export const DESKTOP_FILE_NAME = 'sticky-notes-linux.desktop';
export const WINDOW_WM_CLASS = 'com.netsysprep.stickynotes';

/**
 * Determines whether the current Linux Electron process is running on native Wayland
 * (as opposed to X11/XWayland).
 *
 * NOTE: In Electron 38+, Chromium initializes the Browser process's Ozone backend
 * BEFORE `main.js` executes. Never call `app.commandLine.appendSwitch('ozone-platform', ...)`
 * from JavaScript, as that leaves the Browser process on Wayland while forcing the GPU
 * process onto X11 (causing GPU crashes and blank/invisible windows). Instead, Ozone
 * selection must be passed on the process command line (via `.desktop` `executableArgs`
 * and `autostart.ts`).
 */
export function isRunningOnNativeWayland(env: NodeJS.ProcessEnv, argv: string[]): boolean {
  const explicitPlatform = argv.find((arg) => arg.startsWith('--ozone-platform='));
  if (explicitPlatform === '--ozone-platform=x11') return false;
  if (explicitPlatform === '--ozone-platform=wayland') return true;

  const idx = argv.indexOf('--ozone-platform');
  if (idx !== -1) {
    if (argv[idx + 1] === 'x11') return false;
    if (argv[idx + 1] === 'wayland') return true;
  }

  return Boolean(env.WAYLAND_DISPLAY);
}

/**
 * CLI arguments passed before Electron initializes so X11/XWayland is selected
 * when DISPLAY is present (required for alwaysOnTop and desktop (x, y) coordinates)
 * and WM_CLASS / app_id matches StartupWMClass in sticky-notes-linux.desktop.
 */
export function buildLinuxLaunchArgs(env: NodeJS.ProcessEnv): string[] {
  const args: string[] = [];
  if (env.DISPLAY && env.DISPLAY.trim().length > 0) {
    args.push('--ozone-platform=x11');
  }
  args.push(`--class=${WINDOW_WM_CLASS}`);
  return args;
}
