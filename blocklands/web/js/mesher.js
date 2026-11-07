'use strict';
// Builds chunk meshes: visible faces only, per-vertex ambient occlusion, sky light and lamp light.
// Vertex: x, y, z, u, v, sky, lamp  (7 floats)
const Mesher = (() => {
  const P = CS + 2;                       // padded size
  const pad = new Uint8Array(P * P * WH);
  const phm = new Int16Array(P * P);
  const pidx = (x, y, z) => (y * P + (z + 1)) * P + (x + 1);

  // face: normal, origin, right, up, tile slot (0 top, 1 bottom, 2 side), shade
  const FACES = [
    { n: [1, 0, 0], o: [1, 0, 1], r: [0, 0, -1], u: [0, 1, 0], t: 2, s: 0.8 },
    { n: [-1, 0, 0], o: [0, 0, 0], r: [0, 0, 1], u: [0, 1, 0], t: 2, s: 0.8 },
    { n: [0, 1, 0], o: [0, 1, 1], r: [1, 0, 0], u: [0, 0, -1], t: 0, s: 1.0 },
    { n: [0, -1, 0], o: [0, 0, 0], r: [1, 0, 0], u: [0, 0, 1], t: 1, s: 0.5 },
    { n: [0, 0, 1], o: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0], t: 2, s: 0.65 },
    { n: [0, 0, -1], o: [1, 0, 0], r: [-1, 0, 0], u: [0, 1, 0], t: 2, s: 0.65 },
  ];
  const AO = [0.45, 0.65, 0.82, 1.0];
  const EPS = 0.0005;
  const LAMP_R = 8;

  function fill(c) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const n = World.getChunk(c.cx + dx, c.cz + dz);
      const x0 = dx < 0 ? CS - 1 : 0, x1 = dx > 0 ? 0 : CS - 1;
      const z0 = dz < 0 ? CS - 1 : 0, z1 = dz > 0 ? 0 : CS - 1;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const px = x + dx * CS, pz = z + dz * CS;
        phm[(pz + 1) * P + px + 1] = n ? n.hm[x + z * CS] : WH;
        for (let y = 0; y < WH; y++) pad[pidx(px, y, pz)] = n ? n.data[idx(x, y, z)] : B.STONE;
      }
    }
  }

  const at = (x, y, z) => (y < 0 ? B.BEDROCK : y >= WH ? B.AIR : pad[pidx(x, y, z)]);
  const opq = (x, y, z) => OPAQUE[at(x, y, z)];
  function sky(x, y, z) {
    if (y >= WH) return 1;
    const h = phm[(z + 1) * P + x + 1];
    if (y > h) return 1;
    return Math.max(0.12, 1 - (h - y) * 0.16);
  }

  function lampLight(lamps, x, y, z) {
    let best = 0;
    for (let i = 0; i < lamps.length; i += 3) {
      const dx = x - lamps[i], dy = y - lamps[i + 1], dz = z - lamps[i + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= LAMP_R * LAMP_R) continue;
      const v = Math.min(1, 1.5 * (1 - Math.sqrt(d2) / LAMP_R));
      if (v > best) best = v;
    }
    return best;
  }

  function visible(id, nb) {
    if (nb === B.AIR) return true;
    if (OPAQUE[nb]) return false;
    const k = BLOCKS[id].kind;
    if (k === 'water') return nb !== B.WATER;
    if (nb === id) return id === B.LEAVES && fancy; // Fancy: leaves show inner faces; glass never does
    return true;
  }

  let fancy = true;
  function build(c) {
    fancy = Settings.data.quality !== 'low';
    fill(c);
    // lamps around this chunk, in chunk-local coords (centre of block)
    const lamps = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const n = World.getChunk(c.cx + dx, c.cz + dz);
      if (!n) continue;
      for (const l of n.lamps) lamps.push(l[0] + dx * CS + 0.5, l[1] + 0.5, l[2] + dz * CS + 0.5);
    }
    const solid = [], water = [];
    for (let y = 0; y < WH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const id = pad[pidx(x, y, z)];
      if (id === B.AIR) continue;
      const b = BLOCKS[id];
      const tiles = Atlas.FACE_TILES[id];
      if (b.kind === 'plant') {
        const t = tiles[2];
        const u0 = t[0] / ATLAS_TILES + EPS, u1 = (t[0] + 1) / ATLAS_TILES - EPS;
        const v0 = t[1] / ATLAS_TILES + EPS, v1 = (t[1] + 1) / ATLAS_TILES - EPS;
        const s = sky(x, y, z), lm = lamps.length ? lampLight(lamps, x + 0.5, y + 0.5, z + 0.5) : 0;
        const q = [[0.15, 0.15, 0.85, 0.85], [0.15, 0.85, 0.85, 0.15]];
        for (const [ax, az, bx, bz] of q) {
          const A = [x + ax, y, z + az], Bv = [x + bx, y, z + bz];
          const v = [
            [A[0], y, A[2], u0, v1], [Bv[0], y, Bv[2], u1, v1], [Bv[0], y + 1, Bv[2], u1, v0], [A[0], y + 1, A[2], u0, v0],
          ];
          for (const tri of [[0, 1, 2], [0, 2, 3], [0, 2, 1], [0, 3, 2]]) for (const k of tri) solid.push(v[k][0], v[k][1], v[k][2], v[k][3], v[k][4], s, lm);
        }
        continue;
      }
      const isWater = b.kind === 'water';
      const out = isWater ? water : solid;
      const waterTop = isWater && at(x, y + 1, z) !== B.WATER ? 0.88 : 1;
      const selfEmit = b.emit ? 1 : 0;
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
        const nb = at(nx, ny, nz);
        if (!visible(id, nb)) continue;
        const t = tiles[F.t];
        const u0 = t[0] / ATLAS_TILES + EPS, u1 = (t[0] + 1) / ATLAS_TILES - EPS;
        const v0 = t[1] / ATLAS_TILES + EPS, v1 = (t[1] + 1) / ATLAS_TILES - EPS;
        const s = sky(nx, ny, nz);
        const verts = [];
        const aos = [];
        for (let k = 0; k < 4; k++) {
          const cr = k === 1 || k === 2 ? 1 : 0, cu = k >= 2 ? 1 : 0;
          const px = F.o[0] + F.r[0] * cr + F.u[0] * cu;
          let py = F.o[1] + F.r[1] * cr + F.u[1] * cu;
          const pz = F.o[2] + F.r[2] * cr + F.u[2] * cu;
          if (py === 1 && waterTop < 1) py = waterTop;
          let ao = 3;
          if (!isWater) {
            const sr = cr ? 1 : -1, su = cu ? 1 : -1;
            const ax = nx + F.r[0] * sr, ay = ny + F.r[1] * sr, az = nz + F.r[2] * sr;
            const bx = nx + F.u[0] * su, by = ny + F.u[1] * su, bz = nz + F.u[2] * su;
            const s1 = opq(ax, ay, az), s2 = opq(bx, by, bz);
            const cc = opq(ax + F.u[0] * su, ay + F.u[1] * su, az + F.u[2] * su);
            ao = s1 && s2 ? 0 : 3 - s1 - s2 - cc;
          }
          aos.push(ao);
          const shade = AO[ao] * F.s;
          let lm = selfEmit;
          if (!selfEmit && lamps.length) lm = lampLight(lamps, x + px, y + py, z + pz);
          verts.push([x + px, y + py, z + pz, cr ? u1 : u0, cu ? v0 : v1, s * shade, lm * (selfEmit ? 1 : shade)]);
        }
        const order = aos[0] + aos[2] < aos[1] + aos[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
        for (const k of order) { const v = verts[k]; out.push(v[0], v[1], v[2], v[3], v[4], v[5], v[6]); }
      }
    }
    return { solid: new Float32Array(solid), water: new Float32Array(water) };
  }

  return { build };
})();
