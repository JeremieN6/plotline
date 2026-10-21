/**
 * Bruitages deduits de ce qui se passe A L ECRAN : le moteur connait l instant exact ou une rangee de liste,
 * un tampon, une notification ou un clic de curseur apparaissent, donc le son tombe toujours dessus (Claude ne
 * garde que les sons qui soulignent le SENS d un mot). Pur : une scene placee -> des evenements { role, at,
 * weight } (at = secondes depuis le debut de la scene, comme les `data-at` de la page).
 *
 * Les instants copient ceux des modeles visuels (facelessTemplateHanko.js, ...Journal.js, ...Herbier.js,
 * ...Editeur.js) : a garder alignes quand une animation change. Les modeles anterieurs partagent des instants
 * moyens (un mot geant se pose vers 0,25 s) : l ecart reste sous 0,1 s.
 */

import { pace } from './facelessTemplateEditeur.js';
import { FACELESS_SFX_PALETTES } from '../data/facelessSfxPalettes.js';

// Son de chaque role pour la palette "full" (DA personnalisee ou papercraft : les sons d origine).
const FULL_BY_ROLE = {
  appear: 'paper/paper-cutout-place', item: 'paper/sticker-peel', chapter: 'paper/paper-flip', strong: 'paper/stamp-thump',
  click: 'girly/mouse-click-soft', good: 'girly/sparkle-twinkle', error: 'fail-error/nope', write: 'paper/pencil-scribble',
};

/** Pur : evenements sonores d une scene placee { layout, items, start, end, jp, tab }. */
export function sceneSoundEvents(scene, { template = 'classic' } = {}) {
  const dur = Math.max(0, Number(scene?.end ?? 0) - Number(scene?.start ?? 0));
  const k = pace(scene);
  const events = [];
  const add = (role, at, weight = 1) => {
    if (at >= 0 && at < dur - 0.2) events.push({ role, at: Number(at.toFixed(3)), weight });
  };
  const clampAt = (at) => Math.min(Math.max(0, Number(at) || 0), Math.max(0.2, dur - 0.5));
  const hanko = template === 'hanko';
  const journal = template === 'journal';

  switch (scene?.layout) {
    case 'list':
      for (const item of scene.items || []) {
        // Ligne "a venir" du Journal : rien n est livre, donc pas de son.
        if (journal && item.tone === 'watch') continue;
        const role = item.tone === 'avoid' ? 'error' : (template === 'herbier' && item.tone === 'good' ? 'good' : 'item');
        add(role, clampAt(item.at), role === 'error' ? 1.4 : (role === 'good' ? 1.2 : 1));
      }
      break;
    case 'label': {
      // Herbier : le trait balaie l etiquette, chaque ingredient JUGE sonne a son passage.
      const rows = (scene.items || []).slice(0, 8);
      const start = 0.55 * k;
      const speed = 120 / Math.max(0.5, k);
      rows.forEach((row, i) => {
        const at = start + ((i + 0.5) * 84) / speed;
        if (row.tone === 'avoid') add('error', at, 1.4);
        else if (row.tone === 'good') add('good', at, 1.2);
      });
      break;
    }
    case 'word':
      if (hanko && scene.jp) add('strong', 0.55 * k, 1.5);
      else add('strong', 0.25, 1);
      break;
    case 'logo':
      add('strong', 0.25, 1);
      break;
    case 'stat':
      add('click', 0.3, 0.9);
      break;
    case 'photo':
      add('appear', 0.25, 0.8);
      if (hanko && scene.tab) add('strong', 0.8, 1.5);
      // Journal : le curseur arrive sur la capture a 0,5 + 0,6 s et clique.
      if (journal) add('click', 1.1, 1.2);
      break;
    case 'title':
      add('chapter', 0.05, 0.7);
      if (hanko) add('strong', 0.6, 1.5);
      if (journal && scene.tab) add('good', 0.7, 1.2);
      if (template === 'editeur') add('write', 0.4, 1);
      break;
    case 'avatar':
      if (hanko) add('strong', 0.6, 1.5);
      else add('appear', 0.4, 0.6);
      break;
    case 'hook':
      if (template === 'editeur') add('write', 0.4, 1);
      break;
    default:
      break;
  }
  return events;
}

/**
 * Pur : bruitages du moteur pour toutes les scenes, au format de la timeline
 * ([{ name, start, gain, scene, cued, engine, role, weight }]), avec le son de la palette de la DA pour chaque role.
 */
export function engineSfx(scenes, style, paletteKey = 'full') {
  const palette = FACELESS_SFX_PALETTES[paletteKey];
  const out = [];
  (scenes || []).forEach((scene, index) => {
    for (const event of sceneSoundEvents(scene, { template: style?.template })) {
      const name = palette ? palette.byRole[event.role] : FULL_BY_ROLE[event.role];
      if (!name) continue;
      out.push({ name, start: Number((scene.start + event.at).toFixed(3)), gain: 0.5, scene: index, cued: true, engine: true, role: event.role, weight: event.weight });
    }
  });
  return out;
}
