import fs from 'node:fs/promises';
import path from 'node:path';

import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import sharp from 'sharp';

ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobe?.path) {
  ffmpeg.setFfprobePath(ffprobe.path);
}

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

export async function checkMinDuration(videoPath) {
  const absolutePath = path.resolve(String(videoPath || ''));
  const probeData = await ffprobeAsync(absolutePath);
  return extractDurationFromProbe(probeData);
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
    await extractFrame(absolutePath, timestamps[index], outputPath);
    const sharpness = await computeLaplacianVariance(outputPath);
    candidates.push({ outputPath, sharpness });
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