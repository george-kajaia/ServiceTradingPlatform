import { Component, inject, HostListener, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../../core/services/dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (dialogService.state().open && dialogService.state().options; as opts) {
      <div class="dialog-backdrop" (click)="onBackdropClick($event)">
        <div
          #dialogEl
          class="dialog"
          [class]="'dialog--' + opts.type"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="'dialog-title'"
          [attr.aria-describedby]="'dialog-message'"
          tabindex="-1"
          (keydown)="onKeydown($event)">
          <div class="dialog__icon" aria-hidden="true">
            @switch (opts.type) {
              @case ('danger') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M15 9l-6 6M9 9l6 6"/>
                </svg>
              }
              @case ('warning') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v4m0 4h.01"/>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              }
              @default {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4m0-4h.01"/>
                </svg>
              }
            }
          </div>
          <h3 id="dialog-title" class="dialog__title">{{ opts.title }}</h3>
          <p id="dialog-message" class="dialog__message">{{ opts.message }}</p>
          <div class="dialog__actions">
            <button
              #cancelBtn
              class="btn btn--secondary"
              (click)="dialogService.close(false)">
              {{ opts.cancelText }}
            </button>
            <button
              #confirmBtn
              class="btn"
              [class]="'btn--' + opts.type"
              (click)="dialogService.close(true)">
              {{ opts.confirmText }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent implements AfterViewChecked {
  readonly dialogService = inject(DialogService);

  @ViewChild('dialogEl') dialogEl?: ElementRef<HTMLElement>;
  @ViewChild('cancelBtn') cancelBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('confirmBtn') confirmBtn?: ElementRef<HTMLButtonElement>;

  private focusSet = false;

  ngAfterViewChecked(): void {
    // Auto-focus the cancel button when dialog opens
    if (this.dialogService.state().open && !this.focusSet && this.cancelBtn) {
      this.cancelBtn.nativeElement.focus();
      this.focusSet = true;
    }
    if (!this.dialogService.state().open) {
      this.focusSet = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialogService.state().open) {
      this.dialogService.close(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      this.handleTabKey(event);
    } else if (event.key === 'Enter') {
      // Only trigger confirm if focus is on confirm button
      if (document.activeElement === this.confirmBtn?.nativeElement) {
        this.dialogService.close(true);
      }
    }
  }

  private handleTabKey(event: KeyboardEvent): void {
    const focusableElements = [this.cancelBtn?.nativeElement, this.confirmBtn?.nativeElement].filter(Boolean);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      // Shift + Tab: if on first element, go to last
      if (activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab: if on last element, go to first
      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.dialogService.close(false);
    }
  }
}
