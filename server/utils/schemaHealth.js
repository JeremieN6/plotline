const REQUIRED_INFLUENCER_COLUMNS = [
  'id',
  'userId',
  'name',
  'niche',
  'style',
  'faceRefPath',
  'bodyPrompt',
  'hairPrompt',
  'hairAutoPrompt',
  'hairLocked',
  'identityProfile',
  'createdAt',
];

const REQUIRED_GENERATED_CONTENT_COLUMNS = [
  'id',
  'influencerId',
  'format',
  'status',
  'imageUrl',
  'caption',
  'errorMessage',
  'createdAt',
];

async function getExistingColumns(prisma, tableName) {
  const rows = await prisma.$queryRaw`
    SELECT column_name::text AS column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
  `;

  return new Set((rows || []).map((row) => String(row?.column_name || '').trim()).filter(Boolean));
}

function getMissingColumns(existingColumns, requiredColumns) {
  return requiredColumns.filter((column) => !existingColumns.has(column));
}

export async function buildSchemaHealthReport(prisma) {
  const influencerColumns = await getExistingColumns(prisma, 'Influencer');
  const generatedContentColumns = await getExistingColumns(prisma, 'GeneratedContent');

  const missingInfluencerColumns = getMissingColumns(influencerColumns, REQUIRED_INFLUENCER_COLUMNS);
  const missingGeneratedContentColumns = getMissingColumns(generatedContentColumns, REQUIRED_GENERATED_CONTENT_COLUMNS);

  return {
    ok: missingInfluencerColumns.length === 0 && missingGeneratedContentColumns.length === 0,
    missing: {
      Influencer: missingInfluencerColumns,
      GeneratedContent: missingGeneratedContentColumns,
    },
    checkedAt: new Date().toISOString(),
  };
}
