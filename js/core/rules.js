/* Core numeric rules: attribute limits, aging, mortality, counsel rule, beauty bonus. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});

  const R = {
    ATTR_MIN: 1,
    ATTR_MAX: 100,
    STRENGTH_DECLINE_AGE: 40, // Strength starts falling at 40
    NATURAL_DEATH_AGE: 55,    // natural death chance rises after 55

    clampAttr(v) { return Math.max(1, Math.min(100, Math.round(v))); },

    /** Points of Strength lost to age. Zero up to 40, then steady loss, faster after 60. */
    strengthLoss(age) {
      if (age <= R.STRENGTH_DECLINE_AGE) return 0;
      return (age - 40) * 0.9 + Math.max(0, age - 60) * 0.6;
    },
    strengthAtAge(peak, age) { return R.clampAttr(peak - R.strengthLoss(age)); },

    /** Beauty holds to 30, then fades. */
    beautyAtAge(peak, age) {
      if (age <= 30) return R.clampAttr(peak);
      return R.clampAttr(Math.max(peak * 0.2, peak - (age - 30) * 0.7));
    },
    /** Seasonal Honor glow from a wife's beauty. */
    beautyHonorBonus(beauty) { return beauty / 10; },

    /** Annual chance of dying of old age. Zero before 55, then rising. */
    naturalDeathHazard(age) {
      if (age < R.NATURAL_DEATH_AGE) return 0;
      const d = age - R.NATURAL_DEATH_AGE;
      return Math.min(0.9, 0.025 + 0.006 * d + 0.0004 * d * d);
    },
    /** Annual chance of dying of everything else: childhood illness, accident, childbed, violence at sea or in a feud. */
    backgroundHazard(age, sex) {
      let h;
      if (age < 1) h = 0.14;
      else if (age < 5) h = 0.045;
      else if (age < 16) h = 0.014;
      else if (age < 40) h = 0.009;
      else if (age < 55) h = 0.006 + (age - 39) * 0.0004;
      else h = 0.012;
      if (sex === 'F' && age >= 16 && age <= 40) h += 0.014; // childbed
      if (sex === 'M' && age >= 16 && age <= 50) h += 0.007; // sea, feuds, accidents
      return h;
    },
    annualDeathHazard(age, sex) {
      const n = R.naturalDeathHazard(age);
      const b = R.backgroundHazard(age, sex);
      return Math.min(0.95, 1 - (1 - n) * (1 - b));
    },
    /** One game turn is half a year. */
    turnDeathChance(age, sex) { return 1 - Math.pow(1 - R.annualDeathHazard(age, sex), 0.5); },
    turnNaturalDeathChance(age) { return 1 - Math.pow(1 - R.naturalDeathHazard(age), 0.5); },

    /** Simulate survival year by year from `fromAge`; returns the age at which death occurs. */
    rollAgeAtDeath(rng, fromAge, sex) {
      for (let a = Math.max(0, fromAge); a < 105; a++) {
        if (rng.chance(R.annualDeathHazard(a, sex))) return a;
      }
      return 105;
    },

    /** Pick a cause of death consistent with the hazard mix at that age. */
    deathCause(rng, age, sex) {
      const nat = R.naturalDeathHazard(age);
      const bg = R.backgroundHazard(age, sex);
      if (rng.chance(nat / (nat + bg))) return { id: 'old_age', text: 'died of old age' };
      const causes = [
        { id: 'illness', text: 'died of a wasting sickness', w: 4 },
        { id: 'fever', text: 'died of a fever in the winter', w: 2 },
        { id: 'drowned', text: 'drowned', w: sex === 'M' && age >= 14 ? 1.4 : 0.3 },
        { id: 'killed', text: 'was killed in a quarrel', w: sex === 'M' && age >= 16 && age <= 55 ? 1.8 : 0 },
        { id: 'childbed', text: 'died in childbed', w: sex === 'F' && age >= 16 && age <= 42 ? 5 : 0 },
        { id: 'exposure', text: 'was lost in a winter storm', w: age >= 12 ? 0.9 : 0 },
        { id: 'horse', text: 'was thrown from a horse and died', w: age >= 8 ? 0.8 : 0 },
        { id: 'accident', text: 'died in an accident on the farm', w: 0.6 },
      ];
      return rng.weighted(causes, (c) => c.w);
    },

    /**
     * Counsel rule: if a counsellor's Law (a wife) is higher than the representative's,
     * the representative's effective Law is the average of the two. Never lowers it.
     */
    effectiveLaw(ownLaw, counselLaws) {
      const best = (counselLaws || []).reduce((m, v) => Math.max(m, v), 0);
      return best > ownLaw ? Math.round((ownLaw + best) / 2) : ownLaw;
    },

    age(person, year) { return year - person.birthYear; },
  };

  IS.Rules = R;
})();
