import { type ToastType } from '@/components/ui/toast';

// Store para mantener referencia global al toast
let toastHandler: ((message: string, type?: ToastType, duration?: number) => string) | null = null;

export const setToastHandler = (
  handler: (message: string, type?: ToastType, duration?: number) => string
) => {
  toastHandler = handler;
};

export const showToast = (message: string, type?: ToastType, duration?: number) => {
  if (toastHandler) {
    return toastHandler(message, type, duration);
  }
  // Fallback a alert si no hay toast disponible (durante SSR)
  if (typeof window !== 'undefined') {
    alert(message);
  }
};

// Funciones helper para diferentes tipos
export const toast = {
  success: (message: string, duration?: number) => showToast(message, 'success', duration),
  error: (message: string, duration?: number) => showToast(message, 'error', duration || 7000),
  warning: (message: string, duration?: number) => showToast(message, 'warning', duration || 6000),
  info: (message: string, duration?: number) => showToast(message, 'info', duration),
};







