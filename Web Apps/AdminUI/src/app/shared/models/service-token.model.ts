import { ScheduleType } from './product.model';

export enum ServiceTokenStatus {
  Available = 0,
  Sold = 1,
  Finished = 255
}

export enum OwnerType {
  Company = 0,
  Customer = 1
}

export interface ServiceToken {
  id: string;
  rowVersion: number;
  companyId: number;
  requestId: number;
  productId: number;
  startDate: string;
  endDate?: string | null;
  status: ServiceTokenStatus | number;
  count: number;
  serviceCount: number;
  scheduleType: ScheduleType;
  ownerType: OwnerType | number;
  ownerPublicKey: string;
}

export interface ServiceTokenDto extends ServiceToken {
  companyName: string;
}
