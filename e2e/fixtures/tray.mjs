import { register } from 'tsx/esm/api';
import { app, Tray } from 'electron';
register();
const { TrayService } = await import('../../src/main/tray.ts');

const actions = [];
let closing = false;
let tray;
let menu;
const originalSetContextMenu = Tray.prototype.setContextMenu;
Tray.prototype.setContextMenu = function (value) {
  tray = Object(this);
  menu = value;
  return originalSetContextMenu.call(this, value);
};
const manager = {
  isClosing: () => closing,
  createNewNoteWindow: () => actions.push('new'),
  toggleManagerWindow: () => actions.push('toggle'),
  showManagerWindow: () => actions.push('list'),
  showAllOpenNotes: () => actions.push('show'),
  hideAllOpenNotes: () => actions.push('hide'),
};
app.whenReady().then(() => {
  const service = new TrayService(manager);
  service.init();
  globalThis.trayTest = {
    labels: () => menu.items.filter((item) => item.type !== 'separator').map((item) => item.label),
    click: (label) => menu.items.find((item) => item.label === label).click(),
    clickTray: () => tray.emit('click'),
    setClosing: (value) => {
      closing = value;
    },
    actions: () => actions,
    destroy: () => {
      service.destroy();
      return tray.isDestroyed();
    },
  };
});
