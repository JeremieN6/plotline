import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { finalizeContentWithVersion, markGenerationFailure } from './contentVersions.js';
import { synthesizeWithTimestamps } from './elevenLabsTts.js';
import { generateFacelessPlan, sanitizeFacelessPlan } from './facelessPlanGenerator.js';
import { mixFacelessAudio, renderFacelessVideo } from './facelessRenderer.js';
import { buildFacelessHtml } from './facelessTemplate.js';
import { layoutFacelessTimelineFromTrack } from './facelessTimeline.js';
import { normalizeErrorMessage, saveGeneratedVideoBuffer } from './videoGeneration.js';

/**
 * Video faceless de bout en bout, en tache de fond :
 * idee -> plan Claude -> voix ElevenLabs (temps des mots) -> timeline ->
 * page HTML -> capture image par image -> MP4 -> Blob -> nouvelle version.
 * Aucun modele de generation video.
 */

// Un rendu occupe Chromium et le processeur ~1 a 3 min : un seul a la fois.
let renderQueue = Promise.resolve();
function enqueueRender(task) {
  const run = renderQueue.then(task, task);
  renderQueue = run.catch(() => {});
  return run;
}

export function resolveFacelessSfxDir() {
  const fromEnv = String(process.env.FACELESS_SFX_DIR || '').trim();
  return fromEnv ? resolve(fromEnv) : resolve(process.cwd(), 'tmp/faceless/sfx');
}

/** Pur : legende du post (texte + hashtags). */
export function buildFacelessCaption(plan) {
  return [plan?.caption, (plan?.hashtags || []).join(' ')].filter(Boolean).join('\n\n') || null;
}

/**
 * Le pipeline lui-meme (sans base de donnees) : renvoie le MP4 et le plan.
 * `plan` deja ecrit (retouche, essai) : Claude n est pas rappele.
 */
export async function produceFacelessVideo({ idea, plan: givenPlan, persona, targetSeconds, captions, voiceId, onStep = () => {} } = {}) {
  onStep('plan');
  const plan = givenPlan
    ? sanitizeFacelessPlan(givenPlan, { captions })
    : await generateFacelessPlan({ idea, persona, targetSeconds, captions });

  const dir = await mkdtemp(join(tmpdir(), 'plotline-faceless-'));
  try {
    onStep('voice');
    const script = plan.scenes.map((scene) => scene.say).join(' ');
    const { audio, words } = await synthesizeWithTimestamps({ text: script, voiceId });
    const voicePath = join(dir, 'voice.mp3');
    await writeFile(voicePath, audio);

    const timeline = layoutFacelessTimelineFromTrack(plan, {
      path: voicePath,
      duration: words.length ? words[words.length - 1].end : 0,
      words,
    });

    const sfxDir = resolveFacelessSfxDir();
    const sfxTracks = timeline.sfx
      .map((s) => ({ path: join(sfxDir, `${s.name}.wav`), start: s.start, gain: s.gain }))
      .filter((track) => existsSync(track.path));

    const audioRaw = join(dir, 'mix.f32');
    await mixFacelessAudio([...timeline.voice.map((v) => ({ path: v.path, start: v.start, gain: 1 })), ...sfxTracks], timeline.duration, audioRaw);

    onStep('render');
    const output = join(dir, 'faceless.mp4');
    await enqueueRender(() => renderFacelessVideo({ html: buildFacelessHtml(timeline), timeline, audioRawPath: audioRaw, outputPath: output }));

    return { video: await readFile(output), plan, duration: timeline.duration };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Lance la generation en tache de fond ; la requete HTTP repond tout de suite. */
export function runFacelessVideoJob({ prisma, contentId, idea, persona, targetSeconds, captions, voiceId, previousStatus }) {
  (async () => {
    try {
      const { video, plan, duration } = await produceFacelessVideo({
        idea, persona, targetSeconds, captions, voiceId,
        onStep: (step) => console.log(`[faceless] contentId=${contentId} etape=${step}`),
      });
      const videoUrl = await saveGeneratedVideoBuffer(video, 'video_faceless');
      console.log(`[faceless] contentId=${contentId} termine (${duration.toFixed(1)} s, ${plan.scenes.length} scenes)`);

      await finalizeContentWithVersion(
        prisma,
        contentId,
        { imageUrl: videoUrl, caption: buildFacelessCaption(plan), status: 'PENDING', errorMessage: null },
        { generationModel: 'faceless' },
      );
    } catch (error) {
      console.warn(`[faceless] contentId=${contentId} echec : ${error?.message || error}`);
      await markGenerationFailure(prisma, contentId, {
        errorMessage: normalizeErrorMessage(error, 'faceless'),
        previousStatus,
      });
    }
  })();

  return { contentId, status: 'processing', model: 'faceless' };
}
