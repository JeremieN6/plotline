import { requireFacelessPersona } from '../../../../utils/facelessApi.js';
import { readFacelessMedia } from '../../../../utils/facelessMedia.js';
import { updateProfileStyle } from '../../../../utils/facelessStyleStore.js';
import { describeAvatarStyle } from '../../../../utils/facelessAvatarStyleDescriber.js';

// Decrit le style graphique de l image de base du pack (un appel Claude vision, ~1 centime)
// et l enregistre comme "style graphique de l avatar". Declenche par l utilisateur : c est la
// meme description que celle faite automatiquement a l import, relancee a la demande.
export default defineEventHandler(async (event) => {
  const profileId = event.context?.params?.profileId;
  const { prisma, user, persona, style } = await requireFacelessPersona(event, profileId);

  const baseUrl = style.avatar.pack?.baseUrl;
  if (!baseUrl) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Importe ou cree d abord l image de base' }));
  }

  let avatarPrompt;
  try {
    const imageBuffer = await readFacelessMedia(baseUrl);
    avatarPrompt = await describeAvatarStyle({ imageBuffer });
  } catch (error) {
    console.warn('[faceless-avatar] description du style impossible', error?.message);
    return sendError(event, createError({ statusCode: 502, statusMessage: 'Description impossible : ' + String(error?.message || 'erreur').slice(0, 120) }));
  }

  await updateProfileStyle(prisma, persona.id, user.id, (current) => ({ ...current, avatarPrompt }));
  return { avatarPrompt };
});
