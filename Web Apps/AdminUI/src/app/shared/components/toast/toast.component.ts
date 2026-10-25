import { Component, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast, ToastType } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      @for (toast of toastService.toasts(); track toast.id; let i = $index) {
        <div
          class="toast"
          [class]="'toast--' + toast.type"
          role="alert"
          [attr.aria-label]="getAriaLabel(toast)"
          tabindex="0"
          (keydown.escape)="toastService.dismiss(toast.id)"
          (keydown.enter)="handleAction(toast)">
          <span class="toast__icon" aria-hidden="true">
            @switch (toast.type) {
              @case ('success') { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> }
              @case ('error') { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg> }
              @case ('warning') { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v4m0 4h.01M12 3l9.5 16.5H2.5L12 3z"/></svg> }
              @case ('info') { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg> }
            }
          </span>
          <span class="toast__message">{{ toast.message }}</span>
          @if (toast.action) {
            <button
              class="toast__action"
              (click)="handleAction(toast)"
              [attr.aria-label]="toast.action.label">
              {{ toast.action.label }}
            </button>
          }
          <button
            class="toast__close"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Dismiss notification"
            tabindex="0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './toast.component.scss'
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  private readonly typeLabels: Record<ToastType, string> = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information'
  };

  getAriaLabel(toast: Toast): string {
    const typeLabel = this.typeLabels[toast.type];
    const actionHint = toast.action ? `. Press Enter to ${toast.action.label.toLowerCase()}.` : '';
    return `${typeLabel}: ${toast.message}${actionHint} Press Escape to dismiss.`;
  }

  handleAction(toast: Toast): void {
    if (toast.action) {
      toast.action.callback();
      this.toastService.dismiss(toast.id);
    }
  }
}
