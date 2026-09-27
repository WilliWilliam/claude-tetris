'use strict';

const MUTE_KEY = 'tetris-muted';

let audioCtx = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';

// Browsers only allow an AudioContext after a user gesture.
function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function setMuted(value) {
  muted = value;
  localStorage.setItem(MUTE_KEY, value ? '1' : '0');
}

function playTone(freq, dur, type = 'square', delay = 0, vol = 0.08) {
  if (muted || !audioCtx) return;
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function playChord(freqs, dur, type, delay = 0) {
  for (const f of freqs) playTone(f, dur, type, delay, 0.05);
}

const sfx = {
  rotate()   { playTone(660, 0.04, 'square', 0, 0.04); },
  lock()     { playTone(110, 0.08, 'triangle', 0, 0.12); },
  hold()     { playTone(440, 0.05, 'sine'); playTone(880, 0.06, 'sine', 0.05); },
  clear(n)   { playChord([523, 659, 784].slice(0, Math.min(n, 3)), 0.18, 'triangle'); if (n === 4) playTone(1047, 0.25, 'triangle', 0.08); },
  combo(n)   { playTone(440 * Math.pow(2, Math.min(n, 12) / 12), 0.12, 'square', 0.1); },
  tspin()    { playChord([587, 740, 880], 0.25, 'sawtooth', 0.05); },
  b2b()      { playTone(1175, 0.15, 'square', 0.15); },
  perfect()  { [523, 659, 784, 1047, 1319].forEach((f, i) => playTone(f, 0.18, 'triangle', 0.2 + i * 0.08, 0.07)); },
  gameOver() { [392, 330, 262, 196].forEach((f, i) => playTone(f, 0.25, 'sawtooth', i * 0.18, 0.06)); },
};
