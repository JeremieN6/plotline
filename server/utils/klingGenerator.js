import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import ffmpeg from 'fluent-ffmpeg';

import { isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { DEFAULT_ASPECT_RATIO } from './aspectRatio.js';
import { configureFfmpeg } from './ffmpegBinaries.js';
import { getGeneratedDir, toMediaUrl } from './mediaStorage.js';

configureFfmpeg(ffmpeg);

const KLING_API_BASE = 'https://api-singapore.klingai.com/v1';
const KLING_MOTION_ENDPOINT = `${KLING_API_BASE}/videos/motion-control`;
const KLING_TEXT_ENDPOINT = `${KLING_API_BASE}/videos/text2video`;
const KLING_IMAGE_ENDPOINT = `${KLING_API_BASE}/videos/image2video`;
const POLL_INTERVAL_MS = 10_000;
const POLL_MAX_ATTEMPTS = 90;
const MAX_VIDEO_DURATION_SECONDS = 20;
const MIN_KLING_WIDTH = 340;
const MAX_KLING_WIDTH = 3850;
const KLING_TEXT_PROMPT_MAX_CHARS = 2500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePromptText(prompt) {
  return String(prompt || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function takeFirstSentence(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const sentenceMatch = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  return String(sentenceMatch?.[1] || normalized).trim();
}

function compressPromptSection(section) {
  return normalizePromptText(section)
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => takeFirstSentence(line))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function prepareKlingTextPrompt(prompt) {
  const normalized = normalizePromptText(prompt);
  if (normalized.length <= KLING_TEXT_PROMPT_MAX_CHARS) {
    return normalized;
  }

  const sections = normalized
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  const compressedSections = sections
    .map((section) => {
      const lowerSection = section.toLowerCase();

      if (
        lowerSection.startsWith('sequence')
        || lowerSection.startsWith('critical constraints')
        || lowerSection.startsWith('style constraints')
        || lowerSection.startsWith('camera')
        || lowerSection.startsWith('strictly avoid')
      ) {
        return compressPromptSection(section);
      }

      return takeFirstSentence(section);
    })
    .filter(Boolean);

  let compacted = compressedSections.join(' ').replace(/\s+/g, ' ').trim();

  if (compacted.length <= KLING_TEXT_PROMPT_MAX_CHARS) {
    return compacted;
  }

  compacted = sections
    .flatMap((section) => section.split('\n'))
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => takeFirstSentence(line))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (compacted.length <= KLING_TEXT_PROMPT_MAX_CHARS) {
    return compacted;
  }

  return `${compacted.slice(0, KLING_TEXT_PROMPT_MAX_CHARS - 3).trimEnd()}...`;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getRuntimeConfigSafe() {
  try {
    if (typeof useRuntimeConfig === 'function') {
      return useRuntimeConfig();
    }
  } catch {
    return {};
  }

  return {};
}

function getKlingConfig() {
  const runtimeConfig = getRuntimeConfigSafe();
  return {
    apiKey: runtimeConfig.klingApiKey || process.env.KLINGAI_ACCESS_KEY || process.env.KLING_API_KEY || '',
    apiSecret: runtimeConfig.klingApiSecret || process.env.KLINGAI_SECRET_KEY || process.env.KLING_API_SECRET || '',
    model: runtimeConfig.klingModel || process.env.KLINGAI_MODEL || process.env.KLING_MODEL || 'kling-v3',
    baseUrl: runtimeConfig.baseUrl || process.env.BASE_URL || '',
  };
}

function isPublicHttpBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return false;
  }

  const hostname = String(parsed.hostname || '').toLowerCase();
  if (!hostname) return false;

  const blockedHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (blockedHosts.has(hostname) || hostname.endsWith('.local')) {
    return false;
  }

  return true;
}

function generateAuthToken() {
  const { apiKey, apiSecret } = getKlingConfig();
  if (!apiKey || !apiSecret) {
    throw new Error('KLINGAI_ACCESS_KEY and KLINGAI_SECRET_KEY are required for reel generation');
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(JSON.stringify({
    iss: apiKey,
    exp: nowSeconds + 1800,
    nbf: nowSeconds - 5,
  }));

  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${header}.${payload}.${signature}`;
}

function ffprobeAsync(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(data);
    });
  });
}

function getVideoStream(probeData) {
  return (probeData?.streams || []).find((stream) => stream.codec_type === 'video') || null;
}

async function getVideoMetadata(videoPath) {
  const probeData = await ffprobeAsync(videoPath);
  const videoStream = getVideoStream(probeData);
  return {
    duration: Number(probeData?.format?.duration || videoStream?.duration || 0),
    width: Number(videoStream?.width || 0),
    height: Number(videoStream?.height || 0),
  };
}

function transcodeVideo(inputPath, outputPath, extraOutputOptions = []) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-movflags +faststart',
        '-metadata:s:v:0 rotate=0',
        ...extraOutputOptions,
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

async function ensureH264Mp4(videoPath) {
  const outputPath = path.join(getGeneratedDir(), `${path.basename(videoPath, path.extname(videoPath))}_h264.mp4`);
  await transcodeVideo(videoPath, outputPath, ['-vf scale=trunc(iw/2)*2:trunc(ih/2)*2']);
  return outputPath;
}

async function trimVideoForMotionControl(videoPath) {
  const outputPath = path.join(getGeneratedDir(), `${path.basename(videoPath, path.extname(videoPath))}_trimmed.mp4`);
  await transcodeVideo(videoPath, outputPath, ['-t 20', '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2']);
  return outputPath;
}

async function ensureKlingResolution(videoPath) {
  const metadata = await getVideoMetadata(videoPath);
  if (metadata.width >= MIN_KLING_WIDTH && metadata.width <= MAX_KLING_WIDTH) {
    return videoPath;
  }

  const targetWidth = metadata.width < MIN_KLING_WIDTH ? MIN_KLING_WIDTH : 1920;
  const outputPath = path.join(getGeneratedDir(), `${path.basename(videoPath, path.extname(videoPath))}_${targetWidth}w.mp4`);
  await transcodeVideo(videoPath, outputPath, [`-vf scale=${targetWidth}:-2`]);
  return outputPath;
}

async function prepareSourceVideo(videoPath) {
  let preparedPath = await ensureH264Mp4(videoPath);
  const metadata = await getVideoMetadata(preparedPath);

  if (metadata.duration > MAX_VIDEO_DURATION_SECONDS) {
    preparedPath = await trimVideoForMotionControl(preparedPath);
  }

  return ensureKlingResolution(preparedPath);
}

async function copyIntoGeneratedDir(localPath, prefix) {
  const ext = path.extname(localPath) || '.bin';
  const filename = `${prefix}_${Date.now()}${ext}`;
  const destination = path.join(getGeneratedDir(), filename);
  await fs.copyFile(localPath, destination);
  return {
    absolutePath: destination,
    fileName: filename,
    publicUrl: toMediaUrl('generated', filename),
  };
}

/**
 * Persiste la video generee pour l affichage. Passe par le Blob quand il est
 * configure: sinon le fichier reste sur le disque de la machine qui genere et
 * devient introuvable depuis un autre environnement partageant la meme base.
 * A ne pas confondre avec copyIntoGeneratedDir, qui doit rester local pour
 * exposer un fichier source a Kling via BASE_URL.
 */
async function persistVideoOutput(localPath, prefix) {
  if (isBlobStorageEnabled()) {
    const buffer = await fs.readFile(localPath);
    const uploaded = await uploadPublicMediaBuffer('generated', 'mp4', buffer, 'video/mp4');
    return { publicUrl: uploaded.url };
  }

  const persisted = await copyIntoGeneratedDir(localPath, prefix);
  return { publicUrl: persisted.publicUrl };
}

async function exposeLocalFileViaBaseUrl(localPath, prefix) {
  const { baseUrl } = getKlingConfig();
  const cleanedBaseUrl = String(baseUrl || '').replace(/\/$/, '');
  if (!cleanedBaseUrl) {
    return '';
  }

  const publicAsset = await copyIntoGeneratedDir(localPath, prefix);
  return `${cleanedBaseUrl}${publicAsset.publicUrl}`;
}

async function imageToBase64(imagePath) {
  const buffer = await fs.readFile(imagePath);
  return buffer.toString('base64');
}

async function uploadVideoToTmpFiles(videoPath) {
  const formData = new FormData();
  const fileBuffer = await fs.readFile(videoPath);
  formData.append('file', new Blob([fileBuffer], { type: 'video/mp4' }), path.basename(videoPath));

  const response = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`tmpfiles upload failed with status ${response.status}`);
  }

  const payload = await response.json();
  const rawUrl = String(payload?.data?.url || '').trim();
  if (!rawUrl) {
    throw new Error('tmpfiles upload did not return a public URL');
  }

  return rawUrl
    .replace('http://tmpfiles.org/', 'https://tmpfiles.org/dl/')
    .replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/')
    .replace('/dl/dl/', '/dl/');
}

async function uploadVideoToBlob(videoPath) {
  if (!isBlobStorageEnabled()) {
    return '';
  }

  const fileBuffer = await fs.readFile(videoPath);
  const uploaded = await uploadPublicMediaBuffer('generated', 'mp4', fileBuffer, 'video/mp4');
  return String(uploaded?.url || '').trim();
}

async function resolveTransportPayloads(imagePath, videoPath) {
  const { baseUrl } = getKlingConfig();
  if (isPublicHttpBaseUrl(baseUrl)) {
    return {
      imagePayload: await exposeLocalFileViaBaseUrl(imagePath, 'kling-image'),
      videoPayload: await exposeLocalFileViaBaseUrl(videoPath, 'kling-video'),
    };
  }

  const blobVideoUrl = await uploadVideoToBlob(videoPath).catch(() => '');
  if (blobVideoUrl) {
    return {
      imagePayload: await imageToBase64(imagePath),
      videoPayload: blobVideoUrl,
    };
  }

  return {
    imagePayload: await imageToBase64(imagePath),
    videoPayload: await uploadVideoToTmpFiles(videoPath),
  };
}

async function submitMotionControlTask({ imagePayload, videoPayload, motionPrompt }) {
  const { model } = getKlingConfig();
  const response = await fetch(KLING_MOTION_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${generateAuthToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_name: model,
      image_url: imagePayload,
      video_url: videoPayload,
      character_orientation: 'video',
      mode: 'std',
      ...(motionPrompt ? { prompt: motionPrompt } : {}),
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Kling motion-control request failed: ${JSON.stringify(payload)}`);
  }

  const taskId = payload?.data?.task_id || payload?.task_id;
  if (!taskId) {
    throw new Error(`Kling response did not include task_id: ${JSON.stringify(payload)}`);
  }

  return taskId;
}

async function pollMotionControlTask(taskId) {
  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);

    const response = await fetch(`${KLING_MOTION_ENDPOINT}/${taskId}`, {
      headers: {
        Authorization: `Bearer ${generateAuthToken()}`,
      },
    });

    const payload = await response.json();
    const data = payload?.data || payload || {};
    const status = data.task_status || data.status || 'unknown';

    if (status === 'succeed') {
      const videoUrl = data?.task_result?.videos?.[0]?.url;
      if (!videoUrl) {
        throw new Error(`Kling succeeded without a video URL: ${JSON.stringify(data)}`);
      }
      return videoUrl;
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(data?.task_status_msg || data?.error_message || `Kling task failed with status ${status}`);
    }
  }

  throw new Error(`Kling motion-control polling timed out after ${POLL_MAX_ATTEMPTS} attempts`);
}

async function downloadGeneratedVideo(videoUrl) {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Unable to download Kling output video (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `video_kling_${Date.now()}.mp4`;
  const outputPath = path.join(getGeneratedDir(), filename);
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

export async function generateVideoMotionControl(imagePath, videoPath, motionPrompt = '') {
  const absoluteImagePath = path.resolve(String(imagePath || ''));
  const absoluteVideoPath = path.resolve(String(videoPath || ''));

  // Track all intermediate files created during preparation so we can clean them
  // up regardless of success or failure (they are only needed to build the request).
  const intermediates = [];

  try {
    let preparedPath = await ensureH264Mp4(absoluteVideoPath);
    intermediates.push(preparedPath);

    const metadata = await getVideoMetadata(preparedPath);
    if (metadata.duration > MAX_VIDEO_DURATION_SECONDS) {
      const trimmed = await trimVideoForMotionControl(preparedPath);
      intermediates.push(trimmed);
      preparedPath = trimmed;
    }

    const resolvedPath = await ensureKlingResolution(preparedPath);
    if (resolvedPath !== preparedPath) {
      intermediates.push(resolvedPath);
      preparedPath = resolvedPath;
    } else {
      preparedPath = resolvedPath;
    }

    const { imagePayload, videoPayload } = await resolveTransportPayloads(absoluteImagePath, preparedPath);
    const taskId = await submitMotionControlTask({ imagePayload, videoPayload, motionPrompt });
    const generatedVideoUrl = await pollMotionControlTask(taskId);
    return await downloadGeneratedVideo(generatedVideoUrl);
  } finally {
    for (const intermediate of intermediates) {
      await fs.unlink(intermediate).catch(() => {});
    }
  }
}

async function submitTextToVideoTask({ prompt, aspectRatio }) {
  const { model } = getKlingConfig();
  const response = await fetch(KLING_TEXT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${generateAuthToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_name: model,
      prompt: prepareKlingTextPrompt(prompt),
      mode: 'std',
      aspect_ratio: aspectRatio,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Kling text2video request failed: ${JSON.stringify(payload)}`);
  }

  const taskId = payload?.data?.task_id || payload?.task_id;
  if (!taskId) {
    throw new Error(`Kling text2video response did not include task_id: ${JSON.stringify(payload)}`);
  }

  return String(taskId);
}

async function submitImageToVideoTask({ prompt, imageBase64, aspectRatio }) {
  const { model } = getKlingConfig();
  const response = await fetch(KLING_IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${generateAuthToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_name: model,
      image: imageBase64,
      prompt: prepareKlingTextPrompt(prompt),
      mode: 'std',
      aspect_ratio: aspectRatio,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Kling image2video request failed: ${JSON.stringify(payload)}`);
  }

  const taskId = payload?.data?.task_id || payload?.task_id;
  if (!taskId) {
    throw new Error(`Kling image2video response did not include task_id: ${JSON.stringify(payload)}`);
  }

  return String(taskId);
}

async function pollKlingVideoTask(endpoint, taskId, label) {
  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);

    const response = await fetch(`${endpoint}/${taskId}`, {
      headers: {
        Authorization: `Bearer ${generateAuthToken()}`,
      },
    });

    const payload = await response.json();
    const data = payload?.data || payload || {};
    const status = data.task_status || data.status || 'unknown';

    if (status === 'succeed') {
      const videoUrl = data?.task_result?.videos?.[0]?.url;
      if (!videoUrl) {
        throw new Error(`${label} succeeded without a video URL: ${JSON.stringify(data)}`);
      }
      return videoUrl;
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(data?.task_status_msg || data?.error_message || `${label} failed with status ${status}`);
    }
  }

  throw new Error(`${label} polling timed out after ${POLL_MAX_ATTEMPTS} attempts`);
}

export async function generateVideoFromTextPrompt(prompt, aspectRatio = DEFAULT_ASPECT_RATIO) {
  const taskId = await submitTextToVideoTask({ prompt, aspectRatio });
  const generatedVideoUrl = await pollKlingVideoTask(KLING_TEXT_ENDPOINT, taskId, 'Kling text2video');
  const localPath = await downloadGeneratedVideo(generatedVideoUrl);

  const persisted = await persistVideoOutput(localPath, 'kling-text');
  await fs.unlink(localPath).catch(() => {});

  return {
    taskId,
    videoUrl: persisted.publicUrl,
  };
}

export async function generateVideoFromImageAndPrompt({ prompt, imageBase64, aspectRatio = DEFAULT_ASPECT_RATIO }) {
  const taskId = await submitImageToVideoTask({ prompt, imageBase64, aspectRatio });
  const generatedVideoUrl = await pollKlingVideoTask(KLING_IMAGE_ENDPOINT, taskId, 'Kling image2video');
  const localPath = await downloadGeneratedVideo(generatedVideoUrl);

  const persisted = await persistVideoOutput(localPath, 'kling-image');
  await fs.unlink(localPath).catch(() => {});

  return {
    taskId,
    videoUrl: persisted.publicUrl,
  };
}

export { prepareKlingTextPrompt };
