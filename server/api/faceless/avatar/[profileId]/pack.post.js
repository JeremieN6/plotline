import { requireFacelessPersona } from '../../../../utils/facelessApi.js';
import { startPackJob } from '../../../../utils/facelessAvatarPack.js';
import { readFacelessMedia, saveFacelessMedia } from '../../../../utils/facelessMedia.js';
import { facelessAssetFolder } from '../../../../utils/facelessIllustration.js';
import { updateProfileStyle } from '../../../../utils/facelessStyleStore.js';
import { generateImageFromGeminiWithSafetyFallback } from '../../../../utils/geminiImageGeneration.js';
import { estimatePackCostUsd } from '../../../../data/facelessAvatarCatalog.js';
import { findImageModel, imageCostUsd, resolvePackModel } from '../../../../data/imageModels.js';

// Genere (en tache de fond) les images demandees du pack d avatars. Chaque image est un
// appel PAYANT du modele d image : `confirmCost: true` est obligatoire, avec le NOMBRE
// d images attendu (`expectedCount`) pour qu une liste modifiee entre-temps ne depense
// pas plus que ce que l utilisateur a accepte. Aussi utilise pour regenerer UNE image.
export default defineEventHandler(async (event) => {
  const profileId = event.context?.params?.profileId;
  const { prisma, user, persona, style } = await requireFacelessPersona(event, profileId);
  const body = await readBody(event);

  const ids = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  if (body?.model && !findImageModel(String(body.model))) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Modele d image inconnu' }));
  }
  const model = resolvePackModel(body?.model);
  const costPerImageUsd = imageCostUsd(model);
  if (!ids.length) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Aucune image demandee' }));
  }
  if (body?.confirmCost !== true || Number(body?.expectedCount) !== new Set(ids).size) {
    return sendError(event, createError({
      statusCode: 400,
      statusMessage: `Confirmation requise : ${new Set(ids).size} image(s) payante(s) avec ${findImageModel(model).label}, environ ${estimatePackCostUsd(new Set(ids).size, costPerImageUsd)} $`,
    }));
  }

  // Le style graphique de l avatar se modifie depuis le dossier : il est enregistre avant de generer.
  const avatarPrompt = String(body?.avatarPrompt ?? style.avatarPrompt ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const avatarRender = body?.avatarRender === undefined ? style.avatarRender : (body.avatarRender === 'faithful' ? 'faithful' : 'stylized');
  if (avatarPrompt !== style.avatarPrompt || avatarRender !== style.avatarRender) {
    await updateProfileStyle(prisma, persona.id, user.id, (current) => ({ ...current, avatarPrompt, avatarRender }));
  }

  const baseUrl = style.avatar.pack?.baseUrl;
  if (!baseUrl) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Cree d abord l image de base du pack' }));
  }

  try {
    return await startPackJob({
      ids,
      baseUrl,
      avatarPrompt,
      faithful: avatarRender === 'faithful',
      gender: persona.gender,
      costPerImageUsd,
      store: { update: (mutator) => updateProfileStyle(prisma, persona.id, user.id, mutator) },
      deps: {
        generate: (prompt, parts) => generateImageFromGeminiWithSafetyFallback(prompt, parts, { model }),
        save: (buffer, type) => saveFacelessMedia(buffer, { folder: facelessAssetFolder(persona.id, 'avatar'), ...type }),
        read: readFacelessMedia,
      },
    });
  } catch (error) {
    if (error?.statusCode === 409) return sendError(event, createError({ statusCode: 409, statusMessage: error.message }));
    return sendError(event, createError({ statusCode: 400, statusMessage: String(error?.message || 'Demande invalide').slice(0, 160) }));
  }
});
