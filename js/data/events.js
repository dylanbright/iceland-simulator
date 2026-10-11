/* Events that need an answer: travelers, neighbors, kin, servants, thralls, fevers, feuds.
 * Same shape as incidents (needs / title / body / options), but they do not belong to a wife.
 * Each season has a good chance of one. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});

  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const live = (c, key) => c.state.household[key].filter((id) => c.state.people[id] && c.state.people[id].deathYear == null);
  const tons = (x) => (Math.round(x * 10) / 10);

  const DEFS = [
    { id: 'traveler', w: 1.4,
      needs: (c) => ({ who: c.rng.pick(['a trader on his way to the coast', 'a poor skald with a worn cloak', 'a farmer bound for the Thing', 'a man who will not say where he has come from', 'a woman traveling to her kin with two children']) }),
      title: () => 'A traveler at the door',
      body: (c) => [`${c.p.who[0].toUpperCase() + c.p.who.slice(1)} has come to your door as the light fails and asks for a meal and a place by the fire.`],
      options: (c) => [
        { id: 'feast', label: 'Give him the best you have', cost: 15 + 8 * c.tier, desc: `${ells(15 + 8 * c.tier)}. Honor +1.`,
          run: () => { c.pay(15 + 8 * c.tier); c.honor(1, 'A good table for a traveler'); return 'He ate well and told it at the next three farms he came to.'; } },
        { id: 'plain', label: 'Give him the plain fare', desc: 'No cost. No gain.',
          run: () => 'He ate, slept, and was gone before the milking.' },
        { id: 'turn', label: 'Send him on to the next farm', desc: 'Honor −1.5. Turning a guest from the door is remembered.',
          run: () => { c.honor(-1.5, 'You turned a traveler from your door'); return 'He went on into the dark. People will say you did that.'; } },
      ] },

    { id: 'borrow_hay', seasons: ['winter'], w: 1.2,
      needs: (c) => { const n = c.neighbor(); const amt = tons(Math.min(6, c.state.farm.hay * 0.12)); return n && amt >= 2 ? Object.assign(n, { amount: amt }) : null; },
      title: (c) => `${c.p.head} asks for hay`,
      body: (c) => [`${c.p.head} of ${c.p.farm} has come with a sledge. His barn is running low and he asks you to spare ${c.p.amount} tons of hay.`],
      options: (c) => [
        { id: 'lend', label: 'Lend it freely', desc: `You lose ${c.p.amount} tons. Honor +0.6, and ${c.p.farm} will remember it.`,
          run: () => { c.state.farm.hay = Math.max(0, c.state.farm.hay - c.p.amount); c.goodwill(c.p.farm, 8); c.honor(0.6, `Hay lent to ${c.p.farm}`); return `${c.p.head} left with the hay and his thanks.`; } },
        { id: 'sell', label: 'Sell it to him at a fair price', desc: `You lose ${c.p.amount} tons and gain ${ells(c.p.amount * 14)}.`,
          run: () => { c.state.farm.hay = Math.max(0, c.state.farm.hay - c.p.amount); c.earn(c.p.amount * 14); c.goodwill(c.p.farm, 2); return `${c.p.head} paid, and did not look pleased about it.`; } },
        { id: 'refuse', label: 'Tell him you need it yourself', desc: `No cost. ${c.p.farm} will think less of you.`,
          run: () => { c.goodwill(c.p.farm, -6); c.honor(-0.3, `Hay refused to ${c.p.farm}`); return `${c.p.head} went away without a word.`; } },
      ] },

    { id: 'stray_sheep', seasons: ['summer'], w: 1,
      needs: (c) => c.neighbor(),
      title: () => 'Strange sheep in your field',
      body: (c) => [`Four of ${c.p.farm}'s sheep have strayed into your home field. They carry ${c.p.head}'s mark, but nobody knows they are here except your shepherd.`],
      options: (c) => [
        { id: 'return', label: `Drive them back to ${c.p.farm}`, desc: 'Honor +0.4. Goodwill with the neighbor.',
          run: () => { c.goodwill(c.p.farm, 5); c.honor(0.4, `You returned ${c.p.farm}'s sheep`); return `${c.p.head} thanked you and said so at the next feast.`; } },
        { id: 'keep', label: 'Say nothing and keep them', desc: 'Four sheep. If it comes out, a feud begins.',
          run: () => {
            c.state.farm.sheep += 4;
            if (c.rng.chance(0.35)) { c.honor(-2.5, `Sheep of ${c.p.farm} found in your flock`); c.goodwill(c.p.farm, -20); c.feud(c.p.farm, 'sheep that strayed and were kept'); return 'The sheep were seen by a passing boy, and now everyone knows.'; }
            return 'Nobody asked, and you did not say.';
          } },
      ] },

    { id: 'boundary', w: 0.55,
      needs: (c) => c.neighbor(),
      title: (c) => `${c.p.farm} claims your land`,
      body: (c) => [`${c.p.head} of ${c.p.farm} says the stream is the boundary of his land, not the stone you have always gone by. The strip in question is a good piece of meadow.`],
      options: (c) => [
        { id: 'yield', label: 'Give him the strip', desc: 'You lose some land. Honor −1.5.',
          run: () => { c.state.farm.landValue = Math.max(0, c.state.farm.landValue - 80); c.goodwill(c.p.farm, 4); c.honor(-1.5, `You gave up land to ${c.p.farm}`); return 'The strip is his. People say it was the easy way.'; } },
        { id: 'firm', label: 'Stand firm', desc: 'Honor +1 if he backs down; −1.5 if it comes to a fight you lose. Goodwill falls.',
          run: () => {
            c.goodwill(c.p.farm, -10);
            if (c.rng.chance(0.45 + c.head.attrs.honor / 250)) { c.honor(1, `You held your boundary against ${c.p.farm}`); return `${c.p.head} backed down. He will remember it.`; }
            c.honor(-1.5, `A boundary quarrel you lost`); c.feud(c.p.farm, 'a boundary quarrel'); return `${c.p.head} brought his men, and you gave way. The matter is not closed.`;
          } },
        { id: 'arbitrate', label: 'Ask neighbors to judge it', cost: 30, desc: `${ells(30)} for the feast. Honor +0.5.`,
          run: () => { c.pay(30); c.goodwill(c.p.farm, 2); c.honor(0.5, 'A boundary settled by arbitration'); return 'The neighbors walked the line and ruled for the stone. Both sides accepted it, more or less.'; } },
      ] },

    { id: 'kin_asks', w: 1,
      needs: (c) => {
        const pool = live(c, 'kin').filter((id) => { const p = c.state.people[id]; return ['brother', 'sister'].includes(p.role) && c.age(p) >= 16; });
        return pool.length ? { kin: c.rng.pick(pool), amount: 40 + 15 * c.tier } : null;
      },
      title: (c) => `${c.state.people[c.p.kin].first} asks for silver`,
      body: (c) => { const p = c.state.people[c.p.kin]; return [`${p.first}, ${c.roleOf(p)}, has fallen into debt and asks you for ${ells(c.p.amount)}. ${p.sex === 'M' ? 'He' : 'She'} says it is a family matter.`]; },
      options: (c) => [
        { id: 'give', label: 'Give it', cost: c.p.amount, desc: `${ells(c.p.amount)}. Honor +1.`,
          run: () => { c.pay(c.p.amount); c.honor(1, 'You stood by your own kin'); return 'The debt was paid, and people said you did right by your own.'; } },
        { id: 'part', label: 'Give half', cost: Math.round(c.p.amount / 2), desc: `${ells(c.p.amount / 2)}. Honor +0.2.`,
          run: () => { c.pay(c.p.amount / 2); c.honor(0.2, 'Half-help to kin'); return 'It was not enough, but it was something.'; } },
        { id: 'refuse', label: 'Refuse', desc: 'No cost. Honor −0.8.',
          run: () => { c.honor(-0.8, 'You turned your kin away'); return 'You said the farm could not carry it. It was probably true.'; } },
      ] },

    { id: 'thrall_trouble', w: 1,
      needs: (c) => { const ids = live(c, 'thralls'); return ids.length ? { id: c.rng.pick(ids) } : null; },
      title: (c) => `${c.state.people[c.p.id].first} has been stealing`,
      body: (c) => { const t = c.state.people[c.p.id]; return [`${t.first}, one of your thralls, has been taking food from the store and hiding it. ${t.attrs.resentment > 60 ? 'He is bitter, and it shows.' : 'Hunger, or habit, or spite.'}`]; },
      options: (c) => {
        const t = c.state.people[c.p.id];
        return [
          { id: 'flog', label: 'Flog him before the others', desc: 'He will behave, and he will hate you for it.',
            run: () => { t.attrs.resentment = Math.min(100, (t.attrs.resentment || 35) + 12); return `${t.first} took it in silence. The others kept their eyes down.`; } },
          { id: 'forgive', label: 'Give a warning and an extra ration', desc: 'He will resent you less.',
            run: () => { t.attrs.resentment = Math.max(1, (t.attrs.resentment || 35) - 8); return `${t.first} did not expect it. He has not stolen since.`; } },
          { id: 'sell', label: 'Sell him', desc: `You gain about ${ells(70)} and lose a pair of hands.`,
            run: () => { c.earn(70); c.removePerson(t.id); return `${t.first} was sold at the next market.`; } },
        ];
      } },

    { id: 'servant_wages', w: 0.9,
      needs: (c) => { const ids = live(c, 'servants'); return ids.length ? { id: c.rng.pick(ids) } : null; },
      title: (c) => `${c.state.people[c.p.id].first} wants more`,
      body: (c) => { const s = c.state.people[c.p.id]; return [`${s.first}, who works for you, says another farm has offered better terms and asks for a bonus to stay.`]; },
      options: (c) => {
        const s = c.state.people[c.p.id];
        return [
          { id: 'pay', label: 'Pay the bonus', cost: 25, desc: `${ells(25)}. ${s.first} stays.`, run: () => { c.pay(25); return `${s.first} took it and stayed, at least for now.`; } },
          { id: 'let', label: 'Let him go', desc: 'You lose a worker.', run: () => { c.removePerson(s.id); return `${s.first} took ${s.sex === 'M' ? 'his' : 'her'} things and left.`; } },
        ];
      } },

    { id: 'wedding_invite', seasons: ['summer'], w: 1.1,
      needs: (c) => c.neighbor(),
      title: (c) => `A wedding at ${c.p.farm}`,
      body: (c) => [`${c.p.head} of ${c.p.farm} has invited your household to the wedding of his daughter. A day's ride each way, and a gift is expected.`],
      options: (c) => [
        { id: 'gift', label: 'Go with a proper gift', cost: 30 + 12 * c.tier, desc: `${ells(30 + 12 * c.tier)}. Honor +1.`,
          run: () => { c.pay(30 + 12 * c.tier); c.goodwill(c.p.farm, 5); c.honor(1, `A fine gift at ${c.p.farm}`); return 'You sat in a good seat and went home with a headache.'; } },
        { id: 'bare', label: 'Go with a small gift', desc: 'No cost. Honor −0.5.',
          run: () => { c.goodwill(c.p.farm, -2); c.honor(-0.5, `A small gift at ${c.p.farm}`); return 'Your gift was noticed, in the way small gifts are.'; } },
        { id: 'regrets', label: 'Send your regrets', desc: 'No cost. Honor −0.3.',
          run: () => { c.goodwill(c.p.farm, -3); c.honor(-0.3, `You missed a wedding at ${c.p.farm}`); return 'Hay needed making. They said they understood.'; } },
      ] },

    { id: 'feud_flare', w: 0, needs: () => null,
      title: (c) => `${c.p.farm} again`,
      body: (c) => [`The quarrel with ${c.p.farm} is not finished: ${c.p.why}. ${c.p.head}'s men were seen at the edge of your land, and they were not there for the view.`],
      options: (c) => {
        const cost = 70 + 25 * c.tier, F = IS.Feud;
        const odds = Math.min(0.8, 0.4 + c.head.attrs.strength / 300 + c.head.attrs.honor / 400);
        return [
          { id: 'pay', label: 'Offer a settlement', cost, desc: `${ells(cost)}. The bad blood cools. Honor −0.5.`,
            run: () => { c.pay(cost); c.goodwill(c.p.farm, 25); F.escalate(c.state, c.p.farm, -1); const f = F.get(c.state, c.p.farm); if (f && c.state.relations[c.p.farm] > F.HOSTILE) F.end(c.state, c.p.farm); c.honor(-0.5, `Peace bought with ${c.p.farm}`); return `${c.p.head} took the silver and the matter is closed, for now.`; } },
          { id: 'ride', label: 'Ride out to meet them', desc: 'Honor +2.5 if you prevail, −2.5 and damage if you do not. It also hardens them.',
            run: () => {
              if (c.rng.chance(odds)) { c.goodwill(c.p.farm, -8); c.honor(2.5, `You faced down ${c.p.farm}`); return `${c.p.head}'s men turned back. You will hear from him again.${F.theyFall(c.state, c.rng, c.p.farm, 0.25)}`; }
              c.honor(-2.5, `You were bested by ${c.p.farm}`); c.state.farm.condition = Math.max(0, c.state.farm.condition - 8); F.escalate(c.state, c.p.farm, 1); c.goodwill(c.p.farm, -5); return `They were more than you expected, and they left a shed burning.${F.bloodshed(c.state, c.rng, c, c.p.farm, c.p.head, 0.4)}`;
            } },
          { id: 'ignore', label: 'Pretend not to notice', desc: 'Honor −2. They will be bolder next time.', run: () => { c.honor(-2, `You ignored ${c.p.farm}'s threats`); F.escalate(c.state, c.p.farm, 1); return 'People said you were afraid. They were not entirely wrong.'; } },
        ];
      } },

    { id: 'child_fever', w: 0.7, winterBonus: 1.8,
      needs: (c) => {
        const kids = live(c, 'children').filter((id) => c.age(c.state.people[id]) < 12);
        return kids.length ? { id: c.rng.pick(kids) } : null;
      },
      title: (c) => `${c.state.people[c.p.id].first} is sick`,
      body: (c) => { const k = c.state.people[c.p.id]; return [`${k.first}, ${c.age(k)}, has a fever that will not break. ${k.sex === 'M' ? 'He' : 'She'} has not eaten in two days.`]; },
      options: (c) => {
        const k = c.state.people[c.p.id];
        const roll = (p, good, bad) => () => { if (c.rng.chance(p)) return good; return bad(); };
        const lose = () => { c.kill(k, 'died of a fever'); return `${k.first} died in the night.`; };
        return [
          { id: 'healer', label: 'Send for the healer', cost: 25, desc: `${ells(25)}. Much better odds.`, run: () => { c.pay(25); return roll(0.9, `${k.first} mended, slowly.`, lose)(); } },
          { id: 'home', label: 'Nurse at home', desc: 'No cost. Risky.', run: roll(0.7, `${k.first} mended, slowly.`, lose) },
        ];
      } },

    { id: 'outlaw', w: 0.4,
      needs: () => ({}),
      title: () => 'A man outlawed at the Thing',
      body: () => ['A man outlawed at the Thing this summer is at your door. He asks for food and a night in the barn. Anyone who helps an outlaw can be prosecuted for it.'],
      options: (c) => [
        { id: 'shelter', label: 'Hide him in the barn', desc: 'A risk. He may reward you.',
          run: () => {
            if (c.rng.chance(0.4)) { c.honor(-3, 'You sheltered an outlaw'); return 'A neighbor saw him leave. The talk is not kind.'; }
            c.earn(25); return 'He was gone by dawn and left a silver ring on the table.';
          } },
        { id: 'refuse', label: 'Turn him away', desc: 'Honor −0.3.', run: () => { c.honor(-0.3, 'An outlaw turned away'); return 'He went out into the cold without a word.'; } },
        { id: 'report', label: 'Report him to the district', desc: 'Honor +0.8.', run: () => { c.honor(0.8, 'You gave up an outlaw'); return 'The district was grateful, and the outlaw was not.'; } },
      ] },

    { id: 'raid_invite', seasons: ['summer'], w: 1.0,
      needs: (c) => {
        const n = c.neighbor(), deps = c.raid.deputies();
        if (!n || !deps.length || !c.raid.fit()) return null;
        const dest = c.rng.weighted([{ d: 'hebrides', w: 4 }, { d: 'ireland', w: 4 }, { d: 'england', w: 2 }], (x) => x.w).d;
        return Object.assign(n, { dest, deps: deps.slice(0, 3).map((d) => d.id) });
      },
      title: (c) => `${c.p.head} is raiding`,
      body: (c) => { const d = IS.Raid.DEST[c.p.dest]; return [`${c.p.head} of ${c.p.farm} is fitting out a ship for ${d.name} and wants strong men to row and fight. Shares of the plunder go to everyone who comes. The haymaking would have to be left to someone else.`]; },
      options: (c) => {
        const d = IS.Raid.DEST[c.p.dest], pct = Math.round(c.raid.estimate(c.p.dest) * 100);
        const fee = IS.Raid.SHARE_FEE;
        const join = c.p.deps.map((id) => {
          const dep = c.state.people[id];
          return { id: 'join-' + id, label: `Go, and leave ${dep.first} to run the farm`, cost: fee,
            desc: `${ells(fee)} for arms and gear. About ${pct} in 100 of not coming back, going by your strength. A share of the plunder, perhaps a captive or two. ${dep.first} (husbandry ${Math.round(dep.attrs.husbandry)}).`,
            run: () => {
              c.pay(fee); c.goodwill(c.p.farm, 5);
              const r = c.raid.run({ dest: c.p.dest, sponsor: false, deputyId: id });
              return `You sailed with ${c.p.head}. ` + r.lines.join(' ');
            } };
        });
        return [...join, { id: 'stay', label: 'Stay home', desc: `No risk. ${c.p.head} will think you soft.`,
          run: () => { c.goodwill(c.p.farm, -3); c.honor(-0.3, `You did not join ${c.p.head}'s raid`); return 'He sailed without you.'; } }];
      } },

    { id: 'kin_raid', seasons: ['summer'], w: 1.1,
      needs: (c) => {
        const pool = c.raid.raiders();
        if (!pool.length) return null;
        const m = c.rng.pick(pool);
        return { kin: m.id, dest: c.rng.weighted([{ d: 'hebrides', w: 4 }, { d: 'ireland', w: 4 }, { d: 'england', w: 2 }, { d: 'baltic', w: 1 }], (x) => x.w).d };
      },
      title: (c) => `${c.state.people[c.p.kin].first} wants to go raiding`,
      body: (c) => {
        const m = c.state.people[c.p.kin], d = IS.Raid.DEST[c.p.dest];
        const only = m.role === 'son' && c.state.household.children.filter((id) => c.state.people[id].sex === 'M' && c.state.people[id].deathYear == null).length === 1 && !c.state.household.kin.some((id) => c.state.people[id].role === 'brother');
        return [`${m.first}, ${c.roleOf(m)}, ${c.age(m)}, wants a place on a ship bound for ${d.name} this summer and asks your leave. He says he is tired of hay and wants a name of his own.`,
          ...(only ? ['He is your only son. If he does not return, you have no heir.'] : []),
          ...(m.attrs.strength >= 65 ? [`He is strong, and is known for it.`] : m.attrs.strength < 40 ? ['He is not strong, and everyone knows it.'] : [])];
      },
      options: (c) => {
        const m = c.state.people[c.p.kin];
        const pct = (o) => Math.round(c.raid.memberEstimate(m, c.p.dest, o) * 100);
        return [
          { id: 'go', label: 'Give him leave', desc: `No cost. About ${pct(false)} in 100 that he does not come back. Honor and a share of the plunder if he does.`,
            run: () => c.raid.runMember({ dest: c.p.dest, memberId: m.id, outfitted: false }).lines.join(' ') },
          { id: 'outfit', label: 'Give him leave and good gear', cost: 40, desc: `${ells(40)}. About ${pct(true)} in 100 of not returning, and a better share of the plunder.`,
            run: () => { c.pay(40); return c.raid.runMember({ dest: c.p.dest, memberId: m.id, outfitted: true }).lines.join(' '); } },
          { id: 'forbid', label: 'Forbid it', desc: 'No risk. He will stay, and may not be happy about it.',
            run: () => {
              if (m.role === 'servant') { c.removePerson(m.id); return `${m.first} said he would find a captain who would have him, and left the farm.`; }
              return `${m.first} stayed, with a look on his face you will remember.`;
            } },
        ];
      } },

    { id: 'heir_urged', w: 1.6,
      needs: (c) => {
        const age = c.age(c.head);
        const can = c.marriage.can();
        if (age < 17 || age > 58 || (c.state.heirNagUntil || 0) > c.state.turn || !c.marriage.needsHeir() || !(can.wife || can.concubine)) return null;
        return { none: c.state.household.wives.length === 0 };
      },
      title: () => 'Your kin speak of an heir',
      body: (c) => {
        const hh = c.state.household;
        const sons = hh.children.filter((id) => c.state.people[id].deathYear == null && c.state.people[id].sex === 'M').length;
        return [hh.wives.length
          ? `You have ${sons ? 'no legitimate son' : 'no son'}, and your wife is past the years for bearing one. Your kin and the neighbors have begun to say that the farm needs an heir.`
          : 'You have no wife and no son, and your kin have begun to say that the farm needs an heir. They have someone in mind.'];
      },
      options: (c) => {
        const can = c.marriage.can(), tier = c.tier;
        const wedding = IS.Economy.C.wedding(tier), cc = IS.Economy.C.concubine(tier);
        const opts = [];
        if (can.wife) opts.push({ id: 'wife', label: c.state.household.wives.length ? 'Court a second wife' : 'Court a wife', cost: wedding,
          desc: `${ells(wedding)} in gifts and feast. About ${Math.round(c.marriage.suit() * 100)} in 100 she accepts. A bride brings a dowry and legitimate children.${c.state.household.wives.length ? ' Your wife will not like it.' : ''}`,
          run: () => {
            c.pay(wedding);
            if (!c.rng.chance(c.marriage.suit())) { c.earn(wedding / 2); return 'Your suit was refused. Half of what you spent on gifts was lost.'; }
            const r = c.marriage.wife();
            return `You married ${IS.Names.fullName(r.wife)}, of ${r.kinFarm}. She brought ${Math.round(r.dowry).toLocaleString('en-US')} ells with her. ${r.lines.join(' ')}`;
          } });
        if (can.concubine) opts.push({ id: 'concubine', label: 'Take a concubine', cost: cc,
          desc: `${ells(cc)} in gifts to her family. No dowry, and her sons are heirs only if you have no legitimate son. ${c.state.household.wives.length ? 'Your wife will take it badly. Honor −0.4.' : ''}`,
          run: () => {
            c.pay(cc);
            const r = c.marriage.concubine();
            if (c.state.household.wives.length) c.honor(-0.4, 'A concubine in the house of a married man');
            return `${IS.Names.fullName(r.woman)} came to the house. ${r.lines.join(' ')}`;
          } });
        opts.push({ id: 'no', label: 'Tell them it is not their business', desc: 'No cost. Honor −0.3.', run: () => { c.state.heirNagUntil = c.state.turn + 8; c.honor(-0.3, 'You brushed off talk of an heir'); return 'They stopped asking in front of you.'; } });
        return opts;
      } },

    { id: 'whale', w: 0.35,
      needs: (c) => c.neighbor(),
      title: () => 'A whale on the shore',
      body: (c) => [`A whale has come ashore on the strand where your land meets ${c.p.farm}'s, and both farms have already sent men with knives. Whale meat is a season's worth of food and ${c.p.head} says the strand is his to the stream.`],
      options: (c) => {
        const val = 90 + 30 * c.tier;
        const L = Math.min(0.85, 0.35 + c.head.attrs.law / 220 + c.head.attrs.honor / 500);
        return [
          { id: 'claim', label: 'Take all of it', desc: `About ${ells(val)} of meat and blubber. ${c.p.farm} will not forget it.`,
            run: () => { c.earn(val); c.goodwill(c.p.farm, -14); c.honor(-0.4, `You took a whale ${c.p.farm} claimed`); return `Your people had it salted by nightfall. ${c.p.head} watched from the hill.`; } },
          { id: 'share', label: `Share it with ${c.p.farm}`, desc: `About ${ells(val / 2)}. Honor +0.4, and goodwill.`,
            run: () => { c.earn(val / 2); c.goodwill(c.p.farm, 8); c.honor(0.4, `A whale shared with ${c.p.farm}`); return `Both farms ate well and ${c.p.head} said so at the next gathering.`; } },
          { id: 'law', label: 'Have it judged at the Thing', cost: 25, desc: `${ells(25)}. Your Law decides. A win gives you all of it.`,
            run: () => { c.pay(25); c.goodwill(c.p.farm, -6); if (c.rng.chance(L)) { c.earn(val); c.honor(0.5, `A whale won at law against ${c.p.farm}`); return 'The court ruled the shore was yours. By then the meat had turned, but you were paid in full.'; } c.honor(-0.5, `You lost a whale case to ${c.p.farm}`); return `The court gave the whale to ${c.p.farm}. The whale had been dead for a month by then, so nobody got much.`; } },
        ];
      } },

    { id: 'thing_support', w: 0.4,
      needs: (c) => c.neighbor(),
      title: (c) => `${c.p.head} wants your support at the Thing`,
      body: (c) => [`${c.p.head} of ${c.p.farm} has a suit coming up and asks you to stand with him at the Thing, and to bring your men. A man who stands beside you is a man who remembers it.`],
      options: (c) => [
        { id: 'stand', label: 'Stand with him', cost: 20, desc: `${ells(20)} for the men's food. Honor +0.2, and ${c.p.farm} will remember it kindly.`,
          run: () => { c.pay(20); c.goodwill(c.p.farm, 12); c.honor(0.2, `You stood with ${c.p.farm} at the Thing`); return `You stood behind him in the circle and he won. He will say so.`; } },
        { id: 'stay', label: 'Say you are busy', desc: 'No cost. He will feel it.',
          run: () => { c.goodwill(c.p.farm, -5); return `He said he understood. People who say that do not.`; } },
        { id: 'oppose', label: 'Back his opponent instead', desc: 'Honor +0.3, but he will not forget it.',
          run: () => { c.goodwill(c.p.farm, -18); c.honor(0.3, `You backed the opponent of ${c.p.farm}`); return `${c.p.head} saw where you were standing, and said nothing.`; } },
      ] },

    { id: 'wool_bargain', seasons: ['winter'], w: 0.9,
      needs: () => ({}),
      title: () => 'A trader with cloth to spare',
      body: () => ['A trader returning from the coast has more raw wool than he can carry, and will let it go cheap.'],
      options: (c) => [
        { id: 'buy', label: 'Buy it', cost: 30, desc: `${ells(30)} for about 55 ells' worth of wool, to weave later.`, run: () => { c.pay(30); c.state.farm.wool += 55; return 'The wool is stacked by the loom.'; } },
        { id: 'pass', label: 'Pass', desc: 'No cost.', run: () => 'He found another buyer by dusk.' },
      ] },
  ];

  IS.Events = { DEFS, byId: (id) => DEFS.find((d) => d.id === id) };
})();
