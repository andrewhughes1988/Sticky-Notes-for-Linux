import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildLinuxLaunchArgs,
  DESKTOP_FILE_NAME,
  isRunningOnNativeWayland,
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
