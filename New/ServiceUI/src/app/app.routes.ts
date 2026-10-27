import { Routes } from '@angular/router';
import { ServiceLoginComponent } from './features/auth/service-login/service-login.component';
import { ServiceScanComponent } from './features/service/scan/scan.component';
import { HomeComponent } from './features/home/home.component';

export const appRoutes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: ServiceLoginComponent },
  { path: 'scan', component: ServiceScanComponent },
  { path: '**', redirectTo: '' }
];
