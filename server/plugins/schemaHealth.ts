export default defineNitroPlugin(async () => {
  try {
    const prismaModule = await import('../utils/prisma.js');
    const healthModule = await import('../utils/schemaHealth.js');
    const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;

    if (!prisma) {
      console.warn('[schema-health] Prisma client unavailable, skip schema check.');
      return;
    }

    const report = await healthModule.buildSchemaHealthReport(prisma);
    if (report.ok) {
      return;
    }

    const serializedMissing = JSON.stringify(report.missing);
    const message = `[schema-health] Missing columns detected: ${serializedMissing}`;
    const strictMode = String(process.env.SCHEMA_HEALTH_STRICT || '').trim().toLowerCase() === 'true';

    if (strictMode) {
      throw new Error(message);
    }

    console.warn(message);
  } catch (error) {
    const strictMode = String(process.env.SCHEMA_HEALTH_STRICT || '').trim().toLowerCase() === 'true';
    if (strictMode) {
      throw error;
    }

    console.warn('[schema-health] Runtime schema check failed (non-blocking):', error?.message || error);
  }
});
