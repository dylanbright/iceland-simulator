/* Person factory. People are plain JSON objects so state saves cleanly. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const R = IS.Rules, N = IS.Names, T = IS.Traits;

  /** Simple per-generation id counter. */
  function makeIdGen(prefix) { let n = 0; return () => (prefix || 'p') + (++n); }

  /** Most people are unremarkable at law or verse; a few are prodigies. */
  function skill(rng, median) {
    return rng.chance(0.15) ? rng.clampedNormal(median + 35, 14, 30, 95) : rng.clampedNormal(median, 12, 3, 70);
  }

  const Person = {
    makeIdGen,
    /**
     * opts: sex, birthYear, name {first,gen}, father {first,gen}, role ('husband'|'wife'|'none'),
     *       parentTraits, honor, happiness, kind ('free'|'thrall')
     */
    make(rng, nextId, opts) {
      const sex = opts.sex;
      const name = opts.name || (opts.kind === 'thrall' ? N.thrall(rng, sex) : sex === 'M' ? N.male(rng) : N.female(rng));
      const peakStrength = sex === 'M' ? rng.clampedNormal(55, 14, 15, 95) : rng.clampedNormal(40, 12, 10, 80);
      const peakBeauty = rng.clampedNormal(50, 20, 5, 98);
      const p = {
        id: nextId(),
        first: name.first,
        gen: name.gen,
        father: opts.father ? { first: opts.father.first, gen: opts.father.gen } : null,
        byname: null,
        sex,
        kind: opts.kind || 'free',
        birthYear: opts.birthYear,
        deathYear: null,
        deathCause: null,
        peak: { strength: peakStrength, beauty: peakBeauty },
        attrs: {
          honor: opts.honor != null ? R.clampAttr(opts.honor) : rng.clampedNormal(45, 12, 5, 95),
          happiness: opts.happiness != null ? R.clampAttr(opts.happiness) : rng.clampedNormal(58, 12, 15, 90),
          strength: peakStrength,
          law: skill(rng, 28),
          poetry: skill(rng, 25),
          beauty: peakBeauty,
          husbandry: rng.clampedNormal(46, 15, 5, 90),
        },
        traits: [],
      };
      if (opts.role === 'husband') p.traits = T.rollHusband(rng, opts.parentTraits || []);
      else if (opts.role === 'wife') p.traits = T.rollWife(rng);
      if (p.kind === 'thrall') p.attrs.resentment = rng.clampedNormal(35, 15, 5, 80);
      return p;
    },
    /** Recompute age-dependent attributes (Strength, Beauty) for a given year. */
    refresh(p, year) {
      const age = year - p.birthYear;
      p.attrs.strength = R.strengthAtAge(p.peak.strength, age);
      p.attrs.beauty = R.beautyAtAge(p.peak.beauty, age);
      return p;
    },
    fullName(p) { return N.fullName(p); },
    /** A man's byname often reflects his temperament. */
    assignByname(rng, p) {
      if (p.sex !== 'M' || !rng.chance(0.28)) return;
      const map = { hotheaded: 'the Hot-Headed', greedy: 'the Stingy', generous: 'the Generous', proud: 'the Proud',
        peaceable: 'the Peaceful', cunning: 'the Sly', just: 'the Just', fearless: 'the Bold', cautious: 'the Wary' };
      const fromTrait = p.traits.length && rng.chance(0.7) ? map[rng.pick(p.traits)] : null;
      p.byname = fromTrait || N.genericByname(rng);
    },
  };

  IS.Person = Person;
})();
