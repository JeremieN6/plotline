import test from 'node:test';
import assert from 'node:assert/strict';

import { ASSET_SHEET_COMMON_PROMPT, ASSET_SHEET_TYPE_PROMPTS } from '../server/data/assetSheetPrompts.js';
import { buildAssetSheetParts } from '../server/utils/assetSheetGeneration.js';
import {
  ASSET_SOURCE_ROLES,
  ASSET_TYPES,
  MAX_ASSETS_PER_ACCOUNT,
  MAX_SOURCE_IMAGES,
  MAX_UPLOAD_BYTES,
  buildAssetCode,
  getAssetSheetFallbackPrompt,
  getAssetSheetPrompt,
  getRolePromptLabel,
  normalizeAssetType,
  normalizeSourceRole,
  parseSources,
  slugifyAssetName,
} from '../server/utils/referenceAssets.js';

const ALL_TYPES = ['CAR', 'HOUSE', 'STREET', 'JEWEL', 'SHOES', 'HAT', 'PROP'];

test('les 7 types du lot 1 existent, avec un libellé français', () => {
  assert.deepEqual(ASSET_TYPES.map((item) => item.type), ALL_TYPES);
  assert.ok(ASSET_TYPES.every((item) => item.label.length > 0));
});

test('normalizeAssetType : accepte les types valides (casse libre), refuse le reste', () => {
  assert.equal(normalizeAssetType('car'), 'CAR');
  assert.equal(normalizeAssetType(' Jewel '), 'JEWEL');
  assert.equal(normalizeAssetType('PERSON'), null);
  assert.equal(normalizeAssetType(''), null);
  assert.equal(normalizeAssetType(undefined), null);
});

test('chaque type a des rôles, le premier est le défaut, OTHER existe partout', () => {
  for (const type of ALL_TYPES) {
    const roles = ASSET_SOURCE_ROLES[type];
    assert.ok(roles.length >= 3, `${type} a au moins 3 rôles`);
    assert.ok(roles.some((item) => item.role === 'OTHER'), `${type} a OTHER`);
    assert.ok(roles.every((item) => item.label && item.promptLabel), `${type} : libellés FR et anglais`);
    assert.equal(normalizeSourceRole(type, ''), roles[0].role, `${type} : défaut = premier rôle`);
  }
});

test('normalizeSourceRole : rôle valide conservé, invalide ou d\'un autre type = défaut', () => {
  assert.equal(normalizeSourceRole('CAR', 'interior'), 'INTERIOR');
  assert.equal(normalizeSourceRole('CAR', 'WORN'), 'EXTERIOR');
  assert.equal(normalizeSourceRole('JEWEL', 'WORN'), 'WORN');
  assert.equal(normalizeSourceRole('JEWEL', 'nimporte'), 'FRONT');
  assert.equal(normalizeSourceRole('STREET', 'WIDE'), 'WIDE');
  assert.equal(normalizeSourceRole('NOPE', 'EXTERIOR'), null);
});

test('getRolePromptLabel : libellé anglais pour Gemini, défaut si rôle invalide', () => {
  assert.equal(getRolePromptLabel('CAR', 'INTERIOR'), 'interior');
  assert.equal(getRolePromptLabel('JEWEL', 'DETAIL'), 'macro detail');
  assert.equal(getRolePromptLabel('CAR', 'inconnu'), 'exterior');
  assert.equal(getRolePromptLabel('NOPE', 'EXTERIOR'), null);
});

test('slugifyAssetName : accents, espaces, caractères spéciaux, nom vide ou très long', () => {
  assert.equal(slugifyAssetName('Arkana rouge'), 'arkana_rouge');
  assert.equal(slugifyAssetName('Château d\'Écouen'), 'chateau_d_ecouen');
  assert.equal(slugifyAssetName('  --Mon  bijou !!  '), 'mon_bijou');
  assert.equal(slugifyAssetName(''), null);
  assert.equal(slugifyAssetName('   '), null);
  assert.equal(slugifyAssetName('!!!'), null);
  assert.equal(slugifyAssetName(undefined), null);
  const long = slugifyAssetName('a'.repeat(100));
  assert.equal(long.length, 40);
  const cutOnSeparator = slugifyAssetName(`${'a'.repeat(39)} suite du nom`);
  assert.ok(!cutOnSeparator.endsWith('_'));
  assert.ok(cutOnSeparator.length <= 40);
});

test('buildAssetCode : TYPE_slug, null si type ou nom invalides', () => {
  assert.equal(buildAssetCode('CAR', 'Arkana rouge'), 'CAR_arkana_rouge');
  assert.equal(buildAssetCode('car', 'arkana'), 'CAR_arkana');
  assert.equal(buildAssetCode('NOPE', 'arkana'), null);
  assert.equal(buildAssetCode('CAR', '   '), null);
});

test('les prompts de fiche : un prompt par type, toujours précédé du bloc COMMON', () => {
  for (const type of ALL_TYPES) {
    assert.ok(ASSET_SHEET_TYPE_PROMPTS[type], `${type} a son bloc`);
    const prompt = getAssetSheetPrompt(type);
    assert.ok(prompt.startsWith(ASSET_SHEET_COMMON_PROMPT), `${type} commence par COMMON`);
    assert.ok(prompt.endsWith(ASSET_SHEET_TYPE_PROMPTS[type]), `${type} finit par son bloc`);
  }
  assert.equal(getAssetSheetPrompt('NOPE'), null);
  assert.ok(!getAssetSheetFallbackPrompt().includes(ASSET_SHEET_COMMON_PROMPT));
});

test('le bloc intérieur de CAR et HOUSE n\'est inclus que si une photo intérieur existe', () => {
  assert.match(ASSET_SHEET_TYPE_PROMPTS.CAR, /only if at least one photo is labelled interior/);
  assert.match(ASSET_SHEET_TYPE_PROMPTS.CAR, /otherwise omit the block entirely/);
  assert.match(ASSET_SHEET_TYPE_PROMPTS.HOUSE, /only if at least one photo is labelled interior/);
  assert.match(ASSET_SHEET_TYPE_PROMPTS.HOUSE, /otherwise omit the block entirely/);
});

test('parseSources : JSON valide, texte invalide, non-tableau, entrées sans url', () => {
  assert.deepEqual(parseSources([{ url: 'https://x/a.jpg', role: 'exterior' }]), [{ url: 'https://x/a.jpg', role: 'EXTERIOR' }]);
  assert.deepEqual(parseSources('[{"url":"/uploads/a.jpg","role":"INTERIOR"}]'), [{ url: '/uploads/a.jpg', role: 'INTERIOR' }]);
  assert.deepEqual(parseSources('pas du json'), []);
  assert.deepEqual(parseSources({ url: 'x' }), []);
  assert.deepEqual(parseSources(null), []);
  assert.deepEqual(parseSources([{ role: 'EXTERIOR' }, { url: '   ' }, null, 'texte', { url: 'https://x/b.jpg' }]), [
    { url: 'https://x/b.jpg', role: '' },
  ]);
});

test('constantes du lot 1', () => {
  assert.equal(MAX_ASSETS_PER_ACCOUNT, 100);
  assert.equal(MAX_SOURCE_IMAGES, 8);
  assert.equal(MAX_UPLOAD_BYTES, 10 * 1024 * 1024);
});

test('buildAssetSheetParts : texte puis image pour chaque photo, vrai type MIME, consigne finale', () => {
  const parts = buildAssetSheetParts('CAR', [
    { buffer: Buffer.from('aaa'), mimeType: 'image/png', role: 'EXTERIOR' },
    { buffer: Buffer.from('bbb'), mimeType: 'image/jpeg', role: 'INTERIOR' },
  ]);
  assert.equal(parts.length, 5);
  assert.equal(parts[0].text, 'Photo 1 of 2, shows: exterior.');
  assert.equal(parts[1].inlineData.mimeType, 'image/png');
  assert.equal(parts[1].inlineData.data, Buffer.from('aaa').toString('base64'));
  assert.equal(parts[2].text, 'Photo 2 of 2, shows: interior.');
  assert.equal(parts[3].inlineData.mimeType, 'image/jpeg');
  assert.equal(parts[4].text, 'Generate the reference sheet from these photos.');
});
