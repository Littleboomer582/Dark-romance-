// Shared game rules: used by the server (Node) and the client (browser).
(function (root) {
  'use strict';

  const MAP_W = 2400;
  const MAP_H = 1600;
  const PLAYER_R = 16;
  const BASE_SPEED = 230;
  const MAX_HP = 100;
  const SCORE_LIMIT = 50;
  const MATCH_MS = 10 * 60 * 1000;
  const MAX_ATTACHMENTS = 2;

  // ---------------------------------------------------------------- weapons
  // rate = ms between shots, spread = radians (half-angle), range = px of full damage
  const WEAPONS = {
    // Submachine guns
    thompson: { name: 'Thompson M1A1', cls: 'SMG', nation: 'USA', dmg: 24, rate: 86, mag: 30, reserve: 150, reload: 2400, spread: 0.07, range: 450, speed: 1.0, auto: true, allowed: ['grip', 'extmag', 'suppressor', 'aperture', 'dualmag'] },
    mp40: { name: 'MP40', cls: 'SMG', nation: 'Germany', dmg: 25, rate: 100, mag: 32, reserve: 160, reload: 2300, spread: 0.065, range: 480, speed: 1.0, auto: true, allowed: ['grip', 'extmag', 'suppressor', 'aperture', 'dualmag'] },
    ppsh41: { name: 'PPSh-41', cls: 'SMG', nation: 'USSR', dmg: 20, rate: 67, mag: 35, reserve: 175, reload: 2800, spread: 0.09, range: 400, speed: 1.0, auto: true, allowed: ['grip', 'extmag', 'aperture', 'dualmag'] },
    type100: { name: 'Type 100', cls: 'SMG', nation: 'Japan', dmg: 22, rate: 80, mag: 30, reserve: 150, reload: 2300, spread: 0.07, range: 430, speed: 1.02, auto: true, allowed: ['grip', 'extmag', 'suppressor', 'aperture', 'dualmag'] },
    // Assault rifles / automatic rifles
    stg44: { name: 'StG 44', cls: 'Assault Rifle', nation: 'Germany', dmg: 30, rate: 110, mag: 30, reserve: 120, reload: 2500, spread: 0.045, range: 700, speed: 0.94, auto: true, allowed: ['grip', 'extmag', 'aperture', 'suppressor', 'dualmag'] },
    bar: { name: 'M1918 BAR', cls: 'Assault Rifle', nation: 'USA', dmg: 38, rate: 140, mag: 20, reserve: 100, reload: 2800, spread: 0.05, range: 750, speed: 0.88, auto: true, allowed: ['bipod', 'grip', 'extmag', 'aperture', 'dualmag'] },
    // Semi-auto rifles
    garand: { name: 'M1 Garand', cls: 'Rifle', nation: 'USA', dmg: 50, rate: 200, mag: 8, reserve: 64, reload: 2200, spread: 0.025, range: 900, speed: 0.92, auto: false, allowed: ['scope', 'bayonet', 'aperture', 'suppressor', 'extmag'] },
    gewehr43: { name: 'Gewehr 43', cls: 'Rifle', nation: 'Germany', dmg: 46, rate: 180, mag: 10, reserve: 70, reload: 2600, spread: 0.03, range: 850, speed: 0.92, auto: false, allowed: ['scope', 'aperture', 'suppressor', 'extmag'] },
    svt40: { name: 'SVT-40', cls: 'Rifle', nation: 'USSR', dmg: 46, rate: 180, mag: 10, reserve: 70, reload: 2500, spread: 0.03, range: 850, speed: 0.92, auto: false, allowed: ['scope', 'bayonet', 'aperture', 'suppressor', 'extmag'] },
    m1carbine: { name: 'M1A1 Carbine', cls: 'Rifle', nation: 'USA', dmg: 36, rate: 150, mag: 15, reserve: 90, reload: 2000, spread: 0.035, range: 650, speed: 0.98, auto: false, allowed: ['aperture', 'bayonet', 'extmag', 'suppressor', 'scope'] },
    // Bolt-action rifles
    kar98k: { name: 'Kar98k', cls: 'Bolt-Action', nation: 'Germany', dmg: 100, rate: 1150, mag: 5, reserve: 40, reload: 3000, spread: 0.012, range: 1200, speed: 0.9, auto: false, allowed: ['scope', 'bayonet', 'aperture'] },
    springfield: { name: 'Springfield', cls: 'Bolt-Action', nation: 'USA', dmg: 100, rate: 1050, mag: 5, reserve: 40, reload: 2800, spread: 0.012, range: 1200, speed: 0.9, auto: false, allowed: ['scope', 'bayonet', 'aperture'] },
    mosin: { name: 'Mosin-Nagant', cls: 'Bolt-Action', nation: 'USSR', dmg: 100, rate: 1150, mag: 5, reserve: 40, reload: 3100, spread: 0.012, range: 1250, speed: 0.9, auto: false, allowed: ['scope', 'bayonet', 'aperture'] },
    arisaka: { name: 'Arisaka', cls: 'Bolt-Action', nation: 'Japan', dmg: 95, rate: 950, mag: 5, reserve: 40, reload: 2700, spread: 0.014, range: 1150, speed: 0.92, auto: false, allowed: ['scope', 'bayonet', 'aperture'] },
    // Shotguns
    trenchgun: { name: 'M1897 Trench Gun', cls: 'Shotgun', nation: 'USA', dmg: 15, pellets: 8, rate: 850, mag: 6, reserve: 36, reload: 3000, spread: 0.2, range: 260, speed: 1.0, auto: false, allowed: ['bayonet', 'grip', 'extmag'] },
    doublebarrel: { name: 'Double-Barreled Shotgun', cls: 'Shotgun', nation: 'Various', dmg: 14, pellets: 10, rate: 220, mag: 2, reserve: 30, reload: 2200, spread: 0.26, range: 230, speed: 1.0, auto: false, allowed: ['grip', 'dualmag'] },
    // Machine guns
    mg42: { name: 'MG42', cls: 'Machine Gun', nation: 'Germany', dmg: 32, rate: 50, mag: 50, reserve: 200, reload: 4500, spread: 0.08, range: 750, speed: 0.78, auto: true, allowed: ['bipod', 'extmag', 'grip'] },
    dp28: { name: 'DP-28', cls: 'Machine Gun', nation: 'USSR', dmg: 34, rate: 110, mag: 47, reserve: 188, reload: 4000, spread: 0.06, range: 750, speed: 0.8, auto: true, allowed: ['bipod', 'grip', 'extmag'] },
    type99: { name: 'Type 99 LMG', cls: 'Machine Gun', nation: 'Japan', dmg: 36, rate: 115, mag: 30, reserve: 150, reload: 3500, spread: 0.055, range: 760, speed: 0.82, auto: true, allowed: ['bipod', 'grip', 'extmag'] },
    // Pistols (secondary)
    colt: { name: 'M1911 .45', cls: 'Pistol', nation: 'USA', dmg: 34, rate: 150, mag: 7, reserve: 42, reload: 1700, spread: 0.04, range: 380, speed: 1.05, auto: false, secondary: true, allowed: [] },
    p38: { name: 'Walther P38', cls: 'Pistol', nation: 'Germany', dmg: 30, rate: 140, mag: 8, reserve: 48, reload: 1600, spread: 0.04, range: 380, speed: 1.05, auto: false, secondary: true, allowed: [] },
    tt33: { name: 'Tokarev TT-33', cls: 'Pistol', nation: 'USSR', dmg: 30, rate: 140, mag: 8, reserve: 48, reload: 1600, spread: 0.04, range: 400, speed: 1.05, auto: false, secondary: true, allowed: [] },
    nambu: { name: 'Nambu', cls: 'Pistol', nation: 'Japan', dmg: 28, rate: 130, mag: 8, reserve: 48, reload: 1600, spread: 0.045, range: 360, speed: 1.06, auto: false, secondary: true, allowed: [] },
    revolver: { name: '.357 Revolver', cls: 'Pistol', nation: 'USA', dmg: 55, rate: 320, mag: 6, reserve: 36, reload: 2400, spread: 0.035, range: 420, speed: 1.03, auto: false, secondary: true, allowed: [] },
  };

  const ATTACHMENTS = {
    scope: { name: 'Telescopic Scope', desc: 'Aim down sights to zoom out and see further. Pin-point accuracy, slower while aiming.' },
    aperture: { name: 'Aperture Sight', desc: '25% tighter spread.' },
    grip: { name: 'Foregrip', desc: '30% tighter spread and less penalty while moving.' },
    extmag: { name: 'Extended Mag', desc: '50% more rounds per magazine.' },
    dualmag: { name: 'Dual Mags', desc: 'Taped magazines: 35% faster reloads.' },
    suppressor: { name: 'Suppressor', desc: 'Shots do not reveal you on the enemy radar. Slightly less damage and range.' },
    bayonet: { name: 'Bayonet', desc: 'Longer melee lunge. Melee is a guaranteed kill.' },
    bipod: { name: 'Bipod', desc: 'Huge accuracy boost when aiming while standing still.' },
  };

  function computeStats(id, atts) {
    const w = WEAPONS[id] || WEAPONS.thompson;
    atts = (atts || []).filter((a) => w.allowed.includes(a));
    const s = {
      id, name: w.name, cls: w.cls, dmg: w.dmg, pellets: w.pellets || 1, rate: w.rate, mag: w.mag,
      reserve: w.reserve, reload: w.reload, spread: w.spread, range: w.range, speed: w.speed,
      auto: w.auto, adsMult: 0.55, moveMult: 1.7, zoom: 1, suppressed: false, bayonet: false,
      bipod: false, atts,
    };
    if (w.cls === 'Bolt-Action') s.adsMult = 0.3;
    if (w.cls === 'Shotgun') s.adsMult = 0.8;
    for (const a of atts) {
      switch (a) {
        case 'scope': s.zoom = 1.45; s.adsMult *= 0.4; s.range *= 1.4; break;
        case 'aperture': s.spread *= 0.75; break;
        case 'grip': s.spread *= 0.7; s.moveMult = 1.35; break;
        case 'extmag': s.mag = Math.ceil(s.mag * 1.5); s.reserve = Math.ceil(s.reserve * 1.5); break;
        case 'dualmag': s.reload *= 0.65; break;
        case 'suppressor': s.suppressed = true; s.dmg *= 0.88; s.range *= 0.85; break;
        case 'bayonet': s.bayonet = true; break;
        case 'bipod': s.bipod = true; break;
      }
    }
    return s;
  }

  function sanitizeLoadout(lo) {
    lo = lo || {};
    let primary = WEAPONS[lo.primary] && !WEAPONS[lo.primary].secondary ? lo.primary : 'thompson';
    let secondary = WEAPONS[lo.secondary] && WEAPONS[lo.secondary].secondary ? lo.secondary : 'colt';
    const allowed = WEAPONS[primary].allowed;
    const atts = [];
    if (Array.isArray(lo.atts)) {
      for (const a of lo.atts) {
        if (typeof a === 'string' && allowed.includes(a) && !atts.includes(a) && atts.length < MAX_ATTACHMENTS) atts.push(a);
      }
    }
    return { primary, secondary, atts };
  }

  // -------------------------------------------------------------------- map
  // k: wall | crate | sand
  const leftSide = [
    { x: 300, y: 260, w: 50, h: 280, k: 'wall' },
    { x: 300, y: 1060, w: 50, h: 280, k: 'wall' },
    { x: 470, y: 520, w: 130, h: 34, k: 'sand' },
    { x: 470, y: 1046, w: 130, h: 34, k: 'sand' },
    { x: 560, y: 760, w: 80, h: 80, k: 'crate' },
    { x: 620, y: 300, w: 70, h: 70, k: 'crate' },
    { x: 620, y: 1230, w: 70, h: 70, k: 'crate' },
    { x: 850, y: 140, w: 300, h: 30, k: 'wall' },
    { x: 850, y: 140, w: 30, h: 240, k: 'wall' },
    { x: 850, y: 1430, w: 300, h: 30, k: 'wall' },
    { x: 850, y: 1220, w: 30, h: 240, k: 'wall' },
    { x: 960, y: 580, w: 40, h: 170, k: 'wall' },
    { x: 960, y: 850, w: 40, h: 170, k: 'wall' },
    { x: 760, y: 470, w: 34, h: 120, k: 'sand' },
    { x: 760, y: 1010, w: 34, h: 120, k: 'sand' },
    { x: 150, y: 700, w: 60, h: 60, k: 'crate' },
    { x: 150, y: 840, w: 60, h: 60, k: 'crate' },
  ];
  const center = [
    { x: 1120, y: 480, w: 160, h: 30, k: 'wall' },
    { x: 1120, y: 1090, w: 160, h: 30, k: 'wall' },
    { x: 1165, y: 715, w: 70, h: 170, k: 'wall' },
    { x: 1150, y: 90, w: 100, h: 110, k: 'crate' },
    { x: 1150, y: 1400, w: 100, h: 110, k: 'crate' },
    { x: 1080, y: 300, w: 34, h: 100, k: 'sand' },
    { x: 1286, y: 300, w: 34, h: 100, k: 'sand' },
    { x: 1080, y: 1200, w: 34, h: 100, k: 'sand' },
    { x: 1286, y: 1200, w: 34, h: 100, k: 'sand' },
  ];
  const WALLS = leftSide
    .concat(leftSide.map((r) => ({ x: MAP_W - r.x - r.w, y: r.y, w: r.w, h: r.h, k: r.k })))
    .concat(center);

  const SPAWNS = { allies: [], axis: [] };
  for (const y of [180, 420, 640, 960, 1180, 1420]) {
    SPAWNS.allies.push({ x: 90, y });
    SPAWNS.axis.push({ x: MAP_W - 90, y });
  }
  for (const y of [300, 800, 1300]) {
    SPAWNS.allies.push({ x: 230, y });
    SPAWNS.axis.push({ x: MAP_W - 230, y });
  }

  // ---------------------------------------------------------------- physics
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function resolveCircle(x, y, r) {
    x = clamp(x, r, MAP_W - r);
    y = clamp(y, r, MAP_H - r);
    for (let i = 0; i < WALLS.length; i++) {
      const w = WALLS[i];
      const cx = clamp(x, w.x, w.x + w.w);
      const cy = clamp(y, w.y, w.y + w.h);
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          y = cy + (dy / d) * r;
        } else {
          const l = x - w.x, rr = w.x + w.w - x, t = y - w.y, b = w.y + w.h - y;
          const m = Math.min(l, rr, t, b);
          if (m === l) x = w.x - r; else if (m === rr) x = w.x + w.w + r;
          else if (m === t) y = w.y - r; else y = w.y + w.h + r;
        }
      }
    }
    return [x, y];
  }

  function moveCircle(x, y, dx, dy, r) {
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 8));
    for (let i = 0; i < steps; i++) {
      const res = resolveCircle(x + dx / steps, y + dy / steps, r);
      x = res[0]; y = res[1];
    }
    return [x, y];
  }

  function rayRect(ox, oy, dx, dy, w) {
    let tmin = 0, tmax = Infinity;
    if (Math.abs(dx) < 1e-9) { if (ox < w.x || ox > w.x + w.w) return Infinity; }
    else {
      let t1 = (w.x - ox) / dx, t2 = (w.x + w.w - ox) / dx;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
    if (Math.abs(dy) < 1e-9) { if (oy < w.y || oy > w.y + w.h) return Infinity; }
    else {
      let t1 = (w.y - oy) / dy, t2 = (w.y + w.h - oy) / dy;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
    return tmin;
  }

  // distance along unit ray (dx,dy) to first wall, capped at maxD
  function rayWalls(ox, oy, dx, dy, maxD) {
    let best = maxD;
    for (let i = 0; i < WALLS.length; i++) {
      const t = rayRect(ox, oy, dx, dy, WALLS[i]);
      if (t < best) best = t;
    }
    // map edges
    if (dx > 0) best = Math.min(best, (MAP_W - ox) / dx); else if (dx < 0) best = Math.min(best, -ox / dx);
    if (dy > 0) best = Math.min(best, (MAP_H - oy) / dy); else if (dy < 0) best = Math.min(best, -oy / dy);
    return Math.max(0, best);
  }

  function rayCircle(ox, oy, dx, dy, cx, cy, r) {
    const fx = ox - cx, fy = oy - cy;
    const b = fx * dx + fy * dy;
    const c = fx * fx + fy * fy - r * r;
    const disc = b * b - c;
    if (disc < 0) return Infinity;
    const t = -b - Math.sqrt(disc);
    if (t >= 0) return t;
    return c < 0 ? 0 : Infinity;
  }

  function hasLOS(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
    if (d < 1) return true;
    return rayWalls(x1, y1, dx / d, dy / d, d) >= d - 0.5;
  }

  function moveSpeed(stats, ads, sprint) {
    let s = BASE_SPEED * stats.speed;
    if (ads) s *= stats.zoom > 1 ? 0.5 : 0.65;
    else if (sprint) s *= 1.35;
    return s;
  }

  // Applies one movement input. Used identically by client prediction and server.
  function applyMove(x, y, mx, my, dt, speed) {
    const m = Math.hypot(mx, my);
    if (m < 0.08) return [x, y];
    if (m > 1) { mx /= m; my /= m; }
    return moveCircle(x, y, mx * speed * dt, my * speed * dt, PLAYER_R);
  }

  const api = {
    MAP_W, MAP_H, PLAYER_R, BASE_SPEED, MAX_HP, SCORE_LIMIT, MATCH_MS, MAX_ATTACHMENTS,
    WEAPONS, ATTACHMENTS, WALLS, SPAWNS,
    computeStats, sanitizeLoadout, resolveCircle, moveCircle, rayWalls, rayCircle, hasLOS,
    moveSpeed, applyMove, clamp,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(typeof self !== 'undefined' ? self : this);
