/* A boy at the head of the house (under sixteen): the events of a saga boyhood.
 * The ball game at Hvítá, where the young Egill Skallagrímsson took an axe to the boy who beat him;
 * a first verse at a feast; lessons that shape the man; grown men talking over his head at the Thing. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const age = (c) => IS.Economy.yearOf(c.state) - c.head.birthYear;
  const boy = (lo, hi) => (c) => { const a = age(c); return a >= lo && a <= hi; };
  const note = (c, k, x, w) => IS.Saga && IS.Saga.note(c.state, k, x, w);
  const grow = (c, key, n) => {
    if (key === 'strength') { c.head.peak.strength = Math.min(95, c.head.peak.strength + n); IS.Person.refresh(c.head, IS.Economy.yearOf(c.state)); }
    else c.head.attrs[key] = Math.min(95, c.head.attrs[key] + n);
  };
  const mother = (c) => c.state.household.kin.map((id) => c.state.people[id]).find((p) => p && p.deathYear == null && p.role === 'mother');
  const done = (c, id) => { c.head.youth = c.head.youth || {}; return !!c.head.youth[id]; };
  const mark = (c, id) => { c.head.youth = c.head.youth || {}; c.head.youth[id] = true; };

  const DEFS = [
    { id: 'boy_ballgame', w: 0.8,
      needs: (c) => {
        if (!boy(6, 14)(c) || done(c, 'ball')) return null;
        const n = c.neighbor();
        return n ? { farm: n.farm, head: n.head, other: IS.Names.male(c.rng).first, oage: Math.min(15, age(c) + c.rng.int(2, 5)) } : null;
      },
      title: () => 'The ball game',
      body: (c) => [`The boys of the district played the ball game on the ice. You were matched against ${c.p.other}, ${c.p.head}'s son from ${c.p.farm}, who is ${c.p.oage} and a head taller than you.`,
        `He beat you, and then he knocked you down, and then he stood over you and told everyone that the master of ${c.state.farm.name} could not hold a bat. Everyone laughed. You are ${age(c)}, and your face is burning.`],
      options: (c) => {
        const str = c.head.attrs.strength, wrestle = Math.max(0.15, Math.min(0.65, 0.2 + str / 150 - (c.p.oage - age(c)) * 0.04));
        const champ = IS.Feud.champion(c.state);
        const opts = [
          { id: 'bear', label: 'Go home and say nothing', desc: 'Honor −0.5. Boys forget. Sometimes.', run: () => { mark(c, 'ball'); c.honor(-0.5, 'You were beaten at the ball game'); return 'You walked home across the ice alone. Nobody at home asked about the bruise.'; } },
          { id: 'wrestle', label: `Get up and wrestle him`, desc: `${cap(IS.Feud.oddsWord(wrestle))}: he is older and bigger. Win and the laughing stops.`,
            run: () => { mark(c, 'ball'); if (c.rng.chance(wrestle)) { grow(c, 'strength', 2); c.honor(1, `You threw ${c.p.other} at the ball game`); return `You came at him low and he went down hard on the ice. The boys stopped laughing. ${c.p.other} did not speak to you for the rest of the day.`; } c.honor(-0.5, 'You were beaten twice at the ball game'); return `He threw you again, harder. You will be bigger one day. Everybody knows it, including him.`; } },
          { id: 'axe', label: 'Run home, fetch an axe, and come back', desc: `It is what the boy Egill did at Hvítá. ${c.p.other} will be dead. ${c.p.farm} will want blood or silver for him, and the district will never look at you the same way.`,
            run: () => {
              mark(c, 'ball');
              const F = IS.Feud;
              F.ensure(c.state, c.p.farm, `the boy you killed at the ball game`); F.slain(c.state, c.p.farm, 'them'); F.escalate(c.state, c.p.farm, 1);
              const f = F.get(c.state, c.p.farm); if (f) f.owedThem += F.wergild(c.state, 'son');
              c.goodwill(c.p.farm, -40); c.honor(1, `You killed ${c.p.other} at the ball game, at ${age(c)}`);
              note(c, 'youth', `When he was ${age(c)} years old he killed ${c.p.other}, the son of ${c.p.head} of ${c.p.farm}, with an axe after a ball game.`, 4);
              const m = mother(c);
              return `You walked back onto the ice with the axe under your cloak and buried it in ${c.p.other}'s head before anyone understood what you were doing. The game broke up in screaming.${m ? ` When you came home, ${m.first} looked at you for a long time, and said you would make a viking one day, and that you should have a ship when you were old enough.` : ''} ${c.p.head} of ${c.p.farm} has lost a son, and he knows whose.`;
            } },
        ];
        if (champ && champ.id !== c.head.id) opts.push({ id: 'tell', label: `Tell ${champ.first}`, desc: 'He is a grown man and will deal with it. People will say you ran to him.', run: () => { mark(c, 'ball'); c.goodwill(c.p.farm, -5); return `${champ.first} rode to ${c.p.farm} and had words with ${c.p.head} about the manners of his son. It was settled. You were not asked how you felt about it.`; } });
        return opts;
      } },

    { id: 'boy_verse', w: 0.6,
      needs: (c) => (boy(4, 13)(c) && !done(c, 'verse') ? {} : null),
      title: () => 'A verse at the feast',
      body: (c) => [`At the autumn feast you were let sit with the men, which you are not often. When the drinking horns had gone round twice and someone called for verses, you climbed onto the bench.`, `The hall went quiet, the way a hall goes quiet for a child about to make a fool of himself. You are ${age(c)}.`],
      options: (c) => {
        const p = Math.min(0.8, 0.25 + c.head.attrs.poetry / 120);
        return [
          { id: 'recite', label: 'Recite the verse you made in your head on the way', desc: `${cap(IS.Feud.oddsWord(p))}, by your Poetry. A good verse from a boy is talked of for years.`,
            run: () => { mark(c, 'verse'); if (c.rng.chance(p)) { grow(c, 'poetry', 6); c.honor(1.5, `Your first verse, at ${age(c)}`); note(c, 'youth', `At ${age(c)} he made a verse at a feast, and the men in the hall gave him gifts for it.`, 2); return 'The verse scanned, it rhymed inside the line the way a real one does, and it was about the host, flatteringly. Men pressed gifts on you: a ring, three snail shells, a duck egg. It will be told.'; } c.honor(-0.3, 'Your first verse fell flat'); return 'You lost the second line halfway through. The men laughed, kindly, which was worse.'; } },
          { id: 'sit', label: 'Lose your nerve and sit down', desc: 'Nobody will remember.', run: () => { mark(c, 'verse'); return 'You sat down. Someone ruffled your hair. You will make the verse another year.'; } },
        ];
      } },

    { id: 'boy_lessons', w: 1.1,
      needs: (c) => (boy(7, 15)(c) && (c.head.youthLessons || 0) < 4 ? {} : null),
      title: () => 'What the boy should learn',
      body: (c) => { const ch = IS.Feud.champion(c.state); return [`You are ${age(c)}. The winter evenings are long, and the household argues about what you should be taught: the law, the sword, the farm, or the old verses.`, ch && ch.id !== c.head.id ? `${ch.first} thinks a master who cannot fight will not be master long.` : 'There is nobody much to teach you the sword.']; },
      options: (c) => {
        const ch = IS.Feud.champion(c.state), m = mother(c);
        const learn = (key, n, text) => () => { c.head.youthLessons = (c.head.youthLessons || 0) + 1; grow(c, key, n); return text; };
        const opts = [
          { id: 'law', label: 'Sit with the old men and learn the law', desc: 'Law +4. Cases are won by the man who knows the forms.', run: learn('law', 4, 'An old man who had been at forty Alþings taught you the forms of a summons, one winter evening at a time. You can recite the whole of it now, and bore the household doing so.') },
          { id: 'arms', label: ch && ch.id !== c.head.id ? `Train with ${ch.first}` : 'Practice with a wooden sword', desc: `Strength +${ch && ch.id !== c.head.id ? 4 : 2}.`, run: learn('strength', ch && ch.id !== c.head.id ? 4 : 2, ch && ch.id !== c.head.id ? `${ch.first} knocked you down every morning until you started knocking him down back, now and then.` : 'You hacked at a post behind the byre until your arms ached.') },
          { id: 'farm', label: m ? `Learn the farm from ${m.first}` : 'Learn the farm from the servants', desc: 'Husbandry +4. Stock counts and hay weights.', run: learn('husbandry', 4, 'You learned how many tons a cow eats, which sheep to cull, and when the hay is dry enough to stack.') },
          { id: 'verse', label: 'Learn the old verses', desc: 'Poetry +4.', run: learn('poetry', 4, 'You learned the long poems by heart, the ones about gods and kings, and started making short ones of your own.') },
        ];
        return opts;
      } },

    { id: 'boy_thing', w: 0.6,
      needs: (c) => (boy(11, 15)(c) && c.state.regency ? {} : null),
      title: () => 'Talked over at the Thing',
      body: (c) => [`At the spring Thing the grown men discussed the boundary of your summer pasture with ${c.state.regency.regentName || 'your kinsman'}, as if you were not standing there. One of them called you "the boy from ${c.state.farm.name}".`, `You are ${age(c)}, and you are the master of ${c.state.farm.name}.`],
      options: (c) => {
        const p = Math.min(0.75, 0.2 + c.head.attrs.law / 150 + c.head.attrs.poetry / 300);
        return [
          { id: 'speak', label: 'Speak for your own farm', desc: `${cap(IS.Feud.oddsWord(p))}, by your Law. A boy who speaks well at the Thing is remembered. One who stammers is remembered too.`,
            run: () => { if (c.rng.chance(p)) { c.honor(1.5, `You spoke for your farm at the Thing, at ${age(c)}`); grow(c, 'law', 2); return `You named the old marker stones, the witnesses to the last settlement, and the year it was made. The men stopped talking over your head. One of them said afterward that the boy from ${c.state.farm.name} would be a hard man to deal with.`; } c.honor(-0.5, 'You stammered at the Thing'); return 'You started well and lost the thread. Somebody laughed, and your kinsman finished it for you.'; } },
          { id: 'wait', label: 'Let your kinsman speak, and listen', desc: 'Law +1. Your time will come.', run: () => { grow(c, 'law', 1); return 'You listened to every word, and remembered who said what. Your time will come.'; } },
        ];
      } },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
