let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

const MAX_ROWS = 20000;

/**
 * Usage du mois (lecture seule, aucune limite appliquee) :
 *   GET /api/usage                  -> mon compte, mois courant, par profil
 *   GET /api/usage?month=2026-09    -> un autre mois
 *   GET /api/usage?scope=all        -> TOUS les comptes (admin uniquement)
 */
export default defineEventHandler(async (event) => {
  try {
    const authModule = await import('../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const { monthRange, summarizeUsage } = await import('../utils/usageSummary.js');
    const prisma = await getPrisma();

    const query = getQuery(event);
    const allAccounts = String(query?.scope || '') === 'all';
    if (allAccounts && !user.isAdmin) {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'Reserve aux comptes administrateur' }));
    }

    const { label, start, end } = monthRange(query?.month);
    const inMonth = { gte: start, lt: end };
    const ownerFilter = allAccounts ? {} : { influencer: { is: { userId: user.id } } };

    const [versions, failedContents] = await Promise.all([
      prisma.contentVersion.findMany({
        where: { createdAt: inMonth, content: { is: ownerFilter } },
        select: {
          contentId: true,
          imageUrl: true,
          generationModel: true,
          content: { select: { influencerId: true, influencer: { select: { name: true, userId: true } } } },
        },
        take: MAX_ROWS,
      }),
      prisma.generatedContent.findMany({
        where: { createdAt: inMonth, status: 'FAILED', ...ownerFilter },
        select: { influencerId: true, influencer: { select: { name: true, userId: true } } },
        take: MAX_ROWS,
      }),
    ]);

    const groupBy = (key) => {
      const groups = new Map();
      const entry = (id, name) => {
        if (!groups.has(id)) groups.set(id, { id, name, versions: [], failed: 0 });
        return groups.get(id);
      };
      for (const version of versions) {
        const { id, name } = key(version.content);
        entry(id, name).versions.push(version);
      }
      for (const content of failedContents) {
        const { id, name } = key(content);
        entry(id, name).failed += 1;
      }
      return [...groups.values()].map((group) => ({
        id: group.id,
        name: group.name,
        ...summarizeUsage({ versions: group.versions, failed: group.failed }),
      }));
    };

    let breakdown;
    if (allAccounts) {
      const rows = groupBy((content) => ({ id: content.influencer?.userId || 'inconnu', name: '' }));
      const users = await prisma.user.findMany({
        where: { id: { in: rows.map((row) => row.id) } },
        select: { id: true, email: true },
      });
      const emailById = new Map(users.map((entry) => [entry.id, entry.email]));
      breakdown = rows.map((row) => ({ ...row, name: emailById.get(row.id) || row.id }));
    } else {
      breakdown = groupBy((content) => ({ id: content.influencerId, name: content.influencer?.name || content.influencerId }));
    }

    breakdown.sort((a, b) => b.generations - a.generations);

    return {
      month: label,
      scope: allAccounts ? 'all' : 'account',
      truncated: versions.length >= MAX_ROWS || failedContents.length >= MAX_ROWS,
      total: summarizeUsage({ versions, failed: failedContents.length }),
      breakdown,
      limits: 'Compte les generations (versions) et les contenus en echec. Ne voit pas les candidates de fiche de reference, ni les appels enchaines d une video longue.',
    };
  } catch (error) {
    if (error?.statusCode) throw error;
    console.error('[usage] erreur', error);
    throw createError({ statusCode: 500, statusMessage: 'Impossible de calculer l usage' });
  }
});
