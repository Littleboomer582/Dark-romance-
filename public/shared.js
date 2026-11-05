// Shared game rules: used by the server (Node) and the client (browser).
// World units: x/y are the ground plane, h is height. 1 unit ~ 2.5 cm.
(function (root) {
  'use strict';

  const MAP_W = 2400;
  const MAP_H = 1600;
  const PLAYER_R = 16;
  const BASE_SPEED = 230;
  const MAX_HP = 100;
  const SCORE_LIMIT = 50;
  const MATCH_MS = 10 * 60 * 1000;
  const MAX_ATTACHMENTS = 3;
  const MAX_SEC_ATTACHMENTS = 1;
  const EYE = { stand: 60, crouch: 40 };
  const BODY = { stand: 72, crouch: 50 };
  const HEAD_ZONE = 13; // top N units of the body count as a headshot
  const HEADSHOT_MULT = 1.5;

  // ---------------------------------------------------------------- weapons
  // rate = ms between shots, spread = hip-fire cone (radians), range = units of full damage
  const W = (o) => o;
  const WEAPONS = {
    // Submachine guns
    thompson: W({ name: 'Thompson M1A1', cls: 'SMG', nation: 'USA', dmg: 24, rate: 86, mag: 30, reserve: 150, reload: 2400, spread: 0.06, range: 500, speed: 1.0, auto: true,
      allowed: ['aperture', 'grip', 'extmag', 'drum', 'dualmag', 'suppressor', 'flashhider', 'rapidfire', 'sling'] }),
    mp40: W({ name: 'MP40', cls: 'SMG', nation: 'Germany', dmg: 25, rate: 100, mag: 32, reserve: 160, reload: 2300, spread: 0.055, range: 520, speed: 1.0, auto: true,
      allowed: ['aperture', 'grip', 'extmag', 'dualmag', 'suppressor', 'flashhider', 'rapidfire', 'sling'] }),
    ppsh41: W({ name: 'PPSh-41', cls: 'SMG', nation: 'USSR', dmg: 20, rate: 67, mag: 35, reserve: 175, reload: 2800, spread: 0.07, range: 450, speed: 1.0, auto: true,
      allowed: ['aperture', 'grip', 'drum', 'dualmag', 'flashhider', 'rapidfire', 'sling'] }),
    type100: W({ name: 'Type 100', cls: 'SMG', nation: 'Japan', dmg: 22, rate: 80, mag: 30, reserve: 150, reload: 2300, spread: 0.06, range: 480, speed: 1.02, auto: true,
      allowed: ['aperture', 'grip', 'extmag', 'drum', 'dualmag', 'suppressor', 'bayonet', 'rapidfire', 'sling'] }),
    // Assault rifles / automatic rifles
    stg44: W({ name: 'StG 44', cls: 'Assault Rifle', nation: 'Germany', dmg: 30, rate: 110, mag: 30, reserve: 120, reload: 2500, spread: 0.05, range: 800, speed: 0.94, auto: true,
      allowed: ['aperture', 'scope', 'grip', 'extmag', 'dualmag', 'suppressor', 'flashhider', 'fmj', 'rapidfire', 'sling'] }),
    bar: W({ name: 'M1918 BAR', cls: 'Assault Rifle', nation: 'USA', dmg: 38, rate: 140, mag: 20, reserve: 100, reload: 2800, spread: 0.055, range: 850, speed: 0.88, auto: true,
      allowed: ['aperture', 'bipod', 'grip', 'extmag', 'dualmag', 'flashhider', 'fmj', 'rapidfire', 'sling'] }),
    // Semi-auto rifles
    garand: W({ name: 'M1 Garand', cls: 'Rifle', nation: 'USA', dmg: 50, rate: 200, mag: 8, reserve: 64, reload: 2200, spread: 0.045, range: 1000, speed: 0.92, auto: false,
      allowed: ['aperture', 'scope', 'bayonet', 'extmag', 'suppressor', 'flashhider', 'riflenade', 'fmj', 'sling'] }),
    gewehr43: W({ name: 'Gewehr 43', cls: 'Rifle', nation: 'Germany', dmg: 46, rate: 180, mag: 10, reserve: 70, reload: 2600, spread: 0.045, range: 950, speed: 0.92, auto: false,
      allowed: ['aperture', 'scope', 'extmag', 'suppressor', 'flashhider', 'riflenade', 'fmj', 'sling'] }),
    svt40: W({ name: 'SVT-40', cls: 'Rifle', nation: 'USSR', dmg: 46, rate: 180, mag: 10, reserve: 70, reload: 2500, spread: 0.045, range: 950, speed: 0.92, auto: false,
      allowed: ['aperture', 'scope', 'bayonet', 'extmag', 'suppressor', 'flashhider', 'riflenade', 'fmj', 'sling'] }),
    m1carbine: W({ name: 'M1A1 Carbine', cls: 'Rifle', nation: 'USA', dmg: 36, rate: 150, mag: 15, reserve: 90, reload: 2000, spread: 0.045, range: 750, speed: 0.98, auto: false,
      allowed: ['aperture', 'scope', 'bayonet', 'extmag', 'dualmag', 'suppressor', 'riflenade', 'sling'] }),
    // Bolt-action rifles
    kar98k: W({ name: 'Kar98k', cls: 'Bolt-Action', nation: 'Germany', dmg: 100, rate: 1150, mag: 5, reserve: 40, reload: 3000, spread: 0.06, range: 1400, speed: 0.9, auto: false,
      allowed: ['aperture', 'scope', 'bayonet', 'flashhider', 'riflenade', 'fmj', 'sling'] }),
    springfield: W({ name: 'Springfield', cls: 'Bolt-Action', nation: 'USA', dmg: 100, rate: 1050, mag: 5, reserve: 40, reload: 2800, spread: 0.06, range: 1400, speed: 0.9, auto: false,
      allowed: ['aperture', 'scope', 'bayonet', 'flashhider', 'riflenade', 'fmj', 'sling'] }),
    mosin: W({ name: 'Mosin-Nagant', cls: 'Bolt-Action', nation: 'USSR', dmg: 100, rate: 1150, mag: 5, reserve: 40, reload: 3100, spread: 0.06, range: 1450, speed: 0.9, auto: false,
      allowed: ['aperture', 'scope', 'bayonet', 'flashhider', 'riflenade', 'fmj', 'sling'] }),
    arisaka: W({ name: 'Arisaka', cls: 'Bolt-Action', nation: 'Japan', dmg: 95, rate: 950, mag: 5, reserve: 40, reload: 2700, spread: 0.06, range: 1350, speed: 0.92, auto: false,
      allowed: ['aperture', 'scope', 'bayonet', 'flashhider', 'riflenade', 'fmj', 'sling'] }),
    // Shotguns
    trenchgun: W({ name: 'M1897 Trench Gun', cls: 'Shotgun', nation: 'USA', dmg: 15, pellets: 8, rate: 850, mag: 6, reserve: 36, reload: 3000, spread: 0.12, range: 300, speed: 1.0, auto: false,
      allowed: ['grip', 'extmag', 'bayonet', 'sling'] }),
    doublebarrel: W({ name: 'Double-Barreled Shotgun', cls: 'Shotgun', nation: 'Various', dmg: 14, pellets: 10, rate: 220, mag: 2, reserve: 30, reload: 2200, spread: 0.15, range: 260, speed: 1.0, auto: false,
      allowed: ['grip', 'dualmag', 'sling'] }),
    // Machine guns
    mg42: W({ name: 'MG42', cls: 'Machine Gun', nation: 'Germany', dmg: 32, rate: 50, mag: 50, reserve: 200, reload: 4500, spread: 0.075, range: 850, speed: 0.78, auto: true,
      allowed: ['bipod', 'grip', 'extmag', 'drum', 'flashhider', 'fmj', 'sling'] }),
    dp28: W({ name: 'DP-28', cls: 'Machine Gun', nation: 'USSR', dmg: 34, rate: 110, mag: 47, reserve: 188, reload: 4000, spread: 0.065, range: 850, speed: 0.8, auto: true,
      allowed: ['bipod', 'grip', 'extmag', 'flashhider', 'fmj', 'rapidfire', 'sling'] }),
    type99: W({ name: 'Type 99 LMG', cls: 'Machine Gun', nation: 'Japan', dmg: 36, rate: 115, mag: 30, reserve: 150, reload: 3500, spread: 0.06, range: 860, speed: 0.82, auto: true,
      allowed: ['bipod', 'scope', 'grip', 'extmag', 'bayonet', 'flashhider', 'fmj', 'sling'] }),
    // Pistols (secondary)
    colt: W({ name: 'M1911 .45', cls: 'Pistol', nation: 'USA', dmg: 34, rate: 150, mag: 7, reserve: 42, reload: 1700, spread: 0.04, range: 400, speed: 1.05, auto: false, secondary: true, allowed: ['extmag', 'suppressor', 'aperture', 'dualmag'] }),
    p38: W({ name: 'Walther P38', cls: 'Pistol', nation: 'Germany', dmg: 30, rate: 140, mag: 8, reserve: 48, reload: 1600, spread: 0.04, range: 400, speed: 1.05, auto: false, secondary: true, allowed: ['extmag', 'suppressor', 'aperture', 'dualmag'] }),
    tt33: W({ name: 'Tokarev TT-33', cls: 'Pistol', nation: 'USSR', dmg: 30, rate: 140, mag: 8, reserve: 48, reload: 1600, spread: 0.04, range: 420, speed: 1.05, auto: false, secondary: true, allowed: ['extmag', 'suppressor', 'aperture', 'dualmag'] }),
    nambu: W({ name: 'Nambu', cls: 'Pistol', nation: 'Japan', dmg: 28, rate: 130, mag: 8, reserve: 48, reload: 1600, spread: 0.045, range: 380, speed: 1.06, auto: false, secondary: true, allowed: ['extmag', 'suppressor', 'aperture', 'dualmag'] }),
    revolver: W({ name: '.357 Revolver', cls: 'Pistol', nation: 'USA', dmg: 55, rate: 320, mag: 6, reserve: 36, reload: 2400, spread: 0.035, range: 450, speed: 1.03, auto: false, secondary: true, allowed: ['aperture', 'dualmag'] }),
  };

  // slot: only one attachment per slot
  const ATTACHMENTS = {
    scope: { name: 'Telescopic Scope', slot: 'optic', desc: '4x magnified scope. Pin-point accuracy when aiming, slower aiming movement.' },
    aperture: { name: 'Aperture Sight', slot: 'optic', desc: 'Peep sight: 25% tighter spread.' },
    suppressor: { name: 'Suppressor', slot: 'muzzle', desc: 'Quiet shots that never show you on the enemy radar. Slightly less damage and range.' },
    flashhider: { name: 'Flash Hider', slot: 'muzzle', desc: 'Hides muzzle flash, 25% less recoil and 10% tighter spread.' },
    riflenade: { name: 'Rifle Grenade', slot: 'muzzle', desc: 'Launcher cup with 3 explosive rifle grenades (B key / RG button).' },
    bayonet: { name: 'Bayonet', slot: 'blade', desc: 'Long melee lunge. Melee is a guaranteed kill.' },
    grip: { name: 'Foregrip', slot: 'under', desc: '30% tighter spread, 40% less recoil, smaller moving penalty.' },
    bipod: { name: 'Bipod', slot: 'under', desc: 'Huge accuracy and recoil boost when aiming while standing still or crouched.' },
    extmag: { name: 'Extended Mag', slot: 'mag', desc: '50% more rounds per magazine.' },
    drum: { name: 'Drum Mag', slot: 'mag', desc: 'Massive drum: 120% more rounds, but slower reloads and a bit heavier.' },
    dualmag: { name: 'Dual Mags', slot: 'mag2', desc: 'Taped magazines: 35% faster reloads.' },
    rapidfire: { name: 'Rapid Fire', slot: 'ammo', desc: 'Tuned action: 25% faster fire rate, slightly more spread.' },
    fmj: { name: 'FMJ Rounds', slot: 'ammo', desc: 'Bullets punch through crates and sandbags (70% damage).' },
    sling: { name: 'Sling', slot: 'sling', desc: 'Carry it lighter: 6% faster movement and faster aiming.' },
  };

  const RECOIL = { 'SMG': 0.011, 'Assault Rifle': 0.017, 'Rifle': 0.03, 'Bolt-Action': 0.06, 'Shotgun': 0.07, 'Machine Gun': 0.014, 'Pistol': 0.028 };
  const ADS_MULT = { 'SMG': 0.32, 'Assault Rifle': 0.22, 'Rifle': 0.14, 'Bolt-Action': 0.08, 'Shotgun': 0.75, 'Machine Gun': 0.3, 'Pistol': 0.35 };

  function cleanAtts(id, atts, max) {
    const w = WEAPONS[id];
    const out = [];
    const slots = {};
    if (!w || !Array.isArray(atts)) return out;
    for (const a of atts) {
      if (typeof a !== 'string' || !w.allowed.includes(a) || out.includes(a) || out.length >= max) continue;
      const slot = ATTACHMENTS[a].slot;
      if (slots[slot]) continue;
      slots[slot] = true;
      out.push(a);
    }
    return out;
  }

  function computeStats(id, atts) {
    const w = WEAPONS[id] || WEAPONS.thompson;
    if (!WEAPONS[id]) id = 'thompson';
    atts = cleanAtts(id, atts, w.secondary ? MAX_SEC_ATTACHMENTS : MAX_ATTACHMENTS);
    const s = {
      id, name: w.name, cls: w.cls, dmg: w.dmg, pellets: w.pellets || 1, rate: w.rate, mag: w.mag,
      reserve: w.reserve, reload: w.reload, spread: w.spread, range: w.range, speed: w.speed,
      auto: w.auto, adsMult: ADS_MULT[w.cls], moveMult: 1.7, zoom: 1, suppressed: false, bayonet: false,
      bipod: false, recoil: RECOIL[w.cls], noFlash: false, fmj: false, rifleNades: 0, adsSpeed: 9, atts,
    };
    for (const a of atts) {
      switch (a) {
        case 'scope': s.zoom = 4; s.adsMult *= 0.35; s.range *= 1.3; s.adsSpeed = 6; break;
        case 'aperture': s.spread *= 0.75; s.adsMult *= 0.85; break;
        case 'grip': s.spread *= 0.7; s.moveMult = 1.35; s.recoil *= 0.6; break;
        case 'extmag': s.mag = Math.ceil(s.mag * 1.5); s.reserve = Math.ceil(s.reserve * 1.5); break;
        case 'drum': s.mag = Math.ceil(s.mag * 2.2); s.reserve = Math.ceil(s.reserve * 1.6); s.reload *= 1.3; s.speed -= 0.03; break;
        case 'dualmag': s.reload *= 0.65; break;
        case 'suppressor': s.suppressed = true; s.noFlash = true; s.dmg *= 0.88; s.range *= 0.85; break;
        case 'flashhider': s.noFlash = true; s.recoil *= 0.75; s.spread *= 0.9; break;
        case 'riflenade': s.rifleNades = 3; break;
        case 'bayonet': s.bayonet = true; break;
        case 'bipod': s.bipod = true; break;
        case 'rapidfire': s.rate *= 0.75; s.spread *= 1.12; break;
        case 'fmj': s.fmj = true; break;
        case 'sling': s.speed += 0.06; s.adsSpeed += 4; break;
      }
    }
    return s;
  }

  function sanitizeLoadout(lo) {
    lo = lo || {};
    const primary = WEAPONS[lo.primary] && !WEAPONS[lo.primary].secondary ? lo.primary : 'thompson';
    const secondary = WEAPONS[lo.secondary] && WEAPONS[lo.secondary].secondary ? lo.secondary : 'colt';
    return {
      primary, secondary,
      atts: cleanAtts(primary, lo.atts, MAX_ATTACHMENTS),
      secAtts: cleanAtts(secondary, lo.secAtts, MAX_SEC_ATTACHMENTS),
    };
  }

  // -------------------------------------------------------------------- map
  // k: wall | crate | sand
  const HEIGHTS = { wall: 130, crate: 48, sand: 34 };
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
  for (const w of WALLS) w.ht = HEIGHTS[w.k];

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

  // slab test against an axis-aligned box; returns entry distance or Infinity
  function slab(o, d, lo, hi, tmin, tmax) {
    if (Math.abs(d) < 1e-9) return (o < lo || o > hi) ? null : [tmin, tmax];
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    return tmin > tmax ? null : [tmin, tmax];
  }

  // 2D ray vs wall footprints (treats every wall as infinitely tall)
  function rayWalls(ox, oy, dx, dy, maxD) {
    let best = maxD;
    for (let i = 0; i < WALLS.length; i++) {
      const w = WALLS[i];
      let r = slab(ox, dx, w.x, w.x + w.w, 0, Infinity);
      if (r) r = slab(oy, dy, w.y, w.y + w.h, r[0], r[1]);
      if (r && r[0] < best) best = r[0];
    }
    if (dx > 0) best = Math.min(best, (MAP_W - ox) / dx); else if (dx < 0) best = Math.min(best, -ox / dx);
    if (dy > 0) best = Math.min(best, (MAP_H - oy) / dy); else if (dy < 0) best = Math.min(best, -oy / dy);
    return Math.max(0, best);
  }

  // 3D ray (unit direction) vs walls, crates, sandbags, ground and map edges.
  // If ignoreThin is set, crates and sandbags are skipped (FMJ).
  function rayWorld(ox, oy, oh, dx, dy, dh, maxD, ignoreThin) {
    let best = maxD;
    for (let i = 0; i < WALLS.length; i++) {
      const w = WALLS[i];
      if (ignoreThin && w.k !== 'wall') continue;
      let r = slab(ox, dx, w.x, w.x + w.w, 0, Infinity);
      if (r) r = slab(oy, dy, w.y, w.y + w.h, r[0], r[1]);
      if (r) r = slab(oh, dh, -1, w.ht, r[0], r[1]);
      if (r && r[0] < best) best = r[0];
    }
    if (dh < -1e-9) best = Math.min(best, -oh / dh);
    if (dx > 0) best = Math.min(best, (MAP_W - ox) / dx); else if (dx < 0) best = Math.min(best, -ox / dx);
    if (dy > 0) best = Math.min(best, (MAP_H - oy) / dy); else if (dy < 0) best = Math.min(best, -oy / dy);
    return Math.max(0, best);
  }

  // 3D ray vs a standing/crouching soldier (vertical cylinder). Returns distance or Infinity.
  function rayCylinder(ox, oy, oh, dx, dy, dh, cx, cy, r, ht) {
    let t0 = 0, t1 = Infinity;
    const a = dx * dx + dy * dy;
    const fx = ox - cx, fy = oy - cy;
    if (a < 1e-9) {
      if (fx * fx + fy * fy > r * r) return Infinity;
    } else {
      const b = fx * dx + fy * dy, c = fx * fx + fy * fy - r * r;
      const disc = b * b - a * c;
      if (disc < 0) return Infinity;
      const sq = Math.sqrt(disc);
      t0 = Math.max(t0, (-b - sq) / a); t1 = Math.min(t1, (-b + sq) / a);
    }
    const v = slab(oh, dh, 0, ht, t0, t1);
    return v ? v[0] : Infinity;
  }

  function rayCircle(ox, oy, dx, dy, cx, cy, r) { return rayCylinder(ox, oy, 0, dx, dy, 0, cx, cy, r, 1); }

  function hasLOS(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
    if (d < 1) return true;
    return rayWalls(x1, y1, dx / d, dy / d, d) >= d - 0.5;
  }

  function hasLOS3(x1, y1, h1, x2, y2, h2) {
    const dx = x2 - x1, dy = y2 - y1, dh = h2 - h1, d = Math.hypot(dx, dy, dh);
    if (d < 1) return true;
    return rayWorld(x1, y1, h1, dx / d, dy / d, dh / d, d) >= d - 0.5;
  }

  function moveSpeed(stats, ads, sprint, crouch) {
    let s = BASE_SPEED * stats.speed;
    if (crouch) s *= 0.55;
    if (ads) s *= stats.zoom > 1 ? 0.5 : 0.65;
    else if (sprint && !crouch) s *= 1.35;
    return s;
  }

  // Applies one movement input. Used identically by client prediction and server.
  function applyMove(x, y, mx, my, dt, speed) {
    const m = Math.hypot(mx, my);
    if (m < 0.08) return [x, y];
    if (m > 1) { mx /= m; my /= m; }
    return moveCircle(x, y, mx * speed * dt, my * speed * dt, PLAYER_R);
  }

  // Effective cone of fire for the current state.
  function currentSpread(st, ads, moving, crouch, sprint) {
    let s = st.spread * (ads ? st.adsMult : 1) * (moving ? st.moveMult : 1);
    if (st.bipod && ads && (!moving || crouch)) s *= 0.35;
    if (crouch) s *= 0.8;
    if (sprint && !ads && moving) s *= 1.5;
    return s;
  }

  function eyeHeight(crouch) { return crouch ? EYE.crouch : EYE.stand; }
  function bodyHeight(crouch) { return crouch ? BODY.crouch : BODY.stand; }

  const api = {
    MAP_W, MAP_H, PLAYER_R, BASE_SPEED, MAX_HP, SCORE_LIMIT, MATCH_MS, MAX_ATTACHMENTS, MAX_SEC_ATTACHMENTS,
    HEAD_ZONE, HEADSHOT_MULT, WEAPONS, ATTACHMENTS, WALLS, SPAWNS,
    computeStats, sanitizeLoadout, cleanAtts, resolveCircle, moveCircle, rayWalls, rayWorld, rayCylinder, rayCircle,
    hasLOS, hasLOS3, moveSpeed, applyMove, currentSpread, eyeHeight, bodyHeight, clamp,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(typeof self !== 'undefined' ? self : this);
