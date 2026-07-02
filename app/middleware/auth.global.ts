const PUBLIC_PATHS = ['/', '/auth/login', '/auth/signup'];

function isPublicPath(path: string) {
  if (PUBLIC_PATHS.includes(path)) return true;
  return false;
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, refreshAuth } = useAuthSession();
  await refreshAuth();

  const authenticated = Boolean(user.value?.id);
  const publicPath = isPublicPath(to.path);

  if (!authenticated && !publicPath) {
    const redirect = encodeURIComponent(to.fullPath || '/dashboard');
    return navigateTo(`/auth/login?redirect=${redirect}`);
  }

  if (authenticated && to.path.startsWith('/auth/')) {
    return navigateTo('/dashboard');
  }
});
