import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_ALTERNATES,
  defaultFacelessStyle,
  mergeClientStyle,
  normalizeFacelessStyle,
  pickStyleSlot,
  readyPackEntries,
  removeAlternate,
  setAlternate,
} from '../server/utils/facelessStyle.js';
import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { buildFacelessPlanSystemPrompt } from '../server/utils/facelessPlanGenerator.js';

const withPack = () => {
  const base = defaultFacelessStyle('papercraft-pastel', 'FEMALE');
  return normalizeFacelessStyle({
    ...base,
    avatar: { kind: 'pack', svg: base.avatar.svg, pack: { entries: { happy: { status: 'done', mode: 'head', url: 'https://x/h.png' } } } },
    illustrations: [{ id: 'ill-abc123', kind: 'photo', label: 'Cafe', url: 'https://x/i.jpg' }],
  }, { keepPack: true });
};

test('une DA neuve n a aucun avatar par defaut (ni dessine, ni pack)', () => {
  assert.equal(defaultFacelessStyle('papercraft-pastel', 'FEMALE').avatar.kind, 'none');
  assert.equal(defaultFacelessStyle('fenetre-orange', 'MALE').avatar.kind, 'none');
  assert.equal(normalizeFacelessStyle({}).avatar.kind, 'svg', 'une DA enregistree sans type d avatar garde le dessin d avant');
  assert.equal(normalizeFacelessStyle({ avatar: { kind: 'none' } }).avatar.kind, 'none');
});

test('un pack choisi mais vide ne redonne pas un dessin impose : aucun avatar', () => {
  const style = normalizeFacelessStyle({ avatar: { kind: 'pack', pack: { entries: {} } } }, { keepPack: true });
  assert.equal(style.avatar.kind, 'none');
});

test('sans avatar, le plan n en demande pas et le pack n est pas lu', () => {
  const none = normalizeFacelessStyle({ avatar: { kind: 'none' } });
  const prompt = buildFacelessPlanSystemPrompt({ style: none });
  assert.match(prompt, /AUCUN avatar/);
  assert.doesNotMatch(prompt, /un avatar illustre reagit/);
  assert.deepEqual(readyPackEntries(none), {});
  assert.match(buildFacelessPlanSystemPrompt({ style: normalizeFacelessStyle({}) }), /un avatar illustre reagit/);
});

test('les DA en option : ajout, plafond a 2, ordre et retrait', () => {
  let style = withPack();
  assert.equal(MAX_ALTERNATES, 2);
  assert.equal(setAlternate(style, 2, { name: 'Trop tot' }), null, 'le rang 2 exige le rang 1');
  assert.equal(setAlternate(style, 3, { name: 'Trop' }), null);
  assert.equal(setAlternate(style, 0, { name: 'Non' }), null);

  style = setAlternate(style, 1, { name: 'Option A', preset: 'fenetre-orange', avatar: { kind: 'none' } });
  style = setAlternate(style, 2, { name: 'Option B', preset: 'brutal-fluo' });
  assert.deepEqual(style.alternates.map((a) => a.name), ['Option A', 'Option B']);
  assert.equal(style.alternates[0].template, 'fenetre');

  style = setAlternate(style, 1, { name: 'Option A bis' });
  assert.equal(style.alternates[0].name, 'Option A bis');
  assert.equal(style.alternates.length, 2);

  style = removeAlternate(style, 1);
  assert.deepEqual(style.alternates.map((a) => a.name), ['Option B']);
  assert.equal(removeAlternate(style, 2), null);
});

test('une DA en option ne peut jamais porter d images : elle partage le pack et les illustrations de la principale', () => {
  const main = withPack();
  const withAlt = setAlternate(main, 1, {
    name: 'Option',
    avatar: { kind: 'pack', pack: { entries: { evil: { status: 'done', mode: 'head', url: 'https://evil/x.png' } } } },
    illustrations: [{ id: 'ill-zzz999', kind: 'photo', label: 'x', url: 'https://evil/i.jpg' }],
  });
  assert.equal(withAlt.alternates[0].avatar.pack, null);
  assert.deepEqual(withAlt.alternates[0].illustrations, []);

  const picked = pickStyleSlot(withAlt, 1);
  assert.equal(picked.name, 'Option');
  assert.deepEqual(Object.keys(readyPackEntries(picked)), ['happy']);
  assert.equal(picked.illustrations[0].id, 'ill-abc123');
});

test('pickStyleSlot : rang 0 ou inconnu = la principale ; pack vide = aucun avatar', () => {
  const main = withPack();
  const withAlt = setAlternate(main, 1, { name: 'Option', avatar: { kind: 'none' } });
  assert.equal(pickStyleSlot(withAlt, 0).name, main.name);
  assert.equal(pickStyleSlot(withAlt, 2).name, main.name);
  assert.equal(pickStyleSlot(withAlt, 'x').name, main.name);
  assert.equal(pickStyleSlot(withAlt, 1).avatar.kind, 'none');

  const emptyMain = normalizeFacelessStyle({ alternates: [] }, { keepPack: true });
  const alt = setAlternate(emptyMain, 1, { name: 'Pack sans pack', avatar: { kind: 'pack' } });
  assert.equal(pickStyleSlot(alt, 1).avatar.kind, 'none');
});

test('enregistrer la principale garde les options de la base, jamais celles du client', () => {
  const stored = setAlternate(withPack(), 1, { name: 'Option A' });
  const next = mergeClientStyle(stored, { ...stored, name: 'Principale modifiee', alternates: [{ name: 'Intrus' }] });
  assert.equal(next.name, 'Principale modifiee');
  assert.deepEqual(next.alternates.map((a) => a.name), ['Option A']);
});

test('les modeles sont rangés en deux categories : les 11 premiers en classique, le reste en anime', () => {
  const templates = Object.values(FACELESS_PRESETS).map((preset) => defaultFacelessStyle(preset.style.preset, 'FEMALE').template);
  assert.equal(templates.filter((template) => template === 'classic').length, 11);
  assert.ok(templates.filter((template) => template !== 'classic').length >= 8);
});
