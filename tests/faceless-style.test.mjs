import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendStyleRule,
  defaultFacelessStyle,
  describeStyleForPrompt,
  mergeClientStyle,
  normalizeFacelessStyle,
  readyPackEntries,
  safeHexColor,
} from '../server/utils/facelessStyle.js';
import {
  keyAndTrimPng,
  keyOutGreen,
  startPackJob,
  validatePackIds,
  isPackBusy,
  buildEntryPrompt,
  buildBaseAvatarPrompt,
  generateBaseAvatar,
} from '../server/utils/facelessAvatarPack.js';
import { AVATAR_PACK_CATALOG, estimatePackCostUsd, findCatalogEntry } from '../server/data/facelessAvatarCatalog.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { layoutFacelessTimelineFromTrack } from '../server/utils/facelessTimeline.js';
import { buildPreviewPage, buildPreviewPlan } from '../server/utils/facelessPreview.js';
import { buildFacelessPlanSystemPrompt, sanitizeFacelessPlan } from '../server/utils/facelessPlanGenerator.js';
import { generateFacelessStyle, parseFacelessStyleResponse } from '../server/utils/facelessStyleGenerator.js';
import { loadPersonaStyle, resolveProfileStyle, updateProfileStyle } from '../server/utils/facelessStyleStore.js';
import { buildChibiSvg } from '../server/utils/facelessAvatar.js';

// --- DA : normalisation ------------------------------------------------------

test('normalizeFacelessStyle : valeurs invalides ramenees aux reglages du preset', () => {
  const style = normalizeFacelessStyle({
    preset: 'brutalisme', font: 'comic', card: 'nope', palette: { accent: 'rouge', text: '#ABCDEF' }, enters: ['teleport'], captions: { position: 'milieu' },
    voiceId: 'voix-inconnue', background: 'x',
  });
  assert.equal(style.preset, 'brutalisme');
  assert.equal(style.font, 'archivo');
  assert.equal(style.card, 'flat');
  assert.equal(style.background, 'grid');
  assert.equal(style.palette.accent, '#e8542f');
  assert.equal(style.palette.text, '#abcdef');
  assert.deepEqual(style.enters, ['pop']);
  assert.equal(style.captions.position, 'top');
  assert.ok(style.voiceId.length > 10);
  assert.equal(style.avatar.pack, null);
});

test('safeHexColor et regles : bornees', () => {
  assert.equal(safeHexColor('#FF00AA', '#000000'), '#ff00aa');
  assert.equal(safeHexColor('javascript:1', '#000000'), '#000000');
  assert.ok(normalizeFacelessStyle({ rules: 'x'.repeat(5000) }).rules.length <= 1500);
});

test('defaultFacelessStyle : un persona masculin n a ni noeud ni cheveux longs, voix masculine', () => {
  const male = defaultFacelessStyle('brutalisme', 'MALE');
  assert.equal(male.avatar.svg.hair, 'short');
  assert.equal(male.avatar.svg.accessory, 'none');
  assert.equal(male.voiceId, 'bIHbv24MWmeRgasZH58o');
  const female = defaultFacelessStyle('papercraft-pastel', 'FEMALE');
  assert.equal(female.avatar.svg.accessory, 'bow');
});

test('le pack n est jamais pris du client, seulement de la base', () => {
  const stored = normalizeFacelessStyle({
    avatar: { kind: 'pack', pack: { baseUrl: 'https://blob/base.png', entries: { happy: { status: 'done', mode: 'head', url: 'https://blob/happy.png' } } } },
  }, { keepPack: true });
  assert.equal(stored.avatar.kind, 'pack');
  assert.deepEqual(readyPackEntries(stored), { happy: { mode: 'head', url: 'https://blob/happy.png' } });

  const client = {
    ...stored,
    avatar: { kind: 'pack', pack: { baseUrl: 'http://attaquant/x', entries: { happy: { status: 'done', mode: 'head', url: 'http://attaquant/evil.png' } } } },
  };
  const merged = mergeClientStyle(stored, client);
  assert.equal(merged.avatar.pack.entries.happy.url, 'https://blob/happy.png');
  assert.equal(merged.avatar.pack.baseUrl, 'https://blob/base.png');

  // Sans pack en base, un client qui demande "pack" retombe sur le dessin.
  assert.equal(mergeClientStyle(null, client).avatar.kind, 'svg');
  assert.equal(normalizeFacelessStyle(client).avatar.pack, null);
});

test('appendStyleRule : sans doublon, plafonnee', () => {
  const base = { rules: '- une regle' };
  assert.equal(appendStyleRule(base, 'Une REGLE').rules, '- une regle');
  assert.equal(appendStyleRule(base, 'garde les cartes plus longtemps').rules, '- une regle\n- garde les cartes plus longtemps');
  let style = { rules: '' };
  for (let i = 0; i < 80; i += 1) style = appendStyleRule(style, `regle numero ${i} ${'x'.repeat(40)}`);
  assert.ok(style.rules.length <= 1500);
  assert.match(style.rules, /regle numero 79/);
});

test('describeStyleForPrompt : DA lisible par Claude', () => {
  const text = describeStyleForPrompt(defaultFacelessStyle('brutalisme', 'MALE'));
  assert.match(text, /Brutalisme/);
  assert.match(text, /Sous-titres : Texte seul, placés en haut/);
  assert.match(text, /Règles de montage/);
});

// --- Rendu : la DA se retrouve dans la page ---------------------------------

function sampleTimeline(extra = {}) {
  const plan = { scenes: [
    { say: 'Salut toi.', layout: 'hook', text: 'Salut', bg: 'main', avatar: { mode: 'head', beats: [{ at: 0, expr: 'happy' }] }, ...extra },
    { say: 'Abonne-toi.', layout: 'avatar', text: 'Abonne-toi', bg: 'dark', avatar: { mode: 'body', pose: 'wave', beats: [{ at: 0, expr: 'happy' }] }, captions: true },
  ] };
  const words = [
    { text: 'Salut', start: 0, end: 0.3 }, { text: 'toi.', start: 0.3, end: 0.6 },
    { text: 'Abonne-toi.', start: 0.8, end: 1.4 },
  ];
  return layoutFacelessTimelineFromTrack(plan, { path: 'v', duration: 1.4, words });
}

test('buildFacelessHtml : la palette, la police et le style de cartes viennent de la DA', () => {
  const brutal = defaultFacelessStyle('brutalisme', 'MALE');
  const html = buildFacelessHtml(sampleTimeline(), { style: brutal });
  assert.match(html, /font-family:"Archivo"/);
  assert.match(html, /Archivo\.ttf/);
  assert.match(html, /--accent:#e8542f/);
  assert.match(html, /box-shadow:12px 12px 0/);
  assert.ok(!html.includes('class="tape"'));
  assert.match(html, /<section class="scene bg-dark">/);

  const paper = buildFacelessHtml(sampleTimeline(), { style: defaultFacelessStyle('papercraft-pastel', 'FEMALE') });
  assert.match(paper, /Fredoka\.ttf/);
  assert.match(paper, /class="tape"/);
  assert.match(paper, /clip-path:polygon/);
});

test('buildFacelessHtml : transitions limitees a celles de la DA', () => {
  const style = normalizeFacelessStyle({ preset: 'brutalisme', enters: ['cut'] });
  const html = buildFacelessHtml(sampleTimeline(), { style });
  const enters = [...html.matchAll(/data-enter="([a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(enters.length > 0);
  assert.ok(enters.every((e) => e === 'cut'), enters.join(','));
});

test('buildFacelessHtml : une image du pack remplace le dessin', () => {
  const style = defaultFacelessStyle('papercraft-pastel', 'FEMALE');
  const timeline = sampleTimeline({ avatar: { beats: [{ at: 0, expr: 'happy' }] } });
  const html = buildFacelessHtml(timeline, { style, packEntries: { happy: { mode: 'head', url: 'https://blob/h.png' } } });
  assert.match(html, /<img class="avatar-img"[^>]*src="https:\/\/faceless\.assets\/avatar\/happy\.png"/);
  // La scene 2 reference toujours une expression du dessin ("happy" existe aussi dans le pack) : image aussi.
  assert.ok(html.split('avatar-img').length >= 3);
});

test('buildFacelessHtml : sous-titres en haut et fonds selon la scene', () => {
  const html = buildFacelessHtml(sampleTimeline(), { style: defaultFacelessStyle('brutalisme', 'MALE') });
  assert.match(html, /"captionTop":150/);
  assert.match(html, /"motion":"smooth"/);
});

test('avatar dessine : toutes les coiffures et accessoires', () => {
  for (const hair of ['long', 'short', 'bun']) {
    for (const accessory of ['none', 'bow', 'glasses']) {
      const svg = buildChibiSvg({ expression: 'happy', look: { hair, hairColor: '#222222', skin: '#e9bf9b', accessory, top: '#3a4a73' }, id: 't' });
      assert.match(svg, /^<svg/);
      assert.equal(svg.includes('stroke-width="3"/><'), accessory === 'bow' ? svg.includes('stroke-width="3"/><') : svg.includes('stroke-width="3"/><'));
    }
  }
  const noBow = buildChibiSvg({ look: { hair: 'short', accessory: 'none' }, id: 'a' });
  const bow = buildChibiSvg({ look: { hair: 'long', accessory: 'bow' }, id: 'b', accent: '#e8542f' });
  assert.ok(bow.includes('#e8542f'));
  assert.ok(!noBow.includes('#e8542f'));
});

// --- Plan : DA et pack ------------------------------------------------------

test('prompt du plan : DA + liste des images du pack', () => {
  const style = defaultFacelessStyle('brutalisme', 'MALE');
  const prompt = buildFacelessPlanSystemPrompt({
    style, packEntries: { happy: { mode: 'head' }, 'body-wave': { mode: 'body' } },
  });
  assert.match(prompt, /DIRECTION ARTISTIQUE/);
  assert.match(prompt, /Brutalisme/);
  assert.match(prompt, /- happy : Content \(tête seule\)/);
  assert.match(prompt, /- body-wave : Salue \(buste\)/);
  assert.ok(!prompt.includes('expressions possibles'));
  assert.match(buildFacelessPlanSystemPrompt({ style }), /expressions possibles/);
});

test('plan : seuls les id du pack sont acceptes, fond et logo geres', () => {
  const plan = sanitizeFacelessPlan({
    scenes: [
      { say: 'Un.', layout: 'logo', word: 'Notion', emoji: '📓', bg: 'dark', avatar: { beats: [{ at: 0, expr: 'inconnu' }, { at: 'un', expr: 'body-wave' }] } },
      { say: 'Deux.', layout: 'logo', bg: 'weird', avatar: { beats: [{ at: 0, expr: 'happy' }] } },
    ],
  }, { packIds: ['happy', 'body-wave'] });
  assert.equal(plan.scenes[0].layout, 'logo');
  assert.equal(plan.scenes[0].bg, 'dark');
  assert.deepEqual(plan.scenes[0].avatar.beats.map((b) => b.expr), ['happy', 'body-wave']);
  // Logo sans nom : retombe sur "avatar".
  assert.equal(plan.scenes[1].layout, 'avatar');
  assert.equal(plan.scenes[1].bg, 'main');
});

// --- Apercu -----------------------------------------------------------------

test('apercu : le plan utilise les images du pack quand il y en a', () => {
  const style = defaultFacelessStyle('papercraft-pastel', 'FEMALE');
  const withPack = buildPreviewPlan(style, { happy: { mode: 'head' }, 'body-wave': { mode: 'body' } });
  assert.equal(withPack.scenes[2].avatar.beats[0].expr, 'body-wave');
  const drawn = buildPreviewPlan(style);
  assert.equal(drawn.scenes[2].avatar.pose, 'wave');
  const { html, times } = buildPreviewPage(style);
  assert.equal(times.length, 3);
  assert.match(html, /<section class="scene bg-dark">/);
  assert.equal(buildPreviewPlan({ ...style, captions: { ...style.captions, enabled: false } }).scenes[2].captions, false);
});

// --- Pack d avatars ---------------------------------------------------------

test('catalogue : ids uniques, tete/buste, cout', () => {
  const ids = AVATAR_PACK_CATALOG.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^[a-z0-9-]{2,40}$/.test(id)));
  assert.ok(AVATAR_PACK_CATALOG.some((e) => e.mode === 'head') && AVATAR_PACK_CATALOG.some((e) => e.mode === 'body'));
  assert.equal(estimatePackCostUsd(10), 1.34);
  assert.equal(findCatalogEntry('nope'), null);
});

test('prompts du pack : meme personnage, fond vert, tete ou buste', () => {
  const head = buildEntryPrompt(findCatalogEntry('happy'), 'chibi sticker');
  assert.match(head, /SAME character/);
  assert.match(head, /chibi sticker/);
  assert.match(head, /#00FF00/);
  assert.match(head, /only the head/);
  assert.match(buildEntryPrompt(findCatalogEntry('body-wave'), ''), /head to the waist/);
  assert.match(buildBaseAvatarPrompt('flat colors'), /flat colors/);
});

test('validatePackIds et isPackBusy', () => {
  assert.deepEqual(validatePackIds(['happy', 'happy', 'sad']), ['happy', 'sad']);
  assert.throws(() => validatePackIds([]), /Aucune/);
  assert.throws(() => validatePackIds(['happy', 'zzz']), /inconnues/);
  assert.throws(() => validatePackIds(Array.from({ length: 40 }, (_, i) => `a${i}`)), /Au plus/);
  assert.equal(isPackBusy({ generating: true, startedAt: Date.now() }), true);
  assert.equal(isPackBusy({ generating: true, startedAt: Date.now() - 3600 * 1000 }), false);
  assert.equal(isPackBusy({ generating: false, startedAt: Date.now() }), false);
});

async function greenImage(width = 120, height = 120) {
  const sharp = (await import('sharp')).default;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const inside = x >= 40 && x < 80 && y >= 30 && y < 90;
      data.set(inside ? [220, 40, 60, 255] : [0, 255, 0, 255], i);
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

test('detourage : le fond vert disparait, le personnage est rogne', async () => {
  const png = await keyAndTrimPng(await greenImage());
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // 40 x 60 de personnage + 8 px de marge de chaque cote.
  assert.equal(info.width, 56);
  assert.equal(info.height, 76);
  assert.equal(data[3], 0, 'coin transparent');
  const center = ((38 * info.width) + 28) * 4;
  assert.equal(data[center + 3], 255, 'centre opaque');
  assert.equal(data[center], 220);
  await assert.rejects(keyAndTrimPng(await (async () => {
    const s = (await import('sharp')).default;
    return s({ create: { width: 60, height: 60, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } }).png().toBuffer();
  })()), /Aucun personnage/);
});

test('keyOutGreen : un vert dominant devient transparent, un rouge reste', () => {
  const px = Uint8Array.from([0, 255, 0, 255, 200, 30, 30, 255, 120, 140, 120, 255]);
  keyOutGreen(px);
  assert.equal(px[3], 0);
  assert.equal(px[7], 255);
  assert.ok(px[11] > 100, 'un vert pale n est pas efface');
});

function fakeStore(initial = null) {
  const state = { style: initial || defaultFacelessStyle('papercraft-pastel', 'FEMALE') };
  const calls = [];
  return {
    state,
    calls,
    update: async (mutator) => {
      calls.push(1);
      state.style = await mutator(JSON.parse(JSON.stringify(state.style)));
      return state.style;
    },
  };
}

async function waitFor(check, ms = 4000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('delai depasse');
}

test('startPackJob : images generees, detourees et enregistrees une a une', async () => {
  const store = fakeStore();
  const png = await greenImage();
  const generated = [];
  const deps = {
    generate: async (prompt, parts) => {
      generated.push({ prompt, hasRef: parts[0].inlineData.data.length > 10 });
      return { data: png.toString('base64'), mimeType: 'image/png' };
    },
    save: async () => `https://blob/e-${generated.length}.png`,
    read: async () => Buffer.from('octets-de-l-image-de-base'),
  };

  const result = await startPackJob({ ids: ['happy', 'body-wave'], store, baseUrl: 'https://blob/base.png', avatarPrompt: 'chibi', deps });
  assert.equal(result.started, true);
  assert.equal(result.count, 2);
  assert.equal(result.usd, 0.27);
  // Marquage immediat : "pending" + en cours.
  assert.equal(store.state.style.avatar.pack.generating, true);

  await waitFor(() => store.state.style.avatar.pack.generating === false);
  const entries = store.state.style.avatar.pack.entries;
  assert.equal(entries.happy.status, 'done');
  assert.equal(entries['body-wave'].mode, 'body');
  assert.match(entries.happy.url, /^https:\/\/blob\/e-/);
  assert.equal(generated.length, 2);
  assert.ok(generated.every((g) => g.hasRef && /SAME character/.test(g.prompt)));
});

test('startPackJob : un echec n efface ni le reste ni l ancienne image', async () => {
  const store = fakeStore();
  store.state.style.avatar.pack = { baseUrl: 'https://blob/base.png', baseSource: 'generated', generating: false, startedAt: 0, entries: { sad: { status: 'done', mode: 'head', url: 'https://blob/old-sad.png', error: '' } } };
  const png = await greenImage();
  const deps = {
    generate: async (prompt) => {
      if (/sad|tear/.test(prompt)) throw new Error('IMAGE_SAFETY');
      return { data: png.toString('base64'), mimeType: 'image/png' };
    },
    save: async () => 'https://blob/new.png',
    read: async () => Buffer.from('octets-de-l-image-de-base'),
  };
  await startPackJob({ ids: ['happy', 'sad'], store, baseUrl: 'https://blob/base.png', avatarPrompt: '', deps });
  await waitFor(() => store.state.style.avatar.pack.generating === false);
  const entries = store.state.style.avatar.pack.entries;
  assert.equal(entries.happy.status, 'done');
  assert.equal(entries.sad.status, 'failed');
  assert.match(entries.sad.error, /IMAGE_SAFETY/);
  assert.equal(entries.sad.url, 'https://blob/old-sad.png');
});

test('startPackJob : refuse une seconde generation en cours', async () => {
  const store = fakeStore();
  store.state.style.avatar.pack = { baseUrl: 'b', baseSource: 'generated', generating: true, startedAt: Date.now(), entries: {} };
  await assert.rejects(startPackJob({ ids: ['happy'], store, baseUrl: 'b', avatarPrompt: '', deps: {} }), /deja en cours/);
});

test('generateBaseAvatar : une image, sans detourage', async () => {
  let prompt;
  const url = await generateBaseAvatar({
    referenceBuffer: Buffer.from('ref'),
    referenceMime: 'image/jpeg',
    avatarPrompt: 'sticker',
    deps: {
      generate: async (p) => { prompt = p; return { data: Buffer.from('img').toString('base64'), mimeType: 'image/png' }; },
      save: async (buffer, type) => `https://blob/base.${type.extension}`,
    },
  });
  assert.equal(url, 'https://blob/base.png');
  assert.match(prompt, /sticker/);
});

// --- Generation de DA par Claude --------------------------------------------

test('generateFacelessStyle : champs normalises, voix et description conservees', async () => {
  const current = defaultFacelessStyle('papercraft-pastel', 'FEMALE');
  current.voiceId = 'cjVigY5qzO86Huf0OWal';
  let request;
  const createMessage = async (req) => {
    request = req;
    return { content: [{ type: 'text', text: '```json\n' + JSON.stringify({ name: 'Rose bonbon', palette: { background: '#ffc0d9', accent: 'pas une couleur' }, card: 'sticker', voiceId: 'x', font: 'pacifico' }) + '\n```' }] };
  };
  const style = await generateFacelessStyle({ description: 'mets tout en rose bonbon', current, persona: { name: 'Camille' }, createMessage });
  assert.equal(style.name, 'Rose bonbon');
  assert.equal(style.palette.background, '#ffc0d9');
  assert.equal(style.palette.accent, current.palette.accent);
  assert.equal(style.card, 'sticker');
  assert.equal(style.font, current.font);
  assert.equal(style.voiceId, 'cjVigY5qzO86Huf0OWal');
  assert.match(request.system, /Camille/);
  assert.match(request.messages[0].content, /DA actuelle/);
  await assert.rejects(generateFacelessStyle({ description: '  ', createMessage }), /vide/);
  assert.throws(() => parseFacelessStyleResponse('pas de json'), /sans JSON/);
});

// --- Stockage ---------------------------------------------------------------

test('resolveProfileStyle : defaut selon le genre quand rien n est stocke', () => {
  assert.equal(resolveProfileStyle({ gender: 'MALE' }, null).avatar.svg.hair, 'short');
  assert.equal(resolveProfileStyle({ gender: 'FEMALE' }, null).avatar.svg.hair, 'long');
  assert.equal(resolveProfileStyle({ gender: 'MALE' }, { preset: 'brutalisme' }).preset, 'brutalisme');
});

test('loadPersonaStyle : repli sans la colonne facelessStyle (migration pas passee)', async () => {
  const calls = [];
  const prisma = {
    profile: {
      findFirst: async ({ select }) => {
        calls.push(Object.keys(select));
        if ('facelessStyle' in select) throw new Error('Unknown field `facelessStyle` for select statement');
        return { id: 'p1', name: 'Max', gender: 'MALE', faceRefPath: null };
      },
    },
  };
  const loaded = await loadPersonaStyle(prisma, 'p1', 'u1');
  assert.equal(loaded.persona.name, 'Max');
  assert.equal(loaded.stored, false);
  assert.equal(loaded.style.avatar.svg.hair, 'short');
  assert.equal(calls.length, 2);
  assert.equal(await loadPersonaStyle({ profile: { findFirst: async () => null } }, 'x', 'u'), null);
  await assert.rejects(loadPersonaStyle({ profile: { findFirst: async () => { throw new Error('connexion perdue'); } } }, 'x', 'u'), /connexion/);
});

test('updateProfileStyle : ecritures concurrentes rangees (aucune perte)', async () => {
  let row = { facelessStyle: null };
  const prisma = {
    profile: {
      findFirst: async () => {
        // Lecture lente : sans file d attente, deux ecritures partiraient du meme etat.
        await new Promise((r) => setTimeout(r, 15));
        return { id: 'p1', name: 'C', gender: 'FEMALE', faceRefPath: null, facelessStyle: row.facelessStyle };
      },
      update: async ({ data }) => { row = { facelessStyle: data.facelessStyle }; },
    },
  };
  await Promise.all(['happy', 'sad', 'love'].map((id) => updateProfileStyle(prisma, 'p1', 'u1', (style) => {
    const pack = style.avatar.pack || { baseUrl: 'b', entries: {} };
    pack.entries[id] = { status: 'done', mode: 'head', url: `https://blob/${id}.png` };
    style.avatar.pack = pack;
    return style;
  })));
  assert.deepEqual(Object.keys(row.facelessStyle.avatar.pack.entries).sort(), ['happy', 'love', 'sad']);
});

test('readableTextOn : texte sombre sur un accent clair, blanc sur un accent fonce', async () => {
  const { readableTextOn } = await import('../server/utils/facelessTemplate.js');
  assert.equal(readableTextOn('#3dffa0'), '#141414');
  assert.equal(readableTextOn('#ffd23f'), '#141414');
  assert.equal(readableTextOn('#e8542f'), '#ffffff');
  assert.equal(readableTextOn('#1a1a1a'), '#ffffff');
  assert.equal(readableTextOn('n importe quoi'), '#ffffff');
});

test('regles de montage : une liste de Claude devient une ligne par regle', () => {
  const fromArray = normalizeFacelessStyle({ rules: ['Pas d emoji', '- Rythme sec'] });
  assert.equal(fromArray.rules, '- Pas d emoji\n- Rythme sec');
  const glued = normalizeFacelessStyle({ rules: '- Une regle,- Une autre,- Une troisieme' });
  assert.equal(glued.rules, '- Une regle\n- Une autre\n- Une troisieme');
  assert.equal(normalizeFacelessStyle({ rules: 'Une phrase, avec une virgule.' }).rules, 'Une phrase, avec une virgule.');
});

test('generateFacelessStyle : voix par defaut selon le genre de la persona', async () => {
  const createMessage = async () => ({ content: [{ type: 'text', text: JSON.stringify({ name: 'X', rules: ['a', 'b'] }) }] });
  const male = await generateFacelessStyle({ description: 'sobre', persona: { gender: 'MALE' }, createMessage });
  assert.equal(male.voiceId, 'bIHbv24MWmeRgasZH58o');
  assert.equal(male.rules, '- a\n- b');
  const female = await generateFacelessStyle({ description: 'sobre', persona: { gender: 'FEMALE' }, createMessage });
  assert.equal(female.voiceId, 'cgSgspJ2msm6clMCkdW9');
});

test('modeles de DA : 7 au total, chacun complet et normalisable sans perte', async () => {
  const { FACELESS_PRESETS } = await import('../server/data/facelessThemes.js');
  const keys = Object.keys(FACELESS_PRESETS);
  assert.deepEqual(keys, ['papercraft-pastel', 'brutalisme', 'cahier-ecolier', 'neon-nuit', 'kraft-carnet', 'luxe-minimal', 'pop-jaune']);
  for (const key of keys) {
    const base = FACELESS_PRESETS[key].style;
    assert.equal(base.preset, key);
    const style = normalizeFacelessStyle({ ...base });
    assert.equal(style.name, base.name);
    assert.equal(style.font, base.font);
    assert.equal(style.card, base.card);
    assert.equal(style.background, base.background);
    assert.deepEqual(style.palette, base.palette);
    assert.deepEqual(style.enters, base.enters);
    assert.equal(defaultFacelessStyle(key, 'MALE').preset, key);
  }
});

test('prompt de base : ne rien ajouter qui ne soit pas sur la reference', () => {
  const prompt = buildBaseAvatarPrompt('chibi');
  assert.match(prompt, /VISIBLE/);
  assert.match(prompt, /Do NOT add anything/);
  assert.match(prompt, /no glasses/);
  assert.ok(!prompt.includes('skin tone, glasses'));
  assert.ok(!findCatalogEntry('happy').prompt.includes('sparkles'));
});
