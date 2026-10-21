/* Events of the story layer (core/saga.js and the warnings in core/feud.js):
 *   ambition_new - an ambition is fulfilled; the family chooses the next
 *   warn_coming  - a heavy feud blow is seen a season ahead; prepare for it
 */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const F = () => IS.Feud;
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const word = (p) => F().oddsWord(p);

  const DEFS = [
    { id: 'ambition_new', w: 0, needs: () => null,
      title: () => 'What the family wants next',
      body: (c) => [c.p.done ? `It is done: ${c.p.done.charAt(0).toLowerCase() + c.p.done.slice(1)}. People will speak of it. But a family that wants nothing is already in decline, and the household looks to you for what comes next.` : 'The household has gone a while without a purpose, and your sons and kinsmen have begun to ask what this family is for.'],
      options: (c) => {
        if (!c.p.ids) c.p.ids = IS.Saga.choices(c.state, c.rng, 3);
        const opts = c.p.ids.map((id) => {
          const hook = id === 'avenge' ? (c.state.hooks || []).find((h) => h.type === 'unavenged_killing' && h.farm) : null;
          const a = IS.Saga.makeAmbition(c.state, id, hook);
          return { id, label: a.text, desc: IS.Saga.hintOf(a),
            run: () => { c.state.ambition = IS.Saga.makeAmbition(c.state, id, hook); return `The household has a new purpose: ${a.text.charAt(0).toLowerCase() + a.text.slice(1)}.`; } };
        });
        opts.push({ id: 'rest', label: 'Want nothing more for now', desc: 'You can choose again when the next season turns.',
          run: () => { c.state.ambition = null; c.state.ambitionAsk = c.state.turn + 2; return 'You are content, for now. The household is not sure it likes that.'; } });
        return opts;
      } },

    { id: 'warn_coming', w: 0, needs: () => null,
      title: (c) => (c.p.act === 'burning' ? `A warning: ${c.p.farm} means to burn you out` : `A warning: ${c.p.farm} means to kill one of yours`),
      body: (c) => {
        const what = c.p.act === 'burning' ? 'to come with fire' : 'to kill a man of your house';
        const how = {
          shepherd: `Your shepherd came down from the high pasture at a run. He saw ${c.p.head}'s men gathering at ${c.p.farm}, more than a farm needs, with their weapons and spare horses.`,
          kinsman: `A kinsman sends word by a boy on a lathered horse: ${c.p.head} of ${c.p.farm} has been heard saying at his own table that he means ${what} before the season is out.`,
          beggar: `A beggar woman who goes from farm to farm sat by your fire and said, between mouthfuls, that ${c.p.head}'s men are sharpening weapons and talking about your farm.`,
          dream: `${c.p.dreamer} woke in the night and would not sleep again. She dreamed of wolves circling the farm, and their eyes were like fire. She says it means men are coming from ${c.p.farm}, and nobody laughs.`,
        }[c.p.how] || `Word has come that ${c.p.head} of ${c.p.farm} means ${what}.`;
        return [how, 'Whatever is coming will come next season. You have that long to make ready.'];
      },
      options: (c) => {
        const guardCost = 60 + 25 * c.tier, bindCost = 80 + 20 * c.tier;
        const f = F().get(c.state, c.p.farm);
        const strike = F().fightOdds(c.state, F().edge(c.state, c.p.farm) + 0.05), bind = F().lawChance(c.state, c.p.farm, 0.25);
        const opts = [
          { id: 'guard', label: 'Hire men to guard the farm', cost: guardCost, desc: `${ells(guardCost)}. They may turn him back${c.p.act === 'burning' ? ', and if he comes anyway you will fight with more men at the door' : ''}.`,
            run: () => { c.pay(guardCost); if (f) f.guard = 1; return 'You took on hard men from the next valley for the season, and set a watch every night.'; } },
        ];
        if (c.p.act === 'burning' && (c.state.household.wives.length || c.state.household.children.length)) opts.push({ id: 'send', label: 'Send the women and children to kin', desc: 'Nobody but the men will be in the house if it burns. The wives will not thank you for the journey.',
          run: () => { if (f) f.spare = true; c.state.household.wives.forEach((id) => { const w = c.state.people[id]; if (w && w.attrs) w.attrs.happiness = Math.max(0, w.attrs.happiness - 4); }); return 'The women and children rode out to their kin, wrapped against the weather, and the house was very quiet after.'; } });
        if (!c.state.expedition) opts.push({ id: 'strike', label: 'Strike first', desc: `${cap(word(strike))}. A win stops him and brings Honor +2, but blood spilled first is a debt too.`,
          run: () => {
            if (c.rng.chance(strike)) { if (f) f.warned = null; c.honor(2, `You struck ${c.p.farm} before they could strike you`); F().escalate(c.state, c.p.farm, -1); return `You fell on ${c.p.head}'s men in their own yard while they were still saddling.${F().theyFall(c.state, c.rng, c.p.farm, 0.5)} Whatever he planned, it will not be this season.`; }
            c.honor(-1.5, `Your strike on ${c.p.farm} failed`);
            return `They were readier than your shepherd thought.${F().bloodshed(c.state, c.rng, c, c.p.farm, c.p.head, 0.35)} And now they know you know.`;
          } });
        opts.push({ id: 'bind', label: 'Go to the goði and have him bound to the peace', cost: bindCost, desc: `${ells(bindCost)} in gifts and fees. ${cap(word(bind))}. If it works, the blow does not fall and the quarrel cools.`,
          run: () => {
            c.pay(bindCost);
            if (c.rng.chance(bind)) { if (f) { f.warned = null; } F().escalate(c.state, c.p.farm, -1); F().bump(c.state, c.p.farm, 6); return `The goði summoned ${c.p.head} and made him swear before witnesses to keep the peace this year. He swore it with a face like stone.`; }
            return `The goði listened, took the gifts, and said a man cannot be punished for what he has not done yet.`;
          } });
        opts.push({ id: 'wait', label: 'Wait and see', desc: 'Perhaps it is only talk.', run: () => 'You told the household it was only talk. Not everyone believed you.' });
        return opts;
      } },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
