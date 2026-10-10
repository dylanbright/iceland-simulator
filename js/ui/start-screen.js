/* Start screen: the family you were born into, what you inherit, and the choice to begin or roll another family. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const h = IS.dom.h;
  const N = IS.Names, G = IS.Game, T = IS.Traits;

  const ROLE_LABEL = {
    mother: 'your mother', stepmother: 'your stepmother', brother: 'your brother', sister: 'your sister',
    servant: 'servant', thrall: 'thrall', son: 'your son', daughter: 'your daughter', wife: 'your wife',
  };

  function honorWord(v) {
    if (v < 20) return 'shamed';
    if (v < 35) return 'doubted';
    if (v < 50) return 'ordinary standing';
    if (v < 65) return 'respected';
    if (v < 80) return 'honored';
    return 'renowned';
  }

  const num = (label, v) => [label + ' ', h('b', null, String(v)), '  '];

  function traitList(sex, ids) {
    if (!ids.length) return null;
    return ids.map((id, i) => {
      const d = T.def(sex, id);
      return [h('span', { title: d.desc }, d.name), i < ids.length - 1 ? ', ' : ''];
    });
  }

  function personBlock(state, p, opts) {
    opts = opts || {};
    const age = G.age(state, p);
    const a = p.attrs;
    const role = opts.role || ROLE_LABEL[p.role] || p.role || '';
    const line = [];
    if (p.sex === 'F' && (p.role === 'wife')) line.push(...num('Strength', a.strength), ...num('Law', a.law), ...num('Poetry', a.poetry), ...num('Beauty', a.beauty), ...num('Happiness', a.happiness));
    else if (p.kind === 'thrall') line.push(...num('Strength', a.strength), ...num('Resentment', a.resentment));
    else if (opts.full) line.push(...num('Strength', a.strength), ...num('Law', a.law), ...num('Poetry', a.poetry), ...num('Husbandry', a.husbandry));
    else line.push(...num('Strength', a.strength));
    return h('div', { class: 'person' },
      h('div', null, h('span', { class: 'who' }, N.fullName(p)), ' ', h('span', { class: 'role' }, role ? role + ', ' + age : String(age))),
      h('div', { class: 'attrs' }, line),
      opts.traits || null,
    );
  }

  function wifeTraits(state, wife) {
    const known = wife.knownTraits || [];
    const hiddenLeft = wife.traits.length > known.length;
    const kids = [];
    if (known.length) kids.push(traitList('F', known));
    if (hiddenLeft) kids.push(h('span', { class: 'unknown' }, (known.length ? ' ' : '') + 'You do not yet know all of her ways.'));
    const grudges = (state.grudges[wife.id] || []).map((g) => {
      if (g.target.type === 'person') {
        const t = state.people[g.target.id];
        return h('div', null, 'She has little love for ' + (t ? t.first : 'a member of the house') + ' (' + g.reason + ').');
      }
      return h('div', null, 'Her kin carry ' + g.reason + '.');
    });
    return h('div', { class: 'traits' }, kids, grudges);
  }

  function ledger(state) {
    const head = G.head(state);
    const hh = state.household;
    const f = state.farm;
    const honor = head.attrs.honor;
    const unavenged = state.hooks.filter((x) => x.type === 'unavenged_killing').length;

    const standing = h('section', null,
      h('h2', null, 'Your standing'),
      h('div', { class: 'honor-figure' }, h('span', { class: 'n' }, String(honor)), h('span', { class: 'w' }, 'Honor, ' + honorWord(honor))),
      h('div', { class: 'honor-bar', role: 'img', 'aria-label': 'Honor ' + honor + ' of 100' }, h('span', { style: { width: honor + '%' } })),
      h('p', { class: 'honor-note' }, unavenged
        ? 'A killing in your family is still unavenged. People are watching what you do about it.'
        : 'Courts, feasts and neighbors will all measure you by this.'),
    );

    const farm = h('section', null,
      h('h2', null, f.name),
      h('p', null, 'You are a ' + f.tierLabel + ' in ' + f.valley + ', ' + (f.setting === 'coast' ? 'on the coast' : f.setting === 'river' ? 'by a salmon river' : 'inland') + '.'),
      h('dl', { class: 'stock' },
        h('dt', null, 'Land'), h('dd', null, f.tenure === 'owned' ? 'Yours, worth ' + f.landValue.toLocaleString('en-US') + ' ells' : 'Rented'),
        h('dt', null, 'Stock'), h('dd', null, f.cattle + ' cattle, ' + f.sheep + ' sheep, ' + f.horses + ' horses'),
        h('dt', null, 'Cloth'), h('dd', null, f.vadmal.toLocaleString('en-US') + ' ells of vaðmál'),
        h('dt', null, 'Silver'), h('dd', null, f.silver + ' ounces, refined'),
        h('dt', null, 'Total'), h('dd', null, f.wealth.toLocaleString('en-US') + ' ells'),
      ),
    );

    const people = [personBlock(state, head, { role: 'you', full: true, traits: head.traits.length ? h('div', { class: 'traits' }, traitList('M', head.traits)) : null })];
    hh.wives.forEach((id) => people.push(personBlock(state, state.people[id], { traits: wifeTraits(state, state.people[id]) })));
    if (!hh.wives.length) people.push(h('p', { class: 'empty' }, 'You are unmarried. Your kin expect you to find a wife.'));
    const rest = [];
    ['children', 'kin', 'servants', 'thralls'].forEach((k) => hh[k].forEach((id) => rest.push(state.people[id])));
    const household = h('section', null,
      h('h2', null, 'Your household'),
      people,
      rest.length ? h('ul', { class: 'mini-list' }, rest.map((p) => h('li', null,
        h('span', { class: 'who' }, N.fullName(p)), ' ', h('span', { class: 'role' }, (ROLE_LABEL[p.role] || p.role) + ', ' + G.age(state, p))))) : null,
    );

    const obligations = h('section', null,
      h('h2', null, 'What follows you'),
      state.hooks.length
        ? h('ul', null, state.hooks.map((x) => h('li', { class: 'hook' }, x.text)))
        : h('p', { class: 'empty' }, 'No old debts or feuds follow you. That will not last.'),
    );

    return h('aside', { class: 'ledger', 'aria-label': 'What you inherit' }, standing, farm, household, obligations);
  }

  function station(g, lines, opts) {
    const n = lines.length;
    const head = lines.slice(0, 2), tail = lines.slice(-1), mid = lines.slice(2, n - 1);
    const years = opts.role + ', ' + g.birthYear + ' to ' + g.deathYear;
    return h('li', { class: 'station', style: { '--honor': g.honor } },
      h('h3', null, g.name),
      h('p', { class: 'years' }, years + '. Honor ' + g.honor + '.'),
      head.map((l) => h('p', null, l)),
      mid.length ? h('details', null, h('summary', null, 'Read the rest of his story (' + mid.length + ' more)'), mid.map((l) => h('p', null, l))) : null,
      n > 2 ? tail.map((l) => h('p', { class: 'ended' }, l)) : null,
    );
  }

  function startScreen(state, ctl) {
    const head = G.head(state);
    const gens = state.ancestry.generations;
    const prologue = state.ancestry.prologue;
    const info = G.turnInfo(state);
    const age = G.age(state, head);

    // The lineage, recited: you, then your fathers.
    const names = [{ first: head.first, byname: head.byname }, ...[2, 1, 0].map((i) => ({ first: gens[i].first, byname: gens[i].byname }))];
    const lineage = h('ol', { class: 'lineage', 'aria-label': 'Your line' }, names.map((n, i) => h('li', { style: { '--i': i } },
      i ? h('span', { class: 'son-of' }, 'son of') : null, n.first, n.byname ? h('span', { class: 'byname' }, n.byname) : null)));

    const seedInput = h('input', { id: 'seed', type: 'text', value: state.seed, spellcheck: 'false', autocomplete: 'off',
      onkeydown: (e) => { if (e.key === 'Enter') ctl.setSeed(e.target.value.trim()); },
      onchange: (e) => ctl.setSeed(e.target.value.trim()) });

    const bar = h('header', { class: 'bar' },
      h('span', { class: 'bar-title' }, 'Iceland Simulator'),
      h('div', { class: 'bar-tools' },
        ctl.hasSave() ? h('button', { class: 'btn', type: 'button', onclick: ctl.continueSaved }, 'Continue saved game') : null,
        h('label', { class: 'seed-field', for: 'seed' }, 'Family seed', seedInput),
        h('button', { class: 'btn', type: 'button', onclick: ctl.reroll }, 'Roll a new family'),
      ));

    const hero = h('section', { class: 'hero' },
      lineage,
      h('p', { class: 'hero-place' }, state.farm.name + ' in ' + state.farm.valley + ', in the ' + state.farm.quarter + ' Quarter.'),
      h('p', { class: 'hero-when' }, 'Summer of ' + info.year + '. You are ' + age + ', your father is dead, and the farm is yours.'),
      h('div', { class: 'hero-actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: ctl.begin }, 'Begin as ' + head.first)),
    );

    const thread = h('section', { 'aria-labelledby': 'thread-h' },
      h('h2', { id: 'thread-h', class: 'thread-intro-h', style: { 'font-size': '1.35rem', margin: '0 0 0.4rem' } }, 'How you came to hold this farm'),
      h('p', { class: 'thread-intro' }, 'Each knot is a man of your line, sized by his Honor. What they did is yours to carry.'),
      h('ol', { class: 'thread' },
        prologue.map((p, i) => station(gens[i], p.lines, { role: p.role.charAt(0).toUpperCase() + p.role.slice(1) })),
        h('li', { class: 'station', style: { '--honor': head.attrs.honor } },
          h('h3', null, N.fullName(head)),
          h('p', { class: 'years' }, 'You, born ' + head.birthYear + '. Honor ' + head.attrs.honor + '.'),
          h('p', null, 'You are ' + age + ' winters old. ' + (state.married ? 'You are married, and the house is yours to run.' : 'You have no wife yet.') + ' What you do with the farm, the name and the old quarrels is the saga from here.'),
          h('div', { class: 'hero-actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: ctl.begin }, 'Begin as ' + head.first)),
        ),
      ),
    );

    return h('div', { class: 'page' }, bar,
      h('main', { class: 'layout' }, h('div', null, hero, thread), ledger(state)));
  }

  IS.ui.startScreen = startScreen;
})();
