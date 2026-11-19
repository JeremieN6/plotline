import test from 'node:test';
import assert from 'node:assert/strict';

import { logoGridHtml, logoGridLayout, logoRows } from '../server/utils/facelessLogoGrid.js';
import { sanitizeFacelessScene } from '../server/utils/facelessPlanGenerator.js';
import { buildFacelessHtml, slideshowAsPhoto, slideshowAsStack } from '../server/utils/facelessTemplate.js';
import { defaultFacelessStyle } from '../server/utils/facelessStyle.js';
import { sceneFieldsFor } from '../app/utils/facelessSceneFields.js';

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const illustrations = Object.fromEntries(ids.map((id) => [id, { kind: 'logo', label: id, url: 'mem://' + id }]));

test('logoRows : 2 et 3 sur une rangée, 4 en 2 x 2, 5 en 3 + 2, 6 en 3 + 3', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((n) => logoRows(n)), [[], [1], [2], [3], [2, 2], [3, 2], [3, 3]]);
  assert.deepEqual(logoRows(9), [3, 3]);
});

test('logoGridLayout : même taille partout, dans la zone, centré, sans chevauchement', () => {
  const box = { x: 40, y: 500, w: 1000, h: 820 };
  for (const count of [2, 3, 4, 5, 6]) {
    const cells = logoGridLayout(count, box, { gap: 36, maxSide: 330 });
    assert.equal(cells.length, count);
    assert.ok(cells.every((cell) => cell.size === cells[0].size && cell.size <= 330));
    for (const cell of cells) {
      assert.ok(cell.x >= box.x && cell.x + cell.size <= box.x + box.w, `x hors zone (${count})`);
      assert.ok(cell.y >= box.y && cell.y + cell.size <= box.y + box.h, `y hors zone (${count})`);
    }
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        const apart = cells[i].x + cells[i].size <= cells[j].x || cells[j].x + cells[j].size <= cells[i].x
          || cells[i].y + cells[i].size <= cells[j].y || cells[j].y + cells[j].size <= cells[i].y;
        assert.ok(apart, `chevauchement (${count})`);
      }
    }
  }
  // Deux logos : centrés horizontalement dans la zone.
  const two = logoGridLayout(2, box);
  assert.equal(two[0].x - box.x, box.x + box.w - (two[1].x + two[1].size));
  assert.deepEqual(logoGridLayout(0, box), []);
});

test('logoGridHtml : un élément animé par logo, instants du mot dit, le premier dès le début ; rien sous 2 logos', () => {
  const calls = [];
  const fx = (html, options) => { calls.push(options); return `<div>${html}</div>`; };
  const html = logoGridHtml([{ id: 'a', at: 0 }, { id: 'b', at: 1.2 }, { id: 'c', at: 2.5 }], { x: 0, y: 0, w: 1000, h: 600 }, { fx, url: (id) => `/i/${id}.jpg` });
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.at), [0.15, 1.2, 2.5]);
  assert.ok(html.includes('/i/a.jpg') && html.includes('/i/c.jpg') && html.includes('class="logo-tile"'));
  assert.equal(logoGridHtml([{ id: 'a', at: 0 }], { x: 0, y: 0, w: 1000, h: 600 }, { fx, url: (id) => id }), '');
});

test('nettoyage : mode « stack » jusqu’à 6 images, mode « replace » (défaut) jusqu’à 5', () => {
  const images = ids.map((id) => ({ id }));
  const stack = sanitizeFacelessScene({ say: 'Texte.', layout: 'slideshow', display: 'stack', images }, { illustrationIds: ids });
  assert.equal(stack.display, 'stack');
  assert.equal(stack.images.length, 6);
  const replace = sanitizeFacelessScene({ say: 'Texte.', layout: 'slideshow', images }, { illustrationIds: ids });
  assert.equal(replace.display, 'replace');
  assert.equal(replace.images.length, 5);
  const bad = sanitizeFacelessScene({ say: 'Texte.', layout: 'slideshow', display: 'bidon', images }, { illustrationIds: ids });
  assert.equal(bad.display, 'replace');
  // Une seule image valide : scène photo, sans trace du mode.
  const one = sanitizeFacelessScene({ say: 'Texte.', layout: 'slideshow', display: 'stack', images: [{ id: 'a' }, { id: 'zzz' }] }, { illustrationIds: ids });
  assert.equal(one.layout, 'photo');
  assert.equal(one.display, undefined);
});

test('slideshowAsStack : scène photo avec la liste des images et le drapeau stack, sans cycle d’images', () => {
  const scene = { layout: 'slideshow', display: 'stack', images: [{ id: 'a', at: 0 }, { id: 'b', at: 1 }] };
  const asStack = slideshowAsStack(scene);
  assert.equal(asStack.layout, 'photo');
  assert.equal(asStack.stack, true);
  assert.equal(asStack.slideshow, undefined);
  assert.ok(slideshowAsPhoto(scene).slideshow);
  assert.equal(slideshowAsStack({ layout: 'slideshow', images: [{ id: 'a' }] }).stack, undefined);
});

function sceneHtml(template, display) {
  const style = { ...defaultFacelessStyle(template, 'MALE'), screenFrame: true };
  const scenes = [{
    layout: 'slideshow', display, start: 0, end: 6, voiceStart: 0, voiceEnd: 5, words: [], say: 'Cursor Lovable Bolt', beats: [], items: [], sfx: [], captions: false, bg: 'main',
    images: [{ id: 'a', at: 0 }, { id: 'b', at: 1 }, { id: 'c', at: 2 }],
  }];
  return buildFacelessHtml({ duration: 6, scenes, captions: [], sfx: [] }, { style, illustrations });
}

test('modèle Dashboard : logos en cases animées ; un autre modèle retombe sur une image à la fois', () => {
  const dashboard = sceneHtml('dashboard-bleu', 'stack');
  assert.equal((dashboard.match(/class="logo-tile"/g) || []).length, 3);
  assert.ok(!dashboard.includes('data-cycle='));
  const other = sceneHtml('terminal', 'stack');
  assert.ok(!other.includes('class="logo-tile"'));
  assert.ok(other.includes('data-cycle='));
  // Mode « replace » sur le Dashboard : comportement d’avant.
  assert.ok(sceneHtml('dashboard-bleu', 'replace').includes('data-cycle='));
});

test('éditeur : le choix « les images s’ajoutent » n’est proposé que pour les modèles qui le dessinent', () => {
  assert.equal(sceneFieldsFor('slideshow', 'dashboard').slideshow.stack, true);
  assert.equal(sceneFieldsFor('slideshow', 'editeur').slideshow.stack, false);
  assert.equal(sceneFieldsFor('slideshow', 'dashboard').slideshow.maxStack, 6);
});
