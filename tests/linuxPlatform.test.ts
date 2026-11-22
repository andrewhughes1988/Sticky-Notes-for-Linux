import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DESKTOP_FILE_NAME,
  resolveLinuxOzoneSwitches,
  WINDOW_WM_CLASS,
} from '../src/main/linuxPlatform';

test('resolveLinuxOzoneSwitches prefers x11/XWayland when DISPLAY is set for alwaysOnTop and bounds', () => {
  const kdeWaylandWithXWayland = resolveLinuxOzoneSwitches(
    { WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' },
    ['electron', '.']
  );
  assert.deepEqual(kdeWaylandWithXWayland, {
    switches: [['ozone-platform', 'x11']],
    isNativeWayland: false,
  });
});

test('resolveLinuxOzoneSwitches falls back to native Wayland when DISPLAY is absent', () => {
  const pureWayland = resolveLinuxOzoneSwitches(
    { WAYLAND_DISPLAY: 'wayland-0' },
    ['electron', '.']
  );
  assert.deepEqual(pureWayland, {
    switches: [
      ['ozone-platform-hint', 'auto'],
      ['enable-features', 'WaylandWindowDecorations'],
    ],
    isNativeWayland: true,
  });
});

test('resolveLinuxOzoneSwitches respects explicit user --ozone-platform CLI flags', () => {
  const explicitWayland = resolveLinuxOzoneSwitches(
    { WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' },
    ['electron', '--ozone-platform=wayland', '.']
  );
  assert.deepEqual(explicitWayland, {
    switches: [],
    isNativeWayland: true,
  });

  const explicitHint = resolveLinuxOzoneSwitches(
    { WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' },
    ['electron', '--ozone-platform-hint=auto', '.']
  );
  assert.deepEqual(explicitHint, {
    switches: [],
    isNativeWayland: false,
  });

  assert.equal(DESKTOP_FILE_NAME, 'sticky-notes-linux.desktop');
  assert.equal(WINDOW_WM_CLASS, 'com.netsysprep.stickynotes');
});
