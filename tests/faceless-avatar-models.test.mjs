import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PACK_MODEL,
  IMAGE_MODELS,
  LEGACY_IMAGE_MODEL,
  describeImageModels,
  findImageModel,
  imageCostUsd,
  resolvePackModel,
} from '../server/data/imageModels.js';
import {
  AVATAR_PACK_CATALOG,
  IMAGE_COST_USD,
  catalogForGender,
  estimatePackCostUsd,
  findCatalogEntry,
  isEntryAvailable,
} from '../server/data/facelessAvatarCatalog.js';
import { buildEntryPrompt, describePackCost, validatePackIds } from '../server/utils/facelessAvatarPack.js';
import {
  MAX_STYLE_CHARS,
  buildStyleDescriptionPrompt,
  cleanStyleDescription,
  describeAvatarStyle,
} from '../server/utils/facelessAvatarStyleDescriber.js';

test('modeles d image : defaut Flash 3.1, le modele historique reste connu', () => {
  assert.equal(DEFAULT_PACK_MODEL, 'gemini-3.1-flash-image');
  assert.ok(findImageModel(LEGACY_IMAGE_MODEL));
  assert.equal(IMAGE_MODELS.length, 3);
  assert.equal(describeImageModels().every((model) => model.id && model.label && model.costUsd > 0 && model.note), true);
});

test('resolvePackModel : demande valide > variable d environnement > defaut ; jamais un identifiant inconnu', () => {
  assert.equal(resolvePackModel('gemini-3-pro-image-preview', ''), 'gemini-3-pro-image-preview');
  assert.equal(resolvePackModel('', 'gemini-2.5-flash-image'), 'gemini-2.5-flash-image');
  assert.equal(resolvePackModel('', ''), DEFAULT_PACK_MODEL);
  assert.equal(resolvePackModel('un-modele-invente', 'autre-invente'), DEFAULT_PACK_MODEL);
  // Une demande valide prime sur la variable d environnement.
  assert.equal(resolvePackModel('gemini-3.1-flash-image', 'gemini-2.5-flash-image'), 'gemini-3.1-flash-image');
});

test('imageCostUsd : tarif par modele, tarif historique pour un modele inconnu', () => {
  assert.equal(imageCostUsd('gemini-2.5-flash-image') < imageCostUsd('gemini-3.1-flash-image'), true);
  assert.equal(imageCostUsd('gemini-3.1-flash-image') < imageCostUsd('gemini-3-pro-image-preview'), true);
  assert.equal(imageCostUsd('inconnu'), IMAGE_COST_USD);
});

test('cout du pack : suit le modele ; sans modele, tarif historique inchange', () => {
  assert.equal(estimatePackCostUsd(10), 1.34);
  assert.equal(estimatePackCostUsd(28, imageCostUsd('gemini-3.1-flash-image')), 1.88);
  assert.equal(describePackCost(28, imageCostUsd('gemini-2.5-flash-image')).usd, 1.09);
  assert.equal(describePackCost(2).usd, 0.27);
});

test('catalogue : la pose "slay" (ongles) n est pas proposee a une persona masculine', () => {
  const slay = findCatalogEntry('body-slay');
  assert.equal(slay.femaleOnly, true);
  assert.equal(isEntryAvailable(slay, 'MALE'), false);
  assert.equal(isEntryAvailable(slay, 'FEMALE'), true);
  assert.equal(catalogForGender('MALE').some((entry) => entry.id === 'body-slay'), false);
  assert.equal(catalogForGender('FEMALE').length, AVATAR_PACK_CATALOG.length);
  assert.equal(catalogForGender('MALE').length, AVATAR_PACK_CATALOG.length - 1);
});

test('validatePackIds : refuse une pose non proposee au genre de la persona, accepte sans genre', () => {
  assert.throws(() => validatePackIds(['happy', 'body-slay'], 'MALE'), /non proposees/);
  assert.deepEqual(validatePackIds(['happy', 'body-slay'], 'FEMALE'), ['happy', 'body-slay']);
  assert.deepEqual(validatePackIds(['happy']), ['happy']);
});

test('prompts du pack : ordinateur et telephone vus de dos (ecran invisible), marge autour du sujet', () => {
  const laptop = buildEntryPrompt(findCatalogEntry('body-laptop'), 'style');
  assert.match(laptop, /BACK of the laptop lid/);
  assert.match(laptop, /BEHIND an open laptop/);
  assert.match(laptop, /hides the keyboard, the hands/);
  assert.match(laptop, /clear margin/);
  const phone = buildEntryPrompt(findCatalogEntry('body-phone'), 'style');
  assert.match(phone, /BACK of the phone/);
  assert.match(phone, /no screen content/);
});

test('description du style : consigne sans identite, reponse nettoyee et bornee', () => {
  const prompt = buildStyleDescriptionPrompt();
  assert.match(prompt, /STYLE GRAPHIQUE/);
  assert.match(prompt, /pas qui est le personnage/);
  assert.equal(cleanStyleDescription('  "rendu 3D de film d\'animation, peau lisse"  '), 'rendu 3D de film d\'animation, peau lisse');
  assert.equal(cleanStyleDescription('```\nrendu 3D,   ombrage doux\n```'), 'rendu 3D, ombrage doux');
  assert.equal(cleanStyleDescription('ok'), '');
  assert.equal(cleanStyleDescription(''), '');
  const long = Array.from({ length: 80 }, (_, i) => `element ${i}`).join(', ');
  const cut = cleanStyleDescription(long);
  assert.equal(cut.length <= MAX_STYLE_CHARS, true);
  assert.equal(cut.endsWith(','), false);
});

test('describeAvatarStyle : envoie l image a Claude et renvoie la description nettoyee ; erreurs claires', async () => {
  const sharp = (await import('sharp')).default;
  const imageBuffer = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#cccccc' } }).png().toBuffer();

  let request;
  const description = await describeAvatarStyle({
    imageBuffer,
    createMessage: async (params) => {
      request = params;
      return { content: [{ type: 'text', text: '"rendu 3D de film d\'animation, grands yeux, ombrage doux"' }] };
    },
  });
  assert.equal(description, 'rendu 3D de film d\'animation, grands yeux, ombrage doux');
  assert.equal(request.messages[0].content[0].type, 'image');
  assert.equal(request.messages[0].content[0].source.media_type, 'image/jpeg');
  assert.match(request.system, /STYLE GRAPHIQUE/);

  await assert.rejects(() => describeAvatarStyle({ imageBuffer, createMessage: async () => ({ content: [{ type: 'text', text: '' }] }) }), /description exploitable/);
  await assert.rejects(() => describeAvatarStyle({ createMessage: async () => ({}) }), /Image requise/);
});
