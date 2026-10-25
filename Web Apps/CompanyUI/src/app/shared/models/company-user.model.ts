// Mirrors ServiceTokenApi.Enums.CompanyUserType (byte enum)
export enum CompanyUserType {
  None = 0,
  Admin = 1,
  Other = 2
}

// Mirrors ServiceTokenApi.Entities.CompanyUser
export interface CompanyUser {
  id: number;
  userType: CompanyUserType;
  companyId: number;
  userName: string;
  password: string;
}

// Mirrors ServiceTokenApi.Dto.CompanyUserRequestDto
export interface CompanyUserRequestDto {
  userType: CompanyUserType;
  companyId: number;
  userName: string;
  password: string;
}
