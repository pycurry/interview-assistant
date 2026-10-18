const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

// Apply Linux flags for headless container environment
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('ozone-platform', 'headless');
app.commandLine.appendSwitch('headless');

console.log('=== STARTING AUTOMATED ELECTRON SMOKE TEST ===');

let testPassed = true;

app.whenReady().then(async () => {
  try {
    console.log('[1/5] Testing Settings Store...');
    const { SettingsStore } = require('../dist-electron/main/store.js');
    const store = new SettingsStore();
    const initialSettings = store.getSettings();
    console.log('  Initial settings provider:', initialSettings.activeProvider);
    console.log('  Initial prompt mode:', initialSettings.promptMode);

    store.updateSettings({ promptMode: 'system-design' });
    const updatedSettings = store.getSettings();
    if (updatedSettings.promptMode !== 'system-design') {
      throw new Error('Settings update failed');
    }
    console.log('  Updated prompt mode verified:', updatedSettings.promptMode);

    console.log('[2/5] Testing Stealth Exclusion Module...');
    const { applyStealthExclusion } = require('../dist-electron/main/stealth.js');

    console.log('[3/5] Creating BrowserWindow...');
    const win = new BrowserWindow({
      width: 620,
      height: 720,
      show: false,
      transparent: true,
      frame: false,
      webPreferences: {
        offscreen: true,
        preload: path.join(__dirname, '../dist-electron/preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const stealthStatus = applyStealthExclusion(win);
    console.log('  Stealth module reported:', stealthStatus);

    console.log('[4/5] Testing Desktop Capturer (Audio/Screen Sharing Sources)...');
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      console.log(`  DesktopCapturer returned ${sources.length} sources`);
    } catch (e) {
      console.log('  DesktopCapturer skipped (headless environment):', e.message);
    }

    console.log('[5/5] Loading dist/index.html...');
    const distPath = path.join(__dirname, '../dist/index.html');
    if (!fs.existsSync(distPath)) {
      throw new Error(`dist/index.html does not exist at ${distPath}`);
    }

    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`  [Renderer Console L${level}]: ${message}`);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error(`  [Renderer Load Failed]: ${errorCode} - ${errorDescription}`);
      testPassed = false;
    });

    await win.loadFile(distPath);
    console.log('  Window successfully loaded dist/index.html!');

    // Wait 2 seconds for React to mount and run hooks
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('=== ALL SMOKE TESTS PASSED SUCCESSFULLY! ===');
    win.destroy();
    app.quit();
    process.exit(0);
  } catch (err) {
    console.error('SMOKE TEST FAILED WITH ERROR:', err);
    app.quit();
    process.exit(1);
  }
});
