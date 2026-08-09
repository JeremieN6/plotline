/**
 * Rattachements marque <-> ambassadrice.
 *
 * Une ambassadrice represente souvent plusieurs marques: les liens vivent dans
 * la table `BrandAmbassador`. L ancienne colonne `brandId`, limitee a une seule
 * marque, sert encore de repli tant que la migration n est pas passee partout.
 */

/** La table de liaison n existe pas encore sur cette base. */
function isMissingLinkTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'P2021'
    || message.includes('brandambassador')
    || message.includes('does not exist');
}

/**
 * Marques rattachees, par ambassadrice. Retombe sur `brandId` si la table de
 * liaison n est pas encore la, pour ne jamais faire echouer la liste des profils.
 */
export async function readBrandIdsByAmbassador(prisma, profiles) {
  const ambassadorIds = profiles.map((profile) => profile.id);
  if (!ambassadorIds.length) {
    return new Map();
  }

  try {
    const links = await prisma.brandAmbassador.findMany({
      where: { ambassadorId: { in: ambassadorIds } },
      select: { brandId: true, ambassadorId: true },
    });

    const byAmbassador = new Map();
    for (const link of links) {
      const current = byAmbassador.get(link.ambassadorId) || [];
      current.push(link.brandId);
      byAmbassador.set(link.ambassadorId, current);
    }

    return byAmbassador;
  } catch (error) {
    if (!isMissingLinkTableError(error)) {
      throw error;
    }

    const fallback = new Map();
    for (const profile of profiles) {
      if (profile?.brandId) {
        fallback.set(profile.id, [profile.brandId]);
      }
    }

    return fallback;
  }
}

/**
 * Remplace la liste des marques d une ambassadrice. On calcule le differentiel
 * plutot que de tout supprimer puis recreer: les liens conserves gardent ainsi
 * leur date de rattachement.
 */
export async function setBrandsForAmbassador(prisma, ambassadorId, brandIds) {
  const desired = [...new Set(
    (Array.isArray(brandIds) ? brandIds : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )];

  const existing = await prisma.brandAmbassador.findMany({
    where: { ambassadorId },
    select: { brandId: true },
  });

  const existingIds = new Set(existing.map((link) => link.brandId));
  const toAdd = desired.filter((brandId) => !existingIds.has(brandId));
  const toRemove = [...existingIds].filter((brandId) => !desired.includes(brandId));

  if (toRemove.length) {
    await prisma.brandAmbassador.deleteMany({
      where: { ambassadorId, brandId: { in: toRemove } },
    });
  }

  if (toAdd.length) {
    await prisma.brandAmbassador.createMany({
      data: toAdd.map((brandId) => ({ ambassadorId, brandId })),
      skipDuplicates: true,
    });
  }

  // `brandId` reste alimente avec la premiere marque tant que la colonne existe:
  // le code qui ne connait pas encore la table de liaison continue de fonctionner.
  await prisma.profile.update({
    where: { id: ambassadorId },
    data: { brandId: desired[0] || null },
  }).catch(() => {});

  return desired;
}
