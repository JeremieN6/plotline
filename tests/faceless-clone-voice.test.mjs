import test from 'node:test';
import assert from 'node:assert/strict';

import { AUDIO_TAGS, hasAudioTags, listAudioTags, normalizeAudioTags, stripAudioTags } from '../server/utils/audioTags.js';
import { ELEVENLABS_V3_MODEL, V3_STABILITY, alignmentToWords, buildElevenLabsBody, listCloneVoices } from '../server/utils/elevenLabsTts.js';
import { assignWordsToScenes, countSpokenTokens } from '../server/utils/facelessTimeline.js';
import {
  buildFacelessPlanSystemPrompt,
  buildFacelessPlanUserPrompt,
  buildFacelessRetouchSystemPrompt,
  sanitizeFacelessPlan,
  spokenTextChanged,
} from '../server/utils/facelessPlanGenerator.js';
import { resolveVoiceChoice } from '../server/utils/facelessVoiceChoice.js';

const SAY = "[curious] Tu savais que 70 % des mails n'arrivent jamais ? [excited] Eh oui ! [sighs] Bref...";

test('balises : retrait pour compter, liste blanche pour garder', () => {
  assert.equal(stripAudioTags(SAY), "Tu savais que 70 % des mails n'arrivent jamais ? Eh oui ! Bref...");
  assert.equal(hasAudioTags(SAY), true);
  assert.equal(hasAudioTags('Salut tout le monde'), false);
  assert.deepEqual(listAudioTags(SAY), ['curious', 'excited', 'sighs']);

  // Une balise inventee est retiree (elle serait LUE), les connues passent en minuscules avec un espace derriere.
  assert.equal(normalizeAudioTags('[EXCITED]Bravo ! [lis-moi-a-voix-haute] Merci'), '[excited] Bravo ! Merci');
  // Une balise coupee en fin de texte n est pas une balise.
  assert.equal(normalizeAudioTags('Bravo [exci'), 'Bravo');
  // Un texte sans balise reste identique (espaces compris, typographie francaise comprise).
  assert.equal(normalizeAudioTags('Eh oui !'), 'Eh oui !');
  assert.ok(Object.keys(AUDIO_TAGS).includes('short pause'));
});

test('les balises ne comptent jamais comme des mots dits', () => {
  assert.equal(countSpokenTokens(SAY), 14);
  assert.equal(countSpokenTokens('[excited]'), 0);
  const scenes = [{ say: '[curious] Un deux ?' }, { say: '[serious] Trois quatre.' }];
  const words = ['Un', 'deux', '?', 'Trois', 'quatre.'].map((text, i) => ({ text, start: i, end: i + 1 }));
  // "?" seul est un mot (separe par un espace) : meme regle que le texte sans balise.
  assert.equal(assignWordsToScenes(scenes, words)[1].length, 2);
});

test('alignement : les balises du texte envoye n apparaissent pas parmi les mots', () => {
  const text = '[excited] Eh oui !';
  const chars = [...text];
  const alignment = {
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.1),
    character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
  };
  const words = alignmentToWords(alignment);
  assert.deepEqual(words.map((w) => w.text), ['Eh', 'oui', '!']);
  // Le premier mot commence apres la balise.
  assert.ok(words[0].start >= 0.9);
});

test('v3 : corps de requete (langue, stabilite a trois niveaux, pas de reglages v2)', () => {
  const body = buildElevenLabsBody({ text: ' Salut ', modelId: ELEVENLABS_V3_MODEL, stability: V3_STABILITY.creative });
  assert.equal(body.model_id, 'eleven_v3');
  assert.equal(body.language_code, 'fr');
  assert.deepEqual(body.voice_settings, { stability: 0 });
  assert.equal(body.text, 'Salut');
  assert.equal(buildElevenLabsBody({ text: 'x', modelId: ELEVENLABS_V3_MODEL, stability: 0.3 }).voice_settings.stability, 0.5, 'valeur interdite : naturel');
  // Les autres modeles gardent exactement leurs reglages d avant.
  assert.equal(buildElevenLabsBody({ text: 'x' }).voice_settings.use_speaker_boost, true);
});

test('voix clonees : seulement la categorie "cloned", jamais d exception', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ voices: [
    { voice_id: 'a', name: 'Jérémie', category: 'cloned' },
    { voice_id: 'b', name: 'Audrey', category: 'professional' },
    { voice_id: 'c', name: 'Roger', category: 'premade' },
  ] }) });
  assert.deepEqual(await listCloneVoices({ apiKey: 'k', fetchImpl, now: 10 ** 12 }), [{ id: 'a', name: 'Jérémie' }]);
  assert.deepEqual(await listCloneVoices({ apiKey: 'k', fetchImpl: async () => { throw new Error('reseau'); }, now: 2 * 10 ** 12 }), []);
});

test('choix de la voix : la voix clonee est reservee au proprietaire et limitee aux voix du compte', async () => {
  const listClones = async () => [{ id: 'clone-1', name: 'Jérémie' }];
  const style = { voiceId: 'bIHbv24MWmeRgasZH58o' };

  const forbidden = await resolveVoiceChoice({ body: { voiceMode: 'clone', voiceId: 'clone-1' }, user: { isAdmin: false }, style, listClones });
  assert.equal(forbidden.error.statusCode, 403);

  const unknown = await resolveVoiceChoice({ body: { voiceMode: 'clone', voiceId: 'celle-d-un-autre' }, user: { isAdmin: true }, style, listClones });
  assert.equal(unknown.error.statusCode, 400);

  const ok = await resolveVoiceChoice({ body: { voiceMode: 'clone', voiceStability: 'creative' }, user: { isAdmin: true }, style, listClones });
  assert.deepEqual(ok, { voiceMode: 'clone', voiceId: 'clone-1', stability: 0 });

  const none = await resolveVoiceChoice({ body: { voiceMode: 'clone' }, user: { isAdmin: true }, style, listClones: async () => [] });
  assert.equal(none.error.statusCode, 503);

  // Voix de synthese : comme avant (voix de la DA par defaut, voix inconnue refusee).
  assert.deepEqual(await resolveVoiceChoice({ body: {}, user: { isAdmin: false }, style, listClones }), { voiceMode: 'synth', voiceId: 'bIHbv24MWmeRgasZH58o' });
  assert.equal((await resolveVoiceChoice({ body: { voiceId: 'inconnue' }, user: {}, style, listClones })).error.statusCode, 400);
});

const planOf = (say) => ({ scenes: [{ say, layout: 'hook', text: 'Un **titre**' }, { say: 'Deuxième scène.', layout: 'avatar', text: 'Suite' }] });

test('plan : les balises sont gardees pour la voix clonee et retirees partout ailleurs', () => {
  const kept = sanitizeFacelessPlan(planOf(SAY), { allowTags: true });
  assert.equal(kept.scenes[0].say, SAY);

  const stripped = sanitizeFacelessPlan(planOf(SAY));
  assert.equal(stripped.scenes[0].say, "Tu savais que 70 % des mails n'arrivent jamais ? Eh oui ! Bref...");
  assert.ok(stripped.scenes.every((scene) => !scene.say.includes('[')));

  // Une balise inventee n est jamais conservee, meme pour la voix clonee.
  assert.doesNotMatch(sanitizeFacelessPlan(planOf('[hurle-comme-un-loup] Salut'), { allowTags: true }).scenes[0].say, /\[/);
});

test('changer une balise change le texte dit (la voix est regeneree), pas un simple espace', () => {
  const a = sanitizeFacelessPlan(planOf('[excited] Salut tout le monde.'), { allowTags: true });
  const b = sanitizeFacelessPlan(planOf('[serious] Salut tout le monde.'), { allowTags: true });
  assert.equal(spokenTextChanged(a, b), true);
  assert.equal(spokenTextChanged(a, sanitizeFacelessPlan(planOf('[excited]   Salut   tout le monde.'), { allowTags: true })), false);
});

test('prompts : consignes de ton seulement pour la voix clonee, directives du createur prioritaires', () => {
  assert.match(buildFacelessPlanSystemPrompt({ toneTags: true }), /TON DE LA VOIX/);
  assert.match(buildFacelessPlanSystemPrompt({ toneTags: true }), /\[excited\]/);
  assert.match(buildFacelessPlanSystemPrompt({ toneTags: true }), /mou/);
  assert.doesNotMatch(buildFacelessPlanSystemPrompt({}), /TON DE LA VOIX/);
  assert.match(buildFacelessRetouchSystemPrompt({ toneTags: true }), /consigne de TON/);
  assert.doesNotMatch(buildFacelessRetouchSystemPrompt({}), /consigne de TON/);

  const plain = buildFacelessPlanUserPrompt('Mon idée');
  assert.equal(plain, 'Idee de la video :\nMon idée');
  const directed = buildFacelessPlanUserPrompt('Mon idée', '', 'Accroche agressive, fond sombre sur le chiffre');
  assert.match(directed, /DIRECTIVES DU CREATEUR/);
  assert.match(directed, /fond sombre sur le chiffre/);
  assert.match(buildFacelessPlanUserPrompt('Consigne', 'Un article assez long pour compter.', 'Plus clivant'), /Plus clivant/);
});

test('voix par defaut des articles : clone du proprietaire, sinon voix de la DA', async () => {
  const { resolveOwnerCloneVoice } = await import('../server/utils/facelessVoiceChoice.js');
  const listClones = async () => [{ id: 'clone1', name: 'Moi' }];
  const isAdmin = (email) => email === 'moi@x.fr';

  // Articles : sans voix designee, l unique voix clonee du compte.
  const owner = await resolveOwnerCloneVoice({ ownerEmail: 'moi@x.fr', singleFallback: true, listClones, isAdmin });
  assert.deepEqual(owner, { voiceMode: 'clone', voiceId: 'clone1', stability: V3_STABILITY.natural });
  // Calendrier : jamais de repli, seule une voix designee par la DA compte.
  assert.equal(await resolveOwnerCloneVoice({ ownerEmail: 'moi@x.fr', listClones, isAdmin }), null);

  assert.equal(await resolveOwnerCloneVoice({ ownerEmail: 'autre@x.fr', singleFallback: true, listClones, isAdmin }), null);
  assert.equal(await resolveOwnerCloneVoice({ ownerEmail: 'moi@x.fr', singleFallback: true, listClones: async () => [], isAdmin }), null);
  assert.equal(await resolveOwnerCloneVoice({ ownerEmail: 'moi@x.fr', singleFallback: true, listClones, isAdmin, mode: 'synth' }), null);
  assert.equal(await resolveOwnerCloneVoice({ ownerEmail: 'moi@x.fr', singleFallback: true, listClones: async () => { throw new Error('x'); }, isAdmin }), null);
});

test('voix clonee designee par la DA : la bonne voix, jamais « la premiere » quand il y en a deux', async () => {
  const { resolveOwnerCloneVoice } = await import('../server/utils/facelessVoiceChoice.js');
  const { normalizeFacelessStyle } = await import('../server/utils/facelessStyle.js');
  const listClones = async () => [{ id: 'JeremieVoice1', name: 'Jérémie' }, { id: 'AmandineVoice', name: 'Amandine' }];
  const isAdmin = () => true;

  const amandine = await resolveOwnerCloneVoice({ ownerEmail: 'a@x.fr', style: { cloneVoiceId: 'AmandineVoice' }, listClones, isAdmin });
  assert.equal(amandine.voiceId, 'AmandineVoice');
  // Deux voix et aucun choix : ambigu, donc la voix de synthese de la DA (null), meme pour les articles.
  assert.equal(await resolveOwnerCloneVoice({ ownerEmail: 'a@x.fr', singleFallback: true, listClones, isAdmin }), null);
  // Une voix designee mais disparue du compte : pas de voix au hasard.
  assert.equal(await resolveOwnerCloneVoice({ ownerEmail: 'a@x.fr', style: { cloneVoiceId: 'Supprimee1234' }, singleFallback: true, listClones, isAdmin }), null);

  // Dans la DA : un identifiant bien forme est garde, le reste devient « aucune ».
  assert.equal(normalizeFacelessStyle({ cloneVoiceId: 'AmandineVoice' }).cloneVoiceId, 'AmandineVoice');
  assert.equal(normalizeFacelessStyle({ cloneVoiceId: 'a b; drop table' }).cloneVoiceId, '');
  assert.equal(normalizeFacelessStyle({}).cloneVoiceId, '');
});
