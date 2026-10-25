import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CustomerPaymentMethod } from '../../shared/models/payment-method.model';

/**
 * Reads / clears the customer's saved payment method. The card token itself is captured
 * server-side when a payment completes and is never exposed here — this only surfaces the
 * masked card for display and lets the customer remove the saved card.
 */
@Injectable({ providedIn: 'root' })
export class PaymentMethodApiService {
  private baseUrl = `${environment.apiBaseUrl}/Customer`;

  constructor(private http: HttpClient) {}

  get(customerId: number): Observable<CustomerPaymentMethod> {
    return this.http
      .get<any>(`${this.baseUrl}/GetPaymentMethod/${customerId}`)
      .pipe(map(r => this.normalize(r)));
  }

  remove(customerId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/DeletePaymentMethod?customerId=${customerId}`);
  }

  // ASP.NET Core may serialize camelCase or PascalCase; accept both.
  private normalize(raw: any): CustomerPaymentMethod {
    return {
      hasSavedCard:  raw?.hasSavedCard  ?? raw?.HasSavedCard  ?? false,
      maskedCard:    raw?.maskedCard    ?? raw?.MaskedCard    ?? null,
      cardType:      raw?.cardType      ?? raw?.CardType      ?? null,
      paymentSystem: raw?.paymentSystem ?? raw?.PaymentSystem ?? null,
      tokenLifetime: raw?.tokenLifetime ?? raw?.TokenLifetime ?? null,
      iban:          raw?.iban          ?? raw?.Iban          ?? null
    };
  }
}
