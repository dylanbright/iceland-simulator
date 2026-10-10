/* Trouble that costs something whichever way you answer: thieves, sickness, accidents, old debts called in,
 * a chieftain's demands, lawsuits, a brother who wants his share, hungry neighbors.
 * Every branch has a price. There is no free, obviously right answer, only the one you can afford to live with.
 * Same shape as the other events (see events.js); they join Events.DEFS. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const live = (c, key) => c.state.household[key].filter((id) => c.state.people[id] && c.state.people[id].deathYear == null);
  const pct = (p) => (p >= 0.8 ? 'good odds' : p >= 0.6 ? 'fair odds' : p >= 0.4 ? 'poor odds' : 'long odds');
  const wound = (c, p) => { const n = c.rng.int(4, 12); p.attrs.strength = Math.max(5, Math.round(p.attrs.strength - n)); return n; };
  const everyone = (c) => ['wives', 'children', 'kin', 'servants', 'thralls'].flatMap((k) => live(c, k)).map((id) => c.state.people[id]);
  const open = (c, types) => (c.state.hooks || []).filter((h) => types.includes(h.type) && h.status === 'open' && h.farm && c.state.families[h.farm] && h.amount > 0);
  const tick = (h, turn) => { h.lastCalled = turn; };
  const quiet = (h, turn) => h.lastCalled == null || turn - h.lastCalled >= 8;
  const fixMarried = (c) => { c.state.married = c.state.household.wives.length > 0; };

  /** Sickness: how likely each person in the house is to die, by age and how the house chose to meet it. */
  const sickRisk = (c, p, mult) => {
    const a = c.age(p);
    const base = a < 5 ? 0.12 : a < 14 ? 0.05 : a > 60 ? 0.13 : a > 48 ? 0.06 : 0.035;
    return base * mult * (p.kind === 'thrall' ? 1.15 : 1);
  };

  const DEFS = [
    { id: 'thieves', w: 0.7,
      needs: (c) => (c.state.farm.sheep >= 15 ? { n: c.rng.int(5, 10) } : null),
      title: () => 'Sheep are going missing',
      body: (c) => [`Every morning there are fewer sheep on the hill than the night before. You have counted ${c.p.n} gone so far, and no wolf has been the cause, since Iceland has none. Somebody is taking them, and he knows your fold.`],
      options: (c) => {
        const str = c.head.attrs.strength, hunt = Math.min(0.75, 0.3 + str / 200);
        return [
          { id: 'watch', label: 'Set a night watch', cost: 18, desc: `${ells(18)} for the food and the lost sleep. ${pct(0.55)}: the thief may be caught, and the loss stops. Honor +0.8 if he is.`,
            run: () => { c.pay(18); if (c.rng.chance(0.55)) { c.honor(0.8, 'You caught a sheep thief'); return `On the third night your watchman caught a hungry man from the next valley. You made him pay in labor and let him go.`; } c.state.farm.sheep = Math.max(0, c.state.farm.sheep - Math.ceil(c.p.n / 2)); return `The watch saw nothing, and ${Math.ceil(c.p.n / 2)} more sheep went the following week.`; } },
          { id: 'hunt', label: 'Track them into the hills yourself', desc: `${pct(hunt)} by Strength. Honor +1.5 and the sheep back if you win; a wound and more losses if you do not.`,
            run: () => {
              if (c.rng.chance(hunt)) { c.honor(1.5, 'You ran down sheep thieves'); return `You found the camp in a gully. Three men, a fire, and your sheep. They did not fight, and you brought most of the flock home.`; }
              const n = wound(c, c.head); c.honor(-1, 'Sheep thieves got away from you'); c.state.farm.sheep = Math.max(0, c.state.farm.sheep - c.p.n);
              return `They knew the hills better than you, and one of them knew a knife. You came home ${n > 8 ? 'badly ' : ''}hurt and short ${c.p.n} sheep.`;
            } },
          { id: 'accept', label: 'Write it off', desc: `You lose about ${c.p.n} sheep. Honor −0.5.`,
            run: () => { c.state.farm.sheep = Math.max(0, c.state.farm.sheep - c.p.n); c.honor(-0.5, 'Sheep stolen from your fold'); return `${c.p.n} sheep gone, and everyone knows it.`; } },
        ];
      } },

    { id: 'epidemic', seasons: ['winter'], w: 0.55,
      needs: (c) => ({}),
      title: () => 'Sickness in the district',
      body: () => ['A coughing sickness has come up the valley from the coast. Two farms nearby have buried people already, and it is only a matter of time before it reaches your door. The old and the very young are afraid, and rightly.'],
      options: (c) => {
        const run = (mult, extra) => () => {
          if (extra) extra();
          const dead = [];
          for (const p of everyone(c)) if (c.rng.chance(sickRisk(c, p, mult))) { c.kill(p, 'died in the winter sickness', 'sickness'); dead.push(p.first); }
          fixMarried(c);
          if (!dead.length) return mult < 0.7 ? 'The sickness came to the farm and went again. Nobody died, and nobody quite believed it.' : 'People coughed for a fortnight and everyone lived.';
          return `The sickness took ${dead.join(', ')}.`;
        };
        return [
          { id: 'shut', label: 'Shut the farm to all visitors', desc: 'Honor −1.5: no guests, no help, and neighbors will say so. It cuts the risk a good deal.',
            run: run(0.4, () => { c.honor(-1.5, 'You shut your door in a sickness'); c.goodwill((c.neighbor() || {}).farm, -8); }) },
          { id: 'healer', label: 'Pay for a healer to stay', cost: 70, desc: `${ells(70)}. A woman who knows herbs and nursing will stay through the worst. It cuts the risk.`, run: run(0.6, () => c.pay(70)) },
          { id: 'carry', label: 'Carry on as usual', desc: 'No cost. The old and the small are at real risk.', run: run(1, null) },
        ];
      } },

    { id: 'illness', w: 0.7,
      needs: (c) => { const l = everyone(c).filter((p) => c.age(p) >= 14 && p.id !== c.state.headId); return l.length ? { id: c.rng.pick(l).id } : null; },
      title: (c) => `${c.state.people[c.p.id].first} is ill`,
      body: (c) => { const p = c.state.people[c.p.id]; return [`${p.first}, ${c.age(p)}, has taken to bed with a fever and a pain in the side. ${p.sex === 'M' ? 'He' : 'She'} is ${p.kind === 'thrall' ? 'a thrall of your house' : p.role === 'wife' ? 'your wife' : 'of your household'} and cannot work. The house will feel it either way.`]; },
      options: (c) => {
        const p = c.state.people[c.p.id];
        const run = (survive, cost) => () => {
          if (cost) c.pay(cost);
          if (c.rng.chance(survive)) { if (c.rng.chance(0.25)) { p.attrs.strength = Math.max(5, Math.round(p.attrs.strength - 6)); return `${p.first} lived, but never quite got back the strength.`; } return `${p.first} mended, slowly.`; }
          c.kill(p, 'died of a fever', 'sickness'); fixMarried(c); return `${p.first} died in the night.`;
        };
        return [
          { id: 'healer', label: 'Send for the healer', cost: 45, desc: `${ells(45)}. Much the better odds.`, run: run(0.9, 45) },
          { id: 'home', label: 'Nurse at home', desc: 'No cost. You lose a pair of hands for a season and it is a gamble.', run: () => { c.state.farm.condition = Math.max(0, c.state.farm.condition - 3); return run(0.7, 0)(); } },
        ];
      } },

    { id: 'accident', seasons: ['summer'], w: 0.65,
      needs: (c) => { const l = [...live(c, 'children'), ...live(c, 'kin'), ...live(c, 'servants')].map((id) => c.state.people[id]).filter((p) => p.sex === 'M' && c.age(p) >= 14 && c.age(p) <= 60); return l.length ? { id: c.rng.pick(l).id, what: c.rng.pick(['was kicked by a horse', 'fell from the hay-loft', 'was caught by a rockfall on the path to the shieling', 'went through the river ice-edge at the ford']) } : null; },
      title: (c) => `${c.state.people[c.p.id].first} is hurt`,
      body: (c) => { const p = c.state.people[c.p.id]; return [`${p.first}, ${c.age(p)}, ${c.p.what}. He is alive, broken, and in a great deal of pain, and the hay is not going to cut itself.`]; },
      options: (c) => {
        const p = c.state.people[c.p.id];
        const run = (survive, cost) => () => {
          if (cost) c.pay(cost);
          if (c.rng.chance(survive)) { const n = wound(c, p); return `${p.first} lived. He will not do heavy work this summer, and the injury cost him ${n} points of Strength.`; }
          c.kill(p, 'died of his injuries', 'accident'); return `${p.first} died of it, three days later.`;
        };
        return [
          { id: 'healer', label: 'Pay a bonesetter', cost: 40, desc: `${ells(40)}. A man who knows how to set bones. ${pct(0.85)}.`, run: run(0.85, 40) },
          { id: 'home', label: 'Splint it yourselves', desc: `No cost. ${pct(0.6)}. Infection is the worry.`, run: run(0.6, 0) },
        ];
      } },

    { id: 'debt_called', w: 0.7,
      needs: (c) => {
        if (c.state.turn < 4) return null;
        const h = open(c, ['debt', 'blood_money_owed']).filter((x) => quiet(x, c.state.turn));
        if (!h.length) return null; const pick = c.rng.pick(h); return { hook: pick.id, label: pick.label };
      },
      title: (c) => `${c.p.label} wants what is owed`,
      body: (c) => { const h = c.state.hooks.find((x) => x.id === c.p.hook); return [h.type === 'blood_money_owed' ? `${h.label} has sent a man to say that the blood-money your family has owed for years is now due: ${ells(h.amount)}. He says it with the patience of a man who has a long memory and several sons.` : `${h.label} has come in person about the old debt of ${ells(h.amount)}. He is polite about it, and that is more worrying than if he were not.`]; },
      options: (c) => {
        const h = c.state.hooks.find((x) => x.id === c.p.hook), a = h.amount;
        const f = h.farm;
        return [
          { id: 'pay', label: 'Pay it in full', cost: a, desc: `${ells(a)}. The matter is closed. Honor +0.5.`,
            run: () => { c.pay(a); c.honor(0.5, `You paid an old debt to ${f}`); c.goodwill(f, 15); c.state.hooks = c.state.hooks.filter((x) => x.id !== h.id); return `${a > 400 ? 'It took most of what you had, but ' : ''}you counted it out and the debt is gone. ${f} left on friendly terms.`; } },
          { id: 'part', label: 'Pay half now and the rest later', cost: Math.round(a / 2), desc: `${ells(a / 2)} now. The rest remains. He will not forget the delay.`,
            run: () => { c.pay(a / 2); h.amount = Math.round(a / 2); tick(h, c.state.turn); c.goodwill(f, -6); c.honor(-0.3, `You paid an old debt in part`); return `He took it and said he would be back for the rest. He did not say when.`; } },
          { id: 'refuse', label: 'Tell him he will wait', desc: 'No cost. Honor −2, and the house will be sour with you.',
            run: () => { tick(h, c.state.turn); c.goodwill(f, -25); c.honor(-2, `You refused to pay ${f}`); if (c.rng.chance(0.4)) c.feud(f, 'a debt you would not pay'); return `He looked at you a long moment, then went out to his horse. It was not the end of it.`; } },
        ];
      } },

    { id: 'debt_owed_you', w: 0.5,
      needs: (c) => {
        if (c.state.turn < 4) return null;
        const h = open(c, ['blood_money_due']).filter((x) => quiet(x, c.state.turn));
        if (!h.length) return null; const pick = c.rng.pick(h); return { hook: pick.id, label: pick.label };
      },
      title: (c) => `${c.p.label} still owes you`,
      body: (c) => { const h = c.state.hooks.find((x) => x.id === c.p.hook); return [`${h.label} still owes your family ${ells(h.amount)} in blood-money, and the years have not made him more eager to pay it. Your kin are beginning to ask why you let it lie.`]; },
      options: (c) => {
        const h = c.state.hooks.find((x) => x.id === c.p.hook), f = h.farm;
        const L = Math.min(0.8, 0.3 + c.head.attrs.law / 220 + c.head.attrs.honor / 500);
        return [
          { id: 'sue', label: 'Take it to the Thing', cost: 45, desc: `${ells(45)}. ${pct(L)} at law. A win pays about ${ells(h.amount * 0.7)}. A loss is public.`,
            run: () => { c.pay(45); tick(h, c.state.turn); c.goodwill(f, -8); if (c.rng.chance(L)) { c.earn(h.amount * 0.7); c.honor(1, `You won old blood-money from ${f}`); c.state.hooks = c.state.hooks.filter((x) => x.id !== h.id); return `The court ordered it paid. ${f} did not come to the Thing the next year.`; } c.honor(-1, `You lost an old case against ${f}`); return `The court found the debt too old, or too uncertain. You paid the fee for the privilege of being told.`; } },
          { id: 'press', label: 'Send men to demand it', desc: 'No cost. It either works or starts a quarrel. Honor +0.5 if it works.',
            run: () => { tick(h, c.state.turn); c.goodwill(f, -15); if (c.rng.chance(0.4)) { c.earn(h.amount * 0.5); c.honor(0.5, `You collected from ${f}`); c.state.hooks = c.state.hooks.filter((x) => x.id !== h.id); return `${f} paid half, to make the visit end. Your men came home with it.`; } c.feud(f, 'blood-money your men demanded'); return `${f}'s men met yours at the gate. Words, then more than words. The debt is no nearer paid.`; } },
          { id: 'forgive', label: 'Forgive it', desc: `You give up ${ells(h.amount)}. Honor +1, and a friend.`,
            run: () => { c.honor(1, `You forgave ${f}`); c.goodwill(f, 20); c.state.hooks = c.state.hooks.filter((x) => x.id !== h.id); return `${f} was surprised, and then grateful, and then a little ashamed. That is worth something.`; } },
        ];
      } },

    { id: 'brother_share', w: 0.55,
      needs: (c) => {
        const l = live(c, 'kin').map((id) => c.state.people[id]).filter((p) => p.role === 'brother' && c.age(p) >= 18 && p.sex === 'M');
        return l.length ? { id: c.rng.pick(l).id } : null;
      },
      title: (c) => `${c.state.people[c.p.id].first} wants his share`,
      body: (c) => { const p = c.state.people[c.p.id]; return [`${p.first}, your brother, is ${c.age(p)} and tired of being a man in his brother's house. He says it is time he had his own farm, or at least his own portion of what your father left. He is not shouting, which is how you know he has been thinking about it.`]; },
      options: (c) => {
        const p = c.state.people[c.p.id], silver = 150 + 60 * c.tier, land = 100 + 40 * c.tier;
        return [
          { id: 'pay', label: 'Buy him out and send him off', cost: silver, desc: `${ells(silver)}. He leaves on good terms with enough to start. Honor +0.5, and one hand fewer.`,
            run: () => { c.pay(silver); c.honor(0.5, 'You gave your brother his share'); c.removePerson(p.id); return `${p.first} took the silver and a horse and went east. He sent word the next summer that he had a farm.`; } },
          { id: 'land', label: 'Give him part of the hayfield to work', desc: `You lose about ${ells(land)} of land. He stays, and works it for himself. Honor +0.8.`,
            run: () => { c.state.farm.landValue = Math.max(0, c.state.farm.landValue - land); c.honor(0.8, 'You gave your brother land'); return `${p.first} walked the new line with you. It is less land than you had, and a better brother than you had.`; } },
          { id: 'refuse', label: 'Tell him to wait', desc: 'No cost. He may leave anyway, with bad feeling. Honor −1.',
            run: () => { c.honor(-1, 'You put off your brother\'s claim'); if (c.rng.chance(0.55)) { c.removePerson(p.id); c.state.hooks = c.state.hooks || []; c.state.hooks.push({ id: 'b' + p.id, type: 'kin_estranged', status: 'open', text: `Your brother ${p.first} left your house in anger, with nothing.` }); return `${p.first} left before the next morning, with his sword and nothing else. People noticed.`; } return `${p.first} said no more. He is still there, and he does not forget.`; } },
        ];
      } },

    { id: 'godi_demand', w: 0.55,
      needs: (c) => { const g = Object.values(c.state.families || {}).find((f) => f.goði && f.head && f.farm !== c.state.farm.name) || c.neighbor(); return g ? { farm: g.farm, head: (g.head && g.head.first) || 'The chieftain' } : null; },
      title: (c) => `${c.p.head} calls on his Thingmen`,
      body: (c) => [`${c.p.head} of ${c.p.farm} is going to the Thing with a case and wants a show of strength. Every man who owes him loyalty is expected to bring men, or pay for those who do not. You are known to be a Thingman of his, or near enough.`],
      options: (c) => {
        const gift = 55 + 20 * c.tier;
        return [
          { id: 'men', label: 'Send your men', desc: 'Honor +0.5. It costs a season\'s labor, and a man may be hurt in the crowd.',
            run: () => { c.honor(0.5, `You backed ${c.p.farm} at the Thing`); c.goodwill(c.p.farm, 12); c.state.farm.condition = Math.max(0, c.state.farm.condition - 5); const l = [...live(c, 'kin'), ...live(c, 'servants')].map((id) => c.state.people[id]).filter((p) => p.sex === 'M' && c.age(p) >= 16); if (l.length && c.rng.chance(0.2)) { const x = c.rng.pick(l); wound(c, x); return `Your men stood with him, and ${x.first} came home with a broken head. The farm limped through the week.`; } return 'Your men stood with him and the case went his way. The farm limped through the week short-handed.'; } },
          { id: 'gift', label: 'Send a gift in their place', cost: gift, desc: `${ells(gift)}. He will accept it, and note that you sent silver rather than men.`,
            run: () => { c.pay(gift); c.goodwill(c.p.farm, 3); return `${c.p.head} accepted the gift with a smile that stopped short of his eyes.`; } },
          { id: 'refuse', label: 'Tell him you have your own work', desc: 'No cost. A chieftain remembers who stood with him. Honor −1.',
            run: () => { c.honor(-1, `You refused ${c.p.farm}'s call`); c.goodwill(c.p.farm, -22); if (c.rng.chance(0.3)) c.feud(c.p.farm, 'a call to arms you refused'); return `${c.p.head}'s man did not argue. He wrote your name on a list, in his head.`; } },
        ];
      } },

    { id: 'neighbor_suit', w: 0.6,
      needs: (c) => c.neighbor(),
      title: (c) => `${c.p.head} brings a suit`,
      body: (c) => [`${c.p.head} of ${c.p.farm} has summoned you to the Thing over grazing: he says your sheep have been eating his summer pasture for three years. It is half true, and the half that is true is the half that matters.`],
      options: (c) => {
        const pay = 55 + 20 * c.tier, L = Math.min(0.8, 0.3 + c.head.attrs.law / 220 + c.head.attrs.honor / 500);
        return [
          { id: 'pay', label: 'Pay him and be done', cost: pay, desc: `${ells(pay)}. Honor −0.3. It is over, and he is a little friendlier.`,
            run: () => { c.pay(pay); c.honor(-0.3, `You paid ${c.p.farm} for grazing`); c.goodwill(c.p.farm, 6); return `${c.p.head} took the silver and the matter was dropped. He nodded at you the next time you met.`; } },
          { id: 'fight', label: 'Defend the case', cost: 35, desc: `${ells(35)} for the pleading. ${pct(L)}. Lose and you pay half again, and the Thing hears it.`,
            run: () => { c.pay(35); if (c.rng.chance(L)) { c.honor(1, `You defeated a suit by ${c.p.farm}`); c.goodwill(c.p.farm, -8); return `Your pleading held, and the court threw the case out. ${c.p.head} left in a bad temper.`; } c.pay(pay * 1.5); c.honor(-1.5, `You lost a suit to ${c.p.farm}`); c.goodwill(c.p.farm, -4); return `The court found against you and set the price at ${ells(pay * 1.5)}.`; } },
          { id: 'ignore', label: 'Do not go', desc: 'No cost. Honor −1.5. A man who does not answer a summons is half-way to outlawry, and the neighbor knows it.',
            run: () => { c.honor(-1.5, `You ignored a summons from ${c.p.farm}`); c.goodwill(c.p.farm, -12); if (c.rng.chance(0.35)) c.feud(c.p.farm, 'a summons you ignored'); return `The Thing found for ${c.p.head} in your absence, and he has not stopped telling people.`; } },
        ];
      } },

    { id: 'hungry_neighbors', seasons: ['winter'], w: 0.6,
      needs: (c) => (c.state.farm.provisions >= 6 ? Object.assign({ rations: Math.min(12, Math.floor(c.state.farm.provisions * 0.4)) }, c.neighbor() || {}) : null),
      title: (c) => `${c.p.farm} is out of food`,
      body: (c) => [`${c.p.head}'s wife has come through the snow with two children and nothing in her basket. ${c.p.farm}'s stores are gone and the winter is not. She does not ask for charity: she asks what you will sell her.`],
      options: (c) => [
        { id: 'give', label: `Give her ${c.p.rations} rations`, desc: `You lose ${c.p.rations} rations from your own stores. Honor +1.2, and a friend for life.`,
          run: () => { c.state.farm.provisions = Math.max(0, c.state.farm.provisions - c.p.rations); c.honor(1.2, `You fed the hungry of ${c.p.farm}`); c.goodwill(c.p.farm, 14); return `She went home with the basket full and her eyes wet. ${c.p.head} has said what he thinks of you, at three farms.`; } },
        { id: 'sell', label: `Sell her ${c.p.rations} rations dear`, desc: `You lose ${c.p.rations} rations and gain about ${ells(c.p.rations * 38)}. They will remember the price.`,
          run: () => { c.state.farm.provisions = Math.max(0, c.state.farm.provisions - c.p.rations); c.earn(c.p.rations * 38); c.goodwill(c.p.farm, -8); c.honor(-0.4, 'You sold food dear in a hungry winter'); return `She paid it, with a face like stone. Nobody could say you were not fair, and nobody liked it.`; } },
        { id: 'refuse', label: 'Tell her you have none to spare', desc: 'No cost. Honor −1.5. A hungry house does not forget.',
          run: () => { c.honor(-1.5, `You turned away the hungry of ${c.p.farm}`); c.goodwill(c.p.farm, -20); return `She went away through the snow without speaking. The children did not look back.`; } },
      ] },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
