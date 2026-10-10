/* Wife incidents: what happens in the house, by mood. Each wife has a 50% chance of one each season.
 * An incident is picked by her Happiness band, weighted by her temperament, and may need a neighbor,
 * a grudge or a servant to exist. `needs` returns serialisable params (or null); `options` gives the choices.
 * The ctx helpers (pay, honor, happy, goodwill, divorce ...) come from household.js. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});

  const gift = (c) => 30 + 20 * c.tier;
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';

  const DEFS = [
    /* ---------- a happy house ---------- */
    { id: 'brilliant_feast', band: [62, 100], w: 1.2, traits: { capable: 1.6, peacemaker: 1.4, proud: 1.1 },
      needs: () => ({}),
      title: () => 'She set a fine table',
      body: (c) => [`${c.wname} took charge of the table this season, and the guests are still talking about it.`],
      options: (c) => [
        { id: 'praise', label: 'Praise her before the guests', desc: 'Honor +1.5. She will be pleased.',
          run: () => { c.honor(1.5, `${c.wname} was praised for her table`); c.happy(4); return 'You praised her, and she kept it in mind.'; } },
        { id: 'claim', label: 'Take the credit yourself', desc: 'Honor +2.5, but she will resent it.',
          run: () => { c.honor(2.5, 'The credit for a fine table'); c.happy(c.has('proud') ? -12 : -6); return 'You took the credit. She said nothing, which is not the same as not minding.'; } },
      ] },
    { id: 'saves_money', band: [55, 100], w: 1, traits: { thrifty: 2.5, capable: 1.3 },
      needs: (c) => ({ amount: 20 + c.tier * 10 + c.rng.int(0, 30) }),
      title: () => 'A good bargain',
      body: (c) => [`${c.wname} drove a hard bargain at market and came home with ${ells(c.p.amount)} more than you had counted on.`],
      options: (c) => [
        { id: 'share', label: 'Let her keep a third as her own', desc: `You keep ${ells(c.p.amount * 2 / 3)}. She is glad.`,
          run: () => { c.earn(c.p.amount * 2 / 3); c.happy(6); return `You put ${ells(c.p.amount * 2 / 3)} in the chest and let her keep the rest.`; } },
        { id: 'all', label: 'Put it all in the chest', desc: `You keep ${ells(c.p.amount)}. She will notice.`,
          run: () => { c.earn(c.p.amount); c.happy(-2); return `You put all ${ells(c.p.amount)} in the chest.`; } },
      ] },
    { id: 'verse', band: [50, 100], w: 0.8, traits: { skald: 3 },
      needs: (c) => (c.wife.attrs.poetry >= 35 ? {} : null),
      title: () => 'A verse for the house',
      body: (c) => [`${c.wname} has made a verse in praise of your house. It is a good one, and she knows it.`],
      options: (c) => {
        const gain = 1 + c.wife.attrs.poetry / 40;
        return [
          { id: 'recite', label: 'Have it recited at the next feast', desc: `Honor about +${gain.toFixed(1)}. She will be pleased.`,
            run: () => { c.honor(gain, `${c.wname}'s verse was repeated`); c.happy(3); return 'The verse went round the valley before the month was out.'; } },
          { id: 'keep', label: 'Ask her to keep it in the house', desc: 'No gain. She will be a little hurt.',
            run: () => { c.happy(-3); return 'She put it away and did not offer another.'; } },
        ];
      } },

    /* ---------- an ordinary house ---------- */
    { id: 'wants_cloth', band: [35, 72], w: 1.2, traits: { wasteful: 1.8, proud: 1.3, jealous: 1.2 },
      needs: () => ({}),
      title: () => 'She wants a gift',
      body: (c) => [`${c.wname} has set her heart on fine cloth and a silver brooch, the kind the neighbors' wives wear.`],
      options: (c) => [
        { id: 'give', label: 'Give her what she asks', cost: gift(c), desc: `${ells(gift(c))}. She will be delighted.`,
          run: () => { c.pay(gift(c)); c.happy(12); return 'She wore it to the next feast and let everyone see.'; } },
        { id: 'refuse', label: 'Tell her to make do', desc: 'No cost. She will not forget it.',
          run: () => { c.happy(c.has('proud') || c.has('wasteful') ? -14 : -8); return 'She said that was clearly what she was worth to you.'; } },
      ] },
    { id: 'kin_visit', band: [38, 80], w: 1, traits: { proud: 1.2 },
      needs: (c) => ({ kin: c.wife.kin ? c.wife.kin.farm : 'her old home' }),
      title: () => 'Her kin come to stay',
      body: (c) => [`${c.wname}'s kin from ${c.p.kin} have come for a week, with their horses and their opinions.`],
      options: (c) => [
        { id: 'well', label: 'Host them well', cost: 30 + 25 * c.tier, desc: `${ells(30 + 25 * c.tier)}. Honor +1. She will be glad.`,
          run: () => { c.pay(30 + 25 * c.tier); c.honor(1, `Hospitality to ${c.wname}'s kin`); c.happy(8); c.goodwill(c.p.kin, 5); return `They went home praising your table.`; } },
        { id: 'thin', label: 'Give them the plain table', desc: 'No cost. Honor −1.5. She will be ashamed.',
          run: () => { c.honor(-1.5, `A thin welcome for ${c.wname}'s kin`); c.happy(-6); c.goodwill(c.p.kin, -4); return 'They left a day early and said why.'; } },
      ] },
    { id: 'seating_insult', band: [35, 78], w: 0.5, traits: { proud: 3, jealous: 1.5, vindictive: 1.3 },
      needs: (c) => c.neighbor(),
      title: (c) => `A slight at ${c.p.farm}`,
      body: (c) => [`At the feast at ${c.p.farm}, ${c.p.nwife}, wife of ${c.p.head}, was seated above ${c.wname}. ${c.wname} said nothing at the table. She has said a good deal since.`],
      options: (c) => [
        { id: 'back', label: 'Take her side and demand a fair seat', desc: `${c.p.farm} will not forget it. She will be glad.`,
          run: () => {
            const win = c.rng.chance(clampP(0.35 + c.head.attrs.honor / 200));
            c.goodwill(c.p.farm, -12); c.happy(10);
            c.addGrudge({ type: 'family', farm: c.p.farm }, `the seating at ${c.p.farm}`, 30);
            if (win) { c.honor(1.5, `You held your ground at ${c.p.farm}`); return `${c.p.head} gave way, and people noticed.`; }
            c.honor(-1.5, `You lost a quarrel over a seat at ${c.p.farm}`); return `${c.p.head} would not give way, and people noticed that too.`;
          } },
        { id: 'pass', label: 'Ask her to let it pass', desc: 'No quarrel, but she will feel it.',
          run: () => { c.happy(c.has('proud') ? -14 : -8); return 'She let it pass, in the sense that she did not say it to you again.'; } },
        { id: 'gift', label: `Send ${c.p.farm} a gift to smooth it`, cost: 50, desc: `${ells(50)}. Eases the quarrel.`,
          run: () => { c.pay(50); c.goodwill(c.p.farm, 6); c.happy(-2); return `${c.p.head} took the gift and said no more about it.`; } },
      ] },
    { id: 'small_waste', band: [35, 66], w: 1, traits: { wasteful: 3 },
      needs: (c) => ({ loss: 25 + c.tier * 12 + c.rng.int(0, 25) }),
      title: () => 'Too much at market',
      body: (c) => [`${c.wname} bought more than the house needed at market: ${ells(c.p.loss)} of cloth, trinkets and sweet things.`],
      options: (c) => [
        { id: 'scold', label: 'Scold her and send half of it back', desc: `Costs about ${ells(c.p.loss / 2)}. She will be sore.`,
          run: () => { c.pay(c.p.loss / 2); c.happy(-8); c.reveal('wasteful'); return 'Half of it went back to the merchant, and she took offense.'; } },
        { id: 'let', label: 'Let it go', desc: `Costs ${ells(c.p.loss)}.`,
          run: () => { c.pay(c.p.loss); c.happy(2); c.reveal('wasteful'); return 'You let it go. She will remember that you let it go.'; } },
      ] },

    /* ---------- a sullen house ---------- */
    { id: 'frosty_hospitality', band: [15, 46], w: 1.1, traits: { proud: 1.3, vindictive: 1.2 },
      needs: () => ({}),
      title: () => 'A cold welcome',
      body: (c) => [`Guests came to the house and ${c.wname} received them coldly. They went away saying so.`],
      options: (c) => [
        { id: 'amends', label: 'Send gifts after them', cost: 20 + 8 * c.tier, desc: `${ells(20 + 8 * c.tier)}. Honor −0.5.`,
          run: () => { c.pay(20 + 8 * c.tier); c.honor(-0.5, 'A cold welcome, mended'); return 'The gifts helped, though not entirely.'; } },
        { id: 'ignore', label: 'Say nothing', desc: 'No cost. Honor −2.',
          run: () => { c.honor(-2, 'A cold welcome at your door'); return 'The story was told at several farms.'; } },
      ] },
    { id: 'spreads_talk', band: [10, 46], w: 1, traits: { vindictive: 1.8, malicious: 1.8, meddling: 1.2 },
      needs: () => ({}),
      title: () => 'Talk about you',
      body: (c) => [`${c.wname} has been telling the neighbors what she thinks of you and of the farm. It comes back to you from three directions.`],
      options: (c) => [
        { id: 'confront', label: 'Confront her', desc: 'It may stop it. It will not please her.',
          run: () => {
            c.happy(-6); if (c.has('malicious')) c.reveal('malicious'); else c.reveal('vindictive');
            if (c.rng.chance(0.5)) { c.honor(-0.5, 'Talk in the valley'); return 'She stopped, for now.'; }
            c.honor(-2, 'Talk in the valley'); return 'She did not stop, and now she has more to say.';
          } },
        { id: 'ignore', label: 'Pretend not to hear', desc: 'Honor −2.5.',
          run: () => { c.honor(-2.5, 'Talk in the valley'); return 'People say you either do not know or do not care.'; } },
      ] },
    { id: 'quarrel_in_house', band: [15, 52], w: 1.4, traits: { jealous: 1.5, vindictive: 1.5, proud: 1.2, meddling: 1.5 },
      needs: (c) => {
        const hh = c.state.household;
        const live = [...hh.kin, ...hh.servants, ...hh.thralls, ...hh.wives.filter((id) => id !== c.wife.id), ...(hh.concubines || [])];
        const g = (c.state.grudges[c.wife.id] || []).find((x) => x.target.type === 'person' && live.includes(x.target.id) && c.state.people[x.target.id].deathYear == null);
        return g ? { id: g.target.id, why: g.reason } : null;
      },
      title: (c) => `${c.wname} and ${c.state.people[c.p.id].first}`,
      body: (c) => { const t = c.state.people[c.p.id]; return [`${c.wname} and ${t.first}, ${c.roleOf(t)}, have been at each other's throats for weeks. The rest of the house is taking sides.`]; },
      options: (c) => {
        const t = c.state.people[c.p.id];
        return [
          { id: 'wife', label: `Take ${c.wname}'s side`, desc: 'She will be glad. The other will not.',
            run: () => {
              c.happy(10); c.reveal('vindictive');
              if (t.kind === 'thrall') { t.attrs.resentment = Math.min(100, (t.attrs.resentment || 35) + 10); return `${t.first} was punished and nursed it.`; }
              if (t.role === 'servant') { c.removePerson(t.id); return `${t.first} took ${t.sex === 'M' ? 'his' : 'her'} wages and left.`; }
              if (t.role === 'concubine') { c.removePerson(t.id); return `${t.first} was sent away, and ${c.wname} has not mentioned her since.`; }
              if (t.role === 'wife') return `${t.first} keeps to her own side of the hearth now.`;
              c.honor(-1, `You turned on your own kin`); return `${t.first} will not forget whose side you took.`;
            } },
          { id: 'other', label: `Take ${t.first}'s side`, desc: `${c.wname} will take it badly.`,
            run: () => { c.happy(-12); if (t.role === 'mother' || t.role === 'stepmother') c.honor(0.5, 'You stood by your mother'); return `${c.wname} said she knew now where she stood.`; } },
          { id: 'apart', label: 'Keep them apart', desc: 'No cost. It is only a truce.',
            run: () => { c.happy(-3); return 'They are not speaking, which is quieter.'; } },
        ];
      } },
    { id: 'withholds_help', band: [10, 42], w: 1.1, traits: { vindictive: 1.3, proud: 1.3, malicious: 1.2 },
      needs: () => ({}),
      title: () => 'She will not work',
      body: (c) => [`${c.wname} has stopped doing her share and says she will not lift a hand until she is treated as she ought to be.`],
      options: (c) => [
        { id: 'bargain', label: 'Make peace with a gift', cost: 25 + 15 * c.tier, desc: `${ells(25 + 15 * c.tier)}. She will work.`,
          run: () => { c.pay(25 + 15 * c.tier); c.happy(8); return 'She took the gift and went back to work, not warmly.'; } },
        { id: 'let', label: 'Let her sulk', desc: 'She does no work next season.',
          run: () => { c.sulk(1); c.happy(-3); return 'She sat out the season with her arms folded.'; } },
      ] },
    { id: 'big_waste', band: [15, 46], w: 1, traits: { wasteful: 3 },
      needs: (c) => ({ loss: 60 + c.tier * 20 + c.rng.int(0, 40) }),
      title: () => 'Goods given away',
      body: (c) => [`${c.wname} gave away ${ells(c.p.loss)} of goods to her kin and her friends without asking you.`],
      options: (c) => [
        { id: 'demand', label: 'Demand them back', desc: `Recovers about half. Honor −1.`,
          run: () => { c.pay(c.p.loss / 2); c.honor(-1, 'A quarrel over goods given away'); c.happy(-10); c.reveal('wasteful'); return 'Half of it came back, and the people who gave it back said so loudly.'; } },
        { id: 'let', label: 'Let it stand', desc: `Costs ${ells(c.p.loss)}.`,
          run: () => { c.pay(c.p.loss); c.happy(3); c.reveal('wasteful'); return 'It is gone, and she is pleased with herself.'; } },
      ] },

    /* ---------- a hostile house ---------- */
    { id: 'incites_servant', band: [0, 27], w: 1.5, traits: { malicious: 3.5, vindictive: 2, jealous: 1.3 },
      needs: (c) => {
        const n = c.neighbor();
        const hh = c.state.household;
        const pool = [...hh.servants, ...hh.thralls].filter((id) => c.state.people[id].deathYear == null);
        if (!n || !pool.length) return null;
        return Object.assign(n, { who: c.rng.pick(pool), killed: c.rng.chance(0.3) });
      },
      title: (c) => `Blood with ${c.p.farm}`,
      body: (c) => { const w = c.state.people[c.p.who]; return [`On ${c.wname}'s word, ${w.first}, ${c.roleOf(w)}, ${c.p.killed ? 'killed' : 'beaten'} a man of ${c.p.farm}'s household. ${c.p.head} is demanding satisfaction.`]; },
      options: (c) => {
        const w = c.state.people[c.p.who];
        const comp = c.p.killed ? 140 + 20 * c.tier : 50 + 10 * c.tier;
        return [
          { id: 'pay', label: 'Pay compensation and keep the peace', cost: comp, desc: `${ells(comp)}. Honor −1. She will be displeased.`,
            run: () => { c.pay(comp); c.honor(-1, `Compensation to ${c.p.farm}`); c.happy(-4); c.reveal('malicious'); return `${c.p.head} accepted it, and the matter is closed for now.`; } },
          { id: 'deny', label: 'Deny it and stand behind your wife', desc: `A feud with ${c.p.farm} begins. She will be glad.`,
            run: () => { c.goodwill(c.p.farm, -25); c.honor(-2, `A quarrel with ${c.p.farm} you would not settle`); c.happy(8); c.feud(c.p.farm, c.p.killed ? 'a killing the house would not pay for' : 'an assault the house would not pay for'); c.reveal('malicious'); return `${c.p.head} says this is not finished.`; } },
          { id: 'give', label: `Hand ${w.first} over to ${c.p.farm}`, desc: `You lose ${w.first}'s labour. She will be furious.`,
            run: () => { c.removePerson(w.id); c.goodwill(c.p.farm, 4); c.happy(-10); c.reveal('malicious'); return `${c.p.head} took ${w.first}, and the quarrel ended there.`; } },
        ];
      } },
    { id: 'takes_lover', band: [0, 28], w: 0.9, traits: {},
      needs: (c) => (c.age(c.wife) < 46 ? c.neighbor() : null),
      title: () => 'Talk in the valley',
      body: (c) => [`People say ${c.wname} has been meeting a man from ${c.p.farm} while you were at the fields. The talk is all over the valley.`],
      options: (c) => [
        { id: 'divorce', label: 'Divorce her before witnesses', desc: 'You return her dowry. Her kin will be angry. Honor +1.',
          run: () => { const t = c.divorce(false); c.honor(1, 'You acted when your name was mocked'); return t; } },
        { id: 'forgive', label: 'Confront her, and forgive', desc: 'Honor −1. She may settle.',
          run: () => { c.honor(-1, 'A wife who strayed'); c.happy(10); return 'She wept and promised. People are not convinced.'; } },
        { id: 'ignore', label: 'Pretend not to hear', desc: 'Honor −3.',
          run: () => { c.honor(-3, 'People say you are blind to your own house'); return 'The valley found this funnier than you did.'; } },
      ] },
    { id: 'shames_publicly', band: [0, 30], w: 1.3, traits: { proud: 2.5, vindictive: 1.5, malicious: 1.3 },
      needs: () => ({}),
      title: () => 'Shamed before the valley',
      body: (c) => [`At the feast, ${c.wname} said before the guests that you could not keep a farm or a wife. Nobody laughed. Everybody heard.`],
      options: (c) => [
        { id: 'answer', label: 'Answer her sharply before the guests', desc: 'Honor +0.5. She will not forgive it.',
          run: () => { c.honor(0.5, 'You answered a public insult'); c.happy(-12); return 'You answered her in front of everyone. It was not pretty, but it was done.'; } },
        { id: 'bear', label: 'Bear it in silence', desc: 'Honor −3.',
          run: () => { c.honor(-3, 'A public shaming you did not answer'); c.happy(2); return 'You bore it. The guests drew their own conclusions.'; } },
      ] },
    { id: 'seeks_divorce', band: [0, 24], w: 2.4, traits: {},
      needs: () => ({}),
      title: () => 'She will leave',
      body: (c) => [`${c.wname} has gone to her kin and says she will recite the divorce words before witnesses. Her father is with her.`],
      options: (c) => {
        const cost = 60 + 30 * c.tier;
        return [
          { id: 'go', label: 'Let her go', desc: 'Her dowry goes back with her. Her kin will be cool to you.',
            run: () => { const t = c.divorce(true); c.honor(-1, 'A wife who left you'); return t; } },
          { id: 'appease', label: 'Send gifts and ask her to stay', cost, desc: `${ells(cost)}. She may stay, and she may not.`,
            run: () => {
              c.pay(cost);
              if (c.rng.chance(0.65)) { c.happy(25); return `She took the gifts and came home. It will not take much to unsettle her again.`; }
              const t = c.divorce(true); c.honor(-2, 'A wife who left you after you begged'); return `She took the gifts and left anyway. ${t}`;
            } },
        ];
      } },
    { id: 'sabotage_stores', band: [0, 28], w: 1.1, traits: { malicious: 3, vindictive: 1.8 },
      needs: () => ({}),
      title: () => 'The stores are spoiled',
      body: (c) => [`The dairy-house was left open and part of the stores spoiled; some sheep were let out onto the fell. Nobody saw who did it. ${c.wname} was heard saying you would learn what the farm was worth.`],
      options: (c) => {
        const hurt = () => { const f = c.state.farm; const lost = Math.round(f.provisions * 0.4); f.provisions -= lost; const sh = Math.max(1, Math.round(f.sheep * 0.05)); f.sheep = Math.max(0, f.sheep - sh); return `${sh} sheep were lost and ${lost} rations of stores spoiled.`; };
        return [
          { id: 'accuse', label: 'Accuse her openly', desc: 'Honor −1. She will be furious.',
            run: () => { const t = hurt(); c.honor(-1, 'A quarrel in your own house'); c.happy(-12); c.reveal('malicious'); return t + ' You said what you thought, and she did not deny it.'; } },
          { id: 'quiet', label: 'Put it down to accident', desc: 'No more said. It may happen again.',
            run: () => { const t = hurt(); c.happy(-2); return t + ' You let it be called an accident.'; } },
        ];
      } },
  ];

  function clampP(p) { return Math.max(0.1, Math.min(0.9, p)); }

  IS.Incidents = { DEFS, byId: (id) => DEFS.find((d) => d.id === id) };
})();
