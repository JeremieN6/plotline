/**
 * Transcription ElevenLabs Scribe : le texte ET le temps de chaque mot d un
 * enregistrement (meme cle que la synthese). Sert au mode "ma voix" du faceless.
 */

import { resolveElevenLabsApiKey } from './elevenLabsTts.js';

const API_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
export const SCRIBE_MODEL = 'scribe_v1';

/** Pur : champs du formulaire envoye a Scribe. */
export function buildScribeFields({ languageCode = 'fra' } = {}) {
  return {
    model_id: SCRIBE_MODEL,
    language_code: languageCode,
    timestamps_granularity: 'word',
    tag_audio_events: 'false',
    diarize: 'false',
  };
}

/**
 * Transcrit un enregistrement. Renvoie les mots bruts de Scribe
 * ([{ text, start, end, type }]) ; `fetchImpl` est injectable (tests).
 */
export async function transcribeWithScribe({ audio, filename = 'voix.mp3', contentType = 'audio/mpeg', languageCode, apiKey, fetchImpl = fetch } = {}) {
  const key = String(apiKey || resolveElevenLabsApiKey()).trim();
  if (!key) throw new Error('ELEVEN_LABS_API_KEY non configuree');
  if (!audio?.length) throw new Error('Enregistrement vide');

  const form = new FormData();
  for (const [name, value] of Object.entries(buildScribeFields({ languageCode }))) form.append(name, value);
  form.append('file', new Blob([audio], { type: contentType }), filename);

  const response = await fetchImpl(API_URL, { method: 'POST', headers: { 'xi-api-key': key }, body: form });
  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = data?.detail?.message || data?.detail?.status || JSON.stringify(data?.detail || data).slice(0, 200);
    } catch {
      detail = response.statusText;
    }
    throw new Error(`ElevenLabs a refuse la transcription (${response.status}) : ${detail}`);
  }

  const data = await response.json();
  if (!Array.isArray(data?.words)) throw new Error('Transcription sans mots');
  return { words: data.words, languageCode: data.language_code || '', text: String(data.text || '') };
}
