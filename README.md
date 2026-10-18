# Stealth Interview Assistant

An AI-powered desktop co-pilot engineered to listen to technical & behavioral interviews in real-time and provide stealth on-screen overlays that are **100% invisible when the entire screen is shared** on video conferencing platforms (Zoom, Google Meet, Microsoft Teams, Discord, Slack, OBS).

---

## 🎯 Key Features

- **Screen-Share Invisibility Engine:**
  - **Windows 10 (2004+) & 11:** Invokes native Win32 API `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` (`0x00000011`). Excludes the window from OS-level Desktop Duplication, GDI, and DXGI capture without rendering any black box.
  - **macOS:** Implements `NSWindowSharingNone` via Cocoa / `setContentProtection(true)`, stripping the window from `CGDisplayStream` and `ScreenCaptureKit` composites.
  - **Invisibility Self-Test Tool:** Built-in live screen mirror preview allowing you to verify that the assistant is invisible before entering your interview.
- **Dual-Channel Audio Separation:**
  - **Interviewer Channel:** Captured via System Audio Loopback (WASAPI on Windows, CoreAudio on macOS, desktop audio capture in Electron).
  - **Candidate Channel:** Captured via standard microphone input with Voice Activity Detection (VAD).
  - Eliminates the need for speaker diarization models and provides separate conversation turn tracking.
- **Multi-Model BYOK (Bring Your Own Key) Support:**
  - **Google Gemini:** `gemini-3.8-flash`, `gemini-3.8-pro`
  - **OpenAI:** `gpt-4o`, `gpt-4o-mini`, `o3-mini`, `o1`
  - **Anthropic Claude:** `claude-3-5-sonnet`, `claude-3-7-sonnet`, `claude-3-5-haiku`
  - **DeepSeek:** `deepseek-chat`, `deepseek-reasoner` (R1)
  - **Groq:** `llama-3.3-70b-versatile`
  - **Ollama / Custom Endpoint:** Any local or private OpenAI-compatible model (`http://localhost:11434/v1`)
- **Specialized Interview Modes:**
  - **LeetCode / Coding Mode:** Fast algorithmic pattern identification, optimal Big-O complexity, step-by-step approach, edge cases, and clean code templates.
  - **System Design Mode:** Traffic & storage estimation, component diagrams, caching patterns, database tradeoffs, and fault tolerance.
  - **Behavioral Mode (STAR):** Structured Situation, Task, Action, and Measurable Result bullet points.
  - **Rapid Teleprompter Mode:** 3-5 punchy talking points you can speak out loud immediately.
- **Stealth HUD Controls:**
  - Always-on-top, borderless, glassmorphic HUD.
  - Configurable opacity slider (30% to 100%).
  - Mouse Click-Through Mode: clicks pass directly into your IDE/browser underneath.
  - Emergency Panic Hide hotkey (`Ctrl + Alt + H`).
  - Instant AI trigger hotkey (`Ctrl + Alt + Space`).
  - Clear transcript hotkey (`Ctrl + Alt + C`).
  - Resume & Job Description grounding for tailored personal answers.

---

## 🏗️ Architecture

```
interview-assistant/
├── package.json
├── tsconfig.json              # Renderer TypeScript config
├── tsconfig.electron.json     # Electron Main / Preload config
├── vite.config.ts             # Vite build configuration
├── tailwind.config.js         # Glassmorphism & stealth HUD themes
├── src/
│   ├── main/
│   │   ├── main.ts            # Electron window management & IPC handlers
│   │   ├── stealth.ts         # Screen-share exclusion engine (Win32 & macOS)
│   │   ├── store.ts           # Local persistent settings & API keys storage
│   │   └── shortcuts.ts       # Global system hotkeys (Panic, Ask AI, Clear)
│   ├── preload/
│   │   ├── preload.ts         # Context bridge exposing safe IPC APIs
│   │   └── electron.d.ts      # TypeScript declarations for window.electronAPI
│   ├── shared/
│   │   ├── types.ts           # Shared interfaces (AIProvider, PromptMode, AppSettings)
│   │   └── electron.d.ts      # Global types for renderer
│   └── renderer/
│       ├── main.tsx           # React entry point
│       ├── App.tsx            # Main state orchestrator
│       ├── index.css          # Glassmorphism styles & drag regions
│       ├── components/
│       │   ├── OverlayHUD.tsx         # Draggable floating HUD top bar with VU meters
│       │   ├── TranscriptFeed.tsx     # Dialogue feed separated by speaker
│       │   ├── AIResponseCard.tsx     # Streaming AI answer card with code formatting
│       │   ├── SettingsModal.tsx      # Comprehensive API keys & preferences modal
│       │   └── ScreenShareTester.tsx  # Invisibility diagnostic verification tool
│       └── services/
│           ├── audioCapture.ts        # Dual-stream loopback + mic capture with VAD
│           ├── sttService.ts          # Deepgram Nova-2 streaming WebSocket & WebSpeech
│           └── llmService.ts          # Unified multi-provider streaming adapter
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ and npm
- (Optional) API keys for your preferred models (Google Gemini, OpenAI, Anthropic, DeepSeek, Groq, or Deepgram)

### 2. Install Dependencies
```bash
npm install
```

### 3. Running in Development
Start the Vite development server and Electron in parallel:
```bash
# Terminal 1: Start Vite frontend
npm run dev

# Terminal 2: Start Electron
npm run electron
```

### 4. Building for Production
```bash
npm run build
npm start
```

---

## 🔒 Invisibility Verification (How to test)

Before starting a live interview:
1. Click the **Video camera icon** on the HUD header bar to open the **Screen Share Invisibility Self-Test**.
2. Select your main display from the dropdown.
3. The mirror video feed displays what remote participants see on a screen share.
4. Verify that while the assistant HUD is visible on your physical screen, it is **completely omitted** from the mirror video feed!

---

## ⌨️ Global Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Alt + H` (or `Cmd + Alt + H`) | **Panic Button:** Instantly hides/unhides the overlay |
| `Ctrl + Alt + Space` (or `Cmd + Alt + Space`) | **Ask AI:** Forces immediate AI guidance on current conversation |
| `Ctrl + Alt + C` (or `Cmd + Alt + C`) | **Clear Screen:** Wipes transcripts and AI response card |
| `Ctrl + Alt + T` (or `Cmd + Alt + T`) | **Click-Through:** Toggles mouse pass-through mode |

---

## 🛡️ Privacy & Security
- **Local Storage:** All API keys and transcripts are stored strictly on your local machine (`userData` directory) and are never routed through any external proxy servers.
- **Ephemeral Audio:** Audio data is processed in-memory for streaming transcription and is immediately discarded.
