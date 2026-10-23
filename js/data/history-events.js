/* Dated events (core/history.js schedules them): the famine, Greenland, the new faith, Vínland. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const H = () => IS.History;
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const note = (c, k, x, w) => IS.Saga && IS.Saga.note(c.state, k, x, w);
  const houses = (c) => Object.values(c.state.families || {}).filter((f) => f.head && f.farm !== c.state.farm.name);
  /** Each neighbor house reacts to your faith according to its own. */
  function faithShift(c, mine, d) {
    let pro = 0, con = 0;
    for (const f of houses(c)) {
      f.faith = H().faithOf(c.state, f.farm);
      if (mine === 'aside') continue;
      if (f.faith === mine) { c.goodwill(f.farm, d); pro++; } else { c.goodwill(f.farm, -d); con++; }
    }
    return { pro, con };
  }

  const DEFS = [
    /* ---------- the famine ---------- */
    { id: 'hist_famine', w: 0, needs: () => null,
      title: () => 'The sea ice has not gone out',
      body: (c) => [`It is ${c.p.year}, and the ice lies along the north coast in midsummer. The grass is thin and late everywhere, and the old people talk of the hunger winters their grandparents told them about. Merchants who came this spring are asking twice the usual price for meal, and getting it.`,
        'If this is what it looks like, it will not be one hard winter but two.'],
      options: (c) => {
        const cost = 120 + 40 * c.tier, rations = 6 + 2 * c.tier;
        return [
          { id: 'grain', label: 'Buy meal from the Norwegian ship now', cost, desc: `${ells(cost)} for about ${rations} rations, before the price goes higher.`,
            run: () => { c.pay(cost); c.state.farm.provisions += rations; return 'You bought sacks of meal from the ship at a price that would have been robbery any other year. This year it may be a bargain.'; } },
          { id: 'kill', label: 'Slaughter a fifth of the sheep now and salt the meat', desc: `About ${Math.round(c.state.farm.sheep * 0.2)} sheep. Fewer mouths in the barn, more meat in the store.`,
            run: () => { const C = IS.Economy.C, n = Math.round(c.state.farm.sheep * 0.2); c.state.farm.sheep -= n; c.state.farm.provisions += n * C.SLAUGHTER.sheep; c.earn(n * C.HIDE.sheep); return `You slaughtered ${n} sheep and salted the meat. Fewer animals will go into the winter, and more food will.`; } },
          { id: 'trust', label: 'Trust the farm to see you through', desc: 'Perhaps the old people are wrong.', run: () => 'You said the old people always expect the worst. You hoped they were wrong this time.' },
        ];
      } },

    { id: 'hist_famine_poor', w: 0, needs: () => null,
      title: () => 'The hungry walk the roads',
      body: (c) => ['It is a hunger winter, as the old people said it would be. Whole households from the poorer farms are on the roads, walking from farm to farm with their children. They stand in your yard and do not ask for anything. They do not need to.',
        'At the district meeting some men said that those who cannot feed themselves must be left to fend for themselves. Others said that a district that does that has no right to call itself one.'],
      options: (c) => {
        const food = Math.min(6, Math.max(2, Math.round(c.state.farm.provisions * 0.3)));
        return [
          { id: 'feed', label: `Take them in and share the stores`, desc: `About ${food} rations go to them. Honor +3, and every house in the district will remember it.`,
            run: () => { c.state.farm.provisions = Math.max(0, c.state.farm.provisions - food); c.honor(3, 'You fed the hungry in the famine winter'); for (const f of houses(c)) c.goodwill(f.farm, 4); note(c, 'famine', 'In the famine winter he opened his stores to the hungry, and the district remembered it.', 3); return 'You fed them in the long hall, and some of them stayed until spring. Your own household ate thinly. Nobody complained where you could hear.'; } },
          { id: 'some', label: 'Give the children something and send the rest on', desc: `About ${Math.ceil(food / 3)} rations. Honor +0.5.`,
            run: () => { c.state.farm.provisions = Math.max(0, c.state.farm.provisions - Math.ceil(food / 3)); c.honor(0.5, 'You fed the children of the hungry'); return 'The children ate at your door, and their parents took them on down the valley.'; } },
          { id: 'shut', label: 'Bar the door', desc: 'Your stores are your own. Honor −3.',
            run: () => { c.honor(-3, 'You barred your door in the famine winter'); for (const f of houses(c)) c.goodwill(f.farm, -3); return 'You barred the door. In the morning there was a woman sitting by the wall who had not moved all night.'; } },
        ];
      } },

    /* ---------- Greenland ---------- */
    { id: 'hist_greenland', w: 0, needs: () => null,
      title: () => 'Eiríkr the Red is gathering ships',
      body: (c) => [`Eiríkr the Red has come back from the west, where he spent three years as an outlaw. He has found a country he calls Greenland, and he says it has good pasture, empty fjords, and no one to pay for land. He is gathering ships at the Breiðafjörður for the voyage this summer.`,
        `Men are selling everything they own to go. Others say there is a reason he gave it such a pleasant name. ${c.state.ship ? 'You have a ship of your own.' : 'You would sail in one of his ships.'}`],
      options: (c) => {
        const sonP = c.p.sonId && c.state.people[c.p.sonId];
        const opts = [
          { id: 'sail', label: 'Sell the farm and sail for Greenland', desc: 'You leave every feud and every friend behind. The land is free, and the voyage is dangerous: about one ship in three never arrives. You carry only a few animals.',
            run: () => {
              const r = c.rng.float(0, 1), outcome = r < 0.62 ? 'safe' : r < 0.9 ? 'storm' : 'wreck';
              const lines = H().migrate(c.state, c.rng, c, outcome);
              if (c.head.deathYear == null) c.honor(3, 'You sailed with Eiríkr the Red to Greenland');
              return lines.join(' ');
            } },
        ];
        if (sonP && sonP.deathYear == null) opts.push({ id: 'son', label: `Send ${sonP.first} with him`, desc: `${sonP.first} makes his own way in the new land. You lose a son from the house, and gain a kinsman across the sea. Honor +1.`,
          run: () => { c.removePerson(sonP.id); c.honor(1, `Your son ${sonP.first} sailed for Greenland`); c.state.greenSon = { name: sonP.first, turn: c.state.turn }; note(c, 'greenland', `His son ${sonP.first} sailed with Eiríkr the Red to Greenland.`, 1.5); return `${sonP.first} went down to the ships with an axe, a cow and his share of the stores. His mother did not watch him go.`; } });
        opts.push({ id: 'share', label: 'Put silver into a ship\'s cargo', cost: 150, desc: `${ells(150)}. If the ship comes back with walrus ivory and hides, the profit is yours. If not, not.`,
          run: () => { c.pay(150); c.state.greenShare = { turn: c.state.turn + 4 }; return 'You bought a share in a cargo of meal and iron for the settlers. The skipper promised you ivory in return, in a year or two.'; } });
        opts.push({ id: 'stay', label: 'Stay where your fathers are buried', desc: 'Let other men drown for Eiríkr\'s dream.', run: () => 'You watched the ships go out of the fjord, and went back to the hay.' });
        return opts;
      } },

    /* ---------- the new faith ---------- */
    { id: 'hist_thangbrand', w: 0, needs: () => null,
      title: () => 'Þangbrandr the priest is in the district',
      body: () => ['A priest from Norway, Þangbrandr, has come with King Óláfr\'s backing to preach the White Christ. He is a big man with a bigger temper: he has already killed two men who made mocking verses about him. Some farmers have been baptized. Some have driven him off their land.',
        'He will be at your door before the summer is out.'],
      options: (c) => {
        const odds = IS.Feud.fightOdds(c.state, -0.1);
        return [
          { id: 'baptize', label: 'Be baptized', desc: 'Christian neighbors will warm to you, heathen ones will not. If the new faith wins, you were among the first.',
            run: () => { c.state.faith = 'christian'; const r = faithShift(c, 'christian', 8); note(c, 'faith', 'He was baptized by Þangbrandr the priest, among the first in the district.', 2); return `You went into the cold water and came out a Christian. ${r.con > r.pro ? 'Most of your neighbors think you have lost your mind.' : 'More of your neighbors approve than you expected.'}`; } },
          { id: 'prime', label: 'Take the prime-signing only', desc: 'The sign of the cross, without baptism: what traders do. It offends nobody very much.',
            run: () => { c.state.faith = 'primesigned'; return 'He made the sign over you, and you gave him a meal. You can deal with Christians now, and you have not given up anything else.'; } },
          { id: 'refuse', label: 'Tell him to leave your land', desc: `Heathen neighbors approve. He may not go quietly: ${IS.Feud.oddsWord(odds)} if it comes to blows.`,
            run: () => {
              c.state.faith = 'heathen'; faithShift(c, 'heathen', 6);
              if (c.rng.chance(0.4)) {
                if (c.rng.chance(odds)) { c.honor(2, 'You drove Þangbrandr the priest off your land'); return 'He drew on you in the yard, and you put him on the ground. His companions carried him back to his horse.'; }
                c.head.attrs.strength = Math.max(5, c.head.attrs.strength - 6); c.honor(-1.5, 'Þangbrandr the priest beat you in your own yard'); return 'He fought like a man who expects heaven to catch him. You will carry the scar.';
              }
              return 'He cursed you in Latin and rode on. Your neighbors to the old gods drank your health.';
            } },
          { id: 'listen', label: 'Hear him out and decide nothing', desc: 'A man can listen.', run: () => { c.state.faith = c.state.faith || 'heathen'; return 'You heard him out over a long meal. He was more interesting than you expected, and more frightening.'; } },
        ];
      } },

    { id: 'hist_conversion', w: 0, needs: () => null,
      title: () => 'The Alþing and the new faith',
      body: () => ['At the Alþing this summer the Christians and the heathens came armed, and each side declared itself out of law with the other. For a day the whole country stood on the edge of war.',
        'Then the lawspeaker, Þorgeirr of Ljósavatn, himself a heathen, lay down under his cloak for a day and a night and spoke to no one. When he rose, he said that if the law is torn apart, peace will be torn apart too. Everyone in Iceland is to be baptized. Men may still sacrifice in private, expose children they cannot feed, and eat horse meat, as long as no one sees it.',
        'Before he rose, men had to choose which side to stand on at the Law Rock.'],
      options: (c) => {
        const early = c.state.faith === 'christian';
        return [
          { id: 'christ', label: 'Stand with the Christians', desc: `The winning side. Honor ${early ? '+3: you were baptized early' : '+1'}. Christian neighbors are pleased.`,
            run: () => { c.honor(early ? 3 : 1, 'You stood with the Christians at the Alþing'); faithShift(c, 'christian', 6); c.state.faith = 'christian'; note(c, 'faith', 'At the Alþing of the year 1000 he stood with the Christians, and was on the winning side.', 2); return 'You stood with the Christians. When Þorgeirr gave his verdict, you were already on the right side of it.'; } },
          { id: 'old', label: 'Stand with the old gods', desc: 'Honor −1 when the verdict comes, but heathen neighbors will not forget who stood with them.',
            run: () => { c.honor(-1, 'You stood with the heathens at the Alþing'); faithShift(c, 'heathen', 8); c.state.faith = 'christian'; c.state.oldFaith = true; note(c, 'faith', 'At the Alþing of the year 1000 he stood with the old gods, and went into the water afterward with a hard face.', 2); return 'You stood with the old gods. When the verdict came you were baptized with everyone else, in the cold river, and you kept a small Þórr\'s hammer under your shirt.'; } },
          { id: 'aside', label: 'Stand aside and wait for the verdict', desc: 'No one can say you chose wrong. No one can say you chose.',
            run: () => { c.state.faith = 'christian'; return 'You stood at the edge of the crowd. When the verdict came, you went into the water with the rest.'; } },
        ];
      } },

    { id: 'hist_greenland_faith', w: 0, needs: () => null,
      title: () => 'Leifr Eiríksson brings a priest',
      body: () => ['Leifr, Eiríkr\'s son, has come home from Norway with a priest and King Óláfr\'s command that Greenland be Christian. Eiríkr will have none of it. His wife Þjóðhildr has been baptized and is building a little church at Brattahlíð, and she says she will not share Eiríkr\'s bed until he is baptized too.',
        'The settlers are taking sides, and Eiríkr is watching who takes which.'],
      options: (c) => [
        { id: 'baptize', label: 'Be baptized by Leifr\'s priest', desc: 'Leifr and the younger men approve. Eiríkr does not.',
          run: () => { c.state.faith = 'christian'; c.goodwill('Brattahlíð', -6); for (const f of houses(c)) if (f.farm !== 'Brattahlíð') c.goodwill(f.farm, 3); c.honor(1, 'You were baptized by Leifr\'s priest'); note(c, 'faith', 'He was baptized when Leifr Eiríksson brought the faith to Greenland.', 1.5); return 'You were baptized in the fjord. Eiríkr said nothing to you at the next feast, which was how he said a great deal.'; } },
        { id: 'eirik', label: 'Stand with old Eiríkr', desc: 'Eiríkr remembers loyalty. The church goes up anyway.',
          run: () => { c.state.faith = 'heathen'; c.goodwill('Brattahlíð', 12); return 'You told Eiríkr you had come to Greenland to follow him, not his son. He clapped you on the shoulder hard enough to hurt.'; } },
      ] },

    { id: 'hist_vinland', w: 0, needs: () => null,
      title: () => 'Þorfinnr Karlsefni is sailing to Vínland',
      body: () => ['Þorfinnr Karlsefni, a rich Icelander who married into Eiríkr\'s family, is fitting out ships to settle the land Leifr found in the west, where the grapes grow wild and the timber stands to the shore. He wants men, livestock and anyone with a strong arm.',
        'Leifr came back. Others who went west did not. There are people already living there, and they did not ask for visitors.'],
      options: (c) => {
        const fit = IS.Raid && IS.Raid.headFit(c.state) && IS.Raid.deputies(c.state).length > 0;
        const opts = [];
        if (fit) opts.push({ id: 'go', label: 'Sail west with him for a season', desc: 'You may come home with timber worth a fortune and a name that will never be forgotten, or you may not come home.',
          run: () => {
            const r = c.rng.float(0, 1);
            if (r < 0.2) { c.kill(c.head, 'was killed by the Skrælingar in Vínland', 'killed abroad'); return 'There was a fight on the shore with the people of that country, who came in skin boats with slings. You did not come back to the ship.'; }
            if (r < 0.55) { c.earn(300); c.honor(3, 'You sailed to Vínland with Þorfinnr Karlsefni'); note(c, 'vinland', 'He sailed to Vínland with Þorfinnr Karlsefni and came home with timber, which was more than most did.', 4); return 'You spent a hard season in the west and fought the Skrælingar twice. You came home with a cargo of timber and a story.'; }
            c.earn(800); c.honor(5, 'You sailed to Vínland and came home rich'); note(c, 'vinland', 'He sailed to Vínland with Þorfinnr Karlsefni and came home with a ship low in the water with timber and furs. Few men did that.', 6);
            return 'The land was everything Leifr said. You came home with the ship low in the water with timber, furs and a skin of wild grapes. People will tell this one in Iceland.';
          } });
        opts.push({ id: 'cattle', label: 'Sell him cattle for the voyage', desc: 'He pays well for animals. You lose two cattle.', run: () => { const n = Math.min(2, c.state.farm.cattle); c.state.farm.cattle -= n; c.earn(n * 120); return `Two of your cows went west in the hold. You were paid better for them than any Icelander would.`; } });
        opts.push({ id: 'stay', label: 'Stay on the farm', desc: 'One new country is enough for a lifetime.', run: () => 'You watched the ships go west from the headland, and went home to the cows.' });
        return opts;
      } },
  ];

  IS.Events.DEFS.push(...DEFS);
})();
