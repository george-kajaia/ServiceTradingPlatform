import { AfterViewInit, Directive, ElementRef, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, innermost last. Only the topmost dialog reacts to keys. */
const stack: object[] = [];

let lockCount = 0;
let saved: { htmlOverflow: string; bodyOverflow: string; bodyPaddingRight: string } | null = null;

function lockScroll(): void {
  if (lockCount++ > 0) return;
  const html = document.documentElement;
  const body = document.body;
  saved = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight
  };
  const scrollbar = window.innerWidth - html.clientWidth;
  if (scrollbar > 0) {
    body.style.paddingRight = `${scrollbar}px`;
  }
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
}

function unlockScroll(): void {
  if (lockCount === 0 || --lockCount > 0) return;
  if (saved) {
    document.documentElement.style.overflow = saved.htmlOverflow;
    document.body.style.overflow = saved.bodyOverflow;
    document.body.style.paddingRight = saved.bodyPaddingRight;
    saved = null;
  }
}

/**
 * Shared behaviour for custom modal dialogs: moves focus in on open, traps Tab/Shift+Tab,
 * emits `dismiss` on Escape (unless `dismissBlocked`), locks background scroll (ref-counted so
 * nested dialogs keep the lock) and returns focus to the opener on close.
 * Put it on the full-screen backdrop element that contains the dialog.
 */
@Directive({
  selector: '[appModalDialog]',
  standalone: true
})
export class ModalDialogDirective implements AfterViewInit, OnDestroy {
  /** True while a request is in flight: Escape is swallowed instead of emitted. */
  @Input() dismissBlocked = false;
  @Output() dismiss = new EventEmitter<void>();

  private host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private opener: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  private token = {};

  private onKeydown = (event: KeyboardEvent): void => {
    if (stack[stack.length - 1] !== this.token || event.defaultPrevented) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (!this.dismissBlocked) this.dismiss.emit();
      return;
    }

    if (event.key === 'Tab') {
      const items = this.focusables();
      if (items.length === 0) {
        event.preventDefault();
        this.container().focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!this.host.contains(active) || active === this.container()) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  constructor() {
    stack.push(this.token);
    lockScroll();
    document.addEventListener('keydown', this.onKeydown);
  }

  ngAfterViewInit(): void {
    const container = this.container();
    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
    // Respect a child that already took focus (e.g. the confirm dialog's default button).
    if (this.host.contains(document.activeElement)) return;
    const items = this.focusables();
    const target = items.find(el => el.matches('input, select, textarea')) ?? items[0] ?? container;
    target.focus();
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onKeydown);
    const idx = stack.indexOf(this.token);
    if (idx >= 0) stack.splice(idx, 1);
    unlockScroll();
    const opener = this.opener;
    if (opener && opener.isConnected && !opener.hasAttribute('disabled')) {
      opener.focus();
    }
  }

  private container(): HTMLElement {
    return this.host.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]') ?? this.host;
  }

  private focusables(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      el => !el.hasAttribute('disabled') && el.getClientRects().length > 0
    );
  }
}
