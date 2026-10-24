/* The women of the house arrive and depart with ceremony: a wedding, a concubine brought home, a funeral.
 * Pushed by Household.drainNews ahead of anything else, so nothing assumes you already know. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const happy = (w, d) => { if (w && w.attrs) w.attrs.happiness = Math.max(0, Math.min(100, w.attrs.happiness + d)); };
  const marriageOf = (c, id) => (c.state.marriages || []).find((m) => m.wifeId === id) || null;
  const otherWives = (c, id) => c.state.household.wives.filter((x) => x !== id).map((x) => c.state.people[x]).filter((w) => w && w.deathYear == null);
  const note = (c, k, x, w) => IS.Saga && IS.Saga.note(c.state, k, x, w);

  const DEFS = [
    { id: 'house_wedding', w: 0, needs: () => null,
      title: (c) => `${c.wname} comes to ${c.state.farm.name}`,
      body: (c) => {
        const w = c.wife, m = marriageOf(c, w.id), first = otherWives(c, w.id)[0];
        const out = [`Your suit was accepted. ${IS.Names.fullName(w)}, ${c.age(w)}, of ${m ? m.kinFarm : 'a good family'}, rode in with her kinsmen and her dowry chest${m ? `: ${ells(m.dowry)} in cloth, silver and stock` : ''}. ${c.p.wordy ? 'Her father said it was your verses that decided him.' : 'Her father looked over the farm the way a man looks over a horse he has already bought.'}`];
        out.push(first ? `${first.first} met her at the door. Nobody in the yard breathed. ${(c.p.lines || []).join(' ')}` : `The household lined up in the yard to see what kind of mistress they are getting. She looked them over in return.`);
        return out;
      },
      options: (c) => {
        const w = c.wife, m = marriageOf(c, w.id), first = otherWives(c, w.id)[0];
        const feast = 50 + 30 * c.tier;
        const reveal = () => { const hid = w.traits.filter((t) => !w.knownTraits.includes(t)); if (hid.length && c.rng.chance(0.5)) c.reveal(c.rng.pick(hid)); };
        const opts = [
          { id: 'feast', label: 'Hold a great wedding feast', cost: feast, desc: `${ells(feast)}. Three days of ale. Honor +1.5, and she and her kin will remember it.`,
            run: () => { c.pay(feast); happy(w, 10); if (m) c.goodwill(m.kinFarm, 8); c.honor(1.5, `Your wedding feast for ${c.wname}`); reveal(); return `The feast went on for three days. Her brothers sang. By the end ${c.wname} was laughing at your jokes, which you chose to take as a good sign.`; } },
          { id: 'modest', label: 'A modest wedding', desc: 'Ale for the household and her kin, no more.', run: () => { happy(w, 2); reveal(); return `A short ceremony, a good meal, and then back to the haymaking. ${c.wname} noted the haymaking.`; } },
        ];
        if (first) {
          opts.push({ id: 'keys', label: `Give ${c.wname} the keys of the household`, desc: `She will run the house. ${first.first} will not forgive you for it soon.`,
            run: () => { happy(w, 12); happy(first, -15); w.keys = true; first.keys = false; note(c, 'marriage', `He gave the keys of the household to his new wife ${c.wname}, over ${first.first}.`, 1.5); return `You hung the keys on ${c.wname}'s belt in front of everyone. ${first.first} went to her room and shut the door.`; } });
          opts.push({ id: 'keep', label: `Leave the keys with ${first.first}`, desc: `${c.wname} is the second wife, and will know it.`,
            run: () => { happy(w, -6); happy(first, 5); return `${first.first} keeps the keys. ${c.wname} smiled at her very politely, and the household began placing bets.`; } });
        }
        return opts;
      } },

    { id: 'house_concubine', w: 0, needs: () => null,
      title: (c) => { const p = c.state.people[c.p.wid]; return `${p ? p.first : 'A woman'} comes into the house`; },
      body: (c) => {
        const p = c.state.people[c.p.wid], wives = c.state.household.wives.map((x) => c.state.people[x]).filter(Boolean);
        return [`${p ? p.first : 'She'} came with a bundle of clothes and one of her brothers, who looked at the floor the whole time. She is not your wife, and everyone knows exactly what she is.`,
          wives.length ? `${wives.map((w) => w.first).join(' and ')} ${wives.length > 1 ? 'have' : 'has'} heard. ${(c.p.lines || []).join(' ')}` : 'There is no wife in the house to object, which is not the same as nobody objecting.'];
      },
      options: (c) => {
        const wives = c.state.household.wives.map((x) => c.state.people[x]).filter(Boolean), cost = 30 + 15 * c.tier;
        const opts = [
          { id: 'house', label: 'Build her a small house of her own', cost, desc: `${ells(cost)}. Out of the wife's sight, if not out of her mind.`, run: () => { c.pay(cost); wives.forEach((w) => happy(w, 4)); return 'You put up a small turf house past the byre. It helped a little.'; } },
          { id: 'hall', label: 'She lives in the hall with everyone', desc: wives.length ? 'Cheaper, and worse for the peace of the house.' : 'Cheaper.', run: () => { wives.forEach((w) => happy(w, -6)); return 'She has a bench in the hall. Meals have become very quiet.'; } },
        ];
        return opts;
      } },

    { id: 'house_funeral', w: 0, needs: () => null,
      title: (c) => { const p = c.state.people[c.p.wid]; return `${p ? p.first : 'She'} is dead`; },
      body: (c) => {
        const p = c.state.people[c.p.wid];
        if (!p) return ['A woman of the house has died.'];
        const m = marriageOf(c, p.id), years = m ? Math.max(1, (p.deathYear || IS.Economy.yearOf(c.state)) - m.startY) : null;
        const kids = Object.values(c.state.people).filter((k) => k.motherId === p.id && k.deathYear == null).map((k) => k.first);
        const mine = c.state.headId === c.p.hid;
        const who = p.role === 'concubine' ? 'your concubine' : mine ? 'your wife' : c.head.motherId === p.id ? 'your mother' : 'your father\'s wife';
        const out = [`${IS.Names.fullName(p)}, ${who}, ${String(p.deathText || 'died').replace(/\.$/, '')}. She was ${p.deathAge} years old${years ? `, and had been ${years} ${years === 1 ? 'year' : 'years'} at ${c.state.farm.name}` : ''}.`];
        out.push(kids.length ? `She leaves ${kids.length === 1 ? 'a child' : kids.length + ' children'}: ${kids.join(', ')}.` : 'She leaves no living children.');
        if (p.attrs && p.attrs.happiness < 35 && m) out.push(`Her kin at ${m.kinFarm} are saying she was not happy in your house.`);
        return out;
      },
      view: (c) => {
        const p = c.state.people[c.p.wid];
        if (!p) return null;
        const m = marriageOf(c, p.id);
        const known = (p.knownTraits || []).map((t) => IS.Traits.WIFE[t] ? IS.Traits.WIFE[t].name.toLowerCase() : t);
        const rows = [['Name', IS.Names.fullName(p)], ['Of', (p.kin && p.kin.farm) || (m && m.kinFarm) || 'unknown'], ['Born', String(p.birthYear)], ['Died', `${p.deathYear || ''}, ${String(p.deathText || '').replace(/\.$/, '')}`]];
        if (known.length) rows.push(['She was', known.join(', ')]);
        return { card: { title: 'In memory', rows } };
      },
      options: (c) => {
        const p = c.state.people[c.p.wid];
        const m = p && marriageOf(c, p.id), kin = m ? m.kinFarm : (p && p.kin && p.kin.farm);
        const kids = p ? Object.values(c.state.people).filter((k) => k.motherId === p.id && k.deathYear == null).length : 0;
        const ale = 40 + 25 * c.tier;
        const unhappy = p && p.attrs && p.attrs.happiness < 35;
        const opts = [
          { id: 'erfi', label: 'Hold a funeral feast for her', cost: ale, desc: `${ells(ale)}. The whole district drinks to her memory. Honor +1, and her kin are softened.`,
            run: () => { c.pay(ale); c.honor(1, `The funeral feast for ${p ? p.first : 'her'}`); if (kin) c.goodwill(kin, unhappy ? 4 : 8); return 'The funeral ale was drunk for two days. Her kinsmen made a speech about her, and it was a better speech than you expected.'; } },
          { id: 'quiet', label: 'Bury her quietly', desc: unhappy && kin ? 'Her kin will take it as one more sign.' : 'A grave mound, a few words, and back to work.', run: () => { if (kin && unhappy) c.goodwill(kin, -8); return 'She was buried on the slope above the home field with her best brooches.'; } },
        ];
        if (m && !kids && m.dowry > 0 && p.role === 'wife') {
          opts.push({ id: 'dowry', label: `Send her dowry back to ${kin}`, cost: m.dowry, desc: `${ells(m.dowry)}. She left no children, and some say the dowry should go home with her. Her kin will think well of you.`,
            run: () => { c.pay(m.dowry); c.goodwill(kin, 20); c.honor(1, `You returned ${p.first}'s dowry to her kin`); return `You sent the dowry back to ${kin} with two men and a good horse. Her father sent word that he had not expected it.`; } });
          if (unhappy) opts.push({ id: 'keepdowry', label: 'Keep the dowry', desc: `It was given to this house. ${kin} will not see it that way.`, run: () => { c.goodwill(kin, -20); if (c.rng.chance(0.4) && IS.Feud) IS.Feud.ensure(c.state, kin, `the dowry of ${p.first}`); return `Her kinsmen came for the dowry and went home without it. They did not slam the door, but they thought about it.`; } });
        }
        return opts;
      } },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
