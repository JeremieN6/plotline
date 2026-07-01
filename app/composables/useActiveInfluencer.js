export function useActiveInfluencer() {
  return useCookie('plotline-active-influencer-id', {
    default: () => '',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}
