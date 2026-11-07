/* Frontline 1945 — detailed procedural weapon models, materials and animations.
   Gun-local axes: +X toward the muzzle, +Y up, +Z to the gun's right side.
   Origin: top of the pistol grip / trigger area. Units ~ 2.5 cm. */
import * as THREE from './vendor/three.module.min.js';

const TAU = Math.PI * 2;

// ================================================================ textures
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function canvasTex(w, h, draw, opts) {
  opts = opts || {};
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function woodTex(base, dark, light, seed) {
  return canvasTex(1024, 256, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // broad colour bands
    for (let i = 0; i < 18; i++) {
      g.fillStyle = (r() < 0.5 ? dark : light).replace('A', (0.06 + r() * 0.1).toFixed(2));
      g.fillRect(0, r() * h, w, 6 + r() * 30);
    }
    // grain lines
    for (let i = 0; i < 260; i++) {
      const y0 = r() * h, amp = 1 + r() * 6, freq = 0.002 + r() * 0.01, ph = r() * TAU;
      g.strokeStyle = dark.replace('A', (0.12 + r() * 0.3).toFixed(2));
      g.lineWidth = 0.6 + r() * 1.8;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) { const y = y0 + Math.sin(x * freq + ph) * amp; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
    // pores
    for (let i = 0; i < 2500; i++) { g.fillStyle = dark.replace('A', '0.35'); g.fillRect(r() * w, r() * h, 2 + r() * 4, 1); }
  }, { repeat: [1 / 34, 1 / 7] });
}
function noiseTex(seed, lo, hi) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(seed);
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = lo + (hi - lo) * (r() * 0.6 + 0.4 * Math.sin(i * 0.002)); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    // scratches
    g.strokeStyle = `rgba(${hi},${hi},${hi},.5)`;
    for (let i = 0; i < 70; i++) { g.lineWidth = 0.5 + r(); g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 8); g.stroke(); }
  }, { srgb: false, repeat: [2, 2] });
}
function stippleTex() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = rng(17);
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = r() < 0.5 ? 40 : 200; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(r() * w, r() * h, 0.6 + r() * 1.1, 0, TAU); g.fill(); }
  }, { srgb: false, repeat: [0.6, 0.6] });
}
function checkerTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#303030'; g.lineWidth = 2;
    for (let i = -h; i < w + h; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
  }, { srgb: false, repeat: [0.35, 0.35] });
}
// perforated sheet metal (alpha holes)
function holesTex(kind) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    if (kind === 'oval') {
      for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) {
        g.beginPath(); g.ellipse(col * 128 + 64 + (row % 2) * 0, row * 85 + 42, 22, 34, 0, 0, TAU); g.fill();
      }
    } else {
      for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        g.beginPath(); g.arc(col * 32 + 16 + (row % 2) * 16, row * 32 + 16, 8, 0, TAU); g.fill();
      }
    }
  }, { srgb: false });
}
function flashStarTex() {
  return canvasTex(128, 128, (g, w) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(0.18, 'rgba(255,220,120,.95)'); gr.addColorStop(0.5, 'rgba(255,140,30,.35)'); gr.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    const spikes = 7;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * TAU, rr = i % 2 ? c * 0.28 : c * (0.75 + 0.25 * Math.sin(i * 7.3));
      g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
    }
    g.fill();
    g.globalCompositeOperation = 'lighter';
    const core = g.createRadialGradient(c, c, 0, c, c, c * 0.45);
    core.addColorStop(0, 'rgba(255,255,240,1)'); core.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = core; g.fillRect(0, 0, w, w);
  });
}
function smokeTex() {
  return canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(210,205,195,.55)'); gr.addColorStop(0.6, 'rgba(180,175,165,.2)'); gr.addColorStop(1, 'rgba(160,160,160,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

// ================================================================ materials
let MAT = null;
function materials() {
  if (MAT) return MAT;
  const rough = noiseTex(3, 70, 150);
  const roughMatte = noiseTex(5, 140, 220);
  const walnut = woodTex('#52301a', 'rgba(28,13,5,A)', 'rgba(135,85,45,A)', 7);
  const birch = woodTex('#764522', 'rgba(55,22,8,A)', 'rgba(170,105,55,A)', 11);
  const beech = woodTex('#6c4026', 'rgba(40,18,8,A)', 'rgba(150,95,55,A)', 13);
  const check = checkerTex();
  const holesR = holesTex('round'), holesO = holesTex('oval');
  holesR.repeat.set(3, 3); holesO.repeat.set(2, 2);
  const steel = (color, r, m, env) => new THREE.MeshStandardMaterial({ color, metalness: m == null ? 0.85 : m, roughness: r, roughnessMap: rough, envMapIntensity: env == null ? 0.28 : env });
  MAT = {
    blued: steel(0x141619, 0.5),
    blued2: steel(0x22252a, 0.55),
    park: new THREE.MeshStandardMaterial({ color: 0x3e3f37, metalness: 0.55, roughness: 0.78, roughnessMap: roughMatte, envMapIntensity: 0.4 }),
    paint: new THREE.MeshStandardMaterial({ color: 0x1b1c1d, metalness: 0.35, roughness: 0.62, roughnessMap: roughMatte, envMapIntensity: 0.4 }),
    bright: steel(0x8c9095, 0.3, 1, 0.5),
    caseHard: steel(0x5a5650, 0.32, 0.95, 0.6),
    walnut: new THREE.MeshPhysicalMaterial({ map: walnut, roughness: 0.48, clearcoat: 0.45, clearcoatRoughness: 0.35 }),
    birch: new THREE.MeshPhysicalMaterial({ map: birch, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    beech: new THREE.MeshPhysicalMaterial({ map: beech, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    bakelite: new THREE.MeshPhysicalMaterial({ color: 0x3b2316, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    poly: new THREE.MeshStandardMaterial({ color: 0x1c1d1e, roughness: 0.72, metalness: 0.1, roughnessMap: roughMatte, envMapIntensity: 0.3 }),
    alu: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.5, metalness: 0.65, roughnessMap: rough, envMapIntensity: 0.35 }),
    stipple: new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.85, metalness: 0.05, bumpMap: stippleTex(), bumpScale: 1.5, envMapIntensity: 0.2 }),
    stippleTan: new THREE.MeshStandardMaterial({ color: 0x8a7a58, roughness: 0.85, metalness: 0.05, bumpMap: stippleTex(), bumpScale: 1.5, envMapIntensity: 0.2 }),
    polyTan: new THREE.MeshStandardMaterial({ color: 0x8a7a58, roughness: 0.75, metalness: 0.05, roughnessMap: roughMatte, envMapIntensity: 0.3 }),
    polyOd: new THREE.MeshStandardMaterial({ color: 0x4a5034, roughness: 0.75, metalness: 0.05, roughnessMap: roughMatte, envMapIntensity: 0.3 }),
    redLens: new THREE.MeshBasicMaterial({ color: 0xff3020 }),
    dot: new THREE.MeshBasicMaterial({ color: 0xeeeee0 }),
    smoke: new THREE.MeshPhysicalMaterial({ color: 0x2c2a26, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.55, clearcoat: 1 }),
    // see-through optic glass (holographic and reflex sights)
    clearGlass: new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    gripWood: new THREE.MeshPhysicalMaterial({ map: walnut, bumpMap: check, bumpScale: 1.2, roughness: 0.6, clearcoat: 0.2 }),
    gripBlack: new THREE.MeshStandardMaterial({ color: 0x1a1512, bumpMap: check, bumpScale: 1.2, roughness: 0.55 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc09a45, metalness: 1, roughness: 0.28 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xb06a3c, metalness: 1, roughness: 0.3 }),
    shellHull: new THREE.MeshStandardMaterial({ color: 0x8a1f17, roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1b2c4a, metalness: 0.1, roughness: 0.02, clearcoat: 1, envMapIntensity: 2.5 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.8 }),
    canvas: new THREE.MeshStandardMaterial({ color: 0x5d5b3e, roughness: 0.95 }),
    nade: new THREE.MeshStandardMaterial({ color: 0x3c4a2b, roughness: 0.7, metalness: 0.2 }),
    perfR: new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.85, roughness: 0.4, alphaMap: holesR, alphaTest: 0.5, side: THREE.DoubleSide }),
    perfO: new THREE.MeshStandardMaterial({ color: 0x232527, metalness: 0.8, roughness: 0.45, alphaMap: holesO, alphaTest: 0.5, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 }),
  };
  return MAT;
}

// Reflection map so steel and varnish catch the light.
export function makeEnvironment(renderer) {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const cols = [];
  const pos = geo.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 50;
    if (y > 0.05) c.setRGB(0.75 + y * 0.2, 0.74 + y * 0.2, 0.7 + y * 0.25);
    else if (y > -0.08) c.setRGB(1.0, 0.95, 0.85);
    else c.setRGB(0.22, 0.19, 0.14);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (x, y, z, w, h, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 0.95), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  panel(20, 35, -10, 40, 18, 4); panel(-30, 18, 25, 22, 10, 2); panel(0, 10, 45, 30, 8, 1.6);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return tex;
}

// ================================================================ geometry helpers
const _v = new THREE.Vector3();
function mesh(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; return m; }
// side-profile extrusion: points [[x,y],...] in the XY plane, thickness along Z
function ext(points, depth, mat, opt) {
  opt = opt || {};
  const sh = new THREE.Shape();
  points.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
  const bevel = opt.bevel == null ? Math.min(0.45, depth * 0.3) : opt.bevel;
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.05, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(depth - bevel * 2) / 2 + (opt.z || 0));
  g.computeVertexNormals();
  return mesh(g, mat);
}
// cylinder along +X from x0, radius r0 at the back, r1 at the front
function tube(r0, len, mat, x0, y, z, r1, seg) {
  const g = new THREE.CylinderGeometry(r1 == null ? r0 : r1, r0, len, seg || 18, 1);
  g.rotateZ(-Math.PI / 2);
  return mesh(g, mat, x0 + len / 2, y, z);
}
// open tube (no caps), e.g. perforated jackets
function sleeve(r, len, mat, x0, y, z) {
  const g = new THREE.CylinderGeometry(r, r, len, 24, 1, true);
  g.rotateZ(-Math.PI / 2);
  return mesh(g, mat, x0 + len / 2, y, z);
}
// lathe along +X: pts [[x, r], ...]
function lathe(pts, mat, x0, y, z, seg) {
  const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[1], p[0])), seg || 24);
  g.rotateZ(-Math.PI / 2);
  return mesh(g, mat, x0, y, z);
}
function box(w, h, d, mat, x, y, z) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
function rbox(w, h, d, mat, x, y, z, r) { // rounded box via extrusion
  r = Math.min(r == null ? 0.3 : r, w / 2.2, h / 2.2);
  const m = ext([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], d, mat, { bevel: Math.min(r, d / 2.5) });
  m.position.set(x, y, z);
  return m;
}
function ring(r, t, mat, x, y, z, arc) { const g = new THREE.TorusGeometry(r, t, 8, 24, arc || TAU); g.rotateY(Math.PI / 2); return mesh(g, mat, x, y, z); }
function sphere(r, mat, x, y, z) { return mesh(new THREE.SphereGeometry(r, 14, 10), mat, x, y, z); }
function rod(a, b, r, mat) { // cylinder between two points
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 10); g.rotateX(Math.PI / 2);
  const m = mesh(g, mat); m.position.copy(a).lerp(b, 0.5); m.lookAt(b);
  return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z || 0);

// ================================================================ common parts
function triggerGroup(M, x, y, guardMat, big) {
  const g = new THREE.Group();
  const r = big ? 1.55 : 1.25;
  const tg = new THREE.TorusGeometry(r, 0.17, 6, 20, Math.PI); tg.rotateZ(Math.PI);
  g.add(mesh(tg, guardMat, x + 0.2, y, 0));
  const trig = ext([[0, 0], [0.35, 0], [0.15, -1.2], [-0.25, -1.45], [-0.1, -1.1]], 0.35, M.blued, { bevel: 0.08 });
  trig.position.set(x + 0.1, y, 0);
  g.add(trig);
  return g;
}
function frontPost(M, x, baseY, topY, hood) {
  const g = new THREE.Group();
  g.add(rbox(1.0, 0.7, 0.9, M.blued, x, baseY + 0.3, 0, 0.15));
  g.add(box(0.2, topY - baseY - 0.3, 0.22, M.blued, x, (baseY + topY) / 2 + 0.15, 0));
  if (hood) { const h = new THREE.CylinderGeometry(0.62, 0.62, 1.1, 16, 1, true, -Math.PI * 0.55, Math.PI * 1.1); h.rotateZ(-Math.PI / 2); g.add(mesh(h, M.blued, x, topY - 0.25, 0)); }
  return g;
}
function rearNotch(M, x, baseY, topY, wide) {
  const w = wide || 1.4;
  const g = new THREE.Group();
  g.add(rbox(2.2, topY - baseY - 0.15, w, M.blued, x, (baseY + topY) / 2 - 0.1, 0, 0.15));
  g.add(box(0.5, 0.35, w * 0.34, M.blued, x + 0.6, topY + 0.05, w * 0.33));
  g.add(box(0.5, 0.35, w * 0.34, M.blued, x + 0.6, topY + 0.05, -w * 0.33));
  return g;
}
function swivel(M, x, y) { const g = new THREE.TorusGeometry(0.55, 0.11, 6, 12); return mesh(g, M.blued, x, y - 0.5, 0); }
function bands(M, xs, y, r, mat) { const g = new THREE.Group(); for (const x of xs) g.add(tube(r, 0.8, mat || M.blued, x, y, 0, r, 20)); return g; }

// curved / straight box magazine as a side profile, hanging down from its top
function magazine(M, len, width, depth, curve, mat) {
  const pts = [], back = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const t = i / N, off = curve * len * t * t, y = -len * t;
    pts.push([width / 2 + off, y]); back.push([-width / 2 + off, y]);
  }
  const prof = pts.concat(back.reverse());
  const g = new THREE.Group();
  g.add(ext(prof, depth, mat || M.blued, { bevel: 0.18 }));
  // floor plate
  const lastOff = curve * len;
  g.add(rbox(width + 0.4, 0.45, depth + 0.3, mat || M.blued, lastOff, -len - 0.1, 0, 0.12));
  // side ribs
  for (let i = 1; i < 4; i++) {
    const t = i / 4.5;
    g.add(box(width * 0.7, 0.18, depth + 0.06, M.blued2, curve * len * t * t, -len * t, 0));
  }
  return g;
}
function drum(M, r, thick, mat) {
  const g = new THREE.Group();
  const pts = [[-thick / 2, 0.3], [-thick / 2, r - 0.4], [-thick / 2 + 0.3, r], [thick / 2 - 0.3, r], [thick / 2, r - 0.4], [thick / 2, 0.3]];
  const d = lathe(pts, mat || M.blued, 0, 0, 0, 32);
  d.rotation.y = Math.PI / 2; // axis along Z
  g.add(d);
  const cap = lathe([[-0.3, 0], [-0.3, r * 0.35], [0.3, r * 0.35], [0.3, 0]], M.bright, 0, 0, thick / 2 + 0.05, 16); cap.rotation.y = Math.PI / 2; g.add(cap);
  for (let i = 0; i < 3; i++) { const rr = ring(r * (0.55 + i * 0.13), 0.08, M.blued2, 0, 0, thick / 2 + 0.02); rr.rotation.y = 0; g.add(rr); }
  return g;
}

// stock silhouettes
function riflestock(M, p) {
  const { buttL, foreL, B, drop = 0.6, pistol = false, mat } = p;
  const xb = -3 - buttL;
  const short = foreL < 12; // SMG-style stock that ends just ahead of the magazine
  const top = short
    ? [[xb, 1.1 - drop], [xb + 5, 1.0 - drop * 0.6], [-7.5, 0.5], [-3.6, 0.72], [foreL, 0.72]]
    : [[xb, 1.1 - drop], [xb + 5, 1.0 - drop * 0.6], [-7.5, 0.5], [-3.6, 0.72], [6.5, 0.72], [foreL * 0.55, B - 0.35], [foreL, B - 0.05]];
  const nose = short ? [[foreL + 0.3, 0.2], [foreL - 0.2, -0.7]] : [[foreL + 0.25, B - 0.55], [foreL - 0.1, B - 1.25]];
  const bottom = short ? [[1.6, -1.0], [-2.4, -1.0]] : [[foreL * 0.55, -0.35], [7.5, -0.7], [5.5, -0.95], [1.6, -1.0], [-2.4, -1.0]];
  const wrist = pistol ? [[-3.5, -1.7], [-4.3, -2.75], [-5.4, -3.05], [-6.3, -2.5], [-7.2, -1.9]] : [[-4.5, -1.55], [-7.0, -1.75]];
  const butt = [[-10.5, -2.2 - drop * 0.3], [xb + 0.4, -3.65 - drop], [xb, -3.45 - drop]];
  const pts = top.concat(nose, bottom, wrist, butt);
  const g = new THREE.Group();
  g.add(ext(pts, 2.6, mat || M.walnut, { bevel: 0.75 }));
  g.add(ext([[xb - 0.4, 1.1 - drop], [xb, 1.1 - drop], [xb, -3.45 - drop], [xb - 0.4, -3.45 - drop]], 2.65, M.blued, { bevel: 0.2 })); // butt plate
  return g;
}
function buttstock(M, p) { // stock that bolts on behind a receiver (SMG / AR / MG)
  const { len, top = 1.6, h = 5, drop = 1.2, x0 = -3, mat, thin = false } = p;
  const xb = x0 - len;
  const pts = [[x0, top], [x0 - 2, top - 0.1], [xb + 1, top - drop], [xb, top - drop], [xb, top - drop - h], [xb + 1.5, top - drop - h], [x0 - 4, top - h * 0.55], [x0, top - 2.6]];
  const g = new THREE.Group();
  g.add(ext(pts, thin ? 2 : 2.6, mat || M.walnut, { bevel: 0.6 }));
  g.add(ext([[xb - 0.35, top - drop], [xb, top - drop], [xb, top - drop - h], [xb - 0.35, top - drop - h]], thin ? 2.05 : 2.65, M.blued, { bevel: 0.15 }));
  return g;
}
function pistolGrip(M, x, y, mat, len, rake) {
  len = len || 5.6; rake = rake == null ? 0.9 : rake;
  const pts = [[x + 1.2, y], [x - 1.0, y], [x - 1.0 - rake, y - len * 0.65], [x - 1.2 - rake * 1.4, y - len], [x + 0.5 - rake * 1.2, y - len - 0.15], [x + 1.1 - rake * 0.6, y - len * 0.55]];
  return ext(pts, 2.3, mat || M.walnut, { bevel: 0.55 });
}

// ================================================================ hands-on parts registry
function finish(g, out) {
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const r = Object.assign({ group: g, parts: {} }, out);
  if (!r.rightHand) r.rightHand = V(-0.4, -2.3, 0);
  return r;
}

// ================================================================ weapon builders
function buildBoltRifle(M, id, has) {
  const S = {
    kar98k: { foreL: 21, bar: 27, buttL: 14, stock: M.walnut, pistol: true, bentHandle: true, hood: true },
    springfield: { foreL: 21, bar: 27, buttL: 14, stock: M.walnut, pistol: false, hood: true },
    mosin: { foreL: 24, bar: 30, buttL: 14, stock: M.birch, pistol: false, hood: true, mag: true },
    arisaka: { foreL: 22, bar: 28, buttL: 14, stock: M.beech, pistol: false, hood: false, mag: false },
  }[id];
  const B = 1.6, g = new THREE.Group();
  g.add(riflestock(M, { buttL: S.buttL, foreL: S.foreL, B, pistol: S.pistol, mat: S.stock }));
  // upper handguard
  g.add(ext([[7, B + 0.3], [S.foreL * 0.62, B + 0.3], [S.foreL * 0.62 + 0.6, B + 1.1], [7.6, B + 1.25]], 2.0, S.stock, { bevel: 0.45 }));
  // receiver + barrel
  g.add(tube(1.15, 9.5, M.blued, -3, B, 0, 1.1, 24));
  g.add(lathe([[0, 1.1], [0.6, 1.05], [1.4, 0.82], [S.bar - 6, 0.62], [S.bar - 6, 0.55], [S.bar - 5.6, 0.0]], M.blued, 6.5, B, 0, 20));
  const muzzleX = 6.5 + S.bar - 5.6;
  g.add(bands(M, [S.foreL * 0.4, S.foreL - 1.2], B - 0.3, 1.45));
  g.add(rbox(1.4, 2.4, 2.8, M.blued, S.foreL - 0.2, B - 0.5, 0, 0.3)); // nose cap
  // magazine / floorplate
  g.add(rbox(6, 0.35, 2.2, M.blued, 2.6, -1.25, 0, 0.1));
  if (S.mag) g.add(rbox(5, 1.6, 2.3, M.blued, 2.6, -1.8, 0, 0.3));
  g.add(triggerGroup(M, -0.2, -1.3, M.blued));
  // bolt (animated)
  const bolt = new THREE.Group(); bolt.position.set(0, B, 0);
  bolt.add(tube(0.72, 9, M.bright, -5.2, 0, 0, 0.72, 16));
  bolt.add(lathe([[0, 0.9], [0.6, 0.95], [1.6, 0.6], [2.2, 0]], M.blued, -6.4, 0, 0, 16)); // shroud/cocking piece
  const stalk = rod(V(-2.3, 0, 0.6), S.bentHandle ? V(-2.6, -1.3, 2.9) : V(-2.3, 0, 3.4), 0.28, M.bright);
  bolt.add(stalk);
  bolt.add(id === 'arisaka' ? mesh(new THREE.SphereGeometry(0.7, 12, 10).scale(1.3, 0.75, 1), M.bright, -2.6, S.bentHandle ? -1.35 : 0, S.bentHandle ? 3.0 : 3.6) : sphere(0.72, M.bright, S.bentHandle ? -2.6 : -2.3, S.bentHandle ? -1.35 : 0, S.bentHandle ? 3.0 : 3.6));
  g.add(bolt);
  // sights
  const sightH = B + 1.75;
  g.add(rearNotch(M, 9.5, B + 0.7, sightH, 1.6));
  if (!has('scope')) g.add(frontPost(M, muzzleX - 1.2, B + 0.5, sightH, S.hood));
  g.add(swivel(M, -12, -3.2)); g.add(swivel(M, S.foreL - 2, B - 1.7));
  return finish(g, { muzzle: V(muzzleX, B, 0), sightH, B, rightHand: S.pistol ? V(-4.7, -1.9, 0) : V(-5.2, -1.3, 0), leftHand: V(10, B - 2.2, -0.4), ejectPort: V(1.5, B + 0.6, 1.1), action: 'bolt', parts: { bolt }, scopeX: -1, scopeBase: B + 1.2 });
}

function buildSemiRifle(M, id, has) {
  const S = {
    garand: { foreL: 20, bar: 26, buttL: 14, mat: M.walnut, mag: null, gas: true },
    gewehr43: { foreL: 16, bar: 26, buttL: 14, mat: M.walnut, mag: 5, pistol: true, gasTop: true },
    svt40: { foreL: 17, bar: 28, buttL: 14, mat: M.birch, mag: 5, brake: true, gasTop: true },
    m1carbine: { foreL: 13, bar: 18, buttL: 12, mat: M.walnut, mag: 6, carbine: true },
  }[id];
  const B = 1.6, g = new THREE.Group();
  g.add(riflestock(M, { buttL: S.buttL, foreL: S.foreL, B, pistol: !!S.pistol, mat: S.mat }));
  g.add(ext([[6.5, B + 0.3], [S.foreL * 0.85, B + 0.3], [S.foreL * 0.85 + 0.5, B + 1.1], [7.2, B + 1.25]], 2.0, S.mat, { bevel: 0.45 }));
  // receiver
  g.add(ext([[-3.2, B - 1.0], [7, B - 1.0], [7, B + 0.9], [5, B + 1.25], [-1.5, B + 1.25], [-3.2, B + 0.7]], 2.4, M.park, { bevel: 0.35 }));
  g.add(lathe([[0, 0.95], [0.8, 0.8], [S.bar - 4, 0.6], [S.bar - 4, 0]], M.park, 7, B, 0, 20));
  let muzzleX = 7 + S.bar - 4;
  if (S.gas) { g.add(tube(0.95, 3.2, M.park, muzzleX - 3.2, B - 0.25, 0, 0.95, 20)); g.add(tube(0.5, 0.6, M.park, muzzleX - 0.1, B - 0.25, 0)); }
  if (S.gasTop) g.add(tube(0.35, S.bar - 9, M.blued, 8, B + 0.85, 0));
  if (S.brake) { g.add(tube(0.85, 3, M.blued, muzzleX, B, 0)); for (let i = 0; i < 5; i++) g.add(box(0.25, 0.4, 1.9, M.dark, muzzleX + 0.5 + i * 0.5, B, 0)); muzzleX += 3; }
  g.add(bands(M, [S.foreL * 0.55, S.foreL - 1], B - 0.3, 1.45, M.park));
  g.add(triggerGroup(M, -0.2, -1.3, M.park, true));
  let mag = null;
  if (S.mag) { mag = magazine(M, S.mag, 3.6, 2.0, 0.03, M.park); mag.position.set(3, -1.1, 0); g.add(mag); }
  else g.add(rbox(4.5, 0.4, 2.2, M.park, 3, -1.25, 0, 0.12));
  // operating rod / charging handle (animated)
  const charger = new THREE.Group();
  if (id === 'garand') { charger.add(rbox(10, 0.6, 0.5, M.park, 6, B - 0.4, 1.35, 0.15)); charger.add(rbox(1.2, 1.0, 1.4, M.park, 1.5, B + 0.1, 1.6, 0.25)); }
  else if (S.carbine) { charger.add(rbox(6, 0.5, 0.45, M.park, 4, B - 0.2, 1.3, 0.12)); charger.add(rbox(0.9, 0.8, 1.1, M.park, 6.5, B - 0.2, 1.7, 0.2)); }
  else charger.add(rbox(1, 1, 1.6, M.blued, 0.5, B + 0.6, -1.6, 0.25));
  g.add(charger);
  const sightH = B + 1.85;
  if (id === 'garand' || S.carbine) { // receiver-mounted aperture
    g.add(rbox(2, sightH - B - 0.6, 1.8, M.park, -2.2, (sightH + B) / 2 + 0.05, 0, 0.2));
    const ap = new THREE.TorusGeometry(0.45, 0.16, 8, 16); ap.rotateY(Math.PI / 2); g.add(mesh(ap, M.park, -2.2, sightH, 0));
  } else g.add(rearNotch(M, 9, B + 0.6, sightH));
  if (!has('scope')) g.add(frontPost(M, muzzleX - (S.brake ? 4 : 1.2), B + 0.5, sightH, true));
  g.add(swivel(M, -12, -3.2));
  return finish(g, { muzzle: V(muzzleX, B, 0), sightH, B, rightHand: S.pistol ? V(-4.7, -1.9, 0) : V(-5.2, -1.3, 0), leftHand: V(9, B - 2.2, -0.4), ejectPort: V(2, B + 0.9, 0.9), action: id === 'garand' ? 'garand' : 'semi', parts: { charger, mag }, scopeX: -1.5, scopeBase: B + 1.3, magPos: V(3, -1.1, 0) });
}

function buildSMG(M, id, has) {
  const B = 1.7, g = new THREE.Group();
  let muzzleX, leftHand, magX = 6, magLen = 9, magCurve = 0, ejectPort = V(3, B + 0.9, 1.0);
  const charger = new THREE.Group();
  if (id === 'thompson') {
    g.add(ext([[-3, -0.2], [11, -0.2], [11, B + 0.6], [9.8, B + 1.05], [-1.2, B + 1.05], [-3, B + 0.6]], 2.7, M.blued, { bevel: 0.45 }));
    g.add(buttstock(M, { len: 13, top: B + 0.9, h: 4.8, drop: 1.4 }));
    g.add(pistolGrip(M, 0.6, -0.1, M.walnut));
    g.add(ext([[11, B - 0.6], [17, B - 0.6], [17.4, B - 1.6], [16.6, B - 2.4], [11.3, B - 2.4]], 2.4, M.walnut, { bevel: 0.6 })); // handguard
    g.add(lathe([[0, 0.75], [10.5, 0.62], [10.5, 0.0]], M.blued, 11, B, 0, 20));
    muzzleX = 21.5;
    charger.add(sphere(0.55, M.bright, 5.5, B + 1.15, 0));
    g.add(rearNotch(M, 0.5, B + 0.9, B + 2.25, 1.2));
    if (!has('scope')) g.add(frontPost(M, muzzleX - 0.8, B + 0.4, B + 2.25));
    leftHand = V(14, B - 2.4, -0.3);
    magX = 6.5; magLen = 9;
  } else if (id === 'mp40') {
    g.add(tube(1.25, 14, M.paint, -3, B, 0, 1.25, 24));
    g.add(ext([[-1.8, -0.2], [9.5, -0.2], [9.5, B - 0.6], [-1.8, B - 0.6]], 2.4, M.bakelite, { bevel: 0.35 })); // lower
    g.add(pistolGrip(M, 0.4, -0.1, M.bakelite, 5.2, 0.6));
    // folding wire stock
    for (const z of [-0.8, 0.8]) g.add(tube(0.22, 12, M.paint, -15, B - 0.2 - (z > 0 ? 1.4 : 0), z));
    g.add(rbox(0.7, 4.2, 2.3, M.paint, -15.2, B - 1.6, 0, 0.2));
    g.add(lathe([[0, 0.7], [9, 0.55], [9, 0]], M.blued, 11, B, 0, 18));
    g.add(rbox(1.6, 1.2, 1.8, M.paint, 18.8, B - 1.1, 0, 0.2)); // barrel rest
    muzzleX = 20;
    charger.add(rbox(0.7, 0.9, 1.4, M.bright, 4, B + 0.2, -1.6, 0.2));
    g.add(rearNotch(M, 9, B + 1.0, B + 2.0, 1.1));
    if (!has('scope')) g.add(frontPost(M, muzzleX - 0.6, B + 0.4, B + 2.0, true));
    leftHand = V(6, -3.5, -0.2); // holds the mag housing
    magX = 6.2; magLen = 12;
  } else { // ppsh41 / type100: wooden stock, perforated jacket
    const ppsh = id === 'ppsh41';
    g.add(ext([[-3, -0.1], [9.5, -0.1], [9.5, B + 1.2], [-2, B + 1.5], [-3, B + 0.9]], 2.6, M.blued, { bevel: 0.4 }));
    g.add(riflestock(M, { buttL: 13, foreL: 9, B, pistol: false, mat: ppsh ? M.birch : M.beech }));
    g.add(sleeve(1.35, 10, M.perfR, 9.5, B, 0));
    g.add(tube(0.45, 10.5, M.blued, 9.5, B, 0));
    muzzleX = 20;
    if (ppsh) { g.add(ext([[19.5, B - 1.35], [21.2, B - 1.35], [20.4, B + 1.4], [19.5, B + 1.4]], 2.7, M.blued, { bevel: 0.2 })); muzzleX = 21; }
    charger.add(rbox(0.8, 0.8, 1.2, M.bright, 3, B + 0.7, 1.5, 0.2));
    g.add(rearNotch(M, 7, B + 1.2, B + 2.2, 1.2));
    if (!has('scope')) g.add(frontPost(M, muzzleX - 1, B + 1.0, B + 2.2, ppsh));
    leftHand = V(7, B - 2.4, -0.3);
    magX = 5; magLen = 9; magCurve = ppsh ? 0.18 : 0;
  }
  g.add(charger);
  g.add(triggerGroup(M, 1.6, -0.3, M.blued));
  // magazine (side-feeding Type 100 mag points left)
  let mag;
  if (has('drum') && id !== 'mp40') { mag = new THREE.Group(); const d = drum(M, 5, 3); d.position.set(0, -5, 0); mag.add(d); mag.add(rbox(2, 1.6, 1.8, M.blued, 0, -0.6, 0, 0.2)); }
  else {
    mag = magazine(M, has('extmag') ? magLen * 1.45 : magLen, 2.3, 1.6, magCurve, M.blued);
    if (has('dualmag')) { const m2 = magazine(M, magLen, 2.3, 1.6, magCurve, M.blued); m2.position.z = 1.9; mag.add(m2); mag.add(rbox(2.6, 1.4, 3.8, M.canvas, magCurve * magLen * 0.3, -magLen * 0.45, 0.95, 0.2)); }
  }
  if (id === 'type100') { mag.rotation.x = Math.PI / 2; mag.position.set(magX, B, -1.2); } else mag.position.set(magX, -0.15, 0);
  g.add(mag);
  return finish(g, { muzzle: V(muzzleX, B, 0), sightH: B + (id === 'thompson' ? 2.25 : id === 'mp40' ? 2.0 : 2.2), B, leftHand, rightHand: id === 'ppsh41' || id === 'type100' ? V(-5.2, -1.3, 0) : undefined, ejectPort, action: 'auto', parts: { charger, mag }, scopeX: 0, scopeBase: B + 1.6, magPos: mag.position.clone() });
}

function buildAR(M, id, has) {
  const B = 1.8, g = new THREE.Group();
  const charger = new THREE.Group();
  let muzzleX, leftHand, mag;
  if (id === 'stg44') {
    g.add(ext([[-3, -0.2], [9, -0.2], [10.5, B - 0.5], [14, B - 0.5], [14, B + 0.9], [12, B + 1.15], [-2, B + 1.15], [-3, B + 0.8]], 2.5, M.paint, { bevel: 0.35 }));
    g.add(tube(0.75, 12, M.paint, 12, B + 0.9, 0)); // gas tube
    g.add(lathe([[0, 0.65], [10, 0.55], [10, 0]], M.blued, 12, B, 0, 18));
    g.add(ext([[11, B - 0.6], [19, B - 0.6], [19, B + 0.2], [11, B + 0.2]], 2.2, M.paint, { bevel: 0.3 }));
    g.add(buttstock(M, { len: 13, top: B + 1.0, h: 4.6, drop: 1.0, mat: M.walnut }));
    g.add(pistolGrip(M, 0.5, -0.15, M.bakelite, 5.4, 0.7));
    muzzleX = 22.5;
    charger.add(rbox(0.6, 0.6, 1.4, M.bright, 6, B + 0.7, -1.7, 0.2));
    g.add(rearNotch(M, 4, B + 1.3, B + 2.4, 1.3));
    if (!has('scope')) g.add(frontPost(M, muzzleX - 1, B + 0.5, B + 2.4, true));
    leftHand = V(15, B - 2.0, -0.3);
    mag = magazine(M, has('extmag') ? 15 : 11, 2.8, 1.8, 0.28, M.paint);
    mag.position.set(5.5, -0.15, 0);
  } else { // BAR
    g.add(ext([[-3, -0.6], [15, -0.6], [15, B + 1.1], [-3, B + 1.3]], 2.7, M.blued, { bevel: 0.35 }));
    g.add(buttstock(M, { len: 14, top: B + 1.1, h: 5.2, drop: 1.2, mat: M.walnut }));
    g.add(triggerGroup(M, 0.6, -0.6, M.blued, true));
    g.add(ext([[14, B - 1.2], [22, B - 1.2], [22, B - 3.1], [14.5, B - 3.4]], 2.6, M.walnut, { bevel: 0.6 }));
    g.add(lathe([[0, 0.8], [18, 0.65], [18, 0]], M.blued, 15, B, 0, 18));
    g.add(tube(0.55, 10, M.blued, 22, B - 1.2, 0));
    g.add(lathe([[0, 0.7], [1.6, 1.0], [2.4, 1.0], [2.4, 0]], M.blued, 33, B, 0, 16)); // flash hider
    muzzleX = 35.4;
    charger.add(rbox(1, 0.8, 1.4, M.bright, 6, B, -1.8, 0.2));
    g.add(rearNotch(M, -1, B + 1.3, B + 2.3, 1.5));
    if (!has('scope')) g.add(frontPost(M, 32.5, B + 0.6, B + 2.3));
    leftHand = V(18, B - 3.4, -0.3);
    mag = magazine(M, has('extmag') ? 9 : 6, 4.2, 2.2, 0.02, M.blued);
    mag.position.set(7, -0.55, 0);
  }
  if (has('dualmag')) { const m2 = mag.clone(); m2.position.set(0, 0, 2.1); mag.add(m2); mag.add(rbox(3.2, 1.3, 4.2, M.canvas, 0.6, -3, 1.05, 0.2)); }
  g.add(charger); g.add(mag);
  if (id === 'stg44') g.add(triggerGroup(M, 1.6, -0.3, M.paint));
  return finish(g, { muzzle: V(muzzleX, B, 0), sightH: B + (id === 'stg44' ? 2.4 : 2.3), B, leftHand, ejectPort: V(3, B + 1.0, 1.1), action: 'auto', parts: { charger, mag }, scopeX: 1, scopeBase: B + 1.6, magPos: mag.position.clone() });
}

function buildMG(M, id, has) {
  const B = 2.0, g = new THREE.Group();
  const charger = new THREE.Group();
  let mag, cover = null, muzzleX, leftHand;
  if (id === 'mg42') {
    g.add(ext([[-3, -0.4], [16, -0.4], [16, B + 1.2], [-3, B + 1.2]], 3.0, M.paint, { bevel: 0.3 }));
    cover = new THREE.Group(); cover.position.set(-2.5, B + 1.2, 0);
    cover.add(rbox(9, 0.8, 3.1, M.paint, 4.5, 0.35, 0, 0.2)); g.add(cover);
    g.add(sleeve(1.75, 15, M.perfO, 16, B, 0)); g.add(tube(1.75, 1.2, M.paint, 16, B, 0)); g.add(tube(0.55, 15.5, M.blued, 16, B, 0));
    g.add(lathe([[0, 1.75], [1.5, 1.2], [3, 1.0], [3, 0]], M.paint, 31, B, 0, 18));
    muzzleX = 34;
    g.add(buttstock(M, { len: 12, top: B + 1.0, h: 4.4, drop: 0.6, mat: M.bakelite, thin: true }));
    g.add(pistolGrip(M, 1, -0.4, M.bakelite, 5.2, 0.7));
    g.add(triggerGroup(M, 2.2, -0.6, M.paint, true));
    charger.add(rbox(1.0, 0.8, 1.8, M.bright, 12, B + 0.2, 2.0, 0.25));
    mag = new THREE.Group();
    mag.add(rbox(5.5, 5, 4, M.nade, 0, -2.5, 0, 0.5));
    mag.add(rbox(5.6, 0.6, 4.1, M.paint, 0, 0.1, 0, 0.2));
    for (let i = 0; i < 7; i++) { // belt of rounds feeding the gun
      const rr = new THREE.Group(); rr.position.set(-1.8 + i * 0.6, 1.6 + Math.min(i, 4) * 0.25, 2.4 - Math.min(i, 4) * 0.45);
      rr.add(tube(0.32, 2.2, M.brass, -1.1, 0, 0)); rr.rotation.y = Math.PI / 2; mag.add(rr);
    }
    mag.position.set(4, -0.5, -4.5);
    g.add(rearNotch(M, 9, B + 1.2, B + 2.6, 1.6));
    if (!has('scope')) g.add(frontPost(M, 29, B + 1.4, B + 2.6));
    leftHand = V(9, -1.0, 2.3); // left hand on top of the stock area
  } else if (id === 'dp28') {
    g.add(tube(1.3, 14, M.blued, -3, B, 0));
    g.add(sleeve(1.45, 12, M.perfO, 11, B, 0)); g.add(tube(0.55, 17, M.blued, 11, B, 0));
    g.add(lathe([[0, 0.9], [1.2, 1.15], [2, 1.15], [2, 0]], M.blued, 28, B, 0, 14));
    muzzleX = 30;
    g.add(buttstock(M, { len: 13, top: B + 0.8, h: 5, drop: 1.6, mat: M.birch }));
    g.add(ext([[-3, B - 1.1], [2, B - 1.1], [0.5, -2.4], [-1.6, -3.8], [-3, -1.5]], 2.4, M.birch, { bevel: 0.6 }));
    g.add(triggerGroup(M, 0.8, -0.2, M.blued, true));
    charger.add(rbox(1.2, 0.7, 1.2, M.bright, 6, B - 0.6, 1.6, 0.2));
    mag = new THREE.Group(); const pan = lathe([[-0.7, 0], [-0.7, 6], [-0.2, 6.6], [0.5, 6.6], [0.7, 4], [0.9, 0]], M.blued, 0, 0, 0, 40); pan.rotation.z = Math.PI / 2; mag.add(pan);
    const hub = lathe([[-0.2, 0], [-0.2, 1.4], [0.3, 1.4], [0.3, 0]], M.bright, 0, 0.9, 0, 16); hub.rotation.z = Math.PI / 2; mag.add(hub);
    mag.position.set(5, B + 2.0, 0);
    g.add(rearNotch(M, 9, B + 0.8, B + 4.2, 1.2)); // raised sights to clear the pan
    if (!has('scope')) g.add(frontPost(M, 27, B + 0.9, B + 4.2, true));
    leftHand = V(-6, -2.8, -0.2);
  } else { // type99
    g.add(ext([[-3, -0.3], [13, -0.3], [13, B + 1.1], [-3, B + 1.1]], 2.6, M.blued, { bevel: 0.3 }));
    g.add(lathe([[0, 0.8], [16, 0.65], [16, 0]], M.blued, 13, B, 0, 18));
    for (let i = 0; i < 9; i++) g.add(tube(1.3, 0.3, M.blued2, 13.5 + i * 0.9, B, 0));
    g.add(lathe([[0, 0.7], [1.6, 1.0], [2.2, 1.0], [2.2, 0]], M.blued, 29, B, 0, 16));
    muzzleX = 31.2;
    g.add(buttstock(M, { len: 13, top: B + 0.9, h: 4.8, drop: 1.2, mat: M.beech }));
    g.add(pistolGrip(M, 1, -0.3, M.beech, 5.2, 0.8));
    g.add(triggerGroup(M, 2.2, -0.5, M.blued, true));
    charger.add(rbox(1, 0.8, 1.4, M.bright, 6, B, -1.7, 0.2));
    mag = magazine(M, has('extmag') ? 12 : 8, 2.8, 1.8, -0.25, M.blued); mag.rotation.z = Math.PI; mag.position.set(5, B + 1.1, 0.7);
    g.add(rearNotch(M, 9, B + 1.1, B + 2.4, 1.2)); g.children[g.children.length - 1].position.z = -1.6;
    if (!has('scope')) { const fp = frontPost(M, 26, B + 0.5, B + 2.4); fp.position.z = -1.6; g.add(fp); }
    leftHand = V(-6, -2.6, -0.2);
  }
  g.add(charger); g.add(mag);
  const sightH = id === 'dp28' ? B + 4.2 : id === 'mg42' ? B + 2.6 : B + 2.4;
  return finish(g, { muzzle: V(muzzleX, B, 0), sightH, sightZ: id === 'type99' ? -1.6 : 0, B, leftHand, ejectPort: V(4, B - 0.6, 1.2), action: 'auto', parts: { charger, mag, cover }, scopeX: 2, scopeBase: B + 1.6, magPos: mag.position.clone(), beltFed: id === 'mg42', pan: id === 'dp28' });
}

// ---- Cold War / modern weapons: one parametric builder driven by a per-gun description
const MODERN = {
  ak47: { style: 'ak', len: 13, bar: 5, hg: 8, hguard: 'wood', furn: 'wood', stock: 'wood', mag: 'curved', magL: 10, curve: 0.3, gas: true, muzzle: 'slant' },
  m16a1: { style: 'ar', fsb: true, len: 15, bar: 7, hg: 9, hguard: 'ribbed', stock: 'a2', mag: 'straight', magL: 8, handle: 'carry', muzzle: 'bird' },
  famas: { custom: true, irons: false, bull: true, len: 16, bar: 6, mag: 'straight', magL: 7, handle: 'long', muzzle: 'bird' },
  galil: { style: 'ak', len: 14, bar: 6, hg: 8, hguard: 'wood', stock: 'fold', mag: 'curved', magL: 10, curve: 0.25, gas: true },
  aug: { custom: true, irons: false, bull: true, len: 17, bar: 7, furn: 'od', mag: 'straight', magL: 8, muzzle: 'bird', vgrip: true },
  fal: { custom: true, irons: false, len: 16, bar: 8, hg: 9, hguard: 'none', stock: 'none', mag: 'straight', magL: 7, magW: 3.2, muzzle: 'bird', recH: 1.3 },
  m14: { custom: true, irons: false, len: 14, bar: 22, hg: 0, hguard: 'none', furn: 'wood', stock: 'none', muzzle: 'bird', mag: 'straight', magL: 6, magW: 3.2, recMat: 'park' },
  m4a1: { style: 'ar', fsb: true, len: 14, bar: 4, hg: 8, hguard: 'quad', rail: true, stock: 'collapsible', mag: 'straight', magL: 9, curve: 0.06, muzzle: 'bird' },
  m16a4: { style: 'ar', fsb: true, len: 15, bar: 8, hg: 9, hguard: 'quad', rail: true, stock: 'a2', mag: 'straight', magL: 9, curve: 0.06, muzzle: 'bird' },
  scarh: { style: 'ar', len: 15, bar: 5, hg: 9, hguard: 'quad', rail: true, furn: 'tan', stock: 'fold', mag: 'straight', magL: 7, magW: 3.2, recMat: 'poly' },
  acr: { style: 'ar', len: 15, bar: 5, hg: 9, hguard: 'mlok', rail: true, stock: 'skeleton', mag: 'straight', magL: 9, recMat: 'poly' },
  tar21: { custom: true, bull: true, len: 16, bar: 5, mag: 'straight', magL: 9, rail: true, muzzle: 'bird' },
  f2000: { custom: true, irons: false, bull: true, len: 17, bar: 4, mag: 'straight', magL: 9, rail: true, smooth: true },
  an94: { style: 'ak', len: 15, bar: 6, hg: 8, hguard: 'square', stock: 'skeleton', mag: 'curved', magL: 10, curve: 0.28, muzzle: 'brake', rail: true },
  xm8: { custom: true, len: 15, bar: 4, hg: 9, hguard: 'none', furn: 'tan', stock: 'none', mag: 'curved', magL: 9, curve: 0.15, recMat: 'poly', rail: true },
  mp5k: { custom: true, irons: false, len: 11, bar: 2, hg: 4, hguard: 'none', stock: 'none', mag: 'curved', magL: 9, curve: 0.2, vgrip: true },
  uzi: { custom: true, irons: false, len: 11, bar: 3, hg: 0, stock: 'none', mag: 'grip', recH: 1.4 },
  skorpion: { custom: true, irons: false, len: 9, bar: 3, hg: 0, stock: 'none', mag: 'curved', magL: 7, curve: 0.35, magX: 4.4 },
  ak74u: { style: 'ak', len: 11, bar: 3, hg: 5, hguard: 'wood', furn: 'wood', stock: 'fold', mag: 'curved', magL: 10, curve: 0.3, gas: true, muzzle: 'big' },
  mac11: { custom: true, irons: false, len: 7, bar: 2, hg: 0, stock: 'none', mag: 'grip', recH: 1.6 },
  mp7: { custom: true, len: 10, bar: 3, hg: 3, hguard: 'none', rail: true, stock: 'none', mag: 'grip', recMat: 'poly', vgrip: true },
  vector: { custom: true, len: 12, bar: 3, hg: 4, hguard: 'none', rail: true, stock: 'fold', mag: 'straight', magL: 7, magX: 4.5, recMat: 'poly', recH: 1.6 },
  p90: { custom: true, irons: false, bull: true, len: 15, bar: 2, mag: 'top', bulky: true },
  ump45: { custom: true, len: 13, bar: 3, hg: 5, hguard: 'none', stock: 'none', mag: 'straight', magL: 9, recMat: 'poly', rail: true },
  pp2000: { custom: true, irons: false, len: 9, bar: 2, hg: 0, stock: 'none', mag: 'grip', recMat: 'poly' },
  m60: { custom: true, irons: false, len: 18, bar: 12, hg: 8, hguard: 'round', furn: 'od', stock: 'none', mag: 'belt', recMat: 'park', bipod: true },
  rpk: { style: 'ak', len: 14, bar: 10, hg: 8, hguard: 'wood', furn: 'wood', stock: 'wood', mag: 'curved', magL: 12, curve: 0.3, gas: true, bipod: true },
  stoner63: { len: 16, bar: 9, hg: 8, hguard: 'round', stock: 'fixed', mag: 'belt' },
  rpd: { len: 16, bar: 12, hg: 9, hguard: 'wood', furn: 'wood', stock: 'wood', mag: 'drum', bipod: true },
  mg4: { len: 17, bar: 9, hg: 7, hguard: 'square', rail: true, stock: 'none', mag: 'belt', recMat: 'poly', bipod: true },
  lsat: { len: 16, bar: 9, hg: 8, hguard: 'square', rail: true, stock: 'tube', mag: 'belt' },
  l86: { custom: true, bull: true, len: 17, bar: 10, mag: 'straight', magL: 9, rail: true, bipod: true },
  l96: { custom: true, len: 14, bar: 16, hg: 12, hguard: 'none', furn: 'od', stock: 'none', mag: 'straight', magL: 4, bolt: true },
  svd: { style: 'ak', len: 14, bar: 14, hg: 9, hguard: 'wood', furn: 'wood', stock: 'thumb', mag: 'straight', magL: 5, curve: 0.1, gas: true, muzzle: 'slant' },
  wa2000: { custom: true, bull: true, len: 20, bar: 10, furn: 'wood', mag: 'straight', magL: 5 },
  psg1: { custom: true, len: 16, bar: 12, hg: 10, hguard: 'none', stock: 'none', mag: 'straight', magL: 5 },
  m200: { len: 15, bar: 18, hg: 12, hguard: 'none', stock: 'skeleton', mag: 'straight', magL: 4, bolt: true, muzzle: 'brake' },
  m82: { custom: true, len: 20, bar: 16, hg: 9, hguard: 'none', stock: 'none', mag: 'straight', magL: 5, magW: 4, muzzle: 'brake', recH: 2.0 },
  dsr50: { custom: true, bull: true, len: 16, bar: 16, mag: 'straight', magL: 4, bolt: true, muzzle: 'brake' },
  ithaca37: { custom: true, irons: false, len: 12, bar: 16, hg: 0, furn: 'wood', stock: 'wood', mag: 'none', tube: true, pump: true, shell: true },
  spas12: { len: 13, bar: 14, hg: 0, stock: 'none', mag: 'none', tube: true, pump: true, shell: true },
  aa12: { custom: true, irons: false, len: 15, bar: 9, hg: 6, hguard: 'none', stock: 'none', mag: 'drum', shell: true, recH: 1.6 },
  ksg: { custom: true, irons: false, bull: true, len: 16, bar: 9, mag: 'none', pump: true, shell: true, twin: true },
  m1014: { irons: false, len: 13, bar: 13, hg: 7, hguard: 'round', stock: 'collapsible', mag: 'none', tube: true, shell: true },
  m1887: { custom: true, irons: false, len: 11, bar: 16, hg: 0, furn: 'wood', stock: 'wood', mag: 'none', tube: true, pump: true, shell: true, lever: true },
};
// Picatinny rail: a base with raised cross-slot teeth
function picRail(M, g, len, x0, y, z, rotX) {
  const r = new THREE.Group();
  r.add(box(len, 0.35, 1.05, M.alu, len / 2, 0, 0));
  for (let x = 0.3; x < len - 0.2; x += 0.62) r.add(box(0.38, 0.22, 1.12, M.alu, x, 0.27, 0));
  r.position.set(x0, y, z); r.rotation.x = rotX || 0;
  g.add(r);
}
// AR-15 family: separate upper and lower, magwell, pins, port, forward assist, rear charging handle
function arReceiver(M, g, sp, B, top, L, charger, has) {
  const metal = sp.recMat === 'poly' ? (sp.furn === 'tan' ? M.stippleTan : M.poly) : M.alu;
  // lower: trigger area + flared magazine well
  g.add(ext([[-3, B - 0.25], [-3, 0.3], [-2.2, -0.2], [3.4, -0.2], [3.6, -1.1], [3.9, -1.45], [7.6, -1.45], [7.9, -1.1], [8.1, -0.2], [9, 0.6], [9, B - 0.25]], 2.3, metal, { bevel: 0.25 }));
  // upper: flat-top body
  g.add(ext([[-3.3, B - 0.25], [L - 3, B - 0.25], [L - 3, top - 0.15], [-3.3, top - 0.15]], 2.15, metal, { bevel: 0.2 }));
  // ejection port with dust cover (right side) and brass deflector
  g.add(box(3.4, 0.75, 0.12, M.dark, 3.6, B + 0.35, 1.08));
  g.add(box(3.6, 0.85, 0.06, metal, 3.6, B - 0.2, 1.12));
  g.add(rbox(0.7, 0.8, 0.5, metal, 1.6, B + 0.55, 1.15, 0.2));
  // forward assist (right rear)
  const fa = tube(0.42, 1.5, metal, -2.6, B + 0.55, 1.2); fa.rotation.y = -0.35; g.add(fa);
  g.add(sphere(0.48, M.alu, -2.9, B + 0.55, 1.35));
  // left side: bolt catch, selector, pivot / takedown pins, mag release (right)
  g.add(rbox(1.2, 0.5, 0.2, metal, 3.0, 0.6, -1.25, 0.1));
  const sel = rbox(1.2, 0.35, 0.18, M.blued, 0.2, B - 0.75, -1.26, 0.08); sel.rotation.z = 0.25; g.add(sel);
  for (const [x, y] of [[-1.8, B - 0.6], [7.8, B - 0.45]]) { g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.5, 10).rotateX(Math.PI / 2), M.blued, x, y, 0)); }
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 12).rotateX(Math.PI / 2), M.blued, 3.4, 0.4, 1.2));
  // trigger guard (part of the lower on an AR)
  g.add(ext([[-0.6, -0.2], [3.2, -0.2], [3.2, -0.55], [2.6, -1.4], [0, -1.4], [-0.6, -0.55]], 0.4, metal, { bevel: 0.1 }));
  const trig = ext([[0, 0], [0.32, 0], [0.12, -0.95], [-0.25, -1.15], [-0.08, -0.85]], 0.32, M.blued, { bevel: 0.06 }); trig.position.set(1.4, -0.2, 0); g.add(trig);
  // A2-style pistol grip with a finger groove bump
  g.add(pistolGrip(M, 0.6, -0.25, M.stipple, 5.2, 1.1));
  const fg = new THREE.SphereGeometry(0.45, 10, 8); fg.scale(1, 1, 2.2);
  g.add(mesh(fg, M.stipple, 1.25, -2.9, 0));
  // rear T charging handle (pulled back at the end of a reload)
  charger.add(box(1.6, 0.35, 0.9, M.alu, -3.6, top - 0.35, 0));
  charger.add(box(0.5, 0.4, 2.6, M.alu, -4.3, top - 0.35, 0));
  // buffer tube + castle nut for AR stocks
  if (sp.stock === 'collapsible' || sp.stock === 'a2') {
    g.add(ring(0.82, 0.18, M.blued, -3.4, B + 0.25, 0));
    if (sp.stock === 'collapsible') g.add(tube(0.7, 9, M.alu, -12.4, B + 0.25, 0));
  }
}
// AK family: stamped receiver, curved dust cover, rivets, long selector, carrier charging handle
function akReceiver(M, g, sp, B, top, L, charger, furnWood) {
  g.add(ext([[-3, B + 0.4], [-3, 0.1], [-2.4, -0.25], [L - 3.2, -0.25], [L - 3, 0.2], [L - 3, B + 0.4]], 2.2, M.blued, { bevel: 0.18 }));
  const cover = new THREE.CylinderGeometry(1.1, 1.1, L - 1.2, 18, 1, false, Math.PI, Math.PI); cover.rotateZ(-Math.PI / 2);
  g.add(mesh(cover, M.blued2, -3 + (L - 1.2) / 2, B + 0.4, 0));
  g.add(box(0.8, 0.6, 2.25, M.blued, -2.6, B + 0.6, 0)); // rear of dust cover / latch
  g.add(rbox(2.2, 1.2, 2.3, M.blued, L - 3.6, B + 0.6, 0, 0.2)); // front trunnion
  for (const x of [-1.8, -0.8, 6.8, 8.4, L - 4.2]) for (const sd of [-1, 1]) g.add(sphere(0.13, M.bright, x, 0.4, sd * 1.12)); // rivets
  // selector lever (right side) and charging handle on the bolt carrier
  const sel = box(6.2, 0.35, 0.18, M.blued, 2.6, B - 0.05, 1.2); sel.rotation.z = -0.06; g.add(sel);
  g.add(box(0.8, 1.0, 0.2, M.blued, -0.5, B - 0.4, 1.2));
  charger.add(box(1.6, 0.35, 0.4, M.bright, L - 5.5, B + 0.4, 1.25));
  charger.add(sphere(0.38, M.bright, L - 4.8, B + 0.4, 1.55));
  // rear sight leaf block on the trunnion
  g.add(rbox(1.8, 0.7, 1.4, M.blued, L - 2.4, top - 0.1, 0, 0.15));
  // trigger guard (flat steel)
  g.add(ext([[-0.4, -0.25], [3.4, -0.25], [3.4, -0.5], [2.8, -1.3], [0, -1.3], [-0.4, -0.55]], 0.35, M.blued, { bevel: 0.08 }));
  const trig = ext([[0, 0], [0.32, 0], [0.12, -0.95], [-0.25, -1.15], [-0.08, -0.85]], 0.32, M.blued, { bevel: 0.06 }); trig.position.set(1.4, -0.25, 0); g.add(trig);
  g.add(pistolGrip(M, 0.6, -0.25, furnWood ? M.bakelite : M.stipple, 5.0, 1.0));
}

// ================================================================ per-gun realism details
function at(o, x, y, z) { o.position.set(x || 0, y || 0, z || 0); return o; }
function plate(pts, d, mat, x, y, z, bevel) { return at(ext(pts, d, mat, { bevel: bevel == null ? Math.min(0.25, d * 0.3) : bevel }), x, y, z); }
// side-profile extrusion with see-through holes (thumbholes, trigger guards, lightening cuts)
function holed(outer, holes, d, mat, bevel) {
  const sh = new THREE.Shape();
  outer.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
  for (const h of holes) { const p = new THREE.Path(); h.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); sh.holes.push(p); }
  bevel = bevel == null ? Math.min(0.3, d * 0.3) : bevel;
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.05, d - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  g.computeVertexNormals();
  return mesh(g, mat);
}
// round holes / slots / grooves on both sides of a part whose half-width is zw
function sideHoles(M, g, x0, dx, n, y, zw, r) {
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CircleGeometry(r, 14), M.dark); c.position.set(x0 + i * dx, y, s * (zw + 0.02)); if (s < 0) c.rotation.y = Math.PI; g.add(c); }
}
function sideSlots(M, g, x0, dx, n, y, zw, w, h) { for (let i = 0; i < n; i++) g.add(rbox(w, h, zw * 2 + 0.06, M.dark, x0 + i * dx, y, 0, Math.min(w, h) * 0.45)); }
function grooves(M, g, x0, dx, n, y, h, zw) { for (let i = 0; i < n; i++) g.add(box(0.16, h, zw * 2 + 0.04, M.dark, x0 + i * dx, y, 0)); }
function pin(M, g, x, y, zw, r) { g.add(mesh(new THREE.CylinderGeometry(r || 0.18, r || 0.18, zw * 2 + 0.08, 10).rotateX(Math.PI / 2), M.blued2, x, y, 0)); }
function trigBlade(M, g, x, y) { g.add(at(ext([[0, 0], [0.35, 0], [0.15, -1.2], [-0.25, -1.45], [-0.1, -1.1]], 0.35, M.blued, { bevel: 0.08 }), x, y, 0)); }
function guardLoop(M, g, x, y, w, h, mat, d) { // simple rounded trigger guard loop below a receiver
  g.add(at(holed([[0, 0], [w, 0], [w, -h * 0.45], [w - 0.7, -h], [0.2, -h], [-0.2, -h * 0.5]], [[[0.4, -0.3], [w - 0.4, -0.3], [w - 0.4, -h * 0.4], [w - 0.9, -h + 0.35], [0.45, -h + 0.35]]], d || 0.5, mat, 0.08), x, y, 0));
}
function lever(M, g, x, y, z, len, rot, mat) { const l = rbox(len, 0.32, 0.14, mat || M.blued, x, y, z, 0.1); l.rotation.z = rot || 0; g.add(l); }
function irons(M, g, rx, fx, base, sightH, opts) { // rear aperture (protected) + front post with ears, both at sightH
  opts = opts || {};
  g.add(rbox(1.0, sightH - base - 0.15, 1.1, opts.mat || M.blued, rx, (base + sightH - 0.15) / 2, 0, 0.12));
  g.add(ring(0.34, 0.11, opts.mat || M.blued, rx, sightH, 0));
  if (opts.ears) for (const s of [-1, 1]) g.add(box(0.8, 0.9, 0.14, opts.mat || M.blued, rx, sightH - 0.05, s * 0.62));
  if (fx != null) {
    g.add(rbox(0.9, Math.max(0.3, sightH - base - 0.95), 1.1, opts.mat || M.blued, fx, base + Math.max(0.3, sightH - base - 0.95) / 2, 0, 0.12));
    for (const s of [-1, 1]) g.add(box(0.5, 1.0, 0.14, opts.mat || M.blued, fx, sightH - 0.3, s * 0.45));
    g.add(box(0.16, 0.95, 0.16, M.dark, fx, sightH - 0.47, 0));
  }
}
// folding skeleton stock with a big lightening cut (UMP, MG4)
function skelStock(M, g, top, mat) {
  g.add(holed([[-3, top - 0.2], [-13.6, top - 0.4], [-13.8, -2.6], [-12.6, -2.8], [-6.5, -0.4], [-3, -0.2]],
    [[[-12.2, top - 1.0], [-4.5, top - 0.9], [-4.5, 0.6], [-6.8, 0.2], [-12.2, -1.6]]], 2.2, mat, 0.35));
  g.add(rbox(0.8, top + 2.9, 2.4, M.dark, -14.0, (top - 0.4 - 2.6) / 2, 0, 0.3)); // butt pad
  g.add(rbox(1.0, 2.6, 2.5, M.blued, -3.2, top - 1.4, 0, 0.2)); // hinge
}
// HK roller-delayed receiver (MP5, PSG1): stamped body, polymer trigger housing, pins, flutes
function hkReceiver(c, x0, x1) {
  const { M, g, B, top, recMat } = c;
  g.add(ext([[x0, 0.2], [x1, 0.2], [x1, top - 0.15], [x1 - 0.35, top + 0.05], [x0 + 0.4, top + 0.05], [x0, top - 0.35]], 2.2, recMat, { bevel: 0.25 }));
  g.add(box(x1 - x0 - 3.5, 0.16, 2.24, M.dark, (x0 + x1) / 2 + 0.6, B + 0.7, 0)); // stamped flute
  g.add(box(x1 - x0 - 3.5, 0.12, 2.24, M.dark, (x0 + x1) / 2 + 0.6, 0.5, 0));
  g.add(ext([[x0 + 0.5, 0.45], [3.9, 0.45], [3.9, -0.45], [3.2, -0.75], [x0 + 1.2, -0.75], [x0 + 0.5, -0.2]], 2.0, M.poly, { bevel: 0.2 })); // trigger housing
  g.add(rbox(3.4, 1.0, 2.1, recMat, 5.5, -0.15, 0, 0.2)); // magwell
  g.add(box(0.45, 0.9, 1.1, M.blued, 7.4, -0.85, 0)); // paddle release
  pin(M, g, x0 + 0.9, 0.0, 1.0); pin(M, g, 3.4, -0.1, 1.0); pin(M, g, x1 - 0.6, 0.6, 1.1);
  g.add(rbox(0.7, top, 2.35, M.poly, x0 - 0.25, top / 2, 0, 0.2)); // end cap
  g.add(box(2.6, 0.7, 0.08, M.dark, 3.5, B + 0.3, 1.14)); // ejection port (right)
  lever(M, g, -0.6, B - 0.85, -1.08, 1.4, 0.35); // selector
  g.add(pistolGrip(M, 0.6, -0.4, M.stipple, 5.0, 0.9));
  g.add(triggerGroup(M, 1.7, -0.55, M.poly));
}
function hkDrumSight(M, g, x, top, sightH) {
  g.add(rbox(1.4, 0.5, 1.6, M.blued, x, top + 0.2, 0, 0.15));
  const d = new THREE.CylinderGeometry(0.4, 0.4, 1.0, 16); d.rotateX(Math.PI / 2); g.add(mesh(d, M.blued, x, top + 0.25, 0)); // rotary drum, below the sight line
  g.add(box(0.35, Math.max(0.1, sightH - top - 0.93), 0.4, M.blued, x, (top + 0.65 + sightH - 0.28) / 2, 0));
  g.add(ring(0.28, 0.1, M.blued, x, sightH, 0));
}
function hkFrontSight(M, g, x, base, sightH) {
  g.add(rbox(1.0, sightH - base - 0.2, 1.0, M.blued, x, (base + sightH - 0.2) / 2, 0, 0.15));
  const h = new THREE.TorusGeometry(0.5, 0.12, 8, 18); h.rotateY(Math.PI / 2); g.add(mesh(h, M.blued, x, sightH - 0.05, 0));
  g.add(box(0.14, 0.5, 0.14, M.dark, x, sightH - 0.3, 0));
}
function bullBody(c, pts, mat, w) { c.g.add(ext(pts, w || 2.8, mat || c.furn, { bevel: 0.55 })); }

const DETAIL = {
  // ---------------------------------------------------------------- assault / battle rifles
  fal(c) {
    const { M, g, B, top, charger, hx, hl, mx, out } = c;
    g.add(ext([[-3, B - 0.5], [13, B - 0.5], [13, top - 0.2], [12.4, top], [-2.6, top], [-3, top - 0.4]], 2.3, M.blued, { bevel: 0.25 })); // upper receiver
    g.add(ext([[-3.2, B - 0.5], [9, B - 0.5], [9, -0.3], [8.3, -1.2], [3.3, -1.2], [2.8, -0.4], [-3.2, -0.4]], 2.4, M.blued2, { bevel: 0.2 })); // lower + magwell
    g.add(box(12, 0.08, 2.36, M.dark, 3, B - 0.5, 0)); // receiver seam
    g.add(box(5.2, 0.24, 0.1, M.dark, 9.2, B + 0.25, -1.17)); // charging slot (left side)
    charger.add(rbox(0.5, 0.45, 1.4, M.blued, 11.2, B + 0.25, -1.8, 0.12)); charger.add(rbox(0.9, 0.35, 0.4, M.blued, 11.2, B + 0.25, -1.3, 0.1));
    g.add(box(2.8, 0.7, 0.08, M.dark, 4.5, B + 0.4, 1.19)); // ejection port
    lever(M, g, 0.2, B - 0.85, -1.22, 1.6, 0.4); pin(M, g, -2.6, B - 0.9, 1.2, 0.22); pin(M, g, 8.6, B - 0.9, 1.2);
    c.grip(M.stipple);
    // vented metal handguard
    g.add(rbox(hl, 2.3, 2.5, M.park, hx + hl / 2, B - 0.1, 0, 0.4));
    sideHoles(M, g, hx + 1.0, 1.15, 7, B + 0.35, 1.25, 0.28); sideHoles(M, g, hx + 1.6, 1.15, 6, B - 0.55, 1.25, 0.28);
    // gas block / regulator and the front sight base
    const fx = hx + hl + 0.4;
    g.add(rbox(1.4, 1.4, 1.5, M.blued, fx, B + 0.35, 0, 0.2)); g.add(tube(0.3, 1.2, M.blued, fx + 0.5, B + 1.0, 0));
    out.sightH = top + 1.0;
    irons(M, g, -1.8, fx, top, out.sightH, { ears: true });
    g.add(buttstock(M, { len: 13, top: top - 0.2, h: 4.4, drop: 0.5, mat: M.poly }));
  },
  m14(c) {
    const { M, g, B, top, charger, mx, out } = c;
    g.add(ext([[-16.5, top - 0.4], [-15.5, top - 0.2], [-4.5, B + 0.1], [-3, B + 0.6], [25, B + 0.4], [26, B + 0.1], [26, B - 1.0], [24, B - 1.2], [9, B - 1.3], [8.2, -0.6], [3.2, -0.6], [2.6, -0.4], [-0.6, -0.4], [-1.8, -1.6], [-3.4, -3.0], [-5.2, -3.0], [-5.8, -1.6], [-12, -1.9], [-16.5, -3.2]], 2.4, M.walnut, { bevel: 0.6 }));
    g.add(box(0.45, 4.6, 2.3, M.park, -16.6, top - 2.6, 0)); // steel butt plate
    g.add(ext([[-3, B + 0.3], [8.5, B + 0.3], [8.5, top + 0.1], [-2.4, top + 0.1], [-3, top - 0.3]], 1.9, M.park, { bevel: 0.2 })); // receiver
    g.add(plate([[8.5, B + 0.4], [15, B + 0.4], [15, B + 1.35], [9, B + 1.45]], 1.9, M.walnut, 0, 0, 0, 0.35)); // upper handguard
    g.add(tube(0.26, 17, M.park, 7, B + 0.25, 1.05)); // operating rod (right)
    charger.add(rbox(1.1, 0.6, 0.5, M.park, 7.2, B + 0.45, 1.25, 0.15));
    g.add(triggerGroup(M, 0.6, -0.4, M.park));
    g.add(tube(0.55, 3.2, M.park, 26, B - 1.0, 0)); g.add(rbox(1.0, 2.4, 2.0, M.park, 26.2, B - 0.35, 0, 0.25)); // gas cylinder + front band
    g.add(sphere(0.25, M.bright, 27.6, B - 1.0, 0)); // gas spindle valve
    out.sightH = top + 1.2;
    irons(M, g, -2.0, null, top + 0.1, out.sightH, { ears: true, mat: M.park });
    g.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 12).rotateX(Math.PI / 2), M.park, -2.0, top + 0.5, -0.85)); // windage knob
    const fx = mx + 0.4; // front sight on the flash suppressor
    g.add(box(0.22, out.sightH - B - 0.7, 0.2, M.park, fx, (out.sightH + B + 0.7) / 2 - 0.1, 0));
    for (const s of [-1, 1]) g.add(box(0.4, 0.9, 0.12, M.park, fx, out.sightH - 0.55, s * 0.38));
    out.leftHand = V(16, B - 2.0, -0.3);
  },
  // ---------------------------------------------------------------- bullpups
  famas(c) {
    const { M, g, B, top, charger, out } = c;
    bullBody(c, [[-15, top - 0.2], [-14.5, top], [-1, top], [0, top - 0.3], [13, top - 0.3], [13.4, B - 1.2], [3.4, B - 1.4], [3.0, -0.3], [-1.5, -0.3], [-3, -1.0], [-8, -1.0], [-12, -3.0], [-15, -3.0]], M.poly);
    g.add(pistolGrip(M, 0.6, -0.3, M.poly, 5.2, 0.6)); trigBlade(M, g, 1.7, -0.4);
    g.add(plate([[2.2, -0.3], [3.2, -0.3], [2.9, -5.1], [-1.4, -5.5], [-1.4, -4.9], [2.2, -4.6]], 0.7, M.poly)); // full-hand guard
    grooves(M, g, 4.2, 0.9, 10, B - 0.4, 1.4, 1.42);
    for (const s of [-1, 1]) { g.add(tube(0.2, 9, M.blued, 3.6, B + 0.2, s * 1.55)); g.add(rbox(0.6, 0.3, 0.5, M.blued, 12.4, B + 0.2, s * 1.55, 0.1)); } // folded bipod legs
    g.add(rbox(6, 1.2, 0.5, M.poly, -10, top - 1.0, -1.55, 0.2)); // cheek rest
    g.add(box(3.0, 0.8, 0.08, M.dark, -6, B + 0.2, 1.43));
    charger.add(rbox(1.2, 0.6, 0.8, M.blued, 2.5, top + 0.35, 0, 0.15));
    out.sightH = top + 2.75;
    g.add(ring(0.32, 0.11, M.blued, -9.6, out.sightH, 0)); g.add(box(0.5, 0.35, 0.6, M.blued, -9.6, top + 2.3, 0)); // rear aperture on the handle
    for (const s of [-1, 1]) g.add(box(0.5, 0.8, 0.14, M.blued, 6.4, out.sightH - 0.2, s * 0.42));
    g.add(box(0.16, 0.7, 0.16, M.dark, 6.4, out.sightH - 0.35, 0));
  },
  aug(c) {
    const { M, g, B, top, charger, hx, out } = c;
    const od = M.polyOd;
    bullBody(c, [[-15, top - 0.4], [-14, top + 0.2], [-3.5, top + 0.2], [-2.5, top - 0.4], [14, top - 0.4], [14.3, B - 1.0], [9.5, B - 1.2], [9.2, -0.4], [-1.2, -0.4], [-3.5, -1.0], [-9, -1.0], [-12.5, -3.0], [-15, -3.0]], od, 3.0);
    g.add(pistolGrip(M, 0.6, -0.3, od, 5.0, 0.6)); trigBlade(M, g, 1.7, -0.4);
    g.add(holed([[-1.6, -0.4], [9.4, -0.4], [9.0, -1.4], [8.4, -5.2], [0.0, -5.6], [-1.8, -4.9]], [[[-0.2, -0.9], [7.8, -0.9], [7.4, -4.7], [0.4, -5.0]]], 1.6, od, 0.4)); // hand enclosure
    g.add(box(2.6, 0.8, 0.08, M.dark, -6, B + 0.2, 1.53));
    g.add(tube(0.38, 4.5, M.blued, hx, B + 0.75, 0)); // gas cylinder
    for (let i = 0; i < 4; i++) g.add(ring(0.62, 0.08, M.blued2, hx + 0.6 + i * 0.5, B, 0)); // barrel lock ribs
    charger.add(rbox(1.0, 0.5, 0.9, M.blued, 8.2, B + 0.55, -1.6, 0.15));
    // integrated 1.5x optic in the carry handle
    g.add(holed([[-5, top - 0.4], [-4, top + 1.6], [5, top + 1.6], [6, top - 0.4]], [[[-3.4, top - 0.1], [4.6, top - 0.1], [4.3, top + 1.0], [-3.0, top + 1.0]]], 1.2, od, 0.25));
    out.sightH = top + 2.35;
    g.add(lathe([[-0.6, 0.95], [0.6, 0.8], [10.4, 0.8], [11.2, 1.0], [12, 1.0], [12, 0.85], [11.2, 0.85], [10.4, 0.65], [0.6, 0.65], [-0.4, 0.8], [-0.6, 0.95]], M.blued, -5.6, out.sightH, 0, 24)); // open tube
    for (const x of [-5.2, 6.3]) { const gl = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), M.clearGlass); gl.rotation.y = Math.PI / 2; gl.position.set(x, out.sightH, 0); g.add(gl); }
    out.scopeBase = top + 3.2;
  },
  tar21(c) {
    const { M, g, B, top } = c;
    bullBody(c, [[-15, top - 0.3], [-14.4, top], [12.6, top], [13.2, top - 0.6], [13.2, B - 1.0], [12, B - 1.7], [4.8, B - 1.7], [4.6, -0.4], [-1.3, -0.4], [-3.0, -1.1], [-9, -1.1], [-12, -3.0], [-15, -3.0]], M.poly, 2.9);
    g.add(pistolGrip(M, 0.6, -0.3, M.stipple, 5.0, 0.6)); trigBlade(M, g, 1.7, -0.45);
    g.add(holed([[-1.6, -0.4], [5.0, -0.4], [4.8, -1.0], [4.2, -5.1], [-0.2, -5.5], [-1.8, -4.8]], [[[-0.2, -0.9], [3.8, -0.9], [3.4, -4.6], [0.4, -4.9]]], 1.1, M.poly, 0.25));
    sideSlots(M, g, 6.2, 1.4, 5, B - 0.2, 1.45, 0.8, 0.35);
    g.add(rbox(6, 1.1, 0.4, M.poly, -10, top - 0.8, -1.55, 0.15)); // cheek rest
    g.add(box(3.0, 0.8, 0.08, M.dark, -6, B + 0.3, 1.48));
    c.charger.add(rbox(1.0, 0.5, 0.9, M.blued, 9.5, B + 0.6, -1.6, 0.15));
  },
  f2000(c) {
    const { M, g, B, top, out } = c;
    bullBody(c, [[-15.2, top - 0.6], [-14, top + 0.4], [-2, top + 0.6], [15.4, top + 0.6], [16.6, top - 0.2], [16.8, B - 0.8], [16, B - 1.5], [10, B - 1.6], [9.4, -0.4], [-1.3, -0.4], [-3, -1.0], [-9, -1.0], [-12.4, -3.2], [-15, -3.2]], M.poly, 3.0);
    g.add(pistolGrip(M, 0.6, -0.3, M.stipple, 5.0, 0.6)); trigBlade(M, g, 1.7, -0.45);
    g.add(holed([[-1.6, -0.4], [9.6, -0.4], [9.2, -1.4], [8.4, -5.0], [0.0, -5.5], [-1.8, -4.8]], [[[-0.2, -0.9], [8.0, -0.9], [7.4, -4.5], [0.4, -4.9]]], 1.4, M.poly, 0.35));
    g.add(box(12, 0.06, 3.04, M.dark, 4, B + 0.2, 0)); // shell seam
    picRail(M, g, 12, -5, top + 0.78, 0);
    out.sightH = top + 1.95; out.scopeBase = top + 1.15;
    if (!c.optic) irons(M, g, -4, 6.5, top + 1.1, out.sightH);
    c.charger.add(rbox(1.0, 0.5, 0.8, M.blued, 12, top + 0.3, -1.55, 0.15));
    out.leftHand = V(9, -2.6, -0.3);
  },
  l86(c) {
    const { M, g, B, top } = c;
    bullBody(c, [[-15, top - 0.3], [-14.5, top], [14, top], [14.2, B - 1.2], [4.2, B - 1.4], [3.4, -0.4], [-1.3, -0.4], [-2.8, -1.2], [-8, -1.2], [-12, -3.6], [-15, -3.6]], M.poly);
    g.add(ext([[-6.2, B - 1.2], [5.8, B - 1.2], [5.8, top + 0.05], [-6.2, top + 0.05]], 2.86, M.park, { bevel: 0.15 })); // steel receiver
    g.add(box(4.0, 0.25, 0.08, M.dark, 1.5, B + 0.35, 1.47)); c.charger.add(rbox(0.8, 0.6, 0.6, M.blued, 2.8, B + 0.35, 1.65, 0.15)); // charging handle (right)
    g.add(box(2.6, 0.8, 0.08, M.dark, -3.2, B + 0.2, 1.47));
    sideSlots(M, g, 7, 1.3, 5, B - 0.2, 1.42, 0.7, 0.35);
    g.add(pistolGrip(M, 0.6, -0.3, M.poly, 5.2, 0.8)); g.add(triggerGroup(M, 1.6, -0.45, M.poly));
    g.add(plate([[-11.4, -1.4], [-10.0, -1.3], [-10.6, -4.6], [-12.2, -4.7]], 2.0, M.poly)); // rear grip
    g.add(rbox(0.6, top + 3.6, 2.9, M.dark, -15.2, (top - 3.6) / 2, 0, 0.2));
  },
  dsr50(c) {
    const { M, g, B, top, hx } = c;
    bullBody(c, [[-15, top + 0.5], [-13.6, top + 0.5], [-13.6, top - 0.4], [13, top - 0.4], [13, B - 1.2], [2.8, B - 1.3], [2.6, -0.4], [-1, -0.4], [-2, -1.2], [-8.5, -1.2], [-11.5, -2.8], [-13.6, -2.8], [-13.6, -3.6], [-15, -3.6]], M.poly, 2.8);
    g.add(rbox(5, 0.8, 1.8, M.poly, -9.6, top + 0.65, 0, 0.3)); for (const x of [-11, -8.2]) g.add(tube(0.15, 0.9, M.bright, x, top + 0.2, 0).rotateZ(Math.PI / 2)); // cheek riser
    g.add(pistolGrip(M, 0.6, -0.3, M.stipple, 5.0, 0.6)); g.add(triggerGroup(M, 1.6, -0.45, M.blued));
    g.add(tube(1.0, 9, M.alu, hx, B, 0, 1.0, 10)); sideSlots(M, g, hx + 1.2, 1.4, 6, B, 1.0, 0.9, 0.35); // free-float tube
    g.add(tube(0.25, 3, M.blued, -13, -3.6, 0).rotateZ(-Math.PI / 2)); // monopod
  },
  wa2000(c) {
    const { M, g, B, top, hx } = c;
    bullBody(c, [[-15, top], [-13, top + 0.4], [-5.5, top + 0.4], [-5, B - 0.4], [-1.4, B - 0.6], [-1.4, -0.4], [-3, -1.0], [-8, -1.0], [-12.5, -3.4], [-15, -3.4]], M.walnut, 2.6);
    g.add(pistolGrip(M, 0.6, -0.3, M.walnut, 5.2, 0.8)); g.add(triggerGroup(M, 1.6, -0.45, M.blued));
    g.add(ext([[-5.2, B - 1.2], [3.0, B - 1.2], [3.0, top], [-5.2, top]], 2.4, M.blued, { bevel: 0.2 })); // action plates
    g.add(rbox(22.4, 0.6, 1.6, M.blued, (-5.2 + hx) / 2, top - 0.05, 0, 0.15)); // upper beam
    g.add(rbox(hx - 3, 1.1, 2.3, M.walnut, (3 + hx) / 2, B - 1.05, 0, 0.35)); // fore-end
    g.add(rbox(1.0, top - B + 2.1, 2.3, M.blued, hx - 0.4, (top + B - 1.6) / 2, 0, 0.2)); // front block
    g.add(lathe([[0, 0.66], [hx + 2, 0.62], [hx + 2, 0]], M.blued, -2, B, 0, 18));
    for (const s of [-1, 1]) g.add(box(hx - 4, 0.14, 0.12, M.dark, (hx + 2) / 2, B + s * 0.25, s > 0 ? 0.6 : -0.6)); // flutes
    g.add(rbox(1.0, top + 3.4, 2.7, M.dark, -15.3, (top - 3.4) / 2, 0, 0.2));
  },
  ksg(c) {
    const { M, g, B, top, out } = c;
    bullBody(c, [[-15, top - 0.2], [-14.2, top + 0.2], [8, top + 0.2], [8.6, top - 0.4], [8.6, B - 2.4], [3.2, B - 2.4], [3.0, -0.6], [-1.2, -0.6], [-3, -1.2], [-9, -1.3], [-12.4, -3.4], [-15, -3.4]], M.poly, 2.9);
    g.add(pistolGrip(M, 0.6, -0.5, M.stipple, 5.0, 0.6)); g.add(triggerGroup(M, 1.6, -0.6, M.poly));
    for (const s of [-1, 1]) { g.add(tube(0.6, 25, M.blued, -6, B - 1.3, s * 0.65)); g.add(sphere(0.6, M.blued, 19, B - 1.3, s * 0.65)); }
    g.add(rbox(1.2, 2.4, 2.6, M.blued, 19.2, B - 0.6, 0, 0.3)); // barrel/tube clamp
    picRail(M, g, 16, -8, top + 0.35, 0);
    out.sightH = top + 1.6; out.scopeBase = top + 0.6;
    if (!c.optic) irons(M, g, -6, 7, top + 0.6, out.sightH);
    out.onPump = (p) => { p.add(at(ext([[-0.9, 0], [0.9, 0], [0.8, -3.6], [-0.8, -3.6]], 1.5, M.stipple, { bevel: 0.45 }), 3, -1.0, 0)); };
  },
  p90(c) {
    const { M, g, B, top, out } = c;
    const bt = top + 0.8;
    g.add(holed([[-12.5, -3.6], [-13.2, -0.6], [-12.6, B + 0.8], [-11, bt], [10, bt], [11.6, B + 0.6], [12.4, B - 0.4], [11.4, -1.0], [8.6, -1.2], [8.4, -4.4], [6.8, -4.7], [-4.4, -4.8], [-6.4, -4.6], [-9.6, -4.2]],
      [[[-4.6, -0.6], [-1.4, -0.6], [-1.0, -3.9], [-4.0, -3.9]], [[1.4, -0.6], [7.2, -0.6], [7.0, -3.9], [1.0, -3.9]]], 3.4, M.poly, 0.7));
    trigBlade(M, g, 1.9, -0.5);
    g.add(box(18, 0.07, 3.44, M.dark, -1, B - 0.2, 0)); // shell seam
    sideSlots(M, g, -11.5, 0.7, 3, -2.2, 1.7, 0.3, 1.6); // butt texture
    for (const s of [-1, 1]) c.charger.add(sphere(0.38, M.poly, 9.4, B + 0.2, s * 1.85));
    // ring sight housing
    g.add(rbox(3.6, 0.8, 1.9, M.poly, -7.4, top + 1.8, 0, 0.3));
    out.sightH = top + 2.6;
    for (const x of [-9.0, -5.8]) { g.add(ring(0.45, 0.1, M.poly, x, out.sightH, 0)); g.add(box(0.3, 0.3, 0.3, M.poly, x, top + 2.2, 0)); } // open reflex hood
    out.leftHand = V(7.8, -2.6, -0.3);
  },
  // ---------------------------------------------------------------- SMGs / PDWs
  mp5k(c) {
    const { M, g, B, top, charger, out } = c;
    hkReceiver(c, -3, 8.2);
    g.add(rbox(3.8, 1.9, 2.3, M.poly, 10.1, B - 0.3, 0, 0.55)); // handguard
    g.add(rbox(0.6, 1.0, 2.0, M.poly, 12.0, B - 1.5, 0, 0.2)); // hand stop
    g.add(tube(0.5, 3.4, c.recMat, 8.2, B + 0.95, 0)); // cocking tube
    g.add(box(2.4, 0.2, 0.1, M.dark, 9.8, B + 0.95, -0.52)); // cocking slot
    charger.add(rbox(0.45, 0.45, 1.4, M.blued, 10.8, B + 1.0, -1.0, 0.12));
    out.sightH = top + 0.75;
    hkDrumSight(M, g, -2.2, top, out.sightH);
    hkFrontSight(M, g, 11.2, B + 1.3, out.sightH);
    g.add(ring(0.75, 0.15, M.blued, 12.6, B, 0)); // barrel nut
  },
  psg1(c) {
    const { M, g, B, top, charger, hx, hl } = c;
    hkReceiver(c, -3, hx);
    g.add(rbox(hl, 2.7, 2.8, M.poly, hx + hl / 2, B - 0.2, 0, 0.5)); sideSlots(M, g, hx + 1.2, 1.6, 5, B - 0.4, 1.4, 1.0, 0.35);
    g.add(box(1.8, 0.2, 0.1, M.dark, hx + 1.4, B + 0.8, -1.45)); charger.add(rbox(0.45, 0.45, 1.4, M.blued, hx + 2.2, B + 0.85, -1.9, 0.12));
    g.add(plate([[-1.8, -4.8], [1.2, -4.8], [1.6, -5.4], [-2.4, -5.6]], 2.6, M.poly)); // palm shelf
    g.add(ext([[-3.3, top - 0.2], [-15, top + 0.2], [-15.6, top + 0.2], [-15.6, -2.9], [-14.4, -3.0], [-6, -0.8], [-3.3, -0.4]], 2.3, M.poly, { bevel: 0.45 }));
    g.add(rbox(6, 0.7, 2.0, M.poly, -10, top + 0.9, 0, 0.25)); for (const x of [-12, -8]) g.add(tube(0.15, 0.8, M.bright, x, top + 0.25, 0).rotateZ(Math.PI / 2));
    g.add(rbox(0.6, top + 3.4, 2.6, M.dark, -15.9, (top - 3.4) / 2 + 0.2, 0, 0.2));
  },
  uzi(c) {
    const { M, g, B, top, charger, out } = c;
    g.add(ext([[-3, 0.0], [8, 0.0], [8, top], [-3, top]], 2.4, M.blued, { bevel: 0.3 }));
    g.add(ext([[-3.1, top - 0.5], [7.2, top - 0.5], [7.2, top + 0.15], [-2.8, top + 0.15]], 2.5, M.blued2, { bevel: 0.15 })); // top cover
    for (let x = -2.4; x < 6.9; x += 0.7) g.add(box(0.25, 0.12, 2.3, M.blued2, x, top + 0.2, 0)); // stamped ribs
    g.add(box(4.2, 0.08, 0.4, M.dark, 3.2, top + 0.27, 0));
    charger.add(rbox(0.8, 0.6, 0.7, M.blued, 5.6, top + 0.5, 0, 0.2));
    g.add(plate([[0.8, 0.0], [-1.6, 0.0], [-2.0, -5.6], [0.4, -5.6]], 2.0, M.gripBlack, 0, 0, 0, 0.35));
    g.add(rbox(0.5, 2.6, 1.2, M.blued, -1.95, -1.6, 0, 0.15)); // grip safety
    g.add(holed([[0.6, 0.0], [4.2, 0.0], [4.2, -0.5], [3.4, -1.6], [0.4, -1.7]], [[[1.0, -0.3], [3.6, -0.3], [3.0, -1.3], [1.0, -1.3]]], 0.5, M.blued, 0.08));
    trigBlade(M, g, 1.5, -0.1);
    g.add(rbox(0.7, 0.5, 0.15, M.blued, -0.6, -0.4, -1.05, 0.1)); // selector
    for (const s of [-1, 1]) g.add(box(9.5, 0.4, 0.15, M.blued, 1.75, -0.15, s * 1.3)); // folded stock arms
    g.add(rbox(0.6, 2.2, 2.9, M.blued, 6.8, -0.9, 0, 0.2));
    g.add(ring(0.9, 0.22, M.blued, 8.1, B, 0)); // barrel nut
    out.sightH = top + 0.9;
    g.add(rbox(1.0, 0.5, 1.6, M.blued, 7.2, top + 0.3, 0, 0.15)); for (const s of [-1, 1]) g.add(box(0.6, 0.9, 0.15, M.blued, 7.2, out.sightH - 0.2, s * 0.55)); g.add(box(0.16, 0.8, 0.16, M.dark, 7.2, out.sightH - 0.3, 0));
    g.add(rbox(0.9, 0.6, 1.2, M.blued, -2.3, top + 0.4, 0, 0.12)); g.add(ring(0.25, 0.09, M.blued, -2.3, out.sightH, 0)); g.add(box(0.4, out.sightH - top - 0.55, 0.4, M.blued, -2.3, (top + 0.7 + out.sightH - 0.25) / 2, 0));
  },
  mac11(c) {
    const { M, g, B, top, charger, out } = c;
    g.add(ext([[-3, 0], [4, 0], [4, top], [-3, top]], 2.2, M.paint, { bevel: 0.2 }));
    g.add(box(7.05, 0.1, 2.25, M.dark, 0.5, B + 0.2, 0));
    g.add(box(3.0, 0.08, 0.35, M.dark, 1.4, top + 0.02, 0)); charger.add(rbox(0.7, 0.35, 0.7, M.blued, 2.6, top + 0.17, 0, 0.12));
    g.add(plate([[0.6, 0], [-1.8, 0], [-1.9, -5.6], [0.5, -5.6]], 1.9, M.stipple, 0, 0, 0, 0.3));
    g.add(holed([[0.4, 0], [3.6, 0], [3.6, -0.4], [3.0, -1.5], [0.4, -1.6]], [[[0.8, -0.3], [3.1, -0.3], [2.6, -1.2], [0.8, -1.2]]], 0.45, M.paint, 0.08));
    trigBlade(M, g, 1.3, -0.1);
    g.add(holed([[3.7, 0.2], [4.6, 0.2], [4.6, -1.0], [3.7, -1.0]], [[[3.95, -0.05], [4.35, -0.05], [4.35, -0.75], [3.95, -0.75]]], 0.6, M.paint, 0.05)); // sling loop
    for (let i = 0; i < 6; i++) g.add(ring(0.6, 0.06, M.blued2, 4.3 + i * 0.28, B, 0)); // threads
    out.sightH = top + 0.55;
    g.add(rbox(0.6, 0.5, 1.0, M.paint, -2.5, top + 0.2, 0, 0.1)); g.add(ring(0.2, 0.08, M.paint, -2.5, out.sightH, 0));
    g.add(box(0.15, 0.55, 0.15, M.paint, 3.6, top + 0.25, 0));
  },
  skorpion(c) {
    const { M, g, B, top, charger, out } = c;
    g.add(ext([[-3, 0.5], [6, 0.5], [6, top - 0.3], [5.6, top], [-2.5, top], [-3, top - 0.5]], 2.0, M.blued, { bevel: 0.2 }));
    for (const s of [-1, 1]) { charger.add(sphere(0.32, M.blued, 2.0, B + 0.35, s * 1.35)); charger.add(tube(0.12, 0.4, M.blued, 2.0, B + 0.35, s * 1.05).rotateY(Math.PI / 2)); }
    g.add(box(4.0, 0.12, 2.04, M.dark, 1.5, B + 0.35, 0));
    g.add(pistolGrip(M, 0.2, 0.5, M.gripBlack, 4.6, 0.9)); g.add(triggerGroup(M, 1.3, 0.35, M.blued));
    g.add(rbox(2.8, 0.7, 1.9, M.blued, 4.4, 0.25, 0, 0.15)); // magwell
    for (const s of [-1, 1]) g.add(tube(0.17, 9, M.blued, -3, top - 0.35, s * 1.12)); // wire stock folded alongside
    g.add(rbox(0.35, 1.3, 2.4, M.blued, 6.1, top - 0.6, 0, 0.12));
    g.add(ring(0.7, 0.18, M.blued, 6.1, B, 0));
    out.sightH = top + 0.7;
    g.add(rearNotch(M, -2.0, top - 0.1, out.sightH, 1.0));
    g.add(frontPost(M, 5.4, top - 0.6, out.sightH, true));
  },
  mp7(c) {
    const { M, g, B, top, charger, out } = c;
    g.add(ext([[-3.4, -0.4], [7.6, -0.4], [7.6, top - 0.2], [7.2, top], [-3.4, top]], 2.2, M.poly, { bevel: 0.3 }));
    g.add(ext([[7.6, B - 1.0], [10, B - 1.0], [10.4, B - 0.5], [10.4, B + 0.8], [7.6, B + 0.9]], 2.0, M.poly, { bevel: 0.3 }));
    for (const s of [-1, 1]) picRail(M, g, 2.4, 7.8, B, s * 1.05, s * Math.PI / 2);
    g.add(plate([[1.0, -0.4], [-1.4, -0.4], [-2.0, -5.6], [0.3, -5.6], [0.4, -3.6], [0.0, -3.2], [0.6, -1.6]], 2.0, M.stipple, 0, 0, 0, 0.35));
    g.add(holed([[0.6, -0.4], [5.6, -0.4], [5.6, -1.0], [4.6, -2.0], [0.6, -2.0]], [[[1.0, -0.7], [4.6, -0.7], [4.0, -1.6], [1.0, -1.6]]], 1.0, M.poly, 0.2));
    trigBlade(M, g, 1.6, -0.5);
    lever(M, g, -1.2, 0.6, -1.15, 1.2, 0.3);
    charger.add(box(1.4, 0.35, 0.8, M.poly, -3.9, top - 0.35, 0)); charger.add(box(0.5, 0.4, 2.4, M.poly, -4.5, top - 0.35, 0));
    for (const y of [B + 0.2, B - 0.9]) for (const s of [-1, 1]) g.add(tube(0.17, 6.1, M.blued, -9.5, y, s * 0.7));
    g.add(rbox(0.9, 3.0, 2.4, M.poly, -9.8, B - 0.4, 0, 0.3));
    g.add(box(2.4, 0.6, 0.08, M.dark, 3.2, B + 0.3, 1.13));
  },
  vector(c) {
    const { M, g, B, top, charger } = c;
    g.add(ext([[-3, top - 0.1], [6, top - 0.1], [9.6, B + 0.4], [9.6, -1.4], [6.0, -1.4], [3.0, -1.4], [3.0, -0.4], [-3, -0.4]], 2.3, M.poly, { bevel: 0.35 }));
    g.add(box(6.4, 0.08, 2.36, M.dark, 2.0, B - 0.3, 0)); // upper/lower seam
    g.add(rbox(3.0, 1.9, 2.0, M.poly, 11.1, B - 0.1, 0, 0.4)); picRail(M, g, 2.8, 9.7, B - 1.05, 0, Math.PI); // barrel shroud
    g.add(pistolGrip(M, 0.6, -0.4, M.stipple, 5.0, 0.7)); g.add(triggerGroup(M, 1.4, -0.55, M.poly));
    g.add(box(3.2, 0.25, 0.1, M.dark, 5.8, B + 0.4, -1.2)); charger.add(rbox(0.8, 0.5, 0.9, M.poly, 7.2, B + 0.4, -1.55, 0.15));
    lever(M, g, -0.6, B - 0.9, -1.2, 1.2, 0.3);
    g.add(box(2.4, 0.7, 0.08, M.dark, -0.6, B + 0.6, 1.18));
  },
  ump45(c) {
    const { M, g, B, top, charger, hx, hl } = c;
    g.add(ext([[-3, -0.4], [hx + 0.5, -0.4], [hx + 0.5, top - 0.2], [hx, top + 0.1], [-3, top + 0.1]], 2.4, M.poly, { bevel: 0.3 }));
    g.add(rbox(hl - 0.5, 2.2, 2.4, M.poly, hx + 0.5 + (hl - 0.5) / 2, B - 0.1, 0, 0.35));
    picRail(M, g, hl - 1, hx + 0.8, B - 1.2, 0, Math.PI); for (const s of [-1, 1]) picRail(M, g, hl - 1.5, hx + 1.0, B - 0.1, s * 1.2, s * Math.PI / 2);
    sideSlots(M, g, -1.5, 1.6, 6, 0.4, 1.2, 1.0, 0.4); // receiver ribs
    g.add(pistolGrip(M, 0.6, -0.4, M.stipple, 5.2, 0.6));
    g.add(holed([[-0.4, -0.4], [3.9, -0.4], [3.9, -0.9], [3.0, -1.9], [0.4, -1.9]], [[[0.3, -0.6], [3.3, -0.6], [2.7, -1.5], [0.6, -1.5]]], 1.0, M.poly, 0.2));
    trigBlade(M, g, 1.5, -0.5);
    g.add(box(4.0, 0.25, 0.1, M.dark, hx - 2.2, B + 0.7, -1.22)); charger.add(rbox(1.2, 0.5, 0.9, M.poly, hx - 1.0, B + 0.7, -1.6, 0.15));
    lever(M, g, -0.8, B - 0.9, -1.22, 1.3, 0.35);
    g.add(box(2.6, 0.8, 0.08, M.dark, 4.0, B + 0.6, 1.23));
    skelStock(M, g, top, M.poly);
  },
  pp2000(c) {
    const { M, g, B, top, charger, out } = c;
    g.add(ext([[-3, -0.3], [6.4, -0.3], [6.4, top - 0.4], [5.8, top], [-2.6, top], [-3, top - 0.5]], 2.1, M.poly, { bevel: 0.3 }));
    picRail(M, g, 5, -1.2, top + 0.05, 0);
    g.add(holed([[0.9, -0.3], [6.4, -0.3], [6.2, -3.9], [4.4, -3.9], [3.4, -1.8], [0.9, -1.8]], [[[1.3, -0.65], [5.6, -0.65], [5.4, -3.4], [4.8, -3.4], [3.8, -1.4], [1.3, -1.4]]], 1.2, M.poly, 0.25));
    g.add(plate([[0.8, -0.3], [-1.6, -0.3], [-2.0, -5.6], [0.4, -5.6], [0.4, -1.0]], 2.0, M.stipple, 0, 0, 0, 0.35));
    trigBlade(M, g, 1.7, -0.4);
    for (const s of [-1, 1]) charger.add(rbox(0.6, 0.4, 0.8, M.poly, -3.2, top - 0.3, s * 1.3, 0.12));
    out.sightH = top + 0.75; out.scopeBase = top + 0.5;
    if (!c.optic) { g.add(rearNotch(M, -2.2, top + 0.3, out.sightH, 1.0)); g.add(frontPost(M, 5.6, top + 0.2, out.sightH, false)); }
    out.leftHand = V(5.4, -2.2, -0.3);
  },
  xm8(c) {
    const { M, g, B, top, charger, hx, hl } = c;
    g.add(ext([[-3, -0.3], [hx, -0.3], [hx, top + 0.2], [hx - 2, top + 0.9], [-1, top + 0.9], [-3, top]], 2.5, M.polyTan, { bevel: 0.5 }));
    g.add(lathe([[0, 1.0], [0.5, 1.35], [hl - 1, 1.3], [hl, 1.0], [hl, 0]], M.polyTan, hx, B, 0, 20)); sideSlots(M, g, hx + 1.2, 1.4, 5, B - 0.3, 1.32, 0.8, 0.3);
    g.add(ext([[-3, top], [-14, top], [-14.6, -2.6], [-12.6, -2.8], [-6, -0.6], [-3, -0.4]], 2.4, M.polyTan, { bevel: 0.6 }));
    g.add(rbox(0.6, top + 2.6, 2.4, M.dark, -14.6, (top - 2.6) / 2, 0, 0.2));
    g.add(pistolGrip(M, 0.6, -0.3, M.stippleTan, 5.2, 0.7)); g.add(triggerGroup(M, 1.6, -0.45, M.polyTan));
    charger.add(rbox(1.2, 0.5, 0.8, M.poly, 3.0, top + 0.95, 0, 0.15));
    g.add(box(2.6, 0.7, 0.08, M.dark, 3.4, B + 0.4, 1.28));
  },
  // ---------------------------------------------------------------- machine guns
  m60(c) {
    const { M, g, B, top, hx, hl, mx, out } = c;
    g.add(ext([[-3, -0.3], [hx, -0.3], [hx, top], [-3, top]], 2.4, M.park, { bevel: 0.25 }));
    g.add(ext([[-1.5, top - 0.1], [9, top - 0.1], [9, top + 0.55], [-0.8, top + 0.7]], 2.5, M.park, { bevel: 0.15 })); // feed cover
    g.add(rbox(0.8, 0.5, 0.8, M.blued, 9.2, top + 0.3, 0, 0.12)); // cover latch
    g.add(box(3.0, 1.0, 0.1, M.dark, 3, B + 0.3, -1.25)); // feed opening (left)
    g.add(box(3.0, 0.8, 0.08, M.dark, 5, B + 0.3, 1.24));
    for (let i = 0; i < 6; i++) g.add(ring(1.2, 0.1, M.polyOd, hx + 1 + i * 1.2, B, 0)); // handguard ribs
    g.add(tube(0.5, 10, M.park, hx + hl, B - 1.1, 0)); // gas cylinder
    c.grip(M.polyOd);
    out.sightH = top + 1.2;
    g.add(rearNotch(M, -1.2, top + 0.5, out.sightH, 1.3));
    g.add(frontPost(M, mx - 1.0, B + 0.4, out.sightH, false));
    g.add(buttstock(M, { len: 13, top: top - 0.2, h: 4.4, drop: 0.5, mat: M.polyOd }));
    g.add(rbox(3.5, 0.5, 2.6, M.park, -14.4, top - 2.6, 0, 0.12)); // shoulder rest
  },
  stoner63(c) {
    const { M, g, B, top, hx, hl } = c;
    g.add(ext([[-1, top - 0.1], [8, top - 0.1], [8, top + 0.5], [-0.4, top + 0.6]], 2.6, M.blued, { bevel: 0.15 }));
    g.add(rbox(0.7, 0.4, 0.7, M.bright, 8.2, top + 0.25, 0, 0.1));
    sideHoles(M, g, hx + 1, 1.2, Math.floor(hl / 1.2), B + 0.3, 1.2, 0.25);
    g.add(tube(0.35, hl + 3, M.blued, hx, B + 1.1, 0));
  },
  rpd(c) {
    const { M, g, B, top, hx, hl } = c;
    g.add(ext([[-1.5, top - 0.1], [8, top - 0.1], [8, top + 0.45], [-0.8, top + 0.6]], 2.6, M.blued, { bevel: 0.15 }));
    g.add(tube(0.45, 7, M.blued, hx + hl, B - 1.0, 0)); g.add(rbox(1.2, 1.6, 1.4, M.blued, hx + hl + 7, B - 0.4, 0, 0.2));
    g.add(box(3, 0.25, 0.1, M.dark, 4, B + 0.3, 1.3)); c.charger.add(rbox(0.9, 0.6, 0.8, M.blued, 5, B + 0.3, 1.6, 0.15));
  },
  mg4(c) {
    const { M, g, B, top, hx } = c;
    g.add(ext([[-1.5, top - 0.1], [9, top - 0.1], [9, top + 0.4], [-1, top + 0.5]], 2.6, M.poly, { bevel: 0.15 }));
    g.add(holed([[hx + 1, B + 1.0], [hx + 1.5, B + 2.4], [hx + 4.5, B + 2.4], [hx + 5, B + 1.0]], [[[hx + 1.8, B + 1.3], [hx + 4.2, B + 1.3], [hx + 4.0, B + 2.0], [hx + 2.0, B + 2.0]]], 0.5, M.poly, 0.1)); // folding handle (folded)
    skelStock(M, g, top, M.poly);
  },
  lsat(c) {
    const { M, g, B, top } = c;
    g.add(ext([[-2, top - 0.1], [10, top - 0.1], [10, top + 0.5], [-1.4, top + 0.6]], 2.7, M.poly, { bevel: 0.2 }));
    g.add(rbox(0.8, 0.4, 0.8, M.blued, 10.2, top + 0.25, 0, 0.1));
  },
  // ---------------------------------------------------------------- snipers
  l96(c) {
    const { M, g, B, top, hx, hl } = c;
    const od = M.polyOd;
    g.add(holed([[-16, top + 0.4], [-14, top + 0.8], [-7, top + 0.8], [-5.5, top - 0.3], [-3, B - 0.4], [hx + hl, B - 0.4], [hx + hl + 0.6, B - 1.6], [hx + hl - 0.6, -0.6], [7.6, -0.6], [3.4, -0.6], [2.8, -0.6], [1.0, -0.6], [0.4, -5.0], [-1.8, -5.2], [-3, -4.9], [-10, -3.3], [-16, -3.4]],
      [[[-1.6, -0.6], [-5, 0.6], [-9, 0.4], [-9.5, -1.6], [-3.4, -3.9], [-2.1, -3.6]]], 2.6, od, 0.5));
    g.add(rbox(1.0, top + 3.8, 2.7, M.dark, -16.4, (top + 0.4 - 3.4) / 2, 0, 0.25)); // recoil pad
    for (const x of [-15.6, -15.2]) g.add(box(0.12, top + 3.6, 2.66, M.blued, x, (top + 0.4 - 3.4) / 2, 0)); // spacers
    g.add(tube(1.05, hx + 3, M.blued, -3, B + 0.45, 0)); // round action
    g.add(triggerGroup(M, 1.6, -0.6, M.blued));
    for (const s of [-1, 1]) g.add(tube(0.2, 7, M.blued, hx + hl - 8, B - 1.2, s * 0.85)); // folded bipod
    g.add(tube(0.25, 2.5, M.blued, -12, -3.5, 0).rotateZ(-Math.PI / 2)); // monopod
  },
  m200(c) {
    const { M, g, B, top, hx, hl } = c;
    g.add(tube(1.15, hl, M.alu, hx, B, 0, 1.15, 10)); sideSlots(M, g, hx + 1.2, 1.6, Math.floor(hl / 1.6) - 1, B, 1.15, 1.0, 0.35);
    picRail(M, g, hl + 12, -2, top + 0.1, 0);
    for (let i = 0; i < 3; i++) g.add(box(c.sp.bar - 2, 0.12, 0.12, M.dark, hx + hl + c.sp.bar / 2, B + 0.25 - i * 0.25, i === 1 ? -0.55 : -0.48)); // barrel flutes
    g.add(rbox(4.5, 0.8, 1.8, M.poly, -10, top + 0.2, 0, 0.3)); // cheek piece
  },
  m82(c) {
    const { M, g, B, top, hx, hl, out } = c;
    const fr = hx + hl;
    g.add(ext([[-3, B - 0.6], [fr, B - 0.6], [fr, top - 0.2], [fr - 0.6, top], [-2.4, top], [-3, top - 0.5]], 2.6, M.park, { bevel: 0.25 }));
    sideSlots(M, g, hx + 0.8, 1.5, 6, B + 0.6, 1.3, 1.0, 1.3);
    g.add(ext([[-3.4, B - 0.6], [12, B - 0.6], [12, -0.5], [9, -0.5], [8.6, -1.4], [3.4, -1.4], [3.0, -0.5], [-3.4, -0.5]], 2.4, M.park, { bevel: 0.2 }));
    g.add(ext([[-3.4, B - 0.6], [-15, B - 0.2], [-15.8, top], [-16.4, top], [-16.4, -3.4], [-15.2, -3.6], [-12, -1.2], [-3.4, -0.5]], 2.4, M.park, { bevel: 0.25 }));
    g.add(rbox(1.0, top + 3.8, 2.8, M.dark, -16.8, (top - 3.6) / 2, 0, 0.3));
    g.add(tube(0.3, 3.5, M.blued, -11, -1.4, 0).rotateZ(-Math.PI / 2));
    g.add(holed([[hx - 3.5, top], [hx - 2.9, top + 1.8], [hx + 2.9, top + 1.8], [hx + 3.5, top]], [[[hx - 2.3, top + 0.2], [hx + 2.3, top + 0.2], [hx + 2.1, top + 1.2], [hx - 2.1, top + 1.2]]], 0.8, M.park, 0.12));
    picRail(M, g, 14, -2.5, top + 0.05, 0); out.scopeBase = top + 0.45;
    c.grip(M.stipple);
    for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(fr - 0.5, B - 0.6, s * 0.9); leg.add(tube(0.28, 8, M.blued, 0, 0, 0)); leg.rotation.set(s * 0.12, 0, -1.2); g.add(leg); }
  },
  // ---------------------------------------------------------------- shotguns
  ithaca37(c) {
    const { M, g, B, top, hx, mx, out } = c;
    g.add(ext([[-3, -0.2], [hx, -0.2], [hx, B + 0.9], [hx - 0.6, top], [-2.2, top], [-3, top - 0.6]], 2.4, M.blued, { bevel: 0.4 }));
    g.add(box(4.0, 0.08, 0.3, M.dark, 2, top - 0.6, -1.21)); g.add(box(2.6, 0.08, 0.3, M.dark, 1.4, top - 0.9, -1.21)); // roll marks
    g.add(box(4, 0.1, 1.4, M.dark, 3.5, -0.2, 0)); // bottom loading / ejection port
    g.add(triggerGroup(M, 0.0, -0.2, M.blued, true));
    g.add(ext([[-3, -0.2], [-1, -0.2], [-2.6, -3.2], [-4.4, -3.6], [-5.4, -1.8]], 2.5, M.walnut, { bevel: 0.6 })); // wrist
    g.add(box(mx - hx, 0.18, 0.5, M.blued, (hx + mx) / 2, top - 0.05, 0)); // vent rib
    for (let x = hx + 1; x < mx - 0.5; x += 1.6) g.add(box(0.3, top - B - 0.6, 0.35, M.blued, x, (top + B + 0.5) / 2 - 0.1, 0));
    out.sightH = top + 0.25; g.add(sphere(0.18, M.bright, mx - 0.3, top + 0.15, 0));
    out.onPump = (p) => { for (let x = 0.6; x < 5.6; x += 0.45) p.add(ring(1.2, 0.06, M.dark, x, 0, 0)); };
  },
  spas12(c) {
    const { M, g, B, top, hx } = c;
    g.add(sleeve(0.95, c.sp.bar - 2, M.perfR, hx + 1, B + 0.1, 0));
    for (const y of [top - 0.6, -0.8]) g.add(tube(0.25, 11, M.blued, -14, y, 0));
    g.add(rbox(0.6, top + 1.4, 2.2, M.blued, -14.2, (top - 0.6 - 0.8) / 2 - 0.4, 0, 0.2));
    g.add(plate([[-14.4, -0.8], [-12.4, -1.4], [-11.8, -2.4], [-12.6, -2.6], [-13.4, -1.8], [-14.4, -1.6]], 0.6, M.blued)); // arm hook
    g.add(rbox(0.8, 0.6, 0.6, M.bright, -1, B - 0.6, -1.3, 0.15)); // mode button
    c.out.onPump = (p) => { for (let x = 0.6; x < 5.6; x += 0.6) p.add(ring(1.2, 0.07, M.dark, x, 0, 0)); };
  },
  aa12(c) {
    const { M, g, B, top, hx, hl, charger, out } = c;
    g.add(ext([[-3, -0.4], [hx, -0.4], [hx, top + 0.3], [-3, top + 0.3]], 2.8, M.paint, { bevel: 0.3 }));
    sideSlots(M, g, -1.5, 1.6, 8, B + 0.2, 1.4, 1.0, 0.3);
    g.add(rbox(hl, 2.3, 2.6, M.paint, hx + hl / 2, B - 0.2, 0, 0.4)); sideSlots(M, g, hx + 1, 1.2, Math.floor(hl / 1.2), B - 0.2, 1.3, 0.7, 0.3);
    g.add(holed([[-1.4, top + 0.3], [-0.8, top + 2.0], [9.6, top + 2.0], [10.2, top + 0.3]], [[[0.2, top + 0.6], [8.6, top + 0.6], [8.4, top + 1.5], [0.4, top + 1.5]]], 1.0, M.paint, 0.2));
    out.sightH = top + 2.45; out.scopeBase = top + 2.0;
    if (!c.optic) { g.add(ring(0.3, 0.1, M.paint, -0.2, out.sightH, 0)); g.add(box(0.7, 0.45, 0.9, M.paint, -0.2, top + 2.15, 0)); for (const s of [-1, 1]) g.add(box(0.5, 0.7, 0.14, M.paint, 9.4, out.sightH - 0.15, s * 0.4)); g.add(box(0.15, 0.6, 0.15, M.dark, 9.4, out.sightH - 0.25, 0)); }
    g.add(ext([[-3, top + 0.3], [-14, top + 0.1], [-14.6, top + 0.1], [-14.6, -2.8], [-13.4, -2.9], [-6.5, -0.6], [-3, -0.4]], 2.5, M.paint, { bevel: 0.4 }));
    c.grip(M.stipple);
    g.add(box(3.2, 0.25, 0.1, M.dark, 7.5, B + 0.4, -1.42)); charger.add(rbox(0.8, 0.6, 0.9, M.blued, 8.6, B + 0.4, -1.8, 0.15));
  },
  m1014(c) {
    const { M, g, B, top, mx, out } = c;
    picRail(M, g, 9, -2, top + 0.05, 0);
    g.add(tube(0.7, 9, M.alu, -12.4, B + 0.25, 0));
    out.sightH = top + 1.1; out.scopeBase = top + 0.45;
    if (!c.optic) {
      g.add(rbox(1.2, 0.7, 1.4, M.blued, -1.4, top + 0.6, 0, 0.15)); g.add(ring(0.42, 0.12, M.blued, -1.4, out.sightH, 0));
      for (const s of [-1, 1]) g.add(box(0.9, 1.3, 0.15, M.blued, -1.4, out.sightH - 0.05, s * 0.72)); // ghost ring with ears
      g.add(rbox(0.8, 0.6, 1.0, M.blued, mx - 0.8, B + 0.75, 0, 0.12)); g.add(box(0.18, out.sightH - B - 1.0, 0.18, M.blued, mx - 0.8, (out.sightH + B + 1.0) / 2 - 0.05, 0));
      for (const s of [-1, 1]) g.add(box(0.5, out.sightH - B - 1.0, 0.14, M.blued, mx - 0.8, (out.sightH + B + 1.0) / 2 - 0.1, s * 0.42));
    }
    g.add(rbox(1.2, 2.4, 1.6, M.blued, mx - 2.0, B - 0.7, 0, 0.3)); // barrel clamp
  },
  m1887(c) {
    const { M, g, B, top, hx, mx, out } = c;
    g.add(ext([[-3, -0.4], [hx, -0.4], [hx, B + 0.6], [hx - 1, top + 0.2], [-1.6, top + 0.2], [-3, top - 0.6]], 2.4, M.caseHard, { bevel: 0.45 }));
    g.add(ext([[-3, -0.4], [-1, -0.4], [-2.6, -3.2], [-4.4, -3.6], [-5.4, -1.8]], 2.5, M.walnut, { bevel: 0.6 })); // wrist
    const h = ext([[0, 0], [0.6, 0], [0.4, 1.2], [-0.5, 1.6], [-0.7, 1.3], [-0.2, 0.9]], 0.5, M.caseHard, { bevel: 0.1 }); h.position.set(-2.6, top - 0.4, 0); g.add(h); // exposed hammer
    trigBlade(M, g, 0.5, -0.5);
    g.add(plate([[hx, B - 0.6], [hx + 6, B - 0.7], [hx + 6.2, B - 1.9], [hx, B - 2.0]], 2.4, M.walnut, 0, 0, 0, 0.5)); // fore-end
    out.sightH = top + 0.35; g.add(sphere(0.2, M.brass, mx - 0.4, top + 0.2, 0)); g.add(box(0.25, top - B - 0.45, 0.25, M.blued, mx - 0.4, (top + B + 0.45) / 2 - 0.1, 0));
    out.onPump = (p) => { p.position.set(0.8, -0.4, 0); };
  },
};

function buildModern(M, id, has) {
  const sp = MODERN[id];
  const B = 1.8, g = new THREE.Group(), charger = new THREE.Group();
  const furn = { black: M.poly, wood: M.walnut, tan: M.polyTan, od: M.polyOd }[sp.furn || 'black'];
  const recMat = sp.recMat === 'poly' ? (sp.furn === 'tan' ? M.polyTan : M.poly) : sp.recMat === 'park' ? M.park : M.blued;
  const L = sp.len, top = B + (sp.recH || 1.1);
  let leftHand, magX, rightHand, hx, hl = sp.hg || 0;
  if (!sp.bull) {
    if (sp.custom) { /* receiver built by DETAIL */ }
    else if (sp.style === 'ar') arReceiver(M, g, sp, B, top, L, charger, has);
    else if (sp.style === 'ak') akReceiver(M, g, sp, B, top, L, charger, sp.furn === 'wood');
    else {
      g.add(ext([[-3, -0.3], [L - 3, -0.3], [L - 3, top - 0.25], [L - 3.6, top], [-2.2, top], [-3, top - 0.6]], 2.5, recMat, { bevel: 0.35 }));
      g.add(box(3.0, 0.7, 0.1, M.dark, 3.4, B + 0.35, 1.28)); // ejection port
      g.add(pistolGrip(M, 0.6, -0.2, sp.furn === 'wood' ? M.walnut : M.stipple, 5.4, 0.8));
      g.add(triggerGroup(M, 1.7, -0.35, recMat));
    }
    hx = L - 3;
    if (sp.hguard === 'wood' && sp.style === 'ak') { // AK: lower handguard + upper handguard over the gas tube
      g.add(ext([[hx, B - 1.25], [hx + hl, B - 1.05], [hx + hl, B + 0.3], [hx, B + 0.35]], 2.5, M.walnut, { bevel: 0.5 }));
      g.add(ext([[hx + 0.4, B + 0.75], [hx + hl * 0.7, B + 0.75], [hx + hl * 0.7 + 0.4, B + 1.55], [hx + 0.2, B + 1.6]], 1.6, M.walnut, { bevel: 0.4 }));
      for (let i = 0; i < 3; i++) g.add(box(0.15, 0.9, 2.55, M.dark, hx + 1.5 + i * 1.3, B - 0.5, 0)); // finger grooves
    }
    else if (sp.hguard === 'wood') g.add(ext([[hx, B - 1.25], [hx + hl, B - 1.0], [hx + hl, B + 0.85], [hx, B + 0.95]], 2.5, M.walnut, { bevel: 0.5 }));
    else if (sp.hguard === 'quad') { // quad rail: rails on top, bottom and both sides
      g.add(rbox(hl, 2.1, 2.1, M.alu, hx + hl / 2, B, 0, 0.3));
      picRail(M, g, hl, hx, B + 1.2, 0); picRail(M, g, hl - 1, hx + 0.5, B - 1.2, 0, Math.PI);
      picRail(M, g, hl - 1.5, hx + 0.7, B, 1.2, Math.PI / 2); picRail(M, g, hl - 1.5, hx + 0.7, B, -1.2, -Math.PI / 2);
    } else if (sp.hguard === 'mlok') { // slim octagonal free-float handguard with slots
      const hg = new THREE.CylinderGeometry(1.25, 1.25, hl, 8); hg.rotateZ(-Math.PI / 2); hg.rotateX(Math.PI / 8);
      g.add(mesh(hg, M.alu, hx + hl / 2, B, 0));
      for (let i = 0; i < Math.floor(hl / 1.6); i++) for (const sd of [-1, 1]) g.add(rbox(1.0, 0.45, 0.1, M.dark, hx + 0.9 + i * 1.6, B - 0.3, sd * 1.2, 0.1));
    } else if (sp.hguard === 'ribbed') { // classic round, ribbed handguard
      const pts = [[0, 1.0], [0.3, 1.3]];
      for (let x = 0.6; x < hl - 0.4; x += 0.6) pts.push([x, 1.32], [x + 0.3, 1.22]);
      pts.push([hl - 0.3, 1.3], [hl, 1.0], [hl, 0]);
      g.add(lathe(pts, M.poly, hx, B, 0, 18));
      g.add(ring(1.05, 0.22, M.alu, hx, B, 0)); // delta ring
    }
    else if (sp.hguard === 'round') g.add(tube(1.25, hl, furn, hx, B, 0, 1.15, 16));
    else if (sp.hguard === 'square') g.add(rbox(hl, 2.3, 2.5, sp.rail ? recMat : furn, hx + hl / 2, B, 0, 0.4));
    magX = sp.magX != null ? sp.magX : 5.5;
    leftHand = V(hl ? hx + Math.min(hl * 0.5, 6) : 4, B - 2.1, -0.3);
    // stock
    if (sp.stock === 'wood') g.add(buttstock(M, { len: 13, top: top - 0.2, h: 4.6, drop: 1.0, mat: M.walnut }));
    else if (sp.stock === 'fixed') g.add(buttstock(M, { len: 13, top: top - 0.2, h: 4.4, drop: 0.5, mat: furn }));
    else if (sp.stock === 'thumb') { g.add(buttstock(M, { len: 13, top: top + 0.4, h: 5.2, drop: 0.3, mat: furn })); g.add(rbox(4, 1.6, 2.7, M.dark, -8, top - 1.8, 0, 0.5)); }
    else if (sp.stock === 'a2') g.add(ext([[-3.6, top - 0.35], [-16.5, top - 0.7], [-16.5, -2.9], [-15.6, -2.95], [-6.5, 0.6], [-3.6, B - 0.6]], 2.3, M.stipple, { bevel: 0.5 }));
    else if (sp.stock === 'collapsible') {
      g.add(ext([[-14.4, B + 1.15], [-9.6, B + 1.0], [-9.4, B - 0.55], [-10.6, B - 0.8], [-13.2, -1.7], [-14.4, -2.2]], 2.3, M.stipple, { bevel: 0.45 }));
      g.add(box(0.6, B + 3.3, 2.4, M.poly, -14.5, (B + 1.15 - 2.2) / 2, 0)); // rubber butt pad
      g.add(rbox(3.2, 0.5, 1.2, M.poly, -11.5, B - 0.8, 0, 0.15)); // adjustment latch
      g.add(box(0.5, 1.2, 2.4, M.dark, -12.4, -1.2, 0)); // sling slot
    }
    else if (sp.stock === 'tube') { g.add(tube(0.75, 8, M.blued, -11, top - 0.9, 0)); g.add(ext([[-15, top + 0.1], [-9.5, top + 0.1], [-9.5, top - 1.7], [-12, -2.2], [-15, -2.3]], 2.3, furn, { bevel: 0.4 })); }
    else if (sp.stock === 'skeleton') { g.add(tube(0.35, 12, M.blued, -15, top - 0.5, 0)); g.add(tube(0.35, 11, M.blued, -14, -1.2, 0)); g.add(rbox(1, 4.8, 2.2, furn, -15, top - 2.6, 0, 0.3)); }
    else if (sp.stock === 'fold') { g.add(rbox(12, 1.6, 0.7, furn, -3 - 6, top - 1.5, -1.6, 0.3)); g.add(rbox(1, 4.2, 0.7, furn, -14.5, top - 3.1, -1.6, 0.2)); }
    else if (sp.stock === 'wire') { g.add(tube(0.25, 11, M.blued, -14, top - 0.4, 0.6)); g.add(tube(0.25, 11, M.blued, -14, top - 2.2, 0.6)); g.add(rbox(0.6, 3.6, 2, M.blued, -14.2, top - 1.4, 0.4, 0.2)); }
  } else { // bullpup: magazine behind the grip, the body is the stock
    const bodyTop = top + (sp.bulky ? 0.8 : 0);
    const prof = sp.bulky
      ? [[-12, -3.4], [-13, -0.5], [-12, bodyTop], [L - 4, bodyTop], [L - 2, B + 0.2], [L - 3, -1.6], [3.2, -2.2], [3.2, -4.4], [-1.5, -4.6], [-0.6, -1.0], [-9, -1.4]]
      : [[-15, -3.6], [-15, bodyTop - 0.3], [-14, bodyTop], [L - 4, bodyTop], [L - 3, bodyTop - 0.6], [L - 3, B - 1.3], [2.6, B - 1.4], [2.6, -0.4], [-1, -0.4], [-2.2, -1.1], [-8, -1.3], [-12, -3.6]];
    if (!sp.custom) {
      g.add(ext(prof, sp.bulky ? 3.4 : 2.8, furn, { bevel: 0.6 }));
      if (!sp.bulky) g.add(pistolGrip(M, 0.6, -0.3, M.poly, 5.2, 0.6));
      g.add(triggerGroup(M, 1.6, -0.45, recMat));
    }
    hx = L - 3; hl = 0;
    magX = -5.5;
    leftHand = V(L - 7, B - 2.0, -0.3);
    if (sp.vgrip) { g.add(ext([[-0.9, 0], [0.9, 0], [0.8, -4.4], [-0.8, -4.4]], 1.6, furn, { bevel: 0.5 })); g.children[g.children.length - 1].position.set(L - 7, B - 1.3, 0); leftHand = V(L - 7, B - 3.4, -0.3); }
  }
  if (sp.vgrip && !sp.bull) { const fg = ext([[-0.9, 0], [0.9, 0], [0.8, -4.2], [-0.8, -4.2]], 1.6, M.poly, { bevel: 0.5 }); fg.position.set(hx + Math.max(1.5, hl * 0.5), B - 1.2, 0); g.add(fg); leftHand = V(hx + Math.max(1.5, hl * 0.5), B - 3.2, -0.3); }
  // barrel + muzzle
  let muzzleX = hx + hl + sp.bar;
  if (sp.style) g.add(lathe([[0, 0.72], [hl * 0.55, 0.7], [hl * 0.55, 0.58], [hl + sp.bar * 0.4, 0.56], [hl + sp.bar * 0.4, 0.5], [hl + sp.bar, 0.48], [hl + sp.bar, 0]], M.blued, hx, B, 0, 18));
  else g.add(lathe([[0, sp.bulky ? 0.6 : 0.68], [hl + sp.bar, 0.58], [hl + sp.bar, 0]], M.blued, hx, B, 0, 16));
  if (sp.gas) { g.add(tube(0.55, Math.max(4, hl * 0.85), recMat, hx, B + 1.0, 0)); g.add(rbox(1.0, 1.4, 1.4, recMat, hx + Math.max(4, hl * 0.85), B + 0.5, 0, 0.2)); }
  if (sp.tube) { g.add(tube(0.6, sp.bar * 0.85 + hl, M.blued, hx, B - 1.4, 0)); if (sp.twin) g.add(tube(0.6, sp.bar * 0.85, M.blued, hx, B - 1.4, 1.3)); }
  if (sp.muzzle === 'bird') { // birdcage flash hider with slots
    g.add(lathe([[0, 0.6], [0.4, 0.7], [2.0, 0.7], [2.2, 0.5], [2.2, 0.35]], M.dark, muzzleX, B, 0, 14));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.6; if (a > Math.PI * 1.25 && a < Math.PI * 1.75) continue; g.add(box(1.3, 0.16, 0.16, M.alu, muzzleX + 1.2, B + Math.sin(a) * 0.7, Math.cos(a) * 0.7)); }
    muzzleX += 2.2;
  }
  else if (sp.muzzle === 'brake') { g.add(rbox(3.4, 1.5, 2.2, M.blued, muzzleX + 1.7, B, 0, 0.35)); for (const x of [1.1, 2.5]) g.add(box(0.9, 1.0, 2.26, M.dark, muzzleX + x, B, 0)); g.add(lathe([[0, 0.55], [0.3, 0.55], [0.3, 0.3]], M.dark, muzzleX + 3.4, B, 0, 12)); muzzleX += 3.7; }
  else if (sp.muzzle === 'slant') { g.add(lathe([[0, 0.6], [1.4, 0.6], [1.6, 0.3]], M.blued, muzzleX, B, 0, 12)); muzzleX += 1.6; }
  else if (sp.muzzle === 'big') { g.add(lathe([[0, 0.7], [0.4, 1.0], [2.4, 1.0], [2.4, 0.4]], M.blued, muzzleX, B, 0, 14)); muzzleX += 2.4; }
  if (sp.fsb && sp.style === 'ar') { // triangular front sight base with bayonet lug
    const fx = hx + hl + 0.3;
    g.add(ext([[-0.7, B - 0.8], [0.7, B - 0.8], [0.35, B + 2.0], [-0.35, B + 2.0]], 1.2, M.blued, { bevel: 0.15 }));
    g.children[g.children.length - 1].position.x = fx;
    if (!sp.handle) { for (const sd of [-1, 1]) g.add(box(0.45, 1.0, 0.14, M.blued, fx, B + 2.3, sd * 0.42)); g.add(box(0.16, 0.9, 0.16, M.dark, fx, B + 1.8, 0)); }
    g.add(box(1.2, 0.5, 0.6, M.blued, fx, B - 1.1, 0));
  }
  if (sp.style === 'ak') { // AK gas block and hooded front sight
    const fx = hx + hl;
    g.add(rbox(1.4, 1.0, 1.4, M.blued, fx + 0.2, B + 0.9, 0, 0.25));
    g.add(rbox(1.0, 0.8, 1.4, M.blued, fx + sp.bar - 0.8, B + 0.3, 0, 0.2));
    for (const sd of [-1, 1]) g.add(box(0.5, 2.0, 0.15, M.blued, fx + sp.bar - 0.8, B + 1.6, sd * 0.45)); // sight ears
    g.add(box(0.15, 1.6, 0.15, M.dark, fx + sp.bar - 0.8, B + 1.35, 0)); // front post, tip at B + 2.15
  }
  if (sp.bipod) for (const sd of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(hx + hl + sp.bar * 0.5, B - 0.6, sd * 0.8); leg.add(tube(0.25, 7, M.blued, 0, 0, 0)); leg.rotation.set(sd * 0.12, 0, -1.2); g.add(leg); } // folded down
  // top rail / carry handle / sights
  let sightH, scopeBase = top + 0.25;
  const optic = has('reddot') || has('holo') || has('acog') || has('scope');
  if (sp.rail) {
    const railLen = (sp.bull ? L - 2 : L + hl - 2);
    g.add(box(railLen, 0.45, 1.2, M.blued, (sp.bull ? -6 : -2) + railLen / 2, top + 0.22, 0));
    for (let x = 0; x < railLen; x += 0.9) g.add(box(0.35, 0.2, 1.25, M.dark, (sp.bull ? -6 : -2) + x, top + 0.48, 0));
    scopeBase = top + 0.45; sightH = sp.fsb ? B + 2.25 : top + 1.5;
    if (!optic) { // flip-up irons (rear aperture + front post); they fold away under an optic
      g.add(box(0.8, sightH - top - 0.8, 1.1, M.dark, -1.5, (top + 0.45 + sightH - 0.35) / 2, 0));
      g.add(ring(0.36, 0.12, M.dark, -1.5, sightH, 0));
      if (!sp.fsb) { const fx = sp.bull ? L - 4 : hx + hl - 1; g.add(box(0.6, 0.7, 1.0, M.dark, fx, top + 0.8, 0)); for (const sd of [-1, 1]) g.add(box(0.5, 1.0, 0.15, M.dark, fx, sightH - 0.3, sd * 0.42)); g.add(box(0.16, 0.9, 0.16, M.dark, fx, sightH - 0.45, 0)); }
    }
    else { g.add(box(0.8, 0.35, 1.0, M.dark, -1.5, top + 0.6, 0)); g.add(box(0.6, 0.35, 0.5, M.dark, (sp.bull ? L - 4 : hx + hl - 1), top + 0.6, 0)); }
  } else if (sp.handle) {
    const hlen = sp.handle === 'long' ? L + 2 : 9, h0 = sp.handle === 'long' ? -11 : -2.5;
    g.add(ext([[h0, top], [h0 + 0.8, top + 2.2], [h0 + hlen - 0.8, top + 2.2], [h0 + hlen, top], [h0 + hlen - 1.2, top], [h0 + hlen - 1.4, top + 1.3], [h0 + 1.4, top + 1.3], [h0 + 1.2, top]], 1.3, recMat, { bevel: 0.2 }));
    sightH = top + 2.45; scopeBase = top + 2.3;
    if (sp.fsb) { // tall A1 front sight post on the triangular base
      const fx = hx + hl + 0.3;
      g.add(ext([[-0.35, B + 2.0], [0.35, B + 2.0], [0.25, sightH - 0.6], [-0.25, sightH - 0.6]], 1.0, M.blued, { bevel: 0.1 })); g.children[g.children.length - 1].position.x = fx;
      for (const sd of [-1, 1]) g.add(box(0.45, 0.9, 0.14, M.blued, fx, sightH - 0.35, sd * 0.42));
      g.add(box(0.16, 0.8, 0.16, M.dark, fx, sightH - 0.4, 0));
      g.add(ring(0.32, 0.12, M.dark, h0 + 1.2, sightH, 0)); g.add(box(0.8, 0.3, 1.0, recMat, h0 + 1.2, top + 2.25, 0)); // rear aperture
    } else if (sp.irons !== false) g.add(box(0.25, top + 2.45 - B - 0.4, 0.3, M.dark, muzzleX - 2, (top + 2.45 + B + 0.4) / 2, 0));
  } else if (sp.style === 'ak') {
    sightH = B + 2.15; // front post tip and the rear leaf notch line up above the upper handguard
    g.add(rearNotch(M, L - 2.4, top - 0.1, sightH, 1.3));
  } else if (sp.irons === false) {
    sightH = top + 0.8;
  } else {
    sightH = top + 0.8;
    g.add(rearNotch(M, 0.5, top - 0.2, sightH, 1.2));
    g.add(frontPost(M, muzzleX - 1.2, B + 0.4, sightH, sp.furn === 'wood'));
  }
  // per-gun detail
  const dOut = {};
  if (DETAIL[id]) {
    DETAIL[id]({ M, g, sp, B, top, L, hx, hl, recMat, furn, charger, has, optic, mx: hx + hl + sp.bar, out: dOut,
      grip: (mat) => { g.add(pistolGrip(M, 0.6, -0.3, mat || M.stipple, 5.2, 0.8)); g.add(triggerGroup(M, 1.7, -0.45, recMat)); } });
    if (dOut.sightH != null) sightH = dOut.sightH;
    if (dOut.scopeBase != null) scopeBase = dOut.scopeBase;
    if (dOut.leftHand) leftHand = dOut.leftHand;
  }
  // magazine
  let mag = null;
  const magW = sp.magW || 2.6;
  if (sp.mag === 'curved' || sp.mag === 'straight') {
    const mL = (sp.magL || 8) * (has('extmag') ? 1.4 : 1);
    mag = magazine(M, mL, magW, 1.7, sp.mag === 'curved' ? sp.curve : sp.curve || 0, sp.furn === 'tan' ? M.stippleTan : sp.style === 'ak' ? M.blued2 : sp.style === 'ar' ? M.alu : M.paint);
    if (sp.style) { mag.add(box(magW * 0.55, 0.3, 0.9, M.brass, 0.1, 0.25, 0)); mag.add(box(0.35, 0.25, 0.6, M.copper, magW * 0.3, 0.27, 0)); } // top round
    if (has('dualmag')) { const m2 = magazine(M, mL, magW, 1.7, sp.curve || 0, M.paint); m2.position.z = 1.9; mag.add(m2); mag.add(rbox(magW + 0.4, 1.3, 3.8, M.canvas, 0.3, -mL * 0.4, 0.95, 0.2)); }
    mag.position.set(magX, -0.3, 0);
  } else if (sp.mag === 'grip') { mag = new THREE.Group(); mag.add(rbox(2.2, 0.8 + (has('extmag') ? 2.5 : 0), 1.6, M.paint, -0.9, -6.0 - (has('extmag') ? 1.2 : 0), 0, 0.15)); }
  else if (sp.mag === 'belt') {
    mag = new THREE.Group();
    mag.add(rbox(5, has('extmag') ? 6.5 : 5, 3.8, M.polyOd, 0, -2.5, 0, 0.4));
    for (let i = 0; i < 6; i++) { const rr = new THREE.Group(); rr.position.set(-1.5 + i * 0.6, 1.0 + Math.min(i, 3) * 0.3, 2.0 - Math.min(i, 3) * 0.4); rr.add(tube(0.3, 2.0, M.brass, -1, 0, 0)); rr.rotation.y = Math.PI / 2; mag.add(rr); }
    mag.position.set(4, -0.6, -4);
  } else if (sp.mag === 'drum') { mag = new THREE.Group(); const d = drum(M, 4.6, 3.2); d.position.set(0, -4.6, 0); mag.add(d); mag.position.set(sp.bull ? magX : 5, -0.3, 0); }
  else if (sp.mag === 'top') { mag = new THREE.Group(); for (let i = 0; i < 18; i++) for (const z of [-0.45, 0.45]) mag.add(box(0.5, 0.28, 0.75, M.brass, -5.2 + i * 0.6 + (z > 0 ? 0.3 : 0), 0, z)); mag.add(rbox(12, 1.2, 2.4, M.smoke, 0, 0, 0, 0.3)); mag.position.set(L / 2 - 6, top + 1.2, 0); sightH = top + 2.6; scopeBase = top + 1.9; }
  if (mag) g.add(mag);
  // moving parts
  const parts = { charger, mag };
  let action = 'auto';
  if (sp.bolt) {
    const bolt = new THREE.Group(); bolt.position.set(0, B + 0.2, 0);
    bolt.add(tube(0.6, 5, M.bright, -3, 0, 0));
    bolt.add(rod(V(-1.5, 0, 0.6), V(-1.8, -0.8, 2.8), 0.28, M.bright));
    bolt.add(sphere(0.65, M.bright, -1.8, -0.85, 3.0));
    g.add(bolt); parts.bolt = bolt; action = 'bolt';
  } else if (sp.pump) {
    const pump = new THREE.Group();
    if (sp.lever) { pump.add(ext([[-0.8, 0], [1.4, 0], [1.0, -3.6], [-2.6, -3.6], [-2.8, -2.4], [-0.6, -2.2]], 0.5, M.blued, { bevel: 0.1 })); pump.position.set(8.5, -0.3, 0); }
    else { pump.add(lathe([[0, 1.05], [0.4, 1.2], [5.6, 1.2], [6, 1.05], [6, 0]], sp.furn === 'wood' ? M.walnut : M.poly, 0, 0, 0, 18)); pump.position.set(8.5, B - 1.35, 0); }
    if (dOut.onPump) dOut.onPump(pump);
    g.add(pump); parts.pump = pump; action = 'pump';
    if (!sp.lever) leftHand = V(11.5, B - 2.7, -0.3);
  } else if (!sp.style && !sp.custom) charger.add(rbox(0.9, 0.7, 1.3, M.bright, Math.min(L - 5, 5), top - 0.3, 1.5, 0.2));
  g.add(charger);
  const out = finish(g, { muzzle: V(muzzleX, B, 0), sightH, B, leftHand, rightHand, ejectPort: V(sp.bull ? -4 : 3, B + 0.8, 1.2), action, parts, scopeX: sp.bull ? -4 : 0, scopeBase, magPos: mag ? mag.position.clone() : undefined, shell: !!sp.shell, beltFed: sp.mag === 'belt', railed: !!sp.rail || !!sp.handle });
  return out;
}

function buildShotgun(M, id, has) {
  const B = 1.7, g = new THREE.Group();
  if (id === 'trenchgun') {
    g.add(ext([[-3, -0.6], [7, -0.6], [7, B + 0.9], [5, B + 1.4], [-3, B + 1.2]], 2.8, M.park, { bevel: 0.4 }));
    g.add(buttstock(M, { len: 14, top: B + 1.1, h: 5.2, drop: 1.4, mat: M.walnut }));
    g.add(ext([[-3, -0.6], [-1, -0.6], [-2.6, -3.6], [-4.2, -3.9], [-5, -2.0]], 2.5, M.walnut, { bevel: 0.6 })); // wrist
    g.add(triggerGroup(M, -0.8, -0.6, M.park, true));
    g.add(lathe([[0, 0.85], [24, 0.8], [24, 0]], M.park, 7, B, 0, 20));
    g.add(tube(0.6, 17, M.park, 7, B - 1.4, 0));
    const shield = new THREE.CylinderGeometry(1.3, 1.3, 13, 20, 1, true, -Math.PI * 0.65, Math.PI * 1.3); shield.rotateZ(-Math.PI / 2);
    g.add(mesh(shield, M.perfR, 8 + 6.5, B + 0.1, 0));
    const pump = new THREE.Group();
    const p = lathe([[0, 1.1], [0.4, 1.25], [5.6, 1.25], [6, 1.1], [6, 0]], M.walnut, 0, 0, 0, 20);
    pump.add(p); for (let i = 0; i < 6; i++) pump.add(ring(1.27, 0.08, M.walnut, 0.8 + i * 0.85, 0, 0));
    pump.position.set(8.5, B - 1.3, 0);
    g.add(pump);
    g.add(sphere(0.25, M.bright, 30.6, B + 0.9, 0)); // bead sight
    const leftHand = V(11.5, B - 2.6, -0.3);
    return finish(g, { muzzle: V(31, B, 0), sightH: B + 1.15, B, rightHand: V(-3, -1.8, 0), leftHand, ejectPort: V(2.5, B + 0.5, 1.2), action: 'pump', parts: { pump }, shell: true, scopeX: 0, scopeBase: B + 1.4 });
  }
  // double barrel
  g.add(buttstock(M, { len: 14, top: B + 0.9, h: 5.2, drop: 1.6, mat: M.walnut }));
  g.add(ext([[-3, B + 0.9], [-1, B + 1.0], [-1.5, -0.6], [-3.4, -3.6], [-5, -3.6], [-6, -1]], 2.6, M.walnut, { bevel: 0.6 }));
  g.add(ext([[-1, -0.6], [3.5, -0.6], [3.5, B + 1.3], [-1, B + 1.3]], 2.9, M.caseHard, { bevel: 0.35 })); // case-hardened action
  g.add(triggerGroup(M, 0.2, -0.6, M.blued, true));
  const barrels = new THREE.Group(); barrels.position.set(3.4, -0.2, 0);
  for (const z of [-0.8, 0.8]) barrels.add(lathe([[0, 0.85], [22, 0.78], [22, 0]], M.blued, 0, B + 0.2, z, 20));
  barrels.add(box(22, 0.5, 0.6, M.blued, 11, B + 1.0, 0)); // rib
  barrels.add(ext([[0.5, B - 0.9], [9, B - 0.9], [9.6, B - 2.0], [1, B - 2.3]], 2.6, M.walnut, { bevel: 0.6 })); // forend
  barrels.add(sphere(0.2, M.bright, 21.6, B + 1.35, 0));
  g.add(barrels);
  return finish(g, { muzzle: V(25.4, B, 0), sightH: B + 1.45, B, rightHand: V(-3, -1.6, 0), leftHand: V(9, B - 2.8, -0.2), ejectPort: V(3.5, B, 0), action: 'break', parts: { barrels }, shell: true, scopeX: 0, scopeBase: B + 1.4 });
}

function buildPistol(M, id, has) {
  const g = new THREE.Group();
  const B = 1.6;
  const slide = new THREE.Group();
  let muzzleX;
  if (id === 'revolver') {
    g.add(ext([[-2.2, 0.2], [2.4, 0.2], [2.4, 2.6], [-1.6, 2.6], [-2.6, 1.6]], 1.6, M.blued, { bevel: 0.3 }));
    const cyl = new THREE.Group(); cyl.position.set(0.2, 1.5, 0);
    const c = lathe([[0, 0.3], [0.15, 1.35], [0.4, 1.45], [3.1, 1.45], [3.35, 1.35], [3.5, 0.3]], M.blued, -1.6, 0, 0, 24);
    cyl.add(c);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; cyl.add(box(2.2, 0.35, 0.35, M.dark, 0.15, Math.cos(a) * 1.42, Math.sin(a) * 1.42)); } // flutes
    g.add(cyl);
    g.add(lathe([[0, 0.55], [6.2, 0.5], [6.2, 0]], M.blued, 2.2, B + 0.6, 0, 16));
    g.add(rbox(5.5, 0.6, 0.9, M.blued, 4.8, B - 0.1, 0, 0.2)); // ejector shroud
    g.add(box(0.25, 0.6, 0.25, M.blued, 8.0, B + 1.3, 0));
    muzzleX = 8.4;
    const hammer = rbox(0.8, 1.2, 0.5, M.blued, -2.4, 2.8, 0, 0.15); hammer.rotation.z = 0.5; g.add(hammer);
    g.add(ext([[-2.4, 1.3], [-0.8, 0.4], [-1.5, -3.9], [-3.3, -4.3], [-3.7, -3.4], [-3.2, 0.2]], 1.7, M.gripWood, { bevel: 0.5 }));
    g.add(triggerGroup(M, 0.4, 0.2, M.blued));
    return finish(g, { muzzle: V(muzzleX, B + 0.6, 0), sightH: B + 1.6, B: B + 0.6, rightHand: V(-1.9, -1.8, 0), leftHand: V(-1.9, -3.0, -1.7), ejectPort: V(-1, 1.5, -1.5), action: 'revolver', parts: { cyl }, pistol: true });
  }
  const spec = {
    colt: { len: 8.6, h: 1.55, grip: M.gripWood, frame: M.park, slideMat: M.park, guard: 'round', hammer: 'spur', front: 'square', gripSafety: true, thumbSafety: true, beaver: true },
    p38: { len: 8.2, h: 1.4, grip: M.gripBlack, frame: M.blued, slideMat: M.blued, open: true, guard: 'round', hammer: 'spur', front: 'square', slideSafety: true },
    tt33: { len: 7.8, h: 1.5, grip: M.gripBlack, frame: M.blued, slideMat: M.blued, guard: 'round', hammer: 'spur', front: 'square', bigSerr: true },
    nambu: { len: 9, h: 1.2, grip: M.gripWood, frame: M.blued, slideMat: M.blued, nambu: true },
    deagle: { len: 10.4, h: 2.0, w: 1.8, grip: M.gripBlack, frame: M.bright, slideMat: M.bright, guard: 'hook', hammer: 'spur', front: 'square', topRail: true, slideSafety: true },
    makarov: { len: 6.6, h: 1.4, grip: M.bakelite, frame: M.blued, slideMat: M.blued, guard: 'round', hammer: 'spur', front: 'round', round: true, slideSafety: true },
    cz75: { len: 8.0, h: 1.3, grip: M.gripWood, frame: M.blued, slideMat: M.blued, guard: 'hook', hammer: 'spur', front: 'taper', inFrame: true, thumbSafety: true, beaver: true },
    glock18: { len: 7.6, h: 1.6, grip: M.stipple, frame: M.poly, slideMat: M.blued2, guard: 'square', hammer: 'none', front: 'taper', rail: true, fingers: true, selector: true, trigSafety: true },
    usp45: { len: 8.2, h: 1.6, grip: M.stipple, frame: M.poly, slideMat: M.blued2, guard: 'square', hammer: 'ring', front: 'taper', rail: true, round: true, thumbSafety: true, beaver: true },
    m9: { len: 8.6, h: 1.4, grip: M.gripBlack, frame: M.blued, slideMat: M.blued, open: true, guard: 'round', hammer: 'spur', front: 'square', slideSafety: true },
    fiveseven: { len: 8.2, h: 1.5, grip: M.stipple, frame: M.poly, slideMat: M.blued2, guard: 'hook', hammer: 'none', front: 'taper', rail: true, trigSafety: false },
    b93r: { len: 9.4, h: 1.4, grip: M.gripBlack, frame: M.blued, slideMat: M.blued, open: true, guard: 'round', hammer: 'spur', front: 'square', slideSafety: true, comp: true, foregrip: true, longMag: true },
  }[id];
  let sightTop;
  if (spec.nambu) {
    g.add(tube(0.85, 6, M.blued, -2.2, B + 0.3, 0)); // receiver
    g.add(lathe([[0, 0.75], [5.5, 0.5], [5.5, 0]], M.blued, 3.6, B + 0.3, 0, 16));
    slide.add(lathe([[0, 0.55], [0.6, 0.7], [1.2, 0.55], [1.2, 0]], M.bright, -2.9, B + 0.3, 0, 12)); // bolt knob
    g.add(ext([[-2.2, B - 0.5], [3, B - 0.5], [2.4, -0.4], [-1.2, -0.4]], 1.5, M.blued, { bevel: 0.25 }));
    g.add(ext([[-2.3, 0.2], [-0.2, 0.2], [-1.5, -5.0], [-3.8, -5.1], [-3.6, -3.5]], 1.9, spec.grip, { bevel: 0.5 }));
    g.add(triggerGroup(M, 0.3, -0.05, spec.frame));
    muzzleX = 9.1;
  } else {
    const W = spec.w || 1.5, fx = spec.len - 2.7, yb = B - 0.6, yt = B + spec.h - 0.6;
    // ---- slide: bevelled nose, rear face, serrations, ejection port, sights with white dots
    const nose = spec.front === 'taper' ? [[fx - 0.2, yb], [fx, yb + 0.25], [fx, yt - 0.4], [fx - 0.45, yt]]
      : spec.front === 'round' ? [[fx - 0.15, yb], [fx, yb + 0.2], [fx, yt - 0.45], [fx - 0.25, yt - 0.12], [fx - 0.65, yt]]
      : [[fx, yb], [fx, yt - 0.1], [fx - 0.1, yt]];
    const sp = spec.open
      ? [[-2.6, yb], ...nose.slice(0, -1), [fx - 0.1, yt], [3.5, yt], [3.5, B + 0.2], [0.8, B + 0.2], [0.8, yt], [-2.4, yt], [-2.6, yt - 0.25]]
      : [[-2.6, yb], ...nose, [-2.35, yt], [-2.6, yt - 0.25]];
    slide.add(ext(sp, W, spec.slideMat, { bevel: spec.round ? 0.3 : 0.16 }));
    if (spec.open) slide.add(tube(0.5, 3.5, M.blued, 0.5, B + 0.25, 0));
    const serrN = spec.bigSerr ? 6 : 9, serrW = spec.bigSerr ? 0.2 : 0.1;
    for (let i = 0; i < serrN; i++) slide.add(box(serrW, spec.h * 0.72, W + 0.03, M.dark, -2.25 + i * (spec.bigSerr ? 0.36 : 0.24), (yb + yt) / 2 + 0.05, 0)); // rear cocking serrations
    slide.add(box(spec.open ? 1.2 : 1.9, spec.h * 0.5, 0.05, M.dark, spec.open ? 2.8 : 0.9, yt - spec.h * 0.3, W / 2 + 0.01)); // ejection port (right)
    if (!spec.open) slide.add(box(1.8, spec.h * 0.4, 0.05, M.bright, 0.9, yt - spec.h * 0.3, W / 2 - 0.02)); // barrel hood seen through the port
    slide.add(box(1.4, 0.12, 0.05, M.blued2, -1.0, yt - spec.h * 0.35, W / 2 + 0.02)); // extractor
    slide.add(box(2.6, 0.06, 0.04, M.dark, fx - 2.6, yb + spec.h * 0.45, -W / 2 - 0.02)); // roll mark
    slide.add(box(1.6, 0.06, 0.04, M.dark, fx - 3.1, yb + spec.h * 0.3, -W / 2 - 0.02));
    if (spec.topRail) { slide.add(box(spec.len - 4, 0.25, 0.7, M.bright, fx - (spec.len - 4) / 2 - 0.3, yt + 0.12, 0)); for (let x = 1.0; x < fx - 0.6; x += 0.45) slide.add(box(0.18, 0.1, 0.72, M.dark, x, yt + 0.25, 0)); }
    sightTop = yt + (spec.topRail ? 0.25 : 0) + 0.32;
    const st = yt + (spec.topRail ? 0.25 : 0);
    slide.add(box(0.28, sightTop - st, 0.22, M.blued, fx - 0.45, (st + sightTop) / 2, 0)); // front blade
    slide.add(box(0.7, 0.12, 0.7, M.blued, -2.0, st + 0.06, 0)); // rear sight base
    for (const z of [-0.36, 0.36]) slide.add(box(0.6, sightTop - st + 0.05, 0.3, M.blued, -2.0, (st + sightTop + 0.05) / 2, z)); // notch posts
    const dot = (x, y, z, r) => { const d = new THREE.Mesh(new THREE.CircleGeometry(r, 10), M.dot); d.rotation.y = -Math.PI / 2; d.position.set(x, y, z); slide.add(d); };
    dot(-2.31, sightTop - 0.12, -0.36, 0.07); dot(-2.31, sightTop - 0.12, 0.36, 0.07); dot(fx - 0.6, sightTop - 0.1, 0, 0.07); // three-dot sights
    if (spec.slideSafety) { slide.add(rbox(0.9, 0.45, 0.2, M.blued, -1.6, yt - 0.35, -W / 2 - 0.1, 0.1)); slide.add(rbox(0.9, 0.45, 0.2, M.blued, -1.6, yt - 0.35, W / 2 + 0.1, 0.1)); }
    if (spec.selector) slide.add(rbox(0.5, 0.35, 0.15, M.dark, -2.2, yb + 0.25, -W / 2 - 0.08, 0.08));
    if (spec.hammer === 'none') slide.add(box(0.05, spec.h * 0.4, 0.6, M.bright, -2.62, (yb + yt) / 2, 0)); // striker cover plate
    slide.add(tube(0.42, 0.12, M.dark, fx - 0.05, B + 0.1, 0)); // bore
    if (spec.comp) { slide.add(rbox(1.3, spec.h - 0.1, W, spec.slideMat, fx + 0.6, (yb + yt) / 2, 0, 0.2)); for (let i = 0; i < 3; i++) slide.add(box(0.18, 0.1, 0.5, M.dark, fx + 0.25 + i * 0.3, yt - 0.02, 0)); }
    muzzleX = spec.len - 2.3 + (spec.comp ? 1.3 : 0);
    // ---- frame: dust cover (with an accessory rail), slide rails, trigger guard
    const fw = W - 0.1;
    g.add(ext([[-2.8, yb], [fx - 0.35, yb], [fx - 0.35, spec.rail ? 0.15 : 0.35], [2.7, 0.0], [-0.4, 0.0], [-2.6, -0.2], [-2.8, 0.4]], fw, spec.frame, { bevel: 0.15 }));
    if (spec.rail) for (let x = 3.2; x < fx - 0.6; x += 0.5) g.add(box(0.2, 0.12, fw + 0.03, M.dark, x, 0.25, 0));
    if (spec.inFrame) g.add(box(4.6, 0.35, W + 0.05, spec.frame, -0.4, yb + 0.12, 0)); // CZ: slide rides inside the frame
    const outer = spec.guard === 'round'
      ? [[-0.4, 0.1], [2.8, 0.1], [2.9, -0.4], [2.5, -1.3], [1.4, -1.7], [0.0, -1.6], [-0.5, -1.0]]
      : [[-0.4, 0.1], [2.9, 0.1], [2.9, -1.6], [0.0, -1.6], [-0.5, -1.0]];
    const inner = spec.guard === 'round'
      ? [[0.0, -0.1], [2.4, -0.1], [2.3, -0.5], [1.9, -1.2], [1.3, -1.35], [0.3, -1.25], [-0.05, -0.9]]
      : [[0.0, -0.1], [2.5, -0.1], [2.5, -1.25], [0.25, -1.25], [-0.05, -0.85]];
    g.add(holed(outer, [inner], 0.95, spec.frame, 0.1));
    if (spec.guard === 'hook') g.add(ext([[2.5, -1.6], [3.0, -1.6], [3.0, -1.2], [2.8, -1.35]], 0.95, spec.frame, { bevel: 0.08 }));
    // trigger
    g.add(at(ext([[0, 0], [0.35, 0], [0.22, -0.8], [-0.05, -1.15], [-0.08, -0.75]], 0.32, spec.frame === M.poly ? M.poly : M.blued, { bevel: 0.07 }), 0.85, -0.05, 0));
    if (spec.trigSafety) g.add(box(0.12, 0.6, 0.12, M.dark, 1.0, -0.6, 0));
    // ---- grip frame + panels, beavertail, front strap
    const gp = [[-0.4, 0.2], [-1.25, -4.55], [-1.45, -4.8], [-3.55, -4.95], [-3.85, -4.45], [-3.3, -0.5], [-3.45, 0.3]];
    if (spec.beaver) gp.push([-3.95, 0.7], [-3.6, 0.95]); else gp.push([-3.2, 0.9]);
    gp.push([-2.6, yb], [-2.4, 0.2]);
    g.add(ext(gp, fw - 0.1, spec.frame, { bevel: 0.15 }));
    g.add(ext([[-0.85, -0.35], [-1.5, -4.2], [-3.4, -4.4], [-3.55, -4.1], [-3.05, -0.6], [-2.6, -0.3]], fw + 0.12, spec.grip, { bevel: 0.12 }));
    if (spec.grip !== M.stipple) for (const z of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10).rotateX(Math.PI / 2), M.bright, -2.2, -1.0, z * (fw / 2 + 0.08))); // grip screws
    if (spec.fingers) for (let i = 0; i < 3; i++) g.add(sphere(0.28, spec.frame, -1.05 - i * 0.24, -1.6 - i * 1.0, 0));
    if (spec.gripSafety) g.add(rbox(0.45, 2.4, 0.9, spec.frame, -3.55, -1.4, 0, 0.15));
    // ---- controls on the left side
    g.add(rbox(1.7, 0.28, 0.12, M.blued, 0.3, yb - 0.12, -fw / 2 - 0.06, 0.08)); // slide stop
    g.add(rbox(0.45, 0.45, 0.12, M.blued, 1.0, yb - 0.32, -fw / 2 - 0.06, 0.08));
    g.add(rbox(0.45, 0.45, 0.14, M.dark, -0.55, -0.35, -fw / 2 - 0.08, 0.1)); // mag release
    if (spec.thumbSafety) g.add(rbox(1.0, 0.35, 0.14, M.blued, -2.4, yb - 0.15, -fw / 2 - 0.07, 0.08));
    // ---- hammer
    if (spec.hammer === 'spur') { const h = ext([[0, 0], [0.5, 0], [0.3, 0.9], [-0.4, 1.15], [-0.5, 0.85], [-0.1, 0.65]], 0.45, M.blued, { bevel: 0.08 }); h.position.set(-2.75, yb + 0.15, 0); g.add(h); }
    else if (spec.hammer === 'ring') { g.add(rbox(0.5, 0.7, 0.45, M.blued, -2.75, yb + 0.5, 0, 0.1)); const r = new THREE.TorusGeometry(0.3, 0.1, 6, 14); g.add(mesh(r, M.blued, -2.95, yb + 0.95, 0)); }
    if (spec.foregrip) g.add(ext([[3.0, 0.1], [3.7, 0.1], [3.9, -2.4], [3.2, -2.5]], 0.8, M.blued, { bevel: 0.12 })); // 93R folding foregrip
  }
  g.add(slide);
  const mag = new THREE.Group();
  mag.add(rbox(2.2, 0.38, 1.3, spec.frame === M.poly ? M.poly : M.blued, -2.5, -5.08, 0, 0.12));
  if (spec.longMag) mag.add(rbox(1.9, 1.6, 1.15, M.blued, -2.65, -5.9, 0, 0.12));
  if (has('extmag')) mag.add(rbox(1.6, 2.0, 1.1, M.blued, -2.75, spec.longMag ? -7.3 : -6.1, 0, 0.15));
  g.add(mag);
  const sightH = spec.nambu ? B + 1.25 : sightTop;
  return finish(g, { muzzle: V(muzzleX, B + (spec.nambu ? 0.3 : 0.1), 0), sightH, B: B + 0.1, rightHand: V(-1.8, -2.1, 0), leftHand: spec.foregrip ? V(3.5, -1.6, -0.3) : V(-1.9, -3.2, -1.6), ejectPort: V(0.5, B + 0.6, 0.8), action: 'pistol', parts: { slide, mag }, pistol: true, magPos: V(0, 0, 0) });
}

// ================================================================ attachments
function addAttachments(M, gun, atts, id) {
  const g = gun.group, has = (a) => atts.includes(a);
  const B = gun.B, mz = gun.muzzle;
  const pistol = !!gun.pistol;
  if (has('scope')) {
    const sy = gun.scopeBase + 2.0, sx = gun.scopeX;
    const sc = new THREE.Group();
    sc.add(lathe([[-3.2, 0], [-3.2, 1.45], [-2.6, 1.5], [-1.2, 0.95], [9, 0.95], [10.6, 1.65], [12, 1.7], [12, 0]], M.blued, sx, sy, 0, 28));
    const tz = new THREE.CylinderGeometry(0.55, 0.55, 1.2, 14); g.add(mesh(tz, M.blued, sx + 3.9, sy + 1.3, 0));
    const tz2 = new THREE.CylinderGeometry(0.55, 0.55, 1.2, 14); tz2.rotateX(Math.PI / 2); g.add(mesh(tz2, M.blued, sx + 3.9, sy, 1.3));
    for (const x of [sx - 0.5, sx + 7]) { sc.add(rbox(1.5, sy - gun.scopeBase, 1.4, M.blued, x, (sy + gun.scopeBase) / 2, 0, 0.25)); sc.add(ring(1.05, 0.2, M.blued, x, sy, 0)); }
    const lens = new THREE.Mesh(new THREE.CircleGeometry(1.55, 24), M.glass); lens.rotation.y = Math.PI / 2; lens.position.set(sx + 11.95, sy, 0); sc.add(lens);
    const lens2 = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24), M.glass); lens2.rotation.y = -Math.PI / 2; lens2.position.set(sx - 3.15, sy, 0); sc.add(lens2);
    g.add(sc);
    gun.sightH = sy; gun.scope = true;
  } else if (has('reddot') || has('holo') || has('acog')) {
    const sx = (gun.scopeX || 0) + 1, base = gun.scopeBase;
    const o = new THREE.Group();
    if (has('reddot')) {
      // short open tube: you look straight through it at the dot
      o.add(rbox(2.2, 0.6, 1.3, M.blued, sx, base + 0.3, 0, 0.2));
      o.add(box(0.8, 0.5, 0.6, M.blued, sx, base + 0.75, 0));
      o.add(lathe([[-1.2, 0.85], [1.2, 0.85], [1.2, 0.7], [-1.2, 0.7]], M.blued, sx, base + 1.6, 0, 20));
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), M.clearGlass); glass.rotation.y = Math.PI / 2; glass.position.set(sx + 1.1, base + 1.6, 0); o.add(glass);
      gun.sightH = base + 1.6;
    } else if (has('holo')) {
      // holographic sight: a base with an open hood (side walls along the barrel, a top bar) and a clear window
      const hw = 2.3, hh = 1.9, len = 3.8, y0 = base + 0.9;
      o.add(rbox(len, 0.9, hw, M.paint, sx, base + 0.45, 0, 0.25));            // body / battery housing
      for (const z of [-1, 1]) o.add(box(len, hh, 0.22, M.paint, sx, y0 + hh / 2, z * (hw / 2 - 0.11))); // side walls
      o.add(box(len, 0.28, hw, M.paint, sx, y0 + hh + 0.14, 0));                // top bar
      o.add(box(0.5, 0.5, hw * 0.6, M.dark, sx - len / 2 + 0.3, base + 0.6, 0)); // rear buttons
      const win = new THREE.Mesh(new THREE.PlaneGeometry(hw - 0.44, hh), M.clearGlass); win.rotation.y = Math.PI / 2; win.position.set(sx + len / 2 - 0.3, y0 + hh / 2, 0); o.add(win);
      gun.sightH = y0 + hh / 2;
    } else {
      o.add(rbox(3, 0.7, 1.4, M.blued, sx, base + 0.35, 0, 0.2));
      o.add(lathe([[-2.6, 0.9], [-1.4, 0.95], [1.6, 0.95], [2.8, 1.2], [3.2, 1.2], [3.2, 0]], M.paint, sx, base + 1.55, 0, 18));
      const ln = new THREE.Mesh(new THREE.CircleGeometry(1.1, 18), M.glass); ln.rotation.y = Math.PI / 2; ln.position.set(sx + 3.21, base + 1.55, 0); o.add(ln);
      gun.sightH = base + 1.55; gun.scope = true;
    }
    g.add(o);
  } else if (has('aperture')) {
    const ap = new THREE.Group();
    ap.add(rbox(1.4, 1.0, 1.4, M.blued, 0, -0.4, 0, 0.2));
    const r = new THREE.TorusGeometry(0.5, 0.2, 8, 16); r.rotateY(Math.PI / 2); ap.add(mesh(r, M.blued, 0, 0.35, 0));
    ap.position.set(pistol ? -2.2 : -1.6, gun.sightH - 0.35, gun.sightZ || 0);
    g.add(ap);
  }
  if (has('laser')) {
    const lx = Math.max(2, gun.leftHand.x + 2.5);
    g.add(rbox(2.6, 1.0, 1.0, M.paint, lx, B - 0.3, 1.5, 0.2));
    const em = new THREE.Mesh(new THREE.CircleGeometry(0.22, 8), M.redLens); em.rotation.y = Math.PI / 2; em.position.set(lx + 1.32, B - 0.3, 1.5); g.add(em);
  }
  if (has('gl')) {
    const gx = gun.leftHand.x - 3;
    g.add(tube(1.0, 9, M.paint, gx, B - 1.9, 0, 1.0, 18));
    g.add(rbox(3, 1.6, 2.2, M.paint, gx + 1, B - 1.4, 0, 0.3));
    g.add(ring(1.0, 0.15, M.blued, gx + 9, B - 1.9, 0));
    gun.leftHand = V(gx + 5, B - 3.3, -0.3);
  }
  if (has('suppressor')) {
    const L = pistol ? 6 : 9, R = pistol ? 0.95 : 1.3;
    g.add(lathe([[0, R * 0.6], [0.5, R], [L - 0.4, R], [L, R * 0.7], [L, 0.25]], M.paint, mz.x, mz.y, 0, 24));
    for (let i = 1; i < 4; i++) g.add(ring(R + 0.02, 0.05, M.blued2, mz.x + (L / 4) * i, mz.y, 0));
    mz.x += L;
  }
  if (has('flashhider')) {
    g.add(lathe([[0, 0.55], [3.2, 1.1], [3.2, 0.9], [0.3, 0.4]], M.blued, mz.x, mz.y, 0, 20));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.add(box(1.8, 0.25, 0.25, M.dark, mz.x + 2.1, mz.y + Math.sin(a) * 0.95, Math.cos(a) * 0.95)); }
    mz.x += 3.2;
  }
  if (has('riflenade')) {
    g.add(lathe([[0, 0.7], [0.8, 1.25], [3.6, 1.25], [3.6, 1.05], [0.9, 1.05]], M.blued, mz.x, mz.y, 0, 20));
    const nade = new THREE.Group();
    nade.add(lathe([[0, 0.9], [1.5, 1.25], [4.5, 1.3], [6.2, 0.6], [6.6, 0]], M.nade, 0, 0, 0, 20));
    nade.add(tube(0.5, 3, M.nade, -2.6, 0, 0));
    for (let i = 0; i < 4; i++) { const f = box(2.4, 0.08, 1.8, M.nade, -1.6, 0, 0); f.rotation.x = i * Math.PI / 4; nade.add(f); }
    nade.position.set(mz.x + 3.2, mz.y, 0);
    g.add(nade);
    gun.parts.rifleNade = nade;
    mz.x += 3.6;
  }
  if (has('bayonet')) {
    const by = B - 1.35, bx = gun.muzzle.x - 3.5;
    g.add(rbox(3, 1.2, 1.2, M.blued, bx, by, 0, 0.3));
    g.add(ring(0.75, 0.15, M.blued, bx + 1.4, B, 0));
    const blade = ext([[0, -0.55], [13, -0.45], [15.2, 0.15], [13, 0.5], [0, 0.55]], 0.32, M.bright, { bevel: 0.08 });
    blade.position.set(bx + 1.5, by, 0); g.add(blade);
    g.add(box(10, 0.12, 0.34, M.blued2, bx + 7, by + 0.05, 0)); // fuller
  }
  if (has('grip')) {
    const gx = gun.leftHand.x;
    const fg = ext([[-1.1, 0], [1.1, 0], [0.9, -5.2], [0.2, -5.6], [-0.9, -5.2]], 1.9, M.walnut, { bevel: 0.55 });
    fg.position.set(gx, gun.leftHand.y + 1.4, 0); g.add(fg);
    g.add(rbox(3, 0.6, 2.2, M.blued, gx, gun.leftHand.y + 1.4, 0, 0.15));
    gun.leftHand = V(gx, gun.leftHand.y - 1.2, -0.3); gun.foregrip = true;
  }
  if (has('bipod')) {
    const bx = Math.min(gun.muzzle.x - 4, gun.leftHand.x + 9);
    g.add(rbox(2, 1.2, 2.6, M.blued, bx, B - 1.0, 0, 0.3));
    for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(bx, B - 1.2, s * 0.9);
      leg.add(tube(0.3, 9, M.blued, -9, 0, 0)); leg.add(rbox(1.4, 0.4, 0.9, M.blued, -9.2, 0, 0, 0.12));
      leg.rotation.set(s * 0.12, 0, -0.35); g.add(leg);
    }
  }
  if (has('sling')) {
    const a = V(-10, -3.9, 1.4), b = V(Math.min(gun.muzzle.x - 6, 16), B - 1.9, 1.4);
    const pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 4.2, 1.45)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 24, 0.22, 4); geo.scale(1, 1, 1);
    g.add(mesh(geo, M.leather));
  }
  if (has('drum') && gun.parts.mag && id === 'mg42') { gun.parts.mag.add(drum(M, 4, 3.4)); }
  if (has('extmag') && gun.pan && gun.parts.mag) gun.parts.mag.scale.y = 1.5;
}

// ================================================================ public API
const BUILDERS = {
  kar98k: buildBoltRifle, springfield: buildBoltRifle, mosin: buildBoltRifle, arisaka: buildBoltRifle,
  garand: buildSemiRifle, gewehr43: buildSemiRifle, svt40: buildSemiRifle, m1carbine: buildSemiRifle,
  thompson: buildSMG, mp40: buildSMG, ppsh41: buildSMG, type100: buildSMG,
  stg44: buildAR, bar: buildAR, mg42: buildMG, dp28: buildMG, type99: buildMG,
  trenchgun: buildShotgun, doublebarrel: buildShotgun,
  colt: buildPistol, p38: buildPistol, tt33: buildPistol, nambu: buildPistol, revolver: buildPistol,
  deagle: buildPistol, makarov: buildPistol, cz75: buildPistol, glock18: buildPistol, usp45: buildPistol, m9: buildPistol, fiveseven: buildPistol, b93r: buildPistol,
};

export function makeGun(id, atts) {
  const M = materials();
  atts = (atts || []).slice();
  if (MODERN[id] && ['l96', 'svd', 'wa2000', 'psg1', 'm200', 'm82', 'dsr50'].includes(id) && !atts.includes('scope')) atts.push('scope'); // snipers come scoped
  const has = (a) => atts.includes(a);
  const builder = MODERN[id] ? buildModern : BUILDERS[id] || buildSMG;
  const gun = builder(M, MODERN[id] || BUILDERS[id] ? id : 'thompson', has);
  gun.id = id;
  gun.atts = atts;
  gun.muzzle = gun.muzzle.clone();
  addAttachments(M, gun, atts, id);
  gun.anim = { lastShot: -1e9, cycled: true, ejected: true, reloadPrev: 0, cylRot: 0 };
  gun.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return gun;
}

// Merge a gun's meshes by material: far fewer draw calls for third-person weapons.
export function mergeGun(gun) {
  const root = gun.group;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    const list = buckets.get(o.material) || []; list.push(geo); buckets.set(o.material, list);
  });
  const out = new THREE.Group();
  for (const [mat, list] of buckets) {
    const total = list.reduce((n, g) => n + g.attributes.position.count, 0);
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    let o3 = 0, o2 = 0;
    for (const g of list) { pos.set(g.attributes.position.array, o3); nor.set(g.attributes.normal.array, o3); uv.set(g.attributes.uv.array, o2); o3 += g.attributes.position.array.length; o2 += g.attributes.uv.array.length; g.dispose(); }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(merged, mat); m.castShadow = true;
    out.add(m);
  }
  gun.group = out;
  return gun;
}

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seg = (t, a, b) => ease((t - a) / (b - a));
const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));

// Animate moving parts. s: { now, rate (ms), reload (0..1, 0 = not reloading), ammo }
// Returns a list of events: 'eject' (spent casing), 'bolt', 'pump', 'click', 'magout', 'magin', 'rack', 'ping'.
export function animateGun(gun, s) {
  const ev = [];
  const a = gun.anim, P = gun.parts;
  const since = s.now - a.lastShot;
  // --- firing cycle
  switch (gun.action) {
    case 'bolt': {
      const cyc = Math.max(600, s.rate * 0.8), t = (since - 140) / cyc;
      if (P.bolt && s.reload <= 0) {
        const up = seg(t, 0, 0.18) - seg(t, 0.82, 1), back = seg(t, 0.2, 0.45) - seg(t, 0.55, 0.8);
        P.bolt.rotation.x = -1.25 * up; P.bolt.position.x = -6 * back;
      }
      if (!a.cycled && t >= 0) { a.cycled = true; ev.push('bolt'); }
      if (!a.ejected && t >= 0.38) { a.ejected = true; ev.push('eject'); }
      break;
    }
    case 'pump': {
      const t = (since - 160) / 420;
      if (P.pump) P.pump.position.x = 8.5 - 4.2 * bump(t, 0, 1);
      if (!a.cycled && t >= 0) { a.cycled = true; ev.push('pump'); }
      if (!a.ejected && t >= 0.45) { a.ejected = true; ev.push('eject'); }
      break;
    }
    case 'pistol': {
      const locked = s.ammo === 0 && s.reload <= 0;
      if (P.slide) P.slide.position.x = locked ? -2.2 : -2.2 * bump(since, 0, 110);
      if (!a.ejected && since > 20) { a.ejected = true; ev.push('eject'); }
      break;
    }
    case 'revolver': {
      if (!a.cycled) { a.cycled = true; a.cylRot += TAU / 6; }
      if (P.cyl) { P.cyl.rotation.x += (a.cylRot - P.cyl.rotation.x) * 0.35; }
      break;
    }
    case 'break': break;
    default: { // auto / semi / garand
      const dur = Math.min(90, s.rate * 0.7);
      if (P.charger) P.charger.position.x = -2.4 * bump(since, 0, dur);
      if (!a.ejected && since > 15) { a.ejected = true; ev.push('eject'); }
      if (gun.action === 'garand' && s.ammo === 0 && !a.pinged && since > 30 && s.reload <= 0) { a.pinged = true; ev.push('ping'); }
    }
  }
  // --- reload
  const r = s.reload, pr = a.reloadPrev;
  const cross = (x) => pr < x && r >= x;
  if (r > 0) {
    if (gun.action === 'bolt') {
      if (P.bolt) { const open = seg(r, 0, 0.12) - seg(r, 0.86, 1); P.bolt.rotation.x = -1.25 * Math.min(1, open * 2); P.bolt.position.x = -6 * Math.max(0, open * 2 - 1); }
      if (cross(0.08)) ev.push('bolt'); if (cross(0.35)) ev.push('magin'); if (cross(0.6)) ev.push('magin'); if (cross(0.9)) ev.push('bolt');
    } else if (gun.action === 'revolver') {
      if (P.cyl) P.cyl.position.z = -2.6 * (seg(r, 0.05, 0.2) - seg(r, 0.85, 0.97));
      if (cross(0.1)) ev.push('click'); if (cross(0.3)) ev.push('eject6'); if (cross(0.6)) ev.push('magin'); if (cross(0.92)) ev.push('click');
    } else if (gun.action === 'break') {
      if (P.barrels) P.barrels.rotation.z = -0.55 * (seg(r, 0.05, 0.22) - seg(r, 0.82, 0.95));
      if (cross(0.12)) ev.push('click'); if (cross(0.25)) ev.push('eject2'); if (cross(0.6)) ev.push('magin'); if (cross(0.9)) ev.push('rack');
    } else if (gun.action === 'pump') {
      if (cross(0.2)) ev.push('magin'); if (cross(0.45)) ev.push('magin'); if (cross(0.7)) ev.push('magin'); if (cross(0.9)) ev.push('pump');
      if (P.pump) P.pump.position.x = 8.5 - 4.2 * bump(r, 0.82, 1);
    } else {
      // detachable box / drum / pan / belt
      const m = P.mag;
      if (m && gun.magPos) {
        const out = seg(r, 0.08, 0.3), inn = seg(r, 0.42, 0.68);
        const away = out * (1 - inn);
        const dir = gun.pan ? V(0, 1, 0) : gun.beltFed ? V(0, -0.4, -1) : V(0, -1, 0);
        m.position.copy(gun.magPos).addScaledVector(dir, 16 * away);
        m.rotation.z = (gun.pan ? 0 : 0.35) * away;
        m.visible = !(r > 0.3 && r < 0.42);
      }
      if (P.cover) P.cover.rotation.z = 1.1 * (seg(r, 0.05, 0.2) - seg(r, 0.72, 0.85));
      if (gun.action === 'garand') { if (cross(0.45)) ev.push('magin'); if (cross(0.8)) ev.push('rack'); }
      else { if (cross(0.1)) ev.push('magout'); if (cross(0.62)) ev.push('magin'); if (cross(0.85)) ev.push('rack'); }
      if (P.charger) P.charger.position.x = -2.6 * bump(r, 0.8, 0.95);
      if (P.slide) P.slide.position.x = -2.2 * (1 - seg(r, 0.85, 0.95));
    }
  } else if (pr > 0) { // reload finished: reset parts
    if (P.mag && gun.magPos) { P.mag.position.copy(gun.magPos); P.mag.rotation.z = 0; P.mag.visible = true; }
    if (P.cover) P.cover.rotation.z = 0;
    if (P.barrels) P.barrels.rotation.z = 0;
    if (P.cyl) P.cyl.position.z = 0;
    if (P.bolt) { P.bolt.rotation.x = 0; P.bolt.position.x = 0; }
    a.pinged = false;
  }
  a.reloadPrev = r;
  return ev;
}

export function onShot(gun, now) { gun.anim.lastShot = now; gun.anim.cycled = false; gun.anim.ejected = false; }

// where the left hand should be (gun-local), following the magazine during reloads
export function leftHandTarget(gun, r, out) {
  out.copy(gun.leftHand);
  if (r > 0 && gun.parts.mag && gun.magPos && !gun.pistol) {
    const k = Math.min(1, bump(r, 0.05, 0.8) * 1.6);
    out.lerp(_v.copy(gun.parts.mag.position).add(V(0, gun.pan ? 1 : -2, -1)), k);
  }
  return out;
}

export function casingMesh(shell) {
  const M = materials();
  const g = new THREE.Group();
  if (shell) { g.add(tube(0.55, 2.4, M.shellHull, -1.2, 0, 0)); g.add(tube(0.58, 0.7, M.brass, -1.3, 0, 0)); }
  else { g.add(lathe([[-0.8, 0.26], [0.4, 0.26], [0.7, 0.19], [1.0, 0.17], [1.0, 0]], M.brass, 0, 0, 0, 10)); }
  return g;
}

export const textures = { flashStar: null, smoke: null };
export function fxTextures() {
  if (!textures.flashStar) { textures.flashStar = flashStarTex(); textures.smoke = smokeTex(); }
  return textures;
}
