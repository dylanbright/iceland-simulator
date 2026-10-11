# Early Medieval Iceland Simulator

A browser roguelike about running a farm and a dynasty in 10th-century Iceland. Static files only, no backend.

## Run it
Open `index.html` in a browser. Add `#seed=anything` to the URL to replay a specific family.

## Test
`node test/run-tests.js [seedCount]` checks the rules and the family generator.
`node test/sim.js [games] [turns]` autoplays whole games (invariants plus balance figures).

## Structure
- `js/rng.js` seeded PRNG (all randomness goes through it, so runs replay from a seed)
- `js/core/` rules, calendar, people, ancestry generator, starting state, economy (pure per-season maths and every tuning number), turn (weather, deaths, births, succession), raid (the summer voyage), household (wives' moods and the incident roll), save/load
- `js/data/` names, temperament traits, farm misfortunes and windfalls, wife incidents, answerable events
- `js/ui/` DOM helper and screens
- Classic `<script>` files sharing one namespace (`IS`), because Chrome blocks ES modules on `file://`

## Locked decisions
- Two seasons a year (summer, winter); start year 960-985
- One Honor stat (1-100); all attributes 1-100; fighting is Strength
- Strength declines from 40; natural death hazard rises from 55
- Wives have traits, grudges, hidden info; 50% incident chance per wife per turn
- Counsel rule: a wife's Law above the advocate's averages with it
- Thralls included; no supernatural elements

## Status
Playable loop: each season you divide your household's labour, buy and sell stock, choose how open your table is, and the weather decides the rest. Hay, food, cloth, Honor, hunger, births, deaths, daughters' marriages, thrall resentment and succession to an heir all work. Wives now have moods and a 50% chance each season of an incident (17 kinds, picked by Happiness, temperament, grudges and neighbors), which you answer with a choice: gifts, divorce, feuds, honor. Placeholder courtship (one random bride). Travelers, neighbors, kin, servants, thralls, fevers and feuds now bring decisions too (13 kinds). Summer raids: sponsor one yourself (buy a ship, pick a coast from the Hebrides to Frankland, name an adult of your house to run the farm; survival rests on your Strength, plunder and captives and a foreign king's favor come home) or accept a neighbor's invitation as an event. Next: concubines and a real courtship, events and neighbors, the Althing, combat.

## Artwork
Decoration comes from the purchased Viking-art pack in `PNG/` (kept out of the game itself). `python tools/build_art.py` shrinks the chosen pieces into `art/` and inlines them into `css/art.css` as one-colour masks, so they take the theme colours and follow dark mode. Inlined because browsers block mask images loaded from separate files when the game is opened straight from disk. Check the pack's licence before publishing the game online.

## Feuds
Neighbors you wrong turn on you, following the Njáls saga ladder (insults, stock, hay, a thrall, a kinsman, the burning). See `js/core/feud.js` and `js/data/feud-events.js`. Stress test: `node test/feud.js 60 60 mixed`.

## Difficulty
The game is tuned to be noticeably hard: Thing dues, spoilage, harsher winters, higher mortality, and dilemma events (thieves, epidemics, debts, a goði's demands, lawsuits) where every choice costs something. Tuning lives in `js/core/economy.js`, `js/core/rules.js`, and `js/core/household.js`.

## Markets
Prices vary each season. Every animal or thrall you sell pushes the price down and every one you buy pushes it up, so a big sale of sheep fetches less per head; the planning screen shows the total for the lot. The glut lingers into the next season at half strength. You can buy horses and sell thralls (the most resentful go first). `node test/market.js` checks this.
