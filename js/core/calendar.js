/* Calendar: two seasons per year. The Icelandic year begins on 14 April (first day of Summer Finding). */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});

  const MONTHS = [
    { id: 'summer_finding', name: 'Summer Finding', season: 'summer', span: 'Apr 14 – May 13' },
    { id: 'eggtide', name: 'Eggtide', season: 'summer', span: 'May 14 – Jun 13' },
    { id: 'midsummer', name: 'Midsummer', season: 'summer', span: 'Jun 14 – Jul 13' },
    { id: 'haymaking', name: 'Haymaking', season: 'summer', span: 'Jul 14 – Aug 13' },
    { id: 'double_month', name: 'Double Month', season: 'summer', span: 'Aug 14 – Sep 13' },
    { id: 'harvest_month', name: 'Harvest Month', season: 'summer', span: 'Sep 14 – Oct 13' },
    { id: 'winter_finding', name: 'Winter Finding', season: 'winter', span: 'Oct 14 – Nov 13' },
    { id: 'frost_month', name: 'Frost Month', season: 'winter', span: 'Nov 14 – Dec 13' },
    { id: 'jol', name: 'Jól', season: 'winter', span: 'Dec 14 – Jan 13' },
    { id: 'thorri', name: 'Þorri', season: 'winter', span: 'Jan 14 – Feb 13' },
    { id: 'barren_month', name: 'Barren Month', season: 'winter', span: 'Feb 14 – Mar 13' },
    { id: 'single_month', name: 'Single Month', season: 'winter', span: 'Mar 14 – Apr 13' },
  ];

  /** Fixed calendar beats that play out inside each season (content hooks for later systems). */
  const BEATS = {
    summer: [
      { id: 'victory_sacrifice', name: 'Victory Sacrifice', month: 'summer_finding', note: 'New year. Omens read for the year ahead.' },
      { id: 'spring_assembly', name: 'Spring Assembly', month: 'summer_finding', note: 'Local court (vorþing). Cases between neighbors.' },
      { id: 'althing', name: 'The Alþing', month: 'midsummer', note: 'National assembly at Þingvellir. Quarter Courts, Law Council.' },
      { id: 'haymaking', name: 'Haymaking', month: 'haymaking', note: 'The winter\'s fate is decided in the hayfield.' },
      { id: 'roundup', name: 'Sheep round-up', month: 'harvest_month', note: 'Sheep driven from the highlands and sorted by owner.' },
      { id: 'summer_feasts', name: 'Late-summer feasts', month: 'harvest_month', note: 'Weddings and funeral banquets in times of plenty.' },
    ],
    winter: [
      { id: 'winter_nights', name: 'Winter Nights', month: 'winter_finding', note: 'Winter begins. Cattle come indoors.' },
      { id: 'jol_feast', name: 'Jól feast', month: 'jol', note: 'Midwinter feast. Honor is won and lost at table.' },
      { id: 'thorri_blot', name: 'Þorri', month: 'thorri', note: 'The hardest part of winter. Hay runs low.' },
      { id: 'spring_contracts', name: 'Household contracts', month: 'single_month', note: 'Lodging contracts renegotiated before spring.' },
    ],
  };

  const Calendar = {
    MONTHS,
    BEATS,
    SEASONS: ['summer', 'winter'],
    /** Turn 0 is the first Summer of startYear. Two turns per year. */
    turnInfo(turn, startYear) {
      const yearIndex = Math.floor(turn / 2);
      const season = turn % 2 === 0 ? 'summer' : 'winter';
      const year = startYear + yearIndex;
      return {
        turn, year, season, yearIndex,
        label: (season === 'summer' ? 'Summer' : 'Winter') + ', year ' + year,
        months: MONTHS.filter((m) => m.season === season),
        beats: BEATS[season],
      };
    },
  };

  IS.Calendar = Calendar;
})();
