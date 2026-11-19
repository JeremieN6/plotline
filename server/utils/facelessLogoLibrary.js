/**
 * Bibliotheque de logos de marques embarquee dans l outil (Simple Icons, licence CC0) :
 * dessins dans resources/faceless/logos/<slug>.svg, catalogue dans server/data/facelessLogos.js.
 * Aucun logo n est jamais cherche ailleurs (ni web, ni adresse venue d un texte).
 *
 * Un logo de la bibliotheque s utilise dans un plan avec l identifiant `lib-<slug>` : il est reconnu
 * partout (nettoyage du plan, rendu) sans etre copie dans le dossier de la persona.
 * Le catalogue et la recherche sont purs ; seul `renderLibraryLogoPng` lit un fichier.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { FACELESS_LOGOS } from '../data/facelessLogos.js';

export const LIBRARY_ID_PREFIX = 'lib-';
export const LIBRARY_URL_PREFIX = 'library:';

function norm(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const ITEMS = FACELESS_LOGOS.map(([slug, title, hex, aliases = []]) => ({
  slug,
  title,
  hex,
  names: [...new Set([norm(slug), norm(title), ...aliases.map(norm)].filter(Boolean))],
}));
const BY_SLUG = new Map(ITEMS.map((item) => [item.slug, item]));

/** Pur : les logos disponibles [{ slug, title }], par ordre alphabetique (pour les menus). */
export function listLibraryLogos() {
  return ITEMS.map(({ slug, title }) => ({ slug, title })).sort((a, b) => a.title.localeCompare(b.title, 'fr'));
}

/** Pur : cet identifiant de plan est-il un logo de la bibliotheque ? */
export function isLibraryLogoId(id) {
  const value = String(id ?? '');
  return value.startsWith(LIBRARY_ID_PREFIX) && BY_SLUG.has(value.slice(LIBRARY_ID_PREFIX.length));
}

/**
 * Pur : l entree d image du logo (meme forme que les illustrations du dossier : kind, label, url),
 * ou null. L `url` est interne (`library:<slug>`) : voir `readFacelessMedia`.
 */
export function libraryEntryFor(id) {
  if (!isLibraryLogoId(id)) return null;
  const item = BY_SLUG.get(String(id).slice(LIBRARY_ID_PREFIX.length));
  return { kind: 'logo', label: item.title, url: `${LIBRARY_URL_PREFIX}${item.slug}` };
}

/**
 * Pur : l identifiant `lib-<slug>` du logo qui porte ce nom, ou ''.
 * Nom identique (slug, nom ou alias, sans accent ni casse), sinon debut de nom commun a 5 lettres au
 * moins (« Claude Code » trouve Claude ; un nom court comme « make » exige l egalite).
 */
export function libraryLogoIdFor(name) {
  const wanted = norm(name);
  if (wanted.length < 2) return '';
  const exact = ITEMS.find((item) => item.names.includes(wanted));
  if (exact) return LIBRARY_ID_PREFIX + exact.slug;
  const partial = ITEMS
    .map((item) => ({ item, hit: item.names.filter((candidate) => Math.min(candidate.length, wanted.length) >= 5 && (candidate.startsWith(wanted) || wanted.startsWith(candidate))) }))
    .filter((entry) => entry.hit.length)
    .sort((a, b) => Math.max(...b.hit.map((h) => h.length)) - Math.max(...a.hit.map((h) => h.length)))[0];
  return partial ? LIBRARY_ID_PREFIX + partial.item.slug : '';
}

/** Pur : luminance relative approximative d une couleur #rrggbb (0 a 1). */
function luminance(hex) {
  const value = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Pur : le dessin SVG dans la couleur de la marque (un logo presque blanc passe en gris fonce :
 * il serait invisible sur la tuile blanche du montage).
 */
export function colorizeLogoSvg(svg, hex) {
  const color = luminance(hex) > 0.85 ? '#1f2937' : hex;
  return String(svg).replace('<svg ', `<svg fill="${color}" `);
}

/** Dossier des dessins (FACELESS_ASSETS_DIR le deplace, comme les polices). */
function logoDir() {
  const base = String(process.env.FACELESS_ASSETS_DIR || '').trim() || resolve(process.cwd(), 'resources/faceless');
  return resolve(base, 'logos');
}

/**
 * Le logo en PNG transparent (carre), pret a servir au rendu.
 * @param {string} slug  identifiant du catalogue (jamais un chemin : toute autre valeur est refusee)
 */
export async function renderLibraryLogoPng(slug, size = 512) {
  const item = BY_SLUG.get(String(slug));
  if (!item) throw new Error('Logo inconnu de la bibliotheque');
  const svg = colorizeLogoSvg(await readFile(resolve(logoDir(), `${item.slug}.svg`), 'utf8'), item.hex);
  const sharp = (await import('sharp')).default;
  return sharp(Buffer.from(svg), { density: 600 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}
