import { requireFacelessPersona, summarizePack } from '../../../utils/facelessApi.js';
import { mergeClientStyle } from '../../../utils/facelessStyle.js';
import { saveProfileStyle } from '../../../utils/facelessStyleStore.js';
import { AVATAR_PACK_CATALOG } from '../../../data/facelessAvatarCatalog.js';

// Enregistre la DA d une persona. Les champs sont normalises ; le pack d avatars
// (images, adresses) n est JAMAIS pris dans la requete : il reste celui que le
// serveur a ecrit.
export default defineEventHandler(async (event) => {
  const { prisma, persona, style: existing } = await requireFacelessPersona(event, event.context?.params?.profileId);
  const body = await readBody(event);

  if (!body?.style || typeof body.style !== 'object') {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'style requis' }));
  }

  const next = mergeClientStyle(existing, body.style);
  try {
    await saveProfileStyle(prisma, persona.id, next);
  } catch (error) {
    console.warn('[faceless-style] enregistrement impossible', error?.message);
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Enregistrement impossible (la colonne facelessStyle existe-t-elle sur la base ?)' }));
  }

  return {
    saved: true,
    style: { ...next, avatar: { ...next.avatar, pack: null } },
    pack: summarizePack(next, AVATAR_PACK_CATALOG),
  };
});
