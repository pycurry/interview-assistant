import { contextBridge, ipcRenderer } from 'electron';
import { AppSettings, DesktopSource, SystemStatus } from '../shared/types';
import { StealthStatus } from '../main/stealth';

const electronAPI = {
  getStealthStatus: (): Promise<StealthStatus> => {
    return ipcRenderer.invoke('stealth:get-status');
  },

  getSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:get');
  },

  updateSettings: (updates: Partial<AppSettings>): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:update', updates);
  },

  setClickThrough: (ignore: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('window:set-click-through', ignore);
  },

  minimizeWindow: (): Promise<void> => {
    return ipcRenderer.invoke('window:minimize');
  },

  hideWindow: (): Promise<void> => {
    return ipcRenderer.invoke('window:hide');
  },

  closeWindow: (): Promise<void> => {
    return ipcRenderer.invoke('window:close');
  },

  getDesktopSources: (): Promise<DesktopSource[]> => {
    return ipcRenderer.invoke('desktop:get-sources');
  },

  onHotkeyTriggerAI: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('hotkey:trigger-ai', handler);
    return () => ipcRenderer.removeListener('hotkey:trigger-ai', handler);
  },

  onHotkeyClear: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('hotkey:clear', handler);
    return () => ipcRenderer.removeListener('hotkey:clear', handler);
  },

  onClickThroughChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_: any, enabled: boolean) => callback(enabled);
    ipcRenderer.on('window:click-through-changed', handler);
    return () => ipcRenderer.removeListener('window:click-through-changed', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
