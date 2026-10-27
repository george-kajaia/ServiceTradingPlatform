import { Injectable } from '@angular/core';
import { AdminUser } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AdminStateService {
  admin: AdminUser | null = null;
}
