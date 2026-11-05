'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const S = require('./public/shared.js');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TICK_MS = 1000 / 60;
const SEND_EVERY = 2; // broadcast at 30 Hz
const RESPAWN_MS = 3500;
const MAX_PLAYERS_PER_ROOM = 16;

// ------------------------------------------------------------- static files
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  const file = path.normalize(path.join(PUBLIC, urlPath));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' };
    if (urlPath === '/sw.js') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(data);
  });
});

// ------------------------------------------------------------ bot pathing
const CELL = 40;
const GW = Math.ceil(S.MAP_W / CELL), GH = Math.ceil(S.MAP_H / CELL);
const blocked = new Uint8Array(GW * GH);
for (let gy = 0; gy < GH; gy++) {
  for (let gx = 0; gx < GW; gx++) {
    const cx = gx * CELL + CELL / 2, cy = gy * CELL + CELL / 2;
    const r = S.PLAYER_R + 4;
    let b = cx < r || cy < r || cx > S.MAP_W - r || cy > S.MAP_H - r;
    for (const w of S.WALLS) {
      const px = S.clamp(cx, w.x, w.x + w.w), py = S.clamp(cy, w.y, w.y + w.h);
      if ((cx - px) ** 2 + (cy - py) ** 2 < r * r) { b = true; break; }
    }
    blocked[gy * GW + gx] = b ? 1 : 0;
  }
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
  while (heap.length && iter++ < 4000) {
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
  { primary: 'kar98k', atts: ['scope'] }, { primary: 'trenchgun', atts: ['grip'] }, { primary: 'svt40', atts: [] },
  { primary: 'mg42', atts: ['grip'] }, { primary: 'type100', atts: ['extmag'] }, { primary: 'gewehr43', atts: ['aperture'] },
];
const SECONDARIES = ['colt', 'p38', 'tt33', 'nambu', 'revolver'];
const rooms = new Map();
let nextId = 1;

function makeGun(id, atts) {
  const stats = S.computeStats(id, atts);
  return { id, stats, ammo: stats.mag, reserve: stats.reserve };
}

class Room {
  constructor(code, botsPerTeam) {
    this.code = code;
    this.botsPerTeam = botsPerTeam;
    this.players = new Map();
    this.nades = [];
    this.events = [];
    this.tickCount = 0;
    this.reset();
  }

  reset() {
    const now = Date.now();
    this.score = { allies: 0, axis: 0 };
    this.state = 'playing';
    this.endsAt = now + S.MATCH_MS;
    this.nades = [];
    for (const p of this.players.values()) {
      p.kills = 0; p.deaths = 0;
      this.spawn(p, now);
    }
  }

  humans() { return [...this.players.values()].filter((p) => !p.bot); }

  teamCount(team) { let n = 0; for (const p of this.players.values()) if (p.team === team) n++; return n; }

  pickTeam() { return this.teamCount('allies') <= this.teamCount('axis') ? 'allies' : 'axis'; }

  addPlayer(p) {
    p.team = this.pickTeam();
    this.players.set(p.id, p);
    this.spawn(p, Date.now());
    this.balanceBots();
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.humans().length === 0) { rooms.delete(this.code); return; }
    this.balanceBots();
  }

  balanceBots() {
    for (const team of ['allies', 'axis']) {
      const members = [...this.players.values()].filter((p) => p.team === team);
      const humans = members.filter((p) => !p.bot).length;
      const want = Math.max(0, this.botsPerTeam - humans);
      const bots = members.filter((p) => p.bot);
      while (bots.length > want) this.players.delete(bots.pop().id);
      while (bots.length < want && this.players.size < MAX_PLAYERS_PER_ROOM) {
        const b = createBot(team);
        bots.push(b);
        this.players.set(b.id, b);
        this.spawn(b, Date.now());
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
    p.guns = [makeGun(p.loadout.primary, p.loadout.atts), makeGun(p.loadout.secondary, [])];
    p.slot = 0;
    p.reloadEnd = 0;
    p.nextShot = now + 300;
    p.nades = 2;
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

  damage(victim, dmg, attacker, weapon, now) {
    if (!victim.alive || victim.spawnProtectUntil > now) return;
    victim.hp -= dmg;
    victim.lastHurt = now;
    this.events.push({ e: 'h', i: victim.id, b: attacker.id, x: victim.x | 0, y: victim.y | 0 });
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths++;
      victim.respawnAt = now + RESPAWN_MS;
      victim.killedBy = attacker.id;
      victim.killedWith = weapon;
      if (attacker !== victim && attacker.team !== victim.team) {
        attacker.kills++;
        if (this.state === 'playing') this.score[attacker.team]++;
      }
      this.events.push({ e: 'k', k: attacker.id, v: victim.id, w: weapon });
    }
  }

  fire(p, now) {
    const g = this.gun(p);
    const st = g.stats;
    let spread = st.spread * (p.ads ? st.adsMult : 1) * (p.moving ? st.moveMult : 1);
    if (st.bipod && p.ads && !p.moving) spread *= 0.35;
    if (p.sprint && !p.ads) spread *= 1.5;
    p.spawnProtectUntil = 0;
    g.ammo--;
    p.nextShot = now + st.rate;
    if (!st.suppressed) p.radarUntil = now + 2000;
    const maxD = st.range * (st.pellets > 1 ? 1.4 : 1.8);
    const hits = new Map();
    for (let i = 0; i < st.pellets; i++) {
      const a = p.ang + (Math.random() * 2 - 1) * spread;
      const dx = Math.cos(a), dy = Math.sin(a);
      let hd = S.rayWalls(p.x, p.y, dx, dy, maxD);
      let hit = null;
      for (const q of this.players.values()) {
        if (!q.alive || q.team === p.team) continue;
        const t = S.rayCircle(p.x, p.y, dx, dy, q.x, q.y, S.PLAYER_R);
        if (t < hd) { hd = t; hit = q; }
      }
      this.events.push({ e: 's', i: p.id, x: p.x | 0, y: p.y | 0, a: +a.toFixed(3), d: hd | 0, w: g.id, s: st.suppressed ? 1 : 0, p: i });
      if (hit) {
        const dmg = st.dmg * (hd > st.range ? 0.65 : 1);
        hits.set(hit, (hits.get(hit) || 0) + dmg);
      }
    }
    for (const [q, dmg] of hits) this.damage(q, dmg, p, st.name, now);
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

  throwNade(p, dist, now) {
    if (!p.alive || p.nades <= 0) return;
    p.nades--;
    dist = S.clamp(+dist || 400, 80, 600);
    const speed = dist * 1.6;
    this.nades.push({ id: nextId++, owner: p.id, team: p.team, x: p.x + Math.cos(p.ang) * 20, y: p.y + Math.sin(p.ang) * 20,
      vx: Math.cos(p.ang) * speed, vy: Math.sin(p.ang) * speed, explodeAt: now + 2200 });
    this.events.push({ e: 'n', i: p.id });
  }

  updateNades(dt, now) {
    for (const n of this.nades) {
      const fr = Math.pow(0.2, dt);
      n.vx *= fr; n.vy *= fr;
      const nx = n.x + n.vx * dt;
      const rx = S.resolveCircle(nx, n.y, 5);
      if (rx[0] !== nx || rx[1] !== n.y) n.vx *= -0.5; else n.x = nx;
      const ny = n.y + n.vy * dt;
      const ry = S.resolveCircle(n.x, ny, 5);
      if (ry[0] !== n.x || ry[1] !== ny) n.vy *= -0.5; else n.y = ny;
      if (now >= n.explodeAt) {
        n.dead = true;
        this.events.push({ e: 'x', x: n.x | 0, y: n.y | 0 });
        const owner = this.players.get(n.owner) || { id: n.owner, team: n.team, kills: 0 };
        for (const q of this.players.values()) {
          if (!q.alive || (q.team === n.team && q.id !== n.owner)) continue;
          const d = Math.hypot(q.x - n.x, q.y - n.y);
          if (d > 190 || !S.hasLOS(n.x, n.y, q.x, q.y)) continue;
          q.spawnProtectUntil = Math.min(q.spawnProtectUntil, now);
          this.damage(q, d < 60 ? 150 : 150 * (1 - (d - 60) / 130), owner, 'Frag Grenade', now);
        }
      }
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
    if (p.input.fire && !p.sprintActive && !p.reloadEnd && now >= p.nextShot && this.state === 'playing') {
      if (g.ammo > 0) {
        if (g.stats.auto || !p.triggerHeld) this.fire(p, now);
      } else if (g.reserve > 0) this.startReload(p, now);
      else if (p.slot === 0) this.swap(p, now);
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
      p.sprintActive = p.sprint && !p.ads && p.moving;
      if (!p.alive || this.state !== 'playing') continue;
      const sp = S.moveSpeed(this.gun(p).stats, p.ads, p.sprint);
      const pos = S.applyMove(p.x, p.y, mx, my, dt, sp);
      p.x = pos[0]; p.y = pos[1];
    }
  }

  tick(now, dt) {
    this.tickCount++;
    if (this.state === 'ended') {
      if (now >= this.restartAt) this.reset();
    } else {
      for (const p of this.players.values()) {
        if (p.bot) { p.moveBudget = 1; botThink(this, p, now, dt); }
        else p.moveBudget = Math.min(0.3, p.moveBudget + dt);
        this.updatePlayer(p, now, dt);
      }
      this.updateNades(dt, now);
      if (this.score.allies >= S.SCORE_LIMIT || this.score.axis >= S.SCORE_LIMIT || now >= this.endsAt) {
        this.state = 'ended';
        this.restartAt = now + 12000;
        const w = this.score.allies === this.score.axis ? 'draw' : this.score.allies > this.score.axis ? 'allies' : 'axis';
        this.events.push({ e: 'end', w });
      }
    }
    if (this.tickCount % SEND_EVERY === 0) this.broadcast(now);
    if (this.tickCount % 60 === 0) this.sendRoster();
  }

  broadcast(now) {
    const ps = [];
    for (const p of this.players.values()) {
      const flags = (p.team === 'axis' ? 1 : 0) | (p.alive ? 2 : 0) | (p.ads ? 4 : 0) | (p.radarUntil > now ? 8 : 0)
        | (p.spawnProtectUntil > now ? 16 : 0) | (p.reloadEnd ? 32 : 0);
      ps.push({ i: p.id, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, a: +p.ang.toFixed(3), h: Math.ceil(p.hp), f: flags, w: this.gun(p).id });
    }
    const base = {
      t: 's', p: ps, n: this.nades.map((n) => [n.x | 0, n.y | 0]), sc: [this.score.allies, this.score.axis],
      tl: Math.max(0, this.endsAt - now), st: this.state, rs: this.state === 'ended' ? Math.max(0, this.restartAt - now) : 0, ev: this.events,
    };
    this.events = [];
    for (const p of this.players.values()) {
      if (p.bot || !p.ws || p.ws.readyState !== 1) continue;
      const g = this.gun(p);
      base.you = {
        seq: p.lastSeq, x: p.x, y: p.y, alive: p.alive, hp: Math.ceil(p.hp), slot: p.slot, ammo: g.ammo, res: g.reserve,
        rl: p.reloadEnd ? Math.max(0, p.reloadEnd - now) / g.stats.reload : 0, nd: p.nades, team: p.team,
        ri: p.alive ? 0 : Math.max(0, p.respawnAt - now), kb: p.killedBy, kw: p.killedWith,
        g: p.guns.map((x) => [x.id, x.stats.atts]),
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
    pendingLoadout: S.sanitizeLoadout({}), guns: [], slot: 0, nades: 2, respawnAt: 0,
  };
}

function createBot(team) {
  const p = basePlayer(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ' [BOT]');
  const lo = BOT_LOADOUTS[Math.floor(Math.random() * BOT_LOADOUTS.length)];
  p.pendingLoadout = S.sanitizeLoadout({ ...lo, secondary: SECONDARIES[Math.floor(Math.random() * SECONDARIES.length)] });
  p.bot = { nextScan: 0, target: null, acquiredAt: 0, aimErr: 0, strafe: 1, strafeUntil: 0, nextPath: 0, lastPos: null, stuckCheck: 0 };
  p.team = team;
  return p;
}

// ---------------------------------------------------------------- bot AI
function botThink(room, p, now, dt) {
  if (!p.alive) return;
  const b = p.bot;
  const g = room.gun(p);
  const st = g.stats;
  if (now >= b.nextScan) {
    b.nextScan = now + 200 + Math.random() * 100;
    let best = null, bd = Infinity;
    for (const q of room.players.values()) {
      if (!q.alive || q.team === p.team) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < 1100 && d < bd && S.hasLOS(p.x, p.y, q.x, q.y)) { bd = d; best = q; }
    }
    if (best && best !== b.target) { b.acquiredAt = now; b.aimErr = (Math.random() - 0.5) * 0.6; }
    b.target = best;
  }
  let mx = 0, my = 0, fire = false, ads = false, sprint = false;
  const t = b.target && b.target.alive ? b.target : null;
  if (t) {
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
    b.aimErr *= Math.pow(0.15, dt);
    const want = Math.atan2(dy, dx) + b.aimErr + (Math.random() - 0.5) * 0.04;
    let da = Math.atan2(Math.sin(want - p.ang), Math.cos(want - p.ang));
    p.ang += S.clamp(da, -7 * dt, 7 * dt);
    ads = d > 300 && st.cls !== 'Shotgun';
    const ready = now - b.acquiredAt > 380;
    fire = ready && Math.abs(da) < 0.18 && d < st.range * 1.4;
    if (!st.auto) fire = fire && !p.triggerHeld;
    if (now > b.strafeUntil) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeUntil = now + 600 + Math.random() * 1000; }
    const ux = dx / d, uy = dy / d;
    let fwd = d > st.range * 0.8 ? 1 : d < 140 ? -1 : 0;
    if (st.cls === 'Shotgun' && d > 120) fwd = 1;
    mx = ux * fwd + -uy * b.strafe * 0.8;
    my = uy * fwd + ux * b.strafe * 0.8;
    if (Math.random() < 0.002 * (dt * 60) && p.nades > 0 && d > 220 && d < 550) room.throwNade(p, d, now);
    b.path = null;
  } else {
    if (g.ammo < st.mag * 0.5) room.startReload(p, now);
    if (!b.path || !b.path.length || now >= b.nextPath) {
      b.nextPath = now + 1500;
      let goal = null, gd = Infinity;
      for (const q of room.players.values()) {
        if (!q.alive || q.team === p.team) continue;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < gd) { gd = d; goal = q; }
      }
      const gx = goal ? goal.x : Math.random() * S.MAP_W, gy = goal ? goal.y : Math.random() * S.MAP_H;
      b.path = findPath(p.x, p.y, gx + (Math.random() - 0.5) * 200, gy + (Math.random() - 0.5) * 200);
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
      sprint = b.path.length > 6;
    }
    if (now >= b.stuckCheck) {
      if (b.lastPos && Math.hypot(b.lastPos.x - p.x, b.lastPos.y - p.y) < 8) b.nextPath = 0;
      b.lastPos = { x: p.x, y: p.y };
      b.stuckCheck = now + 1000;
    }
  }
  p.input.fire = fire;
  p.ads = ads;
  p.sprint = sprint;
  p.moving = Math.hypot(mx, my) > 0.1;
  p.sprintActive = sprint && !ads && p.moving;
  if (room.state === 'playing') {
    const pos = S.applyMove(p.x, p.y, mx, my, dt, S.moveSpeed(st, ads, sprint));
    p.x = pos[0]; p.y = pos[1];
  }
}

// -------------------------------------------------------------- websocket
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', (ws) => {
  let player = null, room = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    const now = Date.now();
    if (m.t === 'join' && !player) {
      const name = String(m.name || 'Soldier').replace(/[^\w .\-']/g, '').trim().slice(0, 16) || 'Soldier';
      const code = String(m.room || 'PUBLIC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PUBLIC';
      room = rooms.get(code);
      if (!room) { room = new Room(code, S.clamp(m.bots | 0, 0, 6)); rooms.set(code, room); }
      if (room.humans().length >= MAX_PLAYERS_PER_ROOM) { ws.send(JSON.stringify({ t: 'err', msg: 'Room is full' })); return; }
      player = basePlayer(name);
      player.ws = ws;
      player.pendingLoadout = S.sanitizeLoadout(m.loadout);
      room.addPlayer(player);
      ws.send(JSON.stringify({ t: 'welcome', id: player.id, code: room.code }));
      room.sendRoster();
      return;
    }
    if (!player) return;
    switch (m.t) {
      case 'in':
        if (Array.isArray(m.l)) room.applyInputs(player, m.l.slice(0, 20));
        if (Number.isFinite(m.a) && player.alive) player.ang = m.a;
        player.input.fire = !!m.f;
        break;
      case 'reload': if (player.alive) room.startReload(player, now); break;
      case 'swap': if (player.alive) room.swap(player, now); break;
      case 'melee': room.melee(player, now); break;
      case 'nade': room.throwNade(player, m.d, now); break;
      case 'loadout': player.pendingLoadout = S.sanitizeLoadout(m.loadout); break;
      case 'team': {
        const other = player.team === 'allies' ? 'axis' : 'allies';
        if (room.teamCount(other) - (room.players.size - room.teamCount(other)) < 2 || room.humans().length < 2) {
          player.team = other;
          if (player.alive) { player.alive = false; player.respawnAt = now + RESPAWN_MS; player.killedBy = player.id; player.killedWith = 'Team change'; }
          room.balanceBots();
          room.sendRoster();
        }
        break;
      }
      case 'ping': ws.send(JSON.stringify({ t: 'pong', c: m.c })); break;
    }
  });

  ws.on('close', () => { if (room && player) room.removePlayer(player.id); });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const room of rooms.values()) room.tick(now, dt);
}, TICK_MS);

server.listen(PORT, () => console.log(`Frontline 1945 server running on http://localhost:${PORT}`));
