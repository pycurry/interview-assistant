import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, SpeakerTurn, AIResponse } from '../shared/types';
import { StealthStatus } from '../main/stealth';
import { OverlayHUD } from './components/OverlayHUD';
import { TranscriptFeed } from './components/TranscriptFeed';
import { AIResponseCard } from './components/AIResponseCard';
import { SettingsModal } from './components/SettingsModal';
import { ScreenShareTester } from './components/ScreenShareTester';
import { TestAssistantModal } from './components/TestAssistantModal';
import { DualAudioCaptureService } from './services/audioCapture';
import { STTService } from './services/sttService';
import { LLMService } from './services/llmService';
import { Send, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [stealthStatus, setStealthStatus] = useState<StealthStatus | null>(null);
  const [turns, setTurns] = useState<SpeakerTurn[]>([]);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);

  // Audio levels
  const [micLevel, setMicLevel] = useState(0);
  const [systemLevel, setSystemLevel] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isClickThrough, setIsClickThrough] = useState(false);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTesterOpen, setIsTesterOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // Manual query input fallback
  const [manualInput, setManualInput] = useState('');

  // Refs for services
  const audioCaptureRef = useRef<DualAudioCaptureService | null>(null);
  const sttServiceRef = useRef<STTService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnsRef = useRef<SpeakerTurn[]>([]);
  turnsRef.current = turns;

  // 1. Initial Load
  useEffect(() => {
    async function init() {
      if (window.electronAPI) {
        const loadedSettings = await window.electronAPI.getSettings();
        setSettings(loadedSettings);

        const status = await window.electronAPI.getStealthStatus();
        setStealthStatus(status);

        // Register hotkey listeners
        window.electronAPI.onHotkeyTriggerAI(() => {
          handleTriggerAI();
        });

        window.electronAPI.onHotkeyClear(() => {
          handleClear();
        });

        window.electronAPI.onClickThroughChanged((enabled: boolean) => {
          setIsClickThrough(enabled);
        });
      }
    }
    init();
  }, []);

  // 2. Initialize Audio & STT when settings are ready
  useEffect(() => {
    if (!settings) return;

    const audioService = new DualAudioCaptureService({
      onLevels: (levels) => {
        setMicLevel(levels.micLevel);
        setSystemLevel(levels.systemLevel);
      },
      onInterviewerSpeechEnd: () => {
        // Auto-trigger AI if enabled in settings
        if (settings.autoTriggerAI && turnsRef.current.length > 0) {
          handleTriggerAI();
        }
      },
      onError: (err) => console.warn('Audio service error:', err),
    });

    audioService.setSensitivity(settings.vadSensitivity || 0.5);
    audioService.start().then((started) => {
      setIsListening(started);

      if (started) {
        const stt = new STTService();
        sttServiceRef.current = stt;

        const micStream = audioService.getMicStream();
        if (micStream) {
          stt.startSpeechRecognition(micStream, 'candidate', settings, {
            onTranscript: handleNewTranscript,
            onError: (e) => console.warn('Candidate STT error:', e),
          });
        }

        const sysStream = audioService.getSystemStream();
        if (sysStream) {
          stt.startSpeechRecognition(sysStream, 'interviewer', settings, {
            onTranscript: handleNewTranscript,
            onError: (e) => console.warn('Interviewer STT error:', e),
          });
        }
      }
    });

    audioCaptureRef.current = audioService;

    return () => {
      audioService.stop();
      sttServiceRef.current?.stop();
    };
  }, [settings?.sttProvider, settings?.deepgramApiKey]);

  // Handle incoming transcripts
  const handleNewTranscript = (partial: Partial<SpeakerTurn>) => {
    if (!partial.text || partial.text.trim().length === 0) return;

    setTurns((prev) => {
      const last = prev[prev.length - 1];
      // If same speaker and recent, append or update
      if (last && last.speaker === partial.speaker && !last.isFinal) {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          text: partial.text || last.text,
          isFinal: Boolean(partial.isFinal),
        };
        return updated;
      }

      // New turn
      const newTurn: SpeakerTurn = {
        id: Math.random().toString(36).substring(7),
        speaker: partial.speaker || 'interviewer',
        text: partial.text || '',
        timestamp: partial.timestamp || Date.now(),
        isFinal: Boolean(partial.isFinal),
      };
      return [...prev.slice(-15), newTurn]; // Keep last 15 turns
    });
  };

  // Trigger AI Generation
  const handleTriggerAI = async (customPrompt?: string) => {
    if (!settings) return;

    let currentTurns = turnsRef.current;

    if (customPrompt) {
      const manualTurn: SpeakerTurn = {
        id: Math.random().toString(36).substring(7),
        speaker: 'interviewer',
        text: customPrompt,
        timestamp: Date.now(),
        isFinal: true,
      };
      currentTurns = [...currentTurns, manualTurn];
      setTurns(currentTurns);
    }

    if (currentTurns.length === 0) return;

    // Abort any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const responseId = Math.random().toString(36).substring(7);
    const newAiResponse: AIResponse = {
      id: responseId,
      query: currentTurns[currentTurns.length - 1].text,
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
      mode: settings.promptMode,
      model: settings.activeModel,
    };
    setAiResponse(newAiResponse);

    await LLMService.streamResponse(
      currentTurns,
      settings,
      {
        onToken: (token) => {
          setAiResponse((prev) => {
            if (!prev || prev.id !== responseId) return prev;
            return {
              ...prev,
              content: prev.content + token,
            };
          });
        },
        onComplete: (fullText) => {
          setAiResponse((prev) => {
            if (!prev || prev.id !== responseId) return prev;
            return {
              ...prev,
              content: fullText || prev.content,
              isStreaming: false,
            };
          });
        },
        onError: (err) => {
          setAiResponse((prev) => {
            if (!prev || prev.id !== responseId) return prev;
            return {
              ...prev,
              content: `Error: ${err.message}`,
              isStreaming: false,
            };
          });
        },
      },
      controller.signal
    );
  };

  const handleClear = () => {
    setTurns([]);
    setAiResponse(null);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const query = manualInput.trim();
    setManualInput('');
    handleTriggerAI(query);
  };

  const handleSaveSettings = async (updated: Partial<AppSettings>) => {
    if (window.electronAPI) {
      const saved = await window.electronAPI.updateSettings(updated);
      setSettings(saved);
      audioCaptureRef.current?.setSensitivity(saved.vadSensitivity || 0.5);
    }
  };

  const handleToggleClickThrough = async () => {
    if (window.electronAPI) {
      const newState = !isClickThrough;
      await window.electronAPI.setClickThrough(newState);
      setIsClickThrough(newState);
    }
  };

  const handleInjectTestConversation = (question: string, answer?: string) => {
    const testTurn: SpeakerTurn = {
      id: Math.random().toString(36).substring(7),
      speaker: 'interviewer',
      text: question,
      timestamp: Date.now(),
      isFinal: true,
    };
    setTurns((prev) => [...prev.slice(-14), testTurn]);

    if (answer) {
      setAiResponse({
        id: Math.random().toString(36).substring(7),
        query: question,
        content: answer,
        isStreaming: false,
        timestamp: Date.now(),
        mode: settings?.promptMode || 'coding',
        model: settings?.activeModel || 'gemini-3.8-flash',
      });
    } else {
      handleTriggerAI(question);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen bg-transparent">
        <div className="hud-glass p-4 rounded-xl text-xs text-gray-300">
          Loading Stealth Assistant...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen hud-glass rounded-2xl overflow-hidden shadow-2xl border border-gray-800/80">
      {/* Top HUD Control Bar */}
      <OverlayHUD
        settings={settings}
        stealthStatus={stealthStatus}
        micLevel={micLevel}
        systemLevel={systemLevel}
        isListening={isListening}
        isClickThrough={isClickThrough}
        onToggleClickThrough={handleToggleClickThrough}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTester={() => setIsTesterOpen(true)}
        onOpenTestModal={() => setIsTestModalOpen(true)}
        onTriggerAI={() => handleTriggerAI()}
        onClear={handleClear}
        onMinimize={() => window.electronAPI?.minimizeWindow()}
        onHide={() => window.electronAPI?.hideWindow()}
        onClose={() => window.electronAPI?.closeWindow()}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Real-time Dialogue / Transcript */}
        <TranscriptFeed turns={turns} fontSize={settings.fontSize} />

        {/* AI Answer & Guidance HUD Card */}
        <AIResponseCard
          response={aiResponse}
          onRegenerate={() => handleTriggerAI()}
          onClear={() => setAiResponse(null)}
          onRunQuickTest={() => handleTriggerAI('Can you explain how a Hash Map handles collisions, and compare chaining vs open addressing?')}
          fontSize={settings.fontSize}
        />
      </div>

      {/* Manual Quick Query Input Bar */}
      <form
        onSubmit={handleManualSubmit}
        className="px-3.5 py-2.5 bg-dark-surface/90 border-t border-gray-800/80 flex items-center gap-2 no-drag"
      >
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Ask AI or paste question manually (e.g. 'Solve 3Sum in O(N^2)')..."
          className="flex-1 bg-dark-bg/80 border border-gray-700/60 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm flex items-center justify-center"
          title="Submit question"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <ScreenShareTester
        isOpen={isTesterOpen}
        onClose={() => setIsTesterOpen(false)}
        stealthStatus={stealthStatus}
      />

      <TestAssistantModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        settings={settings}
        micLevel={micLevel}
        onInjectTestConversation={handleInjectTestConversation}
      />
    </div>
  );
};
