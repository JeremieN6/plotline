module.exports = defineEventHandler(async (event) => {
  // Rapport de schema interne: reserve aux admins (aucun outil du depot ne
  // l interroge sans session). Import dynamique: ce fichier reste en CJS.
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  if (!user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Reserve aux comptes administrateur' });
  }

  const prismaModule = await import('../../utils/prisma.js');
  const healthModule = await import('../../utils/schemaHealth.js');
  const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;

  if (!prisma) {
    return {
      ok: false,
      message: 'Prisma unavailable',
      checkedAt: new Date().toISOString(),
    };
  }

  const report = await healthModule.buildSchemaHealthReport(prisma);
  if (!report.ok) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Schema drift detected',
      data: report,
    });
  }

  return report;
});
