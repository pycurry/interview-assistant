import { AppSettings, SpeakerTurn } from '../../shared/types';

export interface STTCallbacks {
  onTranscript: (turn: Partial<SpeakerTurn>) => void;
  onError: (error: Error) => void;
}

export class STTService {
  private activeRecognition: any = null;
  private deepgramSocket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;

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
      // Fallback to Webkit Speech Recognition or Whisper Audio chunking
      this.startWebSpeechRecognition(speaker, callbacks);
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
        callbacks.onError(new Error('Deepgram WebSocket error'));
      };
    } catch (e: any) {
      callbacks.onError(e);
    }
  }

  /**
   * 2. Web Speech API (Native Chromium in Electron, zero setup required)
   */
  private startWebSpeechRecognition(
    speaker: 'interviewer' | 'candidate',
    callbacks: STTCallbacks
  ) {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in this environment.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = res[0].transcript;
          callbacks.onTranscript({
            speaker,
            text,
            isFinal: res.isFinal,
            timestamp: Date.now(),
          });
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('WebSpeech error:', event.error);
        }
      };

      recognition.onend = () => {
        // Automatically restart speech recognition for continuous listening
        try {
          recognition.start();
        } catch (e) {}
      };

      recognition.start();
      this.activeRecognition = recognition;
    } catch (err: any) {
      callbacks.onError(err);
    }
  }

  /**
   * 3. Cloud Whisper Transcription for an audio blob
   */
  public static async transcribeWhisperBlob(blob: Blob, apiKey: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Whisper transcription failed: ${res.statusText}`);
    }

    const json = await res.json();
    return json.text || '';
  }

  public stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.deepgramSocket) {
      this.deepgramSocket.close();
      this.deepgramSocket = null;
    }

    if (this.activeRecognition) {
      this.activeRecognition.stop();
      this.activeRecognition = null;
    }
  }
}
