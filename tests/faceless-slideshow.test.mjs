import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeFacelessScene, sanitizeFacelessPlan } from '../server/utils/facelessPlanGenerator.js';
import { layoutFacelessTimelineFromTrack, resolveSlideshowCues } from '../server/utils/facelessTimeline.js';
import { buildFacelessHtml, injectSlideshow, slideshowAsPhoto } from '../server/utils/facelessTemplate.js';
import { engineSfx, sceneSoundEvents } from '../server/utils/facelessSfxEvents.js';
import { finalizeSfx } from '../server/utils/facelessSfxPlan.js';
import { usedIllustrationIds } from '../server/utils/facelessMedia.js';
import { defaultFacelessStyle } from '../server/utils/facelessStyle.js';
import { incompleteReason, sceneFieldsFor } from '../app/utils/facelessSceneFields.js';

const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
const illustrations = Object.fromEntries(ids.map((id) => [id, { kind: 'mockup', label: id, url: 'mem://' + id }]));
const words = 'Regarde la page un puis la demo deux et enfin le resultat trois pour finir'.split(' ')
  .map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 }));

test('nettoyage : 2 a 5 images du dossier, sans doublon, avec animation et bruitage valides', () => {
  const scene = sanitizeFacelessScene({
    say: 'Regarde la demo.', layout: 'slideshow',
    images: [{ id: 'a' }, { id: 'b', at: 'demo' }, { id: 'b', at: 'x' }, { id: 'zzz' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' }],
    transition: 'zoom', imageSound: 'paper/swish-soft',
  }, { illustrationIds: ids });
  assert.equal(scene.layout, 'slideshow');
  assert.deepEqual(scene.images.map((i) => i.id), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(scene.transition, 'zoom');
  assert.equal(scene.imageSound, 'paper/swish-soft');

  const bad = sanitizeFacelessScene({ say: 'Texte.', layout: 'slideshow', images: [{ id: 'a' }, { id: 'b' }], transition: 'bidon', imageSound: 'nimporte/quoi' }, { illustrationIds: ids });
  assert.equal(bad.transition, 'fade');
  assert.equal(bad.imageSound, '');
  const quiet = sanitizeFacelessScene({ say: 'Texte.', layout: 'slideshow', images: [{ id: 'a' }, { id: 'b' }], imageSound: 'none' }, { illustrationIds: ids });
  assert.equal(quiet.imageSound, 'none');
});

test('nettoyage : une seule image = scene photo, aucune = avatar', () => {
  const one = sanitizeFacelessScene({ say: 'Texte.', layout: 'slideshow', images: [{ id: 'a' }, { id: 'zzz' }] }, { illustrationIds: ids });
  assert.equal(one.layout, 'photo');
  assert.equal(one.image, 'a');
  assert.equal(one.images, undefined);
  const none = sanitizeFacelessScene({ say: 'Texte.', layout: 'slideshow', images: [] }, { illustrationIds: ids });
  assert.equal(none.layout, 'avatar');
  assert.equal(none.images, undefined);
});

test('chronometrage : mots declencheurs, sinon parts egales ; la premiere image des le debut', () => {
  const withCues = resolveSlideshowCues([{ id: 'a', at: '' }, { id: 'b', at: 'demo' }, { id: 'c', at: 'resultat' }], words);
  assert.equal(withCues[0].at, 0);
  assert.equal(withCues[1].at, words.find((w) => w.text === 'demo').start);
  assert.equal(withCues[2].at, words.find((w) => w.text === 'resultat').start);

  const even = resolveSlideshowCues([{ id: 'a' }, { id: 'b' }, { id: 'c' }], words);
  const end = words[words.length - 1].end;
  assert.equal(even[0].at, 0);
  assert.ok(Math.abs(even[1].at - end / 3) < 0.01 && Math.abs(even[2].at - (2 * end) / 3) < 0.01);

  // un mot introuvable ne fait jamais reculer une image
  const missing = resolveSlideshowCues([{ id: 'a' }, { id: 'b', at: 'resultat' }, { id: 'c', at: 'introuvable' }], words);
  assert.ok(missing[2].at >= missing[1].at);
});

test('timeline : les instants des images sont relatifs au debut de la scene', () => {
  const plan = {
    scenes: [
      { say: 'Un debut. Puis la demo ici.', layout: 'slideshow', images: [{ id: 'a', at: '' }, { id: 'b', at: 'demo' }], captions: false, items: [], sfx: [], avatar: { beats: [] } },
      { say: 'Fin.', layout: 'avatar', items: [], sfx: [], avatar: { beats: [] }, captions: false },
    ],
  };
  const track = { path: 'x', duration: 3, words: 'Un debut. Puis la demo ici. Fin.'.split(' ').map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.35 })) };
  const timeline = layoutFacelessTimelineFromTrack(plan, track, { leadIn: 0, gap: 0, tail: 0.5, visualLead: 0.3 });
  const first = timeline.scenes[0];
  assert.equal(first.images[0].at, 0);
  assert.ok(first.images[1].at > 0 && first.images[1].at < first.end - first.start);
});

test('rendu : la scene est dessinee comme une photo, avec les attributs de bascule et le prechargement', () => {
  const scene = {
    say: 'Texte.', layout: 'slideshow', images: [{ id: 'a', at: 0 }, { id: 'b', at: 2 }, { id: 'c', at: 4 }], transition: 'wipe',
    start: 0, end: 6, words: [], items: [], sfx: [], beats: [], captionChunks: [], avatar: { beats: [] }, bg: 'main', captions: false,
  };
  const photo = slideshowAsPhoto(scene);
  assert.equal(photo.layout, 'photo');
  assert.equal(photo.image, 'a');
  assert.deepEqual(photo.slideshow.ids, ['a', 'b', 'c']);

  for (const preset of ['papercraft-pastel', 'dashboard-bleu', 'fenetre-orange']) {
    const html = buildFacelessHtml({ scenes: [scene], duration: 6, voice: [], sfx: [] }, { style: defaultFacelessStyle(preset, 'MALE'), illustrations });
    assert.match(html, /data-cycle="a,b,c"/, preset);
    assert.match(html, /data-cycle-at="0,2,4"/, preset);
    assert.match(html, /data-cycle-tr="wipe"/, preset);
    assert.match(html, /illustration\/b\.jpg"/, preset);
  }
  // une scene qui n'est pas un defile n'est pas touchee
  const plain = { layout: 'avatar', text: 'x' };
  assert.equal(slideshowAsPhoto(plain), plain);
  assert.equal(injectSlideshow('<div></div>', plain), '<div></div>');
});

test('sons : un son a chaque changement, celui choisi, aucun si « Aucun »', () => {
  const scene = { layout: 'slideshow', start: 0, end: 8, images: [{ id: 'a', at: 0 }, { id: 'b', at: 3 }, { id: 'c', at: 6 }] };
  const auto = sceneSoundEvents(scene);
  assert.deepEqual(auto.filter((e) => e.role === 'item').map((e) => e.at), [3, 6]);
  assert.equal(auto.some((e) => e.name), false);

  const custom = sceneSoundEvents({ ...scene, imageSound: 'paper/swish-soft' });
  assert.deepEqual(custom.filter((e) => e.role === 'item').map((e) => e.name), ['paper/swish-soft', 'paper/swish-soft']);
  assert.deepEqual(sceneSoundEvents({ ...scene, imageSound: 'none' }), []);

  // le son choisi passe meme hors de la palette de la DA
  const timeline = [{ ...scene, imageSound: 'paper/swish-soft' }];
  const out = finalizeSfx(engineSfx(timeline, { template: 'editeur' }, 'tech'), timeline, { paletteKey: 'tech' });
  assert.ok(out.some((s) => s.name === 'paper/swish-soft'));
});

test('images utilisees : celles du defile sont chargees et figees avec la video', () => {
  const plan = { scenes: [{ layout: 'slideshow', images: [{ id: 'a' }, { id: 'c' }] }, { layout: 'photo', image: 'b' }] };
  assert.deepEqual(usedIllustrationIds(plan, illustrations).sort(), ['a', 'b', 'c']);
});

test('editeur : champs du defile, avertissement sous 2 images', () => {
  assert.deepEqual(sceneFieldsFor('slideshow', 'dashboard').slideshow, { max: 5, min: 2 });
  assert.equal(sceneFieldsFor('photo', 'dashboard').slideshow, null);
  assert.match(incompleteReason({ layout: 'slideshow', images: [{ id: 'a' }] }), /au moins 2 images/);
  assert.equal(incompleteReason({ layout: 'slideshow', images: [{ id: 'a' }, { id: 'b' }] }), '');
});

test('plan : un defile sans illustrations disponibles retombe sur avatar', () => {
  const plan = sanitizeFacelessPlan({ scenes: [{ say: 'Un.', layout: 'slideshow', images: [{ id: 'a' }, { id: 'b' }] }, { say: 'Deux.', layout: 'avatar' }] }, { illustrationIds: [] });
  assert.equal(plan.scenes[0].layout, 'avatar');
});
