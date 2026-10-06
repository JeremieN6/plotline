/**
 * Comptage d usage (lecture seule), derive des tables existantes : aucune
 * colonne ni migration. Une "generation" = une ContentVersion creee dans le
 * mois (premiere generation OU regeneration). Limites assumees : ne voit ni
 * les candidates de fiche de reference (client seulement), ni les appels
 * enchaines d une video longue (une seule version pour 1 a 4 appels), ni les
 * tentatives echouees (comptees a part via les contenus FAILED).
 */

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];

/** Pur : bornes UTC [debut, fin[ d un mois "YYYY-MM" (mois courant par defaut). */
export function monthRange(month, now = new Date()) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(month || '').trim());
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();

  return {
    label: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

/** Pur : "video" si l URL du media est une video, sinon "image". */
export function classifyMedia(imageUrl) {
  const path = String(imageUrl || '').split('?')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((extension) => path.endsWith(extension)) ? 'video' : 'image';
}

function emptySummary() {
  return { generations: 0, images: 0, videos: 0, regenerations: 0, failed: 0, byModel: {} };
}

/**
 * Pur : agrege des versions ({ contentId, imageUrl, generationModel }) et un
 * nombre de contenus echoues. `regenerations` = versions au-dela de la
 * premiere de chaque contenu.
 */
export function summarizeUsage({ versions = [], failed = 0 } = {}) {
  const summary = { ...emptySummary(), failed: Number(failed) || 0 };
  const contentIds = new Set();

  for (const version of versions) {
    summary.generations += 1;
    contentIds.add(version.contentId);

    if (classifyMedia(version.imageUrl) === 'video') summary.videos += 1;
    else summary.images += 1;

    const model = String(version.generationModel || '').trim() || 'inconnu';
    summary.byModel[model] = (summary.byModel[model] || 0) + 1;
  }

  summary.regenerations = summary.generations - contentIds.size;
  return summary;
}
