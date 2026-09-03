import fs from 'node:fs/promises';
import path from 'node:path';

import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';

import { configureFfmpeg } from './ffmpegBinaries.js';

configureFfmpeg(ffmpeg);

const MIN_DURATION_SECONDS = 3;
const SCAN_PERCENTAGES = [0.1, 0.25, 0.45, 0.65, 0.85];

function getTempFramePath(videoPath, index) {
  const stem = path.basename(videoPath, path.extname(videoPath));
  return path.join(process.cwd(), 'storage', 'temp', `${stem}_frame_${index}.jpg`);
}

async function ensureTempDir() {
  await fs.mkdir(path.join(process.cwd(), 'storage', 'temp'), { recursive: true });
}

function ffprobeAsync(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
}

function extractDurationFromProbe(probeData) {
  const formatDuration = Number(probeData?.format?.duration || 0);
  if (formatDuration > 0) {
    return formatDuration;
  }

  const videoStream = (probeData?.streams || []).find((stream) => stream.codec_type === 'video');
  const streamDuration = Number(videoStream?.duration || 0);
  return streamDuration > 0 ? streamDuration : 0;
}

function variance(values) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
}

async function computeLaplacianVariance(imagePath) {
  const { data, info } = await sharp(imagePath)
    .grayscale()
    .resize({ width: 512, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const responses = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const center = data[index];
      const top = data[index - width];
      const bottom = data[index + width];
      const left = data[index - 1];
      const right = data[index + 1];
      const laplacian = top + bottom + left + right - (4 * center);
      responses.push(laplacian);
    }
  }

  return variance(responses);
}

function extractFrame(videoPath, timestampSeconds, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestampSeconds)
      .outputOptions(['-frames:v 1', '-q:v 2'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Runs ffmpeg scene-change detection on the video and returns an array of
 * cut timestamps (in seconds) where a scene boundary was detected.
 * Falls back to [] on any ffmpeg error so the caller can decide what to do.
 */
async function detectSceneCuts(absolutePath) {
  return new Promise((resolve) => {
    const cutTimes = [];
    ffmpeg(absolutePath)
      .outputOptions([
        '-vf', 'select=gt(scene\\,0.35),showinfo',
        '-vsync', '0',
        '-f', 'null',
      ])
      .output(process.platform === 'win32' ? 'nul' : '/dev/null')
      .on('stderr', (line) => {
        const match = String(line || '').match(/pts_time:(\d+(?:\.\d+)?)/);
        if (match) {
          cutTimes.push(Number(match[1]));
        }
      })
      .on('end', () => resolve(cutTimes))
      .on('error', () => resolve([]))
      .run();
  });
}

/**
 * Returns the duration of the longest continuous shot in the video (seconds).
 * If ffmpeg scene detection fails entirely, falls back to the total duration.
 */
async function longestContinuousShotDuration(absolutePath) {
  const probeData = await ffprobeAsync(absolutePath);
  const totalDuration = extractDurationFromProbe(probeData);

  let cutTimes;
  try {
    cutTimes = await detectSceneCuts(absolutePath);
  } catch {
    // If detection fails, assume the full video is one continuous shot.
    return totalDuration;
  }

  if (!cutTimes.length) {
    // No cuts detected — entire video is one shot.
    return totalDuration;
  }

  const boundaries = [0, ...cutTimes.sort((a, b) => a - b), totalDuration];
  const shots = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    shots.push(boundaries[i + 1] - boundaries[i]);
  }

  return Math.max(...shots);
}

/**
 * Detects boomerang / loop videos: a clip that plays forward then backward
 * (or repeats a 2-4s loop) over a longer total runtime.
 *
 * Strategy: compare pixel-histogram similarity between the first and last thirds
 * of the video using ffmpeg select frames. If the first-quarter frame is nearly
 * identical to the last-quarter frame the video is a boomerang.
 *
 * Returns true when the video is considered a boomerang (should be rejected).
 */
async function isBoomerangVideo(absolutePath) {
  const probeData = await ffprobeAsync(absolutePath);
  const duration = extractDurationFromProbe(probeData);

  // Only worth checking if duration is long enough to be a looped clip.
  if (duration < 4) {
    return false;
  }

  const tempDir = path.join(process.cwd(), 'storage', 'temp');
  await fs.mkdir(tempDir, { recursive: true });

  const stem = path.basename(absolutePath, path.extname(absolutePath));
  const frameEarly = path.join(tempDir, `${stem}_boom_early.jpg`);
  const frameLate = path.join(tempDir, `${stem}_boom_late.jpg`);

  try {
    // Extract frame at 15% and 85% of the video.
    await extractFrame(absolutePath, duration * 0.15, frameEarly);
    await extractFrame(absolutePath, duration * 0.85, frameLate);

    const existsEarly = await fs.access(frameEarly).then(() => true).catch(() => false);
    const existsLate = await fs.access(frameLate).then(() => true).catch(() => false);

    if (!existsEarly || !existsLate) {
      return false;
    }

    // Compare grayscale histograms with sharp.
    const earlyStats = await sharp(frameEarly).greyscale().resize(64, 64).raw().toBuffer();
    const lateStats = await sharp(frameLate).greyscale().resize(64, 64).raw().toBuffer();

    // Mean absolute difference over all pixels.
    let totalDiff = 0;
    const len = Math.min(earlyStats.length, lateStats.length);
    for (let i = 0; i < len; i += 1) {
      totalDiff += Math.abs(earlyStats[i] - lateStats[i]);
    }
    const mad = totalDiff / len;

    // MAD < 8 means the two frames are nearly identical → boomerang.
    return mad < 8;
  } catch {
    return false;
  } finally {
    await fs.unlink(frameEarly).catch(() => {});
    await fs.unlink(frameLate).catch(() => {});
  }
}

/**
 * Exported check used by runReelWorkflow.
 *
 * Returns the total duration so callers can keep existing logic,
 * but throws with a descriptive message for:
 *  - Videos where no continuous shot is ≥ MIN_DURATION_SECONDS
 *  - Boomerang / loop videos
 *
 * Keeping the original return value (duration number) preserves backward
 * compatibility with extractBestFrame which re-calls checkMinDuration.
 */
export async function checkMinDuration(videoPath) {
  const absolutePath = path.resolve(String(videoPath || ''));
  const probeData = await ffprobeAsync(absolutePath);
  const totalDuration = extractDurationFromProbe(probeData);

  // 1. Reject boomerang / loop videos before anything else.
  const boomerang = await isBoomerangVideo(absolutePath);
  if (boomerang) {
    throw new Error(`Boomerang/loop video rejected (frames at 15% and 85% are nearly identical): ${path.basename(absolutePath)}`);
  }

  // 2. Reject videos where no single continuous shot is long enough for Kling.
  const maxShot = await longestContinuousShotDuration(absolutePath);
  if (maxShot < MIN_DURATION_SECONDS) {
    throw new Error(
      `No continuous shot ≥${MIN_DURATION_SECONDS}s found (longest=${maxShot.toFixed(2)}s). Kling requires uninterrupted motion.`,
    );
  }

  return totalDuration;
}

export async function extractBestFrame(videoPath) {
  const absolutePath = path.resolve(String(videoPath || ''));
  await ensureTempDir();

  const duration = await checkMinDuration(absolutePath);
  if (duration < MIN_DURATION_SECONDS) {
    throw new Error(`Video duration too short for reel workflow (${duration.toFixed(2)}s < ${MIN_DURATION_SECONDS}s)`);
  }

  const timestamps = SCAN_PERCENTAGES.map((percentage) => {
    const rawTimestamp = duration * percentage;
    return Math.max(0.15, Math.min(rawTimestamp, Math.max(duration - 0.15, 0.15)));
  });

  const candidates = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const outputPath = getTempFramePath(absolutePath, index + 1);
    try {
      await extractFrame(absolutePath, timestamps[index], outputPath);
      // Verify the file was actually written before passing to Sharp.
      await fs.access(outputPath);
      const sharpness = await computeLaplacianVariance(outputPath);
      candidates.push({ outputPath, sharpness });
    } catch {
      // ffmpeg may silently skip a frame at certain timestamps (edge of video,
      // corrupted segment, etc.). Clean up and continue with other timestamps.
      await fs.unlink(outputPath).catch(() => {});
    }
  }

  const bestCandidate = candidates.sort((left, right) => right.sharpness - left.sharpness)[0];
  if (!bestCandidate?.outputPath) {
    throw new Error('Unable to extract a usable frame from the video');
  }

  for (const candidate of candidates) {
    if (candidate.outputPath !== bestCandidate.outputPath) {
      await fs.unlink(candidate.outputPath).catch(() => {});
    }
  }

  return bestCandidate.outputPath;
}
