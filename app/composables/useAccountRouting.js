const HOME_ROUTES = {
  INFLUENCER_CREATOR: '/dashboard',
  CONTENT_CREATOR: '/studio',
  BRAND: '/brand-studio',
};

const ONBOARDING_ROUTES = {
  INFLUENCER_CREATOR: '/onboarding/influencer-creator',
  CONTENT_CREATOR: '/onboarding/content-creator',
  BRAND: '/onboarding/brand',
};

export function resolveAccountHomePath(accountType) {
  const normalized = String(accountType || '').trim().toUpperCase();
  return HOME_ROUTES[normalized] || '/onboarding';
}

export function resolveOnboardingPath(accountType) {
  const normalized = String(accountType || '').trim().toUpperCase();
  return ONBOARDING_ROUTES[normalized] || '/onboarding';
}

export function hasAccountType(accountType) {
  return Boolean(String(accountType || '').trim());
}
