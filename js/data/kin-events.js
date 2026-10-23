/* Danger inside the house (core/history.js): a hot-tempered son, a wives' quarrel, a brother who wants the land.
 * Plus the letters and cargoes that come back from Greenland. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const F = () => IS.Feud;
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const note = (c, k, x, w) => IS.Saga && IS.Saga.note(c.state, k, x, w);
  const live = (c, key) => c.state.household[key].map((id) => c.state.people[id]).filter((p) => p && p.deathYear == null);
  const happy = (w, d) => { if (w && w.attrs) w.attrs.happiness = Math.max(0, Math.min(100, w.attrs.happiness + d)); };

  const DEFS = [
    /* ---------- the hot-tempered son ---------- */
    { id: 'son_hothead', w: 0.9,
      needs: (c) => {
        const s = IS.History.hotSon(c.state, c.rng);
        if (!s) return null;
        const n = c.neighbor();
        if (!n || !n.head) return null;
        return { id: s.id, farm: n.farm, head: n.head, step: Math.min(2, s.hotCount || 0) };
      },
      title: (c) => { const s = c.state.people[c.p.id]; return [`${s.first} has struck a man at the horse-fight`, `${s.first} has made a verse about ${c.p.head}`, `${s.first} has killed a man of ${c.p.farm}`][c.p.step]; },
      body: (c) => {
        const s = c.state.people[c.p.id], a = c.age(s);
        return [[
          `${s.first}, your son, is ${a} and has a temper like a struck flint. At the horse-fight he quarrelled with a son of ${c.p.head} of ${c.p.farm} over whose stallion had won, and knocked him down in front of everyone. ${c.p.head} has sent to ask what you mean to do about it.`,
          `${s.first} has made a verse about ${c.p.head} of ${c.p.farm}, and it is a good one, which is the trouble. It is being repeated at every farm in the valley. ${c.p.head} is not laughing.`,
          `${s.first} met a man of ${c.p.farm} on the road. Words were said about ${c.p.head}, and ${s.first} answered them with his axe. The man is dead. ${s.first} came home and sat by the fire as if nothing had happened, and said only that the man had asked for it.`,
        ][c.p.step], 'You did not choose this quarrel. Your son chose it for you.'];
      },
      options: (c) => {
        const s = c.state.people[c.p.id], step = c.p.step, v = F().wergild(c.state, 'kin');
        const price = [40, 70, v][step];
        const grow = () => { s.hotCount = (s.hotCount || 0) + 1; };
        return [
          { id: 'back', label: `Stand behind ${s.first}`, desc: `Honor +${step === 2 ? 2 : 1}. ${c.p.head} becomes your enemy${step === 2 ? ', and a killing must be answered' : ''}.`,
            run: () => {
              grow(); c.honor(step === 2 ? 2 : 1, `You stood behind your son ${s.first}`); c.goodwill(c.p.farm, step === 2 ? -30 : -15);
              F().ensure(c.state, c.p.farm, `your son ${s.first}'s quarrel`);
              if (step === 2) { F().slain(c.state, c.p.farm, 'them'); const f = F().get(c.state, c.p.farm); if (f) f.owedThem += v; note(c, 'hothead', `His son ${s.first} killed a man of ${c.p.farm}, and he stood behind him.`, 2.5); }
              return step === 2 ? `You told ${c.p.head}'s messenger that the man had been warned. ${s.first} sleeps with his axe now, and so do you.` : `You told ${c.p.head} that your son had done nothing a man should apologize for. ${s.first} looked at you as he never had before.`;
            } },
          { id: 'pay', label: `Pay ${c.p.head} for what your son did`, cost: price, desc: `${ells(price)}. The quarrel ends here. ${s.first} will not thank you.`,
            run: () => { c.pay(price); grow(); c.goodwill(c.p.farm, step === 2 ? -6 : 4); if (step === 2) c.honor(-0.5, `You paid for your son ${s.first}'s killing`); s.hotCalm = c.state.turn + 2; return step === 2 ? `You paid the full price of the dead man and gave ${c.p.head} your hand on it. ${s.first} said you had bought peace with his honor.` : `You paid, and ${c.p.head} accepted. ${s.first} went out and broke a gate.`; } },
          { id: 'restrain', label: `Take ${s.first} in hand`, desc: 'Keep him at home and hard at work. He may settle, or he may leave.',
            run: () => {
              if (c.rng.chance(0.3)) { c.removePerson(s.id); note(c, 'hothead', `His son ${s.first} quarrelled with him and left to go raiding abroad.`, 1.5); c.goodwill(c.p.farm, -5); return `${s.first} said he would not be kept like a dog. He took his weapons and a horse and went down to the ships. You do not know where he is.`; }
              s.hotCalm = c.state.turn + 6; c.goodwill(c.p.farm, -5); return `You kept ${s.first} at the haymaking and the peat-cutting from dawn to dark. He is too tired to quarrel, for now.`;
            } },
          { id: 'abroad', label: `Send ${s.first} abroad to cool off`, cost: 60, desc: `${ells(60)} for his passage. He leaves the house, and the quarrel leaves with him.`,
            run: () => { c.pay(60); c.removePerson(s.id); c.goodwill(c.p.farm, step === 2 ? -8 : 2); note(c, 'hothead', `His son ${s.first} was sent abroad after a quarrel with ${c.p.farm}.`, 1); return `${s.first} sailed for Norway with a sword and a letter to a kinsman. Maybe he will come back a wiser man. Maybe he will just come back.`; } },
        ];
      } },

    /* ---------- the wives' quarrel (Hallgerðr and Bergþóra) ---------- */
    { id: 'wives_quarrel', w: 0, needs: () => null,
      title: (c) => [null, `${c.wname} and ${c.p.nwife} at the feast`, `A thrall of ${c.p.farm} is dead`, `${c.p.nwife} answers`, `The women's quarrel reaches the men`][c.p.stage],
      body: (c) => {
        const t = [null,
          `At the feast at ${c.p.farm}, ${c.p.head}'s wife ${c.p.nwife} asked ${c.wname} to move down the bench for a guest. ${c.wname} would not. Things were said that both women will remember. ${c.p.head} is your friend, and he laughed it off. ${c.wname} did not laugh.`,
          `${c.p.nwife}'s thrall was found dead in the woods. One of your men did it, and everyone knows ${c.wname} sent him. She says ${c.p.nwife} had it coming. ${c.p.head} is still your friend, and has sent word that he would rather be paid than be your enemy.`,
          `${c.p.dead}, one of your people, was killed on the shore, and the killer was ${c.p.nwife}'s man. ${c.p.head} has ridden over himself with the price of a man in a bag, before you even asked for it. He says the women will not stop, but the men can still keep faith.`,
          `It has gone too far for silver. ${c.p.nwife} goaded a kinsman of ${c.p.head}'s into it, and ${c.p.dead} of your house is dead. ${c.p.head} did not want it, but he is bound to his kin now, and you are bound to yours.`];
        return [t[c.p.stage]];
      },
      options: (c) => {
        const stage = c.p.stage, w = c.wife, P = IS.Economy.C.PRICE;
        const end = () => { c.state.wq = null; };
        const restrain = { id: 'restrain', label: `Forbid ${c.wname} to go on with it`, desc: `${c.wname} will be very angry with you. It may end the quarrel.`,
          run: () => { happy(w, -12); if (c.rng.chance(0.55)) { end(); return `You told ${c.wname} it was finished. She did not speak to you for a week. But it is finished.`; } return `You told ${c.wname} it was finished. She agreed so readily that you know it is not.`; } };
        if (stage === 1) return [
          restrain,
          { id: 'back', label: `Stand by ${c.wname}`, desc: 'Honor +0.5. Your friendship with ' + c.p.head + ' cools.', run: () => { c.honor(0.5, `You stood by ${c.wname} against ${c.p.nwife}`); c.goodwill(c.p.farm, -6); happy(w, 6); return `You said your wife sits where she pleases. ${c.p.head} raised his eyebrows and changed the subject.`; } },
          { id: 'laugh', label: 'Laugh it off with ' + c.p.head, desc: 'The men stay friends. The women do not.', run: () => { happy(w, -4); return `You and ${c.p.head} drank together and agreed that women are women. Neither of your wives agreed.`; } },
        ];
        if (stage === 2) { const price = Math.round(P.thrall * 1.2); return [
          { id: 'pay', label: `Pay ${c.p.head} the price at once`, cost: price, desc: `${ells(price)}. The friendship holds, whatever the women do.`,
            run: () => { c.pay(price); c.goodwill(c.p.farm, 4); c.honor(0.5, `You kept faith with ${c.p.head}`); return `You paid it in his yard, in front of his people, and he gave you his hand. ${c.wname} called you a fool for it.`; } },
          restrain,
          { id: 'deny', label: 'Say your man acted alone', desc: 'No cost. ' + c.p.head + ' will not believe it.', run: () => { c.goodwill(c.p.farm, -15); happy(w, 4); return `${c.p.head} heard you out and rode home without a word. That was worse than shouting.`; } },
        ]; }
        if (stage === 3) {
          const price = Math.round(P.thrall * 1.5);
          return [
            { id: 'accept', label: `Take ${c.p.head}'s silver and keep the friendship`, desc: `About ${ells(price)}. Two friends keeping faith while their wives make war.`,
              run: () => { c.earn(price); c.goodwill(c.p.farm, 6); c.honor(0.5, `You and ${c.p.head} kept faith`); note(c, 'wives', `His wife ${c.wname} and ${c.p.nwife} of ${c.p.farm} had their servants killed, each in turn, and the two husbands paid for every one and stayed friends.`, 2); return `You took the bag and put your hand on his shoulder. People said it was a strange friendship, and a fine one.`; } },
            restrain,
            { id: 'avenge', label: 'Answer it in kind', desc: 'The friendship ends. A feud begins.', run: () => { c.goodwill(c.p.farm, -30); F().ensure(c.state, c.p.farm, `the quarrel between ${c.wname} and ${c.p.nwife}`); F().escalate(c.state, c.p.farm, 2); end(); happy(w, 8); return `You sent the silver back. ${c.wname} smiled for the first time in a month.`; } },
          ];
        }
        // stage 4: a man of the house
        const val = F().wergild(c.state, 'kin');
        return [
          { id: 'feud', label: 'It is a feud now', desc: 'The friendship is over. The killing will have to be answered, one way or another.',
            run: () => { F().ensure(c.state, c.p.farm, `the women's quarrel that ended in a killing`); F().escalate(c.state, c.p.farm, 3); c.goodwill(c.p.farm, -40); end(); c.state.pending.push({ id: 'feud_kin', wifeId: null, kind: 'event', params: { farm: c.p.farm, head: c.p.head, victim: c.p.dead || 'your man', relation: c.p.rel === 'servant' ? 'servant' : (c.p.rel || 'kinsman'), value: val } }); note(c, 'wives', `The quarrel between his wife ${c.wname} and ${c.p.nwife} ended in a killing, and two friends became enemies.`, 3); return `${c.p.head} sent word that he was sorry, and that it changed nothing. You knew that already.`; } },
          { id: 'mend', label: `Ride to ${c.p.head} and try to save the friendship`, cost: 40, desc: `${ells(40)}. About even odds. If he agrees, he pays the full price and sends the killer away.`,
            run: () => { c.pay(40); end(); if (c.rng.chance(0.5)) { c.earn(val); c.goodwill(c.p.farm, 5); c.honor(1, `You and ${c.p.head} kept the peace`); return `${c.p.head} paid the full price and sent his kinsman out of the district. You both looked older at the end of it.`; } F().ensure(c.state, c.p.farm, `the women's quarrel`); F().escalate(c.state, c.p.farm, 2); c.goodwill(c.p.farm, -25); return `${c.p.head} said his kin would not let him. You rode home an enemy.`; } },
        ];
      } },

    /* ---------- a brother wants the land ---------- */
    { id: 'inherit_claim', w: 0, needs: () => null,
      title: (c) => `${c.p.brother} claims his share of the land`,
      body: (c) => [`${c.p.brother} took his share of the stock and silver when ${c.p.father} died. Now he says that was only the movables. The law divides land between brothers too, and he wants his.`,
        'He has brought witnesses. He is your brother, and he means it.'],
      options: (c) => {
        const f = c.state.farm, part = Math.round(f.landValue * 0.3), buy = Math.round(f.landValue * 0.22);
        return [
          { id: 'divide', label: 'Divide the land with him', desc: `You lose about ${ells(part)} of land (a third of the hayfield). He farms next door, and stands with you. Honor +1.`,
            run: () => { f.landValue -= part; const farm = IS.History.brotherFarm(c.state, { first: c.p.brother }, 40); c.honor(1, `You divided the land with ${c.p.brother}`); note(c, 'brother', `He divided the land with his brother ${c.p.brother}, who built a farm at ${farm}.`, 1.5); return `You walked the new boundary together and set the stones. ${c.p.brother} has built at ${farm}, a shout away.`; } },
          { id: 'buy', label: 'Buy him out with silver', cost: buy, desc: `${ells(buy)}. You keep the land. He goes, satisfied.`,
            run: () => { c.pay(buy); c.honor(0.3, `You bought out your brother ${c.p.brother}`); return `${c.p.brother} counted the silver twice, shook your hand, and rode south to look for land of his own.`; } },
          { id: 'refuse', label: 'Refuse him', desc: 'Honor −1. He sets up on the edge of the valley, and he will not be a friendly neighbor.',
            run: () => { const farm = IS.History.brotherFarm(c.state, { first: c.p.brother }, -55); F().ensure(c.state, farm, 'the land your father left'); const fd = F().get(c.state, farm); if (fd) fd.owedThem += part * 0.5; c.honor(-1, `You refused your brother ${c.p.brother} his share`); note(c, 'brother', `He refused his brother ${c.p.brother} a share of the land, and they were enemies after.`, 2.5); return `${c.p.brother} said that your father would be ashamed of you. He built a poor farm at ${farm}, at the edge of the valley, and he has a long memory.`; } },
        ];
      } },

    /* ---------- word from Greenland ---------- */
    { id: 'green_letter', w: 3,
      needs: (c) => (c.state.greenSon && !c.state.greenSon.done && c.state.turn >= c.state.greenSon.turn + 6 ? {} : null),
      title: (c) => `Word from ${c.state.greenSon.name} in Greenland`,
      body: (c) => [`A ship in from Greenland brought a skipper who knew your son ${c.state.greenSon.name}. He has a farm in the fjords, a wife, and a son named after you. He sends you a walrus tusk and his greetings.`],
      options: (c) => [{ id: 'ok', label: 'Keep the tusk by the high seat', desc: 'About 120 ells of ivory, and a story to tell. Honor +0.5.',
        run: () => { c.state.greenSon.done = true; c.earn(120); c.honor(0.5, `Your son ${c.state.greenSon.name} prospers in Greenland`); return 'You set the tusk by the high seat where guests would see it.'; } }] },
    { id: 'ivory_return', w: 3,
      needs: (c) => (c.state.greenShare && !c.state.greenShare.done && c.state.turn >= c.state.greenShare.turn ? {} : null),
      title: () => 'The Greenland cargo',
      body: () => ['The ship you put silver into has come back from Greenland, or some of it has.'],
      options: (c) => [{ id: 'ok', label: 'See what the skipper brought', desc: 'Profit, loss, or nothing.',
        run: () => { c.state.greenShare.done = true; const r = c.rng.float(0, 1); if (r < 0.3) return 'The ship went down off the glaciers. Your silver is at the bottom of the sea.'; if (r < 0.75) { c.earn(260); return 'Walrus ivory and sealskins: your share came to about 260 ells.'; } c.earn(520); return 'A fine cargo of ivory and white falcons for the Norwegian court. Your share came to about 520 ells.'; } }] },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
