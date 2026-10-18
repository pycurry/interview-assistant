import { AppSettings, SpeakerTurn } from '../../shared/types';

export interface STTCallbacks {
  onTranscript: (turn: Partial<SpeakerTurn>) => void;
  onError: (error: Error) => void;
}

export interface TranscriptionResult {
  text: string;
  engine: string;
}

export class STTService {
  private activeRecognition: any = null;
  private deepgramSocket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunkSliceInterval: any = null;

  /**
   * Starts real-time speech recognition for a specific stream and speaker role.
   */
  public startSpeechRecognition(
    stream: MediaStream,
    speaker: 'interviewer' | 'candidate',
    settings: AppSettings,
    callbacks: STTCallbacks
  ) {
    if (settings.sttProvider === 'deepgram' && settings.deepgramApiKey) {
      this.startDeepgramStreaming(stream, speaker, settings.deepgramApiKey, callbacks);
    } else {
      // Robust chunked recording using available AI provider (Gemini, Whisper, Groq)
      // This completely eliminates the Electron webkitSpeechRecognition network error.
      this.startChunkedAudioRecognition(stream, speaker, settings, callbacks);
    }
  }

  /**
   * 1. Deepgram Nova-2 Real-Time WebSocket Streaming (Lowest Latency ~300ms)
   */
  private startDeepgramStreaming(
    stream: MediaStream,
    speaker: 'interviewer' | 'candidate',
    apiKey: string,
    callbacks: STTCallbacks
  ) {
    try {
      const url = 'wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true';
      this.deepgramSocket = new WebSocket(url, ['token', apiKey]);

      this.deepgramSocket.onopen = () => {
        this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && this.deepgramSocket?.readyState === WebSocket.OPEN) {
            this.deepgramSocket.send(event.data);
          }
        };
        this.mediaRecorder.start(250); // Send 250ms chunks
      };

      this.deepgramSocket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          const transcript = data.channel?.alternatives?.[0]?.transcript;
          if (transcript && transcript.trim().length > 0) {
            callbacks.onTranscript({
              speaker,
              text: transcript,
              isFinal: Boolean(data.is_final),
              timestamp: Date.now(),
            });
          }
        } catch (e) {}
      };

      this.deepgramSocket.onerror = (err) => {
        console.error('Deepgram WebSocket error:', err);
        callbacks.onError(new Error('Deepgram WebSocket connection error'));
      };
    } catch (e: any) {
      callbacks.onError(e);
    }
  }

  /**
   * 2. Chunked Audio Recognition via MediaRecorder & Multimodal AI Models
   * Replaces Chromium webkitSpeechRecognition which is disabled in Electron.
   */
  private startChunkedAudioRecognition(
    stream: MediaStream,
    speaker: 'interviewer' | 'candidate',
    settings: AppSettings,
    callbacks: STTCallbacks
  ) {
    try {
      let chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      this.mediaRecorder = recorder;
      let isProcessing = false;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Periodic slice transcription every 4 seconds
      this.chunkSliceInterval = setInterval(async () => {
        if (recorder.state === 'recording' && chunks.length > 0 && !isProcessing) {
          isProcessing = true;
          const audioBlob = new Blob(chunks, { type: mimeType });
          chunks = []; // reset for next slice

          // Only process audio blobs with voice activity (> 4KB)
          if (audioBlob.size > 4000) {
            try {
              const res = await STTService.transcribeAudioBlob(audioBlob, settings);
              if (res.text && res.text.trim().length > 0) {
                callbacks.onTranscript({
                  speaker,
                  text: res.text.trim(),
                  isFinal: true,
                  timestamp: Date.now(),
                });
              }
            } catch (err: any) {
              console.warn('Chunked transcription notice:', err.message);
            }
          }
          isProcessing = false;
        }
      }, 4000);

      recorder.start(1000);
    } catch (err: any) {
      console.warn('Chunked audio recognition could not start:', err);
      callbacks.onError(err);
    }
  }

  /**
   * 3. Universal Speech-to-Text Transcriber
   * Seamlessly checks for Gemini (Multimodal), Groq (Whisper Turbo), OpenAI (Whisper), or Deepgram.
   */
  public static async transcribeAudioBlob(
    blob: Blob,
    settings: AppSettings
  ): Promise<TranscriptionResult> {
    // 1. Google Gemini Multimodal Audio (Default - Uses candidate's existing Gemini API key)
    if (settings.geminiApiKey) {
      const base64Audio = await STTService.blobToBase64(blob);
      const mimeType = blob.type.split(';')[0] || 'audio/webm';

      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': settings.geminiApiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Audio,
                  },
                },
                {
                  text: 'Transcribe the spoken speech in this audio clip verbatim. Output ONLY the transcribed words with no extra notes or explanation. If there is no speech, output nothing.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 250,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`Gemini transcription error (${res.status}): ${errJson.error?.message || res.statusText}`);
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return { text: rawText, engine: 'Google Gemini 3.8 Flash' };
    }

    // 2. Groq Whisper (Ultra Fast ~180ms)
    if (settings.groqApiKey) {
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-large-v3-turbo');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.groqApiKey}` },
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`Groq Whisper error (${res.status}): ${errJson.error?.message || res.statusText}`);
      }

      const json = await res.json();
      return { text: (json.text || '').trim(), engine: 'Groq Whisper Large v3' };
    }

    // 3. OpenAI Whisper Cloud API
    if (settings.openaiApiKey) {
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.openaiApiKey}` },
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`OpenAI Whisper error (${res.status}): ${errJson.error?.message || res.statusText}`);
      }

      const json = await res.json();
      return { text: (json.text || '').trim(), engine: 'OpenAI Whisper-1' };
    }

    // 4. Deepgram Pre-recorded Audio API
    if (settings.deepgramApiKey) {
      const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${settings.deepgramApiKey}`,
          'Content-Type': blob.type || 'audio/webm',
        },
        body: blob,
      });

      if (!res.ok) {
        throw new Error(`Deepgram transcription failed (${res.status}): ${res.statusText}`);
      }

      const json = await res.json();
      const transcript = json.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      return { text: transcript.trim(), engine: 'Deepgram Nova-2' };
    }

    throw new Error('No API key configured for speech recognition. Please enter a Gemini, OpenAI, Groq, or Deepgram API key in Settings.');
  }

  /**
   * Helper to convert Blob to base64
   */
  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  public stop() {
    if (this.chunkSliceInterval) {
      clearInterval(this.chunkSliceInterval);
      this.chunkSliceInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
      this.mediaRecorder = null;
    }

    if (this.deepgramSocket) {
      try {
        this.deepgramSocket.close();
      } catch (e) {}
      this.deepgramSocket = null;
    }

    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch (e) {}
      this.activeRecognition = null;
    }
  }
}
