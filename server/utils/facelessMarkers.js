/**
 * Marqueurs d image dans le texte dit d une scene faceless : `[logo : Claude]`.
 *
 * Le createur (ou Claude, sur sa demande) ecrit le marqueur JUSTE APRES les mots qui doivent
 * declencher l image : « C est Claude Code [logo : Claude], une IA qui ecrit du code. »
 * Le marqueur n est jamais lu a voix haute ni affiche : il est retire du texte et converti en
 * image de la scene, choisie UNIQUEMENT parmi les images du dossier de la persona (jamais une
 * adresse ni un fichier venu du texte). Tout est pur.
 */

import { libraryLogoIdFor } from './facelessLogoLibrary.js';

const MARKER = /\[\s*(?:logo|image)\s*:\s*([^\]\n]{1,60}?)\s*\]/gi;

/** Pur : le texte contient-il au moins un marqueur d image ? */
export function hasImageMarkers(text) {
  MARKER.lastIndex = 0;
  const found = MARKER.test(String(text ?? ''));
  // Une expression globale garde sa position apres un test : sans cela, matchAll partirait d apres le marqueur.
  MARKER.lastIndex = 0;
  return found;
}

/** Pur : forme comparable d un nom (sans accents, casse, ponctuation ni espaces). */
export function normalizeLabel(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function wordKey(word) {
  return normalizeLabel(word);
}

/**
 * Pur : retire les marqueurs du texte et note, pour chacun, son nom et le repere du mot dit qui
 * le declenche (`cue`). Le repere est le mot juste avant le marqueur ; si le nom de l image
 * est dit dans les 3 mots qui precedent (« Claude Code [logo : Claude] »), l image apparait des
 * ce mot-la (« Claude Code »).
 * @returns {{ say: string, markers: { name: string, cue: string }[] }}
 */
export function extractImageMarkers(text) {
  const source = String(text ?? '');
  const markers = [];
  let cleaned = '';
  let last = 0;

  MARKER.lastIndex = 0;
  for (const match of source.matchAll(MARKER)) {
    cleaned += source.slice(last, match.index);
    last = match.index + match[0].length;
    const name = match[1].trim();
    const before = cleaned.split(/\s+/).map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean);
    const recent = before.slice(-3);
    const first = wordKey(name.split(/\s+/)[0]);
    const at = first ? recent.findIndex((word) => wordKey(word) === first) : -1;
    const cue = at >= 0 ? recent.slice(at).join(' ') : (recent[recent.length - 1] || '');
    markers.push({ name, cue });
  }

  cleaned += source.slice(last);
  return {
    say: cleaned.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim(),
    markers,
  };
}

/**
 * Pur : l image du dossier qui porte ce nom (libelle ou identifiant), ou ''.
 * Ordre : nom identique, puis nom qui commence pareil (3 lettres au moins) ; a egalite, un
 * « Logo de marque » passe avant une autre image.
 * @param {Record<string, { label?: string, kind?: string }>} illustrations
 */
export function findIllustrationByName(name, illustrations) {
  const wanted = normalizeLabel(name);
  if (wanted.length < 2) return '';
  const entries = Object.entries(illustrations || {}).map(([id, item]) => ({ id, label: normalizeLabel(item?.label || id), key: normalizeLabel(id), logo: item?.kind === 'logo' }));
  const rank = (entry) => (entry.label === wanted || entry.key === wanted ? 0 : (wanted.length >= 3 && (entry.label.startsWith(wanted) || (entry.label.length >= 3 && wanted.startsWith(entry.label))) ? 1 : 9));
  const ordered = entries.map((entry) => ({ entry, score: rank(entry) })).filter((item) => item.score < 9)
    .sort((a, b) => (a.score - b.score) || (Number(b.entry.logo) - Number(a.entry.logo)));
  return ordered[0]?.entry.id || '';
}

/**
 * Pur : transforme les marqueurs d un texte dit en images de scene (dossier de la persona, puis bibliotheque de logos).
 * 1 image : scene « photo » ; 2 images ou plus : images qui s ajoutent (la premiere des le debut de
 * la scene, les suivantes au mot dit). Un nom introuvable est signale dans `notices`, jamais ignore.
 * @returns {{ say: string, images: { id: string, at: string }[], notices: string[] }}
 */
export function resolveImageMarkers(text, illustrations, { max = 6 } = {}) {
  const { say, markers } = extractImageMarkers(text);
  const images = [];
  const notices = [];

  for (const marker of markers) {
    // Le dossier de la persona d abord (ses propres images), puis la bibliotheque de logos de l outil.
    const id = findIllustrationByName(marker.name, illustrations) || libraryLogoIdFor(marker.name);
    if (!id) {
      notices.push(`Logo « ${marker.name} » introuvable (ni dans le dossier de la persona, ni dans la bibliothèque de logos) : importe-le dans le dossier (type « Logo de marque »), puis écris à nouveau [logo : ${marker.name}].`);
    } else if (!images.some((image) => image.id === id)) {
      images.push({ id, at: marker.cue });
    }
  }

  if (images.length > max) {
    notices.push(`${max} logos au maximum par scène : les suivants ne sont pas affichés.`);
    images.length = max;
  }
  return { say, images, notices };
}
