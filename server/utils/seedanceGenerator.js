import fs from 'node:fs/promises';
import path from 'node:path';

import { DEFAULT_ASPECT_RATIO } from './aspectRatio.js';
import { isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { getGeneratedDir, toMediaUrl } from './mediaStorage.js';

const DEFAULT_API_BASE = 'https://api.seevio.ai';
const GENERATION_PATH = '/v1/videos/generations';
const TASK_PATH = '/v1/tasks';
const DEFAULT_MODEL = 'seedance-2-5';
const DEFAULT_DURATION_SECONDS = 8;
// Seedance 2.5 refuse la requete en 400 au-dela: seuls 480p et 720p existent.
const SUPPORTED_RESOLUTIONS = ['480p', '720p'];
const DEFAULT_RESOLUTION = '720p';
const POLL_INTERVAL_MS = 10_000;
const POLL_MAX_ATTEMPTS = 90;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * SEEDANCE_API_URL a historiquement contenu une URL d endpoint complete. On n en
 * garde que l origine pour reconstruire nous-memes les chemins /v1/..., sinon on
 * obtiendrait des URLs du type ".../v1/videos/v1/videos/generations".
 */
export function resolveSeedanceApiBase(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return DEFAULT_API_BASE;

  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return DEFAULT_API_BASE;
  }
}

/** L API distingue les deux modes; la presence d une image de depart tranche. */
export function resolveGenerationType(imageUrls) {
  return Array.isArray(imageUrls) && imageUrls.length ? 'image-to-video' : 'text-to-video';
}

/**
 * En image-to-video, Seedance 2.5 n accepte que `adaptive` et refuse la requete
 * en 400 sur toute autre valeur: le cadrage est repris de l image de depart.
 * Ce n est pas une entorse a la regle "le prompt decide du format" — l image de
 * depart est elle-meme generee au format demande par le prompt.
 */
export function resolveSeedanceAspectRatio(generationType, aspectRatio) {
  return generationType === 'image-to-video' ? 'adaptive' : aspectRatio;
}

/** Toute valeur hors 480p/720p fait echouer la requete en 400. */
export function resolveSeedanceResolution(resolution) {
  const normalized = String(resolution || '').trim().toLowerCase();
  return SUPPORTED_RESOLUTIONS.includes(normalized) ? normalized : DEFAULT_RESOLUTION;
}

export function buildSeedanceRequestBody({
  prompt,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  imageUrls = [],
  model = DEFAULT_MODEL,
  duration = DEFAULT_DURATION_SECONDS,
  resolution = DEFAULT_RESOLUTION,
}) {
  const generationType = resolveGenerationType(imageUrls);

  return {
    model,
    input: {
      prompt: String(prompt || '').trim(),
      generation_type: generationType,
      duration,
      aspect_ratio: resolveSeedanceAspectRatio(generationType, aspectRatio),
      resolution: resolveSeedanceResolution(resolution),
      ...(generationType === 'image-to-video' ? { image_urls: imageUrls } : {}),
    },
  };
}

/** Le taskId ne se trouve pas au meme endroit selon les reponses observees. */
export function extractSeedanceTaskId(payload) {
  return String(
    payload?.taskId
    || payload?.task_id
    || payload?.id
    || payload?.data?.taskId
    || payload?.data?.task_id
    || payload?.data?.id
    || ''
  ).trim();
}

export function extractSeedanceVideoUrl(payload) {
  const data = payload?.data || payload || {};
  const firstResult = Array.isArray(data?.results) ? data.results[0] : null;

  const candidate = typeof firstResult === 'string'
    ? firstResult
    : firstResult?.url || firstResult?.videoUrl || firstResult?.video_url;

  return String(candidate || data?.videoUrl || data?.video_url || '').trim();
}

function getSeedanceConfig(runtimeConfig = {}) {
  return {
    apiBase: resolveSeedanceApiBase(process.env.SEEDANCE_API_URL),
    apiKey: String(runtimeConfig?.seedanceApiKey || process.env.SEEDANCE_API_KEY || '').trim(),
    model: String(process.env.SEEDANCE_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
  };
}

function describeFailure(label, payload) {
  const data = payload?.data || payload || {};
  const message = data?.error?.message || data?.error || data?.message || payload?.message;
  return `${label}: ${message ? String(message) : JSON.stringify(payload ?? {})}`;
}

/**
 * Seedance ne prend pas d image en base64: elle doit etre accessible par URL.
 * Le Blob est la seule option fiable ici (le disque local n est pas joignable
 * depuis l exterieur), donc sans Blob on retombe sur une generation text-to-video.
 */
export async function exposeStartFrameUrl(image) {
  if (!image?.base64) return '';
  if (!isBlobStorageEnabled()) return '';

  const mimeType = String(image.mimeType || 'image/jpeg');
  const extension = mimeType.includes('png') ? 'png' : 'jpg';
  const buffer = Buffer.from(image.base64, 'base64');

  const uploaded = await uploadPublicMediaBuffer('video-frames', extension, buffer, mimeType);
  return String(uploaded?.url || '').trim();
}

async function submitSeedanceTask({ prompt, aspectRatio, imageUrls, runtimeConfig }) {
  const { apiBase, apiKey, model } = getSeedanceConfig(runtimeConfig);

  const response = await fetch(`${apiBase}${GENERATION_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildSeedanceRequestBody({ prompt, aspectRatio, imageUrls, model })),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(describeFailure(`Seedance generation refusee (${response.status})`, payload));
  }

  const taskId = extractSeedanceTaskId(payload);
  if (!taskId) {
    // Certaines reponses peuvent deja porter le resultat: on l accepte tel quel.
    const immediateUrl = extractSeedanceVideoUrl(payload);
    if (immediateUrl) {
      return { taskId: '', videoUrl: immediateUrl, model };
    }

    throw new Error(describeFailure('Seedance n a pas renvoye de taskId', payload));
  }

  return { taskId, videoUrl: '', model };
}

async function pollSeedanceTask(taskId, runtimeConfig) {
  const { apiBase, apiKey } = getSeedanceConfig(runtimeConfig);

  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);

    const response = await fetch(`${apiBase}${TASK_PATH}/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(describeFailure(`Seedance suivi de tache impossible (${response.status})`, payload));
    }

    const data = payload?.data || payload || {};
    const status = String(data?.status || data?.state || '').toLowerCase();

    if (['succeeded', 'success', 'completed', 'done', 'succeed'].includes(status)) {
      const videoUrl = extractSeedanceVideoUrl(payload);
      if (!videoUrl) {
        throw new Error(describeFailure('Seedance a termine sans URL de video', payload));
      }
      return videoUrl;
    }

    if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) {
      throw new Error(describeFailure('Seedance a echoue', payload));
    }
  }

  throw new Error(`Seedance: la generation n a pas abouti apres ${POLL_MAX_ATTEMPTS} verifications`);
}

/**
 * Rapatrie la video chez nous. Comme pour Veo et Kling, le passage par le Blob est
 * indispensable: l URL du fournisseur expire, et un fichier ecrit sur le disque
 * local devient introuvable depuis l autre environnement partageant la meme base.
 */
async function persistSeedanceVideo(videoUrl) {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Seedance: telechargement de la video impossible (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (isBlobStorageEnabled()) {
    const uploaded = await uploadPublicMediaBuffer('generated', 'mp4', buffer, 'video/mp4');
    return String(uploaded?.url || '').trim();
  }

  const filename = `video_seedance_${Date.now()}.mp4`;
  await fs.writeFile(path.join(getGeneratedDir(), filename), buffer);
  return toMediaUrl('generated', filename);
}

export async function generateSeedanceVideo({
  prompt,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  startFrame = null,
  runtimeConfig = {},
}) {
  const startFrameUrl = startFrame ? await exposeStartFrameUrl(startFrame).catch(() => '') : '';
  const imageUrls = startFrameUrl ? [startFrameUrl] : [];

  const submitted = await submitSeedanceTask({ prompt, aspectRatio, imageUrls, runtimeConfig });
  const remoteVideoUrl = submitted.videoUrl || await pollSeedanceTask(submitted.taskId, runtimeConfig);

  return {
    jobId: submitted.taskId,
    videoUrl: await persistSeedanceVideo(remoteVideoUrl),
    status: 'completed',
    model: submitted.model,
  };
}
