import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServiceTokenDto } from '../../shared/models/service-token.model';

@Injectable({ providedIn: 'root' })
export class ServiceTokenApiService {
  private baseUrl = `${environment.apiBaseUrl}/ServiceToken`;

  constructor(private http: HttpClient) {}

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

  getService(serviceTokenId: string, rowVersion: number, connectionId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/GetService`, null, {
      params: { serviceTokenId, rowVersion: rowVersion.toString(), connectionId }
    });
  }
}
