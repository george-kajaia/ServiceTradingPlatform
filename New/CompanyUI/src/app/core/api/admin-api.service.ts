import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminUser } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private baseUrl = `${environment.apiBaseUrl}/User`;

  constructor(private http: HttpClient) {}

  login(payload: { userName: string; password: string }): Observable<AdminUser> {
    // Backend returns Ok(user.Id) (number), not the full object.
    return this.http
      .post<number>(`${this.baseUrl}/Login`, payload)
      .pipe(switchMap(id => this.getById(id)));
  }

  getById(id: number): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.baseUrl}/GetById/${id}`);
  }
}
