/**
 * Voix de synthese ElevenLabs avec le temps de chaque caractere
 * (endpoint `with-timestamps`) : c est ce qui permet de caler le montage
 * faceless sur la voix sans etape de transcription.
 */

const API_BASE = 'https://api.elevenlabs.io/v1';
export const ELEVENLABS_DEFAULT_MODEL = 'eleven_multilingual_v2';
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128';
/** Modele expressif : comprend les balises de ton ([excited]...), voix clonee comprise. */
export const ELEVENLABS_V3_MODEL = 'eleven_v3';
/** v3 n accepte que trois valeurs de stabilite : 0 (creatif), 0,5 (naturel), 1 (sobre). */
export const V3_STABILITY = { creative: 0, natural: 0.5, robust: 1 };

export function resolveElevenLabsApiKey() {
  return String(process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY || '').trim();
}

/** Pur : corps de la requete de synthese. */
export function buildElevenLabsBody({ text, modelId = ELEVENLABS_DEFAULT_MODEL, voiceSettings, stability } = {}) {
  if (modelId === ELEVENLABS_V3_MODEL) {
    const wanted = Number(stability);
    return {
      text: String(text || '').trim(),
      model_id: modelId,
      language_code: 'fr',
      voice_settings: { stability: Object.values(V3_STABILITY).includes(wanted) ? wanted : V3_STABILITY.natural },
    };
  }
  return {
    text: String(text || '').trim(),
    model_id: modelId,
    voice_settings: {
      stability: 0.45,
      similarity_boost: 0.8,
      style: 0.35,
      use_speaker_boost: true,
      ...(voiceSettings || {}),
    },
  };
}

/**
 * Pur : alignement caractere par caractere -> mots (decoupe sur les espaces),
 * chaque mot garde sa ponctuation. Debut = 1er caractere, fin = dernier.
 */
export function alignmentToWords(alignment) {
  const chars = alignment?.characters || [];
  const starts = alignment?.character_start_times_seconds || [];
  const ends = alignment?.character_end_times_seconds || [];
  const words = [];
  let current = null;

  // Les balises de ton ([excited]...) sont dans l alignement mais ne sont pas des mots dits.
  let inTag = false;
  chars.forEach((char, i) => {
    if (char === '[') {
      if (current) words.push(current);
      current = null;
      inTag = true;
      return;
    }
    if (inTag) {
      if (char === ']') inTag = false;
      return;
    }
    if (/\s/.test(char)) {
      if (current) words.push(current);
      current = null;
      return;
    }
    if (!current) current = { text: '', start: Number(starts[i]) || 0, end: Number(ends[i]) || 0 };
    current.text += char;
    current.end = Number(ends[i]) || current.end;
  });
  if (current) words.push(current);

  return words;
}

/**
 * Synthese + temps des mots. Renvoie { audio: Buffer (mp3), words }.
 * `fetchImpl` est injectable (tests).
 */
export async function synthesizeWithTimestamps({ text, voiceId, modelId, stability, apiKey, fetchImpl = fetch } = {}) {
  const key = String(apiKey || resolveElevenLabsApiKey()).trim();
  if (!key) throw new Error('ELEVEN_LABS_API_KEY non configuree');
  if (!String(voiceId || '').trim()) throw new Error('Voix ElevenLabs manquante');

  const url = `${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${ELEVENLABS_OUTPUT_FORMAT}`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(buildElevenLabsBody({ text, modelId, stability })),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = data?.detail?.message || data?.detail?.status || JSON.stringify(data?.detail || data).slice(0, 200);
    } catch {
      detail = response.statusText;
    }
    throw new Error(`ElevenLabs a refuse la synthese (${response.status}) : ${detail}`);
  }

  const data = await response.json();
  const audio = Buffer.from(String(data?.audio_base64 || ''), 'base64');
  if (!audio.length) throw new Error('ElevenLabs a repondu sans audio');

  return { audio, words: alignmentToWords(data?.alignment || data?.normalized_alignment) };
}

/**
 * Voix CLONEES du compte ElevenLabs (celles que le proprietaire a enregistrees) : [{ id, name }].
 * Mise en cache courte (la liste change rarement). Ne leve jamais : liste vide si l appel echoue.
 */
let cloneVoicesCache = { at: 0, voices: [] };
export async function listCloneVoices({ apiKey, fetchImpl = fetch, now = Date.now() } = {}) {
  if (now - cloneVoicesCache.at < 5 * 60 * 1000 && cloneVoicesCache.voices.length) return cloneVoicesCache.voices;
  const key = String(apiKey || resolveElevenLabsApiKey()).trim();
  if (!key) return [];
  try {
    const response = await fetchImpl(`${API_BASE}/voices`, { headers: { 'xi-api-key': key } });
    if (!response.ok) return [];
    const data = await response.json();
    const voices = (Array.isArray(data?.voices) ? data.voices : [])
      .filter((voice) => voice?.category === 'cloned' && voice?.voice_id)
      .map((voice) => ({ id: String(voice.voice_id), name: String(voice.name || 'Ma voix') }));
    cloneVoicesCache = { at: now, voices };
    return voices;
  } catch {
    return [];
  }
}
