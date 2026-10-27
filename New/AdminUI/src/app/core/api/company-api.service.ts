import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Company, CompanyUser } from '../../shared/models/company.model';
import { CompanyRequestDto } from '../../shared/models/dtos.model';

@Injectable({ providedIn: 'root' })
export class CompanyApiService {
  private baseUrl = `${environment.apiBaseUrl}/Company`;

  constructor(private http: HttpClient) {}

  login(payload: { userName: string; password: string }): Observable<CompanyUser> {
    console.log(`${this.baseUrl}/Login`);
    return this.http.post<CompanyUser>(`${this.baseUrl}/Login`, payload);
  }

  register(dto: CompanyRequestDto): Observable<any> {
    // Backend: [HttpPost("create")]
    return this.http.post<any>(`${this.baseUrl}/create`, dto);
  }

  getById(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.baseUrl}/GetById/${id}`);
  }

  getAll(skip: number = 0, take: number = 50, search: string | null = null): Observable<Company[]> {
    let params = new HttpParams().set('skip', skip).set('take', take);
    if (search && search.trim().length > 0) params = params.set('search', search.trim());
    return this.http.get<Company[]>(`${this.baseUrl}/GetAll`, { params });
  }

  approveCompany(companyId: number, rowVersion: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/Approve?companyId=${companyId}&rowVersion=${rowVersion}`, null);
  }

  updateCompany(companyId: number, rowVersion: number, company: Company): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/update?companyId=${companyId}&rowVersion=${rowVersion}`, company);
  }

  deleteCompany(companyId: number, rowVersion: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/delete?companyId=${companyId}&rowVersion=${rowVersion}`);
  }
}
