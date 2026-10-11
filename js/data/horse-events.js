/* Horse-fights (Strength) and horse-races (Speed). Each horse in state.stable has a name and both stats. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const logistic = (d, k) => 1 / (1 + Math.exp(-d / k));
  const S = () => IS.Stable;

  const stable = (c) => S().sync(c.state, c.rng);
  const kill = (c, h) => {
    const s = c.state.stable, i = s.indexOf(h);
    if (i >= 0) s.splice(i, 1);
    c.state.farm.horses = Math.max(0, c.state.farm.horses - 1);
  };

  const DEFS = [
    { id: 'horse_fight', seasons: ['summer'], w: 2.0,
      needs: (c) => (c.state.farm.horses >= 1 ? {} : null),
      title: () => 'A horse-fight in the valley',
      body: (c) => {
        const h = S().best(c.state, 'strength');
        return ['The district is meeting for horse-fighting, with ale and wagers, and men are asking whose stallion will go into the ring.',
          h ? `Your strongest horse is ${h.name}: Strength ${h.strength} (${S().word(h.strength)})${h.wins || h.losses ? `, ${h.wins} won and ${h.losses} lost in the ring` : ', untried in the ring'}.` : 'You have no horse fit for the ring.'];
      },
      options: (c) => {
        stable(c);
        const h = S().best(c.state, 'strength');
        if (!h) return [{ id: 'stay', label: 'Watch from the edge', desc: 'No risk.', run: () => 'You watched with a cup in your hand and said little.' }];
        const p = Math.max(0.1, Math.min(0.88, logistic(h.strength - 55, 11) + Math.min(0.06, h.wins * 0.02) - Math.min(0.06, h.losses * 0.02)));
        const odds = IS.Feud.oddsWord(p);
        const fight = (stake) => () => {
          stable(c);
          if (stake) c.pay(stake);
          if (c.rng.chance(p)) {
            h.wins++; h.strength = Math.min(95, h.strength + 1);
            c.honor(h.wins >= 3 ? 2.6 : 2.2, `${h.name} won the horse-fight`);
            if (stake) c.earn(stake * 2.2);
            return `${h.name} came out of the ring bloodied and standing. ${h.wins >= 3 ? 'His name is known across the district. ' : ''}${stake ? `You won ${Math.round(stake * 2.2)} ells on him. ` : ''}People bought you ale.`;
          }
          h.losses++;
          c.honor(-0.8, `${h.name} lost the horse-fight`);
          if (c.rng.chance(0.2)) { kill(c, h); return `${h.name} lost, and had to be put down after.${stake ? ` The ${stake} ells went with him.` : ''}`; }
          return `${h.name} lost, and you drank less than the winner did.${stake ? ` The ${stake} ells are gone.` : ''}`;
        };
        return [
          { id: 'enter', label: `Enter ${h.name}`, desc: `Strength ${h.strength}, ${odds}. Honor +2.2 if he wins, −0.8 if he loses, and he may be killed. Winners get stronger.`, run: fight(0) },
          { id: 'wager', label: 'Enter him and wager on him', cost: 40, desc: `${ells(40)} staked (${odds}). If he wins you take back about ${ells(88)}. If not, the stake is gone.`, run: fight(40) },
          { id: 'stay', label: 'Watch from the edge', desc: 'No risk.', run: () => 'You watched with a cup in your hand and said little.' },
        ];
      } },

    { id: 'horse_race', seasons: ['summer'], w: 1.8,
      needs: (c) => (c.state.farm.horses >= 1 ? {} : null),
      title: () => 'Horse-racing at the gathering',
      body: (c) => {
        const h = S().best(c.state, 'speed');
        return ['Young men are racing horses along the strand at the summer gathering, and the whole district has come out to shout.',
          h ? `Your fastest horse is ${h.name}: Speed ${h.speed} (${S().word(h.speed)})${h.races ? `, ${h.raceWins} wins in ${h.races} races` : ', never raced'}.` : 'You have no horse to race.'];
      },
      options: (c) => {
        stable(c);
        const h = S().best(c.state, 'speed');
        if (!h) return [{ id: 'stay', label: 'Watch from the crowd', desc: 'No risk.', run: () => 'You watched with a cup in your hand and said little.' }];
        const rival = h.speed >= 62 ? 'a real chance to win' : h.speed >= 48 ? 'a fair chance of a place' : 'little hope of winning';
        const race = (stake) => () => {
          stable(c);
          if (stake) c.pay(stake);
          const field = c.rng.int(5, 8), mine = h.speed + c.rng.normal(0, 7);
          let ahead = 0;
          for (let i = 0; i < field - 1; i++) if (c.rng.normal(52, 13) + c.rng.normal(0, 7) > mine) ahead++;
          const place = ahead + 1;
          h.races++;
          if (place === 1) {
            h.raceWins++; h.speed = Math.min(95, h.speed + 1);
            c.honor(h.raceWins >= 3 ? 2.6 : 2.2, `${h.name} won the race`);
            if (stake) c.earn(stake * 3.2);
            return `${h.name} took the lead at the second flag and held it. Men who wouldn't have spoken to you last year bought you ale.${stake ? ` You won ${Math.round(stake * 3.2)} ells on him.` : ''}`;
          }
          if (place <= 3) {
            c.honor(0.4, `${h.name} placed in the race`);
            if (stake) c.earn(stake);
            return `${h.name} came in ${place === 2 ? 'second' : 'third'} of ${field}, close enough to be talked about.${stake ? ' You got your stake back.' : ''}`;
          }
          c.honor(-0.3, `${h.name} was beaten in the race`);
          return `${h.name} finished ${place === field ? 'last' : 'in the pack'} of ${field}. Somebody remarked on the quality of your horse, in your hearing.${stake ? ` The ${stake} ells are gone.` : ''}`;
        };
        return [
          { id: 'enter', label: `Race ${h.name}`, desc: `Speed ${h.speed}: ${rival}. Honor +2.2 for a win, +0.4 for a place, −0.3 if beaten. No risk to the horse.`, run: race(0) },
          { id: 'wager', label: 'Race him and back him', cost: 40, desc: `${ells(40)} staked. A win pays about ${ells(128)}, a place returns the stake, otherwise it is lost.`, run: race(40) },
          { id: 'stay', label: 'Watch from the crowd', desc: 'No risk.', run: () => 'You watched with a cup in your hand and said little.' },
        ];
      } },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
