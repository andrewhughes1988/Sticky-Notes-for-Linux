import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildLinuxLaunchArgs,
  DESKTOP_FILE_NAME,
  isRunningOnNativeWayland,
  preserveWaylandPosition,
  WINDOW_WM_CLASS,
} from '../src/main/linuxPlatform';

test('isRunningOnNativeWayland distinguishes CLI x11 vs native Wayland accurately', () => {
  assert.equal(
    isRunningOnNativeWayland({ WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' }, [
      'sticky-notes-linux',
      '--ozone-platform=x11',
    ]),
    false
  );
  assert.equal(
    isRunningOnNativeWayland({ WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' }, [
      'sticky-notes-linux',
      '--ozone-platform=wayland',
    ]),
    true
  );
  assert.equal(
    isRunningOnNativeWayland({ WAYLAND_DISPLAY: 'wayland-0' }, ['sticky-notes-linux']),
    true
  );
  assert.equal(isRunningOnNativeWayland({ DISPLAY: ':0' }, ['sticky-notes-linux']), false);
});

test('buildLinuxLaunchArgs supplies --ozone-platform=x11 when DISPLAY is set and always sets --class', () => {
  assert.deepEqual(buildLinuxLaunchArgs({ DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' }), [
    '--ozone-platform=x11',
    '--class=com.netsysprep.stickynotes',
  ]);
  assert.deepEqual(buildLinuxLaunchArgs({ WAYLAND_DISPLAY: 'wayland-0' }), [
    '--class=com.netsysprep.stickynotes',
  ]);
  assert.equal(DESKTOP_FILE_NAME, 'sticky-notes-linux.desktop');
  assert.equal(WINDOW_WM_CLASS, 'com.netsysprep.stickynotes');
});

test('native Wayland retains saved coordinates while recording the current size', () => {
  const current = { x: 0, y: 0, width: 510, height: 720 };
  const saved = { x: 120, y: 140, width: 400, height: 640 };
  assert.deepEqual(preserveWaylandPosition(current, saved, true), {
    x: 120,
    y: 140,
    width: 510,
    height: 720,
  });
  assert.deepEqual(preserveWaylandPosition(current, saved, false), current);
  assert.deepEqual(preserveWaylandPosition(current, null, true), current);
  const moved = { ...current, x: 35, y: 45 };
  assert.deepEqual(preserveWaylandPosition(moved, saved, true), moved);
});
