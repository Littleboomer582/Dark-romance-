'use strict';
// Block definitions and the procedurally painted texture atlas (all art is generated in code).
const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, WATER: 6, LOG: 7, LEAVES: 8, PLANKS: 9,
  GLASS: 10, BEDROCK: 11, COAL: 12, IRON: 13, GRAVEL: 14, SNOW: 15, BRICK: 16, LAMP: 17, CACTUS: 18,
  TALLGRASS: 19, ROSE: 20, DAISY: 21, SANDSTONE: 22, STONEBRICK: 23, BIRCH: 24, CLAY: 25,
};

const ATLAS_TILES = 16; // 16 x 16 grid of 16px tiles
const TILE = 16;

// kind: 'solid' | 'cutout' (alpha-tested, see-through) | 'water' | 'plant' (crossed quads)
// tex: [top, bottom, side] tile names
const BLOCKS = [];
function def(id, name, opts) { BLOCKS[id] = Object.assign({ id, name, kind: 'solid', hardness: 1, drop: id, sound: 'stone', emit: 0 }, opts); }
def(B.AIR, 'Air', { kind: 'air' });
def(B.GRASS, 'Grass', { tex: ['grass_top', 'dirt', 'grass_side'], hardness: 0.6, drop: B.DIRT, sound: 'grass' });
def(B.DIRT, 'Dirt', { tex: ['dirt', 'dirt', 'dirt'], hardness: 0.5, sound: 'grass' });
def(B.STONE, 'Stone', { tex: ['stone', 'stone', 'stone'], hardness: 1.6, drop: B.COBBLE });
def(B.COBBLE, 'Cobblestone', { tex: ['cobble', 'cobble', 'cobble'], hardness: 1.8 });
def(B.SAND, 'Sand', { tex: ['sand', 'sand', 'sand'], hardness: 0.5, sound: 'sand' });
def(B.WATER, 'Water', { kind: 'water', tex: ['water', 'water', 'water'], hardness: -1 });
def(B.LOG, 'Oak Log', { tex: ['log_top', 'log_top', 'log_side'], hardness: 1.3, sound: 'wood' });
def(B.LEAVES, 'Leaves', { kind: 'cutout', tex: ['leaves', 'leaves', 'leaves'], hardness: 0.25, sound: 'grass' });
def(B.PLANKS, 'Planks', { tex: ['planks', 'planks', 'planks'], hardness: 1.1, sound: 'wood' });
def(B.GLASS, 'Glass', { kind: 'cutout', tex: ['glass', 'glass', 'glass'], hardness: 0.4, drop: 0, sound: 'glass' });
def(B.BEDROCK, 'Bedrock', { tex: ['bedrock', 'bedrock', 'bedrock'], hardness: -1 });
def(B.COAL, 'Coal Ore', { tex: ['coal', 'coal', 'coal'], hardness: 2 });
def(B.IRON, 'Iron Ore', { tex: ['iron', 'iron', 'iron'], hardness: 2.4 });
def(B.GRAVEL, 'Gravel', { tex: ['gravel', 'gravel', 'gravel'], hardness: 0.6, sound: 'sand' });
def(B.SNOW, 'Snow', { tex: ['snow', 'dirt', 'snow_side'], hardness: 0.4, sound: 'sand' });
def(B.BRICK, 'Bricks', { tex: ['brick', 'brick', 'brick'], hardness: 1.8 });
def(B.LAMP, 'Lamp', { tex: ['lamp', 'lamp', 'lamp'], hardness: 0.5, emit: 1, sound: 'glass' });
def(B.CACTUS, 'Cactus', { tex: ['cactus_top', 'cactus_top', 'cactus_side'], hardness: 0.5, sound: 'grass' });
def(B.TALLGRASS, 'Tall Grass', { kind: 'plant', tex: ['tallgrass', 'tallgrass', 'tallgrass'], hardness: 0, drop: 0, sound: 'grass' });
def(B.ROSE, 'Red Flower', { kind: 'plant', tex: ['rose', 'rose', 'rose'], hardness: 0, sound: 'grass' });
def(B.DAISY, 'Yellow Flower', { kind: 'plant', tex: ['daisy', 'daisy', 'daisy'], hardness: 0, sound: 'grass' });
def(B.SANDSTONE, 'Sandstone', { tex: ['sandstone_top', 'sandstone_top', 'sandstone'], hardness: 1.2 });
def(B.STONEBRICK, 'Stone Bricks', { tex: ['stonebrick', 'stonebrick', 'stonebrick'], hardness: 1.8 });
def(B.BIRCH, 'Birch Log', { tex: ['birch_top', 'birch_top', 'birch_side'], hardness: 1.3, sound: 'wood' });
def(B.CLAY, 'Clay', { tex: ['clay', 'clay', 'clay'], hardness: 0.6, sound: 'sand' });

const NUM_BLOCKS = BLOCKS.length;
const OPAQUE = new Uint8Array(256);   // hides neighbour faces, casts AO
const SOLID = new Uint8Array(256);    // collides with the player
const TARGETABLE = new Uint8Array(256);
for (const b of BLOCKS) {
  OPAQUE[b.id] = b.kind === 'solid' ? 1 : 0;
  SOLID[b.id] = b.kind === 'solid' || b.kind === 'cutout' ? 1 : 0;
  TARGETABLE[b.id] = b.kind !== 'air' && b.kind !== 'water' ? 1 : 0;
}
// Blocks offered in the creative inventory (in order)
const PLACEABLE = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.STONEBRICK, B.BRICK, B.PLANKS, B.LOG, B.BIRCH, B.LEAVES,
  B.GLASS, B.LAMP, B.SAND, B.SANDSTONE, B.GRAVEL, B.CLAY, B.SNOW, B.CACTUS, B.COAL, B.IRON, B.TALLGRASS, B.ROSE, B.DAISY, B.BEDROCK];

// Survival recipes: inputs (id -> count) -> output
const RECIPES = [
  { out: B.PLANKS, n: 4, inp: [[B.LOG, 1]] },
  { out: B.PLANKS, n: 4, inp: [[B.BIRCH, 1]] },
  { out: B.STONE, n: 1, inp: [[B.COBBLE, 1], [B.COAL, 1]] },
  { out: B.GLASS, n: 2, inp: [[B.SAND, 2], [B.COAL, 1]] },
  { out: B.STONEBRICK, n: 4, inp: [[B.STONE, 4]] },
  { out: B.SANDSTONE, n: 1, inp: [[B.SAND, 4]] },
  { out: B.BRICK, n: 4, inp: [[B.CLAY, 4], [B.COAL, 1]] },
  { out: B.LAMP, n: 2, inp: [[B.GLASS, 1], [B.COAL, 1], [B.IRON, 1]] },
];

// ---- texture painting ----
const Atlas = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_TILES * TILE;
  const ctx = canvas.getContext('2d');
  const tiles = {};
  let next = 0;
  let rs = 1;
  const rnd = () => { rs = (Math.imul(rs, 1103515245) + 12345) >>> 0; return rs / 4294967296; };
  const clamp = (v) => Math.max(0, Math.min(255, v | 0));

  function tile(name, seed, paint) {
    const idx = next++;
    tiles[name] = idx;
    rs = seed * 7919 + 17;
    const img = ctx.createImageData(TILE, TILE);
    const px = (x, y, r, g, b, a = 255) => {
      if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
      const o = (y * TILE + x) * 4;
      img.data[o] = clamp(r); img.data[o + 1] = clamp(g); img.data[o + 2] = clamp(b); img.data[o + 3] = a;
    };
    const get = (x, y) => { const o = (y * TILE + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]]; };
    paint(px, get);
    ctx.putImageData(img, (idx % ATLAS_TILES) * TILE, Math.floor(idx / ATLAS_TILES) * TILE);
  }

  const noisy = (r, g, b, v) => (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const n = (rnd() - 0.5) * v;
      px(x, y, r + n, g + n, b + n);
    }
  };
  const speckle = (px, count, r, g, b, v = 20) => {
    for (let i = 0; i < count; i++) {
      const x = (rnd() * TILE) | 0, y = (rnd() * TILE) | 0, n = (rnd() - 0.5) * v;
      px(x, y, r + n, g + n, b + n);
    }
  };
  const blob = (px, cx, cy, r, g, b) => {
    const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]];
    for (const [dx, dy] of pts) if (rnd() < 0.8) { const n = (rnd() - 0.5) * 30; px(cx + dx, cy + dy, r + n, g + n, b + n); }
  };

  tile('grass_top', 1, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const n = rnd();
      px(x, y, 86 + n * 30 - 15, 150 + n * 40 - 20, 58 + n * 20 - 10);
    }
    speckle(px, 18, 110, 180, 70);
  });
  tile('dirt', 2, (px) => { noisy(124, 88, 60, 30)(px); speckle(px, 14, 96, 66, 44); speckle(px, 8, 150, 112, 80); });
  tile('grass_side', 3, (px) => {
    noisy(124, 88, 60, 30)(px); speckle(px, 14, 96, 66, 44);
    for (let x = 0; x < TILE; x++) {
      const d = 3 + ((rnd() * 3) | 0);
      for (let y = 0; y < d; y++) { const n = rnd(); px(x, y, 86 + n * 26 - 13, 150 + n * 36 - 18, 58); }
    }
  });
  tile('stone', 4, (px) => { noisy(128, 128, 130, 22)(px); speckle(px, 20, 104, 104, 108); speckle(px, 10, 150, 150, 152); });
  tile('cobble', 5, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const cx = (x + ((y >> 2) & 1) * 2) % 5, cy = y % 4;
      const edge = cx === 0 || cy === 0;
      const n = (rnd() - 0.5) * 24;
      const v = edge ? 82 : 128 + ((x * 7 + y * 13) % 3) * 8;
      px(x, y, v + n, v + n, v + 2 + n);
    }
  });
  tile('sand', 6, (px) => { noisy(222, 206, 150, 18)(px); speckle(px, 14, 200, 184, 128); });
  tile('water', 7, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const w = Math.sin((x + y * 0.5) * 0.8) * 10 + (rnd() - 0.5) * 8;
      px(x, y, 46 + w, 98 + w, 196 + w);
    }
  });
  tile('log_side', 8, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const stripe = (x % 4 === 0) ? -26 : (x % 4 === 2 ? 8 : 0);
      const n = (rnd() - 0.5) * 16;
      px(x, y, 104 + stripe + n, 78 + stripe + n, 48 + stripe * 0.6 + n);
    }
  });
  tile('log_top', 9, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const n = (rnd() - 0.5) * 12;
      if (d > 6.5) px(x, y, 96 + n, 72 + n, 44 + n);
      else { const ring = Math.floor(d) % 2 ? 0 : -18; px(x, y, 178 + ring + n, 144 + ring + n, 92 + ring + n); }
    }
  });
  tile('leaves', 10, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const n = rnd();
      if (n < 0.18) px(x, y, 0, 0, 0, 0);
      else px(x, y, 48 + n * 40, 112 + n * 50, 38 + n * 20);
    }
  });
  tile('planks', 11, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const seam = y % 4 === 3 || (x === ((y >> 2) * 5 + 3) % TILE);
      const n = (rnd() - 0.5) * 14;
      const grain = Math.sin(x * 0.9 + (y >> 2) * 3) * 6;
      if (seam) px(x, y, 112 + n, 82 + n, 50 + n);
      else px(x, y, 176 + grain + n, 136 + grain + n, 84 + grain + n);
    }
  });
  tile('glass', 12, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const border = x === 0 || y === 0 || x === 15 || y === 15;
      const glint = (x - y === 3 || x - y === 4) && x > 4 && x < 11;
      if (border) px(x, y, 210, 232, 240);
      else if (glint) px(x, y, 240, 250, 255);
      else px(x, y, 0, 0, 0, 0);
    }
  });
  tile('bedrock', 13, (px) => { noisy(70, 70, 72, 60)(px); speckle(px, 30, 30, 30, 32); });
  tile('coal', 14, (px) => {
    noisy(128, 128, 130, 22)(px);
    for (let i = 0; i < 5; i++) blob(px, 2 + ((rnd() * 12) | 0), 2 + ((rnd() * 12) | 0), 38, 38, 40);
  });
  tile('iron', 15, (px) => {
    noisy(128, 128, 130, 22)(px);
    for (let i = 0; i < 5; i++) blob(px, 2 + ((rnd() * 12) | 0), 2 + ((rnd() * 12) | 0), 214, 168, 128);
  });
  tile('gravel', 16, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const n = rnd(); const v = n < 0.3 ? 96 : n < 0.7 ? 128 : 160;
      px(x, y, v + 4, v, v - 4);
    }
  });
  tile('snow', 17, (px) => { noisy(240, 244, 250, 10)(px); });
  tile('snow_side', 18, (px) => {
    noisy(124, 88, 60, 30)(px);
    for (let x = 0; x < TILE; x++) {
      const d = 3 + ((rnd() * 3) | 0);
      for (let y = 0; y < d; y++) px(x, y, 238 + rnd() * 10, 242, 250);
    }
  });
  tile('brick', 19, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const row = y >> 2; const off = row % 2 ? 4 : 0;
      const mortar = y % 4 === 3 || (x + off) % 8 === 7;
      const n = (rnd() - 0.5) * 20;
      if (mortar) px(x, y, 190 + n * 0.3, 184, 176);
      else px(x, y, 156 + n, 74 + n * 0.5, 58 + n * 0.5);
    }
  });
  tile('lamp', 20, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const frame = x === 0 || y === 0 || x === 15 || y === 15 || x === 7 || x === 8 || y === 7 || y === 8;
      const n = (rnd() - 0.5) * 14;
      if (frame) px(x, y, 120 + n, 92 + n, 52 + n);
      else { const d = Math.hypot((x % 8) - 3.5, (y % 8) - 3.5); px(x, y, 255, 236 - d * 10 + n, 150 - d * 14 + n); }
    }
  });
  tile('cactus_side', 21, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const n = (rnd() - 0.5) * 16;
      const rib = x % 4 === 1 ? 18 : 0;
      px(x, y, 40 + rib + n, 120 + rib + n, 46 + n);
    }
    for (let i = 0; i < 10; i++) px(((rnd() * 4) | 0) * 4 + 1, (rnd() * TILE) | 0, 220, 220, 180);
  });
  tile('cactus_top', 22, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5); const n = (rnd() - 0.5) * 16;
      px(x, y, 70 - d * 2 + n, 150 - d * 3 + n, 70 + n);
    }
  });
  tile('tallgrass', 23, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px(x, y, 0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      let x = 2 + ((rnd() * 12) | 0); const h = 6 + ((rnd() * 9) | 0); const lean = rnd() < 0.5 ? -1 : 1;
      for (let j = 0; j < h; j++) { if (j > 3 && rnd() < 0.25) x += lean; const n = rnd() * 30; px(x, 15 - j, 70 + n, 140 + n, 50); }
    }
  });
  const flower = (r, g, b) => (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px(x, y, 0, 0, 0, 0);
    for (let y = 6; y < 16; y++) px(7, y, 60, 130, 40);
    px(6, 11, 60, 140, 40); px(5, 10, 60, 140, 40); px(8, 12, 60, 140, 40); px(9, 11, 60, 140, 40);
    for (let y = 2; y < 7; y++) for (let x = 5; x < 10; x++) {
      if ((x === 5 || x === 9) && (y === 2 || y === 6)) continue;
      px(x, y, r + (rnd() - 0.5) * 30, g + (rnd() - 0.5) * 30, b);
    }
    px(7, 4, 250, 220, 80);
  };
  tile('rose', 24, flower(214, 40, 40));
  tile('daisy', 25, flower(250, 214, 50));
  tile('sandstone', 26, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const band = y < 3 ? 10 : y > 12 ? -12 : (y % 4 === 0 ? -8 : 0);
      const n = (rnd() - 0.5) * 10;
      px(x, y, 216 + band + n, 196 + band + n, 140 + band + n);
    }
  });
  tile('sandstone_top', 27, (px) => { noisy(218, 200, 144, 12)(px); });
  tile('stonebrick', 28, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const row = y >> 3; const off = row % 2 ? 4 : 0;
      const mortar = y % 8 === 7 || (x + off) % 8 === 7;
      const n = (rnd() - 0.5) * 18;
      const v = mortar ? 84 : 126;
      px(x, y, v + n, v + n, v + 4 + n);
    }
  });
  tile('birch_side', 29, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const n = (rnd() - 0.5) * 12; px(x, y, 222 + n, 220 + n, 210 + n); }
    for (let i = 0; i < 7; i++) {
      const y = (rnd() * TILE) | 0, x0 = (rnd() * 12) | 0, w = 2 + ((rnd() * 4) | 0);
      for (let x = x0; x < x0 + w; x++) px(x, y, 46, 42, 38);
    }
  });
  tile('birch_top', 30, (px) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); const n = (rnd() - 0.5) * 12;
      if (d > 6.5) px(x, y, 220 + n, 218 + n, 208 + n);
      else { const ring = Math.floor(d) % 2 ? 0 : -16; px(x, y, 196 + ring + n, 170 + ring + n, 116 + ring + n); }
    }
  });
  tile('clay', 31, (px) => { noisy(158, 164, 178, 14)(px); speckle(px, 10, 140, 146, 160); });

  function uv(name) {
    const i = tiles[name];
    return [(i % ATLAS_TILES), Math.floor(i / ATLAS_TILES)];
  }
  // per block: [top, bottom, side] tile coordinates
  const FACE_TILES = BLOCKS.map((b) => b.tex ? b.tex.map(uv) : null);

  // Small isometric icon of a block (data URL), for hotbar and inventory
  const iconCache = {};
  function icon(id) {
    if (iconCache[id]) return iconCache[id];
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const t = FACE_TILES[id]; const b = BLOCKS[id];
    const src = (tc) => [tc[0] * TILE, tc[1] * TILE];
    if (b.kind === 'plant') {
      const [sx, sy] = src(t[2]); g.drawImage(canvas, sx, sy, TILE, TILE, 4, 4, 40, 40);
    } else {
      const s = 20;
      // top face
      let [sx, sy] = src(t[0]);
      g.setTransform(s / TILE, (s / TILE) * 0.5, -(s / TILE), (s / TILE) * 0.5, 24, 2);
      g.drawImage(canvas, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
      // left face
      [sx, sy] = src(t[2]);
      g.setTransform(s / TILE, (s / TILE) * 0.5, 0, s / TILE * 1.1, 4, 12);
      g.drawImage(canvas, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, TILE, TILE);
      // right face
      g.setTransform(s / TILE, -(s / TILE) * 0.5, 0, s / TILE * 1.1, 24, 22);
      g.drawImage(canvas, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, TILE, TILE);
    }
    return (iconCache[id] = c.toDataURL());
  }

  return { canvas, FACE_TILES, icon };
})();
