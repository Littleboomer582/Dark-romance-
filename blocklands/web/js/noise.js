'use strict';
// Seeded hash-based value noise (2D and 3D) and fractal sums.
const Noise = (() => {
  let SEED = 1337;

  function setSeed(s) { SEED = s | 0; }

  function hash2(x, y, salt) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(SEED + (salt | 0), 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function hash3(x, y, z, salt) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2246822519) ^ Math.imul(SEED + (salt | 0), 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  // Returns -1..1
  function noise2(x, y, salt) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const a = hash2(xi, yi, salt), b = hash2(xi + 1, yi, salt);
    const c = hash2(xi, yi + 1, salt), d = hash2(xi + 1, yi + 1, salt);
    return lerp(lerp(a, b, xf), lerp(c, d, xf), yf) * 2 - 1;
  }

  function noise3(x, y, z, salt) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const n000 = hash3(xi, yi, zi, salt), n100 = hash3(xi + 1, yi, zi, salt);
    const n010 = hash3(xi, yi + 1, zi, salt), n110 = hash3(xi + 1, yi + 1, zi, salt);
    const n001 = hash3(xi, yi, zi + 1, salt), n101 = hash3(xi + 1, yi, zi + 1, salt);
    const n011 = hash3(xi, yi + 1, zi + 1, salt), n111 = hash3(xi + 1, yi + 1, zi + 1, salt);
    const x00 = lerp(n000, n100, xf), x10 = lerp(n010, n110, xf);
    const x01 = lerp(n001, n101, xf), x11 = lerp(n011, n111, xf);
    return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf) * 2 - 1;
  }

  function fbm2(x, y, oct, salt) {
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += noise2(x * f, y * f, salt + i * 31) * amp;
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }

  return { setSeed, hash2, hash3, noise2, noise3, fbm2 };
})();
