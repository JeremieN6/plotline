import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FACE_REF_METHODS,
  buildDownloadName,
  deleteGalleryImage,
  describeGalleryMethod,
  isGalleryUnavailable,
  normalizeGalleryMethod,
  saveGallerySheet,
  toGalleryEntry,
} from '../server/utils/faceRefGallery.js';

test('normalizeGalleryMethod : seules les méthodes connues sont gardées, le reste retombe sur « default »', () => {
  assert.equal(normalizeGalleryMethod('contact_sheet_9'), 'contact_sheet_9');
  assert.equal(normalizeGalleryMethod('close_up_4'), 'close_up_4');
  assert.equal(normalizeGalleryMethod('default'), 'default');
  assert.equal(normalizeGalleryMethod('  '), 'default');
  assert.equal(normalizeGalleryMethod(undefined), 'default');
  assert.equal(normalizeGalleryMethod('<script>'), 'default');
  assert.equal(normalizeGalleryMethod('__proto__'), 'default');
  assert.equal(describeGalleryMethod('contact_sheet_9'), FACE_REF_METHODS.contact_sheet_9);
});

test('toGalleryEntry : ne renvoie que les champs prévus, avec le nom de la persona', () => {
  const entry = toGalleryEntry({
    id: 'f1',
    userId: 'secret-user',
    imageUrl: 'https://blob.example/face-ref-gallery/u/x.jpg',
    method: 'contact_sheet_9',
    profileId: 'p1',
    createdAt: new Date('2026-10-16T10:00:00Z'),
    profile: { name: 'Usagi' },
  });
  assert.deepEqual(Object.keys(entry).sort(), ['createdAt', 'id', 'imageUrl', 'method', 'methodLabel', 'profileId', 'profileName']);
  assert.equal(entry.profileName, 'Usagi');
  assert.equal(entry.createdAt, '2026-10-16T10:00:00.000Z');

  const orphan = toGalleryEntry({ id: 'f2', imageUrl: 'x', method: 'nope', profileId: null, createdAt: '2026-10-16', profile: null });
  assert.equal(orphan.profileName, null);
  assert.equal(orphan.method, 'default');
});

test('buildDownloadName : nom lisible, sans accent ni caractère dangereux', () => {
  assert.equal(buildDownloadName({ profileName: 'Usagi', createdAt: '2026-10-16T10:00:00.000Z' }), 'fiche-reference-usagi-2026-10-16.jpg');
  assert.equal(buildDownloadName({ profileName: 'Éloïse "../x"', createdAt: '2026-10-16' }, 'png'), 'fiche-reference-eloise-x-2026-10-16.png');
  assert.equal(buildDownloadName({ profileName: null, createdAt: '' }), 'fiche-reference-fiche-sans-date.jpg');
});

test('isGalleryUnavailable : table absente ou modèle inconnu, pas les autres erreurs', () => {
  assert.equal(isGalleryUnavailable(new TypeError('Cannot read properties of undefined')), true);
  assert.equal(isGalleryUnavailable({ code: 'P2021' }), true);
  assert.equal(isGalleryUnavailable({ message: 'relation "FaceRefSheet" does not exist' }), true);
  assert.equal(isGalleryUnavailable({ message: 'Unknown argument `method`' }), true);
  assert.equal(isGalleryUnavailable({ code: 'P2002', message: 'Unique constraint failed' }), false);
});

test('saveGallerySheet : sans modèle Prisma, ne lève pas et ne stocke aucun fichier', async () => {
  const result = await saveGallerySheet({}, { userId: 'u1', buffer: Buffer.from('x'), method: 'default' });
  assert.equal(result, null);
});

test('deleteGalleryImage : refuse tout chemin qui sort du dossier de la galerie', async () => {
  assert.equal(await deleteGalleryImage(''), false);
  assert.equal(await deleteGalleryImage('/uploads/face-ref-gallery/../../etc/passwd'), false);
  assert.equal(await deleteGalleryImage('/uploads/face-ref-gallery/u/../secret.jpg'), false);
  assert.equal(await deleteGalleryImage('/uploads/face-ref-gallery/u/a/b.jpg'), false);
  assert.equal(await deleteGalleryImage('/uploads/autre/u/x.jpg'), false);
  assert.equal(await deleteGalleryImage('/uploads/face-ref-gallery/u/inexistant.jpg'), false);
});
