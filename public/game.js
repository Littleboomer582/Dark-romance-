/* Frontline 1945 — first-person browser / Android client */
import * as THREE from './vendor/three.module.min.js';
import * as Guns from './guns.js';

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

// ================================================================ settings
const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sprint: 'ShiftLeft',
  crouch: 'KeyC', prone: 'KeyZ', holdCrouch: 'ControlLeft', reload: 'KeyR', swap: 'KeyQ', grenade: 'KeyG',
  melee: 'KeyV', rifleNade: 'KeyB', ks1: 'Digit5', ks2: 'Digit6', ks3: 'Digit7', scores: 'Tab', loadout: 'KeyL',
};
const BIND_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right', jump: 'Jump', sprint: 'Sprint',
  crouch: 'Crouch / slide (hold: prone)', prone: 'Prone', holdCrouch: 'Hold to crouch', reload: 'Reload', swap: 'Switch weapon',
  grenade: 'Throw grenade', melee: 'Melee', rifleNade: 'Rifle grenade', ks1: 'Recon Plane', ks2: 'Airstrike', ks3: 'Mortar Barrage',
  scores: 'Scoreboard', loadout: 'Change loadout',
};
const KS_BIND = { recon: 'ks1', air: 'ks2', mortar: 'ks3' };
const settings = Object.assign({ adsSens: 1, invertY: false, fov: isTouch ? 70 : 75, volume: 0.8, quality: isTouch ? 'low' : 'high' }, loadSaved('fl_settings', {}));
settings.binds = Object.assign({}, DEFAULT_BINDS, settings.binds || {});
function saveSettings() { save('fl_settings', settings); }
function keyName(code) {
  if (!code) return '—';
  const named = { Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt', Tab: 'Tab', CapsLock: 'Caps Lock', Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
  if (named[code]) return named[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  if (code.startsWith('Arrow')) return code.slice(5) + ' arrow';
  return code;
}
const actionFor = (code) => Object.keys(settings.binds).find((a) => settings.binds[a] === code);

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
let sens = loadSaved('fl_sens', 1);
$('sens').value = sens; $('sensVal').textContent = (+sens).toFixed(2);
$('sens').addEventListener('input', () => { sens = +$('sens').value; $('sensVal').textContent = sens.toFixed(2); save('fl_sens', sens); });
$('adsMode').value = loadSaved('fl_adsMode', 'hold');
$('adsMode').addEventListener('change', () => { adsMode = $('adsMode').value; adsLatched = false; save('fl_adsMode', adsMode); });
$('controlsHelp').innerHTML = isTouch
  ? 'Left thumb: move (push all the way up to sprint). Drag on the right to look. FIRE buttons shoot (drag on them to aim). AIM aims down sights, JUMP jumps, &#8615; crouch (tap while sprinting to slide, hold to go prone), R reload, &#8646; swap, G grenade, &#9876; melee, RG rifle grenade.'
  : 'Click to lock the mouse &middot; WASD move &middot; Mouse look &middot; Left click fire &middot; Right click aim down sights &middot; Shift sprint &middot; Space jump &middot; C crouch (while sprinting: slide, hold: prone) &middot; Z prone &middot; Ctrl hold crouch &middot; R reload &middot; Q / wheel swap &middot; G grenade &middot; V melee &middot; B rifle grenade &middot; Tab scores &middot; L loadout';

// ================================================================== audio
let actx = null, noiseBuf = null, soundsThisFrame = 0, master = null;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = settings.volume; master.connect(actx.destination);
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
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}
function tone(freq, dur, vol, type) {
  if (!actx) return;
  const o = actx.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
  const g = actx.createGain(); const t = actx.currentTime;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
// Layered gunshot: supersonic crack + muzzle blast + low thump + echo tail, muffled with distance.
const SHOT_SND = { // crack HP, body LP, body decay, thump Hz, tail decay, gain
  'SMG': [2400, 2300, 0.11, 100, 0.55, 0.5], 'Assault Rifle': [3000, 1900, 0.15, 85, 0.75, 0.62], 'Rifle': [3400, 1600, 0.2, 75, 0.95, 0.72],
  'Bolt-Action': [3800, 1400, 0.26, 62, 1.3, 0.85], 'Shotgun': [1800, 1100, 0.3, 58, 1.1, 0.85], 'Machine Gun': [3000, 1800, 0.13, 80, 0.65, 0.62],
  'Pistol': [2800, 2600, 0.09, 115, 0.45, 0.42],
};
function volAt(x, y) { return Math.max(0, 1 - Math.hypot(x - pred.x, y - pred.y) / 2400); }
function nz(dest, t, type, f, q, peak, attack, decay) {
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const fl = actx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7;
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  src.connect(fl); fl.connect(g); g.connect(dest);
  src.start(t, Math.random() * 0.8); src.stop(t + attack + decay + 0.05);
}
function playShot(wid, x, y, sup) {
  const w = S.WEAPONS[wid]; if (!w || !actx || soundsThisFrame > 6) return;
  const near = volAt(x, y); if (near <= 0.01) return;
  soundsThisFrame++;
  const [hp, lp, bd, th, tail, gain] = SHOT_SND[w.cls] || SHOT_SND.SMG;
  const t = actx.currentTime;
  const out = actx.createGain(); out.gain.value = gain * (0.15 + 0.85 * near * near);
  const muffle = actx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 500 + 15000 * near * near;
  out.connect(muffle); muffle.connect(master);
  if (sup) { nz(out, t, 'lowpass', 1300, 0.7, 0.45, 0.002, 0.09); nz(out, t, 'highpass', 3500, 0.7, 0.2, 0.001, 0.02); return; }
  nz(out, t, 'highpass', hp, 0.8, 0.9 * near, 0.001, 0.035);   // crack
  nz(out, t, 'lowpass', lp, 0.9, 1.0, 0.002, bd);               // blast
  const o = actx.createOscillator(); o.type = 'sine'; // thump
  o.frequency.setValueAtTime(th * 2.2, t); o.frequency.exponentialRampToValueAtTime(th * 0.5, t + 0.14);
  const og = actx.createGain(); og.gain.setValueAtTime(0.9, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.22);
  nz(out, t + 0.035, 'lowpass', 650, 0.5, 0.22, 0.02, tail);    // echo tail
}
// Mechanical sounds for your own weapon.
function mech(kind) {
  if (!actx) return;
  const t = actx.currentTime, d = master;
  const click = (at, v, f) => nz(d, t + at, 'highpass', f || 3200, 1.2, v, 0.001, 0.025);
  const slide = (at, v, f, dur) => nz(d, t + at, 'bandpass', f || 1400, 1.5, v, 0.01, dur || 0.1);
  switch (kind) {
    case 'bolt': click(0, 0.25); slide(0.06, 0.16, 1600, 0.12); click(0.2, 0.22, 2600); slide(0.25, 0.14, 1300, 0.1); click(0.36, 0.3); break;
    case 'pump': slide(0, 0.2, 900, 0.07); click(0.06, 0.25, 2000); slide(0.18, 0.2, 1000, 0.06); click(0.22, 0.3, 2200); break;
    case 'magout': click(0, 0.22); slide(0.03, 0.12, 1200, 0.12); break;
    case 'magin': slide(0, 0.1, 1100, 0.05); click(0.05, 0.35, 1800); nz(d, t + 0.05, 'lowpass', 500, 0.7, 0.25, 0.002, 0.07); break;
    case 'rack': click(0, 0.25); slide(0.02, 0.15, 1500, 0.08); click(0.12, 0.35, 2400); break;
    case 'click': click(0, 0.2, 4000); break;
    case 'ping': for (const [f, v] of [[2650, 0.12], [4150, 0.06], [2690, 0.08]]) { const o = actx.createOscillator(); o.frequency.value = f; const g = actx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.75); } break;
    case 'shell': for (let i = 0; i < 3; i++) { const o = actx.createOscillator(); o.frequency.value = 3200 + Math.random() * 3200; const g = actx.createGain(); const at = t + i * (0.05 + Math.random() * 0.07); g.gain.setValueAtTime(0.035 / (i + 1), at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06); o.connect(g); g.connect(d); o.start(at); o.stop(at + 0.08); } break;
    case 'hull': nz(d, t, 'lowpass', 700, 0.7, 0.12, 0.002, 0.06); break;
  }
}

// ================================================================ network
let ws = null, myId = 0, joined = false, roomCode = '';
let snaps = [];
const roster = new Map();
let you = null;
const pred = S.newMoveState(0, 0); // your predicted movement state (position, height, stance, slide)
let pending = [], outbox = [], seq = 0, lastSend = 0, lastFireSent = false;
let yaw = 0, pitch = 0, recoilDebt = 0, wasAlive = false, lastSlot = 0, sprintWas = false;
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

let offlineMode = false, leaving = false, wsOpen = null, lobbyInfo = null, lastLobbyState = null;
const playerName = () => { save('fl_name', $('name').value.trim()); return $('name').value.trim() || 'Soldier'; };

function attach(sock) {
  ws = sock;
  sock.onmessage = (ev) => { if (ws !== sock) return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMessage(m); };
  sock.onclose = () => {
    if (ws !== sock) return;
    const wasJoined = joined;
    ws = null; wsOpen = null; joined = false;
    if (wasJoined || !$('lobbyScreen').classList.contains('hidden')) showMenu(leaving ? '' : 'Disconnected from server.');
    else if (!leaving) showErr('Could not reach the game server.');
    leaving = false;
  };
}
// Opens (or reuses) the connection to the online game server.
function ensureOnline() {
  if (ws && !offlineMode && wsOpen) return wsOpen;
  if (ws) { leaving = true; ws.close(); }
  const url = serverUrl();
  if (!url) return Promise.reject(new Error('Enter your game server address above for online play, or choose OFFLINE VS BOTS.'));
  save('fl_server', $('server').value.trim());
  offlineMode = false;
  let sock;
  try { sock = new WebSocket(url); } catch (e) { return Promise.reject(new Error('Could not connect: ' + e.message)); }
  attach(sock);
  wsOpen = new Promise((res, rej) => {
    sock.onopen = () => res();
    sock.onerror = () => rej(new Error('Could not reach the game server at ' + url.replace(/^ws/, 'http').replace(/\/ws$/, '') + '.'));
  });
  wsOpen.catch(() => { if (ws === sock) { ws = null; wsOpen = null; } });
  return wsOpen;
}
function online(action) {
  initAudio();
  showErr('Connecting...');
  ensureOnline().then(() => { showErr(''); action(); }).catch((e) => showErr(e.message));
}
function playOffline() {
  initAudio();
  if (ws) { leaving = true; ws.close(); }
  offlineMode = true;
  const sock = localSocket();
  attach(sock);
  wsOpen = null;
  sock.onopen = () => sock.send(JSON.stringify({ t: 'join', name: playerName(), room: 'OFFLINE', quick: true, bots: +$('offBots').value, map: $('offMap').value, mode: $('offMode').value, loadout }));
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

// Show an error message on whichever menu screen is visible.
function showErr(msg) {
  for (const id of ['lobbyScreen', 'createScreen', 'browseScreen', 'menu']) {
    const el = $(id);
    if (!el.classList.contains('hidden')) { el.querySelector('.err').textContent = msg; return; }
  }
  $('err').textContent = msg;
}

const SCREENS = ['menu', 'armory', 'createScreen', 'browseScreen', 'lobbyScreen'];
function showScreen(id) {
  for (const s2 of SCREENS) $(s2).classList.toggle('hidden', s2 !== id);
  if (id) for (const s2 of ['hud', 'touch', 'pause', 'scoreboard', 'loadoutScreen']) $(s2).classList.add('hidden');
  for (const s2 of SCREENS) { const e = $(s2).querySelector('.err'); if (e && s2 !== id) e.textContent = ''; }
  if (browseTimer && id !== 'browseScreen') { clearInterval(browseTimer); browseTimer = null; }
}

function enterGame() {
  showScreen(null);
  $('hud').classList.remove('hidden');
  if (isTouch) $('touch').classList.remove('hidden');
  else if (!locked) { $('pause').classList.remove('hidden'); requestLock(); }
}
function enterLobby() {
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen('lobbyScreen');
  renderLobby();
}

function onMessage(m) {
  switch (m.t) {
    case 'welcome':
      myId = m.id; roomCode = m.code; joined = true; snaps = []; pending = []; you = null;
      lastLobbyState = m.state;
      if (m.lobby && m.state !== 'playing') enterLobby(); else enterGame();
      break;
    case 'lobby':
      lobbyInfo = m;
      if (m.settings && m.state !== 'playing') {
        currentMode = m.settings.mode;
        buildWorld(m.settings.map);
        if (objModeId !== currentMode || objMapId !== m.settings.map) buildObjectives(m.settings.map, currentMode);
      }
      if (!joined || !m.lobby) break;
      if (m.state === 'playing' && lastLobbyState !== 'playing') enterGame();
      else if (m.state === 'lobby' && lastLobbyState !== 'lobby') { enterLobby(); }
      lastLobbyState = m.state;
      renderLobby();
      break;
    case 'lobbies': renderLobbyList(m); break;
    case 'kicked': leaving = true; showMenu('The host removed you from the lobby.'); break;
    case 'err': showErr(m.msg); break;
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
  if (m.mp && m.mp !== worldMapId) buildWorld(m.mp);
  if (m.md) currentMode = m.md;
  if (m.mp && (m.md !== objModeId || m.mp !== objMapId)) buildObjectives(m.mp, m.md || 'tdm');
  objState = m.ob;
  match.sc = m.sc; match.tl = m.tl; match.rs = m.rs; match.sl = m.sl; match.lb = m.lb; match.rc = m.rc;
  lastStateAt = now;
  if (match.st === 'ended' && m.st === 'playing') { match.winner = null; killfeed.length = 0; }
  match.st = m.st;
  you = m.you;
  if (you) {
    pending = pending.filter((i) => i[0] > you.seq);
    const mv = you.mv || [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const ns = { x: you.x, y: you.y, z: mv[0], vz: mv[1], slide: mv[2], sdx: mv[3], sdy: mv[4], slideCd: mv[5], pc: !!mv[6], ps: !!mv[7], pj: !!mv[8], stance: pred.stance, air: false };
    if (you.alive) {
      const st = myStats();
      for (const i of pending) S.stepMove(ns, i[2], i[3], i[4], i[1], st);
    }
    const x = ns.x, y = ns.y;
    if (!wasAlive && you.alive) { yaw = Math.atan2(S.MAP_H / 2 - y, S.MAP_W / 2 - x); pitch = 0; crouchOn = false; proneOn = false; adsLatched = false; deathPos = null; }
    if (wasAlive && !you.alive) deathPos = { x: pred.x, y: pred.y, yaw };
    wasAlive = you.alive;
    Object.assign(pred, ns);
    if (you.slot !== lastSlot) { vmSwap = 1; lastSlot = you.slot; }
  }
  for (const e of m.ev) handleEvent(e, now);
}

const nameOf = (id) => { const r = roster.get(id); return r ? r.n : '?'; };
const teamOf = (id) => { const r = roster.get(id); return r ? r.t : 'allies'; };

const TEAMNAME = { allies: 'Allies', axis: 'Axis' };
function objNotice(e, now) {
  if (!you) return;
  const mine = e.t === you.team;
  let text = '', good = null;
  if (currentMode === 'dom') {
    const L = 'ABC'[e.i] || '';
    if (e.k === 'cap') { text = `${TEAMNAME[e.t]} captured ${L}`; good = mine; }
    else if (e.k === 'neutral') text = `${L} neutralized`;
  } else if (currentMode === 'ctf') {
    // e.t is the team that owns the flag
    if (e.k === 'take') { text = mine ? 'Your flag was taken!' : e.i === myId ? 'You have the enemy flag! Get it home!' : 'Enemy flag taken'; good = !mine; }
    else if (e.k === 'drop') { text = mine ? 'Your flag was dropped' : 'Enemy flag dropped'; good = mine; }
    else if (e.k === 'return') { text = mine ? 'Your flag was returned' : 'Enemy flag returned'; good = mine; }
    else if (e.k === 'cap') { text = mine ? 'The enemy captured your flag!' : 'Your team captured the flag!'; good = !mine; }
  } else if (currentMode === 'hq' && e.k === 'move') text = 'The HQ has moved';
  if (!text) return;
  killfeed.push({ notice: text, good, t: now });
  while (killfeed.length > 5) killfeed.shift();
  centerMsg = { text, t: now };
  if (good === true) { tone(660, 0.12, 0.07, 'triangle'); setTimeout(() => tone(990, 0.16, 0.07, 'triangle'), 120); }
  else if (good === false) { tone(330, 0.2, 0.07, 'sawtooth'); }
  else tone(520, 0.1, 0.05, 'triangle');
}

// ---- killstreaks
function useStreak(id) {
  if (!you || !you.alive || !(you.ks || []).includes(id)) return;
  send({ t: 'in', l: [], a: +yaw.toFixed(4), p: +pitch.toFixed(4), f: lastFireSent }); // make sure the server has your aim
  send({ t: 'ks', k: id });
}
function notice(text, good, now) {
  killfeed.push({ notice: text, good, t: now });
  while (killfeed.length > 5) killfeed.shift();
  centerMsg = { text, t: now };
}
function streakEarned(id, now) {
  const key = isTouch ? 'tap it below' : 'press ' + keyName(settings.binds[KS_BIND[id]]);
  notice(`${S.STREAKS[id].name} ready! (${key})`, true, now);
  tone(523, 0.12, 0.08, 'triangle'); setTimeout(() => tone(659, 0.12, 0.08, 'triangle'), 110); setTimeout(() => tone(784, 0.2, 0.08, 'triangle'), 220);
}
function streakUsed(e, now) {
  const mine = you && e.t === you.team, self = e.i === myId;
  const name = S.STREAKS[e.k].name;
  const text = self ? `${name} called in` : mine ? `Friendly ${name.toLowerCase()} ${e.k === 'recon' ? 'overhead' : 'inbound'}` : e.k === 'recon' ? 'Enemy recon plane overhead' : `Enemy ${name.toLowerCase()} incoming! Take cover!`;
  notice(text, mine, now);
  if (!mine) { tone(440, 0.25, 0.08, 'square'); setTimeout(() => tone(440, 0.25, 0.08, 'square'), 350); }
  if (e.k === 'recon') { drone(4, 0.15); return; }
  if (e.k === 'air') {
    const flight = { x: e.x, y: e.y, ang: e.a, start: now, arrive: now + 3200, planes: [] };
    for (let i = 0; i < 3; i++) { const pl = makePlane(mine ? 0x4d5a36 : 0x5d6266); scene.add(pl); flight.planes.push(pl); }
    flights.push(flight);
    setTimeout(() => drone(4.5, 0.35), 1200);
  }
  for (const [x, y, ms] of e.s || []) {
    shells.push({ x, y, at: now + ms, kind: e.k });
    if (e.k === 'mortar') setTimeout(() => whistle(x, y), Math.max(0, ms - 1100));
    else setTimeout(() => whistle(x, y, true), Math.max(0, ms - 800));
  }
}
function drone(sec, vol) {
  if (!actx) return;
  const t = actx.currentTime, g = actx.createGain(), f = actx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 420;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * 0.25, t + sec * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + sec);
  for (const fr of [78, 81, 156]) { const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + sec + 0.1); }
  f.connect(g); g.connect(master);
}
function whistle(x, y, short) {
  if (!actx) return;
  const v = Math.max(0.05, volAt(x, y)) * 0.12, t = actx.currentTime, dur = short ? 0.7 : 1.0;
  const o = actx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(short ? 900 : 1600, t); o.frequency.exponentialRampToValueAtTime(short ? 300 : 500, t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
const flights = [], shells = [], shellMeshes = [];
let reconPlanes = { allies: null, axis: null };
function makePlane(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(8, 5, 90, 12), paint); body.rotation.z = Math.PI / 2; g.add(body);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 12, 12), M.dark); nose.rotation.z = Math.PI / 2; nose.position.x = 50; g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(22, 2.5, 130), paint); wing.position.x = 8; g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 44), paint); tail.position.x = -40; g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(14, 20, 2), paint); fin.position.set(-40, 10, 0); g.add(fin);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(1, 30, 3), M.dark); prop.position.x = 57; g.add(prop); g.userData.prop = prop;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function updateStreakFx(now, dt) {
  // recon planes circle the map while active
  for (const [i, team] of [[0, 'allies'], [1, 'axis']]) {
    const on = match.rc && match.rc[i] > 0 && joined;
    if (on && !reconPlanes[team]) { reconPlanes[team] = makePlane(team === 'allies' ? 0x4d5a36 : 0x5d6266); scene.add(reconPlanes[team]); }
    if (!on && reconPlanes[team]) { scene.remove(reconPlanes[team]); reconPlanes[team] = null; }
    const pl = reconPlanes[team];
    if (pl) {
      const a = now / 7000 + i * Math.PI, r = 1000;
      pl.position.set(S.MAP_W / 2 + Math.cos(a) * r, 720, S.MAP_H / 2 + Math.sin(a) * r);
      pl.rotation.set(0.35, -a - Math.PI, 0); pl.userData.prop.rotation.x += dt * 40;
    }
  }
  // bomber flights cross the target line
  for (let f = flights.length - 1; f >= 0; f--) {
    const fl = flights[f], tt = (now - fl.arrive) / 1000, sp = 760;
    if (tt > 4) { for (const pl of fl.planes) scene.remove(pl); flights.splice(f, 1); continue; }
    fl.planes.forEach((pl, k) => {
      const lat = (k - 1) * 70, back = Math.abs(k - 1) * 50;
      const d = tt * sp - back;
      pl.position.set(fl.x + Math.cos(fl.ang) * d - Math.sin(fl.ang) * lat, 430 + k * 12, fl.y + Math.sin(fl.ang) * d + Math.cos(fl.ang) * lat);
      pl.rotation.set(0, -fl.ang, 0); pl.userData.prop.rotation.x += dt * 40;
    });
  }
  // falling bombs / mortar shells
  let n = 0;
  for (let i = shells.length - 1; i >= 0; i--) {
    const sh = shells[i], left = sh.at - now, fall = sh.kind === 'air' ? 800 : 450;
    if (left < 0) { shells.splice(i, 1); continue; }
    if (left > fall) continue;
    let m = shellMeshes[n];
    if (!m) { m = new THREE.Mesh(new THREE.CapsuleGeometry(3, 12, 4, 8), M.dark); scene.add(m); shellMeshes[n] = m; }
    m.visible = true; m.position.set(sh.x, 4 + (left / fall) * (sh.kind === 'air' ? 420 : 320), sh.y);
    n++;
  }
  for (let i = n; i < shellMeshes.length; i++) shellMeshes[i].visible = false;
}
function teamRecon() { return !!(you && match.rc && match.rc[you.team === 'allies' ? 0 : 1] > 0); }
function streakHud() {
  if (!you) return '';
  const st = you.st || 0, have = you.ks || [];
  const next = S.STREAK_IDS.find((id) => S.STREAKS[id].kills > st);
  let html = `<div class="ks-line">Streak <b>${st}</b>${next ? ` &middot; ${esc(S.STREAKS[next].name)} at ${S.STREAKS[next].kills}` : ''}</div>`;
  if (teamRecon()) html += `<div class="ks-line ks-on">Recon plane overhead ${Math.ceil(match.rc[you.team === 'allies' ? 0 : 1] / 1000)}s</div>`;
  for (const id of have) html += `<button class="ks-btn" data-ks="${id}">${isTouch ? '' : '[' + esc(keyName(settings.binds[KS_BIND[id]])) + '] '}${esc(S.STREAKS[id].name)}</button>`;
  return html;
}

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
          if (st.bipod && adsT > 0.5 && (!movingNow || pred.stance > 0)) k *= 0.3;
          if (pred.stance === 1) k *= 0.8;
          if (pred.stance === 2) k *= 0.6;
          pitch = Math.min(1.45, pitch + k);
          yaw += (Math.random() - 0.5) * k * 0.6;
          recoilDebt += k * 0.55;
          vmShot(st, now);
          shake = Math.max(shake, k * 30);
        }
      } else {
        start = new THREE.Vector3(ox + Math.cos(e.a) * 26, oh - 9, oy + Math.sin(e.a) * 26);
        if (e.p === 0 && !e.s) {
          const sm = soldiers.get(e.i); if (sm) sm.flash.userData.t = now;
          if (now - (muzzleLight.userData.t || 0) > 60 && Math.hypot(e.x - pred.x, e.y - pred.y) < 900) { muzzleLight.position.set(start.x, start.y, start.z); muzzleLight.intensity = 2500; muzzleLight.userData.t = now; }
        }
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
    case 'rg': noise(700, 0.35, volAt(pred.x, pred.y) * 0.5); if (e.i === myId) { vmImpulse(0.08); if (vm && vm.gun.parts.rifleNade) vm.gun.parts.rifleNade.visible = false; } break;
    case 'end': match.winner = e.w; break;
    case 'obj': objNotice(e, now); break;
    case 'ksE': if (e.i === myId) streakEarned(e.k, now); break;
    case 'ks': streakUsed(e, now); break;
  }
}

// ================================================================= THREE
const renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.quality === 'high', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, settings.quality === 'low' ? 1 : isTouch ? 1.5 : 2));
renderer.autoClear = false;
renderer.shadowMap.enabled = settings.quality === 'high';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb4ae98);
scene.fog = new THREE.Fog(0xb4ae98, 600, 3200);
const camera = new THREE.PerspectiveCamera(75, 1, 1, 6000);
camera.rotation.order = 'YXZ';
scene.add(camera);

const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(55, 1, 0.5, 300);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const envMap = Guns.makeEnvironment(renderer);
vmScene.environment = envMap;
scene.environment = envMap;
scene.environmentIntensity = 0.6;
vmScene.add(new THREE.HemisphereLight(0xe8e4d8, 0x4a4030, 0.9));
const vmSun = new THREE.DirectionalLight(0xfff0d8, 2.2); vmSun.position.set(0.6, 1, 0.5); vmScene.add(vmSun);
const vmFill = new THREE.DirectionalLight(0xc8d4ff, 0.5); vmFill.position.set(-1, 0.3, -0.4); vmScene.add(vmFill);
const vmMuzzleLight = new THREE.PointLight(0xffb060, 0, 60, 1.5); vmScene.add(vmMuzzleLight);
const muzzleLight = new THREE.PointLight(0xffb060, 0, 420, 1.6);

const hemi = new THREE.HemisphereLight(0xcfd6db, 0x5a5034, 1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.0);
sun.position.set(S.MAP_W / 2 - 900, 1400, S.MAP_H / 2 - 500);
sun.target.position.set(S.MAP_W / 2, 0, S.MAP_H / 2);
if (renderer.shadowMap.enabled) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -1600; sc.right = 1600; sc.top = 1300; sc.bottom = -1300; sc.near = 100; sc.far = 3500;
  sun.shadow.bias = -0.0008;
}
scene.add(sun); scene.add(sun.target); scene.add(muzzleLight);

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
// ---- textures (built on first use, shared between maps)
const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  const speckle = (g, n, base, cols, count, seed, maxSize) => {
    const r = rng(seed); g.fillStyle = base; g.fillRect(0, 0, n, n);
    for (let i = 0; i < count; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(r() * n, r() * n, 1 + r() * (maxSize || 4), 1 + r() * (maxSize || 4)); }
  };
  const T = {
    dirt: () => canvasTex(256, (g, n) => speckle(g, n, '#6a6440', ['rgba(80,70,40,.45)', 'rgba(120,115,70,.4)', 'rgba(70,72,40,.45)', 'rgba(140,130,100,.4)'], 2600, 7), 40, 28),
    village: () => canvasTex(256, (g, n) => {
      speckle(g, n, '#776a4c', ['rgba(95,85,60,.5)', 'rgba(130,118,88,.45)', 'rgba(80,90,50,.35)'], 2200, 21);
      const r = rng(4);
      for (let i = 0; i < 70; i++) { const c = 110 + r() * 40; g.fillStyle = `rgba(${c},${c * 0.95},${c * 0.85},.55)`; g.beginPath(); g.ellipse(r() * n, r() * n, 5 + r() * 6, 4 + r() * 5, r() * 3, 0, TAU); g.fill(); }
    }, 40, 28),
    snow: () => canvasTex(256, (g, n) => {
      speckle(g, n, '#e9edf2', ['rgba(200,210,222,.5)', 'rgba(255,255,255,.7)', 'rgba(185,195,210,.35)'], 2600, 31, 5);
      const r = rng(8); for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(170,180,195,.25)'; g.lineWidth = 2; g.beginPath(); const x = r() * n, y = r() * n; g.moveTo(x, y); g.lineTo(x + 30 * r(), y + 8 * r()); g.stroke(); }
    }, 30, 20),
    sand: () => canvasTex(256, (g, n) => {
      speckle(g, n, '#cdb683', ['rgba(180,160,110,.45)', 'rgba(225,210,170,.5)', 'rgba(160,140,95,.35)'], 3000, 41, 3);
      const r = rng(6); for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(170,150,105,.3)'; g.lineWidth = 2; g.beginPath(); const y = r() * n; g.moveTo(0, y); for (let x = 0; x <= n; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 4); g.stroke(); }
    }, 34, 24),
    brick: () => canvasTex(128, (g, n) => {
      g.fillStyle = '#857a68'; g.fillRect(0, 0, n, n);
      const r = rng(3);
      for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
        const x = col * 32 + (row % 2) * 16, y = row * 16, c = 110 + r() * 40;
        g.fillStyle = `rgb(${c},${c * 0.9},${c * 0.78})`; g.fillRect(x + 1, y + 1, 30, 14); g.fillRect(x - 127, y + 1, 30, 14);
      }
      for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(40,30,20,.25)'; g.fillRect(r() * n, r() * n, 2, 2); }
    }),
    plaster: () => canvasTex(256, (g, n) => {
      speckle(g, n, '#cbbd9b', ['rgba(180,165,130,.5)', 'rgba(215,205,180,.5)', 'rgba(150,135,105,.3)'], 1800, 51, 5);
      const r = rng(12);
      for (let i = 0; i < 5; i++) { // exposed brick where plaster fell off
        const x = r() * n, y = r() * n, w = 30 + r() * 50, h = 18 + r() * 30;
        for (let by = 0; by < h; by += 8) for (let bx = 0; bx < w; bx += 16) { const c = 120 + r() * 40; g.fillStyle = `rgb(${c},${c * 0.75},${c * 0.6})`; g.fillRect(x + bx + (by % 16 ? 8 : 0), y + by, 14, 6); }
      }
      g.fillStyle = '#5a4026'; g.fillRect(0, 0, n, 8); g.fillRect(0, n - 10, n, 10); // timber beams
      g.fillRect(n / 2 - 4, 0, 8, n);
      g.fillStyle = 'rgba(60,50,40,.35)'; g.fillRect(0, n - 30, n, 20); // grime
    }),
    wood: () => canvasTex(128, (g, n) => {
      g.fillStyle = '#8a6234'; g.fillRect(0, 0, n, n);
      const r = rng(11);
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#7d5730' : '#916838'; g.fillRect(0, i * 32 + 1, n, 30); }
      for (let i = 0; i < 160; i++) { g.strokeStyle = 'rgba(60,40,20,.35)'; g.beginPath(); const y = r() * n; g.moveTo(0, y); g.lineTo(n, y + (r() - 0.5) * 6); g.stroke(); }
      g.strokeStyle = '#4e3418'; g.lineWidth = 8; g.strokeRect(4, 4, n - 8, n - 8);
      g.beginPath(); g.moveTo(8, 8); g.lineTo(n - 8, n - 8); g.stroke();
    }),
    logs: () => canvasTex(128, (g, n) => {
      g.fillStyle = '#5b3f26'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 6; i++) { const y = i * (n / 6); const gr = g.createLinearGradient(0, y, 0, y + n / 6); gr.addColorStop(0, '#3e2a18'); gr.addColorStop(0.5, '#7a5634'); gr.addColorStop(1, '#3a2615'); g.fillStyle = gr; g.fillRect(0, y, n, n / 6); }
      const r = rng(19); for (let i = 0; i < 120; i++) { g.strokeStyle = 'rgba(30,20,10,.3)'; g.beginPath(); const y = r() * n; g.moveTo(r() * n, y); g.lineTo(r() * n, y + 1); g.stroke(); }
    }),
    concrete: () => canvasTex(128, (g, n) => {
      g.fillStyle = '#8c887c'; g.fillRect(0, 0, n, n);
      const r = rng(5);
      for (let i = 0; i < 900; i++) { const c = 100 + r() * 70; g.fillStyle = `rgba(${c},${c},${c * 0.95},.35)`; g.fillRect(r() * n, r() * n, 2 + r() * 3, 2 + r() * 3); }
      g.fillStyle = 'rgba(50,45,40,.3)'; g.fillRect(0, n - 10, n, 10);
    }),
    stone: () => canvasTex(128, (g, n) => {
      g.fillStyle = '#7d786d'; g.fillRect(0, 0, n, n);
      const r = rng(23);
      for (let i = 0; i < 40; i++) { const c = 95 + r() * 60; g.fillStyle = `rgb(${c},${c * 0.97},${c * 0.9})`; g.beginPath(); g.ellipse(r() * n, r() * n, 8 + r() * 12, 6 + r() * 9, r() * 3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(40,38,34,.5)'; g.stroke(); }
    }),
    rock: () => canvasTex(128, (g, n) => speckle(g, n, '#7b7a74', ['rgba(60,60,58,.5)', 'rgba(150,148,140,.45)', 'rgba(100,96,88,.4)'], 1500, 61, 6)),
    snowrock: () => canvasTex(128, (g, n) => { speckle(g, n, '#9da3ab', ['rgba(230,236,242,.8)', 'rgba(120,125,132,.5)'], 1500, 71, 7); g.fillStyle = 'rgba(240,244,248,.85)'; g.fillRect(0, 0, n, n * 0.3); }),
    jungle: () => canvasTex(128, (g, n) => speckle(g, n, '#2f4a24', ['rgba(60,95,40,.6)', 'rgba(25,40,18,.6)', 'rgba(90,120,55,.4)'], 2500, 81, 6)),
    bag: () => canvasTex(64, (g, n) => speckle(g, n, '#b09a6b', ['rgba(120,100,60,.4)', 'rgba(200,185,140,.3)'], 300, 9, 2)),
    gravel: () => canvasTex(256, (g, n) => speckle(g, n, '#6f6a60', ['rgba(90,86,78,.6)', 'rgba(140,134,120,.5)', 'rgba(60,55,50,.5)', 'rgba(110,80,55,.35)'], 4200, 101, 3), 40, 28),
    dock: () => canvasTex(256, (g, n) => {
      speckle(g, n, '#7d7b74', ['rgba(100,98,92,.5)', 'rgba(140,138,130,.4)'], 1800, 111, 4);
      g.strokeStyle = 'rgba(50,48,44,.6)'; g.lineWidth = 2;
      for (let i = 0; i <= n; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, n); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(n, i); g.stroke(); }
      g.fillStyle = 'rgba(40,36,30,.25)'; const r = rng(113); for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(r() * n, r() * n, 10 + r() * 20, 6 + r() * 10, r() * 3, 0, TAU); g.fill(); }
    }, 38, 26),
    boxcar: () => canvasTex(256, (g, n) => {
      g.fillStyle = '#6e2e1f'; g.fillRect(0, 0, n, n);
      for (let x = 0; x < n; x += 10) { g.fillStyle = x % 20 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.04)'; g.fillRect(x, 0, 10, n); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, 0, 1, n); }
      g.fillStyle = '#3a2a22'; g.fillRect(n * 0.38, n * 0.12, n * 0.24, n * 0.88); // sliding door
      g.strokeStyle = '#1f1612'; g.lineWidth = 4; g.strokeRect(n * 0.38, n * 0.12, n * 0.24, n * 0.88);
      g.fillStyle = '#1e1e1e'; g.fillRect(0, 0, n, 10); g.fillRect(0, n - 14, n, 14);
      g.fillStyle = 'rgba(230,220,200,.75)'; g.font = 'bold 20px sans-serif'; g.fillText('No. ' + (1000 + Math.floor(Math.random() * 8999)), 12, 40);
      const r = rng(121); for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(140,70,30,.25)'; g.fillRect(r() * n, r() * n, 3, 2 + r() * 8); }
    }),
    corrugated: () => canvasTex(128, (g, n) => {
      for (let x = 0; x < n; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, '#6d6a62'); gr.addColorStop(0.5, '#8d8a80'); gr.addColorStop(1, '#5a5850'); g.fillStyle = gr; g.fillRect(x, 0, 8, n); }
      const r = rng(131); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${120 + r() * 40},${60 + r() * 20},20,.35)`; g.beginPath(); g.ellipse(r() * n, r() * n, 4 + r() * 12, 8 + r() * 20, 0, 0, TAU); g.fill(); }
    }),
    palisade: () => canvasTex(128, (g, n) => {
      for (let x = 0; x < n; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#3b2a1a'); gr.addColorStop(0.5, '#7a5a3a'); gr.addColorStop(1, '#3a2817'); g.fillStyle = gr; g.fillRect(x, 0, 16, n); }
      g.fillStyle = 'rgba(30,20,10,.5)'; g.fillRect(0, n * 0.3, n, 5); g.fillRect(0, n * 0.75, n, 5); // lashings
    }),
    planks: () => canvasTex(128, (g, n) => {
      g.fillStyle = '#6a4b2e'; g.fillRect(0, 0, n, n);
      for (let y = 0; y < n; y += 16) { g.fillStyle = y % 32 ? '#5d4128' : '#73532f'; g.fillRect(0, y, n, 15); g.fillStyle = 'rgba(20,12,6,.6)'; g.fillRect(0, y + 15, n, 1); }
      const r = rng(141); for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(20,12,6,.7)'; g.fillRect(r() * n, Math.floor(r() * 8) * 16 + 7, 2, 2); }
    }),
    coal: () => canvasTex(64, (g, n) => speckle(g, n, '#1c1b1a', ['rgba(60,60,62,.6)', 'rgba(10,10,10,.6)', 'rgba(90,90,95,.3)'], 600, 151, 4)),
    lawn: () => canvasTex(256, (g, n) => speckle(g, n, '#58723a', ['rgba(70,100,45,.55)', 'rgba(110,140,70,.45)', 'rgba(45,70,30,.5)', 'rgba(140,130,80,.25)'], 4500, 161, 3), 40, 28),
    asphalt: () => canvasTex(256, (g, n) => speckle(g, n, '#3d3c3a', ['rgba(70,68,64,.6)', 'rgba(30,30,30,.6)', 'rgba(90,88,84,.35)'], 3500, 171, 3)),
    siding: () => canvasTex(128, (g, n) => {
      g.fillStyle = '#d9d2bf'; g.fillRect(0, 0, n, n);
      for (let y = 0; y < n; y += 10) { const gr = g.createLinearGradient(0, y, 0, y + 10); gr.addColorStop(0, '#ece6d4'); gr.addColorStop(0.85, '#cfc7b2'); gr.addColorStop(1, '#8f8876'); g.fillStyle = gr; g.fillRect(0, y, n, 10); }
      const r = rng(181); for (let i = 0; i < 80; i++) { g.fillStyle = 'rgba(90,80,60,.18)'; g.fillRect(r() * n, r() * n, 6 + r() * 20, 2); }
      g.fillStyle = 'rgba(70,60,45,.35)'; g.fillRect(0, n - 14, n, 14);
    }),
    storefront: () => canvasTex(256, (g, n) => {
      g.fillStyle = '#8a4a32'; g.fillRect(0, 0, n, n);
      const r = rng(191);
      for (let row = 0; row < 32; row++) for (let col = 0; col < 8; col++) { const c = 115 + r() * 35; g.fillStyle = `rgb(${c},${c * 0.6},${c * 0.45})`; g.fillRect(col * 32 + (row % 2) * 16 + 1, row * 8 + 1, 30, 6); }
      g.fillStyle = '#2f4a3a'; g.fillRect(0, 34, n, 36); // painted sign band
      g.fillStyle = '#d8d0b8'; g.fillRect(0, 0, n, 6);
    }),
    hedge: () => canvasTex(128, (g, n) => speckle(g, n, '#2c4a22', ['rgba(60,100,40,.65)', 'rgba(20,35,15,.6)', 'rgba(90,130,55,.45)'], 2600, 201, 6)),
    bagSnow: () => canvasTex(64, (g, n) => { speckle(g, n, '#a8987a', ['rgba(120,100,60,.4)', 'rgba(240,244,248,.6)'], 300, 9, 2); g.fillStyle = 'rgba(240,244,248,.7)'; g.fillRect(0, 0, n, n * 0.35); }),
  };
  TEX[name] = T[name]();
  return TEX[name];
}

// ---- per-map look
const THEMES = {
  ruins: { fog: 0xb4ae98, near: 600, far: 3200, sky: 0xcfd6db, gnd: 0x5a5034, hemi: 1.25, sun: 0xfff0d0, sunI: 2.0, ground: 'dirt', perim: 'concrete', craters: 40, craterCol: 0x3b3524, wall: 'brick' },
  village: { fog: 0xc8c1ad, near: 650, far: 3300, sky: 0xd8dcd8, gnd: 0x6a5a3a, hemi: 1.3, sun: 0xffe9c4, sunI: 2.1, ground: 'village', perim: 'stone', craters: 14, craterCol: 0x4a4030, wall: 'stone' },
  winter: { fog: 0xd3d9e1, near: 300, far: 2300, sky: 0xe8f0fa, gnd: 0x9aa2ad, hemi: 1.45, sun: 0xe6eeff, sunI: 1.3, ground: 'snow', perim: 'snowrock', craters: 10, craterCol: 0xaab2bd, wall: 'logs', snow: true, treeline: 'pine' },
  rail: { fog: 0xb8b2a6, near: 600, far: 3100, sky: 0xd0d2d2, gnd: 0x5a5244, hemi: 1.2, sun: 0xffe6c0, sunI: 1.9, ground: 'gravel', perim: 'brick', craters: 18, craterCol: 0x3a3630, wall: 'brick' },
  harbor: { fog: 0xa9b5bc, near: 500, far: 2900, sky: 0xc6d2da, gnd: 0x5c5e5c, hemi: 1.25, sun: 0xf2f0e8, sunI: 1.6, ground: 'dock', perim: 'brick', craters: 10, craterCol: 0x3e3c38, wall: 'brick' },
  town: { fog: 0xc9d3d9, near: 700, far: 3300, sky: 0xdde8f0, gnd: 0x6a6a48, hemi: 1.35, sun: 0xfff1d6, sunI: 2.3, ground: 'lawn', perim: 'hedge', craters: 6, craterCol: 0x4a4430, wall: 'brick' },
  camp: { fog: 0xc8bf9f, near: 700, far: 3200, sky: 0xd9d8c8, gnd: 0x6a5a3a, hemi: 1.3, sun: 0xfff0cc, sunI: 2.1, ground: 'dirt', perim: 'palisade', craters: 12, craterCol: 0x4a3f2a, wall: 'planks' },
  island: { fog: 0xbcd6e2, near: 800, far: 3600, sky: 0xd6eefb, gnd: 0xa08f62, hemi: 1.3, sun: 0xfff2d6, sunI: 2.5, ground: 'sand', perim: 'jungle', craters: 22, craterCol: 0x8a7a52, wall: 'concrete', treeline: 'palm' },
};
const M = {
  bag: new THREE.MeshLambertMaterial({ map: null }),
  metal: new THREE.MeshStandardMaterial({ color: 0x2a2b2c, metalness: 0.7, roughness: 0.45 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x18191a, metalness: 0.5, roughness: 0.6 }),
  nade: new THREE.MeshStandardMaterial({ color: 0x38452a, roughness: 0.7 }),
  skin: new THREE.MeshLambertMaterial({ color: 0xc99d78 }),
  bark: new THREE.MeshLambertMaterial({ color: 0x4a3626 }),
  palmBark: new THREE.MeshLambertMaterial({ color: 0x8a7556 }),
  pine: new THREE.MeshLambertMaterial({ color: 0x24402c }),
  pineSnow: new THREE.MeshLambertMaterial({ color: 0xeef3f8 }),
  frond: new THREE.MeshLambertMaterial({ color: 0x3f6b2a, side: THREE.DoubleSide }),
  fence: new THREE.MeshLambertMaterial({ color: 0x6b5236 }),
  water: new THREE.MeshLambertMaterial({ color: 0x9fb8c0 }),
  canal: new THREE.MeshStandardMaterial({ color: 0x2d4a52, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.92 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x45474a, roughness: 0.6, metalness: 0.6 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 0.4, metalness: 0.8 }),
  sleeper: new THREE.MeshLambertMaterial({ color: 0x3e2f22 }),
  tank: new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.7, metalness: 0.3 }),
  trim: new THREE.MeshLambertMaterial({ color: 0xefeadc }),
  glass: new THREE.MeshStandardMaterial({ color: 0x2a3a44, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.35 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.2, metalness: 1 }),
  flower: new THREE.MeshLambertMaterial({ color: 0xc0405a }),
};
function wallMat(name, w, h) { const t = tex(name).clone(); t.needsUpdate = true; t.repeat.set(w, h); return new THREE.MeshLambertMaterial({ map: t }); }

let worldGroup = null, worldMapId = null, snowPts = null;
function disposeGroup(g) {
  const shared = Object.values(M), sharedTex = Object.values(TEX);
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !shared.includes(o.material)) { if (o.material.map && !sharedTex.includes(o.material.map)) o.material.map.dispose(); o.material.dispose(); }
  });
}

function pineTree(g, x, z, h, snowy, r) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, h * 0.45, 8), M.bark); trunk.position.set(x, h * 0.22, z); trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cr = (2.6 - i * 0.6) * r * 1.6, ch = h * 0.36, y = h * (0.3 + i * 0.22);
    const c = new THREE.Mesh(new THREE.ConeGeometry(cr, ch, 9), M.pine); c.position.set(x, y + ch / 2, z); c.rotation.y = i; c.castShadow = true; g.add(c);
    if (snowy) { const sn = new THREE.Mesh(new THREE.ConeGeometry(cr * 0.8, ch * 0.45, 9), M.pineSnow); sn.position.set(x, y + ch * 0.8, z); sn.rotation.y = i + 0.5; g.add(sn); }
  }
}
function palmTree(g, x, z, h, r, seed) {
  const rr = rng(seed);
  const lean = (rr() - 0.5) * 0.5, dir = rr() * TAU;
  let px = x, pz = z, py = 0;
  const segs = 6;
  for (let i = 0; i < segs; i++) { // gently curving trunk
    const len = h / segs, t = i / segs;
    const dx = Math.cos(dir) * Math.sin(lean * t * 2) * len, dz = Math.sin(dir) * Math.sin(lean * t * 2) * len;
    const sgm = new THREE.Mesh(new THREE.CylinderGeometry(r * (0.85 - t * 0.3), r * (1 - t * 0.3), len * 1.04, 8), M.palmBark);
    sgm.position.set(px + dx / 2, py + len / 2, pz + dz / 2);
    sgm.lookAt(px + dx, py + len, pz + dz); sgm.rotateX(Math.PI / 2); sgm.castShadow = true; g.add(sgm);
    px += dx; pz += dz; py += len;
  }
  for (let i = 0; i < 8; i++) { // fronds
    const a = (i / 8) * TAU + rr() * 0.3;
    const f = new THREE.Mesh(new THREE.ConeGeometry(9, 90, 4, 1, true), M.frond);
    f.scale.set(1, 1, 0.18);
    f.position.set(px + Math.cos(a) * 38, py - 14, pz + Math.sin(a) * 38);
    f.rotation.set(0, -a, 0); f.rotateZ(-Math.PI / 2 - 0.45);
    f.castShadow = true; g.add(f);
  }
}

function buildWorld(mapId) {
  if (worldMapId === mapId) return;
  const map = S.useMap(mapId);
  worldMapId = mapId;
  if (worldGroup) { scene.remove(worldGroup); disposeGroup(worldGroup); }
  if (snowPts) { scene.remove(snowPts); snowPts.geometry.dispose(); snowPts = null; }
  const th = THEMES[map.theme] || THEMES.ruins;
  const g = new THREE.Group();
  worldGroup = g;
  scene.background = new THREE.Color(th.fog);
  scene.fog = new THREE.Fog(th.fog, th.near, th.far);
  hemi.color.setHex(th.sky); hemi.groundColor.setHex(th.gnd); hemi.intensity = th.hemi;
  sun.color.setHex(th.sun); sun.intensity = th.sunI;
  const gt = tex(th.ground);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S.MAP_W + 3000, S.MAP_H + 3000), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(S.MAP_W / 2, 0, S.MAP_H / 2); ground.receiveShadow = true;
  g.add(ground);
  const r = rng(42 + mapId.length);
  const craterMat = new THREE.MeshLambertMaterial({ color: th.craterCol, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < th.craters; i++) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(20 + r() * 40, 18), craterMat);
    c.rotation.x = -Math.PI / 2; c.position.set(r() * S.MAP_W, 0.3 + i * 0.01, r() * S.MAP_H); c.receiveShadow = true;
    g.add(c);
  }
  const bags = [];
  for (const w of S.WALLS) {
    const cx = w.x + w.w / 2, cz = w.y + w.h / 2;
    if (w.k === 'sand') {
      const horiz = w.w >= w.h, len = horiz ? w.w : w.h, dep = horiz ? w.h : w.w;
      const n = Math.max(1, Math.round(len / 24)), rows = Math.round(w.ht / 11.5), cols = Math.max(1, Math.round(dep / 17));
      for (let ry = 0; ry < rows; ry++) for (let c = 0; c < cols; c++) for (let i = 0; i < n; i++) {
        const along = (i + 0.5 + (ry % 2 ? 0.25 : -0.25)) * (len / n); if (along > len) continue;
        const across = (c + 0.5) * (dep / cols);
        bags.push({ x: horiz ? w.x + along : w.x + across, z: horiz ? w.y + across : w.y + along, y: 5.8 + ry * 11, rot: horiz ? 0 : Math.PI / 2, sx: len / n / 2 + 1.5, sz: dep / cols / 2 + 1 });
      }
      continue;
    }
    if (w.k === 'tree') {
      if (map.theme === 'island') palmTree(g, cx, cz, 250 + r() * 60, w.w / 2, Math.floor(cx * 7 + cz));
      else pineTree(g, cx, cz, 300 + r() * 80, map.theme === 'winter', w.w / 2);
      continue;
    }
    if (w.k === 'log') {
      const horiz = w.w >= w.h, len = horiz ? w.w : w.h, rad = w.ht / 3.2;
      for (const [o, y] of [[-rad, rad], [rad, rad], [0, rad * 2.6]]) {
        const lg = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 10), wallMat('logs', 1, 1));
        lg.rotation.z = Math.PI / 2; if (!horiz) lg.rotation.y = Math.PI / 2;
        lg.position.set(cx + (horiz ? 0 : o * 0.9), y, cz + (horiz ? o * 0.9 : 0)); lg.castShadow = lg.receiveShadow = true; g.add(lg);
      }
      if (map.theme === 'winter') { const sn = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 6, 3, horiz ? 6 : len), M.pineSnow); sn.position.set(cx, rad * 3.6 + 1, cz); g.add(sn); }
      continue;
    }
    if (w.k === 'rock') {
      const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), wallMat(map.theme === 'winter' ? 'snowrock' : 'rock', 2, 2));
      rk.scale.set(w.w * 0.62, w.ht * 0.75, w.h * 0.62); rk.position.set(cx, w.ht * 0.42, cz); rk.rotation.y = r() * 3;
      rk.castShadow = rk.receiveShadow = true; g.add(rk);
      if (map.theme === 'village') { // the square's fountain
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(w.w * 0.62, w.w * 0.66, 22, 20), wallMat('stone', 3, 0.4)); basin.position.set(cx, 11, cz); g.add(basin);
        const water = new THREE.Mesh(new THREE.CircleGeometry(w.w * 0.55, 20), M.water); water.rotation.x = -Math.PI / 2; water.position.set(cx, 20, cz); g.add(water);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 70, 10), wallMat('stone', 1, 1)); col.position.set(cx, 35, cz); g.add(col);
        rk.visible = false;
      }
      continue;
    }
    if (w.k === 'fence') {
      const horiz = w.w >= w.h, len = horiz ? w.w : w.h;
      for (let i = 0; i <= Math.round(len / 30); i++) { const t = i / Math.round(len / 30); const post = new THREE.Mesh(new THREE.BoxGeometry(5, w.ht, 5), M.fence); post.position.set(horiz ? w.x + t * len : cx, w.ht / 2, horiz ? cz : w.y + t * len); post.castShadow = true; g.add(post); }
      for (const y of [w.ht * 0.35, w.ht * 0.8]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 3, 5, horiz ? 3 : len), M.fence); rail.position.set(cx, y, cz); rail.castShadow = true; g.add(rail); }
      continue;
    }
    if (w.k === 'water') {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(w.w, 4, w.h), new THREE.MeshLambertMaterial({ color: 0x202a2c })); bed.position.set(cx, -1.5, cz); g.add(bed);
      const wt = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h), M.canal); wt.rotation.x = -Math.PI / 2; wt.position.set(cx, 0.8, cz); g.add(wt);
      for (const side of [-1, 1]) { const edge = new THREE.Mesh(new THREE.BoxGeometry(8, 8, w.h), wallMat('concrete', 0.2, w.h / 100)); edge.position.set(cx + side * (w.w / 2 + 4), 4, cz); edge.receiveShadow = true; g.add(edge); }
      continue;
    }
    if (w.k === 'boxcar') {
      const horiz = w.w >= w.h, len = horiz ? w.w : w.h, dep = horiz ? w.h : w.w;
      const body = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : dep, w.ht - 16, horiz ? dep : len), wallMat('boxcar', 1, 1));
      body.position.set(cx, 16 + (w.ht - 16) / 2, cz); body.castShadow = body.receiveShadow = true; g.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry((horiz ? len : dep) + 4, 5, (horiz ? dep : len) + 6), M.steel); roof.position.set(cx, w.ht + 1, cz); roof.castShadow = true; g.add(roof);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len - 10 : dep - 8, 8, horiz ? dep - 8 : len - 10), M.dark); frame.position.set(cx, 12, cz); g.add(frame);
      for (const a of [-0.38, -0.25, 0.25, 0.38]) for (const sd of [-1, 1]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 4, 14), M.steel); wh.rotation.x = Math.PI / 2; if (!horiz) wh.rotation.z = Math.PI / 2;
        wh.position.set(cx + (horiz ? a * len : sd * dep * 0.42), 7, cz + (horiz ? sd * dep * 0.42 : a * len)); g.add(wh);
      }
      continue;
    }
    if (w.k === 'coal') {
      const heap = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w.w, w.h) * 0.62, w.ht, 10), new THREE.MeshLambertMaterial({ map: tex('coal') }));
      heap.scale.set(1, 1, w.h / w.w); heap.position.set(cx, w.ht / 2, cz); heap.castShadow = heap.receiveShadow = true; g.add(heap);
      continue;
    }
    if (w.k === 'post') {
      const pst = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.ht, w.h), map.theme === 'camp' ? wallMat('logs', 1, 3) : M.steel); pst.position.set(cx, w.ht / 2, cz); pst.castShadow = true; g.add(pst);
      continue;
    }
    if (w.k === 'cargo') {
      const r2 = rng(Math.floor(cx * 3 + cz));
      const lw = w.w, lh = w.h, cols = [0x5d6b3e, 0x6b4a2e, 0x4b5a6a, 0x7a5a34];
      for (let lvl = 0; lvl < 2; lvl++) {
        const bx = new THREE.Mesh(new THREE.BoxGeometry(lw - lvl * 10, w.ht / 2 - 1, lh - lvl * 10), lvl ? new THREE.MeshLambertMaterial({ map: tex('wood'), color: cols[Math.floor(r2() * 4)] }) : wallMat('wood', 1, 1));
        bx.position.set(cx + (r2() - 0.5) * 6 * lvl, w.ht / 4 + lvl * w.ht / 2, cz + (r2() - 0.5) * 6 * lvl); bx.rotation.y = (r2() - 0.5) * 0.12 * lvl; bx.castShadow = bx.receiveShadow = true; g.add(bx);
      }
      continue;
    }
    if (w.k === 'window') { // sill + lintel + frame: shoot or jump through
      const horiz = w.w >= w.h, len = horiz ? w.w : w.h, dep = horiz ? w.h : w.w;
      const wallTex = map.theme === 'town' ? (cx < S.MAP_W / 2 ? 'siding' : 'storefront') : 'plaster';
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.ht, w.h), wallMat(wallTex, len / 140, w.ht / 170)); sill.position.set(cx, w.ht / 2, cz); sill.castShadow = sill.receiveShadow = true; g.add(sill);
      const top = 170 - 112;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(w.w, top, w.h), wallMat(wallTex, len / 140, top / 170)); lintel.position.set(cx, 112 + top / 2, cz); lintel.castShadow = true; g.add(lintel);
      const fr = (a, b, c, x, y, z) => { const m2 = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), M.trim); m2.position.set(x, y, z); g.add(m2); };
      fr(horiz ? len + 6 : dep + 4, 4, horiz ? dep + 4 : len + 6, cx, w.ht + 2, cz);
      fr(horiz ? len + 6 : dep + 4, 4, horiz ? dep + 4 : len + 6, cx, 112, cz);
      for (const sd of [-1, 1]) fr(horiz ? 4 : dep + 4, 74, horiz ? dep + 4 : 4, cx + (horiz ? sd * len / 2 : 0), 75, cz + (horiz ? 0 : sd * len / 2));
      continue;
    }
    if (w.k === 'hedge') {
      const hd = new THREE.Mesh(new THREE.BoxGeometry(w.w + 6, w.ht, w.h + 6), new THREE.MeshLambertMaterial({ map: tex('hedge') })); hd.position.set(cx, w.ht / 2, cz); hd.castShadow = hd.receiveShadow = true; g.add(hd);
      continue;
    }
    if (w.k === 'planter') {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.ht, w.h), wallMat('brick', Math.max(w.w, w.h) / 60, 0.6)); pl.position.set(cx, w.ht / 2, cz); pl.castShadow = pl.receiveShadow = true; g.add(pl);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(w.w - 8, 4, w.h - 8), new THREE.MeshLambertMaterial({ color: 0x3a2a1a })); soil.position.set(cx, w.ht, cz); g.add(soil);
      const n = Math.floor(Math.max(w.w, w.h) / 22);
      for (let i = 0; i < n; i++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(5, 6, 5), i % 3 ? M.frond : M.flower); const t = (i + 0.5) / n; fl.position.set(w.w > w.h ? w.x + t * w.w : cx, w.ht + 5, w.w > w.h ? cz : w.y + t * w.h); g.add(fl); }
      continue;
    }
    if (w.k === 'car' || w.k === 'truck') {
      const horiz = w.w >= w.h, len = horiz ? w.w : w.h, wid = horiz ? w.h : w.w;
      const grp = new THREE.Group(); grp.position.set(cx, 0, cz); if (!horiz) grp.rotation.y = Math.PI / 2;
      const r2 = rng(Math.floor(cx + cz * 3));
      const paint = new THREE.MeshStandardMaterial({ color: w.k === 'truck' ? 0x3f5a3a : [0x2b3a5a, 0x6a2a24, 0x2f4a3a, 0x1e1e20][Math.floor(r2() * 4)], roughness: 0.35, metalness: 0.5 });
      const add = (geo, mat, x, y, z) => { const m2 = new THREE.Mesh(geo, mat); m2.position.set(x, y, z); m2.castShadow = true; grp.add(m2); return m2; };
      if (w.k === 'car') {
        add(new THREE.BoxGeometry(len, 22, wid), paint, 0, 20, 0);
        add(new THREE.BoxGeometry(len * 0.5, 20, wid - 6), paint, -len * 0.08, 41, 0);
        add(new THREE.BoxGeometry(len * 0.46, 15, wid - 4), M.glass, -len * 0.08, 41, 0);
        add(new THREE.BoxGeometry(6, 8, wid - 10), M.chrome, len / 2, 20, 0);
      } else {
        add(new THREE.BoxGeometry(len * 0.66, w.ht - 14, wid), new THREE.MeshLambertMaterial({ color: 0x7a6a4a }), -len * 0.17, (w.ht - 14) / 2 + 14, 0); // cargo box
        add(new THREE.BoxGeometry(len * 0.32, 48, wid - 4), paint, len * 0.34, 38, 0); // cab
        add(new THREE.BoxGeometry(4, 16, wid - 12), M.glass, len * 0.5, 50, 0);
      }
      for (const a of [-0.32, 0.32]) for (const sd of [-1, 1]) { const tire = add(new THREE.CylinderGeometry(10, 10, 6, 14), M.tire, a * len, 10, sd * (wid / 2 - 2)); tire.rotation.x = Math.PI / 2; }
      g.add(grp);
      continue;
    }
    let mat;
    if (w.k === 'house' && map.theme === 'town') mat = wallMat('siding', Math.max(w.w, w.h) / 140, w.ht / 170);
    else if (w.k === 'store') mat = wallMat('storefront', Math.max(w.w, w.h) / 300, 1);
    else if (w.k === 'shed' || w.k === 'warehouse') mat = wallMat('corrugated', Math.max(w.w, w.h) / 60, w.ht / 100);
    else if (w.k === 'palisade') mat = wallMat('palisade', Math.max(w.w, w.h) / 64, 1);
    else if (w.k === 'hut') mat = wallMat('planks', Math.max(w.w, w.h) / 100, w.ht / 100);
    else if (w.k === 'crate') mat = wallMat('wood', Math.max(1, Math.round(Math.max(w.w, w.h) / 50)), Math.max(1, Math.round(w.ht / 50)));
    else if (w.k === 'house') mat = wallMat('plaster', Math.max(w.w, w.h) / 140, w.ht / 170);
    else if (w.k === 'bunker') mat = wallMat('concrete', Math.max(w.w, w.h) / 100, w.ht / 100);
    else mat = wallMat(th.wall, Math.max(w.w, w.h) / 64, w.ht / 64);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.ht, w.h), mat);
    m.position.set(cx, w.ht / 2, cz); m.castShadow = m.receiveShadow = true; g.add(m);
    if (w.k === 'palisade') { // pointed log tops
      const horiz = w.w >= w.h, len = horiz ? w.w : w.h, n = Math.floor(len / 16);
      const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(8, 18, 6), M.bark, n);
      const mt = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; mt.makeTranslation(horiz ? w.x + t * len : cx, w.ht + 9, horiz ? cz : w.y + t * len); tips.setMatrixAt(i, mt); }
      g.add(tips);
    }
    if (w.k === 'shed' || w.k === 'warehouse' || w.k === 'hut') { const cap = new THREE.Mesh(new THREE.BoxGeometry(w.w + 4, 6, w.h + 4), w.k === 'hut' ? wallMat('planks', 1, 0.1) : M.steel); cap.position.set(cx, w.ht + 3, cz); cap.castShadow = true; g.add(cap); }
    if (w.k === 'wall' || w.k === 'house' || w.k === 'bunker' || w.k === 'store') {
      const capMat = map.theme === 'winter' ? M.pineSnow : wallMat(w.k === 'house' ? 'wood' : 'concrete', 2, 0.2);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w.w + 4, w.k === 'bunker' ? 10 : 6, w.h + 4), capMat);
      cap.position.set(cx, w.ht + (w.k === 'bunker' ? 5 : 3), cz); cap.castShadow = true; g.add(cap);
    }
  }
  if (bags.length) {
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshLambertMaterial({ map: tex(map.theme === 'winter' ? 'bagSnow' : 'bag') }), bags.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    bags.forEach((b, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot + (r() - 0.5) * 0.1); sc.set(b.sx, 6.3, b.sz); pos.set(b.x, b.y, b.z); mtx.compose(pos, q, sc); inst.setMatrixAt(i, mtx); });
    inst.castShadow = inst.receiveShadow = true; g.add(inst);
  }
  // set pieces
  for (const pr of map.props || []) {
    if (pr.type === 'rails') {
      for (const off of [-12, 12]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(S.MAP_W - 600, 3, 3), M.rail); rl.position.set(S.MAP_W / 2, 1.5, pr.y + off); rl.receiveShadow = true; g.add(rl); }
      const n = Math.floor((S.MAP_W - 600) / 26), sl = new THREE.InstancedMesh(new THREE.BoxGeometry(8, 2, 40), M.sleeper, n), mt = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { mt.makeTranslation(300 + i * 26, 0.8, pr.y); sl.setMatrixAt(i, mt); }
      sl.receiveShadow = true; g.add(sl);
    } else if (pr.type === 'watertower') {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(64, 64, 80, 24), M.tank); tank.position.set(pr.x, 340, pr.y); tank.castShadow = true; g.add(tank);
      const top = new THREE.Mesh(new THREE.ConeGeometry(70, 34, 24), M.steel); top.position.set(pr.x, 397, pr.y); top.castShadow = true; g.add(top);
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(72, 72, 4, 24), M.steel); deck.position.set(pr.x, 300, pr.y); g.add(deck);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const br = new THREE.Mesh(new THREE.BoxGeometry(dx ? 4 : 94, 4, dz ? 4 : 94), M.steel); br.position.set(pr.x + dx * 47, 150, pr.y + dz * 47); g.add(br); }
    } else if (pr.type === 'tower') {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(96, 8, 96), wallMat('planks', 1, 1)); deck.position.set(pr.x, 200, pr.y); deck.castShadow = true; g.add(deck);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(dx ? 4 : 96, 30, dz ? 4 : 96), wallMat('planks', 1, 0.3)); rl.position.set(pr.x + dx * 46, 219, pr.y + dz * 46); g.add(rl); }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(80, 40, 4), wallMat('planks', 1, 1)); roof.rotation.y = Math.PI / 4; roof.position.set(pr.x, 290, pr.y); roof.castShadow = true; g.add(roof);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(6, 60, 6), wallMat('logs', 1, 1)); pl.position.set(pr.x + dx * 42, 260, pr.y + dz * 42); g.add(pl); }
    } else if (pr.type === 'street') {
      const st2 = new THREE.Mesh(new THREE.PlaneGeometry(pr.x1 - pr.x0, 900), new THREE.MeshLambertMaterial({ map: tex('asphalt') }));
      st2.rotation.x = -Math.PI / 2; st2.position.set((pr.x0 + pr.x1) / 2, 0.4, 800); st2.receiveShadow = true; g.add(st2);
      for (const x of [pr.x0, pr.x1]) { const curb = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 900), wallMat('concrete', 0.2, 6)); curb.position.set(x, 2, 800); curb.receiveShadow = true; g.add(curb); }
      for (let y = 380; y < 1240; y += 60) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(4, 30), new THREE.MeshBasicMaterial({ color: 0xe8d890 })); ln.rotation.x = -Math.PI / 2; ln.position.set((pr.x0 + pr.x1) / 2, 0.6, y); g.add(ln); }
      for (const [x, y] of [[pr.x0 - 30, 420], [pr.x1 + 30, 1180], [pr.x0 - 30, 1180], [pr.x1 + 30, 420]]) { // street lamps
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 180, 8), M.steel); pole.position.set(x, 90, y); g.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c0 })); lamp.position.set(x, 182, y); g.add(lamp);
      }
      // store awning on the store's street-facing side
      const aw = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 300), new THREE.MeshLambertMaterial({ color: 0xa83a32 })); aw.position.set(S.MAP_W - 600 - 300 - 10, 120, 690); aw.rotation.z = 0.35; g.add(aw);
      const sc = document.createElement('canvas'); sc.width = 512; sc.height = 96;
      const sg = sc.getContext('2d'); sg.fillStyle = '#2f4a3a'; sg.fillRect(0, 0, 512, 96); sg.strokeStyle = '#d8c890'; sg.lineWidth = 6; sg.strokeRect(6, 6, 500, 84);
      sg.fillStyle = '#efe2b8'; sg.font = 'bold 54px serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText('GENERAL STORE', 256, 50);
      const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(200, 38), new THREE.MeshLambertMaterial({ map: stex }));
      sign.rotation.y = -Math.PI / 2; sign.position.set(S.MAP_W - 600 - 300 - 4, 148, 690); g.add(sign);
    } else if (pr.type === 'bridge') {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(pr.w + 40, 6, pr.h), wallMat('planks', 1, 1)); deck.position.set(pr.x + pr.w / 2, 3, pr.y + pr.h / 2); deck.receiveShadow = true; g.add(deck);
      for (const sd of [0, 1]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(pr.w + 40, 4, 4), M.steel); rl.position.set(pr.x + pr.w / 2, 30, pr.y + sd * pr.h); g.add(rl); for (const px of [0, 0.5, 1]) { const po = new THREE.Mesh(new THREE.BoxGeometry(4, 30, 4), M.steel); po.position.set(pr.x - 20 + px * (pr.w + 40), 15, pr.y + sd * pr.h); g.add(po); } }
    }
  }
  // perimeter + tree line beyond it
  const per = 180;
  for (const [x, z, w, d] of [[S.MAP_W / 2, -20, S.MAP_W + 80, 40], [S.MAP_W / 2, S.MAP_H + 20, S.MAP_W + 80, 40], [-20, S.MAP_H / 2, 40, S.MAP_H], [S.MAP_W + 20, S.MAP_H / 2, 40, S.MAP_H]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, per, d), wallMat(th.perim, Math.max(w, d) / 128, per / 128));
    m.position.set(x, per / 2, z); m.receiveShadow = true; g.add(m);
  }
  if (th.treeline) {
    const tr = rng(99);
    for (let i = 0; i < 70; i++) {
      const side = i % 4, t = tr();
      const x = side < 2 ? t * S.MAP_W : side === 2 ? -80 - tr() * 160 : S.MAP_W + 80 + tr() * 160;
      const z = side >= 2 ? t * S.MAP_H : side === 0 ? -80 - tr() * 160 : S.MAP_H + 80 + tr() * 160;
      if (th.treeline === 'pine') pineTree(g, x, z, 380 + tr() * 140, true, 16); else palmTree(g, x, z, 300 + tr() * 120, 13, i * 13);
    }
  }
  // spawn flags
  for (const [x, col] of [[60, 0x3d6fb0], [S.MAP_W - 60, 0xb03a30]]) {
    for (const z of [300, 1300]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 160, 6), M.metal); pole.position.set(x, 80, z); g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(50, 30), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }));
      flag.position.set(x + (x < 100 ? 25 : -25), 140, z); g.add(flag);
    }
  }
  scene.add(g);
  // falling snow
  if (th.snow) {
    const N = isTouch ? 1500 : 3500, arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { arr[i * 3] = (Math.random() - 0.5) * 1400; arr[i * 3 + 1] = Math.random() * 500; arr[i * 3 + 2] = (Math.random() - 0.5) * 1400; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    snowPts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, transparent: true, opacity: 0.85, depthWrite: false }));
    snowPts.frustumCulled = false;
    scene.add(snowPts);
  }
  buildObjectives(mapId, currentMode);
}
function updateSnow(dt, now) {
  if (!snowPts) return;
  const a = snowPts.geometry.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) {
    a[i + 1] -= (40 + (i % 7) * 6) * dt; a[i] += Math.sin(now / 900 + i) * 8 * dt;
    if (a[i + 1] < 0) { a[i + 1] = 500; a[i] = (Math.random() - 0.5) * 1400; a[i + 2] = (Math.random() - 0.5) * 1400; }
  }
  snowPts.geometry.attributes.position.needsUpdate = true;
  snowPts.position.set(camera.position.x, 0, camera.position.z);
}

// ---- objectives in the world
let objGroup = null, objMapId = null, objModeId = null, currentMode = 'tdm', objState = null;
const objView = { dom: [], flags: [], hq: null, markers: [] };
const TEAMHEX = { 0: 0xd8d3c0, 1: 0x4f8fe0, 2: 0xd9483b };
function markerSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.fillStyle = 'rgba(0,0,0,.55)'; g.fill(); g.lineWidth = 8; g.strokeStyle = color; g.stroke();
  g.font = 'bold 58px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(text, 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
  s2.scale.set(0.075, 0.075, 1); s2.renderOrder = 20;
  return s2;
}
function setMarker(s2, text, color) { const n = markerSprite(text, color); s2.material.map.dispose(); s2.material.map = n.material.map; n.material.dispose(); }
function flagMesh(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 110, 8), M.metal); pole.position.y = 55; g.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(42, 26, 8, 2), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  cloth.position.set(21, 96, 0); g.add(cloth);
  g.userData.cloth = cloth;
  return g;
}
function ringMesh(r, color, opacity) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r - 8, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity || 0.75, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.y = 1.5;
  return m;
}
function buildObjectives(mapId, mode) {
  if (objGroup) { scene.remove(objGroup); disposeGroup(objGroup); }
  objMapId = mapId; objModeId = mode;
  objView.dom = []; objView.flags = []; objView.hq = null;
  const map = S.MAPS[mapId];
  const g = new THREE.Group(); objGroup = g;
  if (mode === 'dom') {
    map.dom.forEach((pt, i) => {
      const f = flagMesh(TEAMHEX[0]); f.position.set(pt.x, 0, pt.y); g.add(f);
      const ring = ringMesh(100, TEAMHEX[0]); ring.position.x = pt.x; ring.position.z = pt.y; g.add(ring);
      const mk = markerSprite('ABC'[i], '#d8d3c0'); mk.position.set(pt.x, 150, pt.y); g.add(mk);
      objView.dom.push({ flag: f, ring, mk, owner: -1 });
    });
  } else if (mode === 'ctf') {
    for (const [ti, team] of [[1, 'allies'], [2, 'axis']]) {
      const home = map.flags[team];
      const base = ringMesh(46, TEAMHEX[ti], 0.9); base.position.x = home.x; base.position.z = home.y; g.add(base);
      const f = flagMesh(TEAMHEX[ti]); f.position.set(home.x, 0, home.y); g.add(f);
      const mk = markerSprite('⚑', ti === 1 ? '#4f8fe0' : '#d9483b'); mk.position.set(home.x, 150, home.y); g.add(mk);
      objView.flags.push({ flag: f, mk, team });
    }
  } else if (mode === 'hq') {
    const zone = new THREE.Mesh(new THREE.CylinderGeometry(140, 140, 70, 48, 1, true), new THREE.MeshBasicMaterial({ color: TEAMHEX[0], transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    zone.position.y = 35; g.add(zone);
    const ring = ringMesh(140, TEAMHEX[0], 0.85); g.add(ring);
    const mk = markerSprite('HQ', '#d8d3c0'); g.add(mk);
    objView.hq = { zone, ring, mk, holder: -1, idx: -1 };
  }
  scene.add(g);
}
function updateObjectives3D(now, players) {
  if (!objGroup) return;
  const ob = objState, map = S.MAPS[objMapId];
  if (objModeId === 'dom' && ob && ob.p) {
    ob.p.forEach(([owner], i) => {
      const v = objView.dom[i]; if (!v) return;
      if (v.owner !== owner) {
        v.owner = owner;
        v.flag.userData.cloth.material.color.setHex(TEAMHEX[owner]); v.ring.material.color.setHex(TEAMHEX[owner]);
        setMarker(v.mk, 'ABC'[i], owner === 1 ? '#4f8fe0' : owner === 2 ? '#d9483b' : '#d8d3c0');
      }
    });
  } else if (objModeId === 'ctf' && ob && ob.f) {
    ob.f.forEach(([state, x, y, carrier], i) => {
      const v = objView.flags[i]; if (!v) return;
      let px = x, py = y, lift = 0;
      if (state === 1) { const c = carrier === myId ? { x: pred.x, y: pred.y } : players.get(carrier); if (c) { px = c.x; py = c.y; lift = 30; } }
      v.flag.position.set(px, lift, py);
      v.flag.visible = !(state === 1 && carrier === myId);
      v.mk.position.set(px, 150, py);
    });
  } else if (objModeId === 'hq' && ob && objView.hq) {
    const v = objView.hq, z = map.hq[ob.z];
    if (v.idx !== ob.z) { v.idx = ob.z; v.zone.position.x = v.ring.position.x = z.x; v.zone.position.z = v.ring.position.z = z.y; v.mk.position.set(z.x, 160, z.y); }
    const h = ob.c ? 3 : ob.h;
    if (v.holder !== h) {
      v.holder = h; const col = h === 3 ? 0xf0c040 : TEAMHEX[h];
      v.zone.material.color.setHex(col); v.ring.material.color.setHex(col);
      setMarker(v.mk, 'HQ', h === 1 ? '#4f8fe0' : h === 2 ? '#d9483b' : h === 3 ? '#f0c040' : '#d8d3c0');
    }
    v.zone.material.opacity = 0.14 + Math.sin(now / 300) * 0.05;
  }
  for (const f of objView.dom.concat(objView.flags)) { const cl = f.flag.userData.cloth; cl.rotation.y = Math.sin(now / 400 + f.flag.position.x) * 0.25; }
}

// ============================================================ small mesh helpers
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function limb(a, b, t, mat) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), mat);
  m.position.copy(a).lerp(b, 0.5); m.lookAt(b);
  return m;
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
let vm = null;
let adsT = 0, vmSwap = 0, vmFlash = 0, vmMelee = 0, bobPhase = 0, movingNow = false, crouchOn = false, crouchT = 0;
let proneOn = false, jumpHeld = false, eyeSmooth = 60, landDip = 0, wasAir = false, slideTilt = 0, crouchDownAt = 0;
const myEye = () => pred.z + S.eyeHeight(pred.stance);
let lastStateAt = 0, reloadP = 0;
const rec = { z: 0, rx: 0, ry: 0, rz: 0, vz: 0, vrx: 0, vry: 0, vrz: 0 };
const sway = { x: 0, y: 0, lastYaw: 0, lastPitch: 0 };
const VM_HIP = new THREE.Vector3(7, -7.6, -18.5), VM_HIP_PISTOL = new THREE.Vector3(5.4, -5.8, -14);
const skinMat = new THREE.MeshStandardMaterial({ color: 0xc0906a, roughness: 0.62 });
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const armGeo = new THREE.CylinderGeometry(1, 0.82, 1, 14); armGeo.rotateX(Math.PI / 2); armGeo.translate(0, 0, 0.5);
function sleeveMat(team) { return new THREE.MeshStandardMaterial({ color: team === 'axis' ? 0x5a6162 : 0x666b3c, roughness: 0.95 }); }
function setArm(m, a, b, r) { const d = tmpA.subVectors(b, a); const len = d.length(); m.position.copy(a); m.quaternion.setFromUnitVectors(Z_AXIS, d.normalize()); m.scale.set(r, r, len); }
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
// a finger segment between two points (gun-local, relative to the hand)
function seg(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
  const f = new THREE.Mesh(new THREE.CapsuleGeometry(r || 0.36, Math.max(0.1, len - (r || 0.36) * 2), 4, 8), skinMat);
  f.position.copy(a).lerp(b, 0.5); f.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
  return f;
}
const P3 = (x, y, z) => new THREE.Vector3(x, y, z);
function makeRightHand() { // grips a pistol grip / stock wrist: palm on the right, fingers wrap round to the left side
  const h = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skinMat); palm.scale.set(1.5, 2.1, 0.8); palm.position.set(-0.7, -0.2, 1.35); h.add(palm);
  for (let i = 0; i < 3; i++) { // middle, ring, little finger
    const y = -0.1 - i * 0.95, s2 = i === 2 ? 0.85 : 1;
    h.add(seg(P3(0.2, y, 1.25), P3(1.25, y, 0.6), 0.37));
    h.add(seg(P3(1.25, y, 0.6), P3(1.1, y - 0.1, -0.9 * s2), 0.35));
    h.add(seg(P3(1.1, y - 0.1, -0.9 * s2), P3(0.2, y - 0.2, -1.3 * s2), 0.32));
  }
  h.add(seg(P3(0.3, 1.0, 1.2), P3(1.6, 1.35, 0.5), 0.36)); // index finger on the trigger
  h.add(seg(P3(1.6, 1.35, 0.5), P3(2.1, 1.0, 0.0), 0.33));
  h.add(seg(P3(-1.2, 0.9, 1.2), P3(-0.6, 1.5, -0.6), 0.42)); // thumb wraps over to the left side
  h.add(seg(P3(-0.6, 1.5, -0.6), P3(0.5, 1.0, -1.35), 0.38));
  h.rotation.z = -0.12;
  return h;
}
function makeLeftHand() { // cradles the fore-end from below: thumb up the left side, fingers up the right
  const h = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skinMat); palm.scale.set(2.1, 0.8, 1.5); palm.position.set(0, -0.35, 0); h.add(palm);
  for (let i = 0; i < 4; i++) { const x = -1.3 + i * 0.85; h.add(seg(P3(x, -0.2, 1.2), P3(x + 0.2, 1.1, 1.65), 0.36)); h.add(seg(P3(x + 0.2, 1.1, 1.65), P3(x + 0.3, 2.0, 1.25), 0.32)); }
  h.add(seg(P3(-0.6, -0.3, -1.2), P3(0.6, 0.6, -1.7), 0.42)); // thumb
  h.add(seg(P3(0.6, 0.6, -1.7), P3(1.6, 1.5, -1.5), 0.38));
  return h;
}
function buildViewmodel(id, atts, team) {
  const key = id + ':' + atts.join(',') + ':' + team;
  if (vm && vm.key === key) return;
  if (vm) vmScene.remove(vm.holder);
  const gun = Guns.makeGun(id, atts);
  const holder = new THREE.Group();
  gun.group.rotation.y = Math.PI / 2;
  holder.add(gun.group);
  const sleeve = sleeveMat(team);
  gun.group.position.z = gun.rightHand.x; // put the grip where your hand naturally is
  const rHand = makeRightHand(); rHand.position.copy(gun.rightHand); gun.group.add(rHand);
  const lHand = makeLeftHand(); lHand.position.copy(gun.leftHand); gun.group.add(lHand);
  if (gun.foregrip) lHand.rotation.x = -1.2;
  const rArm = new THREE.Mesh(armGeo, sleeve), lArm = new THREE.Mesh(armGeo, sleeve);
  gun.group.add(rArm, lArm);
  const rElbow = gun.rightHand.clone().add(new THREE.Vector3(-15, -8, 9));
  const lElbow = gun.pistol ? gun.leftHand.clone().add(new THREE.Vector3(-12, -8, -9)) : gun.leftHand.clone().add(new THREE.Vector3(-11, -12, -8));
  const tex = Guns.fxTextures();
  const mkFlash = (size) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flashStar, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.set(size, size, 1); sp.visible = false; return sp; };
  const flash = mkFlash(gun.pistol ? 5 : 8), flash2 = mkFlash(gun.pistol ? 3 : 5);
  flash.position.copy(gun.muzzle).add(new THREE.Vector3(2.2, 0, 0)); flash2.position.copy(gun.muzzle).add(new THREE.Vector3(4.5, 0, 0));
  gun.group.add(flash, flash2);
  vmScene.add(holder);
  vm = { key, holder, gun, flash, flash2, rHand, lHand, rArm, lArm, rElbow, lElbow, rHandHome: gun.rightHand.clone() };
}
// world-space position of your muzzle (for tracers, smoke and the flash light)
function vmMuzzleWorld() {
  if (vm && vm.holder.visible) {
    vm.holder.updateMatrixWorld(true);
    const p = vm.gun.group.localToWorld(tmpC.copy(vm.gun.muzzle)); // viewmodel camera space
    const k = Math.tan(camera.fov * Math.PI / 360) / Math.tan(vmCamera.fov * Math.PI / 360); // match on-screen position
    p.x *= k; p.y *= k;
    return camera.localToWorld(p.clone());
  }
  const eyeH = myEye();
  const f = new THREE.Vector3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
  return new THREE.Vector3(pred.x, eyeH - 2, pred.y).addScaledVector(f, 30);
}
function vmImpulse(k) {
  const a = 1 - adsT * 0.45;
  rec.vz += (45 + k * 900) * a;
  rec.vrx += (2.5 + k * 70) * a;
  rec.vry += (Math.random() - 0.5) * (1 + k * 30) * a;
  rec.vrz += (Math.random() - 0.5) * (2 + k * 40) * a;
}
function vmShot(st, now) {
  vmImpulse(st.recoil);
  vmFlash = now;
  if (vm) Guns.onShot(vm.gun, now);
  if (!st.noFlash) {
    const p = vmMuzzleWorld();
    muzzleLight.position.copy(p); muzzleLight.intensity = 4000; muzzleLight.userData.t = now;
    vmMuzzleLight.intensity = 450; vmMuzzleLight.userData.t = now;
  }
  if (Math.random() < (st.auto ? 0.35 : 0.9)) puffSmoke(vmMuzzleWorld(), st.cls === 'Shotgun' || st.cls === 'Bolt-Action' ? 3 : 1);
}
const springStep = (x, v, dt) => { const a = -300 * x - 26 * v; v += a * dt; return [x + v * dt, v]; };
function updateRecoil(dt) {
  for (let i = 0; i < 2; i++) {
    const h = dt / 2;
    [rec.z, rec.vz] = springStep(rec.z, rec.vz, h);
    [rec.rx, rec.vrx] = springStep(rec.rx, rec.vrx, h);
    [rec.ry, rec.vry] = springStep(rec.ry, rec.vry, h);
    [rec.rz, rec.vrz] = springStep(rec.rz, rec.vrz, h);
  }
}
// ---- ejected casings (viewmodel space)
const casings = [];
let casingTpl = null, shellTpl = null;
function spawnCasings(n, kind) {
  if (!vm || !vm.gun.ejectPort) return;
  if (!casingTpl) { casingTpl = Guns.casingMesh(false); shellTpl = Guns.casingMesh(true); }
  vm.holder.updateMatrixWorld(true);
  const shell = !!vm.gun.shell;
  for (let i = 0; i < n; i++) {
    const m = (shell ? shellTpl : casingTpl).clone();
    m.position.copy(vm.gun.group.localToWorld(tmpB.copy(vm.gun.ejectPort)));
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    let vx = 20 + Math.random() * 12, vy = 14 + Math.random() * 9, vz = 3 + Math.random() * 4;
    if (kind === 'down') { vx = (Math.random() - 0.5) * 4; vy = -6 - Math.random() * 6; vz = 1; m.position.y -= i * 0.3; }
    if (kind === 'back') { vx = (Math.random() - 0.5) * 6; vy = 10 + Math.random() * 4; vz = 14; }
    vmScene.add(m);
    casings.push({ m, vx, vy, vz, sx: (Math.random() - 0.5) * 30, sy: (Math.random() - 0.5) * 30, t: performance.now() });
    setTimeout(() => mech(shell ? 'hull' : 'shell'), 380 + Math.random() * 260 + i * 60);
  }
}
function updateCasings(now, dt) {
  for (let i = casings.length - 1; i >= 0; i--) {
    const c = casings[i];
    if (now - c.t > 900) { vmScene.remove(c.m); casings.splice(i, 1); continue; }
    c.vy -= 85 * dt;
    c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt;
    c.m.rotation.x += c.sx * dt; c.m.rotation.y += c.sy * dt;
  }
}
// ---- muzzle smoke (world space)
const smokes = [];
function puffSmoke(pos, n) {
  const tex = Guns.fxTextures().smoke;
  for (let i = 0; i < n && smokes.length < 40; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.32 }));
    sp.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3));
    sp.scale.setScalar(5);
    scene.add(sp);
    smokes.push({ sp, t: performance.now(), life: 1400 + Math.random() * 800, vx: Math.cos(yaw) * 8 + (Math.random() - 0.5) * 6, vy: 6 + Math.random() * 6, vz: Math.sin(yaw) * 8 + (Math.random() - 0.5) * 6 });
  }
}
function updateSmoke(now, dt) {
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s2 = smokes[i]; const k = (now - s2.t) / s2.life;
    if (k >= 1) { scene.remove(s2.sp); s2.sp.material.dispose(); smokes.splice(i, 1); continue; }
    s2.sp.position.x += s2.vx * dt; s2.sp.position.y += s2.vy * dt; s2.sp.position.z += s2.vz * dt;
    s2.vx *= 0.97; s2.vz *= 0.97;
    s2.sp.scale.setScalar(5 + k * 26);
    s2.sp.material.opacity = 0.32 * (1 - k);
  }
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
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(root);
  return { root, legL, legR, upper, holder, uniMat: uni, gunKey: '', gun: null, flash, team, tag: null, tagName: '', walk: 0, lastX: 0, lastY: 0, deadAt: 0, flashAt: 0 };
}
function setSoldierGun(s, key) {
  if (s.gunKey === key) return;
  if (s.gun) s.holder.remove(s.gun.group);
  const [id, a] = key.split(':');
  const gun = Guns.mergeGun(Guns.makeGun(id, a ? a.split(',') : []));
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

const inGame = () => joined && $('loadoutScreen').classList.contains('hidden') && $('pause').classList.contains('hidden') && $('lobbyScreen').classList.contains('hidden') && $('settingsScreen').classList.contains('hidden');
function requestLock() { if (!isTouch && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } } }
document.addEventListener('pointerlockerror', () => { if (joined && inGame()) $('pause').classList.remove('hidden'); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && joined && !isTouch && $('loadoutScreen').classList.contains('hidden') && $('lobbyScreen').classList.contains('hidden')) $('pause').classList.remove('hidden');
  if (locked) $('pause').classList.add('hidden');
  mouseDown = mouseRight = false;
});
$('resume').addEventListener('click', () => { $('pause').classList.add('hidden'); requestLock(); });
$('pauseLoadout').addEventListener('click', () => { $('pause').classList.add('hidden'); toggleLoadout(true); });
$('pauseLeave').addEventListener('click', () => leaveMatch());

addEventListener('keydown', (e) => {
  if (rebinding) return;
  if (!joined) return;
  const act = actionFor(e.code);
  if (act === 'scores') { e.preventDefault(); toggleScores(true); return; }
  if (act === 'loadout') { toggleLoadout(); return; }
  if (!inGame()) return;
  keys[e.code] = true;
  if (act === 'jump' || act === 'holdCrouch' || e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Digit1' && you && you.slot === 1) send({ t: 'swap' });
  if (e.code === 'Digit2' && you && you.slot === 0) send({ t: 'swap' });
  switch (act) {
    case 'reload': send({ t: 'reload' }); break;
    case 'swap': send({ t: 'swap' }); break;
    case 'grenade': send({ t: 'nade' }); break;
    case 'melee': send({ t: 'melee' }); break;
    case 'rifleNade': send({ t: 'rg' }); break;
    case 'crouch': crouchDownAt = performance.now(); if (proneOn) { proneOn = false; crouchOn = true; } else crouchOn = !crouchOn; break;
    case 'prone': proneOn = !proneOn; if (proneOn) crouchOn = false; break;
    case 'jump': pressJump(); break;
    case 'sprint': crouchOn = false; proneOn = false; break;
    case 'ks1': useStreak('recon'); break;
    case 'ks2': useStreak('air'); break;
    case 'ks3': useStreak('mortar'); break;
  }
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  const act = actionFor(e.code);
  if (act === 'scores') toggleScores(false);
  if (act === 'crouch') crouchDownAt = 0;
  if (act === 'jump') jumpHeld = false;
});
// Jump: from prone you rise to a crouch, from a crouch you stand, standing you jump.
function pressJump() {
  if (proneOn) { proneOn = false; crouchOn = true; return; }
  if (crouchOn) { crouchOn = false; return; }
  jumpHeld = true;
  setTimeout(() => { if (!keys[settings.binds.jump]) jumpHeld = false; }, 120);
}
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = mouseRight = false; fireBtns.clear(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', () => { if (inGame() && locked) send({ t: 'swap' }); }, { passive: true });

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (e.pointerType === 'mouse') {
    if (!locked && joined && inGame()) requestLock();
    return; // buttons are tracked with mousedown/mouseup below
  }
  e.preventDefault();
  if (e.clientX < innerWidth * 0.4 && !moveStick) moveStick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  else lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
// Mouse buttons: pointer events only report the FIRST button pressed (holding aim and then clicking
// fire produced no event), so use mousedown/mouseup, which fire for every button. Buttons are also
// released when the window loses focus or the mouse lock ends, so none can get stuck.
let adsMode = loadSaved('fl_adsMode', 'hold'), adsLatched = false;
// Send the trigger pull to the server immediately instead of waiting for the next frame.
function pullTrigger() {
  if (!you || !you.alive) return;
  send({ t: 'in', l: [], a: +yaw.toFixed(4), p: +pitch.toFixed(4), f: true, pull: 1 });
  lastFireSent = true;
}
function releaseTrigger() {
  if (!lastFireSent || mouseDown || fireBtns.size) return;
  send({ t: 'in', l: [], a: +yaw.toFixed(4), p: +pitch.toFixed(4), f: false });
  lastFireSent = false;
}
document.addEventListener('mousedown', (e) => {
  if (!locked || !inGame()) return;
  if (e.button === 0) { mouseDown = true; pullTrigger(); }
  if (e.button === 2) { mouseRight = true; if (adsMode === 'toggle') adsLatched = !adsLatched; }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) { mouseDown = false; releaseTrigger(); }
  if (e.button === 2) mouseRight = false;
});
addEventListener('mousemove', (e) => {
  if (!locked || !inGame()) return;
  const k = 0.0022 * sens * lookScale();
  yaw += e.movementX * k;
  pitch = S.clamp(pitch - e.movementY * k * (settings.invertY ? -1 : 1), -1.45, 1.45);
});
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') return;
  if (moveStick && moveStick.id === e.pointerId) { moveStick.x = e.clientX; moveStick.y = e.clientY; return; }
  const lp = lookPointers.get(e.pointerId);
  if (lp && inGame()) {
    const k = 0.0055 * sens * lookScale() * (assistTarget ? 0.55 : 1);
    yaw += (e.clientX - lp.x) * k;
    pitch = S.clamp(pitch - (e.clientY - lp.y) * k * (settings.invertY ? -1 : 1), -1.45, 1.45);
    lp.x = e.clientX; lp.y = e.clientY;
  }
});
function endPointer(e) {
  if (e.pointerType === 'mouse') return;
  if (moveStick && moveStick.id === e.pointerId) moveStick = null;
  lookPointers.delete(e.pointerId);
  if (fireBtns.has(e.pointerId)) { fireBtns.delete(e.pointerId); if (!fireBtns.size) { $('tFire').classList.remove('on'); $('tFire2').classList.remove('on'); releaseTrigger(); } }
}
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);
function lookScale() { const st = myStats(); return adsT > 0.5 ? (st.zoom > 1 ? 0.28 : 0.65) * settings.adsSens : 1; }

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
for (const id of ['tFire', 'tFire2']) bindBtn(id, (b, e) => { fireBtns.add(e.pointerId); lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); b.classList.add('on'); pullTrigger(); });
bindBtn('tAds', (b) => { adsToggle = !adsToggle; b.classList.toggle('on', adsToggle); });
bindBtn('tCrouch', () => {
  crouchDownAt = performance.now();
  if (proneOn) { proneOn = false; crouchOn = true; } else crouchOn = !crouchOn;
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('tCrouch').addEventListener(ev, () => { crouchDownAt = 0; });
bindBtn('tJump', () => pressJump());
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
  const md = S.MODES[currentMode] || S.MODES.tdm;
  let html = `<h2>${esc(md.name)} &mdash; ${esc((S.MAPS[objMapId] || S.MAPS.ruins).name)} &middot; first to ${match.sl || md.def} ${md.unit}</h2><div class="sb">`;
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
  const inLobby = !$('lobbyScreen').classList.contains('hidden');
  el.classList.toggle('hidden', !show);
  $('switchTeam').classList.toggle('hidden', inLobby);
  $('leave').classList.toggle('hidden', inLobby);
  $('loadoutTag').textContent = inLobby ? 'Your loadout for the next match.' : 'Changes apply on your next respawn.';
  if (show) { $('pause').classList.add('hidden'); gameLoadout.render(); if (document.pointerLockElement) document.exitPointerLock(); }
  else if (joined && !isTouch && !inLobby) requestLock();
  fireBtns.clear(); mouseDown = false;
}
$('loadoutSave').addEventListener('click', () => {
  const inLobby = !$('lobbyScreen').classList.contains('hidden');
  send({ t: 'loadout', loadout }); toggleLoadout(false);
  if (!inLobby) centerMsg = { text: 'Loadout saved\nApplies on respawn', t: performance.now() };
});
$('switchTeam').addEventListener('click', () => { send({ t: 'team' }); toggleLoadout(false); });
$('leave').addEventListener('click', leaveMatch);
function leaveMatch() { leaving = true; if (ws) ws.close(); else showMenu(''); }

function loadoutSummary() {
  const p = S.WEAPONS[loadout.primary], sc = S.WEAPONS[loadout.secondary];
  const a = loadout.atts.map((x) => S.ATTACHMENTS[x].name).join(' + ');
  $('loadoutSummary').innerHTML = `Loadout: <b>${esc(p.name)}</b>${a ? ' (' + esc(a) + ')' : ''} &middot; <b>${esc(sc.name)}</b>`;
}
function showMenu(err) {
  joined = false;
  lobbyInfo = null; lastLobbyState = null;
  if (document.pointerLockElement) document.exitPointerLock();
  for (const id of [...soldiers.keys()]) removeSoldier(id);
  for (const f of flights) for (const pl of f.planes) scene.remove(pl);
  flights.length = 0; shells.length = 0;
  showScreen('menu');
  $('err').textContent = err || '';
  loadoutSummary();
}
function goFullscreen(toggle) {
  const d = document;
  if (toggle && d.fullscreenElement) { d.exitFullscreen(); return; }
  const el = d.documentElement;
  const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
  if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
}
function phoneFullscreen() { if (isTouch && !matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) goFullscreen(false); }

// ---- main menu
$('btnQuick').addEventListener('click', () => { phoneFullscreen(); online(() => send({ t: 'join', name: playerName(), room: 'PUBLIC', quick: true, bots: 4, loadout })); });
$('btnCreate').addEventListener('click', () => { showScreen('createScreen'); if (!$('lobbyName').value) $('lobbyName').placeholder = playerName() + "'s lobby"; });
$('btnBrowse').addEventListener('click', () => { showScreen('browseScreen'); refreshLobbies(); browseTimer = setInterval(refreshLobbies, 4000); });
$('offline').addEventListener('click', () => { phoneFullscreen(); playOffline(); });
$('btnArmory').addEventListener('click', () => { showScreen('armory'); menuLoadout.render(); });
$('btnSettings').addEventListener('click', () => openSettings());
$('ksPanel').addEventListener('click', (e) => { const b = e.target.closest('button[data-ks]'); if (b) useStreak(b.dataset.ks); });
$('pauseSettings').addEventListener('click', () => { $('pause').classList.add('hidden'); openSettings(); });
$('loadoutSettings').addEventListener('click', () => { $('loadoutScreen').classList.add('hidden'); openSettings(); });

let rebinding = null;
function openSettings() {
  if (document.pointerLockElement) document.exitPointerLock();
  $('settingsScreen').classList.remove('hidden');
  renderBinds();
  $('adsSens').value = settings.adsSens; $('adsSensVal').textContent = (+settings.adsSens).toFixed(2);
  $('invertY').checked = !!settings.invertY;
  $('fovSet').value = settings.fov; $('fovVal').textContent = settings.fov;
  $('volSet').value = settings.volume; $('volVal').textContent = Math.round(settings.volume * 100) + '%';
  $('quality').value = settings.quality;
}
function closeSettings() {
  rebinding = null;
  $('settingsScreen').classList.add('hidden');
  if (!joined) return;
  if (!$('lobbyScreen').classList.contains('hidden')) return;
  if (!isTouch) { $('pause').classList.remove('hidden'); }
}
$('settingsBack').addEventListener('click', closeSettings);
for (const b of document.querySelectorAll('#settingsTabs button')) b.addEventListener('click', () => {
  for (const o of document.querySelectorAll('#settingsTabs button')) o.classList.toggle('on', o === b);
  for (const t of document.querySelectorAll('#settingsScreen .tab')) t.classList.toggle('hidden', t.id !== 'tab-' + b.dataset.tab);
});
function renderBinds() {
  const el = $('bindList');
  el.innerHTML = Object.keys(DEFAULT_BINDS).map((a) => `<div class="bind-row"><span>${esc(BIND_LABELS[a])}</span><button data-bind="${a}" class="${rebinding === a ? 'wait' : ''}">${rebinding === a ? 'Press a key…' : esc(keyName(settings.binds[a]))}</button></div>`).join('');
  for (const b of el.querySelectorAll('button[data-bind]')) b.addEventListener('click', () => { rebinding = b.dataset.bind; renderBinds(); });
}
// while rebinding, the next key press is captured before the game sees it
addEventListener('keydown', (e) => {
  if (!rebinding) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code !== 'Escape') {
    const old = settings.binds[rebinding], other = actionFor(e.code);
    if (other && other !== rebinding) settings.binds[other] = old; // swap with whatever used that key
    settings.binds[rebinding] = e.code;
    saveSettings();
  }
  rebinding = null; renderBinds(); updateHelp();
}, true);
$('resetBinds').addEventListener('click', () => { settings.binds = Object.assign({}, DEFAULT_BINDS); saveSettings(); renderBinds(); updateHelp(); });
$('adsSens').addEventListener('input', () => { settings.adsSens = +$('adsSens').value; $('adsSensVal').textContent = settings.adsSens.toFixed(2); saveSettings(); });
$('invertY').addEventListener('change', () => { settings.invertY = $('invertY').checked; saveSettings(); });
$('fovSet').addEventListener('input', () => { settings.fov = +$('fovSet').value; $('fovVal').textContent = settings.fov; saveSettings(); });
$('volSet').addEventListener('input', () => { settings.volume = +$('volSet').value; $('volVal').textContent = Math.round(settings.volume * 100) + '%'; if (master) master.gain.value = settings.volume; saveSettings(); });
$('quality').addEventListener('change', () => { settings.quality = $('quality').value; saveSettings(); $('qualityNote').textContent = 'Restart the game (reload the page or reopen the app) to apply.'; });
function updateHelp() {
  if (isTouch) return;
  const k = (a) => keyName(settings.binds[a]);
  $('controlsHelp').innerHTML = `Click to lock the mouse &middot; ${k('forward')}${k('left')}${k('back')}${k('right')} move &middot; Left click fire &middot; Right click aim &middot; ${k('sprint')} sprint &middot; ${k('jump')} jump &middot; ${k('crouch')} crouch / slide (hold: prone) &middot; ${k('prone')} prone &middot; ${k('reload')} reload &middot; ${k('swap')} swap &middot; ${k('grenade')} grenade &middot; ${k('melee')} melee &middot; ${k('ks1')}/${k('ks2')}/${k('ks3')} killstreaks &middot; ${k('scores')} scores &middot; change keys in Settings`;
}
updateHelp();
$('armoryBack').addEventListener('click', () => showMenu(''));
$('server').value = loadSaved('fl_server', '');
if (servedOverHttp) $('server').placeholder = 'Leave empty to use this site (' + location.host + ')';
if (!window.Sim) $('offline').classList.add('hidden');
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnQuick').click(); });

// ---- create lobby
const BOT_OPTS = [0, 1, 2, 3, 4, 5, 6, 7], TIME_OPTS = [5, 10, 15, 20, 30];
function fillSelect(el, opts, val, label) { el.innerHTML = opts.map((o) => `<option value="${o}"${String(o) === String(val) ? ' selected' : ''}>${label(o)}</option>`).join(''); }
const botLabel = (o) => o === 0 ? 'No bots' : o + ' per team';
const mapLabel = (id) => S.MAPS[id].name, modeLabel = (id) => S.MODES[id].name;
const scoreLabel = (mode) => (o) => o + ' ' + S.MODES[mode].unit;
fillSelect($('cBots'), BOT_OPTS, 4, botLabel);
fillSelect($('cMap'), S.MAP_IDS, 'ruins', mapLabel);
fillSelect($('cMode'), S.MODE_IDS, 'tdm', modeLabel);
const fillScores = (el, mode, val) => fillSelect(el, S.MODES[mode].scores, val == null ? S.MODES[mode].def : val, scoreLabel(mode));
fillScores($('cScore'), 'tdm');
fillSelect($('cTime'), TIME_OPTS, 10, (o) => o + ' min');
$('cMode').addEventListener('change', () => { fillScores($('cScore'), $('cMode').value); $('cModeDesc').textContent = S.MODES[$('cMode').value].desc; });
$('cMap').addEventListener('change', () => buildWorld($('cMap').value));
$('cModeDesc').textContent = S.MODES.tdm.desc;
fillSelect($('offMap'), S.MAP_IDS, loadSaved('fl_offMap', 'ruins'), mapLabel);
fillSelect($('offMode'), S.MODE_IDS, loadSaved('fl_offMode', 'tdm'), modeLabel);
$('offMap').addEventListener('change', () => { save('fl_offMap', $('offMap').value); buildWorld($('offMap').value); });
$('offMode').addEventListener('change', () => save('fl_offMode', $('offMode').value));
$('createBack').addEventListener('click', () => showMenu(''));
$('createGo').addEventListener('click', () => {
  phoneFullscreen();
  online(() => send({ t: 'create', name: playerName(), lobbyName: $('lobbyName').value.trim() || $('lobbyName').placeholder,
    bots: +$('cBots').value, score: +$('cScore').value, time: +$('cTime').value, priv: $('cPriv').checked, map: $('cMap').value, mode: $('cMode').value, loadout }));
});

// ---- lobby browser
let browseTimer = null;
function refreshLobbies() { online(() => send({ t: 'list' })); }
function joinLobby(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) { showErr('Type a lobby code first.'); return; }
  phoneFullscreen();
  online(() => send({ t: 'join', name: playerName(), room: code, loadout }));
}
function renderLobbyList(m) {
  const el = $('lobbyList');
  const rows = m.list.map((l) => `<div class="lobby-row"><div class="info"><div class="nm">${esc(l.name)}${l.state === 'lobby' ? '<span class="badge">Waiting</span>' : '<span class="badge live">In match</span>'}</div>
    <div class="meta">${esc(S.MODES[l.mode] ? S.MODES[l.mode].name : '')} on ${esc(S.MAPS[l.map] ? S.MAPS[l.map].name : '')} &middot; Host ${esc(l.host)} &middot; ${l.players}/${l.max} players &middot; ${l.bots ? l.bots + ' bots/team' : 'no bots'} &middot; first to ${l.score} &middot; ${l.time} min &middot; code ${esc(l.code)}</div></div>
    <button data-code="${esc(l.code)}"${l.players >= l.max ? ' disabled' : ''}>JOIN</button></div>`);
  rows.push(`<div class="lobby-row"><div class="info"><div class="nm">Quick Play</div><div class="meta">Public drop-in match, rotating maps and modes &middot; ${m.quick} playing</div></div><button data-quick="1">PLAY</button></div>`);
  el.innerHTML = (m.list.length ? '' : '<p class="tag">No open lobbies right now. Create one from the main menu!</p>') + rows.join('');
  for (const b of el.querySelectorAll('button[data-code]')) b.addEventListener('click', () => joinLobby(b.dataset.code));
  for (const b of el.querySelectorAll('button[data-quick]')) b.addEventListener('click', () => $('btnQuick').click());
}
$('joinGo').addEventListener('click', () => joinLobby($('joinCode').value));
$('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinLobby($('joinCode').value); });
$('browseRefresh').addEventListener('click', refreshLobbies);
$('browseBack').addEventListener('click', () => showMenu(''));

// ---- lobby room
function renderLobby() {
  const L = lobbyInfo;
  if (!L || $('lobbyScreen').classList.contains('hidden')) return;
  const isHost = L.host === myId;
  const me = L.players.find((p) => p.i === myId);
  const humans = L.players.filter((p) => !p.b);
  const ready = humans.filter((p) => p.r).length;
  $('lbName').textContent = L.name;
  $('lbCode').textContent = L.code;
  $('lbPriv').innerHTML = L.priv ? '<span class="badge">Private</span>' : '<span class="badge">Public</span>';
  $('lbStatus').textContent = L.state === 'lobby'
    ? `${ready} of ${humans.length} ready · ${isHost ? 'You are the host: press START MATCH when everyone is set.' : 'Waiting for the host to start the match...'}`
    : L.state === 'playing' ? 'Match in progress...' : 'Match over: returning to the lobby...';
  let html = '';
  for (const t of ['allies', 'axis']) {
    const list = L.players.filter((p) => p.t === t).sort((a, b) => a.b - b.b);
    html += `<div class="${t}"><h3>${t.toUpperCase()} <span class="tagx">${((n) => n + (n === 1 ? ' player' : ' players'))(list.filter((p) => !p.b).length)}</span></h3><table>`;
    for (const p of list) {
      html += `<tr class="${p.i === myId ? 'me' : ''}"><td>${esc(p.n.replace(' [BOT]', ''))}${p.i === L.host ? '<span class="tagx">&#9733; host</span>' : ''}${p.b ? '<span class="tagx">bot</span>' : ''}</td>`
        + `<td class="rd">${p.b ? '' : p.r ? '&#10003; READY' : ''}</td>`
        + `<td class="kick">${isHost && !p.b && p.i !== myId ? `<button data-kick="${p.i}" title="Remove from lobby">&#10005;</button>` : ''}</td></tr>`;
    }
    if (!list.length) html += '<tr><td class="tagx">Empty</td></tr>';
    html += '</table></div>';
  }
  $('lbTeams').innerHTML = html;
  for (const b of $('lbTeams').querySelectorAll('button[data-kick]')) b.addEventListener('click', () => send({ t: 'kick', id: +b.dataset.kick }));
  // settings
  const st = L.settings;
  const box = $('lbSettings');
  if (isHost) {
    if (!box.dataset.host || document.activeElement === null || !box.contains(document.activeElement)) {
      box.dataset.host = '1';
      box.innerHTML = `<div class="lo-label">Match settings (host)</div><div class="row">
        <label>Map<select id="hMap"></select></label><label>Mode<select id="hMode"></select></label></div>
        <p class="lo-desc">${esc(S.MODES[st.mode].desc)}</p><div class="row">
        <label>Bots per team<select id="hBots"></select></label><label>Score limit<select id="hScore"></select></label><label>Time limit<select id="hTime"></select></label></div>
        <label class="check"><input type="checkbox" id="hPriv"${L.priv ? ' checked' : ''}> Private lobby</label>`;
      fillSelect($('hMap'), S.MAP_IDS, st.map, mapLabel);
      fillSelect($('hMode'), S.MODE_IDS, st.mode, modeLabel);
      fillSelect($('hBots'), BOT_OPTS, st.bots, botLabel);
      fillScores($('hScore'), st.mode, st.score);
      fillSelect($('hTime'), TIME_OPTS, st.time, (o) => o + ' min');
      const push = () => send({ t: 'settings', s: { map: $('hMap').value, mode: $('hMode').value, bots: +$('hBots').value, score: +$('hScore').value, time: +$('hTime').value, priv: $('hPriv').checked } });
      for (const id of ['hMap', 'hMode', 'hBots', 'hScore', 'hTime', 'hPriv']) $(id).addEventListener('change', () => { push(); $(id).blur(); });
    }
  } else {
    box.dataset.host = '';
    box.innerHTML = `<div class="lo-label">Match settings</div><div class="ro"><b>${esc(S.MODES[st.mode].name)}</b> on <b>${esc(S.MAPS[st.map].name)}</b> &middot; ${st.bots ? st.bots + ' bots per team' : 'No bots'} &middot; first to ${st.score} ${S.MODES[st.mode].unit} &middot; ${st.time} minute limit</div><p class="lo-desc">${esc(S.MODES[st.mode].desc)}</p>`;
  }
  const inLobby = L.state === 'lobby';
  $('lbReady').classList.toggle('hidden', !inLobby);
  $('lbReady').textContent = me && me.r ? 'NOT READY' : 'READY';
  $('lbReady').classList.toggle('alt', !!(me && me.r));
  $('lbStart').classList.toggle('hidden', !(isHost && inLobby));
}
$('lbReady').addEventListener('click', () => send({ t: 'ready' }));
$('lbStart').addEventListener('click', () => { initAudio(); send({ t: 'start' }); });
$('lbTeam').addEventListener('click', () => send({ t: 'team' }));
$('lbLoadout').addEventListener('click', () => toggleLoadout(true));
$('lbLeave').addEventListener('click', leaveMatch);
$('lbCopy').addEventListener('click', () => {
  const code = lobbyInfo ? lobbyInfo.code : '';
  const done = () => { $('lbCopy').textContent = 'Copied!'; setTimeout(() => { $('lbCopy').textContent = 'Copy'; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => {}); else done();
});
loadoutSummary();

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
    out.set(id, { ...pb, x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k, z: (pa.z || 0) + ((pb.z || 0) - (pa.z || 0)) * k, a: pa.a + da * k, q: pa.q + (pb.q - pa.q) * k });
  }
  return out;
}

// aim assist (touch): find an enemy close to the crosshair
let assistTarget = null;
function findAssist(players) {
  assistTarget = null;
  if (!isTouch || !you || !you.alive) return;
  const eye = myEye();
  let best = 0.09 + adsT * 0.06;
  for (const [id, p] of players) {
    if (id === myId || !(p.f & 2) || (p.f & 1 ? 'axis' : 'allies') === you.team) continue;
    const ch = (p.z || 0) + S.bodyHeight(p.f & 256 ? 2 : p.f & 64 ? 1 : 0) * 0.72;
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

  updateSnow(dt, now);
  if (!joined || !$('lobbyScreen').classList.contains('hidden')) { renderAttract(now); return; }
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
      const K = settings.binds;
      fwd = (keys[K.forward] || keys.ArrowUp ? 1 : 0) - (keys[K.back] || keys.ArrowDown ? 1 : 0);
      strafe = (keys[K.right] || keys.ArrowRight ? 1 : 0) - (keys[K.left] || keys.ArrowLeft ? 1 : 0);
      ads = adsMode === 'toggle' ? adsLatched : mouseRight;
      sprint = !!keys[K.sprint] && fwd > 0;
      fire = mouseDown && locked;
    }
    // hold crouch to go prone
    if (crouchDownAt && performance.now() - crouchDownAt > 420 && !pred.slide) { proneOn = true; crouchOn = false; crouchDownAt = 0; }
    if (isTouch && sprint && !sprintWas && (crouchOn || proneOn) && !pred.slide) { crouchOn = false; proneOn = false; }
    sprintWas = sprint;
    if (crouchOn || proneOn) sprint = false;
    if (sprint) { ads = false; adsLatched = false; }
    const holdCrouch = !isTouch && !!keys[settings.binds.holdCrouch];
    mx = fwd * Math.cos(yaw) - strafe * Math.sin(yaw);
    my = fwd * Math.sin(yaw) + strafe * Math.cos(yaw);
    movingNow = Math.hypot(mx, my) > 0.1;
    // recoil recovery
    if (recoilDebt > 0) { const r = Math.min(recoilDebt, recoilDebt * 7 * dt + 0.0005); pitch -= r; recoilDebt -= r; }
    const flags = (ads ? 1 : 0) | (sprint ? 2 : 0) | (crouchOn || holdCrouch ? 4 : 0) | (jumpHeld ? 8 : 0) | (proneOn ? 16 : 0);
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const item = [seq + 1, r3(dt), r3(mx), r3(my), flags];
    if (alive) S.stepMove(pred, item[2], item[3], flags, item[1], st);
    seq++;
    pending.push(item); outbox.push(item);
    if (pending.length > 240) pending.shift();
    if (now - lastSend > 33 || fire !== lastFireSent) {
      send({ t: 'in', l: outbox, a: +yaw.toFixed(4), p: +pitch.toFixed(4), f: fire && alive });
      outbox = []; lastSend = now; lastFireSent = fire;
    }
  }

  // --- camera
  adsT += ((ads && alive ? 1 : 0) - adsT) * Math.min(1, dt * st.adsSpeed);
  crouchT += ((pred.stance > 0 ? 1 : 0) - crouchT) * Math.min(1, dt * 10);
  eyeSmooth += (S.eyeHeight(pred.stance) - eyeSmooth) * Math.min(1, dt * (pred.slide > 0 ? 16 : 9));
  if (wasAir && !pred.air && you && you.alive) landDip = Math.min(9, landDip + 6);
  wasAir = pred.air;
  landDip *= Math.pow(0.004, dt);
  slideTilt += ((pred.slide > 0 ? 1 : 0) - slideTilt) * Math.min(1, dt * 10);
  const scoped = st.zoom > 1 && adsT > 0.85;
  const baseFov = settings.fov;
  const fov = (st.zoom > 1 ? baseFov + (baseFov / st.zoom - baseFov) * Math.max(0, (adsT - 0.6) / 0.4) : baseFov - 20 * adsT) + 7 * slideTilt * (1 - adsT);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  shake *= Math.pow(0.02, dt);
  if (you && you.alive) {
    const eye = pred.z + eyeSmooth - landDip;
    const grounded = !pred.air && pred.slide <= 0;
    if (movingNow && alive && grounded) bobPhase += dt * (sprint ? 14 : 9) * (pred.stance === 2 ? 0.45 : pred.stance === 1 ? 0.7 : 1);
    const bob = movingNow && grounded ? Math.sin(bobPhase * 2) * (sprint ? 1.6 : pred.stance === 2 ? 1.2 : 0.8) * (1 - adsT * 0.8) : 0;
    camera.position.set(pred.x, eye + bob, pred.y);
    let lp = pitch, ly = yaw;
    if (scoped) { lp += Math.sin(now / 900) * 0.002; ly += Math.cos(now / 1300) * 0.002; }
    lp += (Math.random() - 0.5) * shake * 0.004; ly += (Math.random() - 0.5) * shake * 0.004;
    tmpV.set(pred.x + Math.cos(ly) * Math.cos(lp) * 100, eye + bob + Math.sin(lp) * 100, pred.y + Math.sin(ly) * Math.cos(lp) * 100);
    camera.lookAt(tmpV);
    if (slideTilt > 0.01) camera.rotateZ(-0.09 * slideTilt); // lean into the slide
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
    if (s.root.rotation.z > 1.2 && !(p.f & 256)) s.root.rotation.z = 0;
    s.root.visible = true;
    const sp = Math.hypot(p.x - s.lastX, p.y - s.lastY) / Math.max(dt, 0.001);
    s.lastX = p.x; s.lastY = p.y;
    const prone = !!(p.f & 256), sliding = !!(p.f & 512), crouch = !!(p.f & 64) && !prone;
    const stance = prone ? 2 : crouch ? 1 : 0;
    s.root.position.x = p.x; s.root.position.z = p.y; s.root.position.y = p.z || 0;
    s.root.rotation.y = -p.a;
    // prone: lie flat facing forward; slide: lean back
    const lie = prone ? -1.45 : sliding ? 0.75 : 0;
    s.root.rotation.z += (lie - s.root.rotation.z) * Math.min(1, dt * 12);
    if (prone) { s.root.position.x -= Math.cos(p.a) * 30; s.root.position.z -= Math.sin(p.a) * 30; }
    if (sp > 20) s.walk += dt * Math.min(sp, 320) / 22;
    const swing = sp > 20 ? Math.sin(s.walk) * (p.f & 128 ? 0.8 : 0.5) : 0;
    s.legL.rotation.z = swing; s.legR.rotation.z = -swing;
    const cy = crouch || sliding ? 0.55 : 1;
    s.legL.scale.y = s.legR.scale.y = cy;
    s.upper.position.y = crouch || sliding ? -16 : 0;
    s.holder.rotation.z = (p.q || 0) - s.root.rotation.z; // keep the gun pointed where they aim
    if (p.f & 1024) { s.legL.rotation.z = 0.5; s.legR.rotation.z = -0.3; } // tuck legs mid-jump
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
      const eye = myEye();
      const cp = Math.cos(pitch);
      const dx = Math.cos(yaw) * cp, dy = Math.sin(yaw) * cp, dh = Math.sin(pitch);
      const t = S.rayCylinder(pred.x, pred.y, eye - (p.z || 0), dx, dy, dh, p.x, p.y, S.PLAYER_R + 4, S.bodyHeight(stance));
      showTag = t < 1500 && S.rayWorld(pred.x, pred.y, eye, dx, dy, dh, t) >= t - 1;
    }
    s.tag.visible = showTag;
    s.tag.position.y = prone ? 40 : crouch ? 66 : 86;
    if (prone) s.tag.position.set(30, 40, 0); else s.tag.position.x = 0;
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
  // reload progress (0..1), smoothed between server updates
  if (you && you.rl > 0) reloadP = Math.min(0.999, 1 - Math.max(0, you.rl - (now - lastStateAt) / st.reload));
  else reloadP = 0;
  updateRecoil(dt);
  updateCasings(now, dt);
  updateSmoke(now, dt);
  if (muzzleLight.intensity > 0 && now - muzzleLight.userData.t > 55) muzzleLight.intensity = 0;
  if (vmMuzzleLight.intensity > 0 && now - vmMuzzleLight.userData.t > 55) vmMuzzleLight.intensity = 0;
  const showVm = !!(vm && you && you.alive && !scoped);
  if (vm) {
    const G = vm.gun;
    vm.holder.visible = showVm;
    vmSwap = Math.max(0, vmSwap - dt * 3);
    // parts + sounds
    const evs = Guns.animateGun(G, { now, rate: st.rate, reload: reloadP, ammo: you ? you.ammo : 1 });
    for (const ev of evs) {
      if (ev === 'eject') spawnCasings(1);
      else if (ev === 'eject6') spawnCasings(6, 'down');
      else if (ev === 'eject2') spawnCasings(2, 'back');
      else mech(ev);
    }
    if (G.parts.rifleNade) G.parts.rifleNade.visible = !!(you && you.rg > 0);
    // hands: left hand follows the magazine / pump, right hand works the bolt
    Guns.leftHandTarget(G, reloadP, tmpB);
    if (G.parts.pump) tmpB.x += G.parts.pump.position.x - 8.5;
    vm.lHand.position.lerp(tmpB, Math.min(1, dt * 16));
    let rTarget = vm.rHandHome;
    const bolt = G.parts.bolt;
    if (bolt && (Math.abs(bolt.rotation.x) > 0.05 || bolt.position.x < -0.2)) {
      bolt.updateMatrixWorld(true);
      rTarget = G.group.worldToLocal(bolt.localToWorld(tmpC.set(-2.4, -0.8, 3.6))).add(tmpA.set(0, 0, 0.6));
    }
    vm.rHand.position.lerp(rTarget, Math.min(1, dt * 18));
    setArm(vm.rArm, tmpA.copy(vm.rHand.position).add(tmpC.set(-1.2, -1.4, 1.5)), vm.rElbow, 1.9);
    setArm(vm.lArm, tmpB.copy(vm.lHand.position).add(tmpC.set(-1.0, -0.9, -0.2)), vm.lElbow, 1.8);
    // position: hip <-> aim down sights
    const hip = G.pistol ? VM_HIP_PISTOL : VM_HIP;
    const target = tmpA.set(-(G.sightZ || 0), -G.sightH, G.pistol ? -14 : -15.5).lerp(hip, 1 - adsT);
    const bobA = movingNow ? (1 - adsT * 0.85) : 0;
    target.x += Math.sin(bobPhase) * 0.6 * bobA;
    target.y += Math.abs(Math.cos(bobPhase)) * 0.5 * bobA - crouchT * 0.3 + Math.sin(now / 700) * 0.12 * (1 - adsT);
    target.y -= vmSwap * 14;
    if (pred.stance === 2) { target.y -= 1.0; if (movingNow) { target.x += Math.sin(bobPhase) * 1.6; target.y -= Math.abs(Math.sin(bobPhase)) * 1.2; } }
    target.y -= landDip * 0.15;
    // sway against your look direction
    let dyaw = yaw - sway.lastYaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    const dp = pitch - sway.lastPitch;
    sway.lastYaw = yaw; sway.lastPitch = pitch;
    const sk = 1 - adsT * 0.7;
    sway.x += (S.clamp(-dyaw * 3, -0.12, 0.12) * sk - sway.x) * Math.min(1, dt * 9);
    sway.y += (S.clamp(dp * 3, -0.1, 0.1) * sk - sway.y) * Math.min(1, dt * 9);
    target.x += sway.x * 5; target.y += sway.y * 4;
    let rx = 0, ry = 0, rz = -0.28 * slideTilt;
    if (pred.stance === 2 && movingNow && reloadP <= 0) rz += Math.sin(bobPhase) * 0.12;
    if (sprint && movingNow) { target.x -= 2; target.y -= 2.5; ry = 0.75; rz = 0.3; rx -= 0.25; }
    if (reloadP > 0) {
      const dip = Math.sin(Math.min(1, reloadP) * Math.PI);
      const boltGun = G.action === 'bolt' || G.action === 'garand' || G.action === 'pump';
      target.y -= dip * 1.5; target.x -= dip * 1.5;
      rz += dip * (boltGun ? -0.3 : G.action === 'revolver' ? 0.45 : 0.22); rx += dip * (G.action === 'break' ? 0.2 : 0.06); ry += dip * 0.12;
    }
    const mk = now - vmMelee;
    if (mk < 320) { const j = Math.sin(mk / 320 * Math.PI); target.z -= j * 9; target.x -= j * 3; rz -= j * 0.4; }
    vm.holder.position.lerp(target, Math.min(1, dt * 20));
    vm.holder.position.z += rec.z * 0.05;
    vm.holder.rotation.set(rx + rec.rx * 0.04 + sway.y, ry + rec.ry * 0.03 + sway.x, rz + rec.rz * 0.03);
    // muzzle flash
    const fl = now - vmFlash < 42 && !st.noFlash;
    vm.flash.visible = vm.flash2.visible = fl;
    if (fl) {
      vm.flash.material.rotation = Math.random() * TAU; vm.flash2.material.rotation = Math.random() * TAU;
      const s2 = 0.8 + Math.random() * 0.5; vm.flash.scale.setScalar((G.pistol ? 5 : 8) * s2); vm.flash2.scale.setScalar((G.pistol ? 3 : 5) * s2);
    }
  }

  updateObjectives3D(now, players);
  updateStreakFx(now, dt);
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
    const spread = S.currentSpread(st, ads, moving, pred.stance, sprint, pred.air);
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
  for (const w of S.WALLS) { c.fillStyle = w.k === 'water' ? 'rgba(70,120,140,.85)' : 'rgba(210,200,170,.75)'; c.fillRect(w.x, w.y, w.w, w.h); }
  for (const [id, p] of players) {
    if (id === myId || !(p.f & 2)) continue;
    const team = p.f & 1 ? 'axis' : 'allies';
    if (team !== you.team && !(p.f & 8) && !teamRecon()) continue;
    c.fillStyle = team === you.team ? '#5aa0ff' : '#ff5040';
    c.beginPath(); c.arc(p.x, p.y, 34, 0, TAU); c.fill();
  }
  // objectives
  const map = S.MAPS[objMapId], ob = objState, col = (k) => (k === 1 ? '#5aa0ff' : k === 2 ? '#ff5040' : '#e8e2c8');
  if (map && ob) {
    c.lineWidth = 14;
    if (currentMode === 'dom' && ob.p) map.dom.forEach((pt, i) => { c.strokeStyle = col(ob.p[i][0]); c.beginPath(); c.arc(pt.x, pt.y, 100, 0, TAU); c.stroke(); });
    if (currentMode === 'ctf' && ob.f) ob.f.forEach(([st, x, y], i) => { c.fillStyle = col(i + 1); c.fillRect(x - 40, y - 60, 70, 45); c.fillRect(x - 40, y - 60, 12, 120); });
    if (currentMode === 'hq' && ob.z != null) { const z = map.hq[ob.z]; c.strokeStyle = ob.c ? '#f0c040' : col(ob.h); c.beginPath(); c.arc(z.x, z.y, 140, 0, TAU); c.stroke(); }
  }
  c.restore();
  // player arrow (always up)
  c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(ox + size / 2, oy + size / 2 - 7); c.lineTo(ox + size / 2 - 5, oy + size / 2 + 5); c.lineTo(ox + size / 2 + 5, oy + size / 2 + 5); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,240,200,.35)'; c.strokeRect(ox, oy, size, size);
}

function objectiveHud(now) {
  const ob = objState; let html = '';
  const tag = (k, txt, extra) => `<span class="ob ob${k}${extra || ''}">${txt}</span>`;
  if (currentMode === 'dom' && ob && ob.p) {
    const map = S.MAPS[objMapId];
    html = ob.p.map(([owner, prog], i) => {
      const pt = map.dom[i];
      const here = you && you.alive && Math.hypot(pt.x - pred.x, pt.y - pred.y) < 100;
      const bar = here ? `<i style="width:${Math.abs(prog)}%;background:${prog > 0 ? '#4f8fe0' : '#d9483b'}"></i>` : '';
      return tag(owner, 'ABC'[i] + bar, here ? ' here' : '');
    }).join('');
  } else if (currentMode === 'ctf' && ob && ob.f) {
    const st = (s2) => (s2 === 0 ? 'Home' : s2 === 1 ? 'Taken' : 'Dropped');
    const mi = you.team === 'allies' ? 0 : 1, ei = 1 - mi;
    html = tag(mi + 1, '⚑ Yours: ' + st(ob.f[mi][0])) + tag(ei + 1, '⚑ Enemy: ' + st(ob.f[ei][0]));
    if (ob.f[ei][0] === 1 && ob.f[ei][3] === myId) html += tag(3, 'You have the flag! Run home');
  } else if (currentMode === 'hq' && ob && ob.z != null) {
    const sec = Math.ceil(ob.mv / 1000);
    const who = ob.c ? 'Contested' : ob.h === 0 ? 'Unclaimed' : (ob.h === (you.team === 'allies' ? 1 : 2) ? 'Your team holds it' : 'Enemy holds it');
    html = tag(ob.c ? 3 : ob.h, `HQ: ${who}`) + tag(0, `moves in ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
  }
  return html;
}

function updateHud(now) {
  if (!you) return;
  const ksh = streakHud();
  if (hudCache.ksh !== ksh) { hudCache.ksh = ksh; $('ksPanel').innerHTML = ksh; }
  const md = S.MODES[currentMode] || S.MODES.tdm;
  setText('modeLabel', `${md.name} · ${(S.MAPS[objMapId] || S.MAPS.ruins).name} · first to ${match.sl || md.def}`);
  const obh = objectiveHud(now);
  if (hudCache.obh !== obh) { hudCache.obh = obh; $('objbar').innerHTML = obh; }
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
  setText('stance', pred.slide > 0 ? 'SLIDING' : pred.stance === 2 ? 'PRONE' : pred.stance === 1 ? 'CROUCHED' : pred.air ? 'AIRBORNE' : '');
  setText('ping', offlineMode ? 'OFFLINE' : Math.round(ping) + ' ms · ' + roomCode);
  if (isTouch) $('tRg').classList.toggle('hidden', !(you.rg > 0 && you.slot === 0));
  if (isTouch) { $('tCrouch').classList.toggle('on', crouchOn || proneOn); $('tCrouch').textContent = proneOn ? '⤓' : '↧'; }
  const kf = killfeed.filter((k) => now - k.t < 6000).map((k) => k.notice ? `<div class="notice ${k.good === true ? 'good' : k.good === false ? 'bad' : ''}">${esc(k.notice)}</div>` : `<div><span class="c-${teamOf(k.k)}">${esc(nameOf(k.k))}</span> <span class="w">[${esc(k.w)}${k.hs ? ' · HS' : ''}]</span> <span class="c-${teamOf(k.v)}">${esc(nameOf(k.v))}</span></div>`).join('');
  if (hudCache.kf !== kf) { hudCache.kf = kf; $('killfeed').innerHTML = kf; }
  let c = '';
  if (match.st === 'ended') {
    const w = match.winner;
    c = (w === 'draw' ? 'DRAW' : (w === you.team ? 'VICTORY' : 'DEFEAT') + '\n' + (w || '').toUpperCase() + ' WIN') +
      `\n<small>${match.sc[0]} - ${match.sc[1]} · ${match.lb ? 'back to the lobby' : 'next match'} in ${Math.ceil(match.rs / 1000)}s</small>`;
  } else if (!you.alive) {
    const by = you.kb === myId ? 'You' : nameOf(you.kb);
    c = (you.kw === 'Team change' ? 'SWITCHING TEAMS' : 'KILLED BY ' + esc(by).toUpperCase() + `\n<small>${esc(you.kw || '')}</small>`) +
      `\n<small>Respawning in ${(you.ri / 1000).toFixed(1)}s · ${isTouch ? 'tap &#9881;' : 'press L'} to change loadout</small>`;
  } else if (centerMsg && now - centerMsg.t < 1500) {
    c = esc(centerMsg.text);
  }
  if (hudCache.c !== c) { hudCache.c = c; $('center').innerHTML = c; }
}

buildWorld(loadSaved('fl_offMap', 'ruins'));
requestAnimationFrame(frame);
