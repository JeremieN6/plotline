import { requireFacelessUser } from '../../../utils/facelessApi.js';
import { renderStylePreview } from '../../../utils/facelessPreview.js';
import { normalizeFacelessStyle, readyPackEntries } from '../../../utils/facelessStyle.js';
import { loadPersonaStyle } from '../../../utils/facelessStyleStore.js';

// Apercu d une DA : trois images d une video type, sans voix ni appel payant (quelques
// secondes de rendu). Si la DA utilise le pack d avatars de la persona, ses vraies images
// apparaissent dans l apercu.
export default defineEventHandler(async (event) => {
  const user = await requireFacelessUser(event);
  const body = await readBody(event);

  if (!body?.style || typeof body.style !== 'object') {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'style requis' }));
  }
  const style = normalizeFacelessStyle(body.style);

  let packEntries = {};
  const profileId = String(body?.profileId || '').trim();
  if (profileId && body.style?.avatar?.kind === 'pack') {
    const prismaModule = await import('../../../utils/prisma.js');
    const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;
    const loaded = await loadPersonaStyle(prisma, profileId, user.id);
    if (!loaded) return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
    packEntries = readyPackEntries({ ...loaded.style, avatar: { ...loaded.style.avatar, kind: 'pack' } });
  }

  try {
    const jpeg = await renderStylePreview({ style, packEntries });
    return { image: `data:image/jpeg;base64,${jpeg.toString('base64')}` };
  } catch (error) {
    console.warn('[faceless-style] apercu impossible', error?.message);
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Apercu impossible' }));
  }
});
