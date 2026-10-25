import { Injectable, signal } from '@angular/core';

export type DialogType = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: DialogType;
}

interface DialogState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly state = signal<DialogState>({
    open: false,
    options: null,
    resolve: null
  });

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      this.state.set({
        open: true,
        options: {
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          type: 'info',
          ...options
        },
        resolve
      });
    });
  }

  close(result: boolean): void {
    const { resolve } = this.state();
    if (resolve) {
      resolve(result);
    }
    this.state.set({
      open: false,
      options: null,
      resolve: null
    });
  }
}
