import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron';
import path from 'path';
import { applyStealthExclusion } from './stealth';
import { SettingsStore } from './store';
import { registerGlobalShortcuts } from './shortcuts';
import { AppSettings } from '../shared/types';

import fs from 'fs';

// In restricted container/Linux environments, disable sandbox flags and dev-shm usage
if (app && app.commandLine) {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('disable-gpu-vsync');
}

let mainWindow: BrowserWindow | null = null;
let settingsStore: SettingsStore;
let isClickThrough = false;

function createWindow() {
  settingsStore = new SettingsStore();
  const settings = settingsStore.getSettings();
  const isLinux = process.platform === 'linux';

  mainWindow = new BrowserWindow({
    width: 620,
    height: 720,
    center: true,
    show: true,
    // On Linux X11, 32-bit transparent windows without a compositor stall buffer presentation (gl_surface_presentation_helper).
    // Using solid backgroundColor: '#0f1117' guarantees 100% reliable rendering without disappearing.
    transparent: !isLinux,
    backgroundColor: '#0f1117',
    frame: false,
    alwaysOnTop: settings.alwaysOnTop ?? true,
    hasShadow: !isLinux,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Forward renderer console messages to terminal for troubleshooting
  mainWindow.webContents.on('console-message', (_, level, message) => {
    console.log(`[Renderer]: ${message}`);
  });

  // Apply OS-level screen capture exclusion immediately
  if (settings.stealthExclusionActive) {
    applyStealthExclusion(mainWindow);
  }

  // Set initial window opacity (on macOS / Windows only to avoid Linux compositor alpha drops)
  if (!isLinux && settings.opacity && typeof settings.opacity === 'number') {
    mainWindow.setOpacity(Math.max(0.4, settings.opacity));
  }

  // Set window level to stay above fullscreen applications safely by platform
  if (process.platform === 'darwin' || process.platform === 'win32') {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    mainWindow.setAlwaysOnTop(true);
  }

  mainWindow.show();
  mainWindow.focus();

  // Register global shortcuts
  setupShortcuts(settings);

  // Load renderer: prefer built static bundle, or dev server if explicitly set
  const distIndexPath = path.join(__dirname, '../../dist/index.html');
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch(() => {
      mainWindow?.loadFile(distIndexPath);
    });
  } else if (fs.existsSync(distIndexPath)) {
    mainWindow.loadFile(distIndexPath);
  } else {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      console.error('Neither dist/index.html nor Vite dev server (http://localhost:5173) was found. Please run "npm run build" first.');
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupShortcuts(settings: AppSettings) {
  if (!mainWindow) return;

  registerGlobalShortcuts(
    mainWindow,
    settings,
    // On Trigger AI
    () => {
      mainWindow?.webContents.send('hotkey:trigger-ai');
    },
    // On Clear
    () => {
      mainWindow?.webContents.send('hotkey:clear');
    },
    // On Toggle Click Through
    () => {
      toggleClickThrough();
    }
  );
}

function toggleClickThrough() {
  if (!mainWindow) return;
  isClickThrough = !isClickThrough;
  mainWindow.setIgnoreMouseEvents(isClickThrough, { forward: true });
  mainWindow.webContents.send('window:click-through-changed', isClickThrough);
}

// IPC Handlers
ipcMain.handle('stealth:get-status', () => {
  if (!mainWindow) return { supported: false, active: false };
  return applyStealthExclusion(mainWindow);
});

ipcMain.handle('settings:get', () => {
  return settingsStore.getSettings();
});

ipcMain.handle('settings:update', (_, updates: Partial<AppSettings>) => {
  const updated = settingsStore.updateSettings(updates);
  
  const isLinux = process.platform === 'linux';
  if (mainWindow && !isLinux && updates.opacity !== undefined) {
    mainWindow.setOpacity(updates.opacity);
  }
  if (mainWindow && updates.alwaysOnTop !== undefined) {
    if (process.platform === 'darwin' || process.platform === 'win32') {
      mainWindow.setAlwaysOnTop(updates.alwaysOnTop, 'screen-saver');
    } else {
      mainWindow.setAlwaysOnTop(updates.alwaysOnTop);
    }
  }
  if (mainWindow && updates.stealthExclusionActive !== undefined) {
    if (updates.stealthExclusionActive) {
      applyStealthExclusion(mainWindow);
    } else if (!isLinux) {
      mainWindow.setContentProtection(false);
    }
  }

  setupShortcuts(updated);
  return updated;
});

ipcMain.handle('window:set-click-through', (_, ignore: boolean) => {
  if (!mainWindow) return;
  isClickThrough = ignore;
  mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  return isClickThrough;
});

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:hide', () => {
  mainWindow?.hide();
});

ipcMain.handle('window:show', () => {
  mainWindow?.showInactive();
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// Provide desktop capture sources for loopback audio and screen share self-test
ipcMain.handle('desktop:get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnailUrl: s.thumbnail.toDataURL(),
    }));
  } catch (err) {
    console.error('Failed to get desktop capturer sources:', err);
    return [];
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
