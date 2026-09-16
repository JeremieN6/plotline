/**
 * Profil generique auto-cree par compte pour le contenu qui n'a pas besoin
 * d'etre rattache a un persona du catalogue (personnage fictif du widget
 * "Video Scenario", affiche produit, contenu ponctuel...). La colonne
 * GeneratedContent.influencerId reste obligatoire en base (c'est ce qui permet
 * de retrouver le contenu dans Mes creations) -- ce profil ACTIVITY neutre en
 * tient lieu par defaut, sans jamais etre propose dans les selecteurs de
 * persona (aucun faceRefPath, donc exclu de useAmbassadorSelection).
 */

export const DEFAULT_PROFILE_NAME = 'Contenus sans persona';

export async function getOrCreateDefaultProfile(prisma, userId) {
  const existing = await prisma.profile.findFirst({
    where: { userId, profileType: 'ACTIVITY', name: DEFAULT_PROFILE_NAME },
  });
  if (existing) return existing;

  return prisma.profile.create({
    data: {
      userId,
      name: DEFAULT_PROFILE_NAME,
      niche: 'Contenu sans persona attribue',
      style: 'Variable selon le prompt',
      profileType: 'ACTIVITY',
    },
  });
}
