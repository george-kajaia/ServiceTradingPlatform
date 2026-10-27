import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompanyUser, CompanyUserRequestDto } from '../../shared/models/company-user.model';

@Injectable({ providedIn: 'root' })
export class CompanyUserApiService {
  // The company-user endpoints live on the Company controller (api/Company/...).
  private baseUrl = `${environment.apiBaseUrl}/Company`;

  constructor(private http: HttpClient) {}

  // Backend: [HttpGet("GetAllUsers")] (skip/take/search).
  // NOTE: the backend does NOT filter by CompanyId, so callers must filter client-side.
  getAll(skip: number = 0, take: number = 50, search: string | null = null): Observable<CompanyUser[]> {
    let params = new HttpParams()
      .set('skip', skip)
      .set('take', take);

    if (search && search.trim().length > 0) {
      params = params.set('search', search.trim());
    }

    return this.http.get<CompanyUser[]>(`${this.baseUrl}/GetAllUsers`, { params });
  }

  // Backend: [HttpGet("GetUserByName/{userName}")] GetUserByName(string userName)
  // userName comes from the route; companyId is no longer required.
  getByName(userName: string): Observable<CompanyUser> {
    return this.http.get<CompanyUser>(
      `${this.baseUrl}/GetUserByName/${encodeURIComponent(userName)}`
    );
  }

  // Backend: [HttpPost("CreateUser")] CreateUser([FromBody] CompanyUserRequestDto user) -> 200 OK (empty)
  create(dto: CompanyUserRequestDto): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/CreateUser`, dto);
  }

  // Backend: [HttpPut("UpdateUser")] UpdateUser([FromBody] CompanyUserRequestDto user) -> 200 OK (empty)
  update(dto: CompanyUserRequestDto): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/UpdateUser`, dto);
  }

  // Backend: [HttpDelete("DeleteUser")] DeleteUser([FromBody] long companyId, string userName)
  // companyId is read from the JSON body, userName from the query string.
  delete(companyId: number, userName: string): Observable<void> {
    const params = new HttpParams().set('userName', userName);
    return this.http.request<void>('delete', `${this.baseUrl}/DeleteUser`, {
      params,
      body: companyId,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
