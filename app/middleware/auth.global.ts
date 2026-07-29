import {
  hasAccountType,
  resolveAccountHomePath,
  resolveOnboardingPath,
} from '~/composables/useAccountRouting'

const PUBLIC_PATHS = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/confirm-email-change',
];

const AUTH_ENTRY_PATHS = ['/auth/login', '/auth/signup'];

function isPublicPath(path: string) {
  if (PUBLIC_PATHS.includes(path)) return true;
  return false;
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, refreshAuth } = useAuthSession();
  await refreshAuth();

  const authenticated = Boolean(user.value?.id);
  const publicPath = isPublicPath(to.path);
  const accountType = String(user.value?.accountType || '').trim();
  const onboardingPath = to.path.startsWith('/onboarding');
  const targetAfterLogin = resolveAccountHomePath(accountType);

  if (!authenticated && !publicPath) {
    const redirect = encodeURIComponent(to.fullPath || '/onboarding');
    return navigateTo(`/auth/login?redirect=${redirect}`);
  }

  if (authenticated && AUTH_ENTRY_PATHS.includes(to.path)) {
    if (!hasAccountType(accountType)) {
      return navigateTo('/onboarding');
    }
    return navigateTo(targetAfterLogin);
  }

  if (authenticated && to.path === '/' && hasAccountType(accountType)) {
    return navigateTo(targetAfterLogin);
  }

  if (!authenticated) {
    return;
  }

  if (!hasAccountType(accountType) && !onboardingPath) {
    return navigateTo('/onboarding');
  }

  if (hasAccountType(accountType) && to.path === '/onboarding') {
    return navigateTo(resolveOnboardingPath(accountType));
  }

  if (hasAccountType(accountType) && onboardingPath) {
    const expectedPath = resolveOnboardingPath(accountType);
    if (to.path !== expectedPath) {
      return navigateTo(targetAfterLogin);
    }
  }
});
