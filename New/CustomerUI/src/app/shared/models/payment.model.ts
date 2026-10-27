// Models for the Flitt embedded checkout flow (mirrors the .NET PaymentController DTOs).

/** Result of initiating a payment: the order id we poll on, and the Flitt checkout token. */
export interface InitiateEmbeddedPaymentResult {
  orderId: string;
  token: string;
}

/** A single token reference sent when initiating a (possibly multi-token) payment. */
export interface PaymentTokenRef {
  serviceTokenId: string;
  rowVersion: number;
}

// Mirrors the backend PaymentStatus enum (serialized as its name string).
export type PaymentStatusValue =
  | 'None'
  | 'Created'
  | 'Processing'
  | 'Succeeded'
  | 'Failed'
  | 'Expired'
  | 'Cancelled';

/** Per-token outcome inside a payment order. */
export interface PaymentItemStatus {
  serviceTokenId: string;
  status: PaymentStatusValue | string;
}

/**
 * Status of a (possibly multi-token) payment order. One Flitt order can now cover several
 * tokens, so the response carries an overall headline `status`, a `final` flag (true only once
 * every token is terminal — the signal the client polls on) and the per-token `items`.
 */
export interface PaymentBatchStatusResult {
  orderId: string;
  status: PaymentStatusValue | string;
  final: boolean;
  amount: number;
  currency: string;
  items: PaymentItemStatus[];
}

const FINAL_PAYMENT_STATUSES: ReadonlyArray<string> =
  ['Succeeded', 'Failed', 'Expired', 'Cancelled'];

/** True once a single token/order has reached a terminal state. */
export function isFinalStatus(status: string): boolean {
  return FINAL_PAYMENT_STATUSES.includes(status);
}

/** True only when funds were captured and ownership was finalized. */
export function isSuccessStatus(status: string): boolean {
  return status === 'Succeeded';
}
