import { BLOB_STORAGE_BUDGET_BYTES, importPathPrefix } from '../../utils/contentImport.js';
import { getBlobUsage } from '../../utils/blobUsage.js';

// Place restante sur le stockage, pour griser l import avant d envoyer des fichiers qui feraient deborder le forfait gratuit.
export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);

  if (!String(process.env.BLOB_READ_WRITE_TOKEN || '').trim()) {
    return sendError(event, createError({ statusCode: 503, statusMessage: 'Stockage de fichiers non configuré' }));
  }

  try {
    const usage = await getBlobUsage();
    return {
      prefix: importPathPrefix(user.id),
      usedBytes: usage.bytes,
      budgetBytes: BLOB_STORAGE_BUDGET_BYTES,
      remainingBytes: usage.complete ? Math.max(0, BLOB_STORAGE_BUDGET_BYTES - usage.bytes) : 0,
      complete: usage.complete,
    };
  } catch {
    return sendError(event, createError({ statusCode: 502, statusMessage: 'Lecture du stockage impossible' }));
  }
});
