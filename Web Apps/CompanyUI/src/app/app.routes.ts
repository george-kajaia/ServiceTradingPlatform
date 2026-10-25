import { Routes } from '@angular/router';
import { CompanyLoginComponent } from './features/auth/company-login/company-login.component';
import { CompanyDashboardComponent } from './features/company/dashboard/company-dashboard.component';
import { HomeComponent } from './features/home/home.component';

export const appRoutes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: CompanyLoginComponent },
  { path: 'dashboard', component: CompanyDashboardComponent },
  { path: '**', redirectTo: '' }
];
