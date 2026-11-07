'use strict';
// Chunked voxel world: terrain generation, block access, player edits.
const CS = 16;        // chunk size (x, z)
const WH = 96;        // world height
const SEA = 30;
const idx = (x, y, z) => (y * CS + z) * CS + x;
const ckey = (cx, cz) => cx + ',' + cz;

class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.data = new Uint8Array(CS * CS * WH);
    this.hm = new Int16Array(CS * CS); // highest light-blocking block per column (-1 if none)
    this.lamps = [];                    // [x, y, z] local positions of light blocks
    this.mesh = null;
    this.dirty = true;
  }
  get(x, y, z) { return this.data[idx(x, y, z)]; }
  updateColumn(x, z) {
    let y = WH - 1;
    for (; y >= 0; y--) { const id = this.data[idx(x, y, z)]; if (OPAQUE[id] || id === B.LEAVES) break; }
    this.hm[x + z * CS] = y;
  }
  rebuildMeta() {
    this.lamps.length = 0;
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) this.updateColumn(x, z);
    for (let i = 0; i < this.data.length; i++) if (BLOCKS[this.data[i]] && BLOCKS[this.data[i]].emit) {
      this.lamps.push([i % CS, Math.floor(i / (CS * CS)), Math.floor(i / CS) % CS]);
    }
  }
}

const Terrain = {
  height(x, z) {
    const cont = Noise.fbm2(x / 320, z / 320, 4, 10);
    const hills = Noise.fbm2(x / 70, z / 70, 3, 20);
    const ridge = 1 - Math.abs(Noise.fbm2(x / 160, z / 160, 4, 30));
    const mountMask = Math.max(0, Noise.fbm2(x / 400, z / 400, 2, 40) * 1.8 - 0.15);
    let h = 34 + cont * 16 + hills * 6 + mountMask * ridge * ridge * 38;
    return Math.max(4, Math.min(WH - 8, Math.floor(h)));
  },
  temp(x, z) { return Noise.fbm2(x / 380, z / 380, 3, 50); },
  forest(x, z) { return Noise.fbm2(x / 120, z / 120, 2, 60); },
  // biome: 0 plains, 1 forest, 2 desert, 3 snowy
  biome(x, z, h) {
    const t = this.temp(x, z);
    if (h > 66 || t < -0.38) return 3;
    if (t > 0.3) return 2;
    return this.forest(x, z) > 0.05 ? 1 : 0;
  },
  // Tree at this column? returns 0 none, 1 oak, 2 birch
  treeAt(x, z) {
    const h = this.height(x, z);
    if (h <= SEA + 1) return 0;
    const b = this.biome(x, z, h);
    if (b === 2) return 0;
    const chance = b === 1 ? 0.028 : b === 3 ? 0.01 : 0.004;
    const r = Noise.hash2(x, z, 77);
    if (r >= chance) return 0;
    return (b !== 3 && Noise.hash2(x, z, 78) < 0.3) ? 2 : 1;
  },
};

const World = {
  chunks: new Map(),
  edits: new Map(), // chunk key -> Map(index -> id)

  reset() {
    for (const c of this.chunks.values()) if (c.mesh) Renderer.freeMesh(c.mesh);
    this.chunks.clear(); this.edits.clear();
  },

  getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); },

  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= WH) return B.AIR;
    const c = this.chunks.get(ckey(Math.floor(x / CS), Math.floor(z / CS)));
    if (!c) return B.AIR;
    return c.data[idx(x - c.cx * CS, y, z - c.cz * CS)];
  },

  isLoaded(x, z) { return this.chunks.has(ckey(Math.floor(x / CS), Math.floor(z / CS))); },

  setBlock(x, y, z, id) {
    if (y < 0 || y >= WH) return false;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = this.chunks.get(ckey(cx, cz));
    if (!c) return false;
    const lx = x - cx * CS, lz = z - cz * CS;
    const i = idx(lx, y, lz);
    const old = c.data[i];
    if (old === id) return false;
    c.data[i] = id;
    const k = ckey(cx, cz);
    if (!this.edits.has(k)) this.edits.set(k, new Map());
    this.edits.get(k).set(i, id);
    c.updateColumn(lx, lz);
    const lightChanged = BLOCKS[old].emit || BLOCKS[id].emit;
    if (lightChanged) c.rebuildMeta();
    // remesh this chunk and touching neighbours (lamps light up to 8 blocks away)
    const r = lightChanged ? 1 : 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const touch = r || (dx === 0 || (dx === -1 && lx === 0) || (dx === 1 && lx === CS - 1)) &&
        (dz === 0 || (dz === -1 && lz === 0) || (dz === 1 && lz === CS - 1));
      if (!touch) continue;
      const n = this.chunks.get(ckey(cx + dx, cz + dz));
      if (n) n.dirty = true;
    }
    // plants fall off when the block below goes away
    if (y + 1 < WH && !SOLID[id]) {
      const above = this.getBlock(x, y + 1, z);
      if (BLOCKS[above].kind === 'plant') this.setBlock(x, y + 1, z, B.AIR);
    }
    return true;
  },

  generate(cx, cz) {
    const c = new Chunk(cx, cz);
    const d = c.data;
    const ox = cx * CS, oz = cz * CS;
    const heights = new Int16Array(CS * CS), biomes = new Uint8Array(CS * CS);
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = ox + x, wz = oz + z;
      const h = Terrain.height(wx, wz);
      const bi = Terrain.biome(wx, wz, h);
      heights[x + z * CS] = h; biomes[x + z * CS] = bi;
      const beach = h <= SEA + 1 && h >= SEA - 3;
      const under = h < SEA - 3;
      let top, fill;
      if (bi === 2) { top = B.SAND; fill = B.SAND; }
      else if (beach) { top = B.SAND; fill = B.SAND; }
      else if (under) { const r = Noise.hash2(wx >> 2, wz >> 2, 5); top = r < 0.3 ? B.GRAVEL : r < 0.45 ? B.CLAY : B.SAND; fill = top === B.CLAY ? B.CLAY : B.DIRT; }
      else if (bi === 3) { top = B.SNOW; fill = B.DIRT; }
      else { top = B.GRASS; fill = B.DIRT; }
      if (h > 74) { top = B.SNOW; fill = B.STONE; }
      d[idx(x, 0, z)] = B.BEDROCK;
      for (let y = 1; y <= h; y++) {
        let id;
        if (y === h) id = top;
        else if (y > h - 4) id = (bi === 2 && y > h - 3) ? B.SAND : (bi === 2 ? B.SANDSTONE : fill);
        else {
          id = B.STONE;
          if (y < 64 && Noise.hash3(wx >> 1, y >> 1, wz >> 1, 101) < 0.022 && Noise.hash3(wx, y, wz, 102) < 0.65) id = B.COAL;
          else if (y < 40 && Noise.hash3(wx >> 1, y >> 1, wz >> 1, 103) < 0.012 && Noise.hash3(wx, y, wz, 104) < 0.6) id = B.IRON;
          else if (y < 3 && Noise.hash3(wx, y, wz, 105) < 0.5) id = B.BEDROCK;
        }
        d[idx(x, y, z)] = id;
      }
      for (let y = h + 1; y <= SEA; y++) d[idx(x, y, z)] = B.WATER;
      // caves: two crossing noise sheets carve tunnels
      const maxY = h > SEA + 2 ? h : h - 5;
      for (let y = 4; y < maxY; y++) {
        const a = Noise.noise3(wx / 28, y / 18, wz / 28, 200);
        if (Math.abs(a) > 0.1) continue;
        const b = Noise.noise3(wx / 28, y / 18, wz / 28, 300);
        if (Math.abs(b) < 0.1) d[idx(x, y, z)] = B.AIR;
      }
      // ground cover
      const surf = d[idx(x, h, z)];
      if (h >= SEA + 1 && h + 1 < WH) {
        const r = Noise.hash2(wx, wz, 90);
        if (surf === B.GRASS) {
          if (r < (bi === 1 ? 0.06 : 0.12)) d[idx(x, h + 1, z)] = B.TALLGRASS;
          else if (r < 0.135) d[idx(x, h + 1, z)] = Noise.hash2(wx, wz, 91) < 0.5 ? B.ROSE : B.DAISY;
        } else if (surf === B.SAND && bi === 2 && r < 0.006) {
          const ch = 1 + ((Noise.hash2(wx, wz, 92) * 3) | 0);
          for (let i = 1; i <= ch && h + i < WH; i++) d[idx(x, h + i, z)] = B.CACTUS;
        }
      }
    }
    // trees (scan a margin so trees near the edge spill in from neighbours)
    for (let tz = -2; tz < CS + 2; tz++) for (let tx = -2; tx < CS + 2; tx++) {
      const wx = ox + tx, wz = oz + tz;
      const kind = Terrain.treeAt(wx, wz);
      if (!kind) continue;
      const inside = tx >= 0 && tz >= 0 && tx < CS && tz < CS;
      const gh = inside ? heights[tx + tz * CS] : Terrain.height(wx, wz);
      if (inside) { const s = d[idx(tx, gh, tz)]; if (s !== B.GRASS && s !== B.SNOW && s !== B.DIRT) continue; }
      else { const bi = Terrain.biome(wx, wz, gh); if (gh <= SEA + 1 || gh > 74 || bi === 2) continue; }
      if (inside && gh <= SEA + 1) continue;
      const th = 4 + ((Noise.hash2(wx, wz, 79) * 3) | 0);
      const top = gh + th;
      const logId = kind === 2 ? B.BIRCH : B.LOG;
      const put = (x, y, z, id, force) => {
        if (x < 0 || z < 0 || x >= CS || z >= CS || y <= 0 || y >= WH) return;
        const i = idx(x, y, z);
        if (force || d[i] === B.AIR || d[i] === B.TALLGRASS || d[i] === B.ROSE || d[i] === B.DAISY) d[i] = id;
      };
      for (let y = top - 2; y <= top + 1; y++) {
        const r = y >= top ? 1 : 2;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && (y >= top || Noise.hash3(wx + dx, y, wz + dz, 80) < 0.5)) continue;
          put(tx + dx, y, tz + dz, B.LEAVES, false);
        }
      }
      for (let y = gh + 1; y < top; y++) put(tx, y, tz, logId, true);
      if (inside) put(tx, gh, tz, B.DIRT, true);
    }
    // re-apply saved player edits
    const e = this.edits.get(ckey(cx, cz));
    if (e) for (const [i, id] of e) d[i] = id;
    c.rebuildMeta();
    this.chunks.set(ckey(cx, cz), c);
    return c;
  },

  unload(key) {
    const c = this.chunks.get(key);
    if (!c) return;
    if (c.mesh) Renderer.freeMesh(c.mesh);
    this.chunks.delete(key);
  },

  findSpawn() {
    for (let r = 0; r < 400; r += 8) {
      for (let a = 0; a < 8; a++) {
        const x = Math.round(Math.cos(a * Math.PI / 4) * r), z = Math.round(Math.sin(a * Math.PI / 4) * r);
        const h = Terrain.height(x, z);
        if (h > SEA + 1 && h < 70 && !Terrain.treeAt(x, z)) return [x + 0.5, h + 1, z + 0.5];
      }
    }
    return [0.5, Terrain.height(0, 0) + 2, 0.5];
  },

  serializeEdits() {
    const out = {};
    for (const [k, m] of this.edits) {
      if (!m.size) continue;
      const arr = [];
      for (const [i, id] of m) arr.push(i, id);
      out[k] = arr;
    }
    return out;
  },

  loadEdits(obj) {
    this.edits.clear();
    if (!obj) return;
    for (const k in obj) {
      const m = new Map(); const a = obj[k];
      for (let i = 0; i < a.length; i += 2) m.set(a[i], a[i + 1]);
      this.edits.set(k, m);
    }
  },
};
