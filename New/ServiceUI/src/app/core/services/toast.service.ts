import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  callback: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  action?: ToastAction;
}

export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
}

const MAX_TOASTS = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  readonly toasts = signal<Toast[]>([]);

  private show(type: ToastType, message: string, options: ToastOptions = {}): void {
    const id = `toast-${++this.counter}`;
    const duration = options.duration ?? (type === 'error' ? 5000 : 3000);
    const toast: Toast = { id, type, message, duration, action: options.action };

    this.toasts.update(toasts => {
      const updated = [...toasts, toast];
      // Keep only the last MAX_TOASTS
      if (updated.length > MAX_TOASTS) {
        return updated.slice(-MAX_TOASTS);
      }
      return updated;
    });

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(message: string, options?: ToastOptions): void {
    this.show('success', message, options);
  }

  error(message: string, options?: ToastOptions): void {
    this.show('error', message, { duration: 5000, ...options });
  }

  info(message: string, options?: ToastOptions): void {
    this.show('info', message, options);
  }

  warning(message: string, options?: ToastOptions): void {
    this.show('warning', message, { duration: 4000, ...options });
  }

  dismiss(id: string): void {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  clear(): void {
    this.toasts.set([]);
  }

  // Helper for common retry pattern
  errorWithRetry(message: string, retryFn: () => void): void {
    this.error(message, {
      duration: 6000,
      action: {
        label: 'Retry',
        callback: retryFn
      }
    });
  }
}
