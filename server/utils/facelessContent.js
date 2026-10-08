/**
 * Lecture des videos faceless en base : la version active porte le renderSpec
 * (plan + voix) dont repart une retouche.
 */

export const FACELESS_PERSONA_SELECT = {
  id: true, name: true, niche: true, style: true, gender: true, description: true, targetAudience: true,
};

/**
 * renderSpec de la version active ; a defaut (versions anciennes sans drapeau
 * actif), celui de la version dont le rendu est affiche.
 */
export async function findActiveFacelessSpec(prisma, content) {
  const select = { renderSpec: true, imageUrl: true, isActive: true };
  const versions = await prisma.contentVersion.findMany({
    where: { contentId: content.id },
    orderBy: { createdAt: 'desc' },
    select,
  });

  const active = versions.find((v) => v.isActive)
    || versions.find((v) => v.imageUrl && v.imageUrl === content.imageUrl);
  return active?.renderSpec || null;
}
