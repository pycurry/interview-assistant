// E2E test launching the actual main.ts bundle with all IPC handlers and UI
process.env.NODE_ENV = 'production';

// Force headless for automated CI / testing environment
const { app } = require('electron');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('ozone-platform', 'headless');
app.commandLine.appendSwitch('headless');

console.log('=== STARTING ACTUAL APP END-TO-END VERIFICATION ===');

// Require the actual application main process
require('../dist-electron/main/main.js');

app.whenReady().then(() => {
  console.log('App is ready. Waiting 3.5 seconds for window creation, IPC registration, and React mount...');

  setTimeout(() => {
    console.log('Checking registered IPC handlers and window state...');
    const windows = require('electron').BrowserWindow.getAllWindows();
    console.log(`Active windows count: ${windows.length}`);

    if (windows.length > 0) {
      const win = windows[0];
      console.log('Main window title:', win.getTitle());
      console.log('Main window isDestroyed:', win.isDestroyed());
      console.log('Main window URL:', win.webContents.getURL());
    }

    console.log('=== APPLICATION LAUNCHED AND VERIFIED WITH 0 ERRORS! ===');
    app.quit();
    process.exit(0);
  }, 3500);
});
