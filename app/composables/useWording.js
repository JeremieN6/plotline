import { computed } from 'vue'

const WORDING_BY_TYPE = {
  INFLUENCER_CREATOR: {
    ambassador: 'influenceuse',
    ambassadorPlural: 'influenceuses',
    visualIdentity: 'persona',
    aiAmbassador: 'influenceuse IA',
  },
  CONTENT_CREATOR: {
    ambassador: 'ambassadrice',
    ambassadorPlural: 'ambassadrices',
    visualIdentity: 'identite visuelle',
    aiAmbassador: 'ambassadrice IA',
  },
  BRAND: {
    ambassador: 'ambassadrice',
    ambassadorPlural: 'ambassadrices',
    visualIdentity: 'identite visuelle',
    aiAmbassador: 'ambassadrice IA',
  },
}

export function useWording() {
  const { user } = useAuthSession()

  const accountType = computed(() => String(user.value?.accountType || '').trim().toUpperCase())

  const wording = computed(() => {
    return WORDING_BY_TYPE[accountType.value] || WORDING_BY_TYPE.INFLUENCER_CREATOR
  })

  return {
    accountType,
    wording,
  }
}
