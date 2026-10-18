import React from 'react';
import { 
  ShieldCheck, 
  Settings, 
  EyeOff, 
  MousePointer, 
  Video, 
  Mic, 
  Volume2, 
  Minus, 
  X, 
  Sparkles,
  Trash2,
  FlaskConical
} from 'lucide-react';
import { AppSettings, PromptMode } from '../../shared/types';
import { StealthStatus } from '../../main/stealth';

interface OverlayHUDProps {
  settings: AppSettings;
  stealthStatus: StealthStatus | null;
  micLevel: number;
  systemLevel: number;
  isListening: boolean;
  isClickThrough: boolean;
  onToggleClickThrough: () => void;
  onOpenSettings: () => void;
  onOpenTester: () => void;
  onOpenTestModal: () => void;
  onTriggerAI: () => void;
  onClear: () => void;
  onMinimize: () => void;
  onHide: () => void;
  onClose: () => void;
}

export const OverlayHUD: React.FC<OverlayHUDProps> = ({
  settings,
  stealthStatus,
  micLevel,
  systemLevel,
  isListening,
  isClickThrough,
  onToggleClickThrough,
  onOpenSettings,
  onOpenTester,
  onOpenTestModal,
  onTriggerAI,
  onClear,
  onMinimize,
  onHide,
  onClose,
}) => {
  const getModeShortName = (mode: PromptMode) => {
    switch (mode) {
      case 'coding':
        return 'DSA / Code';
      case 'system-design':
        return 'System Design';
      case 'behavioral':
        return 'STAR';
      default:
        return 'Bullet Hint';
    }
  };

  return (
    <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-800/80 bg-dark-bg/95 rounded-t-2xl drag-region select-none text-xs">
      {/* Left: Branding & Stealth Shield */}
      <div className="flex items-center gap-2">
        <div
          title={stealthStatus?.active ? 'Stealth Exclusion Active (Invisible to screen share)' : 'Stealth Status'}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
            stealthStatus?.active
              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
              : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
          }`}
        >
          <ShieldCheck className="w-3 h-3" />
          <span>{stealthStatus?.active ? 'Stealth ON' : 'Stealth Check'}</span>
        </div>

        {/* Active model & mode */}
        <span className="font-semibold text-gray-200">{settings.activeModel}</span>
        <span className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-indigo-300 font-medium">
          {getModeShortName(settings.promptMode)}
        </span>
      </div>

      {/* Center: Audio VU Monitors */}
      <div className="flex items-center gap-2.5 px-3 py-0.5 rounded-full bg-dark-surface/80 border border-gray-800 no-drag">
        {/* System audio (Interviewer) */}
        <div className="flex items-center gap-1" title="Interviewer Audio Loopback">
          <Volume2 className="w-3 h-3 text-indigo-400" />
          <div className="w-8 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-75"
              style={{ width: `${Math.min(100, systemLevel * 300)}%` }}
            />
          </div>
        </div>

        {/* Mic audio (You) */}
        <div className="flex items-center gap-1" title="Your Microphone">
          <Mic className="w-3 h-3 text-emerald-400" />
          <div className="w-8 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${Math.min(100, micLevel * 300)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right: Actions and window controls */}
      <div className="flex items-center gap-1 no-drag">
        {/* Force AI trigger button */}
        <button
          onClick={onTriggerAI}
          title="Ask AI for answer (Ctrl+Alt+Space)"
          className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/60 border border-indigo-500/40 text-indigo-300 hover:text-white transition-all flex items-center gap-1"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold hidden sm:inline">Ask AI</span>
        </button>

        {/* Clear conversation button */}
        <button
          onClick={onClear}
          title="Clear transcript & screen (Ctrl+Alt+C)"
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Screen share tester */}
        <button
          onClick={onOpenTester}
          title="Verify Screen Share Invisibility"
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <Video className="w-3.5 h-3.5" />
        </button>

        {/* Test Speech STT & AI Output */}
        <button
          onClick={onOpenTestModal}
          title="Test Transcription (STT) & AI Output"
          className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-200 transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
        </button>

        {/* Click-through toggle */}
        <button
          onClick={onToggleClickThrough}
          title={isClickThrough ? 'Click-Through: Enabled (Clicks pass through)' : 'Click-Through: Disabled'}
          className={`p-1.5 rounded-lg transition-colors ${
            isClickThrough ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" />
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="API Keys & Preferences"
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Panic / Quick Hide button */}
        <button
          onClick={onHide}
          title="Panic Hide Overlay (Ctrl+Alt+H)"
          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 transition-colors"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3.5 bg-gray-800 mx-0.5" />

        {/* Minimize */}
        <button
          onClick={onMinimize}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
        >
          <Minus className="w-3 h-3" />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-rose-600/80 text-gray-400 hover:text-white"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
