import { Routes } from '@angular/router';
import { AdminLoginComponent } from './features/auth/admin-login/admin-login.component';
import { AdminDashboardComponent } from './features/admin/dashboard/admin-dashboard.component';

export const appRoutes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: AdminLoginComponent },
  { path: 'dashboard', component: AdminDashboardComponent },
  { path: '**', redirectTo: 'login' }
];
