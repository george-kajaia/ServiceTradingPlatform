import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DomainItemDto } from '../../shared/models/dtos.model';

/**
 * Fetches the lookup/domain tables used to populate dropdowns
 * (LegalFormDomain, EconomicActivityDomain), each exposing { Id, Name }.
 *
 * NOTE: the project has no domain endpoints yet, so the controller names below
 * are an assumption that follows the existing `/{Controller}/GetAll` convention.
 * If your backend controllers are named differently (e.g. `LegalFormDomain`),
 * just change the two constants here — nothing else needs to change.
 */
@Injectable({ providedIn: 'root' })
export class DomainApiService {
  private legalFormUrl = `${environment.apiBaseUrl}/LegalFormDomain`;
  private economicActivityUrl = `${environment.apiBaseUrl}/EconomicActivityDomain`;

  constructor(private http: HttpClient) {}

  getLegalForms(): Observable<DomainItemDto[]> {
    return this.http.get<DomainItemDto[]>(`${this.legalFormUrl}/GetAll`);
  }

  getEconomicActivities(): Observable<DomainItemDto[]> {
    return this.http.get<DomainItemDto[]>(`${this.economicActivityUrl}/GetAll`);
  }
}
