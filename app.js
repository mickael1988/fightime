'use strict';

const VERSION = '1.0.0';

/* ---------- Configuration des timers ---------- */

const BASE = {
  prep: 10,
  rounds: 8, work: 20, rest: 10,
  sets: 1, setRest: 60,
  warn: 0, cooldown: 0,
  prepLabel: 'PRÉPARER', workLabel: 'EXERCICE', restLabel: 'REPOS',
  lapCounter: false,
};

const MODE_DEFAULTS = {
  tabata: { rounds: 8, work: 20, rest: 10, sets: 2, setRest: 60 },
  rounds: { rounds: 3, work: 180, rest: 60, warn: 10, workLabel: 'COMBAT' },
};

const BUILTIN_PRESETS = [
  { id: 'boxe', name: 'Boxe 3×3′', cfg: MODE_DEFAULTS.rounds },
  { id: 'mma', name: 'MMA 5×5′', cfg: { ...MODE_DEFAULTS.rounds, rounds: 5, work: 300 } },
  { id: 'muay', name: 'Muay Thaï 5×3′', cfg: { ...MODE_DEFAULTS.rounds, rounds: 5, rest: 120 } },
  { id: 'sparring', name: 'Sparring 12×2′', cfg: { ...MODE_DEFAULTS.rounds, rounds: 12, work: 120, rest: 30, workLabel: 'SPARRING' } },
  { id: 'tabata', name: 'Tabata classique', cfg: { rounds: 8, work: 20, rest: 10 } },
  { id: 'emom', name: 'EMOM 10′', cfg: { rounds: 10, work: 60, rest: 0, workLabel: 'MINUTE' } },
  { id: 'amrap', name: 'AMRAP 12′', cfg: { rounds: 1, work: 720, rest: 0, warn: 60, workLabel: 'AMRAP', lapCounter: true } },
  { id: 'timer', name: 'Minuteur 5′', cfg: { prep: 0, rounds: 1, work: 300, rest: 0, workLabel: 'MINUTEUR' } },
];

const MODE_TITLES = { tabata: 'TABATA', rounds: 'ROUNDS', chrono: 'CHRONOMÈTRE' };

// Lignes de l'éditeur (icône montre) ; dot = couleur de la pastille
const INTERVAL_ROWS = [
  { key: 'prep', label: c => c.prepLabel || 'PRÉPARER', hint: 'Compte à rebours avant de commencer', dot: 'prep', type: 'time', min: 0 },
  { key: 'work', label: c => c.workLabel || 'EXERCICE', hint: 'Faire des exercices pendant', dot: 'work', type: 'time', min: 1 },
  { key: 'rest', label: c => c.restLabel || 'REPOS', hint: 'Se reposer pendant', dot: 'rest', type: 'time', min: 0 },
  { key: 'rounds', label: 'Rounds', hint: 'Un round = un exercice + repos', dot: 'cool', type: 'num', min: 1, max: 99 },
  { key: 'sets', label: 'Cycles', hint: c => `Un cycle = ${c.rounds} round${c.rounds > 1 ? 's' : ''}`, dot: 'prep', type: 'num', min: 1, max: 20 },
  { key: 'setRest', label: 'Repos entre les cycles', hint: 'Intervalle de récupération', dot: 'prep', type: 'time', min: 0 },
  { key: 'cooldown', label: 'Récupération', hint: 'Récupération après l’entraînement', dot: 'cool', type: 'time', min: 0 },
];

const OPTION_ROWS = [
  { key: 'warn', label: 'Alerte avant la fin', hint: 'Signal sonore avant la fin de l’exercice', dot: 'warn', type: 'time', min: 0 },
  { key: 'lapCounter', label: 'Compteur de tours', hint: 'Remplace « rounds restants »', type: 'toggle' },
  { key: 'prepLabel', label: 'Nom préparation', type: 'text' },
  { key: 'workLabel', label: 'Nom exercice', type: 'text' },
  { key: 'restLabel', label: 'Nom repos', type: 'text' },
];

/* ---------- Paramètres généraux ---------- */

// Chaque sonorité associe un son au début du travail, à la fin et à l'alerte
const THEMES = [
  { id: 'gong', name: 'Gong chinois', start: 'gong', end: 'gong2', warn: 'clap' },
  { id: 'boxing', name: 'Cloche de boxe', start: 'bell', end: 'bell3', warn: 'clap' },
  { id: 'beep', name: 'Bip électronique', start: 'beepHigh', end: 'beepLow', warn: 'beep2' },
  { id: 'whistle', name: 'Sifflet', start: 'whistle', end: 'whistle3', warn: 'beep2' },
  { id: 'horn', name: 'Sirène', start: 'horn', end: 'hornLong', warn: 'beep2' },
];

const COLOR_THEMES = [['orange', 'Orange + Bleu'], ['citron', 'Citron + Violet']];

const TIME_FORMATS = [['00:00', '00:00'], ['0:00', '0:00'], ['00:00.0', '00:00.0']];

const canVibrate = 'vibrate' in navigator;

const PREF_ROWS = [
  { key: 'timer', label: 'Intervalles du timer', type: 'link', showIf: () => store.mode !== 'chrono' },
  { key: 'sound', label: 'Effet sonore', type: 'toggle' },
  { key: 'theme', label: 'Type de sonorité', type: 'picker', choices: () => THEMES.map(t => [t.id, t.name]) },
  { key: 'volume', type: 'volume' },
  { key: 'voice', label: 'Voice assist', type: 'toggle', hint: 'Annonce vocale des rounds et du décompte' },
  { key: 'voiceURI', label: 'Voix', type: 'picker', choices: voiceChoices },
  { key: 'ducking', label: 'Effet ducking', type: 'toggle', disabled: true, hint: 'Réduire le volume de la musique pendant les annonces — non autorisé pour une web app' },
  { key: 'countdown', label: 'Décompte 3-2-1', type: 'toggle', hint: 'Bips (ou voix) sur les 3 dernières secondes' },
  { key: 'ticking', label: 'Son de cliquetis', type: 'toggle' },
  { key: 'vibrate', label: 'Vibration', type: 'toggle', disabled: !canVibrate, hint: canVibrate ? '' : 'Non prise en charge par ce navigateur' },
  { key: 'torch', label: 'Éclairage flash', type: 'toggle', hint: 'Éclairage flash ne fonctionne qu’en mode premier plan (Android)' },
  { key: 'screenFlash', label: 'Flash à l’écran', type: 'toggle', hint: 'Le flash de l’écran ne fonctionne qu’en mode premier plan' },
  { key: 'rotation', label: 'Rotation', type: 'toggle', hint: 'Autoriser la rotation de l’écran pendant l’exercice' },
  { key: 'colors', label: 'Couleurs', type: 'picker', choices: () => COLOR_THEMES },
  { key: 'pale', label: 'Couleurs pâles', type: 'toggle' },
  { key: 'timeFormat', label: 'Format minuteur', type: 'picker', choices: () => TIME_FORMATS },
];

const DEFAULT_PREFS = {
  sound: true, theme: 'gong', volume: 70,
  voice: false, voiceURI: '',
  ducking: false, countdown: true, ticking: false,
  vibrate: true, torch: false, screenFlash: false,
  rotation: true, colors: 'orange', pale: false, timeFormat: '00:00',
};

/* ---------- Stockage ---------- */

const STORE_KEY = 'fightime:v3';

function freshStore() {
  return {
    mode: 'tabata',
    cfgs: {
      tabata: { ...BASE, ...MODE_DEFAULTS.tabata },
      rounds: { ...BASE, ...MODE_DEFAULTS.rounds },
      custom: { ...BASE, ...BUILTIN_PRESETS[6].cfg },
    },
    customName: BUILTIN_PRESETS[6].name,
    presets: [],
    prefs: { ...DEFAULT_PREFS },
    showRemaining: false,
  };
}

function loadStore() {
  const s = freshStore();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && saved.cfgs) {
      Object.assign(s, saved);
      for (const k of ['tabata', 'rounds', 'custom']) s.cfgs[k] = { ...BASE, ...saved.cfgs[k] };
      s.prefs = { ...DEFAULT_PREFS, ...saved.prefs };
    }
  } catch (_) {}
  return s;
}

function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (_) {}
}

const store = loadStore();
const cfg = () => store.cfgs[store.mode];
const prefs = store.prefs;

/* ---------- Formatage ---------- */

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');

// Affichage d'un temps selon le format choisi ; countdown arrondit au supérieur
function fmtClock(ms, countdown = true) {
  ms = Math.max(0, ms);
  if (prefs.timeFormat === '00:00.0') {
    const t = countdown ? Math.ceil(ms / 100) : Math.floor(ms / 100);
    const s = Math.floor(t / 10);
    return `${pad(Math.floor(s / 60))}:${pad(s % 60)}.${t % 10}`;
  }
  const s = countdown ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${prefs.timeFormat === '0:00' ? m : pad(m)}:${pad(s % 60)}`;
}

// Durée en secondes, sans dixièmes
function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  return `${prefs.timeFormat === '0:00' ? m : pad(m)}:${pad(sec % 60)}`;
}

// Accepte "90", "1:30", "1.30", "1m30"
function parseTime(str) {
  const parts = String(str).trim().split(/[:.,m\s]+/).filter(Boolean).map(Number);
  if (!parts.length || parts.some(isNaN)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function timeStep(v, dir) {
  const ref = dir > 0 ? v : v - 1;
  const step = ref < 60 ? 5 : ref < 600 ? 15 : 60;
  return Math.max(0, Math.round((v + dir * step) / step) * step);
}

/* ---------- Construction des phases ---------- */

function buildPhases(c) {
  const phases = [];
  if (c.prep > 0) phases.push({ type: 'prep', label: c.prepLabel || 'PRÉPARER', dur: c.prep, set: 1 });
  for (let s = 1; s <= c.sets; s++) {
    for (let r = 1; r <= c.rounds; r++) {
      phases.push({ type: 'work', label: c.workLabel || 'TRAVAIL', dur: c.work, round: r, set: s });
      if (r < c.rounds && c.rest > 0)
        phases.push({ type: 'rest', label: c.restLabel || 'REPOS', dur: c.rest, round: r, set: s });
    }
    // Le repos entre cycles appartient déjà au cycle suivant pour les compteurs
    if (s < c.sets && c.setRest > 0)
      phases.push({ type: 'rest', label: c.restLabel || 'REPOS', dur: c.setRest, set: s + 1, setBreak: true });
  }
  if (c.cooldown > 0) phases.push({ type: 'cool', label: 'RÉCUPÉRATION', dur: c.cooldown, set: c.sets + 1 });
  return phases;
}

const totalOf = phases => phases.reduce((a, p) => a + p.dur, 0);

/* ---------- Audio ---------- */

let ctx, master;

function initAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  updateVolume();
}

function updateVolume() {
  if (master) master.gain.value = prefs.volume / 100;
}

function tone(freq, dur, { type = 'sine', gain = 0.5, at = 0, slide, attack = 0.008 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function bellHit(at) {
  [[540, 1], [1188, 0.55], [1980, 0.35], [2850, 0.2], [4100, 0.1]]
    .forEach(([f, a]) => tone(f, 1.8, { gain: 0.4 * a, at }));
}

function gongHit(at) {
  [[92, 1], [146, 0.7], [213, 0.55], [291, 0.4], [405, 0.28], [534, 0.18], [702, 0.1]]
    .forEach(([f, a]) => tone(f, 4.5, { gain: 0.45 * a, at, slide: f * 0.985, attack: 0.02 }));
}

function whistle(at, dur) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), lfo = ctx.createOscillator();
  const depth = ctx.createGain(), g = ctx.createGain();
  o.frequency.value = 2900;
  lfo.frequency.value = 32;
  depth.gain.value = 140;
  lfo.connect(depth).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
  g.gain.setValueAtTime(0.3, t + dur - 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); lfo.start(t);
  o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}

const SOUNDS = {
  gong: () => gongHit(0),
  gong2: () => { gongHit(0); gongHit(1.1); },
  bell: () => bellHit(0),
  bell3: () => [0, 0.32, 0.64].forEach(bellHit),
  beepHigh: () => tone(1000, 0.7, { type: 'square', gain: 0.25 }),
  beepLow: () => tone(600, 0.9, { type: 'square', gain: 0.25 }),
  beep2: () => [0, 0.18].forEach(at => tone(1200, 0.12, { type: 'square', gain: 0.22, at })),
  whistle: () => whistle(0, 0.6),
  whistle3: () => [0, 0.3, 0.6].forEach(at => whistle(at, 0.2)),
  horn: () => { tone(220, 1.2, { type: 'sawtooth', gain: 0.35, slide: 260 }); tone(330, 1.2, { type: 'sawtooth', gain: 0.2 }); },
  hornLong: () => { tone(220, 2, { type: 'sawtooth', gain: 0.35 }); tone(330, 2, { type: 'sawtooth', gain: 0.2 }); },
  clap: () => [0, 0.14, 0.28].forEach(at => tone(1800, 0.05, { type: 'triangle', gain: 0.6, at })),
};

// Joue le son "start" | "end" | "warn" de la sonorité choisie
function sfx(kind) {
  if (!prefs.sound) return;
  const theme = THEMES.find(t => t.id === prefs.theme) || THEMES[0];
  SOUNDS[theme[kind]]?.();
}

const countBeep = () => prefs.sound && tone(880, 0.15, { type: 'square', gain: 0.2 });
const tickSound = () => prefs.sound && tone(2400, 0.03, { type: 'triangle', gain: 0.25 });

/* ---------- Voix ---------- */

const synth = window.speechSynthesis;

function frenchVoices() {
  return synth ? synth.getVoices().filter(v => v.lang.toLowerCase().startsWith('fr')) : [];
}

function voiceChoices() {
  return [['', 'Par défaut'], ...frenchVoices().map(v => [v.voiceURI, v.name])];
}

function speak(text) {
  if (!prefs.voice || !synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.volume = Math.max(0.1, prefs.volume / 100);
  u.rate = 1.05;
  const v = frenchVoices().find(x => x.voiceURI === prefs.voiceURI);
  if (v) u.voice = v;
  synth.speak(u);
}

const say = label => label.toLowerCase();

function announce(ph, c) {
  if (ph.type === 'prep') return speak('Préparez-vous');
  if (ph.type === 'cool') return speak('Récupération');
  if (ph.type === 'rest') return speak(ph.setBreak ? `${say(ph.label)}, fin du cycle` : say(ph.label));
  let intro = '';
  if (c.sets > 1 && ph.round === 1) intro += `Cycle ${ph.set}. `;
  if (c.rounds > 1) intro += ph.round === c.rounds && ph.set === c.sets ? 'Dernier round. ' : `Round ${ph.round}. `;
  speak(intro + say(ph.label));
}

function warnText(sec) {
  if (sec % 60 === 0) return sec === 60 ? 'Une minute' : `${sec / 60} minutes`;
  return `${sec} secondes`;
}

/* ---------- Effets visuels et physiques ---------- */

function buzz(pattern) {
  if (prefs.vibrate && canVibrate) navigator.vibrate(pattern);
}

function screenFlash() {
  if (!prefs.screenFlash) return;
  const f = $('flash');
  f.hidden = false;
  f.classList.remove('go');
  void f.offsetWidth; // relance l'animation
  f.classList.add('go');
}

let torchTrack = null;

async function torchAcquire() {
  if (torchTrack) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const track = stream.getVideoTracks()[0];
    if (!track.getCapabilities?.().torch) { track.stop(); return false; }
    torchTrack = track;
    return true;
  } catch (_) {
    return false;
  }
}

function torchRelease() {
  torchTrack?.stop();
  torchTrack = null;
}

function torchBlink() {
  if (!prefs.torch || !torchTrack) return;
  const t = torchTrack;
  t.applyConstraints({ advanced: [{ torch: true }] })
    .then(() => setTimeout(() => t.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {}), 350))
    .catch(() => {});
}

function phaseEffects() {
  screenFlash();
  torchBlink();
}

function lockOrientation() {
  if (!prefs.rotation) screen.orientation?.lock?.('portrait').catch(() => {});
}

function unlockOrientation() {
  try { screen.orientation?.unlock?.(); } catch (_) {}
}

/* ---------- Moteur ---------- */

// run = null (à l'arrêt) ou { cfg, phases, idx, phaseStart, pausedAt, lastSec, laps, done }
// En mode chrono : { chrono: true, start, pausedAt, laps: [durées en ms], lapStart }
let run = null;
let loop = null;

const isPaused = () => !!run && run.pausedAt !== null;

function start() {
  initAudio();
  const now = performance.now();
  if (store.mode === 'chrono') {
    run = { chrono: true, start: now, pausedAt: null, laps: [], lapStart: now };
    sfx('start');
    speak('C’est parti');
  } else {
    const c = { ...cfg() };
    run = { cfg: c, phases: buildPhases(c), idx: 0, phaseStart: now, pausedAt: null, lastSec: null, laps: 0, done: false };
    enterPhase();
  }
  if (prefs.torch) torchAcquire();
  lockOrientation();
  requestWakeLock();
  clearInterval(loop);
  loop = setInterval(tick, 100);
  tick();
}

function reset() {
  clearInterval(loop);
  run = null;
  synth?.cancel();
  torchRelease();
  unlockOrientation();
  releaseWakeLock();
  render();
}

function togglePlay() {
  if (!run || run.done) return start();
  const now = performance.now();
  if (run.pausedAt === null) {
    run.pausedAt = now;
    synth?.cancel();
    releaseWakeLock();
  } else {
    const paused = now - run.pausedAt;
    if (run.chrono) { run.start += paused; run.lapStart += paused; }
    else run.phaseStart += paused;
    run.pausedAt = null;
    initAudio();
    requestWakeLock();
  }
  render();
}

function enterPhase() {
  const ph = run.phases[run.idx];
  const prev = run.phases[run.idx - 1];
  run.lastSec = null;
  if (ph.type === 'work') { sfx('start'); buzz(400); }
  else if (prev && prev.type === 'work') { sfx('end'); buzz([200, 100, 200]); }
  announce(ph, run.cfg);
  if (prev) phaseEffects();
}

function finish() {
  clearInterval(loop);
  run.done = true;
  if (run.phases[run.phases.length - 1].type === 'work') sfx('end');
  speak('Terminé. Bravo !');
  buzz([300, 150, 300, 150, 600]);
  phaseEffects();
  setTimeout(torchRelease, 600);
  unlockOrientation();
  releaseWakeLock();
  render();
}

function tick() {
  if (!run || run.done || run.chrono) return render();

  const now = run.pausedAt ?? performance.now();
  let ph = run.phases[run.idx];
  let rem = ph.dur * 1000 - (now - run.phaseStart);

  // Avance sans dérive (rattrape aussi le retard si l'écran a été mis en veille)
  while (rem <= 0) {
    run.phaseStart += ph.dur * 1000;
    run.idx++;
    if (run.idx >= run.phases.length) return finish();
    enterPhase();
    ph = run.phases[run.idx];
    rem = ph.dur * 1000 - (now - run.phaseStart);
  }

  const secs = Math.ceil(rem / 1000);
  if (secs !== run.lastSec && run.pausedAt === null) {
    const first = run.lastSec === null;
    run.lastSec = secs;
    if (!first) cues(ph, secs);
  }
  render();
}

function cues(ph, secs) {
  const c = run.cfg;
  if (ph.type === 'work' && c.warn > 0 && c.warn < ph.dur && secs === c.warn) {
    sfx('warn');
    speak(warnText(c.warn));
    buzz(150);
    return;
  }
  if (prefs.countdown && secs >= 1 && secs <= 3 && ph.dur > 3) {
    if (prefs.voice) speak(String(secs));
    else countBeep();
    return;
  }
  if (prefs.ticking) tickSound();
}

function addLap() {
  if (!run || run.done || isPaused()) return;
  const now = performance.now();
  if (run.chrono) {
    run.laps.push(now - run.lapStart);
    run.lapStart = now;
  } else if (run.cfg.lapCounter) {
    run.laps++;
  } else {
    return;
  }
  tickSound();
  buzz(60);
  render();
}

/* ---------- Affichage ---------- */

function setStat(side, value, label, tappable) {
  $(side + 'Val').textContent = value;
  $(side + 'Lbl').textContent = label;
  $(side + 'Stat').classList.toggle('tappable', !!tappable);
  $(side + 'Stat').style.visibility = label ? '' : 'hidden';
}

function setPlay(state) {
  const labels = { idle: 'COMMENCER', running: 'PAUSE', paused: 'REPRENDRE', done: 'RECOMMENCER' };
  $('playLbl').textContent = labels[state];
  $('playBtn').setAttribute('aria-label', labels[state]);
  $('playIcon').querySelector('.play-glyph').setAttribute('d',
    state === 'running' ? 'M37 32h9v36h-9zM54 32h9v36h-9z' : 'M40 32 L70 50 L40 68 Z');
}

function modeTitle() {
  return store.mode === 'custom' ? store.customName.toUpperCase() : MODE_TITLES[store.mode];
}

function render() {
  const body = document.body;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.mode === store.mode));
  $('modeTitle').textContent = modeTitle();
  body.classList.toggle('paused', isPaused());
  body.classList.toggle('pale', prefs.pale);
  body.dataset.colors = prefs.colors;
  body.classList.toggle('tenths', prefs.timeFormat === '00:00.0');
  body.classList.toggle('editable', !run || !!run.done);
  $('clockBtn').hidden = store.mode === 'chrono';

  if (store.mode === 'chrono') return renderChrono();

  const c = run ? run.cfg : cfg();
  const phases = run ? run.phases : buildPhases(c);
  if (!phases.length) return;
  const idx = run ? Math.min(run.idx, phases.length - 1) : 0;
  const cur = phases[idx];
  const now = run ? (run.pausedAt ?? performance.now()) : 0;
  const rem = run ? Math.max(0, cur.dur * 1000 - (now - run.phaseStart)) : cur.dur * 1000;
  const secs = Math.ceil(rem / 1000);
  const done = !!run && run.done;

  // En-tête : durée totale ou temps restant
  const total = totalOf(phases);
  const left = done ? 0 : rem / 1000 + totalOf(phases.slice(idx + 1));
  $('totalTime').textContent = store.showRemaining ? '-' + fmt(Math.ceil(left)) : fmt(total);

  // Phase en cours
  if (done) {
    body.dataset.phase = 'done';
    body.classList.remove('warn');
    $('curLabel').textContent = 'TERMINÉ';
    $('curTime').textContent = fmt(total);
  } else {
    body.dataset.phase = cur.type;
    body.classList.toggle('warn', !!run && cur.type === 'work' && c.warn > 0 && c.warn < cur.dur && secs <= c.warn);
    $('curLabel').textContent = cur.label;
    $('curTime').textContent = fmtClock(rem);
  }

  // Phase suivante
  const next = done ? null : phases[idx + 1];
  $('next').dataset.type = next ? next.type : 'end';
  $('nextLabel').textContent = next ? next.label : done ? 'BRAVO' : 'FIN';
  $('nextTime').textContent = next ? fmt(next.dur) : done ? '💪' : fmt(0);

  // Compteurs
  const set = done ? c.sets + 1 : cur.set;
  if (c.lapCounter) {
    setStat('left', run ? run.laps : 0, run && !done ? 'TOURS · TOUCHE +1' : 'TOURS', run && !done);
  } else {
    const roundsLeft = done ? 0 : phases.filter((p, i) => p.type === 'work' && p.set === set && i >= idx).length;
    setStat('left', roundsLeft, 'ROUNDS RESTANTS');
  }
  setStat('right', Math.max(0, c.sets - set + 1), 'CYCLES RESTANTS');

  setPlay(!run ? 'idle' : done ? 'done' : isPaused() ? 'paused' : 'running');
}

function renderChrono() {
  const body = document.body;
  body.classList.remove('warn', 'editable');
  const now = run ? (run.pausedAt ?? performance.now()) : 0;
  const elapsed = run ? now - run.start : 0;
  const lapTime = run ? now - run.lapStart : 0;
  const laps = run ? run.laps : [];

  body.dataset.phase = run ? 'work' : 'prep';
  $('totalTime').textContent = fmtClock(elapsed, false).replace(/\.\d$/, '');
  $('curLabel').textContent = 'CHRONO';
  $('curTime').textContent = fmtClock(elapsed, false);

  $('next').dataset.type = 'rest';
  $('nextLabel').textContent = `TOUR ${laps.length + 1}`;
  $('nextTime').textContent = fmtClock(lapTime, false);

  setStat('left', laps.length, run ? 'TOURS · TOUCHE +1' : 'TOURS', !!run);
  const best = laps.length ? Math.min(...laps) : null;
  setStat('right', best === null ? '--:--' : fmtClock(best, false), 'MEILLEUR TOUR');

  setPlay(!run ? 'idle' : isPaused() ? 'paused' : 'running');
}

/* ---------- Verrou d'écran ---------- */

let wakeLock = null;

async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (_) {}
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && run && !run.done && !isPaused()) {
    requestWakeLock();
    tick();
  }
});

/* ---------- Feuilles ---------- */

function openSheet(id, stack = false) {
  if (!stack) closeSheets();
  $(id).hidden = false;
}

function closeSheets() {
  document.querySelectorAll('.sheet').forEach(s => { s.hidden = true; });
  document.activeElement?.blur();
}

document.querySelectorAll('[data-close]').forEach(b => { b.onclick = closeSheets; });
$('pickerBack').onclick = () => { $('pickerSheet').hidden = true; };

/* ---------- Paramètres généraux (roue dentée) ---------- */

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function toggleInput(checked, disabled, onChange) {
  const t = el('input', 'toggle');
  t.type = 'checkbox';
  t.checked = !!checked;
  t.disabled = !!disabled;
  t.onchange = () => onChange(t.checked);
  return t;
}

function rowShell(label, hint) {
  const row = el('div', 'row');
  const text = el('div', 'row-text');
  text.append(el('span', 'row-label', label));
  if (hint) text.append(el('span', 'row-hint', hint));
  row.append(text);
  return row;
}

const SPEAKER = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';

async function setPref(key, value) {
  if (key === 'torch' && value) {
    initAudio();
    const ok = await torchAcquire();
    if (!ok) {
      alert('Le flash n’est pas accessible sur cet appareil ou ce navigateur (il fonctionne avec Chrome sur Android).');
      value = false;
    } else if (!run) {
      torchRelease();
    }
  }
  prefs[key] = value;
  saveStore();
  updateVolume();
  if (key === 'rotation' && run && !run.done) value ? unlockOrientation() : lockOrientation();
  renderPrefs();
  render();
}

function renderPrefs() {
  const wrap = $('prefRows');
  wrap.innerHTML = '';
  for (const r of PREF_ROWS) {
    if (r.showIf && !r.showIf()) continue;

    if (r.type === 'volume') {
      const row = el('div', 'row row-volume');
      const range = el('input');
      range.type = 'range';
      range.min = 0;
      range.max = 100;
      range.value = prefs.volume;
      range.style.setProperty('--fill', prefs.volume + '%');
      range.setAttribute('aria-label', 'Volume');
      range.oninput = () => range.style.setProperty('--fill', range.value + '%');
      range.onchange = () => { prefs.volume = +range.value; saveStore(); initAudio(); sfx('warn'); };
      const lo = el('span', 'vol-icon');
      const hi = el('span', 'vol-icon');
      lo.innerHTML = SPEAKER + '<path d="M16 9.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      hi.innerHTML = SPEAKER + '<path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      row.append(lo, range, hi);
      wrap.append(row);
      continue;
    }

    const row = rowShell(r.label, r.hint);
    if (r.disabled) row.classList.add('disabled');

    if (r.type === 'toggle') {
      row.append(toggleInput(prefs[r.key], r.disabled, v => setPref(r.key, v)));
    } else if (r.type === 'picker') {
      const choices = r.choices();
      const current = choices.find(([v]) => v === prefs[r.key]) || choices[0];
      const btn = el('button', 'row-picker');
      btn.append(el('span', 'row-value', current[1]), el('span', 'chevron', '›'));
      row.classList.add('clickable');
      row.onclick = () => openPicker(r, choices);
      row.append(btn);
    } else if (r.type === 'link') {
      row.classList.add('clickable');
      row.append(el('span', 'chevron', '›'));
      row.onclick = openEditor;
    }
    wrap.append(row);
  }
}

function openPicker(r, choices) {
  $('pickerTitle').textContent = r.label.toUpperCase();
  const list = $('pickerList');
  list.innerHTML = '';
  for (const [value, label] of choices) {
    const row = rowShell(label);
    row.classList.add('clickable');
    if (value === prefs[r.key]) row.append(el('span', 'check', '✓'));
    row.onclick = () => {
      prefs[r.key] = value;
      saveStore();
      initAudio();
      if (r.key === 'theme') sfx('start');
      if (r.key === 'voiceURI') { const was = prefs.voice; prefs.voice = true; speak('Round 1. Combat'); prefs.voice = was; }
      openPicker(r, choices);
      renderPrefs();
      render();
    };
    list.append(row);
  }
  if (r.key === 'voiceURI' && choices.length === 1) {
    list.append(el('p', 'empty', 'Aucune voix française trouvée sur cet appareil.'));
  }
  openSheet('pickerSheet', true);
}

synth?.addEventListener?.('voiceschanged', () => { if (!$('settingsSheet').hidden) renderPrefs(); });

/* ---------- Éditeur des intervalles ---------- */

let draft = null; // copie modifiable de la config, appliquée seulement par « Enregistrer »

const resolve = (v, c) => (typeof v === 'function' ? v(c) : v);

// ":10" sous la minute, "05:00" au-delà
function fmtShort(sec) {
  return sec < 60 ? ':' + pad(sec) : `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
}

function editorRow(r) {
  const label = resolve(r.label, draft);
  const row = rowShell(label, resolve(r.hint, draft));
  if (r.dot) row.querySelector('.row-label').prepend(el('i', `dot dot-${r.dot}`));

  if (r.type === 'time' || r.type === 'num') {
    row.classList.add('clickable');
    row.append(el('span', 'row-big', r.type === 'time' ? fmtShort(draft[r.key]) : draft[r.key]), el('span', 'chevron', '›'));
    row.onclick = () => openWheel(r, label);
  } else if (r.type === 'toggle') {
    row.append(toggleInput(draft[r.key], false, v => { draft[r.key] = v; }));
  } else if (r.type === 'text') {
    const input = el('input', 'value value-text');
    input.value = draft[r.key];
    input.maxLength = 16;
    input.setAttribute('aria-label', r.label);
    input.onchange = () => { draft[r.key] = input.value.trim().toUpperCase(); renderEditor(); };
    row.append(input);
  }
  return row;
}

function renderEditor() {
  $('editorTitle').textContent = modeTitle();
  $('runningNote').hidden = !run || run.done;
  const intervals = $('intervalRows');
  intervals.innerHTML = '';
  INTERVAL_ROWS.forEach(r => intervals.append(editorRow(r)));
  const options = $('optionRows');
  options.innerHTML = '';
  OPTION_ROWS.forEach(r => options.append(editorRow(r)));
}

function openEditor() {
  if (store.mode === 'chrono') return;
  draft = { ...cfg() };
  renderEditor();
  // Laisse la barre d'onglets visible sous l'éditeur
  document.documentElement.style.setProperty('--tabs-h', document.querySelector('.tabs').offsetHeight + 'px');
  openSheet('editorSheet');
  $('editorSheet').querySelector('.sheet-inner').scrollTop = 0;
}

$('editorCancel').onclick = closeSheets;

$('editorSave').onclick = () => {
  store.cfgs[store.mode] = { ...draft };
  saveStore();
  closeSheets();
  render();
};

$('newTimerBtn').onclick = () => {
  const name = prompt('Nom du nouveau minuteur :');
  if (!name || !name.trim()) return;
  const p = { id: 'u' + Date.now(), name: name.trim().slice(0, 24), cfg: { ...draft } };
  store.presets.push(p);
  if (run && !run.done) reset();
  store.mode = 'custom';
  store.cfgs.custom = { ...BASE, ...p.cfg };
  store.customName = p.name;
  saveStore();
  closeSheets();
  render();
};

/* ---------- Molettes ---------- */

const ITEM_H = 64;

function makeWheel(values, current, format) {
  const wheel = el('div', 'wheel');
  values.forEach((v, i) => {
    const item = el('div', 'wheel-item', format(v));
    item.onclick = () => wheel.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
    wheel.append(item);
  });
  wheel.read = () => values[Math.max(0, Math.min(values.length - 1, Math.round(wheel.scrollTop / ITEM_H)))];
  wheel.init = () => { wheel.scrollTop = Math.max(0, values.indexOf(current)) * ITEM_H; };
  return wheel;
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

function openWheel(r, label) {
  $('wheelTitle').textContent = label.toUpperCase();
  $('wheelHint').textContent = resolve(r.hint, draft) || '';
  const box = $('wheels');
  box.innerHTML = '';
  const v = draft[r.key];
  let read;

  if (r.type === 'time') {
    const min = makeWheel(range(0, 99), Math.floor(v / 60), pad);
    const sec = makeWheel(range(0, 59), v % 60, pad);
    box.append(min, el('span', 'wheel-sep', ':'), sec);
    box.dataset.units = 'MIN SEC';
    read = () => min.read() * 60 + sec.read();
  } else {
    const num = makeWheel(range(r.min, r.max), v, String);
    box.append(num);
    box.dataset.units = '';
    read = num.read;
  }

  $('wheelOk').onclick = () => {
    draft[r.key] = Math.max(r.min ?? 0, read());
    $('wheelSheet').hidden = true;
    renderEditor();
  };
  openSheet('wheelSheet', true);
  box.querySelectorAll('.wheel').forEach(w => w.init());
}

$('wheelCancel').onclick = () => { $('wheelSheet').hidden = true; };

/* ---------- Préréglages (onglet Plus) ---------- */

function presetRow(p, custom) {
  const row = rowShell(p.name);
  row.classList.add('clickable');
  row.append(el('span', 'row-value', fmt(totalOf(buildPhases({ ...BASE, ...p.cfg })))));
  row.onclick = () => {
    reset();
    store.mode = 'custom';
    store.cfgs.custom = { ...BASE, ...p.cfg };
    store.customName = p.name;
    saveStore();
    closeSheets();
    render();
  };
  if (custom) {
    const x = el('button', 'row-del', '✕');
    x.setAttribute('aria-label', `Supprimer ${p.name}`);
    x.onclick = e => {
      e.stopPropagation();
      if (!confirm(`Supprimer « ${p.name} » ?`)) return;
      store.presets = store.presets.filter(q => q.id !== p.id);
      saveStore();
      renderPlus();
    };
    row.append(x);
  }
  return row;
}

function renderPlus() {
  const mine = $('customList');
  mine.innerHTML = '';
  if (!store.presets.length) {
    mine.append(el('p', 'empty', 'Touche l’icône montre en haut à droite, règle tes intervalles puis « Ajouter un nouveau minuteur ».'));
  }
  store.presets.forEach(p => mine.append(presetRow(p, true)));
  const builtin = $('builtinList');
  builtin.innerHTML = '';
  BUILTIN_PRESETS.forEach(p => builtin.append(presetRow(p, false)));
}

/* ---------- Événements ---------- */

$('playBtn').onclick = togglePlay;
$('resetBtn').onclick = reset;
$('leftStat').onclick = () => (run && !run.done ? addLap() : openEditor());
$('rightStat').onclick = () => { if (!run || run.done) openEditor(); };
$('current').onclick = () => { if (!run || run.done) openEditor(); };
$('next').onclick = () => { if (!run || run.done) openEditor(); };
$('settingsBtn').onclick = () => { renderPrefs(); openSheet('settingsSheet'); };
$('clockBtn').onclick = openEditor;
$('totalTime').onclick = () => {
  store.showRemaining = !store.showRemaining;
  saveStore();
  render();
};

document.querySelectorAll('.tab').forEach(t => {
  t.onclick = () => {
    if (!$('editorSheet').hidden) closeSheets();
    if (t.dataset.mode === 'custom') {
      renderPlus();
      openSheet('plusSheet');
      return;
    }
    if (t.dataset.mode === store.mode) return;
    if (run && !run.done && !confirm('Arrêter le timer en cours ?')) return;
    reset();
    store.mode = t.dataset.mode;
    saveStore();
    render();
  };
});

document.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.code === 'Escape') closeSheets();
  else if (e.code === 'KeyR') reset();
  else if (e.code === 'KeyL') addLap();
});

/* ---------- Écran de démarrage ---------- */

const SPLASH_MIN = 1200; // durée minimale d'affichage (ms)
const SPLASH_MAX = 3000; // ne bloque jamais plus longtemps, même si le chargement traîne

function hideSplash() {
  const splash = $('splash');
  if (!splash || splash.classList.contains('hide')) return;
  splash.classList.add('hide');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  setTimeout(() => splash.remove(), 800);
}

$('splash').onclick = hideSplash;
setTimeout(hideSplash, SPLASH_MAX);
window.addEventListener('load', () => setTimeout(hideSplash, Math.max(0, SPLASH_MIN - performance.now())));

document.querySelector('.version').textContent = `VERSION: ${VERSION}`;
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
