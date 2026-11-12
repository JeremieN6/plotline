// Reseaux choisis au moment de planifier un contenu (GeneratedContent.plannedPlatforms, JSON).
// Aucune verification de connexion : c est un repere de calendrier. Seul INSTAGRAM est publie automatiquement.
import { MANUAL_PLATFORM_IDS } from './manualPublication.js';

/** Liste normalisee (majuscules, sans doublon, liste blanche), ou `undefined` si le corps n en contient pas. */
export function normalizePlannedPlatforms(value) {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.map((item) => String(item || '').trim().toUpperCase()))].filter((item) => MANUAL_PLATFORM_IDS.includes(item));
}

/** La publication automatique n a de sens que si Instagram fait partie des reseaux choisis. */
export function canAutoPublish(platforms) {
  return Array.isArray(platforms) && platforms.includes('INSTAGRAM');
}
