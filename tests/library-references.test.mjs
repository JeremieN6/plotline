import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASSET_TYPE_NOUN,
  MAX_REFERENCE_IMAGES,
  RECOMMENDED_MAX_LIBRARY_ASSETS,
  buildReferenceLabelText,
  buildReferenceLegend,
  normalizeLibraryAssetIds,
  remainingReferenceSlots,
} from '../server/utils/libraryReferences.js';
import { ASSET_TYPES } from '../server/utils/referenceAssets.js';

test('constantes : 14 references au maximum, avertissement au-dela de 6 assets', () => {
  assert.equal(MAX_REFERENCE_IMAGES, 14);
  assert.equal(RECOMMENDED_MAX_LIBRARY_ASSETS, 6);
});

test('normalizeLibraryAssetIds : tout ce qui n est pas un tableau -> []', () => {
  for (const value of [undefined, null, 'abc', 12, {}, { 0: 'a' }, true]) {
    assert.deepEqual(normalizeLibraryAssetIds(value), []);
  }
});

test('normalizeLibraryAssetIds : chaines non vides, doublons retires, ordre conserve', () => {
  assert.deepEqual(normalizeLibraryAssetIds(['b', 'a', 'b', '', '  ', 3, null, ' a ', 'c']), ['b', 'a', 'c']);
  assert.deepEqual(normalizeLibraryAssetIds([]), []);
});

test('remainingReferenceSlots : les 4 combinaisons', () => {
  assert.equal(remainingReferenceSlots({ hasFaceRef: false, hasExtraReference: false }), 14);
  assert.equal(remainingReferenceSlots({ hasFaceRef: true, hasExtraReference: false }), 13);
  assert.equal(remainingReferenceSlots({ hasFaceRef: false, hasExtraReference: true }), 13);
  assert.equal(remainingReferenceSlots({ hasFaceRef: true, hasExtraReference: true }), 12);
  assert.equal(remainingReferenceSlots(), 14);
});

test('legende : prompt strictement inchange sans asset (aucune regression)', () => {
  const prompt = 'Elle marche dans la rue.';
  assert.equal(buildReferenceLegend({ prompt, hasFaceRef: true, hasExtraReference: true, libraryAssets: [] }), prompt);
  assert.equal(buildReferenceLegend({ prompt, hasFaceRef: true }), prompt);
  assert.equal(buildReferenceLegend({ prompt, libraryAssets: null }), prompt);
});

test('legende : numerotation avec face ref, packshot et assets, dans l ordre', () => {
  const text = buildReferenceLegend({
    prompt: 'Elle sort de CAR_arkana devant HOUSE_merlettes.',
    hasFaceRef: true,
    hasExtraReference: true,
    libraryAssets: [{ code: 'CAR_arkana', type: 'CAR' }, { code: 'HOUSE_merlettes', type: 'HOUSE' }],
  });
  assert.ok(text.startsWith('REFERENCE IMAGES, in the order they are attached:\nImage 1: reference sheet of the person'));
  assert.ok(text.includes('Image 2: product reference.'));
  assert.ok(text.includes('Image 3: CAR_arkana, a vehicle.'));
  assert.ok(text.includes('Image 4: HOUSE_merlettes, a house or building.'));
  assert.ok(text.endsWith('SCENE:\nElle sort de CAR_arkana devant HOUSE_merlettes.'));
});

test('legende : sans face ref ni packshot, la numerotation commence aux assets', () => {
  const text = buildReferenceLegend({ prompt: 'x', libraryAssets: [{ code: 'CAR_arkana', type: 'CAR' }] });
  assert.ok(text.includes('Image 1: CAR_arkana, a vehicle.'));
  assert.ok(!text.includes('reference sheet of the person'));
  assert.ok(!text.includes('product reference'));

  const withFace = buildReferenceLegend({ prompt: 'x', hasFaceRef: true, libraryAssets: [{ code: 'CAR_arkana', type: 'CAR' }] });
  assert.ok(withFace.includes('Image 2: CAR_arkana, a vehicle.'));
  assert.ok(!withFace.includes('product reference'));

  const withProduct = buildReferenceLegend({ prompt: 'x', hasExtraReference: true, libraryAssets: [{ code: 'CAR_arkana', type: 'CAR' }] });
  assert.ok(withProduct.includes('Image 1: product reference.'));
  assert.ok(withProduct.includes('Image 2: CAR_arkana, a vehicle.'));
});

test('legende : consigne anti-recopie de la planche presente', () => {
  const text = buildReferenceLegend({ prompt: 'x', libraryAssets: [{ code: 'CAR_a', type: 'CAR' }] });
  assert.ok(text.includes("Never reproduce a sheet's layout, panels, borders, background or any text"));
  assert.ok(text.includes('keeping its shape, colors, materials and details exactly as in its sheet'));
  // Un essai reel avait produit une capture d ecran d interface d appareil photo.
  assert.ok(text.includes('never a screenshot: no camera interface, no UI overlay'));
});

test('libelle par type : chaque type d asset a un nom, repli sur "an object"', () => {
  for (const { type } of ASSET_TYPES) assert.ok(ASSET_TYPE_NOUN[type], type);
  assert.equal(ASSET_TYPE_NOUN.CAR, 'a vehicle');
  assert.equal(ASSET_TYPE_NOUN.JEWEL, 'a piece of jewelry');
  const text = buildReferenceLegend({ prompt: 'x', libraryAssets: [{ code: 'ZZ_x', type: 'INCONNU' }] });
  assert.ok(text.includes('Image 1: ZZ_x, an object.'));
});

test('etiquette d image : "Image N: CODE"', () => {
  assert.equal(buildReferenceLabelText(3, 'CAR_arkana'), 'Image 3: CAR_arkana');
});

test('14 references au maximum : face ref + packshot + assets ne depasse jamais le plafond', () => {
  const slots = remainingReferenceSlots({ hasFaceRef: true, hasExtraReference: true });
  const assets = Array.from({ length: slots }, (_, i) => ({ code: `PROP_${i}`, type: 'PROP' }));
  const text = buildReferenceLegend({ prompt: 'x', hasFaceRef: true, hasExtraReference: true, libraryAssets: assets });
  assert.ok(text.includes(`Image ${MAX_REFERENCE_IMAGES}: PROP_${slots - 1}, an object.`));
  assert.ok(!text.includes(`Image ${MAX_REFERENCE_IMAGES + 1}:`));
});
