import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import { isAbsoluteHttpUrl, isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { finalizeContentWithVersion, markGenerationFailure } from './contentVersions.js';
import { synthesizeWithTimestamps } from './elevenLabsTts.js';
import { generateFacelessPlan, retouchFacelessPlan, sanitizeFacelessPlan, spokenTextChanged } from './facelessPlanGenerator.js';
import { mixFacelessAudio, renderFacelessVideo } from './facelessRenderer.js';
import { buildFacelessHtml } from './facelessTemplate.js';
import { layoutFacelessTimelineFromTrack } from './facelessTimeline.js';
import { getGeneratedDir, resolveMediaPath, toMediaUrl } from './mediaStorage.js';
import { normalizeErrorMessage, saveGeneratedVideoBuffer } from './videoGeneration.js';

/**
 * Video faceless de bout en bout, en tache de fond :
 * idee -> plan Claude -> voix ElevenLabs (temps des mots) -> timeline ->
 * page HTML -> capture image par image -> MP4 -> Blob -> nouvelle version.
 * Aucun modele de generation video.
 *
 * Chaque version garde un `renderSpec` (plan + voix + temps des mots) : une
 * retouche repart de la version active, et reutilise la voix telle quelle tant
 * que le texte dit ne change pas.
 */

export const RENDER_SPEC_KIND = 'faceless';

// Un rendu occupe Chromium et le processeur ~1 a 3 min : un seul a la fois.
let renderQueue = Promise.resolve();
function enqueueRender(task) {
  const run = renderQueue.then(task, task);
  renderQueue = run.catch(() => {});
  return run;
}

/**
 * Bruitages : par defaut les sons SYNTHETISES du depot (resources/faceless/sfx,
 * aucune licence tierce). FACELESS_SFX_DIR permet de pointer vers un autre pack
 * (memes noms de fichiers) -- sous la responsabilite de qui le fournit.
 */
export function resolveFacelessSfxDir() {
  const fromEnv = String(process.env.FACELESS_SFX_DIR || '').trim();
  return fromEnv ? resolve(fromEnv) : resolve(process.cwd(), 'resources/faceless/sfx');
}

/** Pur : legende du post (texte + hashtags). */
export function buildFacelessCaption(plan) {
  return [plan?.caption, (plan?.hashtags || []).join(' ')].filter(Boolean).join('\n\n') || null;
}

/** Pur : un renderSpec exploitable pour une retouche ? */
export function isFacelessRenderSpec(spec) {
  return spec?.kind === RENDER_SPEC_KIND
    && Array.isArray(spec?.plan?.scenes) && spec.plan.scenes.length > 0
    && Boolean(spec?.voiceUrl) && Array.isArray(spec?.words) && spec.words.length > 0;
}

async function saveFacelessVoice(buffer) {
  if (isBlobStorageEnabled()) {
    return (await uploadPublicMediaBuffer('generated', 'mp3', buffer, 'audio/mpeg')).url;
  }
  const filename = `voice_faceless_${Date.now()}.mp3`;
  await writeFile(join(getGeneratedDir(), filename), buffer);
  return toMediaUrl('generated', filename);
}

async function readFacelessVoice(voiceUrl) {
  const url = String(voiceUrl || '').trim();
  if (isAbsoluteHttpUrl(url)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Voix introuvable (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
  // Chemin disque absolu : seulement pour les essais en ligne de commande
  // (scripts/faceless-prototype/e2e.mjs) ; le serveur n ecrit jamais que des URL.
  if (isAbsolute(url) && !url.startsWith('/api/') && existsSync(url)) return readFile(url);
  const relative = url.replace(/^\/api\/media\//, '').split('/').map(decodeURIComponent).join('/');
  const absolute = resolveMediaPath(relative);
  if (!absolute) throw new Error('Adresse de voix invalide');
  return readFile(absolute);
}

/**
 * Montage seul, a partir d un plan et d une voix deja produite (aucun appel
 * Claude ni ElevenLabs). `voice` = { audio: Buffer mp3, words }.
 */
export async function renderFacelessFromPlan(plan, voice) {
  const dir = await mkdtemp(join(tmpdir(), 'plotline-faceless-'));
  try {
    const voicePath = join(dir, 'voice.mp3');
    await writeFile(voicePath, voice.audio);

    const words = voice.words;
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

    const output = join(dir, 'faceless.mp4');
    await enqueueRender(() => renderFacelessVideo({ html: buildFacelessHtml(timeline), timeline, audioRawPath: audioRaw, outputPath: output }));

    return { video: await readFile(output), duration: timeline.duration };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function synthesizePlanVoice(plan, voiceId) {
  const script = plan.scenes.map((scene) => scene.say).join(' ');
  return synthesizeWithTimestamps({ text: script, voiceId });
}

/**
 * Le pipeline complet (sans base de donnees) : renvoie le MP4, le plan et la
 * voix. `plan` deja ecrit (essai) : Claude n est pas rappele.
 */
export async function produceFacelessVideo({ idea, plan: givenPlan, persona, targetSeconds, captions, voiceId, onStep = () => {} } = {}) {
  onStep('plan');
  const plan = givenPlan
    ? sanitizeFacelessPlan(givenPlan, { captions })
    : await generateFacelessPlan({ idea, persona, targetSeconds, captions });

  onStep('voice');
  const voice = await synthesizePlanVoice(plan, voiceId);

  onStep('render');
  const { video, duration } = await renderFacelessFromPlan(plan, voice);
  return { video, plan, voice, duration };
}

/**
 * Retouche (sans base de donnees) : Claude modifie le plan selon la consigne ;
 * la voix est reutilisee si le texte dit n a pas bouge, sinon regeneree.
 */
export async function retouchFacelessVideo({ spec, instruction, persona, onStep = () => {} } = {}) {
  onStep('plan');
  const plan = await retouchFacelessPlan({
    plan: spec.plan, instruction, persona, targetSeconds: spec.targetSeconds, captions: spec.captions !== false,
  });

  const newVoice = spokenTextChanged(spec.plan, plan);
  onStep(newVoice ? 'voice' : 'voice-reused');
  const voice = newVoice
    ? await synthesizePlanVoice(plan, spec.voiceId)
    : { audio: await readFacelessVoice(spec.voiceUrl), words: spec.words };

  onStep('render');
  const { video, duration } = await renderFacelessFromPlan(plan, voice);
  return { video, plan, voice, newVoice, duration };
}

async function finalizeFaceless(prisma, contentId, { video, plan, voice, voiceUrl, duration, base }) {
  const videoUrl = await saveGeneratedVideoBuffer(video, 'video_faceless');
  const renderSpec = {
    ...base,
    kind: RENDER_SPEC_KIND,
    specVersion: 1,
    plan,
    voiceUrl,
    words: voice.words,
  };

  console.log(`[faceless] contentId=${contentId} termine (${duration.toFixed(1)} s, ${plan.scenes.length} scenes)`);
  await finalizeContentWithVersion(
    prisma,
    contentId,
    { imageUrl: videoUrl, caption: buildFacelessCaption(plan), status: 'PENDING', errorMessage: null },
    { generationModel: 'faceless', renderSpec },
  );
}

function inBackground(prisma, contentId, previousStatus, task) {
  (async () => {
    try {
      await task();
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

const logStep = (contentId) => (step) => console.log(`[faceless] contentId=${contentId} etape=${step}`);

/** Lance la generation en tache de fond ; la requete HTTP repond tout de suite. */
export function runFacelessVideoJob({ prisma, contentId, idea, persona, targetSeconds, captions, voiceId, previousStatus }) {
  return inBackground(prisma, contentId, previousStatus, async () => {
    const result = await produceFacelessVideo({ idea, persona, targetSeconds, captions, voiceId, onStep: logStep(contentId) });
    const voiceUrl = await saveFacelessVoice(result.voice.audio);
    await finalizeFaceless(prisma, contentId, {
      ...result,
      voiceUrl,
      base: { idea, voiceId, targetSeconds, captions, personaId: persona?.id || null },
    });
  });
}

/** Lance une retouche en tache de fond a partir du renderSpec de la version active. */
export function runFacelessRetouchJob({ prisma, contentId, spec, instruction, persona, previousStatus }) {
  return inBackground(prisma, contentId, previousStatus, async () => {
    const result = await retouchFacelessVideo({ spec, instruction, persona, onStep: logStep(contentId) });
    const voiceUrl = result.newVoice ? await saveFacelessVoice(result.voice.audio) : spec.voiceUrl;
    await finalizeFaceless(prisma, contentId, {
      ...result,
      voiceUrl,
      base: {
        idea: spec.idea,
        voiceId: spec.voiceId,
        targetSeconds: spec.targetSeconds,
        captions: spec.captions,
        personaId: spec.personaId || null,
        // Historique des consignes : utile pour comprendre une version (et a Claude plus tard).
        retouches: [...(Array.isArray(spec.retouches) ? spec.retouches : []), String(instruction).slice(0, 1000)].slice(-10),
      },
    });
  });
}
