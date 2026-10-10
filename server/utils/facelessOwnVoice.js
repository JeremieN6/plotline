import Anthropic from '@anthropic-ai/sdk';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { transcribeWithScribe } from './elevenLabsStt.js';
import { resolveFfmpegPaths } from './ffmpegBinaries.js';
import {
  buildFacelessPlanSystemPrompt, parseFacelessPlanResponse, sanitizeFacelessPlan,
} from './facelessPlanGenerator.js';
import { finalizeFaceless, inBackground, logStep, pickIllustrations, renderFacelessFromPlan } from './facelessVideoJob.js';
import { saveFacelessMedia } from './facelessMedia.js';
import { normalizeFacelessStyle, readyPackEntries } from './facelessStyle.js';
import {
  OWN_VOICE_MAX_WORDS, buildCleaningSystemPrompt, buildCleaningUserPrompt, buildCutFilter, buildKeepSegments,
  keptIndices, normalizeCleaning, numberedTranscript, remapDirectives, splitIntoScenes, tokenizeTranscript,
} from './ownVoice.js';

const execFileAsync = promisify(execFile);
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_SCENES = 40;
const MAX_CHARS = 6000;

/** Pur : type de l enregistrement d apres sa signature (jamais d apres le nom envoye). */
export function detectAudioType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const ascii = (from, to) => buffer.subarray(from, to).toString('latin1');
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return { mime: 'audio/wav', extension: 'wav' };
  if (ascii(0, 3) === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return { mime: 'audio/mpeg', extension: 'mp3' };
  if (ascii(4, 8) === 'ftyp') return { mime: 'audio/mp4', extension: 'm4a' };
  if (ascii(0, 4) === 'OggS') return { mime: 'audio/ogg', extension: 'ogg' };
  if (ascii(0, 4) === 'fLaC') return { mime: 'audio/flac', extension: 'flac' };
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return { mime: 'audio/webm', extension: 'webm' };
  return null;
}

async function askClaude({ system, user, maxTokens, createMessage, apiKey }) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!createMessage && !key) throw new Error('ANTHROPIC_API_KEY non configuree');
  const request = {
    model: String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  };
  const response = await (createMessage ? createMessage(request) : new Anthropic({ apiKey: key }).messages.create(request));
  return parseFacelessPlanResponse((response?.content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('\n'));
}

/** Claude repere les ratés et les indications parlees. Si l appel echoue, on ne coupe rien. */
export async function cleanTranscript({ words, context = '', createMessage, apiKey } = {}) {
  try {
    const raw = await askClaude({
      system: buildCleaningSystemPrompt(), user: buildCleaningUserPrompt(words, context), maxTokens: 4096, createMessage, apiKey,
    });
    return normalizeCleaning(raw, words.length);
  } catch (error) {
    console.warn(`[faceless-voice] nettoyage par Claude impossible, aucune coupe : ${error?.message || error}`);
    return { cuts: [], directives: [] };
  }
}

/** Coupe l enregistrement et le renvoie en mp3. */
export async function cutAudio(audio, extension, segments) {
  const dir = await mkdtemp(join(tmpdir(), 'plotline-ownvoice-'));
  try {
    const { ffmpegPath } = resolveFfmpegPaths();
    const input = join(dir, `in.${extension}`);
    const output = join(dir, 'out.mp3');
    await writeFile(input, audio);
    await execFileAsync(ffmpegPath, [
      '-y', '-i', input, '-filter_complex', buildCutFilter(segments), '-map', '[out]',
      '-ar', '44100', '-ac', '1', '-b:a', '128k', output,
    ], { maxBuffer: 16 * 1024 * 1024 });
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function ownVoiceSection(scenes, directives) {
  return [
    '',
    'VOIX DU CREATEUR : MODE IMPOSE (remplace la partie "SCRIPT" ci-dessus)',
    'Le createur a ENREGISTRE sa propre voix. Tu n ecris donc AUCUN script : les scenes ci-dessous sont figees.',
    `- Renvoie EXACTEMENT ${scenes.length} scenes, dans cet ordre, une par scene ci-dessous. Recopie chaque "say" mot pour mot.`,
    '- Tu choisis seulement le montage de chaque scene (layout, textes a l ecran, avatar, fond, bruitages, captions), selon ce qui est dit.',
    '- Les reperes "at" citent des mots EXACTS du "say" de la scene. Le premier repere d une scene est a 0.',
    '- "title", "caption", "hashtags" : a toi de les ecrire d apres le contenu.',
    '',
    'SCENES FIGEES',
    ...scenes.map((s, i) => `${i + 1}. ${s.say}`),
    ...(directives.length ? [
      '',
      'INDICATIONS DE MONTAGE DONNEES A VOIX HAUTE PAR LE CREATEUR (a appliquer, elles ne sont plus dans le texte) :',
      ...directives.map((d) => `- avant la scene ${d.scene + 1} : ${d.instruction}`),
    ] : []),
  ].join('\n');
}

/**
 * Plan de montage pour des scenes figees (voix du createur). Les `say` sont ecrits
 * par le code, jamais par Claude : le decompte des mots reste exact.
 */
export async function generateOwnVoicePlan({ scenes, directives = [], idea = '', persona, captions = true, style = null, packEntries = null, illustrations = null, createMessage, apiKey } = {}) {
  const directiveLines = directives.map((d) => ({ ...d, scene: Math.max(0, scenes.findIndex((s) => d.atWord >= s.from && d.atWord <= s.to)) }));
  const system = [
    buildFacelessPlanSystemPrompt({ targetSeconds: 30, persona, captions, style, packEntries, illustrations, maxNew: 0 }),
    ownVoiceSection(scenes, directiveLines),
  ].join('\n');
  const user = idea ? `Sujet de la video :\n${String(idea).trim()}` : 'Monte cette video d apres les scenes figees.';

  const raw = await askClaude({ system, user, maxTokens: 12000, createMessage, apiKey });
  const given = Array.isArray(raw?.scenes) ? raw.scenes : [];
  // Une scene absente de la reponse devient une simple scene "avatar" : la video se fait quand meme.
  const merged = scenes.map((scene, i) => ({ ...(given[i] || { layout: 'avatar' }), say: scene.say }));

  return sanitizeFacelessPlan(
    { ...raw, scenes: merged },
    { captions, packIds: Object.keys(packEntries || {}), illustrationIds: Object.keys(illustrations || {}), maxNew: 0, maxScenes: MAX_SCENES, maxChars: MAX_CHARS },
  );
}

/**
 * Pipeline complet "ma voix" (sans base de donnees) :
 * transcription -> coupes (Claude) -> audio nettoye -> plan -> montage.
 * `deps` rend chaque etape reseau injectable (tests).
 */
export async function produceOwnVoiceVideo({ audio, idea = '', persona, captions = true, style = null, illustrations = {}, onStep = () => {}, deps = {} } = {}) {
  const type = detectAudioType(audio);
  if (!type) throw new Error('Format audio non reconnu (mp3, wav, m4a, ogg, flac ou webm)');
  const da = style || normalizeFacelessStyle({});
  const packEntries = readyPackEntries(da);
  const transcribe = deps.transcribe || transcribeWithScribe;
  const clean = deps.clean || cleanTranscript;
  const cut = deps.cut || cutAudio;
  const plan = deps.plan || generateOwnVoicePlan;
  const render = deps.render || renderFacelessFromPlan;

  onStep('transcription');
  const transcript = await transcribe({ audio, filename: `voix.${type.extension}`, contentType: type.mime });
  const words = tokenizeTranscript(transcript.words);
  if (words.length < 5) throw new Error('Presque rien n a ete reconnu dans l enregistrement (parle plus fort, ou verifie la langue)');
  if (words.length > OWN_VOICE_MAX_WORDS) throw new Error(`Enregistrement trop long (${words.length} mots, maximum ${OWN_VOICE_MAX_WORDS} : environ 4 minutes)`);

  onStep('nettoyage');
  const cleaning = await clean({ words, context: idea });
  const kept = keptIndices(words.length, cleaning.cuts);
  if (kept.length < 5) throw new Error('Il ne reste presque rien apres la suppression des ratés : enregistre une prise plus propre');

  const { segments, words: cleanWords } = buildKeepSegments(words, kept, { duration: words[words.length - 1].end + 1 });
  const cleaned = await cut(audio, type.extension, segments);

  onStep('plan');
  const sceneRanges = splitIntoScenes(cleanWords.map((w, i) => ({ ...w, i })));
  const directives = remapDirectives(cleaning.directives, kept);
  const montage = await plan({ scenes: sceneRanges, directives, idea, persona, captions, style: da, packEntries, illustrations });

  onStep('render');
  const voice = { audio: cleaned, words: cleanWords };
  const { video, duration } = await render(montage, voice, { style: da, packEntries, illustrations });

  return {
    video, plan: montage, voice, duration, style: da, packEntries, illustrationEntries: pickIllustrations(montage, illustrations),
    report: { wordsHeard: words.length, wordsKept: kept.length, cuts: cleaning.cuts, directives: cleaning.directives, transcript: numberedTranscript(words).slice(0, 4000) },
  };
}

/** Lance le montage "ma voix" en tache de fond ; la requete HTTP repond tout de suite. */
export function runOwnVoiceJob({ prisma, contentId, audio, idea, persona, captions, style, illustrations = {}, previousStatus }) {
  return inBackground(prisma, contentId, previousStatus, async () => {
    const result = await produceOwnVoiceVideo({ audio, idea, persona, captions, style, illustrations, onStep: logStep(contentId) });
    console.log(`[faceless-voice] contentId=${contentId} ${result.report.wordsHeard} mots entendus, ${result.report.wordsKept} gardes, ${result.report.cuts.length} coupe(s)`);
    const voiceUrl = await saveFacelessMedia(result.voice.audio, { folder: 'generated', extension: 'mp3', contentType: 'audio/mpeg' });
    await finalizeFaceless(prisma, contentId, {
      ...result,
      voiceUrl,
      base: {
        idea, voiceId: 'own', voiceSource: 'own', targetSeconds: Math.round(result.duration), captions, personaId: persona?.id || null,
        voiceReport: { wordsHeard: result.report.wordsHeard, wordsKept: result.report.wordsKept, cuts: result.report.cuts, directives: result.report.directives },
      },
    });
  });
}
