import { requireFacelessPersona, summarizePack } from '../../../utils/facelessApi.js';
import { MAX_ALTERNATES, mergeClientStyle, removeAlternate, setAlternate } from '../../../utils/facelessStyle.js';
import { saveProfileStyle } from '../../../utils/facelessStyleStore.js';
import { AVATAR_PACK_CATALOG } from '../../../data/facelessAvatarCatalog.js';

// Enregistre une DA d une persona. `slot` : 0 = la DA principale (defaut), 1 et 2 = les DA en
// option (`remove: true` retire une option). Les champs sont normalises ; le pack d avatars
// et les illustrations (images, adresses) ne sont JAMAIS pris dans la requete : ils restent
// ceux que le serveur a ecrits, et sont communs aux trois DA.
export default defineEventHandler(async (event) => {
  const { prisma, persona, style: existing } = await requireFacelessPersona(event, event.context?.params?.profileId);
  const body = await readBody(event);

  const slot = body?.slot === undefined ? 0 : Number(body.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot > MAX_ALTERNATES) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'rang de DA invalide' }));
  }

  let next;
  if (slot > 0 && body?.remove === true) {
    next = removeAlternate(existing, slot);
    if (!next) return sendError(event, createError({ statusCode: 404, statusMessage: 'Cette DA n existe pas' }));
  } else {
    if (!body?.style || typeof body.style !== 'object') {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'style requis' }));
    }
    if (slot === 0) {
      next = mergeClientStyle(existing, body.style);
    } else {
      next = setAlternate(existing, slot, body.style);
      if (!next) return sendError(event, createError({ statusCode: 400, statusMessage: 'Crée d abord la DA précédente' }));
    }
  }

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
