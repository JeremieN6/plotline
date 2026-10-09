import { requireFacelessPersona, summarizePack } from '../../../utils/facelessApi.js';
import { AVATAR_PACK_CATALOG } from '../../../data/facelessAvatarCatalog.js';

// DA faceless d une persona (ou la DA par defaut adaptee a son genre si rien n est enregistre).
export default defineEventHandler(async (event) => {
  const { persona, style, stored } = await requireFacelessPersona(event, event.context?.params?.profileId);

  return {
    profileId: persona.id,
    profileName: persona.name,
    gender: persona.gender,
    hasFaceRef: Boolean(persona.faceRefPath),
    stored,
    style: { ...style, avatar: { ...style.avatar, pack: null } },
    pack: summarizePack(style, AVATAR_PACK_CATALOG),
  };
});
