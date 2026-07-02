export function useAuthSession() {
  const user = useState('auth-user', () => null);
  const initialized = useState('auth-initialized', () => false);
  const loading = useState('auth-loading', () => false);

  async function refreshAuth(options = {}) {
    const force = Boolean(options?.force);
    if (loading.value) return user.value;
    if (!force && initialized.value) return user.value;

    loading.value = true;
    try {
      const requestFetch = process.server ? useRequestFetch() : $fetch;
      const response = await requestFetch('/api/auth/me');
      user.value = response?.user || null;
    } catch {
      user.value = null;
    } finally {
      initialized.value = true;
      loading.value = false;
    }

    return user.value;
  }

  return {
    user,
    initialized,
    loading,
    refreshAuth,
  };
}
