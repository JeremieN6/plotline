import test from 'node:test';
import assert from 'node:assert/strict';

import { WIDGETS } from '../server/data/widgets.js';
import { loadLibraryAssetBriefs } from '../server/utils/libraryReferenceLoader.js';
import { buildLibraryAssetsPromptBlock } from '../server/utils/libraryReferences.js';
import { buildPromptAssistSystemPrompt } from '../server/utils/promptAssistGenerator.js';
import { buildWidgetFieldsSystemPrompt } from '../server/utils/widgetFieldsAssistGenerator.js';

const portrait = WIDGETS.find((widget) => widget.id === 'PORTRAIT_STUDIO');
const assets = [{ code: 'CAR_audi_rsq3_noir', type: 'CAR' }, { code: 'HOUSE_maison_luxe', type: 'HOUSE' }];

test('bloc des assistants : codes et types dans l ordre, consigne de les citer sans decrire leur apparence', () => {
  const block = buildLibraryAssetsPromptBlock(assets);
  assert.ok(block.includes('- CAR_audi_rsq3_noir : a vehicle'));
  assert.ok(block.includes('- HOUSE_maison_luxe : a house or building'));
  assert.ok(block.indexOf('CAR_audi_rsq3_noir') < block.indexOf('HOUSE_maison_luxe'));
  assert.ok(block.includes('code EXACT'));
  assert.ok(block.includes('N invente jamais d autre code'));
});

test('bloc des assistants : vide sans asset (le prompt des assistants reste identique)', () => {
  for (const value of [undefined, null, [], 'x']) assert.equal(buildLibraryAssetsPromptBlock(value), '');
});

test('assistant des champs de widget : codes ajoutes seulement s il y a des assets', () => {
  const without = buildWidgetFieldsSystemPrompt({ widget: portrait, personaDescription: 'Madison' });
  assert.ok(!without.includes('Assets de la bibliotheque'));
  assert.equal(buildWidgetFieldsSystemPrompt({ widget: portrait, personaDescription: 'Madison', libraryAssets: [] }), without);

  const withAssets = buildWidgetFieldsSystemPrompt({ widget: portrait, personaDescription: 'Madison', libraryAssets: assets });
  assert.ok(withAssets.includes('CAR_audi_rsq3_noir') && withAssets.includes('HOUSE_maison_luxe'));
  assert.ok(withAssets.startsWith(without.split('\n\nReponds uniquement')[0]), 'le debut du prompt est inchange');
  assert.ok(withAssets.includes('Reponds uniquement avec un objet JSON brut'), 'la consigne de format reste en dernier');
});

test('assistant du prompt libre : codes pour une image, jamais pour une video, inchange sans asset', () => {
  const imageBase = buildPromptAssistSystemPrompt({ mediaType: 'image' });
  assert.ok(!imageBase.includes('Assets de la bibliotheque'));
  assert.equal(buildPromptAssistSystemPrompt({ mediaType: 'image', libraryAssets: [] }), imageBase);

  const image = buildPromptAssistSystemPrompt({ mediaType: 'image', libraryAssets: assets });
  assert.ok(image.includes('CAR_audi_rsq3_noir'));
  assert.ok(image.trimEnd().endsWith('Forme exacte : {"prompt": string}'));

  const video = buildPromptAssistSystemPrompt({ mediaType: 'video', libraryAssets: assets });
  assert.ok(!video.includes('CAR_audi_rsq3_noir'), 'aucune video dans ce lot');
  assert.equal(video, buildPromptAssistSystemPrompt({ mediaType: 'video' }));
});

function fakePrisma(rows) {
  const calls = [];
  return {
    calls,
    referenceAsset: {
      async findMany(args) {
        calls.push(args);
        return rows.filter((row) => args.where.id.in.includes(row.id) && row.userId === args.where.userId);
      },
    },
  };
}

test('chargement des codes : par compte, dans l ordre demande, sans fiche ou inconnu ignore', async () => {
  const rows = [
    { id: 'a', userId: 'u1', code: 'CAR_arkana', type: 'CAR', sheetUrl: 'https://x/a.png' },
    { id: 'b', userId: 'u1', code: 'HOUSE_merlettes', type: 'HOUSE', sheetUrl: 'https://x/b.png' },
    { id: 'c', userId: 'u1', code: 'JEWEL_bague', type: 'JEWEL', sheetUrl: null },
    { id: 'd', userId: 'u2', code: 'CAR_autre', type: 'CAR', sheetUrl: 'https://x/d.png' },
  ];
  const prisma = fakePrisma(rows);
  const briefs = await loadLibraryAssetBriefs({ prisma, ids: ['b', 'c', 'd', 'zzz', 'a'], ownerUserId: 'u1' });
  assert.deepEqual(briefs, [{ code: 'HOUSE_merlettes', type: 'HOUSE' }, { code: 'CAR_arkana', type: 'CAR' }]);
  assert.equal(prisma.calls[0].where.userId, 'u1');

  const none = fakePrisma(rows);
  assert.deepEqual(await loadLibraryAssetBriefs({ prisma: none, ids: [], ownerUserId: 'u1' }), []);
  assert.deepEqual(await loadLibraryAssetBriefs({ prisma: none, ids: ['a'] }), []);
  assert.equal(none.calls.length, 0);
});
