import { getPromptPatterns } from '../data/promptPatterns.js';

/**
 * Regles de selection des patterns (voir server/data/promptPatterns.js pour
 * le detail de chaque champ). Fonctions pures : la verification serveur doit
 * etre appelee a CHAQUE point d entree qui accepte un patternId (liste des
 * widgets, resolve, fields-assist, routage CUSTOM_PROMPT_STUDIO), jamais
 * seulement filtree cote front.
 */

export function isPatternAllowedForAccount(pattern, accountType) {
  if (!pattern) return false;
  if (!pattern.accountTypeRestriction) return true;
  return pattern.accountTypeRestriction === String(accountType || '').trim().toUpperCase();
}

/** Patterns qu un compte donne peut choisir pour un widget donne (Studio manuel). */
export function listSelectablePatterns({ widgetId, accountType } = {}) {
  const key = String(widgetId || '').trim().toUpperCase();

  return getPromptPatterns().filter(
    (pattern) => pattern.widgetId === key
      && pattern.selectable === true
      && isPatternAllowedForAccount(pattern, accountType),
  );
}

/**
 * Verifie qu un patternId demande explicitement (resolve/fields-assist) est
 * bien selectionnable par ce compte pour ce widget. Renvoie le pattern ou
 * `null` -- a l appelant de refuser la requete si `null` (jamais silencieux).
 */
export function resolvePatternForAccount({ patternId, widgetId, accountType }) {
  if (!patternId) return null;

  const key = String(widgetId || '').trim().toUpperCase();
  const found = listSelectablePatterns({ widgetId: key, accountType })
    .find((pattern) => pattern.id === String(patternId || '').trim().toUpperCase());

  return found || null;
}

/**
 * Un pattern est utilisable par la cadence uniquement s il est `automatable`,
 * `selectable`, ET sans restriction de compte -- garde-fou EXPLICITE, pas
 * seulement une consequence des donnees actuelles : un futur pattern marque
 * par erreur `automatable: true` ET restreint a un type de compte ne doit
 * jamais pouvoir contourner ce controle en passant par la cadence (qui n a
 * pas de notion de compte au moment du routage -- voir
 * chooseCustomPromptWidgetAndPattern). Exportee separement pour etre testee
 * independamment des donnees reelles de promptPatterns.js.
 */
export function isAutomatablePattern(pattern) {
  return Boolean(pattern)
    && pattern.automatable === true
    && pattern.selectable === true
    && !pattern.accountTypeRestriction;
}

/**
 * Pattern automatique pour la cadence (CUSTOM_PROMPT_STUDIO) : un seul
 * pattern actif par widget dans ce lot (pas de selection par tag, voir
 * CLAUDE.md).
 */
export function getAutomatablePatternForWidget(widgetId) {
  const key = String(widgetId || '').trim().toUpperCase();

  return getPromptPatterns().find(
    (pattern) => pattern.widgetId === key && isAutomatablePattern(pattern),
  ) || null;
}

/**
 * Fusionne un pattern sur son widget de base : `template`/`negativePrompt` du
 * pattern priment s ils sont definis, et chaque `assistHintOverrides[key]`
 * remplace l `assistHint` de la variable correspondante. Le widget de base
 * n est jamais modifie -- un nouvel objet est renvoye.
 */
export function buildEffectiveWidget(widget, pattern) {
  if (!widget) return widget;
  if (!pattern) return widget;

  const variables = (widget.variables || []).map((variable) => {
    const override = pattern.assistHintOverrides?.[variable.key];
    return override ? { ...variable, assistHint: override } : variable;
  });

  return {
    ...widget,
    variables,
    template: pattern.template || widget.template,
    negativePrompt: pattern.negativePrompt || widget.negativePrompt,
  };
}
