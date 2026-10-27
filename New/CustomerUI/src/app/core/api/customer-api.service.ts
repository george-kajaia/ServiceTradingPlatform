import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Customer } from '../../shared/models/user.model';
import { CustomerCreateDto } from '../../shared/models/dtos.model';

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  private baseUrl = `${environment.apiBaseUrl}/Customer`;

  constructor(private http: HttpClient) {}

  login(payload: { userName: string; password: string }): Observable<Customer> {
    return this.http.post<Customer>(`${this.baseUrl}/Login`, payload);
  }

  register(dto: CustomerCreateDto): Observable<Customer> {
    // Backend: [HttpPost("create")]
    return this.http.post<Customer>(`${this.baseUrl}/create`, dto);
  }

  getAll(skip: number = 0, take: number = 50, search: string | null = null): Observable<Customer[]> {
    let params = new HttpParams().set('skip', skip).set('take', take);
    if (search && search.trim().length > 0) params = params.set('search', search.trim());
    return this.http.get<Customer[]>(`${this.baseUrl}/GetAll`, { params });
  }

  updateCustomer(customerId: number, rowVersion: number, customer: Customer): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/update?customerId=${customerId}&rowVersion=${rowVersion}`, customer);
  }

  approveCustomer(customerId: number, rowVersion: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/Approve?customerId=${customerId}&rowVersion=${rowVersion}`, null);
  }

  deleteCustomer(customerId: number, rowVersion: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/delete?customerId=${customerId}&rowVersion=${rowVersion}`);
  }
}
