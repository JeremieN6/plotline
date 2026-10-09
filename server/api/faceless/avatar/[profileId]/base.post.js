import { requireFacelessPersona } from '../../../../utils/facelessApi.js';
import { generateBaseAvatar } from '../../../../utils/facelessAvatarPack.js';
import { saveFacelessMedia } from '../../../../utils/facelessMedia.js';
import { facelessAssetFolder } from '../../../../utils/facelessIllustration.js';
import { updateProfileStyle } from '../../../../utils/facelessStyleStore.js';
import { generateImageFromGeminiWithSafetyFallback } from '../../../../utils/geminiImageGeneration.js';
import { readImageSourceBuffer } from '../../../../utils/faceRefReader.js';
import { IMAGE_COST_USD } from '../../../../data/facelessAvatarCatalog.js';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Pur : type d image reel d apres sa signature (le type declare par le client ne prouve rien). */
function sniffImage(buffer) {
  if (buffer.length > 8 && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return { extension: 'png', contentType: 'image/png' };
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: 'jpg', contentType: 'image/jpeg' };
  return null;
}

// Image de base du pack (le personnage dont toutes les expressions derivent), de deux facons :
//  - mode "upload"   : l utilisateur fournit son image (gratuit) ;
//  - mode "generate" : UNE image generee a partir de la fiche de reference de la persona
//    (appel payant : exige confirmCost: true).
export default defineEventHandler(async (event) => {
  const profileId = event.context?.params?.profileId;
  const { prisma, user, persona, style } = await requireFacelessPersona(event, profileId);
  const body = await readBody(event);
  const mode = body?.mode === 'upload' ? 'upload' : 'generate';
  const avatarPrompt = String(body?.avatarPrompt || style.avatarPrompt || '').trim().slice(0, 400);

  let url;
  try {
    if (mode === 'upload') {
      const buffer = Buffer.from(String(body?.imageBase64 || '').replace(/^data:[^,]+,/, ''), 'base64');
      if (!buffer.length) return sendError(event, createError({ statusCode: 400, statusMessage: 'image requise' }));
      if (buffer.length > MAX_UPLOAD_BYTES) return sendError(event, createError({ statusCode: 400, statusMessage: 'Image trop lourde (8 Mo maximum)' }));
      const type = sniffImage(buffer);
      if (!type) return sendError(event, createError({ statusCode: 400, statusMessage: 'Le fichier doit etre un PNG ou un JPG' }));
      url = await saveFacelessMedia(buffer, { folder: facelessAssetFolder(persona.id, 'avatar'), ...type });
    } else {
      if (body?.confirmCost !== true) {
        return sendError(event, createError({ statusCode: 400, statusMessage: `Confirmation requise : 1 image payante (environ ${IMAGE_COST_USD} $)` }));
      }
      if (!persona.faceRefPath) {
        return sendError(event, createError({ statusCode: 400, statusMessage: 'Cette persona n a pas de fiche de reference' }));
      }
      const reference = await readImageSourceBuffer(persona.faceRefPath);
      url = await generateBaseAvatar({
        referenceBuffer: reference.buffer,
        referenceMime: reference.mimeType,
        avatarPrompt,
        deps: {
          generate: generateImageFromGeminiWithSafetyFallback,
          save: (buffer, type) => saveFacelessMedia(buffer, { folder: facelessAssetFolder(persona.id, 'avatar'), ...type }),
        },
      });
    }
  } catch (error) {
    console.warn('[faceless-avatar] image de base impossible', error?.message);
    return sendError(event, createError({ statusCode: 502, statusMessage: 'Image de base impossible : ' + String(error?.message || 'erreur').slice(0, 120) }));
  }

  await updateProfileStyle(prisma, persona.id, user.id, (current) => {
    const pack = current.avatar.pack || { entries: {} };
    pack.baseUrl = url;
    pack.baseSource = mode === 'upload' ? 'upload' : 'generated';
    pack.generating = false;
    current.avatar.pack = pack;
    if (avatarPrompt) current.avatarPrompt = avatarPrompt;
    return current;
  });

  return { baseUrl: url, source: mode };
});
