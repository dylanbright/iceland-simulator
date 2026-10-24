/* Game state: creation, save/load. State is plain JSON; the RNG is reproducible from the seed. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});

  const SAVE_KEY = 'icelandsim.save.v1';
  const SAVE_VERSION = 2;

  /** Small, save-friendly summary of the ancestry (the full object is only needed during creation). */
  function compactAncestry(a) {
    return {
      region: a.region,
      startYear: a.startYear,
      prologue: a.prologue,
      generations: a.generations.map((g) => ({
        role: ['great-grandfather', 'grandfather', 'father'][g.gi],
        name: IS.Names.fullName(g.man), first: g.man.first, byname: g.man.byname,
        birthYear: g.man.birthYear, deathYear: g.man.deathYear,
        honor: g.honor, cause: g.cause.id, traits: g.man.traits.slice(),
        marriages: g.marriages.map((m) => ({ wife: IS.Names.fullName(m.wife), kinFarm: m.kinFarm, startY: m.startY, endY: m.endY, endReason: m.endReason })),
        estate: g.estate,
      })),
      inheritance: a.inheritance,
      timeline: a.timeline,
    };
  }

  const Game = {
    SAVE_KEY, SAVE_VERSION,
    compactAncestry,

    /** Create a new game from a seed. Returns the state object. */
    newGame(seed, opts) {
      const ancestry = IS.Ancestry.generate(seed, opts);
      const start = IS.Start.build(ancestry);
      const state = {
        version: SAVE_VERSION,
        seed: String(seed),
        startYear: ancestry.startYear,
        turn: 0,
        rngState: new IS.RNG(seed).fork('game').getState(),
        ancestry: compactAncestry(ancestry),
      };
      Object.assign(state, start);
      const rng = new IS.RNG(seed).fork('game');
      state.idn = 0;
      state.away = state.away || [];
      state.history = [];
      state.deadHeads = [];
      state.lastPlan = null;
      state.mode = 'plan';
      state.pending = [];
      state.relations = {};
      state.feuds = [];
      IS.Feud.seed(state);
      state.peakHonor = state.people[state.headId].attrs.honor;
      IS.Economy.initFarm(state, rng.fork('farm'));
      // the starting wife's family is a house of the district too, so her kin can matter
      for (const id of state.household.wives) {
        const w = state.people[id], k = w && w.kin;
        if (k && k.farm && state.families && !state.families[k.farm]) state.families[k.farm] = { farm: k.farm, head: IS.Names.male(rng.fork('kin' + id)), tier: k.tier || 2, roles: ['wife-kin'], goði: false };
      }
      state.chronicle = []; state.sagaStats = { kills: 0, burnings: 0, ambitions: 0, raids: 0 };
      { const w = state.household.wives.map((id) => state.people[id])[0]; if (w) IS.Saga.note(state, 'startwife', `He was married to ${IS.Names.fullName(w)}${w.kin && w.kin.farm ? ` of ${w.kin.farm}` : ''}.`, 0); }
      IS.Saga.seedAmbition(state, rng.fork('ambition'));
      IS.Turn.prepare(state, rng.fork('prepare'));
      state.rngState = rng.getState();
      return state;
    },

    turnInfo(state) { return IS.Calendar.turnInfo(state.turn, state.startYear); },
    head(state) { return state.people[state.headId]; },
    person(state, id) { return state.people[id]; },
    /** Current in-game year for age calculations. */
    year(state) { return IS.Calendar.turnInfo(state.turn, state.startYear).year; },
    age(state, p) { return Game.year(state) - p.birthYear; },

    /* ---------- save / load (browser) ---------- */
    serialize(state) { return JSON.stringify(state); },
    deserialize(text) {
      const s = JSON.parse(text);
      if (!s || s.version !== SAVE_VERSION) throw new Error('Unsupported save version');
      return s;
    },
    save(state) {
      try { localStorage.setItem(SAVE_KEY, Game.serialize(state)); return true; } catch (e) { return false; }
    },
    load() {
      try { const t = localStorage.getItem(SAVE_KEY); return t ? Game.deserialize(t) : null; } catch (e) { return null; }
    },
    hasSave() { return !!Game.load(); },
    clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } },
  };

  IS.Game = Game;
})();
