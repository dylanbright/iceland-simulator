/* Neighbours quarrel with each other, and their friends ask you for help. Pushed by Feud.tick (core/feud.js).
 * Helping a friend wins his gratitude and the other man's enmity, and can start a feud of your own. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const F = () => IS.Feud;
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const word = (p) => F().oddsWord(p);
  const wound = (c) => { const n = c.rng.int(3, 9); c.fighter.attrs.strength = Math.max(5, Math.round(c.fighter.attrs.strength - n)); return n; };
  const ally = (c, d) => c.goodwill(c.p.ally, d);
  const foe = (c, d) => c.goodwill(c.p.foe, d);

  const DEFS = [
    { id: 'nbr_help', w: 0, needs: () => null,
      title: (c) => `${c.p.allyHead} asks for your help`,
      body: (c) => [c.p.stage === 1
        ? `${c.p.allyHead} of ${c.p.ally}, a neighbor${c.p.friend ? ' and a friend' : ''}, was mocked by ${c.p.foeHead} of ${c.p.foe} in front of the whole Thing. He has come to your farm to ask whether you will stand beside him when it is answered.`
        : `${c.p.foeHead} of ${c.p.foe} has driven off a good part of ${c.p.allyHead}'s stock, and ${c.p.allyHead} of ${c.p.ally}${c.p.friend ? ', a friend,' : ''} has come to you for help. He says he will not ask twice, and that he remembers who came when it was his turn to need them.`],
      options: (c) => {
        const odds = F().fightOdds(c.state, 0.02), L = F().lawChance(c.state, c.p.foe, 0.3);
        return [
          { id: 'ride', label: `Ride with ${c.p.allyHead}`, desc: `${cap(word(odds))}. Honor +1.5 if you prevail, −1.5 and a wound if not. ${c.p.allyHead} will not forget either way, but ${c.p.foeHead} will remember you, and a feud may follow.`,
            run: () => {
              if (c.rng.chance(odds)) {
                c.honor(1.5, `You rode with ${c.p.allyHead} against ${c.p.foeHead}`); ally(c, 20); foe(c, -22); F().shiftBond(c.state, c.p.ally, c.p.foe, 4);
                if (c.rng.chance(0.5)) c.feud(c.p.foe, `you rode with ${c.p.allyHead} against him`);
                return `You and ${c.p.allyHead} rode to ${c.p.foe} with a dozen men, and ${c.p.foeHead} came out and made his peace in the yard. ${c.p.allyHead} will say so for years.`;
              }
              c.honor(-1.5, `You were beaten riding with ${c.p.allyHead}`); const n = wound(c); ally(c, 8); foe(c, -28); c.feud(c.p.foe, `you rode with ${c.p.allyHead} against him`);
              return `${c.p.foeHead} was ready, and had friends of his own. You came home ${n > 6 ? 'badly ' : ''}hurt, and ${c.p.allyHead} was grateful that you had come at all.`;
            } },
          { id: 'law', label: `Stand with him at the Thing`, cost: 30, desc: `${ells(30)}. ${cap(word(L))} at law. Honor +1 if it succeeds. A friendly act, and ${c.p.foeHead} will resent it less than a sword.`,
            run: () => {
              c.pay(30);
              if (c.rng.chance(L)) { c.honor(1, `You helped ${c.p.allyHead} win at the Thing`); ally(c, 15); foe(c, -8); return `Your word, and your witnesses, carried the case. ${c.p.allyHead} was paid, and ${c.p.foeHead} paid with a bad grace.`; }
              c.honor(-0.5, `A case you helped ${c.p.allyHead} bring failed`); ally(c, 4); return `The judges found for ${c.p.foeHead}. ${c.p.allyHead} thanked you anyway, which was kinder than you deserved.`;
            } },
          { id: 'gift', label: 'Lend him silver', cost: 50, desc: `${ells(50)}. He can pay for his own lawsuit, or his own men. He will remember it. No risk to you.`,
            run: () => { c.pay(50); ally(c, 12); return `${c.p.allyHead} took the silver and said little, which is how you can tell a man means it.`; } },
          { id: 'refuse', label: 'Stay out of it', desc: `Honor −0.5, and ${c.p.allyHead} will think less of you. ${c.p.foeHead} will not mind.`,
            run: () => { c.honor(-0.5, `You stayed out of ${c.p.allyHead}'s quarrel`); ally(c, -10); foe(c, 3); return `${c.p.allyHead} left without finishing his ale. Some friendships are measured by days like this.`; } },
        ];
      } },

    { id: 'nbr_revenge', w: 0, needs: () => null,
      title: (c) => `${c.p.allyHead} wants revenge`,
      body: (c) => [`A man of ${c.p.ally} was killed by ${c.p.foeHead}'s people. ${c.p.allyHead}${c.p.friend ? ', who is your friend,' : ''} has come to your farm in the evening, after the others had gone to bed. He wants the killing paid for, and he wants you with him when he asks.`],
      options: (c) => {
        const odds = F().fightOdds(c.state, -0.04), v = c.p.value, L = F().lawChance(c.state, c.p.foe, 0.25);
        const away = !!c.state.expedition;
        const opts = [];
        if (!away) opts.push({ id: 'ride', label: `Ride with ${c.p.allyHead} for revenge`, desc: `${cap(word(odds))}. Honor +3 if it goes well, and ${c.p.allyHead} is yours for life. It starts a feud with ${c.p.foe}, and a man of yours may die.`,
          run: () => {
            c.feud(c.p.foe, `you took revenge with ${c.p.allyHead}`); F().escalate(c.state, c.p.foe, 1);
            const f = F().get(c.state, c.p.foe); if (f) f.owedThem += v;
            if (c.rng.chance(odds)) { c.honor(3, `You avenged a man of ${c.p.ally}`); ally(c, 30); foe(c, -35); return `You found ${c.p.foeHead}'s brother in the hay-barn at dawn with ${c.p.allyHead}'s sons beside you. It was done quickly. ${c.p.allyHead} gripped your forearm and could not speak.`; }
            c.honor(-1.5, `A revenge you rode on went wrong`); wound(c); ally(c, 12); foe(c, -40);
            const m = F().men(c.state); let extra = '';
            if (m.length && c.rng.chance(0.4)) { const x = c.rng.pick(m); c.kill(x, `died in a revenge with ${c.p.allyHead}`, 'killed in a feud'); extra = ` ${x.first} did not come back.`; }
            return `They were warned, and waiting.${extra} ${c.p.allyHead} says he will not forget that you came.`;
          } });
        opts.push({ id: 'law', label: 'Back his case for blood-money', cost: 60, desc: `${ells(60)}. ${cap(word(L))} at law. Honor +1.5 on success. ${c.p.allyHead} will be grateful, and no blood is shed.`,
          run: () => {
            c.pay(60);
            if (c.rng.chance(L)) { c.honor(1.5, `You helped ${c.p.allyHead} win blood-money`); ally(c, 22); foe(c, -10); return `The Althing set a price on the dead man, and ${c.p.foeHead} paid it. ${c.p.allyHead} says the credit is half yours.`; }
            c.honor(-0.8, 'A blood-money case you backed failed'); ally(c, 6); foe(c, -4); return `The case failed on a point of procedure. ${c.p.allyHead} blames the court, and says so loudly.`;
          } });
        opts.push({ id: 'refuse', label: 'Tell him this is not your quarrel', desc: `Honor −1. A friend who stays home when blood is spilled is not much of a friend.`,
          run: () => { c.honor(-1, `You refused ${c.p.allyHead} in his need`); ally(c, -18); return `${c.p.allyHead} did not argue. He thanked you for the hospitality, which was worse.`; } });
        return opts;
      } },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
