/* Entry point: decides which screen to show and wires the controls. */
(function () {
  'use strict';
  const IS = globalThis.IS;
  const app = document.getElementById('app');
  let state = null;

  function seedFromHash() {
    const m = /seed=([^&]+)/.exec(location.hash);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function show(node, keepScroll) { const y = window.scrollY; app.replaceChildren(node); window.scrollTo(0, keepScroll ? y : 0); }
  function showError(e) {
    console.error(e);
    app.replaceChildren(IS.dom.h('div', { class: 'page' }, IS.dom.h('main', { class: 'stub' },
      IS.dom.h('h1', null, 'Something went wrong'),
      IS.dom.h('p', null, String(e && e.message ? e.message : e)),
      IS.dom.h('div', { class: 'btns' }, IS.dom.h('button', { class: 'btn', type: 'button', onclick: () => roll(IS.RNG.randomSeed()) }, 'Roll a new family')))));
  }

  const startCtl = {
    hasSave: () => IS.Game.hasSave(),
    setSeed(seed) { if (seed && seed !== state.seed) roll(seed); },
    reroll() { roll(IS.RNG.randomSeed()); },
    begin() { IS.Game.save(state); showGame(); },
    continueSaved() {
      const s = IS.Game.load();
      if (s) { state = s; showGame(); }
    },
  };
  const gameCtl = {
    resolve(plan) { IS.Turn.resolve(state, plan); IS.Game.save(state); showGame(); },
    choose(optionId) { IS.Household.choose(state, optionId); IS.Game.save(state); showGame(); },
    proceed() { IS.Turn.proceed(state); IS.Game.save(state); showGame(); },
    replan(plan) { showGame(plan, true); },
    dismissOutcome() { state.outcome = null; IS.Game.save(state); showGame(); },
    abandon() { IS.Game.clearSave(); roll(IS.RNG.randomSeed()); },
  };

  function showStart() { try { show(IS.ui.startScreen(state, startCtl)); } catch (e) { showError(e); } }
  function showGame(plan, keepScroll) { try { show(IS.ui.playScreen(state, gameCtl, plan), keepScroll); } catch (e) { showError(e); } }

  function roll(seed) {
    try {
      state = IS.Game.newGame(seed);
      history.replaceState(null, '', '#seed=' + encodeURIComponent(seed));
      showStart();
    } catch (e) { showError(e); }
  }

  roll(seedFromHash() || IS.RNG.randomSeed());
})();
