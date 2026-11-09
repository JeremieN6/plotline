// Nombre de publications automatiques ratees du compte : contenus en erreur qui ont encore leur media ET leur date
// planifiee (le planificateur la restaure quand il abandonne). Sert a la pastille du menu « Contenu ».
// Une seule requete de comptage, appelee a l'ouverture de l'application et a chaque changement de page (jamais en boucle).
let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

export default defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const count = await prisma.generatedContent.count({
      where: {
        status: 'FAILED',
        scheduledAt: { not: null },
        AND: [{ imageUrl: { not: null } }, { imageUrl: { not: '' } }],
        influencer: { is: { userId: user.id } },
      },
    });

    return { count };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    // La pastille n'est qu'un confort : une panne ne doit jamais casser le menu.
    return { count: 0 };
  }
});
