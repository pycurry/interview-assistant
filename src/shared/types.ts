export type AIProvider = 
  | 'openai' 
  | 'anthropic' 
  | 'gemini' 
  | 'deepseek' 
  | 'groq' 
  | 'ollama' 
  | 'custom';

export interface ModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  contextWindow?: number;
  description?: string;
}

export type PromptMode = 'coding' | 'system-design' | 'behavioral' | 'rapid-bullet';

export interface SpeakerTurn {
  id: string;
  speaker: 'interviewer' | 'candidate';
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface AIResponse {
  id: string;
  query: string;
  content: string;
  isStreaming: boolean;
  timestamp: number;
  mode: PromptMode;
  model: string;
}

export interface AppSettings {
  // Provider API Keys
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  groqApiKey?: string;
  customApiUrl?: string; // For Ollama or OpenAI-compatible custom endpoint
  customApiKey?: string;
  
  // Model & Prompt Selection
  activeProvider: AIProvider;
  activeModel: string;
  promptMode: PromptMode;
  
  // Custom Resume & Job Context
  resumeText?: string;
  jobDescriptionText?: string;
  
  // Speech-To-Text Settings
  sttProvider: 'gemini' | 'deepgram' | 'whisper-api' | 'groq' | 'local-whisper';
  deepgramApiKey?: string;
  vadSensitivity: number; // 0.0 to 1.0
  autoTriggerAI: boolean; // Auto-trigger when interviewer finishes speaking
  
  // Stealth & Overlay Appearance
  opacity: number; // 0.2 to 1.0
  fontSize: 'sm' | 'base' | 'lg';
  alwaysOnTop: boolean;
  clickThrough: boolean;
  stealthExclusionActive: boolean;
  
  // Hotkeys
  panicKey: string; // e.g. "CommandOrControl+Alt+H"
  triggerKey: string; // e.g. "CommandOrControl+Alt+Space"
  clearKey: string; // e.g. "CommandOrControl+Alt+C"
}

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export interface DesktopSource {
  id: string;
  name: string;
  thumbnailUrl: string;
}

export interface SystemStatus {
  stealthSupported: boolean;
  stealthActive: boolean;
  platform: 'win32' | 'darwin' | 'linux';
  audioLoopbackAvailable: boolean;
}
