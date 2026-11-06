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
  // stance: 0 standing, 1 crouched (or sliding), 2 prone
  const EYE = [60, 40, 15];
  const BODY = [72, 50, 24];
  const HEAD = [13, 12, 9]; // top N units of the body count as a headshot
  const HEAD_ZONE = 13;
  const GRAVITY = 900, JUMP_V = 300, STEP = 8, SLIDE_T = 0.8, SLIDE_CD = 1.1;
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
  // k: wall | crate | sand | house | tree | log | rock | bunker | fence
  // water blocks walking but bullets and grenades pass over it
  const HEIGHTS = { wall: 130, crate: 48, sand: 34, house: 170, tree: 320, log: 30, rock: 64, bunker: 95, fence: 42,
    boxcar: 112, shed: 150, coal: 70, post: 300, water: 1, warehouse: 190, cargo: 96, palisade: 210, hut: 140,
    window: 38, hedge: 120, car: 53, truck: 92, planter: 36, store: 170 };
  const mirror = (list) => list.concat(list.map((r) => Object.assign({}, r, { x: MAP_W - r.x - r.w })));
  // a building made of wall segments with doorways ('n','s','e','w')
  function house(x, y, w, h, doors, t, k) {
    t = t || 16; k = k || 'house'; doors = doors || '';
    const D = 96, out = [];
    const hz = (yy, door) => { if (!door) out.push({ x, y: yy, w, h: t, k }); else { const m = x + w / 2; out.push({ x, y: yy, w: m - D / 2 - x, h: t, k }, { x: m + D / 2, y: yy, w: x + w - m - D / 2, h: t, k }); } };
    const vt = (xx, door) => { if (!door) out.push({ x: xx, y: y + t, w: t, h: h - 2 * t, k }); else { const m = y + h / 2; out.push({ x: xx, y: y + t, w: t, h: m - D / 2 - y - t, k }, { x: xx, y: m + D / 2, w: t, h: y + h - t - m - D / 2, k }); } };
    hz(y, doors.includes('n')); hz(y + h - t, doors.includes('s'));
    vt(x, doors.includes('w')); vt(x + w - t, doors.includes('e'));
    return out;
  }
  function scatter(seed, n, kind, size, area, avoid) {
    let sd = seed; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const out = [];
    for (let tries = 0; out.length < n && tries < n * 40; tries++) {
      const x = area[0] + r() * (area[2] - area[0]), y = area[1] + r() * (area[3] - area[1]);
      const c = { x: Math.round(x), y: Math.round(y), w: size, h: size, k: kind };
      const pad = 46;
      if (avoid.concat(out).some((o) => c.x < o.x + o.w + pad && c.x + c.w + pad > o.x && c.y < o.y + o.h + pad && c.y + c.h + pad > o.y)) continue;
      out.push(c);
    }
    return out;
  }

  // ---- Ruins (the original map)
  const ruinsLeft = [
    { x: 300, y: 260, w: 50, h: 280, k: 'wall' }, { x: 300, y: 1060, w: 50, h: 280, k: 'wall' },
    { x: 470, y: 520, w: 130, h: 34, k: 'sand' }, { x: 470, y: 1046, w: 130, h: 34, k: 'sand' },
    { x: 560, y: 760, w: 80, h: 80, k: 'crate' }, { x: 620, y: 300, w: 70, h: 70, k: 'crate' }, { x: 620, y: 1230, w: 70, h: 70, k: 'crate' },
    { x: 850, y: 140, w: 300, h: 30, k: 'wall' }, { x: 850, y: 140, w: 30, h: 240, k: 'wall' },
    { x: 850, y: 1430, w: 300, h: 30, k: 'wall' }, { x: 850, y: 1220, w: 30, h: 240, k: 'wall' },
    { x: 960, y: 580, w: 40, h: 170, k: 'wall' }, { x: 960, y: 850, w: 40, h: 170, k: 'wall' },
    { x: 760, y: 470, w: 34, h: 120, k: 'sand' }, { x: 760, y: 1010, w: 34, h: 120, k: 'sand' },
    { x: 150, y: 700, w: 60, h: 60, k: 'crate' }, { x: 150, y: 840, w: 60, h: 60, k: 'crate' },
  ];
  const ruinsCenter = [
    { x: 1120, y: 480, w: 160, h: 30, k: 'wall' }, { x: 1120, y: 1090, w: 160, h: 30, k: 'wall' }, { x: 1165, y: 715, w: 70, h: 170, k: 'wall' },
    { x: 1150, y: 90, w: 100, h: 110, k: 'crate' }, { x: 1150, y: 1400, w: 100, h: 110, k: 'crate' },
    { x: 1080, y: 300, w: 34, h: 100, k: 'sand' }, { x: 1286, y: 300, w: 34, h: 100, k: 'sand' },
    { x: 1080, y: 1200, w: 34, h: 100, k: 'sand' }, { x: 1286, y: 1200, w: 34, h: 100, k: 'sand' },
  ];

  // ---- Village: farm houses, a barn and a fountain square
  const villageLeft = [].concat(
    house(330, 170, 280, 210, 'se'), house(330, 1220, 280, 210, 'ne'), house(760, 560, 240, 480, 'we'),
    [
      { x: 690, y: 300, w: 60, h: 60, k: 'crate' }, { x: 690, y: 1240, w: 60, h: 60, k: 'crate' },
      { x: 480, y: 640, w: 24, h: 120, k: 'fence' }, { x: 480, y: 840, w: 24, h: 120, k: 'fence' },
      { x: 150, y: 720, w: 70, h: 40, k: 'crate' }, { x: 600, y: 470, w: 110, h: 30, k: 'sand' }, { x: 600, y: 1100, w: 110, h: 30, k: 'sand' },
      { x: 860, y: 230, w: 120, h: 26, k: 'fence' }, { x: 860, y: 1350, w: 120, h: 26, k: 'fence' },
    ]);
  const villageCenter = [].concat(house(1060, 80, 280, 200, 's'), house(1060, 1320, 280, 200, 'n'), [
    { x: 1150, y: 750, w: 100, h: 100, k: 'rock' },
    { x: 1060, y: 590, w: 110, h: 30, k: 'sand' }, { x: 1230, y: 590, w: 110, h: 30, k: 'sand' },
    { x: 1060, y: 980, w: 110, h: 30, k: 'sand' }, { x: 1230, y: 980, w: 110, h: 30, k: 'sand' },
    { x: 1170, y: 420, w: 60, h: 60, k: 'crate' }, { x: 1170, y: 1120, w: 60, h: 60, k: 'crate' },
  ]);

  // ---- Winter Forest: pines, log piles, foxholes and a ruined cabin
  const winterCenter = house(1080, 680, 240, 240, 'nswe', 18, 'wall');
  const winterBase = [
    { x: 420, y: 520, w: 120, h: 30, k: 'log' }, { x: 420, y: 1050, w: 120, h: 30, k: 'log' },
    { x: 640, y: 760, w: 30, h: 90, k: 'sand' }, { x: 670, y: 735, w: 60, h: 28, k: 'sand' }, { x: 670, y: 847, w: 60, h: 28, k: 'sand' },
    { x: 880, y: 300, w: 90, h: 70, k: 'rock' }, { x: 880, y: 1230, w: 90, h: 70, k: 'rock' },
    { x: 980, y: 520, w: 110, h: 30, k: 'log' }, { x: 980, y: 1050, w: 110, h: 30, k: 'log' },
  ];
  const winterLeft = winterBase.concat(scatter(91, 26, 'tree', 24, [300, 60, 1040, 1520], winterBase.concat(winterCenter, [{ x: 0, y: 0, w: 300, h: 1600 }])));
  const winterMid = scatter(17, 4, 'tree', 24, [1100, 60, 1176, 1520], winterCenter.concat(winterLeft));

  // ---- Pacific Island: concrete bunkers, palms, sandbag lines
  const islandLeft0 = [].concat(house(420, 290, 210, 170, 'e', 22, 'bunker'), house(420, 1140, 210, 170, 'e', 22, 'bunker'), [
    { x: 330, y: 700, w: 30, h: 200, k: 'sand' }, { x: 700, y: 620, w: 140, h: 30, k: 'sand' }, { x: 700, y: 950, w: 140, h: 30, k: 'sand' },
    { x: 860, y: 760, w: 90, h: 80, k: 'rock' }, { x: 128, y: 765, w: 60, h: 60, k: 'crate' }, { x: 690, y: 160, w: 60, h: 60, k: 'crate' }, { x: 690, y: 1380, w: 60, h: 60, k: 'crate' },
  ]);
  const islandCenter = [].concat(house(1100, 690, 200, 220, 'ns', 22, 'bunker'), [
    { x: 1150, y: 300, w: 100, h: 80, k: 'rock' }, { x: 1150, y: 1220, w: 100, h: 80, k: 'rock' },
  ]);
  const islandLeft = islandLeft0.concat(scatter(33, 13, 'tree', 22, [320, 60, 1060, 1520], islandLeft0.concat(islandCenter, [{ x: 0, y: 0, w: 300, h: 1600 }])));

  // ---- Rail Yard: boxcars, sheds and coal piles around a water tower
  const railLeft = [].concat(house(340, 620, 190, 360, 'e', 16, 'shed'), [
    { x: 420, y: 300, w: 210, h: 44, k: 'boxcar' }, { x: 420, y: 1256, w: 210, h: 44, k: 'boxcar' },
    { x: 700, y: 560, w: 230, h: 44, k: 'boxcar' }, { x: 700, y: 996, w: 230, h: 44, k: 'boxcar' },
    { x: 900, y: 190, w: 120, h: 90, k: 'coal' }, { x: 900, y: 1320, w: 120, h: 90, k: 'coal' },
    { x: 620, y: 770, w: 60, h: 60, k: 'crate' }, { x: 990, y: 740, w: 30, h: 120, k: 'sand' },
    { x: 1020, y: 360, w: 60, h: 60, k: 'crate' }, { x: 1020, y: 1180, w: 60, h: 60, k: 'crate' },
  ]);
  const railCenter = [
    { x: 1146, y: 746, w: 14, h: 14, k: 'post' }, { x: 1240, y: 746, w: 14, h: 14, k: 'post' }, { x: 1146, y: 840, w: 14, h: 14, k: 'post' }, { x: 1240, y: 840, w: 14, h: 14, k: 'post' },
    { x: 1090, y: 420, w: 220, h: 44, k: 'boxcar' }, { x: 1090, y: 1136, w: 220, h: 44, k: 'boxcar' },
    { x: 1170, y: 150, w: 60, h: 60, k: 'crate' }, { x: 1170, y: 1390, w: 60, h: 60, k: 'crate' },
  ];

  // ---- Harbor: warehouses and cargo on both sides of a canal with two bridges
  const harborLeft = [].concat(house(330, 150, 330, 250, 'se', 18, 'warehouse'), house(330, 1200, 330, 250, 'ne', 18, 'warehouse'), [
    { x: 760, y: 300, w: 90, h: 90, k: 'cargo' }, { x: 760, y: 1210, w: 90, h: 90, k: 'cargo' }, { x: 880, y: 720, w: 100, h: 160, k: 'cargo' },
    { x: 560, y: 620, w: 60, h: 60, k: 'crate' }, { x: 560, y: 920, w: 60, h: 60, k: 'crate' },
    { x: 1010, y: 400, w: 30, h: 110, k: 'sand' }, { x: 1010, y: 1090, w: 30, h: 110, k: 'sand' },
    { x: 1040, y: 760, w: 40, h: 80, k: 'crate' },
  ]);
  const harborCenter = [
    { x: 1150, y: 0, w: 100, h: 380, k: 'water' }, { x: 1150, y: 480, w: 100, h: 640, k: 'water' }, { x: 1150, y: 1220, w: 100, h: 380, k: 'water' },
  ];

  // ---- Boot Camp: a small, fast arena inside a palisade
  const campLeft = [].concat(house(640, 440, 200, 130, 's', 14, 'hut'), house(640, 1030, 200, 130, 'n', 14, 'hut'), [
    { x: 910, y: 640, w: 110, h: 26, k: 'log' }, { x: 910, y: 934, w: 110, h: 26, k: 'log' },
    { x: 880, y: 860, w: 30, h: 0, k: 'sand' },
    { x: 1010, y: 470, w: 30, h: 110, k: 'sand' }, { x: 1010, y: 1020, w: 30, h: 110, k: 'sand' },
    { x: 780, y: 770, w: 50, h: 50, k: 'crate' },
  ]).filter((w) => w.h > 0);
  const campCenter = [
    { x: 560, y: 360, w: 1280, h: 40, k: 'palisade' }, { x: 560, y: 1200, w: 1280, h: 40, k: 'palisade' },
    { x: 560, y: 400, w: 40, h: 800, k: 'palisade' }, { x: 1800, y: 400, w: 40, h: 800, k: 'palisade' },
    { x: 1160, y: 760, w: 16, h: 16, k: 'post' }, { x: 1224, y: 760, w: 16, h: 16, k: 'post' }, { x: 1160, y: 824, w: 16, h: 16, k: 'post' }, { x: 1224, y: 824, w: 16, h: 16, k: 'post' },
    { x: 1175, y: 470, w: 50, h: 50, k: 'crate' }, { x: 1175, y: 1080, w: 50, h: 50, k: 'crate' },
  ];
  const campSpawns = (xs) => [[625, 640], [625, 800], [625, 960], [700, 700], [700, 900], [690, 620], [690, 980]].map(([x, y]) => ({ x: xs ? MAP_W - x : x, y }));

  // a building whose walls have doors ('d') and windows ('w': a low sill you can shoot or jump through)
  function building(x, y, w, h, sides, k, t) {
    t = t || 16; const out = [];
    const run = (horiz, fixed, a0, a1, spec) => {
      const n = spec.length, L = a1 - a0; let cur = a0;
      const push = (a, b, kind) => { if (b - a < 2) return; out.push(horiz ? { x: a, y: fixed, w: b - a, h: t, k: kind } : { x: fixed, y: a, w: t, h: b - a, k: kind }); };
      for (let i = 0; i < n; i++) {
        const c = a0 + (L * (i + 1)) / (n + 1), ow = spec[i] === 'd' ? 100 : 72;
        push(cur, c - ow / 2, k);
        if (spec[i] === 'w') push(c - ow / 2, c + ow / 2, 'window');
        cur = c + ow / 2;
      }
      push(cur, a1, k);
    };
    run(true, y, x, x + w, sides.n || ''); run(true, y + h - t, x, x + w, sides.s || '');
    run(false, x, y + t, y + h - t, sides.w || ''); run(false, x + w - t, y + t, y + h - t, sides.e || '');
    return out;
  }
  // mirror for the other team, swapping some building styles so the two sides look different
  const mirrorSkin = (list, swap) => list.concat(list.map((r) => Object.assign({}, r, { x: MAP_W - r.x - r.w, k: swap[r.k] || r.k })));

  // ---- Main Street: a compact home-front town block, a house facing a general store
  const townLeft = [].concat(
    building(600, 540, 300, 300, { n: 'w', s: 'w', e: 'dw', w: 'w' }, 'house'),
    house(560, 980, 210, 170, 'e', 16, 'shed'),
    [
      { x: 540, y: 880, w: 300, h: 12, k: 'fence' }, { x: 840, y: 900, w: 12, h: 120, k: 'fence' },
      { x: 960, y: 560, w: 56, h: 120, k: 'car' }, { x: 960, y: 1050, w: 56, h: 120, k: 'car' },
      { x: 700, y: 420, w: 60, h: 60, k: 'crate' }, { x: 900, y: 420, w: 90, h: 30, k: 'planter' },
      { x: 520, y: 680, w: 36, h: 36, k: 'crate' },
    ]);
  const townCenter = [
    { x: 480, y: 330, w: 1440, h: 30, k: 'hedge' }, { x: 480, y: 1240, w: 1440, h: 30, k: 'hedge' },
    { x: 480, y: 360, w: 30, h: 880, k: 'hedge' }, { x: 1890, y: 360, w: 30, h: 880, k: 'hedge' },
    { x: 1168, y: 700, w: 64, h: 170, k: 'truck' },
    { x: 1110, y: 470, w: 180, h: 30, k: 'planter' }, { x: 1110, y: 1110, w: 180, h: 30, k: 'planter' },
  ];
  const townSpawns = (flip) => [[540, 420], [540, 800], [540, 1180], [640, 440], [660, 1190], [600, 860], [880, 1190]].map(([x, y]) => ({ x: flip ? MAP_W - x : x, y }));

  const MAPS = {
    ruins: { name: 'Ruins', desc: 'Bombed-out town ruins', theme: 'ruins', walls: mirror(ruinsLeft).concat(ruinsCenter) },
    village: { name: 'Village', desc: 'French farm village', theme: 'village', walls: mirror(villageLeft).concat(villageCenter) },
    winter: { name: 'Winter Forest', desc: 'Snowy pine forest', theme: 'winter', walls: mirror(winterLeft).concat(winterCenter, mirror(winterMid)) },
    island: { name: 'Pacific Island', desc: 'Beach bunkers and palms', theme: 'island', walls: mirror(islandLeft).concat(islandCenter) },
    rail: { name: 'Rail Yard', desc: 'Freight depot with boxcars and a water tower', theme: 'rail', walls: mirror(railLeft).concat(railCenter),
      props: [{ type: 'watertower', x: 1200, y: 800 }].concat([322, 1278, 582, 1018, 442, 1158].map((y) => ({ type: 'rails', y }))) },
    harbor: { name: 'Harbor', desc: 'Docks and warehouses split by a canal', theme: 'harbor', walls: mirror(harborLeft).concat(harborCenter),
      props: [{ type: 'bridge', x: 1150, y: 380, w: 100, h: 100 }, { type: 'bridge', x: 1150, y: 1120, w: 100, h: 100 }],
      obj: { dom: [[560, 800], [1200, 1170], [1840, 800]], hq: [[1200, 430], [720, 560], [1680, 1060], [720, 1060], [1680, 560]] } },
    town: { name: 'Main Street', desc: 'Compact home-front town block: a house facing a general store', theme: 'town',
      walls: mirrorSkin(townLeft, { house: 'store' }).concat(townCenter),
      props: [{ type: 'street', x0: 1000, x1: 1400 }],
      spawns: { allies: townSpawns(false), axis: townSpawns(true) },
      obj: { dom: [[750, 690], [1200, 960], [1650, 690]], flags: [[600, 940], [1800, 940]], hq: [[1200, 960], [750, 690], [1650, 690], [1200, 620], [760, 1190]] } },
    camp: { name: 'Boot Camp', desc: 'Small, fast close-quarters arena', theme: 'camp', walls: mirror(campLeft).concat(campCenter),
      props: [{ type: 'tower', x: 1200, y: 800 }],
      spawns: { allies: campSpawns(false), axis: campSpawns(true) },
      obj: { dom: [[860, 800], [1200, 700], [1540, 800]], flags: [[690, 800], [1710, 800]], hq: [[1200, 700], [900, 540], [1500, 1060], [900, 1060], [1500, 540]] } },
  };
  const MAP_IDS = Object.keys(MAPS);

  const MODES = {
    tdm: { name: 'Team Deathmatch', short: 'TDM', desc: 'Most kills wins.', scores: [25, 50, 75, 100, 150], def: 50, unit: 'kills' },
    dom: { name: 'Domination', short: 'DOM', desc: 'Capture and hold flags A, B and C. Each flag held scores points.', scores: [100, 150, 200, 300], def: 200, unit: 'points' },
    ctf: { name: 'Capture the Flag', short: 'CTF', desc: "Steal the enemy flag and bring it to your base while your own flag is home.", scores: [1, 3, 5, 7], def: 3, unit: 'captures' },
    hq: { name: 'Headquarters', short: 'HQ', desc: 'Hold the active HQ zone to score. It moves every minute.', scores: [100, 150, 200, 300], def: 200, unit: 'points' },
  };
  const MODE_IDS = Object.keys(MODES);
  // Killstreaks: earned by kills in a row without dying (killstreak kills don't count)
  const STREAKS = {
    recon: { name: 'Recon Plane', kills: 3, desc: 'Shows every enemy on your team\'s minimap for 30 seconds.', ms: 30000 },
    air: { name: 'Airstrike', kills: 5, desc: 'Bombers drop a line of bombs through the spot you are looking at.' },
    mortar: { name: 'Mortar Barrage', kills: 7, desc: 'Shells rain down on enemy positions.' },
  };
  const STREAK_IDS = Object.keys(STREAKS);

  // the active map's walls and spawns (the same array objects are refilled by useMap)
  const WALLS = [];
  const SPAWNS = { allies: [], axis: [] };
  for (const y of [180, 420, 640, 960, 1180, 1420]) { SPAWNS.allies.push({ x: 90, y }); SPAWNS.axis.push({ x: MAP_W - 90, y }); }
  for (const y of [300, 800, 1300]) { SPAWNS.allies.push({ x: 230, y }); SPAWNS.axis.push({ x: MAP_W - 230, y }); }
  const DEFAULT_SPAWNS = { allies: SPAWNS.allies.slice(), axis: SPAWNS.axis.slice() };
  let currentMap = null;
  function useMap(id) {
    if (!MAPS[id]) id = 'ruins';
    if (currentMap === id) return MAPS[id];
    currentMap = id;
    WALLS.length = 0;
    for (const w of MAPS[id].walls) WALLS.push(w);
    for (const team of ['allies', 'axis']) { SPAWNS[team].length = 0; for (const sp of (MAPS[id].spawns || DEFAULT_SPAWNS)[team]) SPAWNS[team].push(sp); }
    return MAPS[id];
  }
  // ---------------------------------------------------------------- physics
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // z = feet height: anything you are standing above (minus a small step) does not block you
  function resolveCircle(x, y, r, z) {
    z = z || 0;
    x = clamp(x, r, MAP_W - r);
    y = clamp(y, r, MAP_H - r);
    for (let i = 0; i < WALLS.length; i++) {
      const w = WALLS[i];
      if (w.k !== 'water' && w.ht <= z + STEP) continue;
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

  function moveCircle(x, y, dx, dy, r, z) {
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 8));
    for (let i = 0; i < steps; i++) {
      const res = resolveCircle(x + dx / steps, y + dy / steps, r, z);
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

  const stanceOf = (v) => (v === true ? 1 : v === false || v == null ? 0 : v);

  function moveSpeed(stats, ads, sprint, stance) {
    stance = stanceOf(stance);
    let s = BASE_SPEED * stats.speed;
    if (stance === 1) s *= 0.55;
    if (stance === 2) s *= 0.26;
    if (ads) s *= stats.zoom > 1 ? 0.5 : 0.65;
    else if (sprint && stance === 0) s *= 1.35;
    return s;
  }

  // Simple movement used by bots (always on the ground).
  function applyMove(x, y, mx, my, dt, speed) {
    const m = Math.hypot(mx, my);
    if (m < 0.08) return [x, y];
    if (m > 1) { mx /= m; my /= m; }
    return moveCircle(x, y, mx * speed * dt, my * speed * dt, PLAYER_R);
  }

  // Height of whatever you would be standing on at (x, y) given your feet height z.
  function groundAt(x, y, z) {
    let g = 0;
    const r = PLAYER_R * 0.6;
    for (let i = 0; i < WALLS.length; i++) {
      const w = WALLS[i];
      if (w.k === 'water' || w.ht > z + STEP || w.ht <= g) continue;
      const cx = clamp(x, w.x, w.x + w.w), cy = clamp(y, w.y, w.y + w.h);
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) g = w.ht;
    }
    return g;
  }

  // Player movement state used identically by client prediction and the server.
  // flags: 1 aim, 2 sprint, 4 crouch, 8 jump, 16 prone
  function newMoveState(x, y) { return { x, y, z: 0, vz: 0, stance: 0, slide: 0, sdx: 0, sdy: 0, slideCd: 0, pc: false, ps: false, pj: false, air: false }; }
  function stepMove(s, mx, my, flags, dt, stats) {
    const ads = !!(flags & 1), sprintIn = !!(flags & 2), crouch = !!(flags & 4), jump = !!(flags & 8), prone = !!(flags & 16);
    let m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; m = 1; }
    const moving = m > 0.08;
    const onGround = s.vz <= 0 && s.z <= groundAt(s.x, s.y, s.z) + 0.5;
    s.slideCd = Math.max(0, s.slideCd - dt);
    // sprint + crouch = slide
    if (crouch && !s.pc && s.ps && onGround && moving && s.slideCd <= 0) { s.slide = SLIDE_T; s.sdx = mx / m; s.sdy = my / m; s.slideCd = SLIDE_CD; }
    s.pc = crouch;
    if (jump && !s.pj && onGround && !prone) { s.vz = JUMP_V; s.slide = 0; }
    s.pj = jump;
    const sprint = sprintIn && !crouch && !prone && !ads && moving && s.slide <= 0;
    s.ps = sprint;
    s.stance = s.slide > 0 ? 1 : prone ? 2 : crouch ? 1 : 0;
    let vx = 0, vy = 0;
    if (s.slide > 0) {
      const k = s.slide / SLIDE_T, sp = BASE_SPEED * stats.speed * (0.8 + 1.4 * k);
      vx = s.sdx * sp; vy = s.sdy * sp;
      s.slide = Math.max(0, s.slide - dt);
    } else if (moving) {
      const sp = moveSpeed(stats, ads, sprint, s.stance);
      vx = mx * sp; vy = my * sp;
    }
    if (vx || vy) { const r = moveCircle(s.x, s.y, vx * dt, vy * dt, PLAYER_R, s.z); s.x = r[0]; s.y = r[1]; }
    const g = groundAt(s.x, s.y, s.z);
    if (s.vz > 0 || s.z > g + 0.01) {
      s.vz -= GRAVITY * dt; s.z += s.vz * dt;
      if (s.z <= g) { s.z = g; s.vz = 0; }
    } else { s.z = g; s.vz = 0; }
    s.air = s.z > groundAt(s.x, s.y, s.z) + 0.5;
    return s;
  }

  // Effective cone of fire for the current state.
  function currentSpread(st, ads, moving, stance, sprint, air) {
    stance = stanceOf(stance);
    let s = st.spread * (ads ? st.adsMult : 1) * (moving ? st.moveMult : 1);
    if (st.bipod && ads && (!moving || stance > 0)) s *= 0.35;
    if (stance === 1) s *= 0.8;
    if (stance === 2) s *= 0.6;
    if (sprint && !ads && moving) s *= 1.5;
    if (air) s = s * 2.5 + 0.02;
    return s;
  }

  function eyeHeight(stance) { return EYE[stanceOf(stance)]; }
  function bodyHeight(stance) { return BODY[stanceOf(stance)]; }
  function headZone(stance) { return HEAD[stanceOf(stance)]; }

  // ---- objective positions (nudged out of any wall they land in)
  function freeSpot(x, y) { const r = resolveCircle(x, y, 40); return { x: Math.round(r[0]), y: Math.round(r[1]) }; }
  for (const id of MAP_IDS) {
    useMap(id);
    const m = MAPS[id];
    for (const w of m.walls) w.ht = HEIGHTS[w.k];
    const midY = MAP_H / 2;
    m.dom = [freeSpot(560, midY), freeSpot(MAP_W / 2, id === 'ruins' ? 610 : id === 'village' ? 660 : id === 'island' ? 600 : 520), freeSpot(MAP_W - 560, midY)];
    m.flags = { allies: freeSpot(165, midY), axis: freeSpot(MAP_W - 165, midY) };
    m.hq = [freeSpot(MAP_W / 2, id === 'winter' ? 800 : 560), freeSpot(720, 380), freeSpot(MAP_W - 720, 1220), freeSpot(720, 1220), freeSpot(MAP_W - 720, 380)];
    const o = m.obj || {};
    if (o.dom) m.dom = o.dom.map(([x, y]) => freeSpot(x, y));
    if (o.flags) m.flags = { allies: freeSpot(o.flags[0][0], o.flags[0][1]), axis: freeSpot(o.flags[1][0], o.flags[1][1]) };
    if (o.hq) m.hq = o.hq.map(([x, y]) => freeSpot(x, y));
  }
  currentMap = null; useMap('ruins');

  const api = {
    MAP_W, MAP_H, PLAYER_R, BASE_SPEED, MAX_HP, SCORE_LIMIT, MATCH_MS, MAX_ATTACHMENTS, MAX_SEC_ATTACHMENTS,
    HEAD_ZONE, HEADSHOT_MULT, WEAPONS, ATTACHMENTS, WALLS, SPAWNS, MAPS, MAP_IDS, MODES, MODE_IDS, STREAKS, STREAK_IDS, HEIGHTS, useMap,
    computeStats, sanitizeLoadout, cleanAtts, resolveCircle, moveCircle, rayWalls, rayWorld, rayCylinder, rayCircle,
    hasLOS, hasLOS3, moveSpeed, applyMove, currentSpread, eyeHeight, bodyHeight, headZone, clamp,
    groundAt, stepMove, newMoveState, GRAVITY, JUMP_V,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(typeof self !== 'undefined' ? self : this);
