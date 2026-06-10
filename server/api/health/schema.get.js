module.exports = defineEventHandler(async () => {
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
