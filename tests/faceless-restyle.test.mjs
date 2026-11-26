import test from 'node:test';
import assert from 'node:assert/strict';

import { listRestyleChoices, resolveRestyle } from '../server/utils/facelessRestyle.js';
import { defaultFacelessStyle, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';

const packAvatar = { kind: 'pack', pack: { entries: { happy: { mode: 'head', url: 'https://x/happy.png' } } } };
const profileStyle = () => ({
  ...normalizeFacelessStyle({ ...defaultFacelessStyle('editeur-jaune', 'MALE'), avatar: packAvatar }, { keepPack: true }),
  alternates: [normalizeFacelessStyle({ ...defaultFacelessStyle('dashboard-bleu', 'MALE'), screenFrame: true, avatar: { kind: 'pack' } })],
});

test('listRestyleChoices : les DA du profil d’abord, puis tous les modèles ; sans profil, les modèles seuls', () => {
  const withProfile = listRestyleChoices(profileStyle());
  assert.deepEqual(withProfile.slice(0, 2).map((c) => c.value), ['slot:0', 'slot:1']);
  assert.equal(withProfile.length, 2 + Object.keys(FACELESS_PRESETS).length);
  const without = listRestyleChoices(null);
  assert.equal(without.length, Object.keys(FACELESS_PRESETS).length);
  assert.ok(without.every((c) => c.value.startsWith('preset:') && c.label.startsWith('Modèle : ')));
});

test('resolveRestyle (DA du profil) : la bonne DA, avec le pack d’avatars de la principale', () => {
  const option = resolveRestyle('slot:1', { profileStyle: profileStyle(), screen: 'computer' });
  assert.equal(option.style.template, 'dashboard');
  assert.equal(option.style.screenFrame, true);
  assert.ok(option.style.avatar.pack.entries.happy.url);
  assert.match(option.label, /option 2/);
  assert.equal(resolveRestyle('slot:0', { profileStyle: profileStyle() }).style.template, 'editeur');
});

test('resolveRestyle (modèle) : avatar du profil et écran de la vidéo gardés', () => {
  const spec = { style: { ...defaultFacelessStyle('dashboard-bleu', 'MALE'), screenFrame: true } };
  const trial = resolveRestyle('preset:cahier-bleu', { profileStyle: profileStyle(), spec, gender: 'MALE' });
  assert.equal(trial.style.template, 'cahier');
  assert.equal(trial.style.avatar.kind, 'pack');
  // L’écran de la vidéo suit ; hors Dashboard, il prend la fenêtre commune (pas le cadre propre au Dashboard).
  assert.equal(trial.style.screen, 'computer');
  assert.equal(trial.style.screenFrame, false);
  // Sans profil : l'avatar est celui de la vidéo.
  const alone = resolveRestyle('preset:brutal-fluo', { spec: { style: defaultFacelessStyle('terminal', 'MALE') } });
  assert.equal(alone.style.avatar.kind, 'none');
});

test('resolveRestyle refuse un choix inconnu ou hors limites', () => {
  for (const bad of ['', 'slot:3', 'slot:-1', 'slot:2', 'preset:inconnu', 'preset:__proto__', 'preset:toString', 'autre:1', null]) {
    assert.equal(resolveRestyle(bad, { profileStyle: profileStyle() }), null, String(bad));
  }
  assert.equal(resolveRestyle('slot:0', {}), null);
});
