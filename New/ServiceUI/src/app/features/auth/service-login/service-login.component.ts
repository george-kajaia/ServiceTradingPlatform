import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { CompanyStateService } from '../../../core/state/company-state.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-service-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './service-login.component.html',
  styleUrls: ['./service-login.component.scss']
})
export class ServiceLoginComponent {
  loginModel = { userName: '', password: '' };
  loading = false;

  private toast = inject(ToastService);

  constructor(
    private companyApi: CompanyApiService,
    private companyState: CompanyStateService,
    private router: Router
  ) {}

  onLogin() {
    this.loading = true;
    // Same login flow as the company app.
    this.companyApi.login(this.loginModel).subscribe({
      next: companyUser => {
        this.companyState.companyUser = companyUser;
        this.companyApi.getById(companyUser.companyId).subscribe({
          next: company => {
            this.loading = false;
            this.companyState.company = company;
            this.router.navigate(['/scan']);
          },
          error: err => {
            this.loading = false;
            this.toast.error(err.error?.message ?? err.error);
          }
        });
      },
      error: err => {
        this.loading = false;
        this.toast.error(err.error?.message ?? err.error);
      }
    });
  }
}
