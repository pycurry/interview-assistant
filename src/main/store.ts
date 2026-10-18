import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { AppSettings } from '../shared/types';

const DEFAULT_SETTINGS: AppSettings = {
  activeProvider: 'gemini',
  activeModel: 'gemini-3.8-flash',
  promptMode: 'coding',
  sttProvider: 'deepgram',
  vadSensitivity: 0.5,
  autoTriggerAI: true,
  opacity: 0.85,
  fontSize: 'base',
  alwaysOnTop: true,
  clickThrough: false,
  stealthExclusionActive: true,
  panicKey: 'CommandOrControl+Alt+H',
  triggerKey: 'CommandOrControl+Alt+Space',
  clearKey: 'CommandOrControl+Alt+C',
  customApiUrl: 'http://localhost:11434/v1',
};

export class SettingsStore {
  private filePath: string;
  private settings: AppSettings;

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else {
      let dir = '';
      try {
        dir = app.getPath('userData');
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const testFile = path.join(dir, '.write-test');
        fs.writeFileSync(testFile, 'ok');
        fs.unlinkSync(testFile);
      } catch (e) {
        dir = process.cwd();
      }
      this.filePath = path.join(dir, 'stealth-assistant-settings.json');
    }
    this.settings = this.loadSettings();
  }

  private loadSettings(): AppSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        if (parsed.activeModel === 'gemini-2.5-flash' || parsed.activeModel === 'gemini-1.5-flash') {
          parsed.activeModel = 'gemini-3.8-flash';
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read existing settings file, falling back to defaults', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...updates };
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save settings to disk', e);
    }
    return this.settings;
  }
}
