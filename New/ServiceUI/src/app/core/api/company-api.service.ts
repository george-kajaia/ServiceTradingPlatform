import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Company, CompanyUser } from '../../shared/models/company.model';

@Injectable({ providedIn: 'root' })
export class CompanyApiService {
  private baseUrl = `${environment.apiBaseUrl}/Company`;

  constructor(private http: HttpClient) {}

  // Same login flow as the company app: authenticates a company user.
  login(payload: { userName: string; password: string }): Observable<CompanyUser> {
    return this.http.post<CompanyUser>(`${this.baseUrl}/Login`, payload);
  }

  getById(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.baseUrl}/GetById/${id}`);
  }
}
