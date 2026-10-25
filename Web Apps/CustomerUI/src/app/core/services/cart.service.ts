import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ServiceTokenDto } from '../../shared/models/service-token.model';
import { ServiceTokenApiService } from '../api/service-token-api.service';

export type CartMarket = 'primaryMarket' | 'secondaryMarket';

export interface CartItem {
  token: ServiceTokenDto;
  market: CartMarket;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = new BehaviorSubject<CartItem[]>([]);
  items$ = this._items.asObservable();

  get items(): CartItem[] { return this._items.value; }
  get count(): number { return this._items.value.length; }

  constructor(private serviceTokenApi: ServiceTokenApiService) {}

  /** Loads the customer's in-cart tokens from the API and populates the local cart.
   *  Call this on app init / after login so the cart survives page refreshes. */
  load(customerPublicKey: string): Observable<void> {
    return this.serviceTokenApi.getCustomerServiceTokensInCart(customerPublicKey).pipe(
      tap((tokens: ServiceTokenDto[]) => {
        const items: CartItem[] = (tokens ?? []).map(token => ({
          token: this.normalizeToken(token),
          // Derive market from ownerType: 0 = company (primary), otherwise secondary
          market: (token.ownerType === 0 || (token as any).OwnerType === 0)
            ? 'primaryMarket'
            : 'secondaryMarket'
        }));
        this._items.next(items);
      }),
      map(() => undefined)
    );
  }

  private normalizeToken(raw: any): ServiceTokenDto {
    if (!raw) return raw;
    return {
      id:             raw.id             ?? raw.Id,
      rowVersion:     raw.rowVersion     ?? raw.RowVersion,
      companyId:      raw.companyId      ?? raw.CompanyId,
      requestId:      raw.requestId      ?? raw.RequestId,
      productId:      raw.productId      ?? raw.ProductId,
      startDate:      raw.startDate      ?? raw.StartDate,
      endDate:        raw.endDate        ?? raw.EndDate,
      status:         raw.status         ?? raw.Status,
      remainingCount: raw.remainingCount ?? raw.RemainingCount,
      serviceCount:   raw.serviceCount   ?? raw.ServiceCount,
      scheduleType:   raw.scheduleType   ?? raw.ScheduleType,
      ownerType:      raw.ownerType      ?? raw.OwnerType,
      ownerPublicKey: raw.ownerPublicKey ?? raw.OwnerPublicKey,
      companyName:    raw.companyName    ?? raw.CompanyName,
      productName:    raw.productName    ?? raw.ProductName,
      price:          raw.price          ?? raw.Price,
      pictogram:      raw.pictogram      ?? raw.Pictogram,
    };
  }

  /** Calls MarkServiceTokenInCart on the API, which returns the updated ServiceTokenDto
   *  (with the server's new RowVersion). Stores that fresh token in the cart so that
   *  CancelInCart and the checkout buy calls use the correct RowVersion. */
  add(token: ServiceTokenDto, market: CartMarket, customerPublicKey: string): Observable<void> {
    if (this._items.value.find(i => i.token?.id === token.id)) {
      return of(undefined);
    }

    return this.serviceTokenApi.markServiceTokenInCart(token.id, token.rowVersion, customerPublicKey).pipe(
      tap((updatedToken: ServiceTokenDto) => {
        // Store the returned token so we have the latest RowVersion for subsequent calls
        this._items.next([...this._items.value, { token: updatedToken, market }]);
      }),
      map(() => undefined)
    );
  }

  /** Calls CancelInCart on the API (returns updated ServiceTokenDto), then removes
   *  the token from the local cart on success. */
  remove(tokenId: string): Observable<void> {
    const item = this._items.value.find(i => i.token?.id === tokenId);
    if (!item) {
      return of(undefined);
    }

    return this.serviceTokenApi.cancelInCart(item.token.id, item.token.rowVersion).pipe(
      tap(() => {
        this._items.next(this._items.value.filter(i => i.token?.id !== tokenId));
      }),
      map(() => undefined)
    );
  }

  /** Remove from local state only — used after a successful purchase so we
   *  don't call CancelInCart for tokens that were just bought. */
  removeLocal(tokenId: string): void {
    this._items.next(this._items.value.filter(i => i.token?.id !== tokenId));
  }

  clear(): void { this._items.next([]); }

  has(tokenId: string): boolean {
    return this._items.value.some(i => i.token?.id === tokenId);
  }
}
