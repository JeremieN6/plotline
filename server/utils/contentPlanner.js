/**
 * Cerveau du planificateur editorial: a partir de la cadence d un profil, il
 * pose des creneaux dates (quand, quelle plateforme, quel format).
 *
 * Volontairement pur et sans acces base ni reseau: la cadence est la partie du
 * planificateur qui doit rester previsible, y compris quand Claude est
 * indisponible. Le texte des idees est genere ailleurs; ici on ne decide que
 * du rythme.
 */

export const SUPPORTED_PLAN_FORMATS = ['FEED', 'STORY', 'REEL'];
export const DEFAULT_FORMAT_ROTATION = ['FEED', 'STORY', 'REEL'];
export const DEFAULT_POSTS_PER_WEEK = 3;
export const DEFAULT_PUBLISH_HOUR = 18;

const MAX_POSTS_PER_WEEK = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * La rotation est stockee en texte ("FEED,STORY,REEL") pour rester lisible et
 * modifiable sans migration. Toute valeur inconnue est ecartee plutot que de
 * faire echouer la planification entiere.
 */
export function parseFormatRotation(value) {
  const parsed = String(value || '')
    .split(/[,|]/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => SUPPORTED_PLAN_FORMATS.includes(item));

  return parsed.length ? parsed : [...DEFAULT_FORMAT_ROTATION];
}

/** Le format decide de la plateforme, comme dans le pipeline de generation. */
export function platformForFormat(format) {
  return String(format || '').trim().toUpperCase() === 'REEL' ? 'TIKTOK' : 'INSTAGRAM';
}

export function normalizePostsPerWeek(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_POSTS_PER_WEEK;
  return Math.min(Math.floor(parsed), MAX_POSTS_PER_WEEK);
}

export function normalizePublishHour(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 23) return DEFAULT_PUBLISH_HOUR;
  return Math.floor(parsed);
}

/** Nombre de publications a poser sur la periode, jamais moins d une. */
export function countSlots(days, postsPerWeek) {
  const safeDays = Math.max(1, Math.floor(Number(days) || 0));
  const perWeek = normalizePostsPerWeek(postsPerWeek);
  return Math.max(1, Math.round((safeDays * perWeek) / 7));
}

function atPublishHour(baseDate, dayOffset, publishHour) {
  const date = new Date(baseDate.getTime() + dayOffset * DAY_MS);
  date.setHours(publishHour, 0, 0, 0);
  return date;
}

/**
 * Pose les creneaux d une periode. Les publications sont reparties regulierement
 * plutot que groupees en debut de periode: un compte qui publie trois fois par
 * semaine ne publie pas trois jours d affilee puis plus rien.
 *
 * `rotationOffset` reprend la rotation la ou le profil l avait laissee, ce qui
 * evite de toujours redemarrer sur le meme format d une periode a l autre.
 */
export function buildPlanSlots({
  startDate,
  days = 7,
  postsPerWeek = DEFAULT_POSTS_PER_WEEK,
  formatRotation = DEFAULT_FORMAT_ROTATION,
  rotationOffset = 0,
  publishHour = DEFAULT_PUBLISH_HOUR,
} = {}) {
  const base = startDate instanceof Date && !Number.isNaN(startDate.getTime())
    ? new Date(startDate.getTime())
    : new Date();

  const safeDays = Math.max(1, Math.floor(Number(days) || 0));
  const rotation = Array.isArray(formatRotation) && formatRotation.length
    ? formatRotation
    : [...DEFAULT_FORMAT_ROTATION];
  const hour = normalizePublishHour(publishHour);
  const total = countSlots(safeDays, postsPerWeek);
  const spacing = safeDays / total;
  const offset = Number.isFinite(Number(rotationOffset)) ? Math.abs(Math.floor(Number(rotationOffset))) : 0;

  const slots = [];
  for (let index = 0; index < total; index += 1) {
    const format = rotation[(offset + index) % rotation.length];
    slots.push({
      position: index + 1,
      scheduledAt: atPublishHour(base, Math.round(index * spacing), hour),
      format,
      platform: platformForFormat(format),
    });
  }

  return slots;
}

/**
 * Idee de contenu de repli, utilisee quand Claude est indisponible ou renvoie
 * une reponse inexploitable. Elle n a pas vocation a etre publiee telle quelle:
 * elle donne un point de depart editable plutot qu un plan vide.
 */
export function buildFallbackIdea({ profile, format, position }) {
  const name = String(profile?.name || 'le profil').trim();
  const niche = String(profile?.niche || '').split(/[,|]/)[0]?.trim() || 'son univers';
  const style = String(profile?.style || '').split(/[,|]/)[0]?.trim() || 'naturel';

  const angleByFormat = {
    FEED: `une scene posee qui met en valeur ${niche}`,
    STORY: `un moment pris sur le vif autour de ${niche}`,
    REEL: `une sequence courte et rythmee autour de ${niche}`,
  };

  const angle = angleByFormat[String(format || '').toUpperCase()] || angleByFormat.FEED;

  return {
    prompt: `${name}, ${angle}, dans un style ${style}.`,
    caption: '',
    hashtags: '',
    isFallback: true,
  };
}
