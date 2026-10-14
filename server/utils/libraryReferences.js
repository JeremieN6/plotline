/**
 * Assets de la bibliotheque joints a une generation d'image du Studio : regles
 * pures (plafond de references, normalisation des identifiants, legende envoyee
 * a Gemini). Les fiches sont des planches multi-panneaux sur fond beige : sans
 * consigne contraire, le modele peut recopier la planche dans l'image finale.
 */

/** Gemini accepte 14 images de reference au maximum par generation. */
export const MAX_REFERENCE_IMAGES = 14;

/** Au-dela, le modele ignore souvent certains assets : simple avertissement d'interface. */
export const RECOMMENDED_MAX_LIBRARY_ASSETS = 6;

export const ASSET_TYPE_NOUN = {
  CAR: 'a vehicle',
  HOUSE: 'a house or building',
  STREET: 'an outdoor location',
  JEWEL: 'a piece of jewelry',
  SHOES: 'a pair of shoes',
  HAT: 'a hat',
  PROP: 'an object',
};

/** Tableau de chaines non vides, dedoublonne en gardant l'ordre ; tout le reste -> []. */
export function normalizeLibraryAssetIds(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const ids = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** Emplacements restant pour des assets une fois la face ref et le packshot comptes. */
export function remainingReferenceSlots({ hasFaceRef = false, hasExtraReference = false } = {}) {
  return MAX_REFERENCE_IMAGES - (hasFaceRef ? 1 : 0) - (hasExtraReference ? 1 : 0);
}

/**
 * Bloc ajoute au prompt systeme des assistants "idee -> prompt / champs" quand
 * des assets sont joints : Claude connait leurs CODES (pas leur apparence, les
 * fiches s'en chargent) et doit les citer tels quels dans la scene. Vide s'il
 * n'y a pas d'asset : le prompt des assistants reste alors identique.
 * `libraryAssets` : [{ code, type }] dans l'ordre de selection.
 */
export function buildLibraryAssetsPromptBlock(libraryAssets = []) {
  if (!Array.isArray(libraryAssets) || !libraryAssets.length) return '';
  const lines = libraryAssets.map((asset) => `- ${asset.code} : ${ASSET_TYPE_NOUN[asset.type] || 'an object'}`);
  return [
    "Assets de la bibliotheque joints a cette image (leurs fiches de reference sont envoyees a part au modele) :",
    ...lines,
    'Quand l idee parle de ces objets ou lieux, cite leur code EXACT dans la scene, par exemple "walking from CAR_xxx, parked in the driveway, toward the front door of HOUSE_yyy".',
    "N invente jamais d autre code et ne decris pas l apparence de ces assets : les fiches s en chargent.",
  ].join('\n');
}

/** Etiquette placee juste avant l'image d'un asset dans les parts envoyees a Gemini. */
export function buildReferenceLabelText(index, code) {
  return `Image ${index}: ${code}`;
}

/**
 * Texte envoye a Gemini. `libraryAssets` : [{ code, type }] dans l'ordre d'envoi.
 * Sans asset, renvoie `prompt` INCHANGE (aucune regression sur les autres flux).
 * Numerotation : face ref si utilisee, packshot si present, puis les assets.
 */
export function buildReferenceLegend({ prompt, hasFaceRef = false, hasExtraReference = false, libraryAssets = [] } = {}) {
  if (!Array.isArray(libraryAssets) || !libraryAssets.length) return prompt;

  const lines = ['REFERENCE IMAGES, in the order they are attached:'];
  let index = 0;

  if (hasFaceRef) {
    index += 1;
    lines.push(`Image ${index}: reference sheet of the person (face and hair). The person in the scene must match it exactly.`);
  }
  if (hasExtraReference) {
    index += 1;
    lines.push(`Image ${index}: product reference. The product must match it exactly.`);
  }
  for (const asset of libraryAssets) {
    index += 1;
    const noun = ASSET_TYPE_NOUN[asset.type] || 'an object';
    lines.push(`${buildReferenceLabelText(index, asset.code)}, ${noun}.`);
  }

  return [
    lines.join('\n'),
    '',
    "Each reference sheet shows one subject from several angles on a plain background. It only defines how that subject looks. Never reproduce a sheet's layout, panels, borders, background or any text: render each subject naturally, as a real element of the scene, keeping its shape, colors, materials and details exactly as in its sheet. Place each referenced subject in the scene as the scene description indicates; if the description does not mention one, include it only if it fits naturally. The result must be a natural photograph, never a screenshot: no camera interface, no UI overlay, no on-screen controls, no text.",
    '',
    'SCENE:',
    prompt,
  ].join('\n');
}
