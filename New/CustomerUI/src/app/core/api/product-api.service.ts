import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../../shared/models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private baseUrl = `${environment.apiBaseUrl}/Product`;

  constructor(private http: HttpClient) {}

  getAll(skip: number = 0, take: number = 50, search: string | null = null): Observable<Product[]> {
    let params = new HttpParams()
      .set('skip', skip)
      .set('take', take);

    if (search && search.trim().length > 0) {
      params = params.set('search', search.trim());
    }

    return this.http.get<Product[]>(`${this.baseUrl}/GetAll`, { params });
  }

  getById(productId: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/GetById/${productId}`);
  }

  create(product: Product): Observable<void> {
    // Backend returns 200 OK with an empty body
    return this.http.post<void>(`${this.baseUrl}/Create`, product);
  }

  update(productId: number, newProduct: Product): Observable<void> {
    // Backend signature: Update(int productId, [FromBody] Product newProduct) (productId bound from query string)
    // Backend returns 200 OK with an empty body
    return this.http.put<void>(`${this.baseUrl}/Update?productId=${productId}`, newProduct);
  }

  delete(productId: number): Observable<void> {
    // Backend signature: Delete(int productId) (productId bound from query string)
    return this.http.delete<void>(`${this.baseUrl}/Delete?productId=${productId}`);
  }
}
