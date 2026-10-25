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
  function neighborsDialog(state) {
    const dir = IS.Feud.directory(state);
    const tier = (t) => (IS.Start.TIER_LABEL && IS.Start.TIER_LABEL[t]) || 'a farm';
    const dlg = h('dialog', { class: 'nbr-dialog', 'aria-label': 'Your neighbors' });
    const close = () => { try { dlg.close(); } catch (e) { /* already closed */ } dlg.remove(); };
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    const head = state.people[state.headId];
    dlg.append(
      h('h2', null, 'Nábúar: your neighbors'),
      h('p', { class: 'sec-note' }, `How the houses around you feel about yours. A man of high Honor is usually well thought of, but a jealous man likes you less the higher you rise, and a quarrelsome one picks fights with anyone. Houses that dislike you are the ones who bring border claims, suits and, in the end, violence. Your Honor is ${Math.round(head.attrs.honor)}.`),
      h('ul', { class: 'nbr-list' }, dir.map((n) => {
        const cls = n.rel <= -50 ? 'bad2' : n.rel <= -15 ? 'bad' : n.rel >= 40 ? 'good2' : n.rel >= 15 ? 'good' : 'mid';
        const pos = ((n.rel + 100) / 200) * 100;
        return h('li', { class: 'nbr-item ' + cls },
          h('div', { class: 'nbr-top' }, h('b', null, `${n.head} of ${n.farm}`), h('span', { class: 'nbr-word' }, n.word)),
          h('div', { class: 'nbr-meter', role: 'img', 'aria-label': `Feeling toward you: ${n.word}` }, h('span', { style: { left: pos + '%' } })),
          h('div', { class: 'nbr-meta' }, [`${tier(n.tier)}`, n.goði ? 'a goði' : null, n.nature ? n.nature : null].filter(Boolean).join(', ') + (n.nature ? '' : '; you do not know his temper yet')),
          n.why ? h('div', { class: 'nbr-meta' }, n.why) : null,
          (n.likes && n.likes.length) || (n.dislikes && n.dislikes.length) ? h('div', { class: 'nbr-meta' }, [n.likes.length ? `Friends with ${n.likes.join(' and ')}.` : null, n.dislikes.length ? `At odds with ${n.dislikes.join(' and ')}.` : null].filter(Boolean).join(' ')) : null,
          n.feud ? h('div', { class: 'nbr-feud-line' }, `Feud: ${n.feud}${n.owed ? `. He may claim about ${fmt(n.owed)} ells from you` : ''}${n.toll ? `. The dead: ${n.toll.you} of yours, ${n.toll.them} of theirs` : ''}${n.truce ? '. A truce holds for now' : ''}.`) : null);
      })),
      h('div', { class: 'nbr-actions' }, h('button', { class: 'btn', type: 'button', onclick: close }, 'Close')));
    return dlg;
  }
  function neighborsButton(state) {
    return h('button', { class: 'btn nbr-btn', type: 'button', title: 'Neighbors', onclick: () => {
      const d = neighborsDialog(state); document.body.appendChild(d);
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
      d.scrollTop = 0;
    } }, 'nábúar');
  }

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

  function standingSec(state) {
    const head = IS.Game.head(state), honor = head.attrs.honor;
    const bonus = state.household.wives.reduce((m, id) => Math.max(m, R.beautyHonorBonus(state.people[id].attrs.beauty)), 0);
    return h('section', null,
      h('h2', null, 'Your standing'),
      h('div', { class: 'honor-figure' }, h('span', { class: 'n' }, String(Math.round(honor))), h('span', { class: 'w' }, 'Honor, ' + honorWord(honor))),
      h('div', { class: 'honor-bar', role: 'img', 'aria-label': 'Honor ' + Math.round(honor) + ' of 100' }, h('span', { style: { width: honor + '%' } })),
      bonus > 0.5 ? h('p', { class: 'honor-note' }, `At feasts and in court your wife's beauty adds about ${Math.round(bonus)}.`) : null);
  }

  function ledger(state, extraTop) {
    const f = state.farm;
    const standing = standingSec(state);
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
    const st = state.stable || [];
    const stableSec = f.horses > 0 && st.length ? h('section', null, h('h2', null, 'Your horses'),
      h('ul', { class: 'nbrs stable' }, st.slice().sort((a, b) => IS.Stable.worth(b) - IS.Stable.worth(a)).map((x) => h('li', { class: 'nbr' },
        h('span', { class: 'who' }, x.name), ' ', h('span', { class: 'role' }, `Speed ${x.speed}, Strength ${x.strength}`),
        x.raceWins || x.wins ? h('span', { class: 'nbr-stage' }, ` (${[x.raceWins && x.raceWins + ' race' + (x.raceWins > 1 ? 's' : ''), x.wins && x.wins + ' fight' + (x.wins > 1 ? 's' : '')].filter(Boolean).join(', ')} won)`) : null)))) : null;
    const household = h('section', null, h('h2', null, 'Your household'), peopleList(state));
    const hooks = state.hooks.length ? h('section', null, h('h2', null, 'What follows you'),
      h('ul', null, state.hooks.map((x) => h('li', { class: 'hook' }, x.text)))) : null;
    const nb = IS.Feud ? IS.Feud.summary(state) : [];
    const neighbors = nb.length ? h('section', null, h('h2', null, 'Your neighbors'),
      h('ul', { class: 'nbrs' }, nb.map((n) => h('li', { class: n.feud ? 'nbr nbr-feud' : 'nbr' },
        h('span', { class: 'who' }, n.farm), ' ', h('span', { class: 'role' }, n.word), n.feud ? h('span', { class: 'nbr-stage' }, ' (' + n.feud + ')') : null)))) : null;
    return h('aside', { class: 'ledger', 'aria-label': 'Your farm and household' }, extraTop || null, standing, farm, stableSec, household, neighbors, hooks,
      state.families && IS.Feud && !extraTop ? h('div', { class: 'ledger-foot' }, neighborsButton(state)) : null);
  }

  /** The farm, the household, the horses and what follows you, in a dialog (the plan screen keeps only the outlook beside it). */
  function farmButton(state) {
    return h('button', { class: 'btn nbr-btn', type: 'button', onclick: () => {
      const dlg = h('dialog', { class: 'nbr-dialog farm-dialog', 'aria-label': 'Your farm and household' });
      const close = () => { try { dlg.close(); } catch (e) { /* closed */ } dlg.remove(); };
      dlg.addEventListener('close', () => dlg.remove());
      dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
      const l = ledger(state, h('span'));
      l.className = 'ledger in-dialog';
      l.firstChild.remove(); l.firstChild.remove(); // the placeholder, and the standing (already on the page)
      const tale = (state.chronicle || []).filter((e) => Math.abs(e.w) >= 1.5 || e.k === 'marriage').slice(-8);
      if (tale.length) l.append(h('section', null, h('h2', null, 'What will be told of you'), h('ul', { class: 'tale' }, tale.map((e) => {
        const head = state.people[e.h]; const x = e.k === 'deed' ? IS.Saga.third(e.x, head ? head.first : 'He') : e.x.replace(/^He\b/, head ? head.first : 'He');
        return h('li', null, h('span', { class: 'tale-y' }, String(e.y)), ' ', x);
      }))));
      dlg.append(l, h('div', { class: 'nbr-actions' }, h('button', { class: 'btn', type: 'button', onclick: close }, 'Close')));
      document.body.appendChild(dlg);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      dlg.scrollTop = 0;
    } }, 'Farm');
  }

  /* ---------- planning ---------- */
  const OPEN = new Set(); // which plan sections the player has left open, kept across seasons
  function exileView(state, ctl) {
    const x = state.exile, dep = state.people[state.expedition.deputyId], S = E.seasonOf(state);
    const W = IS.Law.WHERE[x.where], left = Math.max(0, x.until - state.turn);
    const where = W ? `You are serving your outlawry in ${W.name}. ${Math.ceil(left / 2)} ${Math.ceil(left / 2) === 1 ? 'year' : 'years'} remain before you may go home.` : 'You are an outlaw in the highlands. Every man in Iceland may kill you, and some of them mean to.';
    const main = h('main', { class: 'report' },
      h('h1', null, W ? `${cap(S)} in ${W.name}` : `${cap(S)} in the highlands`),
      h('p', { class: 'lede' }, where),
      h('p', null, dep ? `${dep.first} runs the farm at home, as best ${dep.sex === 'F' ? 'she' : 'he'} can, on the household's usual plan.` : 'Nobody fit is left to run the farm. It runs itself, badly.'),
      x.gains ? h('p', null, `You have put by about ${fmt(x.gains)} ells to bring home.`) : null,
      h('div', { class: 'hero-actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => ctl.resolve({}) }, S === 'summer' ? 'Let the summer pass' : 'Let the winter pass')));
    return h('div', { class: 'page' }, bar(state, ctl, abandonButton(ctl)), h('main', { class: 'layout' }, main, ledger(state)));
  }

  function awayView(state, ctl) {
    if (state.exile && state.expedition && state.expedition.exile) return exileView(state, ctl);
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

    /* --- folding sections: a one-line summary, opened only to change it --- */
    const teach = state.turn < 4; // the first two years explain themselves; after that, only numbers
    function fold(key, title, sumFn, body) {
      const det = h('details', { class: 'plan-sec fold' });
      if (OPEN.has(S + key)) det.open = true;
      det.addEventListener('toggle', () => { if (det.open) OPEN.add(S + key); else OPEN.delete(S + key); });
      const sum = h('span', { class: 'fold-sum' });
      reg(() => {
        const r = sumFn();
        sum.replaceChildren(...[h('span', null, r.text), r.warn ? h('span', { class: 'fold-warn' }, r.warn) : null, r.sub ? h('span', { class: 'fold-sub' }, r.sub) : null].filter(Boolean));
      });
      det.append(h('summary', null, h('span', { class: 'fold-title' }, title), sum, h('span', { class: 'fold-act', 'aria-hidden': 'true' })),
        h('div', { class: 'fold-body' }, body));
      return det;
    }
    const list = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
    const nOf = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const animal = (k, n) => (k === 'cattle' ? nOf(n, 'cow', 'cattle') : k === 'sheep' ? nOf(n, 'sheep', 'sheep') : nOf(n, 'horse', 'horses'));

    /* --- labour --- */
    const setting = f.setting;
    const fishName = setting === 'coast' ? 'Fishing and fowling' : setting === 'river' ? 'Salmon and trout' : 'Fowling and lake fishing';
    const rate = (S === 'summer' ? C.FISH_SUMMER : C.FISH_WINTER)[setting];
    const L = {
      hay: ['Haymaking', 'haymaking', () => {
        const w = wastedHay();
        return `About ${C.HAY_PER_HAND} tons a hand. Your fields give at most ${t1(out.rep.hayCap || 0)}.` + (w ? ` The field is full: ${w === 1 ? 'one hand cuts' : w + ' hands cut'} nothing extra. Put ${w === 1 ? 'it' : 'them'} to other work.` : '');
      }, () => `${t1(out.rep.hayMade || 0)} tons${wastedHay() ? ' (field full)' : ''}`],
      fish: [fishName, 'fishing', () => `About ${rate} rations a hand${S === 'winter' ? ', less in a hard winter' : ''}.`, () => `${t1(out.rep.fish || 0)} rations`],
      weave: ['Weaving', 'weaving', () => `About ${C.WEAVE_PER_HAND} ells a hand. ${fmt(f.wool)} ells of wool to work.`, () => `${fmt(out.rep.woven || 0)} ells`],
      craft: ['Crafts and trade goods', 'crafts', () => `About ${S === 'summer' ? C.CRAFT_SUMMER : C.CRAFT_PER_HAND} ells a hand.`, () => `${fmt(out.rep.crafted || 0)} ells`],
      build: ['Repairs and manuring', 'repairs', teach ? () => 'Roofs, walls and the home field. Keeps the farm in good order.' : null, () => `buildings ${conditionWord(out.res.farm.condition)}`],
    };
    /** Hands on haymaking beyond what the field can give: they cut nothing. */
    function wastedHay() {
      if (S !== 'summer' || !plan.labour.hay) return 0;
      const per = C.HAY_PER_HAND * ((out.res.wf && out.res.wf.perHand) || 1);
      // the fewest hands that cut all but the last ton the field can give
      const needed = per > 0 ? Math.ceil(Math.max(0, (out.rep.hayCap || 0) - 1) / per) : plan.labour.hay;
      return Math.max(0, plan.labour.hay - Math.max(1, needed));
    }
    const work = fold('work', 'Work', () => {
      const xs = E.CATS[S].filter((c) => plan.labour[c] > 0).map((c) => `${plan.labour[c]} ${L[c][1]}`);
      const idle = unassigned();
      const wasted = wastedHay();
      return { text: xs.length ? list(xs) : 'Nobody given work', warn: [idle ? `${nOf(idle, 'hand', 'hands')} idle` : '', wasted ? `${nOf(wasted, 'hand', 'hands')} on hay with nothing to cut` : ''].filter(Boolean).join('; ') || null };
    }, [
      teach ? liveText('p', 'sec-note', () => { const wf = out.res.wf; return `Herd chores take about ${t1(wf.chores)} hands' worth of your household's labour. ${wf.hands} hands are free to give out, ${unassigned()} not yet given.`; })
        : liveText('p', 'sec-note', () => `${out.res.wf.hands} hands free after herd chores, ${unassigned()} not yet given.`),
      E.CATS[S].map((c) => row(L[c][0], L[c][2], stepper({
        aria: L[c][0], get: () => plan.labour[c], set: (v) => { plan.labour[c] = v; }, max: () => plan.labour[c] + unassigned(),
      }), L[c][3])),
    ]);

    /* --- livestock: one grid --- */
    let showHorses = (plan.sellHorseIds || []).length > 0;
    const horseBox = h('div', { class: 'horse-sale' });
    const drawHorses = () => {
      if (!showHorses || !(state.stable && state.stable.length)) { horseBox.replaceChildren(); return; }
      horseBox.replaceChildren(h('ul', { class: 'horse-list' }, state.stable.slice().sort((a, b) => IS.Stable.worth(b) - IS.Stable.worth(a)).map((x) => {
        const cb = h('input', { type: 'checkbox', onchange: (e) => {
          const set = new Set(plan.sellHorseIds || []);
          if (e.target.checked) set.add(x.id); else set.delete(x.id);
          plan.sellHorseIds = [...set]; plan.sell.horses = plan.sellHorseIds.length; update();
        } });
        if ((plan.sellHorseIds || []).includes(x.id)) cb.checked = true;
        const price = h('span', { class: 'horse-price' });
        reg(() => {
          const ids = plan.sellHorseIds || [], mult = (prices && prices.horses) || 1;
          if (ids.includes(x.id)) { const e = E.horseLot(state.stable.filter((y) => ids.includes(y.id)), mult).each.find((z) => z.id === x.id); price.textContent = `${e ? e.price : '?'} ells`; }
          else price.textContent = `about ${E.horseLot([x], mult).total} ells`;
        });
        return h('li', null, h('label', { class: 'horse-line' }, cb, h('b', null, x.name), h('span', { class: 'horse-stats' }, `speed ${x.speed}, strength ${x.strength}`), price));
      })));
      update();
    };
    const horseToggle = h('button', { type: 'button', class: 'btn btn-small', onclick: () => { showHorses = !showHorses; drawHorses(); } });
    reg(() => { const n = (plan.sellHorseIds || []).length; horseToggle.textContent = n ? `${n} chosen` : showHorses ? 'Hide' : 'Choose'; horseToggle.setAttribute('aria-expanded', String(showHorses)); });
    const herd = [['cattle', 'Cattle'], ['sheep', 'Sheep'], ['horses', 'Horses']];
    const cell = (cls, ...kids) => h('div', { class: 'hg-cell ' + cls }, ...kids);
    const herdGrid = h('div', { class: 'herd-grid', role: 'table', 'aria-label': 'Livestock' },
      h('div', { class: 'hg-row hg-head', role: 'row' }, cell('hg-name', ''), cell('hg-have', 'Have'), cell('hg-price', 'Sell / buy'), cell('hg-ctl', 'Slaughter'), cell('hg-ctl', 'Sell'), cell('hg-ctl', 'Buy')),
      herd.map(([key, label]) => h('div', { class: 'hg-row', role: 'row' },
        cell('hg-name', h('b', null, label)),
        cell('hg-have', String(f[key])),
        cell('hg-price', key === 'horses' ? `by worth / ${px('horses', true)}` : `${px(key, false)} / ${px(key, true)}`),
        cell('hg-ctl', key === 'horses' ? '' : stepper({ aria: 'Slaughter ' + label.toLowerCase(), get: () => plan.cull[key], set: (v) => { plan.cull[key] = v; }, max: () => f[key] - plan.sell[key] })),
        cell('hg-ctl', key === 'horses' ? (state.stable && state.stable.length ? horseToggle : '') : stepper({ aria: 'Sell ' + label.toLowerCase(), get: () => plan.sell[key], set: (v) => { plan.sell[key] = v; }, max: () => f[key] - (plan.cull[key] || 0) })),
        cell('hg-ctl', stepper({ aria: 'Buy ' + label.toLowerCase(), get: () => plan.buy[key], set: (v) => { plan.buy[key] = v; }, max: () => 40 })))));
    const marketNote = liveText('p', 'sec-note market-note', () => {
      const xs = [];
      for (const k of ['cattle', 'sheep']) {
        const m = (prices && prices[k]) || 1;
        if (plan.sell[k] > 1) { const l = E.lot(k, plan.sell[k], false, m); xs.push(`Selling ${animal(k, plan.sell[k])} brings about ${fmt(l.total)} ells (${Math.round(l.avg)} each).`); }
      }
      return xs.length ? xs.join(' ') + ' A crowded market pays less.' : '';
    });
    const herdSec = fold('herd', 'Livestock', () => {
      const cull = ['cattle', 'sheep'].filter((k) => plan.cull[k]).map((k) => animal(k, plan.cull[k]));
      const sell = ['cattle', 'sheep'].filter((k) => plan.sell[k]).map((k) => animal(k, plan.sell[k]))
        .concat((plan.sellHorseIds || []).map((id) => (state.stable.find((x) => x.id === id) || {}).name).filter(Boolean));
      const buy = herd.map(([k]) => k).filter((k) => plan.buy[k]).map((k) => animal(k, plan.buy[k]));
      const xs = [cull.length && 'slaughter ' + list(cull), sell.length && 'sell ' + list(sell), buy.length && 'buy ' + list(buy)].filter(Boolean);
      const herdLine = (g) => herd.map(([k]) => animal(k, g(k))).join(', ');
      const after = (k) => Math.max(0, f[k] - (plan.cull[k] || 0) - (k === 'horses' ? (plan.sellHorseIds || []).length : plan.sell[k] || 0) + (plan.buy[k] || 0));
      const changed = herd.some(([k]) => after(k) !== f[k]);
      return { text: xs.length ? cap(xs.join('; ')) : 'No changes to the herd',
        sub: `Herd: ${herdLine((k) => f[k])}${changed ? ` → ${herdLine(after)}` : ''}` };
    }, [
      teach ? h('p', { class: 'sec-note' }, 'A slaughtered cow feeds four people for a season and a sheep feeds less than one. Every animal you keep needs hay all winter. A horse sells for what it is worth, and you cannot tell how good a bought horse is until it is yours.') : null,
      herdGrid, horseBox, marketNote,
    ]);
    drawHorses();

    /* --- buying in --- */
    const goods = fold('goods', 'Buying in', () => {
      const xs = [plan.buy.hay && `${plan.buy.hay} t of hay`, plan.buy.food && `${plan.buy.food} rations of food`].filter(Boolean);
      return { text: xs.length ? 'Buy ' + list(xs) : 'Nothing bought' };
    }, [
      row('Hay', `${px('hay', true)} ells a ton.`, stepper({ aria: 'Buy hay', get: () => plan.buy.hay, set: (v) => { plan.buy.hay = v; }, max: () => 200, step: 5, fmt: (v) => v + ' t' })),
      row('Food', `${px('food', true)} ells a ration${teach ? '. Flour, malt and dried fish from merchants.' : '.'}`, stepper({ aria: 'Buy food', get: () => plan.buy.food, set: (v) => { plan.buy.food = v; }, max: () => 100, step: 2 })),
    ]);

    /* --- the house: the table, and the thralls --- */
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
    const HOSP_WORD = { plain: 'Plain table', open: 'Open hand', lavish: 'Lavish feast' };
    const hasThralls = state.household.thralls.length > 0;
    const people = fold('house', S === 'winter' ? 'The Jól table' : 'Hospitality', () => ({
      text: HOSP_WORD[plan.hospitality] + (hasThralls ? `; thralls treated ${plan.treatment}ly` : ''),
    }), [
      radios('hospitality', [hospOpt('plain', 'Plain table'), hospOpt('open', 'Open hand'), hospOpt('lavish', 'Lavish feast')], () => plan.hospitality, (v) => { plan.hospitality = v; }),
      hasThralls ? [h('h3', null, 'Your thralls'), radios('treatment', [
        { value: 'harsh', label: 'Harsh', desc: 'They work about a tenth harder. Resentment climbs.' },
        { value: 'fair', label: 'Fair', desc: 'What custom allows.' },
        { value: 'kind', label: 'Kind', desc: 'They eat better, a quarter more food. Resentment eases.' },
      ], () => plan.treatment, (v) => { plan.treatment = v; })] : null,
    ]);

    /* --- other dealings: people, land, marriage. Rare, so folded away --- */
    const canWife = E.canSeekWife(state), canConc = IS.Marriage.canTakeConcubine(state), heirNeed = IS.Marriage.needsHeir(state);
    const deals = fold('deals', 'Other dealings', () => {
      const xs = [plan.buy.servants && `hire ${nOf(plan.buy.servants, 'servant', 'servants')}`, plan.buy.thralls && `buy ${nOf(plan.buy.thralls, 'thrall', 'thralls')}`,
        plan.sell.thralls && `sell ${nOf(plan.sell.thralls, 'thrall', 'thralls')}`, plan.buy.land && `buy ${nOf(plan.buy.land, 'parcel', 'parcels')} of land`,
        plan.seekWife && 'court a wife', plan.concubine && 'take a concubine'].filter(Boolean);
      return { text: xs.length ? cap(list(xs)) : 'Servants, thralls, land and marriage', warn: heirNeed && canWife && !plan.seekWife ? 'You have no heir' : null };
    }, [
      row('Hire servants', `${C.HIRE_FEE} ells to take one on, then ${C.WAGE} a season. You have ${state.household.servants.length}.`, stepper({ aria: 'Hire servants', get: () => plan.buy.servants, set: (v) => { plan.buy.servants = v; }, max: () => 3 })),
      row('Buy a thrall', `${px('thrall', true)} ells each. You have ${state.household.thralls.length}.${teach ? ' Too many thralls to free men invites revolt.' : ''}`, stepper({ aria: 'Buy thralls', get: () => plan.buy.thralls, set: (v) => { plan.buy.thralls = v; }, max: () => 3 })),
      hasThralls ? row('Sell a thrall', `${px('thrall', false)} ells each. The most resentful go first.`, stepper({ aria: 'Sell thralls', get: () => plan.sell.thralls, set: (v) => { plan.sell.thralls = v; }, max: () => state.household.thralls.length })) : null,
      row('Land', `${fmt(E.landPrice(f, prices && prices.land))} ells buys ${C.PARCEL_TONS} more tons of hayfield.`, stepper({ aria: 'Buy land', get: () => plan.buy.land, set: (v) => { plan.buy.land = v; }, max: () => 3, fmt: (v) => v + (v === 1 ? ' parcel' : ' parcels') })),
      canWife ? h('label', { class: 'check' },
        (() => { const i = h('input', { type: 'checkbox', onchange: (e) => { plan.seekWife = e.target.checked; update(); } }); if (plan.seekWife) i.checked = true; return i; })(),
        h('span', null, h('b', null, state.household.wives.length ? 'Court a second wife this summer. ' : 'Court a wife this summer. '),
          (() => {
            const w = IS.Marriage.suitWords(state);
            return `Gifts and the wedding feast cost ${fmt(C.wedding(tier))} ells. About ${Math.round(IS.Marriage.suitChance(state) * 100)} in 100 that she accepts` +
              (w.up.length ? `, helped by ${w.up.join(' and ')}` : '') + (w.down.length ? `${w.up.length ? ', but' : ','} hurt by ${w.down.join(' and ')}` : '') + '.';
          })(),
          state.household.wives.length ? ' She would bring a dowry and legitimate children, and your wife will not like it.' : '',
          heirNeed ? ' You have no son and no wife young enough to bear one.' : '')) : null,
      canConc ? h('label', { class: 'check' },
        (() => { const i = h('input', { type: 'checkbox', onchange: (e) => { plan.concubine = e.target.checked; update(); } }); if (plan.concubine) i.checked = true; return i; })(),
        h('span', null, h('b', null, 'Take a concubine. '), `Gifts to her family cost ${fmt(C.concubine(tier))} ells. No dowry, and her sons are heirs only if you have no legitimate son.${state.household.wives.length ? ' Your wife will take it badly.' : ''}`)) : null,
    ]);

    /* --- a raid: one line until you can afford it --- */
    let raidSec = null;
    const R = IS.Raid;
    if (S === 'summer' && R.canRaid(state)) {
      const deps = R.deputies(state), total = R.cost(state), afford = E.cashOf(f) >= total;
      const oath = state.vow && state.vow.status === 'sworn' ? state.vow : null;
      if (!afford) {
        raidSec = h('div', { class: 'plan-sec plan-line' }, h('span', { class: 'fold-title' }, 'A raid'),
          h('span', { class: 'fold-sum' }, `${state.ship ? 'You cannot fit out a crew yet' : 'No ship yet'}: it costs ${fmt(total)} ells and you hold ${fmt(E.cashOf(f))} now.${oath ? ` Your oath to avenge ${oath.fallen} must wait.` : ''}`));
      } else {
        const destBox = h('div', { class: 'choices', role: 'radiogroup', 'aria-label': 'Where to raid' });
        const depBox = h('div', null);
        const lootWord = (l) => (l >= 1900 ? 'immense' : l >= 1500 ? 'great' : l >= 1100 ? 'large' : 'fair');
        const draw = () => {
          const opt = (value, label, desc) => {
            const input = h('input', { type: 'radio', name: 'raiddest', value, onchange: () => {
              plan.raid = value ? { dest: value, deputyId: (plan.raid && plan.raid.deputyId) || deps[0].id } : null; update(); draw();
            } });
            if ((plan.raid ? plan.raid.dest : '') === value) input.checked = true;
            return h('label', { class: 'choice' }, input, h('span', { class: 'choice-text' }, h('b', null, label), ' ', h('span', null, desc)));
          };
          destBox.replaceChildren(opt('', 'Stay home', 'No raid this summer.'),
            ...R.ORDER.map((id) => {
              const d = R.DEST[id], pct = Math.round(R.deathEstimate(state, id, true) * 100);
              const fav = state.favors && state.favors[id];
              return opt(id, d.name, `${d.winter ? 'Away until next summer. ' : 'Home by autumn. '}About ${pct} in 100 of not returning. Plunder ${lootWord(d.loot)}.${fav ? ' Its king favors you.' : ''}${oath && oath.dest === id ? ` Your oath to avenge ${oath.fallen} draws you here.` : ''}`);
            }));
          depBox.replaceChildren(...(plan.raid ? [
            h('h3', null, 'Who runs the farm while you are gone?'),
            h('div', { class: 'choices', role: 'radiogroup', 'aria-label': 'Who runs the farm' }, deps.map((x) => {
              const input = h('input', { type: 'radio', name: 'raiddep', value: x.id, onchange: () => { plan.raid.deputyId = x.id; update(); } });
              if (plan.raid.deputyId === x.id) input.checked = true;
              return h('label', { class: 'choice' }, input, h('span', { class: 'choice-text' }, h('b', null, x.name), ' ', h('span', null, `${x.role}, ${x.age}, husbandry ${x.husbandry}.`)));
            })),
            R.heirless(state) ? h('p', { class: 'sec-note' }, 'You have no son or brother to inherit. If you do not come back, the line ends.') : null].filter(Boolean) : []));
        };
        raidSec = fold('raid', 'A raid', () => {
          if (!plan.raid) return { text: 'Staying home', warn: oath ? `your oath to avenge ${oath.fallen} waits` : null };
          const dep = deps.find((x) => x.id === plan.raid.deputyId);
          return { text: `Sail for ${R.DEST[plan.raid.dest].short || R.DEST[plan.raid.dest].name}${dep ? `; ${dep.name.split(' ')[0]} runs the farm` : ''}` };
        }, [
          h('p', { class: 'sec-note' }, `${teach ? "Sail this summer and bring home plunder, captives and, perhaps, a foreign king's favor. You are not here to work the farm. " : ''}Whether you come back rests on your Strength (${Math.round(head.attrs.strength)}). ${state.ship ? 'Crew and outfitting' : 'Ship, crew and outfitting'}: ${fmt(total)} ells, paid before anything else.`),
          destBox, depBox,
        ]);
        draw();
      }
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
        ...(S === 'summer' ? [
          h('p', { class: 'out-label' }, 'Meat and food laid up for winter', h('b', null, ` have ${t1(o.res.farm.provisions)}, house needs about ${t1(o.rationNeed)}`)),
          h('p', { class: 'out-verdict' }, o.res.farm.provisions >= o.rationNeed ? 'Winter stores are covered. There is no need to slaughter more.'
            : o.res.farm.provisions >= o.rationNeed * 0.8 ? 'Nearly enough. Winter fishing and dairy should make up the rest.'
              : (plan.cull.cattle || plan.cull.sheep) || plan.buy.food ? 'Short for the winter. Slaughter more, or buy food, or plan to fish.' : 'Short for the winter. Slaughter some stock, buy food, or put more hands on the fishing.')] : []),
        h('p', { class: 'out-label' }, 'Cash', h('b', null, ` ${fmt(o.cashStart)} → ${fmt(o.cashEnd)} ells`)),
        ...(notes.length ? [h('ul', { class: 'out-notes' }, notes.map((x) => h('li', null, x)))] : []),
        h('p', { class: 'out-foot' }, 'These are expectations for an average season. The weather will not be average.'));
    };
    reg(rebuildOutlook);

    /* --- dock: the three numbers that matter, coloured when the plan falls short --- */
    const dockChips = h('div', { class: 'dock-chips' });
    reg(() => {
      const o = out, n = o.needs, foodOk = o.rationHave >= o.rationNeed;
      const hayCls = o.hayHave < n.mild ? 'chip bad' : o.hayHave < n.normal ? 'chip warn' : 'chip';
      const cashCls = o.cashEnd < 0 ? 'chip bad' : 'chip';
      dockChips.replaceChildren(
        h('span', { class: hayCls }, 'Hay ', h('b', null, `${t1(o.hayHave)} / ${t1(n.normal)} t`)),
        h('span', { class: foodOk ? 'chip' : 'chip bad' }, 'Food ', h('b', null, foodOk ? 'enough' : 'short')),
        h('span', { class: cashCls }, 'Cash at season’s end ', h('b', null, fmt(o.cashEnd))));
    });
    const carry = () => {
      // remember the routine part of the plan for "same as last season"; one-off dealings are not repeated
      const keep = JSON.parse(JSON.stringify(plan));
      delete keep.raid; delete keep.seekWife; delete keep.concubine;
      keep.buy.land = 0; keep.buy.thralls = 0; keep.buy.servants = 0; keep.sell.thralls = 0; keep.sell.horses = 0; keep.sellHorseIds = [];
      state.seasonPlans = Object.assign({}, state.seasonPlans, { [S]: keep });
      ctl.resolve(plan);
    };
    const dock = h('div', { class: 'dock' }, h('div', { class: 'dock-inner' }, dockChips,
      h('div', { class: 'dock-btns' }, farmButton(state), state.families && IS.Feud ? neighborsButton(state) : null,
        h('button', { class: 'btn btn-primary', type: 'button', title: 'Enter', onclick: carry }, S === 'summer' ? 'Carry out the summer' : 'Carry out the winter'))));

    /* --- assemble --- */
    const beats = IS.Calendar.turnInfo(state.turn, state.startYear).beats.map((b) => b.name).join(', ');
    const last = state.seasonPlans && state.seasonPlans[S];
    const sameAsLast = () => {
      const p = JSON.parse(JSON.stringify(last));
      for (const k of ['cattle', 'sheep']) { p.cull[k] = Math.min(p.cull[k] || 0, f[k]); p.sell[k] = Math.min(p.sell[k] || 0, f[k] - p.cull[k]); }
      ctl.replan(p);
    };
    const intro = h('section', { class: 'season-head' },
      h('h1', null, `${cap(S)} of ${year}`),
      h('p', { class: 'omen' }, S === 'winter' && omen.winter ? omen.winter : omen.text),
      h('p', { class: 'beats' }, `This season: ${beats}.`),
      state.ambition ? h('p', { class: 'ambition' }, h('span', { class: 'amb-k' }, state.ambition.doneTurn != null ? 'Ambition fulfilled' : 'The family’s ambition'), ' ',
        h('b', null, state.ambition.text + '.'), state.ambition.doneTurn == null ? ' ' + IS.Saga.hintOf(state.ambition) : '') : null,
      state.regency ? h('p', { class: 'ambition case-line' }, h('span', { class: 'amb-k' }, 'A boy in the high seat'),
        `${state.regency.kind === 'foster' ? `You are being fostered at ${state.regency.farm}; ${state.regency.regentName} keeps the farm` : state.regency.kind === 'household' ? 'The household runs the farm between them' : `${state.regency.regentName} holds the farm`} until you come of age in ${IS.Calendar.turnInfo(state.regency.until, state.startYear).year}.`) : null,
      (state.cases || []).length ? h('p', { class: 'ambition case-line' }, h('span', { class: 'amb-k' }, 'Before the Alþing'),
        state.cases.map((cs) => h('span', { class: 'case-item' }, h('b', null, cs.side === 'plaintiff' ? `Your case against ${cs.head} of ${cs.farm}` : `${cs.head} of ${cs.farm}'s case against you`), `, for ${IS.Law.chargeWord(cs)}. Heard in the summer of ${IS.Calendar.turnInfo(cs.hearing, state.startYear).year}.`))) : null,
      h('div', { class: 'plan-tools' },
        h('button', { class: 'btn', type: 'button', onclick: () => ctl.replan(E.suggest(state)) }, 'Usual plan'),
        last ? h('button', { class: 'btn', type: 'button', onclick: sameAsLast }, `Same as last ${S}`) : null,
        h('button', { class: 'btn', type: 'button', onclick: () => ctl.replan({ hospitality: plan.hospitality, treatment: plan.treatment }) }, 'Clear')),
      h('p', { class: 'plan-hint' }, 'Open a line to change it. Enter carries out the plan.'));

    const main = h('div', { class: 'main' }, intro, h('div', { class: 'folds' }, work, herdSec, goods, raidSec, people, deals));
    const page = h('div', { class: 'page has-dock' }, bar(state, ctl, abandonButton(ctl)),
      h('main', { class: 'layout' }, main, h('aside', { class: 'ledger', 'aria-label': 'Outlook and standing' }, outlookBox, standingSec(state))), dock);
    document.onkeydown = (e) => {
      if (e.key !== 'Enter' || e.repeat || !document.body.contains(page) || document.querySelector('dialog[open]')) return;
      if (e.target.closest && e.target.closest('button, input, summary, select, textarea, a')) return;
      e.preventDefault(); carry();
    };
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
  /** The battle screen: two columns of named men, and the last rounds. */
  function battlePanel(b) {
    const mark = (m) => (m.hp >= (m.max || 2) ? 'fit' : m.hp > 0 ? 'wounded' : m.dead ? 'dead' : 'down');
    const WORD = { fit: 'standing', wounded: 'wounded', down: 'out of the fight', dead: 'dead' };
    const col = (title, side) => h('div', { class: 'bt-side' }, h('h3', null, title),
      h('ul', null, side.map((m) => h('li', { class: 'bt-man bt-' + mark(m) }, h('span', { class: 'bt-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'bt-name' }, m.name + (m.lead ? ' ★' : '')), m.tag ? h('span', { class: 'bt-tag' }, ' ' + m.tag) : null, h('span', { class: 'bt-state' }, WORD[mark(m)])))));
    const pips = Array.from({ length: b.max }, (_, i) => h('span', { class: 'bt-pip' + (i < b.round - 1 ? ' done' : i === b.round - 1 ? ' now' : '') }));
    if (b.duel) {
      const fighter = (m, side) => h('div', { class: 'du-man du-' + mark(m) },
        h('p', { class: 'du-side' }, side), h('p', { class: 'du-name' }, m.name), h('p', { class: 'du-str' }, `Strength ${Math.round(m.str)}`),
        h('div', { class: 'du-hp', role: 'img', 'aria-label': `${m.hp} of ${m.max} before he falls` }, Array.from({ length: m.max || 3 }, (_, i) => h('span', { class: i < m.hp ? 'on' : '' }))),
        h('p', { class: 'du-state' }, WORD[mark(m)]));
      return h('section', { class: 'battle duel', 'aria-label': 'Single combat' },
        h('div', { class: 'bt-rounds' }, h('span', null, `Exchange ${Math.min(b.round, b.max)} of ${b.max}`), h('span', { class: 'bt-pips' }, pips)),
        h('div', { class: 'du-cols' }, fighter(b.us[0], 'You'), h('span', { class: 'du-vs', 'aria-hidden': 'true' }, 'against'), fighter(b.them[0], 'The killer')),
        b.log.length ? h('ol', { class: 'bt-log' }, b.log.slice(0, 3).map((l) => h('li', null, l))) : null);
    }
    return h('section', { class: 'battle', 'aria-label': 'The fight' },
      h('div', { class: 'bt-rounds' }, h('span', null, `Round ${Math.min(b.round, b.max)} of ${b.max}`), h('span', { class: 'bt-pips' }, pips)),
      h('div', { class: 'bt-cols' }, col('Your side', b.us), col(`${b.foe}'s side`, b.them)),
      b.log.length ? h('ol', { class: 'bt-log' }, b.log.slice(0, 3).map((l) => h('li', null, l))) : null);
  }

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
      d.view && d.view.card ? h('section', { class: 'case-card' }, h('h2', null, d.view.card.title), h('dl', { class: 'stock' }, d.view.card.rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]))) : null,
      d.view && d.view.battle ? battlePanel(d.view.battle) : null,
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
      (() => {
        const sg = IS.Saga.write(state);
        return h('section', { class: 'rep-sec saga' },
          h('h2', null, sg.title),
          h('p', { class: 'saga-rating' }, h('b', null, sg.rating + '.'), ' ', sg.ratingNote),
          sg.chapters.map((ch, i) => h('div', { class: 'saga-ch' }, h('h3', null, `Chapter ${i + 1}`), h('p', null, ch.lines.join(' ')))));
      })(),
      h('section', { class: 'rep-sec' }, h('h2', null, 'The reckoning'),
        h('dl', { class: 'stock' },
          h('dt', null, 'Years'), h('dd', null, String(s.years)),
          h('dt', null, 'Heads of the house'), h('dd', null, String(s.heads)),
          h('dt', null, 'Peak Honor'), h('dd', null, String(s.peakHonor)),
          h('dt', null, 'Final worth'), h('dd', null, fmt(s.wealth) + ' ells'),
          h('dt', null, 'Saga score'), h('dd', null, String(IS.Saga.score(state))),
          h('dt', null, 'Ambitions fulfilled'), h('dd', null, String((state.sagaStats && state.sagaStats.ambitions) || 0)))),
      heads.length ? h('section', { class: 'rep-sec' }, h('h2', null, 'Who held the farm'), h('ul', { class: 'people' }, heads)) : null,
      h('div', { class: 'hero-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: ctl.abandon }, 'Roll a new family')));
    return h('div', { class: 'page' }, bar(state, ctl), main);
  }

  IS.ui.playScreen = function (state, ctl, initialPlan) {
    document.onkeydown = null;
    if (state.mode === 'over') return overView(state, ctl);
    if (state.mode === 'incident') return incidentView(state, ctl);
    if (state.mode === 'report') return reportView(state, ctl);
    return planView(state, ctl, initialPlan);
  };
  IS.ui.honorWord = honorWord;
})();
