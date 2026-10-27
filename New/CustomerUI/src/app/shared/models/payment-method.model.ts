// Saved payment method for a customer. The raw card token is NEVER sent to the client —
// only whether a saved card exists, plus masked/display fields. Mirrors CustomerPaymentMethodDto.
export interface CustomerPaymentMethod {
  hasSavedCard: boolean;
  maskedCard?: string | null;
  cardType?: string | null;
  paymentSystem?: string | null;
  tokenLifetime?: string | null;
  iban?: string | null;
}
