import test from 'node:test';
import assert from 'node:assert/strict';

import { loadLibraryReferenceParts } from '../server/utils/libraryReferenceLoader.js';

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

const rows = [
  { id: 'a', userId: 'u1', code: 'CAR_arkana', type: 'CAR', sheetUrl: 'https://x/a.png' },
  { id: 'b', userId: 'u1', code: 'HOUSE_merlettes', type: 'HOUSE', sheetUrl: 'https://x/b.png' },
  { id: 'c', userId: 'u1', code: 'JEWEL_bague', type: 'JEWEL', sheetUrl: null },
  { id: 'd', userId: 'u2', code: 'CAR_autre', type: 'CAR', sheetUrl: 'https://x/d.png' },
];
const readImage = async (url) => ({ mimeType: 'image/png', buffer: Buffer.from(url) });

function quiet(fn) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  return fn(warnings).finally(() => { console.warn = original; });
}

test('chargeur : ordre demande, etiquette puis image, numerotation a partir de startIndex', async () => {
  const prisma = fakePrisma(rows);
  const { parts, assets } = await loadLibraryReferenceParts({ prisma, ids: ['b', 'a'], ownerUserId: 'u1', startIndex: 2, readImage });
  assert.deepEqual(assets, [{ code: 'HOUSE_merlettes', type: 'HOUSE' }, { code: 'CAR_arkana', type: 'CAR' }]);
  assert.equal(parts.length, 4);
  assert.deepEqual(parts[0], { text: 'Image 2: HOUSE_merlettes' });
  assert.equal(parts[1].inlineData.mimeType, 'image/png');
  assert.equal(Buffer.from(parts[1].inlineData.data, 'base64').toString(), 'https://x/b.png');
  assert.deepEqual(parts[2], { text: 'Image 3: CAR_arkana' });
  // la requete est filtree par proprietaire
  assert.equal(prisma.calls[0].where.userId, 'u1');
});

test('chargeur : sans identifiant ou sans proprietaire, rien n est lu', async () => {
  const prisma = fakePrisma(rows);
  assert.deepEqual(await loadLibraryReferenceParts({ prisma, ids: [], ownerUserId: 'u1', readImage }), { parts: [], assets: [] });
  await quiet(async (warnings) => {
    assert.deepEqual(await loadLibraryReferenceParts({ prisma, ids: ['a'], readImage }), { parts: [], assets: [] });
    assert.equal(warnings.length, 1);
  });
  assert.equal(prisma.calls.length, 0);
});

test('chargeur : asset d un autre compte, supprime ou sans fiche -> ignore avec un avertissement', async () => {
  await quiet(async (warnings) => {
    const prisma = fakePrisma(rows);
    const { assets } = await loadLibraryReferenceParts({ prisma, ids: ['d', 'zzz', 'c', 'a'], ownerUserId: 'u1', readImage });
    assert.deepEqual(assets, [{ code: 'CAR_arkana', type: 'CAR' }]);
    assert.equal(warnings.length, 3);
  });
});

test('chargeur : fiche illisible ignoree, plafond respecte', async () => {
  await quiet(async (warnings) => {
    const prisma = fakePrisma(rows);
    const failing = async (url) => {
      if (url.endsWith('a.png')) throw new Error('introuvable');
      return readImage(url);
    };
    const first = await loadLibraryReferenceParts({ prisma, ids: ['a', 'b'], ownerUserId: 'u1', readImage: failing });
    assert.deepEqual(first.assets.map((a) => a.code), ['HOUSE_merlettes']);

    const capped = await loadLibraryReferenceParts({ prisma, ids: ['a', 'b'], ownerUserId: 'u1', maxCount: 1, readImage });
    assert.deepEqual(capped.assets.map((a) => a.code), ['CAR_arkana']);
    assert.ok(warnings.length >= 2);
  });
});
