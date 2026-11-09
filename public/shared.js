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
  const MAX_ATTACHMENTS = 5;
  const MAX_SEC_ATTACHMENTS = 2;
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
  // ---- Cold War and modern weapons (real firearms)
  const AR_A = ['reddot', 'holo', 'acog', 'suppressor', 'flashhider', 'grip', 'gl', 'extmag', 'dualmag', 'fmj', 'rapidfire', 'laser', 'sling'];
  const SMG_A = ['reddot', 'holo', 'suppressor', 'flashhider', 'grip', 'extmag', 'dualmag', 'rapidfire', 'fmj', 'laser', 'sling'];
  const LMG_A = ['reddot', 'holo', 'acog', 'grip', 'bipod', 'extmag', 'fmj', 'rapidfire', 'flashhider', 'sling'];
  const SNI_A = ['suppressor', 'extmag', 'fmj', 'bipod', 'dualmag', 'sling'];
  const SG_A = ['reddot', 'holo', 'grip', 'extmag', 'laser', 'suppressor', 'dualmag', 'sling'];
  const PI_A = ['suppressor', 'extmag', 'laser', 'reddot', 'dualmag'];
  const MOD = (era, cls, allowed, list) => { for (const [id, name, nation, dmg, rate, mag, reserve, reload, spread, range, speed, extra] of list) WEAPONS[id] = Object.assign({ name, cls, era, nation, dmg, rate, mag, reserve, reload, spread, range, speed, auto: true, allowed }, extra || {}); };
  MOD('cw', 'Assault Rifle', AR_A, [
    ['ak47', 'AK-47', 'USSR', 34, 100, 30, 120, 2600, 0.055, 800, 0.93],
    ['m16a1', 'M16A1', 'USA', 30, 86, 30, 120, 2400, 0.045, 780, 0.95],
    ['famas', 'FAMAS F1', 'France', 28, 60, 25, 125, 2500, 0.05, 700, 0.96],
    ['galil', 'Galil ARM', 'Israel', 32, 92, 35, 140, 2700, 0.055, 760, 0.9],
    ['aug', 'AUG A1', 'Austria', 30, 86, 30, 120, 2600, 0.045, 800, 0.95],
    ['fal', 'FN FAL', 'Belgium', 46, 150, 20, 100, 2700, 0.04, 950, 0.9, { auto: false }],
  ]);
  MOD('modern', 'Assault Rifle', AR_A, [
    ['m4a1', 'M4A1', 'USA', 29, 75, 30, 150, 2200, 0.045, 760, 0.98],
    ['m16a4', 'M16A4', 'USA', 32, 70, 30, 150, 2300, 0.035, 850, 0.95, { auto: false, burst: 3 }],
    ['scarh', 'SCAR-H', 'Belgium', 40, 100, 20, 100, 2400, 0.05, 850, 0.92],
    ['acr', 'ACR', 'USA', 30, 80, 30, 150, 2200, 0.04, 800, 0.97],
    ['tar21', 'TAR-21', 'Israel', 31, 80, 30, 150, 2400, 0.05, 760, 0.96],
    ['f2000', 'F2000', 'Belgium', 27, 63, 30, 150, 2500, 0.055, 720, 0.97],
    ['an94', 'AN-94', 'Russia', 33, 66, 30, 150, 2600, 0.04, 820, 0.94, { auto: false, burst: 2 }],
    ['xm8', 'XM8', 'USA', 29, 76, 30, 150, 2300, 0.045, 760, 0.97],
  ]);
  MOD('cw', 'SMG', SMG_A, [
    ['mp5k', 'MP5K', 'W. Germany', 23, 66, 30, 150, 2000, 0.065, 420, 1.03],
    ['uzi', 'Uzi', 'Israel', 22, 63, 32, 160, 2200, 0.075, 400, 1.04],
    ['skorpion', 'Skorpion vz. 61', 'Czechoslovakia', 18, 50, 20, 120, 1900, 0.08, 330, 1.05],
    ['ak74u', 'AK-74u', 'USSR', 26, 75, 30, 150, 2300, 0.06, 480, 1.02],
    ['mac11', 'MAC-11', 'USA', 17, 46, 32, 160, 1800, 0.09, 300, 1.06],
  ]);
  MOD('modern', 'SMG', SMG_A, [
    ['mp7', 'MP7', 'Germany', 23, 63, 40, 160, 2100, 0.06, 450, 1.04],
    ['vector', 'Vector', 'USA', 21, 50, 25, 150, 2000, 0.055, 400, 1.04],
    ['p90', 'P90', 'Belgium', 21, 66, 50, 150, 2800, 0.065, 420, 1.03],
    ['ump45', 'UMP45', 'Germany', 28, 92, 25, 125, 2100, 0.06, 500, 1.02],
    ['pp2000', 'PP-2000', 'Russia', 20, 60, 40, 160, 2000, 0.07, 380, 1.05],
  ]);
  MOD('cw', 'Machine Gun', LMG_A, [
    ['m60', 'M60', 'USA', 36, 110, 100, 300, 6000, 0.07, 900, 0.78],
    ['rpk', 'RPK', 'USSR', 33, 100, 45, 180, 4200, 0.065, 850, 0.82],
    ['stoner63', 'Stoner 63', 'USA', 31, 80, 75, 225, 5000, 0.065, 820, 0.82],
    ['rpd', 'RPD', 'USSR', 35, 92, 100, 300, 6000, 0.075, 850, 0.78],
  ]);
  MOD('modern', 'Machine Gun', LMG_A, [
    ['mg4', 'MG4', 'Germany', 31, 76, 100, 300, 5600, 0.07, 850, 0.8],
    ['lsat', 'LSAT', 'USA', 32, 85, 100, 300, 5800, 0.065, 870, 0.8],
    ['l86', 'L86 LSW', 'UK', 34, 85, 30, 150, 3000, 0.05, 880, 0.85],
  ]);
  MOD('cw', 'Sniper', SNI_A, [
    ['l96', 'L96A1', 'UK', 100, 1100, 5, 30, 3000, 0.07, 1500, 0.9, { auto: false, scoped: true, bolt: true }],
    ['svd', 'Dragunov SVD', 'USSR', 70, 250, 10, 50, 2800, 0.07, 1300, 0.9, { auto: false, scoped: true }],
    ['wa2000', 'WA2000', 'W. Germany', 70, 230, 6, 36, 2800, 0.07, 1300, 0.9, { auto: false, scoped: true }],
    ['psg1', 'PSG1', 'W. Germany', 68, 220, 5, 35, 2600, 0.07, 1250, 0.9, { auto: false, scoped: true }],
  ]);
  MOD('modern', 'Sniper', SNI_A, [
    ['m200', 'CheyTac M200', 'USA', 110, 1200, 5, 30, 3200, 0.07, 1600, 0.88, { auto: false, scoped: true, bolt: true }],
    ['m82', 'Barrett M82', 'USA', 95, 300, 10, 40, 3600, 0.08, 1600, 0.85, { auto: false, scoped: true }],
    ['dsr50', 'DSR 50', 'Germany', 110, 1300, 4, 28, 3000, 0.07, 1600, 0.9, { auto: false, scoped: true, bolt: true }],
  ]);
  MOD('cw', 'Rifle', AR_A, [['m14', 'M14', 'USA', 48, 170, 20, 100, 2600, 0.045, 950, 0.92, { auto: false }]]);
  MOD('cw', 'Shotgun', SG_A, [
    ['ithaca37', 'Ithaca 37', 'USA', 16, 800, 4, 32, 3200, 0.12, 280, 1.0, { auto: false, pellets: 8 }],
    ['spas12', 'SPAS-12', 'Italy', 17, 900, 8, 32, 3500, 0.11, 290, 0.98, { auto: false, pellets: 8 }],
  ]);
  MOD('modern', 'Shotgun', SG_A, [
    ['aa12', 'AA-12', 'USA', 10, 200, 8, 32, 3000, 0.16, 230, 0.96, { pellets: 8 }],
    ['ksg', 'KSG', 'USA', 18, 950, 12, 36, 4000, 0.07, 330, 0.98, { auto: false, pellets: 6 }],
    ['m1014', 'M1014', 'Italy', 13, 260, 6, 36, 3000, 0.13, 260, 1.0, { auto: false, pellets: 8 }],
    ['m1887', 'Winchester 1887', 'USA', 18, 650, 6, 30, 3200, 0.14, 250, 1.0, { auto: false, pellets: 8 }],
  ]);
  MOD('cw', 'Pistol', PI_A, [
    ['makarov', 'Makarov PM', 'USSR', 28, 140, 8, 48, 1600, 0.045, 360, 1.06, { auto: false, secondary: true }],
    ['cz75', 'CZ75', 'Czechoslovakia', 30, 130, 12, 60, 1700, 0.045, 380, 1.05, { auto: false, secondary: true }],
  ]);
  MOD('modern', 'Pistol', PI_A, [
    ['deagle', 'Desert Eagle', 'Israel', 60, 300, 7, 35, 2000, 0.04, 450, 1.03, { auto: false, secondary: true }],
    ['glock18', 'Glock 18', 'Austria', 22, 55, 17, 85, 1700, 0.08, 330, 1.06, { secondary: true }],
    ['usp45', 'USP .45', 'Germany', 34, 150, 12, 60, 1700, 0.04, 400, 1.05, { auto: false, secondary: true }],
    ['m9', 'M9', 'USA', 30, 120, 15, 75, 1700, 0.045, 380, 1.05, { auto: false, secondary: true }],
    ['fiveseven', 'Five-seven', 'Belgium', 30, 120, 20, 80, 1700, 0.045, 400, 1.05, { auto: false, secondary: true }],
    ['b93r', 'Beretta 93R', 'Italy', 26, 55, 20, 80, 1800, 0.05, 380, 1.05, { auto: false, burst: 3, secondary: true }],
  ]);
  for (const id in WEAPONS) if (!WEAPONS[id].era) WEAPONS[id].era = 'ww2';
  const ERAS = { ww2: 'WWII', cw: 'Cold War', modern: 'Modern' };
  {
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
    reddot: { name: 'Red Dot Sight', slot: 'optic', desc: 'Clear reflex sight: tighter aim and faster aiming down sights.' },
    holo: { name: 'Holographic Sight', slot: 'optic', desc: 'Wide holographic window: even tighter aim.' },
    acog: { name: 'ACOG Scope', slot: 'optic', desc: '2.2x magnified scope for mid-range.' },
    laser: { name: 'Laser Sight', slot: 'laser', desc: 'Hip-fire spread reduced by 35%.' },
    gl: { name: 'Grenade Launcher', slot: 'under', desc: 'Underbarrel launcher with 3 explosive grenades (B key / RG button).' },
  };

  const RECOIL = { 'Sniper': 0.07, 'SMG': 0.011, 'Assault Rifle': 0.017, 'Rifle': 0.03, 'Bolt-Action': 0.06, 'Shotgun': 0.07, 'Machine Gun': 0.014, 'Pistol': 0.028 };
  const ADS_MULT = { 'Sniper': 0.08, 'SMG': 0.32, 'Assault Rifle': 0.22, 'Rifle': 0.14, 'Bolt-Action': 0.08, 'Shotgun': 0.75, 'Machine Gun': 0.3, 'Pistol': 0.35 };

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

  function computeStats(id, atts, perks) {
    const w = WEAPONS[id] || WEAPONS.thompson;
    if (!WEAPONS[id]) id = 'thompson';
    atts = cleanAtts(id, atts, w.secondary ? MAX_SEC_ATTACHMENTS : MAX_ATTACHMENTS);
    const s = {
      id, name: w.name, cls: w.cls, dmg: w.dmg, pellets: w.pellets || 1, rate: w.rate, mag: w.mag,
      reserve: w.reserve, reload: w.reload, spread: w.spread, range: w.range, speed: w.speed,
      auto: w.auto, adsMult: ADS_MULT[w.cls], moveMult: 1.7, zoom: 1, suppressed: false, bayonet: false,
      bipod: false, recoil: RECOIL[w.cls], noFlash: false, fmj: false, rifleNades: 0, adsSpeed: 9, atts,
      burst: w.burst || 0, hipMult: 1, optic: null, era: w.era,
    };
    if (w.scoped) { s.zoom = w.cls === 'Sniper' ? 4 : 4; s.adsMult *= 0.35; s.adsSpeed = 6; s.optic = 'scope'; }
    for (const a of atts) {
      switch (a) {
        case 'scope': s.zoom = 4; s.adsMult *= 0.35; s.range *= 1.3; s.adsSpeed = 6; s.optic = 'scope'; break;
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
        case 'reddot': s.adsMult *= 0.82; s.adsSpeed += 2; s.optic = 'reddot'; break;
        case 'holo': s.adsMult *= 0.75; s.adsSpeed += 1; s.optic = 'holo'; break;
        case 'acog': s.zoom = 2.2; s.adsMult *= 0.55; s.range *= 1.15; s.optic = 'acog'; break;
        case 'laser': s.hipMult = 0.65; break;
        case 'gl': s.rifleNades = 3; s.launcher = true; break;
      }
    }
    if (Array.isArray(perks)) {
      if (perks.includes('lightweight')) s.speed *= 1.08;
      if (perks.includes('sleight')) s.reload *= 0.65;
      if (perks.includes('quickdraw')) s.adsSpeed *= 1.5;
      if (perks.includes('steady')) s.hipMult *= 0.65;
    }
    return s;
  }

  // three different scorestreaks, ordered by cost
  function cleanStreaks(list) {
    const out = [];
    if (Array.isArray(list)) for (const id of list) if (STREAKS[id] && !out.includes(id) && out.length < 3) out.push(id);
    for (const id of DEFAULT_STREAKS) if (out.length < 3 && !out.includes(id)) out.push(id);
    return out.sort((a, b) => STREAKS[a].cost - STREAKS[b].cost);
  }
  function sanitizeLoadout(lo) {
    lo = lo || {};
    const primary = WEAPONS[lo.primary] && !WEAPONS[lo.primary].secondary ? lo.primary : 'thompson';
    const secondary = WEAPONS[lo.secondary] && WEAPONS[lo.secondary].secondary ? lo.secondary : 'colt';
    return {
      primary, secondary,
      atts: cleanAtts(primary, lo.atts, MAX_ATTACHMENTS),
      secAtts: cleanAtts(secondary, lo.secAtts, MAX_SEC_ATTACHMENTS),
      streaks: cleanStreaks(lo.streaks),
      lethal: LETHALS[lo.lethal] ? lo.lethal : 'frag',
      tactical: TACTICALS[lo.tactical] ? lo.tactical : 'flash',
      perks: PERK_SLOTS.map((ids, i) => (Array.isArray(lo.perks) && ids.includes(lo.perks[i]) ? lo.perks[i] : DEFAULT_PERKS[i])),
      op: cleanOperator(lo.op),
    };
  }
  // custom operator: what your soldier looks like to everyone
  const OPERATOR = {
    skin: { label: 'Skin tone', opts: ['Light', 'Fair', 'Tan', 'Brown', 'Dark'] },
    face: { label: 'Face', opts: ['Clean-shaven', 'Stubble', 'Mustache', 'Full beard', 'Scarf mask'] },
    hair: { label: 'Hair', opts: ['Brown', 'Black', 'Blond', 'Red', 'Grey'] },
    head: { label: 'Headgear', opts: ['Combat helmet', 'Helmet with net', 'Helmet and goggles', 'Field cap', 'Beret', 'Boonie hat', 'Bare head'] },
    uni: { label: 'Uniform', opts: ['Standard issue', 'Woodland camo', 'Desert', 'Winter whites', 'Night ops'] },
    gear: { label: 'Gear', opts: ['Webbing and pouches', 'Chest rig', 'Light (belt only)'] },
  };
  const OP_KEYS = Object.keys(OPERATOR);
  function cleanOperator(op) {
    const out = {};
    for (const k of OP_KEYS) { const v = op && Number.isInteger(op[k]) ? op[k] : 0; out[k] = v >= 0 && v < OPERATOR[k].opts.length ? v : 0; }
    return out;
  }
  const operatorCode = (op) => OP_KEYS.map((k) => (op && op[k]) || 0).join('');

  // -------------------------------------------------------------------- equipment, perks, starter classes
  const LETHALS = {
    frag: { name: 'Frag Grenade', count: 2, desc: 'Bounces off walls, explodes after 2.4 seconds.' },
    semtex: { name: 'Semtex', count: 2, desc: 'Sticky grenade: sticks to walls, the ground and enemies, then explodes.' },
    molotov: { name: 'Molotov', count: 1, desc: 'Shatters on impact into a pool of fire that burns for 6 seconds.' },
    knife: { name: 'Throwing Knife', count: 2, desc: 'Silent, flies straight and kills in one hit.' },
  };
  const TACTICALS = {
    flash: { name: 'Flashbang', count: 2, desc: 'Blinds enemies who are looking at it for up to 4 seconds.' },
    stun: { name: 'Stun Grenade', count: 2, desc: 'Dazes enemies in the blast: slow, shaky aim and poor accuracy for up to 4 seconds.' },
    smoke: { name: 'Smoke Grenade', count: 1, desc: 'A thick smoke screen for 12 seconds. Blocks sight lines.' },
  };
  const PERKS = {
    scavenger: { name: 'Scavenger', desc: 'Fallen enemies drop ammo packs. Walk over one to refill ammo and get a lethal back.' },
    lightweight: { name: 'Lightweight', desc: 'Move 8% faster.' },
    ghost: { name: 'Ghost', desc: 'Invisible to enemy recon planes.' },
    flak: { name: 'Flak Jacket', desc: 'Take 45% less damage from explosives and fire.' },
    hardline: { name: 'Hardline', desc: 'Scorestreaks cost 20% fewer points.' },
    sleight: { name: 'Sleight of Hand', desc: 'Reload 35% faster.' },
    quickdraw: { name: 'Quickdraw', desc: 'Aim down sights 50% faster.' },
    dangerclose: { name: 'Danger Close', desc: 'Your explosives do 25% more damage.' },
    steady: { name: 'Steady Aim', desc: 'Hip-fire is 35% more accurate.' },
    tacmask: { name: 'Tactical Mask', desc: 'Flashbangs and stun grenades are 80% weaker on you.' },
    deadsilence: { name: 'Dead Silence', desc: 'Your footsteps make no sound.' },
    coldblooded: { name: 'Cold-Blooded', desc: 'Enemies do not see your name, and bots are slower to spot you.' },
  };
  const PERK_SLOTS = [['scavenger', 'lightweight', 'ghost', 'flak'], ['sleight', 'hardline', 'quickdraw', 'dangerclose'], ['steady', 'tacmask', 'deadsilence', 'coldblooded']];
  const DEFAULT_PERKS = ['lightweight', 'sleight', 'steady'];
  const streakCost = (id, perks) => Math.round(STREAKS[id].cost * (Array.isArray(perks) && perks.includes('hardline') ? 0.8 : 1));
  // ready-made classes: pick one, then change anything you like
  const STARTER_CLASSES = [
    { name: 'Assault', desc: 'All-round rifleman.', lo: { primary: 'm4a1', atts: ['reddot', 'grip'], secondary: 'm9', lethal: 'frag', tactical: 'flash', perks: ['lightweight', 'sleight', 'steady'] } },
    { name: 'Run & Gun', desc: 'Fast SMG flanker.', lo: { primary: 'mp5k', atts: ['rapidfire', 'laser'], secondary: 'usp45', lethal: 'semtex', tactical: 'stun', perks: ['lightweight', 'quickdraw', 'deadsilence'] } },
    { name: 'Sniper', desc: 'Long range, hidden from recon.', lo: { primary: 'l96', atts: ['fmj'], secondary: 'deagle', lethal: 'knife', tactical: 'smoke', perks: ['ghost', 'quickdraw', 'coldblooded'] } },
    { name: 'Support', desc: 'Machine gun that holds ground.', lo: { primary: 'm60', atts: ['bipod', 'grip'], secondary: 'm9', lethal: 'frag', tactical: 'smoke', perks: ['flak', 'hardline', 'tacmask'] } },
    { name: 'Breacher', desc: 'Shotgun for close quarters.', lo: { primary: 'spas12', atts: ['grip'], secondary: 'glock18', lethal: 'molotov', tactical: 'flash', perks: ['scavenger', 'sleight', 'deadsilence'] } },
    { name: 'Stealth', desc: 'Silenced and off the radar.', lo: { primary: 'ump45', atts: ['suppressor', 'reddot'], secondary: 'fiveseven', secAtts: ['suppressor'], lethal: 'knife', tactical: 'smoke', perks: ['ghost', 'hardline', 'coldblooded'] } },
    { name: 'WWII Rifleman', desc: 'Garand and a .45.', lo: { primary: 'garand', atts: ['aperture', 'riflenade'], secondary: 'colt', lethal: 'frag', tactical: 'smoke', perks: ['scavenger', 'sleight', 'steady'] } },
    { name: 'WWII Commando', desc: 'Silenced Thompson.', lo: { primary: 'thompson', atts: ['suppressor', 'grip'], secondary: 'colt', lethal: 'molotov', tactical: 'stun', perks: ['lightweight', 'quickdraw', 'deadsilence'] } },
  ];

  // -------------------------------------------------------------------- map
  // k: wall | crate | sand
  // k: wall | crate | sand | house | tree | log | rock | bunker | fence
  // water blocks walking but bullets and grenades pass over it
  const HEIGHTS = { wall: 130, crate: 48, sand: 34, house: 170, tree: 320, log: 30, rock: 64, bunker: 95, fence: 42,
    boxcar: 112, shed: 150, coal: 70, post: 300, water: 1, warehouse: 190, cargo: 96, palisade: 210, hut: 140,
    window: 38, hedge: 120, car: 53, truck: 92, planter: 36, store: 170, plane: 62 };
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

  // ---- Airfield: hangars, parked fighters behind sandbag revetments, a control tower in the middle
  const airLeft = [].concat(house(270, 560, 320, 480, 'e', 18, 'warehouse'), [
    { x: 660, y: 230, w: 170, h: 150, k: 'plane' }, { x: 660, y: 1220, w: 170, h: 150, k: 'plane' },
    { x: 640, y: 410, w: 210, h: 30, k: 'sand' }, { x: 640, y: 1160, w: 210, h: 30, k: 'sand' },
    { x: 760, y: 720, w: 64, h: 150, k: 'truck' },
    { x: 920, y: 640, w: 60, h: 60, k: 'crate' }, { x: 920, y: 900, w: 60, h: 60, k: 'crate' },
    { x: 1010, y: 470, w: 30, h: 110, k: 'sand' }, { x: 1010, y: 1020, w: 30, h: 110, k: 'sand' },
    { x: 420, y: 330, w: 50, h: 50, k: 'crate' }, { x: 420, y: 1220, w: 50, h: 50, k: 'crate' },
  ]);
  const airCenter = [].concat(house(1110, 710, 180, 180, 'ns', 18, 'bunker'), [
    { x: 1170, y: 300, w: 60, h: 60, k: 'crate' }, { x: 1170, y: 1240, w: 60, h: 60, k: 'crate' },
    { x: 1080, y: 520, w: 240, h: 30, k: 'sand' }, { x: 1080, y: 1050, w: 240, h: 30, k: 'sand' },
  ]);
  // ---- Desert Outpost: flat-roofed adobe houses, compound walls, palms around a central house
  const desertLeft = [].concat(
    building(420, 300, 260, 220, { s: 'd', e: 'w', n: 'w' }, 'house'),
    building(420, 1080, 260, 220, { n: 'd', e: 'w', s: 'w' }, 'house'),
    [
      { x: 790, y: 560, w: 24, h: 160, k: 'wall' }, { x: 790, y: 880, w: 24, h: 160, k: 'wall' },
      { x: 300, y: 760, w: 40, h: 40, k: 'tree' }, { x: 960, y: 300, w: 40, h: 40, k: 'tree' }, { x: 960, y: 1260, w: 40, h: 40, k: 'tree' },
      { x: 900, y: 760, w: 90, h: 80, k: 'rock' }, { x: 640, y: 720, w: 60, h: 60, k: 'crate' },
      { x: 1010, y: 470, w: 30, h: 110, k: 'sand' }, { x: 1010, y: 1020, w: 30, h: 110, k: 'sand' },
      { x: 560, y: 600, w: 56, h: 120, k: 'car' },
    ]);
  const desertCenter = [].concat(building(1080, 680, 240, 240, { n: 'dw', s: 'dw', e: 'w', w: 'w' }, 'house'), [
    { x: 1180, y: 300, w: 40, h: 40, k: 'tree' }, { x: 1180, y: 1260, w: 40, h: 40, k: 'tree' },
    { x: 1150, y: 480, w: 100, h: 30, k: 'sand' }, { x: 1150, y: 1090, w: 100, h: 30, k: 'sand' },
  ]);
  // ---- Factory: a big pillared factory hall in the middle, loading yards with rail cars on both sides
  const factLeft = [
    { x: 300, y: 300, w: 230, h: 44, k: 'boxcar' }, { x: 300, y: 1256, w: 230, h: 44, k: 'boxcar' },
    { x: 560, y: 140, w: 120, h: 90, k: 'coal' }, { x: 560, y: 1370, w: 120, h: 90, k: 'coal' },
    { x: 540, y: 700, w: 90, h: 90, k: 'cargo' }, { x: 420, y: 800, w: 60, h: 60, k: 'crate' },
    { x: 680, y: 520, w: 30, h: 110, k: 'sand' }, { x: 680, y: 970, w: 30, h: 110, k: 'sand' },
    { x: 620, y: 420, w: 60, h: 60, k: 'crate' }, { x: 620, y: 1120, w: 60, h: 60, k: 'crate' },
  ];
  const factCenter = [].concat(building(800, 440, 800, 720, { n: 'ddd', s: 'ddd', w: 'dwd', e: 'dwd' }, 'warehouse', 20), [
    { x: 990, y: 630, w: 20, h: 20, k: 'post' }, { x: 1190, y: 630, w: 20, h: 20, k: 'post' }, { x: 1390, y: 630, w: 20, h: 20, k: 'post' },
    { x: 990, y: 950, w: 20, h: 20, k: 'post' }, { x: 1190, y: 950, w: 20, h: 20, k: 'post' }, { x: 1390, y: 950, w: 20, h: 20, k: 'post' },
    { x: 1040, y: 740, w: 100, h: 80, k: 'cargo' }, { x: 1260, y: 780, w: 100, h: 80, k: 'cargo' },
    { x: 900, y: 540, w: 60, h: 60, k: 'crate' }, { x: 1440, y: 1000, w: 60, h: 60, k: 'crate' },
    { x: 1170, y: 520, w: 60, h: 30, k: 'sand' }, { x: 1170, y: 1050, w: 60, h: 30, k: 'sand' },
  ]);

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
    airfield: { name: 'Airfield', desc: 'Hangars, parked fighters and a control tower', theme: 'airfield', walls: mirror(airLeft).concat(airCenter),
      props: [{ type: 'runway' }, { type: 'ctower', x: 1200, y: 800 }],
      obj: { dom: [[700, 800], [1200, 450], [1700, 800]], hq: [[1200, 450], [700, 800], [1700, 800], [1200, 1150], [880, 330]] } },
    desert: { name: 'Desert Outpost', desc: 'Adobe houses and palms in the desert sun', theme: 'desert', walls: mirror(desertLeft).concat(desertCenter),
      obj: { dom: [[680, 800], [1200, 800], [1720, 800]], hq: [[1200, 800], [550, 410], [1850, 1190], [550, 1190], [1850, 410]] } },
    factory: { name: 'Factory', desc: 'A pillared factory hall between two loading yards', theme: 'factory', walls: mirror(factLeft).concat(factCenter),
      props: [322, 1278].map((y) => ({ type: 'rails', y })).concat([{ type: 'chimney', x: 950, y: -160 }, { type: 'chimney', x: 1450, y: -160 }, { type: 'chimney', x: 1200, y: 1780 }]),
      obj: { dom: [[560, 900], [1200, 860], [1840, 900]], hq: [[1200, 860], [600, 560], [1800, 1040], [600, 1040], [1800, 560]] } },
  };
  const MAP_IDS = Object.keys(MAPS);

  const MODES = {
    tdm: { name: 'Team Deathmatch', short: 'TDM', desc: 'Most kills wins.', scores: [25, 50, 75, 100, 150], def: 50, unit: 'kills' },
    dom: { name: 'Domination', short: 'DOM', desc: 'Capture and hold flags A, B and C. Each flag held scores points.', scores: [100, 150, 200, 300], def: 200, unit: 'points' },
    ctf: { name: 'Capture the Flag', short: 'CTF', desc: "Steal the enemy flag and bring it to your base while your own flag is home.", scores: [1, 3, 5, 7], def: 3, unit: 'captures' },
    hq: { name: 'Headquarters', short: 'HQ', desc: 'Hold the active HQ zone to score. It moves every minute.', scores: [100, 150, 200, 300], def: 200, unit: 'points' },
    kc: { name: 'Kill Confirmed', short: 'KC', desc: 'Kills drop dog tags. Grab enemy tags to score, grab your team\'s tags to deny them.', scores: [25, 50, 75, 100], def: 50, unit: 'confirms' },
    hc: { name: 'Hardcore', short: 'HC', desc: 'Team deathmatch for realists: a few bullets kill, friendly fire is on, and there is no minimap, crosshair or health bar.', scores: [25, 50, 75, 100], def: 50, unit: 'kills' },
    sd: { name: 'Search & Destroy', short: 'S&D', desc: 'Rounds with one life each. Attackers plant a bomb at site A or B; defenders stop them or defuse it. Sides swap every round.', scores: [3, 4, 6], def: 4, unit: 'rounds' },
    dem: { name: 'Demolition', short: 'DEM', desc: 'With respawns, the Allies attack: blow up both sites A and B before time runs out. The Axis defend and defuse.', scores: [2], def: 2, unit: 'sites' },
  };
  const MODE_IDS = Object.keys(MODES);
  // Killstreaks: earned by kills in a row without dying (killstreak kills don't count)
  // Scorestreaks: earned with points (kills, assists, objectives) without dying. Pick 3 in your loadout.
  const STREAKS = {
    recon: { name: 'Recon Plane', cost: 400, desc: 'Every enemy shows on your team\'s minimap for 30 seconds.', ms: 30000 },
    counter: { name: 'Counter-Recon', cost: 500, desc: 'Jams the enemy minimap with static and blocks their recon for 30 seconds.', ms: 30000 },
    supply: { name: 'Supply Drop', cost: 550, desc: 'A crate parachutes in next to you: full ammo, grenades and health for any teammate who grabs it.' },
    air: { name: 'Airstrike', cost: 750, desc: 'Bombers drop a line of bombs through the spot you are looking at.' },
    strafe: { name: 'Strafing Run', cost: 850, desc: 'A fighter flies low along your aim line, raking it with machine-gun fire.' },
    mortar: { name: 'Mortar Barrage', cost: 950, desc: 'Shells rain down on enemy positions.' },
    para: { name: 'Paratroopers', cost: 1100, desc: 'Three friendly soldiers parachute in beside you and fight for 45 seconds.', ms: 45000 },
    arty: { name: 'Artillery', cost: 1300, desc: 'A heavy bombardment pounds the enemy half of the map.' },
  };
  const STREAK_IDS = Object.keys(STREAKS);
  const DEFAULT_STREAKS = ['recon', 'air', 'mortar'];
  const POINTS = { plant: 200, defuse: 250, confirm: 50, deny: 50, kill: 100, headshot: 25, assist: 50, capture: 150, neutralize: 50, flagTake: 100, flagCapture: 300, flagReturn: 100, hqSecond: 10 };

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
  const SPRINT_MAX = 6;
  function newMoveState(x, y) { return { x, y, z: 0, vz: 0, stance: 0, slide: 0, sdx: 0, sdy: 0, slideCd: 0, pc: false, ps: false, pj: false, air: false, stam: SPRINT_MAX, winded: false }; }
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
    if (s.stam == null) { s.stam = SPRINT_MAX; s.winded = false; }
    const sprint = sprintIn && !crouch && !prone && !ads && moving && s.slide <= 0 && !s.winded;
    if (sprint) { s.stam -= dt; if (s.stam <= 0) { s.stam = 0; s.winded = true; } }
    else { s.stam = Math.min(SPRINT_MAX, s.stam + dt * (moving ? 0.6 : 1.0)); if (s.winded && s.stam >= 2.5) s.winded = false; }
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
    let s = st.spread * (ads ? st.adsMult : st.hipMult || 1) * (moving ? st.moveMult : 1);
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
    HEAD_ZONE, HEADSHOT_MULT, WEAPONS, ATTACHMENTS, ERAS, WALLS, SPAWNS, MAPS, MAP_IDS, MODES, MODE_IDS, STREAKS, STREAK_IDS, DEFAULT_STREAKS, POINTS, HEIGHTS, useMap,
    computeStats, sanitizeLoadout, cleanAtts, resolveCircle, moveCircle, rayWalls, rayWorld, rayCylinder, rayCircle,
    hasLOS, hasLOS3, moveSpeed, applyMove, currentSpread, eyeHeight, bodyHeight, headZone, clamp,
    groundAt, stepMove, newMoveState, GRAVITY, JUMP_V, SPRINT_MAX,
    LETHALS, TACTICALS, PERKS, PERK_SLOTS, DEFAULT_PERKS, STARTER_CLASSES, streakCost, OPERATOR, OP_KEYS, cleanOperator, operatorCode,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(typeof self !== 'undefined' ? self : this);
