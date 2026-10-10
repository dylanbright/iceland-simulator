/* Starting position: turns an ancestry into a playable household, farm and set of obligations. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const R = IS.Rules, N = IS.Names, P = IS.Person, A = IS.Ancestry;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round10 = (v) => Math.round(v / 10) * 10;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const TIER_LABEL = ['', 'cotter on rented land', 'smallholder', 'householder with a sound farm', 'prosperous householder', 'great householder'];

  /** Split movable wealth (ells) into goods the farm actually holds. */
  function deriveAssets(landValue, movable) {
    return {
      landValue,
      tenure: landValue >= 800 ? 'owned' : 'rented',
      cattle: Math.max(1, Math.round((movable * 0.38) / 80)),
      sheep: Math.max(4, Math.round((movable * 0.30) / 16)),
      horses: Math.max(1, Math.round((movable * 0.08) / 80)),
      vadmal: Math.round(movable * 0.14),     // ells of cloth on hand
      silver: Math.round((movable * 0.10) / 30), // eyrir of refined silver
    };
  }

  const Start = {
    TIER_LABEL, deriveAssets,
    build(a) {
      const rng = new IS.RNG(a.seed).fork('start');
      const nextId = P.makeIdGen('s');
      const ctx = { rng, families: a.families };
      const Y = a.startYear;
      const people = {};
      // The ancestry pre-rolled death dates for some relatives. Once the game starts, death is rolled turn by turn instead.
      const add = (p) => { if (p.deathYear != null && p.deathYear > Y) { p.deathYear = null; p.deathCause = null; } people[p.id] = p; return p; };

      const head = add(clone(a.player));
      P.refresh(head, Y);
      const headAge = Y - head.birthYear;
      let land = a.inheritance.land, movable = a.inheritance.movable;
      const hh = { wives: [], concubines: [], children: [], kin: [], servants: [], thralls: [] };
      const marriages = [];
      const grudges = {};
      const log = [];

      // ---- the father's household: mother, stepmother, siblings
      const gen2 = a.generations[2];
      const motherMarriage = gen2.marriages.find((m) => m.mother);
      const lastMarriage = gen2.marriages[gen2.marriages.length - 1];
      let mother = null;
      const widowAlive = (m) => m.endReason === 'husband died' && m.wife.deathYear > Y && Y - m.wife.birthYear < 76;
      if (widowAlive(motherMarriage)) {
        mother = add(clone(motherMarriage.wife)); P.refresh(mother, Y);
        mother.role = 'mother'; hh.kin.push(mother.id);
      }
      if (lastMarriage !== motherMarriage && widowAlive(lastMarriage)) {
        const sm = add(clone(lastMarriage.wife)); P.refresh(sm, Y);
        sm.role = 'stepmother'; hh.kin.push(sm.id);
      }
      const away = [];
      for (const c of gen2.children) {
        if (c.id === head.id || !(c.deathYear == null || c.deathYear > Y)) continue;
        const sib = add(clone(c)); P.refresh(sib, Y);
        const age = Y - sib.birthYear;
        if (age < 25 && !(sib.sex === 'F' && age >= 18 && rng.chance(0.45))) {
          sib.role = sib.sex === 'M' ? 'brother' : 'sister'; hh.kin.push(sib.id);
        } else {
          sib.role = sib.sex === 'M' ? 'brother (living apart)' : 'sister (married away)';
          if (sib.sex === 'F') {
            const fam = A.newFamily(ctx, 'brother-in-law', clamp(A.tierOf(land + movable) + rng.int(-1, 1), 1, 5));
            sib.marriedInto = fam.farm;
          }
          away.push(sib.id);
        }
      }

      // ---- the player's own marriage
      const married = rng.chance(0.78);
      let wife = null;
      if (married) {
        const homeTier = A.tierOf(land + movable);
        const tier = clamp(homeTier + rng.int(-1, 1), 1, 5);
        const fam = A.newFamily(ctx, 'wife-kin', tier);
        const startY = Math.max(Y - rng.int(0, 8), head.birthYear + 17);
        const ageAtM = rng.clampedNormal(20, 3, 16, 30);
        let happy = rng.clampedNormal(62, 10, 25, 90) + (tier < homeTier ? 4 : 0) - (tier > homeTier ? 6 : 0);
        wife = add(P.make(rng, nextId, {
          sex: 'F', birthYear: startY - ageAtM, father: fam.head, role: 'wife',
          honor: rng.clampedNormal(40 + tier * 3, 10, 8, 90), happiness: clamp(happy, 20, 92),
        }));
        wife.kin = { farm: fam.farm, tier };
        wife.role = 'wife';
        // After some years of marriage you know her public traits and part of the rest.
        wife.knownTraits = wife.traits.filter((t) => IS.Traits.WIFE[t].visible || rng.chance(0.4));
        P.refresh(wife, Y);
        const dowry = round10(A.TIER_WEALTH[tier] * rng.float(0.07, 0.14));
        movable += dowry;
        hh.wives.push(wife.id);
        marriages.push({ wifeId: wife.id, startY, kinFarm: fam.farm, kinTier: tier, dowry, status: 'married' });

        // children of this marriage who are still alive
        let buried = 0;
        const wifeAge = Y - wife.birthYear;
        for (let y = startY + 1; y <= Y && y - wife.birthYear <= 41; y++) {
          if (!rng.chance(0.36)) continue;
          const sex = rng.chance(0.5) ? 'M' : 'F';
          const survives = y + R.rollAgeAtDeath(rng, 0, sex) > Y;
          if (!survives) { buried++; continue; }
          const kid = add(P.make(rng, nextId, { sex, birthYear: y, father: head, role: 'none' }));
          kid.motherId = wife.id; kid.role = sex === 'M' ? 'son' : 'daughter';
          P.refresh(kid, Y);
          hh.children.push(kid.id);
        }
        wife.childrenBuried = buried;

        // grudges the wife brings into the house
        const g = [];
        const touchy = wife.traits.some((t) => ['jealous', 'proud', 'meddling', 'vindictive', 'malicious'].includes(t));
        if (mother && touchy && rng.chance(0.5)) {
          g.push({ target: { type: 'person', id: mother.id }, reason: 'mother-in-law', intensity: rng.int(20, 50) });
        }
        if (rng.chance(0.3)) {
          const pool = Object.values(a.families).filter((f) => f.farm !== fam.farm && f.farm !== a.region.farm && f.head);
          if (pool.length) {
            const f = rng.pick(pool);
            g.push({ target: { type: 'family', farm: f.farm }, reason: `an old quarrel between ${fam.farm} and ${f.farm}`, intensity: rng.int(15, 45) });
          }
        }
        grudges[wife.id] = g;
        void wifeAge;
      }

      // ---- free servants and thralls, scaled to wealth
      const wealth = land + movable;
      const freeAdults = () => 1 + hh.wives.length + hh.kin.filter((id) => Y - people[id].birthYear >= 16).length + hh.servants.length;
      const nServants = clamp(Math.floor(wealth / 3500) + rng.int(0, 2) - (wealth < 2000 ? 1 : 0), 0, 6);
      for (let i = 0; i < nServants; i++) {
        const sex = rng.chance(0.5) ? 'M' : 'F';
        const s = add(P.make(rng, nextId, { sex, birthYear: Y - rng.int(16, 55), role: 'none' }));
        s.role = 'servant'; P.refresh(s, Y);
        hh.servants.push(s.id);
      }
      const maxThralls = Math.min(8, Math.floor(freeAdults() * 1.2));
      const nThralls = Math.min(maxThralls, rng.int(0, 1 + Math.floor(wealth / 3500)));
      for (let i = 0; i < nThralls; i++) {
        const sex = rng.chance(0.55) ? 'M' : 'F';
        const t = add(P.make(rng, nextId, { sex, birthYear: Y - rng.int(14, 50), role: 'none', kind: 'thrall' }));
        t.role = 'thrall'; P.refresh(t, Y);
        hh.thralls.push(t.id);
      }

      // ---- the farm
      const assets = deriveAssets(land, movable);
      const tier = A.tierOf(land + movable);
      const farm = Object.assign({
        name: a.region.farm, valley: a.region.valley, quarter: a.region.quarter, setting: a.region.setting,
        wealth: land + movable, tier, tierLabel: TIER_LABEL[tier],
      }, assets);

      if (!married) log.push('You are unmarried. Your kin will expect you to find a wife soon.');
      if (mother) log.push(`Your mother, ${N.fullName(mother)}, still lives in the house.`);

      return {
        headId: head.id, people, household: hh, marriages, grudges, farm,
        away, headAge, married, log,
        hooks: clone(a.hooks), families: clone(a.families),
      };
    },
  };

  IS.Start = Start;
})();
