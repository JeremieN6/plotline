import test from 'node:test'
import assert from 'node:assert/strict'

import * as server from '../server/utils/contentImport.js'
import * as client from '../app/utils/contentImportLimits.js'

const HOST = 'https://abc123.public.blob.vercel-storage.com'

test('les limites du navigateur sont les memes que celles du serveur', () => {
  assert.equal(client.IMPORT_MAX_VIDEO_BYTES, server.IMPORT_MAX_VIDEO_BYTES)
  assert.equal(client.IMPORT_MAX_IMAGE_BYTES, server.IMPORT_MAX_IMAGE_BYTES)
  assert.equal(client.IMPORT_MAX_FILES_PER_BATCH, server.IMPORT_MAX_FILES_PER_BATCH)
  assert.deepEqual(client.IMPORT_VIDEO_TYPES, server.IMPORT_VIDEO_TYPES)
  assert.deepEqual(client.IMPORT_IMAGE_TYPES, server.IMPORT_IMAGE_TYPES)
})

test('validateImportFile : types, taille, fichier vide', () => {
  assert.equal(server.validateImportFile({ contentType: 'video/mp4', size: 34749 * 1024 }), '')
  assert.match(server.validateImportFile({ contentType: 'application/zip', size: 10 }), /Format/)
  assert.match(server.validateImportFile({ contentType: 'video/mp4', size: 0 }), /vide/)
  assert.match(server.validateImportFile({ contentType: 'video/mp4', size: 151 * 1048576 }), /trop lourd/)
  assert.match(server.validateImportFile({ contentType: 'image/png', size: 21 * 1048576 }), /trop lourd/)
  assert.equal(client.importFileProblem({ type: 'video/mp4', size: 151 * 1048576 }) !== '', true)
})

test('isOwnImportUrl : seulement le dossier de CE compte sur Vercel Blob', () => {
  assert.equal(server.isOwnImportUrl(`${HOST}/imports/u1/a-xyz.mp4`, 'u1'), true)
  assert.equal(server.isOwnImportUrl(`${HOST}/imports/u2/a.mp4`, 'u1'), false)
  assert.equal(server.isOwnImportUrl(`${HOST}/imports/u1/../u2/a.mp4`, 'u1'), false)
  assert.equal(server.isOwnImportUrl(`${HOST}/imports/u1%2F..%2Fu2/a.mp4`, 'u1'), false)
  assert.equal(server.isOwnImportUrl(`${HOST}/generated/u1/a.mp4`, 'u1'), false)
  assert.equal(server.isOwnImportUrl('https://evil.example.com/imports/u1/a.mp4', 'u1'), false)
  assert.equal(server.isOwnImportUrl('https://x.public.blob.vercel-storage.com.evil.com/imports/u1/a.mp4', 'u1'), false)
  assert.equal(server.isOwnImportUrl(`http://abc.public.blob.vercel-storage.com/imports/u1/a.mp4`, 'u1'), false)
  assert.equal(server.isOwnImportUrl(`${HOST}/imports/u1/`, 'u1'), false)
  assert.equal(server.isOwnImportUrl(`${HOST}/imports/u1/a.mp4`, ''), false)
  assert.equal(server.isOwnImportUrl('pas une adresse', 'u1'), false)
})

test('importKindFromUrl et formatForKind', () => {
  assert.equal(server.importKindFromUrl(`${HOST}/imports/u1/a.MP4?x=1`), 'video')
  assert.equal(server.importKindFromUrl(`${HOST}/imports/u1/a.jpeg`), 'image')
  assert.equal(server.importKindFromUrl(`${HOST}/imports/u1/a.zip`), null)
  assert.equal(server.formatForKind('video'), 'REEL')
  assert.equal(server.formatForKind('image'), 'FEED')
})

test('safeImportName : accents, espaces, chemins', () => {
  assert.equal(server.safeImportName('Ma vidéo été 1.mp4'), 'Ma-video-ete-1.mp4')
  assert.equal(server.safeImportName('C:\\dossier\\clip final.mov'), 'clip-final.mov')
  assert.equal(server.safeImportName('../../etc/passwd'), 'passwd')
  assert.equal(server.safeImportName(''), 'fichier')
})

test('storageVerdict : garde-fou de stockage', () => {
  const budget = server.BLOB_STORAGE_BUDGET_BYTES
  assert.equal(server.storageVerdict(439 * 1048576, 196 * 1048576).ok, true)
  assert.equal(server.storageVerdict(800 * 1048576, 150 * 1048576).ok, false)
  assert.equal(server.storageVerdict(budget, 1).ok, false)
  assert.equal(server.storageVerdict(100, 50).remainingBytes, budget - 100)
})

test('normalizeImportRow : adresse, date facultative, reseaux, legende', () => {
  const url = `${HOST}/imports/u1/clip.mp4`
  const ok = server.normalizeImportRow({ url, scheduledAt: '2026-11-20T10:00:00.000Z', platforms: ['tiktok', 'TIKTOK', 'inconnu', 'X'], caption: '  Salut  ' }, 'u1')
  assert.equal(ok.row.format, 'REEL')
  assert.equal(ok.row.caption, 'Salut')
  assert.deepEqual(ok.row.platforms, ['TIKTOK', 'X'])
  assert.equal(ok.row.scheduledAt.toISOString(), '2026-11-20T10:00:00.000Z')

  const bare = server.normalizeImportRow({ url }, 'u1')
  assert.equal(bare.row.scheduledAt, null)
  assert.deepEqual(bare.row.platforms, [])
  assert.equal(bare.row.caption, null)

  assert.ok(server.normalizeImportRow({ url, scheduledAt: 'demain' }, 'u1').error)
  assert.ok(server.normalizeImportRow({ url }, 'u2').error)
})
