/* Names and places. Old Norse forms, normalised spelling. Male names carry their genitive for patronymics. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});

  // [nominative, genitive]
  const MALE = [
    ['Þorsteinn', 'Þorsteins'], ['Þórðr', 'Þórðar'], ['Ketill', 'Ketils'], ['Grímr', 'Gríms'], ['Ólafr', 'Ólafs'],
    ['Hallr', 'Halls'], ['Hrafn', 'Hrafns'], ['Egill', 'Egils'], ['Skapti', 'Skapta'], ['Snorri', 'Snorra'],
    ['Gunnarr', 'Gunnars'], ['Njáll', 'Njáls'], ['Kolbeinn', 'Kolbeins'], ['Ásgeirr', 'Ásgeirs'], ['Björn', 'Bjarnar'],
    ['Eiríkr', 'Eiríks'], ['Atli', 'Atla'], ['Helgi', 'Helga'], ['Hjalti', 'Hjalta'], ['Hrútr', 'Hrúts'],
    ['Mörðr', 'Marðar'], ['Ásbjörn', 'Ásbjarnar'], ['Þorgeirr', 'Þorgeirs'], ['Þorkell', 'Þorkels'], ['Bersi', 'Bersa'],
    ['Úlfr', 'Úlfs'], ['Steinarr', 'Steinars'], ['Önundr', 'Önundar'], ['Þorbjörn', 'Þorbjarnar'], ['Vermundr', 'Vermundar'],
    ['Gísli', 'Gísla'], ['Ingjaldr', 'Ingjalds'], ['Arnkell', 'Arnkels'], ['Vésteinn', 'Vésteins'], ['Hávarðr', 'Hávarðar'],
    ['Þórarinn', 'Þórarins'], ['Sigmundr', 'Sigmundar'], ['Hallgrímr', 'Hallgríms'], ['Kári', 'Kára'], ['Þorgrímr', 'Þorgríms'],
    ['Álfr', 'Álfs'], ['Oddr', 'Odds'], ['Ormr', 'Orms'], ['Böðvarr', 'Böðvars'], ['Þorleifr', 'Þorleifs'],
    ['Bárðr', 'Bárðar'], ['Ari', 'Ara'], ['Glúmr', 'Glúms'],
  ];

  const FEMALE = [
    'Guðrún', 'Þórdís', 'Ásdís', 'Þorgerðr', 'Unnr', 'Hildigunnr', 'Þuríðr', 'Ragnheiðr', 'Halldóra', 'Jórunn',
    'Ingibjörg', 'Sigríðr', 'Helga', 'Þórunn', 'Oddný', 'Gróa', 'Auðr', 'Ása', 'Álfdís', 'Rannveig',
    'Sæunn', 'Þorbjörg', 'Steinunn', 'Hallbera', 'Þórhalla', 'Katla', 'Signý', 'Yngvildr', 'Þórný', 'Vigdís',
    'Dalla', 'Hallfríðr', 'Ljót', 'Bjargey', 'Þórelfr', 'Arnbjörg', 'Gyða', 'Hrefna', 'Ólöf', 'Svanhildr',
  ];

  // Irish-Gaelic names borne by captives and their descendants, plus a few Norse slave-names.
  const THRALL_MALE = [['Dufgus', 'Dufgus'], ['Kjarvalr', 'Kjarvals'], ['Kormákr', 'Kormáks'], ['Mýrkjartan', 'Mýrkjartans'],
    ['Dufþakr', 'Dufþaks'], ['Melkólmr', 'Melkólms'], ['Svartr', 'Svarts'], ['Kolr', 'Kols'], ['Beinir', 'Beinis'], ['Mókolfr', 'Mókolfs']];
  const THRALL_FEMALE = ['Melkorka', 'Kormlöð', 'Eðna', 'Gelgja', 'Brígid', 'Sunna', 'Svala', 'Kata'];

  const BYNAMES_GENERIC = ['the Stout', 'the Tall', 'the Old', 'the Red', 'the Lucky', 'the Lame', 'the Quiet', 'the Wise', 'Gray-Beard', 'the Unlucky'];
  const FARM_PREFIX = ['Birki', 'Lax', 'Hrafn', 'Svan', 'Sand', 'Stein', 'Grjót', 'Hvamm', 'Búr', 'Sel', 'Hrút', 'Ár', 'Mó', 'Reyni', 'Gull', 'Hól', 'Brún', 'Fagra', 'Ketil', 'Skógar'];
  const FARM_SUFFIX = ['hlíð', 'holt', 'brekka', 'laug', 'tunga', 'ás', 'fell', 'gerði', 'hóll', 'nes', 'vík', 'mýri', 'staðir', 'hváll', 'dalr', 'ey'];

  // [name, quarter]
  const VALLEYS = [
    ['Laxárdalr', 'West'], ['Hvalfjörðr', 'West'], ['Borgarfjörðr', 'West'], ['Hítardalr', 'West'], ['Mýrar', 'West'],
    ['Breiðafjörðr', 'West'], ['Króksfjörðr', 'West'], ['Norðrárdalr', 'West'], ['Hvítársíða', 'West'], ['Haukadalr', 'West'],
    ['Súgandafjörðr', 'West'], ['Dýrafjörðr', 'West'], ['Önundarfjörðr', 'West'],
    ['Hrútafjörðr', 'North'], ['Svínadalr', 'North'], ['Langadalr', 'North'], ['Vatnsdalr', 'North'], ['Eyjafjörðr', 'North'],
    ['Skagafjörðr', 'North'], ['Hörgárdalr', 'North'], ['Reykjadalr', 'North'], ['Öxarfjörðr', 'North'], ['Svarfaðardalr', 'North'],
    ['Fljótsdalr', 'East'], ['Skriðdalr', 'East'], ['Álftafjörðr', 'East'], ['Vopnafjörðr', 'East'],
    ['Rangárvellir', 'South'], ['Þjórsárdalr', 'South'], ['Fljótshlíð', 'South'], ['Landeyjar', 'South'], ['Biskupstungur', 'South'], ['Grímsnes', 'South'], ['Mýrdalr', 'South'],
  ];

  // Where settlers and their kin came from.
  const ORIGINS = [
    { id: 'sogn', text: 'Sogn in Norway', w: 3 }, { id: 'hordaland', text: 'Hordaland in Norway', w: 3 },
    { id: 'rogaland', text: 'Rogaland in Norway', w: 2 }, { id: 'more', text: 'Møre in Norway', w: 2 },
    { id: 'trondelag', text: 'Trøndelag in Norway', w: 1.5 }, { id: 'agder', text: 'Agder in Norway', w: 1 },
    { id: 'hebrides', text: 'the Hebrides', w: 1.5 }, { id: 'orkney', text: 'the Orkneys', w: 1 },
    { id: 'dublin', text: 'Dublin, among the Norse-Irish', w: 1 },
  ];

  const Names = {
    MALE, FEMALE, THRALL_MALE, THRALL_FEMALE, ORIGINS, VALLEYS,
    male(rng) { const [first, gen] = rng.pick(MALE); return { first, gen }; },
    female(rng) { return { first: rng.pick(FEMALE), gen: null }; },
    thrall(rng, sex) {
      if (sex === 'F') return { first: rng.pick(THRALL_FEMALE), gen: null };
      const [first, gen] = rng.pick(THRALL_MALE);
      return { first, gen };
    },
    origin(rng) { return rng.weighted(ORIGINS, (o) => o.w); },
    farmName(rng) { return rng.pick(FARM_PREFIX) + rng.pick(FARM_SUFFIX); },
    genericByname(rng) { return rng.pick(BYNAMES_GENERIC); },
    region(rng) {
      const [valley, quarter] = rng.pick(VALLEYS);
      const setting = rng.weighted([{ s: 'coast', w: 0.4 }, { s: 'river', w: 0.35 }, { s: 'inland', w: 0.25 }], (x) => x.w).s;
      return { valley, quarter, setting };
    },
    /** "Þorsteinsson", "Ketilsdóttir" */
    patronymic(person) {
      if (!person.father) return '';
      return person.father.gen + (person.sex === 'M' ? 'son' : 'dóttir');
    },
    /** "Ketill Þorsteinsson the Stout" */
    fullName(person) {
      let n = person.first;
      if (person.father) n += ' ' + Names.patronymic(person);
      if (person.byname) n += ' ' + person.byname;
      return n;
    },
    /** "Þórðr of Brekka" style short reference for a head of a neighbouring family. */
    ofFarm(head, farm) { return head.first + ' of ' + farm; },
  };

  IS.Names = Names;
})();
