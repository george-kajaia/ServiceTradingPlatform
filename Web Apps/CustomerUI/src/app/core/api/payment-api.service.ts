import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  InitiateEmbeddedPaymentResult,
  PaymentBatchStatusResult,
  PaymentItemStatus,
  PaymentTokenRef
} from '../../shared/models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private baseUrl = `${environment.apiBaseUrl}/Payment`;

  constructor(private http: HttpClient) {}

  /**
   * Creates ONE Flitt order covering every supplied in-cart token and returns the embedded
   * checkout token. The buyer is charged the summed amount once, while each token is still
   * recorded as its own Payment row server-side.
   */
  initiateBatch(
    tokens: PaymentTokenRef[],
    customerPublicKey: string,
    saveCard: boolean = false
  ): Observable<InitiateEmbeddedPaymentResult> {
    return this.http.post<any>(`${this.baseUrl}/InitiateEmbeddedPaymentBatch`, {
      tokens,
      customerPublicKey,
      saveCard
    }).pipe(map(r => this.normalizeInitiate(r)));
  }

  /** Polls the current status of a payment order by its order id. */
  getStatus(orderId: string): Observable<PaymentBatchStatusResult> {
    return this.http.get<any>(`${this.baseUrl}/GetStatus`, {
      params: { orderId }
    }).pipe(map(r => this.normalizeStatus(r)));
  }

  // ASP.NET Core may serialize either camelCase or PascalCase depending on config,
  // so accept both — matching the pattern used by ServiceTokenApiService.
  private normalizeInitiate(raw: any): InitiateEmbeddedPaymentResult {
    return {
      orderId: raw?.orderId ?? raw?.OrderId,
      token:   raw?.token   ?? raw?.Token
    };
  }

  private normalizeStatus(raw: any): PaymentBatchStatusResult {
    const rawItems: any[] = raw?.items ?? raw?.Items ?? [];
    const items: PaymentItemStatus[] = rawItems.map(i => ({
      serviceTokenId: i?.serviceTokenId ?? i?.ServiceTokenId,
      status:         i?.status         ?? i?.Status
    }));

    return {
      orderId:  raw?.orderId  ?? raw?.OrderId,
      status:   raw?.status   ?? raw?.Status,
      final:    raw?.final    ?? raw?.Final ?? false,
      amount:   raw?.amount   ?? raw?.Amount ?? 0,
      currency: raw?.currency ?? raw?.Currency ?? 'GEL',
      items
    };
  }
}
