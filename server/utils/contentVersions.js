import { deleteMediaUrls } from './mediaCleanup.js';

// Plafonds de retention: un MP4 pese 30-80 Mo contre ~500 Ko pour une image,
// l historique video est donc volontairement plus court.
export const IMAGE_VERSION_CAP = 5;
export const VIDEO_VERSION_CAP = 2;

export function isVideoContent(format, imageUrl) {
  const normalizedFormat = String(format || '').trim().toUpperCase();
  if (normalizedFormat === 'REEL' || normalizedFormat === 'STORY') {
    return true;
  }

  return String(imageUrl || '').trim().toLowerCase().endsWith('.mp4');
}

export function versionCapFor(format, imageUrl) {
  return isVideoContent(format, imageUrl) ? VIDEO_VERSION_CAP : IMAGE_VERSION_CAP;
}

/**
 * Un media ne doit etre supprime que s il n est plus reference nulle part:
 * ni par le rendu courant du contenu, ni par une version conservee. Le retour
 * arriere recopie l URL d une version dans GeneratedContent, les deux peuvent
 * donc pointer sur le meme fichier.
 */
function collectSafelyDeletableUrls({ versionsToPurge, keptVersions, currentImageUrl }) {
  const stillReferenced = new Set(
    [
      String(currentImageUrl || '').trim(),
      ...keptVersions.map((version) => String(version.imageUrl || '').trim()),
    ].filter(Boolean),
  );

  return versionsToPurge
    .map((version) => String(version.imageUrl || '').trim())
    .filter((url) => url && !stillReferenced.has(url));
}

/**
 * Enregistre un nouveau rendu comme version active et purge les versions
 * excedentaires (les plus anciennes, jamais l active).
 */
export async function recordContentVersion(prisma, contentId, {
  imageUrl,
  caption,
  prompt,
  generationModel,
  format,
} = {}) {
  const id = String(contentId || '').trim();
  if (!id) {
    return null;
  }

  let created;
  try {
    [, created] = await prisma.$transaction([
      prisma.contentVersion.updateMany({
        where: { contentId: id, isActive: true },
        data: { isActive: false },
      }),
      prisma.contentVersion.create({
        data: {
          contentId: id,
          imageUrl: imageUrl || null,
          caption: caption || null,
          prompt: prompt || null,
          generationModel: generationModel || null,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);
  } catch (error) {
    // L historique est un confort: s il echoue (table absente car migration non
    // appliquee, par exemple), la generation elle-meme ne doit pas etre perdue.
    console.warn('[content-versions] enregistrement impossible', {
      contentId: id,
      message: error?.message,
    });
    return null;
  }

  try {
    await purgeExcessVersions(prisma, id, { format, imageUrl });
  } catch (error) {
    console.warn('[content-versions] purge impossible', {
      contentId: id,
      message: error?.message,
    });
  }

  return created;
}

/**
 * Point de passage unique pour finaliser un rendu: met a jour l etat courant du
 * contenu puis archive ce rendu comme nouvelle version active.
 */
export async function finalizeContentWithVersion(prisma, contentId, data, { generationModel } = {}) {
  const updated = await prisma.generatedContent.update({
    where: { id: contentId },
    data,
    select: {
      imageUrl: true,
      caption: true,
      prompt: true,
      format: true,
    },
  });

  await recordContentVersion(prisma, contentId, {
    imageUrl: updated.imageUrl,
    caption: updated.caption,
    prompt: updated.prompt,
    format: updated.format,
    generationModel,
  });

  return updated;
}

export async function purgeExcessVersions(prisma, contentId, { format, imageUrl } = {}) {
  const cap = versionCapFor(format, imageUrl);

  const versions = await prisma.contentVersion.findMany({
    where: { contentId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, imageUrl: true, isActive: true },
  });

  if (versions.length <= cap) {
    return 0;
  }

  const keptVersions = versions.slice(0, cap);
  // Une version active hors plafond reste conservee: on ne supprime jamais le
  // rendu en cours d utilisation.
  const versionsToPurge = versions.slice(cap).filter((version) => !version.isActive);

  if (!versionsToPurge.length) {
    return 0;
  }

  const content = await prisma.generatedContent.findUnique({
    where: { id: contentId },
    select: { imageUrl: true },
  });

  const deletableUrls = collectSafelyDeletableUrls({
    versionsToPurge,
    keptVersions: [...keptVersions, ...versions.slice(cap).filter((version) => version.isActive)],
    currentImageUrl: content?.imageUrl,
  });

  // Media d abord, puis la ligne: si la suppression du fichier echoue, la version
  // reste en base et pourra etre repurgee plus tard plutot que de laisser un orphelin.
  await deleteMediaUrls(deletableUrls);

  await prisma.contentVersion.deleteMany({
    where: { id: { in: versionsToPurge.map((version) => version.id) } },
  });

  return versionsToPurge.length;
}

/**
 * Supprime tous les medias rattaches a un contenu (rendu courant + versions).
 * A appeler avant la suppression du contenu: la cascade SQL effacerait les
 * lignes de versions sans jamais toucher aux fichiers.
 */
export async function deleteAllContentMedia(prisma, contentId, currentImageUrl) {
  const urls = [String(currentImageUrl || '').trim()].filter(Boolean);

  try {
    const versions = await prisma.contentVersion.findMany({
      where: { contentId },
      select: { imageUrl: true },
    });
    urls.push(...versions.map((version) => String(version.imageUrl || '').trim()).filter(Boolean));
  } catch (error) {
    console.warn('[content-versions] lecture des versions impossible avant suppression', {
      contentId,
      message: error?.message,
    });
  }

  return await deleteMediaUrls(urls);
}
