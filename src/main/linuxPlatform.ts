export const DESKTOP_FILE_NAME = 'sticky-notes-linux.desktop';
export const WINDOW_WM_CLASS = 'com.netsysprep.stickynotes';

export interface LinuxOzoneResolution {
  switches: Array<[string, string]>;
  isNativeWayland: boolean;
}

/**
 * Sticky Notes relies on Always-on-Top pinning (`setAlwaysOnTop`) and exact desktop
 * window coordinates (`x`, `y`), neither of which is exposed by the Wayland `xdg-shell`
 * protocol to client applications.
 *
 * Starting in Electron 38+, Linux automatically defaults to native Wayland when
 * `WAYLAND_DISPLAY` is set, which breaks pinning, window position restoration, and
 * `moveTop()`. When an X11/XWayland `DISPLAY` is available (standard on KDE Plasma
 * and GNOME Wayland sessions), prefer the `x11` Ozone backend unless the user
 * explicitly passed an `--ozone-platform*` flag. On pure-Wayland sessions without
 * XWayland, fall back gracefully to native Wayland.
 */
export function resolveLinuxOzoneSwitches(
  env: NodeJS.ProcessEnv,
  argv: string[]
): LinuxOzoneResolution {
  const explicitPlatformArg = argv.find((arg) => arg.startsWith('--ozone-platform='));
  const hasExplicitFlag =
    Boolean(explicitPlatformArg) ||
    argv.some((arg) => arg === '--ozone-platform' || arg.startsWith('--ozone-platform-hint'));

  if (hasExplicitFlag) {
    const isWayland =
      explicitPlatformArg === '--ozone-platform=wayland' ||
      (argv.includes('--ozone-platform') &&
        argv[argv.indexOf('--ozone-platform') + 1] === 'wayland');
    return { switches: [], isNativeWayland: isWayland };
  }

  if (env.DISPLAY && env.DISPLAY.trim().length > 0) {
    return {
      switches: [['ozone-platform', 'x11']],
      isNativeWayland: false,
    };
  }

  return {
    switches: [
      ['ozone-platform-hint', 'auto'],
      ['enable-features', 'WaylandWindowDecorations'],
    ],
    isNativeWayland: Boolean(env.WAYLAND_DISPLAY),
  };
}
