import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addIllustration,
  defaultFacelessStyle,
  mergeClientStyle,
  normalizeFacelessStyle,
  readyIllustrations,
  removeIllustration,
} from '../server/utils/facelessStyle.js';
import {
  buildIllustrationPrompt,
  facelessAssetFolder,
  generateIllustration,
  illustrationLabel,
  importIllustration,
  processIllustrationImage,
} from '../server/utils/facelessIllustration.js';
import {
  applyNewImages,
  buildFacelessPlanSystemPrompt,
  collectNewImageRequests,
  sanitizeFacelessPlan,
} from '../server/utils/facelessPlanGenerator.js';
import { makeIllustrationGenerator, pickIllustrations } from '../server/utils/facelessVideoJob.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { layoutFacelessTimelineFromTrack } from '../server/utils/facelessTimeline.js';

const sample = (n = 1) => ({ id: `ill-abcdef${String(n).padStart(2, '0')}`, kind: 'photo', label: `Image ${n}`, prompt: 'x', url: `https://blob/i${n}.jpg`, source: 'generated', createdAt: n });

test('illustrations : ecrites par le serveur seulement, jamais prises du client', () => {
  const stored = normalizeFacelessStyle({ illustrations: [sample(1), { id: 'pas-un-id', url: 'x' }, { id: 'ill-abcdef09', url: '' }] }, { keepPack: true });
  assert.equal(stored.illustrations.length, 1);
  assert.deepEqual(readyIllustrations(stored), { 'ill-abcdef01': { kind: 'photo', label: 'Image 1', url: 'https://blob/i1.jpg' } });

  const client = { ...stored, illustrations: [{ ...sample(2), url: 'http://attaquant/x.jpg' }] };
  assert.deepEqual(normalizeFacelessStyle(client).illustrations, []);
  assert.equal(mergeClientStyle(stored, client).illustrations[0].url, 'https://blob/i1.jpg');
  assert.deepEqual(mergeClientStyle(null, client).illustrations, []);
});

test('illustrations : ajout, retrait et plafond', () => {
  let style = { illustrations: [] };
  for (let i = 1; i <= 65; i += 1) style = addIllustration(style, { ...sample(1), id: `ill-${String(i).padStart(8, '0')}` });
  assert.equal(style.illustrations.length, 60);
  assert.equal(style.illustrations[0].id, 'ill-00000006');
  assert.equal(removeIllustration(style, 'ill-00000006').illustrations.length, 59);
});

test('prompts : photo sans visage ni texte, maquette generique, illustration dans la DA', () => {
  const style = defaultFacelessStyle('neon-nuit', 'MALE');
  const photo = buildIllustrationPrompt({ kind: 'photo', prompt: 'a coffee next to a laptop', style, persona: { gender: 'MALE', niche: 'tech' } });
  assert.match(photo, /smartphone photo/);
  assert.match(photo, /a coffee next to a laptop/);
  assert.match(photo, /No visible face/);
  assert.match(photo, /no logos, no brand names/);
  assert.match(photo, /male content creator in the niche "tech"/);

  const mockup = buildIllustrationPrompt({ kind: 'mockup', prompt: 'a to-do app', style });
  assert.match(mockup, /invented interface/);
  assert.match(mockup, /No real brand logos/);
  assert.ok(mockup.includes(style.palette.accent));

  const drawn = buildIllustrationPrompt({ kind: 'illustration', prompt: 'a rocket', style });
  assert.match(drawn, /flat illustration/);
  assert.ok(drawn.includes(style.avatarPrompt));

  assert.equal(facelessAssetFolder('p1', 'illustrations'), 'faceless-assets/p1/illustrations');
  assert.equal(illustrationLabel('', 'A very long description '.repeat(10)).length, 80);
});

test('image : redimensionnee, orientation appliquee, EXIF retire', async () => {
  const sharp = (await import('sharp')).default;
  const original = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#336699' } })
    .jpeg().withExif({ IFD0: { Copyright: 'secret-gps-camera' } }).toBuffer();
  assert.ok((await sharp(original).metadata()).exif);

  const meta = await sharp(await processIllustrationImage(original)).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.ok(meta.width <= 1200 && meta.height <= 1500);
  assert.equal(meta.exif, undefined);
});

test('generateIllustration / importIllustration : entrees completes, fichier JPEG', async () => {
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 400, height: 500, channels: 3, background: '#ffaa00' } }).png().toBuffer();
  const saved = [];
  const deps = {
    generate: async () => ({ data: png.toString('base64'), mimeType: 'image/png' }),
    save: async (buffer, type) => { saved.push(type); return `https://blob/new-${saved.length}.jpg`; },
  };
  const entry = await generateIllustration({ kind: 'mockup', prompt: 'a calendar app', label: 'Calendrier', style: defaultFacelessStyle(), persona: null, deps });
  assert.match(entry.id, /^ill-[a-f0-9]{10}$/);
  assert.equal(entry.kind, 'mockup');
  assert.equal(entry.label, 'Calendrier');
  assert.equal(entry.source, 'generated');
  assert.equal(saved[0].extension, 'jpg');
  await assert.rejects(generateIllustration({ kind: 'photo', prompt: '  ', deps }), /vide/);
  await assert.rejects(generateIllustration({ kind: 'photo', prompt: 'x', deps: { generate: async () => ({ data: '' }), save: async () => '' } }), /aucune image/);

  const imported = await importIllustration({ buffer: png, kind: 'inconnu', label: 'Ma photo', deps });
  assert.equal(imported.kind, 'photo');
  assert.equal(imported.source, 'upload');
  assert.equal(imported.label, 'Ma photo');
});

test('plan : photo avec une image du dossier, ou nouvelle image dans la limite du budget', () => {
  const plan = sanitizeFacelessPlan({
    scenes: [
      { say: 'Un.', layout: 'photo', image: 'ill-abcdef01', text: 'Mon bureau', frame: 'polaroid' },
      { say: 'Deux.', layout: 'photo', image: 'ill-inconnu', newImage: { kind: 'mockup', prompt: 'a generic budgeting app screen' } },
      { say: 'Trois.', layout: 'photo', newImage: { kind: 'photo', prompt: 'a second image beyond the budget' }, text: 'Trop' },
      { say: 'Quatre.', layout: 'photo', image: 'ill-pas-dans-la-liste', text: 'Rien' },
    ],
  }, { illustrationIds: ['ill-abcdef01'], maxNew: 1 });
  assert.equal(plan.scenes[0].image, 'ill-abcdef01');
  assert.equal(plan.scenes[0].frame, 'polaroid');
  assert.equal(plan.scenes[1].layout, 'photo');
  assert.deepEqual(plan.scenes[1].newImage, { kind: 'mockup', prompt: 'a generic budgeting app screen' });
  // Budget epuise : la scene retombe sur "avatar" avec son texte, sans image.
  assert.equal(plan.scenes[2].layout, 'avatar');
  assert.equal(plan.scenes[2].text, 'Trop');
  assert.ok(!('newImage' in plan.scenes[2]));
  // Image inconnue et rien a generer : "avatar" aussi.
  assert.equal(plan.scenes[3].layout, 'avatar');

  // Aucun droit de generer : une demande est ignoree.
  const noBudget = sanitizeFacelessPlan({ scenes: [
    { say: 'Un.', layout: 'photo', newImage: { kind: 'photo', prompt: 'something nice to see' }, text: 'a' },
    { say: 'Deux.', layout: 'avatar', text: 'b' },
  ] }, { illustrationIds: [], maxNew: 0 });
  assert.equal(noBudget.scenes[0].layout, 'avatar');

  // Le budget est plafonne a 3 meme si on en demande plus.
  const many = sanitizeFacelessPlan({
    scenes: Array.from({ length: 6 }, (_, i) => ({ say: `Phrase ${i}.`, layout: 'photo', newImage: { kind: 'photo', prompt: `scene number ${i} to illustrate` } })),
  }, { maxNew: 99 });
  assert.equal(collectNewImageRequests(many).length, 3);
});

test('prompt du plan : illustrations disponibles et regles selon l autorisation', () => {
  const illustrations = { 'ill-abcdef01': { kind: 'photo', label: 'Mon bureau' } };
  const allowed = buildFacelessPlanSystemPrompt({ illustrations, maxNew: 2 });
  assert.match(allowed, /ILLUSTRATIONS DISPONIBLES/);
  assert.match(allowed, /- ill-abcdef01 : Mon bureau \(Photo réaliste\)/);
  assert.match(allowed, /AU PLUS 2 nouvelle\(s\) image\(s\)/);
  const denied = buildFacelessPlanSystemPrompt({ illustrations: {}, maxNew: 0 });
  assert.match(denied, /- aucune/);
  assert.match(denied, /PAS le droit de demander de nouvelle image/);
});

test('nouvelles images : rangees dans le plan, repli en cas d echec', () => {
  const plan = { scenes: [
    { say: 'a', layout: 'photo', newImage: { kind: 'photo', prompt: 'p1' }, text: 'Un', frame: 'plain' },
    { say: 'b', layout: 'photo', newImage: { kind: 'mockup', prompt: 'p2' }, text: 'Deux' },
    { say: 'c', layout: 'avatar', text: 'Trois' },
  ] };
  assert.deepEqual(collectNewImageRequests(plan).map((r) => r.sceneIndex), [0, 1]);
  const done = applyNewImages(plan, { 0: 'ill-aaaaaa01' });
  assert.equal(done.scenes[0].image, 'ill-aaaaaa01');
  assert.ok(!('newImage' in done.scenes[0]));
  assert.equal(done.scenes[1].layout, 'avatar');
  assert.equal(done.scenes[1].text, 'Deux');
  assert.equal(done.scenes[2], plan.scenes[2]);
  assert.deepEqual(pickIllustrations(done, { 'ill-aaaaaa01': { url: 'u' }, 'ill-zzzzzz02': { url: 'v' } }), { 'ill-aaaaaa01': { url: 'u' } });
});

test('generateur de nouvelles images : succes ranges dans le dossier, echec tolere', async () => {
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 200, height: 250, channels: 3, background: '#112233' } }).png().toBuffer();
  let row = { facelessStyle: null };
  const prisma = { profile: {
    findFirst: async () => ({ id: 'p1', name: 'C', gender: 'FEMALE', faceRefPath: null, facelessStyle: row.facelessStyle }),
    update: async ({ data }) => { row = { facelessStyle: data.facelessStyle }; },
  } };
  const deps = {
    generate: async (prompt) => {
      if (/FAIL/.test(prompt)) throw new Error('IMAGE_SAFETY');
      return { data: png.toString('base64') };
    },
    save: async () => `https://blob/g-${Math.random().toString(36).slice(2, 6)}.jpg`,
  };
  const generate = makeIllustrationGenerator({ prisma, userId: 'u1', persona: { id: 'p1', gender: 'FEMALE' }, style: defaultFacelessStyle(), deps });
  const results = await generate([{ kind: 'photo', prompt: 'a nice desk' }, { kind: 'photo', prompt: 'FAIL please' }, { kind: 'mockup', prompt: 'a clean app screen' }]);
  assert.equal(results.filter(Boolean).length, 2);
  assert.equal(results[1], null);
  assert.equal(row.facelessStyle.illustrations.length, 2);
  assert.ok(row.facelessStyle.illustrations.every((item) => /^ill-/.test(item.id)));
});

function photoTimeline(extra = {}) {
  const plan = { scenes: [
    { say: 'Mon bureau.', layout: 'photo', image: 'ill-abcdef01', text: 'Mon bureau', bg: 'main', avatar: { mode: 'head', beats: [{ at: 0, expr: 'happy' }] }, ...extra },
    { say: 'Suite.', layout: 'avatar', text: 'Suite', bg: 'main', avatar: { mode: 'body', pose: 'wave', beats: [{ at: 0, expr: 'happy' }] } },
  ] };
  const words = [{ text: 'Mon', start: 0, end: 0.3 }, { text: 'bureau.', start: 0.3, end: 0.8 }, { text: 'Suite.', start: 1.0, end: 1.4 }];
  return layoutFacelessTimelineFromTrack(plan, { path: 'v', duration: 1.5, words });
}

test('mise en page photo : cadre selon la DA, image servie sous /illustration/', () => {
  const illustrations = { 'ill-abcdef01': { kind: 'photo', label: 'Bureau', url: 'https://blob/b.jpg' } };
  const torn = buildFacelessHtml(photoTimeline(), { style: defaultFacelessStyle('papercraft-pastel', 'FEMALE'), illustrations });
  assert.match(torn, /class="photo polaroid"/);
  assert.match(torn, /src="https:\/\/faceless\.assets\/illustration\/ill-abcdef01\.jpg"/);
  assert.match(torn, /Mon bureau/);
  assert.match(torn, /class="tape"/);

  const flat = buildFacelessHtml(photoTimeline(), { style: defaultFacelessStyle('brutalisme', 'MALE'), illustrations });
  assert.match(flat, /class="photo plainframe"/);
  assert.match(buildFacelessHtml(photoTimeline({ frame: 'polaroid' }), { style: defaultFacelessStyle('brutalisme', 'MALE'), illustrations }), /class="photo polaroid"/);

  // Image absente du dossier : la scene reste lisible, sans image cassee.
  const missing = buildFacelessHtml(photoTimeline(), { style: defaultFacelessStyle(), illustrations: {} });
  assert.ok(!missing.includes('class="photo-img"'));
});
