/* The game screens: planning a season, reading its report, and the end of the line. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const h = IS.dom.h;
  const E = IS.Economy, C = E.C, N = IS.Names, R = IS.Rules;

  const fmt = (x) => Math.round(x).toLocaleString('en-US');
  const t1 = (x) => (Math.round(x * 10) / 10).toLocaleString('en-US');
  const signed = (x, d) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(Math.round(x * (d ? 10 : 1)) / (d ? 10 : 1));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function honorWord(v) {
    if (v < 20) return 'shamed';
    if (v < 35) return 'doubted';
    if (v < 50) return 'ordinary standing';
    if (v < 65) return 'respected';
    if (v < 80) return 'honored';
    return 'renowned';
  }
  const conditionWord = (c) => (c < 20 ? 'ruinous' : c < 40 ? 'shabby' : c < 60 ? 'serviceable' : c < 80 ? 'sound' : 'well kept');

  const ROLE = { head: 'you', wife: 'your wife', son: 'your son', daughter: 'your daughter', mother: 'your mother', stepmother: 'your stepmother',
    brother: 'your brother', sister: 'your sister', concubine: 'your concubine', servant: 'servant', thrall: 'thrall' };
  const nameOf = (p) => (p.kind === 'thrall' ? p.first : N.fullName(p));

  /* ---------- shared pieces ---------- */
  function bar(state, ctl, right, label) {
    const info = IS.Game.turnInfo(state);
    return h('header', { class: 'bar' },
      h('span', { class: 'bar-title' }, 'Iceland Simulator'),
      h('div', { class: 'bar-tools' }, h('span', { class: 'bar-when' }, label || info.label), right || null));
  }

  function abandonButton(ctl) {
    let armed = false;
    const b = h('button', { class: 'btn', type: 'button', onclick: () => {
      if (!armed) { armed = true; b.textContent = 'Really abandon this game?'; setTimeout(() => { armed = false; b.textContent = 'Abandon this game'; }, 4000); }
      else ctl.abandon();
    } }, 'Abandon this game');
    return b;
  }

  function peopleList(state) {
    const hh = state.household, year = E.yearOf(state);
    const row = (id) => {
      const p = state.people[id];
      const age = year - p.birthYear;
      let extra = p.kind === 'thrall' ? `, resentment ${p.attrs.resentment}` : '';
      if (p.role === 'wife') {
        const known = (p.knownTraits || []).map((t) => IS.Traits.WIFE[t].name.toLowerCase());
        extra = `, ${IS.Household.mood(p.attrs.happiness)}` + (known.length ? ` (${known.join(', ')})` : '');
      }
      return h('li', null, h('span', { class: 'who' }, nameOf(p)), ' ', h('span', { class: 'role' }, `${ROLE[p.role] || p.role}, ${age}${extra}`));
    };
    const head = state.people[state.headId];
    const groups = ['wives', 'concubines', 'children', 'kin', 'servants', 'thralls'].flatMap((k) => hh[k] || []);
    return h('ul', { class: 'people' },
      h('li', null, h('span', { class: 'who' }, N.fullName(head)), ' ', h('span', { class: 'role' }, `you, ${year - head.birthYear}`)),
      groups.map(row));
  }

  function ledger(state, extraTop) {
    const f = state.farm, head = IS.Game.head(state);
    const honor = head.attrs.honor;
    const bonus = state.household.wives.reduce((m, id) => Math.max(m, R.beautyHonorBonus(state.people[id].attrs.beauty)), 0);
    const standing = h('section', null,
      h('h2', null, 'Your standing'),
      h('div', { class: 'honor-figure' }, h('span', { class: 'n' }, String(Math.round(honor))), h('span', { class: 'w' }, 'Honor, ' + honorWord(honor))),
      h('div', { class: 'honor-bar', role: 'img', 'aria-label': 'Honor ' + Math.round(honor) + ' of 100' }, h('span', { style: { width: honor + '%' } })),
      bonus > 0.5 ? h('p', { class: 'honor-note' }, `At feasts and in court your wife's beauty adds about ${Math.round(bonus)}.`) : null);
    const farm = h('section', null,
      h('h2', null, f.name),
      h('dl', { class: 'stock' },
        h('dt', null, 'Cash'), h('dd', null, `${fmt(f.vadmal)} ells of vaðmál, ${f.silver} ounces of silver`),
        h('dt', null, 'Land'), h('dd', null, `${f.tenure === 'owned' ? 'Yours' : 'Rented'}, ${t1(E.hayCapacity(f))} tons of hay a year`),
        h('dt', null, 'Stock'), h('dd', null, `${f.cattle} cattle, ${f.sheep} sheep, ${f.horses} horses`),
        state.ship ? [h('dt', null, 'Ship'), h('dd', null, 'You own a ship')] : null,
        h('dt', null, 'Hay'), h('dd', null, `${t1(f.hay)} tons in the barns`),
        h('dt', null, 'Food'), h('dd', null, `${t1(f.provisions)} rations stored`),
        h('dt', null, 'Wool'), h('dd', null, `${fmt(f.wool)} ells unwoven`),
        h('dt', null, 'Buildings'), h('dd', null, conditionWord(f.condition)),
        h('dt', null, 'Worth'), h('dd', null, `${fmt(f.wealth)} ells`)));
    const household = h('section', null, h('h2', null, 'Your household'), peopleList(state));
    const hooks = state.hooks.length ? h('section', null, h('h2', null, 'What follows you'),
      h('ul', null, state.hooks.map((x) => h('li', { class: 'hook' }, x.text)))) : null;
    const nb = IS.Feud ? IS.Feud.summary(state) : [];
    const neighbors = nb.length ? h('section', null, h('h2', null, 'Your neighbors'),
      h('ul', { class: 'nbrs' }, nb.map((n) => h('li', { class: n.feud ? 'nbr nbr-feud' : 'nbr' },
        h('span', { class: 'who' }, n.farm), ' ', h('span', { class: 'role' }, n.word), n.feud ? h('span', { class: 'nbr-stage' }, ' (' + n.feud + ')') : null)))) : null;
    return h('aside', { class: 'ledger', 'aria-label': 'Your farm and household' }, extraTop || null, standing, farm, household, neighbors, hooks);
  }

  /* ---------- planning ---------- */
  function awayView(state, ctl) {
    const x = state.expedition, d = IS.Raid.DEST[x.dest], dep = state.people[x.deputyId];
    const main = h('main', { class: 'report' },
      h('h1', null, `Winter abroad`),
      h('p', { class: 'lede' }, `You are wintering on the shores of ${d.short}. ${dep.first} is running the farm at home. You can do nothing about it from here, and the ship will sail for Iceland when the ice allows.`),
      h('p', null, `The farm will follow the household's usual plan. ${dep.first} manages it ${IS.Raid.stewardEff(state) >= 0.92 ? 'well' : IS.Raid.stewardEff(state) >= 0.84 ? 'adequately' : 'badly'}.`),
      h('div', { class: 'hero-actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => ctl.resolve({}) }, 'Let the winter pass')));
    return h('div', { class: 'page' }, bar(state, ctl, abandonButton(ctl)), h('main', { class: 'layout' }, main, ledger(state)));
  }

  function planView(state, ctl, initialPlan) {
    if (IS.Raid.isAway(state)) return awayView(state, ctl);
    const S = E.seasonOf(state), f = state.farm, year = E.yearOf(state);
    const omen = IS.Turn.omenOf(state);
    const prices = state.env.prices;
    const head = state.people[state.headId];
    let plan = E.normalizePlan(state, initialPlan || E.suggest(state), S);
    let out = null;
    const regs = [];
    const reg = (fn) => { regs.push(fn); return fn; };
    const update = () => { out = E.outlook(state, plan); regs.forEach((fn) => fn()); };

    const px = (kind, buying) => Math.max(1, Math.round(C.PRICE[kind] * ((prices && prices[kind]) || 1) * (buying ? C.BUY : C.SELL)));
    const tier = E.tierOfFarm(f);
    const unassigned = () => Math.max(0, out.res.wf.hands - Object.values(plan.labour).reduce((a, b) => a + b, 0));

    function stepper(o) {
      const val = h('output', { class: 'step-val' });
      const min = o.min || 0, step = o.step || 1;
      const dec = h('button', { type: 'button', class: 'step-btn', 'aria-label': 'Fewer: ' + o.aria, onclick: () => { o.set(Math.max(min, o.get() - step)); update(); } }, '−');
      const inc = h('button', { type: 'button', class: 'step-btn', 'aria-label': 'More: ' + o.aria, onclick: () => { o.set(Math.min(o.max(), o.get() + step)); update(); } }, '+');
      reg(() => { val.textContent = (o.fmt || String)(o.get()); dec.disabled = o.get() <= min; inc.disabled = o.get() + step > o.max(); });
      return h('div', { class: 'stepper', role: 'group', 'aria-label': o.aria }, dec, val, inc);
    }
    function liveText(tag, cls, fn) {
      const el = h(tag, { class: cls });
      reg(() => { el.textContent = fn(); });
      return el;
    }
    function row(label, hint, control, yieldFn) {
      return h('div', { class: 'row' },
        h('div', { class: 'row-text' }, h('div', { class: 'row-label' }, label),
          typeof hint === 'function' ? liveText('div', 'row-hint', hint) : hint ? h('div', { class: 'row-hint' }, hint) : null),
        h('div', { class: 'row-ctl' }, control, yieldFn ? liveText('span', 'row-yield', yieldFn) : null));
    }

    /* --- labour --- */
    const setting = f.setting;
    const fishName = setting === 'coast' ? 'Fishing and fowling' : setting === 'river' ? 'Salmon and trout' : 'Fowling and lake fishing';
    const rate = (S === 'summer' ? C.FISH_SUMMER : C.FISH_WINTER)[setting];
    const L = {
      hay: ['Haymaking', () => `A hand cuts about ${C.HAY_PER_HAND} tons. Your fields give at most ${t1(out.rep.hayCap || 0)} tons.`, () => `${t1(out.rep.hayMade || 0)} tons`],
      fish: [fishName, () => `About ${rate} rations a hand${S === 'winter' ? ', less in a hard winter' : ''}.`, () => `${t1(out.rep.fish || 0)} rations`],
      weave: ['Weaving', () => `A hand weaves about ${C.WEAVE_PER_HAND} ells of cloth. You have ${fmt(f.wool)} ells of wool to work.`, () => `${fmt(out.rep.woven || 0)} ells`],
      craft: ['Crafts and trade goods', () => `About ${S === 'summer' ? C.CRAFT_SUMMER : C.CRAFT_PER_HAND} ells a hand.`, () => `${fmt(out.rep.crafted || 0)} ells`],
      build: ['Repairs and manuring', () => 'Roofs, walls and the home field. Keeps the farm in good order.', () => `buildings ${conditionWord(out.res.farm.condition)}`],
    };
    const work = h('section', { class: 'plan-sec' },
      h('h2', null, 'Work'),
      liveText('p', 'sec-note', () => {
        const wf = out.res.wf;
        return `Herd chores take about ${t1(wf.chores)} hands' worth of your household's labour. ${wf.hands} hands are free to give out, ${unassigned()} not yet given.`;
      }),
      E.CATS[S].map((c) => row(L[c][0], L[c][1], stepper({
        aria: L[c][0], get: () => plan.labour[c], set: (v) => { plan.labour[c] = v; }, max: () => plan.labour[c] + unassigned(),
      }), L[c][2])));

    /* --- livestock --- */
    const herd = [['cattle', 'Cattle', 'cattle'], ['sheep', 'Sheep', 'sheep'], ['horses', 'Horses', 'horses']];
    const herdSec = h('section', { class: 'plan-sec' },
      h('h2', null, 'Livestock'),
      h('p', { class: 'sec-note' }, 'A slaughtered cow feeds four people for a season and a sheep feeds less than one. Sold animals bring cash. Every animal you keep needs hay all winter.'),
      herd.map(([key, label, priceKey]) => h('div', { class: 'stock-row' },
        h('div', { class: 'row-text' }, h('div', { class: 'row-label' }, label), liveText('div', 'row-hint', () => {
          const ns = plan.sell[key], nb = plan.buy[key], m = (prices && prices[priceKey]) || 1;
          let t = `You have ${f[key]}. Sells for ${px(priceKey, false)} ells, costs ${px(priceKey, true)} to buy.`;
          if (ns > 1) t += ` Selling ${ns} brings about ${fmt(E.lot(priceKey, ns, false, m).total)} ells in all (about ${Math.round(E.lot(priceKey, ns, false, m).avg)} each): a crowded market pays less.`;
          if (nb > 1) t += ` Buying ${nb} costs about ${fmt(E.lot(priceKey, nb, true, m).total)} ells in all.`;
          return t;
        })),
        h('div', { class: 'stock-ctls' },
          key === 'horses' ? null : h('label', { class: 'mini' }, h('span', null, 'Slaughter'), stepper({ aria: 'Slaughter ' + label.toLowerCase(), get: () => plan.cull[key], set: (v) => { plan.cull[key] = v; }, max: () => f[key] - plan.sell[key] })),
          h('label', { class: 'mini' }, h('span', null, 'Sell'), stepper({ aria: 'Sell ' + label.toLowerCase(), get: () => plan.sell[key], set: (v) => { plan.sell[key] = v; }, max: () => f[key] - (plan.cull[key] || 0) })),
          h('label', { class: 'mini' }, h('span', null, 'Buy'), stepper({ aria: 'Buy ' + label.toLowerCase(), get: () => plan.buy[key], set: (v) => { plan.buy[key] = v; }, max: () => 40 }))))));

    /* --- goods --- */
    const goods = h('section', { class: 'plan-sec' },
      h('h2', null, 'Buying in'),
      row('Hay', `${px('hay', true)} ells a ton.`, stepper({ aria: 'Buy hay', get: () => plan.buy.hay, set: (v) => { plan.buy.hay = v; }, max: () => 200, step: 5, fmt: (v) => v + ' t' })),
      row('Food', `${px('food', true)} ells a ration. Flour, malt and dried fish from merchants.`, stepper({ aria: 'Buy food', get: () => plan.buy.food, set: (v) => { plan.buy.food = v; }, max: () => 100, step: 2 })),
      row('Land', `${fmt(E.landPrice(f, prices && prices.land))} ells buys ${C.PARCEL_TONS} more tons of hayfield.`, stepper({ aria: 'Buy land', get: () => plan.buy.land, set: (v) => { plan.buy.land = v; }, max: () => 3, fmt: (v) => v + (v === 1 ? ' parcel' : ' parcels') })));

    /* --- household --- */
    const radios = (name, opts, get, set) => h('div', { class: 'choices', role: 'radiogroup', 'aria-label': name }, opts.map((o) => {
      const input = h('input', { type: 'radio', name: name + '-' + S, value: o.value, onchange: () => { set(o.value); update(); } });
      if (get() === o.value) input.checked = true;
      return h('label', { class: 'choice' }, input, h('span', { class: 'choice-text' }, h('b', null, o.label), ' ', h('span', null, o.desc)));
    }));
    const winterMult = S === 'winter' ? C.HOSP.winterMult : 1;
    const glow = Math.max(0.15, Math.min(1.3, (92 - state.people[state.headId].attrs.honor) / 55));
    const hospOpt = (v, label) => {
      const cost = v === 'plain' ? 0 : Math.round(C.HOSP.cost[v][tier] * winterMult);
      const gain = C.HOSP.honor[v] * winterMult * glow;
      return { value: v, label, desc: v === 'plain' ? 'No more than custom asks. No cost.' : `${fmt(cost)} ells. About ${signed(gain, true)} Honor.` };
    };
    const people = h('section', { class: 'plan-sec' },
      h('h2', null, 'The house'),
      h('h3', null, S === 'winter' ? 'The Jól table' : 'Hospitality'),
      radios('hospitality', [hospOpt('plain', 'Plain table'), hospOpt('open', 'Open hand'), hospOpt('lavish', 'Lavish feast')], () => plan.hospitality, (v) => { plan.hospitality = v; }),
      state.household.thralls.length ? [h('h3', null, 'Your thralls'), radios('treatment', [
        { value: 'harsh', label: 'Harsh', desc: 'They work about a tenth harder. Resentment climbs.' },
        { value: 'fair', label: 'Fair', desc: 'What custom allows.' },
        { value: 'kind', label: 'Kind', desc: 'They eat better, a quarter more food. Resentment eases.' },
      ], () => plan.treatment, (v) => { plan.treatment = v; })] : null,
      h('h3', null, 'Taking people on'),
      row('Hire servants', `${C.HIRE_FEE} ells to take one on, then ${C.WAGE} ells a season. You have ${state.household.servants.length}.`, stepper({ aria: 'Hire servants', get: () => plan.buy.servants, set: (v) => { plan.buy.servants = v; }, max: () => 3 })),
      row('Buy a thrall', `${px('thrall', true)} ells each. You have ${state.household.thralls.length}. Too many thralls to free men invites revolt.`, stepper({ aria: 'Buy thralls', get: () => plan.buy.thralls, set: (v) => { plan.buy.thralls = v; }, max: () => 3 })),
      state.household.thralls.length ? row('Sell a thrall', `${px('thrall', false)} ells each. The most resentful go first. You have ${state.household.thralls.length}.`, stepper({ aria: 'Sell thralls', get: () => plan.sell.thralls, set: (v) => { plan.sell.thralls = v; }, max: () => state.household.thralls.length })) : null,
      E.canSeekWife(state) ? h('label', { class: 'check' },
        (() => { const i = h('input', { type: 'checkbox', onchange: (e) => { plan.seekWife = e.target.checked; update(); } }); if (plan.seekWife) i.checked = true; return i; })(),
        h('span', null, h('b', null, state.household.wives.length ? 'Court a second wife this summer. ' : 'Court a wife this summer. '),
          (() => {
            const w = IS.Marriage.suitWords(state);
            return `Gifts and the wedding feast cost ${fmt(C.wedding(tier))} ells. About ${Math.round(IS.Marriage.suitChance(state) * 100)} in 100 that she accepts` +
              (w.up.length ? `, helped by ${w.up.join(' and ')}` : '') + (w.down.length ? `${w.up.length ? ', but' : ','} hurt by ${w.down.join(' and ')}` : '') + '.';
          })(),
          state.household.wives.length ? ' She would bring a dowry and legitimate children, and your wife will not like it.' : '',
          IS.Marriage.needsHeir(state) ? ' You have no son and no wife young enough to bear one.' : '')) : null,
      IS.Marriage.canTakeConcubine(state) ? h('label', { class: 'check' },
        (() => { const i = h('input', { type: 'checkbox', onchange: (e) => { plan.concubine = e.target.checked; update(); } }); if (plan.concubine) i.checked = true; return i; })(),
        h('span', null, h('b', null, 'Take a concubine. '), `Gifts to her family cost ${fmt(C.concubine(tier))} ells. No dowry, and her sons are heirs only if you have no legitimate son.${state.household.wives.length ? ' Your wife will take it badly.' : ''}`)) : null);

    /* --- a raid --- */
    let raidSec = null;
    const R = IS.Raid;
    if (S === 'summer' && R.canRaid(state)) {
      const deps = R.deputies(state), total = R.cost(state), afford = E.cashOf(f) >= total;
      const destBox = h('div', { class: 'choices', role: 'radiogroup', 'aria-label': 'Where to raid' });
      const depBox = h('div', null);
      const lootWord = (l) => (l >= 1900 ? 'immense' : l >= 1500 ? 'great' : l >= 1100 ? 'large' : 'fair');
      const draw = () => {
        const opt = (value, label, desc, dis) => {
          const input = h('input', { type: 'radio', name: 'raiddest', value, disabled: dis, onchange: () => {
            plan.raid = value ? { dest: value, deputyId: (plan.raid && plan.raid.deputyId) || deps[0].id } : null; update(); draw();
          } });
          if ((plan.raid ? plan.raid.dest : '') === value) input.checked = true;
          return h('label', { class: 'choice' }, input, h('span', { class: 'choice-text' }, h('b', null, label), ' ', h('span', null, desc)));
        };
        destBox.replaceChildren(opt('', 'Stay home', 'No raid this summer.', false),
          ...R.ORDER.map((id) => {
            const d = R.DEST[id], pct = Math.round(R.deathEstimate(state, id, true) * 100);
            const fav = state.favors && state.favors[id];
            return opt(id, d.name, `${d.winter ? 'Away until next summer. ' : 'Home by autumn. '}About ${pct} in 100 of not returning. Plunder ${lootWord(d.loot)}.${fav ? ' Its king favors you.' : ''}`, !afford);
          }));
        depBox.replaceChildren(...(plan.raid ? [
          h('h3', null, 'Who runs the farm while you are gone?'),
          h('div', { class: 'choices', role: 'radiogroup', 'aria-label': 'Who runs the farm' }, deps.map((x) => {
            const input = h('input', { type: 'radio', name: 'raiddep', value: x.id, onchange: () => { plan.raid.deputyId = x.id; update(); } });
            if (plan.raid.deputyId === x.id) input.checked = true;
            return h('label', { class: 'choice' }, input, h('span', { class: 'choice-text' }, h('b', null, x.name), ' ', h('span', null, `${x.role}, ${x.age}, husbandry ${x.husbandry}. A poorer manager means a poorer harvest.`)));
          })),
          R.heirless(state) ? h('p', { class: 'sec-note' }, 'You have no son or brother to inherit. If you do not come back, the line ends.') : null].filter(Boolean) : []));
      };
      raidSec = h('section', { class: 'plan-sec plan-raid' },
        h('h2', null, 'A raid'),
        h('p', { class: 'sec-note' }, `Sail this summer and bring home plunder, captives and, perhaps, a foreign king's favor. You are not here to work the farm, and whether you come back rests on your Strength (${Math.round(head.attrs.strength)}). Further coasts pay more and kill more. ${state.ship ? 'You own a ship, so you only pay for the crew and outfitting' : `A ship costs ${fmt(R.SHIP_COST)} ells, then the crew and outfitting`}: ${fmt(total)} ells in all.${afford ? '' : ` You have ${fmt(E.cashOf(f))}.`}`),
        destBox, depBox);
      draw();
    }

    /* --- outlook --- */
    const gauge = h('div', { class: 'gauge' });
    const outlookBox = h('section', { class: 'outlook' });
    const verdictHay = (have, n) => have >= n.severe ? 'Enough even for a severe winter.' : have >= n.hard ? 'Enough for a hard winter, but not a severe one.'
      : have >= n.normal ? 'Enough for an ordinary winter. A hard one would hurt.' : have >= n.mild ? 'Only enough for a mild winter.' : 'Not enough even for a mild winter. Animals will starve.';
    const rebuildOutlook = () => {
      const o = out, n = o.needs, maxv = Math.max(o.hayHave, n.severe) * 1.08 || 1;
      const pos = (v) => Math.min(100, (v / maxv) * 100) + '%';
      gauge.replaceChildren(
        h('div', { class: 'gauge-track' }, h('div', { class: 'gauge-fill', style: { width: pos(o.hayHave) } }),
          ['normal', 'hard', 'severe'].map((k) => h('div', { class: 'gauge-tick', style: { left: pos(n[k]) }, title: `${C.SEV[k].label} winter: ${t1(n[k])} tons` }))),
        h('div', { class: 'gauge-legend' }, `Ordinary ${t1(n.normal)} · hard ${t1(n.hard)} · severe ${t1(n.severe)} tons`));
      const foodGap = o.rationHave - o.rationNeed;
      const notes = [...o.rep.notes];
      if (o.cashEnd < o.cashStart - 1) notes.push('This plan spends more than it brings in.');
      if (unassigned() > 0) notes.push(`${unassigned()} hands are not given any work.`);
      if (o.res.hungerFrac > 0.01) notes.push('The household would go hungry on this plan.');
      outlookBox.replaceChildren(
        h('h2', null, S === 'summer' ? 'Outlook for the winter' : 'Outlook for the spring'),
        h('p', { class: 'out-label' }, S === 'summer' ? 'Hay you will have laid up' : 'Hay you have for the winter', h('b', null, ' ' + t1(o.hayHave) + ' tons')),
        gauge,
        h('p', { class: 'out-verdict' }, verdictHay(o.hayHave, n)),
        h('p', { class: 'out-label' }, 'Food this season', h('b', null, ` need ${t1(o.rationNeed)}, have ${t1(o.rationHave)}`)),
        h('p', { class: 'out-verdict' }, foodGap >= 0 ? (foodGap > o.rationNeed * 0.25 ? 'The house will eat well.' : 'Just enough. A bad turn of luck would leave you short.') : 'Not enough. The house will go hungry.'),
        h('p', { class: 'out-label' }, 'Cash', h('b', null, ` ${fmt(o.cashStart)} → ${fmt(o.cashEnd)} ells`)),
        ...(notes.length ? [h('ul', { class: 'out-notes' }, notes.map((x) => h('li', null, x)))] : []),
        h('p', { class: 'out-foot' }, 'These are expectations for an average season. The weather will not be average.'));
    };
    reg(rebuildOutlook);

    /* --- dock --- */
    const dockChips = h('div', { class: 'dock-chips' });
    reg(() => {
      const o = out, n = o.needs, foodOk = o.rationHave >= o.rationNeed;
      dockChips.replaceChildren(
        h('span', { class: 'chip' }, 'Hay ', h('b', null, `${t1(o.hayHave)} / ${t1(n.normal)} t`)),
        h('span', { class: 'chip' }, 'Food ', h('b', null, foodOk ? 'enough' : 'short')),
        h('span', { class: 'chip' }, 'Cash ', h('b', null, fmt(o.cashEnd))));
    });
    const dock = h('div', { class: 'dock' }, h('div', { class: 'dock-inner' }, dockChips,
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => ctl.resolve(plan) }, S === 'summer' ? 'Carry out the summer' : 'Carry out the winter')));

    /* --- assemble --- */
    const beats = IS.Calendar.turnInfo(state.turn, state.startYear).beats.map((b) => b.name).join(', ');
    const intro = h('section', { class: 'season-head' },
      h('h1', null, `${cap(S)} of ${year}`),
      h('p', { class: 'omen' }, omen.text),
      h('p', { class: 'beats' }, `This season: ${beats}.`),
      h('div', { class: 'plan-tools' },
        h('button', { class: 'btn', type: 'button', onclick: () => ctl.replan(E.suggest(state)) }, 'Use the household’s usual plan'),
        h('button', { class: 'btn', type: 'button', onclick: () => ctl.replan({ hospitality: plan.hospitality, treatment: plan.treatment }) }, 'Clear the plan')));

    const main = h('div', { class: 'main' }, intro, work, herdSec, goods, raidSec, people);
    const page = h('div', { class: 'page has-dock' }, bar(state, ctl, abandonButton(ctl)),
      h('main', { class: 'layout' }, main, ledger(state, outlookBox)), dock);
    update();
    return page;
  }

  /* ---------- the season in review ---------- */
  function reportView(state, ctl) {
    const rep = state.report;
    const next = IS.Calendar.turnInfo(state.turn, state.startYear);
    const sec = (title, lines) => (lines && lines.length ? h('section', { class: 'rep-sec' }, h('h2', null, title), lines.map((l) => h('p', null, l))) : null);
    const b = rep.before, a = rep.after;
    const row = (label, x, y, d) => h('tr', null, h('th', { scope: 'row' }, label), h('td', null, d ? t1(x) : fmt(x)), h('td', null, d ? t1(y) : fmt(y)));
    const parts = rep.honorParts.filter((p) => Math.abs(p.d) >= 0.05);
    const succ = rep.succession;
    const main = h('main', { class: 'report' },
      h('h1', null, `${cap(rep.season)} of ${rep.year} in review`),
      succ ? h('section', { class: 'rep-sec rep-succ' }, h('h2', null, succ.ended ? 'The line ends' : 'The head of the house has died'), (succ.lines || [succ.text]).map((l) => h('p', null, l))) : null,
      sec('The voyage', rep.raid),
      sec('The farm', rep.farm),
      sec('The herd', rep.herd),
      sec('The house', rep.household),
      rep.incidents && rep.incidents.length ? h('section', { class: 'rep-sec' }, h('h2', null, 'Matters you settled'),
        rep.incidents.map((x) => h('p', null, h('b', null, x.title + '. '), x.text))) : null,
      sec('What else happened', rep.events),
      h('section', { class: 'rep-sec' },
        h('h2', null, 'Honor'),
        parts.length ? h('ul', { class: 'honor-parts' }, parts.map((p) => h('li', null, h('span', { class: 'hp-d' }, signed(p.d, true)), ' ' + p.why))) : h('p', null, 'Nothing you did this season changed how people see you.'),
        h('p', null, `Honor ${t1(b.honor)} → `, h('b', { class: 'honor-now' }, t1(a.honor)), ` (${signed(a.honor - b.honor, true)})`)),
      h('section', { class: 'rep-sec' },
        h('h2', null, 'The books'),
        h('table', { class: 'books' },
          h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Before'), h('th', null, 'After'))),
          h('tbody', null,
            row('Cash (ells)', b.cash, a.cash), row('Worth (ells)', b.wealth, a.wealth), row('Cattle', b.cattle, a.cattle), row('Sheep', b.sheep, a.sheep), row('Horses', b.horses, a.horses), row('Hay (tons)', b.hay, a.hay, true), row('People', b.people, a.people)))),
      h('div', { class: 'hero-actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: ctl.proceed }, `On to ${next.season} of ${next.year}`)));
    return h('div', { class: 'page' }, bar(state, ctl, abandonButton(ctl), `${cap(rep.season)}, year ${rep.year}`), main);
  }

  /* ---------- a matter in the house ---------- */
  function incidentView(state, ctl) {
    const d = IS.Household.describe(state);
    if (!d) { state.mode = 'report'; return reportView(state, ctl); }
    const w = d.wife;
    const cash = E.cashOf(state.farm);
    const card = !w ? null : h('div', { class: 'wife-card' },
      h('div', { class: 'wc-head' }, h('span', { class: 'who' }, w.name), ' ', h('span', { class: 'role' }, `${w.age}${w.kin ? ', of ' + w.kin : ''}`)),
      h('p', { class: 'wc-mood' }, `She is ${w.mood}.`),
      w.traits.length ? h('ul', { class: 'wc-traits' }, w.traits.map((t) => h('li', null, h('b', null, t.name + '. '), t.desc))) : null,
      w.hidden > 0 ? h('p', { class: 'wc-hidden' }, 'There is more to her temper than you have yet seen.') : null);
    const opts = d.options.map((o) => h('button', { class: 'opt', type: 'button', disabled: o.disabled, onclick: () => ctl.choose(o.id) },
      h('span', { class: 'opt-label' }, o.label),
      h('span', { class: 'opt-desc' }, o.disabled ? `${o.desc} You have ${fmt(cash)} ells and this needs ${fmt(o.cost)}.` : o.desc)));
    const main = h('main', { class: 'incident' },
      h('p', { class: 'inc-count' }, (d.total > 1 ? `Matter ${d.number} of ${d.total}` : 'A matter') + (d.kind === 'event' ? ' for the farm' : ' in the house')),
      h('h1', null, d.title),
      d.body.map((l) => h('p', { class: 'lede' }, l)),
      card,
      h('div', { class: 'opts', role: 'group', 'aria-label': 'What will you do?' }, opts));
    return h('div', { class: 'page' }, bar(state, ctl, abandonButton(ctl)), h('main', { class: 'layout' }, main, ledger(state)));
  }

  /* ---------- the end of the line ---------- */
  function overView(state, ctl) {
    const o = state.over, s = o.summary || IS.Turn.summary(state);
    const heads = (state.deadHeads || []).map((d) => h('li', null, h('span', { class: 'who' }, d.name), ' ', h('span', { class: 'role' }, `${d.born} to ${d.died}, Honor ${d.honor}, ${d.cause}`)));
    const main = h('main', { class: 'report report-over' },
      h('h1', null, 'The line ends'),
      h('p', { class: 'lede' }, o.reason),
      h('section', { class: 'rep-sec' }, h('h2', null, 'The saga'),
        h('dl', { class: 'stock' },
          h('dt', null, 'Years'), h('dd', null, String(s.years)),
          h('dt', null, 'Heads of the house'), h('dd', null, String(s.heads)),
          h('dt', null, 'Peak Honor'), h('dd', null, String(s.peakHonor)),
          h('dt', null, 'Final worth'), h('dd', null, fmt(s.wealth) + ' ells'),
          h('dt', null, 'Score'), h('dd', null, `${s.score} (provisional: the real scoring comes later)`))),
      heads.length ? h('section', { class: 'rep-sec' }, h('h2', null, 'Who held the farm'), h('ul', { class: 'people' }, heads)) : null,
      h('div', { class: 'hero-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: ctl.abandon }, 'Roll a new family')));
    return h('div', { class: 'page' }, bar(state, ctl), main);
  }

  IS.ui.playScreen = function (state, ctl, initialPlan) {
    if (state.mode === 'over') return overView(state, ctl);
    if (state.mode === 'incident') return incidentView(state, ctl);
    if (state.mode === 'report') return reportView(state, ctl);
    return planView(state, ctl, initialPlan);
  };
  IS.ui.honorWord = honorWord;
})();
