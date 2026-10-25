import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Minimal shape of the global `checkout` function exposed by the Flitt SDK. */
type FlittCheckoutFn = (selector: string, options: FlittCheckoutOptions) => void;

declare global {
  interface Window {
    checkout?: FlittCheckoutFn;
  }
}

export interface FlittCheckoutOptions {
  options?: Record<string, unknown>;
  params: { token: string } & Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Loads the Flitt embedded-checkout SDK (JS + CSS) once and renders the checkout widget
 * into a container element. The widget keeps the buyer on our page — no redirect to
 * pay.flitt.com — and processes the order identified by the supplied checkout token.
 */
@Injectable({ providedIn: 'root' })
export class FlittCheckoutService {
  private loadPromise: Promise<void> | null = null;

  /** Ensures the SDK script + stylesheet are present, resolving once `window.checkout` exists. */
  load(): Promise<void> {
    if (window.checkout) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<void>((resolve, reject) => {
      // Stylesheet (id-guarded so it is injected only once).
      if (!document.getElementById('flitt-checkout-css')) {
        const link = document.createElement('link');
        link.id = 'flitt-checkout-css';
        link.rel = 'stylesheet';
        link.href = environment.flitt.checkoutCss;
        document.head.appendChild(link);
      }

      const existing = document.getElementById('flitt-checkout-js') as HTMLScriptElement | null;
      if (existing) {
        if (window.checkout) { resolve(); return; }
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load the Flitt checkout SDK.')));
        return;
      }

      const script = document.createElement('script');
      script.id = 'flitt-checkout-js';
      script.src = environment.flitt.checkoutJs;
      script.async = true;
      script.onload = () => {
        if (window.checkout) resolve();
        else reject(new Error('Flitt checkout SDK loaded but `checkout` is unavailable.'));
      };
      script.onerror = () => reject(new Error('Failed to load the Flitt checkout SDK.'));
      document.body.appendChild(script);
    });

    return this.loadPromise;
  }

  /**
   * Renders (or re-renders) the embedded checkout for the given order token into the element
   * matched by `selector`. The container is cleared first so it can host successive orders.
   */
  async render(selector: string, token: string): Promise<void> {
    await this.load();

    const container = document.querySelector(selector);
    if (container) container.innerHTML = '';

    const options: FlittCheckoutOptions = {
      options: {
        methods: ['card'],
        methods_disabled: ['wallets'],
        wallet_methods_enabled: [],        // don't init Apple/Google Pay (card-only flow)
        card_icons: ['mastercard', 'visa', 'maestro'],
        active_tab: 'card',
        full_screen: false,
        show_pay_button: true,             // (was the deprecated `button`)
        show_email: false,                 // (was the deprecated `email`)
        title: 'Service Tokens',
        theme: { type: 'light', preset: 'navy_shimmer' }
      },
      params: { token }
    };

    window.checkout!(selector, options);
  }
}
