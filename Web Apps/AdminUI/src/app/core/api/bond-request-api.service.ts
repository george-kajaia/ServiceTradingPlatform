import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BondRequest } from '../../shared/models/company.model';
import { BondRequestDto } from '../../shared/models/dtos.model';

@Injectable({ providedIn: 'root' })
export class BondRequestApiService {
  private baseUrl = `${environment.apiBaseUrl}/BondRequest`;

  constructor(private http: HttpClient) {}

  Get(companyId: number = -1, status: number = 0): Observable<BondRequest[]> {
    return this.http.get<BondRequest[]>(`${this.baseUrl}/Get?CompanyId=${companyId}&status=${status}`);
  }

  create(dto: BondRequestDto): Observable<BondRequest> {
    return this.http.post<BondRequest>(`${this.baseUrl}/Create`, dto);
  }

  approve(requestId: number): Observable<BondRequest> {
    return this.http.post<BondRequest>(`${this.baseUrl}/Approve?requestId=${requestId}`, null);
  }
}
