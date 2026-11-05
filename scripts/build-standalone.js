// Packs the whole game (HTML, CSS, Three.js, game code, offline simulation) into one HTML file
// that opens directly in a web browser: no install, no server needed for offline play.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');
const read = (f) => fs.readFileSync(path.join(pub, f), 'utf8');
const safe = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

// Three.js is an ES module: wrap it in a function and turn its export list into a THREE object.
function threeAsObject() {
  let src = read('vendor/three.module.min.js');
  const at = src.lastIndexOf('export{');
  if (at < 0) throw new Error('three.js export list not found');
  const end = src.indexOf('}', at);
  const list = src.slice(at + 7, end).split(',').map((s) => s.trim()).filter(Boolean);
  const props = list.map((item) => {
    const m = item.split(/\s+as\s+/);
    return m.length === 2 ? `${JSON.stringify(m[1])}:${m[0]}` : `${m[0]}:${m[0]}`;
  });
  src = src.slice(0, at) + src.slice(end + 1).replace(/^;/, '');
  return `const THREE = (() => {\n${src}\nreturn {${props.join(',')}};\n})();\n`;
}

// guns.js is an ES module too: wrap it and expose its exports as a Guns object.
function gunsAsObject() {
  let src = read('guns.js');
  const imp = /^import \* as THREE from '\.\/vendor\/three\.module\.min\.js';\s*$/m;
  if (!imp.test(src)) throw new Error('THREE import not found in guns.js');
  src = src.replace(imp, '');
  const names = [];
  src = src.replace(/^export (function|const|let) (\w+)/gm, (m, kind, name) => { names.push(name); return kind + ' ' + name; });
  if (/^export /m.test(src)) throw new Error('Unhandled export in guns.js');
  return `const Guns = (() => {\n${src}\nreturn { ${names.join(', ')} };\n})();\n`;
}

let html = read('index.html');
let game = read('game.js');
const importLine = /^import \* as THREE from '\.\/vendor\/three\.module\.min\.js';\s*$/m;
if (!importLine.test(game)) throw new Error('THREE import line not found in game.js');
game = game.replace(importLine, '');
const gunsImport = /^import \* as Guns from '\.\/guns\.js';\s*$/m;
if (!gunsImport.test(game)) throw new Error('Guns import line not found in game.js');
game = game.replace(gunsImport, '');

const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(pub, 'icons/icon-192.png')).toString('base64');
const replaceOnce = (needle, value) => {
  if (!html.includes(needle)) throw new Error('Missing in index.html: ' + needle);
  html = html.replace(needle, () => value);
};
replaceOnce('<link rel="stylesheet" href="style.css">', `<style>\n${read('style.css')}\n</style>`);
replaceOnce('<link rel="manifest" href="manifest.webmanifest">\n', '');
replaceOnce('<link rel="icon" href="icons/icon-192.png">', `<link rel="icon" href="${icon}">`);
replaceOnce('<link rel="apple-touch-icon" href="icons/icon-192.png">', `<link rel="apple-touch-icon" href="${icon}">`);
replaceOnce('<script src="shared.js"></script>', `<script>\n${safe(read('shared.js'))}\n</script>`);
replaceOnce('<script src="sim.js"></script>', `<script>\n${safe(read('sim.js'))}\n</script>`);
replaceOnce('<script type="module" src="game.js"></script>', `<script type="module">\n${safe(threeAsObject())}\n${safe(gunsAsObject())}\n${safe(game)}\n</script>`);

const out = path.join(root, 'frontline-1945.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
