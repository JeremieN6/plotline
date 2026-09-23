import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Choisit un mot-cle Pinterest pour les formats sans persona obligatoire
 * (STORY) ou avec un persona du catalogue (REEL), a la place de Claude.
 *
 * Un mot-cle libre invente par Claude peut ne renvoyer aucun resultat sur
 * Pinterest (constat reel du 2026-09-22: `undefined` faute de mot-cle du tout).
 * On pioche a la place dans server/data/variables.json, deja rempli a la main
 * avec des mots-cles courts et precis qui trouvent fiablement du contenu
 * (voir pinterest_video_tags_story / pinterest_video_tags_reel, toujours du
 * type "video <2-3 mots precis>").
 */

let variablesCache = null;

async function getVariables() {
  if (variablesCache) return variablesCache;

  const filePath = resolve(process.cwd(), 'server', 'data', 'variables.json');
  const raw = await readFile(filePath, 'utf-8');
  variablesCache = JSON.parse(raw);
  return variablesCache;
}

function randomItem(list) {
  if (!Array.isArray(list) || !list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}

// Indices grossiers pour deviner une categorie a partir de la niche/du style
// texte libre d un profil. Toute niche non reconnue retombe sur "lifestyle",
// la categorie la plus fournie des deux banques.
const CATEGORY_HINTS = {
  beach: ['beach', 'plage', 'mer', 'ocean', 'summer', 'ete'],
  outfit: ['outfit', 'mode', 'fashion', 'vestimentaire', 'tenue'],
  cosplay: ['cosplay', 'anime', 'manga'],
  location: ['voyage', 'travel', 'city', 'ville'],
};

export function detectPinterestCategory(text) {
  const normalized = String(text || '').toLowerCase();

  for (const [category, hints] of Object.entries(CATEGORY_HINTS)) {
    if (hints.some((hint) => normalized.includes(hint))) {
      return category;
    }
  }

  return 'lifestyle';
}

/**
 * @param {{ format: 'STORY'|'REEL', niche?: string, style?: string }} params
 * @returns {Promise<{ keyword: string, category: string }>}
 */
export async function pickPinterestKeyword({ format, niche, style }) {
  const variables = await getVariables();
  const bankKey = String(format || '').trim().toUpperCase() === 'REEL'
    ? 'pinterest_video_tags_reel'
    : 'pinterest_video_tags_story';
  const bank = variables?.[bankKey] || {};
  const category = detectPinterestCategory(`${niche || ''} ${style || ''}`);
  const list = Array.isArray(bank[category]) && bank[category].length ? bank[category] : bank.lifestyle;

  return { keyword: randomItem(list), category };
}
