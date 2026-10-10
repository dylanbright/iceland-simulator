/* Misfortunes and windfalls of the farming year. Each event sets "mods" that the economy applies.
 * No supernatural events: weather, sickness, fire, and what the sea brings in. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});

  const pct = (x) => Math.round(x * 100);
  const EVENTS = [
    { id: 'sheep_sickness', p: { summer: 0.04, winter: 0.03 },
      apply: (c) => { const x = c.rng.float(0.12, 0.3); c.mods.sheepLoss = (c.mods.sheepLoss || 0) + x; return `Sickness went through the flock. About ${pct(x)} in every hundred sheep died.`; } },
    { id: 'murrain', p: { summer: 0.03 },
      apply: (c) => { const x = c.rng.float(0.15, 0.35); c.mods.cattleLoss = x; return `A murrain struck the cattle. About ${pct(x)} in every hundred died.`; } },
    { id: 'cold_spring', p: { summer: 0.06 },
      apply: (c) => { c.mods.hayMult = (c.mods.hayMult || 1) * 0.8; return 'A late cold spring left the home field thin and slow.'; } },
    { id: 'wet_summer', p: { summer: 0.07 },
      apply: (c) => { c.mods.hayMult = (c.mods.hayMult || 1) * 0.88; return 'Rain lay on the cut hay for weeks and some of it rotted in the swath.'; } },
    { id: 'dry_spell', p: { summer: 0.08 },
      apply: (c) => { c.mods.hayMult = (c.mods.hayMult || 1) * 1.12; return 'A dry spell in haymaking. The hay went into the barn sweet and fast.'; } },
    { id: 'ashfall', p: { summer: 0.012 },
      apply: (c) => { c.mods.hayMult = (c.mods.hayMult || 1) * 0.6; c.mods.sheepLoss = (c.mods.sheepLoss || 0) + 0.18; return 'Ash fell from a fire in the highlands. The grass is gritty and the sheep are sick from it.'; } },
    { id: 'driftwood', p: { summer: 0.1, winter: 0.06 }, only: 'coast',
      apply: (c) => { const x = c.rng.int(20, 60); c.mods.cash = (c.mods.cash || 0) + x; return `Good timber washed up on your shore. It is worth about ${x} ells.`; } },
    { id: 'salmon_run', p: { summer: 0.1 }, only: 'river',
      apply: (c) => { c.mods.fishMult = (c.mods.fishMult || 1) * 1.4; return 'A heavy salmon run filled the river.'; } },
    { id: 'whale', p: { summer: 0.03, winter: 0.04 }, only: 'coast',
      apply: (c) => { c.mods.rations = (c.mods.rations || 0) + 25; return 'A whale stranded on your shore. The whole household went down with knives, and the neighbors came to ask about their share.'; } },
    { id: 'hall_fire', p: { winter: 0.02 },
      apply: (c) => { c.mods.provLoss = 0.3; c.mods.condDelta = (c.mods.condDelta || 0) - 20; return 'A fire in the long house burnt part of the stores and scorched the roof.'; } },
    { id: 'damp_hay', p: { winter: 0.04 },
      apply: (c) => { c.mods.hayLoss = 0.12; return 'Damp got into the hay barn and some of the hay went bad.'; } },
    { id: 'blizzard', p: { winter: 0.05 },
      apply: (c) => { c.mods.sheepLoss = (c.mods.sheepLoss || 0) + 0.08; c.mods.cattleLoss = 0.03; return 'A blizzard caught the stock out. Several sheep and a cow were lost in the drifts.'; } },
  ];

  const FarmEvents = {
    EVENTS,
    /** Roll this season's events. Returns { mods, notes }. */
    roll(state, rng, S) {
      const ctx = { rng, mods: {}, setting: state.farm.setting };
      const notes = [];
      for (const e of EVENTS) {
        const p = e.p[S];
        if (!p || (e.only && e.only !== ctx.setting)) continue;
        if (rng.chance(p)) notes.push(e.apply(ctx));
      }
      return { mods: ctx.mods, notes };
    },
  };

  IS.FarmEvents = FarmEvents;
})();
