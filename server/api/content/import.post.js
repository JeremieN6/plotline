import { IMPORT_MAX_FILES_PER_BATCH, normalizeImportRow } from '../../utils/contentImport.js';
import { invalidateBlobUsage } from '../../utils/blobUsage.js';
import { getOrCreateDefaultProfile } from '../../utils/defaultProfile.js';
import { recordContentVersion } from '../../utils/contentVersions.js';

// Cree les contenus a partir de fichiers DEJA televerses (imports/<compte>/...). Valide par defaut, jamais publie
// automatiquement : la date et les reseaux ne sont que des reperes de calendrier.
export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const body = await readBody(event);

  const rawRows = Array.isArray(body?.items) ? body.items : [];
  if (!rawRows.length) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Aucun fichier à importer' }));
  }
  if (rawRows.length > IMPORT_MAX_FILES_PER_BATCH) {
    return sendError(event, createError({ statusCode: 400, statusMessage: `${IMPORT_MAX_FILES_PER_BATCH} fichiers au maximum par import` }));
  }

  const rows = [];
  for (const raw of rawRows) {
    const result = normalizeImportRow(raw, user.id);
    if (result.error) {
      return sendError(event, createError({ statusCode: 400, statusMessage: result.error }));
    }
    rows.push(result.row);
  }

  const prismaModule = await import('../../utils/prisma.js');
  const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;

  // Profil cible : un profil du compte, sinon le profil « Contenus sans persona ».
  const requested = String(body?.profileId || '').trim();
  let profile = null;
  if (requested) {
    profile = await prisma.profile.findFirst({ where: { id: requested, userId: user.id }, select: { id: true } });
    if (!profile) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
    }
  } else {
    profile = await getOrCreateDefaultProfile(prisma, user.id);
  }

  const ids = [];
  for (const row of rows) {
    const content = await prisma.generatedContent.create({
      data: {
        influencerId: profile.id,
        imageUrl: row.url,
        caption: row.caption,
        format: row.format,
        platform: 'INSTAGRAM',
        status: 'VALIDATED',
        scheduledAt: row.scheduledAt,
        autoPublish: false,
        ...(row.platforms.length ? { plannedPlatforms: row.platforms } : {}),
      },
      select: { id: true },
    });
    await recordContentVersion(prisma, content.id, {
      imageUrl: row.url,
      caption: row.caption,
      generationModel: 'import',
      format: row.format,
    });
    ids.push(content.id);
  }

  invalidateBlobUsage();
  return { success: true, count: ids.length, ids };
});
