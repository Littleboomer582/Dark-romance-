// Game simulation: rooms, players, hit detection, bots.
// Runs on the Node server, and inside the browser for offline play.
(function (root) {
  'use strict';
  const S = (typeof module !== 'undefined' && module.exports) ? require('./shared.js') : root.Shared;

const SEND_EVERY = 2; // broadcast at 30 Hz
const STREAK_WEAPONS = ['Airstrike', 'Mortar Barrage', 'Strafing Run', 'Artillery'];
// blast size per explosion kind: radius, max damage, source height for cover checks, flat = ignore height
const BLAST = { semtex: [190, 150, 6], frag: [200, 150, 6], rg: [200, 150, 6], air: [210, 155, 6], mortar: [200, 150, 6], arty: [240, 170, 6], strafe: [55, 75, 160, true] };
const RESPAWN_MS = 3500;
const NADE_CODE = { frag: 0, rg: 1, semtex: 2, molotov: 3, knife: 4, flash: 5, stun: 6, smoke: 7 };
const hasPerk = (p, id) => !!(p && (p.loadout || p.pendingLoadout) && (p.loadout || p.pendingLoadout).perks && (p.loadout || p.pendingLoadout).perks.includes(id));
const MAX_PLAYERS_PER_ROOM = 16;
const DOM_RADIUS = 100, FLAG_RADIUS = 38, FLAG_RETURN_MS = 15000, HQ_RADIUS = 140, HQ_MOVE_MS = 60000;
// Quick Play cycles through every map and mode
const ROTATION = [['ruins', 'tdm'], ['village', 'dom'], ['winter', 'ctf'], ['island', 'hq'], ['village', 'tdm'], ['winter', 'dom'], ['island', 'ctf'], ['ruins', 'hq'], ['winter', 'tdm'], ['island', 'dom'], ['ruins', 'ctf'], ['village', 'hq'],
  ['rail', 'tdm'], ['camp', 'dom'], ['harbor', 'ctf'], ['rail', 'hq'], ['camp', 'tdm'], ['harbor', 'dom'], ['rail', 'ctf'], ['camp', 'hq'], ['harbor', 'tdm']];

// ------------------------------------------------------------ bot pathing
const CELL = 40;
const GW = Math.ceil(S.MAP_W / CELL), GH = Math.ceil(S.MAP_H / CELL);
// one walkability grid per map, built on first use
const grids = {};
let blocked = null;
function buildGrid() {
  const grid = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const cx = gx * CELL + CELL / 2, cy = gy * CELL + CELL / 2;
      const r = S.PLAYER_R + 4;
      let b = cx < r || cy < r || cx > S.MAP_W - r || cy > S.MAP_H - r;
      for (const w of S.WALLS) {
        const px = S.clamp(cx, w.x, w.x + w.w), py = S.clamp(cy, w.y, w.y + w.h);
        if ((cx - px) ** 2 + (cy - py) ** 2 < r * r) { b = true; break; }
      }
      grid[gy * GW + gx] = b ? 1 : 0;
    }
  }
  return grid;
}
// Point the shared physics and the bot pathing at a room's map before working on that room.
function useRoom(room) {
  S.useMap(room.map);
  blocked = grids[room.map] || (grids[room.map] = buildGrid());
}
function cellOf(x, y) { return [S.clamp(Math.floor(x / CELL), 0, GW - 1), S.clamp(Math.floor(y / CELL), 0, GH - 1)]; }
function nearestOpen(gx, gy) {
  if (!blocked[gy * GW + gx]) return [gx, gy];
  for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = gx + dx, y = gy + dy;
    if (x >= 0 && y >= 0 && x < GW && y < GH && !blocked[y * GW + x]) return [x, y];
  }
  return [gx, gy];
}
function findPath(x0, y0, x1, y1) {
  const [sx, sy] = nearestOpen(...cellOf(x0, y0));
  const [tx, ty] = nearestOpen(...cellOf(x1, y1));
  const start = sy * GW + sx, goal = ty * GW + tx;
  const g = new Float32Array(GW * GH).fill(Infinity);
  const came = new Int32Array(GW * GH).fill(-1);
  const closed = new Uint8Array(GW * GH);
  const heap = []; // [f, idx]
  const push = (f, i) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const h = (i) => { const x = i % GW, y = (i / GW) | 0; const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  g[start] = 0; push(h(start), start);
  let iter = 0;
  while (heap.length && iter++ < 2500) {
    const [, cur] = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % GW, cy = (cur / GW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const ni = ny * GW + nx;
      if (blocked[ni]) continue;
      if (dx && dy && (blocked[cy * GW + nx] || blocked[ny * GW + cx])) continue;
      const ng = g[cur] + (dx && dy ? 1.414 : 1);
      if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ng + h(ni), ni); }
    }
  }
  if (came[goal] === -1 && goal !== start) return [];
  const pts = [];
  for (let c = goal; c !== -1 && c !== start; c = came[c]) pts.push({ x: (c % GW) * CELL + CELL / 2, y: ((c / GW) | 0) * CELL + CELL / 2 });
  pts.reverse();
  return pts;
}

// ------------------------------------------------------------------ rooms
const BOT_NAMES = ['Pvt. Baker', 'Cpl. Hayes', 'Sgt. Kowalski', 'Pvt. Ivanov', 'Gefr. Weber', 'Pvt. Duarte', 'Cpl. Novak', 'Sgt. Brandt',
  'Pvt. Morozov', 'Pvt. Fischer', 'Cpl. Ortiz', 'Sgt. Lindqvist', 'Pvt. Sato', 'Pvt. Kelly', 'Cpl. Petrov', 'Pvt. Schulz'];
const BOT_LOADOUTS = [
  { primary: 'thompson', atts: ['grip', 'extmag'] }, { primary: 'mp40', atts: ['aperture'] }, { primary: 'ppsh41', atts: ['grip'] },
  { primary: 'stg44', atts: ['grip'] }, { primary: 'garand', atts: ['aperture'] }, { primary: 'bar', atts: ['grip'] },
  { primary: 'kar98k', atts: ['scope', 'fmj'] }, { primary: 'garand', atts: ['riflenade', 'aperture'] }, { primary: 'trenchgun', atts: ['grip'] }, { primary: 'svt40', atts: [] },
  { primary: 'mg42', atts: ['grip'] }, { primary: 'type100', atts: ['extmag'] }, { primary: 'gewehr43', atts: ['aperture'] },
];
const SECONDARIES = ['colt', 'p38', 'tt33', 'nambu', 'revolver'];
const rooms = new Map();
let nextId = 1;

function makeGun(id, atts, perks) {
  const stats = S.computeStats(id, atts, perks);
  return { id, stats, ammo: stats.mag, reserve: stats.reserve };
}

const TIME_OPTIONS = [5, 10, 15, 20, 30];
function cleanText(v, max, def) { return String(v == null ? '' : v).replace(/[^\w .\-'!?#&]/g, '').trim().slice(0, max) || def; }

class Room {
  // opts: { name, bots, score, time, priv, lobby }
  constructor(code, opts) {
    this.code = code;
    this.players = new Map();
    this.nades = [];
    this.events = [];
    this.tickCount = 0;
    this.lobby = !!opts.lobby;
    this.hostId = 0;
    this.rotate = !!opts.rotate;
    this.rotIndex = Math.floor(Math.random() * ROTATION.length);
    if (this.rotate) { opts.map = ROTATION[this.rotIndex][0]; opts.mode = ROTATION[this.rotIndex][1]; }
    this.applySettings(opts);
    this.name = cleanText(opts.name, 24, this.lobby ? 'Lobby ' + code : 'Quick Play');
    this.score = { allies: 0, axis: 0 };
    if (this.lobby) { this.state = 'lobby'; this.endsAt = 0; } else this.reset();
  }

  applySettings(o) {
    if (o.bots != null) this.botsPerTeam = S.clamp(o.bots | 0, 0, 7);
    if (this.botsPerTeam == null) this.botsPerTeam = 4;
    if (this.state !== 'playing') { // map and mode only change between matches
      if (o.map && S.MAPS[o.map]) this.map = o.map;
      if (o.mode && S.MODES[o.mode] && o.mode !== this.mode) { this.mode = o.mode; this.scoreLimit = S.MODES[o.mode].def; }
    }
    if (!this.map) this.map = 'ruins';
    if (!this.mode) this.mode = 'tdm';
    const MD = S.MODES[this.mode];
    if (MD.scores.includes(+o.score)) this.scoreLimit = +o.score;
    if (!MD.scores.includes(this.scoreLimit)) this.scoreLimit = MD.def;
    if (TIME_OPTIONS.includes(+o.time)) this.matchMs = +o.time * 60000;
    if (!this.matchMs) this.matchMs = S.MATCH_MS;
    if (o.priv != null) this.priv = !!o.priv;
    if (o.name != null && this.lobby) this.name = cleanText(o.name, 24, this.name || 'Lobby');
  }

  reset() {
    const now = Date.now();
    useRoom(this);
    this.score = { allies: 0, axis: 0 };
    this.state = 'playing';
    this.endsAt = now + this.matchMs;
    this.nades = [];
    this.initObjectives(now);
    this.recon = { allies: 0, axis: 0 };
    this.jam = { allies: 0, axis: 0 };
    this.strikes = [];
    this.drops = [];
    this.fires = []; this.clouds = []; this.packs = [];
    for (const q of [...this.players.values()]) if (q.para) this.players.delete(q.id);
    for (const p of this.players.values()) {
      p.kills = 0; p.deaths = 0; p.sp = 0; p.ks = []; p.earned = [];
      this.spawn(p, now);
    }
  }

  backToLobby() {
    this.state = 'lobby';
    this.nades = [];
    for (const p of this.players.values()) { p.alive = false; p.respawnAt = Infinity; p.ready = false; p.input.fire = false; }
    this.sendLobby();
  }

  // give a player their guns without putting them on the battlefield (lobby)
  equip(p) {
    p.loadout = p.pendingLoadout;
    p.guns = [makeGun(p.loadout.primary, p.loadout.atts, p.loadout.perks), makeGun(p.loadout.secondary, p.loadout.secAtts, p.loadout.perks)];
    p.slot = 0; p.alive = false; p.respawnAt = Infinity;
  }

  info() {
    return { code: this.code, name: this.name, host: (this.players.get(this.hostId) || {}).name || '', players: this.humans().length,
      max: MAX_PLAYERS_PER_ROOM, bots: this.botsPerTeam, state: this.state, score: this.scoreLimit, time: this.matchMs / 60000, map: this.map, mode: this.mode };
  }

  // ------------------------------------------------------------ objectives
  initObjectives(now) {
    const m = S.MAPS[this.map];
    this.obj = null;
    if (this.mode === 'dom') this.obj = { pts: m.dom.map((q) => ({ x: q.x, y: q.y, owner: null, prog: 0 })), nextScore: now + 1000 };
    else if (this.mode === 'ctf') {
      const flag = (team) => ({ team, home: m.flags[team], x: m.flags[team].x, y: m.flags[team].y, state: 'home', carrier: 0, dropAt: 0 });
      this.obj = { flags: { allies: flag('allies'), axis: flag('axis') } };
    } else if (this.mode === 'hq') this.obj = { zones: m.hq, idx: 0, moveAt: now + HQ_MOVE_MS, nextScore: now + 1000, holder: null, contested: false };
  }

  teamsNear(x, y, r) {
    const n = { allies: 0, axis: 0 };
    for (const p of this.players.values()) if (p.alive && Math.hypot(p.x - x, p.y - y) < r) n[p.team]++;
    return n;
  }

  updateObjectives(now, dt) {
    const o = this.obj;
    if (!o) return;
    if (this.mode === 'dom') {
      for (let i = 0; i < o.pts.length; i++) {
        const pt = o.pts[i], n = this.teamsNear(pt.x, pt.y, DOM_RADIUS);
        const rate = 0.22 * dt;
        if (n.allies && !n.axis) pt.prog = Math.min(1, pt.prog + rate * Math.min(3, n.allies));
        else if (n.axis && !n.allies) pt.prog = Math.max(-1, pt.prog - rate * Math.min(3, n.axis));
        else if (!n.allies && !n.axis) { const home = pt.owner === 'allies' ? 1 : pt.owner === 'axis' ? -1 : 0; pt.prog += S.clamp(home - pt.prog, -rate * 0.5, rate * 0.5); }
        if (pt.owner === 'allies' && pt.prog <= 0) { pt.owner = null; this.events.push({ e: 'obj', k: 'neutral', i }); this.awardNear(pt.x, pt.y, DOM_RADIUS, 'axis', S.POINTS.neutralize, 'Neutralized', now); }
        if (pt.owner === 'axis' && pt.prog >= 0) { pt.owner = null; this.events.push({ e: 'obj', k: 'neutral', i }); this.awardNear(pt.x, pt.y, DOM_RADIUS, 'allies', S.POINTS.neutralize, 'Neutralized', now); }
        if (!pt.owner && pt.prog >= 1) { pt.owner = 'allies'; this.events.push({ e: 'obj', k: 'cap', i, t: 'allies' }); this.awardNear(pt.x, pt.y, DOM_RADIUS, 'allies', S.POINTS.capture, 'Captured', now); }
        if (!pt.owner && pt.prog <= -1) { pt.owner = 'axis'; this.events.push({ e: 'obj', k: 'cap', i, t: 'axis' }); this.awardNear(pt.x, pt.y, DOM_RADIUS, 'axis', S.POINTS.capture, 'Captured', now); }
      }
      if (now >= o.nextScore) { o.nextScore += 4000; for (const pt of o.pts) if (pt.owner) this.score[pt.owner]++; }
    } else if (this.mode === 'ctf') {
      for (const team of ['allies', 'axis']) {
        const f = o.flags[team], enemy = team === 'allies' ? 'axis' : 'allies';
        if (f.state === 'carried') {
          const c = this.players.get(f.carrier);
          if (!c || !c.alive || c.team === team) { f.state = 'dropped'; f.dropAt = now; f.carrier = 0; this.events.push({ e: 'obj', k: 'drop', t: team }); continue; }
          f.x = c.x; f.y = c.y;
          const myFlag = o.flags[enemy];
          if (myFlag.state === 'home' && Math.hypot(c.x - myFlag.home.x, c.y - myFlag.home.y) < FLAG_RADIUS + 14) {
            this.score[enemy]++;
            this.events.push({ e: 'obj', k: 'cap', t: team, i: c.id });
            this.award(c, S.POINTS.flagCapture, 'Flag captured', now);
            f.state = 'home'; f.x = f.home.x; f.y = f.home.y; f.carrier = 0;
          }
          continue;
        }
        if (f.state === 'dropped' && now - f.dropAt > FLAG_RETURN_MS) { f.state = 'home'; f.x = f.home.x; f.y = f.home.y; this.events.push({ e: 'obj', k: 'return', t: team }); continue; }
        for (const p of this.players.values()) {
          if (!p.alive || Math.hypot(p.x - f.x, p.y - f.y) > FLAG_RADIUS) continue;
          if (p.team !== team) { f.state = 'carried'; f.carrier = p.id; this.events.push({ e: 'obj', k: 'take', t: team, i: p.id }); this.award(p, S.POINTS.flagTake, 'Flag taken', now); break; }
          if (f.state === 'dropped') { f.state = 'home'; f.x = f.home.x; f.y = f.home.y; this.events.push({ e: 'obj', k: 'return', t: team, i: p.id }); this.award(p, S.POINTS.flagReturn, 'Flag returned', now); break; }
        }
      }
    } else if (this.mode === 'hq') {
      if (now >= o.moveAt) { o.idx = (o.idx + 1) % o.zones.length; o.moveAt = now + HQ_MOVE_MS; this.events.push({ e: 'obj', k: 'move', i: o.idx }); }
      const z = o.zones[o.idx], n = this.teamsNear(z.x, z.y, HQ_RADIUS);
      o.contested = !!(n.allies && n.axis);
      o.holder = o.contested ? null : n.allies ? 'allies' : n.axis ? 'axis' : null;
      if (now >= o.nextScore) { o.nextScore += 1000; if (o.holder) { this.score[o.holder] += 1; this.awardNear(z.x, z.y, HQ_RADIUS, o.holder, S.POINTS.hqSecond, 'Holding HQ', now); } }
    }
  }

  objState(now) {
    const o = this.obj;
    if (!o) return null;
    const code = (t) => (t === 'allies' ? 1 : t === 'axis' ? 2 : 0);
    if (this.mode === 'dom') return { p: o.pts.map((pt) => [code(pt.owner), Math.round(pt.prog * 100)]) };
    if (this.mode === 'ctf') return { f: ['allies', 'axis'].map((t) => { const f = o.flags[t]; return [f.state === 'home' ? 0 : f.state === 'carried' ? 1 : 2, f.x | 0, f.y | 0, f.carrier || 0]; }) };
    if (this.mode === 'hq') return { z: o.idx, mv: Math.max(0, o.moveAt - now), h: code(o.holder), c: o.contested ? 1 : 0 };
    return null;
  }

  sendLobby() {
    const msg = JSON.stringify({ t: 'lobby', code: this.code, name: this.name, host: this.hostId, state: this.state, lobby: this.lobby, priv: !!this.priv,
      settings: { bots: this.botsPerTeam, score: this.scoreLimit, time: this.matchMs / 60000, map: this.map, mode: this.mode },
      players: [...this.players.values()].map((p) => ({ i: p.id, n: p.name, t: p.team, b: p.bot ? 1 : 0, r: p.ready ? 1 : 0 })) });
    for (const p of this.players.values()) if (!p.bot && p.ws && p.ws.readyState === 1) p.ws.send(msg);
  }

  humans() { return [...this.players.values()].filter((p) => !p.bot); }

  teamCount(team) { let n = 0; for (const p of this.players.values()) if (p.team === team) n++; return n; }

  pickTeam() { return this.teamCount('allies') <= this.teamCount('axis') ? 'allies' : 'axis'; }

  addPlayer(p) {
    const humans = (t) => [...this.players.values()].filter((q) => !q.bot && q.team === t).length;
    p.team = humans('allies') <= humans('axis') ? 'allies' : 'axis';
    this.players.set(p.id, p);
    if (!this.hostId) this.hostId = p.id;
    if (this.state === 'playing') this.spawn(p, Date.now()); else this.equip(p);
    this.balanceBots();
    this.sendLobby();
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.humans().length === 0) { rooms.delete(this.code); return; }
    if (this.hostId === id) this.hostId = this.humans()[0].id;
    this.balanceBots();
    this.sendLobby();
    this.sendRoster();
  }

  balanceBots() {
    for (const team of ['allies', 'axis']) {
      const members = [...this.players.values()].filter((p) => p.team === team && !p.para);
      const humans = members.filter((p) => !p.bot).length;
      const want = Math.max(0, this.botsPerTeam - humans);
      const bots = members.filter((p) => p.bot);
      while (bots.length > want) this.players.delete(bots.pop().id);
      while (bots.length < want && this.players.size < MAX_PLAYERS_PER_ROOM) {
        const b = createBot(team, new Set([...this.players.values()].map((q) => q.name)));
        bots.push(b);
        this.players.set(b.id, b);
        if (this.state === 'playing') this.spawn(b, Date.now()); else this.equip(b);
      }
    }
  }

  spawn(p, now) {
    const list = S.SPAWNS[p.team];
    const enemies = [...this.players.values()].filter((q) => q.team !== p.team && q.alive);
    let best = list[0], bestScore = -Infinity;
    for (const s of list) {
      let d = Infinity;
      for (const e of enemies) d = Math.min(d, Math.hypot(e.x - s.x, e.y - s.y));
      const score = d + Math.random() * 300;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    const pos = S.resolveCircle(best.x + (Math.random() - 0.5) * 40, best.y + (Math.random() - 0.5) * 40, S.PLAYER_R);
    p.x = pos[0]; p.y = pos[1];
    p.ang = p.team === 'allies' ? 0 : Math.PI;
    p.hp = S.MAX_HP;
    p.alive = true;
    p.lastHurt = 0;
    p.spawnProtectUntil = now + 2000;
    p.loadout = p.pendingLoadout;
    p.guns = [makeGun(p.loadout.primary, p.loadout.atts, p.loadout.perks), makeGun(p.loadout.secondary, p.loadout.secAtts, p.loadout.perks)];
    p.rgren = p.guns[0].stats.rifleNades;
    p.nextRg = 0;
    Object.assign(p, S.newMoveState(p.x, p.y));
    p.pitch = 0;
    p.slot = 0;
    p.reloadEnd = 0;
    p.nextShot = now + 300;
    p.nades = S.LETHALS[p.loadout.lethal].count;
    p.tacs = S.TACTICALS[p.loadout.tactical].count;
    p.flashUntil = 0; p.stunUntil = 0;
    p.nextMelee = 0;
    p.radarUntil = 0;
    p.path = null;
    p.input.fire = false;
  }

  gun(p) { return p.guns[p.slot]; }

  startReload(p, now) {
    const g = this.gun(p);
    if (p.reloadEnd || g.ammo >= g.stats.mag || g.reserve <= 0) return;
    p.reloadEnd = now + g.stats.reload;
  }

  swap(p, now) {
    p.slot = 1 - p.slot;
    p.reloadEnd = 0;
    p.nextShot = Math.max(p.nextShot, now + 350);
  }

  damage(victim, dmg, attacker, weapon, now, hs) {
    if (!victim.alive || victim.spawnProtectUntil > now) return;
    victim.hp -= dmg;
    victim.lastHurt = now;
    if (attacker && attacker.id !== victim.id) (victim.hurtBy || (victim.hurtBy = {}))[attacker.id] = now;
    this.events.push({ e: 'h', i: victim.id, b: attacker.id, x: victim.x | 0, y: victim.y | 0, hs: hs ? 1 : 0 });
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths++;
      victim.respawnAt = now + RESPAWN_MS;
      victim.killedBy = attacker.id;
      victim.killedWith = weapon;
      victim.killerPos = [attacker.x | 0, attacker.y | 0];
      victim.sp = 0; victim.earned = [];
      if (attacker !== victim && attacker.team !== victim.team) {
        attacker.kills++;
        if (!STREAK_WEAPONS.includes(weapon)) this.award(attacker, S.POINTS.kill + (hs ? S.POINTS.headshot : 0), hs ? 'Headshot' : 'Kill', now);
        for (const [id, t] of Object.entries(victim.hurtBy || {})) { // assists
          const q = this.players.get(+id);
          if (q && q !== attacker && q.team === attacker.team && now - t < 6000) this.award(q, S.POINTS.assist, 'Assist', now);
        }
        if (this.state === 'playing' && this.mode === 'tdm') this.score[attacker.team]++;
      }
      victim.hurtBy = {};
      if (attacker !== victim && this.packs) this.packs.push({ id: nextId++, x: victim.x, y: victim.y, until: now + 20000 });
      this.events.push({ e: 'k', k: attacker.id, v: victim.id, w: weapon, hs: hs ? 1 : 0 });
    }
  }

  fire(p, now) {
    const g = this.gun(p);
    const st = g.stats;
    let spread = S.currentSpread(st, p.ads, p.moving, p.stance, p.sprintActive, p.air);
    if (p.bot) spread = Math.max(spread * 2, 0.025); // bots are less accurate than players
    if (p.stunUntil > now) spread = spread * 2 + 0.03; // dazed
    p.spawnProtectUntil = 0;
    g.ammo--;
    p.nextShot = now + st.rate;
    if (!st.suppressed) p.radarUntil = now + 2000;
    const maxD = st.range * (st.pellets > 1 ? 1.4 : 2.2);
    const eye = p.z + S.eyeHeight(p.stance);
    const hits = new Map();
    for (let i = 0; i < st.pellets; i++) {
      // random point in a cone around the aim direction
      const r = Math.sqrt(Math.random()) * spread, th = Math.random() * Math.PI * 2;
      const yaw = p.ang + Math.cos(th) * r, pitch = S.clamp(p.pitch + Math.sin(th) * r, -1.5, 1.5);
      const cp = Math.cos(pitch);
      const dx = Math.cos(yaw) * cp, dy = Math.sin(yaw) * cp, dh = Math.sin(pitch);
      const wallD = S.rayWorld(p.x, p.y, eye, dx, dy, dh, maxD, st.fmj);
      const thinD = st.fmj ? S.rayWorld(p.x, p.y, eye, dx, dy, dh, maxD, false) : wallD;
      let hd = wallD, hit = null;
      for (const q of this.players.values()) {
        if (!q.alive || q.team === p.team) continue;
        const t = S.rayCylinder(p.x, p.y, eye - q.z, dx, dy, dh, q.x, q.y, S.PLAYER_R, S.bodyHeight(q.stance));
        if (t < hd) { hd = t; hit = q; }
      }
      const endD = hit ? hd : thinD;
      this.events.push({ e: 's', i: p.id, x: p.x | 0, y: p.y | 0, z: eye, a: +yaw.toFixed(4), q: +pitch.toFixed(4), d: endD | 0, w: g.id, s: st.noFlash ? 1 : 0, u: st.suppressed ? 1 : 0, p: i, k: hit ? 1 : 0 });
      if (hit) {
        const hh = eye + dh * hd;
        const hs = hh - hit.z > S.bodyHeight(hit.stance) - S.headZone(hit.stance);
        let dmg = st.dmg * (hd > st.range ? 0.65 : 1) * (hs ? S.HEADSHOT_MULT : 1);
        if (hd > thinD) dmg *= 0.7; // penetrated cover
        const prev = hits.get(hit) || { dmg: 0, hs: false };
        hits.set(hit, { dmg: prev.dmg + dmg, hs: prev.hs || hs });
      }
    }
    for (const [q, h] of hits) this.damage(q, h.dmg, p, st.name, now, h.hs);
    if (g.ammo <= 0) this.startReload(p, now);
  }

  melee(p, now) {
    if (!p.alive || now < p.nextMelee) return;
    p.nextMelee = now + 700;
    p.reloadEnd = 0;
    p.nextShot = Math.max(p.nextShot, now + 400);
    const range = this.gun(p).stats.bayonet ? 85 : 52;
    this.events.push({ e: 'm', i: p.id });
    let best = null, bd = Infinity;
    for (const q of this.players.values()) {
      if (!q.alive || q.team === p.team) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y) - S.PLAYER_R;
      if (d > range) continue;
      let da = Math.atan2(q.y - p.y, q.x - p.x) - p.ang;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > 1.1 || !S.hasLOS(p.x, p.y, q.x, q.y)) continue;
      if (d < bd) { bd = d; best = q; }
    }
    if (best) {
      if (range > 60 && bd > 30) { // bayonet lunge
        const pos = S.moveCircle(p.x, p.y, Math.cos(p.ang) * bd * 0.7, Math.sin(p.ang) * bd * 0.7, S.PLAYER_R);
        p.x = pos[0]; p.y = pos[1];
      }
      best.spawnProtectUntil = 0;
      this.damage(best, 200, p, range > 60 ? 'Bayonet' : 'Knife', now);
    }
  }

  launch(p, kind, speed, up, now, fuse) {
    const eye = p.z + S.eyeHeight(p.stance);
    const cp = Math.cos(p.pitch);
    const dx = Math.cos(p.ang) * cp, dy = Math.sin(p.ang) * cp, dh = Math.sin(p.pitch);
    const start = S.moveCircle(p.x, p.y, dx * 18, dy * 18, 4);
    this.nades.push({ id: nextId++, kind, owner: p.id, team: p.team, x: start[0], y: start[1], h: eye - 6,
      vx: dx * speed, vy: dy * speed, vh: dh * speed + up, explodeAt: now + fuse });
  }

  throwNade(p, now) {
    if (!p.alive || p.nades <= 0 || this.state !== 'playing' || now < (p.nextThrow || 0)) return;
    p.nades--;
    p.nextThrow = now + 600;
    p.spawnProtectUntil = 0;
    const k = p.loadout.lethal;
    if (k === 'knife') this.launch(p, 'knife', 1500, 40, now, 3000);
    else if (k === 'molotov') this.launch(p, 'molotov', 600, 170, now, 5000);
    else if (k === 'semtex') this.launch(p, 'semtex', 600, 180, now, 2600);
    else this.launch(p, 'frag', 620, 180, now, 2400);
    this.events.push({ e: 'n', i: p.id, k });
  }
  throwTactical(p, now) {
    if (!p.alive || !(p.tacs > 0) || this.state !== 'playing' || now < (p.nextThrow || 0)) return;
    p.tacs--;
    p.nextThrow = now + 600;
    p.spawnProtectUntil = 0;
    const k = p.loadout.tactical;
    this.launch(p, k, 620, 180, now, k === 'smoke' ? 1200 : 1500);
    this.events.push({ e: 'n', i: p.id, k });
  }
  // flashbang / stun grenade: affects whoever is near (and, for a flash, looking at it)
  bang(n, now) {
    n.dead = true;
    const flash = n.kind === 'flash', R = flash ? 700 : 320;
    this.events.push({ e: 'fb', x: n.x | 0, y: n.y | 0, z: Math.max(0, n.h) | 0, k: flash ? 1 : 0 });
    for (const q of this.players.values()) {
      if (!q.alive || (q.team === n.team && q.id !== n.owner)) continue;
      const eye = q.z + S.eyeHeight(q.stance);
      const d = Math.hypot(q.x - n.x, q.y - n.y, (eye - n.h) * 0.6);
      if (d > R || !S.hasLOS3(n.x, n.y, Math.max(n.h, 6), q.x, q.y, eye)) continue;
      let k = 1 - d / R;
      if (flash) {
        const a = Math.atan2(n.y - q.y, n.x - q.x) - q.ang;
        const facing = Math.cos(Math.atan2(Math.sin(a), Math.cos(a)));
        k *= facing > 0.5 ? 1 : facing > 0 ? 0.6 : 0.3;
        k = Math.min(1, k * 1.6);
      }
      if (hasPerk(q, 'tacmask')) k *= 0.2;
      const ms = Math.round(4000 * k);
      if (ms < 300) continue;
      if (flash) q.flashUntil = Math.max(q.flashUntil || 0, now + ms); else q.stunUntil = Math.max(q.stunUntil || 0, now + ms);
      if (q.bot && flash) q.bot.target = null;
      this.events.push({ e: flash ? 'fl' : 'stn', i: q.id, ms });
    }
  }
  ignite(n, now) {
    n.dead = true;
    this.fires.push({ id: nextId++, x: n.x, y: n.y, until: now + 6000, owner: n.owner, team: n.team, next: 0 });
    this.events.push({ e: 'fire', x: n.x | 0, y: n.y | 0 });
  }
  smokeBlocks(x0, y0, x1, y1) {
    for (const c of this.clouds) {
      const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
      const t = S.clamp(((c.x - x0) * dx + (c.y - y0) * dy) / L2, 0, 1);
      if (Math.hypot(x0 + dx * t - c.x, y0 + dy * t - c.y) < 130) return true;
    }
    return false;
  }
  updateZones(now) {
    this.clouds = this.clouds.filter((c) => now < c.until);
    this.fires = this.fires.filter((f) => now < f.until);
    for (const f of this.fires) {
      if (now < f.next) continue;
      f.next = now + 250;
      const owner = this.players.get(f.owner) || { id: f.owner, team: f.team, kills: 0, x: f.x, y: f.y };
      for (const q of this.players.values()) {
        if (!q.alive || q.z > 30 || (q.team === f.team && q.id !== f.owner) || Math.hypot(q.x - f.x, q.y - f.y) > 85) continue;
        q.spawnProtectUntil = Math.min(q.spawnProtectUntil, now);
        this.damage(q, 12 * (hasPerk(q, 'flak') ? 0.55 : 1) * (hasPerk(owner, 'dangerclose') ? 1.25 : 1), owner, 'Molotov', now, false);
      }
    }
    // scavenger packs
    this.packs = this.packs.filter((k) => now < k.until && !k.used);
    for (const k of this.packs) for (const q of this.players.values()) {
      if (k.used || !q.alive || !hasPerk(q, 'scavenger') || Math.hypot(q.x - k.x, q.y - k.y) > 42) continue;
      k.used = true;
      for (const g of q.guns) g.reserve = Math.max(g.reserve, g.stats.reserve);
      q.nades = Math.min(S.LETHALS[q.loadout.lethal].count, q.nades + 1);
      q.rgren = Math.max(q.rgren || 0, Math.min(1, q.guns[0].stats.rifleNades));
      this.events.push({ e: 'scav', i: q.id });
    }
  }

  fireRifleNade(p, now) {
    if (!p.alive || p.slot !== 0 || p.rgren <= 0 || now < p.nextRg || p.reloadEnd || this.state !== 'playing') return;
    p.rgren--;
    p.nextRg = now + 1200;
    p.nextShot = Math.max(p.nextShot, now + 600);
    p.spawnProtectUntil = 0;
    p.radarUntil = now + 2000;
    this.launch(p, 'rg', 1250, 60, now, 4000);
    this.events.push({ e: 'rg', i: p.id });
  }

  explode(n, now) {
    if (n.kind === 'flash' || n.kind === 'stun') return this.bang(n, now);
    if (n.kind === 'molotov') return this.ignite(n, now);
    if (n.kind === 'smoke') { n.dead = true; this.clouds.push({ id: nextId++, x: n.x, y: n.y, until: now + 12000 }); this.events.push({ e: 'smk', x: n.x | 0, y: n.y | 0 }); return; }
    if (n.kind === 'knife') { n.dead = true; return; }
    n.dead = true;
    this.events.push({ e: 'x', x: n.x | 0, y: n.y | 0, z: Math.max(0, n.h) | 0, sm: n.kind === 'strafe' ? 1 : 0 });
    const owner = this.players.get(n.owner) || { id: n.owner, team: n.team, kills: 0 };
    const name = { semtex: 'Semtex', rg: 'Rifle Grenade', air: 'Airstrike', mortar: 'Mortar Barrage', arty: 'Artillery', strafe: 'Strafing Run' }[n.kind] || 'Frag Grenade';
    const streak = STREAK_WEAPONS.includes(name);
    const [R, DMG, SRC, flat] = BLAST[n.kind] || BLAST.frag;
    for (const q of this.players.values()) {
      if (!q.alive || (q.team === n.team && (q.id !== n.owner || streak))) continue;
      const qh = q.z + S.bodyHeight(q.stance) * 0.5;
      const d = flat ? Math.hypot(q.x - n.x, q.y - n.y) : Math.hypot(q.x - n.x, q.y - n.y, (qh - n.h) * 0.6);
      if (d > R || !S.hasLOS3(n.x, n.y, Math.max(n.h, SRC), q.x, q.y, qh)) continue;
      q.spawnProtectUntil = Math.min(q.spawnProtectUntil, now);
      const core = R * 0.3;
      const mult = (hasPerk(q, 'flak') ? 0.55 : 1) * (!streak && hasPerk(owner, 'dangerclose') ? 1.25 : 1);
      this.damage(q, (d < core ? DMG : DMG * (1 - (d - core) / (R - core))) * mult, owner, name, now, false);
    }
  }

  // ------------------------------------------------------------ scorestreaks
  award(p, pts, why, now) {
    if (!p || !p.ks || !p.alive || this.state !== 'playing') return;
    p.sp = (p.sp || 0) + pts;
    if (!p.bot) this.events.push({ e: 'pts', i: p.id, n: pts, w: why });
    const chosen = (p.loadout || p.pendingLoadout).streaks || S.DEFAULT_STREAKS;
    p.earned = p.earned || [];
    for (const id of chosen) {
      if (S.streakCost(id, (p.loadout || p.pendingLoadout).perks) <= p.sp && !p.earned.includes(id)) { p.earned.push(id); p.ks.push(id); this.events.push({ e: 'ksE', i: p.id, k: id }); }
    }
  }
  awardNear(x, y, r, team, pts, why, now) {
    for (const q of this.players.values()) if (q.alive && q.team === team && Math.hypot(q.x - x, q.y - y) < r) this.award(q, pts, why, now);
  }
  aimPoint(p, target) {
    if (target) return { x: target.x, y: target.y, ang: target.ang };
    const eye = p.z + S.eyeHeight(p.stance), pt = Math.min(p.pitch, -0.05);
    const cp = Math.cos(pt), dx = Math.cos(p.ang) * cp, dy = Math.sin(p.ang) * cp, dh = Math.sin(pt);
    const d = Math.min(1400, S.rayWorld(p.x, p.y, eye, dx, dy, dh, 1400));
    return { x: p.x + dx * d, y: p.y + dy * d, ang: p.ang };
  }
  updateDrops(now) {
    if (!this.drops || !this.drops.length) return;
    this.drops = this.drops.filter((d) => now < d.until);
    for (const d of this.drops) {
      if (now < d.landAt) continue;
      for (const q of this.players.values()) {
        if (!q.alive || q.team !== d.team || d.used.includes(q.id) || Math.hypot(q.x - d.x, q.y - d.y) > 46) continue;
        d.used.push(q.id);
        for (const g of q.guns) { g.ammo = g.stats.mag; g.reserve = g.stats.reserve; }
        q.nades = S.LETHALS[q.loadout.lethal].count; q.tacs = S.TACTICALS[q.loadout.tactical].count; q.rgren = q.guns[0].stats.rifleNades; q.hp = S.MAX_HP;
        this.events.push({ e: 'sup', i: q.id });
      }
    }
  }
  updateParas(now, dt) {
    for (const q of [...this.players.values()]) {
      if (!q.para) continue;
      if (now > q.paraUntil || !q.alive) { this.players.delete(q.id); this.events.push({ e: 'paraOut', i: q.id }); }
    }
  }
  // target (optional, for bots): { x, y, ang }
  useStreak(p, id, now, target) {
    if (!p.alive || !p.ks || !p.ks.includes(id) || this.state !== 'playing') return;
    p.ks.splice(p.ks.indexOf(id), 1);
    const enemyTeam = p.team === 'allies' ? 'axis' : 'allies';
    if (id === 'recon') {
      this.recon[p.team] = now + S.STREAKS.recon.ms;
      this.events.push({ e: 'ks', k: id, t: p.team, i: p.id });
      return;
    }
    if (id === 'counter') {
      this.jam[enemyTeam] = now + S.STREAKS.counter.ms;
      this.events.push({ e: 'ks', k: id, t: p.team, i: p.id });
      return;
    }
    if (id === 'supply') {
      const pos = S.resolveCircle(p.x + Math.cos(p.ang) * 70, p.y + Math.sin(p.ang) * 70, 30);
      const d = { id: nextId++, x: pos[0], y: pos[1], team: p.team, landAt: now + 3000, until: now + 63000, used: [] };
      this.drops.push(d);
      this.events.push({ e: 'ks', k: id, t: p.team, i: p.id, x: d.x | 0, y: d.y | 0 });
      return;
    }
    if (id === 'para') {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const b = createBot(p.team, new Set([...this.players.values()].map((q) => q.name)));
        b.name = b.name.replace('[BOT]', '[PARA]');
        b.para = true; b.paraUntil = now + S.STREAKS.para.ms;
        this.players.set(b.id, b);
        this.spawn(b, now);
        const a = (i / 3) * Math.PI * 2 + p.ang;
        const pos = S.resolveCircle(p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, S.PLAYER_R);
        b.x = pos[0]; b.y = pos[1]; b.z = 380 + i * 40; b.spawnProtectUntil = 0;
        ids.push(b.id);
      }
      this.events.push({ e: 'ks', k: id, t: p.team, i: p.id, x: p.x | 0, y: p.y | 0, ids });
      this.sendRoster();
      return;
    }
    const shells = [];
    if (id === 'strafe') {
      const { x: tx, y: ty, ang } = this.aimPoint(p, target);
      for (let i = 0; i < 26; i++) {
        const off = (i - 13) * 40;
        const x = S.clamp(tx + Math.cos(ang) * off + (Math.random() - 0.5) * 30, 20, S.MAP_W - 20), y = S.clamp(ty + Math.sin(ang) * off + (Math.random() - 0.5) * 30, 20, S.MAP_H - 20);
        shells.push([x | 0, y | 0, 2600 + i * 45]);
      }
      this.events.push({ e: 'ks', k: id, t: p.team, i: p.id, x: tx | 0, y: ty | 0, a: +ang.toFixed(3), s: shells });
    } else if (id === 'arty') {
      const x0 = enemyTeam === 'axis' ? S.MAP_W / 2 : 60, x1 = enemyTeam === 'axis' ? S.MAP_W - 60 : S.MAP_W / 2;
      for (let i = 0; i < 16; i++) shells.push([(x0 + Math.random() * (x1 - x0)) | 0, (60 + Math.random() * (S.MAP_H - 120)) | 0, 2600 + i * 380 + Math.random() * 200]);
      this.events.push({ e: 'ks', k: id, t: p.team, i: p.id, s: shells });
    } else if (id === 'air') {
      const { x: tx, y: ty, ang } = this.aimPoint(p, target);
      for (let i = 0; i < 7; i++) {
        const off = (i - 3) * 85;
        const x = S.clamp(tx + Math.cos(ang) * off, 20, S.MAP_W - 20), y = S.clamp(ty + Math.sin(ang) * off, 20, S.MAP_H - 20);
        shells.push([x | 0, y | 0, 3200 + i * 110]);
      }
      this.events.push({ e: 'ks', k: id, t: p.team, i: p.id, x: tx | 0, y: ty | 0, a: +ang.toFixed(3), s: shells });
    } else if (id === 'mortar') {
      const enemies = [...this.players.values()].filter((q) => q.alive && q.team === enemyTeam);
      for (let i = 0; i < 10; i++) {
        const q = enemies.length ? enemies[Math.floor(Math.random() * enemies.length)] : null;
        const x = S.clamp((q ? q.x : Math.random() * S.MAP_W) + (Math.random() - 0.5) * 220, 20, S.MAP_W - 20);
        const y = S.clamp((q ? q.y : Math.random() * S.MAP_H) + (Math.random() - 0.5) * 220, 20, S.MAP_H - 20);
        shells.push([x | 0, y | 0, 2000 + i * 650 + Math.random() * 300]);
      }
      this.events.push({ e: 'ks', k: id, t: p.team, i: p.id, s: shells });
    }
    for (const [x, y, ms] of shells) this.strikes.push({ at: now + ms, x, y, h: 4, owner: p.id, team: p.team, kind: id });
  }

  updateStrikes(now) {
    if (!this.strikes || !this.strikes.length) return;
    const due = this.strikes.filter((st) => now >= st.at);
    if (!due.length) return;
    this.strikes = this.strikes.filter((st) => now < st.at);
    for (const st of due) this.explode(st, now);
  }

  blockedAt(x, y, h, r) {
    if (x < r || y < r || x > S.MAP_W - r || y > S.MAP_H - r) return true;
    for (const w of S.WALLS) {
      if (h > w.ht) continue;
      if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
    }
    return false;
  }

  updateNades(dt, now) {
    for (const n of this.nades) {
      n.vh -= 900 * dt;
      if (n.stuck) { // semtex stuck to a surface or a player
        const q = n.stuckTo && this.players.get(n.stuckTo);
        if (q && q.alive) { n.x = q.x; n.y = q.y; n.h = q.z + S.bodyHeight(q.stance) * 0.6; }
        if (now >= n.explodeAt) this.explode(n, now);
        continue;
      }
      if (n.kind === 'rg' || n.kind === 'knife') {
        if (n.kind === 'knife') n.vh += 600 * dt; // knives fly flatter
        const sx = n.vx * dt, sy = n.vy * dt, sh = n.vh * dt;
        const len = Math.hypot(sx, sy, sh) || 1;
        const t = S.rayWorld(n.x, n.y, n.h, sx / len, sy / len, sh / len, len);
        let hitPlayer = false;
        for (const q of this.players.values()) {
          if (!q.alive || q.team === n.team) continue;
          if (S.rayCylinder(n.x, n.y, n.h - q.z, sx / len, sy / len, sh / len, q.x, q.y, S.PLAYER_R + 4, S.bodyHeight(q.stance)) <= len) {
            hitPlayer = true;
            if (n.kind === 'knife' && !n.dead) {
              n.dead = true;
              const owner = this.players.get(n.owner) || { id: n.owner, team: n.team, kills: 0, x: n.x, y: n.y };
              q.spawnProtectUntil = Math.min(q.spawnProtectUntil, now);
              this.damage(q, 200, owner, 'Throwing Knife', now, false);
            }
          }
        }
        if (n.dead) continue;
        const k = Math.min(t, len) / len;
        n.x += sx * k; n.y += sy * k; n.h += sh * k;
        if (t < len || hitPlayer || now >= n.explodeAt) this.explode(n, now);
        continue;
      }
      // frag, tacticals: bounce off walls and the ground; molotov shatters, semtex sticks
      const breaks = n.kind === 'molotov', sticks = n.kind === 'semtex';
      if (sticks) {
        for (const q of this.players.values()) {
          if (!q.alive || q.team === n.team || Math.hypot(q.x - n.x, q.y - n.y) > S.PLAYER_R + 6 || n.h > q.z + S.bodyHeight(q.stance) + 4) continue;
          n.stuck = true; n.stuckTo = q.id; this.events.push({ e: 'stk', i: q.id, b: n.owner }); break;
        }
        if (n.stuck) continue;
      }
      const nx = n.x + n.vx * dt;
      let hit = false;
      if (this.blockedAt(nx, n.y, n.h, 4)) { n.vx *= -0.45; hit = true; } else n.x = nx;
      const ny = n.y + n.vy * dt;
      if (this.blockedAt(n.x, ny, n.h, 4)) { n.vy *= -0.45; hit = true; } else n.y = ny;
      const nh = n.h + n.vh * dt;
      if (nh <= 3 || (nh < n.h && this.blockedAt(n.x, n.y, nh, 4))) hit = true;
      if (hit && breaks) { if (nh <= 3) n.h = 3; this.ignite(n, now); continue; }
      if (hit && sticks) { n.stuck = true; n.h = Math.max(3, Math.min(n.h, nh > 3 ? n.h : 3)); continue; }
      if (nh <= 3) {
        n.h = 3;
        if (n.vh < 0) n.vh = -n.vh * 0.35;
        if (n.vh < 40) n.vh = 0;
        const fr = Math.pow(0.08, dt);
        n.vx *= fr; n.vy *= fr;
      } else if (this.blockedAt(n.x, n.y, nh, 4)) {
        // landed on top of cover
        n.vh = Math.abs(n.vh) < 60 ? 0 : -n.vh * 0.35;
        n.vx *= 0.7; n.vy *= 0.7;
      } else n.h = nh;
      if (now >= n.explodeAt) this.explode(n, now);
    }
    this.nades = this.nades.filter((n) => !n.dead);
  }

  updatePlayer(p, now, dt) {
    if (!p.alive) {
      if (now >= p.respawnAt && this.state === 'playing') this.spawn(p, now);
      return;
    }
    const g = this.gun(p);
    if (p.reloadEnd && now >= p.reloadEnd) {
      const need = g.stats.mag - g.ammo;
      const take = Math.min(need, g.reserve);
      g.ammo += take; g.reserve -= take;
      p.reloadEnd = 0;
    }
    // a trigger pull is remembered briefly, so a quick click (or one made while the gun is still
    // cycling) always fires even if the button was released before this tick
    const pulled = p.firePressedAt && now - p.firePressedAt < 350;
    if ((p.input.fire || pulled) && !p.sprintActive && !p.reloadEnd && now >= p.nextShot && this.state === 'playing') {
      if (g.ammo > 0) {
        if (g.stats.burst) { if ((!p.triggerHeld || pulled) && !(p.burstLeft > 0)) { p.burstLeft = g.stats.burst; p.firePressedAt = 0; } }
        else if (g.stats.auto || !p.triggerHeld || pulled) { this.fire(p, now); p.firePressedAt = 0; }
      } else if (g.reserve > 0) this.startReload(p, now);
      else if (p.slot === 0) this.swap(p, now);
    }
    // burst weapons: keep firing the rest of the burst, then pause
    if (p.burstLeft > 0) {
      if (g.ammo <= 0 || p.reloadEnd || !g.stats.burst) p.burstLeft = 0;
      else if (now >= p.nextShot && this.state === 'playing') { this.fire(p, now); p.burstLeft--; if (!p.burstLeft) p.nextShot = now + g.stats.rate * 3.2; }
    }
    p.triggerHeld = p.input.fire;
    if (now - p.lastHurt > 4500 && p.hp < S.MAX_HP) p.hp = Math.min(S.MAX_HP, p.hp + 30 * dt);
  }

  // Movement inputs from a human client, applied as they arrive (client-side prediction mirrors this).
  applyInputs(p, list) {
    for (const it of list) {
      if (!Array.isArray(it) || it.length < 5) continue;
      const [seq, dtRaw, mxRaw, myRaw, flags] = it;
      if (!(seq > p.lastSeq)) continue;
      p.lastSeq = seq;
      let dt = S.clamp(+dtRaw || 0, 0, 0.05);
      dt = Math.min(dt, p.moveBudget);
      p.moveBudget -= dt;
      const mx = S.clamp(+mxRaw || 0, -1, 1), my = S.clamp(+myRaw || 0, -1, 1);
      p.ads = !!(flags & 1);
      p.sprint = !!(flags & 2);
      p.moving = Math.hypot(mx, my) > 0.1;
      if (!p.alive || this.state !== 'playing') continue;
      S.stepMove(p, mx, my, flags | 0, dt, this.gun(p).stats);
      p.sprintActive = p.ps;
      p.crouch = p.stance > 0;
    }
  }

  tick(now, dt) {
    this.tickCount++;
    if (this.state === 'lobby') {
      // waiting for the host to start: nothing to simulate
    } else if (this.state === 'ended') {
      if (now >= this.restartAt) {
        if (this.lobby) this.backToLobby();
        else {
          if (this.rotate) { this.rotIndex = (this.rotIndex + 1) % ROTATION.length; this.state = 'lobby'; this.applySettings({ map: ROTATION[this.rotIndex][0], mode: ROTATION[this.rotIndex][1] }); }
          this.reset();
        }
      }
    } else {
      for (const p of this.players.values()) {
        if (p.bot) { p.moveBudget = 1; botThink(this, p, now, dt); }
        else p.moveBudget = Math.min(0.3, p.moveBudget + dt);
        this.updatePlayer(p, now, dt);
      }
      this.updateNades(dt, now);
      this.updateObjectives(now, dt);
      this.updateStrikes(now);
      this.updateDrops(now);
      this.updateZones(now);
      this.updateParas(now, dt);
      if (this.score.allies >= this.scoreLimit || this.score.axis >= this.scoreLimit || now >= this.endsAt) {
        this.state = 'ended';
        this.restartAt = now + (this.lobby ? 10000 : 12000);
        const w = this.score.allies === this.score.axis ? 'draw' : this.score.allies > this.score.axis ? 'allies' : 'axis';
        this.events.push({ e: 'end', w });
      }
    }
    if (this.tickCount % (this.state === 'lobby' ? 30 : SEND_EVERY) === 0) this.broadcast(now);
    if (this.tickCount % 60 === 0) this.sendRoster();
  }

  broadcast(now) {
    const ps = [];
    for (const p of this.players.values()) {
      const flags = (p.team === 'axis' ? 1 : 0) | (p.alive ? 2 : 0) | (p.ads ? 4 : 0) | (p.radarUntil > now ? 8 : 0)
        | (p.spawnProtectUntil > now ? 16 : 0) | (p.reloadEnd ? 32 : 0) | (p.stance === 1 ? 64 : 0) | (p.sprintActive ? 128 : 0)
        | (p.stance === 2 ? 256 : 0) | (p.slide > 0 ? 512 : 0) | (p.air ? 1024 : 0) | (p.para && p.z > 0 ? 2048 : 0)
        | (hasPerk(p, 'ghost') ? 4096 : 0) | (hasPerk(p, 'deadsilence') ? 8192 : 0) | (hasPerk(p, 'coldblooded') ? 16384 : 0);
      ps.push({ i: p.id, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, z: Math.round(p.z), a: +p.ang.toFixed(3), q: +(p.pitch || 0).toFixed(2), h: Math.ceil(p.hp), f: flags, w: this.gun(p).id + ':' + this.gun(p).stats.atts.join(',') });
    }
    const base = {
      t: 's', p: ps, n: this.nades.map((n) => [n.x | 0, n.y | 0, n.h | 0, NADE_CODE[n.kind] || 0]), fz: (this.fires || []).map((f) => [f.x | 0, f.y | 0, f.id]), sk: (this.clouds || []).map((c) => [c.x | 0, c.y | 0, c.id, Math.max(0, c.until - now) | 0]), sv: (this.packs || []).map((k) => [k.x | 0, k.y | 0, k.id]), sc: [Math.floor(this.score.allies), Math.floor(this.score.axis)],
      tl: Math.max(0, this.endsAt - now), sl: this.scoreLimit, lb: this.lobby ? 1 : 0, mp: this.map, md: this.mode, ob: this.objState(now), rc: [Math.max(0, (this.recon || {}).allies - now) | 0, Math.max(0, (this.recon || {}).axis - now) | 0], jm: [Math.max(0, (this.jam || {}).allies - now) | 0, Math.max(0, (this.jam || {}).axis - now) | 0], dr: (this.drops || []).map((d) => [d.x | 0, d.y | 0, d.team === 'allies' ? 1 : 2, now >= d.landAt ? 1 : 0, d.id, Math.max(0, d.landAt - now) | 0]), st: this.state, rs: this.state === 'ended' ? Math.max(0, this.restartAt - now) : 0, ev: this.events,
    };
    this.events = [];
    for (const p of this.players.values()) {
      if (p.bot || !p.ws || p.ws.readyState !== 1) continue;
      const g = this.gun(p);
      base.you = {
        seq: p.lastSeq, x: p.x, y: p.y, alive: p.alive, hp: Math.ceil(p.hp), slot: p.slot, ammo: g.ammo, res: g.reserve,
        rl: p.reloadEnd ? Math.max(0, p.reloadEnd - now) / g.stats.reload : 0, nd: p.nades, td: p.tacs || 0, lt: (p.loadout || p.pendingLoadout).lethal, tt: (p.loadout || p.pendingLoadout).tactical, pk: (p.loadout || p.pendingLoadout).perks, fl: Math.max(0, (p.flashUntil || 0) - now), sn: Math.max(0, (p.stunUntil || 0) - now), rg: p.rgren || 0, team: p.team,
        ri: p.alive ? 0 : Math.max(0, p.respawnAt - now), kb: p.killedBy, kw: p.killedWith, kx: p.killerPos,
        g: p.guns.map((x) => [x.id, x.stats.atts]),
        sp: p.sp || 0, ks: p.ks || [], ksl: (p.loadout || p.pendingLoadout).streaks,
        mv: [+p.z.toFixed(3), +p.vz.toFixed(3), +p.slide.toFixed(4), +p.sdx.toFixed(4), +p.sdy.toFixed(4), +p.slideCd.toFixed(4), p.pc ? 1 : 0, p.ps ? 1 : 0, p.pj ? 1 : 0],
      };
      p.ws.send(JSON.stringify(base));
    }
  }

  sendRoster() {
    const list = [...this.players.values()].map((p) => ({ i: p.id, n: p.name, t: p.team, k: p.kills, d: p.deaths, b: p.bot ? 1 : 0 }));
    const msg = JSON.stringify({ t: 'r', l: list, code: this.code });
    for (const p of this.players.values()) if (!p.bot && p.ws && p.ws.readyState === 1) p.ws.send(msg);
  }
}

function basePlayer(name) {
  return {
    id: nextId++, name, team: 'allies', x: 0, y: 0, ang: 0, hp: 100, alive: false, kills: 0, deaths: 0,
    input: { fire: false }, lastSeq: 0, moveBudget: 0.3, ads: false, sprint: false, moving: false, triggerHeld: false,
    pendingLoadout: S.sanitizeLoadout({}), guns: [], slot: 0, nades: 2, respawnAt: 0, pitch: 0, crouch: false, rgren: 0, sp: 0, ks: [], earned: [],
    z: 0, vz: 0, stance: 0, slide: 0, sdx: 0, sdy: 0, slideCd: 0, pc: false, ps: false, pj: false, air: false,
  };
}

function createBot(team, taken) {
  const free = BOT_NAMES.filter((n) => !taken || !taken.has(n + ' [BOT]'));
  const pool = free.length ? free : BOT_NAMES;
  const p = basePlayer(pool[Math.floor(Math.random() * pool.length)] + ' [BOT]');
  const lo = BOT_LOADOUTS[Math.floor(Math.random() * BOT_LOADOUTS.length)];
  const streakPool = S.STREAK_IDS.slice().sort(() => Math.random() - 0.5);
  let gun = lo;
  if (Math.random() < 0.55) { // many bots carry Cold War and modern guns
    const prim = Object.keys(S.WEAPONS).filter((k) => !S.WEAPONS[k].secondary && S.WEAPONS[k].era !== 'ww2');
    const id = prim[Math.floor(Math.random() * prim.length)];
    const al = S.WEAPONS[id].allowed.slice().sort(() => Math.random() - 0.5);
    gun = { primary: id, atts: al.slice(0, Math.floor(Math.random() * 3)) };
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const extras = { lethal: pick(Object.keys(S.LETHALS)), tactical: pick(Object.keys(S.TACTICALS)), perks: S.PERK_SLOTS.map(pick) };
  if (Math.random() < 0.3) Object.assign(gun, pick(S.STARTER_CLASSES).lo);
  p.pendingLoadout = S.sanitizeLoadout({ secondary: SECONDARIES[Math.floor(Math.random() * SECONDARIES.length)], ...extras, ...gun, streaks: streakPool.slice(0, 3) });
  p.bot = { nextScan: 0, target: null, acquiredAt: 0, aimErr: 0, strafe: 1, strafeUntil: 0, nextPath: 0, lastPos: null, stuckCheck: 0 };
  p.team = team;
  return p;
}

// ---------------------------------------------------------------- bot AI
// Where a bot should head when it has nobody to shoot (null = hunt the nearest enemy).
function botGoal(room, p) {
  const o = room.obj;
  if (!o) return null;
  if (room.mode === 'dom') {
    let best = null, bd = Infinity;
    for (const pt of o.pts) { if (pt.owner === p.team) continue; const d = Math.hypot(pt.x - p.x, pt.y - p.y) + (p.id % 3) * 150; if (d < bd) { bd = d; best = pt; } }
    return best || o.pts[p.id % o.pts.length];
  }
  if (room.mode === 'ctf') {
    const enemy = p.team === 'allies' ? 'axis' : 'allies';
    const mine = o.flags[p.team], theirs = o.flags[enemy];
    if (theirs.carrier === p.id) return mine.home;                      // bring it home
    if (mine.state !== 'home') return { x: mine.x, y: mine.y };          // chase / return our flag
    if (p.id % 3 === 0) return { x: mine.home.x + (p.team === 'allies' ? 260 : -260), y: mine.home.y + (p.id % 2 ? -220 : 220) }; // defenders
    if (theirs.state === 'carried') { const c = room.players.get(theirs.carrier); if (c) return c; } // escort
    return { x: theirs.x, y: theirs.y };
  }
  if (room.mode === 'hq') return o.zones[o.idx];
  return null;
}
function botThink(room, p, now, dt) {
  if (!p.alive) return;
  if (p.para && p.z > 0) { p.z = Math.max(0, p.z - 120 * dt); p.input.fire = false; return; } // floating down under a canopy
  const b = p.bot;
  const g = room.gun(p);
  const st = g.stats;
  if (now >= b.nextScan) {
    b.nextScan = now + 200 + Math.random() * 100;
    let best = null, bd = Infinity;
    for (const q of room.players.values()) {
      if (!q.alive || q.team === p.team) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (hasPerk(q, 'coldblooded') && d > 550 && q !== b.target) continue;
      if (d < 1300 && d < bd && S.hasLOS3(p.x, p.y, p.z + S.eyeHeight(p.stance), q.x, q.y, q.z + S.bodyHeight(q.stance) - 6) && !room.smokeBlocks(p.x, p.y, q.x, q.y)) { bd = d; best = q; }
    }
    if (p.flashUntil > now) best = null;
    if (best && best !== b.target) { b.acquiredAt = now + (hasPerk(best, 'coldblooded') ? 400 : 0); b.aimErr = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.5); }
    b.target = best;
  }
  let mx = 0, my = 0, fire = false, ads = false, sprint = false, crouch = false;
  const t = b.target && b.target.alive ? b.target : null;
  // objective modes: keep a route to the objective even while fighting
  const goalObj = botGoal(room, p);
  const flagCarrier = room.mode === 'ctf' && room.obj && room.obj.flags[p.team === 'allies' ? 'axis' : 'allies'].carrier === p.id;
  if (goalObj && t && (!b.path || !b.path.length || now >= b.nextPath)) {
    b.nextPath = now + 900;
    const near = Math.hypot(goalObj.x - p.x, goalObj.y - p.y) < 70;
    b.path = findPath(p.x, p.y, goalObj.x + (Math.random() - 0.5) * (near ? 120 : 50), goalObj.y + (Math.random() - 0.5) * (near ? 120 : 50));
  }
  if (t) {
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
    b.aimErr *= Math.pow(0.3, dt);
    const want = Math.atan2(dy, dx) + b.aimErr + (Math.random() - 0.5) * 0.04;
    let da = Math.atan2(Math.sin(want - p.ang), Math.cos(want - p.ang));
    const turn = p.stunUntil > now ? 2 : 7;
    p.ang += S.clamp(da, -turn * dt, turn * dt);
    const wantPitch = Math.atan2(t.z + S.bodyHeight(t.stance) * 0.75 - p.z - S.eyeHeight(p.stance), d) + b.aimErr * 0.3;
    p.pitch += S.clamp(wantPitch - p.pitch, -4 * dt, 4 * dt);
    ads = d > 300 && st.cls !== 'Shotgun';
    const ready = now - b.acquiredAt > 600;
    fire = ready && Math.abs(da) < 0.1 && d < st.range * 1.3;
    if (!st.auto) fire = fire && !p.triggerHeld;
    if (now > b.strafeUntil) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeUntil = now + 600 + Math.random() * 1000; b.crouch = d > 450 && Math.random() < 0.35; b.prone = d > 650 && (st.cls === 'Bolt-Action' || st.cls === 'Machine Gun') && Math.random() < 0.4; }
    crouch = b.crouch;
    if (p.rgren > 0 && d > 300 && d < 900 && Math.random() < 0.004 * (dt * 60)) room.fireRifleNade(p, now);
    const ux = dx / d, uy = dy / d;
    let fwd = d > st.range * 0.8 ? 1 : d < 140 ? -1 : 0;
    if (st.cls === 'Shotgun' && d > 120) fwd = 1;
    mx = ux * fwd + -uy * b.strafe * 0.8;
    my = uy * fwd + ux * b.strafe * 0.8;
    // push the objective while shooting (always when carrying the flag)
    if (goalObj && b.path && b.path.length && (d > 220 || flagCarrier)) {
      while (b.path.length && Math.hypot(b.path[0].x - p.x, b.path[0].y - p.y) < 24) b.path.shift();
      if (b.path.length) {
        const wx = b.path[0].x - p.x, wy = b.path[0].y - p.y, wd = Math.hypot(wx, wy) || 1;
        mx = wx / wd * 0.9 - uy * b.strafe * 0.3; my = wy / wd * 0.9 + ux * b.strafe * 0.3;
      }
    }
    if (b.prone && !goalObj) { crouch = 2; mx = 0; my = 0; } // snipers and gunners go prone at range
    if (Math.random() < 0.002 * (dt * 60) && p.nades > 0 && d > 220 && d < 550) { const knife = p.loadout.lethal === 'knife'; const sp = p.pitch; if (!knife) p.pitch = 0.35 + (d - 220) / 1200; if (!knife || (Math.abs(da) < 0.05 && d < 420)) room.throwNade(p, now); p.pitch = sp; }
    if (Math.random() < 0.0015 * (dt * 60) && p.tacs > 0 && d > 200 && d < 650) { const sp = p.pitch; p.pitch = 0.3 + (d - 200) / 1400; room.throwTactical(p, now); p.pitch = sp; }
    if (!goalObj) b.path = null;
  } else {
    if (g.ammo < st.mag * 0.5) room.startReload(p, now);
    if (!b.path || !b.path.length || now >= b.nextPath) {
      b.nextPath = now + 1500;
      let goal = goalObj, spread = 50;
      if (goal) { b.nextPath = now + 900; if (Math.hypot(goal.x - p.x, goal.y - p.y) < 70) spread = 120; }
      else {
        spread = 200;
        let gd = Infinity;
        for (const q of room.players.values()) {
          if (!q.alive || q.team === p.team) continue;
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < gd) { gd = d; goal = q; }
        }
      }
      const gx = goal ? goal.x : Math.random() * S.MAP_W, gy = goal ? goal.y : Math.random() * S.MAP_H;
      b.path = findPath(p.x, p.y, gx + (Math.random() - 0.5) * spread, gy + (Math.random() - 0.5) * spread);
    }
    while (b.path.length && Math.hypot(b.path[0].x - p.x, b.path[0].y - p.y) < 24) b.path.shift();
    if (b.path.length > 1 && S.hasLOS(p.x, p.y, b.path[1].x, b.path[1].y) && Math.random() < 0.3) b.path.shift();
    if (b.path.length) {
      const wp = b.path[0];
      const dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy) || 1;
      mx = dx / d; my = dy / d;
      const want = Math.atan2(dy, dx);
      const da = Math.atan2(Math.sin(want - p.ang), Math.cos(want - p.ang));
      p.ang += S.clamp(da, -5 * dt, 5 * dt);
      p.pitch *= Math.pow(0.1, dt);
      sprint = b.path.length > 6;
    }
    if (now >= b.stuckCheck) {
      if (b.lastPos && Math.hypot(b.lastPos.x - p.x, b.lastPos.y - p.y) < 8) b.nextPath = 0;
      b.lastPos = { x: p.x, y: p.y };
      b.stuckCheck = now + 1000;
    }
  }
  if (p.ks && p.ks.length && Math.random() < 0.02) { // bots call in what they have earned
    const id = p.ks[0];
    let tgt = null;
    if (id === 'air' || id === 'strafe') {
      const foes = [...room.players.values()].filter((q) => q.alive && q.team !== p.team);
      if (foes.length) { const f = foes[Math.floor(Math.random() * foes.length)]; tgt = { x: f.x, y: f.y, ang: Math.random() * Math.PI * 2 }; }
    }
    if ((id !== 'air' && id !== 'strafe') || tgt) room.useStreak(p, id, now, tgt);
  }
  p.input.fire = fire;
  p.ads = ads;
  p.sprint = sprint;
  p.crouch = !!crouch;
  p.stance = crouch === 2 ? 2 : crouch ? 1 : 0;
  p.z = 0; p.air = false; p.slide = 0;
  p.moving = Math.hypot(mx, my) > 0.1;
  p.sprintActive = sprint && !ads && !crouch && p.moving;
  p.ps = p.sprintActive;
  if (room.state === 'playing') {
    const pos = S.applyMove(p.x, p.y, mx, my, dt, S.moveSpeed(st, ads, sprint, p.stance));
    p.x = pos[0]; p.y = pos[1];
  }
}

// ------------------------------------------------------------ connections
// conn: { send(string), readyState } — a WebSocket, or a local loopback in the browser.
function connect(ws) {
  let player = null, room = null;
  function message(raw) {
    let m;
    try { m = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(String(raw)); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const now = Date.now();
    if (m.t === 'list') {
      const list = [...rooms.values()].filter((r) => r.lobby && !r.priv).map((r) => r.info());
      const quick = rooms.get('PUBLIC');
      ws.send(JSON.stringify({ t: 'lobbies', list, quick: quick ? quick.humans().length : 0 }));
      return;
    }
    if ((m.t === 'join' || m.t === 'create') && !player) {
      const name = cleanText(m.name, 16, 'Soldier');
      let code;
      if (m.t === 'create') {
        do { code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); } while (rooms.has(code));
        room = new Room(code, { lobby: true, name: m.lobbyName || name + "'s lobby", bots: m.bots, score: m.score, time: m.time, priv: m.priv, map: m.map, mode: m.mode });
        rooms.set(code, room);
      } else {
        code = String(m.room || 'PUBLIC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PUBLIC';
        room = rooms.get(code);
        if (!room) {
          if (code !== 'PUBLIC' && code !== 'OFFLINE' && !m.quick) { ws.send(JSON.stringify({ t: 'err', msg: 'No lobby found with code ' + code + '.' })); room = null; return; }
          room = new Room(code, code === 'PUBLIC' ? { bots: 4, rotate: true } : { bots: m.bots == null ? 4 : m.bots, map: m.map, mode: m.mode, time: m.time });
          rooms.set(code, room);
        }
      }
      if (room.humans().length >= MAX_PLAYERS_PER_ROOM) { ws.send(JSON.stringify({ t: 'err', msg: 'That lobby is full.' })); room = null; return; }
      useRoom(room);
      player = basePlayer(name);
      player.ws = ws;
      player.pendingLoadout = S.sanitizeLoadout(m.loadout);
      room.addPlayer(player);
      ws.send(JSON.stringify({ t: 'welcome', id: player.id, code: room.code, lobby: room.lobby, state: room.state }));
      room.sendLobby();
      room.sendRoster();
      return;
    }
    if (!player) return;
    if (rooms.get(room.code) !== room) return;
    useRoom(room);
    switch (m.t) {
      case 'in':
        if (Array.isArray(m.l)) room.applyInputs(player, m.l.slice(0, 20));
        if (Number.isFinite(m.a) && player.alive) player.ang = m.a;
        if (Number.isFinite(m.p) && player.alive) player.pitch = S.clamp(m.p, -1.45, 1.45);
        if (m.f && (m.pull || !player.input.fire) && player.alive) { player.firePressedAt = now; if (m.pull) player.triggerHeld = false; }
        player.input.fire = !!m.f;
        break;
      case 'reload': if (player.alive) room.startReload(player, now); break;
      case 'swap': if (player.alive) room.swap(player, now); break;
      case 'melee': room.melee(player, now); break;
      case 'nade': room.throwNade(player, now); break;
      case 'tac': room.throwTactical(player, now); break;
      case 'rg': room.fireRifleNade(player, now); break;
      case 'ks': if (typeof m.k === 'string') room.useStreak(player, m.k, now); break;
      case 'loadout': player.pendingLoadout = S.sanitizeLoadout(m.loadout); break;
      case 'ready':
        if (room.state === 'lobby') { player.ready = !player.ready; room.sendLobby(); }
        break;
      case 'settings':
        if (player.id === room.hostId && m.s && typeof m.s === 'object') { room.applySettings(m.s); room.balanceBots(); room.sendLobby(); }
        break;
      case 'start':
        if (player.id === room.hostId && room.state === 'lobby') { room.reset(); room.sendLobby(); room.sendRoster(); }
        break;
      case 'kick': {
        const target = room.players.get(m.id | 0);
        if (player.id === room.hostId && target && !target.bot && target !== player) {
          if (target.ws && target.ws.readyState === 1) target.ws.send(JSON.stringify({ t: 'kicked' }));
          room.removePlayer(target.id);
          if (target.ws && target.ws.close) try { target.ws.close(); } catch (e) { /* ignore */ }
        }
        break;
      }
      case 'team': {
        const other = player.team === 'allies' ? 'axis' : 'allies';
        const humansOther = [...room.players.values()].filter((q) => !q.bot && q.team === other).length;
        if (room.state === 'lobby' ? humansOther < MAX_PLAYERS_PER_ROOM / 2 : (room.teamCount(other) - (room.players.size - room.teamCount(other)) < 2 || room.humans().length < 2)) {
          player.team = other;
          if (player.alive) { player.alive = false; player.respawnAt = now + RESPAWN_MS; player.killedBy = player.id; player.killedWith = 'Team change'; }
          room.balanceBots();
          room.sendRoster();
          room.sendLobby();
        }
        break;
      }
      case 'ping': ws.send(JSON.stringify({ t: 'pong', c: m.c })); break;
    }
  }
  function close() { if (room && player) { useRoom(room); room.removePlayer(player.id); player = null; } }
  return { message, close };
}

let lastTick = Date.now();
function tick() {
  const now = Date.now();
  const dt = Math.min(0.1, (now - lastTick) / 1000);
  lastTick = now;
  for (const room of rooms.values()) { useRoom(room); room.tick(now, dt); }
}

const api = { connect, tick, rooms, useRoom, TICK_MS: 1000 / 60 };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Sim = api;
})(typeof self !== 'undefined' ? self : this);
