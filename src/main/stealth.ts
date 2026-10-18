import { BrowserWindow } from 'electron';
import os from 'os';

export interface StealthStatus {
  supported: boolean;
  active: boolean;
  platform: 'win32' | 'darwin' | 'linux';
  message: string;
}

/**
 * Native constants for Windows SetWindowDisplayAffinity
 * WDA_NONE = 0x00000000
 * WDA_MONITOR = 0x00000001 (Renders black box on screen capture - older Windows 10)
 * WDA_EXCLUDEFROMCAPTURE = 0x00000011 (Completely invisible - Windows 10 2004+ and Windows 11)
 */
const WDA_EXCLUDEFROMCAPTURE = 0x00000011;

/**
 * Configure OS-level screen capture exclusion on the overlay window.
 * This guarantees the window is visible to the candidate, but omitted
 * entirely from screen sharing (Zoom, Teams, Meet, Slack, Discord, OBS).
 */
export function applyStealthExclusion(win: BrowserWindow): StealthStatus {
  const platform = os.platform() as 'win32' | 'darwin' | 'linux';

  try {
    if (platform === 'win32') {
      // Use koffi for direct Win32 SetWindowDisplayAffinity
      try {
        const koffi = require('koffi');
        const user32 = koffi.load('user32.dll');
        const SetWindowDisplayAffinity = user32.func('__stdcall', 'SetWindowDisplayAffinity', 'bool', ['void *', 'uint32_t']);
        
        const nativeHandle = win.getNativeWindowHandle();
        // Convert Electron Buffer to pointer
        const success = SetWindowDisplayAffinity(nativeHandle, WDA_EXCLUDEFROMCAPTURE);
        
        // Also call Electron's built-in setContentProtection as reinforcement
        win.setContentProtection(true);

        return {
          supported: true,
          active: Boolean(success),
          platform: 'win32',
          message: success 
            ? 'Windows WDA_EXCLUDEFROMCAPTURE activated. Overlay is 100% invisible to screen share.' 
            : 'SetWindowDisplayAffinity returned false. Running on fallback content protection.'
        };
      } catch (err) {
        // Fallback to built-in Electron content protection if koffi fails
        win.setContentProtection(true);
        return {
          supported: true,
          active: true,
          platform: 'win32',
          message: 'Windows standard content protection applied.'
        };
      }
    } 
    
    if (platform === 'darwin') {
      // On macOS, setContentProtection(true) natively invokes [window setSharingType:NSWindowSharingNone]
      // This completely removes the window from CGDisplayStream, ScreenCaptureKit, and Zoom
      win.setContentProtection(true);
      
      // Keep on top of fullscreen apps
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.setAlwaysOnTop(true, 'screen-saver');

      return {
        supported: true,
        active: true,
        platform: 'darwin',
        message: 'macOS NSWindowSharingNone activated. Overlay is 100% invisible to screen share.'
      };
    }

    if (platform === 'linux') {
      // On Linux, setContentProtection(true) triggers DRM failure and stalls OpenGL buffer swaps
      // in gl_surface_presentation_helper. Also, 'screen-saver' is not a valid Linux window level.
      win.setAlwaysOnTop(true);

      return {
        supported: false,
        active: false,
        platform: 'linux',
        message: 'Linux detected. Native screen-capture exclusion is compositor-dependent. Use the built-in Companion Mode or verify with the Screen Share Tester.'
      };
    }

    return {
      supported: false,
      active: false,
      platform,
      message: `Unsupported platform: ${platform}`
    };
  } catch (error: any) {
    console.error('Failed to apply stealth exclusion:', error);
    return {
      supported: false,
      active: false,
      platform,
      message: `Error applying stealth exclusion: ${error.message}`
    };
  }
}
