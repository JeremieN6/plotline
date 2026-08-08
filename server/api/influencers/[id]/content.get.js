let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

function isMissingScopeColumnError(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === 'P2022'
    || message.includes('brandid')
    || message.includes('ambassadorid')
    || message.includes('unknown argument')
    || message.includes('unknown field');
}

const CONTENT_SELECT = {
  id: true,
  imageUrl: true,
  caption: true,
  errorMessage: true,
  platform: true,
  format: true,
  status: true,
  scheduledAt: true,
  publishedAt: true,
  twitterPublishedAt: true,
  createdAt: true,
  campaignId: true,
  campaign: {
    select: {
      id: true,
      name: true,
      objective: true,
      channel: true,
    },
  },
};

// Colonnes recentes: si la base n'est pas encore migree, on les retire du select une a une
// et on renvoie null a la place, plutot que de faire echouer toute la liste.
const OPTIONAL_SELECT_FIELDS = ['twitterPublishedAt'];

async function findContents(prisma, where) {
  let select = { ...CONTENT_SELECT };
  const missingFields = [];

  for (let attempt = 0; attempt <= OPTIONAL_SELECT_FIELDS.length; attempt += 1) {
    try {
      const rows = await prisma.generatedContent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select,
      });

      if (!missingFields.length) {
        return rows;
      }

      const nullPatch = Object.fromEntries(missingFields.map((field) => [field, null]));
      return rows.map((item) => ({ ...item, ...nullPatch }));
    } catch (queryErr) {
      const missing = OPTIONAL_SELECT_FIELDS.find(
        (field) => field in select && String(queryErr?.message || '').toLowerCase().includes(field.toLowerCase()),
      );

      if (!missing) {
        throw queryErr;
      }

      delete select[missing];
      missingFields.push(missing);
    }
  }

  throw new Error('Impossible de charger les contenus apres retrait des colonnes optionnelles');
}

export default defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const query = getQuery(event);
    const statusValue = query.statuses || query.status || 'PENDING';
    const campaignId = String(query.campaignId || '').trim();
    const statuses = String(statusValue)
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean);

    const validStatuses = ['PROCESSING', 'PENDING', 'VALIDATED', 'PUBLISHED', 'REJECTED', 'FAILED'];
    if (!statuses.length || statuses.some((status) => !validStatuses.includes(status))) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Statut invalide' }));
    }

    const prisma = await getPrisma();

    const baseWhere = {
      status: statuses.length === 1 ? statuses[0] : { in: statuses },
    };

    if (campaignId) {
      baseWhere.campaignId = campaignId;
    }

    // Un contenu genere "avec ambassadrice" est stocke avec influencerId = ambassadrice
    // (le pipeline en a besoin pour retrouver la face ref), tandis que le profil depuis
    // lequel on travaillait part dans brandId. Filtrer uniquement sur influencerId rendait
    // donc ces contenus invisibles depuis le profil actif. On couvre les trois rattachements.
    let contents;
    try {
      contents = await findContents(prisma, {
        ...baseWhere,
        OR: [
          { influencerId: id },
          { brandId: id },
          { ambassadorId: id },
        ],
      });
    } catch (scopeErr) {
      if (!isMissingScopeColumnError(scopeErr)) {
        throw scopeErr;
      }

      // Base sans les colonnes brandId/ambassadorId: on retombe sur l'ancien filtrage.
      contents = await findContents(prisma, { ...baseWhere, influencerId: id });
    }

    return { contents };
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Impossible de charger les contenus',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
