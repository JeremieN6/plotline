import { summarizeProfileForPersonality } from '../../../utils/personality.js';
import { requireAdminUser, toHttpError } from '../../../utils/personalityEndpoint.js';

/**
 * Profils du compte connecte avec leur statut de personnalite (aucune,
 * enregistree) et leurs plateformes connectees. Reserve aux admins, borne par
 * userId : chaque compte ne voit que ses propres profils.
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAdminUser(event);
    const module = await import('../../../utils/prisma.js');
    const prisma = module?.prisma || module?.default?.prisma;
    const rows = await prisma.profile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        profileType: true,
        instagramAccountId: true,
        twitterConnected: true,
        personality: true,
      },
    });
    return { profiles: rows.map(summarizeProfileForPersonality) };
  } catch (error) {
    throw toHttpError(error);
  }
});
