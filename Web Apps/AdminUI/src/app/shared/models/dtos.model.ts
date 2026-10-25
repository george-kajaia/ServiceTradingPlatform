export interface LoginCredentialDto {
  userName: string;
  password: string;
}

// Matches ServiceTokenApi.Dto.CompanyRequestDto
export interface CompanyRequestDto {
  name: string;
  taxCode: string;
  userName: string;
  password: string;
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
