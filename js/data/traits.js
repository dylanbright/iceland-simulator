/* Temperament traits for husbands (player, heirs, ancestors) and wives.
 * Effects are described as data; later systems read them. `flavor` is used in the family prologue. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});

  const HUSBAND = {
    hotheaded: { id: 'hotheaded', name: 'Hot-headed', weight: 1.1, conflicts: ['cautious', 'peaceable'], flavor: 'was quick to anger and quicker to draw',
      desc: 'Cheaper to start a duel or take vengeance, easier to provoke. Bold deeds earn Honor; rash ones cost it.' },
    cautious: { id: 'cautious', name: 'Cautious', weight: 1.0, conflicts: ['hotheaded', 'fearless'], flavor: 'weighed every step before he took it',
      desc: 'Better at arbitration and avoiding bad fights. May be called a coward when kin demand vengeance.' },
    greedy: { id: 'greedy', name: 'Greedy', weight: 0.9, conflicts: ['generous'], flavor: 'counted every ell twice',
      desc: 'Better at trade and profit, poorer at gifts. Hospitality costs Honor.' },
    generous: { id: 'generous', name: 'Generous', weight: 1.0, conflicts: ['greedy'], flavor: 'kept an open hall and an open hand',
      desc: 'Gifts and feasts earn more Honor, but drain wealth.' },
    proud: { id: 'proud', name: 'Proud', weight: 1.0, conflicts: [], flavor: 'carried himself as if he were a chieftain already',
      desc: 'Honor swings are larger in both directions. Slights hurt more.' },
    peaceable: { id: 'peaceable', name: 'Peaceable', weight: 1.0, conflicts: ['hotheaded'], flavor: 'would sooner settle than fight',
      desc: 'Reduces feud escalation. Jealous and proud wives are harder to manage.' },
    cunning: { id: 'cunning', name: 'Cunning', weight: 0.9, conflicts: ['just'], flavor: 'was never short of a clever plan',
      desc: 'Better at out-of-court maneuvers and loopholes. Discovered schemes cost more Honor.' },
    just: { id: 'just', name: 'Just', weight: 0.8, conflicts: ['cunning'], flavor: 'was known to keep his word to friend and foe alike',
      desc: 'Better at arbitration and oaths. Dirty tricks are not available, but judges favor him.' },
    fearless: { id: 'fearless', name: 'Fearless', weight: 0.8, conflicts: ['cautious'], flavor: 'did not know the meaning of fear, or of prudence',
      desc: 'Better in combat and duels, but more exposed to wounds and death.' },
  };

  const WIFE = {
    thrifty: { id: 'thrifty', name: 'Thrifty', weight: 1.2, conflicts: ['wasteful'], visible: false, flavor: 'ran the household with a careful hand',
      desc: 'Boosts household surplus and winter stores.' },
    wasteful: { id: 'wasteful', name: 'Wasteful', weight: 1.0, conflicts: ['thrifty'], visible: false, flavor: 'spent faster than the farm could earn',
      desc: 'Drains profit: extra food and cloth consumed, feasts and gifts you did not approve, borrowing against the farm.' },
    jealous: { id: 'jealous', name: 'Jealous', weight: 1.2, conflicts: [], visible: false, flavor: 'could not bear a rival in the house or the valley',
      desc: 'Happiness drops sharply from concubines and other women. May act against rivals.' },
    proud: { id: 'proud', name: 'Proud', weight: 1.2, conflicts: [], visible: true, flavor: 'never forgot a slight at the feast-bench',
      desc: 'Quick to feel slighted, especially over seating and gifts. Pushes you to demand equal treatment.' },
    vindictive: { id: 'vindictive', name: 'Vindictive', weight: 0.8, conflicts: ['peacemaker'], visible: false, flavor: 'kept her grudges like treasure',
      desc: 'Remembers every slight for years and escalates.' },
    meddling: { id: 'meddling', name: 'Meddling', weight: 1.0, conflicts: [], visible: false, flavor: 'had an opinion on every man\'s business',
      desc: 'Steps into your disputes and pushes arbitration or vengeance.' },
    malicious: { id: 'malicious', name: 'Malicious', weight: 0.45, conflicts: ['peacemaker'], visible: false, flavor: 'had a hard heart behind a fair face',
      desc: 'Actively harms people she dislikes: slander, theft, inciting servants, thralls or kin to violence.' },
    peacemaker: { id: 'peacemaker', name: 'Peacemaker', weight: 1.0, conflicts: ['vindictive', 'malicious'], visible: false, flavor: 'calmed quarrels before they caught fire',
      desc: 'Reduces feud escalation and hosts well.' },
    capable: { id: 'capable', name: 'Capable', weight: 0.9, conflicts: [], visible: true, flavor: 'could run a farm in her husband\'s absence',
      desc: 'Stronger in household labour and management.' },
    lawful: { id: 'lawful', name: 'Lawful', weight: 0.7, conflicts: [], visible: true, flavor: 'knew the law better than most men at the Thing',
      desc: 'Her legal counsel is sharper.' },
    skald: { id: 'skald', name: 'Skald', weight: 0.7, conflicts: [], visible: true, flavor: 'made verses that were repeated across the valley',
      desc: 'Her poetry earns Honor at feasts and answers insults.' },
  };

  function roll(rng, defs, count, inherit, inheritChance) {
    const chosen = [];
    const ok = (id) => !chosen.some((c) => defs[c].conflicts.includes(id) || defs[id].conflicts.includes(c));
    for (const id of inherit || []) {
      if (chosen.length < count && defs[id] && !chosen.includes(id) && ok(id) && rng.chance(inheritChance)) chosen.push(id);
    }
    let guard = 0;
    while (chosen.length < count && guard++ < 30) {
      const pool = Object.values(defs).filter((d) => !chosen.includes(d.id) && ok(d.id));
      if (!pool.length) break;
      chosen.push(rng.weighted(pool, (d) => d.weight).id);
    }
    return chosen;
  }

  IS.Traits = {
    HUSBAND, WIFE,
    rollHusband(rng, parentTraits) {
      const count = rng.chance(0.45) ? 2 : 1;
      return roll(rng, HUSBAND, count, parentTraits, 0.4);
    },
    rollWife(rng) {
      const count = rng.weighted([{ n: 1, w: 0.4 }, { n: 2, w: 0.45 }, { n: 3, w: 0.15 }], (x) => x.w).n;
      return roll(rng, WIFE, count, [], 0);
    },
    flavor(sex, id) { return (sex === 'M' ? HUSBAND : WIFE)[id].flavor; },
    def(sex, id) { return (sex === 'M' ? HUSBAND : WIFE)[id]; },
  };
})();
