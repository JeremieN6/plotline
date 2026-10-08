import { PERSONALITY_KINDS } from '../../../data/personalityBlocks.js';
import { PLATFORM_BIO_FIELDS, getKindBlocks, normalizeKind } from '../../../utils/personality.js';
import { requireAdminUser, toHttpError } from '../../../utils/personalityEndpoint.js';

/**
 * Forme des blocs et champs d un type de profil, pour construire l ecran admin
 * sans dupliquer le registre cote client. Les consignes internes a Claude
 * (assistHint) ne sont volontairement pas exposees. Reserve aux admins.
 *
 * `steps` : la generation complete se fait en deux requetes (l'une apres l'autre,
 * la seconde recoit la premiere en contexte) pour rester sous le delai du proxy
 * tout en gardant l'apparence et la voix deduites de l'histoire.
 */
export default defineEventHandler(async (event) => {
  try {
    await requireAdminUser(event);
    const kind = normalizeKind(getQuery(event).kind) || 'PERSONA';
    const blocks = getKindBlocks(kind);
    const voiceIndex = blocks.findIndex((block) => block.key === 'voice');
    const splitAt = voiceIndex > 0 ? voiceIndex : Math.ceil(blocks.length / 2);

    return {
      kind,
      kinds: PERSONALITY_KINDS,
      platforms: Object.keys(PLATFORM_BIO_FIELDS),
      platformBioFields: PLATFORM_BIO_FIELDS,
      steps: [
        blocks.slice(0, splitAt).map((block) => block.key),
        blocks.slice(splitAt).map((block) => block.key),
      ].filter((keys) => keys.length),
      blocks: blocks.map((block) => ({
        key: block.key,
        label: block.label,
        fields: block.fields.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          max: field.max ?? null,
          itemMax: field.itemMax ?? null,
          min: field.min ?? null,
          optional: Boolean(field.optional),
          column: field.column || null,
        })),
      })),
    };
  } catch (error) {
    return sendError(event, toHttpError(error));
  }
});
