import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { resolveFfmpegPaths } from './ffmpegBinaries.js';
import { parseSilenceDetect } from './silenceCompaction.js';

const execFileAsync = promisify(execFile);

// Meme reglage que la compaction des silences (-35 dB, valide en reel).
const SILENCE_THRESHOLD = '-35dB';
const MIN_SILENCE_SECONDS = 0.4;

export const BROLL_DEFAULTS = {
  cutawaySeconds: 2,
  minCutawaySeconds: 1.2,
  // Jamais de plan de coupe dans la premiere ou la derniere seconde : l accroche
  // et la chute restent sur la personne qui parle.
  edgeMarginSeconds: 1,
  minGapSeconds: 1.5,
  // Les silences plus courts que ca ne coupent pas une plage de parole.
  mergeGapSeconds: 0.8,
  zoom: 0.08,
  fps: 30,
};

/** Extension d un buffer image (le type declare par un appelant ne prouve rien). */
function imageExtension(buffer) {
  return buffer.length > 8 && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? 'png' : 'jpg';
}

/**
 * Pur : intervalles de PAROLE = complement des silences detectes. Les silences
 * plus courts que mergeGap (micro-pauses d une phrase) ne coupent pas la
 * plage : la voix continue par-dessus un plan de coupe, une pause de quelques
 * dixiemes de seconde n y change rien.
 */
export function deriveSpeechBursts(silences, duration, { minBurst = 0.3, mergeGap = 0 } = {}) {
  const bursts = [];
  let cursor = 0;

  for (const [start, end] of [...silences].sort((a, b) => a[0] - b[0])) {
    if (end - start < mergeGap && start > 0.05 && end < duration - 0.05) continue;
    if (start - cursor >= minBurst) bursts.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (duration - cursor >= minBurst) bursts.push([cursor, duration]);

  return bursts;
}

/**
 * Pur : choisit jusqu a count fenetres de plan de coupe. Dans chaque plage de
 * parole (hors premiere et derniere seconde), on place autant de fenetres que
 * la plage en accepte, espacees et centrees. S il y a plus de fenetres
 * possibles que d images, on garde des fenetres reparties sur toute la video.
 * Renvoie des [debut, fin] tries.
 */
export function pickBrollSlots(speechBursts, duration, count, options = {}) {
  const { cutawaySeconds, minCutawaySeconds, edgeMarginSeconds, minGapSeconds } = { ...BROLL_DEFAULTS, ...options };
  if (!(count > 0) || !(duration > 0)) return [];

  const usableStart = edgeMarginSeconds;
  const usableEnd = duration - edgeMarginSeconds;

  const candidates = [];
  for (const [burstStart, burstEnd] of speechBursts) {
    const from = Math.max(burstStart, usableStart);
    const to = Math.min(burstEnd, usableEnd);
    const room = to - from;
    if (room < minCutawaySeconds) continue;

    const fits = Math.floor((room + minGapSeconds) / (cutawaySeconds + minGapSeconds));
    if (fits < 1) {
      const length = Math.min(cutawaySeconds, room);
      const start = from + (room - length) / 2;
      candidates.push([start, start + length]);
      continue;
    }

    const total = fits * cutawaySeconds + (fits - 1) * minGapSeconds;
    const offset = (room - total) / 2;
    for (let i = 0; i < fits; i += 1) {
      const start = from + offset + i * (cutawaySeconds + minGapSeconds);
      candidates.push([start, start + cutawaySeconds]);
    }
  }

  candidates.sort((a, b) => a[0] - b[0]);

  let chosen = candidates;
  if (candidates.length > count) {
    chosen = [];
    for (let i = 0; i < count; i += 1) {
      const index = count === 1 ? Math.floor((candidates.length - 1) / 2) : Math.round((i * (candidates.length - 1)) / (count - 1));
      chosen.push(candidates[index]);
    }
  }

  return chosen.map(([start, end]) => [Number(start.toFixed(3)), Number(end.toFixed(3))]);
}

/**
 * Pur : arguments ffmpeg pour poser des images par-dessus la video de base.
 * `items` : [{ imagePath, start, end }]. L image est animee par un zoom lent et
 * coupee net (pas de fondu : c est un plan de coupe). L audio de la video de
 * base est conserve tel quel.
 */
export function buildBrollFfmpegArgs({ videoPath, items, width, height, outputPath, fps = BROLL_DEFAULTS.fps, zoom = BROLL_DEFAULTS.zoom }) {
  const args = ['-y', '-loglevel', 'error', '-i', videoPath];
  const filters = [];
  let last = '0:v';

  items.forEach((item, index) => {
    const frames = Math.max(1, Math.round((item.end - item.start) * fps));
    args.push('-i', item.imagePath);
    const input = index + 1;

    // Un seul plan d entree : zoompan produit `frames` images a partir de lui.
    filters.push(
      `[${input}:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2},`
      + `zoompan=z='1+${zoom}*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps},`
      + `setsar=1,format=yuv420p,setpts=PTS-STARTPTS+${item.start.toFixed(3)}/TB[b${index}]`,
    );

    const out = index === items.length - 1 ? 'v' : `m${index}`;
    filters.push(
      `[${last}][b${index}]overlay=enable='between(t,${item.start.toFixed(3)},${item.end.toFixed(3)})':eof_action=pass[${out}]`,
    );
    last = out;
  });

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[v]', '-map', '0:a?',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    outputPath,
  );

  return args;
}

/**
 * Pose des plans de coupe (images) sur une video qui parle. `images` :
 * [{ buffer, mimeType }] dans l ordre voulu. Ne bloque jamais : si quoi que ce
 * soit echoue, la video d origine est renvoyee telle quelle (`applied: 0`).
 *
 * @returns {Promise<{ buffer: Buffer, applied: number, slots: number[][] }>}
 */
export async function addBrollToVideo(videoBuffer, images, options = {}) {
  const opts = { ...BROLL_DEFAULTS, ...options };
  const unchanged = { buffer: videoBuffer, applied: 0, slots: [] };
  if (!Array.isArray(images) || !images.length) return unchanged;

  const dir = await mkdtemp(join(tmpdir(), 'plotline-broll-'));

  try {
    const { ffmpegPath, ffprobePath } = resolveFfmpegPaths();
    const input = join(dir, 'in.mp4');
    const output = join(dir, 'out.mp4');
    await writeFile(input, videoBuffer);

    const detection = await execFileAsync(ffmpegPath, [
      '-i', input, '-af', `silencedetect=noise=${SILENCE_THRESHOLD}:d=${MIN_SILENCE_SECONDS}`, '-f', 'null', '-',
    ]).catch((error) => error);
    const { duration, silences } = parseSilenceDetect(String(detection?.stderr || ''));

    const slots = pickBrollSlots(deriveSpeechBursts(silences, duration, { mergeGap: opts.mergeGapSeconds }), duration, images.length, opts);
    if (!slots.length) return unchanged;

    const probe = await execFileAsync(ffprobePath, [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', input,
    ]);
    const [width, height] = String(probe.stdout).trim().split('x').map(Number);
    if (!(width > 0) || !(height > 0)) return unchanged;

    const items = [];
    for (const [index, slot] of slots.entries()) {
      const imagePath = join(dir, `broll-${index}.${imageExtension(images[index].buffer)}`);
      await writeFile(imagePath, images[index].buffer);
      items.push({ imagePath, start: slot[0], end: slot[1] });
    }

    await execFileAsync(ffmpegPath, buildBrollFfmpegArgs({
      videoPath: input, items, width, height, outputPath: output, fps: opts.fps, zoom: opts.zoom,
    }));

    console.log(`[broll] ${items.length} plan(s) de coupe poses : ${slots.map(([s, e]) => `${s.toFixed(1)}-${e.toFixed(1)}s`).join(', ')}.`);
    return { buffer: await readFile(output), applied: items.length, slots };
  } catch (error) {
    console.warn(`[broll] pose des plans de coupe impossible, video conservee telle quelle : ${error?.message || error}`);
    return unchanged;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
