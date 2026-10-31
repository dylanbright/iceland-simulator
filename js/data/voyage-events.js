/* The voyage told on its own screen: where you went, how it went, what came home and who did not. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const TIER = { disaster: 'a disaster', poor: 'a poor haul', fair: 'a fair haul', great: 'a great haul', legendary: 'a raid men will sing of' };
  const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

  const DEFS = [
    { id: 'voyage_report', w: 0, needs: () => null,
      title: (c) => (c.p.died ? `${c.p.headName} does not come home from ${c.p.where}` : `The voyage to ${c.p.where}: ${TIER[c.p.tier]}`),
      body: (c) => {
        const P = c.p, out = [P.story];
        const crew = P.crew || [];
        if (crew.length) {
          const well = crew.filter((m) => m.fate === 'well').map((m) => m.name), hurt = crew.filter((m) => m.fate === 'wounded'), dead = crew.filter((m) => m.fate === 'killed');
          const bits = [];
          if (well.length) bits.push(`${well.join(' and ')} came through it without a scratch`);
          if (hurt.length) bits.push(`${hurt.map((m) => m.name).join(' and ')} ${hurt.length === 1 ? 'was' : 'were'} wounded`);
          out.push(`Of the men of your own house: ${bits.join('; ')}.${dead.length ? ` ${dead.map((m) => m.name).join(' and ')} ${dead.length === 1 ? 'did' : 'did'} not come back.${dead.some((m) => m.killer) ? ` The crew know the name of the man who killed ${dead.find((m) => m.killer).name}: ${dead.find((m) => m.killer).killer}.` : ''}` : ''}`);
        } else out.push('Your crew were all hired men, and they took their shares at the beach.');
        if (P.died) out.push(`${P.headName} fell in ${P.where}. The crew brought the ship home, and the news.`);
        else {
          if (P.wound) out.push('You took a bad wound in the fighting, and you will feel it for the rest of your life.');
          if (P.favor) out.push(`${P.king[0].toUpperCase() + P.king.slice(1)} heard of you and sent a gift. You are in his favor now.`);
          if (P.vowFound) out.push('And in a hall on that coast, you found the man you swore to kill.');
          if (P.winter) out.push(`The ship will winter in ${P.where}. You will see Iceland again next summer.`);
        }
        if (P.shipLost) out.push('The ship was lost.');
        return out;
      },
      view: (c) => {
        const P = c.p, crew = P.crew || [];
        const rows = [
          ['Where', P.name],
          ['How it went', TIER[P.tier]],
          ['Plunder', P.loot ? `${ells(P.loot)} (you kept ${P.share}% of a full haul${crew.length ? `, with ${NUM[crew.length] || crew.length} of your own men aboard` : ', with a hired crew'})` : 'nothing'],
        ];
        if (P.captives) rows.push(['Captives', `${NUM[P.captives] || P.captives}, to be thralls on the farm`]);
        if (crew.length) rows.push(['Your men', crew.map((m) => `${m.name}: ${m.fate === 'well' ? 'home, unhurt' : m.fate === 'wounded' ? `wounded (strength −${m.w})` : 'killed'}`).join('; ')]);
        if (!P.died && P.honor) rows.push(['Honor', `${P.honor > 0 ? '+' : ''}${P.honor}`]);
        return { card: { title: 'The voyage', rows } };
      },
      options: (c) => [{ id: 'ok', label: c.p.died ? 'Carry the news home' : c.p.winter ? 'Make camp for the winter' : 'Home to the farm', desc: '', run: () => '' }] },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
