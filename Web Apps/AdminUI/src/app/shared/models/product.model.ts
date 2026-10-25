export enum SchedulePeriodType {
  None = 0,
  Daily = 1,
  Weekly = 2,
  Monthly = 3,
  Yearly = 4
}

// Matches ServiceTokenApi.Enums.ScheduleType (owned type)
export interface ScheduleType {
  periodType: SchedulePeriodType;
  periodNumber?: number | null;
}

export interface Product {
  id: number;
  companyId: number;
  name: string;
  serviceCount: number;
  price: number;
  term?: number | null;
  scheduleType: ScheduleType;
}
