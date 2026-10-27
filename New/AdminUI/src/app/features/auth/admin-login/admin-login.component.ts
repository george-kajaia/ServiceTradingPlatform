import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApiService } from '../../../core/api/admin-api.service';
import { AdminStateService } from '../../../core/state/admin-state.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss']
})
export class AdminLoginComponent {
  model = {
    userName: '',
    password: ''
  };

  loading = false;
  private toast = inject(ToastService);

  constructor(
    private adminApi: AdminApiService,
    private adminState: AdminStateService,
    private router: Router
  ) {}

  onLogin() {
    this.loading = true;

    this.adminApi.login(this.model).subscribe({
      next: user => {
        this.loading = false;
        this.adminState.admin = user;
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        this.loading = false;
        console.error(err);

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);        
      }
    });
  }
}
