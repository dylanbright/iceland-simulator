/* Seeded random number generator (mulberry32). Deterministic: same seed, same game.
 * Classic script: attaches to the shared IS namespace; also loadable with require() in Node. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});

  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  class RNG {
    constructor(seed) {
      this.seed = String(seed);
      this.state = hashString(this.seed) || 0x9e3779b9;
    }
    next() {
      this.state = (this.state + 0x6d2b79f5) | 0;
      let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** Integer in [min, max] inclusive. */
    int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
    float(min, max) { return min + this.next() * (max - min); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    /** Pick from items using a weight function (or item.weight). */
    weighted(items, weightOf) {
      const wf = weightOf || ((x) => x.weight);
      let total = 0;
      for (const it of items) total += Math.max(0, wf(it));
      if (total <= 0) return items[Math.floor(this.next() * items.length)];
      let r = this.next() * total;
      for (const it of items) {
        r -= Math.max(0, wf(it));
        if (r < 0) return it;
      }
      return items[items.length - 1];
    }
    normal(mean = 0, sd = 1) {
      const u1 = 1 - this.next();
      const u2 = this.next();
      return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    clampedNormal(mean, sd, min, max) {
      return Math.round(Math.min(max, Math.max(min, this.normal(mean, sd))));
    }
    lognormal(median, sigma) { return median * Math.exp(sigma * this.normal(0, 1)); }
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    /** Independent sub-stream keyed by label; does not advance this stream. */
    fork(label) { return new RNG(this.seed + '/' + label); }
    getState() { return this.state; }
    setState(s) { this.state = s | 0; }
  }

  RNG.randomSeed = function () {
    const words = ['hrafn', 'ketill', 'grim', 'skeggi', 'bjorn', 'ulf', 'asa', 'thora', 'snorri', 'atli', 'kolbein', 'gisli', 'oddr', 'eyvind', 'sigrid', 'helga'];
    const w = words[Math.floor(Math.random() * words.length)];
    return w + '-' + Math.floor(1000 + Math.random() * 9000);
  };

  IS.RNG = RNG;
})();
