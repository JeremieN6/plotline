import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { list, put } from '@vercel/blob';

import { isBlobStorageEnabled } from './blobStorage.js';
import { ensureStorageDir } from './mediaStorage.js';

/**
 * Cache des transcriptions du mode "ma voix" : la transcription (ElevenLabs Scribe) CONSOMME le quota,
 * alors qu on reimporte souvent le meme enregistrement (apres une correction, pour un autre montage...).
 * Cle = empreinte du FICHIER audio + compte + langue : reimporter le meme fichier ne coute plus rien.
 * Stockage sans table (aucune migration) : un petit JSON par enregistrement, Blob en production, disque en repli.
 * Tout est best effort : une lecture ou une ecriture qui echoue ne bloque JAMAIS la video (on transcrit alors normalement).
 */

export const TRANSCRIPT_CACHE_FOLDER = 'faceless-transcripts';
const FORMAT = 1;

/** Pur : empreinte du fichier audio. */
export function hashAudio(audio) {
  return createHash('sha256').update(audio).digest('hex');
}

const safe = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');

/** Pur : chemin du cache (sans extension de dossier de stockage). Vide si la cle n est pas exploitable. */
export function transcriptCachePath({ userId, hash, languageCode = '' } = {}) {
  const user = safe(userId);
  const digest = safe(hash);
  if (!user || digest.length < 32) return '';
  const lang = safe(languageCode);
  return `${TRANSCRIPT_CACHE_FOLDER}/${user}/${digest}${lang ? `-${lang}` : ''}.json`;
}

/** Pur : la transcription lue dans le cache est-elle exploitable (meme forme que celle de Scribe) ? */
export function isUsableTranscript(data) {
  return data?.format === FORMAT
    && Array.isArray(data?.transcript?.words)
    && data.transcript.words.length > 0
    && data.transcript.words.every((w) => w && typeof w.text === 'string' && Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end)));
}

async function readStored(pathname) {
  if (isBlobStorageEnabled()) {
    const found = await list({ prefix: pathname, limit: 5 });
    const blob = (found?.blobs || []).find((item) => item.pathname === pathname);
    if (!blob) return null;
    const response = await fetch(blob.url);
    return response.ok ? response.json() : null;
  }
  const [folder, user, file] = pathname.split('/');
  try {
    return JSON.parse(await readFile(join(ensureStorageDir(folder, user), file), 'utf8'));
  } catch {
    return null;
  }
}

async function writeStored(pathname, data) {
  const body = JSON.stringify(data);
  if (isBlobStorageEnabled()) {
    await put(pathname, body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
    return;
  }
  const [folder, user, file] = pathname.split('/');
  await writeFile(join(ensureStorageDir(folder, user), file), body, 'utf8');
}

/** Cache par defaut (Blob / disque) ; remplacable dans les tests. */
export const defaultTranscriptCache = { read: readStored, write: writeStored };

/**
 * Transcription avec cache. `transcribe()` n est appelee QUE si l enregistrement n a jamais ete transcrit pour ce compte.
 * Sans `userId` (ou sans cle exploitable) : pas de cache, comportement d avant.
 * @returns {Promise<{ transcript: object, cached: boolean }>}
 */
export async function transcribeWithCache({ userId, audio, languageCode = '', transcribe, cache = defaultTranscriptCache } = {}) {
  const pathname = transcriptCachePath({ userId, hash: audio?.length ? hashAudio(audio) : '', languageCode });
  if (!pathname) return { transcript: await transcribe(), cached: false };

  try {
    const stored = await cache.read(pathname);
    if (isUsableTranscript(stored)) return { transcript: stored.transcript, cached: true };
  } catch (error) {
    console.warn(`[faceless-voice] lecture du cache de transcription impossible : ${error?.message || error}`);
  }

  const transcript = await transcribe();
  try {
    await cache.write(pathname, { format: FORMAT, createdAt: new Date().toISOString(), transcript });
  } catch (error) {
    console.warn(`[faceless-voice] ecriture du cache de transcription impossible : ${error?.message || error}`);
  }
  return { transcript, cached: false };
}
