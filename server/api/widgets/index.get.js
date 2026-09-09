import { getWidgets } from '../../data/widgets.js';

export default defineEventHandler(async (event) => {
  try {
    const authModule = await import('../../utils/auth.js');
    await authModule.requireAuthUser(event);

    return { widgets: getWidgets() };
  } catch (err) {
    if (err?.statusCode) throw err;
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
