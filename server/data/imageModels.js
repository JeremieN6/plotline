/**
 * Modeles d image utilisables pour le pack d avatars et l image de base de la persona.
 * `costUsd` = tarif INDICATIF d une image 1K (a verifier sur la console Google, jamais
 * une facture) : il sert a annoncer le cout avant la confirmation.
 *
 * Essai reel du 2026-10-15 (portrait 3D de Jeremie, 3 poses, fond vert) :
 *  - 3.1 Flash : fond vert propre, visage et rendu fideles, 3/3 images ;
 *  - 2.5 Flash : fond non vert (detourage rate), visage moins fidele, 1 refus sur 3 ;
 *  - 3 Pro : modele historique du projet, pas rejoue dans cet essai.
 */

export const IMAGE_MODELS = [
  {
    id: 'gemini-3.1-flash-image',
    label: 'Gemini 3.1 Flash Image',
    costUsd: 0.067,
    note: 'Rapide et fidele sur l\'essai du 15/10 (recommande pour le pack)',
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image',
    costUsd: 0.134,
    note: 'Modele historique du projet : plus de detail et meilleur rendu du texte',
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image',
    costUsd: 0.039,
    note: 'Le moins cher, mais fond pas toujours uni (detourage rate) et refus frequents : deconseille',
  },
];

/** Modele historique : celui de tout le reste du produit (Studio, illustrations...). */
export const LEGACY_IMAGE_MODEL = 'gemini-3-pro-image-preview';

/** Modele par defaut du pack d avatars (surchargeable par FACELESS_AVATAR_MODEL, puis par la demande). */
export const DEFAULT_PACK_MODEL = 'gemini-3.1-flash-image';

export function findImageModel(id) {
  return IMAGE_MODELS.find((model) => model.id === id) || null;
}

/** Pur : modele a utiliser = celui demande s il est connu, sinon la variable d environnement, sinon le defaut. */
export function resolvePackModel(requested, envValue = process.env.FACELESS_AVATAR_MODEL) {
  return findImageModel(String(requested || '').trim())?.id
    || findImageModel(String(envValue || '').trim())?.id
    || DEFAULT_PACK_MODEL;
}

/** Pur : tarif indicatif d une image du modele (le tarif historique si le modele est inconnu). */
export function imageCostUsd(modelId) {
  return findImageModel(modelId)?.costUsd ?? findImageModel(LEGACY_IMAGE_MODEL).costUsd;
}

/** Pur : liste pour l interface (tarif par modele + tarif d une image du modele par defaut). */
export function describeImageModels() {
  return IMAGE_MODELS.map(({ id, label, costUsd, note }) => ({ id, label, costUsd, note }));
}
