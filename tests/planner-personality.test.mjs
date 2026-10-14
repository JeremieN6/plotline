import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFallbackIdea } from '../server/utils/contentPlanner.js';
import { STORY_CLIP_NOTE, buildPlanSystemPrompt, buildPlanUserPrompt, mergeIdeasIntoSlots, parsePlanIdeas } from '../server/utils/planIdeaGenerator.js';
import { describeStoryCategory, pickPinterestKeyword } from '../server/utils/pinterestKeywordPicker.js';
import { PERSONALITY_BLOCKS } from '../server/data/personalityBlocks.js';
import { selectTargetFields } from '../server/utils/personalityGenerator.js';
import { buildPersonalityBrief } from '../server/utils/personalityBrief.js';
import {
  buildPlannerPersonalityBlock,
  buildPreferredForms,
  buildVisualUniverse,
  getContentPillars,
  getStoryKeywords,
  pillarForSlot,
} from '../server/utils/personalityPlanning.js';
import { describeAllFormatProductions, describeFormatProduction, getReelEngine } from '../server/utils/reelEngine.js';

const field = (value) => ({ value, origin: 'user' });
const personality = {
  version: 1,
  kind: 'PERSONA',
  eccentricity: 2,
  blocks: {
    voice: { tone: field('Sobre, précis, un peu sec'), bannedWords: field(['incroyable']) },
    editorial: {
      contentPillars: field(['La fiche d\'épisode', 'Voyage découverte à travers l\'Asie', 'Le contexte de production']),
      redLines: field(['Aucun top 10 sans critère']),
      preferredFormats: field(['Photo fixe avec légende longue', 'Carrousel 6 à 8 slides']),
    },
    appearance: { palette: field('Ivoire chaud, bordeaux passé'), recurringSets: field(['Station de bus 55', 'Le couloir']) },
    lore: { places: field(['Parc Laurier']) },
  },
};

const slots = [1, 2, 3, 4].map((position) => ({
  position,
  scheduledAt: new Date(Date.UTC(2026, 9, 14 + position, 9)),
  format: position === 2 ? 'REEL' : 'FEED',
  platform: 'INSTAGRAM',
}));

test('brief : un element de liste va jusqu a 100 caracteres, et piliers + promesse ne sautent plus sur une personnalite bien remplie', () => {
  const ninety = 'Pas de contenu sponsorise pour un produit qu elle ne possede pas physiquement, jamais, nulle part.';
  assert.ok(ninety.length > 90 && ninety.length <= 100);
  const long = 'x'.repeat(150);
  const full = {
    version: 1,
    kind: 'PERSONA',
    blocks: {
      voice: { tone: field('Sobre, précis, un peu sec. '.repeat(8)), humor: field('Pince-sans-rire. '.repeat(9)), address: field('Tutoie. '.repeat(25)) },
      editorial: {
        redLines: field([ninety, ninety, ninety, ninety, long]),
        contentPillars: field(Array.from({ length: 5 }, (_, i) => `Pilier ${i + 1} : ${'un contenu précis '.repeat(4)}`.slice(0, 90))),
        promise: field('Savoir lire un animé autrement qu en surface. '.repeat(5)),
      },
    },
  };
  const brief = buildPersonalityBrief(full);
  assert.ok(brief.includes(ninety), 'un element de 98 caracteres n est plus coupe');
  // Un element trop long est borne (par le registre a la normalisation, puis par le brief a 100 au plus).
  assert.ok(/x{50,}/.test(brief) && !/x{101,}/.test(brief));
  assert.match(brief, /Piliers de contenu/);
  assert.match(brief, /Promesse faite/);
  assert.ok(brief.length <= 2200);
});

test('mots-cles de stories : lus de la personnalite, bornes, vides sans donnees', () => {
  const withKeywords = {
    version: 1,
    kind: 'PERSONA',
    blocks: { editorial: { storyKeywords: field(['  video rainy window aesthetic ', 'video anime desk setup', '']) } },
  };
  assert.deepEqual(getStoryKeywords(withKeywords), ['video rainy window aesthetic', 'video anime desk setup']);
  assert.deepEqual(getStoryKeywords(personality), []);
  assert.deepEqual(getStoryKeywords(null), []);
});

test('mots-cles de stories : le champ existe pour les 3 types de profil et Claude ne le genere jamais', () => {
  for (const kind of Object.keys(PERSONALITY_BLOCKS)) {
    const fields = PERSONALITY_BLOCKS[kind].flatMap((block) => block.fields.map((f) => ({ block: block.key, ...f })));
    const found = fields.find((f) => f.block === 'editorial' && f.key === 'storyKeywords');
    assert.ok(found, `${kind} : champ storyKeywords`);
    assert.equal(found.curatedOnly, true);
    const targets = selectTargetFields(kind, { onlyBlocks: null, platforms: null, protectedFields: new Set() });
    assert.ok(!targets.some((t) => t.field.key === 'storyKeywords'), `${kind} : jamais genere`);
    assert.ok(targets.some((t) => t.field.key === 'contentPillars'), `${kind} : les autres champs restent generes`);
  }
});

test('choix du clip : les mots-cles de la persona priment pour une STORY, jamais pour un REEL, sinon la banque par categorie', async () => {
  const own = ['video rainy window aesthetic', 'video cozy cafe rain'];
  for (let i = 0; i < 20; i += 1) {
    const story = await pickPinterestKeyword({ format: 'STORY', niche: 'lifestyle', style: 'x', storyKeywords: own });
    assert.ok(own.includes(story.keyword), story.keyword);
  }
  const reel = await pickPinterestKeyword({ format: 'REEL', niche: 'lifestyle', storyKeywords: own });
  assert.ok(!own.includes(reel.keyword), 'un REEL garde la banque par categorie');
  const bank = await pickPinterestKeyword({ format: 'STORY', niche: 'lifestyle', storyKeywords: [] });
  assert.ok(bank.keyword.startsWith('video '), 'sans mots-cles propres : la banque');
  const blank = await pickPinterestKeyword({ format: 'STORY', niche: 'lifestyle', storyKeywords: ['  ', ''] });
  assert.ok(blank.keyword.startsWith('video '));
});

test('moteur REEL : faceless par defaut, legacy seulement sur demande explicite', () => {
  assert.equal(getReelEngine({}), 'faceless');
  assert.equal(getReelEngine({ REEL_ENGINE: '' }), 'faceless');
  assert.equal(getReelEngine({ REEL_ENGINE: 'n importe quoi' }), 'faceless');
  assert.equal(getReelEngine({ REEL_ENGINE: 'LEGACY' }), 'legacy');
});

test('libelles de production : REEL suit le moteur, STORY = clip Pinterest, format inconnu = rien', () => {
  assert.equal(describeFormatProduction('REEL', 'faceless'), 'Vidéo faceless');
  assert.equal(describeFormatProduction('reel', 'legacy'), 'Vidéo générée');
  assert.equal(describeFormatProduction('STORY'), 'Clip Pinterest');
  assert.equal(describeFormatProduction('FEED'), 'Image');
  assert.equal(describeFormatProduction('???'), null);
  assert.deepEqual(Object.keys(describeAllFormatProductions()), ['FEED', 'STORY', 'REEL', 'CUSTOM_PROMPT_STUDIO']);
});

test('piliers : lus tels que declares, sans filtre (le voyage reste), vides sans personnalite', () => {
  const pillars = getContentPillars(personality);
  assert.equal(pillars.length, 3);
  assert.ok(pillars.some((pillar) => /Voyage/.test(pillar)), 'aucun pilier n est ecarte');
  assert.deepEqual(getContentPillars(null), []);
  assert.deepEqual(getContentPillars({}), []);
  assert.deepEqual(getContentPillars('pas un objet'), []);
});

test('rotation des piliers : reguliere, et reprise d un plan a l autre grace au decalage', () => {
  const pillars = ['A', 'B', 'C'];
  assert.deepEqual([1, 2, 3, 4, 5].map((position) => pillarForSlot(pillars, position)), ['A', 'B', 'C', 'A', 'B']);
  // Un premier plan de 4 creneaux : le suivant (decalage 4) reprend a B, pas a A.
  assert.equal(pillarForSlot(pillars, 1, 4), 'B');
  assert.equal(pillarForSlot([], 1), '');
  assert.equal(pillarForSlot(pillars, 1, -5), 'A');
});

test('univers visuel et formes preferees : extraits, bornes, vides sans donnees', () => {
  const universe = buildVisualUniverse(personality);
  assert.match(universe, /palette : Ivoire chaud/);
  assert.match(universe, /Station de bus 55/);
  assert.match(universe, /Parc Laurier/);
  assert.match(buildPreferredForms(personality), /Carrousel/);
  assert.equal(buildVisualUniverse(null), '');
  assert.equal(buildPreferredForms({}), '');
  assert.equal(buildPlannerPersonalityBlock(null), '');
});

test('bloc personnalite du planificateur : voix + univers + formes, avec la consigne de ne pas inventer de format', () => {
  const block = buildPlannerPersonalityBlock(personality);
  assert.match(block, /Ton : Sobre/);
  assert.match(block, /Piliers de contenu/);
  assert.match(block, /Univers visuel/);
  assert.match(block, /sans jamais proposer un format absent/);
});

test('prompt systeme : sans personnalite et en legacy, identique a l ancien comportement', () => {
  const profile = { name: 'Usagi', niche: 'lifestyle', style: 'green eyes shy asian' };
  const prompt = buildPlanSystemPrompt(profile);
  assert.match(prompt, /Niche: lifestyle\./);
  assert.match(prompt, /Style visuel: green eyes shy asian\./);
  assert.match(prompt, /decrit la scene a generer en image ou video/);
  assert.doesNotMatch(prompt, /faceless|Piliers|pilier/);
  assert.equal(buildPlanSystemPrompt(profile), buildPlanSystemPrompt(profile, { personality: null, reelEngine: 'legacy' }));
});

test('prompt systeme : avec personnalite, la voix et les piliers entrent, l univers remplace le style physique', () => {
  const profile = { name: 'Usagi', niche: 'lifestyle', style: 'green eyes shy asian' };
  const prompt = buildPlanSystemPrompt(profile, { personality, reelEngine: 'faceless' });
  assert.match(prompt, /Ton : Sobre/);
  assert.match(prompt, /la personnalité ci-dessous prime/);
  assert.match(prompt, /Chaque creneau indique un pilier/);
  assert.match(prompt, /À éviter absolument : Aucun top 10/);
  assert.doesNotMatch(prompt, /green eyes shy asian/, 'le style physique n est plus presente comme style visuel');
  assert.match(prompt, /Univers visuel/);
});

test('prompt systeme : sans univers visuel, le champ style du profil est conserve', () => {
  const minimal = { version: 1, kind: 'PERSONA', blocks: { voice: { tone: field('Direct') } } };
  const prompt = buildPlanSystemPrompt({ name: 'X', niche: 'n', style: 'epure' }, { personality: minimal });
  assert.match(prompt, /Style visuel: epure\./);
  assert.doesNotMatch(prompt, /Chaque creneau indique un pilier/, 'pas de piliers declares : pas de consigne de pilier');
});

test('prompt systeme : le REEL faceless demande un sujet a raconter, pas une scene a filmer', () => {
  const prompt = buildPlanSystemPrompt({ name: 'X' }, { reelEngine: 'faceless' });
  assert.match(prompt, /REEL : une video faceless/);
  assert.match(prompt, /aucune scene a filmer/);
  assert.doesNotMatch(prompt, /STORY : une ambiance courte/, 'la STORY n a plus de scene decrite');
});

test('STORY : le prompt vient du code (clip automatique), Claude n ecrit que legende et hashtags', () => {
  for (const reelEngine of ['faceless', 'legacy']) {
    const prompt = buildPlanSystemPrompt({ name: 'X' }, { reelEngine });
    assert.match(prompt, /creneau STORY, le clip est choisi automatiquement/);
    assert.match(prompt, /laisse "prompt" vide/);
  }

  // Une STORY sans prompt mais avec legende est conservee (avant : ecartee).
  const ideas = parsePlanIdeas(JSON.stringify([
    { position: 2, prompt: '', caption: 'Un mardi de feuilles', hashtags: '#automne' },
    { position: 9, prompt: '', caption: '', hashtags: '' },
  ]));
  assert.equal(ideas.length, 1);

  const storySlots = [{ position: 2, scheduledAt: new Date(), format: 'STORY', platform: 'INSTAGRAM' }, ...slots.slice(0, 1)];
  const merged = mergeIdeasIntoSlots(storySlots, [
    { position: 2, prompt: 'Candid shot of a shy Asian young woman', caption: 'Un mardi de feuilles', hashtags: '#automne' },
  ], { name: 'Usagi', niche: 'x' });
  assert.equal(merged[0].prompt, STORY_CLIP_NOTE, 'meme si Claude a ecrit une scene avec une personne, elle n est pas conservee');
  assert.equal(merged[0].caption, 'Un mardi de feuilles');
  assert.equal(merged[1].format, 'FEED');
  assert.notEqual(merged[1].prompt, STORY_CLIP_NOTE);

  // Repli (Claude indisponible) : la STORY garde la note, pas une scene inventee.
  assert.equal(mergeIdeasIntoSlots(storySlots, [], { name: 'Usagi' })[0].prompt, STORY_CLIP_NOTE);
  // Un FEED dont Claude a laisse le prompt vide retombe sur l amorce, jamais sur du vide.
  const empty = mergeIdeasIntoSlots(slots.slice(0, 1), [{ position: 1, prompt: '', caption: 'c', hashtags: '' }], { name: 'Usagi', niche: 'n' });
  assert.ok(empty[0].prompt.length > 10);
});

test('categorie du clip des STORY : celle de la banque des stories, jamais une categorie qui n y existe pas', async () => {
  assert.equal(await describeStoryCategory({ niche: 'lifestyle', style: 'green eyes shy asian' }), 'lifestyle');
  assert.equal(await describeStoryCategory({ niche: 'plage, ete' }), 'beach');
  assert.equal(await describeStoryCategory({ niche: 'mode' }), 'outfit');
  // "anime" donne "cosplay" cote REEL, mais la banque des stories n a pas cette categorie.
  assert.equal(await describeStoryCategory({ niche: 'analyse anime' }), 'lifestyle');
  assert.equal(await describeStoryCategory({}), 'lifestyle');
});

test('prompt utilisateur : un pilier par creneau, rotation et reprise ; sans piliers la ligne est inchangee', () => {
  const pillars = getContentPillars(personality);
  const lines = buildPlanUserPrompt(slots, { pillars }).split('\n').filter((line) => line.startsWith('- position'));
  assert.match(lines[0], /pilier : La fiche d'épisode/);
  assert.match(lines[1], /pilier : Voyage découverte/);
  assert.match(lines[3], /pilier : La fiche d'épisode/, 'la rotation boucle');

  const next = buildPlanUserPrompt(slots, { pillars, pillarOffset: 4 }).split('\n').filter((line) => line.startsWith('- position'));
  assert.match(next[0], /pilier : Voyage découverte/, 'le plan suivant reprend apres le dernier pilier utilise');

  assert.doesNotMatch(buildPlanUserPrompt(slots), /pilier/);
});

test('idee de repli : un REEL faceless est un sujet a raconter, les autres cas ne changent pas', () => {
  const profile = { name: 'Usagi', niche: 'animé, analyse', style: 'sobre' };
  const faceless = buildFallbackIdea({ profile, format: 'REEL', position: 1, reelEngine: 'faceless' });
  assert.match(faceless.prompt, /Usagi explique un point précis autour de animé/);
  assert.equal(faceless.isFallback, true);

  const legacy = buildFallbackIdea({ profile, format: 'REEL', position: 1 });
  assert.match(legacy.prompt, /sequence courte et rythmee/);
  const feed = buildFallbackIdea({ profile, format: 'FEED', position: 1, reelEngine: 'faceless' });
  assert.match(feed.prompt, /scene posee/);

  const merged = mergeIdeasIntoSlots(slots, [], profile, { reelEngine: 'faceless' });
  assert.match(merged[1].prompt, /explique un point précis/);
});
