import { ART_DIRECTIONS, DEFAULT_ART_DIRECTION_ID } from '../data/artDirections.js';

// Widgets dont la scene accepte une DA (pour l'instant : Video Scenario, dont la
// scene est un champ libre ; les autres ont un template fixe).
export const ART_DIRECTION_WIDGET_IDS = ['SCENARIO_BLOG'];

export function normalizeArtDirectionId(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ART_DIRECTIONS.some((item) => item.id === normalized) ? normalized : null;
}

export function getArtDirection(id) {
  const normalized = normalizeArtDirectionId(id);
  return normalized ? ART_DIRECTIONS.find((item) => item.id === normalized) : null;
}

/** Liste exposee a l'interface (sans le texte de la scene : il reste cote serveur). */
export function listArtDirections() {
  return ART_DIRECTIONS.map(({ id, label, description }) => ({ id, label, description }));
}

export function getDefaultArtDirectionScene() {
  return getArtDirection(DEFAULT_ART_DIRECTION_ID).scenePrompt;
}

/** Ajoute le fragment de DA en tete d'une scene. Sans DA demandee, la scene est renvoyee telle quelle. */
export function applyArtDirection(sceneText, artDirectionId) {
  const direction = getArtDirection(artDirectionId);
  const scene = String(sceneText || '').trim();
  if (!direction) return scene;
  return scene ? `${direction.scenePrompt}. ${scene}` : direction.scenePrompt;
}

/**
 * Scene d'une video venue d'un appelant externe (sassify) : une DA demandee
 * explicitement l'emporte ; sinon le decor propre au pilier ; sinon la scene
 * neutre par defaut (jamais le script, voir tasks/lessons.md 2026-10-05).
 */
export function resolveExternalScene({ artDirection, decorPrompt }) {
  const direction = getArtDirection(artDirection);
  if (direction) return direction.scenePrompt;
  return String(decorPrompt || '').trim() || getDefaultArtDirectionScene();
}
