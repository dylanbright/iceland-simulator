/* The Alþing as a set piece, outlawry and exile, and the battle screen (core/law.js, core/battle.js). */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});
  const F = () => IS.Feud, L = () => IS.Law, B = () => IS.Battle;
  const ells = (x) => Math.round(x).toLocaleString('en-US') + ' ells';
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const note = (c, k, x, w) => IS.Saga && IS.Saga.note(c.state, k, x, w);
  const houses = (c) => Object.values(c.state.families || {}).filter((f) => f.head && f.farm !== c.state.farm.name);
  const rel = (c, farm) => (c.state.relations && c.state.relations[farm]) || 0;
  const insertNext = (c, item) => c.state.pending.splice(1, 0, item);

  /** The case card shown beside every step of a hearing. */
  function caseView(c, cs) {
    if (!cs) return null;
    const rows = [
      ['The case', `${cs.side === 'plaintiff' ? `You against ${cs.head} of ${cs.farm}` : `${cs.head} of ${cs.farm} against you`}, for ${L().chargeWord(cs)}`],
      ['At stake', cs.side === 'plaintiff' ? (cs.stakes === 'outlawry' ? `${cs.head}'s outlawry, and about ${ells(cs.value)}` : `About ${ells(cs.value)}`) : (cs.stakes === 'outlawry' ? 'Your outlawry' : `About ${ells(cs.value * 1.5)}`)],
      ['Your witnesses', cs.witnesses ? String(cs.witnesses) + (cs.falseW ? ' (two of them bought)' : '') : 'none yet'],
      ['Theirs', String(cs.theirWitnesses)],
      ['Backing', cs.backerName ? cs.backerName : cs.lawyer ? 'a man learned in the law' : 'nobody yet'],
      ['How it stands', L().oddsWord(L().odds(c.state, cs))],
    ];
    return { card: { title: 'Before the Alþing', rows } };
  }

  /* ---------- the verdicts ---------- */
  function verdict(c, cs, won) {
    const f = F().get(c.state, cs.farm);
    L().drop(c.state, cs.cid);
    if (cs.side === 'plaintiff') {
      if (won) {
        c.earn(cs.value); c.state.struck = c.state.struck || {}; c.state.struck[cs.farm] = true;
        c.honor(cs.charge === 'burning' ? 5 : 4, `${cs.head} was outlawed at the Alþing`);
        F().end(c.state, cs.farm); c.goodwill(cs.farm, -20);
        note(c, 'law', `At the Alþing he had ${cs.head} of ${cs.farm} outlawed for ${L().chargeWord(cs)}.`, 4);
        return `The judges found for you. ${cs.head} of ${cs.farm} was declared an outlaw at the Law Rock, and you were awarded ${ells(cs.value)}. He has the summer to get out of Iceland.`;
      }
      c.honor(-2, `Your case against ${cs.head} failed at the Alþing`); c.goodwill(cs.farm, -10);
      return `The judges found for ${cs.head}. You rode home from the Alþing with nothing but the cost of going.`;
    }
    if (won) {
      if (f) { f.owedThem = 0; f.answer = 0; } F().escalate(c.state, cs.farm, -1);
      c.honor(2, `You were cleared at the Alþing`);
      note(c, 'law', `${cs.head} of ${cs.farm} prosecuted him at the Alþing for ${L().chargeWord(cs)}, and he was cleared.`, 2);
      return `The court found for you. ${cs.head}'s case against you was thrown out, and he can claim nothing more for it.`;
    }
    c.honor(-3, `You were found guilty at the Alþing`);
    if (cs.stakes === 'fine') {
      const owe = cs.value * 1.5;
      if (IS.Economy.cashOf(c.state.farm) >= owe) { c.pay(owe); if (f) f.owedThem = 0; return `The court found against you and set the price at ${ells(owe)}. You paid it.`; }
    }
    const full = cs.charge !== 'killing' || cs.defied || c.head.attrs.honor < 25;
    note(c, 'law', `At the Alþing he was declared ${full ? 'a full outlaw' : 'a lesser outlaw'} for ${L().chargeWord(cs)}.`, 4);
    insertNext(c, { id: 'exile_sentence', wifeId: null, kind: 'event', params: { kind: full ? 'full' : 'lesser', farm: cs.farm, head: cs.head, value: cs.value } });
    return full ? `The court declared you a full outlaw. Any man may kill you without paying for it, and no man may shelter you.` : `The court declared you a lesser outlaw: three years out of Iceland, and your life is forfeit if you are found here after the summer.`;
  }
  function maybeBrawl(c, cs, lost) {
    const fam = c.state.families && c.state.families[cs.farm];
    const p = 0.18 + (fam && (fam.goði || fam.tier >= 4) ? 0.1 : 0) + (lost === 'them' ? 0.05 : 0);
    if (!c.rng.chance(p)) return '';
    insertNext(c, { id: 'law_brawl', wifeId: null, kind: 'event', params: { farm: cs.farm, head: cs.head, power: fam ? fam.tier / 2 : 1, friends: cs.backer > 0 ? 3 : 0, friendFarm: cs.backerFarm || '' } });
    return ' As the verdict was read out, men on both sides put their hands to their weapons.';
  }

  const DEFS = [
    /* ---------- filing ---------- */
    { id: 'law_summons', w: 0, needs: () => null,
      title: (c) => `${c.p.head} summons you to the Alþing`,
      body: (c) => [`${c.p.head} of ${c.p.farm} has had a summons read at your door in front of witnesses: you are to answer at the Alþing for the death of his man. He asks for your outlawry, or about ${ells(c.p.owed)} if you settle before the court sits.`,
        'A killing case at the Alþing is not a fine for stray sheep. If you lose, you lose Iceland.'],
      options: (c) => [
        { id: 'answer', label: 'Answer the case at the Alþing', desc: 'You will have a season to find witnesses and a chieftain to back you.',
          run: () => { L().file(c.state, c.rng, { side: 'defendant', farm: c.p.farm, head: c.p.head, charge: 'killing', victim: `${c.p.head}'s man`, value: c.p.owed }); return `You sent word that you would meet ${c.p.head} at the Law Rock. The district has something to talk about all winter.`; } },
        { id: 'settle', label: 'Pay blood-money now', cost: Math.round(c.p.owed * 1.2), desc: `${ells(c.p.owed * 1.2)}. The case is dropped and the killing is paid for. Honor −1.`,
          run: () => { c.pay(c.p.owed * 1.2); const f = F().get(c.state, c.p.farm); if (f) { f.owedThem = 0; f.answer = 0; } F().escalate(c.state, c.p.farm, -1); c.goodwill(c.p.farm, 8); c.honor(-1, `You paid ${c.p.farm} for a killing`); return `You paid the price of the man in front of witnesses, and ${c.p.head} declared himself satisfied.`; } },
        { id: 'defy', label: 'Let him do his worst', desc: 'Honor +0.5 now. If you are not at the Alþing to answer, the court will almost certainly outlaw you.',
          run: () => { const cs = L().file(c.state, c.rng, { side: 'defendant', farm: c.p.farm, head: c.p.head, charge: 'killing', victim: `${c.p.head}'s man`, value: c.p.owed }); if (cs) cs.defied = true; c.honor(0.5, `You laughed at ${c.p.head}'s summons`); return 'You told his man that you knew where the Alþing was, and that you had better things to do there.'; } },
      ] },

    { id: 'law_offer', w: 0, needs: () => null,
      title: (c) => `Bring ${c.p.head} to the Alþing?`,
      body: (c) => [`What ${c.p.head} of ${c.p.farm} did is a case for the Alþing: ${c.p.charge === 'burning' ? 'he came by night and set fire to a house with people inside it' : 'he broke a sworn peace with a killing'}. The court takes this kind of thing more seriously than almost anything.`],
      options: (c) => [
        { id: 'file', label: 'Have the summons read', cost: 20, desc: `${ells(20)}. The case is heard at the next Alþing. A win outlaws him.`,
          run: () => { c.pay(20); L().file(c.state, c.rng, { side: 'plaintiff', farm: c.p.farm, head: c.p.head, charge: c.p.charge, victim: c.p.victim, value: c.p.value }); return `Your witnesses rode to ${c.p.farm} and read the summons at his door. He came out to hear it.`; } },
        { id: 'no', label: 'Leave the law out of it', desc: 'There are other ways.', run: () => 'You said nothing about the law. People wondered what you meant by that.' },
      ] },

    /* ---------- the hearing ---------- */
    { id: 'law_witnesses', w: 0, needs: () => null,
      title: () => 'Witnesses for the Alþing',
      body: (c) => { const cs = L().caseOf(c.state, c.p.cid); return [`The Alþing meets in a few weeks at Þingvellir. ${cs.side === 'plaintiff' ? `Your case against ${cs.head}` : `${cs.head}'s case against you`} will be heard there, and a case is won with witnesses: men who will stand at the Law Rock and swear to what they saw and what was done according to law.`]; },
      view: (c) => caseView(c, L().caseOf(c.state, c.p.cid)),
      options: (c) => {
        const cs = L().caseOf(c.state, c.p.cid);
        const friends = houses(c).filter((f) => rel(c, f.farm) >= 20 && f.farm !== cs.farm).length;
        const next = () => insertNext(c, { id: 'law_backer', wifeId: null, kind: 'event', params: { cid: cs.cid, farm: cs.farm, head: cs.head } });
        return [
          { id: 'friends', label: 'Ride round the neighbors for witnesses', cost: 30, desc: `${ells(30)} in hospitality. ${friends ? `${Math.min(3, friends)} friendly ${friends === 1 ? 'house' : 'houses'} may stand with you.` : 'No house is friendly enough to be sure of.'}`,
            run: () => { c.pay(30); const n = Math.min(3, friends) + (c.rng.chance(0.4) ? 1 : 0); cs.witnesses += Math.max(n, friends ? 1 : 0); next(); return cs.witnesses ? `${cs.witnesses} ${cs.witnesses === 1 ? 'man' : 'men'} agreed to ride with you and swear.` : 'Nobody would commit. You will go with what you have.'; } },
          { id: 'kin', label: 'Take only your own household', desc: 'No cost. One witness, and the court knows he is yours.', run: () => { cs.witnesses += 1; next(); return 'Your household will swear for you. The court will weigh that for what it is.'; } },
          { id: 'false', label: 'Pay two men to swear to what they did not see', cost: 70, desc: `${ells(70)}. Two more witnesses. If the false oath is found out, the case is lost and so is your name.`,
            run: () => { c.pay(70); cs.witnesses += 2; cs.falseW = true; next(); return 'Two men from the next valley will swear to whatever you tell them. You did not ask what else they had sworn to.'; } },
        ];
      } },

    { id: 'law_backer', w: 0, needs: () => null,
      title: () => 'A chieftain to back you',
      body: (c) => { const cs = L().caseOf(c.state, c.p.cid); return [`At the Alþing a man with a chieftain behind him is heard, and a man without one is endured. ${cs.theirBacker >= 0.1 ? `${cs.head} will have powerful friends at the Law Rock.` : `${cs.head} has no great chieftain behind him, as far as you know.`}`]; },
      view: (c) => caseView(c, L().caseOf(c.state, c.p.cid)),
      options: (c) => {
        const cs = L().caseOf(c.state, c.p.cid);
        const next = () => insertNext(c, { id: 'law_plead', wifeId: null, kind: 'event', params: { cid: cs.cid, farm: cs.farm, head: cs.head } });
        const big = houses(c).filter((f) => f.farm !== cs.farm && (f.goði || f.tier >= 4)).sort((a, b) => rel(c, b.farm) - rel(c, a.farm)).slice(0, 2);
        const opts = big.map((f) => {
          const cost = 60 + 20 * f.tier, p = Math.max(0.1, Math.min(0.9, 0.35 + rel(c, f.farm) / 120 + c.head.attrs.honor / 250 - (F().bond ? Math.max(0, F().bond(c.state, f.farm, cs.farm)) / 150 : 0)));
          return { id: 'b_' + f.farm, label: `Ask ${f.head.first} of ${f.farm} for his backing`, cost, desc: `${ells(cost)} in gifts. ${cap(F().oddsWord(p))}. ${f.goði ? 'He is a goði.' : 'A great householder.'}`,
            run: () => { c.pay(cost); next(); if (c.rng.chance(p)) { cs.backer = 0.08 + 0.03 * f.tier + (f.goði ? 0.05 : 0); cs.backerName = `${f.head.first} of ${f.farm}`; cs.backerFarm = f.farm; c.goodwill(f.farm, 5); return `${f.head.first} took the gifts and his hand on it: he will stand with you at the Law Rock.`; } c.state.farm.vadmal += Math.round(cost / 2); return `${f.head.first} sent back half your gifts and said he had other obligations this summer.`; } };
        });
        opts.push({ id: 'lawyer', label: 'Hire a man learned in the law', cost: 50, desc: `${ells(50)}. He knows every form of the law. It helps, and it guards against mistakes.`,
          run: () => { c.pay(50); cs.lawyer = true; next(); return 'You found an old man who had been lawspeaker\'s assistant in his youth. He knows the forms the way a priest knows his prayers.'; } });
        opts.push({ id: 'alone', label: 'Go to the Law Rock on your own', desc: 'Trust your own knowledge of the law.', run: () => { next(); return 'You will plead it yourself.'; } });
        return opts;
      } },

    { id: 'law_plead', w: 0, needs: () => null,
      title: () => 'At the Law Rock',
      body: (c) => { const cs = L().caseOf(c.state, c.p.cid); return [`The court is seated at Þingvellir. ${cs.side === 'plaintiff' ? `You bring your case against ${cs.head} of ${cs.farm}` : `${cs.head} of ${cs.farm} brings his case against you`} for ${L().chargeWord(cs)}. Every word of the pleading must follow the forms of the law: a case can be lost on a single wrong word, whatever the truth of it.`]; },
      view: (c) => caseView(c, L().caseOf(c.state, c.p.cid)),
      options: (c) => {
        const cs = L().caseOf(c.state, c.p.cid), law = c.head.attrs.law;
        const base = L().odds(c.state, cs);
        const plead = (bonus, slip, how) => () => {
          if (cs.falseW && c.rng.chance(0.25)) { L().drop(c.state, cs.cid); c.honor(-4, 'Your false witnesses were exposed at the Alþing'); if (cs.side === 'defendant') return `One of your bought witnesses broke under questioning. The court threw out your defense.${verdict(c, Object.assign({}, cs, { cid: 'gone' }), false)}`; return 'One of your bought witnesses broke under questioning and told the court what he had been paid. The case collapsed, and every man at the Alþing heard why.'; }
          if (c.rng.chance(slip)) {
            L().drop(c.state, cs.cid); c.honor(-1, 'Your case fell on a point of procedure');
            if (cs.side === 'defendant') { const f = F().get(c.state, cs.farm); if (f) f.owedThem = Math.round(f.owedThem * 0.5); return `${how} Then ${cs.head}'s side named the wrong court, and your law-man saw it. The case was void. ${cs.head} will have to start again, if he can.`; }
            return `${how} Then you named the jury from the wrong district, and ${cs.head}'s law-man was on his feet before you finished. The case was void.`;
          }
          const won = c.rng.chance(Math.min(0.92, base + bonus));
          const t = verdict(c, cs, won);
          return `${how} ${t}${maybeBrawl(c, cs, won ? 'them' : 'you')}`;
        };
        const slip = Math.max(0.03, 0.12 - law / 900 - (cs.lawyer ? 0.06 : 0));
        const opts = [
          { id: 'careful', label: 'Follow every form of the law', desc: `${cap(L().oddsWord(base))}. Few mistakes.`, run: plead(0, slip, 'You pleaded slowly, naming every witness and every form.') },
          { id: 'bold', label: 'Press the case hard', desc: `${cap(L().oddsWord(base + 0.08))}, but a hurried pleading invites mistakes.`, run: plead(0.08, slip + 0.12, 'You pressed the case hard and the court felt it.') },
        ];
        if (cs.backerName) opts.push({ id: 'backer', label: `Let ${cs.backerName.split(' of ')[0]} speak for you`, desc: `${cap(L().oddsWord(base + cs.backer * 0.5))}. A chieftain's voice carries.`, run: plead(cs.backer * 0.5, slip, `${cs.backerName} spoke for you, and men listened.`) });
        if (cs.side === 'defendant') opts.push({ id: 'flaw', label: 'Look for a flaw in their pleading', desc: `Your Law (${Math.round(law)}) decides. If you find one, the case is void. If not, it goes worse for you.`,
          run: () => { if (c.rng.chance(Math.min(0.75, law / 140))) { L().drop(c.state, cs.cid); c.honor(1.5, `You broke ${cs.head}'s case on a point of law`); const f = F().get(c.state, cs.farm); if (f) f.owedThem = Math.round(f.owedThem * 0.5); return `You waited until ${cs.head}'s side had finished, then pointed out that they had summoned you before the wrong quarter court. The judges conferred and agreed. The case was void.`; } return plead(-0.06, 0, 'You searched their pleading for a flaw and found none.')(); } });
        const sv = Math.round(cs.value * (cs.side === 'plaintiff' ? 0.8 : 1.2));
        opts.push(cs.side === 'plaintiff'
          ? { id: 'settle', label: 'Accept a settlement before the verdict', desc: `About ${ells(sv)}, if ${cs.head} agrees. No outlawry, and the feud cools.`,
            run: () => { L().drop(c.state, cs.cid); if (c.rng.chance(0.65)) { c.earn(sv); F().escalate(c.state, cs.farm, -2); c.goodwill(cs.farm, 10); c.honor(0.5, `A settlement with ${cs.head} at the Alþing`); return `Respected men went between the booths, and before the court gave its verdict ${cs.head} paid ${ells(sv)} to end it.`; } c.honor(-0.5, `${cs.head} refused to settle`); return `${cs.head} would not settle, and by then you had withdrawn the case.`; } }
          : { id: 'settle', label: 'Offer to settle before the verdict', cost: sv, desc: `${ells(sv)}. No verdict, no outlawry. Honor −1.`,
            run: () => { c.pay(sv); L().drop(c.state, cs.cid); const f = F().get(c.state, cs.farm); if (f) { f.owedThem = 0; f.answer = 0; } F().escalate(c.state, cs.farm, -2); c.honor(-1, `You bought off ${cs.head}'s case`); return `You paid ${ells(sv)} before the court could speak, and ${cs.head} withdrew the case.`; } });
        return opts;
      } },

    { id: 'law_absent', w: 0, needs: () => null,
      title: () => 'Judged without you',
      body: (c) => { const cs = L().caseOf(c.state, c.p.cid); return [`You did not go to the Alþing to answer ${cs.head}'s case, and the court heard it without you.`]; },
      view: (c) => caseView(c, L().caseOf(c.state, c.p.cid)),
      options: (c) => [{ id: 'hear', label: 'Hear the verdict', desc: 'It was given in your absence.',
        run: () => { const cs = L().caseOf(c.state, c.p.cid); const won = c.rng.chance(L().odds(c.state, cs)); return won ? `${cs.head} made a mistake in the pleading, and with no one to answer him the judges still threw it out. ${verdict(c, cs, true)}` : verdict(c, cs, false); } }] },

    { id: 'law_brawl', w: 0, needs: () => null,
      title: () => 'Weapons drawn at the Alþing',
      body: (c) => [`Someone pushed, someone shouted, and now ${c.p.head}'s men and yours are facing each other across the lava with weapons out. The peacemakers are running from the booths. It has happened at the Alþing before, and men have died there.`],
      options: (c) => {
        const spec = { kind: 'thing', farm: c.p.farm, head: c.p.head, force: 4 + Math.round(c.p.power * 2), power: c.p.power, friends: c.p.friends, friendFarm: c.p.friendFarm };
        return [
          { id: 'fight', label: 'Stand and fight', desc: `${cap(B().oddsWord(c.state, spec))}. A battle in front of the whole country.`,
            run: () => { insertNext(c, B().start(c.state, c.rng, spec)); return 'You drew your sword and your men closed up around you.'; } },
          { id: 'peace', label: 'Call on the peacemakers', desc: 'More often than not they get between you in time. Honor +0.5 if they do.',
            run: () => { if (c.rng.chance(0.6)) { c.honor(0.5, 'You kept the peace at the Alþing'); return 'You lowered your weapon and called out to the peacemakers, and they pushed between the two sides before anyone struck.'; } insertNext(c, B().start(c.state, c.rng, spec)); return 'You called for peace, but the first blow had already been struck.'; } },
          { id: 'withdraw', label: 'Pull your men back to your booth', desc: 'Honor −1. Nobody dies.', run: () => { c.honor(-1, 'You withdrew from a fight at the Alþing'); return 'You pulled your men back to your booth. Some called it wisdom. More called it something else.'; } },
        ];
      } },

    /* ---------- outlawry ---------- */
    { id: 'exile_sentence', w: 0, needs: () => null,
      title: (c) => (c.p.kind === 'full' ? 'You are a full outlaw' : 'Three years out of Iceland'),
      body: (c) => (c.p.kind === 'full'
        ? ['The court has made you a full outlaw: no man may feed you, shelter you, or carry you abroad, and any man may kill you without paying for it. It is a sentence for life.', 'Your household will hold the farm, if you leave them something to hold.']
        : ['You are a lesser outlaw. You must be out of Iceland by the end of the summer and stay out for three years. Then you may come home, and the case is closed.', 'Many a man has come home from such a sentence richer than he left.']),
      options: (c) => {
        const opts = [];
        const goNow = (kind, where) => { L().begin(c.state, kind, where, c.p.farm); const dep = c.state.expedition.deputyId && c.state.people[c.state.expedition.deputyId]; return dep ? ` ${dep.first} will run the farm while you are gone.` : ' There is nobody fit to run the farm; it will have to run itself.'; };
        if (c.p.kind === 'lesser') {
          opts.push({ id: 'mikligardr', label: 'Take ship for Miklagarðr and the Varangian Guard', desc: 'The emperor pays his Norse guard in gold. About one man in seven does not come back from three years of his wars.',
            run: () => `You took ship for Norway and the long road east, to the emperor's city.${goNow('lesser', 'mikligardr')}` });
          opts.push({ id: 'norway', label: 'Go to the earl\'s court in Norway', desc: 'Safer, and less gold. You will be back in three years with gifts and stories.', run: () => `You sailed for Norway with letters to the earl.${goNow('lesser', 'norway')}` });
          opts.push({ id: 'stay', label: 'Refuse to leave', desc: 'You become a full outlaw, and they will come for you.', run: () => { insertNext(c, { id: 'exile_sentence', wifeId: null, kind: 'event', params: Object.assign({}, c.p, { kind: 'full', noBuy: true }) }); return 'You told them you would not leave your own land. That made it simpler for everyone who wants you dead.'; } });
          return opts;
        }
        opts.push({ id: 'highlands', label: 'Go to the highlands, like Grettir', desc: 'Live hidden above the glaciers while your household holds the farm. Your enemies will hunt you. Your kin may yet buy your peace.',
          run: () => { note(c, 'exile', 'He was outlawed and went to live in the highlands.', 3); return `You took a horse, an axe and what food you could carry, and went up past the last farms into the wilderness.${goNow('full', 'highlands')}`; } });
        opts.push({ id: 'abroad', label: 'Leave Iceland for good', desc: 'You will never see the farm again. Your heir takes it, as if you had died.',
          run: () => { const y = IS.Economy.yearOf(c.state); c.head.deathYear = y; c.head.deathCause = 'outlawed'; c.head.deathText = 'went abroad an outlaw and never came back to Iceland'; c.head.deathAge = y - c.head.birthYear; IS.Turn.removeFromHousehold(c.state, c.head.id); return 'You sailed with the last ship of the summer. You did not look back at the coast, or not for long.'; } });
        if (!c.p.noBuy) {
          const price = Math.round(c.p.value * 3 + 150), p = Math.max(0.1, Math.min(0.75, 0.25 + rel(c, c.p.farm) / 200 + c.head.attrs.honor / 300));
          opts.push({ id: 'buy', label: `Have your kin offer ${c.p.head} a price for your peace`, cost: price, desc: `${ells(price)}. ${cap(F().oddsWord(p))} that he accepts. If he does, the sentence is lifted.`,
            run: () => { c.pay(price); if (c.rng.chance(p)) { F().end(c.state, c.p.farm); c.honor(-1, `Your kin bought your peace from ${c.p.head}`); return `${c.p.head} took the silver and agreed, before witnesses, that the sentence be lifted. You are not an outlaw. It cost nearly everything.`; } c.state.farm.vadmal += Math.round(price * 0.7); insertNext(c, { id: 'exile_sentence', wifeId: null, kind: 'event', params: Object.assign({}, c.p, { noBuy: true }) }); return `${c.p.head} refused the silver. Most of it came back to you, which was the worst part.`; } });
        }
        return opts;
      } },

    { id: 'outlaw_season', w: 0, needs: () => null,
      title: () => 'An outlaw in the highlands',
      body: (c) => [`You are living above the glaciers, an outlaw. Your strength is ${Math.round(c.head.attrs.strength)}. Word reaches you now and then that men${c.p.farm ? ` from ${c.p.farm}` : ''} are asking where you are.`],
      options: (c) => {
        const x = c.state.exile || {}, fam = c.state.families && c.state.families[x.farm];
        const hunters = (why) => { const leader = IS.Names.male(c.rng).first; insertNext(c, B().start(c.state, c.rng, { kind: 'hunters', farm: x.farm || '', head: leader, force: 3 + c.rng.int(0, 3), power: fam ? fam.tier / 3 : 0.5, alone: true, forceHead: true, companion: x.companion })); return why; };
        const friends = houses(c).filter((f) => rel(c, f.farm) >= 30 && f.farm !== x.farm);
        const kin = (IS.Raid ? IS.Raid.raiders(c.state) : []).filter((p) => p.role === 'brother' || p.role === 'son');
        const opts = [
          { id: 'hide', label: 'Stay hidden', desc: 'Most seasons nobody finds you.', run: () => (c.rng.chance(0.22) ? hunters('A shepherd saw your smoke. By evening there were men on the ridge.') : 'Nobody came. You lived on birds and stolen milk, and kept your fire small.') },
          { id: 'steal', label: x.farm ? `Raid ${x.farm}'s sheep for food` : 'Steal sheep for food', desc: 'You eat well, and your enemies remember. Honor −0.5.',
            run: () => { c.honor(-0.5, 'You stole sheep as an outlaw'); c.head.attrs.strength = Math.min(90, c.head.attrs.strength + 2); if (x.farm) c.goodwill(x.farm, -6); return c.rng.chance(0.35) ? hunters('You took three wethers in the night. In the morning they followed the blood.') : 'You drove off a few sheep in the fog and ate meat for a month.'; } },
        ];
        if (friends.length) { const fr = c.rng.pick(friends); opts.push({ id: 'friend', label: `Ask ${fr.head.first} of ${fr.farm} to hide you`, desc: 'A roof and food for the season, if he does not sell you.',
          run: () => { c.goodwill(fr.farm, -5); if (c.rng.chance(0.2)) return hunters(`${fr.head.first} took you in, fed you, and sent a boy to tell your enemies where you were.`); c.head.attrs.strength = Math.min(90, c.head.attrs.strength + 3); return `${fr.head.first} hid you in his storehouse for the season and never said a word. You will not forget it.`; } }); }
        if (kin.length && !x.companion) { const k = kin[0]; opts.push({ id: 'companion', label: `Ask ${k.first} to share your outlawry`, desc: `Your ${k.role} would stand beside you if they come. He risks his life to do it.`,
          run: () => { x.companion = k.id; return `${k.first} came up the mountain with a spare axe and said he had always wanted to see the glaciers.`; } }); }
        if (c.p.summer && x.farm) {
          const price = Math.round(F().wergild(c.state, 'kin') * 2 + 100), years = Math.floor((c.state.turn - (x.since || 0)) / 2);
          const p = Math.max(0.08, Math.min(0.8, 0.2 + rel(c, x.farm) / 200 + c.head.attrs.honor / 300 + years * 0.03));
          opts.push({ id: 'pardon', label: 'Send your kin to the Alþing to buy your peace', cost: price, desc: `${ells(price)}. ${cap(F().oddsWord(p))}. If ${fam && fam.head ? fam.head.first : 'your enemy'} accepts, you can come home.`,
            run: () => { c.pay(price); if (c.rng.chance(p)) { L().end(c.state); F().end(c.state, x.farm); c.honor(1, 'Your kin bought your peace'); note(c, 'exile', `After ${years || 1} ${years === 1 ? 'year' : 'years'} in the highlands his kin bought his peace, and he came home.`, 3); return 'Your kin paid the price at the Law Rock, and the sentence was lifted. You walked down to your own farm and sat in your own high seat.'; } c.state.farm.vadmal += Math.round(price * 0.6); return 'They would not take it this year. Most of the silver came back up the mountain with the news.'; } });
        }
        return opts;
      } },

    /* ---------- the battle screen ---------- */
    { id: 'battle', w: 0, needs: () => null,
      title: (c) => ({ burning: 'The fight at the door', thing: 'The fight at the Alþing', hunters: 'They have found you' }[c.p.kind] || 'A fight') + ` (round ${c.p.round})`,
      body: (c) => [{
        burning: `${c.p.head}'s men are at the door with torches, and the yard is full of them.`,
        thing: `Your men and ${c.p.head}'s are at each other on the lava field, with the whole Alþing watching.`,
        hunters: `${c.p.head} and his men have come to kill you for the price on your head.`,
      }[c.p.kind], c.p.round === 1 ? 'Choose how your side fights this round.' : 'The fight goes on.'],
      view: (c) => ({ battle: { round: c.p.round, max: B().MAX_ROUNDS, us: c.p.us, them: c.p.them, log: c.p.log, foe: c.p.head } }),
      options: (c) => {
        const P = c.p, theirLead = B().leader(P.them);
        const go = (stance) => () => {
          const r = B().round(c.state, c.rng, P, stance);
          // bury your dead as they fall
          for (const m of P.us) {
            if (!m.pid || m.buried || m.hp > 0) continue;
            const p = c.state.people[m.pid];
            if (!p || p.deathYear != null) { m.buried = true; continue; }
            if (m.dead) { m.buried = true; c.kill(p, { burning: `fell defending the house against ${P.farm}`, thing: `was killed in the fight at the Alþing`, hunters: `was killed by the men who came to hunt the outlaw` }[P.kind] || 'was killed in a fight', 'killed in a feud'); if (P.farm && c.state.families && c.state.families[P.farm] && p.id !== c.state.headId) F().slain(c.state, P.farm, 'you'); }
            else { m.buried = true; if (p.attrs) p.attrs.strength = Math.max(5, p.attrs.strength - 5); }
          }
          const text = r.lines.join(' ');
          if (r.end) return `${text} ${outcome(c, r.end)}`;
          insertNext(c, { id: 'battle', wifeId: null, kind: 'event', params: P });
          return text;
        };
        const fall = { burning: 'Get everyone out through the back', thing: 'Pull back to your booth', hunters: 'Run for the high ground' }[P.kind] || 'Break off';
        const opts = [
          { id: 'wall', label: B().STANCE.wall.word, desc: 'Hold together and let them come. You give little and take little.', run: go('wall') },
          { id: 'press', label: B().STANCE.press.word, desc: 'Hit hard. You hurt them more, and leave yourselves open.', run: go('press') },
        ];
        if (theirLead && theirLead.hp > 0) opts.push({ id: 'leader', label: `Go for ${theirLead.name}`, desc: 'If he falls, his men may break. You will be exposed while you try.', run: go('leader') });
        if (P.kind === 'thing') opts.push({ id: 'peace', label: 'Call on the peacemakers', desc: 'They may get between the lines now that blood is up, or they may not.',
          run: () => (c.rng.chance(0.5) ? outcome(c, 'draw') : go('wall')()) });
        opts.push({ id: 'fall', label: fall, desc: { burning: 'Your people live. The house does not.', thing: 'Honor −1.5. Nobody else dies today.', hunters: 'You may get away. You will lose ground and blood.' }[P.kind], run: () => outcome(c, 'fled') });
        return opts;
      } },
  ];

  /** Apply a battle's result by kind. */
  function outcome(c, end) {
    const fn = B().OUTCOME[c.p.kind];
    const n = B().theirDead(c.p);
    if (n && c.p.farm && c.state.families && c.state.families[c.p.farm] && (end === 'won' || end === 'held' || end === 'draw')) F().slain(c.state, c.p.farm, 'them', n);
    return fn ? fn(c, end, n) : '';
  }
  B().OUTCOME.thing = (c, end, n) => {
    if (end === 'won') { c.honor(3, 'You won the fight at the Alþing'); c.goodwill(c.p.farm, -15); note(c, 'thing', `In the fight at the Alþing he and his men drove off ${c.p.head}'s side${n ? `, and ${n} of them were killed` : ''}.`, 3); return `${c.p.head}'s men broke and ran for their booths.${n ? ` ${n} of them will not ride home.` : ''} People will talk of this Alþing for years.`; }
    if (end === 'lost') { c.honor(-2, 'You lost the fight at the Alþing'); return 'Your side gave way and the peacemakers dragged the rest of you back to your booth.'; }
    if (end === 'fled') { c.honor(-1.5, 'You pulled back from the fight at the Alþing'); return 'You pulled your men back to your booth.'; }
    return 'The peacemakers pushed between the two lines with their arms spread, and the fight ended as fast as it began.';
  };
  B().OUTCOME.hunters = (c, end, n) => {
    if (end === 'won' || end === 'held') { c.honor(1.5, 'You killed the men who came to hunt you'); if (c.state.exile && c.state.exile.farm) c.goodwill(c.state.exile.farm, -10); return `${n ? `You left ${n} of them on the hillside.` : 'They gave it up and went home.'} Nobody will come for a while.`; }
    if (end === 'fled') { c.head.attrs.strength = Math.max(5, c.head.attrs.strength - 3); return 'You ran across the scree with their spears behind you, and lost them in the fog.'; }
    const lead = B().leader(c.p.us);
    if (c.head.deathYear == null && lead && !lead.dead && c.rng.chance(0.5)) { c.head.attrs.strength = Math.max(5, c.head.attrs.strength - 8); return 'They left you for dead in the heather. You crawled away in the night, and lived, just.'; }
    if (c.head.deathYear == null) c.kill(c.head, 'was hunted down and killed as an outlaw', 'killed as an outlaw');
    return 'They took your head down to the lowlands to claim the price.';
  };
  B().OUTCOME.burning = (c, end, n) => {
    const P = c.p;
    if (end === 'won' || end === 'held') { c.honor(P.spare ? 4 : 6, `You held your house against ${P.farm}`); F().bump(c.state, P.farm, -10); F().escalate(c.state, P.farm, -2); return `${end === 'won' ? `${P.head}'s men broke and ran into the dark` : `At first light ${P.head} gave it up and took his men home`}.${n ? ` ${n} of them lie dead in your yard.` : ''} People will tell this one.`; }
    if (end === 'fled') { const fm = c.state.farm; fm.condition = Math.max(0, fm.condition - 25); fm.hay *= 0.7; fm.provisions *= 0.7; c.honor(-3, 'You left your house to be burned'); F().escalate(c.state, P.farm, -1); return 'You got everyone out through the back of the byre and up the hill, and watched the roof go.'; }
    c.honor(P.spare ? -2 : -3, `${P.farm} burned your house`);
    const dead = IS.FeudFx.burn(c, !!P.spare, P.headHere && c.head.deathYear == null);
    insertNext(c, { id: 'law_offer', wifeId: null, kind: 'event', params: { farm: P.farm, head: P.head, charge: 'burning', value: 500 + 150 * c.tier } });
    return `The roof caught, and the smoke drove the last of you out.${dead.length ? ` The dead: ${dead.join(', ')}.` : ' All came out alive, which is more than anyone expected.'}`;
  };

  IS.Events.DEFS.push(...DEFS);
})();
