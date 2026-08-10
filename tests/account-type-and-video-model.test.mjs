import test from 'node:test';
import assert from 'node:assert/strict';

import { isAccountType, normalizeAccountType } from '../server/utils/accountType.js';
import { detectAspectRatioFromPrompt, resolveAspectRatio } from '../server/utils/aspectRatio.js';
import {
  buildFallbackIdea,
  buildPlanSlots,
  countSlots,
  normalizePublishHour,
  parseFormatRotation,
  platformForFormat,
} from '../server/utils/contentPlanner.js';
import { markGenerationFailure } from '../server/utils/contentVersions.js';
import { mergeIdeasIntoSlots, parsePlanIdeas } from '../server/utils/planIdeaGenerator.js';
import {
  buildSeedanceRequestBody,
  extractSeedanceTaskId,
  extractSeedanceVideoUrl,
  resolveGenerationType,
  resolveSeedanceApiBase,
  resolveSeedanceAspectRatio,
  resolveSeedanceResolution,
} from '../server/utils/seedanceGenerator.js';
import {
  describePublishFailure,
  findDuePublications,
  isRetryableFailure,
  resolvePublishTarget,
  runScheduledPublications,
} from '../server/utils/scheduledPublisher.js';
import { selectVideoModel } from '../server/utils/videoModelSelector.js';

test('normalizeAccountType normalizes to uppercase', () => {
  assert.equal(normalizeAccountType(' brand '), 'BRAND');
  assert.equal(normalizeAccountType('content_creator'), 'CONTENT_CREATOR');
});

test('isAccountType accepts only supported values', () => {
  assert.equal(isAccountType('INFLUENCER_CREATOR'), true);
  assert.equal(isAccountType('CONTENT_CREATOR'), true);
  assert.equal(isAccountType('BRAND'), true);
  assert.equal(isAccountType('OTHER'), false);
  assert.equal(isAccountType(''), false);
});

test('selectVideoModel chooses kling for dynamic prompt', () => {
  const model = selectVideoModel('A dynamic dance action scene with high energy movement');
  assert.equal(model, 'kling');
});

test('selectVideoModel chooses veo for cinematic prompt', () => {
  const model = selectVideoModel('A cinematic slow landscape with atmospheric ambiance');
  assert.equal(model, 'veo');
});

test('selectVideoModel defaults to veo', () => {
  const model = selectVideoModel('Create a clean product shot with studio lighting');
  assert.equal(model, 'veo');
});

test('selectVideoModel ne renvoie jamais seedance par defaut', () => {
  // Seedance reste un choix explicite tant qu il n a pas ete eprouve en production.
  const prompts = [
    'Create a clean product shot with studio lighting',
    'Une femme prepare un cafe dans sa cuisine',
    '',
  ];

  for (const prompt of prompts) {
    assert.notEqual(selectVideoModel(prompt), 'seedance');
  }
});

test('le ratio ecrit dans le prompt fait foi', () => {
  assert.equal(detectAspectRatioFromPrompt('Horizontal 16:9 format, beauty institute'), '16:9');
  assert.equal(detectAspectRatioFromPrompt('Vertical 9:16 portrait format video'), '9:16');
  assert.equal(detectAspectRatioFromPrompt('format 16/9 pour youtube'), '16:9');
  assert.equal(detectAspectRatioFromPrompt('square format product shot'), '1:1');
});

test('un decor ou un style ne sont pas pris pour un cadrage', () => {
  // "landscape" au sens paysage et "portrait" au sens photo de visage ne
  // doivent pas imposer un format: seule une mention qualifiee compte.
  assert.equal(detectAspectRatioFromPrompt('A cinematic landscape at sunset'), null);
  assert.equal(detectAspectRatioFromPrompt('Professional portrait photography'), null);
  assert.equal(detectAspectRatioFromPrompt('Une estheticienne tend un flacon'), null);
});

test('repli seulement quand le prompt ne dit rien', () => {
  assert.equal(resolveAspectRatio('Une scene simple'), '9:16');
  assert.equal(resolveAspectRatio('Horizontal 16:9 format'), '16:9');
});

test('seedance: on ne garde que l origine de SEEDANCE_API_URL', () => {
  // La variable a longtemps contenu une URL d endpoint complete: la reutiliser
  // telle quelle produirait des chemins doubles du type /v1/videos/v1/videos.
  assert.equal(resolveSeedanceApiBase(''), 'https://api.seevio.ai');
  assert.equal(resolveSeedanceApiBase('https://api.seevio.ai'), 'https://api.seevio.ai');
  assert.equal(resolveSeedanceApiBase('https://api.seevio.ai/v1/videos/generations'), 'https://api.seevio.ai');
  assert.equal(resolveSeedanceApiBase('pas-une-url'), 'https://api.seevio.ai');
});

test('seedance: le mode depend de la presence d une image de depart', () => {
  assert.equal(resolveGenerationType([]), 'text-to-video');
  assert.equal(resolveGenerationType(null), 'text-to-video');
  assert.equal(resolveGenerationType(['https://blob/frame.jpg']), 'image-to-video');
});

test('seedance: le corps de requete respecte le format attendu', () => {
  const textBody = buildSeedanceRequestBody({ prompt: 'Une scene', aspectRatio: '16:9' });
  assert.equal(textBody.model, 'seedance-2-5');
  assert.equal(textBody.input.generation_type, 'text-to-video');
  assert.equal(textBody.input.aspect_ratio, '16:9');
  // Sans image, la cle ne doit pas etre envoyee vide.
  assert.equal('image_urls' in textBody.input, false);

  const imageBody = buildSeedanceRequestBody({ prompt: 'Une scene', imageUrls: ['https://blob/frame.jpg'] });
  assert.equal(imageBody.input.generation_type, 'image-to-video');
  assert.deepEqual(imageBody.input.image_urls, ['https://blob/frame.jpg']);
});

test('seedance: la resolution est ramenee a une valeur supportee', () => {
  // Seedance 2.5 refuse la requete en 400 hors 480p/720p; 1080p etait envoye.
  assert.equal(resolveSeedanceResolution('1080p'), '720p');
  assert.equal(resolveSeedanceResolution('4k'), '720p');
  assert.equal(resolveSeedanceResolution(''), '720p');
  assert.equal(resolveSeedanceResolution('480p'), '480p');
  assert.equal(resolveSeedanceResolution('720p'), '720p');

  const body = buildSeedanceRequestBody({ prompt: 'Une scene', resolution: '1080p' });
  assert.equal(body.input.resolution, '720p');
});

test('seedance: en image-to-video le ratio doit valoir adaptive', () => {
  // L API refuse en 400 toute autre valeur dans ce mode: le cadrage vient de
  // l image de depart, elle-meme generee au format demande par le prompt.
  assert.equal(resolveSeedanceAspectRatio('image-to-video', '16:9'), 'adaptive');
  assert.equal(resolveSeedanceAspectRatio('text-to-video', '16:9'), '16:9');

  const imageBody = buildSeedanceRequestBody({
    prompt: 'Une scene',
    aspectRatio: '16:9',
    imageUrls: ['https://blob/frame.jpg'],
  });
  assert.equal(imageBody.input.aspect_ratio, 'adaptive');

  const textBody = buildSeedanceRequestBody({ prompt: 'Une scene', aspectRatio: '16:9' });
  assert.equal(textBody.input.aspect_ratio, '16:9');
});

// --- Planificateur editorial ------------------------------------------------

test('planner: la rotation de formats ecarte les valeurs inconnues', () => {
  assert.deepEqual(parseFormatRotation('FEED,REEL'), ['FEED', 'REEL']);
  assert.deepEqual(parseFormatRotation('feed | story'), ['FEED', 'STORY']);
  // Une valeur inconnue ne doit pas faire echouer toute la planification.
  assert.deepEqual(parseFormatRotation('FEED,PODCAST'), ['FEED']);
  assert.deepEqual(parseFormatRotation(''), ['FEED', 'STORY', 'REEL']);
  assert.deepEqual(parseFormatRotation('PODCAST'), ['FEED', 'STORY', 'REEL']);
});

test('planner: le format decide de la plateforme', () => {
  assert.equal(platformForFormat('REEL'), 'TIKTOK');
  assert.equal(platformForFormat('FEED'), 'INSTAGRAM');
  assert.equal(platformForFormat('STORY'), 'INSTAGRAM');
});

test('planner: le nombre de creneaux suit la cadence', () => {
  assert.equal(countSlots(7, 3), 3);
  assert.equal(countSlots(14, 3), 6);
  assert.equal(countSlots(30, 3), 13);
  // Une periode courte doit quand meme produire un creneau.
  assert.equal(countSlots(1, 1), 1);
  assert.equal(countSlots(0, 0), 1);
});

test('planner: les publications sont reparties, pas groupees', () => {
  const slots = buildPlanSlots({
    startDate: new Date('2026-08-10T00:00:00'),
    days: 7,
    postsPerWeek: 3,
    publishHour: 18,
  });

  assert.equal(slots.length, 3);

  const days = slots.map((slot) => slot.scheduledAt.getDate());
  assert.deepEqual(days, [10, 12, 15]);

  // Toutes a l heure de publication demandee.
  for (const slot of slots) {
    assert.equal(slot.scheduledAt.getHours(), 18);
  }
});

test('planner: la rotation reprend ou le profil l avait laissee', () => {
  const base = { startDate: new Date('2026-08-10T00:00:00'), days: 7, postsPerWeek: 3 };

  const fromStart = buildPlanSlots(base).map((slot) => slot.format);
  assert.deepEqual(fromStart, ['FEED', 'STORY', 'REEL']);

  const resumed = buildPlanSlots({ ...base, rotationOffset: 1 }).map((slot) => slot.format);
  assert.deepEqual(resumed, ['STORY', 'REEL', 'FEED']);

  // La plateforme suit le format, creneau par creneau.
  const slots = buildPlanSlots({ ...base, rotationOffset: 2 });
  assert.deepEqual(slots.map((slot) => slot.platform), ['TIKTOK', 'INSTAGRAM', 'INSTAGRAM']);
});

test('planner: une heure de publication invalide retombe sur la valeur par defaut', () => {
  assert.equal(normalizePublishHour(25), 18);
  assert.equal(normalizePublishHour(-1), 18);
  assert.equal(normalizePublishHour('abc'), 18);
  assert.equal(normalizePublishHour(9), 9);
  assert.equal(normalizePublishHour(0), 0);
});

test('planner: l idee de repli s appuie sur le profil', () => {
  const idea = buildFallbackIdea({
    profile: { name: 'Mélina', niche: 'beauté, skincare', style: 'épuré, premium' },
    format: 'REEL',
    position: 1,
  });

  assert.match(idea.prompt, /Mélina/);
  assert.match(idea.prompt, /beauté/);
  assert.match(idea.prompt, /épuré/);
  assert.equal(idea.isFallback, true);
});

test('planner: le JSON de Claude est isole meme entoure de texte', () => {
  const wrapped = 'Voici le plan :\n```json\n[{"position":1,"prompt":"Une scene","caption":"Bonjour","hashtags":"#a #b"}]\n```';
  const ideas = parsePlanIdeas(wrapped);

  assert.equal(ideas.length, 1);
  assert.equal(ideas[0].position, 1);
  assert.equal(ideas[0].prompt, 'Une scene');

  // Une reponse inexploitable ne doit pas lever, juste ne rien produire.
  assert.deepEqual(parsePlanIdeas('pas du json'), []);
  assert.deepEqual(parsePlanIdeas(''), []);
  // Une idee sans prompt n a aucune valeur: on l ecarte.
  assert.deepEqual(parsePlanIdeas('[{"position":1,"prompt":""}]'), []);
});

test('planner: un creneau sans idee recoit le repli deterministe', () => {
  const slots = [
    { position: 1, format: 'FEED', platform: 'INSTAGRAM', scheduledAt: new Date('2026-08-10T18:00:00') },
    { position: 2, format: 'REEL', platform: 'TIKTOK', scheduledAt: new Date('2026-08-12T18:00:00') },
  ];

  const merged = mergeIdeasIntoSlots(
    slots,
    [{ position: 1, prompt: 'Idee de Claude', caption: 'Legende', hashtags: '#x' }],
    { name: 'Mélina', niche: 'beauté', style: 'épuré' },
  );

  assert.equal(merged[0].prompt, 'Idee de Claude');
  assert.equal(merged[0].isFallback, false);

  // Le second creneau n a pas d idee: il reste rempli et editable.
  assert.equal(merged[1].isFallback, true);
  assert.match(merged[1].prompt, /Mélina/);
  assert.equal(merged[1].format, 'REEL');
});

// --- Echec de generation ----------------------------------------------------

test('un echec ne fait pas disparaitre un rendu encore valide', async () => {
  const rows = new Map([['c1', { id: 'c1', status: 'PROCESSING', imageUrl: 'https://blob/video.mp4' }]]);
  const prisma = {
    generatedContent: {
      findUnique: async ({ where }) => rows.get(where.id) || null,
      updateMany: async ({ where, data }) => {
        Object.assign(rows.get(where.id), data);
        return { count: 1 };
      },
    },
  };

  const result = await markGenerationFailure(prisma, 'c1', {
    errorMessage: 'Seedance a refuse la requete',
    previousStatus: 'PENDING',
  });

  assert.equal(result.keptPreviousRender, true);
  assert.equal(rows.get('c1').status, 'PENDING');
  assert.equal(rows.get('c1').errorMessage, 'Seedance a refuse la requete');
});

test('un echec sans aucun rendu reste bien en FAILED', async () => {
  const rows = new Map([['c2', { id: 'c2', status: 'PROCESSING', imageUrl: null }]]);
  const prisma = {
    generatedContent: {
      findUnique: async ({ where }) => rows.get(where.id) || null,
      updateMany: async ({ where, data }) => {
        Object.assign(rows.get(where.id), data);
        return { count: 1 };
      },
    },
  };

  const result = await markGenerationFailure(prisma, 'c2', {
    errorMessage: 'Fournisseur injoignable',
    previousStatus: 'PENDING',
  });

  assert.equal(result.keptPreviousRender, false);
  assert.equal(rows.get('c2').status, 'FAILED');
});

test('on ne restaure jamais le statut de passage PROCESSING', async () => {
  const rows = new Map([['c3', { id: 'c3', status: 'PROCESSING', imageUrl: 'https://blob/v.mp4' }]]);
  const prisma = {
    generatedContent: {
      findUnique: async ({ where }) => rows.get(where.id) || null,
      updateMany: async ({ where, data }) => {
        Object.assign(rows.get(where.id), data);
        return { count: 1 };
      },
    },
  };

  await markGenerationFailure(prisma, 'c3', { errorMessage: 'Boom', previousStatus: 'PROCESSING' });
  assert.equal(rows.get('c3').status, 'PENDING');
});

// --- Publicateur planifie ---------------------------------------------------

/**
 * Reproduit le sous-ensemble de Prisma utilise par le publicateur planifie.
 * `findMany` renvoie volontairement les objets d etat eux-memes, et non des
 * copies: le publicateur vide `scheduledAt` en base pour prendre la main, donc
 * ce faux prouve qu il ne relit pas cette valeur depuis l objet en memoire.
 */
function matchesWhere(row, where) {
  for (const [key, condition] of Object.entries(where)) {
    const value = row[key];

    if (condition === null) {
      if (value !== null && value !== undefined) return false;
      continue;
    }

    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('not' in condition) {
        if (condition.not === null && (value === null || value === undefined)) return false;
        if (condition.not !== null && value === condition.not) return false;
      }
      if ('lte' in condition && !(value instanceof Date && value <= condition.lte)) return false;
      continue;
    }

    if (value !== condition) return false;
  }

  return true;
}

function createFakePrisma(rows) {
  const state = new Map(rows.map((row) => [row.id, { ...row }]));

  return {
    state,
    generatedContent: {
      findMany: async ({ where, take }) => [...state.values()]
        .filter((row) => matchesWhere(row, where))
        .slice(0, take),
      updateMany: async ({ where, data }) => {
        const targets = [...state.values()].filter((row) => matchesWhere(row, where));
        targets.forEach((row) => Object.assign(row, data));
        return { count: targets.length };
      },
      update: async ({ where, data }) => {
        const row = state.get(where.id);
        if (!row) {
          const error = new Error('Not found');
          error.code = 'P2025';
          throw error;
        }
        Object.assign(row, data);
        return { ...row };
      },
    },
  };
}

function makeScheduledContent(overrides = {}) {
  return {
    id: 'content-1',
    status: 'VALIDATED',
    platform: 'INSTAGRAM',
    format: 'FEED',
    caption: 'Hello',
    imageUrl: 'https://blob/image.jpg',
    publishedAt: null,
    errorMessage: null,
    scheduledAt: new Date('2026-08-10T09:00:00Z'),
    influencer: { instagramAccountId: 'ig-1', instagramAccessToken: 'token' },
    ...overrides,
  };
}

test('planification: seules les publications echues et validees sont prises', async () => {
  const now = new Date('2026-08-10T10:00:00Z');
  const prisma = createFakePrisma([
    makeScheduledContent({ id: 'due' }),
    makeScheduledContent({ id: 'plus-tard', scheduledAt: new Date('2026-08-10T18:00:00Z') }),
    makeScheduledContent({ id: 'pas-valide', status: 'PENDING' }),
    makeScheduledContent({ id: 'deja-publie', publishedAt: new Date('2026-08-10T08:00:00Z') }),
    makeScheduledContent({ id: 'non-planifie', scheduledAt: null }),
  ]);

  const due = await findDuePublications(prisma, now);
  assert.deepEqual(due.map((row) => row.id), ['due']);
});

test('planification: TikTok est signale au lieu d attendre indefiniment', async () => {
  const now = new Date('2026-08-10T10:00:00Z');
  const prisma = createFakePrisma([makeScheduledContent({ platform: 'TIKTOK' })]);

  const summary = await runScheduledPublications({ prisma, baseUrl: 'https://plotline.test', now });
  const row = prisma.state.get('content-1');

  assert.equal(summary.results[0].outcome, 'unsupported');
  assert.equal(row.status, 'FAILED');
  assert.match(row.errorMessage, /TikTok/);
  // La date planifiee est restauree: le calendrier positionne les contenus dessus.
  assert.deepEqual(row.scheduledAt, new Date('2026-08-10T09:00:00Z'));
});

test('planification: un contenu deja traite n est pas repris au passage suivant', async () => {
  const now = new Date('2026-08-10T10:00:00Z');
  const prisma = createFakePrisma([makeScheduledContent({ platform: 'TIKTOK' })]);

  await runScheduledPublications({ prisma, baseUrl: 'https://plotline.test', now });
  const second = await runScheduledPublications({ prisma, baseUrl: 'https://plotline.test', now });

  assert.equal(second.results.length, 0);
});

test('planification: le ciblage de plateforme est explicite', () => {
  assert.equal(resolvePublishTarget('INSTAGRAM').supported, true);
  assert.equal(resolvePublishTarget('BOTH').supported, true);
  assert.equal(resolvePublishTarget('TIKTOK').supported, false);
  assert.equal(resolvePublishTarget('').supported, false);
});

test('planification: une config manquante ne se retente pas, une panne reseau oui', () => {
  assert.equal(isRetryableFailure({ code: 'MISSING_CREDENTIALS' }), false);
  assert.equal(isRetryableFailure({ code: 'MISSING_MEDIA' }), false);
  assert.equal(isRetryableFailure({ code: 'CONTAINER_ERROR' }), false);
  assert.equal(isRetryableFailure({ message: 'fetch failed' }), true);

  assert.equal(describePublishFailure({ message: 'Boom' }), 'Boom');
  assert.equal(describePublishFailure({}), 'Publication planifiee impossible');
});

test('seedance: taskId et url de video sont lus quelle que soit l enveloppe', () => {
  assert.equal(extractSeedanceTaskId({ taskId: 'a' }), 'a');
  assert.equal(extractSeedanceTaskId({ data: { task_id: 'b' } }), 'b');
  assert.equal(extractSeedanceTaskId({}), '');

  assert.equal(extractSeedanceVideoUrl({ data: { results: ['https://v/1.mp4'] } }), 'https://v/1.mp4');
  assert.equal(extractSeedanceVideoUrl({ data: { results: [{ url: 'https://v/2.mp4' }] } }), 'https://v/2.mp4');
  assert.equal(extractSeedanceVideoUrl({ data: { results: [] } }), '');
});
