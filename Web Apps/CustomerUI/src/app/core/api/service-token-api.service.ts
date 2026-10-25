import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ServiceTokenDto } from '../../shared/models/service-token.model';

@Injectable({ providedIn: 'root' })
export class ServiceTokenApiService {
  private baseUrl = `${environment.apiBaseUrl}/ServiceToken`;

  constructor(private http: HttpClient) {}

  getService(serviceTokenId: string): Observable<ServiceTokenDto> {
    return this.http.get<ServiceTokenDto>(`${this.baseUrl}/GetServiceToken`, {
      params: { serviceTokenId }
    });
  }

  getCustomerServiceTokens(customerPublicKey: string): Observable<ServiceTokenDto[]> {
    return this.http.get<ServiceTokenDto[]>(`${this.baseUrl}/GetCustomerServiceTokens`, {
      params: { customerPublicKey }
    });
  }

  getPrimaryMarketServiceTokens(companyId: number = -1, requestId: number = -1): Observable<ServiceTokenDto[]> {
    return this.http.get<ServiceTokenDto[]>(`${this.baseUrl}/GetPrimaryMarketServiceTokens`, {
      params: { companyId: companyId.toString(), requestId: requestId.toString() }
    });
  }

  getSecondaryMarketServiceTokens(
    customerPublicKey: string,
    companyId: number = -1,
    requestId: number = -1
  ): Observable<ServiceTokenDto[]> {
    return this.http.get<ServiceTokenDto[]>(`${this.baseUrl}/GetSecondaryMarketServiceTokens`, {
      params: { customerPublicKey, companyId: companyId.toString(), requestId: requestId.toString() }
    });
  }

  buyPrimaryServiceToken(serviceTokenId: string, rowVersion: number, customerPublicKey: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/BuyPrimaryServiceToken`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString(), customerPublicKey }
    });
  }

  markServiceTokenForResell(serviceTokenId: string, rowVersion: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/MarkServiceTokenForResell`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString() }
    });
  }

  cancelReselling(serviceTokenId: string, rowVersion: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/CancelReselling`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString() }
    });
  }

  buySecondaryServiceToken(serviceTokenId: string, rowVersion: number, newCustomerPublicKey: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/BuySecondaryServiceToken`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString(), newCustomerPublicKey }
    });
  }

  redeemService(serviceTokenId: string, rowVersion: number, connectionId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/GetService`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString(), connectionId }
    });
  }

  getCustomerServiceTokensInCart(customerPublicKey: string): Observable<ServiceTokenDto[]> {
    return this.http.get<ServiceTokenDto[]>(`${this.baseUrl}/GetCustomerServiceTokensInCart`, {
      params: { customerPublicKey }
    }); 
  }

  markServiceTokenInCart(serviceTokenId: string, rowVersion: number, customerPublicKey: string): Observable<ServiceTokenDto> {
    return this.http.post<ServiceTokenDto>(`${this.baseUrl}/MarkServiceTokenInCart`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString(), customerPublicKey }
    }).pipe(map(t => this.normalizeToken(t)));
  }

  cancelInCart(serviceTokenId: string, rowVersion: number): Observable<ServiceTokenDto> {
    return this.http.post<ServiceTokenDto>(`${this.baseUrl}/CancelInCart`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString() }
    }).pipe(map(t => this.normalizeToken(t)));
  }

  /** Normalizes PascalCase API response properties to camelCase Angular model properties.
   *  ASP.NET Core without an explicit camelCase serializer returns PascalCase JSON. */
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
      term:           raw.term           ?? raw.Term,
    };
  }
}
