import { setBrandsForAmbassador } from '../../../utils/brandAmbassadorLinks.js';

let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

/**
 * Remplace la liste des marques representees par une ambassadrice.
 * Le corps attendu est { brandIds: string[] }; une liste vide detache tout.
 */
export default defineEventHandler(async (event) => {
  try {
    const id = String(event.context?.params?.id || '').trim();
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const body = await readBody(event);
    const requestedBrandIds = [...new Set(
      (Array.isArray(body?.brandIds) ? body.brandIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    )];

    const ambassador = await prisma.profile.findFirst({
      where: { id, userId: user.id },
      select: { id: true, faceRefPath: true },
    });

    if (!ambassador) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
    }

    // Une marque ne se rattache pas a elle-meme.
    if (requestedBrandIds.includes(id)) {
      return sendError(event, createError({
        statusCode: 400,
        statusMessage: 'Un profil ne peut pas etre rattache a lui-meme',
      }));
    }

    // Les marques doivent appartenir au meme compte: sans ce controle, on
    // pourrait rattacher une ambassadrice a la marque d un autre utilisateur.
    if (requestedBrandIds.length) {
      const ownedBrands = await prisma.profile.findMany({
        where: { id: { in: requestedBrandIds }, userId: user.id },
        select: { id: true },
      });

      if (ownedBrands.length !== requestedBrandIds.length) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Marque introuvable' }));
      }
    }

    const brandIds = await setBrandsForAmbassador(prisma, id, requestedBrandIds);

    return { success: true, brandIds };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    // Message explicite tant que la table de liaison n a pas ete creee, plutot
    // qu un 500 opaque sur une base non migree.
    const message = String(err?.message || '').toLowerCase();
    if (err?.code === 'P2021' || message.includes('brandambassador')) {
      return sendError(event, createError({
        statusCode: 503,
        statusMessage: 'Migration des rattachements marque non appliquee sur cette base',
      }));
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Rattachement aux marques impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
