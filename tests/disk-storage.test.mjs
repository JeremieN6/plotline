import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import {
  diskPathForUrl, diskTarget, getDiskPublicBase, getDiskRoot, getDiskUsage, isDiskStorageEnabled, writeDiskMedia,
} from '../server/utils/diskStorage.js';
import { detectImportType, importPathname, receiveImportFile, typeMatches } from '../server/utils/diskImport.js';
import { isOwnImportUrl } from '../server/utils/contentImport.js';
import { isBlobStorageEnabled, isDevWriteBlocked, uploadPublicMediaBuffer } from '../server/utils/blobStorage.js';
import { deleteMediaByUrl } from '../server/utils/mediaCleanup.js';
import { readImageSourceBuffer } from '../server/utils/faceRefReader.js';
import { readFacelessMedia } from '../server/utils/facelessMedia.js';
import { transcribeWithCache } from '../server/utils/transcriptCache.js';

const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(40, 2)]);

async function withDisk(run) {
  const root = await mkdtemp(join(tmpdir(), 'plotline-media-'));
  const keys = ['MEDIA_STORAGE', 'MEDIA_STORAGE_DIR', 'MEDIA_PUBLIC_BASE_URL', 'BASE_URL', 'BLOB_READ_WRITE_TOKEN'];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { MEDIA_STORAGE: 'disk', MEDIA_STORAGE_DIR: root, BASE_URL: 'https://plotline.example.test' });
  delete process.env.MEDIA_PUBLIC_BASE_URL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    await run(root);
  } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
    await rm(root, { recursive: true, force: true });
  }
}

test('disque : inactif sans MEDIA_STORAGE=disk, dossier absolu et hors du projet obligatoire', () => {
  assert.equal(isDiskStorageEnabled({}), false);
  assert.equal(isDiskStorageEnabled({ MEDIA_STORAGE: ' Disk ' }), true);
  assert.equal(diskPathForUrl('https://x.test/media/a.jpg', {}), null);
  assert.throws(() => getDiskRoot({}));
  assert.throws(() => getDiskRoot({ MEDIA_STORAGE_DIR: 'relatif/media' }));
  assert.throws(() => getDiskRoot({ MEDIA_STORAGE_DIR: join(process.cwd(), 'storage') }), /dehors/);
  assert.throws(() => getDiskRoot({ MEDIA_STORAGE_DIR: process.cwd() }), /dehors/);
  assert.equal(getDiskPublicBase({ BASE_URL: 'https://a.test/' }), 'https://a.test/media');
  assert.equal(getDiskPublicBase({ BASE_URL: 'https://a.test', MEDIA_PUBLIC_BASE_URL: 'https://m.test/f/' }), 'https://m.test/f');
  assert.throws(() => getDiskPublicBase({}));
});

test('disque : chemins et types dangereux refusés', async () => {
  await withDisk(async () => {
    for (const bad of ['../a.jpg', 'a/../../b.jpg', '.cache/a.jpg', 'a/page.html', 'a/image.svg', 'a/script.js', 'a/sans-extension', '']) {
      assert.throws(() => diskTarget(bad), undefined, bad);
    }
    const base = 'https://plotline.example.test/media';
    for (const bad of [`${base}/../etc/passwd`, `${base}/a/%2e%2e/b.jpg`, `${base}`, 'https://evil.test/media/a.jpg', 'https://abc.public.blob.vercel-storage.com/a.jpg']) {
      assert.equal(diskPathForUrl(bad), null, bad);
    }
  });
});

test('stockage partagé en mode disque : écrit, relit sans réseau, supprime', async () => {
  await withDisk(async (root) => {
    assert.equal(isBlobStorageEnabled(), true);
    const saved = await uploadPublicMediaBuffer('face-refs/profil 1', 'jpg', JPG, 'image/jpeg');
    assert.match(saved.url, /^https:\/\/plotline\.example\.test\/media\/face-refs\/profil-1\/\d+-[a-z0-9]+\.jpg$/);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => { throw new Error('aucun appel réseau attendu'); };
    try {
      assert.deepEqual((await readImageSourceBuffer(saved.url)).buffer, JPG);
      assert.deepEqual(await readFacelessMedia(saved.url), JPG);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal((await getDiskUsage()).bytes, JPG.length);
    assert.equal(await deleteMediaByUrl(saved.url), true);
    assert.deepEqual(await readdir(join(root, 'face-refs', 'profil-1')), []);
    assert.equal(await deleteMediaByUrl(saved.url), false);
  });
});

test('cache de transcription sur le disque : le second import ne retranscrit pas', async () => {
  await withDisk(async () => {
    let calls = 0;
    const transcribe = async () => { calls += 1; return { words: [{ text: 'salut', start: 0, end: 0.4 }] }; };
    const args = { userId: 'u1', audio: Buffer.from('audio'), transcribe };
    assert.equal((await transcribeWithCache(args)).cached, false);
    assert.equal((await transcribeWithCache(args)).cached, true);
    assert.equal(calls, 1);
  });
});

test('import : type réel vérifié, taille bornée, rien ne reste en cas de refus', async () => {
  assert.equal(detectImportType(JPG), 'image/jpeg');
  assert.equal(detectImportType(MP4), 'video/mp4');
  assert.equal(detectImportType(Buffer.from('<html><script>')), '');
  assert.equal(typeMatches('video/quicktime', 'video/mp4'), true);
  assert.equal(typeMatches('image/png', 'image/jpeg'), false);
  assert.equal(importPathname('u1', '../../.Mon été.final.MP4', 'video/mp4', 'abc'), 'imports/u1/Mon-ete-final-abc.mp4');

  await withDisk(async (root) => {
    const send = (buffer, contentType, maxBytes = 1000) => receiveImportFile({ stream: Readable.from([buffer]), userId: 'u1', name: 'clip.mp4', contentType, maxBytes });
    const ok = await send(MP4, 'video/mp4');
    assert.deepEqual(await readFile(diskPathForUrl(ok.url)), MP4);
    assert.equal(isOwnImportUrl(ok.url, 'u1'), true);
    assert.equal(isOwnImportUrl(ok.url, 'u2'), false);
    assert.equal(isOwnImportUrl(`${ok.url}?x=1`, 'u1'), false);
    await assert.rejects(send(Buffer.from('<html></html>'), 'video/mp4'), { statusCode: 400 });
    await assert.rejects(send(Buffer.alloc(0), 'video/mp4'), { statusCode: 400 });
    await assert.rejects(send(MP4, 'video/mp4', 10), { statusCode: 413 });
    await assert.rejects(send(MP4, 'text/html'), { statusCode: 400 });
    assert.equal((await readdir(join(root, 'imports', 'u1'))).length, 1);
    await writeDiskMedia('imports/u1/autre.jpg', JPG);
  });
});

test('développement : écritures bloquées sauf autorisation explicite ; production et tests non concernés', () => {
  assert.equal(isDevWriteBlocked({}, true), true);
  assert.equal(isDevWriteBlocked({ MEDIA_ALLOW_DEV_WRITES: 'true' }, true), false);
  assert.equal(isDevWriteBlocked({}, false), false);
});
