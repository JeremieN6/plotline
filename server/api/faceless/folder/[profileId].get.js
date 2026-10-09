import { requireFacelessPersona, summarizePack } from '../../../utils/facelessApi.js';
import { AVATAR_PACK_CATALOG, IMAGE_COST_USD } from '../../../data/facelessAvatarCatalog.js';
import { findFacelessVoice } from '../../../data/facelessCatalog.js';
import { ILLUSTRATION_KINDS } from '../../../data/facelessIllustrations.js';
import { PACK_STALE_MS } from '../../../utils/facelessAvatarPack.js';

const MAX_VIDEOS = 24;

// Le dossier faceless d une persona : TOUT ce qui sert a ses videos, au meme endroit
// (DA, avatar et pack d images, illustrations, voix, videos deja faites).
export default defineEventHandler(async (event) => {
  const { prisma, persona, style, stored } = await requireFacelessPersona(event, event.context?.params?.profileId);

  const pack = summarizePack(style, AVATAR_PACK_CATALOG);
  // Une generation interrompue (redemarrage du serveur) ne doit pas rester "en cours" a vie.
  if (pack.generating && Date.now() - (style.avatar.pack?.startedAt || 0) >= PACK_STALE_MS) pack.generating = false;

  let videos = [];
  try {
    videos = await prisma.generatedContent.findMany({
      where: { influencerId: persona.id, versions: { some: { generationModel: 'faceless' } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_VIDEOS,
      select: { id: true, status: true, imageUrl: true, caption: true, createdAt: true },
    });
  } catch (error) {
    console.warn('[faceless-folder] liste des videos impossible', error?.message);
  }

  return {
    profile: { id: persona.id, name: persona.name, gender: persona.gender, hasFaceRef: Boolean(persona.faceRefPath) },
    stored,
    style: {
      name: style.name,
      preset: style.preset,
      palette: style.palette,
      font: style.font,
      card: style.card,
      background: style.background,
      motion: style.motion,
      captions: style.captions,
      rules: style.rules,
      voiceId: style.voiceId,
      voiceLabel: findFacelessVoice(style.voiceId)?.label || '',
      avatarKind: style.avatar.kind,
    },
    avatarPrompt: style.avatarPrompt,
    pack,
    illustrations: (style.illustrations || []).map((item) => ({ ...item, kindLabel: ILLUSTRATION_KINDS[item.kind] })),
    illustrationKinds: Object.entries(ILLUSTRATION_KINDS).map(([value, label]) => ({ value, label })),
    imageCostUsd: IMAGE_COST_USD,
    videos: videos.map((video) => ({ ...video, createdAt: video.createdAt?.toISOString?.() || video.createdAt })),
  };
});
