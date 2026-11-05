// Game simulation: rooms, players, hit detection, bots.
// Runs on the Node server, and inside the browser for offline play.
(function (root) {
  'use strict';
  const S = (typeof module !== 'undefined' && module.exports) ? require('./shared.js') : root.Shared;

const SEND_EVERY = 2; // broadcast at 30 Hz
const RESPAWN_MS = 3500;
const MAX_PLAYERS_PER_ROOM = 16;

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
  { primary: 'kar98k', atts: ['scope', 'fmj'] }, { primary: 'garand', atts: ['riflenade', 'aperture'] }, { primary: 'trenchgun', atts: ['grip'] }, { primary: 'svt40', atts: [] },
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
    p.guns = [makeGun(p.loadout.primary, p.loadout.atts), makeGun(p.loadout.secondary, p.loadout.secAtts)];
    p.rgren = p.guns[0].stats.rifleNades;
    p.nextRg = 0;
    p.crouch = false;
    p.pitch = 0;
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

  damage(victim, dmg, attacker, weapon, now, hs) {
    if (!victim.alive || victim.spawnProtectUntil > now) return;
    victim.hp -= dmg;
    victim.lastHurt = now;
    this.events.push({ e: 'h', i: victim.id, b: attacker.id, x: victim.x | 0, y: victim.y | 0, hs: hs ? 1 : 0 });
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths++;
      victim.respawnAt = now + RESPAWN_MS;
      victim.killedBy = attacker.id;
      victim.killedWith = weapon;
      victim.killerPos = [attacker.x | 0, attacker.y | 0];
      if (attacker !== victim && attacker.team !== victim.team) {
        attacker.kills++;
        if (this.state === 'playing') this.score[attacker.team]++;
      }
      this.events.push({ e: 'k', k: attacker.id, v: victim.id, w: weapon, hs: hs ? 1 : 0 });
    }
  }

  fire(p, now) {
    const g = this.gun(p);
    const st = g.stats;
    let spread = S.currentSpread(st, p.ads, p.moving, p.crouch, p.sprint);
    if (p.bot) spread = Math.max(spread * 2, 0.025); // bots are less accurate than players
    p.spawnProtectUntil = 0;
    g.ammo--;
    p.nextShot = now + st.rate;
    if (!st.suppressed) p.radarUntil = now + 2000;
    const maxD = st.range * (st.pellets > 1 ? 1.4 : 2.2);
    const eye = S.eyeHeight(p.crouch);
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
        const t = S.rayCylinder(p.x, p.y, eye, dx, dy, dh, q.x, q.y, S.PLAYER_R, S.bodyHeight(q.crouch));
        if (t < hd) { hd = t; hit = q; }
      }
      const endD = hit ? hd : thinD;
      this.events.push({ e: 's', i: p.id, x: p.x | 0, y: p.y | 0, z: eye, a: +yaw.toFixed(4), q: +pitch.toFixed(4), d: endD | 0, w: g.id, s: st.noFlash ? 1 : 0, u: st.suppressed ? 1 : 0, p: i, k: hit ? 1 : 0 });
      if (hit) {
        const hh = eye + dh * hd;
        const hs = hh > S.bodyHeight(hit.crouch) - S.HEAD_ZONE;
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
    const eye = S.eyeHeight(p.crouch);
    const cp = Math.cos(p.pitch);
    const dx = Math.cos(p.ang) * cp, dy = Math.sin(p.ang) * cp, dh = Math.sin(p.pitch);
    const start = S.moveCircle(p.x, p.y, dx * 18, dy * 18, 4);
    this.nades.push({ id: nextId++, kind, owner: p.id, team: p.team, x: start[0], y: start[1], h: eye - 6,
      vx: dx * speed, vy: dy * speed, vh: dh * speed + up, explodeAt: now + fuse });
  }

  throwNade(p, now) {
    if (!p.alive || p.nades <= 0 || this.state !== 'playing') return;
    p.nades--;
    p.spawnProtectUntil = 0;
    this.launch(p, 'frag', 620, 180, now, 2400);
    this.events.push({ e: 'n', i: p.id });
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
    n.dead = true;
    this.events.push({ e: 'x', x: n.x | 0, y: n.y | 0, z: Math.max(0, n.h) | 0 });
    const owner = this.players.get(n.owner) || { id: n.owner, team: n.team, kills: 0 };
    const name = n.kind === 'rg' ? 'Rifle Grenade' : 'Frag Grenade';
    for (const q of this.players.values()) {
      if (!q.alive || (q.team === n.team && q.id !== n.owner)) continue;
      const qh = S.bodyHeight(q.crouch) * 0.5;
      const d = Math.hypot(q.x - n.x, q.y - n.y, (qh - n.h) * 0.6);
      if (d > 200 || !S.hasLOS3(n.x, n.y, Math.max(n.h, 6), q.x, q.y, qh)) continue;
      q.spawnProtectUntil = Math.min(q.spawnProtectUntil, now);
      this.damage(q, d < 60 ? 150 : 150 * (1 - (d - 60) / 140), owner, name, now, false);
    }
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
      if (n.kind === 'rg') {
        const sx = n.vx * dt, sy = n.vy * dt, sh = n.vh * dt;
        const len = Math.hypot(sx, sy, sh) || 1;
        const t = S.rayWorld(n.x, n.y, n.h, sx / len, sy / len, sh / len, len);
        let hitPlayer = false;
        for (const q of this.players.values()) {
          if (!q.alive || q.team === n.team) continue;
          if (S.rayCylinder(n.x, n.y, n.h, sx / len, sy / len, sh / len, q.x, q.y, S.PLAYER_R + 4, S.bodyHeight(q.crouch)) <= len) hitPlayer = true;
        }
        const k = Math.min(t, len) / len;
        n.x += sx * k; n.y += sy * k; n.h += sh * k;
        if (t < len || hitPlayer || now >= n.explodeAt) this.explode(n, now);
        continue;
      }
      // frag: bounces off walls and the ground
      const nx = n.x + n.vx * dt;
      if (this.blockedAt(nx, n.y, n.h, 4)) n.vx *= -0.45; else n.x = nx;
      const ny = n.y + n.vy * dt;
      if (this.blockedAt(n.x, ny, n.h, 4)) n.vy *= -0.45; else n.y = ny;
      const nh = n.h + n.vh * dt;
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
      p.crouch = !!(flags & 4);
      p.moving = Math.hypot(mx, my) > 0.1;
      p.sprintActive = p.sprint && !p.ads && !p.crouch && p.moving;
      if (!p.alive || this.state !== 'playing') continue;
      const sp = S.moveSpeed(this.gun(p).stats, p.ads, p.sprint, p.crouch);
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
        | (p.spawnProtectUntil > now ? 16 : 0) | (p.reloadEnd ? 32 : 0) | (p.crouch ? 64 : 0) | (p.sprintActive ? 128 : 0);
      ps.push({ i: p.id, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, a: +p.ang.toFixed(3), q: +(p.pitch || 0).toFixed(2), h: Math.ceil(p.hp), f: flags, w: this.gun(p).id + ':' + this.gun(p).stats.atts.join(',') });
    }
    const base = {
      t: 's', p: ps, n: this.nades.map((n) => [n.x | 0, n.y | 0, n.h | 0, n.kind === 'rg' ? 1 : 0]), sc: [this.score.allies, this.score.axis],
      tl: Math.max(0, this.endsAt - now), st: this.state, rs: this.state === 'ended' ? Math.max(0, this.restartAt - now) : 0, ev: this.events,
    };
    this.events = [];
    for (const p of this.players.values()) {
      if (p.bot || !p.ws || p.ws.readyState !== 1) continue;
      const g = this.gun(p);
      base.you = {
        seq: p.lastSeq, x: p.x, y: p.y, alive: p.alive, hp: Math.ceil(p.hp), slot: p.slot, ammo: g.ammo, res: g.reserve,
        rl: p.reloadEnd ? Math.max(0, p.reloadEnd - now) / g.stats.reload : 0, nd: p.nades, rg: p.rgren || 0, team: p.team,
        ri: p.alive ? 0 : Math.max(0, p.respawnAt - now), kb: p.killedBy, kw: p.killedWith, kx: p.killerPos,
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
    pendingLoadout: S.sanitizeLoadout({}), guns: [], slot: 0, nades: 2, respawnAt: 0, pitch: 0, crouch: false, rgren: 0,
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
      if (d < 1300 && d < bd && S.hasLOS3(p.x, p.y, S.eyeHeight(p.crouch), q.x, q.y, S.bodyHeight(q.crouch) - 10)) { bd = d; best = q; }
    }
    if (best && best !== b.target) { b.acquiredAt = now; b.aimErr = (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.5); }
    b.target = best;
  }
  let mx = 0, my = 0, fire = false, ads = false, sprint = false, crouch = false;
  const t = b.target && b.target.alive ? b.target : null;
  if (t) {
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
    b.aimErr *= Math.pow(0.3, dt);
    const want = Math.atan2(dy, dx) + b.aimErr + (Math.random() - 0.5) * 0.04;
    let da = Math.atan2(Math.sin(want - p.ang), Math.cos(want - p.ang));
    p.ang += S.clamp(da, -7 * dt, 7 * dt);
    const wantPitch = Math.atan2(S.bodyHeight(t.crouch) * 0.75 - S.eyeHeight(p.crouch), d) + b.aimErr * 0.3;
    p.pitch += S.clamp(wantPitch - p.pitch, -4 * dt, 4 * dt);
    ads = d > 300 && st.cls !== 'Shotgun';
    const ready = now - b.acquiredAt > 600;
    fire = ready && Math.abs(da) < 0.1 && d < st.range * 1.3;
    if (!st.auto) fire = fire && !p.triggerHeld;
    if (now > b.strafeUntil) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeUntil = now + 600 + Math.random() * 1000; b.crouch = d > 450 && Math.random() < 0.35; }
    crouch = b.crouch;
    if (p.rgren > 0 && d > 300 && d < 900 && Math.random() < 0.004 * (dt * 60)) room.fireRifleNade(p, now);
    const ux = dx / d, uy = dy / d;
    let fwd = d > st.range * 0.8 ? 1 : d < 140 ? -1 : 0;
    if (st.cls === 'Shotgun' && d > 120) fwd = 1;
    mx = ux * fwd + -uy * b.strafe * 0.8;
    my = uy * fwd + ux * b.strafe * 0.8;
    if (Math.random() < 0.002 * (dt * 60) && p.nades > 0 && d > 220 && d < 550) { const sp = p.pitch; p.pitch = 0.35 + (d - 220) / 1200; room.throwNade(p, now); p.pitch = sp; }
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
      p.pitch *= Math.pow(0.1, dt);
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
  p.crouch = crouch;
  p.moving = Math.hypot(mx, my) > 0.1;
  p.sprintActive = sprint && !ads && !crouch && p.moving;
  if (room.state === 'playing') {
    const pos = S.applyMove(p.x, p.y, mx, my, dt, S.moveSpeed(st, ads, sprint, crouch));
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
        if (Number.isFinite(m.p) && player.alive) player.pitch = S.clamp(m.p, -1.45, 1.45);
        player.input.fire = !!m.f;
        break;
      case 'reload': if (player.alive) room.startReload(player, now); break;
      case 'swap': if (player.alive) room.swap(player, now); break;
      case 'melee': room.melee(player, now); break;
      case 'nade': room.throwNade(player, now); break;
      case 'rg': room.fireRifleNade(player, now); break;
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
  }
  function close() { if (room && player) { room.removePlayer(player.id); player = null; } }
  return { message, close };
}

let lastTick = Date.now();
function tick() {
  const now = Date.now();
  const dt = Math.min(0.1, (now - lastTick) / 1000);
  lastTick = now;
  for (const room of rooms.values()) room.tick(now, dt);
}

const api = { connect, tick, rooms, TICK_MS: 1000 / 60 };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Sim = api;
})(typeof self !== 'undefined' ? self : this);
