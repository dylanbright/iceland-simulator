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

    /* ---------- the whetting: Hildigunnr and the bloody cloak ---------- */
    { id: 'house_whetting', w: 0, needs: () => null,
      title: (c) => `${c.p.whetter} will not let it rest`,
      body: (c) => {
        const dead = c.p.dead || 'your man';
        return [c.p.dead
          ? `At supper ${c.p.whetter} did not sit. She went to the chest and brought out the cloak ${dead} was wearing when the men of ${c.p.farm} killed him, stiff with his blood, and threw it over your shoulders in front of the whole household.`
          : `At supper ${c.p.whetter} set your food in front of you without a word, then said loudly enough for everyone to hear that she had not known she was married into a house that let its dead lie unavenged.`,
        c.p.dead ? `She says she charges you, by everything you hold holy, to avenge every wound he took, or be called a coward by every man in the district. Nobody at the table is eating.` : `${c.p.head} of ${c.p.farm} still walks about the district. She would like to know why.`];
      },
      options: (c) => {
        const w = c.state.people[c.p.wid], F = IS.Feud, odds = F.fightOdds(c.state, F.edge(c.state, c.p.farm));
        const opts = [];
        if (!c.state.expedition) opts.push({ id: 'ride', label: 'Take up the cloak and ride', desc: `${cap(F.oddsWord(odds))}. Honor +3 if it goes well. She will be satisfied, and the feud will go on.`,
          run: () => {
            happy(w, 15); F.bump(c.state, c.p.farm, -15);
            if (c.rng.chance(odds)) { c.honor(3, `You avenged ${c.p.dead || 'your dead'} at ${c.p.whetter}'s urging`); F.slain(c.state, c.p.farm, 'them'); note(c, 'whetting', `${c.p.whetter} threw ${c.p.dead ? c.p.dead + "'s bloody cloak" : 'the shame of it'} over his shoulders, and he rode to ${c.p.farm} and killed a man there.`, 3); return `You rode that night. By morning a man of ${c.p.farm} was dead, and ${c.p.whetter} served you the best of everything in the house.`; }
            c.honor(-1, `Your ride on ${c.p.farm} failed`); c.head.attrs.strength = Math.max(5, c.head.attrs.strength - 5);
            return `They were waiting. You came home hurt and with nothing to show for it.${F.bloodshed(c.state, c.rng, c, c.p.farm, c.p.head, 0.3)}`;
          } });
        opts.push({ id: 'promise', label: 'Promise her vengeance, in time', desc: 'She will hold you to it. She will not wait forever.', run: () => { happy(w, -5); const f = F.get(c.state, c.p.farm); if (f) f.whetted = c.state.turn - 3; return `You said it would be done when the time was right. ${c.p.whetter} said the time had been right for some while.`; } });
        opts.push({ id: 'refuse', label: 'Tell her the law will settle it', desc: `${c.p.whetter} will take this badly.${!c.p.mother && w && (w.traits || []).some((t) => t === 'vindictive' || t === 'proud') ? ' She may leave you over it.' : ''}`,
          run: () => {
            happy(w, -15); c.honor(-1, 'You refused a whetting at your own table');
            if (!c.p.mother && w && w.deathYear == null && c.state.household.wives.includes(w.id) && (w.traits || []).some((t) => t === 'vindictive' || t === 'proud') && c.rng.chance(0.25)) {
              const wctx = IS.Household._ctxFor ? IS.Household._ctxFor(c.state, w) : null;
              if (wctx) return `${c.p.whetter} said she would not share a bed with a man who would not avenge his own. ${wctx.divorce(true)}`;
            }
            return `${c.p.whetter} took the cloak back and folded it with great care, which was worse than shouting.`;
          } });
        return opts;
      } },

    /* ---------- the widow's suitor ---------- */
    { id: 'house_widow', w: 0, needs: () => null,
      title: (c) => { const w = c.state.people[c.p.wid]; return `${c.p.head} of ${c.p.farm} asks for ${w ? w.first : 'the widow'}`; },
      body: (c) => {
        const w = c.state.people[c.p.wid];
        const kids = kidsOf(c, c.p.wid);
        const who = w && c.head.motherId === w.id ? 'your mother' : 'your father\'s widow';
        return [`${c.p.head} of ${c.p.farm} has asked for ${w ? w.first : 'her'}, ${who}, in marriage. She is ${w ? c.age(w) : ''} and has been a widow long enough, she says.`,
          kids.length ? `If she goes, she means to take ${kids.map((k) => k.first).join(' and ')} with her, and their share of the farm with them.` : 'She has no young children to take with her.'];
      },
      options: (c) => {
        const w = c.state.people[c.p.wid];
        const kids = kidsOf(c, c.p.wid);
        const m = (c.state.marriages || []).find((x) => x.wifeId === c.p.wid);
        const dowry = m ? Math.round(m.dowry) : 100, share = Math.round(dowry + kids.length * (60 + 20 * c.tier));
        const leave = (withKids) => { c.removePerson(w.id); w.role = 'remarried'; if (withKids) kids.forEach((k) => c.removePerson(k.id)); };
        return [
          { id: 'bless', label: 'Give her your blessing, and her share', cost: share, desc: `${ells(share)}: her dowry${kids.length ? ' and the children\'s portion' : ''}. She goes with ${kids.length ? 'the children' : 'your goodwill'}. Honor +1, and ${c.p.farm} becomes a friend.`,
            run: () => { c.pay(share); leave(true); c.goodwill(c.p.farm, 20); c.honor(1, `You gave ${w.first} away with her share`); note(c, 'widow', `${w.first}, his father's widow, married ${c.p.head} of ${c.p.farm}, and he gave her away with her full share.`, 1.5); return `The wedding was at ${c.p.farm}. ${w.first} left with her chest, her portion${kids.length ? ' and the children' : ''}, and something like a smile.`; } },
          { id: 'kids', label: kids.length ? 'Let her go, but keep the children here' : 'Let her go with her dowry only', cost: dowry, desc: `${ells(dowry)}. ${kids.length ? 'The children stay on the farm they will one day help to work. She will not easily forgive you.' : 'A fair parting.'}`,
            run: () => { c.pay(dowry); leave(false); c.goodwill(c.p.farm, kids.length ? -5 : 10); return kids.length ? `${w.first} went to ${c.p.farm} alone. She did not look back at the children, which everyone noticed.` : `${w.first} went to ${c.p.farm} with her dowry and your good wishes.`; } },
          { id: 'forbid', label: 'Refuse the match', desc: `She stays, and ${c.p.head} takes it as an insult.`, run: () => { c.goodwill(c.p.farm, -15); return `You sent ${c.p.head} home with a polite answer. ${w.first} has stopped speaking to you at meals.`; } },
        ];
      } },

    /* ---------- her kin's quarrel becomes yours ---------- */
    { id: 'house_kin_feud', w: 0.5,
      needs: (c) => {
        const wives = c.state.household.wives.map((id) => c.state.people[id]).filter((w) => w && w.deathYear == null && w.kin && c.state.families && c.state.families[w.kin.farm] && c.state.families[w.kin.farm].head);
        if (!wives.length) return null;
        const w = c.rng.pick(wives), kin = c.state.families[w.kin.farm];
        const foes = Object.values(c.state.families).filter((f) => f.head && f.farm !== kin.farm && f.farm !== c.state.farm.name && !c.state.household.wives.some((id) => { const x = c.state.people[id]; return x && x.kin && x.kin.farm === f.farm; }));
        if (!foes.length) return null;
        const foe = c.rng.pick(foes);
        return { wid: w.id, kinFarm: kin.farm, kinHead: kin.head.first, foe: foe.farm, foeHead: foe.head.first };
      },
      title: (c) => { const w = c.state.people[c.p.wid]; return `${w ? w.first + "'s" : 'Your wife\'s'} kin call on you`; },
      body: (c) => { const w = c.state.people[c.p.wid]; return [`${c.p.kinHead} of ${c.p.kinFarm}, ${w ? w.first + "'s" : 'your wife\'s'} kinsman, rode in with mud to his knees. ${c.p.foeHead} of ${c.p.foe} has driven his sheep off the common pasture and beaten his herdsman, and he is gathering men to answer it.`, `He did not ask whether you would come. ${w ? w.first : 'Your wife'} is standing beside him, and did not ask either.`]; },
      options: (c) => {
        const w = c.state.people[c.p.wid], F = IS.Feud, odds = F.fightOdds(c.state, 0.03), arb = Math.min(0.8, 0.35 + c.head.attrs.law / 300 + c.head.attrs.honor / 300);
        const opts = [];
        if (!c.state.expedition) opts.push({ id: 'ride', label: `Ride with ${c.p.kinHead}`, desc: `${cap(F.oddsWord(odds))}. Her kin and she will love you for it. ${c.p.foeHead} will not.`,
          run: () => {
            happy(w, 10); c.goodwill(c.p.kinFarm, 18); c.goodwill(c.p.foe, -22); if (F.shiftBond) F.shiftBond(c.state, c.p.kinFarm, c.p.foe, -8);
            if (c.rng.chance(odds)) { c.honor(1.5, `You rode with your wife's kin against ${c.p.foe}`); if (c.rng.chance(0.4)) c.feud(c.p.foe, `you rode with ${c.p.kinHead} against him`); return `You and ${c.p.kinHead} drove ${c.p.foeHead}'s men off the common and took the sheep back, and some of his. ${w ? w.first : 'Your wife'} met you at the door.`; }
            c.honor(-1, `You rode with your wife's kin and were beaten`); c.head.attrs.strength = Math.max(5, c.head.attrs.strength - 4); c.feud(c.p.foe, `you rode against him for ${c.p.kinHead}`);
            return `${c.p.foeHead} had more men than anyone said. You came home bruised, and with a new enemy.`;
          } });
        opts.push({ id: 'mediate', label: 'Offer to arbitrate between them', cost: 30, desc: `${ells(30)}. ${cap(F.oddsWord(arb))}. If both accept, both think better of you. Honor +1.`,
          run: () => { c.pay(30); if (c.rng.chance(arb)) { c.goodwill(c.p.kinFarm, 6); c.goodwill(c.p.foe, 6); c.honor(1, `You settled a quarrel between ${c.p.kinFarm} and ${c.p.foe}`); happy(w, 3); return `You set a price for the sheep and the herdsman's broken head, and both men paid or took it. People say you have a head for the law.`; } happy(w, -6); c.goodwill(c.p.kinFarm, -6); return `${c.p.foeHead} would not come, and ${c.p.kinHead} thinks you were stalling.`; } });
        opts.push({ id: 'refuse', label: 'Tell him it is not your quarrel', desc: `${w ? w.first : 'Your wife'} will not forget it, and neither will her kin.`,
          run: () => { happy(w, -14); c.goodwill(c.p.kinFarm, -20); return `${c.p.kinHead} left without eating. ${w ? w.first : 'Your wife'} walked him to his horse and did not come back inside for a long time.`; } });
        return opts;
      } },
  ];

  /** A widow's young children, still in the house. */
  function kidsOf(c, wid) {
    const y = IS.Economy.yearOf(c.state);
    return [...c.state.household.kin, ...c.state.household.children].map((id) => c.state.people[id]).filter((k) => k && k.deathYear == null && k.motherId === wid && y - k.birthYear < 14 && k.id !== c.state.headId);
  }
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  IS.Events.DEFS.push(...DEFS);
})();
