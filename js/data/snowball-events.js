/* The snowball: one killing begets the next (after Njáls saga).
 * Feud.slain keeps a tally of the dead on both sides; Feud.tick's chain step turns the tally into events:
 *   snow_answer  - their kin answer for the man you killed, and you must answer that
 *   snow_allies  - kinsmen and friends choose sides, which spreads the feud to other houses
 *   snow_peace   - a respected man counts the dead and offers a settlement
 *   snow_broken  - a hothead on either side breaks the peace
 * Every death raises the stage, so a quarrel over a few sheep ends with a roof on fire. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const F = () => IS.Feud;
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const word = (p) => F().oddsWord(p);
  const wound = (c) => { const n = c.rng.int(3, 9); c.fighter.attrs.strength = Math.max(5, Math.round(c.fighter.attrs.strength - n)); return n; };
  const fd = (c) => F().get(c.state, c.p.farm) || F().ensure(c.state, c.p.farm);
  const tally = (c) => { const t = F().tollOf(F().get(c.state, c.p.farm)); const n = t.you + t.them; return n ? `${n} ${n === 1 ? 'man is' : 'men are'} dead between the houses: ${t.you} of yours, ${t.them} of theirs.` : ''; };
  const up = (c, n) => F().escalate(c.state, c.p.farm, n || 1);
  const down = (c, n) => F().escalate(c.state, c.p.farm, -(n || 1));
  const sour = (c, d) => F().bump(c.state, c.p.farm, d);
  /** A settled peace: the dead are written off, the feud goes quiet, and a truce begins. */
  function peace(c, turns, bumpBy) {
    const f = fd(c);
    f.toll = { you: 0, them: 0 }; f.answer = 0; f.owedThem = 0; f.truce = turns; f.quiet = 0;
    f.stage = Math.min(f.stage, 2); sour(c, bumpBy);
  }
  /** A ride that goes wrong: you are hurt and may lose another man, who is added to the tally. */
  function lostRide(c, why) {
    c.honor(-1.5, why); wound(c); up(c);
    const m = F().men(c.state); let extra = '';
    if (m.length && c.rng.chance(0.5)) { const x = c.rng.pick(m); c.kill(x, `died in the feud with ${c.p.farm}`, 'killed in a feud'); F().slain(c.state, c.p.farm, 'you'); extra = ` ${x.first} did not come back.`; }
    return extra;
  }
  const hotLine = (n) => (n >= 4 ? 'Nobody remembers any longer who began it.' : n === 3 ? 'The count is past what anyone can call even.' : 'Each death is now the reason for the next.');

  const DEFS = [
    { id: 'snow_answer', w: 0, needs: () => null,
      title: (c) => `${c.p.farm} answers for their dead`,
      body: (c) => [`The men of ${c.p.farm} did not wait long. ${c.p.victimName}, your ${c.p.relation === 'servant' ? 'free man' : c.p.relation}, was killed by ${c.p.head}'s kinsmen, who say it is the price of the man you killed. ${tally(c)} ${hotLine(c.p.toll)}`,
        'The district is watching to see whether you will answer, and whether anyone can stop it.'],
      options: (c) => {
        const f = fd(c), t = F().tollOf(f), v = c.p.value, away = !!c.state.expedition;
        const L = F().lawChance(c.state, c.p.farm, 0.15), arb = Math.min(0.7, 0.45 + c.head.attrs.honor / 400);
        const net = Math.round((t.you - t.them) * v * 0.8);
        const odds = F().fightOdds(c.state, F().edge(c.state, c.p.farm) - 0.03 * Math.min(5, t.you + t.them));
        const opts = [
          { id: 'prosecute', label: 'Prosecute at the Alþing', cost: 20, desc: `${ells(20)} for the summons. Heard at the next Alþing, where witnesses and a chieftain's backing decide it. You killed first, and the court will know it. A win outlaws ${c.p.head}.`,
            run: () => { c.pay(20); const cs = IS.Law.file(c.state, c.rng, { side: 'plaintiff', farm: c.p.farm, head: c.p.head, charge: 'killing', victim: c.p.victimName, value: v }); if (cs && !false) cs.theirWitnesses += 1; return cs ? `The summons was read at ${c.p.head}'s door. The Alþing will hear it.` : 'You already have a case waiting against that house.'; } },
          { id: 'settle', label: 'Count the dead and settle', cost: 30, desc: `${ells(30)}. ${cap(word(arb))}. ${net > 0 ? `You have lost more, so you would be paid about ${ells(net)}` : net < 0 ? `They have lost more, so you would pay about ${ells(-net)}` : 'The dead are even, so no silver changes hands'}. A truce follows. Honor +0.5.`,
            run: () => { c.pay(30); if (c.rng.chance(arb)) { if (net > 0) c.earn(net); else if (net < 0) c.pay(-net); c.honor(0.5, `A peace with ${c.p.farm}`); peace(c, 8, 12); return `The arbiters set the dead against each other. ${c.p.head} ${net < 0 ? 'took the silver with a face like winter' : 'paid and gave his hand'}, and for a while both houses went about their work.`; } c.honor(-0.5, `${c.p.farm} refused to count the dead`); sour(c, -5); return `${c.p.head} said his dead were worth more than yours. It was the start of another argument, not the end of this one.`; } },
        ];
        if (!away) opts.push({ id: 'avenge', label: 'Ride and answer again', desc: `${cap(word(odds))}. Honor +2.5 if it goes well. Every killing makes the next answer sooner, and the stakes higher.`,
          run: () => {
            sour(c, -12);
            if (c.rng.chance(odds)) { c.honor(2.5, `You answered ${c.p.farm}'s answer`); F().slain(c.state, c.p.farm, 'them'); return `You took ${c.p.head}'s man at the sheep-pens, and no one saw it done. By evening the whole district knew, which was the point and the trouble.`; }
            const x = lostRide(c, `Your ride against ${c.p.farm} went wrong`);
            return `They were waiting for you.${x}`;
          } });
        opts.push({ id: 'swallow', label: 'Let it lie', desc: 'Honor −4. The count stays where it is, and so do your enemies.',
          run: () => { c.honor(-4, `${c.p.victimName} went unanswered`); if (c.rng.chance(0.4)) up(c); return `You buried ${c.p.victimName} and said nothing. People noticed that too.`; } });
        return opts;
      } },

    { id: 'snow_allies', w: 0, needs: () => null,
      title: (c) => `${c.p.allyHead} of ${c.p.ally} takes sides`,
      body: (c) => [`${tally(c)} Such things do not stay between two farms. ${c.p.allyHead} of ${c.p.ally} is a kinsman of ${c.p.head}, and word has come that he will ride with him the next time blood is spilled.`,
        c.p.friend ? `${c.p.friendHead} of ${c.p.friend}, who thinks well of you, has let it be known he is listening.` : 'You have no neighbor close enough to call on.'],
      options: (c) => {
        const f = fd(c), join = (why) => { f.allies = (f.allies || 0) + 1; F().ensure(c.state, c.p.ally, `${c.p.allyHead} rode with ${c.p.head} against you`); F().bump(c.state, c.p.ally, -22); return why; };
        const rallyP = Math.min(0.8, 0.4 + c.head.attrs.honor / 250), buyP = Math.min(0.75, 0.4 + c.head.attrs.law / 400 + c.head.attrs.honor / 500), buy = 90 + 30 * c.tier;
        const opts = [];
        if (c.p.friend) opts.push({ id: 'rally', label: `Ask ${c.p.friendHead} to stand with you`, cost: 40, desc: `${ells(40)} for the feast. ${cap(word(rallyP))}. If he agrees, his men back you in this feud. He and ${c.p.allyHead} will like each other less.`,
          run: () => {
            c.pay(40);
            if (c.rng.chance(rallyP)) { f.backers = (f.backers || 0) + 1; c.honor(1, `${c.p.friendHead} stood with you`); c.goodwill(c.p.friend, 5); F().shiftBond(c.state, c.p.friend, c.p.ally, -6); return join(`${c.p.friendHead} drank to your cause, and sent word that he would ride when you did. The sides are now plain to see.`); }
            c.honor(-0.5, `${c.p.friendHead} would not commit`); return join(`${c.p.friendHead} ate your food and promised nothing. ${c.p.allyHead} will ride with ${c.p.head}.`);
          } });
        opts.push({ id: 'buy', label: `Pay ${c.p.allyHead} to stay out`, cost: buy, desc: `${ells(buy)}. ${cap(word(buyP))}. If it fails he keeps the silver and rides anyway.`,
          run: () => {
            c.pay(buy);
            if (c.rng.chance(buyP)) { c.goodwill(c.p.ally, 6); f.allyAt = (f.allyAt || 0) + 3; return `${c.p.allyHead} took the gift and said that a man should think of his own harvest. It is not friendship, but it is not war.`; }
            c.honor(-1, `${c.p.allyHead} took your silver and rode against you`); return join('He took the silver, and rode with ' + c.p.head + ' anyway. It will be told at your expense.');
          } });
        opts.push({ id: 'ignore', label: 'Do nothing', desc: `He joins ${c.p.head}. Another house becomes your enemy and their next strike will be stronger.`,
          run: () => join(`${c.p.allyHead} now counts himself among your enemies. You did nothing, which is a kind of choice.`) });
        return opts;
      } },

    { id: 'snow_peace', w: 0, needs: () => null,
      title: (c) => `${c.p.mediator} calls a peace-meeting`,
      body: (c) => [`${c.p.mediator} of ${c.p.mediatorFarm}, a man both sides respect, has called you and ${c.p.head} to a meeting. He means to count the dead and set them against each other. ${c.p.mine} of yours are dead, and ${c.p.theirs} of theirs.`,
        c.p.mine === c.p.theirs ? 'The count is even, and that is when a peace is easiest to make.' : c.p.mine > c.p.theirs ? 'You have lost more, so the balance is in your favor, and that makes it a peace you can ask a price for.' : 'They have lost more, so a peace will cost you something.'],
      options: (c) => {
        const f = fd(c), net = Math.round((c.p.mine - c.p.theirs) * c.p.value * 0.8);
        const theyAgree = 0.78 + (net > 0 ? -0.05 : 0.05), demandP = 0.4;
        const sum = net > 0 ? `You would receive about ${ells(net)}.` : net < 0 ? `You would pay about ${ells(-net)}.` : 'No silver changes hands.';
        return [
          { id: 'accept', label: 'Accept the count and make peace', desc: `${sum} A truce follows, the feud cools, and the tally is wiped. Honor ${net >= 0 ? '+1.5' : '+0.5'}.`,
            run: () => {
              if (c.rng.chance(theyAgree)) { if (net > 0) c.earn(net); else if (net < 0) c.pay(-net); c.honor(net >= 0 ? 1.5 : 0.5, `You made peace with ${c.p.farm}`); peace(c, 9, 15); return `${c.p.mediator} read out the count, and both men spoke the words. Hands were struck. Men who had avoided each other's eyes sat at the same table, and the feast lasted three days.`; }
              c.honor(0.3, `${c.p.head} walked out of the meeting`); return `${c.p.head} listened to the count, said the dead were not equal, and left. ${c.p.mediator} blamed him, loudly.`;
            } },
          { id: 'demand', label: 'Ask for more than the count allows', desc: `Honor +1 if they give in. If not, ${c.p.mediator} will think you did not want peace, and the feud climbs.`,
            run: () => {
              if (c.rng.chance(demandP)) { c.earn(Math.max(c.p.value * 1.2, net)); c.honor(1, `You won a hard peace from ${c.p.farm}`); peace(c, 6, 8); return `${c.p.head} gave way on the price, but not on the look he gave you. The peace holds, as long as no one remembers it.`; }
              c.honor(-0.5, `${c.p.mediator}'s peace failed over your demand`); sour(c, -8); up(c); f.peaceAt = (f.peaceAt || 0) + 2; return `The meeting broke up over a few ells, which is how most of these end.`;
            } },
          { id: 'refuse', label: 'Refuse the meeting', desc: c.p.mine > c.p.theirs ? 'Honor +0.5. A man who has lost more may refuse. The feud climbs.' : 'Honor −1. Pride is an expensive thing to keep. The feud climbs.',
            run: () => { c.honor(c.p.mine > c.p.theirs ? 0.5 : -1, `You refused ${c.p.mediator}'s peace`); up(c); sour(c, -4); return `${c.p.mediator} went home without a word. He will remember who would not listen.`; } },
        ];
      } },

    { id: 'snow_broken', w: 0, needs: () => null,
      title: (c) => (c.p.side === 'you' ? `${c.p.hotName} breaks the peace` : `${c.p.farm} breaks the peace`),
      body: (c) => (c.p.side === 'you'
        ? [`The peace held, and then ${c.p.hotName}, your ${c.p.relation === 'servant' ? 'free man' : c.p.relation}, met one of ${c.p.head}'s men at the ford. There were words about the dead. The man did not walk away.`, `${c.p.head} says it was done on purpose. Half the district will believe him. ${hotLine(c.p.toll)}`]
        : [`The peace held until ${c.p.victimName}, your ${c.p.relation === 'servant' ? 'free man' : c.p.relation}, was cut down at the hay-meadow by a hot-blooded kinsman of ${c.p.head}. It was a killing in the middle of a settled peace, and every man who swore to it knows what that means.`, hotLine(c.p.toll)]),
      options: (c) => {
        const f = fd(c), v = c.p.value, away = !!c.state.expedition;
        const hot = () => { const p = c.p.hotId && c.state.people[c.p.hotId]; return p && p.deathYear == null && !p.left ? p : null; };
        if (c.p.side === 'you') {
          const payP = Math.min(0.85, 0.7 + c.head.attrs.honor / 500), abroadP = Math.min(0.9, 0.82 + c.head.attrs.honor / 700);
          return [
            { id: 'defend', label: `Stand behind ${c.p.hotName}`, desc: 'Honor +1. War resumes at once and ' + c.p.head + ' will want blood.',
              run: () => { c.honor(1, `You stood behind ${c.p.hotName}`); up(c, 2); sour(c, -12); return `You told ${c.p.head}'s messenger that your man was provoked and the family would answer for him. By morning both houses were counting weapons.`; } },
            { id: 'pay', label: 'Pay twice the blood-price and keep the peace', cost: v * 2, desc: `${ells(v * 2)}. ${cap(word(payP))}. Honor −0.5. ${c.p.hotName} stays under your roof.`,
              run: () => { c.pay(v * 2); if (c.rng.chance(payP)) { c.honor(-0.5, 'You paid for a broken peace'); peace(c, 8, 6); return `${c.p.head} counted the silver twice and agreed to say nothing. ${c.p.hotName} will not be allowed near the ford again.`; } c.honor(-1, `${c.p.farm} took your silver and refused peace`); up(c); return `${c.p.head} took the silver and said it was a down payment.`; } },
            { id: 'abroad', label: `Send ${c.p.hotName} abroad`, cost: v, desc: `${ells(v)} for the passage and the blood-price. ${cap(word(abroadP))}. Honor +1. You lose a man, and a peace is kept.`,
              run: () => {
                c.pay(v); const p = hot(); if (p) c.removePerson(p.id);
                if (c.rng.chance(abroadP)) { c.honor(1, `You sent ${c.p.hotName} away to keep the peace`); peace(c, 10, 10); return `${c.p.hotName} sailed on the next ship, with a purse and an angry silence. ${c.p.head} watched him go and said that was a fair judgment, which from him was generous.`; }
                c.honor(0.3, `${c.p.hotName} sailed, but ${c.p.farm} wanted blood`); up(c); sour(c, -6); return `${c.p.hotName} is gone, but ${c.p.head} says an exile is not a corpse.`;
              } },
          ];
        }
        const L = F().lawChance(c.state, c.p.farm, 0.5), arb = 0.7;
        const odds = F().fightOdds(c.state, F().edge(c.state, c.p.farm) + 0.04);
        const opts = [
          { id: 'prosecute', label: 'Prosecute for a broken peace', cost: 20, desc: `${ells(20)} for the summons. Heard at the next Alþing, where witnesses and a chieftain's backing decide it. The court takes a broken peace seriously. A win outlaws ${c.p.head}.`,
            run: () => { c.pay(20); const cs = IS.Law.file(c.state, c.rng, { side: 'plaintiff', farm: c.p.farm, head: c.p.head, charge: 'broken_peace', victim: c.p.victimName, value: v * 2 }); if (cs && !true) cs.theirWitnesses += 1; return cs ? `The summons was read at ${c.p.head}'s door. The Alþing will hear it.` : 'You already have a case waiting against that house.'; } },
          { id: 'settle', label: 'Demand a double price and keep the peace', cost: 30, desc: `${ells(30)}. ${cap(word(arb))}. About ${ells(v * 1.6)}, a truce, and the right to say they broke it. Honor +0.5.`,
            run: () => { c.pay(30); if (c.rng.chance(arb)) { c.earn(v * 1.6); c.honor(0.5, `${c.p.farm} paid double for the broken peace`); peace(c, 8, 6); return `${c.p.head} paid, with the stiffness of a man paying for something he could not afford to dispute.`; } c.honor(-0.5, `${c.p.farm} refused to pay for the broken peace`); sour(c, -6); up(c); return `${c.p.head} will pay nothing, and says he is the injured party.`; } },
        ];
        if (!away) opts.push({ id: 'avenge', label: 'Ride and take a man for a man', desc: `${cap(word(odds))}. Honor +2 if it goes well. The peace is gone either way.`,
          run: () => {
            sour(c, -12);
            if (c.rng.chance(odds)) { c.honor(2, `You avenged ${c.p.victimName}`); F().slain(c.state, c.p.farm, 'them'); return `You rode in the dusk and came back in the dark. ${c.p.head} will know that the peace ended with ${c.p.victimName}, not with you.`; }
            const x = lostRide(c, `Your ride against ${c.p.farm} went wrong`);
            return `They had expected you.${x}`;
          } });
        opts.push({ id: 'swallow', label: 'Say nothing', desc: 'Honor −4. A man who forgives a broken peace invites another.',
          run: () => { c.honor(-4, `${c.p.victimName}'s killing went unanswered`); up(c); return `You made no answer. ${c.p.head} counted that as a victory.`; } });
        return opts;
      } },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
