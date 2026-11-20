export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createValueNoise(seed) {
  const rng = mulberry32(seed);
  const perm = new Float32Array(256 * 256);
  for (let i = 0; i < perm.length; i++) perm[i] = rng();
  const at = (x, y) => perm[((y & 255) << 8) | (x & 255)];
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = fade(x - xi), v = fade(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }

  function fbm(x, y, octaves = 4) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise2(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }

  return { noise2, fbm };
}
