import test from 'node:test';
import assert from 'node:assert/strict';

import { colorizeLogoSvg, isLibraryLogoId, libraryEntryFor, libraryLogoIdFor, listLibraryLogos, renderLibraryLogoPng } from '../server/utils/facelessLogoLibrary.js';
import { usedIllustrationIds } from '../server/utils/facelessMedia.js';
import { pickIllustrations } from '../server/utils/facelessVideoJob.js';
import { resolveImageMarkers } from '../server/utils/facelessMarkers.js';
import { sanitizeFacelessScene } from '../server/utils/facelessPlanGenerator.js';

test('le catalogue est bien range et sans doublon', () => {
  const logos = listLibraryLogos();
  assert.ok(logos.length >= 150);
  assert.equal(new Set(logos.map((logo) => logo.slug)).size, logos.length);
});

test('un nom (titre, alias, casse, accents) retrouve son logo', () => {
  assert.equal(libraryLogoIdFor('Claude'), 'lib-claude');
  assert.equal(libraryLogoIdFor('claude code'), 'lib-claude');
  assert.equal(libraryLogoIdFor('Gemini'), 'lib-googlegemini');
  assert.equal(libraryLogoIdFor('Next.js'), 'lib-nextdotjs');
  assert.equal(libraryLogoIdFor('Twitter'), 'lib-x');
  assert.equal(libraryLogoIdFor('un truc inconnu'), '');
  assert.equal(libraryLogoIdFor('a'), '');
});

test('un nom court n est trouve que par egalite (pas de faux positif)', () => {
  assert.equal(libraryLogoIdFor('makeup'), '');
  assert.equal(libraryLogoIdFor('make'), 'lib-make');
});

test('un identifiant n ouvre jamais autre chose que le catalogue', () => {
  assert.equal(isLibraryLogoId('lib-claude'), true);
  assert.equal(isLibraryLogoId('lib-../../etc/passwd'), false);
  assert.equal(libraryEntryFor('lib-nope'), null);
  assert.equal(libraryEntryFor('lib-claude').url, 'library:claude');
});

test('un logo presque blanc passe en gris fonce, les autres gardent leur couleur', () => {
  assert.match(colorizeLogoSvg('<svg role="img"></svg>', '#FFFFFF'), /fill="#1f2937"/);
  assert.match(colorizeLogoSvg('<svg role="img"></svg>', '#D97757'), /fill="#D97757"/);
});

test('le logo est rendu en PNG carre transparent', async () => {
  const png = await renderLibraryLogoPng('claude', 128);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const sharp = (await import('sharp')).default;
  const meta = await sharp(png).metadata();
  assert.deepEqual([meta.width, meta.height, meta.hasAlpha], [128, 128, true]);
  await assert.rejects(() => renderLibraryLogoPng('../../etc/passwd'));
});

test('un marqueur sans image dans le dossier prend le logo de la bibliotheque, le dossier passe avant', () => {
  const found = resolveImageMarkers('Voici Claude [logo : Claude] et Cursor [logo : Cursor].', {});
  assert.deepEqual(found.images.map((image) => image.id), ['lib-claude', 'lib-cursor']);
  assert.equal(found.notices.length, 0);
  const own = resolveImageMarkers('Voici Claude [logo : Claude].', { 'mon-logo': { kind: 'logo', label: 'Claude' } });
  assert.deepEqual(own.images.map((image) => image.id), ['mon-logo']);
  const unknown = resolveImageMarkers('OpenAI [logo : OpenAI]', {});
  assert.match(unknown.notices[0], /ni dans le dossier de la persona, ni dans la bibliothèque/);
});

test('une scene avec un logo de la bibliotheque est conservee jusqu au rendu', () => {
  const scene = sanitizeFacelessScene({ say: 'Voici Claude [logo : Claude].', layout: 'avatar' }, { illustrations: {}, notices: [] });
  assert.equal(scene.layout, 'photo');
  assert.equal(scene.image, 'lib-claude');
  const plan = { scenes: [scene] };
  assert.deepEqual(Object.keys(pickIllustrations(plan, {})), ['lib-claude']);
  assert.deepEqual(usedIllustrationIds(plan, {}), ['lib-claude']);
});
