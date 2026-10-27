import { Injectable } from '@angular/core';
import { Customer } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class CustomerStateService {
  customer: Customer | null = null;
}
