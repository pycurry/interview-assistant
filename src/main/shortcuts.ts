import { globalShortcut, BrowserWindow } from 'electron';
import { AppSettings } from '../shared/types';

export function registerGlobalShortcuts(
  mainWindow: BrowserWindow,
  settings: AppSettings,
  onTriggerAI: () => void,
  onClear: () => void,
  onToggleClickThrough: () => void
) {
  // Clear any existing shortcuts first
  globalShortcut.unregisterAll();

  // 1. Panic / Hide Overlay Key
  try {
    globalShortcut.register(settings.panicKey || 'CommandOrControl+Alt+H', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.showInactive();
      }
    });
  } catch (e) {
    console.error('Failed to register panic hotkey:', e);
  }

  // 2. Trigger AI Instant Response
  try {
    globalShortcut.register(settings.triggerKey || 'CommandOrControl+Alt+Space', () => {
      onTriggerAI();
    });
  } catch (e) {
    console.error('Failed to register AI trigger hotkey:', e);
  }

  // 3. Clear Transcripts / Screen
  try {
    globalShortcut.register(settings.clearKey || 'CommandOrControl+Alt+C', () => {
      onClear();
    });
  } catch (e) {
    console.error('Failed to register clear hotkey:', e);
  }

  // 4. Toggle Click-through
  try {
    globalShortcut.register('CommandOrControl+Alt+T', () => {
      onToggleClickThrough();
    });
  } catch (e) {
    console.error('Failed to register click-through hotkey:', e);
  }
}
