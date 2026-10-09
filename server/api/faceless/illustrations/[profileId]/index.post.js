import { requireFacelessPersona } from '../../../../utils/facelessApi.js';
import { facelessAssetFolder, generateIllustration, importIllustration } from '../../../../utils/facelessIllustration.js';
import { saveFacelessMedia } from '../../../../utils/facelessMedia.js';
import { addIllustration } from '../../../../utils/facelessStyle.js';
import { updateProfileStyle } from '../../../../utils/facelessStyleStore.js';
import { generateImageFromGeminiWithSafetyFallback } from '../../../../utils/geminiImageGeneration.js';
import { IMAGE_COST_USD } from '../../../../data/facelessAvatarCatalog.js';
import { ILLUSTRATION_KINDS, MAX_ILLUSTRATIONS, MAX_ILLUSTRATION_PROMPT } from '../../../../data/facelessIllustrations.js';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Pur : type d image reel d apres sa signature (le type declare par le client ne prouve rien). */
function isPngOrJpeg(buffer) {
  if (buffer.length > 8 && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return true;
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

// Ajoute une illustration au dossier de la persona :
//  - mode "upload"   : l utilisateur fournit sa photo (gratuit) ;
//  - mode "generate" : UNE image generee (appel payant : exige confirmCost: true).
export default defineEventHandler(async (event) => {
  const profileId = event.context?.params?.profileId;
  const { prisma, user, persona, style } = await requireFacelessPersona(event, profileId);
  const body = await readBody(event);

  if ((style.illustrations || []).length >= MAX_ILLUSTRATIONS) {
    return sendError(event, createError({ statusCode: 409, statusMessage: `Le dossier est plein (${MAX_ILLUSTRATIONS} illustrations) : supprime-en d abord.` }));
  }

  const mode = body?.mode === 'upload' ? 'upload' : 'generate';
  const kind = Object.hasOwn(ILLUSTRATION_KINDS, body?.kind) ? body.kind : 'photo';
  const label = String(body?.label || '').trim().slice(0, 80);
  const deps = {
    generate: generateImageFromGeminiWithSafetyFallback,
    save: (buffer, type) => saveFacelessMedia(buffer, { folder: facelessAssetFolder(persona.id, 'illustrations'), ...type }),
  };

  let entry;
  try {
    if (mode === 'upload') {
      const buffer = Buffer.from(String(body?.imageBase64 || '').replace(/^data:[^,]+,/, ''), 'base64');
      if (!buffer.length) return sendError(event, createError({ statusCode: 400, statusMessage: 'image requise' }));
      if (buffer.length > MAX_UPLOAD_BYTES) return sendError(event, createError({ statusCode: 400, statusMessage: 'Image trop lourde (8 Mo maximum)' }));
      if (!isPngOrJpeg(buffer)) return sendError(event, createError({ statusCode: 400, statusMessage: 'Le fichier doit etre un PNG ou un JPG' }));
      entry = await importIllustration({ buffer, kind, label, deps });
    } else {
      const prompt = String(body?.prompt || '').trim().slice(0, MAX_ILLUSTRATION_PROMPT);
      if (!prompt) return sendError(event, createError({ statusCode: 400, statusMessage: 'Decris l image a generer' }));
      if (body?.confirmCost !== true) {
        return sendError(event, createError({ statusCode: 400, statusMessage: `Confirmation requise : 1 image payante (environ ${IMAGE_COST_USD} $)` }));
      }
      entry = await generateIllustration({ kind, prompt, label, style, persona, deps });
    }
  } catch (error) {
    console.warn('[faceless-illustration] impossible', error?.message);
    return sendError(event, createError({ statusCode: 502, statusMessage: 'Illustration impossible : ' + String(error?.message || 'erreur').slice(0, 120) }));
  }

  await updateProfileStyle(prisma, persona.id, user.id, (current) => addIllustration(current, entry));
  return { illustration: entry };
});
