/* The acts of a feud, and how to answer them (see core/feud.js for who strikes and when).
 * These events are pushed by Feud.tick; they never come up by chance (needs() is always null).
 * The damage of an act has already been done when you read it. Your choice decides what follows:
 * the law (Law score), arbitration, striking back (which raises the stakes), or swallowing it.
 */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const F = () => IS.Feud;
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const wound = (c) => {
    const n = c.rng.int(3, 9);
    c.head.attrs.strength = Math.max(5, Math.round(c.head.attrs.strength - n));
    return n;
  };
  const down = (c, n) => F().escalate(c.state, c.p.farm, -(n || 1));
  const up = (c, n) => F().escalate(c.state, c.p.farm, n || 1);
  const owe = (c, v) => { const f = F().get(c.state, c.p.farm); if (f) f.owedThem += v; };
  const sour = (c, d) => F().bump(c.state, c.p.farm, d);
  const word = (p) => F().oddsWord(p);

  /** The three ways of answering damage to your goods: law, arbitration, striking back, or bearing it. */
  function damageOptions(c, v, what, costs) {
    const L = F().lawChance(c.state, c.p.farm), arb = Math.min(0.8, 0.5 + c.head.attrs.honor / 300);
    const odds = F().fightOdds(c.state, -0.05);
    return [
      { id: 'sue', label: 'Take it to the Thing', cost: costs[0], desc: `${ells(costs[0])} to bring the case. ${cap(word(L))} at law. A win pays you about ${ells(v * 1.5)}.`,
        run: () => {
          c.pay(costs[0]);
          if (c.rng.chance(L)) { c.earn(v * 1.5); c.honor(1, `You won a suit against ${c.p.farm}`); sour(c, -5); down(c); return `The court found for you. ${c.p.head} was ordered to pay for ${what}, and did.`; }
          c.honor(-1, `A suit against ${c.p.farm} you lost`); return `No one would swear to what was seen. The case fell, and the fee with it.`;
        } },
      { id: 'arbitrate', label: 'Ask respected men to arbitrate', cost: costs[1], desc: `${ells(costs[1])} for the feast. ${cap(word(arb))}. If he agrees you recover about ${ells(v * 0.8)} and the quarrel cools.`,
        run: () => {
          c.pay(costs[1]);
          if (c.rng.chance(arb)) { c.earn(v * 0.8); sour(c, 3); down(c); c.honor(0.3, `A settlement with ${c.p.farm}`); return `The arbiters set a price and ${c.p.head} paid it, sourly. Both sides called it fair.`; }
          c.honor(-0.3, `${c.p.farm} refused arbitration`); return `${c.p.head} would not come to the meeting, and says he knows nothing of it.`;
        } },
      { id: 'retaliate', label: 'Pay him back in kind', desc: `Take as much of his as he took of yours. ${cap(word(odds))}. It will not end it.`,
        run: () => {
          up(c); owe(c, v * 0.8);
          if (c.rng.chance(odds)) { c.earn(v * 0.8); c.honor(0.5, `You answered ${c.p.farm} in kind`); sour(c, -12); return `Your men came home before dawn with his stock. Everyone knows whose it was.${F().theyFall(c.state, c.rng, c.p.farm, 0.3)}`; }
          c.honor(-2, `Your reprisal on ${c.p.farm} failed`); sour(c, -8); const n = wound(c);
          return `His herdsmen were waiting. You came home empty-handed and ${n > 6 ? 'badly ' : ''}hurt.${F().bloodshed(c.state, c.rng, c, c.p.farm, c.p.head, 0.3)}`;
        } },
      { id: 'bear', label: 'Say nothing', desc: 'Honor −1.5. He may take it for weakness.',
        run: () => { c.honor(-1.5, `You let ${c.p.farm} take ${what} unanswered`); if (c.rng.chance(0.5)) up(c); return 'People talked of it at the Thing, and not kindly.'; } },
    ];
  }

  const DEFS = [
    { id: 'feud_insult', w: 0, needs: () => null,
      title: (c) => `${c.p.head} mocks you before the whole Thing`,
      body: (c) => [`At the gathering ${c.p.head} of ${c.p.farm} made a verse about you, and the benches laughed. It was not a kind verse. Every man there is now waiting to see what you do.`],
      options: (c) => {
        const poetry = c.head.attrs.poetry, verse = Math.min(0.85, 0.25 + poetry / 150);
        const duel = Math.min(0.8, 0.35 + (c.head.attrs.strength - 50) / 150);
        const L = F().lawChance(c.state, c.p.farm, 0.34);
        return [
          { id: 'verse', label: 'Answer him in verse', desc: `${cap(word(verse))}: your poetry decides. Honor +1.5 or −1.`,
            run: () => { sour(c, -3); if (c.rng.chance(verse)) { c.honor(1.5, `You answered ${c.p.farm} in verse`); return 'The verse was better than his, and was repeated at three farms by morning.'; } c.honor(-1, `Your answer to ${c.p.farm} fell flat`); return 'You found the first line and not the second. They laughed again.'; } },
          { id: 'duel', label: 'Challenge him to the island', desc: `A duel. ${cap(word(duel))} by Strength. Honor +3 or −3, and a loss means a wound.`,
            run: () => {
              sour(c, -12);
              if (c.rng.chance(duel)) {
                c.honor(3, `You beat ${c.p.head} on the island`);
                if (c.rng.chance(0.25)) { up(c); owe(c, F().wergild(c.state, 'kin')); F().slain(c.state, c.p.farm, 'them'); return `You won, and he did not get up. His kin are already counting what you owe.`; }
                return `He yielded after the third bout. Nobody makes verses about you now.`;
              }
              c.honor(-3, `${c.p.head} bested you on the island`); wound(c); up(c); return `He cut you across the arm and the Thing was quiet. You will not forget it, and neither will he.${F().bloodshed(c.state, c.rng, c, c.p.farm, c.p.head, 0.15)}`;
            } },
          { id: 'law', label: 'Prosecute the verse', cost: 25, desc: `${ells(25)}. Slander is a case at law. ${cap(word(L))}. A win brings a fine and Honor +1.`,
            run: () => { c.pay(25); sour(c, -6); if (c.rng.chance(L)) { c.earn(50 + 10 * c.tier); c.honor(1, `You won a slander case against ${c.p.farm}`); return `The court fined him, and the fine was read out where everyone could hear it.`; } c.honor(-1, 'A slander case you lost'); return `The judges said it was only a verse.`; } },
          { id: 'laugh', label: 'Laugh it off', desc: 'Honor −0.8. Peaceable, and maybe wise.',
            run: () => { c.honor(-0.8, `You ignored ${c.p.farm}'s verse`); sour(c, 2); return 'You laughed loudest of all. Some thought it was bravery.'; } },
        ];
      } },

    { id: 'feud_livestock', w: 0, needs: () => null,
      title: (c) => c.p.kind === 'horses' ? `${c.p.n > 1 ? 'Horses' : 'A horse'} killed in the pasture` : `Stock driven off in the night`,
      body: (c) => {
        const what = { sheep: `${c.p.n} sheep`, cattle: `${c.p.n} ${c.p.n > 1 ? 'cattle' : 'cow'}`, horses: `${c.p.n > 1 ? c.p.n + ' horses' : 'a horse'}` }[c.p.kind];
        return [c.p.kind === 'horses'
          ? `${cap(what)} ${c.p.n > 1 ? 'were' : 'was'} found hamstrung in the pasture, still alive, which is how you know it was meant. The tracks lead toward ${c.p.farm}.`
          : `${cap(what)} ${c.p.n > 1 ? 'were' : 'was'} gone by morning. The tracks lead toward ${c.p.farm}, and ${c.p.head} has been saying hard things about you at every gathering.`];
      },
      options: (c) => damageOptions(c, c.p.value, c.p.kind, [30, 20]) },

    { id: 'feud_hay', w: 0, needs: () => null,
      title: () => 'A hay-stack set alight',
      body: (c) => [`Someone fired one of your hay-stacks in the night. About ${c.p.tons} tons are ash. A boy saw riders on the hill, heading toward ${c.p.farm}.`],
      options: (c) => damageOptions(c, c.p.value, 'the hay', [30, 20]) },

    { id: 'feud_thrall', w: 0, needs: () => null,
      title: (c) => `${c.p.victim} is dead`,
      body: (c) => [c.p.kind === 'thrall'
        ? `${c.p.victim}, a thrall of your house, was found dead on the path to the summer pasture. He was killed by men of ${c.p.farm}, and ${c.p.head} does not trouble to deny it. A thrall's price is small, but it was your man.`
        : `${c.p.victim}, a free man in your service, was killed on the road by men of ${c.p.farm}. ${c.p.head} says he was a thief. Nobody believes it, but some are willing to say they do.`],
      options: (c) => {
        const v = c.p.value, L = F().lawChance(c.state, c.p.farm, c.p.kind === 'servant' ? 0.34 : 0.28), arb = Math.min(0.75, 0.45 + c.head.attrs.honor / 300);
        const free = c.p.kind === 'servant';
        return [
          { id: 'sue', label: 'Prosecute at the Althing', cost: 40, desc: `${ells(40)}. ${cap(word(L))} at law. A win pays about ${ells(v * 1.5)} and the case is public.`,
            run: () => { c.pay(40); if (c.rng.chance(L)) { c.earn(v * 1.5); c.honor(free ? 3 : 1.5, `You won a killing case against ${c.p.farm}`); sour(c, -5); down(c); return `${c.p.head} was ordered to pay, and the amount was read aloud. He paid it, and does not come to your door.`; } c.honor(-1.5, `A killing case against ${c.p.farm} you lost`); return `The court would not rule it a killing. ${c.p.head} walked out smiling.`; } },
          { id: 'settle', label: 'Take blood-money by arbitration', cost: 20, desc: `${ells(20)} for the feast. ${cap(word(arb))}. If he agrees you recover about ${ells(v)}.`,
            run: () => { c.pay(20); if (c.rng.chance(arb)) { c.earn(v); sour(c, 5); down(c); c.honor(-0.3, `Blood-money taken from ${c.p.farm}`); return `The arbiters set the price and ${c.p.head} counted it out. The matter is closed, on paper.`; } c.honor(-0.5, `${c.p.farm} would not pay`); return `${c.p.head} offered half the price and a laugh. You said no.`; } },
          { id: 'avenge', label: 'Kill one of his in return', desc: `One of equal worth, no more. Honor +${free ? 1.5 : 0.8}. He will bring suit, or answer in kind.`,
            run: () => { up(c); owe(c, v); sour(c, -15); F().slain(c.state, c.p.farm, 'them'); c.honor(free ? 1.5 : 0.8, `You answered a killing by ${c.p.farm}`); return `A man of ${c.p.farm} was found on the road two nights later. Nobody saw who did it, and nobody needed to.`; } },
          { id: 'ignore', label: 'Let it lie', desc: 'Honor −2.5. A killing unanswered is an invitation.',
            run: () => { c.honor(-2.5, `You let ${c.p.victim}'s killing pass`); if (c.rng.chance(0.5)) up(c); return `${c.p.victim} was buried. People noticed that nothing else was done.`; } },
        ];
      } },

    { id: 'feud_kin', w: 0, needs: () => null,
      title: (c) => `${c.p.victim} is killed`,
      body: (c) => [c.p.how === 'skirmish' ? `${c.p.victim}, ${c.p.relation === 'servant' ? 'a free man of your house' : 'your ' + c.p.relation}, was killed in the fight with ${c.p.head}'s men. Both sides will say the other struck first. Either way he is dead, and the district is watching to see whether your family demands a price, a verdict, or blood.` : `${c.p.victim}, ${c.p.relation === 'servant' ? 'a free man of your house' : 'your ' + c.p.relation}, was killed by men of ${c.p.farm}. ${c.p.head} led them himself. His body was left where it fell, and the whole district knows what the law and honor now demand of you.`],
      options: (c) => {
        const v = c.p.value, L = F().lawChance(c.state, c.p.farm, 0.22), arb = Math.min(0.75, 0.55 + c.head.attrs.honor / 400);
        const away = !!c.state.expedition;
        const odds = F().fightOdds(c.state, F().edge(c.state, c.p.farm));
        const opts = [
          { id: 'prosecute', label: 'Prosecute for outlawry at the Althing', cost: 60, desc: `${ells(60)}. ${cap(word(L))}. A win pays about ${ells(v)}, makes ${c.p.head} an outlaw, and ends the feud on your terms. Honor +3.`,
            run: () => { c.pay(60); sour(c, -10); if (c.rng.chance(L)) { c.earn(v); c.honor(3, `${c.p.head} was outlawed for killing ${c.p.victim}`); F().end(c.state, c.p.farm); return `The court declared ${c.p.head} an outlaw. He took ship before the summer was out, and ${c.p.farm} will not trouble you again soon.`; } c.honor(-3, `You lost the case for ${c.p.victim}`); return `Your witnesses were shaken and the case failed on a point of procedure. It is hard to be told that the law was right.`; } },
          { id: 'settle', label: 'Accept blood-money after arbitration', cost: 30, desc: `${ells(30)}. ${cap(word(arb))}. About ${ells(v * 0.8)} and a handshake. Honor −0.5, but the worst of it ends.`,
            run: () => { c.pay(30); if (c.rng.chance(arb)) { c.earn(v * 0.8); c.honor(-0.5, `Blood-money for ${c.p.victim}`); sour(c, 5); down(c, 2); return `The arbiters set a price, and ${c.p.head} paid it and gave his hand on it. The district called it a good peace, and said it quietly.`; } c.honor(-1, `${c.p.farm}'s insulting offer`); sour(c, -5); return `${c.p.head} offered the price of a thrall. You sent his man away.`; } },
        ];
        if (!away) opts.push({ id: 'avenge', label: 'Take men and avenge him', desc: `${cap(word(odds))}. Honor +3 if it goes well. It will not end here.`,
          run: () => {
            owe(c, v); sour(c, -20);
            if (c.rng.chance(odds)) { c.honor(3, `You avenged ${c.p.victim}`); F().slain(c.state, c.p.farm, 'them'); if (c.rng.chance(0.5)) up(c); return `You found ${c.p.head}'s brother in a hay-barn. The killing was done before anyone could shout. You rode home, and nobody ate that night.`; }
            c.honor(-1.5, `Your revenge on ${c.p.farm} went wrong`); wound(c); up(c);
            const m = F().men(c.state); let extra = '';
            if (m.length && c.rng.chance(0.5)) { const x = c.rng.pick(m); c.kill(x, `died in a failed revenge on ${c.p.farm}`, 'killed in a feud'); F().slain(c.state, c.p.farm, 'you'); extra = ` ${x.first} did not come back.`; }
            return `They were ready, and more than you were.${extra}`;
          } });
        opts.push({ id: 'swallow', label: 'Swallow it', desc: 'Honor −5. The shame will follow the house.',
          run: () => { c.honor(-5, `${c.p.victim}'s killing went unanswered`); if (c.rng.chance(0.4)) up(c); return `${c.p.victim} was buried with little said. Every man who sat at your table afterward knew.`; } });
        return opts;
      } },

    { id: 'feud_burning', w: 0, needs: () => null,
      title: (c) => `${c.p.farm} comes to burn you out`,
      body: (c) => [`They came at night, ${c.p.force} men by your shepherd's count, and ${c.p.head} led them. They have torches. The farm is ringed, and he has called out for you by name. This is what the quarrel was always going to come to.`],
      options: (c) => {
        const away = !!c.state.expedition, f = c.p.force, bonus = -(f - 12) / 100 + F().edge(c.state, c.p.farm);
        const odds = F().fightOdds(c.state, bonus), oddsW = F().fightOdds(c.state, bonus - 0.1);
        const tribute = 300 + 100 * c.tier;
        const burn = (spareWomen, headHere) => {
          const fm = c.state.farm, hh = c.state.household, dead = [];
          fm.condition = Math.max(0, fm.condition - 40); fm.hay *= 0.5; fm.provisions *= 0.5; fm.wool *= 0.4;
          const all = [...hh.wives, ...(hh.concubines || []), ...hh.children, ...hh.kin, ...hh.servants, ...hh.thralls].map((id) => c.state.people[id]).filter((p) => p && p.deathYear == null);
          for (const p of all) {
            const adultM = p.sex === 'M' && c.age(p) >= 16 && p.kind !== 'thrall';
            const pr = adultM ? 0.45 : spareWomen && p.kind !== 'thrall' ? 0 : 0.15;
            if (c.rng.chance(pr)) { c.kill(p, `burned in the attack by ${c.p.farm}`, 'burned in a feud'); dead.push(p.first); if (adultM) F().slain(c.state, c.p.farm, 'you'); }
          }
          if (headHere && c.rng.chance(0.3)) { c.kill(c.head, `burned in the attack by ${c.p.farm}`, 'burned in his house'); dead.push(c.head.first); }
          c.state.married = c.state.household.wives.length > 0;
          return dead;
        };
        const aftermath = (dead) => (dead.length ? ` The dead: ${dead.join(', ')}.` : ' All came out alive, which is more than anyone expected.');
        return [
          { id: 'fight', label: 'Hold the house and fight', desc: `${cap(word(odds))}. A win brings Honor +6. A loss means the house burns, with its people.`,
            run: () => {
              owe(c, 400);
              if (c.rng.chance(odds)) { c.honor(6, `You held your house against ${c.p.farm}`); sour(c, -10); F().escalate(c.state, c.p.farm, -2); F().slain(c.state, c.p.farm, 'them', 2); const m = F().men(c.state); let x = ''; if (m.length && c.rng.chance(0.3)) { const v = c.rng.pick(m); c.kill(v, `fell defending the house against ${c.p.farm}`, 'killed in a feud'); F().slain(c.state, c.p.farm, 'you'); x = ` ${v.first} fell at the door.`; } return `You held the door until the grey light, and ${c.p.head}'s men gave way. They left two dead in the yard.${x} People will tell this one.`; }
              c.honor(-3, `${c.p.farm} burned your house`); return `The roof caught. You fought from the gable until the smoke drove you out.${aftermath(burn(false, !away))}`;
            } },
          { id: 'women', label: 'Ask for the women and children to be let out, then hold the house', desc: `${cap(word(oddsW))}. Honor +4 if you hold. The women and children are spared whatever happens.`,
            run: () => {
              owe(c, 400);
              if (c.rng.chance(oddsW)) { c.honor(4, `You held your house against ${c.p.farm}`); sour(c, -10); F().escalate(c.state, c.p.farm, -2); return `${c.p.head} let the women walk out through the line, which he had not planned to do. Then your men held the door until he gave up the night.`; }
              c.honor(-2, `${c.p.farm} burned your house`); return `The women and children were let out. The rest of you were not.${aftermath(burn(true, !away))}`;
            } },
          { id: 'flee', label: 'Slip away in the dark and leave the buildings', desc: 'Honor −5. Nobody dies, but the house and its stores are mostly lost.',
            run: () => { const fm = c.state.farm; fm.condition = Math.max(0, fm.condition - 25); fm.hay *= 0.7; fm.provisions *= 0.7; c.honor(-5, 'You left your house to be burned'); F().escalate(c.state, c.p.farm, -1); return `You got everyone out through the back of the byre. From the hill you watched the roof go. People will say you ran. They will also say nobody died.`; } },
          { id: 'tribute', label: 'Offer everything to buy peace', cost: tribute, desc: `${ells(tribute)}. Honor −3. The feud falls back to bad blood.`,
            run: () => { c.pay(tribute); c.honor(-3, `You bought peace from ${c.p.farm}`); sour(c, 10); F().escalate(c.state, c.p.farm, -3); return `${c.p.head} took the silver and went home, with the look of a man who had won something.`; } },
        ];
      } },

    { id: 'feud_summons', w: 0, needs: () => null,
      title: (c) => `${c.p.head} summons you to the Thing`,
      body: (c) => [`${c.p.head} of ${c.p.farm} has taken the matter to law. He says you owe him about ${ells(c.p.owed)} for what your people did, and he has had the summons read at your door in front of witnesses.`],
      options: (c) => {
        const o = c.p.owed, L = Math.min(0.85, 0.4 + c.head.attrs.law / 220 + c.head.attrs.honor / 500);
        return [
          { id: 'pay', label: 'Pay what is asked', cost: Math.round(o), desc: `${ells(o)}. Honor −0.5. The matter is closed and the bad blood eases.`,
            run: () => { c.pay(o); const f = F().get(c.state, c.p.farm); if (f) f.owedThem = 0; sour(c, 8); down(c); c.honor(-0.5, `You paid ${c.p.farm}`); return `You counted it out in front of the court. ${c.p.head} looked a little disappointed.`; } },
          { id: 'defend', label: 'Defend the case at the Thing', cost: 40, desc: `${ells(40)}. ${cap(word(L))}. Lose and you pay half again.`,
            run: () => {
              c.pay(40); const f = F().get(c.state, c.p.farm);
              if (c.rng.chance(L)) { if (f) f.owedThem = 0; c.honor(1.5, `You defeated a suit by ${c.p.farm}`); sour(c, -5); return `Your pleading was sound and the court threw the case out. ${c.p.head} left in a temper.`; }
              const pay = o * 1.5; c.pay(pay); if (f) f.owedThem = 0; c.honor(-2, `You lost a suit to ${c.p.farm}`); return `The court found against you and set the price at ${ells(pay)}. You paid it.`;
            } },
          { id: 'defy', label: 'Refuse to answer', desc: 'Honor −1.5. He will press the matter harder.',
            run: () => { const f = F().get(c.state, c.p.farm); if (f) f.owedThem = Math.round(f.owedThem * 0.5); up(c); sour(c, -10); c.honor(-1.5, `You defied a summons from ${c.p.farm}`); return `You did not go. ${c.p.head} was heard at the Thing, and the court was sympathetic.`; } },
        ];
      } },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
