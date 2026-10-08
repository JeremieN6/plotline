import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

import { resolveFfmpegPaths } from './ffmpegBinaries.js';
import { FACELESS_ASSET_ORIGIN } from './facelessTemplate.js';

const execFileAsync = promisify(execFile);

const ASSET_TYPES = { '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

/** Dossier des fichiers du theme (polices...). FACELESS_ASSETS_DIR le remplace. */
export function resolveFacelessAssetsDir() {
  const fromEnv = String(process.env.FACELESS_ASSETS_DIR || '').trim();
  return resolve(fromEnv || resolve(process.cwd(), 'resources/faceless'));
}

/** Pur : chemin disque d une URL du theme, ou null si elle sort du dossier. */
export function facelessAssetPath(url, baseDir = resolveFacelessAssetsDir()) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  const file = resolve(baseDir, `.${pathname}`);
  return file.startsWith(baseDir + sep) ? file : null;
}

async function serveFacelessAsset(route) {
  const file = facelessAssetPath(route.request().url());
  if (!file) return route.abort();
  try {
    const body = await readFile(file);
    return route.fulfill({ status: 200, body, contentType: ASSET_TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
  } catch {
    console.warn(`[faceless] fichier du theme introuvable : ${file}`);
    return route.abort();
  }
}

export const MIX_SAMPLE_RATE = 48000;
const CHANNELS = 2;

/** Decode n importe quel fichier audio en PCM flottant 48 kHz stereo. */
async function decodeToFloat32(path, { trimTail = false } = {}) {
  const { ffmpegPath } = resolveFfmpegPaths();
  const filters = trimTail
    // Retire seulement le silence FINAL (les temps des mots restent valides).
    ? ['-af', 'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse']
    : [];
  const { stdout } = await execFileAsync(ffmpegPath, [
    '-v', 'error', '-i', path, ...filters,
    '-f', 'f32le', '-ac', String(CHANNELS), '-ar', String(MIX_SAMPLE_RATE), '-',
  ], { encoding: 'buffer', maxBuffer: 1024 * 1024 * 512 });
  return new Float32Array(stdout.buffer, stdout.byteOffset, stdout.byteLength / 4);
}

/** Duree (s) d un clip de voix une fois son silence final retire. */
export async function measureTrimmedDuration(path) {
  const samples = await decodeToFloat32(path, { trimTail: true });
  return samples.length / CHANNELS / MIX_SAMPLE_RATE;
}

/**
 * Mixe voix et bruitages a l echantillon pres, en Node (adelay/amix decalait
 * les voix de plusieurs centaines de ms lors du trailer). Ecrit du PCM brut
 * f32le 48 kHz stereo dans `outputPath`.
 * `tracks` : [{ path, start, gain, trimTail }].
 */
export async function mixFacelessAudio(tracks, duration, outputPath) {
  const total = Math.ceil(duration * MIX_SAMPLE_RATE) * CHANNELS;
  const mix = new Float32Array(total);

  for (const track of tracks) {
    const samples = await decodeToFloat32(track.path, { trimTail: track.trimTail });
    const offset = Math.round(track.start * MIX_SAMPLE_RATE) * CHANNELS;
    const gain = track.gain ?? 1;
    for (let i = 0; i < samples.length && offset + i < total; i += 1) {
      if (offset + i >= 0) mix[offset + i] += samples[i] * gain;
    }
  }

  for (let i = 0; i < total; i += 1) mix[i] = Math.max(-1, Math.min(1, mix[i]));
  await writeFile(outputPath, Buffer.from(mix.buffer));
  return outputPath;
}

/**
 * Capture la page image par image (Chromium sans tete via Playwright) et
 * encode en MP4 avec la piste audio deja mixee.
 */
export async function renderFacelessVideo({ html, timeline, audioRawPath, outputPath, onProgress } = {}) {
  const { chromium } = await import('playwright');
  const { ffmpegPath } = resolveFfmpegPaths();
  const { width, height, fps, duration } = timeline;
  const frames = Math.ceil(duration * fps);

  const ffmpeg = spawn(ffmpegPath, [
    '-y', '-v', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-f', 'f32le', '-ar', String(MIX_SAMPLE_RATE), '-ac', String(CHANNELS), '-i', audioRawPath,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
    outputPath,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });

  let stderr = '';
  ffmpeg.stderr.on('data', (chunk) => { stderr += chunk; });
  const finished = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg a echoue (${code}) : ${stderr.slice(-800)}`))));
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.route(`${FACELESS_ASSET_ORIGIN}/**`, (route) => serveFacelessAsset(route));
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => window.__ready);

    for (let i = 0; i < frames; i += 1) {
      await page.evaluate((t) => window.__seek(t), i / fps);
      const jpeg = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ffmpeg.stdin.write(jpeg)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
      if (onProgress && i % fps === 0) onProgress(i / frames);
    }
  } finally {
    ffmpeg.stdin.end();
    await browser.close();
  }

  await finished;
  return outputPath;
}
