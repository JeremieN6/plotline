import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { resolveFfmpegPaths } from './ffmpegBinaries.js';
import { compareSpeech } from './speechFidelity.js';

const execFileAsync = promisify(execFile);

const TRANSCRIPTION_MODEL = 'gemini-3.8-flash';
const SEGMENT_SECONDS = 10;

const TRANSCRIPTION_PROMPT = 'Transcris EXACTEMENT et mot pour mot ce que dit la personne dans cet audio, y compris les repetitions, hesitations et mots deformes ou inventes, sans rien corriger ni ajouter. Ecris les nombres en toutes lettres. Reponds uniquement avec le texte dit, sans horodatage ni commentaire.';

export function isSpeechVerificationEnabled() {
  return String(process.env.OMNIFLASH_VERIFY_SPEECH || '').trim().toLowerCase() !== 'false';
}

// Les interactions chainees renvoient la video CUMULATIVE : le segment k occupe
// [k*10s, (k+1)*10s]. On n extrait que cette fenetre.
async function extractSegmentAudio(videoBuffer, segmentIndex) {
  const dir = await mkdtemp(join(tmpdir(), 'plotline-speech-'));

  try {
    const input = join(dir, 'clip.mp4');
    const output = join(dir, 'segment.wav');
    await writeFile(input, videoBuffer);

    await execFileAsync(resolveFfmpegPaths().ffmpegPath, [
      '-y', '-loglevel', 'error',
      '-ss', String(segmentIndex * SEGMENT_SECONDS), '-t', String(SEGMENT_SECONDS),
      '-i', input, '-vn', '-ac', '1', '-ar', '16000', output,
    ]);

    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Verifie qu un segment de video dit bien `expectedText`. Renvoie null quand la
 * verification elle-meme echoue (ffmpeg absent, API indisponible) : un controle
 * qualite ne doit jamais faire perdre une video deja generee.
 */
export async function verifySegmentSpeech({ ai, videoBuffer, segmentIndex, expectedText }) {
  try {
    const audio = await extractSegmentAudio(videoBuffer, segmentIndex);
    const response = await ai.models.generateContent({
      model: TRANSCRIPTION_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: audio.toString('base64') } },
          { text: TRANSCRIPTION_PROMPT },
        ],
      }],
    });

    const heardText = String(response?.text || '').trim();
    return { heardText, ...compareSpeech(expectedText, heardText) };
  } catch (error) {
    console.warn(`[omniflash] verification de la parole impossible (segment ${segmentIndex + 1}) : ${error?.message || error}`);
    return null;
  }
}
