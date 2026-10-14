import test from 'node:test';
import assert from 'node:assert/strict';

import { parseByteRange, pickHlsVariant } from '../server/utils/pinterestVideoScraper.js';

// Listes maitresses reelles (extraits) : l ordre des variantes n est PAS croissant.
const MASTER_ASCENDING = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=294136,RESOLUTION=234x416,FRAME-RATE=24,AUDIO="audio"
a_240w.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=573320,RESOLUTION=360x640,FRAME-RATE=24,AUDIO="audio"
a_360w.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1001240,RESOLUTION=540x960,FRAME-RATE=24,AUDIO="audio"
a_540w.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1943520,RESOLUTION=720x1280,FRAME-RATE=24,AUDIO="audio"
a_720w.m3u8`;

const MASTER_SHUFFLED = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=702928,RESOLUTION=360x640,FRAME-RATE=30.000
b_360w.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=362076,RESOLUTION=234x416,FRAME-RATE=30.000
b_240w.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1584488,RESOLUTION=648x1152,FRAME-RATE=30.000
b_640w.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1078362,RESOLUTION=486x864,FRAME-RATE=30.000
b_480w.m3u8`;

test('variante HLS : la plus definie, quel que soit l ordre de la liste', () => {
  assert.equal(pickHlsVariant(MASTER_ASCENDING), 'a_720w.m3u8');
  assert.equal(pickHlsVariant(MASTER_SHUFFLED), 'b_640w.m3u8');
});

test('variante HLS : plafond de definition, repli sans resolution, liste sans variante', () => {
  assert.equal(pickHlsVariant(MASTER_ASCENDING, { maxHeight: 1000 }), 'a_540w.m3u8');
  // Plafond plus bas que toutes les variantes : on garde la meilleure disponible plutot que rien.
  assert.equal(pickHlsVariant(MASTER_ASCENDING, { maxHeight: 100 }), 'a_720w.m3u8');
  const noResolution = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=300000\nfirst.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=900000\nsecond.m3u8';
  assert.equal(pickHlsVariant(noResolution), 'first.m3u8', 'sans resolution : ancien comportement (premiere variante)');
  assert.equal(pickHlsVariant('#EXTM3U\n#EXTINF:2,\nseg.ts'), null);
  assert.equal(pickHlsVariant(''), null);
  // A definition egale, le plus gros debit gagne.
  const tie = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=720x1280\nlow.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=720x1280\nhigh.m3u8';
  assert.equal(pickHlsVariant(tie), 'high.m3u8');
});

test('plage d octets HLS : longueur@decalage, decalage implicite = suite de la plage precedente, valeurs invalides', () => {
  assert.deepEqual(parseByteRange('973@0'), { length: 973, offset: 0 });
  assert.deepEqual(parseByteRange('396293@1205'), { length: 396293, offset: 1205 });
  assert.deepEqual(parseByteRange('500', 2000), { length: 500, offset: 2000 });
  assert.deepEqual(parseByteRange(' 500@10 '), { length: 500, offset: 10 });
  assert.equal(parseByteRange(''), null);
  assert.equal(parseByteRange(undefined), null);
  assert.equal(parseByteRange('abc'), null);
  assert.equal(parseByteRange('0@10'), null);
});
