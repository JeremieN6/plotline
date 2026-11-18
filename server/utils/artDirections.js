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

/** Liste exposee a l'interface (sans le texte de la scene : il reste cote serveur). Les parametres n'exposent que cle, libelle, valeur par defaut et options (id, libelle). */
export function listArtDirections() {
  return ART_DIRECTIONS.map(({ id, label, description, parameters }) => ({
    id,
    label,
    description,
    ...(parameters
      ? {
          parameters: parameters.map((parameter) => ({
            key: parameter.key,
            label: parameter.label,
            default: parameter.default,
            options: parameter.options.map((option) => ({ id: option.id, label: option.label })),
          })),
        }
      : {}),
  }));
}

/**
 * Valeurs choisies pour une DA a parametres : une valeur inconnue (ou absente)
 * retombe sur la valeur par defaut, jamais de texte venant du client.
 */
export function normalizeArtDirectionParams(direction, params) {
  const out = {};
  for (const parameter of direction?.parameters || []) {
    const wanted = String(params?.[parameter.key] || '').trim();
    out[parameter.key] = parameter.options.some((option) => option.id === wanted) ? wanted : parameter.default;
  }
  return out;
}

/** Scene d'une DA : son texte fixe, ou base + option choisie de chaque parametre. */
export function composeScene(direction, params) {
  if (!direction?.parameters) return direction?.scenePrompt || '';
  const chosen = normalizeArtDirectionParams(direction, params);
  const parts = direction.parameters.map((parameter) => parameter.options.find((option) => option.id === chosen[parameter.key])?.text);
  return [direction.baseScenePrompt, ...parts].filter(Boolean).join(', ');
}

/**
 * Rythme de parole d'une scene : celui de la DA dont le texte figure dans la
 * scene (pour une DA a parametres, de l'option de rythme dont le texte y figure).
 * Renvoie null si aucune DA ne definit de rythme pour cette scene.
 */
export function speechPaceForScene(scene) {
  const text = String(scene || '');
  for (const direction of ART_DIRECTIONS) {
    if (direction.parameters) {
      if (!direction.baseScenePrompt || !text.includes(direction.baseScenePrompt)) continue;
      for (const parameter of direction.parameters) {
        const option = parameter.options.find((item) => item.speechPace && text.includes(item.text));
        if (option) return option.speechPace;
      }
    } else if (direction.speechPace && text.includes(direction.scenePrompt)) {
      return direction.speechPace;
    }
  }
  return null;
}

export function getDefaultArtDirectionScene() {
  return getArtDirection(DEFAULT_ART_DIRECTION_ID).scenePrompt;
}

/** Ajoute le fragment de DA en tete d'une scene. Sans DA demandee, la scene est renvoyee telle quelle. */
export function applyArtDirection(sceneText, artDirectionId, params) {
  const direction = getArtDirection(artDirectionId);
  const scene = String(sceneText || '').trim();
  if (!direction) return scene;
  const daText = composeScene(direction, params);
  return scene ? `${daText}. ${scene}` : daText;
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
