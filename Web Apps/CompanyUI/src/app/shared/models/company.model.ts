export interface CompanyUser {
  id: number;
  companyId: number;
  userName: string;
  password: string;
}

// Payout bank account a company is paid into when a customer's card payment is
// split. One-to-one with Company. Mirrors ServiceTokenApi.Entities.CompanyBankAccount.
// NOTE: this is the *read* shape (nested under Company on GetById). The write shape
// is flattened on CompanyRequestDto (bankAccountIban / bankAccountName / bankName).
export interface CompanyBankAccount {
  id: number;
  rowVersion: number;
  companyId: number;
  iban: string;
  beneficiaryName: string;
  bankName: string;
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

  // Populated by GetById (Include(x => x.BankAccount)). May be null when the
  // company has not set a payout account yet.
  bankAccount?: CompanyBankAccount | null;
}
