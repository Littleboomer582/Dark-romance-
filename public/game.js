/* Frontline 1945 — first-person browser / Android client */
import * as THREE from './vendor/three.module.min.js';

const S = window.Shared;
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ov = $('overlay');
const octx = ov.getContext('2d');
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
const TAU = Math.PI * 2;

// ================================================================ storage
function loadSaved(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ } }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

// ============================================================= loadout UI
const CLASSES = ['SMG', 'Assault Rifle', 'Rifle', 'Bolt-Action', 'Shotgun', 'Machine Gun'];
const SECONDARY_IDS = Object.keys(S.WEAPONS).filter((k) => S.WEAPONS[k].secondary);
const PRIMARY_IDS = Object.keys(S.WEAPONS).filter((k) => !S.WEAPONS[k].secondary);
let loadout = S.sanitizeLoadout(loadSaved('fl_loadout', { primary: 'thompson', atts: ['grip', 'aperture'], secondary: 'colt', secAtts: [] }));

function buildLoadout(el) {
  let cls = S.WEAPONS[loadout.primary].cls;
  let desc = '';
  const btn = (text, on, onClick, disabled, title) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = text;
    if (on) b.classList.add('on');
    if (disabled) b.disabled = true;
    if (title) b.title = title;
    b.addEventListener('click', onClick);
    return b;
  };
  const div = (c, text) => { const d = document.createElement('div'); d.className = c; if (text) d.textContent = text; return d; };
  function attRow(weaponId, list, max, key) {
    const w = S.WEAPONS[weaponId];
    const row = div('lo-atts');
    if (!w.allowed.length) row.appendChild(div('lo-desc', 'No attachments available.'));
    for (const a of w.allowed) {
      const on = list.includes(a);
      const slotTaken = list.find((x) => x !== a && S.ATTACHMENTS[x].slot === S.ATTACHMENTS[a].slot);
      const disabled = !on && (list.length >= max || !!slotTaken);
      row.appendChild(btn(S.ATTACHMENTS[a].name, on, () => {
        if (on) loadout[key] = list.filter((x) => x !== a);
        else loadout[key] = list.concat([a]);
        desc = S.ATTACHMENTS[a].name + ': ' + S.ATTACHMENTS[a].desc;
        commit();
      }, disabled, slotTaken ? 'Conflicts with ' + S.ATTACHMENTS[slotTaken].name : S.ATTACHMENTS[a].desc));
    }
    return row;
  }
  function render() {
    el.innerHTML = '';
    const w = S.WEAPONS[loadout.primary];
    el.appendChild(div('lo-label', 'Primary class'));
    const cr = div('lo-classes');
    for (const c of CLASSES) cr.appendChild(btn(c, c === cls, () => { cls = c; loadout.primary = PRIMARY_IDS.find((k) => S.WEAPONS[k].cls === c); loadout.atts = []; commit(); }));
    el.appendChild(cr);
    const wr = div('lo-weapons');
    for (const k of PRIMARY_IDS.filter((k) => S.WEAPONS[k].cls === cls)) {
      wr.appendChild(btn(S.WEAPONS[k].name, k === loadout.primary, () => { loadout.primary = k; commit(); }));
    }
    el.appendChild(wr);
    const st = S.computeStats(loadout.primary, loadout.atts);
    const stats = div('lo-stats');
    const bars = [
      ['Damage', Math.min(1, (st.dmg * st.pellets) / 120)],
      ['Fire rate', Math.min(1, 60000 / st.rate / 1200)],
      ['Accuracy', Math.max(0.05, 1 - st.spread / 0.12)],
      ['Range', Math.min(1, st.range / 1800)],
      ['Mobility', Math.max(0.05, (st.speed - 0.7) / 0.4)],
      ['Control', Math.max(0.05, 1 - st.recoil / 0.08)],
    ];
    for (const [n, v] of bars) {
      stats.appendChild(div('', n));
      const bar = div('bar'); const i = document.createElement('i'); i.style.width = (v * 100).toFixed(0) + '%'; bar.appendChild(i);
      stats.appendChild(bar);
    }
    stats.appendChild(div('', 'Magazine'));
    stats.appendChild(div('', `${st.mag} rds · ${(st.reload / 1000).toFixed(1)}s reload · ${w.nation}${st.auto ? ' · full-auto' : ''}`));
    el.appendChild(stats);
    el.appendChild(div('lo-label', `Attachments (${loadout.atts.length}/${S.MAX_ATTACHMENTS}) · one per slot`));
    el.appendChild(attRow(loadout.primary, loadout.atts, S.MAX_ATTACHMENTS, 'atts'));
    el.appendChild(div('lo-desc', desc));
    el.appendChild(div('lo-label', 'Sidearm'));
    const sr = div('lo-sec');
    for (const k of SECONDARY_IDS) sr.appendChild(btn(S.WEAPONS[k].name, k === loadout.secondary, () => { loadout.secondary = k; commit(); }));
    el.appendChild(sr);
    el.appendChild(div('lo-label', `Sidearm attachment (${loadout.secAtts.length}/${S.MAX_SEC_ATTACHMENTS})`));
    el.appendChild(attRow(loadout.secondary, loadout.secAtts, S.MAX_SEC_ATTACHMENTS, 'secAtts'));
  }
  function commit() { loadout = S.sanitizeLoadout(loadout); save('fl_loadout', loadout); render(); }
  render();
  return { render };
}
const menuLoadout = buildLoadout($('loadoutMenu'));
const gameLoadout = buildLoadout($('loadoutGame'));
$('name').value = loadSaved('fl_name', '');
$('room').value = loadSaved('fl_room', '');
let sens = loadSaved('fl_sens', 1);
$('sens').value = sens; $('sensVal').textContent = (+sens).toFixed(2);
$('sens').addEventListener('input', () => { sens = +$('sens').value; $('sensVal').textContent = sens.toFixed(2); save('fl_sens', sens); });
$('controlsHelp').innerHTML = isTouch
  ? 'Left thumb: move (push all the way up to sprint). Drag anywhere on the right to look. FIRE buttons shoot (drag on them to aim while firing). AIM aims down sights, &#8615; crouch, R reload, &#8646; swap, G grenade, &#9876; melee, RG rifle grenade.'
  : 'Click to lock the mouse &middot; WASD move &middot; Mouse look &middot; Left click fire &middot; Right click aim down sights &middot; Shift sprint &middot; C / Ctrl crouch &middot; R reload &middot; Q / wheel swap &middot; G grenade &middot; V melee &middot; B rifle grenade &middot; Tab scores &middot; L loadout';

// ================================================================== audio
let actx = null, noiseBuf = null, soundsThisFrame = 0;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 1.5, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { actx = null; }
}
function noise(freq, dur, vol) {
  if (!actx || vol <= 0.01 || soundsThisFrame > 6) return;
  soundsThisFrame++;
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = actx.createGain(); const t = actx.currentTime;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(actx.destination);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function tone(freq, dur, vol, type) {
  if (!actx) return;
  const o = actx.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
  const g = actx.createGain(); const t = actx.currentTime;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SHOT_SND = { 'SMG': [2600, 0.14], 'Assault Rifle': [2100, 0.2], 'Rifle': [1700, 0.3], 'Bolt-Action': [1400, 0.45], 'Shotgun': [1100, 0.4], 'Machine Gun': [2000, 0.18], 'Pistol': [3000, 0.12] };
function volAt(x, y) { return Math.max(0, 1 - Math.hypot(x - pred.x, y - pred.y) / 1800); }
function playShot(wid, x, y, sup) {
  const w = S.WEAPONS[wid]; if (!w) return;
  const v = volAt(x, y); const [f, d] = SHOT_SND[w.cls] || [2000, 0.2];
  if (sup) noise(900, 0.08, v * 0.25); else noise(f, d, v * 0.55);
}

// ================================================================ network
let ws = null, myId = 0, joined = false, roomCode = '';
let snaps = [];
const roster = new Map();
let you = null;
const pred = { x: 0, y: 0 };
let pending = [], outbox = [], seq = 0, lastSend = 0, lastFireSent = false;
let yaw = 0, pitch = 0, recoilDebt = 0, wasAlive = false, lastSlot = 0;
let nadeState = [];
const match = { sc: [0, 0], tl: 0, st: 'playing', rs: 0, winner: null };
let ping = 0;
const killfeed = [];
const hurtDirs = [];
let hitMarker = 0, hitKill = false, hurtFlash = 0, shake = 0, centerMsg = null, deathPos = null;

const servedOverHttp = /^https?:$/.test(location.protocol);
function serverUrl() {
  let q = $('server').value.trim() || new URLSearchParams(location.search).get('server') || window.GAME_SERVER;
  if (q) {
    if (!/^(https?|wss?):\/\//i.test(q)) q = 'https://' + q;
    return q.replace(/^http/i, 'ws').replace(/\/(ws)?\/?$/, '') + '/ws';
  }
  if (servedOverHttp) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  return null;
}

// Offline play: run the game simulation inside this page and talk to it through a loopback "socket".
function localSocket() {
  const sock = { readyState: 0, onopen: null, onmessage: null, onclose: null,
    send(s) { queueMicrotask(() => conn.message(s)); },
    close() { clearInterval(timer); conn.close(); sock.readyState = 3; if (sock.onclose) sock.onclose(); } };
  const serverSide = { readyState: 1, send: (s) => queueMicrotask(() => { if (sock.onmessage) sock.onmessage({ data: s }); }) };
  const conn = window.Sim.connect(serverSide);
  const timer = setInterval(window.Sim.tick, window.Sim.TICK_MS);
  setTimeout(() => { sock.readyState = 1; if (sock.onopen) sock.onopen(); });
  return sock;
}

let offlineMode = false;
function connect(offline) {
  offlineMode = !!offline;
  const name = $('name').value.trim() || 'Soldier';
  const room = offline ? 'OFFLINE' : ($('room').value.trim() || 'PUBLIC');
  save('fl_name', $('name').value.trim()); save('fl_room', $('room').value.trim()); save('fl_server', $('server').value.trim());
  let bots = +$('bots').value;
  if (offline) {
    if (bots < 2) bots = 4;
    ws = localSocket();
  } else {
    const url = serverUrl();
    if (!url) { $('err').textContent = 'Enter your game server address for online play, or press PLAY OFFLINE VS BOTS.'; $('server').focus(); return; }
    $('err').textContent = 'Connecting...';
    try { ws = new WebSocket(url); } catch (e) { $('err').textContent = 'Could not connect: ' + e.message; return; }
  }
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name, room, bots, loadout }));
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMessage(m); };
  ws.onclose = () => {
    if (joined) showMenu(offlineMode ? '' : 'Disconnected from server.');
    else $('err').textContent = 'Could not reach the game server.';
    joined = false;
  };
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

function onMessage(m) {
  switch (m.t) {
    case 'welcome':
      myId = m.id; roomCode = m.code; joined = true; snaps = []; pending = []; you = null;
      $('err').textContent = '';
      $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
      if (isTouch) $('touch').classList.remove('hidden');
      else requestLock();
      break;
    case 'err': $('err').textContent = m.msg; break;
    case 'r':
      roster.clear();
      for (const p of m.l) roster.set(p.i, p);
      if (!$('scoreboard').classList.contains('hidden')) renderScores();
      break;
    case 'pong': ping = performance.now() - m.c; break;
    case 's': onState(m); break;
  }
}

function myStats() {
  if (!you || !you.g) return S.computeStats(loadout.primary, loadout.atts);
  const g = you.g[you.slot];
  return S.computeStats(g[0], g[1]);
}

function onState(m) {
  const now = performance.now();
  const map = new Map();
  for (const p of m.p) map.set(p.i, p);
  snaps.push({ t: now, p: map });
  while (snaps.length > 30) snaps.shift();
  nadeState = m.n;
  match.sc = m.sc; match.tl = m.tl; match.rs = m.rs;
  if (match.st === 'ended' && m.st === 'playing') { match.winner = null; killfeed.length = 0; }
  match.st = m.st;
  you = m.you;
  if (you) {
    pending = pending.filter((i) => i[0] > you.seq);
    let x = you.x, y = you.y;
    if (you.alive) {
      const st = myStats();
      for (const i of pending) {
        const r = S.applyMove(x, y, i[2], i[3], i[1], S.moveSpeed(st, !!(i[4] & 1), !!(i[4] & 2), !!(i[4] & 4)));
        x = r[0]; y = r[1];
      }
    }
    if (!wasAlive && you.alive) { yaw = Math.atan2(S.MAP_H / 2 - y, S.MAP_W / 2 - x); pitch = 0; crouchOn = false; deathPos = null; }
    if (wasAlive && !you.alive) deathPos = { x: pred.x, y: pred.y, yaw };
    wasAlive = you.alive;
    pred.x = x; pred.y = y;
    if (you.slot !== lastSlot) { vmSwap = 1; lastSlot = you.slot; }
  }
  for (const e of m.ev) handleEvent(e, now);
}

const nameOf = (id) => { const r = roster.get(id); return r ? r.n : '?'; };
const teamOf = (id) => { const r = roster.get(id); return r ? r.t : 'allies'; };

function handleEvent(e, now) {
  switch (e.e) {
    case 's': {
      const isMe = e.i === myId;
      const dx = Math.cos(e.a) * Math.cos(e.q), dy = Math.sin(e.a) * Math.cos(e.q), dh = Math.sin(e.q);
      let ox = e.x, oy = e.y, oh = e.z;
      const end = new THREE.Vector3(ox + dx * e.d, oh + dh * e.d, oy + dy * e.d);
      let start;
      if (isMe) {
        start = vmMuzzleWorld();
        if (e.p === 0) {
          const st = myStats();
          let k = st.recoil * (0.8 + Math.random() * 0.4);
          if (st.bipod && adsT > 0.5 && (!movingNow || crouchOn)) k *= 0.3;
          if (crouchOn) k *= 0.8;
          pitch = Math.min(1.45, pitch + k);
          yaw += (Math.random() - 0.5) * k * 0.6;
          recoilDebt += k * 0.55;
          vmKick = Math.min(1.5, vmKick + 0.6 + k * 6);
          vmFlash = now;
          shake = Math.max(shake, k * 30);
        }
      } else {
        start = new THREE.Vector3(ox + Math.cos(e.a) * 26, oh - 9, oy + Math.sin(e.a) * 26);
        if (e.p === 0 && !e.s) { const sm = soldiers.get(e.i); if (sm) sm.flash.userData.t = now; }
      }
      if (e.p === 0) playShot(e.w, e.x, e.y, e.u);
      if (Math.random() < (isMe ? 0.5 : 0.8)) spawnTracer(start, end, e.u);
      if (e.k) burst(end, 'blood', 5, 60); else { burst(end, 'dust', 4, 50); burst(end, 'spark', 2, 120); }
      break;
    }
    case 'h':
      if (e.b === myId && e.i !== myId) { hitMarker = now; hitKill = false; tone(e.hs ? 2400 : 1800, 0.05, 0.08, 'triangle'); }
      if (e.i === myId) {
        hurtFlash = now; shake = Math.max(shake, 3);
        const src = snaps.length ? snaps[snaps.length - 1].p.get(e.b) : null;
        if (src && e.b !== myId) hurtDirs.push({ x: src.x, y: src.y, t: now });
      }
      break;
    case 'k':
      killfeed.push({ k: e.k, v: e.v, w: e.w, hs: e.hs, t: now });
      while (killfeed.length > 5) killfeed.shift();
      if (e.k === myId && e.v !== myId) {
        hitMarker = now; hitKill = true;
        centerMsg = { text: (e.hs ? 'HEADSHOT\n' : '+1 KILL\n') + nameOf(e.v), t: now };
        tone(880, 0.12, 0.08, 'triangle');
      }
      break;
    case 'x':
      spawnExplosion(e.x, e.z || 5, e.y, now);
      noise(500, 0.9, volAt(e.x, e.y) * 0.9);
      shake = Math.max(shake, 14 * volAt(e.x, e.y));
      break;
    case 'm':
      if (e.i === myId) vmMelee = now;
      noise(4000, 0.06, 0.15);
      break;
    case 'n': tone(300, 0.05, 0.05, 'sine'); break;
    case 'rg': noise(700, 0.35, volAt(pred.x, pred.y) * 0.5); if (e.i === myId) vmKick = 1.5; break;
    case 'end': match.winner = e.w; break;
  }
}

// ================================================================= THREE
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
renderer.autoClear = false;
renderer.shadowMap.enabled = !isTouch;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const FOG = 0xb4ae98;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.Fog(FOG, 600, 3200);
const camera = new THREE.PerspectiveCamera(75, 1, 1, 6000);
camera.rotation.order = 'YXZ';
scene.add(camera);

const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(55, 1, 0.5, 300);
vmScene.add(new THREE.HemisphereLight(0xe8e4d8, 0x4a4030, 1.6));
const vmSun = new THREE.DirectionalLight(0xfff0d8, 1.6); vmSun.position.set(0.4, 1, 0.3); vmScene.add(vmSun);

scene.add(new THREE.HemisphereLight(0xcfd6db, 0x5a5034, 1.25));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.0);
sun.position.set(S.MAP_W / 2 - 900, 1400, S.MAP_H / 2 - 500);
sun.target.position.set(S.MAP_W / 2, 0, S.MAP_H / 2);
if (renderer.shadowMap.enabled) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -1600; sc.right = 1600; sc.top = 1300; sc.bottom = -1300; sc.near = 100; sc.far = 3500;
  sun.shadow.bias = -0.0008;
}
scene.add(sun); scene.add(sun.target);

let W = 0, H = 0, odpr = 1;
function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  vmCamera.aspect = W / H; vmCamera.updateProjectionMatrix();
  odpr = Math.min(devicePixelRatio || 1, 2);
  ov.width = Math.round(W * odpr); ov.height = Math.round(H * odpr);
}
addEventListener('resize', resize); resize();

// ------------------------------------------------------------- textures
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function canvasTex(size, draw, rx, ry) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx || 1, ry || 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const texGround = canvasTex(256, (g, n) => {
  const r = rng(7);
  g.fillStyle = '#6a6440'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) {
    const v = r();
    g.fillStyle = v < 0.3 ? 'rgba(80,70,40,.45)' : v < 0.6 ? 'rgba(120,115,70,.4)' : v < 0.85 ? 'rgba(70,72,40,.45)' : 'rgba(140,130,100,.4)';
    g.fillRect(r() * n, r() * n, 1 + r() * 4, 1 + r() * 4);
  }
}, 40, 28);
const texBrick = canvasTex(128, (g, n) => {
  g.fillStyle = '#857a68'; g.fillRect(0, 0, n, n);
  const r = rng(3);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * 32 + (row % 2) * 16, y = row * 16;
      const c = 110 + r() * 40;
      g.fillStyle = `rgb(${c},${c * 0.9},${c * 0.78})`; g.fillRect(x + 1, y + 1, 30, 14);
      g.fillRect(x - 127, y + 1, 30, 14);
    }
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(40,30,20,.25)'; g.fillRect(r() * n, r() * n, 2, 2); }
});
const texWood = canvasTex(128, (g, n) => {
  g.fillStyle = '#8a6234'; g.fillRect(0, 0, n, n);
  const r = rng(11);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#7d5730' : '#916838'; g.fillRect(0, i * 32 + 1, n, 30); }
  for (let i = 0; i < 160; i++) { g.strokeStyle = 'rgba(60,40,20,.35)'; g.beginPath(); const y = r() * n; g.moveTo(0, y); g.lineTo(n, y + (r() - 0.5) * 6); g.stroke(); }
  g.strokeStyle = '#4e3418'; g.lineWidth = 8; g.strokeRect(4, 4, n - 8, n - 8);
  g.beginPath(); g.moveTo(8, 8); g.lineTo(n - 8, n - 8); g.stroke();
});
const texConcrete = canvasTex(128, (g, n) => {
  g.fillStyle = '#8c887c'; g.fillRect(0, 0, n, n);
  const r = rng(5);
  for (let i = 0; i < 900; i++) { const c = 100 + r() * 70; g.fillStyle = `rgba(${c},${c},${c * 0.95},.35)`; g.fillRect(r() * n, r() * n, 2 + r() * 3, 2 + r() * 3); }
  g.fillStyle = 'rgba(50,45,40,.3)'; g.fillRect(0, n - 10, n, 10);
});
const texBag = canvasTex(64, (g, n) => {
  g.fillStyle = '#b09a6b'; g.fillRect(0, 0, n, n);
  const r = rng(9);
  for (let i = 0; i < 300; i++) { g.fillStyle = r() < 0.5 ? 'rgba(120,100,60,.4)' : 'rgba(200,185,140,.3)'; g.fillRect(r() * n, r() * n, 2, 2); }
});

// ------------------------------------------------------------- world
const M = {
  ground: new THREE.MeshLambertMaterial({ map: texGround }),
  bag: new THREE.MeshLambertMaterial({ map: texBag }),
  metal: new THREE.MeshStandardMaterial({ color: 0x2a2b2c, metalness: 0.7, roughness: 0.45 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x18191a, metalness: 0.5, roughness: 0.6 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6e4524, metalness: 0, roughness: 0.7 }),
  wood2: new THREE.MeshStandardMaterial({ color: 0x8c5a2c, metalness: 0, roughness: 0.65 }),
  blade: new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.95, roughness: 0.2 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x223355, metalness: 0.2, roughness: 0.05, emissive: 0x0a1020 }),
  tape: new THREE.MeshStandardMaterial({ color: 0x3c3b2e, roughness: 0.9 }),
  strap: new THREE.MeshStandardMaterial({ color: 0x4c3a22, roughness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0x9a7a30, metalness: 0.8, roughness: 0.35 }),
  nade: new THREE.MeshStandardMaterial({ color: 0x38452a, roughness: 0.7 }),
  skin: new THREE.MeshLambertMaterial({ color: 0xc99d78 }),
};
function wallMat(tex, w, h) { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w, h); return new THREE.MeshLambertMaterial({ map: t }); }

(function buildWorld() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S.MAP_W + 3000, S.MAP_H + 3000), M.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.set(S.MAP_W / 2, 0, S.MAP_H / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  // craters
  const r = rng(42);
  const craterMat = new THREE.MeshLambertMaterial({ color: 0x3b3524, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 40; i++) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(20 + r() * 40, 18), craterMat);
    c.rotation.x = -Math.PI / 2; c.position.set(r() * S.MAP_W, 0.3 + i * 0.01, r() * S.MAP_H); c.receiveShadow = true;
    scene.add(c);
  }
  // walls, crates
  let bagCount = 0;
  const bags = [];
  for (const w of S.WALLS) {
    if (w.k === 'sand') {
      const horiz = w.w >= w.h;
      const len = horiz ? w.w : w.h, dep = horiz ? w.h : w.w;
      const n = Math.max(1, Math.round(len / 24)), rows = Math.round(w.ht / 11.5), cols = Math.max(1, Math.round(dep / 17));
      for (let ry = 0; ry < rows; ry++) for (let c = 0; c < cols; c++) for (let i = 0; i < n; i++) {
        const along = (i + 0.5 + (ry % 2 ? 0.25 : -0.25)) * (len / n);
        if (along > len) continue;
        const across = (c + 0.5) * (dep / cols);
        bags.push({ x: horiz ? w.x + along : w.x + across, z: horiz ? w.y + across : w.y + along, y: 5.8 + ry * 11, rot: horiz ? 0 : Math.PI / 2, sx: len / n / 2 + 1.5, sz: dep / cols / 2 + 1 });
        bagCount++;
      }
      continue;
    }
    const mat = w.k === 'wall' ? wallMat(texBrick, Math.max(w.w, w.h) / 64, w.ht / 64) : wallMat(texWood, Math.max(1, Math.round(Math.max(w.w, w.h) / 50)), Math.max(1, Math.round(w.ht / 50)));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.ht, w.h), mat);
    m.position.set(w.x + w.w / 2, w.ht / 2, w.y + w.h / 2);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    if (w.k === 'wall') { // broken top
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w.w + 4, 6, w.h + 4), wallMat(texConcrete, 2, 0.2));
      cap.position.set(w.x + w.w / 2, w.ht + 3, w.y + w.h / 2); cap.castShadow = true; scene.add(cap);
    }
  }
  const bagGeo = new THREE.SphereGeometry(1, 10, 6);
  const inst = new THREE.InstancedMesh(bagGeo, M.bag, bagCount);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  bags.forEach((b, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot + (r() - 0.5) * 0.1);
    sc.set(b.sx, 6.3, b.sz); pos.set(b.x, b.y, b.z);
    mtx.compose(pos, q, sc); inst.setMatrixAt(i, mtx);
  });
  inst.castShadow = inst.receiveShadow = true;
  scene.add(inst);
  // perimeter
  const per = 180;
  for (const [x, z, w, d] of [[S.MAP_W / 2, -20, S.MAP_W + 80, 40], [S.MAP_W / 2, S.MAP_H + 20, S.MAP_W + 80, 40], [-20, S.MAP_H / 2, 40, S.MAP_H], [S.MAP_W + 20, S.MAP_H / 2, 40, S.MAP_H]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, per, d), wallMat(texConcrete, Math.max(w, d) / 128, per / 128));
    m.position.set(x, per / 2, z); m.receiveShadow = true; scene.add(m);
  }
  // spawn flags
  for (const [x, col] of [[60, 0x3d6fb0], [S.MAP_W - 60, 0xb03a30]]) {
    for (const z of [300, 1300]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 160, 6), M.metal); pole.position.set(x, 80, z); scene.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(50, 30), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }));
      flag.position.set(x + (x < 100 ? 25 : -25), 140, z); scene.add(flag);
    }
  }
})();

// ============================================================ gun models
const GUNSPEC = {
  thompson: { rec: 13, recH: 3.6, bar: 11, barR: 0.9, fins: true, stock: 'wood', stockL: 13, mag: 'stick', magL: 9, magX: 6, fore: 'wood', foreL: 6 },
  mp40: { rec: 12, recH: 3, bar: 10, barR: 0.7, stock: 'wire', stockL: 12, mag: 'stick', magL: 12, magX: 5 },
  ppsh41: { rec: 11, recH: 3.4, bar: 9, barR: 1.4, shroud: true, stock: 'wood', stockL: 15, mag: 'stick', magL: 9, magX: 5, curve: 0.25 },
  type100: { rec: 12, recH: 3, bar: 10, barR: 1.0, shroud: true, stock: 'wood', stockL: 14, mag: 'side', magL: 9, magX: 5 },
  stg44: { rec: 15, recH: 3.6, bar: 10, barR: 0.7, stock: 'wood', stockL: 12, mag: 'stick', magL: 11, magX: 6, curve: 0.3, fore: 'metal', foreL: 6 },
  bar: { rec: 16, recH: 3.6, bar: 16, barR: 0.8, stock: 'wood', stockL: 14, mag: 'box', magL: 6, magX: 7, fore: 'wood', foreL: 8 },
  garand: { rec: 12, recH: 3, bar: 17, barR: 0.7, stock: 'full', stockL: 14, mag: 'none', fore: 'wood', foreL: 14 },
  gewehr43: { rec: 12, recH: 3, bar: 16, barR: 0.7, stock: 'full', stockL: 14, mag: 'box', magL: 5, magX: 6, fore: 'wood', foreL: 12 },
  svt40: { rec: 12, recH: 3, bar: 17, barR: 0.7, stock: 'full', stockL: 14, mag: 'box', magL: 5, magX: 6, fore: 'wood', foreL: 11 },
  m1carbine: { rec: 10, recH: 2.8, bar: 12, barR: 0.6, stock: 'full', stockL: 13, mag: 'box', magL: 6, magX: 5, fore: 'wood', foreL: 9 },
  kar98k: { rec: 12, recH: 2.8, bar: 20, barR: 0.6, stock: 'full', stockL: 15, mag: 'none', bolt: true, fore: 'wood', foreL: 17 },
  springfield: { rec: 12, recH: 2.8, bar: 20, barR: 0.6, stock: 'full', stockL: 15, mag: 'none', bolt: true, fore: 'wood', foreL: 17 },
  mosin: { rec: 12, recH: 2.8, bar: 23, barR: 0.6, stock: 'full', stockL: 15, mag: 'box', magL: 3, magX: 5, bolt: true, fore: 'wood', foreL: 20 },
  arisaka: { rec: 12, recH: 2.8, bar: 21, barR: 0.6, stock: 'full', stockL: 15, mag: 'none', bolt: true, fore: 'wood', foreL: 18 },
  trenchgun: { rec: 10, recH: 3.4, bar: 18, barR: 0.8, stock: 'wood', stockL: 14, mag: 'none', tube: true, pump: true, shroud: true },
  doublebarrel: { rec: 8, recH: 3, bar: 18, barR: 0.8, double: true, stock: 'wood', stockL: 14, mag: 'none', fore: 'wood', foreL: 8 },
  mg42: { rec: 18, recH: 4, bar: 12, barR: 1.6, shroud: true, stock: 'metal', stockL: 12, mag: 'belt', magX: 4 },
  dp28: { rec: 14, recH: 3.4, bar: 16, barR: 1.0, fins: true, stock: 'wood', stockL: 13, mag: 'pan', magX: 6 },
  type99: { rec: 14, recH: 3.6, bar: 14, barR: 0.9, fins: true, stock: 'wood', stockL: 13, mag: 'top', magL: 8, magX: 6 },
  revolver: { pistol: true, revolver: true },
};
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function cylX(r, len, mat, x0, y, z, r2) { // cylinder along +X starting at x0
  const g = new THREE.CylinderGeometry(r2 == null ? r : r2, r, len, 10); g.rotateZ(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.set(x0 + len / 2, y, z); return m;
}
function limb(a, b, t, mat) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), mat);
  m.position.copy(a).lerp(b, 0.5); m.lookAt(b);
  return m;
}

function makeGun(id, atts) {
  atts = atts || [];
  const w = S.WEAPONS[id] || S.WEAPONS.thompson;
  const sp = GUNSPEC[id] || (w.secondary ? { pistol: true } : GUNSPEC.thompson);
  const g = new THREE.Group();
  const has = (a) => atts.includes(a);
  let muzzleX, barY, top, sightH, leftHand;
  if (sp.pistol) {
    top = 2.8; barY = 1.8;
    if (sp.revolver) {
      g.add(box(4, 2.6, 1.6, M.metal, 1.5, 1.6, 0));
      g.add(cylX(1.5, 3, M.metal, 0.5, 1.4, 0));
      g.add(cylX(0.5, 6.5, M.metal, 3.5, 2.2, 0));
      muzzleX = 10;
    } else {
      g.add(box(9, 2.2, 1.5, M.metal, 2.8, 1.8, 0));
      g.add(box(7, 1.2, 1.3, M.dark, 2.2, 0.5, 0));
      muzzleX = 7.3;
    }
    const grip = box(2.2, 5.5, 1.5, M.wood, -0.2, -1.8, 0); grip.rotation.z = 0.25; g.add(grip);
    if (has('extmag')) g.add(box(1.4, 2.5, 1.1, M.dark, -0.9, -5.4, 0));
    if (has('dualmag')) { g.add(box(1.4, 4, 1.1, M.dark, -1.5, -3.5, -1.4)); }
    g.add(box(0.4, 0.8, 0.4, M.dark, muzzleX - 0.8, top - 0.4, 0));
    sightH = top;
    leftHand = new THREE.Vector3(-0.2, -2.5, -1.4);
  } else {
    const recH = sp.recH, rec = sp.rec;
    top = 1.5 + recH / 2;
    barY = 1.5 + recH * 0.15;
    const x0 = -2 + rec;
    g.add(box(rec, recH, 2.4, M.metal, -2 + rec / 2, 1.5, 0));
    const grip = box(2, 5, 1.6, sp.stock === 'full' ? M.wood : M.wood2, 0, -1.6, 0); grip.rotation.z = 0.3; g.add(grip);
    // barrel
    if (sp.double) { g.add(cylX(sp.barR, sp.bar, M.metal, x0, barY, 0.8)); g.add(cylX(sp.barR, sp.bar, M.metal, x0, barY, -0.8)); }
    else g.add(cylX(sp.shroud ? sp.barR : sp.barR, sp.bar, sp.shroud ? M.dark : M.metal, x0, barY, 0));
    if (sp.shroud) g.add(cylX(0.45, sp.bar + 1.2, M.metal, x0, barY, 0));
    if (sp.fins) for (let i = 0; i < 6; i++) g.add(cylX(sp.barR + 0.5, 0.4, M.dark, x0 + 1 + i * 1.2, barY, 0));
    // stock
    if (sp.stock === 'wood' || sp.stock === 'full') {
      const st = box(sp.stockL, 4, 2.1, M.wood, -2 - sp.stockL / 2, 0.4, 0); st.rotation.z = 0.08; g.add(st);
      g.add(box(0.8, 4.6, 2.3, M.dark, -2 - sp.stockL, 0.0, 0));
    } else if (sp.stock === 'wire') {
      g.add(box(sp.stockL, 0.5, 0.5, M.metal, -2 - sp.stockL / 2, 2.2, 0.8));
      g.add(box(sp.stockL, 0.5, 0.5, M.metal, -2 - sp.stockL / 2, 0.2, 0.8));
      g.add(box(0.6, 3.5, 2.2, M.metal, -2 - sp.stockL, 1.2, 0.4));
    } else if (sp.stock === 'metal') {
      const st = box(sp.stockL, 3.6, 2, M.dark, -2 - sp.stockL / 2, 0.8, 0); st.rotation.z = 0.06; g.add(st);
    }
    // fore-end
    const foreL = sp.foreL || 0;
    if (sp.fore === 'wood' || sp.stock === 'full') g.add(box(foreL || sp.bar * 0.6, 2.2, 2.6, M.wood, x0 + (foreL || sp.bar * 0.6) / 2 - 0.5, barY - 1.2, 0));
    else if (sp.fore === 'metal') g.add(box(foreL, 2, 2.4, M.dark, x0 + foreL / 2, barY - 1, 0));
    if (sp.bolt) { g.add(cylX(0.35, 2.5, M.metal, rec * 0.5 - 2, 2.2, 1.4)); g.children[g.children.length - 1].rotation.y = -1.2; g.add(box(1, 1, 1, M.metal, rec * 0.5 - 1.6, 2.2, 2.6)); }
    if (sp.tube) g.add(cylX(0.6, sp.bar * 0.85, M.metal, x0, barY - 1.4, 0));
    if (sp.pump) g.add(cylX(1.2, 6, M.wood, x0 + 2, barY - 1.4, 0));
    // magazine
    const magBottom = 1.5 - recH / 2;
    const addMag = (zoff) => {
      let L = sp.magL || 6;
      if (has('extmag')) L *= 1.5;
      if (sp.mag === 'stick' || sp.mag === 'box') {
        const m = box(sp.mag === 'box' ? 4 : 2.2, L, 1.6, M.dark, sp.magX, magBottom - L / 2, zoff);
        if (sp.curve) { m.geometry.translate(0, -L / 2, 0); m.position.y = magBottom; m.rotation.z = sp.curve; }
        g.add(m);
      } else if (sp.mag === 'side') {
        g.add(box(2.2, 1.6, L, M.dark, sp.magX, 1.5, -1.2 - L / 2));
      } else if (sp.mag === 'top') {
        const m = box(2.2, L, 1.6, M.dark, sp.magX, top + L / 2, 1.0 + zoff); m.rotation.z = -0.3; g.add(m);
      }
    };
    if (has('drum')) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 2.8, 16), M.dark); d.rotation.x = Math.PI / 2;
      if (sp.mag === 'belt') d.position.set(sp.magX, 0, -4); else d.position.set(sp.magX, magBottom - 4.4, 0);
      g.add(d);
    } else if (sp.mag === 'pan') {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 1.2, 18), M.dark); d.position.set(sp.magX, top + 1, 0); g.add(d);
      if (has('extmag')) { const d2 = d.clone(); d2.position.y += 1.2; g.add(d2); }
    } else if (sp.mag === 'belt') {
      g.add(box(5, has('extmag') ? 7 : 5, 4, M.nade, sp.magX, -1, -4.5));
      for (let i = 0; i < 5; i++) g.add(box(0.6, 0.4, 1.2, M.brass, sp.magX - 2 + i, 2, -2.4));
    } else if (sp.mag !== 'none') {
      addMag(0);
      if (has('dualmag')) { addMag(1.8); g.add(box(sp.mag === 'box' ? 4.2 : 2.4, 1.2, 3.6, M.tape, sp.magX, magBottom - 2.5, 0.9)); }
    }
    muzzleX = x0 + sp.bar;
    // iron sights
    g.add(box(0.4, 1.6, 0.4, M.dark, muzzleX - 1, barY + sp.barR + 0.8, 0));
    g.add(box(0.6, 1, 1.6, M.dark, -0.5, top + 0.5, 0));
    sightH = Math.max(top + 0.9, barY + sp.barR + 1.5);
    leftHand = new THREE.Vector3(x0 + Math.min(sp.bar * 0.35, 7), barY - 2.2, -0.6);
    // ---- attachments
    if (has('grip')) { g.add(box(1.8, 5, 1.8, M.wood2, x0 + Math.min(sp.bar * 0.3, 6), barY - 4.2, 0)); leftHand.set(x0 + Math.min(sp.bar * 0.3, 6), barY - 5.5, -0.6); }
    if (has('bipod')) {
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 10, 0.45), M.metal);
        leg.geometry.translate(0, -5, 0);
        leg.position.set(x0 + sp.bar * 0.75, barY - 0.6, 0); leg.rotation.set(s * 0.35, 0, 0.45); g.add(leg);
      }
    }
    if (has('bayonet')) {
      g.add(box(2.5, 1.4, 1.2, M.dark, muzzleX - 2.5, barY - 1.4, 0));
      g.add(box(13, 1.1, 0.3, M.blade, muzzleX + 4.5, barY - 1.4, 0));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 4), M.blade); tip.rotation.z = -Math.PI / 2; tip.position.set(muzzleX + 12.1, barY - 1.4, 0); g.add(tip);
    }
    if (has('sling')) {
      const a = new THREE.Vector3(-2 - (sp.stockL || 8) * 0.8, -2.2, 1.3), b = new THREE.Vector3(x0 + sp.bar * 0.5, barY - 1.5, 1.3), mid = new THREE.Vector3((a.x + b.x) / 2, -6, 1.6);
      g.add(limb(a, mid, 0.35, M.strap)); g.add(limb(mid, b, 0.35, M.strap));
    }
    if (has('scope')) {
      const sy = top + 2.6, sx = -1;
      g.add(cylX(1.1, 12, M.dark, sx, sy, 0));
      g.add(cylX(1.6, 2.5, M.dark, sx + 12, sy, 0, 1.1));
      g.add(cylX(1.1, 2, M.dark, sx - 2, sy, 0, 1.5));
      g.add(box(1.2, 2, 1, M.metal, sx + 2.5, top + 1, 0)); g.add(box(1.2, 2, 1, M.metal, sx + 9, top + 1, 0));
      const lens = new THREE.Mesh(new THREE.CircleGeometry(1.4, 12), M.glass); lens.rotation.y = Math.PI / 2; lens.position.set(sx + 14.55, sy, 0); g.add(lens);
      sightH = sy;
    } else if (has('aperture')) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.28, 6, 12), M.dark); ring.rotation.y = Math.PI / 2; ring.position.set(-1, top + 1.3, 0); g.add(ring);
      sightH = Math.max(sightH, top + 1.3);
    }
  }
  // muzzle devices
  if (has('suppressor')) { g.add(cylX(sp.pistol ? 1.0 : 1.3, sp.pistol ? 7 : 10, M.dark, muzzleX, barY, 0)); muzzleX += sp.pistol ? 7 : 10; }
  if (has('flashhider')) { g.add(cylX(0.65, 3, M.dark, muzzleX, barY, 0, 1.15)); muzzleX += 3; }
  if (has('riflenade')) {
    g.add(cylX(1.25, 3.5, M.metal, muzzleX, barY, 0)); muzzleX += 3.5;
    g.add(cylX(1.4, 4.5, M.nade, muzzleX, barY, 0)); g.add(cylX(0.5, 3, M.nade, muzzleX + 4.5, barY, 0, 1.4));
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, muzzle: new THREE.Vector3(muzzleX, barY, 0), sightH, leftHand, scope: has('scope') };
}

// muzzle flash sprite
const flashTex = canvasTex(64, (g, n) => {
  const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.3, 'rgba(255,200,80,.9)'); gr.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
});
function makeFlash(size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.set(size, size, 1); s.visible = false;
  return s;
}

// ============================================================ viewmodel
let vm = null; // {key, holder, gun, flash}
let adsT = 0, vmKick = 0, vmSwap = 0, vmFlash = 0, vmMelee = 0, bobPhase = 0, movingNow = false, crouchOn = false, crouchT = 0;
const VM_HIP = new THREE.Vector3(6.5, -7.2, -15.5);
function sleeveMat(team) { return new THREE.MeshLambertMaterial({ color: team === 'axis' ? 0x5c6366 : 0x6b7140 }); }
function buildViewmodel(id, atts, team) {
  const key = id + ':' + atts.join(',') + ':' + team;
  if (vm && vm.key === key) return;
  if (vm) vmScene.remove(vm.holder);
  const gun = makeGun(id, atts);
  const holder = new THREE.Group();
  gun.group.rotation.y = Math.PI / 2;
  holder.add(gun.group);
  const sleeve = sleeveMat(team);
  // right hand on the grip, left hand forward
  gun.group.add(box(3, 3.2, 2.6, M.skin, 0, -1.8, 0.4));
  gun.group.add(limb(new THREE.Vector3(-1, -3, 1.2), new THREE.Vector3(-13, -10, 8), 3.4, sleeve));
  const lh = gun.leftHand;
  gun.group.add(box(3, 2.6, 2.8, M.skin, lh.x, lh.y, lh.z));
  gun.group.add(limb(new THREE.Vector3(lh.x - 1, lh.y - 1, lh.z - 0.5), new THREE.Vector3(lh.x - 10, lh.y - 11, -9), 3.4, sleeve));
  const flash = makeFlash(9);
  flash.position.copy(gun.muzzle).add(new THREE.Vector3(2.5, 0, 0));
  gun.group.add(flash);
  vmScene.add(holder);
  vm = { key, holder, gun, flash };
}
function vmMuzzleWorld() {
  // approximate world-space muzzle position for tracers
  const eyeH = S.eyeHeight(crouchOn);
  const f = new THREE.Vector3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
  const right = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
  const p = new THREE.Vector3(pred.x, eyeH, pred.y).addScaledVector(f, 28);
  p.addScaledVector(right, 5 * (1 - adsT)).y -= 4 * (1 - adsT) + 1.5;
  return p;
}

// ============================================================== soldiers
const soldiers = new Map(); // id -> model
const UNIFORM = { allies: 0x6b7140, axis: 0x5f666a };
function nameSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48;
  const g = c.getContext('2d');
  g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(text, 128, 24);
  g.fillStyle = color; g.fillText(text, 128, 24);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(48, 9, 1); s.renderOrder = 10;
  return s;
}
function makeSoldier(id, team) {
  const root = new THREE.Group();
  const uni = new THREE.MeshLambertMaterial({ color: UNIFORM[team] });
  const dark = new THREE.MeshLambertMaterial({ color: team === 'axis' ? 0x3d4244 : 0x4a4e2a });
  const boot = new THREE.MeshLambertMaterial({ color: 0x2a2018 });
  const band = new THREE.MeshLambertMaterial({ color: team === 'axis' ? 0xc0392b : 0x3d7bd0 });
  const mkLeg = (z) => {
    const g = new THREE.Group(); g.position.set(0, 34, z);
    const l = box(7, 30, 7, uni, 0, -15, 0); g.add(l);
    g.add(box(9, 5, 7.5, boot, 1.2, -32, 0));
    return g;
  };
  const legL = mkLeg(-4.5), legR = mkLeg(4.5);
  root.add(legL, legR);
  const upper = new THREE.Group(); root.add(upper);
  upper.add(box(10, 25, 17, uni, 0, 46, 0));
  upper.add(box(11, 3, 18, boot, 0, 35, 0)); // belt
  upper.add(box(4, 5, 4, M.skin, 0, 59.5, 0)); // neck
  const head = new THREE.Mesh(new THREE.SphereGeometry(5.6, 12, 10), M.skin); head.position.set(0.5, 64, 0); upper.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(7.2, 14, 8, 0, TAU, 0, Math.PI / 2), dark); helmet.position.set(0, 65.5, 0); upper.add(helmet);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(team === 'axis' ? 7.6 : 8.4, team === 'axis' ? 8.6 : 8.4, 1, 14), dark); brim.position.set(0, team === 'axis' ? 64.5 : 65.6, 0); upper.add(brim);
  upper.add(box(4, 3.5, 2, band, 0, 50, -9.5)); // armband (left)
  upper.add(box(4, 3.5, 2, band, 0, 50, 9.5));
  const pack = box(5, 14, 12, boot, -7, 48, 0); upper.add(pack);
  // gun holder (pitches with aim)
  const holder = new THREE.Group(); holder.position.set(6, 52, 3); upper.add(holder);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  const flash = makeFlash(14);
  scene.add(root);
  return { root, legL, legR, upper, holder, uniMat: uni, gunKey: '', gun: null, flash, team, tag: null, tagName: '', walk: 0, lastX: 0, lastY: 0, deadAt: 0, flashAt: 0 };
}
function setSoldierGun(s, key) {
  if (s.gunKey === key) return;
  if (s.gun) s.holder.remove(s.gun.group);
  const [id, a] = key.split(':');
  const gun = makeGun(id, a ? a.split(',') : []);
  s.holder.add(gun.group);
  // arms
  const sleeve = s.uniMat;
  const lh = gun.leftHand;
  gun.group.add(limb(new THREE.Vector3(-8, 4, 4), new THREE.Vector3(0, -1.5, 0.8), 4, sleeve));
  gun.group.add(limb(new THREE.Vector3(-8, 4, -10), new THREE.Vector3(lh.x, lh.y, lh.z), 4, sleeve));
  gun.group.add(box(3, 3, 3, M.skin, lh.x, lh.y, lh.z));
  s.flash.position.copy(gun.muzzle).add(new THREE.Vector3(3, 0, 0));
  gun.group.add(s.flash);
  s.gun = gun; s.gunKey = key;
}
function removeSoldier(id) { const s = soldiers.get(id); if (!s) return; scene.remove(s.root); soldiers.delete(id); }

// ================================================================ effects
const tracers = [];
const tracerGeo = new THREE.BoxGeometry(1, 1, 1);
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const tracerMatFaint = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.25, depthWrite: false });
function spawnTracer(a, b, faint) {
  const len = a.distanceTo(b);
  if (len < 30) return;
  const m = new THREE.Mesh(tracerGeo, faint ? tracerMatFaint : tracerMat);
  m.scale.set(0.5, 0.5, Math.min(70, len * 0.4));
  m.position.copy(a); m.lookAt(b);
  scene.add(m);
  tracers.push({ m, a: a.clone(), b: b.clone(), len, t: performance.now() });
}
const particles = [];
const partGeo = new THREE.BoxGeometry(1, 1, 1);
const PMAT = {
  dust: new THREE.MeshLambertMaterial({ color: 0x9c9078 }),
  blood: new THREE.MeshBasicMaterial({ color: 0x8a1010 }),
  spark: new THREE.MeshBasicMaterial({ color: 0xffd060 }),
  smoke: new THREE.MeshLambertMaterial({ color: 0x4a4540, transparent: true, opacity: 0.6, depthWrite: false }),
  fire: new THREE.MeshBasicMaterial({ color: 0xff9a30 }),
};
function burst(pos, kind, n, speed) {
  for (let i = 0; i < n && particles.length < 260; i++) {
    const m = new THREE.Mesh(partGeo, PMAT[kind]);
    const s = kind === 'smoke' ? 12 + Math.random() * 10 : kind === 'spark' ? 0.6 : 1.2 + Math.random() * 1.5;
    m.scale.setScalar(s);
    m.position.copy(pos);
    scene.add(m);
    particles.push({ m, s, vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed * (kind === 'smoke' ? 0.3 : 0.8), vz: (Math.random() - 0.5) * speed,
      t: performance.now(), life: kind === 'smoke' ? 1800 : kind === 'spark' ? 200 : 600, g: kind === 'smoke' ? -10 : kind === 'spark' ? 0 : 300, grow: kind === 'smoke' });
  }
}
const explosions = [];
const boomLight = new THREE.PointLight(0xffa040, 0, 500, 1.5); scene.add(boomLight);
function spawnExplosion(x, h, y, now) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.9, depthWrite: false }));
  m.position.set(x, h + 10, y); scene.add(m);
  explosions.push({ m, t: now });
  boomLight.position.set(x, h + 40, y); boomLight.intensity = 4e5; boomLight.userData.t = now;
  const p = new THREE.Vector3(x, h + 8, y);
  burst(p, 'fire', 14, 400); burst(p, 'dust', 20, 350); burst(p, 'smoke', 10, 120);
}
const nadeMeshes = [];
function nadeMesh(i, kind) {
  if (!nadeMeshes[i]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 4.5, 8), M.nade));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 6), M.metal); cap.position.y = 3; g.add(cap);
    scene.add(g); nadeMeshes[i] = g;
  }
  return nadeMeshes[i];
}

// ================================================================== input
const keys = {};
let mouseDown = false, mouseRight = false, locked = false;
let adsToggle = false, fireBtns = new Set();
let moveStick = null;
const lookPointers = new Map();
const STICK_R = 60;

const inGame = () => joined && $('loadoutScreen').classList.contains('hidden') && $('pause').classList.contains('hidden');
function requestLock() { if (!isTouch && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } } }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && joined && !isTouch && $('loadoutScreen').classList.contains('hidden')) $('pause').classList.remove('hidden');
  if (locked) $('pause').classList.add('hidden');
  mouseDown = mouseRight = false;
});
$('resume').addEventListener('click', () => { $('pause').classList.add('hidden'); requestLock(); });
$('pauseLoadout').addEventListener('click', () => { $('pause').classList.add('hidden'); toggleLoadout(true); });

addEventListener('keydown', (e) => {
  if (!joined) return;
  if (e.code === 'Tab') { e.preventDefault(); toggleScores(true); return; }
  if (e.code === 'KeyL') { toggleLoadout(); return; }
  if (!inGame()) return;
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'KeyR') send({ t: 'reload' });
  if (e.code === 'KeyQ' || (e.code === 'Digit1' && you && you.slot === 1) || (e.code === 'Digit2' && you && you.slot === 0)) send({ t: 'swap' });
  if (e.code === 'KeyG') send({ t: 'nade' });
  if (e.code === 'KeyV' || e.code === 'KeyF') send({ t: 'melee' });
  if (e.code === 'KeyB') send({ t: 'rg' });
  if (e.code === 'KeyC') crouchOn = !crouchOn;
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Tab') toggleScores(false); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = mouseRight = false; fireBtns.clear(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', () => { if (inGame() && locked) send({ t: 'swap' }); }, { passive: true });

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (e.pointerType === 'mouse') {
    if (!locked) { if (joined && inGame()) requestLock(); return; }
    if (e.button === 0) mouseDown = true;
    if (e.button === 2) mouseRight = true;
    return;
  }
  e.preventDefault();
  if (e.clientX < innerWidth * 0.4 && !moveStick) moveStick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  else lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
addEventListener('mousemove', (e) => {
  if (!locked || !inGame()) return;
  const k = 0.0022 * sens * lookScale();
  yaw += e.movementX * k;
  pitch = S.clamp(pitch - e.movementY * k, -1.45, 1.45);
});
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') return;
  if (moveStick && moveStick.id === e.pointerId) { moveStick.x = e.clientX; moveStick.y = e.clientY; return; }
  const lp = lookPointers.get(e.pointerId);
  if (lp && inGame()) {
    const k = 0.0055 * sens * lookScale() * (assistTarget ? 0.55 : 1);
    yaw += (e.clientX - lp.x) * k;
    pitch = S.clamp(pitch - (e.clientY - lp.y) * k, -1.45, 1.45);
    lp.x = e.clientX; lp.y = e.clientY;
  }
});
function endPointer(e) {
  if (e.pointerType === 'mouse') { if (e.button === 0) mouseDown = false; if (e.button === 2) mouseRight = false; return; }
  if (moveStick && moveStick.id === e.pointerId) moveStick = null;
  lookPointers.delete(e.pointerId);
  if (fireBtns.has(e.pointerId)) { fireBtns.delete(e.pointerId); if (!fireBtns.size) { $('tFire').classList.remove('on'); $('tFire2').classList.remove('on'); } }
}
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);
function lookScale() { const st = myStats(); return adsT > 0.5 ? (st.zoom > 1 ? 0.28 : 0.65) : 1; }

function stickVec(s) {
  if (!s) return [0, 0, 0];
  let dx = (s.x - s.ox) / STICK_R, dy = (s.y - s.oy) / STICK_R;
  const m = Math.hypot(dx, dy);
  if (m > 1) { dx /= m; dy /= m; }
  return [dx, dy, Math.min(1, m)];
}
function bindBtn(id, down) {
  $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); initAudio(); down($(id), e); });
}
for (const id of ['tFire', 'tFire2']) bindBtn(id, (b, e) => { fireBtns.add(e.pointerId); lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); b.classList.add('on'); });
bindBtn('tAds', (b) => { adsToggle = !adsToggle; b.classList.toggle('on', adsToggle); });
bindBtn('tCrouch', () => { crouchOn = !crouchOn; });
bindBtn('tReload', () => send({ t: 'reload' }));
bindBtn('tSwap', () => send({ t: 'swap' }));
bindBtn('tNade', () => send({ t: 'nade' }));
bindBtn('tMelee', () => send({ t: 'melee' }));
bindBtn('tRg', () => send({ t: 'rg' }));
$('btnScores').addEventListener('click', () => toggleScores());
$('btnLoadout').addEventListener('click', () => toggleLoadout());
$('btnFull').addEventListener('click', () => goFullscreen(true));
$('scoreboard').addEventListener('click', () => toggleScores(false));

function toggleScores(force) {
  const el = $('scoreboard');
  const show = force === undefined ? el.classList.contains('hidden') : force;
  el.classList.toggle('hidden', !show);
  if (show) renderScores();
}
function renderScores() {
  const teams = { allies: [], axis: [] };
  for (const p of roster.values()) teams[p.t].push(p);
  let html = `<h2>Room ${esc(roomCode)} &mdash; Team Deathmatch (first to ${S.SCORE_LIMIT})</h2><div class="sb">`;
  for (const t of ['allies', 'axis']) {
    teams[t].sort((a, b) => b.k - a.k || a.d - b.d);
    html += `<div class="${t}"><h3>${t.toUpperCase()} ${match.sc[t === 'allies' ? 0 : 1]}</h3><table><tr><th>Soldier</th><th>K</th><th>D</th></tr>`;
    for (const p of teams[t]) html += `<tr class="${p.i === myId ? 'me' : ''}"><td>${esc(p.n)}</td><td>${p.k}</td><td>${p.d}</td></tr>`;
    html += '</table></div>';
  }
  $('scoreContent').innerHTML = html + '</div><p class="tag">' + (offlineMode ? 'Offline match' : 'Ping ' + Math.round(ping) + ' ms') + ' &middot; tap to close</p>';
}
function toggleLoadout(force) {
  const el = $('loadoutScreen');
  const show = force === undefined ? el.classList.contains('hidden') : force;
  el.classList.toggle('hidden', !show);
  if (show) { gameLoadout.render(); if (document.pointerLockElement) document.exitPointerLock(); }
  else if (joined && !isTouch) requestLock();
  fireBtns.clear(); mouseDown = false;
}
$('loadoutSave').addEventListener('click', () => { send({ t: 'loadout', loadout }); toggleLoadout(false); centerMsg = { text: 'Loadout saved\nApplies on respawn', t: performance.now() }; });
$('switchTeam').addEventListener('click', () => { send({ t: 'team' }); toggleLoadout(false); });
$('leave').addEventListener('click', () => { if (ws) ws.close(); });

function showMenu(err) {
  joined = false;
  if (document.pointerLockElement) document.exitPointerLock();
  for (const id of [...soldiers.keys()]) removeSoldier(id);
  $('menu').classList.remove('hidden');
  for (const id of ['hud', 'touch', 'loadoutScreen', 'scoreboard', 'pause']) $(id).classList.add('hidden');
  $('err').textContent = err || '';
  menuLoadout.render();
}
function goFullscreen(toggle) {
  const d = document;
  if (toggle && d.fullscreenElement) { d.exitFullscreen(); return; }
  const el = d.documentElement;
  const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
  if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
}
function deploy(offline) {
  initAudio();
  if (isTouch && !matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) goFullscreen(false);
  connect(offline);
}
$('deploy').addEventListener('click', () => deploy(false));
$('offline').addEventListener('click', () => deploy(true));
$('server').value = loadSaved('fl_server', '');
if (servedOverHttp) $('server').placeholder = 'Leave empty to use this site (' + location.host + ')';
if (!window.Sim) $('offline').classList.add('hidden');
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('deploy').click(); });

let deferredPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('install').classList.remove('hidden'); });
$('install').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('install').classList.add('hidden'); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
setInterval(() => send({ t: 'ping', c: performance.now() }), 2000);

// ======================================================== interpolation
function interpPlayers(now) {
  const rt = now - 100;
  if (!snaps.length) return new Map();
  let a = snaps[0], b = snaps[snaps.length - 1];
  for (let i = snaps.length - 1; i > 0; i--) { if (snaps[i - 1].t <= rt) { a = snaps[i - 1]; b = snaps[i]; break; } }
  const span = b.t - a.t;
  const k = span > 0 ? S.clamp((rt - a.t) / span, 0, 1) : 1;
  const out = new Map();
  for (const [id, pb] of b.p) {
    const pa = a.p.get(id);
    if (!pa || ((pa.f & 2) !== (pb.f & 2)) || Math.hypot(pa.x - pb.x, pa.y - pb.y) > 150) { out.set(id, pb); continue; }
    const da = Math.atan2(Math.sin(pb.a - pa.a), Math.cos(pb.a - pa.a));
    out.set(id, { ...pb, x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k, a: pa.a + da * k, q: pa.q + (pb.q - pa.q) * k });
  }
  return out;
}

// aim assist (touch): find an enemy close to the crosshair
let assistTarget = null;
function findAssist(players) {
  assistTarget = null;
  if (!isTouch || !you || !you.alive) return;
  const eye = S.eyeHeight(crouchOn);
  let best = 0.09 + adsT * 0.06;
  for (const [id, p] of players) {
    if (id === myId || !(p.f & 2) || (p.f & 1 ? 'axis' : 'allies') === you.team) continue;
    const ch = S.bodyHeight(!!(p.f & 64)) * 0.72;
    const dx = p.x - pred.x, dy = p.y - pred.y, d = Math.hypot(dx, dy);
    if (d > 1300 || d < 1) continue;
    const ty = Math.atan2(dy, dx), tp = Math.atan2(ch - eye, d);
    const dyaw = Math.atan2(Math.sin(ty - yaw), Math.cos(ty - yaw)), dp = tp - pitch;
    const ang = Math.hypot(dyaw, dp);
    if (ang < best && S.hasLOS3(pred.x, pred.y, eye, p.x, p.y, ch)) { best = ang; assistTarget = { dyaw, dp }; }
  }
}

// ============================================================ main loop
let last = performance.now();
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
const tmpV = new THREE.Vector3();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  soundsThisFrame = 0;
  $('rotate').classList.toggle('hidden', !(joined && isTouch && H > W));

  if (!joined) { renderAttract(now); return; }
  const players = interpPlayers(now);
  const st = myStats();
  const alive = !!(you && you.alive && match.st === 'playing');
  let ads = false, fire = false, mx = 0, my = 0, sprint = false;
  findAssist(players);

  if (inGame() && you) {
    let fwd = 0, strafe = 0;
    if (isTouch) {
      const [sx, sy, sm] = stickVec(moveStick);
      fwd = -sy; strafe = sx;
      sprint = sm > 0.95 && -sy > 0.8 && !adsToggle;
      ads = adsToggle;
      fire = fireBtns.size > 0;
      if (assistTarget && (fire || ads)) {
        const r = Math.min(1, (ads ? 7 : 3) * dt);
        yaw += assistTarget.dyaw * r; pitch += assistTarget.dp * r;
      }
    } else {
      fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      strafe = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      ads = mouseRight;
      sprint = !!(keys.ShiftLeft || keys.ShiftRight) && fwd > 0;
      fire = mouseDown && locked;
      if (keys.ControlLeft || keys.ControlRight) crouchOn = true;
    }
    if (sprint) { crouchOn = false; ads = false; }
    mx = fwd * Math.cos(yaw) - strafe * Math.sin(yaw);
    my = fwd * Math.sin(yaw) + strafe * Math.cos(yaw);
    movingNow = Math.hypot(mx, my) > 0.1;
    // recoil recovery
    if (recoilDebt > 0) { const r = Math.min(recoilDebt, recoilDebt * 7 * dt + 0.0005); pitch -= r; recoilDebt -= r; }
    if (alive) {
      const r = S.applyMove(pred.x, pred.y, mx, my, dt, S.moveSpeed(st, ads, sprint, crouchOn));
      pred.x = r[0]; pred.y = r[1];
    }
    seq++;
    const item = [seq, +dt.toFixed(4), +mx.toFixed(3), +my.toFixed(3), (ads ? 1 : 0) | (sprint ? 2 : 0) | (crouchOn ? 4 : 0)];
    pending.push(item); outbox.push(item);
    if (pending.length > 240) pending.shift();
    if (now - lastSend > 33 || fire !== lastFireSent) {
      send({ t: 'in', l: outbox, a: +yaw.toFixed(4), p: +pitch.toFixed(4), f: fire && alive });
      outbox = []; lastSend = now; lastFireSent = fire;
    }
  }

  // --- camera
  adsT += ((ads && alive ? 1 : 0) - adsT) * Math.min(1, dt * st.adsSpeed);
  crouchT += ((crouchOn ? 1 : 0) - crouchT) * Math.min(1, dt * 10);
  const scoped = st.zoom > 1 && adsT > 0.85;
  const baseFov = isTouch ? 70 : 75;
  const fov = st.zoom > 1 ? baseFov + (baseFov / st.zoom - baseFov) * Math.max(0, (adsT - 0.6) / 0.4) : baseFov - 20 * adsT;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  shake *= Math.pow(0.02, dt);
  if (you && you.alive) {
    const eye = 60 - 20 * crouchT;
    if (movingNow && alive) bobPhase += dt * (sprint ? 14 : 9) * (crouchOn ? 0.7 : 1);
    const bob = movingNow ? Math.sin(bobPhase * 2) * (sprint ? 1.6 : 0.8) * (1 - adsT * 0.8) : 0;
    camera.position.set(pred.x, eye + bob, pred.y);
    let lp = pitch, ly = yaw;
    if (scoped) { lp += Math.sin(now / 900) * 0.002; ly += Math.cos(now / 1300) * 0.002; }
    lp += (Math.random() - 0.5) * shake * 0.004; ly += (Math.random() - 0.5) * shake * 0.004;
    tmpV.set(pred.x + Math.cos(ly) * Math.cos(lp) * 100, eye + bob + Math.sin(lp) * 100, pred.y + Math.sin(ly) * Math.cos(lp) * 100);
    camera.lookAt(tmpV);
  } else if (deathPos) {
    // death cam: look from above at where you fell, towards your killer
    const kx = you && you.kx ? you.kx : null;
    const target = kx ? new THREE.Vector3(kx[0], 40, kx[1]) : new THREE.Vector3(deathPos.x, 0, deathPos.y);
    const desired = new THREE.Vector3(deathPos.x - Math.cos(deathPos.yaw) * 70, 170, deathPos.y - Math.sin(deathPos.yaw) * 70);
    camera.position.lerp(desired, Math.min(1, dt * 3));
    camera.lookAt(target);
  }

  // --- soldiers
  const seen = new Set();
  for (const [id, p] of players) {
    if (id === myId) continue;
    seen.add(id);
    const team = p.f & 1 ? 'axis' : 'allies';
    let s = soldiers.get(id);
    if (s && s.team !== team) { removeSoldier(id); s = null; }
    if (!s) { s = makeSoldier(id, team); soldiers.set(id, s); s.lastX = p.x; s.lastY = p.y; }
    setSoldierGun(s, p.w);
    const aliveP = !!(p.f & 2);
    if (!aliveP) {
      if (!s.deadAt) s.deadAt = now;
      const k = Math.min(1, (now - s.deadAt) / 350);
      s.root.rotation.z = k * 1.45;
      s.root.position.y = -k * 6;
      s.root.visible = now - s.deadAt < 3000;
      if (s.tag) s.tag.visible = false;
      continue;
    }
    if (s.deadAt) { s.deadAt = 0; s.root.rotation.z = 0; s.root.position.y = 0; s.lastX = p.x; s.lastY = p.y; }
    s.root.visible = true;
    const sp = Math.hypot(p.x - s.lastX, p.y - s.lastY) / Math.max(dt, 0.001);
    s.lastX = p.x; s.lastY = p.y;
    s.root.position.x = p.x; s.root.position.z = p.y;
    s.root.rotation.y = -p.a;
    const crouch = !!(p.f & 64);
    if (sp > 20) s.walk += dt * Math.min(sp, 320) / 22;
    const swing = sp > 20 ? Math.sin(s.walk) * (p.f & 128 ? 0.8 : 0.5) : 0;
    s.legL.rotation.z = swing; s.legR.rotation.z = -swing;
    const cy = crouch ? 0.55 : 1;
    s.legL.scale.y = s.legR.scale.y = cy;
    s.upper.position.y = crouch ? -16 : 0;
    s.holder.rotation.z = p.q || 0;
    if (p.f & 128) s.holder.rotation.x = 0.5; else s.holder.rotation.x = 0;
    // name tags: teammates always, enemies when aimed at
    const r = roster.get(id);
    const nm = r ? r.n : '';
    const friendly = you && team === you.team;
    if (!s.tag || s.tagName !== nm) {
      if (s.tag) s.root.remove(s.tag);
      s.tag = nameSprite(nm, friendly ? '#9cc8ff' : '#ff8a7a'); s.tagName = nm;
      s.tag.position.set(0, 86, 0); s.root.add(s.tag);
    }
    let showTag = friendly;
    if (!friendly && you && you.alive) {
      const eye = S.eyeHeight(crouchOn);
      const cp = Math.cos(pitch);
      const dx = Math.cos(yaw) * cp, dy = Math.sin(yaw) * cp, dh = Math.sin(pitch);
      const t = S.rayCylinder(pred.x, pred.y, eye, dx, dy, dh, p.x, p.y, S.PLAYER_R + 4, S.bodyHeight(crouch));
      showTag = t < 1500 && S.rayWorld(pred.x, pred.y, eye, dx, dy, dh, t) >= t - 1;
    }
    s.tag.visible = showTag;
    s.tag.position.y = crouch ? 66 : 86;
  }
  for (const id of [...soldiers.keys()]) if (!seen.has(id)) removeSoldier(id);
  for (const s of soldiers.values()) s.flash.visible = now - (s.flash.userData.t || 0) < 50 && !s.deadAt;

  // --- grenades
  nadeState.forEach((n, i) => {
    const m = nadeMesh(i);
    m.visible = true;
    m.position.lerp(tmpV.set(n[0], n[2] + 2, n[1]), m.userData.init ? 0.5 : 1);
    m.userData.init = true;
    m.rotation.x += dt * 8;
    m.scale.set(1, n[3] ? 1.8 : 1, 1);
  });
  for (let i = nadeState.length; i < nadeMeshes.length; i++) { nadeMeshes[i].visible = false; nadeMeshes[i].userData.init = false; }

  // --- effects
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    const k = (now - t.t) / 1000 * 9000 / t.len;
    if (k >= 1) { scene.remove(t.m); tracers.splice(i, 1); continue; }
    t.m.position.copy(t.a).lerp(t.b, k);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; const age = now - p.t;
    if (age > p.life) { scene.remove(p.m); particles.splice(i, 1); continue; }
    p.vy -= p.g * dt;
    p.m.position.x += p.vx * dt; p.m.position.y = Math.max(0.5, p.m.position.y + p.vy * dt); p.m.position.z += p.vz * dt;
    const f = 1 - age / p.life;
    p.m.scale.setScalar(p.grow ? p.s * (1 + (1 - f) * 2) : p.s * Math.max(0.2, f));
  }
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i]; const k = (now - e.t) / 450;
    if (k >= 1) { scene.remove(e.m); e.m.geometry.dispose(); e.m.material.dispose(); explosions.splice(i, 1); continue; }
    e.m.scale.setScalar(20 + k * 110); e.m.material.opacity = 0.9 * (1 - k);
  }
  if (boomLight.intensity > 0) boomLight.intensity = Math.max(0, 4e5 * (1 - (now - boomLight.userData.t) / 300));

  // --- viewmodel
  const g = you && you.g ? you.g[you.slot] : null;
  if (g && you) buildViewmodel(g[0], g[1], you.team);
  const showVm = !!(vm && you && you.alive && !scoped);
  if (vm) {
    vm.holder.visible = showVm;
    vmKick *= Math.pow(0.0005, dt);
    vmSwap = Math.max(0, vmSwap - dt * 3);
    const target = new THREE.Vector3(0, -vm.gun.sightH, -11).lerp(VM_HIP, 1 - adsT);
    const bobA = movingNow ? (1 - adsT * 0.85) : 0;
    target.x += Math.sin(bobPhase) * 0.6 * bobA;
    target.y += Math.abs(Math.cos(bobPhase)) * 0.5 * bobA - crouchT * 0.3;
    target.z += vmKick * 1.8;
    target.y -= vmSwap * 14;
    let rx = vmKick * 0.06, ry = 0, rz = 0;
    if (sprint && movingNow) { target.x -= 2; target.y -= 2.5; ry = 0.7; rz = 0.25; rx -= 0.2; }
    const rl = you ? you.rl : 0;
    if (rl > 0) { const dip = Math.sin(Math.min(1, (1 - rl)) * Math.PI); target.y -= dip * 5; rz += dip * 0.7; rx -= dip * 0.3; }
    const mk = now - vmMelee;
    if (mk < 300) { const j = Math.sin(mk / 300 * Math.PI); target.z -= j * 9; target.x -= j * 3; rz -= j * 0.4; }
    vm.holder.position.lerp(target, Math.min(1, dt * 18));
    vm.holder.rotation.x += (rx - vm.holder.rotation.x) * Math.min(1, dt * 18);
    vm.holder.rotation.y += (ry - vm.holder.rotation.y) * Math.min(1, dt * 12);
    vm.holder.rotation.z += (rz - vm.holder.rotation.z) * Math.min(1, dt * 12);
    vm.flash.visible = now - vmFlash < 45 && !st.noFlash;
    if (vm.flash.visible) vm.flash.material.rotation = Math.random() * TAU;
  }

  renderer.clear();
  renderer.render(scene, camera);
  if (showVm) { renderer.clearDepth(); renderer.render(vmScene, vmCamera); }
  drawOverlay(now, players, st, scoped, ads, movingNow, sprint);
  updateHud(now);
}

function renderAttract(now) {
  const t = now / 14000;
  camera.fov = 70; camera.updateProjectionMatrix();
  camera.position.set(S.MAP_W / 2 + Math.cos(t) * 1300, 420, S.MAP_H / 2 + Math.sin(t) * 900);
  camera.lookAt(S.MAP_W / 2, 0, S.MAP_H / 2);
  renderer.clear();
  renderer.render(scene, camera);
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, ov.width, ov.height);
}

// ============================================================== overlay
function drawOverlay(now, players, st, scoped, ads, moving, sprint) {
  const c = octx;
  c.setTransform(odpr, 0, 0, odpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  if (!you) return;
  if (scoped && you.alive) {
    const r = Math.min(W, H) * 0.46;
    c.fillStyle = '#000';
    c.beginPath(); c.rect(0, 0, W, H); c.arc(cx, cy, r, 0, TAU, true); c.fill();
    const gr = c.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.85)');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.strokeStyle = '#000'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy); c.lineTo(cx, cy + r); c.stroke();
    c.lineWidth = 5; c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx - r * 0.25, cy); c.moveTo(cx + r * 0.25, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy + r * 0.25); c.lineTo(cx, cy + r); c.stroke();
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx - 3, cy + 18); c.lineTo(cx + 3, cy + 18); c.closePath(); c.fillStyle = '#000'; c.fill();
  }
  // damage vignette
  const lowHp = you.alive && you.hp < 45;
  if (now - hurtFlash < 400 || lowHp) {
    const a = Math.max(now - hurtFlash < 400 ? 0.4 * (1 - (now - hurtFlash) / 400) : 0, lowHp ? (45 - you.hp) / 70 : 0);
    const gr = c.createRadialGradient(cx, cy, Math.min(W, H) * 0.3, cx, cy, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(150,0,0,${Math.min(0.85, a * 1.8)})`);
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
  }
  // hurt direction arcs
  for (let i = hurtDirs.length - 1; i >= 0; i--) {
    const h = hurtDirs[i]; const age = now - h.t;
    if (age > 1200) { hurtDirs.splice(i, 1); continue; }
    const rel = Math.atan2(h.y - pred.y, h.x - pred.x) - yaw;
    const R = Math.min(W, H) * 0.22;
    c.strokeStyle = `rgba(220,30,20,${0.8 * (1 - age / 1200)})`; c.lineWidth = 8;
    c.beginPath(); c.arc(cx, cy, R, rel - Math.PI / 2 - 0.3, rel - Math.PI / 2 + 0.3); c.stroke();
  }
  // crosshair
  if (you.alive && inGame() && !scoped) {
    const spread = S.currentSpread(st, ads, moving, crouchOn, sprint);
    const gap = Math.max(4, Math.tan(spread) / Math.tan(camera.fov * Math.PI / 360) * H / 2);
    const a = Math.max(0, 1 - adsT * 1.6);
    if (a > 0 && !sprint) {
      c.strokeStyle = `rgba(255,255,255,${0.9 * a})`; c.lineWidth = 2; c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 2;
      c.beginPath();
      c.moveTo(cx - gap - 9, cy); c.lineTo(cx - gap, cy); c.moveTo(cx + gap, cy); c.lineTo(cx + gap + 9, cy);
      c.moveTo(cx, cy - gap - 9); c.lineTo(cx, cy - gap); c.moveTo(cx, cy + gap); c.lineTo(cx, cy + gap + 9);
      c.stroke(); c.shadowBlur = 0;
    }
    if (st.cls === 'Shotgun' && adsT > 0.5) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(cx, cy, gap, 0, TAU); c.stroke(); }
    if (you.rl > 0) {
      c.strokeStyle = '#d9a441'; c.lineWidth = 3;
      c.beginPath(); c.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - you.rl)); c.stroke();
    }
  }
  if (now - hitMarker < 220 && you.alive) {
    c.strokeStyle = hitKill ? 'rgba(255,70,50,.95)' : 'rgba(255,255,255,.95)'; c.lineWidth = 2.5;
    c.beginPath();
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.moveTo(cx + dx * 6, cy + dy * 6); c.lineTo(cx + dx * 14, cy + dy * 14); }
    c.stroke();
  }
  // touch stick
  if (isTouch && inGame() && moveStick) {
    const s = moveStick;
    c.strokeStyle = 'rgba(255,240,200,.4)'; c.lineWidth = 2;
    c.beginPath(); c.arc(s.ox, s.oy, STICK_R, 0, TAU); c.stroke();
    const [vx, vy] = stickVec(s);
    c.fillStyle = 'rgba(255,240,200,.45)';
    c.beginPath(); c.arc(s.ox + vx * STICK_R, s.oy + vy * STICK_R, 24, 0, TAU); c.fill();
  }
  drawMinimap(players, now);
}

function drawMinimap(players) {
  const c = octx;
  const size = 150, ox = 8, oy = 8, scale = 0.09; // world -> px
  c.save();
  c.beginPath(); c.rect(ox, oy, size, size); c.clip();
  c.fillStyle = 'rgba(20,20,12,.7)'; c.fillRect(ox, oy, size, size);
  c.translate(ox + size / 2, oy + size / 2);
  c.rotate(-yaw - Math.PI / 2);
  c.scale(scale, scale);
  c.translate(-pred.x, -pred.y);
  c.fillStyle = 'rgba(70,65,45,.9)'; c.fillRect(0, 0, S.MAP_W, S.MAP_H);
  c.fillStyle = 'rgba(210,200,170,.75)';
  for (const w of S.WALLS) c.fillRect(w.x, w.y, w.w, w.h);
  for (const [id, p] of players) {
    if (id === myId || !(p.f & 2)) continue;
    const team = p.f & 1 ? 'axis' : 'allies';
    if (team !== you.team && !(p.f & 8)) continue;
    c.fillStyle = team === you.team ? '#5aa0ff' : '#ff5040';
    c.beginPath(); c.arc(p.x, p.y, 34, 0, TAU); c.fill();
  }
  c.restore();
  // player arrow (always up)
  c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(ox + size / 2, oy + size / 2 - 7); c.lineTo(ox + size / 2 - 5, oy + size / 2 + 5); c.lineTo(ox + size / 2 + 5, oy + size / 2 + 5); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,240,200,.35)'; c.strokeRect(ox, oy, size, size);
}

function updateHud(now) {
  if (!you) return;
  setText('scA', String(match.sc[0])); setText('scX', String(match.sc[1]));
  const tl = Math.ceil(match.tl / 1000);
  setText('timer', Math.floor(tl / 60) + ':' + String(tl % 60).padStart(2, '0'));
  const hp = you.alive ? you.hp : 0;
  if (hudCache.hp !== hp) { hudCache.hp = hp; $('hpFill').style.width = hp + '%'; $('hpText').textContent = hp; }
  const g = you.g && you.g[you.slot];
  if (g) {
    setText('weaponName', S.WEAPONS[g[0]].name);
    setText('weaponAtts', g[1].map((a) => S.ATTACHMENTS[a].name).join(' + '));
  }
  setText('ammoMag', String(you.ammo)); setText('ammoRes', String(you.res));
  setText('nades', 'Frag x' + you.nd + (you.rg ? ' · Rifle Gren x' + you.rg : '') + (you.rl > 0 ? ' · RELOADING' : you.ammo === 0 ? ' · RELOAD!' : ''));
  setText('stance', crouchOn ? 'CROUCHED' : '');
  setText('ping', offlineMode ? 'OFFLINE' : Math.round(ping) + ' ms · ' + roomCode);
  if (isTouch) $('tRg').classList.toggle('hidden', !(you.rg > 0 && you.slot === 0));
  if (isTouch) $('tCrouch').classList.toggle('on', crouchOn);
  const kf = killfeed.filter((k) => now - k.t < 6000).map((k) => `<div><span class="c-${teamOf(k.k)}">${esc(nameOf(k.k))}</span> <span class="w">[${esc(k.w)}${k.hs ? ' · HS' : ''}]</span> <span class="c-${teamOf(k.v)}">${esc(nameOf(k.v))}</span></div>`).join('');
  if (hudCache.kf !== kf) { hudCache.kf = kf; $('killfeed').innerHTML = kf; }
  let c = '';
  if (match.st === 'ended') {
    const w = match.winner;
    c = (w === 'draw' ? 'DRAW' : (w === you.team ? 'VICTORY' : 'DEFEAT') + '\n' + (w || '').toUpperCase() + ' WIN') +
      `\n<small>${match.sc[0]} - ${match.sc[1]} · next match in ${Math.ceil(match.rs / 1000)}s</small>`;
  } else if (!you.alive) {
    const by = you.kb === myId ? 'You' : nameOf(you.kb);
    c = (you.kw === 'Team change' ? 'SWITCHING TEAMS' : 'KILLED BY ' + esc(by).toUpperCase() + `\n<small>${esc(you.kw || '')}</small>`) +
      `\n<small>Respawning in ${(you.ri / 1000).toFixed(1)}s · ${isTouch ? 'tap &#9881;' : 'press L'} to change loadout</small>`;
  } else if (centerMsg && now - centerMsg.t < 1500) {
    c = esc(centerMsg.text);
  }
  if (hudCache.c !== c) { hudCache.c = c; $('center').innerHTML = c; }
}

requestAnimationFrame(frame);
