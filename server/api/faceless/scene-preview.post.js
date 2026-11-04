import { requireFacelessUser } from '../../utils/facelessApi.js';
import { renderScenePreview } from '../../utils/facelessPreview.js';
import { defaultFacelessStyle, pickStyleSlot, readyIllustrations, readyPackEntries } from '../../utils/facelessStyle.js';
import { loadPersonaStyle } from '../../utils/facelessStyleStore.js';

const MAX_SCENE_JSON = 20000;

// Apercu d UNE scene du plan en cours : une image fixe, rendue avec la DA choisie pour la video, l avatar du pack
// et les images du dossier. Sans voix ni appel payant (ni Claude, ni ElevenLabs, ni Gemini) : un rendu Chromium de
// quelques secondes sur le serveur. Rien n est enregistre.
export default defineEventHandler(async (event) => {
  const user = await requireFacelessUser(event);
  const body = await readBody(event);

  const scene = body?.scene;
  if (!scene || typeof scene !== 'object' || Array.isArray(scene) || JSON.stringify(scene).length > MAX_SCENE_JSON) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'scene requise' }));
  }

  let style = defaultFacelessStyle();
  const profileId = String(body?.profileId || '').trim();
  if (profileId) {
    const prismaModule = await import('../../utils/prisma.js');
    const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;
    const loaded = await loadPersonaStyle(prisma, profileId, user.id, { withPersonality: false });
    if (!loaded) return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
    style = pickStyleSlot(loaded.style, body?.styleSlot);
  }

  try {
    const jpeg = await renderScenePreview({
      scene,
      style,
      packEntries: readyPackEntries(style),
      illustrations: profileId ? readyIllustrations(style) : {},
    });
    return { image: `data:image/jpeg;base64,${jpeg.toString('base64')}` };
  } catch (error) {
    console.warn('[faceless-scene-preview] apercu impossible', error?.message);
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Aperçu impossible, réessaie dans un instant.' }));
  }
});
