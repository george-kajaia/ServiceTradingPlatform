import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CustomerApiService } from '../../../core/api/customer-api.service';
import { CustomerStateService } from '../../../core/state/customer-state.service';
import { CustomerCreateDto } from '../../../shared/models/dtos.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-customer-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer-login.component.html',
  styleUrls: ['./customer-login.component.scss']
})
export class CustomerLoginComponent implements OnInit {
  isRegisterMode = false;

  loginModel = { userName: '', password: '' };
  registerModel: CustomerCreateDto = { publicKey: '', userName: '', password: '' };

  loading = false;
  loginError = '';

  private toast = inject(ToastService);

  constructor(
    private customerApi: CustomerApiService,
    private customerState: CustomerStateService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['mode'] === 'register') {
        this.isRegisterMode = true;
      }
    });
  }

  toggleMode() {
    this.isRegisterMode = !this.isRegisterMode;
    this.loginError = '';
  }

  onLogin() {
    this.loading = true;
    this.loginError = '';
    this.customerApi.login(this.loginModel).subscribe({
      next: customer => {
        this.loading = false;
        this.customerState.customer = customer;
        const pendingId = this.customerState.pendingTokenId;
        if (pendingId) {
          this.router.navigate(['/marketplace'], { queryParams: { tab: 'primaryMarket', openToken: pendingId } });
        } else {
          this.router.navigate(['/marketplace']);
        }
      },
      error: () => {
        this.loading = false;
        this.loginError = 'Incorrect username or password. Please try again.';
      }
    });
  }

  onRegister() {
    this.loading = true;
    this.customerApi.register(this.registerModel).subscribe({
      next: _ => {
        this.loading = false;
        this.toast.success('Registration successful! You can now login with your credentials.');
        this.isRegisterMode = false;
      },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }
}
