import { getWidgets } from '../../data/widgets.js';
import { getPromptPatterns } from '../../data/promptPatterns.js';
import { isPatternAllowedForAccount } from '../../utils/promptPatternSelector.js';

export default defineEventHandler(async (event) => {
  try {
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    // Seuls les patterns que ce compte a le droit de choisir sont exposes --
    // filtre serveur, jamais un filtrage cote front sur la liste complete.
    const patterns = getPromptPatterns()
      .filter((pattern) => pattern.selectable === true && isPatternAllowedForAccount(pattern, user.accountType))
      .map(({ id, nom, type, widgetId, tier, tags, statut }) => ({ id, nom, type, widgetId, tier, tags, statut }));

    return { widgets: getWidgets(), patterns };
  } catch (err) {
    if (err?.statusCode) throw err;
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
