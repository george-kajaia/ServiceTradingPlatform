import { Injectable } from '@angular/core';
import { CompanyUser, Company } from '../../shared/models/company.model';

@Injectable({ providedIn: 'root' })
export class CompanyStateService {
  companyUser: CompanyUser | null = null;
  company: Company | null = null;
}
