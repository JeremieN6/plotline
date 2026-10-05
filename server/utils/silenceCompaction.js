import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { resolveFfmpegPaths } from './ffmpegBinaries.js';

const execFileAsync = promisify(execFile);

// Un silence plus long que MIN_SILENCE_SECONDS est raccourci a KEEP_SECONDS : la
// pause reste audible, mais plus de vide de 1 a 2 s entre deux segments generes.
const MIN_SILENCE_SECONDS = 0.6;
const KEEP_SECONDS = 0.3;
const SILENCE_THRESHOLD = '-35dB';

export function isSilenceCompactionEnabled() {
  return String(process.env.OMNIFLASH_COMPACT_SILENCE || '').trim().toLowerCase() !== 'false';
}

/**
 * Pur : a partir des silences detectes ([debut, fin] en secondes) et de la duree
 * totale, renvoie les intervalles a CONSERVER. Un silence au tout debut est
 * coupe jusqu a 0,15 s avant la parole ; les autres gardent KEEP_SECONDS.
 */
export function computeKeepSegments(silences, duration, { minSilence = MIN_SILENCE_SECONDS, keep = KEEP_SECONDS } = {}) {
  const segments = [];
  let cursor = 0;

  for (const [start, end] of silences) {
    if (end - start < minSilence) continue;

    if (start < 0.05) {
      cursor = Math.max(cursor, end - keep / 2);
      continue;
    }

    const cutStart = start + keep / 2;
    const cutEnd = end - keep / 2;
    if (cutEnd - cutStart <= 0.05) continue;

    if (cutStart > cursor) segments.push([cursor, cutStart]);
    cursor = cutEnd;
  }

  if (cursor < duration) segments.push([cursor, duration]);
  return segments;
}

export function parseSilenceDetect(stderr) {
  const durationMatch = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr);
  const duration = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : 0;

  const silences = [];
  let openStart = null;

  for (const match of stderr.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (match[1] === 'start') {
      openStart = Number(match[2]);
    } else if (openStart !== null) {
      silences.push([openStart, Number(match[2])]);
      openStart = null;
    }
  }

  if (openStart !== null) silences.push([openStart, duration]);
  return { duration, silences };
}

/**
 * Raccourcit les longs silences en coupant image ET son aux memes instants
 * (couper l audio seul desynchroniserait la video). Ne bloque jamais : en cas de
 * probleme, la video d origine est renvoyee telle quelle.
 */
export async function compactSilences(videoBuffer) {
  const dir = await mkdtemp(join(tmpdir(), 'plotline-silence-'));

  try {
    const { ffmpegPath } = resolveFfmpegPaths();
    const input = join(dir, 'in.mp4');
    const output = join(dir, 'out.mp4');
    await writeFile(input, videoBuffer);

    // ffmpeg ecrit son rapport sur stderr, y compris quand tout va bien.
    const detection = await execFileAsync(ffmpegPath, [
      '-i', input, '-af', `silencedetect=noise=${SILENCE_THRESHOLD}:d=0.4`, '-f', 'null', '-',
    ]).catch((error) => error);
    const { duration, silences } = parseSilenceDetect(String(detection?.stderr || ''));

    const keep = computeKeepSegments(silences, duration);
    const removed = duration - keep.reduce((total, [start, end]) => total + (end - start), 0);
    if (!duration || keep.length < 2 || removed < 0.3) return videoBuffer;

    const filters = keep.map(([start, end], i) => (
      `[0:v]trim=${start.toFixed(3)}:${end.toFixed(3)},setpts=PTS-STARTPTS[v${i}];`
      + `[0:a]atrim=${start.toFixed(3)}:${end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
    ));
    const joined = keep.map((_, i) => `[v${i}][a${i}]`).join('');
    const filterComplex = `${filters.join(';')};${joined}concat=n=${keep.length}:v=1:a=1[v][a]`;

    await execFileAsync(ffmpegPath, [
      '-y', '-loglevel', 'error', '-i', input, '-filter_complex', filterComplex,
      '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', output,
    ]);

    console.log(`[omniflash] silences raccourcis : ${removed.toFixed(1)}s retirees sur ${duration.toFixed(1)}s.`);
    return await readFile(output);
  } catch (error) {
    console.warn(`[omniflash] raccourcissement des silences impossible, video conservee telle quelle : ${error?.message || error}`);
    return videoBuffer;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
