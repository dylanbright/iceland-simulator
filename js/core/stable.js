/* Individual horses: each has a name, a Speed (for races) and a Strength (for horse-fights).
 * The farm keeps a plain count (farm.horses) that the economy works with; state.stable is the list of
 * named horses behind that count, kept in step by sync(). */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const NAMES = ['Blesi', 'Grani', 'Fálki', 'Skjóni', 'Jarpur', 'Brúnn', 'Rauður', 'Leirljós', 'Moldi', 'Glæsir', 'Fákur', 'Svipur',
    'Vindur', 'Gráni', 'Sóti', 'Stjarni', 'Glói', 'Mósi', 'Hvítingur', 'Hrímnir', 'Skuggi', 'Svaði', 'Hrafn', 'Dreyri', 'Gulltoppr',
    'Skinfaxi', 'Vakur', 'Léttir', 'Stúfur', 'Kólur', 'Hörður', 'Eldur'];

  const word = (v) => (v >= 76 ? 'exceptional' : v >= 62 ? 'very good' : v >= 48 ? 'good' : v >= 35 ? 'ordinary' : 'poor');

  function make(state, rng, around) {
    const taken = new Set((state.stable || []).map((h) => h.name));
    const free = NAMES.filter((n) => !taken.has(n));
    const name = free.length ? rng.pick(free) : rng.pick(NAMES) + ' ' + (state.stable.length + 1);
    const pull = (k) => (around == null ? 0 : 0.3 * (around[k] - 50));
    const id = 'h' + (state.horseSeq = (state.horseSeq || 0) + 1);
    return { id, name, speed: clamp(Math.round(rng.normal(50 + pull('speed'), 14)), 15, 95), strength: clamp(Math.round(rng.normal(50 + pull('strength'), 14)), 15, 95), wins: 0, losses: 0, races: 0, raceWins: 0 };
  }

  const worth = (h) => h.speed + h.strength;

  /** Make the list match farm.horses. New horses are foals or purchases (a little like your herd); losses are mostly the weak. */
  function sync(state, rng) {
    state.stable = state.stable || [];
    const n = state.farm.horses, s = state.stable;
    while (s.length > n) {
      // a loss falls on the weak more often than the strong
      const w = s.map((h) => Math.max(5, 160 - worth(h)));
      let r = rng.float(0, w.reduce((a, b) => a + b, 0)), i = 0;
      while (i < s.length - 1 && r > w[i]) { r -= w[i]; i++; }
      s.splice(i, 1);
    }
    if (s.length < n) {
      const avg = s.length ? { speed: s.reduce((a, h) => a + h.speed, 0) / s.length, strength: s.reduce((a, h) => a + h.strength, 0) / s.length } : null;
      while (s.length < n) s.push(make(state, rng, avg));
    }
    return s;
  }

  /** You sold n horses: the poorest go first. */
  function sell(state, n) {
    state.stable = state.stable || [];
    state.stable.sort((a, b) => worth(a) - worth(b));
    state.stable.splice(0, Math.min(n, state.stable.length));
  }

  function sellIds(state, ids) {
    state.stable = (state.stable || []).filter((h) => !ids.includes(h.id));
  }

  const best = (state, key) => (state.stable || []).slice().sort((a, b) => b[key] - a[key] || worth(b) - worth(a))[0] || null;

  IS.Stable = { NAMES, word, make, sync, sell, sellIds, best, worth };
})();
