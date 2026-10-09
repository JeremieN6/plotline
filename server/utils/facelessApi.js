import { loadPersonaStyle } from './facelessStyleStore.js';

/**
 * Contexte commun des routes /api/faceless/style et /api/faceless/avatar :
 * session obligatoire, persona du compte obligatoire (404 sinon).
 * @returns {Promise<{ prisma, user, persona, style, stored }>}
 */
export async function requireFacelessPersona(event, profileId) {
  const authModule = await import('./auth.js');
  const user = await authModule.requireAuthUser(event);

  const prismaModule = await import('./prisma.js');
  const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;

  const id = String(profileId || '').trim();
  if (!id) throw createError({ statusCode: 400, statusMessage: 'profil requis' });

  const loaded = await loadPersonaStyle(prisma, id, user.id);
  if (!loaded) throw createError({ statusCode: 404, statusMessage: 'Profil introuvable' });
  return { prisma, user, ...loaded };
}

export async function requireFacelessUser(event) {
  const authModule = await import('./auth.js');
  return authModule.requireAuthUser(event);
}

/** Resume du pack pour l interface : image de base + une ligne par entree du catalogue. */
export function summarizePack(style, catalog) {
  const pack = style.avatar.pack;
  return {
    kind: style.avatar.kind,
    baseUrl: pack?.baseUrl || '',
    baseSource: pack?.baseSource || '',
    generating: Boolean(pack?.generating),
    entries: catalog.map((entry) => {
      const stored = pack?.entries?.[entry.id];
      return {
        id: entry.id,
        mode: entry.mode,
        label: entry.label,
        status: stored?.status || 'none',
        url: stored?.url || '',
        error: stored?.error || '',
      };
    }),
  };
}
