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
    polyTan: new THREE.MeshStandardMaterial({ color: 0x8a7a58, roughness: 0.75, metalness: 0.05, roughnessMap: roughMatte, envMapIntensity: 0.3 }),
    polyOd: new THREE.MeshStandardMaterial({ color: 0x4a5034, roughness: 0.75, metalness: 0.05, roughnessMap: roughMatte, envMapIntensity: 0.3 }),
    redLens: new THREE.MeshBasicMaterial({ color: 0xff3020 }),
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
  ak47: { len: 13, bar: 5, hg: 8, hguard: 'wood', furn: 'wood', stock: 'wood', mag: 'curved', magL: 10, curve: 0.3, gas: true, muzzle: 'slant' },
  m16a1: { len: 15, bar: 7, hg: 9, hguard: 'round', stock: 'fixed', mag: 'straight', magL: 8, handle: 'carry', muzzle: 'bird' },
  famas: { bull: true, len: 16, bar: 6, mag: 'straight', magL: 7, handle: 'long', muzzle: 'bird' },
  galil: { len: 14, bar: 6, hg: 8, hguard: 'wood', stock: 'fold', mag: 'curved', magL: 10, curve: 0.25, gas: true },
  aug: { bull: true, len: 17, bar: 7, furn: 'od', mag: 'straight', magL: 8, muzzle: 'bird', vgrip: true },
  fal: { len: 16, bar: 8, hg: 9, hguard: 'square', stock: 'fixed', mag: 'straight', magL: 7, magW: 3.2, muzzle: 'bird', recH: 1.3 },
  m14: { len: 14, bar: 10, hg: 12, hguard: 'wood', furn: 'wood', stock: 'wood', mag: 'straight', magL: 6, magW: 3.2, recMat: 'park' },
  m4a1: { len: 14, bar: 4, hg: 8, hguard: 'square', rail: true, stock: 'tube', mag: 'straight', magL: 9, curve: 0.06, muzzle: 'bird' },
  m16a4: { len: 15, bar: 8, hg: 9, hguard: 'square', rail: true, stock: 'fixed', mag: 'straight', magL: 9, curve: 0.06, muzzle: 'bird' },
  scarh: { len: 15, bar: 5, hg: 9, hguard: 'square', rail: true, furn: 'tan', stock: 'fold', mag: 'straight', magL: 7, magW: 3.2, recMat: 'poly' },
  acr: { len: 15, bar: 5, hg: 9, hguard: 'square', rail: true, stock: 'skeleton', mag: 'straight', magL: 9, recMat: 'poly' },
  tar21: { bull: true, len: 16, bar: 5, mag: 'straight', magL: 9, rail: true, muzzle: 'bird' },
  f2000: { bull: true, len: 17, bar: 4, mag: 'straight', magL: 9, rail: true, smooth: true },
  an94: { len: 15, bar: 6, hg: 8, hguard: 'square', stock: 'skeleton', mag: 'curved', magL: 10, curve: 0.28, muzzle: 'brake', rail: true },
  xm8: { len: 15, bar: 4, hg: 9, hguard: 'round', furn: 'tan', stock: 'fixed', mag: 'curved', magL: 9, curve: 0.15, recMat: 'poly', rail: true },
  mp5k: { len: 11, bar: 2, hg: 4, hguard: 'square', stock: 'none', mag: 'curved', magL: 9, curve: 0.2, vgrip: true },
  uzi: { len: 11, bar: 3, hg: 0, stock: 'fold', mag: 'grip', recH: 1.4 },
  skorpion: { len: 9, bar: 3, hg: 0, stock: 'wire', mag: 'curved', magL: 7, curve: 0.35, magX: 4 },
  ak74u: { len: 11, bar: 3, hg: 5, hguard: 'wood', furn: 'wood', stock: 'fold', mag: 'curved', magL: 10, curve: 0.3, gas: true, muzzle: 'big' },
  mac11: { len: 7, bar: 2, hg: 0, stock: 'none', mag: 'grip', recH: 1.6 },
  mp7: { len: 10, bar: 3, hg: 3, hguard: 'square', rail: true, stock: 'tube', mag: 'grip', recMat: 'poly', vgrip: true },
  vector: { len: 12, bar: 3, hg: 4, hguard: 'square', rail: true, stock: 'fold', mag: 'straight', magL: 7, magX: 4.5, recMat: 'poly', recH: 1.6 },
  p90: { bull: true, len: 15, bar: 2, mag: 'top', bulky: true },
  ump45: { len: 13, bar: 3, hg: 5, hguard: 'square', stock: 'fold', mag: 'straight', magL: 9, recMat: 'poly', rail: true },
  pp2000: { len: 9, bar: 2, hg: 0, stock: 'none', mag: 'grip', recMat: 'poly' },
  m60: { len: 18, bar: 12, hg: 8, hguard: 'round', furn: 'od', stock: 'fixed', mag: 'belt', recMat: 'park', bipod: true },
  rpk: { len: 14, bar: 10, hg: 8, hguard: 'wood', furn: 'wood', stock: 'wood', mag: 'curved', magL: 12, curve: 0.3, gas: true, bipod: true },
  stoner63: { len: 16, bar: 9, hg: 8, hguard: 'round', stock: 'fixed', mag: 'belt' },
  rpd: { len: 16, bar: 12, hg: 9, hguard: 'wood', furn: 'wood', stock: 'wood', mag: 'drum', bipod: true },
  mg4: { len: 17, bar: 9, hg: 7, hguard: 'square', rail: true, stock: 'skeleton', mag: 'belt', recMat: 'poly', bipod: true },
  lsat: { len: 16, bar: 9, hg: 8, hguard: 'square', rail: true, stock: 'tube', mag: 'belt' },
  l86: { bull: true, len: 17, bar: 10, mag: 'straight', magL: 9, rail: true, bipod: true },
  l96: { len: 14, bar: 16, hg: 12, hguard: 'square', furn: 'od', stock: 'thumb', mag: 'straight', magL: 4, bolt: true },
  svd: { len: 14, bar: 14, hg: 9, hguard: 'wood', furn: 'wood', stock: 'thumb', mag: 'straight', magL: 5, curve: 0.1, gas: true, muzzle: 'slant' },
  wa2000: { bull: true, len: 20, bar: 10, furn: 'wood', mag: 'straight', magL: 5 },
  psg1: { len: 16, bar: 12, hg: 10, hguard: 'square', stock: 'fixed', mag: 'straight', magL: 5 },
  m200: { len: 15, bar: 18, hg: 12, hguard: 'round', stock: 'skeleton', mag: 'straight', magL: 4, bolt: true, muzzle: 'brake' },
  m82: { len: 20, bar: 16, hg: 9, hguard: 'square', stock: 'fixed', mag: 'straight', magL: 5, magW: 4, muzzle: 'brake', recH: 2.0, bipod: true },
  dsr50: { bull: true, len: 16, bar: 16, mag: 'straight', magL: 4, bolt: true, muzzle: 'brake' },
  ithaca37: { len: 12, bar: 16, hg: 0, furn: 'wood', stock: 'wood', mag: 'none', tube: true, pump: true, shell: true },
  spas12: { len: 13, bar: 14, hg: 0, stock: 'fold', mag: 'none', tube: true, pump: true, shell: true },
  aa12: { len: 15, bar: 9, hg: 6, hguard: 'square', stock: 'fixed', mag: 'drum', shell: true, recH: 1.6 },
  ksg: { bull: true, len: 16, bar: 9, mag: 'none', tube: true, pump: true, shell: true, twin: true },
  m1014: { len: 13, bar: 13, hg: 7, hguard: 'round', stock: 'tube', mag: 'none', tube: true, shell: true },
  m1887: { len: 11, bar: 16, hg: 0, furn: 'wood', stock: 'wood', mag: 'none', tube: true, pump: true, shell: true, lever: true },
};
function buildModern(M, id, has) {
  const sp = MODERN[id];
  const B = 1.8, g = new THREE.Group(), charger = new THREE.Group();
  const furn = { black: M.poly, wood: M.walnut, tan: M.polyTan, od: M.polyOd }[sp.furn || 'black'];
  const recMat = sp.recMat === 'poly' ? (sp.furn === 'tan' ? M.polyTan : M.poly) : sp.recMat === 'park' ? M.park : M.blued;
  const L = sp.len, top = B + (sp.recH || 1.1);
  let leftHand, magX, rightHand, hx, hl = sp.hg || 0;
  if (!sp.bull) {
    g.add(ext([[-3, -0.3], [L - 3, -0.3], [L - 3, top - 0.25], [L - 3.6, top], [-2.2, top], [-3, top - 0.6]], 2.5, recMat, { bevel: 0.35 }));
    g.add(pistolGrip(M, 0.6, -0.2, sp.furn === 'wood' ? M.walnut : M.poly, 5.4, 0.8));
    g.add(triggerGroup(M, 1.7, -0.35, recMat));
    hx = L - 3;
    if (sp.hguard === 'wood') g.add(ext([[hx, B - 1.25], [hx + hl, B - 1.0], [hx + hl, B + 0.85], [hx, B + 0.95]], 2.5, M.walnut, { bevel: 0.5 }));
    else if (sp.hguard === 'round') g.add(tube(1.25, hl, furn, hx, B, 0, 1.15, 16));
    else if (sp.hguard === 'square') g.add(rbox(hl, 2.3, 2.5, sp.rail ? recMat : furn, hx + hl / 2, B, 0, 0.4));
    magX = sp.magX != null ? sp.magX : 5.5;
    leftHand = V(hl ? hx + Math.min(hl * 0.5, 6) : 4, B - 2.1, -0.3);
    // stock
    if (sp.stock === 'wood') g.add(buttstock(M, { len: 13, top: top - 0.2, h: 4.6, drop: 1.0, mat: M.walnut }));
    else if (sp.stock === 'fixed') g.add(buttstock(M, { len: 13, top: top - 0.2, h: 4.4, drop: 0.5, mat: furn }));
    else if (sp.stock === 'thumb') { g.add(buttstock(M, { len: 13, top: top + 0.4, h: 5.2, drop: 0.3, mat: furn })); g.add(rbox(4, 1.6, 2.7, M.dark, -8, top - 1.8, 0, 0.5)); }
    else if (sp.stock === 'tube') { g.add(tube(0.75, 8, M.blued, -11, top - 0.9, 0)); g.add(ext([[-15, top + 0.1], [-9.5, top + 0.1], [-9.5, top - 1.7], [-12, -2.2], [-15, -2.3]], 2.3, furn, { bevel: 0.4 })); }
    else if (sp.stock === 'skeleton') { g.add(tube(0.35, 12, M.blued, -15, top - 0.5, 0)); g.add(tube(0.35, 11, M.blued, -14, -1.2, 0)); g.add(rbox(1, 4.8, 2.2, furn, -15, top - 2.6, 0, 0.3)); }
    else if (sp.stock === 'fold') { g.add(rbox(12, 1.6, 0.7, furn, -3 - 6, top - 1.5, -1.6, 0.3)); g.add(rbox(1, 4.2, 0.7, furn, -14.5, top - 3.1, -1.6, 0.2)); }
    else if (sp.stock === 'wire') { g.add(tube(0.25, 11, M.blued, -14, top - 0.4, 0.6)); g.add(tube(0.25, 11, M.blued, -14, top - 2.2, 0.6)); g.add(rbox(0.6, 3.6, 2, M.blued, -14.2, top - 1.4, 0.4, 0.2)); }
  } else { // bullpup: magazine behind the grip, the body is the stock
    const bodyTop = top + (sp.bulky ? 0.8 : 0);
    const prof = sp.bulky
      ? [[-12, -3.4], [-13, -0.5], [-12, bodyTop], [L - 4, bodyTop], [L - 2, B + 0.2], [L - 3, -1.6], [3.2, -2.2], [3.2, -4.4], [-1.5, -4.6], [-0.6, -1.0], [-9, -1.4]]
      : [[-15, -3.6], [-15, bodyTop - 0.3], [-14, bodyTop], [L - 4, bodyTop], [L - 3, bodyTop - 0.6], [L - 3, B - 1.3], [2.6, B - 1.4], [2.6, -0.4], [-1, -0.4], [-2.2, -1.1], [-8, -1.3], [-12, -3.6]];
    g.add(ext(prof, sp.bulky ? 3.4 : 2.8, furn, { bevel: 0.6 }));
    if (!sp.bulky) g.add(pistolGrip(M, 0.6, -0.3, M.poly, 5.2, 0.6));
    g.add(triggerGroup(M, 1.6, -0.45, recMat));
    hx = L - 3; hl = 0;
    magX = -5.5;
    leftHand = V(L - 7, B - 2.0, -0.3);
    if (sp.vgrip) { g.add(ext([[-0.9, 0], [0.9, 0], [0.8, -4.4], [-0.8, -4.4]], 1.6, furn, { bevel: 0.5 })); g.children[g.children.length - 1].position.set(L - 7, B - 1.3, 0); leftHand = V(L - 7, B - 3.4, -0.3); }
  }
  if (sp.vgrip && !sp.bull) { const fg = ext([[-0.9, 0], [0.9, 0], [0.8, -4.2], [-0.8, -4.2]], 1.6, M.poly, { bevel: 0.5 }); fg.position.set(hx + Math.max(1.5, hl * 0.5), B - 1.2, 0); g.add(fg); leftHand = V(hx + Math.max(1.5, hl * 0.5), B - 3.2, -0.3); }
  // barrel + muzzle
  let muzzleX = hx + hl + sp.bar;
  g.add(lathe([[0, sp.bulky ? 0.6 : 0.68], [hl + sp.bar, 0.58], [hl + sp.bar, 0]], M.blued, hx, B, 0, 16));
  if (sp.gas) { g.add(tube(0.55, Math.max(4, hl * 0.85), recMat, hx, B + 1.0, 0)); g.add(rbox(1.0, 1.4, 1.4, recMat, hx + Math.max(4, hl * 0.85), B + 0.5, 0, 0.2)); }
  if (sp.tube) { g.add(tube(0.6, sp.bar * 0.85 + hl, M.blued, hx, B - 1.4, 0)); if (sp.twin) g.add(tube(0.6, sp.bar * 0.85, M.blued, hx, B - 1.4, 1.3)); }
  if (sp.muzzle === 'bird') { g.add(lathe([[0, 0.55], [1.6, 0.75], [1.6, 0.4]], M.dark, muzzleX, B, 0, 12)); muzzleX += 1.6; }
  else if (sp.muzzle === 'brake') { g.add(rbox(3, 1.5, 2.2, M.dark, muzzleX + 1.5, B, 0, 0.3)); for (let i = 0; i < 3; i++) g.add(box(0.3, 1.6, 2.3, M.paint, muzzleX + 0.6 + i * 0.9, B, 0)); muzzleX += 3; }
  else if (sp.muzzle === 'slant') { g.add(lathe([[0, 0.6], [1.4, 0.6], [1.6, 0.3]], M.blued, muzzleX, B, 0, 12)); muzzleX += 1.6; }
  else if (sp.muzzle === 'big') { g.add(lathe([[0, 0.7], [0.4, 1.0], [2.4, 1.0], [2.4, 0.4]], M.blued, muzzleX, B, 0, 14)); muzzleX += 2.4; }
  if (sp.bipod) for (const sd of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(hx + hl + sp.bar * 0.5, B - 0.6, sd * 0.8); leg.add(tube(0.25, 7, M.blued, 0, 0, 0)); leg.rotation.set(sd * 0.12, 0, -1.2); g.add(leg); } // folded down
  // top rail / carry handle / sights
  let sightH, scopeBase = top + 0.25;
  if (sp.rail) {
    const railLen = (sp.bull ? L - 2 : L + hl - 2);
    g.add(box(railLen, 0.45, 1.2, M.blued, (sp.bull ? -6 : -2) + railLen / 2, top + 0.22, 0));
    for (let x = 0; x < railLen; x += 0.9) g.add(box(0.35, 0.2, 1.25, M.dark, (sp.bull ? -6 : -2) + x, top + 0.48, 0));
    scopeBase = top + 0.45; sightH = top + 1.5;
    g.add(rbox(0.8, 1.1, 1.0, M.dark, -1.5, top + 1.0, 0, 0.15)); g.add(rbox(0.6, 1.1, 0.5, M.dark, (sp.bull ? L - 4 : hx + hl - 1), top + 1.0, 0, 0.1));
  } else if (sp.handle) {
    const hlen = sp.handle === 'long' ? L + 2 : 9, h0 = sp.handle === 'long' ? -11 : -2.5;
    g.add(ext([[h0, top], [h0 + 0.8, top + 2.2], [h0 + hlen - 0.8, top + 2.2], [h0 + hlen, top], [h0 + hlen - 1.2, top], [h0 + hlen - 1.4, top + 1.3], [h0 + 1.4, top + 1.3], [h0 + 1.2, top]], 1.3, recMat, { bevel: 0.2 }));
    sightH = top + 2.45; scopeBase = top + 2.3;
    g.add(box(0.25, top + 2.45 - B - 0.4, 0.3, M.dark, muzzleX - 2, (top + 2.45 + B + 0.4) / 2, 0));
  } else {
    sightH = top + 0.8;
    g.add(rearNotch(M, 0.5, top - 0.2, sightH, 1.2));
    g.add(frontPost(M, muzzleX - 1.2, B + 0.4, sightH, sp.furn === 'wood'));
  }
  // magazine
  let mag = null;
  const magW = sp.magW || 2.6;
  if (sp.mag === 'curved' || sp.mag === 'straight') {
    const mL = (sp.magL || 8) * (has('extmag') ? 1.4 : 1);
    mag = magazine(M, mL, magW, 1.7, sp.mag === 'curved' ? sp.curve : sp.curve || 0, sp.furn === 'tan' ? M.polyTan : M.paint);
    if (has('dualmag')) { const m2 = magazine(M, mL, magW, 1.7, sp.curve || 0, M.paint); m2.position.z = 1.9; mag.add(m2); mag.add(rbox(magW + 0.4, 1.3, 3.8, M.canvas, 0.3, -mL * 0.4, 0.95, 0.2)); }
    mag.position.set(magX, -0.3, 0);
  } else if (sp.mag === 'grip') { mag = new THREE.Group(); mag.add(rbox(2.2, 0.8 + (has('extmag') ? 2.5 : 0), 1.6, M.paint, -0.9, -6.0 - (has('extmag') ? 1.2 : 0), 0, 0.15)); }
  else if (sp.mag === 'belt') {
    mag = new THREE.Group();
    mag.add(rbox(5, has('extmag') ? 6.5 : 5, 3.8, M.polyOd, 0, -2.5, 0, 0.4));
    for (let i = 0; i < 6; i++) { const rr = new THREE.Group(); rr.position.set(-1.5 + i * 0.6, 1.0 + Math.min(i, 3) * 0.3, 2.0 - Math.min(i, 3) * 0.4); rr.add(tube(0.3, 2.0, M.brass, -1, 0, 0)); rr.rotation.y = Math.PI / 2; mag.add(rr); }
    mag.position.set(4, -0.6, -4);
  } else if (sp.mag === 'drum') { mag = new THREE.Group(); const d = drum(M, 4.6, 3.2); d.position.set(0, -4.6, 0); mag.add(d); mag.position.set(sp.bull ? magX : 5, -0.3, 0); }
  else if (sp.mag === 'top') { mag = new THREE.Group(); mag.add(rbox(12, 1.2, 2.4, M.polyTan, 0, 0, 0, 0.3)); mag.position.set(L / 2 - 6, top + 1.2, 0); sightH = top + 2.6; scopeBase = top + 1.9; }
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
    g.add(pump); parts.pump = pump; action = 'pump';
    if (!sp.lever) leftHand = V(11.5, B - 2.7, -0.3);
  } else charger.add(rbox(0.9, 0.7, 1.3, M.bright, Math.min(L - 5, 5), top - 0.3, 1.5, 0.2));
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
    colt: { len: 8.6, h: 1.55, grip: M.gripWood, frame: M.park, slideMat: M.park },
    p38: { len: 8.2, h: 1.4, grip: M.gripBlack, frame: M.blued, slideMat: M.blued, open: true },
    tt33: { len: 7.8, h: 1.5, grip: M.gripBlack, frame: M.blued, slideMat: M.blued },
    nambu: { len: 9, h: 1.2, grip: M.gripWood, frame: M.blued, slideMat: M.blued, nambu: true },
    deagle: { len: 10.4, h: 2.0, grip: M.gripBlack, frame: M.bright, slideMat: M.bright },
    makarov: { len: 6.6, h: 1.4, grip: M.bakelite, frame: M.blued, slideMat: M.blued },
    cz75: { len: 8.0, h: 1.4, grip: M.gripWood, frame: M.blued, slideMat: M.blued },
    glock18: { len: 7.6, h: 1.6, grip: M.poly, frame: M.poly, slideMat: M.blued },
    usp45: { len: 8.2, h: 1.6, grip: M.poly, frame: M.poly, slideMat: M.blued },
    m9: { len: 8.6, h: 1.4, grip: M.gripBlack, frame: M.blued, slideMat: M.blued, open: true },
    fiveseven: { len: 8.2, h: 1.5, grip: M.poly, frame: M.poly, slideMat: M.blued },
    b93r: { len: 9.4, h: 1.4, grip: M.gripBlack, frame: M.blued, slideMat: M.blued, open: true },
  }[id];
  if (spec.nambu) {
    g.add(tube(0.85, 6, M.blued, -2.2, B + 0.3, 0)); // receiver
    g.add(lathe([[0, 0.75], [5.5, 0.5], [5.5, 0]], M.blued, 3.6, B + 0.3, 0, 16));
    slide.add(lathe([[0, 0.55], [0.6, 0.7], [1.2, 0.55], [1.2, 0]], M.bright, -2.9, B + 0.3, 0, 12)); // bolt knob
    g.add(ext([[-2.2, B - 0.5], [3, B - 0.5], [2.4, -0.4], [-1.2, -0.4]], 1.5, M.blued, { bevel: 0.25 }));
    g.add(ext([[-2.3, 0.2], [-0.2, 0.2], [-1.5, -5.0], [-3.8, -5.1], [-3.6, -3.5]], 1.9, spec.grip, { bevel: 0.5 }));
    muzzleX = 9.1;
  } else {
    // frame + slide
    g.add(ext([[-2.4, -0.1], [spec.len - 3.2, -0.1], [spec.len - 3.2, B - 0.6], [-2.4, B - 0.6]], 1.45, spec.frame, { bevel: 0.2 }));
    const sp = spec.open
      ? [[-2.6, B - 0.6], [spec.len - 2.7, B - 0.6], [spec.len - 2.7, B + spec.h - 0.6], [3.5, B + spec.h - 0.6], [3.5, B + 0.2], [0.8, B + 0.2], [0.8, B + spec.h - 0.6], [-2.6, B + spec.h - 0.6]]
      : [[-2.6, B - 0.6], [spec.len - 2.7, B - 0.6], [spec.len - 2.7, B + spec.h - 0.6], [-2.4, B + spec.h - 0.6], [-2.6, B + spec.h - 0.9]];
    slide.add(ext(sp, 1.5, spec.slideMat, { bevel: 0.18 }));
    for (let i = 0; i < 8; i++) slide.add(box(0.12, spec.h * 0.75, 1.52, M.dark, -2.2 + i * 0.28, B + spec.h * 0.4 - 0.6, 0)); // serrations
    if (spec.open) slide.add(tube(0.5, 3.5, M.blued, 0.5, B + 0.25, 0));
    slide.add(box(0.25, 0.55, 0.3, M.blued, spec.len - 3.1, B + spec.h - 0.35, 0)); // front sight
    slide.add(rbox(0.6, 0.45, 1.2, M.blued, -2.0, B + spec.h - 0.35, 0, 0.1)); // rear sight
    slide.add(tube(0.45, 0.4, M.dark, spec.len - 2.75, B + 0.1, 0));
    muzzleX = spec.len - 2.3;
    const gp = [[-2.6, 0], [-0.7, 0], [-1.5, -4.6], [-3.5, -4.85], [-3.75, -4.4], [-3.3, -0.4]];
    g.add(ext(gp, 1.6, spec.grip, { bevel: 0.3 }));
    g.add(ext(gp, 1.35, spec.frame, { bevel: 0.15 })); // grip frame under the panels
    const hammer = rbox(0.6, 0.9, 0.45, M.blued, -2.8, B + 0.3, 0, 0.12); hammer.rotation.z = 0.4; g.add(hammer);
  }
  g.add(slide);
  g.add(triggerGroup(M, 0.3, -0.05, spec.frame));
  const mag = new THREE.Group();
  mag.add(rbox(1.7, 0.5, 1.2, M.blued, -2.65, -4.95, 0, 0.12));
  if (has('extmag')) mag.add(rbox(1.6, 2.0, 1.1, M.blued, -2.75, -6.1, 0, 0.15));
  mag.position.set(0, 0, 0);
  g.add(mag);
  const sightH = spec.nambu ? B + 1.25 : B + spec.h - 0.1;
  return finish(g, { muzzle: V(muzzleX, B + (spec.nambu ? 0.3 : 0.1), 0), sightH, B: B + 0.1, rightHand: V(-1.8, -2.1, 0), leftHand: V(-1.9, -3.2, -1.6), ejectPort: V(0.5, B + 0.6, 0.8), action: 'pistol', parts: { slide, mag }, pistol: true, magPos: V(0, 0, 0) });
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
      o.add(rbox(2.2, 0.6, 1.3, M.blued, sx, base + 0.3, 0, 0.2));
      o.add(lathe([[-1.2, 0.75], [1.2, 0.75], [1.2, 0.55], [-1.2, 0.55]], M.blued, sx, base + 1.25, 0, 16));
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), M.redLens); dot.rotation.y = -Math.PI / 2; dot.position.set(sx + 1.0, base + 1.25, 0); o.add(dot);
      gun.sightH = base + 1.25;
    } else if (has('holo')) {
      o.add(rbox(3.4, 0.8, 1.6, M.paint, sx, base + 0.4, 0, 0.25));
      o.add(box(0.35, 1.9, 1.6, M.paint, sx - 1.5, base + 1.5, 0)); o.add(box(0.35, 1.9, 1.6, M.paint, sx + 1.5, base + 1.5, 0)); o.add(box(3.4, 0.3, 1.6, M.paint, sx, base + 2.45, 0));
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), M.glass); win.rotation.y = Math.PI / 2; win.position.set(sx + 1.5, base + 1.45, 0); o.add(win);
      gun.sightH = base + 1.45;
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
