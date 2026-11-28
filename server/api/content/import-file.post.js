import { isDevWriteBlocked, DEV_WRITE_BLOCKED_MESSAGE } from '../../utils/blobStorage.js';
import { importMaxBytes, validateImportFile } from '../../utils/contentImport.js';
import { getDiskUsage, isDiskStorageEnabled } from '../../utils/diskStorage.js';
import { receiveImportFile } from '../../utils/diskImport.js';

// Un refus qui repond sans avoir lu le fichier envoye peut casser la connexion : le navigateur n aurait alors pas le
// motif. On lit et jette le reste avant de repondre.
function drain(req) {
  if (req.readableEnded || req.destroyed) return Promise.resolve();
  return new Promise((resolve) => {
    req.once('end', resolve);
    req.once('error', resolve);
    req.once('close', resolve);
    req.resume();
  });
}

// Import vers le disque du serveur : le corps de la requete EST le fichier (nginx doit accepter 160 Mo sur cette
// adresse, voir docs/stockage-disque.md). `?name=` donne le nom d origine, Content-Type le format.
export default defineEventHandler(async (event) => {
  const refuse = async (statusCode, statusMessage) => {
    await drain(event.node.req);
    return sendError(event, createError({ statusCode, statusMessage }));
  };

  const authModule = await import('../../utils/auth.js');
  let user;
  try {
    user = await authModule.requireAuthUser(event);
  } catch (err) {
    await drain(event.node.req);
    throw err;
  }

  if (!isDiskStorageEnabled()) return refuse(409, 'Import direct sur le disque non activé');
  if (isDevWriteBlocked()) return refuse(503, DEV_WRITE_BLOCKED_MESSAGE);

  const contentType = String(getHeader(event, 'content-type') || '').split(';')[0].trim().toLowerCase();
  const size = Number(getHeader(event, 'content-length'));
  const problem = validateImportFile({ contentType, size });
  if (problem) return refuse(400, problem);

  try {
    const usage = await getDiskUsage();
    if (size > usage.availableBytes) return await refuse(400, 'Plus assez de place sur le serveur pour ce fichier.');

    return await receiveImportFile({
      stream: event.node.req,
      userId: user.id,
      name: String(getQuery(event).name || ''),
      contentType,
      maxBytes: importMaxBytes(contentType),
    });
  } catch (err) {
    if (!err?.statusCode) console.error('[import-file] echec', { code: err?.code, message: err?.message });
    return refuse(err?.statusCode || 500, err?.statusCode ? err.message : 'Enregistrement du fichier impossible');
  }
});
