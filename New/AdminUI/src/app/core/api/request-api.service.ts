import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Request } from '../../shared/models/request.model';
import { RequestDto } from '../../shared/models/dtos.model';

@Injectable({ providedIn: 'root' })
export class RequestApiService {
  private baseUrl = `${environment.apiBaseUrl}/Request`;

  constructor(private http: HttpClient) {}

  getAll(companyId: number = -1, status: number = 0): Observable<Request[]> {
    // Backend signature: GetAll(int CompanyId = -1, RequestStatus status = RequestStatus.None)
    return this.http.get<Request[]>(`${this.baseUrl}/GetAll?CompanyId=${companyId}&status=${status}`);
  }

  getById(requestId: number): Observable<Request> {
    // NOTE: backend route template uses {id} while action parameter is named requestId.
    // Most ASP.NET Core setups still bind correctly, but if it doesn't, use list view instead.
    return this.http.get<Request>(`${this.baseUrl}/GetById/${requestId}`);
  }

  create(dto: RequestDto): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/Create`, dto);
  }

  update(requestId: number, rowVersion: number, dto: RequestDto): Observable<Request> {
    return this.http.put<Request>(`${this.baseUrl}/Update?requestId=${requestId}&rowVersion=${rowVersion}`, dto);
  }

  delete(requestId: number, rowVersion: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/Delete?requestId=${requestId}&rowVersion=${rowVersion}`);
  }

  authorize(requestId: number, rowVersion: number): Observable<Request> {
    return this.http.post<Request>(`${this.baseUrl}/Authorize?requestId=${requestId}&rowVersion=${rowVersion}`, null);
  }

  deauthorize(requestId: number, rowVersion: number): Observable<Request> {
    return this.http.post<Request>(`${this.baseUrl}/Deauthorize?requestId=${requestId}&rowVersion=${rowVersion}`, null);
  }

  approve(requestId: number, rowVersion: number): Observable<Request> {
    return this.http.post<Request>(`${this.baseUrl}/Approve?requestId=${requestId}&rowVersion=${rowVersion}`, null);
  }
}
