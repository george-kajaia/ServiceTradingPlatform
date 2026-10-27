import { Company } from './company.model';

export interface LoginCredentialDto {
  userName: string;
  password: string;
}

// Matches ServiceTokenApi.Dto.CompanyRequestDto
export interface CompanyRequestDto {
  name: string;
  taxCode: string;
  address: string;
  legalForm: number;        // byte on the API; FK -> LegalFormDomain.Id
  economicActivity: number; // int on the API;  FK -> EconomicActivityDomain.Id
  mail: string;
  phone: string;
  userName: string;
  password: string;

  // ── Payout bank account (one-to-one). The company is paid into this IBAN when
  //    a customer's card payment is split; the company is NOT a Flitt merchant.
  //    Sent flat (not nested) because the API binds them onto CompanyRequestDto.
  //    Optional: the API only creates a CompanyBankAccount when an IBAN is supplied. ──
  bankAccountIban: string;
  bankAccountName: string; // beneficiary name on the transfer
  bankName: string;        // informational
}

// Body shape for Company update. The API's PUT /Company/update binds onto
// CompanyRequestDto, so the bank account must be flattened (bankAccountIban / …),
// even though GetById returns it nested under Company.bankAccount.
export type CompanyUpdateDto = Company & {
  bankAccountIban: string;
  bankAccountName: string;
  bankName: string;
};

// Generic lookup item for *Domain tables (Id, Name).
// Used to populate the Legal Form / Economic Activity dropdowns.
export interface DomainItemDto {
  id: number;
  name: string;
}

// Matches ServiceTokenApi.Dto.CustomerCreateDto (entity fields)
export interface CustomerCreateDto {
  publicKey: string;
  userName: string;
  password: string;
}

// Matches ServiceTokenApi.Dto.RequestDto
export interface RequestDto {
  companyId: number;
  productId: number;
  serviceTokenCount: number;
}
