import { requireFacelessUser } from '../../utils/facelessApi.js';
import { DEFAULT_PROFILE_NAME } from '../../utils/defaultProfile.js';
import { listPersonaStyles } from '../../utils/facelessStyleStore.js';

// Liste des dossiers faceless du compte : une carte par persona (le profil neutre
// "Contenus sans persona" n a pas de dossier).
export default defineEventHandler(async (event) => {
  const user = await requireFacelessUser(event);
  const prismaModule = await import('../../utils/prisma.js');
  const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;

  const rows = (await listPersonaStyles(prisma, user.id)).filter((row) => row.persona.name !== DEFAULT_PROFILE_NAME);

  const folders = [];
  for (const { persona, style, stored } of rows) {
    let videoCount = 0;
    try {
      videoCount = await prisma.generatedContent.count({
        where: { influencerId: persona.id, versions: { some: { generationModel: 'faceless' } } },
      });
    } catch {
      videoCount = 0;
    }
    const packEntries = Object.values(style.avatar.pack?.entries || {});
    folders.push({
      id: persona.id,
      name: persona.name,
      gender: persona.gender,
      daName: style.name,
      stored,
      palette: style.palette,
      baseUrl: style.avatar.pack?.baseUrl || '',
      packReady: packEntries.filter((entry) => entry.url).length,
      illustrations: (style.illustrations || []).length,
      videos: videoCount,
    });
  }

  return { folders };
});
