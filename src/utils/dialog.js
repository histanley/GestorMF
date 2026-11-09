// ==============================================================================
// GestorMF - Diálogos e Modais de Confirmação & Alertas Modernos (Substitui confirm/alert nativos)
// ==============================================================================

let globalDialogListener = null;

/**
 * Registra o ouvinte do componente visual montado na raiz
 */
export function registerDialogListener(listener) {
  globalDialogListener = listener;
  return () => {
    if (globalDialogListener === listener) {
      globalDialogListener = null;
    }
  };
}

/**
 * Abre um diálogo de confirmação moderno e estilizado com Promise
 * @param {Object|string} options
 * @returns {Promise<boolean>}
 */
export function confirmDialog(options) {
  const opts = typeof options === 'string' ? { message: options } : (options || {});

  return new Promise((resolve) => {
    if (globalDialogListener) {
      globalDialogListener({
        isOpen: true,
        isConfirm: true,
        variant: opts.variant || 'danger', // 'danger' | 'warning' | 'info' | 'success'
        title: opts.title || (opts.variant === 'danger' ? 'Confirmar Exclusão' : 'Confirmar Ação'),
        message: opts.message || 'Tem certeza que deseja prosseguir?',
        description: opts.description || '',
        confirmText: opts.confirmText || 'Confirmar',
        cancelText: opts.cancelText || 'Cancelar',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    } else {
      const result = window.confirm(opts.message || 'Deseja continuar?');
      resolve(result);
    }
  });
}

/**
 * Abre um diálogo de alerta moderno com Promise
 * @param {Object|string} options
 * @returns {Promise<boolean>}
 */
export function alertDialog(options) {
  const opts = typeof options === 'string' ? { message: options } : (options || {});

  return new Promise((resolve) => {
    if (globalDialogListener) {
      globalDialogListener({
        isOpen: true,
        isConfirm: false,
        variant: opts.variant || 'info', // 'danger' | 'warning' | 'info' | 'success'
        title: opts.title || 'Aviso do Sistema',
        message: opts.message || '',
        description: opts.description || '',
        confirmText: opts.confirmText || 'Entendido',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(true),
      });
    } else {
      window.alert(opts.message || '');
      resolve(true);
    }
  });
}

