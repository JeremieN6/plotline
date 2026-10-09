/**
 * Video faceless avec la VRAIE voix de l utilisateur (etape 2 du tuto) :
 * transcription avec le temps de chaque mot -> Claude repere les ratés (reprises,
 * hésitations) et les indications parlées ("change le fond") -> on coupe l audio
 * -> les mots restants alimentent le montage comme ceux d ElevenLabs.
 * Tout ce fichier est pur et teste ; les appels reseau / ffmpeg sont ailleurs.
 */

import { countSpokenTokens } from './facelessTimeline.js';

export const OWN_VOICE_MAX_BYTES = 25 * 1024 * 1024;
export const OWN_VOICE_MAX_WORDS = 700;

// Souffle laisse autour d un morceau d audio conserve (coupure sans claquement).
const PAD_SECONDS = 0.1;
// Une pause naturelle plus courte que ca, sans coupe entre les deux mots, est gardee telle quelle.
const NATURAL_GAP_SECONDS = 0.45;

/** Pur : mots du transcripteur -> [{ i, text, start, end }] (ni espaces ni bruitages). */
export function tokenizeTranscript(rawWords) {
  const words = [];
  for (const raw of Array.isArray(rawWords) ? rawWords : []) {
    if (raw?.type && raw.type !== 'word') continue;
    const text = String(raw?.text ?? '').replace(/\s+/g, ' ').trim();
    const start = Number(raw?.start);
    const end = Number(raw?.end);
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    // Un "mot" contenant une espace casserait le decompte des mots par scene.
    for (const part of text.split(' ')) {
      words.push({ i: words.length, text: part, start, end });
    }
  }
  return words;
}

/** Pur : le transcript numerote tel que Claude le lit ("[12] bonjour"). */
export function numberedTranscript(words) {
  return words.map((w) => `[${w.i}] ${w.text}`).join(' ');
}

/** Pur : texte brut d une liste de mots. */
export function wordsToText(words) {
  return words.map((w) => w.text).join(' ');
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * Pur : reponse de Claude -> { cuts: [{from, to, reason}], directives: [{at, instruction}] },
 * bornee au nombre de mots, plages triees et fusionnees. Tout ce qui est invalide est ignore.
 */
export function normalizeCleaning(raw, wordCount) {
  const last = wordCount - 1;
  const cuts = (Array.isArray(raw?.cuts) ? raw.cuts : [])
    .map((cut) => ({
      from: Math.floor(Number(cut?.from)),
      to: Math.floor(Number(cut?.to)),
      reason: String(cut?.reason || '').slice(0, 80),
    }))
    .filter((cut) => Number.isFinite(cut.from) && Number.isFinite(cut.to) && cut.to >= cut.from && cut.to >= 0 && cut.from <= last)
    .map((cut) => ({ ...cut, from: clamp(cut.from, 0, last), to: clamp(cut.to, 0, last) }))
    .sort((a, b) => a.from - b.from);

  const merged = [];
  for (const cut of cuts) {
    const previous = merged[merged.length - 1];
    if (previous && cut.from <= previous.to + 1) previous.to = Math.max(previous.to, cut.to);
    else merged.push({ ...cut });
  }

  const directives = (Array.isArray(raw?.directives) ? raw.directives : [])
    .map((d) => ({ at: Math.floor(Number(d?.at)), instruction: String(d?.instruction || '').replace(/\s+/g, ' ').trim().slice(0, 200) }))
    .filter((d) => Number.isFinite(d.at) && d.at >= 0 && d.at <= last && d.instruction)
    .slice(0, 12);

  return { cuts: merged, directives };
}

/** Pur : indices des mots conserves. */
export function keptIndices(wordCount, cuts) {
  const removed = new Set();
  for (const cut of cuts) for (let i = cut.from; i <= cut.to; i += 1) removed.add(i);
  return Array.from({ length: wordCount }, (_, i) => i).filter((i) => !removed.has(i));
}

/**
 * Pur : morceaux d audio a conserver et nouveaux temps des mots.
 * Deux mots conserves consecutifs dans la source (aucune coupe entre eux) et
 * separes par une pause naturelle restent dans le meme morceau ; sinon on coupe,
 * en laissant PAD_SECONDS de souffle de chaque cote (la pause entre deux morceaux
 * vaut donc ~0,2 s, au lieu du trou ou de la reprise d origine).
 * @returns {{ segments: Array<{start:number,end:number}>, words: Array<{text:string,start:number,end:number}> }}
 */
export function buildKeepSegments(words, kept, { duration = Infinity } = {}) {
  if (!kept.length) return { segments: [], words: [] };

  const groups = [];
  let group = [kept[0]];
  for (let k = 1; k < kept.length; k += 1) {
    const prev = words[kept[k - 1]];
    const next = words[kept[k]];
    const adjacent = kept[k] === kept[k - 1] + 1;
    if (adjacent && next.start - prev.end <= NATURAL_GAP_SECONDS) group.push(kept[k]);
    else { groups.push(group); group = [kept[k]]; }
  }
  groups.push(group);

  const segments = groups.map((indices, g) => {
    const first = words[indices[0]];
    const lastWord = words[indices[indices.length - 1]];
    const before = g === 0 ? first.start : first.start - words[groups[g - 1][groups[g - 1].length - 1]].end;
    const after = g === groups.length - 1 ? Infinity : words[groups[g + 1][0]].start - lastWord.end;
    // Jamais plus que la moitie du trou a cote, pour ne pas reprendre un bout du mot voisin (ou d un raté).
    const start = Math.max(0, first.start - Math.min(PAD_SECONDS, before / 2));
    const end = Math.min(duration, lastWord.end + Math.min(PAD_SECONDS, after / 2));
    return { start, end, indices };
  });

  const outWords = [];
  let cursor = 0;
  for (const segment of segments) {
    for (const index of segment.indices) {
      const w = words[index];
      outWords.push({ text: w.text, start: Number((cursor + w.start - segment.start).toFixed(3)), end: Number((cursor + w.end - segment.start).toFixed(3)) });
    }
    cursor += segment.end - segment.start;
  }

  return { segments: segments.map(({ start, end }) => ({ start, end })), words: outWords };
}

/**
 * Pur : filtre ffmpeg qui assemble les morceaux (fondu de 12 ms a chaque jonction),
 * puis ramene le volume a un niveau de diffusion.
 */
export function buildCutFilter(segments) {
  if (!segments.length) throw new Error('Aucun morceau d audio a conserver');
  const parts = segments.map((s, i) => {
    const length = Math.max(0.02, s.end - s.start);
    const fade = Math.min(0.012, length / 4);
    return `[0:a]atrim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},asetpts=PTS-STARTPTS,`
      + `afade=t=in:d=${fade.toFixed(3)},afade=t=out:st=${Math.max(0, length - fade).toFixed(3)}:d=${fade.toFixed(3)}[s${i}]`;
  });
  const inputs = segments.map((_, i) => `[s${i}]`).join('');
  parts.push(`${inputs}concat=n=${segments.length}:v=0:a=1,highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11[out]`);
  return parts.join(';');
}

const SENTENCE_END = /[.!?…]["»”)]*$/;
const MAX_SCENE_WORDS = 24;
const MIN_PAUSE_SPLIT_WORDS = 7;
const PAUSE_SPLIT_SECONDS = 0.55;

/**
 * Pur : decoupe les mots conserves en scenes (une scene = une phrase). On coupe
 * a la ponctuation de fin de phrase, a une vraie pause entre deux mots, ou a
 * MAX_SCENE_WORDS mots. Une scene finale trop courte est rattachee a la precedente.
 * @returns {Array<{ from: number, to: number, say: string }>} indices dans `words`
 */
export function splitIntoScenes(words) {
  const scenes = [];
  let from = 0;
  for (let i = 0; i < words.length; i += 1) {
    const count = i - from + 1;
    const pauseAfter = i + 1 < words.length ? words[i + 1].start - words[i].end : Infinity;
    const endOfSentence = SENTENCE_END.test(words[i].text) && count >= 3;
    const longPause = count >= MIN_PAUSE_SPLIT_WORDS && pauseAfter >= PAUSE_SPLIT_SECONDS;
    if (i === words.length - 1 || endOfSentence || longPause || count >= MAX_SCENE_WORDS) {
      scenes.push({ from, to: i });
      from = i + 1;
    }
  }
  if (scenes.length > 1 && scenes[scenes.length - 1].to - scenes[scenes.length - 1].from + 1 < 3) {
    const tail = scenes.pop();
    scenes[scenes.length - 1].to = tail.to;
  }
  return scenes.map((s) => ({ ...s, say: wordsToText(words.slice(s.from, s.to + 1)) }));
}

/** Pur : verifie que les scenes du plan reprennent exactement les mots dits (decompte). */
export function sceneWordCountMatches(plan, words) {
  return (plan?.scenes || []).reduce((sum, s) => sum + countSpokenTokens(s.say), 0) === words.length;
}

/** Pur : une indication parlee ramenee dans les mots CONSERVES (indice du mot suivant garde). */
export function remapDirectives(directives, kept) {
  return directives.map((d) => {
    const position = kept.findIndex((index) => index >= d.at);
    return { instruction: d.instruction, atWord: position === -1 ? Math.max(0, kept.length - 1) : position };
  });
}

// --- Prompts -----------------------------------------------------------------

export function buildCleaningSystemPrompt() {
  return [
    'Tu es monteur audio. On te donne la transcription numerotee d un enregistrement brut ou le createur parle, se reprend, hesite et donne parfois des indications de montage a voix haute.',
    'Ton travail : dire quels mots SUPPRIMER pour obtenir la meilleure prise unique, et relever les indications de montage parlees.',
    '',
    'A SUPPRIMER (cuts) :',
    '- Les reprises : quand le createur recommence une phrase, supprime la ou les tentatives rate(e)s et GARDE la derniere prise, la plus complete.',
    '- Les phrases abandonnees, faux departs, mots begayes, repetitions involontaires.',
    '- Les hesitations ("euh", "hum", "bah" qui ne servent a rien) et les commentaires adresses a toi-meme ("attends", "on recommence", "ok c est bon").',
    '- Les indications de montage dites a voix haute (voir plus bas) : ce sont des consignes, pas du texte de la video.',
    'NE SUPPRIME PAS une phrase correcte juste parce qu elle est maladroite, ni une repetition voulue (effet de style, enumeration).',
    '',
    'INDICATIONS DE MONTAGE (directives) : quand le createur dit quelque chose comme "la, change le fond", "mets un fond sombre", "ici je suis surpris", "affiche le logo de ...", releve l instruction reformulee a l imperatif, ancree sur l indice du mot ou elle commence (at). Le passage dit correspondant doit aussi etre dans cuts.',
    '',
    'Reponds uniquement avec un objet JSON brut : {"cuts":[{"from":<indice>,"to":<indice>,"reason":"<court>"}],"directives":[{"at":<indice>,"instruction":"<consigne>"}]}',
    'Les indices sont ceux de la transcription ([12] = indice 12), plages inclusives. Aucune coupe si l enregistrement est deja propre.',
  ].join('\n');
}

export function buildCleaningUserPrompt(words, context = '') {
  return [
    context ? `Sujet de la video (pour t aider a juger ce qui est le propos) : ${String(context).slice(0, 500)}` : '',
    'Transcription :',
    numberedTranscript(words),
  ].filter(Boolean).join('\n\n');
}
