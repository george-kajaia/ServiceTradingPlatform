import { Injectable } from '@angular/core';
import { Customer } from '../../shared/models/user.model';

const SESSION_KEY = 'customer_session';

@Injectable({ providedIn: 'root' })
export class CustomerStateService {
  private _customer: Customer | null = null;

  constructor() {
    // Rehydrate from sessionStorage on startup (survives F5, cleared on tab close)
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) this._customer = JSON.parse(stored);
    } catch { /* ignore */ }
  }

  get customer(): Customer | null {
    return this._customer;
  }

  set customer(value: Customer | null) {
    this._customer = value;
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
  }

  /** Token id to auto-open in the marketplace after login (set by home page card click) */
  pendingTokenId: string | null = null;
}
