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

    /* ---------- the death of the head of the house ---------- */
    { id: 'house_headdeath', w: 0, needs: () => null,
      title: (c) => { const o = c.state.people[c.p.did]; return `${o ? IS.Names.fullName(o) : 'The head of the house'} is dead`; },
      body: (c) => {
        const o = c.state.people[c.p.did], h = c.state.people[c.p.heirId] || c.head;
        if (!o) return ['The head of the house is dead.'];
        const dh = (c.state.deadHeads || []).filter((d) => d.id !== o.id).slice(-1)[0];
        const since = dh ? dh.died : c.state.startYear, years = Math.max(1, (o.deathYear || c.p.year) - since);
        const ep = IS.Saga ? IS.Saga.epitaph(c.state, o.id, o.first) : [];
        const age = IS.Economy.yearOf(c.state) - h.birthYear;
        const out = [`${IS.Names.fullName(o)}, master of ${c.state.farm.name}, ${String(o.deathText || 'died').replace(/\.$/, '')}. He was ${o.deathAge || ''} winters old, and had held the farm for ${years} ${years === 1 ? 'year' : 'years'}.`];
        if (ep.length) out.push(`People are already saying what they will remember of him. ${ep.join(' ')}`);
        const young = age < 3 ? `, though he is a child of ${age === 1 ? 'one' : age < 1 ? 'a few months' : 'two'} still carried on his mother's hip` : age < 10 ? `, though he is only ${age} and his feet do not reach the floor` : age < 16 ? `, though he is only ${age}` : '';
        out.push(h.id === c.state.headId ? `Now ${IS.Names.fullName(h)} sits in the high seat${young}.` : 'The household is waiting to see who will sit in the high seat.');
        return out;
      },
      view: (c) => {
        const o = c.state.people[c.p.did];
        if (!o) return null;
        const dh = (c.state.deadHeads || []).find((d) => d.id === o.id);
        return { card: { title: 'In memory', rows: [['Name', IS.Names.fullName(o)], ['Lived', `${o.birthYear} to ${o.deathYear || c.p.year}`], ['Honor', dh ? `${dh.honor}, ${IS.ui && IS.ui.honorWord ? IS.ui.honorWord(dh.honor) : ''}` : '?'], ['Death', String(o.deathText || '').replace(/\.$/, '')]] } };
      },
      options: (c) => {
        const o = c.state.people[c.p.did], dh = (c.state.deadHeads || []).find((d) => d.id === (o && o.id));
        const christian = c.state.faith === 'christian' || IS.Economy.yearOf(c.state) >= 1000;
        const rites = 60 + 30 * c.tier, erfi = 80 + 40 * c.tier, great = dh && dh.honor >= 55;
        const name = o ? o.first : 'him';
        const opts = [];
        if (christian) opts.push({ id: 'church', label: 'Bury him at the church, with a priest to sing over him', cost: rites, desc: `${ells(rites)}. Honor +1.5. The new way, and the district will see it done well.`,
          run: () => { c.pay(rites); c.honor(1.5, `${name}'s burial at the church`); return `They buried ${name} by the church wall, and the priest sang in Latin over him. Half the district came.`; } });
        else opts.push({ id: 'mound', label: 'Raise a great mound and lay him in it, armed, with his best horse', cost: rites, desc: `${ells(rites)} and a horse. Honor +2.5. The old way, and men will point to the mound for a hundred years.`,
          run: () => { c.pay(rites); if (c.state.farm.horses > 0) c.state.farm.horses -= 1; c.honor(2.5, `The mound raised over ${name}`); if (IS.Saga) IS.Saga.note(c.state, 'burial', `They raised a great mound over ${name} and laid him in it with his weapons and his horse.`, 1.5); return `They laid ${name} in the mound sitting up, with his sword across his knees and his horse beside him, and closed it with turf. It can be seen from the sea.`; } });
        opts.push({ id: 'erfi', label: 'Hold the inheritance feast, and take the high seat before the whole district', cost: erfi, desc: `${ells(erfi)}. Honor +2, and every neighbor who drinks your ale thinks a little better of the new master.`,
          run: () => { c.pay(erfi); c.honor(2, `The inheritance feast for ${name}`); for (const f of Object.values(c.state.families || {})) if (f.head && f.farm !== c.state.farm.name) c.goodwill(f.farm, 3); return `The erfi lasted three days. On the last night the heir drank the memorial cup, stood, and stepped up into the high seat, and the hall roared.`; } });
        opts.push({ id: 'plain', label: 'Bury him simply', desc: great ? `He was a man of standing, and people expected more. Honor −1.` : 'A grave, a few words, and back to work.',
          run: () => { if (great) c.honor(-1, `${name} was buried meanly`); return `${name} was buried on the slope above the home field. It was quickly done.`; } });
        return opts;
      } },

    /* ---------- who sits in the high seat ---------- */
    { id: 'house_succession', w: 0, needs: () => null,
      title: () => 'Who takes the high seat?',
      body: (c) => {
        const h = c.state.people[c.p.heirId], r = c.state.people[c.p.rivalId];
        if (!h || !r) return ['The question of the high seat has settled itself.'];
        const ha = c.age(h), ra = c.age(r);
        return [`By law the farm goes to ${h.first}${h.legit === false ? '' : ', the lawful son'}. He is ${ha}${ha < 16 ? ', a boy' : ''}.`,
          `But ${r.first} is ${ra}, a grown man${r.legit === false ? ', though a concubine\'s son' : ', and the elder'}, and half the household already looks to him when something needs deciding. ${r.legit === false && h.legit !== false ? "The boy's mother's kin will not take it quietly if he is passed over." : 'Nobody has said anything yet. Everyone is thinking it.'}`];
      },
      view: (c) => {
        const h = c.state.people[c.p.heirId], r = c.state.people[c.p.rivalId];
        if (!h || !r) return null;
        const row = (p) => `${c.age(p)}, Strength ${Math.round(p.attrs.strength)}, Law ${Math.round(p.attrs.law)}${p.legit === false ? ', a concubine\'s son' : ''}`;
        return { card: { title: 'The claimants', rows: [[h.first, row(h)], [r.first, row(r)]] } };
      },
      options: (c) => {
        const h = c.state.people[c.p.heirId], r = c.state.people[c.p.rivalId];
        if (!h || !r || r.deathYear != null) return [{ id: 'ok', label: 'Go on', desc: '', run: () => '' }];
        const share = Math.max(40, Math.min(c.p.share || 200, Math.round(IS.Economy.cashOf(c.state.farm) * 0.6)));
        return [
          { id: 'heir', label: `Keep ${h.first} in the high seat`, desc: `The law is kept. ${r.first} takes his share of the movables, about ${ells(share)}, and goes, and he may not go as a friend.`,
            run: () => {
              c.pay(share); c.honor(0.5, 'You kept the law of inheritance');
              c.removePerson(r.id); r.role = 'brother (living apart)'; (c.state.away = c.state.away || []).push(r.id);
              let t = `${r.first} took his share and rode out of the yard without looking back.`;
              if (c.rng.chance(0.35) && IS.History) { const farm = IS.History.brotherFarm(c.state, r, -45); IS.Feud.ensure(c.state, farm, `the high seat ${r.first} was denied`); t += ` He has built a farm at ${farm}, and he says the high seat should have been his.`; }
              if (c.age(h) < 16) c.state.pending.splice(1, 0, { id: 'house_regency', wifeId: null, kind: 'event', params: { heirId: h.id } });
              return t;
            } },
          { id: 'rival', label: `Give the high seat to ${r.first}`, desc: `A grown man holds the farm. ${r.legit === false ? 'Honor −4: a concubine\'s son over the lawful heir. ' : ''}${h.first} stays as his brother.`,
            run: () => {
              const mother = h.motherId && c.state.people[h.motherId];
              IS.Turn.switchHead(c.state, r.id, c.rng);
              if (r.legit === false && h.legit !== false) { c.state.people[r.id].attrs.honor = Math.max(1, c.state.people[r.id].attrs.honor - 4); if (mother && mother.kin) c.goodwill(mother.kin.farm, -20); }
              if (mother && mother.attrs) mother.attrs.happiness = Math.max(0, mother.attrs.happiness - 20);
              if (IS.Saga) IS.Saga.note(c.state, 'succession', `${r.first} took the high seat over his younger brother ${h.first}.`, 1.5);
              return `${r.first} stepped up into the high seat. ${h.first} watched from the bench${mother ? `, and his mother ${mother.first} did not watch at all` : ''}.`;
            } },
        ];
      } },

    /* ---------- a boy in the high seat ---------- */
    { id: 'house_regency', w: 0, needs: () => null,
      title: (c) => { const h = c.state.people[c.p.heirId] || c.head, a = c.age(h); return a < 2 ? `${h.first} is a baby` : `${h.first} is only ${a}`; },
      body: (c) => { const h = c.state.people[c.p.heirId] || c.head; return [`${h.first} is the master of ${c.state.farm.name} now, and he is ${c.age(h)} ${c.age(h) === 1 ? 'year' : 'years'} old. Someone has to hold the farm for him until he is sixteen: drive the bargains, answer the neighbors, stand at the Thing.`, 'Whoever holds it will hold it the way they think best.']; },
      options: (c) => {
        const h = c.state.people[c.p.heirId] || c.head, y = IS.Economy.yearOf(c.state);
        const until = c.state.turn + Math.max(1, 16 - c.age(h)) * 2;
        const kin = c.state.household.kin.map((id) => c.state.people[id]).filter((p) => p && p.deathYear == null);
        const mother = kin.find((p) => p.role === 'mother' && y - p.birthYear >= 20);
        const uncle = kin.filter((p) => p.sex === 'M' && y - p.birthYear >= 20 && p.id !== h.id).sort((a, b) => b.attrs.husbandry - a.attrs.husbandry)[0];
        const friend = Object.values(c.state.families || {}).filter((f) => f.head && f.farm !== c.state.farm.name && ((c.state.relations || {})[f.farm] || 0) >= 10).sort((a, b) => (c.state.relations[b.farm] || 0) - (c.state.relations[a.farm] || 0))[0];
        const eff = (p) => Math.max(0.78, Math.min(0.97, 0.8 + p.attrs.husbandry / 450 + ((p.traits || []).includes('capable') ? 0.04 : 0)));
        const set = (r) => { c.state.regency = Object.assign({ until, heirId: h.id }, r); };
        const opts = [];
        if (mother) opts.push({ id: 'mother', label: `His mother ${mother.first} holds the farm`, desc: `She knows the household better than anyone (husbandry ${Math.round(mother.attrs.husbandry)}). Steady, if not bold.`,
          run: () => { set({ kind: 'mother', regentId: mother.id, regentName: mother.first, eff: eff(mother) }); return `${mother.first} took the keys and the high seat's cushion, and told the household that nothing would change. A great deal changed, but quietly.`; } });
        if (uncle) opts.push({ id: 'kin', label: `${uncle.first}, his kinsman, holds the farm`, desc: `A grown man to deal with the neighbors (husbandry ${Math.round(uncle.attrs.husbandry)}). Some men grow used to a high seat.`,
          run: () => { set({ kind: 'kin', regentId: uncle.id, regentName: uncle.first, eff: eff(uncle), risk: 0.05 }); return `${uncle.first} moved his things into the master's bed-closet. He says it is only until the boy is grown.`; } });
        if (friend) opts.push({ id: 'foster', label: `Send ${h.first} to be fostered at ${friend.farm}`, desc: `${friend.head.first} raises him as his own, and your houses become close. The household runs the farm in the meantime, and the boy comes home better taught.`,
          run: () => { const d = IS.Raid ? IS.Raid.deputies(c.state)[0] : null; set({ kind: 'foster', farm: friend.farm, regentName: d ? d.name : 'the household', eff: d ? Math.max(0.78, Math.min(0.95, 0.78 + d.husbandry / 450)) : 0.8 }); c.goodwill(friend.farm, 25); if (IS.Feud && IS.Feud.shiftBond) {} return `${h.first} rode to ${friend.farm} behind ${friend.head.first}'s saddle. Fostering binds two houses like blood.`; } });
        opts.push({ id: 'household', label: 'The household runs it together', desc: 'Nobody in charge, everybody with an opinion. The farm will do less well.', run: () => { set({ kind: 'household', regentName: 'the household', eff: 0.8 }); return 'The servants, the women and the old men run the farm between them, and argue about everything.'; } });
        return opts;
      } },

    { id: 'house_comingofage', w: 0, needs: () => null,
      title: (c) => `${c.head.first} comes of age`,
      body: (c) => [c.p.kind === 'foster' ? `${c.head.first} has come home from ${c.p.farm}, sixteen, taller than anyone expected and full of ${c.p.farm}'s opinions. He has learned the law at his foster-father's table and the sword in his yard.` : `${c.head.first} is sixteen. This spring he sat in the high seat for the first time as its master, not as a boy being humored, and ${c.p.regentName || 'whoever had held the farm'} stepped down.`],
      options: (c) => [
        { id: 'gift', label: c.p.kind === 'foster' ? `Send a gift to ${c.p.farm}` : `Give ${c.p.regentName} a gift for the years of keeping`, cost: 40, desc: `${ells(40)}. Honor +0.5. Gratitude is remembered.`, run: () => { c.pay(40); c.honor(0.5, 'You thanked those who held the farm for you'); if (c.p.farm) c.goodwill(c.p.farm, 10); return 'The gift was well received, and the story of it went round the district.'; } },
        { id: 'go', label: 'Take up the work', desc: 'There is a great deal of it.', run: () => 'You walked the boundaries, counted the stock, and found out what the farm really looks like.' },
      ] },

    { id: 'house_usurper', w: 0, needs: () => null,
      title: (c) => `${c.p.name} would keep the high seat`,
      body: (c) => [`${c.p.name}, who holds the farm until ${c.head.first} is grown, has started speaking as if it were his own. He has made bargains in his own name, and he told a neighbor that a boy is no master for a farm like this one.`, 'The household is waiting to see what happens.'],
      options: (c) => {
        const r = c.state.people[c.p.rid], p = Math.min(0.85, 0.45 + c.head.attrs.honor / 200), buy = 80 + 40 * c.tier;
        const out = () => { if (r && r.deathYear == null) c.removePerson(r.id); c.state.regency = Object.assign({}, c.state.regency, { kind: 'household', regentId: null, regentName: 'the household', eff: 0.8, risk: 0 }); };
        return [
          { id: 'stand', label: 'Rally the household and the neighbors behind the boy', desc: `${cap(IS.Feud.oddsWord(p))}. If it fails, ${c.p.name} takes what he can carry and becomes an enemy.`,
            run: () => {
              if (c.rng.chance(p)) { out(); c.honor(1, `The household stood behind ${c.head.first}`); return `The household and two neighbors stood in the yard behind the boy. ${c.p.name} looked at them for a long time, then packed his things.`; }
              const take = Math.round(IS.Economy.cashOf(c.state.farm) * 0.3); c.pay(take); out();
              const farm = IS.History.brotherFarm(c.state, { first: c.p.name }, -50); IS.Feud.ensure(c.state, farm, `the high seat he tried to take`);
              return `${c.p.name} left with ${ells(take)} of the farm's silver and half the stories about you. He has settled at ${farm} and calls himself wronged.`;
            } },
          { id: 'buy', label: 'Pay him to step down', cost: buy, desc: `${ells(buy)}. He goes quietly.`, run: () => { c.pay(buy); out(); return `${c.p.name} counted the silver and found that he had always meant to step down.`; } },
          { id: 'yield', label: 'Let him hold it as he likes until the boy is grown', desc: 'Honor −2. The farm is his in all but name for now.', run: () => { c.honor(-2, `${c.p.name} ruled ${c.state.farm.name} in the boy's name`); if (c.state.regency) c.state.regency.risk = 0; return `${c.p.name} sits in the high seat now, and the boy sits beside it.`; } },
        ];
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
