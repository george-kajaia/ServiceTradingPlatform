import { Injectable } from '@angular/core';
import { Observable, throwError, timer } from 'rxjs';
import { concatMap, filter, map, take, tap, timeout } from 'rxjs/operators';
import { CartItem, CartService } from './cart.service';
import { PaymentApiService } from '../api/payment-api.service';
import {
  InitiateEmbeddedPaymentResult,
  PaymentBatchStatusResult,
  PaymentTokenRef
} from '../../shared/models/payment.model';

export interface CheckoutQueueItem {
  tokenId: string;
  rowVersion: number;
  productName: string;
  companyName: string;
  price: number;
}

export interface CheckoutItemResult {
  tokenId: string;
  productName: string;
  orderId?: string;
  outcome: 'success' | 'failed' | 'cancelled';
}

interface CheckoutSession {
  publicKey: string;
  items: CheckoutQueueItem[];
  saveCard?: boolean;
  currentOrderId?: string;
  currentToken?: string;
  results: CheckoutItemResult[];
}

/**
 * Drives an embedded Flitt checkout for the whole cart in a SINGLE payment. All primary-market
 * items are sent to the backend together, which creates one Flitt order for the summed amount
 * (one widget, one charge) while still recording each token as its own Payment row. The buyer
 * never leaves the page; the order is polled until every token reaches a terminal status. The
 * session is persisted to sessionStorage so it can be resumed if a hard redirect ever occurs
 * (e.g. an external 3-D Secure step that lands back on /payment/return).
 */
@Injectable({ providedIn: 'root' })
export class CheckoutFlowService {
  private readonly KEY = 'checkout_session';
  private readonly POLL_INTERVAL_MS = 2000;
  private readonly POLL_TIMEOUT_MS = 600000; // 10 min — buyer may be entering card / 3DS

  constructor(
    private paymentApi: PaymentApiService,
    private cart: CartService
  ) {}

  // ── session persistence ──────────────────────────────────────────────────
  getSession(): CheckoutSession | null {
    try {
      const raw = sessionStorage.getItem(this.KEY);
      return raw ? (JSON.parse(raw) as CheckoutSession) : null;
    } catch {
      return null;
    }
  }

  private save(session: CheckoutSession): void {
    try { sessionStorage.setItem(this.KEY, JSON.stringify(session)); } catch { /* ignore */ }
  }

  clear(): void {
    try { sessionStorage.removeItem(this.KEY); } catch { /* ignore */ }
  }

  // ── flow ────────────────────────────────────────────────────────────────
  /**
   * Builds a checkout session from the primary-market items in the cart.
   * Returns false if there is nothing payable (only secondary-market items, or empty).
   */
  begin(items: CartItem[], publicKey: string, saveCard: boolean = false): boolean {
    const queue: CheckoutQueueItem[] = items
      .filter(i => i.market === 'primaryMarket')
      .map(i => ({
        tokenId: i.token.id,
        rowVersion: i.token.rowVersion,
        productName: i.token.productName,
        companyName: i.token.companyName,
        price: i.token.price
      }));

    if (queue.length === 0) return false;

    this.save({ publicKey, items: queue, saveCard, results: [] });
    return true;
  }

  /** The items being paid for in the current order (for display). */
  get items(): CheckoutQueueItem[] {
    return this.getSession()?.items ?? [];
  }

  /** Number of tokens in the current order. */
  get itemCount(): number {
    return this.items.length;
  }

  /** Summed amount of the current order. */
  get total(): number {
    return this.items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  }

  results(): CheckoutItemResult[] {
    return this.getSession()?.results ?? [];
  }

  /**
   * Creates the single Flitt order covering every item in the session and returns the checkout
   * token the caller renders into the embedded widget. The order id is stored for polling.
   */
  initiate(): Observable<InitiateEmbeddedPaymentResult> {
    const s = this.getSession();
    if (!s) return throwError(() => new Error('No active checkout session.'));
    if (s.items.length === 0) return throwError(() => new Error('Nothing to pay for.'));

    const tokens: PaymentTokenRef[] = s.items.map(i => ({
      serviceTokenId: i.tokenId,
      rowVersion: i.rowVersion
    }));

    return this.paymentApi
      .initiateBatch(tokens, s.publicKey, s.saveCard ?? false)
      .pipe(
        tap(res => {
          if (!res.token) throw new Error('No checkout token returned.');
          s.currentOrderId = res.orderId;
          s.currentToken = res.token;
          this.save(s);
        })
      );
  }

  /** The Flitt checkout token for the in-flight order, if any (used to (re)render the widget). */
  get currentToken(): string | null {
    return this.getSession()?.currentToken ?? null;
  }

  /** True when the order has been initiated and is awaiting a terminal status. */
  hasPendingOrder(): boolean {
    return !!this.getSession()?.currentOrderId;
  }

  /**
   * Polls the order until every token reaches a terminal status, records each token's outcome,
   * drops the purchased tokens from the cart, and completes the session.
   */
  resolve(): Observable<CheckoutItemResult[]> {
    const s = this.getSession();
    if (!s || !s.currentOrderId) {
      return throwError(() => new Error('No payment to resolve.'));
    }

    const orderId = s.currentOrderId;

    return this.pollUntilFinal(orderId).pipe(
      map(status => {
        const byToken = new Map(status.items.map(i => [i.serviceTokenId, i.status]));

        const results: CheckoutItemResult[] = s.items.map(item => {
          const itemStatus = byToken.get(item.tokenId) ?? 'Failed';
          const outcome: CheckoutItemResult['outcome'] =
            itemStatus === 'Succeeded' ? 'success'
              : itemStatus === 'Cancelled' ? 'cancelled'
                : 'failed';

          if (outcome === 'success') {
            this.cart.removeLocal(item.tokenId);
          }

          return { tokenId: item.tokenId, productName: item.productName, orderId, outcome };
        });

        s.results = results;
        s.currentOrderId = undefined;
        s.currentToken = undefined;
        this.save(s);
        return results;
      })
    );
  }

  private pollUntilFinal(orderId: string): Observable<PaymentBatchStatusResult> {
    return timer(0, this.POLL_INTERVAL_MS).pipe(
      concatMap(() => this.paymentApi.getStatus(orderId)),
      filter(r => r.final),   // stop only when every token is terminal
      take(1),                // complete on the first fully-terminal status
      timeout({ first: this.POLL_TIMEOUT_MS })
    );
  }

  /**
   * Confirms an order by id without relying on the in-memory session — used when the buyer
   * returns via a hard redirect (api/Payment/Return → ?orderId=…) and the session may be gone.
   * Builds results straight from the server's per-token breakdown; product names are taken from
   * the session when still present, otherwise a short token label is shown.
   */
  resolveByOrderId(orderId: string): Observable<CheckoutItemResult[]> {
    if (!orderId) return throwError(() => new Error('No order id to resolve.'));

    const s = this.getSession();
    const nameByToken = new Map((s?.items ?? []).map(i => [i.tokenId, i.productName]));

    return this.pollUntilFinal(orderId).pipe(
      map(status => {
        const results: CheckoutItemResult[] = status.items.map(item => {
          const outcome: CheckoutItemResult['outcome'] =
            item.status === 'Succeeded' ? 'success'
              : item.status === 'Cancelled' ? 'cancelled'
                : 'failed';

          if (outcome === 'success') {
            this.cart.removeLocal(item.serviceTokenId);
          }

          return {
            tokenId: item.serviceTokenId,
            productName: nameByToken.get(item.serviceTokenId) ?? `Token ${item.serviceTokenId}`,
            orderId,
            outcome
          };
        });

        if (s) {
          s.results = results;
          s.currentOrderId = undefined;
          s.currentToken = undefined;
          this.save(s);
        }
        return results;
      })
    );
  }
}
