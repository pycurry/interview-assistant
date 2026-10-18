import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, SpeakerTurn, PromptMode } from '../../shared/types';
import { LLMService } from '../services/llmService';
import { STTService } from '../services/sttService';
import { 
  X, 
  FlaskConical, 
  Mic, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Volume2, 
  Play, 
  Loader2, 
  Code, 
  LayoutGrid, 
  HeartHandshake 
} from 'lucide-react';

interface TestAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  micLevel: number;
  onInjectTestConversation: (question: string, answer?: string) => void;
}

const SAMPLE_QUESTIONS: { mode: PromptMode; title: string; question: string; icon: any }[] = [
  {
    mode: 'coding',
    title: 'Coding (DSA)',
    icon: Code,
    question: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. What is the optimal time and space complexity?',
  },
  {
    mode: 'system-design',
    title: 'System Design',
    icon: LayoutGrid,
    question: 'How would you design a distributed rate limiter that supports 100,000 requests per second across multiple data centers?',
  },
  {
    mode: 'behavioral',
    title: 'Behavioral (STAR)',
    icon: HeartHandshake,
    question: 'Describe a challenging situation where you had a disagreement with your team lead on an architectural decision. How did you resolve it?',
  },
];

export const TestAssistantModal: React.FC<TestAssistantModalProps> = ({
  isOpen,
  onClose,
  settings,
  micLevel,
  onInjectTestConversation,
}) => {
  const [activeTab, setActiveTab] = useState<'llm' | 'stt'>('llm');

  // LLM Test State
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [customQuestion, setCustomQuestion] = useState(SAMPLE_QUESTIONS[0].question);
  const [isLlmTesting, setIsLlmTesting] = useState(false);
  const [llmTestOutput, setLlmTestOutput] = useState('');
  const [llmTestStatus, setLlmTestStatus] = useState<'idle' | 'streaming' | 'success' | 'error'>('idle');
  const [llmErrorMessage, setLlmErrorMessage] = useState('');
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);

  // STT Test State
  const [isRecordingStt, setIsRecordingStt] = useState(false);
  const [sttTestTranscript, setSttTestTranscript] = useState('');
  const [sttEngine, setSttEngine] = useState('');
  const [sttStatus, setSttStatus] = useState<'idle' | 'listening' | 'transcribing' | 'heard' | 'error'>('idle');
  const [sttError, setSttError] = useState('');
  const [sttLatencyMs, setSttLatencyMs] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const testStreamRef = useRef<MediaStream | null>(null);

  const stopSttTest = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((t) => t.stop());
      testStreamRef.current = null;
    }
    setIsRecordingStt(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopSttTest();
      setLlmTestStatus('idle');
      setLlmTestOutput('');
      setResponseTimeMs(null);
    }
  }, [isOpen]);

  // 1. LLM Test Runner
  const runLlmTest = async () => {
    if (!customQuestion.trim()) return;

    setIsLlmTesting(true);
    setLlmTestStatus('streaming');
    setLlmTestOutput('');
    setLlmErrorMessage('');
    const startTime = Date.now();

    const mockTurns: SpeakerTurn[] = [
      {
        id: 'test-turn-1',
        speaker: 'interviewer',
        text: customQuestion.trim(),
        timestamp: Date.now(),
        isFinal: true,
      },
    ];

    try {
      await LLMService.streamResponse(
        mockTurns,
        settings,
        {
          onToken: (token) => {
            setLlmTestOutput((prev) => prev + token);
          },
          onComplete: (fullText) => {
            setLlmTestStatus('success');
            setIsLlmTesting(false);
            setResponseTimeMs(Date.now() - startTime);
          },
          onError: (err) => {
            setLlmTestStatus('error');
            setLlmErrorMessage(err.message);
            setIsLlmTesting(false);
          },
        }
      );
    } catch (e: any) {
      setLlmTestStatus('error');
      setLlmErrorMessage(e.message);
      setIsLlmTesting(false);
    }
  };

  // 2. STT Test Runner (MediaRecorder + Multimodal AI Model / Whisper)
  const startSttTest = async () => {
    try {
      setSttStatus('listening');
      setIsRecordingStt(true);
      setSttTestTranscript('');
      setSttError('');
      setSttEngine('');
      setSttLatencyMs(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      testStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecordingStt(false);
        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          setSttStatus('idle');
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType });
        if (audioBlob.size < 1200) {
          setSttStatus('error');
          setSttError('Recorded audio snippet was too short. Speak a full phrase and click Stop.');
          return;
        }

        setSttStatus('transcribing');
        const startTime = Date.now();
        try {
          const { text, engine } = await STTService.transcribeAudioBlob(audioBlob, settings);
          const latency = Date.now() - startTime;
          setSttLatencyMs(latency);
          setSttEngine(engine);
          if (text && text.trim().length > 0) {
            setSttTestTranscript(text);
            setSttStatus('heard');
          } else {
            setSttTestTranscript('(No spoken words detected in recording)');
            setSttStatus('heard');
          }
        } catch (err: any) {
          setSttStatus('error');
          setSttError(err.message || 'Speech-to-text transcription failed.');
        } finally {
          if (testStreamRef.current) {
            testStreamRef.current.getTracks().forEach((t) => t.stop());
            testStreamRef.current = null;
          }
        }
      };

      recorder.start(250);
    } catch (err: any) {
      setSttStatus('error');
      setSttError(`Microphone access error: ${err.message}. Please check microphone permissions.`);
      setIsRecordingStt(false);
    }
  };

  const handleApplyToMainHUD = () => {
    onInjectTestConversation(customQuestion, llmTestOutput);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md no-drag">
      <div className="w-full max-w-2xl bg-dark-bg border border-gray-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 bg-dark-surface/80">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Assistant Diagnostic & Test Suite</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 bg-dark-surface/40 text-xs">
          <button
            onClick={() => setActiveTab('llm')}
            className={`flex items-center gap-1.5 px-5 py-2.5 font-medium border-b-2 transition-all ${
              activeTab === 'llm'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Test AI Model Output</span>
          </button>

          <button
            onClick={() => setActiveTab('stt')}
            className={`flex items-center gap-1.5 px-5 py-2.5 font-medium border-b-2 transition-all ${
              activeTab === 'stt'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Test Microphone & Speech-To-Text</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-gray-300">
          {/* TAB 1: LLM TEST */}
          {activeTab === 'llm' && (
            <div className="space-y-4">
              {/* Active Model Info Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-dark-surface border border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-gray-400">Active Provider:</span>
                  <span className="font-semibold text-white uppercase">{settings.activeProvider}</span>
                  <span className="text-gray-500">|</span>
                  <span className="font-mono text-indigo-300">{settings.activeModel}</span>
                </div>
                <div className="text-[11px] text-gray-400">
                  Mode: <span className="text-white capitalize">{settings.promptMode}</span>
                </div>
              </div>

              {/* Sample Question Selector */}
              <div>
                <label className="block text-gray-300 font-semibold mb-2">Select a Sample Interview Question</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {SAMPLE_QUESTIONS.map((q, idx) => {
                    const Icon = q.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedPresetIndex(idx);
                          setCustomQuestion(q.question);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          selectedPresetIndex === idx
                            ? 'border-indigo-500 bg-indigo-500/10 text-white'
                            : 'border-gray-800 bg-dark-surface/50 text-gray-400 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                          <Icon className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{q.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={3}
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Type an interview question to test with..."
                  className="w-full bg-dark-surface border border-gray-700 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Run Test Button */}
              <div className="flex items-center justify-between">
                <button
                  onClick={runLlmTest}
                  disabled={isLlmTesting || !customQuestion.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLlmTesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Streaming Response from {settings.activeModel}...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Test Live AI Response</span>
                    </>
                  )}
                </button>

                {responseTimeMs && (
                  <span className="text-[11px] font-mono text-emerald-400">
                    Latency: {responseTimeMs}ms
                  </span>
                )}
              </div>

              {/* Error Box */}
              {llmErrorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1">
                    <div className="font-semibold">Model Error</div>
                    <p className="text-[11px] mt-0.5">{llmErrorMessage}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Check your API key in Settings or make sure your provider account has active credits.
                    </p>
                  </div>
                </div>
              )}

              {/* Output Preview Box */}
              {llmTestOutput && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-300">Live AI Output:</span>
                    <button
                      onClick={handleApplyToMainHUD}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      Copy to Main Assistant HUD →
                    </button>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/60 border border-gray-800 text-gray-200 text-xs font-mono max-h-[220px] overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                    {llmTestOutput}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SPEECH-TO-TEXT (STT) TEST */}
          {activeTab === 'stt' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-dark-surface border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-semibold">Microphone Input Level:</span>
                  <span className="font-mono text-emerald-400">{Math.round(micLevel * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, micLevel * 300)}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Speak into your microphone. If the green bar moves, your microphone is properly configured.
                </p>
              </div>

              {/* Voice Speech Test */}
              <div className="p-4 rounded-xl bg-dark-surface/60 border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">Test Speech Transcription</div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                    {settings.geminiApiKey ? 'Gemini 3.8 Flash' : settings.groqApiKey ? 'Groq Whisper' : settings.openaiApiKey ? 'OpenAI Whisper' : 'Multimodal STT'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Click the button below and speak a sample interview question (e.g., <em>"Can you explain the difference between processes and threads?"</em>), then click <strong>Stop & Transcribe</strong>.
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={isRecordingStt ? stopSttTest : startSttTest}
                    disabled={sttStatus === 'transcribing'}
                    className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-md transition-all ${
                      isRecordingStt
                        ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                        : sttStatus === 'transcribing'
                        ? 'bg-amber-600 text-white cursor-wait opacity-90'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>
                      {isRecordingStt
                        ? 'Stop & Transcribe'
                        : sttStatus === 'transcribing'
                        ? 'Transcribing Audio...'
                        : 'Record & Test STT'}
                    </span>
                  </button>

                  {sttStatus === 'listening' && (
                    <span className="text-rose-400 text-xs flex items-center gap-1.5 animate-pulse font-medium">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                      Recording your voice... Click 'Stop & Transcribe' when done
                    </span>
                  )}

                  {sttStatus === 'transcribing' && (
                    <span className="text-amber-400 text-xs flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Transcribing via {settings.geminiApiKey ? 'Gemini 3.8 Flash' : 'AI Speech API'}...
                    </span>
                  )}

                  {sttStatus === 'heard' && (
                    <span className="text-emerald-400 text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Transcription complete!
                    </span>
                  )}
                </div>

                {sttError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                    <span>{sttError}</span>
                  </div>
                )}

                {sttTestTranscript && (
                  <div className="space-y-2 p-3 rounded-xl bg-black/60 border border-gray-800">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>Transcribed Speech ({sttEngine || 'AI Speech'}):</span>
                      {sttLatencyMs && <span className="text-emerald-400 font-mono text-[10px]">{sttLatencyMs}ms</span>}
                    </div>
                    <div className="text-emerald-300 font-mono text-xs select-text">
                      "{sttTestTranscript}"
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          setCustomQuestion(sttTestTranscript);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 transition-all flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Use As Test Question</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Simulate Interviewer Audio Button */}
              <div className="p-4 rounded-xl bg-dark-surface/40 border border-gray-800/80 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-indigo-400" />
                    <span>Simulate Interviewer Turn</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Inserts a sample interviewer question into the conversation transcript to test turn-taking.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onInjectTestConversation('Can you walk me through your solution for the two-sum problem?');
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-indigo-300 text-xs font-medium transition-colors"
                >
                  Insert Sample Turn
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 bg-dark-surface/80 text-xs">
          <span className="text-gray-500 text-[11px]">
            Tests execute directly on your configured providers without affecting real interviews.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-medium transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
