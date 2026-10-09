/**
 * Video faceless : du plan de montage (scenes + texte dit) a une timeline
 * absolue, calee sur la voix. Tout est pur et teste.
 *
 * Une scene = une phrase dite. Le visuel change au debut de la phrase
 * (regle du tuto : "toujours commencer quand la phrase commence"), et les
 * reperes internes (apparition d un element de liste, changement d expression,
 * bruitage) peuvent etre donnes en secondes ou par un MOT de la phrase.
 */

export const FACELESS_DEFAULTS = {
  width: 1080,
  height: 1920,
  fps: 30,
  // Silence avant la premiere phrase, entre deux phrases, apres la derniere.
  leadIn: 0.3,
  gap: 0.12,
  tail: 0.9,
  // Le visuel arrive un poil avant la voix.
  visualLead: 0.06,
  maxCaptionWords: 3,
};

/** Pur : mot normalise pour la comparaison (minuscules, sans accents ni ponctuation). */
export function normalizeWord(word) {
  return String(word || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Elision : "l'affiliation" se repere par "affiliation".
    .replace(/^(?:qu|[cdjlmnst])['’]/, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Pur : temps (relatif au debut de la phrase) d un repere. Nombre = secondes ;
 * texte = premier mot correspondant (plusieurs mots : la sequence) ; inconnu = 0.
 */
export function resolveCue(cue, words = []) {
  if (typeof cue === 'number' && Number.isFinite(cue)) return Math.max(0, cue);
  const wanted = String(cue ?? '').split(/\s+/).map(normalizeWord).filter(Boolean);
  if (!wanted.length) return 0;

  const spoken = words.map((w) => normalizeWord(w.text));
  for (let i = 0; i + wanted.length <= spoken.length; i += 1) {
    if (wanted.every((w, k) => spoken[i + k] === w)) return words[i].start;
  }
  return 0;
}

/** Pur : ajoute une fin a chaque mot (debut du mot suivant, ou fin du clip). */
export function withWordEnds(words = [], clipDuration) {
  return words.map((w, i) => ({
    text: String(w.text),
    start: Number(w.start),
    end: i + 1 < words.length ? Number(words[i + 1].start) : Number(clipDuration),
  }));
}

/**
 * Pur : decoupe les mots en sous-titres courts (au plus `maxWords`), avec une
 * coupure forcee apres une ponctuation forte du texte d origine.
 */
export function buildCaptionChunks(words, { maxWords = FACELESS_DEFAULTS.maxCaptionWords, end } = {}) {
  const chunks = [];
  let current = [];

  const flush = () => {
    if (!current.length) return;
    chunks.push({ start: current[0].start, words: current });
    current = [];
  };

  for (const word of words) {
    current.push(word);
    if (current.length >= maxWords || /[.!?,:;…]$/.test(word.text)) flush();
  }
  flush();

  return chunks.map((chunk, i) => ({
    ...chunk,
    end: i + 1 < chunks.length ? chunks[i + 1].start : (end ?? chunk.words[chunk.words.length - 1].end),
  }));
}

function resolveList(list, words) {
  return (Array.isArray(list) ? list : []).map((item) => ({ ...item, at: resolveCue(item?.at, words) }));
}

/** Pur : nombre de mots (separes par des espaces) d un texte dit. */
export function countSpokenTokens(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

/**
 * Pur : repartit les mots d une piste unique entre les scenes. La piste a ete
 * produite a partir des `say` joints par un espace, donc chaque scene possede
 * exactement autant de mots que son texte.
 */
export function assignWordsToScenes(scenes, words) {
  const expected = scenes.reduce((sum, scene) => sum + countSpokenTokens(scene.say), 0);
  if (expected !== words.length) throw new Error(`${words.length} mots dans la voix pour ${expected} attendus`);

  let cursor = 0;
  return scenes.map((scene) => {
    const count = countSpokenTokens(scene.say);
    const slice = words.slice(cursor, cursor + count);
    cursor += count;
    return slice;
  });
}

// Coeur commun : `segments[i]` = { voiceStart, voiceEnd, words (temps absolus) }.
function placeScenes(spec, segments, voice, opts) {
  const scenes = spec.scenes;

  const placed = scenes.map((scene, i) => {
    const { voiceStart, voiceEnd, words: absolute } = segments[i];
    // Reperes relatifs a la voix de la scene ; recales sur le debut visuel dans finishTimeline.
    const words = absolute.map((w) => ({ ...w, start: w.start - voiceStart, end: w.end - voiceStart }));
    return {
      ...scene,
      voiceStart,
      voiceEnd,
      words: absolute,
      items: resolveList(scene.items, words),
      beats: resolveList(scene.avatar?.beats, words),
      sfx: resolveList(scene.sfx, words),
    };
  });

  return finishTimeline(spec, placed, voice, opts);
}

function assertScenes(spec) {
  const scenes = Array.isArray(spec?.scenes) ? spec.scenes : [];
  if (!scenes.length) throw new Error('Aucune scene dans le plan de montage');
  return scenes;
}

/**
 * Pur : une piste de voix UNIQUE pour tout le script (ElevenLabs : intonation
 * continue). `track` = { path, duration, words: [{ text, start, end }] }.
 */
export function layoutFacelessTimelineFromTrack(spec, track, options = {}) {
  const opts = { ...FACELESS_DEFAULTS, ...spec, ...options };
  const scenes = assertScenes(spec);
  const perScene = assignWordsToScenes(scenes, track.words);

  const shifted = perScene.map((list) => list.map((w) => ({ text: w.text, start: w.start + opts.leadIn, end: w.end + opts.leadIn })));
  const segments = shifted.map((list, i) => {
    if (!list.length) throw new Error(`La scene ${i + 1} n a aucun mot dit`);
    return { voiceStart: list[0].start, voiceEnd: list[list.length - 1].end, words: list };
  });

  return placeScenes(spec, segments, [{ path: track.path, start: opts.leadIn }], opts);
}

/**
 * Pur : place chaque scene sur la ligne de temps a partir des clips de voix.
 * `clips[i]` = { path, duration, words: [{ text, start }] } pour `spec.scenes[i]`.
 */
export function layoutFacelessTimeline(spec, clips, options = {}) {
  const opts = { ...FACELESS_DEFAULTS, ...spec, ...options };
  const scenes = assertScenes(spec);
  if (clips.length !== scenes.length) throw new Error(`${scenes.length} scenes pour ${clips.length} clips de voix`);

  const voice = [];
  const segments = [];
  let cursor = opts.leadIn;

  clips.forEach((clip) => {
    const words = withWordEnds(clip.words, clip.duration).map((w) => ({ ...w, start: w.start + cursor, end: w.end + cursor }));
    voice.push({ path: clip.path, start: cursor });
    segments.push({ voiceStart: cursor, voiceEnd: cursor + clip.duration, words });
    cursor += clip.duration + opts.gap;
  });

  return placeScenes(spec, segments, voice, opts);
}

function finishTimeline(spec, placed, voice, opts) {
  const duration = placed[placed.length - 1].voiceEnd + opts.tail;

  placed.forEach((scene, i) => {
    scene.start = i === 0 ? 0 : Math.max(0, scene.voiceStart - opts.visualLead);
    scene.end = i + 1 < placed.length ? Math.max(0, placed[i + 1].voiceStart - opts.visualLead) : duration;
    // Repere voix -> repere scene. Un repere a 0 reste au debut visuel de la scene.
    const offset = scene.voiceStart - scene.start;
    scene.items = scene.items.map((it) => ({ ...it, at: it.at + offset }));
    scene.beats = scene.beats.map((b) => ({ ...b, at: b.at > 0 ? b.at + offset : 0 }));
    scene.sfx = scene.sfx.map((s) => ({ ...s, at: s.at > 0 ? s.at + offset : 0 }));
    scene.captionChunks = scene.captions
      ? buildCaptionChunks(scene.words, { maxWords: opts.maxCaptionWords, end: scene.end })
      : [];
  });

  const sfx = placed.flatMap((scene) => scene.sfx.map((s) => ({
    name: s.name,
    start: Number((scene.start + s.at).toFixed(3)),
    gain: s.gain ?? 0.5,
  })));

  return {
    width: opts.width,
    height: opts.height,
    fps: opts.fps,
    theme: spec.theme || 'papercraft-pastel',
    duration: Number(duration.toFixed(3)),
    voice,
    sfx,
    scenes: placed,
  };
}
