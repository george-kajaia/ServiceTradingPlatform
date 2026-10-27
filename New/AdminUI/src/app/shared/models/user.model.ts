export interface Customer {
  id: number;
  rowVersion: number;
  publicKey: string;
  status: number;
  userName: string;
  password: string;
}

export interface AdminUser {
  id: number;
  userName: string;
  userFullName: string;
  password: string;
}
