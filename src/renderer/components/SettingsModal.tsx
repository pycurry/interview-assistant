import React, { useState } from 'react';
import { AIProvider, AppSettings, PromptMode } from '../../shared/types';
import { X, Key, Sliders, ShieldCheck, FileText, Mic, Check, Eye, EyeOff } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (updated: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'models' | 'modes' | 'stealth' | 'context' | 'audio'>('models');
  const [formState, setFormState] = useState<AppSettings>(settings);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const toggleShowKey = (id: string) => {
    setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = () => {
    onSave(formState);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 800);
  };

  const providers: { id: AIProvider; label: string; models: string[] }[] = [
    {
      id: 'gemini',
      label: 'Google Gemini',
      models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'],
    },
    {
      id: 'openai',
      label: 'OpenAI',
      models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
    },
    {
      id: 'anthropic',
      label: 'Anthropic Claude',
      models: ['claude-3-5-sonnet-20241022', 'claude-3-7-sonnet', 'claude-3-5-haiku-20241022'],
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
    },
    {
      id: 'groq',
      label: 'Groq (Ultra-Fast)',
      models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    },
    {
      id: 'ollama',
      label: 'Ollama / Local LLM',
      models: ['llama3.2', 'qwen2.5-coder', 'deepseek-coder'],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm no-drag">
      <div className="w-full max-w-xl bg-dark-bg border border-gray-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 bg-dark-surface/60">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Assistant Preferences & API Keys</h2>
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
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-medium border-b-2 transition-all ${
              activeTab === 'models'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>AI Models & Keys</span>
          </button>

          <button
            onClick={() => setActiveTab('modes')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-medium border-b-2 transition-all ${
              activeTab === 'modes'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Interview Mode</span>
          </button>

          <button
            onClick={() => setActiveTab('stealth')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-medium border-b-2 transition-all ${
              activeTab === 'stealth'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Stealth & Overlay</span>
          </button>

          <button
            onClick={() => setActiveTab('context')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-medium border-b-2 transition-all ${
              activeTab === 'context'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Resume & Context</span>
          </button>

          <button
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-1.5 px-4 py-2.5 font-medium border-b-2 transition-all ${
              activeTab === 'audio'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Audio & STT</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-gray-300">
          {/* TAB 1: AI Models & Keys */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Active AI Provider</label>
                <div className="grid grid-cols-3 gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setFormState((prev) => ({
                          ...prev,
                          activeProvider: p.id,
                          activeModel: p.models[0],
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                        formState.activeProvider === p.id
                          ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                          : 'border-gray-800 bg-dark-surface/50 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Model Selector */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Active Model</label>
                <select
                  value={formState.activeModel}
                  onChange={(e) => setFormState({ ...formState, activeModel: e.target.value })}
                  className="w-full bg-dark-surface border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  {providers
                    .find((p) => p.id === formState.activeProvider)
                    ?.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                </select>
              </div>

              {/* API Keys Configuration */}
              <div className="pt-2 border-t border-gray-800 space-y-3">
                <div className="font-semibold text-gray-200">Configure API Keys (Saved locally on your machine)</div>

                {/* Gemini Key */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Google Gemini API Key</span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      Get Key
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey['gemini'] ? 'text' : 'password'}
                      value={formState.geminiApiKey || ''}
                      onChange={(e) => setFormState({ ...formState, geminiApiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full bg-dark-surface border border-gray-700 rounded-lg px-3 py-1.5 pr-9 text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('gemini')}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-white"
                    >
                      {showKey['gemini'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* OpenAI Key */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">OpenAI API Key</span>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      Get Key
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey['openai'] ? 'text' : 'password'}
                      value={formState.openaiApiKey || ''}
                      onChange={(e) => setFormState({ ...formState, openaiApiKey: e.target.value })}
                      placeholder="sk-proj-..."
                      className="w-full bg-dark-surface border border-gray-700 rounded-lg px-3 py-1.5 pr-9 text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('openai')}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-white"
                    >
                      {showKey['openai'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Anthropic Key */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400">Anthropic Claude API Key</span>
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      Get Key
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey['anthropic'] ? 'text' : 'password'}
                      value={formState.anthropicApiKey || ''}
                      onChange={(e) => setFormState({ ...formState, anthropicApiKey: e.target.value })}
                      placeholder="sk-ant-..."
                      className="w-full bg-dark-surface border border-gray-700 rounded-lg px-3 py-1.5 pr-9 text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('anthropic')}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-white"
                    >
                      {showKey['anthropic'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* DeepSeek Key */}
                <div>
                  <span className="text-gray-400 block mb-1">DeepSeek API Key</span>
                  <input
                    type={showKey['deepseek'] ? 'text' : 'password'}
                    value={formState.deepseekApiKey || ''}
                    onChange={(e) => setFormState({ ...formState, deepseekApiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full bg-dark-surface border border-gray-700 rounded-lg px-3 py-1.5 text-white font-mono"
                  />
                </div>

                {/* Custom / Ollama endpoint */}
                <div>
                  <span className="text-gray-400 block mb-1">Ollama / Custom Endpoint URL</span>
                  <input
                    type="text"
                    value={formState.customApiUrl || ''}
                    onChange={(e) => setFormState({ ...formState, customApiUrl: e.target.value })}
                    placeholder="http://localhost:11434/v1"
                    className="w-full bg-dark-surface border border-gray-700 rounded-lg px-3 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Interview Mode */}
          {activeTab === 'modes' && (
            <div className="space-y-3">
              <label className="block text-gray-300 font-semibold">Select Primary Interview Mode</label>
              <div className="space-y-2">
                {[
                  {
                    id: 'coding',
                    title: 'LeetCode / Coding Mode',
                    desc: 'Outputs algorithmic patterns, step-by-step approach, time/space complexity, and clean code skeleton.',
                  },
                  {
                    id: 'system-design',
                    title: 'System Design Architecture',
                    desc: 'Produces high-level architectural components, back-of-envelope calculations, scalability tradeoffs, and caching patterns.',
                  },
                  {
                    id: 'behavioral',
                    title: 'Behavioral Questions (STAR Method)',
                    desc: 'Generates structured answers using Situation, Task, Action, and Measurable Results.',
                  },
                  {
                    id: 'rapid-bullet',
                    title: 'Rapid Teleprompter Bullets',
                    desc: 'Ultra-concise talking points you can say out loud in real-time.',
                  },
                ].map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setFormState({ ...formState, promptMode: m.id as PromptMode })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      formState.promptMode === m.id
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-gray-800 bg-dark-surface/40 hover:border-gray-700 text-gray-400'
                    }`}
                  >
                    <div className="font-semibold text-white flex items-center justify-between">
                      <span>{m.title}</span>
                      {formState.promptMode === m.id && <Check className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Stealth & Overlay */}
          {activeTab === 'stealth' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>Native Screen Capture Exclusion Active</span>
                </div>
                <p className="text-[11px] text-gray-300 mt-1">
                  On Windows 10/11 and macOS, native system calls (<code>WDA_EXCLUDEFROMCAPTURE</code> and <code>NSWindowSharingNone</code>) exclude this window from screen shares, recordings, and browser tab shares.
                </p>
              </div>

              {/* Opacity slider */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-gray-300 font-semibold">Overlay Opacity</label>
                  <span className="font-mono text-indigo-400">{Math.round((formState.opacity || 0.85) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.0"
                  step="0.05"
                  value={formState.opacity || 0.85}
                  onChange={(e) => setFormState({ ...formState, opacity: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Font Size */}
              <div>
                <label className="text-gray-300 font-semibold block mb-1">Font Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['sm', 'base', 'lg'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFormState({ ...formState, fontSize: size })}
                      className={`py-1.5 rounded-lg border uppercase tracking-wider font-semibold ${
                        formState.fontSize === size
                          ? 'border-indigo-500 bg-indigo-500/20 text-white'
                          : 'border-gray-800 bg-dark-surface text-gray-400'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Click-through toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-dark-surface border border-gray-800">
                <div>
                  <div className="font-semibold text-white">Click-Through Mode</div>
                  <div className="text-[11px] text-gray-400">Mouse clicks pass directly through the overlay to your IDE/browser.</div>
                </div>
                <input
                  type="checkbox"
                  checked={formState.clickThrough || false}
                  onChange={(e) => setFormState({ ...formState, clickThrough: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4 cursor-pointer"
                />
              </div>

              {/* Always on top toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-dark-surface border border-gray-800">
                <div>
                  <div className="font-semibold text-white">Always On Top</div>
                  <div className="text-[11px] text-gray-400">Keeps overlay floating above all other windows and full-screen apps.</div>
                </div>
                <input
                  type="checkbox"
                  checked={formState.alwaysOnTop ?? true}
                  onChange={(e) => setFormState({ ...formState, alwaysOnTop: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Resume & Job Context */}
          {activeTab === 'context' && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Candidate Resume / Experience Highlights</label>
                <p className="text-[11px] text-gray-400 mb-1.5">
                  Paste bullet points of your past projects, metrics, and tech stack. The AI will ground behavioral and technical answers in your real experience.
                </p>
                <textarea
                  rows={5}
                  value={formState.resumeText || ''}
                  onChange={(e) => setFormState({ ...formState, resumeText: e.target.value })}
                  placeholder="- Senior backend engineer with 5 years experience in Go, Kubernetes, Kafka...&#10;- Led migration of payment service reducing p99 latency by 40%..."
                  className="w-full bg-dark-surface border border-gray-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Target Job Description & Role</label>
                <textarea
                  rows={4}
                  value={formState.jobDescriptionText || ''}
                  onChange={(e) => setFormState({ ...formState, jobDescriptionText: e.target.value })}
                  placeholder="Paste key responsibilities and qualifications for the role..."
                  className="w-full bg-dark-surface border border-gray-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* TAB 5: Audio & Speech-to-Text */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">STT Transcription Engine</label>
                <select
                  value={formState.sttProvider}
                  onChange={(e) => setFormState({ ...formState, sttProvider: e.target.value as any })}
                  className="w-full bg-dark-surface border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="deepgram">Deepgram Nova-2 (Lowest latency WebSocket streaming, ~300ms)</option>
                  <option value="whisper-api">OpenAI Whisper Cloud API</option>
                  <option value="local-whisper">Built-in Web Speech API (Free / Zero Setup)</option>
                </select>
              </div>

              {formState.sttProvider === 'deepgram' && (
                <div>
                  <span className="text-gray-400 block mb-1">Deepgram API Key</span>
                  <input
                    type="password"
                    value={formState.deepgramApiKey || ''}
                    onChange={(e) => setFormState({ ...formState, deepgramApiKey: e.target.value })}
                    placeholder="Enter Deepgram key for live streaming transcription..."
                    className="w-full bg-dark-surface border border-gray-700 rounded-lg px-3 py-1.5 text-white font-mono"
                  />
                </div>
              )}

              {/* VAD Sensitivity */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-gray-300 font-semibold">Voice Activity Detection (VAD) Sensitivity</label>
                  <span className="font-mono text-indigo-400">{Math.round((formState.vadSensitivity || 0.5) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={formState.vadSensitivity || 0.5}
                  onChange={(e) => setFormState({ ...formState, vadSensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Auto Trigger AI */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-dark-surface border border-gray-800">
                <div>
                  <div className="font-semibold text-white">Auto-Trigger AI on Question End</div>
                  <div className="text-[11px] text-gray-400">Automatically sends the interviewer's question to the AI after 1.2s of silence.</div>
                </div>
                <input
                  type="checkbox"
                  checked={formState.autoTriggerAI ?? true}
                  onChange={(e) => setFormState({ ...formState, autoTriggerAI: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-800 bg-dark-surface/60">
          <div className="text-[11px] text-gray-400">
            {savedNotice ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Settings saved!
              </span>
            ) : (
              'All API keys remain local on this machine.'
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
