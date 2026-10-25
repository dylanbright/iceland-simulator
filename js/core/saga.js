/* The story of the line: what is remembered (Chronicle), what the family strives for (Ambition),
 * and the saga written when the line ends (Saga).
 *
 * state.chronicle[] { t: turn, y: year, k: kind, x: text, w: weight (sign = glory or shame), h: headId }
 * state.ambition    { id, text, since, base, tier, farm?, victim? }   (passes to the heir)
 * state.sagaStats   { kills, burnings, ambitions, raids }
 */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const E = () => IS.Economy;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fmt = (x) => Math.round(x).toLocaleString('en-US');
  const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; };

  /* ================= chronicle ================= */
  const MAX = 500;
  /** Season-by-season Honor that is housekeeping, not story. */
  const ROUTINE = /without cloth|short of hay|went hungry|cold welcome|fine table|lavish table|open hand|wages|rent/i;
  function note(state, k, x, w, extra) {
    if (!x || (k === 'deed' && ROUTINE.test(x))) return;
    state.chronicle = state.chronicle || [];
    const t = state.turn, last = state.chronicle[state.chronicle.length - 1];
    if (last && last.t === t && last.x === x) return;
    state.chronicle.push(Object.assign({ t, y: E().yearOf(state), k, x, w: w || 0, h: state.headId }, extra || {}));
    if (state.chronicle.length > MAX) {
      const i = state.chronicle.findIndex((e) => Math.abs(e.w) < 1.2 && e.k !== 'marriage');
      state.chronicle.splice(i >= 0 ? i : 0, 1);
    }
  }
  const stat = (state, k, n) => { state.sagaStats = state.sagaStats || { kills: 0, burnings: 0, ambitions: 0, raids: 0 }; state.sagaStats[k] = (state.sagaStats[k] || 0) + (n || 1); };
  const FAMILY = ['wife', 'son', 'daughter', 'brother', 'sister', 'mother', 'stepmother', 'concubine'];
  const ROLE = { wife: 'wife', son: 'son', daughter: 'daughter', brother: 'brother', sister: 'sister', mother: 'mother', stepmother: 'stepmother', concubine: 'concubine' };
  /** A member of the family died (violent deaths weigh more). */
  function death(state, p, text, violent) {
    if (!p || !FAMILY.includes(p.role)) return;
    note(state, 'death', `${p.first}, his ${ROLE[p.role]}, ${text.replace(/\.$/, '')}.`, violent ? 2 : p.role === 'wife' || p.role === 'son' ? 1.2 : 0.6);
  }

  /* ================= ambitions ================= */
  const myTier = (state) => E().tierOfFarm(state.farm);
  const AMB = {
    avenge: {
      make: (state, h) => ({ farm: h.farm, victim: h.victimName, text: `Avenge ${h.victimName}, killed by the men of ${h.farm}` }),
      done: (state, a) => !!(state.struck && state.struck[a.farm]),
      hint: (a) => `A man of ${a.farm} must die for it, or be outlawed at the Thing.`,
    },
    standing: {
      make: (state) => { const t = Math.round(clamp(state.people[state.headId].attrs.honor + 12, 55, 80)); return { target: t, text: `Raise the family's name to Honor ${t}` }; },
      done: (state, a) => state.people[state.headId].attrs.honor >= a.target,
      hint: () => 'Feasts, victories and good judgment at the Thing.',
    },
    wealth: {
      make: (state) => { const t = Math.round(Math.max(8000, state.farm.wealth * 1.5) / 500) * 500; return { target: t, text: `Make the farm worth ${fmt(t)} ells` }; },
      done: (state, a) => E().wealth(state.farm) >= a.target,
      hint: () => 'More land, more stock, silver in the chest.',
    },
    sail: {
      ok: (state) => IS.Raid && IS.Raid.canRaid(state),
      make: (state) => ({ base: state.sagaStats ? state.sagaStats.raids || 0 : 0, text: 'Sail on a raid and come home alive' }),
      done: (state, a) => ((state.sagaStats && state.sagaStats.raids) || 0) > a.base,
      hint: () => 'A ship and crew cost a good deal of silver.',
    },
    marry: {
      ok: (state) => state.household.wives.length < 2,
      make: (state) => ({ tier: myTier(state), since: E().yearOf(state), text: 'Marry into a greater house than your own' }),
      done: (state, a) => (state.marriages || []).some((m) => m.startY >= a.since && ((m.kinTier || 0) > a.tier || (state.families && state.families[m.kinFarm] && state.families[m.kinFarm].goði))),
      hint: () => 'A wife from a richer farm, or a goði\'s family. Honor helps the suit.',
    },
    races: {
      ok: (state) => state.farm.horses > 0,
      make: (state) => ({ base: state.raceWins || 0, text: 'Win two horse races' }),
      done: (state, a) => (state.raceWins || 0) - a.base >= 2,
      hint: () => 'A fast horse, and the nerve to race it.',
    },
    table: {
      make: (state) => ({ base: state.lavishCount || 0, text: 'Keep a lavish table for three seasons' }),
      done: (state, a) => (state.lavishCount || 0) - a.base >= 3,
      hint: () => 'Choose the lavish feast in the plan. It is not cheap.',
    },
    sons: {
      make: () => ({ text: 'See two sons of yours grown to manhood' }),
      done: (state) => {
        const y = E().yearOf(state);
        return state.household.children.map((id) => state.people[id]).filter((p) => p && p.deathYear == null && p.sex === 'M' && y - p.birthYear >= 16).length >= 2;
      },
      hint: () => 'Sons must be born, and must live.',
    },
    peace: {
      ok: (state) => (state.feuds || []).length > 0,
      make: (state) => ({ since: state.turn, text: 'End every feud against your house' }),
      done: (state, a) => state.turn >= a.since + 2 && !(state.feuds || []).length,
      hint: () => 'By law, by silver, or by winning.',
    },
  };
  function makeAmbition(state, id, hook) {
    const d = AMB[id];
    return Object.assign({ id, turn: state.turn }, d.make(state, hook));
  }
  /** Three ambitions to choose from (never the one just finished). */
  function choices(state, rng, n) {
    const ids = Object.keys(AMB).filter((id) => id !== 'avenge' && (!AMB[id].ok || AMB[id].ok(state)) && !AMB[id].done(state, makeAmbition(state, id)));
    const out = [];
    const pool = ids.slice();
    while (pool.length && out.length < (n || 3)) out.push(pool.splice(Math.floor(rng.float(0, 1) * pool.length) % pool.length, 1)[0]);
    // an old killing, still unavenged, is always on the table
    const hook = (state.hooks || []).find((h) => h.type === 'unavenged_killing' && h.farm && !(state.struck && state.struck[h.farm]));
    if (hook) out[0] = 'avenge';
    return out;
  }
  /** A new game: the family's history picks its first ambition. */
  function seedAmbition(state, rng) {
    const hook = (state.hooks || []).find((h) => h.type === 'unavenged_killing' && h.farm);
    if (hook) { state.ambition = makeAmbition(state, 'avenge', hook); return; }
    const goði = (state.hooks || []).some((h) => h.type === 'grudging_goði');
    const ids = goði ? ['standing'] : choices(state, rng, 3);
    state.ambition = makeAmbition(state, ids[0] || 'standing');
  }
  const hintOf = (a) => (a && AMB[a.id] && AMB[a.id].hint ? AMB[a.id].hint(a) : '');
  /** Is the ambition fulfilled? If so: Honor, a line in the chronicle, and a choice of the next. */
  function checkAmbition(state, honor, rep) {
    const a = state.ambition;
    if (!a || a.doneTurn != null || !AMB[a.id]) return false;
    if (!AMB[a.id].done(state, a)) return false;
    a.doneTurn = state.turn;
    honor(4, `You fulfilled the family's ambition: ${a.text.charAt(0).toLowerCase() + a.text.slice(1)}`);
    stat(state, 'ambitions');
    note(state, 'ambition', `He did what the family had long wanted: ${a.text.charAt(0).toLowerCase() + a.text.slice(1)}.`, 4);
    if (rep && rep.household) rep.household.push(`The family's ambition is fulfilled: ${a.text.toLowerCase()}.`);
    state.pending = state.pending || [];
    if (!state.pending.some((p) => p.id === 'ambition_new')) state.pending.push({ id: 'ambition_new', wifeId: null, kind: 'event', params: { done: a.text } });
    return true;
  }

  /* ================= the saga ================= */
  const VERBS = 'lost|won|held|left|had|were|did|made|struck|fought|let|paid|took|bought|answered|refused|stood|sent|swore|married|kept|faced|beat|avenged|ignored|rode|sailed|killed|gave|went|could|would|brought';
  /** "You held your house against X" -> "Böðvarr held his house against X." */
  const PHRASE = [
    [/^(.+)'s raid on (.+)$/, '$1 went raiding in $2'],
    [/^A raid on (.+)$/, 'You went raiding in $1'],
    [/^Sheep of (.+) found in your flock$/, 'Sheep of $1 were found in your flock'],
    [/^(A|An) (.+)$/, 'There was $1 $2'],
  ];
  function third(text, who) {
    let t = String(text).trim().replace(/\.$/, '');
    for (const [re, to] of PHRASE) if (re.test(t)) { t = t.replace(re, to); break; }
    t = t.replace(/^There was (A|An) /, (m, a) => `There was ${a.toLowerCase()} `);
    t = t.replace(/^You were\b/, `${who} was`).replace(/^You\b/, who);
    t = t.replace(new RegExp(`\\byou (${VERBS})\\b`, 'gi'), 'he $1');
    t = t.replace(/\bYour\b/g, 'His').replace(/\byour\b/g, 'his').replace(/\byou\b/gi, 'him');
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return /[.!?]$/.test(t) ? t : t + '.';
  }
  function joiner(state, i, prevY, y, first) {
    if (first) return `In ${y}, `;
    if (prevY === y) return ['That same year ', 'In that year also ', 'The same year '][Math.floor(hash(state.seed + i) * 3)];
    if (y - prevY === 1) return ['The next year ', 'A year later ', 'The following year '][Math.floor(hash(state.seed + i) * 3)];
    if (y - prevY <= 4) return ['Some time after this ', 'A few years later ', 'Soon after '][Math.floor(hash(state.seed + i) * 3)];
    return `In ${y}, `;
  }
  const COMMON = /^(He|His|The|A|An|In|That|It|Both|One|Two|All|They|Their|Her|She)\b/;
  const lower = (s) => (COMMON.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  /** The deeds worth telling of one head: the greatest, and the worst, in the order they happened. */
  function deedsOf(state, headId) {
    const all = (state.chronicle || []).filter((e) => e.h === headId);
    const glory = all.filter((e) => e.w >= 1.5).sort((a, b) => b.w - a.w).slice(0, 6);
    const shame = all.filter((e) => e.w <= -2).sort((a, b) => a.w - b.w).slice(0, 2);
    const kin = all.filter((e) => (e.k === 'death' && e.w >= 1.2) || e.k === 'marriage' || e.k === 'burning').slice(0, 6);
    const set = new Set([...glory, ...shame, ...kin]);
    return all.filter((e) => set.has(e));
  }
  function chapter(state, headInfo, idx) {
    const p = state.people[headInfo.id] || {};
    const first = p.first || headInfo.name.split(' ')[0];
    const lines = [];
    if (idx === 0) {
      const fa = (state.ancestry.generations || []).slice(-1)[0];
      const o = state.origin || { farm: state.ancestry.region.farm || state.farm.name, valley: state.ancestry.region.valley, quarter: state.ancestry.region.quarter };
      lines.push(`There was a man named ${headInfo.name}. He lived at ${o.farm} in ${o.valley}, in the ${o.quarter} Quarter.${fa ? ` His father was ${fa.name}.` : ''}`);
      const wife = (state.chronicle || []).find((e) => e.k === 'startwife');
      if (wife) lines.push(wife.x);
    } else {
      lines.push(`After him ${headInfo.name} took the farm.`);
    }
    let prevY = null;
    const seen = new Set();
    deedsOf(state, headInfo.id).filter((e) => !seen.has(e.x) && seen.add(e.x)).forEach((e, i) => {
      const x = e.k === 'deed' ? third(e.x, first) : e.x.replace(/^He\b/, first);
      lines.push(joiner(state, i + idx * 13, prevY, e.y, prevY == null) + lower(x));
      prevY = e.y;
    });
    if (headInfo.died != null) {
      const age = p.birthYear ? headInfo.died - p.birthYear : null;
      lines.push(`${first} ${(headInfo.cause || 'died').replace(/\.$/, '')} in ${headInfo.died}${age ? `, at ${age} winters old` : ''}.`);
    }
    return { title: headInfo.name, lines };
  }
  const TIERS = [
    [0, 'Forgotten', 'No one tells of this family now. A few stones mark where the farm stood.'],
    [18, 'A short tale', 'It is told at one farm in the valley, on winter evenings, when nothing better is offered.'],
    [40, 'A saga of the district', 'Men in the district know this story, and argue about who was in the right.'],
    [75, 'A saga told across Iceland', 'This saga is told at the Alþing and on every coast. People take sides in it still.'],
    [120, 'A great saga, set down on vellum', 'In time a learned man wrote this saga down, and it has not been forgotten.'],
  ];
  function score(state) {
    const st = state.sagaStats || {};
    let s = 0;
    for (const e of state.chronicle || []) s += e.w > 0 ? Math.min(6, e.w) : Math.min(4, -e.w) * 0.6;
    s += (st.kills || 0) * 1.5 + (st.burnings || 0) * 5 + (st.ambitions || 0) * 4;
    s += ((state.deadHeads || []).length) * 3 + (state.peakHonor || 0) / 5;
    return Math.round(s);
  }
  function write(state) {
    const heads = (state.deadHeads || []).slice();
    const cur = state.people[state.headId];
    if (cur && !heads.some((x) => x.id === cur.id)) heads.push({ id: cur.id, name: IS.Names.fullName(cur), born: cur.birthYear, died: cur.deathYear, cause: cur.deathText });
    const sc = score(state);
    const tier = TIERS.filter((t) => sc >= t[0]).slice(-1)[0];
    return { title: `The saga of the people of ${(state.origin && state.origin.farm) || state.farm.name}`, chapters: heads.map((x, i) => chapter(state, x, i)), score: sc, rating: tier[1], ratingNote: tier[2] };
  }

  /** The two or three things people will say of a dead head, for his funeral. */
  function epitaph(state, headId, first) {
    const all = (state.chronicle || []).filter((e) => e.h === headId && ((e.k === 'deed' && /^(You|Your)\b/.test(e.x)) || e.k === 'ambition' || e.k === 'vow' || e.k === 'law' || e.k === 'migration' || e.k === 'burning' || e.k === 'famine' || e.k === 'vinland'));
    const pick = all.slice().sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 3).sort((a, b) => a.t - b.t);
    return pick.map((e) => (e.k === 'deed' ? third(e.x, first) : e.x.replace(/^He\b/, first)));
  }

  IS.Saga = { epitaph, ROUTINE, note, death, stat, AMB, makeAmbition, choices, seedAmbition, checkAmbition, hintOf, third, write, score, TIERS };
})();
