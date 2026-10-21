/**
 * Bruitages de la video faceless : palette par DA, regles d espacement et baisse de la voix sous un son.
 * Tout est pur : Claude propose des sons (nom + moment), le code decide de ce qui est reellement joue.
 */

import {
  FACELESS_SFX_BY_PRESET, FACELESS_SFX_BY_TEMPLATE, FACELESS_SFX_LEGACY, FACELESS_SFX_PALETTES, FACELESS_SFX_ROLES,
} from '../data/facelessSfxPalettes.js';

/** Pur : cle de la palette d une DA ('tech', 'impact', 'paper', 'soft', 'playful') ou 'full' (DA personnalisee : les 22 sons d origine). */
export function sfxPaletteKey(style) {
  const byTemplate = FACELESS_SFX_BY_TEMPLATE[style?.template];
  if (byTemplate) return byTemplate;
  return FACELESS_SFX_BY_PRESET[style?.preset] || 'full';
}

/** Pur : noms des sons proposes par une palette. */
export function sfxPaletteNames(key) {
  const palette = FACELESS_SFX_PALETTES[key];
  if (!palette) return FACELESS_SFX_LEGACY;
  return [...new Set(Object.values(palette.byRole).filter(Boolean))];
}

/** Pur : le son joue pour `name` dans cette palette (lui-meme s il en fait partie, sinon l equivalent de meme role) ; null = pas de son. */
export function adaptSfxName(name, key) {
  const palette = FACELESS_SFX_PALETTES[key];
  if (!palette) return name;
  if (sfxPaletteNames(key).includes(name)) return name;
  const role = FACELESS_SFX_ROLES[name];
  return (role && palette.byRole[role]) || null;
}

/**
 * Pur : applique les regles d espacement aux bruitages d une timeline.
 * `sfx` : [{ name, start, gain, scene, cued, engine?, role?, weight? }] : les sons proposes par Claude (cales sur
 * un mot) ET ceux du moteur (`engine: true`, voir facelessSfxEvents.js : poses sur une animation de l ecran) ;
 * `scenes` : scenes placees (start, end, voiceStart, words).
 *  - le son est remplace par celui de la palette de la DA (ou supprime) ;
 *  - aucun son dans une scene de moins de `minScene` secondes (1,5 s pour un son du moteur) ;
 *  - un son de Claude ne demarre jamais avant la fin du premier mot de la scene (un son du moteur est cale sur
 *    l animation, la voix baisse dessous) ;
 *  - au moins `minGap` secondes entre deux sons ; le plus important (poids) reste : un son de sens cale sur un mot
 *    (1,3) passe avant un tampon (1,5 : le plus fort) ou une rangee de liste (1), puis le plus tot ;
 *  - jamais deux fois le meme son de suite (sauf les rangees d une meme liste) ;
 *  - chaque son est coupe (`maxDur`) avant le son suivant et avant la scene suivante.
 */
export function finalizeSfx(sfx, scenes, { paletteKey = 'full', minGap = 1.8, minScene = 2, minSceneEngine = 1.5 } = {}) {
  const sceneAt = (entry) => scenes[entry.scene] || scenes.find((s) => entry.start >= s.start && entry.start < s.end);
  const candidates = [];
  for (const entry of sfx || []) {
    const name = adaptSfxName(entry.name, paletteKey);
    const scene = sceneAt(entry);
    if (!name || !scene) continue;
    if (scene.end - scene.start < (entry.engine ? minSceneEngine : minScene)) continue;
    const firstWord = scene.words?.[0];
    if (!entry.engine && firstWord && entry.start < firstWord.end) continue;
    candidates.push({ ...entry, name, sceneEnd: scene.end, weight: entry.weight ?? (entry.cued ? 1.3 : 1) });
  }

  // Priorite au poids, puis au plus tot ; on garde ceux qui respectent l ecart.
  const kept = [];
  for (const entry of [...candidates].sort((a, b) => (b.weight - a.weight) || a.start - b.start)) {
    if (kept.every((other) => Math.abs(other.start - entry.start) >= minGap)) kept.push(entry);
  }
  kept.sort((a, b) => a.start - b.start);

  const out = [];
  for (const entry of kept) {
    const previous = out[out.length - 1];
    const sameList = previous && previous.role === 'item' && entry.role === 'item' && previous.scene === entry.scene;
    if (previous && previous.name === entry.name && !sameList) continue;
    out.push(entry);
  }
  return out.map((entry, i) => {
    const next = out[i + 1];
    const limit = Math.min(entry.sceneEnd + 0.15 - entry.start, next ? next.start - entry.start - 0.05 : Infinity);
    return { name: entry.name, start: entry.start, gain: entry.gain, maxDur: Number(Math.max(0.1, limit).toFixed(3)) };
  });
}

/**
 * Pur : courbe de gain de la voix (une valeur par image audio) : elle descend a `1 - depth` sous chaque son
 * (`ranges` = [{ from, to }] en images), avec une attaque et un relachement doux pour ne jamais claquer.
 */
export function buildDuckEnvelope(frames, ranges, { rate = 48000, depth = 0.45, attack = 0.025, release = 0.18 } = {}) {
  const target = new Float32Array(frames).fill(1);
  for (const { from, to } of ranges) {
    for (let i = Math.max(0, from); i < Math.min(frames, to); i += 1) target[i] = 1 - depth;
  }
  const up = 1 - Math.exp(-1 / (release * rate));
  const down = 1 - Math.exp(-1 / (attack * rate));
  const env = new Float32Array(frames);
  let value = 1;
  for (let i = 0; i < frames; i += 1) {
    value += (target[i] - value) * (target[i] < value ? down : up);
    env[i] = value;
  }
  return env;
}
