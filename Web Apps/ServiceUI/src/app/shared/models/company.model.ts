export interface CompanyUser {
  id: number;
  companyId: number;
  userName: string;
  password: string;
}

export interface Company {
  id: number;
  rowVersion: number;
  name: string;
  status: number; // 0 or 1
  regDate: string;
  taxCode: string;
  address: string;
  legalForm: number;        // FK -> LegalFormDomain.Id
  economicActivity: number; // FK -> EconomicActivityDomain.Id
  mail: string;
  phone: string;
  user?: CompanyUser | null;
}
