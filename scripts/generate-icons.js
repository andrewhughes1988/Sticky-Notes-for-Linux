const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
  const srcIcon = path.join(process.cwd(), 'build', 'icon.png');
  const iconsDir = path.join(process.cwd(), 'build', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const img = nativeImage.createFromPath(srcIcon);
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

  for (const s of sizes) {
    const resized = img.resize({ width: s, height: s, quality: 'best' });
    const outPath = path.join(iconsDir, `${s}x${s}.png`);
    fs.writeFileSync(outPath, resized.toPNG());
    console.log('Created ' + outPath);
  }
  app.quit();
});
