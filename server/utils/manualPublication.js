// Publication faite a la main (hors de l outil) : le createur telecharge la video, la poste lui-meme, puis
// la marque « publiee » avec la date reelle et la ou les plateformes. Fonctions pures.

/** Plateformes proposees (le client a la meme liste avec les libelles : app/utils/manualPlatforms.js). */
export const MANUAL_PLATFORM_IDS = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'X', 'FACEBOOK', 'LINKEDIN'];

const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;
const OLDEST = new Date('2020-01-01T00:00:00Z');

/** Une erreur de saisie destinee a l utilisateur (400). */
function inputError(message) {
  const error = new Error(message);
  error.userMessage = message;
  return error;
}

export function isManualPublicationInputError(error) {
  return Boolean(error?.userMessage);
}

/**
 * Valide la saisie : { publishedAt, platforms }. Renvoie { at: Date, platforms: string[] }.
 * La date ne peut pas etre dans le futur (on enregistre ce qui est DEJA publie).
 */
export function parseManualPublishInput(body, now = new Date()) {
  const rawDate = String(body?.publishedAt || '').trim();
  if (!rawDate) throw inputError('Indique la date de publication.');
  const at = new Date(rawDate);
  if (Number.isNaN(at.getTime())) throw inputError('Date de publication invalide.');
  if (at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) throw inputError('La date de publication ne peut pas être dans le futur.');
  if (at < OLDEST) throw inputError('Date de publication invalide.');

  const wanted = Array.isArray(body?.platforms) ? body.platforms : [];
  const platforms = [...new Set(wanted.map((value) => String(value || '').trim().toUpperCase()))]
    .filter((value) => MANUAL_PLATFORM_IDS.includes(value));
  if (!platforms.length) throw inputError('Choisis au moins une plateforme.');

  return { at, platforms };
}

/** Lecture tolerante de la colonne JSON : null si absente ou invalide. */
export function readManualPublication(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const at = new Date(value.at);
  const platforms = (Array.isArray(value.platforms) ? value.platforms : []).filter((item) => MANUAL_PLATFORM_IDS.includes(item));
  if (Number.isNaN(at.getTime()) || !platforms.length) return null;
  return { at: at.toISOString(), platforms };
}

/**
 * Donnees a ecrire sur un contenu VALIDE marque « publie » a la main.
 * - la date devient `scheduledAt` : le calendrier place les contenus a cette date ;
 * - Instagram et X reutilisent leurs drapeaux existants (badge IG / X, et plus de bouton « Publier » en double) ;
 * - `isCover` faux (diapositive d un carrousel autre que la couverture) : pas de date, une seule puce au calendrier.
 */
export function buildManualPublishData(content, { at, platforms }, { isCover = true } = {}) {
  const data = {
    status: 'PUBLISHED',
    manualPublication: { at: at.toISOString(), platforms },
    scheduledAt: isCover ? at : null,
  };
  if (platforms.includes('INSTAGRAM') && !content?.publishedAt) data.publishedAt = at;
  if (platforms.includes('X') && !content?.twitterPublishedAt) data.twitterPublishedAt = at;
  return data;
}

/**
 * Annule une publication manuelle. On ne retire un drapeau Instagram / X que s il a ete pose par cette
 * publication manuelle (meme instant) : une vraie publication faite ensuite par l outil n est jamais effacee.
 * Le contenu redevient « Valide » seulement s il ne reste aucune autre publication.
 */
export function buildManualUnpublishData(content) {
  const manual = readManualPublication(content?.manualPublication);
  if (!manual) return null;
  const same = (date) => Boolean(date) && new Date(date).toISOString() === manual.at;
  const keepsInstagram = Boolean(content.publishedAt) && !(manual.platforms.includes('INSTAGRAM') && same(content.publishedAt));
  const keepsX = Boolean(content.twitterPublishedAt) && !(manual.platforms.includes('X') && same(content.twitterPublishedAt));

  const data = { manualPublication: null, scheduledAt: null };
  if (manual.platforms.includes('INSTAGRAM') && same(content.publishedAt)) data.publishedAt = null;
  if (manual.platforms.includes('X') && same(content.twitterPublishedAt)) data.twitterPublishedAt = null;
  data.status = keepsInstagram || keepsX ? 'PUBLISHED' : 'VALIDATED';
  return data;
}
