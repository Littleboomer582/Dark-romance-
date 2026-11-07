// Renders the launcher icon (an isometric grass block on a sky tile) with headless Chromium.
// Usage: node blocklands/scripts/make-icons.js   (needs the playwright package)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<body></body>');
  await p.addScriptTag({ path: path.join(root, 'web/js/blocks.js') });
  for (const [name, px] of Object.entries({ ...sizes, web: 512 })) {
    const data = await p.evaluate((px) => {
      const c = document.createElement('canvas'); c.width = c.height = px;
      const g = c.getContext('2d');
      const r = px * 0.18;
      const sky = g.createLinearGradient(0, 0, 0, px); sky.addColorStop(0, '#6fb2f0'); sky.addColorStop(1, '#bfe3ff');
      g.fillStyle = sky; g.beginPath(); g.roundRect(0, 0, px, px, r); g.fill();
      const img = new Image(); img.src = Atlas.icon(B.GRASS);
      return new Promise((res) => { img.onload = () => {
        g.imageSmoothingEnabled = false;
        g.drawImage(img, px * 0.12, px * 0.1, px * 0.76, px * 0.76);
        res(c.toDataURL('image/png'));
      }; });
    }, px);
    const buf = Buffer.from(data.split(',')[1], 'base64');
    const out = name === 'web' ? path.join(root, 'web/icon.png') : path.join(root, `android/res/mipmap-${name}/ic_launcher.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
    console.log('wrote', out);
  }
  await b.close();
})();
