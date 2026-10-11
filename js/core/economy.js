/* Farm economy: tuning constants, labour, and the per-season calculation.
 *
 * Everything here is pure: `season()` reads the game state and returns a new farm plus a report.
 * It uses no randomness; Turn supplies the weather and applies the results. Because it is pure,
 * the same function drives both the real resolution and the "outlook" preview shown while planning.
 *
 * Units: hay in tons, food in rations (one person fed for one season), money in ells of vaðmál.
 */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const A = IS.Ancestry;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const r1 = (v) => Math.round(v * 10) / 10;

  /* ---------- tuning: every number the economy depends on lives here ---------- */
  const C = {
    EYRIR: 30,                       // ells per ounce of refined silver
    HAY_PER_HAND: 20,                // tons a hand can cut and stack in a summer
    LAND_PER_TON: 75,                // ells of land value per ton of hayfield yield
    RENTED_CAP: 26,                  // hayfield a tenant works, in tons
    RENT: 60,                        // ells a summer, tenants only
    HAY_NEED: { cattle: 2.0, horses: 0.8, sheep: 0.25 }, // tons per animal per normal winter
    SEV: {
      mild:   { mult: 0.85, loss: 0.6, fish: 1.15, w: 13, label: 'mild' },
      normal: { mult: 1.0,  loss: 1.0, fish: 1.0,  w: 43, label: 'ordinary' },
      hard:   { mult: 1.2,  loss: 1.7, fish: 0.85, w: 29, label: 'hard' },
      severe: { mult: 1.5,  loss: 3.0, fish: 0.65, w: 15, label: 'severe' },
    },
    CARE_SUMMER: { cattle: 14, sheep: 90, horses: 60 }, // animals one hand can look after
    CARE_WINTER: { cattle: 10, sheep: 80, horses: 50 },
    MILCH: 0.55,                     // share of cattle giving milk
    DAIRY_SUMMER: 1.7, DAIRY_WINTER: 0.4, // rations per milch cow
    FISH_SUMMER: { coast: 4.0, river: 3.5, inland: 1.6 }, // rations per hand
    FISH_WINTER: { coast: 2.5, river: 1.5, inland: 1.0 },
    WEAVE_PER_HAND: 70, WOOL_PER_SHEEP: 1.0, CRAFT_PER_HAND: 5, CRAFT_SUMMER: 3, // ells
    BUILD_PER_HAND: 5, COND_DECAY: 3,
    SLAUGHTER: { cattle: 4, sheep: 0.7 },   // rations from a carcass
    HIDE: { cattle: 5, sheep: 1 },          // ells for hide or pelt
    CLOTH: 0.9,                      // ells of cloth per adult per season
    STORE_KEEP: 0.84, SURPLUS_STORED: 0.7, HAY_CARRY: 0.75,
    WOOL_KEEP: 0.95,                 // moth and damp take a share of unwoven wool each season
    DUES: { summer: [0, 22, 32, 44, 58, 76], winter: [0, 10, 15, 22, 30, 40] }, // Thing dues, ferries, gifts to your goði: ells by farm tier
    CALVES: 0.38, LAMBS: 0.48, FOALS: 0.11,
    BASE_LOSS: { cattle: 0.03, sheep: 0.05, horses: 0.015 },
    PRICE: { cattle: 80, sheep: 16, horses: 80, hay: 16, food: 20, thrall: 110, land: 600 },
    BUY: 1.06, SELL: 0.88,
    // how far each animal you put on the market moves its price (fraction of base), and how far the price can go
    IMPACT: { cattle: 0.035, sheep: 0.018, horses: 0.05, thrall: 0.06 },
    IMPACT_FLOOR: 0.45, IMPACT_CEIL: 1.7,
    PARCEL_TONS: 8,                  // a land purchase adds this much hayfield
    HOSP: {
      cost: { open: [0, 10, 24, 44, 70, 110], lavish: [0, 26, 62, 114, 182, 286] },
      honor: { plain: 0, open: 0.7, lavish: 1.9 },
      winterMult: 1.25,              // Jól
    },
    TREAT: { harsh: { out: 1.10, res: 20, food: 1 }, fair: { out: 1, res: 0, food: 1 }, kind: { out: 1, res: -12, food: 1.25 } },
    OMEN_MOD: [-0.3, -0.15, 0, 0.15, 0.3],
    WAGE: 8, HIRE_FEE: 15,           // servants: ells a season, and to take one on
    wedding(tier) { return 80 + 40 * tier; },
    concubine(tier) { return 40 + 15 * tier; },
  };

  const CATS = { summer: ['hay', 'fish', 'build', 'craft'], winter: ['weave', 'fish', 'craft', 'build'] };
  const SEV_ORDER = ['mild', 'normal', 'hard', 'severe'];

  /* ---------- small helpers ---------- */
  const seasonOf = (state) => (state.turn % 2 === 0 ? 'summer' : 'winter');
  const yearOf = (state) => state.startYear + Math.floor(state.turn / 2);
  const cashOf = (f) => f.vadmal + f.silver * C.EYRIR;
  const wealth = (f) => Math.round(f.landValue + f.cattle * C.PRICE.cattle + f.sheep * C.PRICE.sheep + f.horses * C.PRICE.horses + f.vadmal + f.silver * C.EYRIR + (f.wool || 0));

  /** Pay up to x ells: vaðmál first, then silver (change returned in vaðmál). Returns what was paid. */
  function pay(f, x) {
    x = Math.max(0, Math.min(x, cashOf(f)));
    const fromV = Math.min(f.vadmal, x);
    f.vadmal -= fromV;
    const rest = x - fromV;
    if (rest > 1e-9) {
      const e = Math.ceil(rest / C.EYRIR - 1e-9);
      f.silver -= e;
      f.vadmal += e * C.EYRIR - rest;
    }
    return x;
  }

  /** Change a head count by a fractional expectation, carrying the remainder so nothing is lost to rounding. */
  function adjust(f, key, expected) {
    f.acc = f.acc || {};
    f.acc[key] = (f.acc[key] || 0) + expected;
    const whole = f.acc[key] >= 0 ? Math.floor(f.acc[key]) : Math.ceil(f.acc[key]);
    f.acc[key] -= whole;
    const next = Math.max(0, f[key] + whole);
    const applied = next - f[key];
    f[key] = next;
    return applied;
  }

  const hayCapacity = (f) => (f.tenure === 'rented' ? C.RENTED_CAP : 0) + f.landValue / C.LAND_PER_TON;
  const hayQuality = (f) => 0.85 + 0.003 * f.condition;
  const herdNeed = (f, S) => {
    const c = S === 'summer' ? C.CARE_SUMMER : C.CARE_WINTER;
    return f.cattle / c.cattle + f.sheep / c.sheep + f.horses / c.horses;
  };
  const hayNeed = (f, sev) =>
    (f.cattle * C.HAY_NEED.cattle + f.horses * C.HAY_NEED.horses + f.sheep * C.HAY_NEED.sheep) * C.SEV[sev].mult * (1 - 0.0008 * (f.condition - 50));
  /** What a lot of n animals fetches (or costs): each one moves the price against you. */
  function lot(kind, n, buying, mult) {
    const base = C.PRICE[kind] * (mult || 1) * (buying ? C.BUY : C.SELL), I = C.IMPACT[kind] || 0;
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.max(1, base * (buying ? Math.min(C.IMPACT_CEIL, 1 + I * i) : Math.max(C.IMPACT_FLOOR, 1 - I * i)));
    total = Math.round(total);
    return { total, avg: n ? total / n : Math.round(base) };
  }
  const landPrice = (f, idx) => Math.round(C.PRICE.land * (1 + f.landValue / 8000) * (idx || 1));
  const tierOfFarm = (f) => A.tierOf(wealth(f));

  /* ---------- people and labour ---------- */
  function members(state) {
    const hh = state.household;
    const away = state.expedition && state.turn < state.expedition.untilTurn;
    return [away ? null : state.headId, ...hh.wives, ...(hh.concubines || []), ...hh.children, ...hh.kin, ...hh.servants, ...hh.thralls]
      .map((id) => id && state.people[id]).filter((p) => p && p.deathYear == null);
  }

  function workPower(p, age, T) {
    if (age < 8) return 0;
    let a;
    if (age < 14) a = 0.3; else if (age < 16) a = 0.65; else if (age <= 60) a = 1; else a = Math.max(0.35, 1 - (age - 60) * 0.04);
    let w = a * (0.65 + p.attrs.strength / 285);
    if (p.kind === 'thrall') w *= (1 - (p.attrs.resentment || 35) / 250) * T.out;
    return w;
  }
  function rationNeed(p, age, T) {
    const base = age < 3 ? 0.35 : age < 8 ? 0.55 : age < 14 ? 0.8 : 1;
    return p.kind === 'thrall' && age >= 14 ? base * T.food : base;
  }

  /** Herd chores come first and are automatic; whatever labour is left is divided into whole "hands" for the plan. */
  function workforce(state, treatment, S) {
    S = S || seasonOf(state);
    const Y = yearOf(state), T = C.TREAT[treatment || 'fair'];
    let total = 0, need = 0, cloth = 0, thralls = 0, adults = 0, n = 0;
    const eff = state.expedition && state.turn < state.expedition.untilTurn && IS.Raid ? IS.Raid.stewardEff(state) : 1;
    for (const p of members(state)) {
      const age = Y - p.birthYear;
      let wp = workPower(p, age, T);
      if (p.role === 'wife') {
        if (p.sulkUntil != null && state.turn < p.sulkUntil) wp = 0;
        else if (p.traits.includes('capable')) wp *= 1.15;
      }
      total += wp * eff;
      need += rationNeed(p, age, T);
      cloth += age < 8 ? 0.5 : C.CLOTH;
      n++;
      if (p.kind === 'thrall') thralls++; else if (age >= 14) adults++;
    }
    const chores = herdNeed(state.farm, S);
    const free = Math.max(0, total - chores);
    const hands = Math.max(0, Math.round(free));
    return { total, chores, free, hands, perHand: hands ? free / hands : 0, people: n, rationNeed: need, clothNeed: cloth, thralls, freeAdults: adults, servants: state.household.servants.length };
  }

  function labourOf(plan, wf, S) {
    const cats = CATS[S], a = {};
    let sum = 0;
    cats.forEach((c) => { a[c] = plan.labour[c] || 0; sum += a[c]; });
    for (let i = cats.length - 1; sum > wf.hands && i >= 0; i--) {
      const cut = Math.min(a[cats[i]], sum - wf.hands);
      a[cats[i]] -= cut; sum -= cut;
    }
    const power = {};
    cats.forEach((c) => { power[c] = a[c] * wf.perHand; });
    return { hands: a, power, assigned: sum, idle: wf.hands - sum };
  }

  /* ---------- plans ---------- */
  function canSeekWife(state) {
    const head = state.people[state.headId];
    return seasonOf(state) === 'summer' && state.household.wives.length < 2 && yearOf(state) - head.birthYear >= 17 && !(state.expedition && state.turn < state.expedition.untilTurn);
  }

  function normalizePlan(state, p, S) {
    S = S || seasonOf(state);
    p = p || {};
    const n = (v) => Math.max(0, Math.floor(+v || 0));
    const lab = {};
    CATS[S].forEach((c) => { lab[c] = n(p.labour && p.labour[c]); });
    const g = (o, k) => n(o && o[k]);
    return {
      labour: lab,
      cull: { cattle: g(p.cull, 'cattle'), sheep: g(p.cull, 'sheep') },
      sell: { cattle: g(p.sell, 'cattle'), sheep: g(p.sell, 'sheep'), horses: g(p.sell, 'horses'), thralls: g(p.sell, 'thralls') },
      buy: { hay: g(p.buy, 'hay'), food: g(p.buy, 'food'), cattle: g(p.buy, 'cattle'), sheep: g(p.buy, 'sheep'), horses: g(p.buy, 'horses'), thralls: g(p.buy, 'thralls'), servants: g(p.buy, 'servants'), land: g(p.buy, 'land') },
      hospitality: ['plain', 'open', 'lavish'].includes(p.hospitality) ? p.hospitality : 'plain',
      treatment: ['harsh', 'fair', 'kind'].includes(p.treatment) ? p.treatment : 'fair',
      seekWife: !!p.seekWife && canSeekWife(state) && !(p.raid && p.raid.dest),
      concubine: !!p.concubine && !!IS.Marriage && IS.Marriage.canTakeConcubine(state),
      raid: S === 'summer' && p.raid && p.raid.dest && IS.Raid && IS.Raid.DEST[p.raid.dest] ? { dest: p.raid.dest, deputyId: p.raid.deputyId } : null,
    };
  }

  /* ---------- the season ---------- */
  /**
   * env: { season, weather (summer hay/dairy multiplier), fishLuck, sev (winter), prices, mods }
   * mods: one-off events from Turn: sheepLoss, cattleLoss (fractions), hayMult, fishMult, provLoss, hayLoss,
   *       condDelta, cash, rations, honor.
   */
  function season(state, planIn, env) {
    const S = env.season;
    const plan = normalizePlan(state, planIn, S);
    const f = clone(state.farm);
    f.acc = f.acc || {};
    const mods = env.mods || {};
    const wf = workforce(state, plan.treatment, S);
    const lab = labourOf(plan, wf, S);
    const tier = tierOfFarm(state.farm);
    const price = (kind, buying) => Math.max(1, Math.round(C.PRICE[kind] * ((env.prices && env.prices[kind]) || 1) * (buying ? C.BUY : C.SELL)));
    const rep = { season: S, hands: wf.hands, assigned: lab.assigned, idle: lab.idle, labour: lab.hands, people: wf.people, notes: [], cashStart: Math.round(cashOf(f)) };
    let honor = 0;
    const parts = (rep.honorParts = []);
    const addHonor = (d, why) => { if (!d) return; honor += d; parts.push({ d: Math.round(d * 100) / 100, why }); };

    f.tenure = f.landValue >= 800 ? 'owned' : 'rented';

    /* 1. events that change the starting position */
    if (mods.provLoss) f.provisions *= 1 - mods.provLoss;
    if (mods.hayLoss) f.hay *= 1 - mods.hayLoss;
    if (mods.condDelta) f.condition = clamp(f.condition + mods.condDelta, 0, 100);
    if (mods.cash) f.vadmal += mods.cash;
    let eventRations = mods.rations || 0;
    rep.lostCattleEvent = mods.cattleLoss ? -adjust(f, 'cattle', -f.cattle * mods.cattleLoss) : 0;
    rep.lostSheepEvent = mods.sheepLoss ? -adjust(f, 'sheep', -f.sheep * mods.sheepLoss) : 0;

    /* 2. trade: slaughter, sell, then buy as far as the money goes */
    let slaughterRations = 0;
    const cullC = Math.min(plan.cull.cattle, f.cattle); f.cattle -= cullC;
    const cullS = Math.min(plan.cull.sheep, f.sheep); f.sheep -= cullS;
    slaughterRations += cullC * C.SLAUGHTER.cattle + cullS * C.SLAUGHTER.sheep;
    f.vadmal += cullC * C.HIDE.cattle + cullS * C.HIDE.sheep;
    Object.assign(rep, { cullC, cullS });

    const sold = {}, pressure = {};
    const mult = (k) => (env.prices && env.prices[k]) || 1;
    for (const [k, key] of [['cattle', 'cattle'], ['sheep', 'sheep'], ['horses', 'horses']]) {
      const n = Math.min(plan.sell[k], f[key]);
      f[key] -= n;
      f.vadmal += lot(k, n, false, mult(k)).total;
      sold[k] = n;
      if (n) pressure[k] = -n;
    }
    const nT = Math.min(plan.sell.thralls || 0, state.household.thralls.length);
    sold.thralls = nT;
    if (nT) { f.vadmal += lot('thrall', nT, false, mult('thrall')).total; pressure.thrall = -nT; }
    rep.sold = sold;

    const bought = { hay: 0, food: 0, cattle: 0, sheep: 0, horses: 0, thralls: 0, servants: 0, land: 0 };
    const buy = (kind, key, want) => {
      const p = price(kind, true);
      const n = Math.max(0, Math.min(want, Math.floor(cashOf(f) / p + 1e-9)));
      if (n > 0) pay(f, n * p);
      bought[key] = n;
      if (n < want) rep.notes.push(`You could not afford all ${key === 'food' ? 'the provisions' : key} you wanted.`);
      return n;
    };
    // animals and thralls: every one you buy pushes the price up
    const buyLot = (kind, key, want) => {
      let n = Math.max(0, want);
      while (n > 0 && lot(kind, n, true, mult(kind)).total > cashOf(f) + 1e-9) n--;
      if (n > 0) { pay(f, lot(kind, n, true, mult(kind)).total); pressure[kind] = (pressure[kind] || 0) + n; }
      bought[key] = n;
      if (n < want) rep.notes.push(`You could not afford all the ${key} you wanted.`);
      return n;
    };
    f.hay += buy('hay', 'hay', plan.buy.hay);
    const boughtFood = buy('food', 'food', plan.buy.food);
    f.cattle += buyLot('cattle', 'cattle', plan.buy.cattle);
    f.sheep += buyLot('sheep', 'sheep', plan.buy.sheep);
    f.horses += buyLot('horses', 'horses', plan.buy.horses);
    buyLot('thrall', 'thralls', plan.buy.thralls);
    rep.pressure = pressure;
    if (plan.buy.servants) {
      const n = Math.max(0, Math.min(plan.buy.servants, Math.floor(cashOf(f) / C.HIRE_FEE + 1e-9)));
      pay(f, n * C.HIRE_FEE);
      bought.servants = n;
    }
    for (let i = 0; i < plan.buy.land; i++) {
      const p = landPrice(f, env.prices && env.prices.land);
      if (cashOf(f) < p) { rep.notes.push('You could not afford all the land you wanted.'); break; }
      pay(f, p);
      f.landValue += C.PARCEL_TONS * C.LAND_PER_TON;
      bought.land++;
    }
    f.tenure = f.landValue >= 800 ? 'owned' : 'rented';
    rep.bought = bought;

    if (S === 'summer' && plan.seekWife) {
      const cost = C.wedding(tier);
      if (cashOf(f) >= cost) { pay(f, cost); rep.wedding = { cost }; }
      else rep.notes.push('You could not afford the wedding feast, so no suit was made.');
    }

    if (plan.concubine) {
      const cost = C.concubine(tier);
      if (cashOf(f) >= cost) { pay(f, cost); rep.concubine = { cost }; }
      else rep.notes.push('You could not afford the gifts for a concubine.');
    }

    /* 3. production and the herd */
    const milch = f.cattle * C.MILCH;
    const care = (() => { const nd = herdNeed(f, S); return nd > 0 ? Math.min(1, wf.total / nd) : 1; })();
    rep.care = care;
    let fresh = 0;

    if (S === 'summer') {
      const weather = env.weather;
      const cap = hayCapacity(f) * hayQuality(f);
      const raw = Math.min(cap, lab.power.hay * C.HAY_PER_HAND);
      const made = raw * weather * (mods.hayMult || 1);
      f.hay += made;
      rep.hayMade = made; rep.hayCap = cap;
      const dairy = milch * C.DAIRY_SUMMER * care * (0.85 + 0.15 * weather);
      const fish = lab.power.fish * C.FISH_SUMMER[f.setting] * env.fishLuck * (mods.fishMult || 1);
      rep.dairy = dairy; rep.fish = fish;
      fresh = dairy + fish;
      const craftedS = lab.power.craft * C.CRAFT_SUMMER;
      f.vadmal += craftedS; rep.crafted = craftedS;
      f.condition = clamp(f.condition + lab.power.build * C.BUILD_PER_HAND * (1 - f.condition / 130) - C.COND_DECAY, 0, 100);
      f.wool += f.sheep * C.WOOL_PER_SHEEP * Math.min(1, care + 0.2);
      rep.calves = adjust(f, 'cattle', milch * C.CALVES * care * (0.85 + 0.15 * weather));
      rep.lambs = adjust(f, 'sheep', f.sheep * C.LAMBS * care * (0.8 + 0.2 * weather));
      rep.foals = adjust(f, 'horses', f.horses * C.FOALS);
    } else {
      const sevInfo = C.SEV[env.sev];
      const dairy = milch * C.DAIRY_WINTER * care;
      const fish = lab.power.fish * C.FISH_WINTER[f.setting] * env.fishLuck * sevInfo.fish * (mods.fishMult || 1);
      rep.dairy = dairy; rep.fish = fish;
      fresh = dairy + fish;
      const woven = Math.min(f.wool, lab.power.weave * C.WEAVE_PER_HAND);
      f.wool -= woven; f.vadmal += woven;
      const crafted = lab.power.craft * C.CRAFT_PER_HAND;
      f.vadmal += crafted;
      rep.woven = woven; rep.crafted = crafted;
      f.condition = clamp(f.condition + lab.power.build * C.BUILD_PER_HAND * (1 - f.condition / 130) - C.COND_DECAY * (env.sev === 'severe' ? 2 : 1), 0, 100);
    }

    /* 4. hay: the great constraint. Summer lays it up; winter spends it. */
    rep.needs = {};
    SEV_ORDER.forEach((s) => { rep.needs[s] = hayNeed(f, s); });
    rep.hayHave = f.hay;
    if (S === 'winter') {
      const need = rep.needs[env.sev];
      const short = need > f.hay ? 1 - f.hay / need : 0;
      rep.hayUsed = Math.min(need, f.hay); rep.hayNeedNow = need; rep.hayShort = short;
      f.hay = Math.max(0, f.hay - need) * C.HAY_CARRY;
      const sevInfo = C.SEV[env.sev];
      const k = sevInfo.loss * (1 + (1 - care) * 1.5) * (1.12 - 0.0012 * f.condition);
      const loss = (key, starve) => {
        const frac = 1 - (1 - C.BASE_LOSS[key] * k) * (1 - clamp(starve, 0, 0.9));
        return -adjust(f, key, -f[key] * frac);
      };
      rep.lostCattle = loss('cattle', short * 1.1);
      rep.lostSheep = loss('sheep', short * 0.8);
      rep.lostHorses = loss('horses', short * 0.7);
      if (short > 0.05) addHonor(-Math.min(3, short * 8), 'Your animals went short of hay');
    }

    /* 5. people eat */
    const need = wf.rationNeed;
    const stock = f.provisions + slaughterRations + boughtFood + eventRations;
    const eatFresh = Math.min(fresh, need);
    let rem = need - eatFresh;
    const eatStock = Math.min(stock, rem);
    rem -= eatStock;
    const hungerFrac = need > 0 ? Math.max(0, rem / need) : 0;
    f.provisions = (stock - eatStock) * C.STORE_KEEP + (fresh - eatFresh) * C.SURPLUS_STORED;
    Object.assign(rep, { rationNeed: need, rationHave: fresh + stock, hungerFrac, slaughterRations, boughtFood });
    if (hungerFrac > 0) addHonor(-Math.min(6, 2 + hungerFrac * 10), 'Your household went hungry');

    /* 6. obligations: cloth, rent, hospitality */
    const clothPaid = pay(f, wf.clothNeed);
    rep.clothNeed = wf.clothNeed; rep.clothShort = wf.clothNeed - clothPaid;
    if (rep.clothShort > 0.15 * wf.clothNeed) addHonor(-(1 + Math.min(2, rep.clothShort / Math.max(1, wf.clothNeed) * 2)), 'People went without cloth');
    rep.wagesDue = wf.servants * C.WAGE;
    rep.wagesShort = rep.wagesDue - pay(f, rep.wagesDue);
    if (f.tenure === 'rented') {
      const rent = S === 'summer' ? C.RENT : 0;
      const paid = pay(f, rent);
      rep.rent = rent;
      if (paid < rent) { addHonor(-1, 'You could not pay your rent'); rep.notes.push('You could not pay the rent in full.'); }
    }
    rep.dues = C.DUES[S][tier] || 0;
    rep.duesShort = rep.dues - pay(f, rep.dues);
    if (rep.duesShort > 0.5) { addHonor(-0.5, 'You could not pay your dues'); rep.notes.push('You could not pay your Thing dues in full, and your goði noticed.'); }
    f.wool *= C.WOOL_KEEP;
    const hc = plan.hospitality === 'plain' ? 0 : C.HOSP.cost[plan.hospitality][tier] * (S === 'winter' ? C.HOSP.winterMult : 1);
    if (hc > 0) {
      const paid = pay(f, hc);
      const frac = paid / hc;
      const glow = clamp((92 - state.people[state.headId].attrs.honor) / 55, 0.15, 1.3);
      const gain = C.HOSP.honor[plan.hospitality] * (S === 'winter' ? C.HOSP.winterMult : 1) * glow * frac;
      addHonor(gain, plan.hospitality === 'lavish' ? 'A lavish table' : 'An open hand');
      rep.hosp = { level: plan.hospitality, cost: Math.round(paid), gain };
      if (frac < 1) rep.notes.push('You could not pay for the whole feast, and the guests noticed.');
    }
    if (mods.honor) addHonor(mods.honor, 'Events of the season');

    /* 7. tidy up */
    f.vadmal = Math.round(f.vadmal * 100) / 100;
    f.hay = r1(f.hay); f.provisions = r1(f.provisions); f.wool = r1(f.wool); f.condition = r1(f.condition);
    f.wealth = wealth(f);
    f.tier = tierOfFarm(f);
    f.tierLabel = IS.Start.TIER_LABEL[f.tier];
    rep.cashEnd = Math.round(cashOf(f));
    rep.wealthEnd = f.wealth;
    return { farm: f, rep, plan, honorDelta: honor, hungerFrac, wf, tier };
  }

  /* ---------- what to expect (for the planning screen) ---------- */
  function expectedEnv(state) {
    const e = state.env;
    return { season: seasonOf(state), weather: 1 + 0.6 * C.OMEN_MOD[e.omen + 2], fishLuck: 1, sev: 'normal', prices: e.prices, mods: {} };
  }
  function outlook(state, plan) {
    const env = expectedEnv(state);
    let st = state;
    if (plan && plan.raid && IS.Raid && IS.Raid.canRaid(state)) {
      // preview the summer with you away and the ship paid for
      const f = clone(state.farm);
      pay(f, IS.Raid.cost(state));
      st = Object.assign({}, state, { farm: f, expedition: { dest: plan.raid.dest, deputyId: plan.raid.deputyId, untilTurn: state.turn + 1 } });
    }
    const res = season(st, plan, env);
    const rep = res.rep;
    return {
      res, rep, S: env.season,
      hayHave: rep.hayHave, needs: rep.needs,
      rationNeed: rep.rationNeed, rationHave: rep.rationHave,
      cashEnd: rep.cashEnd, cashStart: rep.cashStart,
    };
  }

  /* ---------- a sensible default plan (the "usual" way: also what tests play with) ---------- */
  function suggest(state) {
    const S = seasonOf(state), f = state.farm, last = state.lastPlan || {};
    const plan = normalizePlan(state, { hospitality: last.hospitality, treatment: last.treatment }, S);
    const wf = workforce(state, plan.treatment, S);
    const H = wf.hands, ph = wf.perHand || 1;
    const L = plan.labour;
    const priceOf = (kind) => Math.round(C.PRICE[kind] * ((state.env.prices && state.env.prices[kind]) || 1) * C.BUY);

    let rem = H;
    // Priorities: food for the house, then hay (summer) or cloth (winter), then upkeep and goods.
    let o = outlook(state, plan);
    const rate = (S === 'summer' ? C.FISH_SUMMER : C.FISH_WINTER)[f.setting] * ph;
    const gap = Math.max(0, o.rationNeed * 1.3 - o.rationHave);
    L.fish = Math.min(rem, Math.ceil(gap / rate - 1e-9));
    rem -= L.fish;
    if (S === 'summer') {
      const cap = hayCapacity(f) * hayQuality(f);
      const target = Math.min(cap, hayNeed({ cattle: f.cattle * 1.15, sheep: f.sheep * 1.3, horses: f.horses * 1.1, condition: f.condition }, 'normal') * 1.1 - f.hay);
      const handsWanted = Math.ceil(target / (C.HAY_PER_HAND * ph));
      L.hay = clamp(handsWanted, 0, rem);
      rem -= L.hay;
      const short = handsWanted - L.hay + (wf.people < 4 ? 1 : 0);
      const n = Math.min(2, short);
      if (n > 0 && cashOf(f) > n * (C.HIRE_FEE + C.WAGE * 8) + 150) plan.buy.servants = n;
    } else {
      L.weave = Math.min(rem, Math.ceil(f.wool / (C.WEAVE_PER_HAND * ph) - 1e-9));
      rem -= L.weave;
    }
    if (f.condition < 85) { L.build = Math.min(rem, 2); rem -= L.build; }
    L.craft = rem;

    // Balance the hay: buy in winter if there is money, otherwise reduce the herd.
    for (let guard = 0; guard < 300; guard++) {
      o = outlook(state, plan);
      const gapHay = o.needs.normal * 1.1 - o.hayHave;
      if (gapHay <= 0) break;
      const price = priceOf('hay');
      if (S === 'winter' && cashOf(f) - plan.buy.hay * price > (Math.ceil(gapHay) + 1) * price + 150) { plan.buy.hay += Math.ceil(gapHay); continue; }
      const cT = (f.cattle - plan.cull.cattle) * C.HAY_NEED.cattle, sT = (f.sheep - plan.cull.sheep) * C.HAY_NEED.sheep;
      if (cT >= sT && f.cattle - plan.cull.cattle > 2) plan.cull.cattle++;
      else if (f.sheep - plan.cull.sheep >= 4) plan.cull.sheep += 4;
      else if (f.cattle - plan.cull.cattle > 0) plan.cull.cattle++;
      else break;
    }
    // Animals taken off the hay are sold, except what the larder needs, which are slaughtered.
    plan.sell.cattle = plan.cull.cattle; plan.sell.sheep = plan.cull.sheep;
    plan.cull.cattle = 0; plan.cull.sheep = 0;
    o = outlook(state, plan);
    let foodGap = o.rationNeed * 1.15 - o.rationHave;
    if (foodGap > 0 && plan.sell.sheep > 0) { const n = Math.min(plan.sell.sheep, Math.ceil(foodGap / C.SLAUGHTER.sheep)); plan.sell.sheep -= n; plan.cull.sheep += n; foodGap -= n * C.SLAUGHTER.sheep; }
    while (foodGap > 0 && plan.sell.cattle > 0) { plan.sell.cattle--; plan.cull.cattle++; foodGap -= C.SLAUGHTER.cattle; }
    if (foodGap > 0.3 && cashOf(f) > Math.ceil(foodGap) * priceOf('food') + 100) plan.buy.food = Math.ceil(foodGap);

    // In summer, lay in the winter's meat. Slaughter is kept modest (a seventh of the flock, those that would be sold anyway
    // first); the rest of the gap is bought as food if there is cash to spare, and only a real shortage forces a bigger cull.
    if (S === 'summer') {
      o = outlook(state, plan);
      let gapStore = o.rationNeed * 1.1 - o.res.farm.provisions;
      const per = C.SLAUGHTER.sheep * C.STORE_KEEP;
      const flock = f.sheep, sheepLeft = () => f.sheep - plan.sell.sheep - plan.cull.sheep;
      const softCap = Math.max(2, Math.ceil(flock / 7)), hardCap = Math.max(4, Math.ceil(flock * 0.3));
      const cullMore = (cap) => {
        if (gapStore <= 0) return;
        let n = Math.min(Math.max(0, cap - plan.cull.sheep), Math.ceil(gapStore / per), Math.max(0, sheepLeft() - 8));
        const fromSale = Math.min(plan.sell.sheep, n);
        plan.sell.sheep -= fromSale; plan.cull.sheep += n; gapStore -= n * per;
      };
      cullMore(softCap);
      const reserve = 250 + 40 * tierOfFarm(f);
      if (gapStore > 0.5) {
        const afford = Math.max(0, Math.floor((cashOf(f) - reserve) / priceOf('food')));
        const n = Math.min(afford, Math.ceil(gapStore));
        if (n > 0) { plan.buy.food += n; gapStore -= n; }
      }
      cullMore(hardCap);
      if (gapStore > 0.5 && cashOf(f) > Math.ceil(gapStore) * priceOf('food') + 100) plan.buy.food += Math.ceil(gapStore);
    }

    const afford = cashOf(f) > 700 && tierOfFarm(f) >= 3;
    if (!last.hospitality) plan.hospitality = afford ? 'open' : 'plain';
    plan.seekWife = canSeekWife(state) && state.household.wives.length === 0 && cashOf(f) >= C.wedding(tierOfFarm(f)) + 250;
    return plan;
  }

  /* ---------- the farm at the start of a game ---------- */
  function initFarm(state, rng) {
    const f = state.farm;
    f.tenure = f.landValue >= 800 ? 'owned' : 'rented';
    f.setting = f.setting || 'inland';
    f.condition = clamp(rng.normal(55, 12), 25, 85);
    f.hay = Math.round(hayCapacity(f) * 0.08);
    f.wool = 0;
    f.acc = {};
    // A farm cannot start with more stock than its hayfield can winter: the surplus was sold.
    const cap = hayCapacity(f) * hayQuality(f);
    for (let g = 0; g < 500 && hayNeed(f, 'normal') > cap * 0.95; g++) {
      if (f.cattle * C.HAY_NEED.cattle >= f.sheep * C.HAY_NEED.sheep && f.cattle > 1) { f.cattle--; f.vadmal += Math.round(C.PRICE.cattle * 0.9); }
      else if (f.sheep > 4) { f.sheep -= 4; f.vadmal += Math.round(C.PRICE.sheep * 0.9 * 4); }
      else break;
    }
    // Nobody works a farm alone: make sure there are at least two hands in the house.
    const nid = () => 'n' + (state.idn = (state.idn || 0) + 1);
    for (let g = 0; g < 3 && workforce(state, 'fair', 'summer').hands < 2; g++) {
      const sv = IS.Person.make(rng, nid, { sex: rng.chance(0.5) ? 'M' : 'F', birthYear: yearOf(state) - rng.int(16, 40), role: 'none' });
      sv.role = 'servant'; IS.Person.refresh(sv, yearOf(state));
      state.people[sv.id] = sv; state.household.servants.push(sv.id);
    }
    const wf = workforce(state, 'fair', 'summer');
    f.provisions = Math.round(wf.rationNeed * 0.6);
    f.wealth = wealth(f);
    return f;
  }

  IS.Economy = {
    C, CATS, SEV_ORDER,
    seasonOf, yearOf, cashOf, wealth, pay, adjust,
    hayCapacity, hayQuality, hayNeed, herdNeed, landPrice, lot, tierOfFarm,
    members, workPower, workforce, labourOf,
    canSeekWife, normalizePlan, season, expectedEnv, outlook, suggest, initFarm,
  };
})();
