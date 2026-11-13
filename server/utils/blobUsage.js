// Place occupee sur Vercel Blob (somme des tailles, tous dossiers). La liste coute une operation avancee par page de
// 1 000 fichiers : resultat garde 60 s en memoire, jamais appele en boucle.
import { list } from '@vercel/blob';

const CACHE_MS = 60 * 1000;
const MAX_PAGES = 10;
let cache = null;

export async function getBlobUsage({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  let total = 0;
  let files = 0;
  let cursor;
  let pages = 0;
  do {
    const page = await list({ limit: 1000, cursor });
    pages += 1;
    for (const blob of page.blobs) {
      total += Number(blob.size) || 0;
      files += 1;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && pages < MAX_PAGES);

  // Liste coupee par le plafond de securite : on ne sait pas, donc on ne declare pas de place libre.
  const value = { bytes: total, files, complete: !cursor };
  cache = { at: Date.now(), value };
  return value;
}

/** Apres un import : on oublie la valeur gardee pour que la prochaine lecture soit juste. */
export function invalidateBlobUsage() {
  cache = null;
}
