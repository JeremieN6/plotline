import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import { finalizeContentWithVersion, markGenerationFailure } from './contentVersions.js';
import { synthesizeWithTimestamps } from './elevenLabsTts.js';
import { applyNewImages, collectNewImageRequests, generateFacelessPlan, retouchFacelessPlan, sanitizeFacelessPlan, spokenTextChanged } from './facelessPlanGenerator.js';
import { facelessAssetFolder, generateIllustration } from './facelessIllustration.js';
import { loadPackAssets, readFacelessMedia, saveFacelessMedia } from './facelessMedia.js';
import { enqueueRender, mixFacelessAudio, renderFacelessVideo } from './facelessRenderer.js';
import { addIllustration, appendStyleRule, normalizeFacelessStyle, readyPackEntries } from './facelessStyle.js';
import { updateProfileStyle } from './facelessStyleStore.js';
import { generateImageFromGeminiWithSafetyFallback } from './geminiImageGeneration.js';
import { buildFacelessHtml } from './facelessTemplate.js';
import { layoutFacelessTimelineFromTrack } from './facelessTimeline.js';
import { normalizeErrorMessage, saveGeneratedVideoBuffer } from './videoGeneration.js';

/**
 * Video faceless de bout en bout, en tache de fond :
 * idee -> plan Claude -> voix ElevenLabs (temps des mots) -> timeline ->
 * page HTML -> capture image par image -> MP4 -> Blob -> nouvelle version.
 * Aucun modele de generation video.
 *
 * Chaque version garde un `renderSpec` (plan + voix + temps des mots + DA et
 * images d avatar du moment) : une retouche repart de la version active avec
 * la meme DA, et reutilise la voix tant que le texte dit ne change pas.
 */

export const RENDER_SPEC_KIND = 'faceless';

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

/** Pur : DA et images d avatar d un renderSpec (anciennes versions : DA par defaut). */
export function styleFromSpec(spec) {
  const style = normalizeFacelessStyle(spec?.style || {});
  const packEntries = spec?.packEntries && typeof spec.packEntries === 'object' ? spec.packEntries : {};
  return { style, packEntries };
}

async function readVoice(voiceUrl) {
  const url = String(voiceUrl || '').trim();
  // Chemin disque absolu : seulement pour les essais en ligne de commande
  // (scripts/faceless-prototype/e2e.mjs) ; le serveur n ecrit jamais que des URL.
  if (isAbsolute(url) && !url.startsWith('/api/') && existsSync(url)) return readFile(url);
  return readFacelessMedia(url);
}

/** Pur : les illustrations (parmi `available`) que le plan utilise reellement. */
export function pickIllustrations(plan, available) {
  const used = {};
  for (const scene of plan?.scenes || []) {
    if (scene?.image && available[scene.image]) used[scene.image] = available[scene.image];
  }
  return used;
}

/**
 * Generateur des NOUVELLES illustrations demandees par un plan (appels payants,
 * au plus le nombre autorise par l utilisateur). Chaque image reussie est rangee
 * dans le dossier de la persona (reutilisable) ; un echec n arrete pas la video :
 * la scene retombe sur une scene "avatar". `requests` : [{ kind, prompt }].
 * @returns {(requests: object[]) => Promise<Array<object|null>>}
 */
export function makeIllustrationGenerator({ prisma, userId, persona, style, concurrency = 2, deps = null }) {
  const effective = deps || {
    generate: generateImageFromGeminiWithSafetyFallback,
    save: (buffer, type) => saveFacelessMedia(buffer, { folder: facelessAssetFolder(persona.id, 'illustrations'), ...type }),
  };

  return async (requests) => {
    const results = new Array(requests.length).fill(null);
    let next = 0;
    const worker = async () => {
      while (next < requests.length) {
        const index = next;
        next += 1;
        try {
          const entry = await generateIllustration({ kind: requests[index].kind, prompt: requests[index].prompt, style, persona, deps: effective });
          results[index] = entry;
          // Rangee dans le dossier pour les prochaines videos ; si l ecriture echoue, l image sert quand meme a celle-ci.
          await updateProfileStyle(prisma, persona.id, userId, (current) => addIllustration(current, entry))
            .catch((error) => console.warn('[faceless] illustration non rangee dans le dossier :', error?.message));
        } catch (error) {
          console.warn(`[faceless] illustration en echec : ${error?.message || error}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, worker));
    return results;
  };
}

/**
 * Montage seul, a partir d un plan et d une voix deja produite (aucun appel
 * Claude ni ElevenLabs). `voice` = { audio: Buffer mp3, words }.
 */
export async function renderFacelessFromPlan(plan, voice, { style = null, packEntries = {}, illustrations = {} } = {}) {
  const da = style || normalizeFacelessStyle({});
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

    const assets = await loadPackAssets(plan, packEntries, undefined, illustrations);
    const output = join(dir, 'faceless.mp4');
    await enqueueRender(() => renderFacelessVideo({
      html: buildFacelessHtml(timeline, { style: da, packEntries, illustrations }), timeline, audioRawPath: audioRaw, outputPath: output, assets,
    }));

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
export async function produceFacelessVideo({ idea, plan: givenPlan, persona, targetSeconds, captions, voiceId, style = null, illustrations = {}, maxNew = 0, generateNewIllustrations = null, onStep = () => {} } = {}) {
  const da = style || normalizeFacelessStyle({});
  const packEntries = readyPackEntries(da);
  const packIds = Object.keys(packEntries);

  onStep('plan');
  let plan = givenPlan
    ? sanitizeFacelessPlan(givenPlan, { captions, packIds, illustrationIds: Object.keys(illustrations), maxNew })
    : await generateFacelessPlan({ idea, persona, targetSeconds, captions, style: da, packEntries, illustrations, maxNew });

  // Nouvelles images demandees par Claude (autorisees et plafonnees en amont) : generees AVANT la voix,
  // pour ne rien depenser de plus si une etape echoue.
  const available = { ...illustrations };
  const requests = collectNewImageRequests(plan);
  if (requests.length) {
    const generated = generateNewIllustrations ? (onStep('images'), await generateNewIllustrations(requests)) : [];
    const results = {};
    requests.forEach((request, i) => {
      const entry = generated[i];
      if (!entry) return;
      results[request.sceneIndex] = entry.id;
      available[entry.id] = { kind: entry.kind, label: entry.label, url: entry.url };
    });
    plan = applyNewImages(plan, results);
  }

  onStep('voice');
  const voice = await synthesizePlanVoice(plan, voiceId || da.voiceId);

  onStep('render');
  const { video, duration } = await renderFacelessFromPlan(plan, voice, { style: da, packEntries, illustrations: available });
  return { video, plan, voice, duration, style: da, packEntries, illustrationEntries: pickIllustrations(plan, available) };
}

/**
 * Retouche (sans base de donnees) : Claude modifie le plan selon la consigne ;
 * la voix est reutilisee si le texte dit n a pas bouge, sinon regeneree.
 * `rememberRule` : la consigne est aussi ajoutee aux regles de la DA.
 */
export async function retouchFacelessVideo({ spec, instruction, persona, rememberRule = false, folderIllustrations = {}, onStep = () => {} } = {}) {
  let { style, packEntries } = styleFromSpec(spec);
  // Images connues : celles du dossier aujourd hui + celles de la version retouchee (meme supprimees du dossier).
  const known = { ...folderIllustrations, ...(spec?.illustrationEntries && typeof spec.illustrationEntries === 'object' ? spec.illustrationEntries : {}) };
  if (rememberRule) style = appendStyleRule(style, instruction);

  onStep('plan');
  const plan = await retouchFacelessPlan({
    plan: spec.plan, instruction, persona, targetSeconds: spec.targetSeconds, captions: spec.captions !== false, style, packEntries, illustrations: known,
  });

  const newVoice = spokenTextChanged(spec.plan, plan);
  onStep(newVoice ? 'voice' : 'voice-reused');
  const voice = newVoice
    ? await synthesizePlanVoice(plan, spec.voiceId)
    : { audio: await readVoice(spec.voiceUrl), words: spec.words };

  onStep('render');
  const { video, duration } = await renderFacelessFromPlan(plan, voice, { style, packEntries, illustrations: known });
  return { video, plan, voice, newVoice, duration, style, packEntries, illustrationEntries: pickIllustrations(plan, known) };
}

async function finalizeFaceless(prisma, contentId, { video, plan, voice, voiceUrl, duration, style, packEntries, illustrationEntries = {}, base }) {
  const videoUrl = await saveGeneratedVideoBuffer(video, 'video_faceless');
  const renderSpec = {
    ...base,
    kind: RENDER_SPEC_KIND,
    specVersion: 2,
    plan,
    voiceUrl,
    words: voice.words,
    // DA et images d avatar du moment : une retouche garde exactement le meme style.
    style: { ...style, avatar: { ...style.avatar, pack: null } },
    packEntries,
    illustrationEntries,
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
export function runFacelessVideoJob({ prisma, contentId, idea, persona, targetSeconds, captions, voiceId, style, userId, illustrations = {}, maxNew = 0, previousStatus }) {
  return inBackground(prisma, contentId, previousStatus, async () => {
    const generateNewIllustrations = maxNew > 0 && persona && userId ? makeIllustrationGenerator({ prisma, userId, persona, style }) : null;
    const result = await produceFacelessVideo({
      idea, persona, targetSeconds, captions, voiceId, style, illustrations, maxNew, generateNewIllustrations, onStep: logStep(contentId),
    });
    const voiceUrl = await saveFacelessMedia(result.voice.audio, { folder: 'generated', extension: 'mp3', contentType: 'audio/mpeg' });
    await finalizeFaceless(prisma, contentId, {
      ...result,
      voiceUrl,
      base: { idea, voiceId: voiceId || result.style.voiceId, targetSeconds, captions, personaId: persona?.id || null },
    });
  });
}

/** Lance une retouche en tache de fond a partir du renderSpec de la version active. */
export function runFacelessRetouchJob({ prisma, contentId, spec, instruction, persona, rememberRule = false, folderIllustrations = {}, previousStatus }) {
  return inBackground(prisma, contentId, previousStatus, async () => {
    const result = await retouchFacelessVideo({ spec, instruction, persona, rememberRule, folderIllustrations, onStep: logStep(contentId) });
    const voiceUrl = result.newVoice
      ? await saveFacelessMedia(result.voice.audio, { folder: 'generated', extension: 'mp3', contentType: 'audio/mpeg' })
      : spec.voiceUrl;
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
