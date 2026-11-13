import { handleUpload } from '@vercel/blob/client';
import {
  IMPORT_ALLOWED_TYPES,
  importMaxBytes,
  importPathPrefix,
  storageVerdict,
  validateImportFile,
} from '../../utils/contentImport.js';
import { getBlobUsage } from '../../utils/blobUsage.js';

// Jeton de televersement DIRECT navigateur -> Vercel Blob (le fichier ne passe pas par le serveur : nginx limite a 25 Mo).
// Le jeton n autorise qu un chemin sous imports/<compte>/, un type et une taille bornes, et seulement s il reste de la place.
export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);

  if (!String(process.env.BLOB_READ_WRITE_TOKEN || '').trim()) {
    return sendError(event, createError({ statusCode: 503, statusMessage: 'Stockage de fichiers non configuré' }));
  }

  const body = await readBody(event);

  try {
    return await handleUpload({
      body,
      request: event.node.req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!String(pathname || '').startsWith(importPathPrefix(user.id)) || String(pathname).includes('..')) {
          throw new Error('Chemin de fichier refusé.');
        }

        let declared = {};
        try {
          declared = JSON.parse(String(clientPayload || '{}'));
        } catch {
          declared = {};
        }
        const problem = validateImportFile({ contentType: declared.contentType, size: declared.size });
        if (problem) throw new Error(problem);

        const usage = await getBlobUsage();
        const verdict = storageVerdict(usage.complete ? usage.bytes : Number.POSITIVE_INFINITY, declared.size);
        if (!verdict.ok) throw new Error('Plus assez de place sur le stockage pour ce fichier.');

        return {
          allowedContentTypes: IMPORT_ALLOWED_TYPES,
          maximumSizeInBytes: importMaxBytes(declared.contentType),
          addRandomSuffix: true,
        };
      },
    });
  } catch (err) {
    return sendError(event, createError({ statusCode: 400, statusMessage: err?.message || 'Envoi refusé' }));
  }
});
