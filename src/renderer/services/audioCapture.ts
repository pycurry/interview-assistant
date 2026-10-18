export interface AudioLevels {
  micLevel: number; // 0 to 1
  systemLevel: number; // 0 to 1
}

export interface AudioCaptureCallbacks {
  onLevels?: (levels: AudioLevels) => void;
  onInterviewerSpeechStart?: () => void;
  onInterviewerSpeechEnd?: (audioBlob?: Blob) => void;
  onCandidateSpeechStart?: () => void;
  onCandidateSpeechEnd?: () => void;
  onError?: (err: Error) => void;
}

export class DualAudioCaptureService {
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;

  private micAnalyser: AnalyserNode | null = null;
  private systemAnalyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  private isInterviewerSpeaking = false;
  private isCandidateSpeaking = false;
  private interviewerSilenceTimer: any = null;
  private candidateSilenceTimer: any = null;

  private callbacks: AudioCaptureCallbacks;
  private sensitivity: number = 0.5; // 0 to 1

  constructor(callbacks: AudioCaptureCallbacks) {
    this.callbacks = callbacks;
  }

  public setSensitivity(sensitivity: number) {
    this.sensitivity = Math.max(0.1, Math.min(1.0, sensitivity));
  }

  /**
   * Initializes both Microphone and System Audio loopback.
   */
  public async start(systemSourceId?: string): Promise<boolean> {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      // 1. Microphone capture (Candidate)
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const micSource = this.audioCtx.createMediaStreamSource(this.micStream);
      this.micAnalyser = this.audioCtx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      micSource.connect(this.micAnalyser);

      // 2. System Audio Loopback capture (Interviewer)
      // On Electron, desktop audio capture can be obtained via chromeMediaSource: 'desktop'
      try {
        if (systemSourceId) {
          this.systemStream = await (navigator.mediaDevices as any).getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: systemSourceId,
              },
            },
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: systemSourceId,
                maxWidth: 16,
                maxHeight: 16,
                maxFrameRate: 1,
              },
            },
          });
        } else {
          // Attempt default screen loopback audio
          const sources = await window.electronAPI.getDesktopSources();
          const screenSource = sources.find((s: any) => s.id.startsWith('screen:')) || sources[0];

          if (screenSource) {
            this.systemStream = await (navigator.mediaDevices as any).getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: screenSource.id,
                },
              },
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: screenSource.id,
                  maxWidth: 16,
                  maxHeight: 16,
                  maxFrameRate: 1,
                },
              },
            });
          }
        }

        if (this.systemStream && this.systemStream.getAudioTracks().length > 0) {
          const sysSource = this.audioCtx.createMediaStreamSource(this.systemStream);
          this.systemAnalyser = this.audioCtx.createAnalyser();
          this.systemAnalyser.fftSize = 256;
          sysSource.connect(this.systemAnalyser);
        }
      } catch (sysErr) {
        console.warn('System audio loopback not directly captured (user can test via Mic or select screen source):', sysErr);
      }

      this.startVADLoop();
      return true;
    } catch (err: any) {
      this.callbacks.onError?.(err);
      return false;
    }
  }

  public stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.systemStream) {
      this.systemStream.getTracks().forEach((t) => t.stop());
      this.systemStream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  private startVADLoop() {
    const micData = new Uint8Array(this.micAnalyser ? this.micAnalyser.frequencyBinCount : 0);
    const sysData = new Uint8Array(this.systemAnalyser ? this.systemAnalyser.frequencyBinCount : 0);

    const threshold = (1.0 - this.sensitivity) * 0.15 + 0.02; // dynamic threshold based on sensitivity

    const checkAudio = () => {
      let micRms = 0;
      let sysRms = 0;

      if (this.micAnalyser) {
        this.micAnalyser.getByteFrequencyData(micData);
        let sum = 0;
        for (let i = 0; i < micData.length; i++) {
          sum += micData[i];
        }
        micRms = sum / (micData.length * 255);
      }

      if (this.systemAnalyser) {
        this.systemAnalyser.getByteFrequencyData(sysData);
        let sum = 0;
        for (let i = 0; i < sysData.length; i++) {
          sum += sysData[i];
        }
        sysRms = sum / (sysData.length * 255);
      }

      this.callbacks.onLevels?.({ micLevel: micRms, systemLevel: sysRms });

      // Detect Interviewer speech turns (System Audio Loopback)
      if (sysRms > threshold) {
        if (!this.isInterviewerSpeaking) {
          this.isInterviewerSpeaking = true;
          this.callbacks.onInterviewerSpeechStart?.();
        }
        clearTimeout(this.interviewerSilenceTimer);
        this.interviewerSilenceTimer = setTimeout(() => {
          this.isInterviewerSpeaking = false;
          this.callbacks.onInterviewerSpeechEnd?.();
        }, 1200); // 1.2 seconds of silence = end of question
      }

      // Detect Candidate speech turns (Mic)
      if (micRms > threshold) {
        if (!this.isCandidateSpeaking) {
          this.isCandidateSpeaking = true;
          this.callbacks.onCandidateSpeechStart?.();
        }
        clearTimeout(this.candidateSilenceTimer);
        this.candidateSilenceTimer = setTimeout(() => {
          this.isCandidateSpeaking = false;
          this.callbacks.onCandidateSpeechEnd?.();
        }, 1000);
      }

      this.animationFrameId = requestAnimationFrame(checkAudio);
    };

    this.animationFrameId = requestAnimationFrame(checkAudio);
  }

  public getMicStream(): MediaStream | null {
    return this.micStream;
  }

  public getSystemStream(): MediaStream | null {
    return this.systemStream;
  }
}
