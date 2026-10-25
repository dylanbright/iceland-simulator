/* The battle screen: a few rounds between named men. One round per choice.
 *
 * A battle is a pending event { id: 'battle', params: { kind, farm, head, round, us[], them[], log[], ... } }.
 * Each fighter: { pid (a person of your house, or null), name, str, hp: 2 fit / 1 wounded / 0 down, dead, lead }
 * Stances: wall (hold), press (attack), leader (go for their leader), fall (break off), and per kind
 * peace (a Thing brawl: call on the peacemakers).
 * Outcomes ('won' | 'held' | 'lost' | 'fled' | 'draw') are applied by Battle.OUTCOME[kind] in data/law-events.js.
 */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const E = () => IS.Economy;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const MAX_ROUNDS = 4;

  const STANCE = {
    wall:   { atk: 0.7, def: 0.6, word: 'Hold the shield wall' },
    press:  { atk: 1.5, def: 1.05, word: 'Press the attack' },
    leader: { atk: 1.1, def: 1.05, word: 'Go for their leader' },
    feint:  { atk: 1.8, def: 1.45, word: 'Feint, then go for the killing blow' },
  };
  const THEIRS = [{ atk: 1.3, def: 1.2 }, { atk: 1.3, def: 1.2 }, { atk: 0.7, def: 0.6 }, { atk: 1.0, def: 1.15 }];

  /** Your side: the head (unless away), the men of the house, hired guards and friends' men. */
  function ourSide(state, spec) {
    const out = [], head = state.people[state.headId];
    if (!spec.noHead && head && head.deathYear == null && (spec.forceHead || !state.expedition)) out.push({ pid: head.id, name: head.first, str: head.attrs.strength, hp: 3, lead: true });
    if (!spec.alone) for (const p of (IS.Raid ? IS.Raid.raiders(state) : []).slice(0, 7)) out.push({ pid: p.id, name: p.first, str: p.attrs.strength || 45, hp: 2 });
    {
      const rng = spec.rng;
      for (let i = 0; i < (spec.hired || 0); i++) out.push({ pid: null, name: IS.Names.male(rng).first, tag: 'hired', str: 50, hp: 2 });
      for (let i = 0; i < (spec.friends || 0); i++) out.push({ pid: null, name: IS.Names.male(rng).first, tag: spec.friendFarm ? 'of ' + spec.friendFarm : 'friend', str: 48, hp: 2 });
    }
    if (spec.companion) { const p = state.people[spec.companion]; if (p && p.deathYear == null) out.push({ pid: p.id, name: p.first, str: p.attrs.strength || 45, hp: 2 }); }
    return out;
  }
  function theirSide(rng, n, headName, power, taken) {
    const used = new Set([...(taken || []), headName]);
    const out = [{ pid: null, name: headName, str: clamp(Math.round(52 + 10 * (power || 0) + rng.normal(0, 6)), 35, 80), hp: 3, lead: true }];
    for (let i = 1; i < n; i++) {
      let nm = IS.Names.male(rng).first, g = 0;
      while (used.has(nm) && g++ < 20) nm = IS.Names.male(rng).first;
      used.add(nm);
      out.push({ pid: null, name: nm, str: clamp(Math.round(46 + rng.normal(0, 7)), 30, 70), hp: 2 });
    }
    return out;
  }

  /** Build a battle item. spec: { kind, farm, head, force, hired, friends, friendFarm, alone, companion, power, extra } */
  function start(state, rng, spec) {
    const us = ourSide(state, Object.assign({ rng }, spec));
    const n = clamp(Math.round(spec.force || 6), spec.kind === 'duel' ? 1 : 2, 10);
    const them = theirSide(rng, n, spec.head, spec.power, us.map((m) => m.name));
    for (const m of [...us, ...them]) m.max = m.hp;
    return { id: 'battle', wifeId: null, kind: 'event', params: Object.assign({ kind: spec.kind, farm: spec.farm, head: spec.head, round: 1, us, them, log: [], usStart: us.length, themStart: them.length }, spec.extra || {}) };
  }

  const up = (side) => side.filter((m) => m.hp > 0);
  const leader = (side) => side.find((m) => m.lead);
  function strike(rng, attackers, defenders, atk, def, focusLeader, edge) {
    const lines = [];
    for (const a of up(attackers)) {
      const targets = up(defenders);
      if (!targets.length) break;
      const p = clamp(0.28 * (a.str / 50) * (a.hp === 1 ? 0.6 : 1) * atk * def * (1 + edge), 0.05, 0.8);
      if (!rng.chance(p)) continue;
      const L = leader(defenders);
      const t = focusLeader && L && L.hp > 0 && rng.chance(0.45) ? L : rng.pick(targets);
      t.hp -= 1;
      if (t.hp <= 0) { t.dead = rng.chance(t.pid ? 0.42 : 0.55); lines.push({ a: a.name, t: t.name, down: true, dead: t.dead, tLead: !!t.lead }); }
      else lines.push({ a: a.name, t: t.name, down: false, tLead: !!t.lead });
    }
    return lines;
  }
  const broken = (side, start, frac) => up(side).length <= Math.max(1, Math.floor(start * frac));
  /** The ground: defenders at a door (or on a scree slope) are hard to reach, and attackers lose heart sooner. */
  const GROUND = {
    burning: { ours: 1.1, early: 0.6, late: 0.85, themBreak: 0.6, usBreak: 0.3 },
    hunters: { ours: 1.1, early: 0.7, late: 0.8, themBreak: 0.55, usBreak: 0 },
    thing:   { ours: 1, early: 1, late: 1, themBreak: 0.5, usBreak: 0.5 },
    // single combat: every blow matters, and it ends when one man is down
    duel:    { ours: 2.2, early: 2.2, late: 2.2, themBreak: 0, usBreak: 0, leaderFalls: 1 },
    // a hall attacked at night: surprise first, then a proper fight
    hall:    { ours: 1.15, early: 0.75, late: 1, themBreak: 0.5, usBreak: 0.4 },
  };

  /** Fight one round with the chosen stance. Mutates params. Returns { lines, end: null | outcome }. */
  function round(state, rng, params, stance) {
    const S = STANCE[stance] || STANCE.wall;
    const theirs = rng.pick(THEIRS);
    const edge = (params.edge || 0);
    // a burning: the attackers have the fire; from the third round the smoke wears on the defenders
    const fire = params.kind === 'burning' && params.round >= 3;
    const ground = GROUND[params.kind] || GROUND.thing;
    const ours = strike(rng, params.us, params.them, S.atk * ground.ours, theirs.def, stance === 'leader', edge);
    const guard = params.kind === 'duel' && stance === 'wall' ? 0.7 : 1; // on the cloaks a man who only defends is hard to hit
    const hits = strike(rng, params.them, params.us, theirs.atk * (params.round < 3 ? ground.early : ground.late), S.def * guard, rng.chance(0.25), -edge);
    const lines = [];
    const say = (h, mine) => {
      if (h.down) lines.push(`${h.a} ${h.dead ? 'killed' : 'cut down'} ${h.t}${h.tLead ? (mine ? ', their leader' : '') : ''}.`);
      else lines.push(`${h.a} wounded ${h.t}.`);
    };
    ours.forEach((h) => say(h, true));
    hits.forEach((h) => say(h, false));
    if (fire) for (const m of up(params.us)) if (rng.chance(0.15)) { m.hp -= 1; if (m.hp <= 0) { m.dead = rng.chance(0.4); lines.push(`${m.name} was overcome by the smoke.`); } }
    if (!lines.length) lines.push('The two lines pushed and shoved, and nobody fell.');
    params.log = [`Round ${params.round}: ${lines.join(' ')}`].concat(params.log).slice(0, 6);
    // the end?
    const theirLead = leader(params.them), ourLead = leader(params.us);
    let end = null;
    if (!up(params.us).length || (ourLead && ourLead.hp <= 0 && ourLead.dead)) end = 'lost';
    else if ((ground.themBreak && broken(params.them, params.themStart, ground.themBreak)) || !up(params.them).length || (theirLead && theirLead.hp <= 0 && rng.chance(ground.leaderFalls || 0.6))) end = 'won';
    else if (ground.usBreak && broken(params.us, params.usStart, ground.usBreak)) end = 'lost';
    else if (params.round >= (params.maxRounds || MAX_ROUNDS)) end = params.kind === 'burning' || params.kind === 'hunters' ? 'held' : 'draw';
    params.round++;
    return { lines, end };
  }

  /** The persons of your house who fell (killed for good): for the outcome to bury. */
  const ourDead = (params) => params.us.filter((m) => m.pid && m.hp <= 0 && m.dead);
  const theirDead = (params) => params.them.filter((m) => m.hp <= 0 && m.dead).length;
  /** Odds of the whole fight as a word, for the option text that leads into it. */
  function oddsWord(state, spec) {
    const us = ourSide(state, Object.assign({ rng: { pick: (a) => a[0], normal: () => 0 } }, spec, { hired: spec.hired || 0, friends: spec.friends || 0 }));
    const n = clamp(Math.round(spec.force || 6), 2, 10);
    const r = us.reduce((s, m) => s + m.str, 0) / (n * 48 + (spec.power || 0) * 10);
    return r >= 1.3 ? 'you have the stronger side' : r >= 0.95 ? 'about even' : r >= 0.65 ? 'they have more men' : 'they far outnumber you';
  }

  IS.Battle = { STANCE, MAX_ROUNDS, start, round, up, leader, ourDead, theirDead, oddsWord, OUTCOME: {} };
})();
