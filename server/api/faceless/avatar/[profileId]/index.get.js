import { requireFacelessPersona, summarizePack } from '../../../../utils/facelessApi.js';
import { catalogForGender } from '../../../../data/facelessAvatarCatalog.js';
import { DEFAULT_PACK_MODEL, describeImageModels, imageCostUsd, resolvePackModel } from '../../../../data/imageModels.js';
import { PACK_STALE_MS } from '../../../../utils/facelessAvatarPack.js';

// Etat du pack d avatars d une persona (a interroger pendant une generation).
export default defineEventHandler(async (event) => {
  const { persona, style } = await requireFacelessPersona(event, event.context?.params?.profileId);
  const pack = summarizePack(style, catalogForGender(persona.gender));

  // Une generation interrompue (redemarrage du serveur) ne doit pas rester "en cours" a vie.
  if (pack.generating && Date.now() - (style.avatar.pack?.startedAt || 0) >= PACK_STALE_MS) pack.generating = false;

  return {
    profileId: persona.id,
    hasFaceRef: Boolean(persona.faceRefPath),
    imageCostUsd: imageCostUsd(resolvePackModel()),
    imageModels: describeImageModels(),
    defaultImageModel: resolvePackModel() || DEFAULT_PACK_MODEL,
    avatarPrompt: style.avatarPrompt,
    pack,
  };
});
