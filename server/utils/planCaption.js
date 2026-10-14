/**
 * Legende relue dans un plan editorial.
 *
 * A l approbation d un plan, chaque contenu est cree avec la legende + les hashtags que l utilisateur a
 * relus (voir approve.post.js). Les chemins de generation du worker (image, REEL Pinterest, story) ecrivaient
 * pourtant leur propre legende par-dessus, generique (nom du profil et description de la scene seulement) et
 * suivie d un bloc de hashtags fixe : la legende relue disparaissait sans que rien ne le dise.
 *
 * Regle : si le contenu vient d une idee de plan ET porte deja une legende, on la garde. Un contenu hors plan
 * (Studio, generation manuelle) garde le comportement d avant : la legende est ecrite apres la generation.
 * Ne leve jamais : sur erreur de lecture, on retombe sur l ancien comportement (legende generee).
 */
export async function readPlanCaption(prisma, contentId) {
  const id = String(contentId || '').trim();
  if (!id || !prisma) return '';

  try {
    const planItem = await prisma.contentPlanItem.findFirst({ where: { contentId: id }, select: { id: true } });
    if (!planItem) return '';

    const content = await prisma.generatedContent.findUnique({ where: { id }, select: { caption: true } });
    return String(content?.caption || '').trim();
  } catch (error) {
    console.warn('[worker] legende du plan illisible, une legende sera generee', {
      reason: String(error?.message || error).split('\n')[0].slice(0, 160),
    });
    return '';
  }
}
