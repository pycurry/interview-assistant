import { AppSettings, DesktopSource, SystemStatus } from './types';
import { StealthStatus } from '../main/stealth';

export interface IElectronAPI {
  getStealthStatus: () => Promise<StealthStatus>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>;
  setClickThrough: (ignore: boolean) => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  getDesktopSources: () => Promise<DesktopSource[]>;
  onHotkeyTriggerAI: (callback: () => void) => () => void;
  onHotkeyClear: (callback: () => void) => () => void;
  onClickThroughChanged: (callback: (enabled: boolean) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
