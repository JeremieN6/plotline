import { readImageSourceBuffer } from './faceRefReader.js';
import { buildReferenceLabelText, normalizeLibraryAssetIds } from './libraryReferences.js';

/**
 * Charge les fiches des assets de la bibliotheque a joindre a une generation
 * d'image. Les assets sont retrouves en base (jamais d'URL venue du client),
 * filtres par proprietaire, et renvoyes dans l'ordre demande. Un asset supprime,
 * sans fiche ou dont la fiche est illisible est ignore avec un avertissement :
 * une regeneration ne doit pas echouer pour ca.
 *
 * `startIndex` : numero de la premiere image d'asset (apres face ref et packshot).
 * `maxCount` : plafond d'images restantes.
 * Renvoie { parts, assets } ; `assets` = [{ code, type }] aligne sur `parts`.
 */
export async function loadLibraryReferenceParts({
  prisma,
  ids,
  ownerUserId,
  startIndex = 1,
  maxCount = Infinity,
  readImage = readImageSourceBuffer,
} = {}) {
  const wanted = normalizeLibraryAssetIds(ids);
  if (!wanted.length) return { parts: [], assets: [] };

  const owner = String(ownerUserId || '').trim();
  if (!owner) {
    console.warn('[library-assets] proprietaire inconnu, assets ignores');
    return { parts: [], assets: [] };
  }

  const rows = await prisma.referenceAsset.findMany({
    where: { id: { in: wanted }, userId: owner },
    select: { id: true, code: true, type: true, sheetUrl: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  const parts = [];
  const assets = [];
  for (const id of wanted) {
    if (assets.length >= maxCount) {
      console.warn('[library-assets] plafond de references atteint, assets restants ignores');
      break;
    }

    const row = byId.get(id);
    if (!row) {
      console.warn('[library-assets] asset introuvable (supprime ?), ignore', { id });
      continue;
    }
    if (!String(row.sheetUrl || '').trim()) {
      console.warn('[library-assets] asset sans fiche, ignore', { code: row.code });
      continue;
    }

    let sheet;
    try {
      sheet = await readImage(row.sheetUrl);
    } catch (error) {
      console.warn('[library-assets] fiche illisible, asset ignore', { code: row.code, message: error?.message });
      continue;
    }

    parts.push({ text: buildReferenceLabelText(startIndex + assets.length, row.code) });
    parts.push({ inlineData: { mimeType: sheet.mimeType, data: sheet.buffer.toString('base64') } });
    assets.push({ code: row.code, type: row.type });
  }

  return { parts, assets };
}
