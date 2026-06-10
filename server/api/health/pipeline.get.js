module.exports = defineEventHandler(async (event) => {
  const prismaModule = await import('../../utils/prisma.js');
  const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;

  if (!prisma) {
    throw createError({ statusCode: 500, statusMessage: 'Prisma unavailable' });
  }

  const query = getQuery(event);
  const hours = Number.parseInt(String(query?.hours || '24'), 10);
  const safeHours = Number.isFinite(hours) && hours > 0 && hours <= 168 ? hours : 24;
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000);
  const processingMaxMinutes = Number.parseInt(String(query?.processingMaxMinutes || '30'), 10);
  const safeProcessingMaxMinutes = Number.isFinite(processingMaxMinutes) && processingMaxMinutes > 0
    ? processingMaxMinutes
    : 30;
  const processingThreshold = new Date(Date.now() - safeProcessingMaxMinutes * 60 * 1000);

  const [
    groupedStatuses,
    recentFailures,
    stuckProcessing,
    recentItems,
  ] = await Promise.all([
    prisma.generatedContent.groupBy({
      by: ['format', 'status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.generatedContent.findMany({
      where: {
        createdAt: { gte: since },
        status: 'FAILED',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        influencerId: true,
        format: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    prisma.generatedContent.findMany({
      where: {
        status: 'PROCESSING',
        createdAt: { lte: processingThreshold },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        id: true,
        influencerId: true,
        format: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.generatedContent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        influencerId: true,
        format: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const byFormat = {};
  for (const row of groupedStatuses) {
    const format = String(row?.format || 'UNKNOWN');
    const status = String(row?.status || 'UNKNOWN');
    if (!byFormat[format]) byFormat[format] = {};
    byFormat[format][status] = row?._count?._all || 0;
  }

  return {
    ok: stuckProcessing.length === 0,
    windowHours: safeHours,
    processingMaxMinutes: safeProcessingMaxMinutes,
    summary: {
      totalRecent: recentItems.length,
      failedRecent: recentFailures.length,
      stuckProcessing: stuckProcessing.length,
      byFormat,
    },
    recentFailures,
    stuckProcessing,
    checkedAt: new Date().toISOString(),
  };
});
