import { ScheduleType } from './product.model';

export enum ServiceTokenStatus {
  None      = 0,
  Available = 1,
  Sold      = 2,
  InCart    = 3,
  Finished  = 255
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
  remainingCount: number;
  serviceCount: number;
  scheduleType: ScheduleType;
  ownerType: OwnerType | number;
  ownerPublicKey: string;
}

export interface ServiceTokenDto extends ServiceToken {
  companyName: string;
  productName: string;
  price: number;
  pictogram?: string | null; // base64-encoded image from API
  term?: number | null;
}
