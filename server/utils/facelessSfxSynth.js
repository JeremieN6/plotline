/**
 * Bruitages de la video faceless, SYNTHETISES par du code (oscillateurs,
 * bruit filtre, cordes pincees) : aucun fichier tiers, donc aucune question de
 * licence. Deterministe (graine fixe par son). Les WAV sont produits par
 * `scripts/faceless-sfx/generate.mjs` dans `resources/faceless/sfx/`.
 */

export const SFX_SAMPLE_RATE = 48000;
const SR = SFX_SAMPLE_RATE;
const TAU = Math.PI * 2;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * SR));

/** Ajoute `src` dans `dst` a partir de `at` secondes. */
function mixInto(dst, src, at = 0, gain = 1) {
  const offset = Math.round(at * SR);
  for (let i = 0; i < src.length && offset + i < dst.length; i += 1) dst[offset + i] += src[i] * gain;
  return dst;
}

/** Ton sinusoidal, frequence glissante (exponentielle), attaque courte, decroissance exponentielle. */
function tone({ seconds, from, to = from, decay = seconds / 4, attack = 0.004, harmonics = [[1, 1]], vibrato = 0, vibratoRate = 0 }) {
  const out = buffer(seconds);
  const phases = harmonics.map(() => 0);
  for (let i = 0; i < out.length; i += 1) {
    const t = i / SR;
    const freq = from * (to / from) ** (t / seconds) * (1 + vibrato * Math.sin(TAU * vibratoRate * t));
    const env = Math.min(1, t / attack) * Math.exp(-t / decay);
    let v = 0;
    harmonics.forEach(([mult, amp], k) => {
      phases[k] += (TAU * freq * mult) / SR;
      v += Math.sin(phases[k]) * amp;
    });
    out[i] = v * env;
  }
  return out;
}

/** Cloche : partiels inharmoniques qui s eteignent a des vitesses differentes. */
function bell(freq, seconds = 1.2, gain = 1) {
  const out = buffer(seconds);
  const partials = [[1, 1, 1], [2.76, 0.45, 0.6], [5.4, 0.25, 0.35], [8.93, 0.12, 0.2]];
  for (let i = 0; i < out.length; i += 1) {
    const t = i / SR;
    let v = 0;
    for (const [mult, amp, life] of partials) v += Math.sin(TAU * freq * mult * t) * amp * Math.exp(-t / (seconds * 0.35 * life));
    out[i] = v * Math.min(1, t / 0.002) * gain;
  }
  return out;
}

/** Corde pincee (Karplus-Strong). */
function pluck(freq, seconds, seed) {
  const out = buffer(seconds);
  const period = Math.max(2, Math.round(SR / freq));
  const random = rng(seed);
  const line = Float32Array.from({ length: period }, () => random());
  for (let i = 0; i < out.length; i += 1) {
    const k = i % period;
    const next = (k + 1) % period;
    const v = line[k];
    line[k] = 0.498 * (line[k] + line[next]);
    out[i] = v;
  }
  return out;
}

/** Filtre biquad (RBJ) : 'bandpass' | 'lowpass' | 'highpass'. `freqAt(t)` permet un balayage. */
function biquad(input, type, freqAt, q = 0.9) {
  const out = new Float32Array(input.length);
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const f = typeof freqAt === 'function' ? freqAt(i / SR) : freqAt;
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    let b0; let b1; let b2;
    if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
    else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    const a0 = 1 + alpha; const a1 = -2 * cos; const a2 = 1 - alpha;
    const y = (b0 * input[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = input[i]; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** Bruit blanc faconne par une enveloppe `env(t, duree)`. */
function noise(seconds, seed, env) {
  const random = rng(seed);
  const out = buffer(seconds);
  for (let i = 0; i < out.length; i += 1) out[i] = random() * env(i / SR, seconds);
  return out;
}

const decayEnv = (attack, decay) => (t) => Math.min(1, t / attack) * Math.exp(-t / decay);
const bumpEnv = (t, d) => Math.sin(Math.PI * Math.min(1, t / d)) ** 2;

/**
 * Volume moyen ramene a `targetRms` (-18 dB) pour que tous les sons aient le
 * meme poids percu, pic plafonne a `peak` (-3 dB) ; retire un eventuel DC.
 */
function normalize(samples, { targetRms = 0.126, peak = 0.7 } = {}) {
  let mean = 0;
  for (const v of samples) mean += v;
  mean /= samples.length || 1;
  let max = 0;
  let energy = 0;
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] -= mean;
    max = Math.max(max, Math.abs(samples[i]));
    energy += samples[i] ** 2;
  }
  const rms = Math.sqrt(energy / (samples.length || 1));
  const gain = max > 0 ? Math.min(targetRms / (rms || 1e-9), peak / max) : 0;
  for (let i = 0; i < samples.length; i += 1) samples[i] *= gain;
  // Fondu de sortie de 10 ms : jamais de clic a la coupure.
  const fade = Math.min(samples.length, Math.round(0.01 * SR));
  for (let i = 0; i < fade; i += 1) samples[samples.length - 1 - i] *= i / fade;
  return samples;
}

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

const RECIPES = {
  'ui/pop': () => mixInto(tone({ seconds: 0.14, from: 620, to: 240, decay: 0.035, harmonics: [[1, 1], [2, 0.2]] }),
    biquad(noise(0.01, 1, decayEnv(0.0005, 0.002)), 'highpass', 3000), 0, 0.5),
  'girly/kawaii-pop': () => tone({ seconds: 0.18, from: 850, to: 1700, decay: 0.05, harmonics: [[1, 1], [2, 0.3], [3, 0.1]] }),
  'girly/cute-boing': () => tone({ seconds: 0.42, from: 260, to: 520, decay: 0.12, vibrato: 0.12, vibratoRate: 14, harmonics: [[1, 1], [2, 0.25]] }),
  'girly/chime-ding-soft': () => bell(1318.51, 1.3),
  'girly/sparkle-twinkle': () => {
    const out = buffer(0.7);
    [3136, 2637, 3520, 2794, 3951, 3322].forEach((f, i) => mixInto(out, tone({ seconds: 0.25, from: f, decay: 0.05, attack: 0.002 }), i * 0.06, 0.8 - i * 0.08));
    return out;
  },
  'girly/sparkle-wand': () => {
    const out = buffer(1.3);
    PENTATONIC.slice(2).forEach((f, i) => mixInto(out, bell(f * 2, 0.5, 0.35), i * 0.05));
    return mixInto(out, biquad(noise(1.0, 7, (t, d) => bumpEnv(t, d) * 0.15), 'highpass', 6000), 0.05);
  },
  'girly/heart-boop': () => {
    const out = buffer(0.3);
    mixInto(out, tone({ seconds: 0.12, from: 520, to: 560, decay: 0.04, harmonics: [[1, 1], [2, 0.15]] }), 0);
    return mixInto(out, tone({ seconds: 0.16, from: 780, to: 820, decay: 0.05, harmonics: [[1, 1], [2, 0.15]] }), 0.11);
  },
  'girly/coin-spin': () => {
    const out = buffer(0.55);
    const square = [[1, 1], [3, 0.3], [5, 0.15]];
    mixInto(out, tone({ seconds: 0.09, from: 987.77, decay: 0.2, harmonics: square }), 0, 0.6);
    return mixInto(out, tone({ seconds: 0.45, from: 1318.51, decay: 0.15, harmonics: square }), 0.08, 0.6);
  },
  'girly/cash-cute': () => {
    const out = RECIPES['girly/coin-spin']();
    const longer = buffer(1.2);
    mixInto(longer, out, 0);
    [1567.98, 1975.53, 2349.32].forEach((f) => mixInto(longer, bell(f, 0.9, 0.3), 0.12));
    return longer;
  },
  'girly/harp-gliss': () => {
    const out = buffer(1.6);
    PENTATONIC.forEach((f, i) => mixInto(out, pluck(f, 1.0, 100 + i), i * 0.055, 0.5));
    return out;
  },
  'girly/mouse-click-soft': () => {
    const out = buffer(0.08);
    mixInto(out, biquad(noise(0.012, 3, decayEnv(0.0003, 0.002)), 'bandpass', 3500, 1.5), 0);
    return mixInto(out, biquad(noise(0.012, 4, decayEnv(0.0003, 0.002)), 'bandpass', 2800, 1.5), 0.045, 0.7);
  },
  'paper/paper-cutout-place': () => {
    const out = tone({ seconds: 0.2, from: 140, to: 90, decay: 0.04 });
    return mixInto(out, biquad(noise(0.12, 11, decayEnv(0.002, 0.025)), 'bandpass', 2200, 0.7), 0, 0.9);
  },
  'paper/paper-slide': () => {
    const flutter = rng(12);
    let level = 0.6;
    return biquad(noise(0.32, 13, (t, d) => { level += flutter() * 0.08; level = Math.max(0.3, Math.min(1, level)); return bumpEnv(t, d) * level; }),
      'bandpass', (t) => 1400 + t * 6000, 0.6);
  },
  'paper/paper-flip': () => {
    const out = buffer(0.22);
    mixInto(out, biquad(noise(0.07, 21, bumpEnv), 'bandpass', 2600, 0.8), 0);
    return mixInto(out, biquad(noise(0.08, 22, bumpEnv), 'bandpass', 1900, 0.8), 0.09, 0.8);
  },
  'paper/sticker-peel': () => {
    const crackle = rng(31);
    const raw = noise(0.36, 32, (t, d) => (t / d) * Math.exp(-((t - d * 0.8) ** 2) / 0.01) * (crackle() > 0.6 ? 1 : 0.25));
    return biquad(raw, 'highpass', (t) => 1500 + t * 9000, 0.7);
  },
  'paper/stamp-thump': () => {
    const out = tone({ seconds: 0.3, from: 95, to: 60, decay: 0.07, harmonics: [[1, 1], [2, 0.3]] });
    return mixInto(out, biquad(noise(0.06, 41, decayEnv(0.001, 0.012)), 'lowpass', 1800), 0, 0.8);
  },
  'paper/scissors-snip': () => {
    const out = buffer(0.32);
    const snip = (seed) => mixInto(biquad(noise(0.05, seed, decayEnv(0.0005, 0.008)), 'bandpass', 5200, 2), tone({ seconds: 0.05, from: 3100, decay: 0.01 }), 0, 0.4);
    mixInto(out, snip(51), 0);
    return mixInto(out, snip(52), 0.16, 0.9);
  },
  'paper/pencil-scribble': () => {
    const wobble = rng(61);
    let gate = 0;
    return biquad(noise(0.7, 62, (t, d) => {
      if (Math.round(t * SR) % Math.round(SR / 14) === 0) gate = 0.4 + Math.abs(wobble()) * 0.6;
      return gate * bumpEnv(t, d) ** 0.3;
    }), 'bandpass', 3200, 1.1);
  },
  'paper/swish-soft': () => biquad(noise(0.38, 71, bumpEnv), 'lowpass', (t) => 600 + t * 5000, 0.8),
  'transitions/whoosh-short': () => biquad(noise(0.45, 81, (t, d) => bumpEnv(t, d) ** 1.5), 'bandpass', (t) => 300 * 10 ** (t / 0.45), 1.4),
  'fail-error/nope': () => {
    const out = buffer(0.5);
    const buzz = [[1, 1], [3, 0.35], [5, 0.2], [7, 0.1]];
    mixInto(out, biquad(tone({ seconds: 0.18, from: 420, decay: 0.5, harmonics: buzz }), 'lowpass', 2500), 0);
    return mixInto(out, biquad(tone({ seconds: 0.26, from: 300, decay: 0.5, harmonics: buzz }), 'lowpass', 2500), 0.2);
  },
  'tension/clock-ticking-a': () => {
    const out = buffer(2.1);
    for (let i = 0; i < 4; i += 1) {
      const click = biquad(noise(0.03, 90 + i, decayEnv(0.0003, 0.004)), 'bandpass', i % 2 ? 2400 : 3200, 3);
      mixInto(out, click, i * 0.5);
    }
    return out;
  },
};

export const SYNTH_SFX_NAMES = Object.keys(RECIPES);

/** Pur : echantillons (Float32, 48 kHz mono) d un bruitage du catalogue. */
export function synthesizeSfx(name) {
  const recipe = RECIPES[name];
  if (!recipe) throw new Error(`Bruitage inconnu : ${name}`);
  return normalize(recipe());
}

/** Pur : WAV PCM 16 bits mono. */
export function encodeWav(samples, sampleRate = SR) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
