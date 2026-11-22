const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(async () => {
  const svgPath = path.join(process.cwd(), 'public', 'icon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const base64Svg = Buffer.from(svgContent).toString('base64');
  const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  const iconsDir = path.join(process.cwd(), 'build', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  for (const s of sizes) {
    win.setSize(s, s);
    await win.loadURL(dataUrl);
    await win.webContents.executeJavaScript(
      'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
    );
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: s, height: s });
    const pngBuffer = image.toPNG();

    const outIconPath = path.join(iconsDir, `${s}x${s}.png`);
    fs.writeFileSync(outIconPath, pngBuffer);
    console.log(`Rendered ${outIconPath} (${pngBuffer.length} bytes)`);

    if (s === 512) {
      fs.writeFileSync(path.join(process.cwd(), 'build', 'icon.png'), pngBuffer);
      fs.writeFileSync(path.join(process.cwd(), 'public', 'icon.png'), pngBuffer);
      console.log('Updated build/icon.png and public/icon.png with 512x512 render');
    }
  }

  win.close();
  app.quit();
});
