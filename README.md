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

## Horses
Each horse has a name, a Speed (horse-races) and a Strength (horse-fights), listed under "Your horses". Foals and purchases take after your herd a little; losses fall mostly on the weak, and sold horses are the poorest first. Winners improve slightly.

## Neighbor temperament
Every neighboring house has a fixed nature: jealous, quarrelsome, peaceable or even-tempered. Feelings drift slowly toward what your Honor deserves, except that jealous houses like you less the higher your Honor climbs. Houses that dislike you bring border claims and suits more often, and are picked first by other neighbor events. The "Neighbors" button (top bar) lists them all with how they feel; a house's temper is shown once you have seen how it feels about you.
When you sell horses you choose which ones (tick them under Livestock). A horse's price follows its Speed and Strength, from about half to over one and a half times the going rate, and each extra horse sold in one season fetches a little less. Bought horses are an unknown quantity.

## Vengeance
If the head of the house, or a son or brother of his, is killed on a raid, there is a 50% chance the crew name the man who struck the blow. The head (or, if he was the one killed, his successor) is then asked once whether to swear vengeance (Honor +1; later raids on that coast may find the killer, Honor +6 if he is killed, a wound if the fight is lost) or let it lie (Honor −1.5). An unfulfilled oath is forgotten after fifteen years. `node test/vow.js` checks it.

## Neighbors against each other
Every pair of neighbors has a fixed bond (from their natures and wealth) that events can move. Houses that dislike each other fall into quarrels (insults, stock driven off, killings), which sometimes end on their own and sometimes reach you: a neighbor asks you to ride with him, stand with him at the Thing, lend silver, or (after a killing) join his revenge or back his claim for blood-money. Helping a friend wins his gratitude and the other house's enmity, and can start a feud of your own. The nábúar screen shows who is friends with, or at odds with, whom. `node test/nbrevents.js` plays them through.

## Snowball (Njáls saga)

Every feud keeps a tally of the dead (`Feud.slain`). A killing is a debt: when you kill one of theirs, his kin answer, and you must answer that. Each death past the first raises the feud a stage, so a row over sheep can end with a burning. Four events carry the chain (`js/data/snowball-events.js`):

- **snow_answer** - they kill a man of yours for the man you killed. Prosecute, count the dead and settle, ride again (which restarts the loop), or let it lie.
- **snow_allies** - at three dead, a kinsman of the enemy takes his side. Ask a friend to stand with you (gives your side an edge in fights), pay the kinsman to stay out, or ignore it (a second house becomes your enemy, and their attacks grow).
- **snow_peace** - a respected man counts the dead and offers a settlement; the side with fewer dead pays the difference. Accept, demand more, or refuse.
- **snow_broken** - during the truce a hothead on either side breaks the peace. Defend your own man, pay double, or send him abroad. If it was them, prosecute, take a double price, avenge or swallow it.

The *nábúar* dialog shows the tally and any truce. `node test/snowball.js 80 avenge` plays an always-avenge line to check the chain.

## The planning screen

Each season opens with the household's usual plan already filled in, shown as one line per area (work, livestock, buying in, raid, the table, other dealings). Open a line to change it; the game remembers which lines you keep open. **Same as last summer/winter** repeats your routine choices (not one-off dealings like land, thralls, marriage or a raid). Explanatory text shows for the first two years only. The bottom bar turns amber when hay or food falls short; **Farm** opens the farm and household ledger. Enter carries out the plan.

## The story layer (Phase 1)

- **Chronicle** (`js/core/saga.js`, `state.chronicle`): notable deeds as they happen (Honor swings of 1.5 or more, family deaths, marriages, burnings, ambitions), each tagged with the head of the house at the time. Routine season Honor (cloth, hay, hunger, tables) is left out. The Farm dialog shows the last few entries as "What will be told of you".
- **Ambitions**: each family starts with one, from its history when it has one (an unavenged killing makes vengeance the goal). The others: raise Honor, grow the farm's worth, sail on a raid and come home, marry into a greater house, win two horse races, keep a lavish table three seasons, see two sons grown, end every feud. Fulfilling one gives Honor +4 and an event to choose the next from three. The plan screen shows the current ambition.
- **Warnings**: 60% of stage 4 and 5 feud blows (a killing, a burning) are signalled a season ahead (`warn_coming`): a shepherd, a kinsman, a beggar, or a wife's dream. Hire guards (may turn the killing back; more men at a burning), send the women and children to kin, strike first, have him bound to the peace by the goði, or wait.
- **The saga**: when the line ends, `Saga.write` tells the chronicle as saga prose, a chapter for each head of the house, with a rating from *Forgotten* to *A great saga, set down on vellum*. `node test/saga.js` prints one.

## History and the household (Phase 2)

Dated events (`js/core/history.js`, `js/data/history-events.js`), pushed the season before they happen:
- **975–976, the famine winters**: dire omens, severe winters, food and hay dear. Buy meal from a Norwegian ship, slaughter early, or trust the farm; in the winter the hungry walk the roads (feed them, feed the children, or bar the door).
- **985–986, Eiríkr the Red's Greenland fleet**: sell the land and sail (14 of 25 ships arrived: a safe passage, storms that cost stock and people, or near-wreck). You start over at a new farm with free land and new neighbors, Eiríkr at Brattahlíð among them; every Icelandic feud and debt stays behind. Or send a son (word and ivory come back years later), or put silver in a cargo.
- **997–998, Þangbrandr the priest**: be baptized, take the prime-signing, drive him off (he fights), or listen.
- **1000, the Alþing takes up the faith**: stand with the Christians, the old gods, or aside before Þorgeirr's verdict; neighbors react by their own faith. In Greenland: Leifr's priest and Þjóðhildr's church, and in 1003–1006 Þorfinnr Karlsefni's voyage to Vínland.

Household drama (`js/data/kin-events.js`):
- **Sons' tempers**: at 14 a son becomes hot-tempered (22%, 40% if his father is). A hothead brawls, makes verses, and in the end kills; stand behind him, pay, take him in hand (he may leave), or send him abroad. A hot son who inherits becomes a hot-headed head.
- **The wives' quarrel**: a proud, vindictive, malicious or jealous wife may fall out with a friendly neighbor's wife. Seating at a feast, then a thrall killed, then one of yours, then a man of the house, while the two husbands try to keep faith by paying for each death.
- **The land**: at a succession, a grown brother who took his share of the movables may claim a share of the land. Divide it (he farms next door as a friend), buy him out, or refuse (he becomes a hostile neighbor with a claim against you).

`node test/history.js` plays lines through all of it.

## Law and the sword (Phase 3)

- **The Alþing** (`js/core/law.js`, `js/data/law-events.js`): killing, burning and broken-peace cases are filed (by you, or against you through `law_summons` once you have killed a man of theirs) and heard at the next Alþing at least a season later. The hearing is a sequence: witnesses (neighbors, your own household, or bought men who may be exposed), a chieftain's backing (gifts; his odds depend on how he likes you and the other side) or a man learned in the law, then the pleading (careful, bold, let your backer speak, look for a flaw in theirs, or settle before the verdict). Procedural slips void a case. A case card shows where things stand at each step. A verdict can set off a brawl at the Thing.
- **Outlawry**: lose a killing case and you are a lesser outlaw (three years abroad: the Varangian Guard in Miklagarðr, rich and dangerous, or the earl's court in Norway); lose a burning or broken-peace case, or one you defied, or with Honor under 25, and you are a full outlaw (the highlands like Grettir, where hunters come and your kin can try to buy your peace each summer; or leave Iceland for good and let the heir take the farm). The farm runs on the usual plan under a deputy while you are gone.
- **The battle screen** (`js/core/battle.js`): burnings, Thing brawls and outlaw hunters are fought over up to four rounds between named men. Each round: hold the shield wall (safe), press the attack or go for their leader (gambles), break off, or (at the Thing) call the peacemakers. Defenders at a door or on a scree slope are hard to reach; hired guards and friends' men fight beside you.

`node test/law.js` plays hostile districts through all of it.

## The women of the house

Weddings, a concubine brought home, and the death of a wife or concubine are now events of their own (`js/data/house-events.js`), shown before anything else in the season so nothing assumes you already know. A wedding: a great feast or a modest one, and with two wives, who gets the keys of the household. A funeral: a funeral feast or a quiet burial; her kin notice if she was unhappy, and a childless wife's dowry can be sent home to them (or kept, at the risk of a feud). The funeral shows a card in her memory.

More of the story now runs through the women of the house:
- **A wife who leaves you** (`seeks_divorce`) takes her family with her: her kin become hostile at once, a feud opens, and any dowry you could not repay becomes their claim against you.
- **The whetting** (`house_whetting`): when a man of the house lies unavenged, a proud, vindictive, meddling or malicious wife (or your mother) may throw his bloody cloak over your shoulders at supper, as Hildigunnr did to Flosi. Ride, promise vengeance in time, or refuse (and a proud or vindictive wife may leave you over it).
- **Her kin's quarrels** (`house_kin_feud`): your wife's kinsman comes to gather men against a neighbor. Ride with him, offer to arbitrate, or refuse and live with both of them.
- **The widow's suitor** (`house_widow`): after a succession, a neighbor may ask for your father's widow, who would take her young children and their share with her. Bless the match and pay her portion, keep the children, or refuse.
- The starting wife's family is now a house of the district, so it can take part in all of this.

**Raid vengeance is fought out.** When you find the man you swore to kill, it is no longer a single roll: call him out to single combat on the cloaks (up to six exchanges, each choosing to keep your shield up, strike hard or feint for the killing blow, or yield; a win is Honor +6), or come back at night with your crew and fall on his hall (a battle; Honor +3 if he dies), or let him be.

**The verdict screen.** Every Alþing case now ends on a screen of its own that tells the hearing as a short story built from your choices: who rode with you (friends, your household, or bought men), whether a chieftain stood beside you or sent your gifts back, how you pleaded, any turn (a bought witness breaking, a slip in the forms, a flaw found in theirs, a settlement), the verdict and what it means. A card sums it up.

**When the head of the house dies**, it is the first thing you see that season (`house_headdeath`): how he died, how long he held the farm, what people will remember of him, and his burial: a mound with his weapons and his horse (or the churchyard, once the faith has come), an inheritance feast where the heir steps into the high seat before the district, or a simple grave. If a grown son stands by while the lawful heir is a boy, or a concubine's elder son outranks the lawful one in years, you choose who takes the high seat (`house_succession`); the one passed over may leave bitter. A boy under sixteen needs someone to hold the farm (`house_regency`): his mother, a kinsman (who may come to like the high seat too much: `house_usurper`), fostering with a friendly house (a lasting bond, and he comes home better taught), or the household together. He takes the farm himself at sixteen (`house_comingofage`).

**A boy does not fight.** While the head is under sixteen, the house's strongest grown man is its champion (`Feud.champion`): fight odds use his Strength, he takes the wounds, he leads in battles (the boy stays out of them), and he goes to the island in a duel. Fighting events say who will fight in the boy's name, and with no grown man in the house the duel is not offered at all.

