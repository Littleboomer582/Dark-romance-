/* Frontline 1945 — browser / Android client */
(function () {
  'use strict';
  const S = window.Shared;
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches;

  // ------------------------------------------------------------ loadout UI
  const CLASSES = ['SMG', 'Assault Rifle', 'Rifle', 'Bolt-Action', 'Shotgun', 'Machine Gun'];
  const SECONDARY_IDS = Object.keys(S.WEAPONS).filter((k) => S.WEAPONS[k].secondary);
  const PRIMARY_IDS = Object.keys(S.WEAPONS).filter((k) => !S.WEAPONS[k].secondary);

  function loadSaved(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  let loadout = S.sanitizeLoadout(loadSaved('fl_loadout', { primary: 'thompson', atts: ['grip'], secondary: 'colt' }));

  function buildLoadout(el) {
    let cls = S.WEAPONS[loadout.primary].cls;
    let desc = '';
    function btn(text, on, onClick, disabled) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      if (on) b.classList.add('on');
      if (disabled) b.disabled = true;
      b.addEventListener('click', onClick);
      return b;
    }
    function div(c, text) { const d = document.createElement('div'); d.className = c; if (text) d.textContent = text; return d; }
    function render() {
      el.innerHTML = '';
      const w = S.WEAPONS[loadout.primary];
      el.appendChild(div('lo-label', 'Primary class'));
      const cr = div('lo-classes');
      for (const c of CLASSES) cr.appendChild(btn(c, c === cls, () => { cls = c; loadout.primary = PRIMARY_IDS.find((k) => S.WEAPONS[k].cls === c); loadout.atts = []; commit(); }));
      el.appendChild(cr);
      const wr = div('lo-weapons');
      for (const k of PRIMARY_IDS.filter((k) => S.WEAPONS[k].cls === cls)) {
        wr.appendChild(btn(S.WEAPONS[k].name, k === loadout.primary, () => {
          loadout.primary = k; loadout.atts = loadout.atts.filter((a) => S.WEAPONS[k].allowed.includes(a)); commit();
        }));
      }
      el.appendChild(wr);
      const st = S.computeStats(loadout.primary, loadout.atts);
      const stats = div('lo-stats');
      const bars = [
        ['Damage', Math.min(1, (st.dmg * st.pellets) / 120)],
        ['Fire rate', Math.min(1, 60000 / st.rate / 1200)],
        ['Accuracy', Math.max(0.05, 1 - st.spread / 0.15)],
        ['Range', Math.min(1, st.range / 1500)],
        ['Mobility', Math.max(0.05, (st.speed - 0.7) / 0.35)],
      ];
      for (const [n, v] of bars) {
        stats.appendChild(div('', n));
        const bar = div('bar'); const i = document.createElement('i'); i.style.width = (v * 100).toFixed(0) + '%'; bar.appendChild(i);
        stats.appendChild(bar);
      }
      stats.appendChild(div('', 'Magazine'));
      stats.appendChild(div('', `${st.mag} rds · ${(st.reload / 1000).toFixed(1)}s reload · ${w.nation}${st.auto ? ' · full-auto' : ''}`));
      el.appendChild(stats);
      el.appendChild(div('lo-label', `Attachments (${loadout.atts.length}/${S.MAX_ATTACHMENTS})`));
      const ar = div('lo-atts');
      if (!w.allowed.length) ar.appendChild(div('lo-desc', 'No attachments available.'));
      for (const a of w.allowed) {
        const on = loadout.atts.includes(a);
        ar.appendChild(btn(S.ATTACHMENTS[a].name, on, () => {
          if (on) loadout.atts = loadout.atts.filter((x) => x !== a);
          else if (loadout.atts.length < S.MAX_ATTACHMENTS) loadout.atts.push(a);
          desc = S.ATTACHMENTS[a].name + ': ' + S.ATTACHMENTS[a].desc;
          commit();
        }, !on && loadout.atts.length >= S.MAX_ATTACHMENTS));
      }
      el.appendChild(ar);
      el.appendChild(div('lo-desc', desc));
      el.appendChild(div('lo-label', 'Sidearm'));
      const sr = div('lo-sec');
      for (const k of SECONDARY_IDS) sr.appendChild(btn(S.WEAPONS[k].name, k === loadout.secondary, () => { loadout.secondary = k; commit(); }));
      el.appendChild(sr);
    }
    function commit() { loadout = S.sanitizeLoadout(loadout); save('fl_loadout', loadout); render(); }
    render();
    return { render };
  }

  const menuLoadout = buildLoadout($('loadoutMenu'));
  const gameLoadout = buildLoadout($('loadoutGame'));
  $('name').value = loadSaved('fl_name', '');
  $('room').value = loadSaved('fl_room', '');
  $('controlsHelp').innerHTML = isTouch
    ? 'Left thumb: move. Right thumb: aim &mdash; push to the edge to fire, or hold FIRE. AIM toggles aim-down-sights (zoom with a scope). R reload, &#8646; swap, G grenade, &#9876; melee.'
    : 'WASD move &middot; Mouse aim &middot; Left click fire &middot; Right click aim down sights &middot; Shift sprint &middot; R reload &middot; Q / wheel swap &middot; G grenade &middot; V melee &middot; Tab scores &middot; Esc loadout';

  // ------------------------------------------------------------- audio
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
  function noise(freq, dur, vol, q) {
    if (!actx || vol <= 0.01 || soundsThisFrame > 6) return;
    soundsThisFrame++;
    const src = actx.createBufferSource(); src.buffer = noiseBuf;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.7;
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
  function playShot(wid, x, y, sup) {
    const w = S.WEAPONS[wid]; if (!w) return;
    const v = volAt(x, y); const [f, d] = SHOT_SND[w.cls] || [2000, 0.2];
    if (sup) noise(900, 0.08, v * 0.25); else noise(f, d, v * 0.55);
  }
  function volAt(x, y) { return Math.max(0, 1 - Math.hypot(x - pred.x, y - pred.y) / 1600); }

  // ------------------------------------------------------------- network
  let ws = null, myId = 0, joined = false, roomCode = '';
  let snaps = [];
  const roster = new Map();
  let you = null;
  const pred = { x: 0, y: 0 };
  let pending = [], outbox = [], seq = 0, lastSend = 0, lastFireSent = false;
  let myAng = 0, wasAlive = false;
  let nadePos = [];
  let match = { sc: [0, 0], tl: 0, st: 'playing', rs: 0, winner: null };
  let ping = 0;
  const tracers = [], particles = [], explosions = [], swings = [], killfeed = [], muzzle = new Map();
  let hitMarker = 0, hurtFlash = 0, shake = 0, centerMsg = null;

  function serverUrl() {
    const q = new URLSearchParams(location.search).get('server');
    if (q) return q.replace(/^http/, 'ws').replace(/\/?$/, '') + '/ws';
    if (window.GAME_SERVER) return window.GAME_SERVER.replace(/^http/, 'ws').replace(/\/?$/, '') + '/ws';
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }

  function connect() {
    $('err').textContent = 'Connecting...';
    const name = $('name').value.trim() || 'Soldier';
    const room = $('room').value.trim() || 'PUBLIC';
    save('fl_name', $('name').value.trim()); save('fl_room', $('room').value.trim());
    try { ws = new WebSocket(serverUrl()); } catch (e) { $('err').textContent = 'Could not connect: ' + e.message; return; }
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name, room, bots: +$('bots').value, loadout }));
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMessage(m); };
    ws.onclose = () => {
      if (joined) showMenu('Disconnected from server.');
      else $('err').textContent = 'Could not reach the game server.';
      joined = false;
    };
    ws.onerror = () => {};
  }
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

  function onMessage(m) {
    switch (m.t) {
      case 'welcome':
        myId = m.id; roomCode = m.code; joined = true; snaps = []; pending = []; you = null;
        $('err').textContent = '';
        $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
        if (isTouch) $('touch').classList.remove('hidden');
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

  function onState(m) {
    const now = performance.now();
    const map = new Map();
    for (const p of m.p) map.set(p.i, p);
    snaps.push({ t: now, p: map });
    while (snaps.length > 30) snaps.shift();
    nadePos = m.n;
    match.sc = m.sc; match.tl = m.tl; match.rs = m.rs;
    if (match.st === 'ended' && m.st === 'playing') { match.winner = null; killfeed.length = 0; }
    match.st = m.st;
    you = m.you;
    if (you) {
      pending = pending.filter((i) => i[0] > you.seq);
      let x = you.x, y = you.y;
      if (you.alive) {
        const st = myStats();
        for (const i of pending) { const r = S.applyMove(x, y, i[2], i[3], i[1], S.moveSpeed(st, !!(i[4] & 1), !!(i[4] & 2))); x = r[0]; y = r[1]; }
      }
      if (!wasAlive && you.alive) { myAng = you.team === 'allies' ? 0 : Math.PI; cam.x = x; cam.y = y; }
      wasAlive = you.alive;
      pred.x = x; pred.y = y;
    }
    for (const e of m.ev) handleEvent(e, now);
  }

  function nameOf(id) { const r = roster.get(id); return r ? r.n : '?'; }
  function teamOf(id) { const r = roster.get(id); return r ? r.t : 'allies'; }

  function handleEvent(e, now) {
    switch (e.e) {
      case 's': {
        let x = e.x, y = e.y;
        if (e.i === myId) { x = pred.x; y = pred.y; }
        tracers.push({ x, y, a: e.a, d: e.d, t: now, s: e.s });
        if (e.p === 0) { muzzle.set(e.i, now); playShot(e.w, x, y, e.s); }
        break;
      }
      case 'h':
        for (let k = 0; k < 6; k++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 180, vy: (Math.random() - 0.5) * 180, t: now, life: 400 + Math.random() * 300, c: '#8a1414', r: 2 + Math.random() * 2 });
        if (e.b === myId && e.i !== myId) { hitMarker = now; tone(1800, 0.05, 0.08, 'triangle'); }
        if (e.i === myId) { hurtFlash = now; shake = Math.max(shake, 4); }
        break;
      case 'k':
        killfeed.push({ k: e.k, v: e.v, w: e.w, t: now });
        while (killfeed.length > 5) killfeed.shift();
        if (e.k === myId && e.v !== myId) { centerMsg = { text: '+1 KILL\n' + nameOf(e.v), t: now }; tone(880, 0.12, 0.08, 'triangle'); }
        break;
      case 'x':
        explosions.push({ x: e.x, y: e.y, t: now });
        for (let k = 0; k < 24; k++) particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 500, vy: (Math.random() - 0.5) * 500, t: now, life: 500 + Math.random() * 600, c: Math.random() < 0.5 ? '#3a3328' : '#f0a030', r: 2 + Math.random() * 4 });
        noise(500, 0.9, volAt(e.x, e.y) * 0.9);
        shake = Math.max(shake, 14 * volAt(e.x, e.y));
        break;
      case 'm': swings.push({ i: e.i, t: now }); noise(4000, 0.06, 0.15); break;
      case 'n': tone(300, 0.05, 0.05, 'sine'); break;
      case 'end': match.winner = e.w; break;
    }
  }

  function myStats() {
    if (!you || !you.g) return S.computeStats(loadout.primary, loadout.atts);
    const g = you.g[you.slot];
    return S.computeStats(g[0], g[1]);
  }

  // --------------------------------------------------------------- input
  const keys = {};
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false, right: false, inside: false };
  let adsToggle = false, sprintToggle = false, fireBtn = false;
  let moveStick = null, aimStick = null;
  const STICK_R = 60;

  function inGame() { return joined && $('loadoutScreen').classList.contains('hidden'); }

  addEventListener('keydown', (e) => {
    if (!joined) return;
    if (e.code === 'Tab') { e.preventDefault(); toggleScores(true); return; }
    if (e.code === 'Escape' || e.code === 'KeyL') { toggleLoadout(); return; }
    if (!inGame()) return;
    keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyR') send({ t: 'reload' });
    if (e.code === 'KeyQ' || e.code === 'Digit1' || e.code === 'Digit2') {
      if (e.code === 'KeyQ' || (e.code === 'Digit1' && you && you.slot === 1) || (e.code === 'Digit2' && you && you.slot === 0)) send({ t: 'swap' });
    }
    if (e.code === 'KeyG') throwNade();
    if (e.code === 'KeyV' || e.code === 'KeyF') send({ t: 'melee' });
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Tab') toggleScores(false); });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = mouse.right = false; });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { if (inGame()) send({ t: 'swap' }); }, { passive: true });

  canvas.addEventListener('pointerdown', (e) => {
    initAudio();
    if (e.pointerType === 'mouse') {
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (e.button === 0) mouse.down = true;
      if (e.button === 2) mouse.right = true;
      return;
    }
    e.preventDefault();
    const s = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    if (e.clientX < innerWidth * 0.42 && !moveStick) moveStick = s;
    else if (!aimStick) aimStick = s;
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true; return; }
    for (const s of [moveStick, aimStick]) if (s && s.id === e.pointerId) { s.x = e.clientX; s.y = e.clientY; }
  });
  function endPointer(e) {
    if (e.pointerType === 'mouse') { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.right = false; return; }
    if (moveStick && moveStick.id === e.pointerId) moveStick = null;
    if (aimStick && aimStick.id === e.pointerId) aimStick = null;
  }
  addEventListener('pointerup', endPointer);
  addEventListener('pointercancel', endPointer);

  function stickVec(s) {
    if (!s) return [0, 0, 0];
    let dx = (s.x - s.ox) / STICK_R, dy = (s.y - s.oy) / STICK_R;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    return [dx, dy, Math.min(1, m)];
  }

  function bindBtn(id, down, up) {
    const b = $(id);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); initAudio(); down(b); });
    if (up) { b.addEventListener('pointerup', () => up(b)); b.addEventListener('pointercancel', () => up(b)); b.addEventListener('pointerleave', () => up(b)); }
  }
  bindBtn('tFire', (b) => { fireBtn = true; b.classList.add('on'); }, (b) => { fireBtn = false; b.classList.remove('on'); });
  bindBtn('tAds', (b) => { adsToggle = !adsToggle; b.classList.toggle('on', adsToggle); });
  bindBtn('tSprint', (b) => { sprintToggle = !sprintToggle; b.classList.toggle('on', sprintToggle); });
  bindBtn('tReload', () => send({ t: 'reload' }));
  bindBtn('tSwap', () => send({ t: 'swap' }));
  bindBtn('tNade', () => throwNade());
  bindBtn('tMelee', () => send({ t: 'melee' }));
  $('btnScores').addEventListener('click', () => toggleScores());
  $('btnLoadout').addEventListener('click', () => toggleLoadout());
  $('btnFull').addEventListener('click', () => goFullscreen(true));
  $('scoreboard').addEventListener('click', () => toggleScores(false));

  function throwNade() {
    let d = 380;
    if (!isTouch) d = Math.hypot(mouse.x - innerWidth / 2 - camOffScreen.x, mouse.y - innerHeight / 2 - camOffScreen.y) / view.scale;
    send({ t: 'nade', d });
  }

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
    $('scoreContent').innerHTML = html + '</div><p class="tag">Ping ' + Math.round(ping) + ' ms &middot; tap to close</p>';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

  function toggleLoadout() {
    const el = $('loadoutScreen');
    const show = el.classList.contains('hidden');
    el.classList.toggle('hidden', !show);
    if (show) gameLoadout.render();
    fireBtn = false; mouse.down = false;
  }
  $('loadoutSave').addEventListener('click', () => { send({ t: 'loadout', loadout }); toggleLoadout(); centerMsg = { text: 'Loadout saved\nApplies on respawn', t: performance.now() }; });
  $('switchTeam').addEventListener('click', () => { send({ t: 'team' }); toggleLoadout(); });
  $('leave').addEventListener('click', () => { if (ws) ws.close(); });

  function showMenu(err) {
    joined = false;
    $('menu').classList.remove('hidden');
    $('hud').classList.add('hidden'); $('touch').classList.add('hidden');
    $('loadoutScreen').classList.add('hidden'); $('scoreboard').classList.add('hidden');
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

  $('deploy').addEventListener('click', () => {
    initAudio();
    if (isTouch && !matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) goFullscreen(false);
    connect();
  });
  $('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('deploy').click(); });

  // PWA install
  let deferredPrompt = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('install').classList.remove('hidden'); });
  $('install').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('install').classList.add('hidden'); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

  setInterval(() => send({ t: 'ping', c: performance.now() }), 2000);

  // ------------------------------------------------------------- rendering
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  addEventListener('resize', resize); resize();

  const view = { scale: 1 };
  const cam = { x: S.MAP_W / 2, y: S.MAP_H / 2 };
  const camOffScreen = { x: 0, y: 0 };

  // ground texture
  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
  const groundPattern = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const r = rng(7);
    g.fillStyle = '#5a5536'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const v = r();
      g.fillStyle = v < 0.33 ? 'rgba(80,70,40,.35)' : v < 0.66 ? 'rgba(110,105,60,.3)' : 'rgba(60,60,35,.35)';
      g.fillRect(r() * 256, r() * 256, 2 + r() * 5, 2 + r() * 5);
    }
    return ctx.createPattern(c, 'repeat');
  })();
  const craters = (() => { const r = rng(42); const a = []; for (let i = 0; i < 40; i++) a.push({ x: r() * S.MAP_W, y: r() * S.MAP_H, r: 20 + r() * 45 }); return a; })();

  const GUN_LEN = { 'SMG': 26, 'Assault Rifle': 31, 'Rifle': 35, 'Bolt-Action': 39, 'Shotgun': 31, 'Machine Gun': 37, 'Pistol': 16 };
  const UNIFORM = { allies: '#6b7140', axis: '#5f666a' };
  const TEAMC = { allies: '#4f8fe0', axis: '#d9483b' };

  function drawSoldier(x, y, a, team, wid, flags, isMe, hp, name, id, now) {
    const w = S.WEAPONS[wid] || S.WEAPONS.thompson;
    const len = GUN_LEN[w.cls] || 28;
    ctx.save();
    ctx.translate(x, y);
    if (flags & 16) ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now / 80);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(3, 4, 18, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(a);
    // melee swing
    for (const s of swings) if (s.i === id && now - s.t < 220) {
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 40, -0.9, 0.9); ctx.stroke();
    }
    // gun
    const wood = w.cls === 'Rifle' || w.cls === 'Bolt-Action' || w.cls === 'Shotgun';
    ctx.fillStyle = wood ? '#6b4a2a' : '#2c2a24';
    ctx.fillRect(4, -3, len * 0.65, 6);
    ctx.fillStyle = '#1e1d19';
    ctx.fillRect(4 + len * 0.55, -2, len * 0.45, 4);
    if (w.cls === 'SMG' && wid === 'thompson') { ctx.fillRect(12, 3, 4, 7); }
    if (wid === 'mp40' || wid === 'stg44') { ctx.fillRect(14, 3, 3, 9); }
    if (wid === 'ppsh41') { ctx.beginPath(); ctx.arc(14, 5, 5, 0, Math.PI * 2); ctx.fill(); }
    if (w.cls === 'Machine Gun') { ctx.fillRect(10, -9, 8, 6); }
    // muzzle flash
    const mf = muzzle.get(id);
    if (mf && now - mf < 60) {
      ctx.fillStyle = 'rgba(255,210,90,.9)';
      ctx.beginPath(); ctx.moveTo(4 + len, -5); ctx.lineTo(4 + len + 16, 0); ctx.lineTo(4 + len, 5); ctx.fill();
    }
    // arms
    ctx.fillStyle = '#c99d78';
    ctx.beginPath(); ctx.arc(10, 6, 4, 0, Math.PI * 2); ctx.arc(4 + len * 0.55, 2, 4, 0, Math.PI * 2); ctx.fill();
    // body
    ctx.fillStyle = UNIFORM[team];
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = TEAMC[team]; ctx.lineWidth = 3; ctx.stroke();
    // helmet
    ctx.fillStyle = team === 'allies' ? '#4c522c' : '#474d50';
    ctx.beginPath(); ctx.arc(1, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.arc(-1, -2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // name + hp
    if (!isMe) {
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(name, x + 1, y - 27);
      ctx.fillStyle = team === (you && you.team) ? '#cfe3ff' : '#ffb3a8'; ctx.fillText(name, x, y - 28);
      if (team === (you && you.team) || hp < 100) {
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 15, y - 24, 30, 4);
        ctx.fillStyle = hp > 50 ? '#7fbf5b' : hp > 25 ? '#e0b43a' : '#e0503a'; ctx.fillRect(x - 15, y - 24, 30 * hp / 100, 4);
      }
    }
  }

  function drawWalls() {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    for (const w of S.WALLS) ctx.fillRect(w.x + 6, w.y + 7, w.w, w.h);
    for (const w of S.WALLS) {
      if (w.k === 'wall') {
        ctx.fillStyle = '#7a7060'; ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = 'rgba(40,35,28,.55)'; ctx.lineWidth = 1;
        ctx.beginPath();
        const horiz = w.w > w.h;
        for (let i = 12; i < (horiz ? w.w : w.h); i += 24) {
          if (horiz) { ctx.moveTo(w.x + i, w.y); ctx.lineTo(w.x + i, w.y + w.h); } else { ctx.moveTo(w.x, w.y + i); ctx.lineTo(w.x + w.w, w.y + i); }
        }
        ctx.stroke();
        ctx.strokeStyle = '#463f33'; ctx.lineWidth = 2; ctx.strokeRect(w.x, w.y, w.w, w.h);
      } else if (w.k === 'crate') {
        ctx.fillStyle = '#86602f'; ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = '#4f3718'; ctx.lineWidth = 3; ctx.strokeRect(w.x + 2, w.y + 2, w.w - 4, w.h - 4);
        ctx.beginPath(); ctx.moveTo(w.x + 4, w.y + 4); ctx.lineTo(w.x + w.w - 4, w.y + w.h - 4); ctx.moveTo(w.x + w.w - 4, w.y + 4); ctx.lineTo(w.x + 4, w.y + w.h - 4); ctx.stroke();
      } else {
        ctx.fillStyle = '#a99366';
        const horiz = w.w >= w.h; const n = Math.max(1, Math.round((horiz ? w.w : w.h) / 26));
        for (let i = 0; i < n; i++) {
          const s = (horiz ? w.w : w.h) / n;
          const bx = horiz ? w.x + i * s : w.x, by = horiz ? w.y : w.y + i * s;
          const bw = horiz ? s : w.w, bh = horiz ? w.h : s;
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx + 1, by + 1, bw - 2, bh - 2, 7) : ctx.rect(bx + 1, by + 1, bw - 2, bh - 2);
          ctx.fill(); ctx.strokeStyle = '#6d5d3c'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
    }
  }

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
      out.set(id, { ...pb, x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k, a: pa.a + da * k });
    }
    return out;
  }

  function drawMinimap(players, now) {
    const mw = 160, mh = mw * S.MAP_H / S.MAP_W, ox = Math.max(8, 8), oy = 8;
    const k = mw / S.MAP_W;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(ox, oy, mw, mh);
    ctx.strokeStyle = 'rgba(255,240,200,.35)'; ctx.strokeRect(ox, oy, mw, mh);
    ctx.fillStyle = 'rgba(200,190,160,.5)';
    for (const w of S.WALLS) ctx.fillRect(ox + w.x * k, oy + w.y * k, Math.max(1, w.w * k), Math.max(1, w.h * k));
    for (const [id, p] of players) {
      if (id === myId || !(p.f & 2)) continue;
      const team = p.f & 1 ? 'axis' : 'allies';
      if (team !== you.team && !(p.f & 8)) continue;
      ctx.fillStyle = TEAMC[team];
      ctx.beginPath(); ctx.arc(ox + p.x * k, oy + p.y * k, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    if (you.alive) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ox + pred.x * k, oy + pred.y * k, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ox + pred.x * k, oy + pred.y * k); ctx.lineTo(ox + pred.x * k + Math.cos(myAng) * 8, oy + pred.y * k + Math.sin(myAng) * 8); ctx.stroke();
    }
  }

  // aim assist for touch: nudge toward a visible enemy near the aim line
  function aimAssist(players, ang, dt) {
    let best = null, bestDa = 0.22;
    for (const [id, p] of players) {
      if (id === myId || !(p.f & 2) || (p.f & 1 ? 'axis' : 'allies') === you.team) continue;
      const d = Math.hypot(p.x - pred.x, p.y - pred.y);
      if (d > 900 || !S.hasLOS(pred.x, pred.y, p.x, p.y)) continue;
      const da = Math.atan2(Math.sin(Math.atan2(p.y - pred.y, p.x - pred.x) - ang), Math.cos(Math.atan2(p.y - pred.y, p.x - pred.x) - ang));
      if (Math.abs(da) < Math.abs(bestDa)) { bestDa = da; best = p; }
    }
    return best ? ang + bestDa * Math.min(1, 6 * dt) : ang;
  }

  // ------------------------------------------------------------ main loop
  let last = performance.now();
  let hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    soundsThisFrame = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1d1c15'; ctx.fillRect(0, 0, W, H);
    $('rotate').classList.toggle('hidden', !(joined && isTouch && H > W));
    if (!joined) { drawAttract(now); return; }

    const players = interpPlayers(now);
    const st = myStats();
    const alive = you && you.alive && match.st === 'playing';
    let ads = false, fire = false, mx = 0, my = 0, sprint = false;

    if (inGame() && you) {
      if (isTouch) {
        const [ax, ay] = stickVec(moveStick); mx = ax; my = ay;
        const [bx, by, bm] = stickVec(aimStick);
        ads = adsToggle;
        sprint = sprintToggle;
        if (aimStick && bm > 0.15) { myAng = Math.atan2(by, bx); if (alive) myAng = aimAssist(players, myAng, dt * 4); }
        else if (!fireBtn && Math.hypot(mx, my) > 0.2) myAng = Math.atan2(my, mx);
        fire = fireBtn || (aimStick && bm > 0.85);
        if (fire && alive) myAng = aimAssist(players, myAng, dt);
        if (Math.hypot(mx, my) < 0.1 && sprintToggle) { sprintToggle = false; $('tSprint').classList.remove('on'); }
      } else {
        mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
        ads = mouse.right;
        sprint = !!(keys.ShiftLeft || keys.ShiftRight);
        fire = mouse.down;
        const wx = cam.x + (mouse.x - W / 2) / view.scale, wy = cam.y + (mouse.y - H / 2) / view.scale;
        if (Math.hypot(wx - pred.x, wy - pred.y) > 4) myAng = Math.atan2(wy - pred.y, wx - pred.x);
      }
      if (alive) {
        const r = S.applyMove(pred.x, pred.y, mx, my, dt, S.moveSpeed(st, ads, sprint));
        pred.x = r[0]; pred.y = r[1];
      }
      seq++;
      const item = [seq, +dt.toFixed(4), +mx.toFixed(3), +my.toFixed(3), (ads ? 1 : 0) | (sprint ? 2 : 0)];
      pending.push(item); outbox.push(item);
      if (pending.length > 240) pending.shift();
      if (now - lastSend > 33 || fire !== lastFireSent) {
        send({ t: 'in', l: outbox, a: +myAng.toFixed(3), f: fire && alive });
        outbox = []; lastSend = now; lastFireSent = fire;
      }
    }

    // camera
    const zoom = ads && st.zoom > 1 ? st.zoom : 1;
    const baseScale = Math.min(W / 1150, H / (isTouch ? 540 : 700));
    view.scale += (baseScale / zoom - view.scale) * Math.min(1, dt * 8);
    let offX = 0, offY = 0;
    if (isTouch) {
      const reach = ads ? (zoom > 1 ? 330 : 150) : 70;
      offX = Math.cos(myAng) * reach; offY = Math.sin(myAng) * reach;
    } else {
      const f = ads ? (zoom > 1 ? 0.65 : 0.4) : 0.22;
      offX = (mouse.x - W / 2) / view.scale * f; offY = (mouse.y - H / 2) / view.scale * f;
    }
    const tx = (you && you.alive ? pred.x : cam.x) + offX, ty = (you && you.alive ? pred.y : cam.y) + offY;
    if (you && you.alive) { cam.x += (tx - cam.x) * Math.min(1, dt * 10); cam.y += (ty - cam.y) * Math.min(1, dt * 10); }
    camOffScreen.x = (pred.x - cam.x) * view.scale; camOffScreen.y = (pred.y - cam.y) * view.scale;
    shake *= Math.pow(0.02, dt);
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;

    // world
    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-cam.x, -cam.y);
    ctx.fillStyle = groundPattern; ctx.fillRect(0, 0, S.MAP_W, S.MAP_H);
    for (const c of craters) {
      ctx.fillStyle = 'rgba(40,34,20,.35)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(30,26,16,.35)'; ctx.beginPath(); ctx.ellipse(c.x + 2, c.y + 2, c.r * 0.55, c.r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    }
    // spawn zones
    ctx.fillStyle = 'rgba(79,143,224,.08)'; ctx.fillRect(0, 0, 280, S.MAP_H);
    ctx.fillStyle = 'rgba(217,72,59,.08)'; ctx.fillRect(S.MAP_W - 280, 0, 280, S.MAP_H);
    ctx.strokeStyle = '#2a2618'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, S.MAP_W, S.MAP_H);

    // particles under players
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; const age = now - p.t;
      if (age > p.life) { particles.splice(i, 1); continue; }
      const k = age / 1000;
      ctx.globalAlpha = 1 - age / p.life; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x + p.vx * k * (1 - k), p.y + p.vy * k * (1 - k), p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // grenades
    for (const n of nadePos) {
      ctx.fillStyle = '#2e3a22'; ctx.beginPath(); ctx.arc(n[0], n[1], 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffdc60'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(n[0], n[1], 10 + 3 * Math.sin(now / 60), 0, Math.PI * 2); ctx.stroke();
    }

    // players
    for (const [id, p] of players) {
      if (id === myId || !(p.f & 2)) continue;
      const team = p.f & 1 ? 'axis' : 'allies';
      if (you && team !== you.team && you.alive && !S.hasLOS(pred.x, pred.y, p.x, p.y)) continue;
      const r = roster.get(id);
      drawSoldier(p.x, p.y, p.a, team, p.w, p.f, false, p.h, r ? r.n : '', id, now);
    }
    if (you && you.alive) {
      const me = players.get(myId);
      const g = you.g && you.g[you.slot];
      drawSoldier(pred.x, pred.y, myAng, you.team, g ? g[0] : 'thompson', me ? me.f : 0, true, you.hp, '', myId, now);
      // aim line
      ctx.strokeStyle = ads ? 'rgba(255,80,60,.35)' : 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5;
      const ld = S.rayWalls(pred.x, pred.y, Math.cos(myAng), Math.sin(myAng), ads ? st.range : 220);
      ctx.beginPath(); ctx.moveTo(pred.x + Math.cos(myAng) * 22, pred.y + Math.sin(myAng) * 22); ctx.lineTo(pred.x + Math.cos(myAng) * ld, pred.y + Math.sin(myAng) * ld); ctx.stroke();
    }

    // tracers
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i]; const age = now - t.t;
      if (age > 120) { tracers.splice(i, 1); continue; }
      const a = 1 - age / 120;
      ctx.strokeStyle = t.s ? `rgba(220,220,200,${0.25 * a})` : `rgba(255,220,130,${0.8 * a})`;
      ctx.lineWidth = 2;
      const sx0 = t.x + Math.cos(t.a) * 24, sy0 = t.y + Math.sin(t.a) * 24;
      ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(t.x + Math.cos(t.a) * t.d, t.y + Math.sin(t.a) * t.d); ctx.stroke();
      if (age < 30) { ctx.fillStyle = 'rgba(255,240,200,.8)'; ctx.fillRect(t.x + Math.cos(t.a) * t.d - 2, t.y + Math.sin(t.a) * t.d - 2, 4, 4); }
    }
    // explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i]; const age = now - e.t;
      if (age > 500) { explosions.splice(i, 1); continue; }
      const k = age / 500;
      ctx.fillStyle = `rgba(255,${180 - k * 120},60,${0.7 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, 30 + k * 160, 0, Math.PI * 2); ctx.fill();
    }
    drawWalls();
    swings.splice(0, swings.length - 10 > 0 ? swings.length - 10 : 0);
    ctx.restore();

    // screen-space overlays
    if (ads && zoom > 1) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.7)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    if (now - hurtFlash < 300 || (you && you.alive && you.hp < 40)) {
      const a = Math.max(now - hurtFlash < 300 ? 0.35 * (1 - (now - hurtFlash) / 300) : 0, you && you.hp < 40 ? (40 - you.hp) / 100 : 0);
      const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(150,0,0,${a * 2})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }

    // reticle
    if (you && you.alive && inGame()) {
      let rx, ry;
      if (isTouch) {
        const d = 200 * view.scale;
        rx = W / 2 + camOffScreen.x + Math.cos(myAng) * d; ry = H / 2 + camOffScreen.y + Math.sin(myAng) * d;
      } else { rx = mouse.x; ry = mouse.y; }
      const moving = Math.hypot(mx, my) > 0.1;
      let spread = st.spread * (ads ? st.adsMult : 1) * (moving ? st.moveMult : 1);
      if (st.bipod && ads && !moving) spread *= 0.35;
      const distW = Math.hypot(rx - W / 2 - camOffScreen.x, ry - H / 2 - camOffScreen.y) / view.scale;
      const gap = Math.max(4, Math.tan(spread) * distW * view.scale);
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx - gap - 8, ry); ctx.lineTo(rx - gap, ry); ctx.moveTo(rx + gap, ry); ctx.lineTo(rx + gap + 8, ry);
      ctx.moveTo(rx, ry - gap - 8); ctx.lineTo(rx, ry - gap); ctx.moveTo(rx, ry + gap); ctx.lineTo(rx, ry + gap + 8);
      ctx.stroke();
      if (now - hitMarker < 200) {
        ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.beginPath();
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.moveTo(rx + dx * 5, ry + dy * 5); ctx.lineTo(rx + dx * 12, ry + dy * 12); }
        ctx.stroke();
      }
      if (you.rl > 0) {
        ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(rx, ry, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - you.rl)); ctx.stroke();
      }
    }
    // touch sticks
    if (isTouch && inGame()) {
      for (const s of [moveStick, aimStick]) {
        if (!s) continue;
        ctx.strokeStyle = 'rgba(255,240,200,.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.ox, s.oy, STICK_R, 0, Math.PI * 2); ctx.stroke();
        if (s === aimStick) { ctx.strokeStyle = 'rgba(255,90,60,.35)'; ctx.beginPath(); ctx.arc(s.ox, s.oy, STICK_R * 0.85, 0, Math.PI * 2); ctx.stroke(); }
        const [vx, vy] = stickVec(s);
        ctx.fillStyle = 'rgba(255,240,200,.45)';
        ctx.beginPath(); ctx.arc(s.ox + vx * STICK_R, s.oy + vy * STICK_R, 24, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (you) drawMinimap(players, now);
    updateHud(now);
  }

  function drawAttract(now) {
    ctx.save();
    const s = Math.max(W / S.MAP_W, H / S.MAP_H) * 1.1;
    ctx.translate(W / 2, H / 2); ctx.scale(s, s);
    ctx.translate(-S.MAP_W / 2 + Math.sin(now / 9000) * 100, -S.MAP_H / 2 + Math.cos(now / 11000) * 60);
    ctx.fillStyle = groundPattern; ctx.fillRect(0, 0, S.MAP_W, S.MAP_H);
    drawWalls();
    ctx.restore();
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
    setText('nades', 'Frag x' + you.nd + (you.rl > 0 ? ' · RELOADING' : you.ammo === 0 ? ' · RELOAD!' : ''));
    setText('ping', Math.round(ping) + ' ms · ' + roomCode);
    // killfeed
    const kf = killfeed.filter((k) => now - k.t < 6000).map((k) => `<div><span class="c-${teamOf(k.k)}">${esc(nameOf(k.k))}</span> <span class="w">[${esc(k.w)}]</span> <span class="c-${teamOf(k.v)}">${esc(nameOf(k.v))}</span></div>`).join('');
    if (hudCache.kf !== kf) { hudCache.kf = kf; $('killfeed').innerHTML = kf; }
    // center
    let c = '';
    if (match.st === 'ended') {
      const w = match.winner;
      const mine = you.team;
      c = (w === 'draw' ? 'DRAW' : (w === mine ? 'VICTORY' : 'DEFEAT') + '\n' + (w || '').toUpperCase() + ' WIN') +
        `\n<small>${match.sc[0]} - ${match.sc[1]} · next match in ${Math.ceil(match.rs / 1000)}s</small>`;
    } else if (!you.alive) {
      const by = you.kb === myId ? 'You' : nameOf(you.kb);
      c = (you.kw === 'Team change' ? 'SWITCHING TEAMS' : 'KILLED BY ' + esc(by).toUpperCase() + `\n<small>${esc(you.kw || '')}</small>`) +
        `\n<small>Respawning in ${(you.ri / 1000).toFixed(1)}s · ${isTouch ? 'tap &#9881;' : 'press Esc'} to change loadout</small>`;
    } else if (centerMsg && now - centerMsg.t < 1500) {
      c = esc(centerMsg.text);
    }
    if (hudCache.c !== c) { hudCache.c = c; $('center').innerHTML = c; }
  }

  requestAnimationFrame(frame);
})();
