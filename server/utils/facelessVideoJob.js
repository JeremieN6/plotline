import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import { finalizeContentWithVersion, markGenerationFailure } from './contentVersions.js';
import { ELEVENLABS_V3_MODEL, synthesizeWithTimestamps } from './elevenLabsTts.js';
import { applyNewImages, collectNewImageRequests, generateFacelessPlan, restoreSpokenText, retouchFacelessPlan, sanitizeFacelessPlan, spokenTextChanged } from './facelessPlanGenerator.js';
import { facelessAssetFolder, generateIllustration } from './facelessIllustration.js';
import { loadPackAssets, readFacelessMedia, saveFacelessMedia } from './facelessMedia.js';
import { enqueueRender, mixFacelessAudio, renderFacelessVideo } from './facelessRenderer.js';
import { finalizeSfx, sfxPaletteKey } from './facelessSfxPlan.js';
import { engineSfx } from './facelessSfxEvents.js';
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

/** Pur : poses de la video (prioritaires : leur image ne change pas) + poses ajoutees au pack depuis. */
export function mergePackEntries(videoEntries, folderEntries) {
  const folder = folderEntries && typeof folderEntries === 'object' ? folderEntries : {};
  const video = videoEntries && typeof videoEntries === 'object' ? videoEntries : {};
  return { ...folder, ...video };
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
    // Palette de la DA, espacement et coupe des sons : voir facelessSfxPlan.js.
    const paletteKey = sfxPaletteKey(da);
    const sfxTracks = finalizeSfx([...timeline.sfx, ...engineSfx(timeline.scenes, da, paletteKey)], timeline.scenes, { paletteKey })
      .map((s) => ({ path: join(sfxDir, `${s.name}.wav`), start: s.start, gain: s.gain, kind: 'sfx', maxDur: s.maxDur }))
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

/**
 * Voix du script entier. `voice` : un identifiant de voix (voix de synthese) ou
 * { source: 'clone', voiceId, stability } (voix clonee : modele v3, le texte garde ses balises de ton).
 */
async function synthesizePlanVoice(plan, voice) {
  const settings = typeof voice === 'string' ? { voiceId: voice } : (voice || {});
  const script = plan.scenes.map((scene) => scene.say).join(' ');
  return synthesizeWithTimestamps({
    text: script,
    voiceId: settings.voiceId,
    modelId: settings.source === 'clone' ? ELEVENLABS_V3_MODEL : undefined,
    stability: settings.stability,
  });
}

/**
 * Genere les nouvelles images demandees par le plan (si le generateur est fourni) et les
 * range avec les illustrations disponibles. Une image qui n a pas pu etre generee ramene
 * sa scene en "avatar" (applyNewImages) : la video se fait quand meme. Commun aux deux
 * modes (voix de synthese et voix du createur). Sans demande, rien n est appele.
 */
export async function attachNewImages({ plan, illustrations = {}, generateNewIllustrations = null, onStep = () => {} } = {}) {
  const available = { ...illustrations };
  const requests = collectNewImageRequests(plan);
  if (!requests.length) return { plan, available };

  const generated = generateNewIllustrations ? (onStep('images'), await generateNewIllustrations(requests)) : [];
  const results = {};
  requests.forEach((request, i) => {
    const entry = generated[i];
    if (!entry) return;
    results[request.sceneIndex] = entry.id;
    available[entry.id] = { kind: entry.kind, label: entry.label, url: entry.url };
  });
  return { plan: applyNewImages(plan, results), available };
}

/**
 * Le pipeline complet (sans base de donnees) : renvoie le MP4, le plan et la
 * voix. `plan` deja ecrit (essai) : Claude n est pas rappele.
 */
export async function produceFacelessVideo({ idea, sourceText = '', direction = '', plan: givenPlan, persona, targetSeconds, captions, voiceId, voiceMode = 'synth', stability, style = null, illustrations = {}, maxNew = 0, generateNewIllustrations = null, onStep = () => {} } = {}) {
  const clone = voiceMode === 'clone';
  const da = style || normalizeFacelessStyle({});
  const packEntries = readyPackEntries(da);
  const packIds = Object.keys(packEntries);

  onStep('plan');
  let plan = givenPlan
    ? sanitizeFacelessPlan(givenPlan, { captions, packIds, illustrationIds: Object.keys(illustrations), maxNew, allowTags: clone })
    : await generateFacelessPlan({ idea, sourceText, direction, persona, targetSeconds, captions, style: da, packEntries, illustrations, maxNew, toneTags: clone });

  // Nouvelles images demandees par Claude (autorisees et plafonnees en amont) : generees AVANT la voix,
  // pour ne rien depenser de plus si une etape echoue.
  const attached = await attachNewImages({ plan, illustrations, generateNewIllustrations, onStep });
  plan = attached.plan;
  const available = attached.available;

  onStep('voice');
  const voiceSettings = clone ? { source: 'clone', voiceId, stability } : { source: 'synth', voiceId: voiceId || da.voiceId };
  const voice = await synthesizePlanVoice(plan, voiceSettings);

  onStep('render');
  const { video, duration } = await renderFacelessFromPlan(plan, voice, { style: da, packEntries, illustrations: available });
  return { video, plan, voice, voiceSettings, duration, style: da, packEntries, illustrationEntries: pickIllustrations(plan, available) };
}

/**
 * Retouche (sans base de donnees) : Claude modifie le plan selon la consigne ;
 * la voix est reutilisee si le texte dit n a pas bouge, sinon regeneree.
 * `rememberRule` : la consigne est aussi ajoutee aux regles de la DA.
 */
export async function retouchFacelessVideo({ spec, instruction, persona, rememberRule = false, folderIllustrations = {}, folderPackEntries = {}, onStep = () => {} } = {}) {
  let { style, packEntries } = styleFromSpec(spec);
  // Poses du pack generees APRES la video : elles deviennent utilisables. Celles deja dans la video gardent leur image (rien ne change d un cadre a l autre).
  packEntries = mergePackEntries(packEntries, folderPackEntries);
  // Images connues : celles du dossier aujourd hui + celles de la version retouchee (meme supprimees du dossier).
  const known = { ...folderIllustrations, ...(spec?.illustrationEntries && typeof spec.illustrationEntries === 'object' ? spec.illustrationEntries : {}) };
  if (rememberRule) style = appendStyleRule(style, instruction);
  const ownVoice = spec?.voiceSource === 'own';

  onStep('plan');
  const ownVoiceRefusal = 'Avec ta propre voix, une retouche ne peut pas changer ce qui est dit : seule la mise en scène change. Re-enregistre ta voix pour modifier le texte.';
  const retouched = await retouchFacelessPlan({
    plan: spec.plan,
    instruction: ownVoice ? `${instruction}\n(Contrainte : la voix est celle enregistree par le createur. Ne modifie, ne deplace et ne supprime aucun mot de aucun "say" ; tu peux seulement les repartir entre scenes. Les nombres restent ecrits comme ils sont dits dans les "say" (ex. "Vingt-deux") ; les chiffres (22, 11 %) ne s affichent que dans les textes a l ecran. Les reperes "at" citent un mot EXACT du "say".)` : instruction,
    persona, targetSeconds: spec.targetSeconds, captions: spec.captions !== false, style, packEntries, illustrations: known,
    // Voix clonee : le plan garde ses balises de ton, et une consigne de ton peut les changer.
    toneTags: spec?.voice?.source === 'clone',
  }).catch((error) => {
    // Devant une consigne qui exige de changer le texte, Claude repond parfois en prose au lieu d un plan.
    throw ownVoice && /sans JSON/.test(String(error?.message)) ? new Error(ownVoiceRefusal) : error;
  });

  // Ma voix : le texte dit est fige, on remet la forme exacte des mots d origine (meme nombre de mots seulement).
  const plan = ownVoice ? restoreSpokenText(retouched, spec.plan) : retouched;
  const newVoice = spokenTextChanged(spec.plan, plan);
  if (newVoice && ownVoice) throw new Error(ownVoiceRefusal);
  onStep(newVoice ? 'voice' : 'voice-reused');
  const voice = newVoice
    ? await synthesizePlanVoice(plan, spec.voice || spec.voiceId)
    : { audio: await readVoice(spec.voiceUrl), words: spec.words };

  onStep('render');
  const { video, duration } = await renderFacelessFromPlan(plan, voice, { style, packEntries, illustrations: known });
  return { video, plan, voice, newVoice, duration, style, packEntries, illustrationEntries: pickIllustrations(plan, known) };
}

export async function finalizeFaceless(prisma, contentId, { video, plan, voice, voiceUrl, duration, style, packEntries, illustrationEntries = {}, base, caption }) {
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
    // `caption` fourni = legende deja relue (idee d un plan editorial) : on la garde au lieu d en ecrire une autre.
    { imageUrl: videoUrl, caption: caption || buildFacelessCaption(plan), status: 'PENDING', errorMessage: null },
    { generationModel: 'faceless', renderSpec },
  );
}

/** Execute la tache ; un echec est consigne sur le contenu (statut FAILED), jamais propage. */
async function runSettled(prisma, contentId, previousStatus, task) {
  try {
    await task();
  } catch (error) {
    console.warn(`[faceless] contentId=${contentId} echec : ${error?.message || error}`);
    await markGenerationFailure(prisma, contentId, {
      errorMessage: normalizeErrorMessage(error, 'faceless'),
      previousStatus,
    });
  }
}

// Jobs en cours dans CE process : l arret du serveur les attend (voir le plugin
// faceless-shutdown), sinon un deploiement tue la generation en plein vol.
const activeJobs = new Set();

export function activeFacelessJobCount() {
  return activeJobs.size;
}

/** Attend la fin des jobs en cours, au plus `timeoutMs` ; renvoie le nombre encore actifs. */
export async function waitForActiveFacelessJobs(timeoutMs) {
  if (!activeJobs.size) return 0;
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); });
  await Promise.race([Promise.allSettled([...activeJobs]), timeout]);
  clearTimeout(timer);
  return activeJobs.size;
}

export function inBackground(prisma, contentId, previousStatus, task) {
  const job = runSettled(prisma, contentId, previousStatus, task).finally(() => activeJobs.delete(job));
  activeJobs.add(job);
  return { contentId, status: 'processing', model: 'faceless' };
}

export const logStep = (contentId) => (step) => console.log(`[faceless] contentId=${contentId} etape=${step}`);

function facelessVideoTask({ prisma, contentId, idea, sourceText = '', direction = '', plan = null, persona, targetSeconds, captions, voiceId, voiceMode = 'synth', stability, style, userId, illustrations = {}, maxNew = 0, caption }) {
  return async () => {
    const generateNewIllustrations = maxNew > 0 && persona && userId ? makeIllustrationGenerator({ prisma, userId, persona, style }) : null;
    const result = await produceFacelessVideo({
      idea, sourceText, direction, plan, persona, targetSeconds, captions, voiceId, voiceMode, stability, style, illustrations, maxNew, generateNewIllustrations, onStep: logStep(contentId),
    });
    const voiceUrl = await saveFacelessMedia(result.voice.audio, { folder: 'generated', extension: 'mp3', contentType: 'audio/mpeg' });
    await finalizeFaceless(prisma, contentId, {
      ...result,
      voiceUrl,
      caption,
      // Le texte source (un article entier) n est pas conserve dans le rendu : seule l idee l est.
      // `voice` : de quoi regenerer la meme voix (modele, voix clonee, stabilite) quand une retouche change le texte ou le ton.
      base: { idea: idea || String(sourceText || '').slice(0, 300), voiceId: voiceId || result.style.voiceId, voice: result.voiceSettings, targetSeconds, captions, personaId: persona?.id || null },
    });
  };
}

/** Lance la generation en tache de fond ; la requete HTTP repond tout de suite. */
export function runFacelessVideoJob(args) {
  return inBackground(args.prisma, args.contentId, args.previousStatus, facelessVideoTask(args));
}

/**
 * Meme generation, mais attend la fin (reussie ou en echec consigne) : pour les
 * enchainements en serie, ou lancer plusieurs rendus Chromium a la fois saturerait la machine.
 */
export async function runFacelessVideoJobAndWait(args) {
  await runSettled(args.prisma, args.contentId, args.previousStatus, facelessVideoTask(args));
  return { contentId: args.contentId, model: 'faceless' };
}

/** Lance une retouche en tache de fond a partir du renderSpec de la version active. */
export function runFacelessRetouchJob({ prisma, contentId, spec, instruction, persona, rememberRule = false, folderIllustrations = {}, folderPackEntries = {}, previousStatus }) {
  return inBackground(prisma, contentId, previousStatus, async () => {
    const result = await retouchFacelessVideo({ spec, instruction, persona, rememberRule, folderIllustrations, folderPackEntries, onStep: logStep(contentId) });
    const voiceUrl = result.newVoice
      ? await saveFacelessMedia(result.voice.audio, { folder: 'generated', extension: 'mp3', contentType: 'audio/mpeg' })
      : spec.voiceUrl;
    await finalizeFaceless(prisma, contentId, {
      ...result,
      voiceUrl,
      base: {
        idea: spec.idea,
        voiceId: spec.voiceId,
        voice: spec.voice || undefined,
        targetSeconds: spec.targetSeconds,
        captions: spec.captions,
        personaId: spec.personaId || null,
        // Historique des consignes : utile pour comprendre une version (et a Claude plus tard).
        retouches: [...(Array.isArray(spec.retouches) ? spec.retouches : []), String(instruction).slice(0, 1000)].slice(-10),
      },
    });
  });
}
