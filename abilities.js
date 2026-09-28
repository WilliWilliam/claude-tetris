'use strict';

// Chargeable abilities: energy fills by clearing lines; when full, E opens the menu.
// The effects live in game.js (useAbility) because they touch the live game state.

const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 10;
const PREVIEW_MS = 30000;
const SLOW_MS = 10000;
const SLOW_FACTOR = 2;

const ABILITIES = [
  { id: 'preview', icon: '👁️', name: 'Ver 5 piezas', desc: 'Muestra las próximas 5 piezas durante 30 s' },
  { id: 'swap',    icon: '🔄', name: 'Cambiar pieza', desc: 'Cambia la pieza actual por otra distinta' },
  { id: 'slow',    icon: '🐢', name: 'Ralentizar', desc: 'La caída va a mitad de velocidad 10 s' },
  { id: 'undo',    icon: '↩️', name: 'Deshacer', desc: 'Deshace la última colocación' },
];
