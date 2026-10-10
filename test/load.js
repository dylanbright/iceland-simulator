/* Loads the game's classic scripts into one shared IS namespace for Node tests. */
'use strict';
const path = require('path');
const FILES = ['rng', 'core/rules', 'core/calendar', 'data/names', 'data/traits', 'core/person', 'core/ancestry', 'core/start', 'core/economy', 'core/raid', 'core/marriage', 'core/feud', 'data/farm-events', 'data/incidents', 'data/events', 'data/feud-events', 'data/conflict-events', 'core/turn', 'core/household', 'core/state'];
FILES.forEach((f) => require(path.join(__dirname, '..', 'js', f + '.js')));
module.exports = globalThis.IS;
