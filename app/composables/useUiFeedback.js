let confirmResolver = null;

export function useUiFeedback() {
  const confirmState = useState('ui-confirm-state', () => ({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmer',
    cancelLabel: 'Annuler',
    tone: 'default',
  }));

  const toasts = useState('ui-toasts', () => []);

  function requestConfirmation(options) {
    confirmState.value = {
      open: true,
      title: options?.title || 'Confirmer',
      message: options?.message || '',
      confirmLabel: options?.confirmLabel || 'Confirmer',
      cancelLabel: options?.cancelLabel || 'Annuler',
      tone: options?.tone || 'default',
    };

    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  function resolveConfirmation(confirmed) {
    confirmState.value = {
      ...confirmState.value,
      open: false,
    };

    if (confirmResolver) {
      confirmResolver(confirmed);
      confirmResolver = null;
    }
  }

  function pushToast(options) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast = {
      id,
      title: options?.title || '',
      message: options?.message || '',
      tone: options?.tone || 'info',
      duration: options?.duration ?? 3200,
    };

    toasts.value = [...toasts.value, toast];

    if (process.client && toast.duration > 0) {
      window.setTimeout(() => {
        removeToast(id);
      }, toast.duration);
    }

    return id;
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  return {
    confirmState,
    toasts,
    requestConfirmation,
    resolveConfirmation,
    pushToast,
    removeToast,
  };
}