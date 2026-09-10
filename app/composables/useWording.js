import { computed } from 'vue'

const WORDING_BY_TYPE = {
  INFLUENCER_CREATOR: {
    ambassador: 'influenceuse',
    ambassadorMasculine: 'influenceur',
    ambassadorPlural: 'influenceuses',
    visualIdentity: 'persona',
    aiAmbassador: 'influenceuse IA',
  },
  CONTENT_CREATOR: {
    ambassador: 'ambassadrice',
    ambassadorMasculine: 'ambassadeur',
    ambassadorPlural: 'ambassadrices',
    visualIdentity: 'identité visuelle',
    aiAmbassador: 'ambassadrice IA',
  },
  BRAND: {
    ambassador: 'ambassadrice',
    ambassadorMasculine: 'ambassadeur',
    ambassadorPlural: 'ambassadrices',
    visualIdentity: 'identité visuelle',
    aiAmbassador: 'ambassadrice IA',
  },
}

export function useWording() {
  const { user } = useAuthSession()

  const accountType = computed(() => String(user.value?.accountType || '').trim().toUpperCase())

  const wording = computed(() => {
    return WORDING_BY_TYPE[accountType.value] || WORDING_BY_TYPE.INFLUENCER_CREATOR
  })

  // FEED/REEL/STORY est le vocabulaire du workflow Pinterest/influenceuses ;
  // les content creators et les brands voient un libellé simplifié Images/Vidéo.
  function formatLabel(format) {
    const normalized = String(format || '').trim().toUpperCase()

    if (accountType.value === 'CONTENT_CREATOR' || accountType.value === 'BRAND') {
      return normalized === 'FEED' ? 'Images' : 'Vidéo'
    }

    return normalized
  }

  // Genre le nom d'ambassadeur/ambassadrice sur un profil precis (silhouette
  // masculine/feminine choisie a la creation) -- reserve aux endroits qui
  // referencent UN profil identifie (fiche persona, profil actif), pas aux
  // libelles generiques/pluriels ("Mes ambassadrices") qui restent au feminin
  // par defaut faute de profil unique a accorder.
  function ambassadorFor(gender) {
    return String(gender || '').trim().toUpperCase() === 'MALE'
      ? wording.value.ambassadorMasculine
      : wording.value.ambassador
  }

  return {
    accountType,
    wording,
    formatLabel,
    ambassadorFor,
  }
}
