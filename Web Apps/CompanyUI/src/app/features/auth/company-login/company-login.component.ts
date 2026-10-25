import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { DomainApiService } from '../../../core/api/domain-api.service';
import { CompanyStateService } from '../../../core/state/company-state.service';
import { ToastService } from '../../../core/services/toast.service';
import { CompanyRequestDto, DomainItemDto } from '../../../shared/models/dtos.model';

@Component({
  selector: 'app-company-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './company-login.component.html',
  styleUrls: ['./company-login.component.scss']
})
export class CompanyLoginComponent implements OnInit {
  isRegisterMode = false;

  loginModel = { userName: '', password: '' };
  registerModel: {
    name: string;
    taxCode: string;
    address: string;
    legalForm: number | null;
    economicActivity: number | null;
    mail: string;
    phone: string;
    userName: string;
    password: string;
    bankAccountIban: string;
    bankAccountName: string;
    bankName: string;
  } = {
    name: '',
    taxCode: '',
    address: '',
    legalForm: null,
    economicActivity: null,
    mail: '',
    phone: '',
    userName: '',
    password: '',
    bankAccountIban: '',
    bankAccountName: '',
    bankName: ''
  };

  // Dropdown sources (loaded from the *Domain tables).
  legalForms: DomainItemDto[] = [];
  economicActivities: DomainItemDto[] = [];
  loadingDomains = false;

  loading = false;
  private toast = inject(ToastService);

  constructor(
    private companyApi: CompanyApiService,
    private domainApi: DomainApiService,
    private companyState: CompanyStateService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Auto-switch to register mode if ?mode=register
    this.route.queryParams.subscribe(params => {
      if (params['mode'] === 'register') {
        this.isRegisterMode = true;
      }
    });

    this.loadDomains();
  }

  toggleMode() { this.isRegisterMode = !this.isRegisterMode; }

  private loadDomains(): void {
    this.loadingDomains = true;
    this.domainApi.getLegalForms().subscribe({
      next: items => { this.legalForms = items ?? []; this.loadingDomains = false; },
      error: err => { this.loadingDomains = false; this.toast.error(err.error?.message ?? 'Failed to load legal forms'); }
    });
    this.domainApi.getEconomicActivities().subscribe({
      next: items => { this.economicActivities = items ?? []; },
      error: err => { this.toast.error(err.error?.message ?? 'Failed to load economic activities'); }
    });
  }

  onLogin() {
    this.loading = true;
    this.companyApi.login(this.loginModel).subscribe({
      next: companyUser => {
        this.companyState.companyUser = companyUser;
        this.companyApi.getById(companyUser.companyId).subscribe({
          next: company => {
            this.loading = false;
            this.companyState.company = company;
            this.router.navigate(['/dashboard']);
          },
          error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
        });
      },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  onRegister() {
    if (this.registerModel.legalForm == null || this.registerModel.economicActivity == null) {
      this.toast.error('Please select a legal form and an economic activity.');
      return;
    }

    const dto: CompanyRequestDto = {
      name: this.registerModel.name,
      taxCode: this.registerModel.taxCode,
      address: this.registerModel.address,
      legalForm: this.registerModel.legalForm,
      economicActivity: this.registerModel.economicActivity,
      mail: this.registerModel.mail,
      phone: this.registerModel.phone,
      userName: this.registerModel.userName,
      password: this.registerModel.password,
      bankAccountIban: this.registerModel.bankAccountIban,
      bankAccountName: this.registerModel.bankAccountName,
      bankName: this.registerModel.bankName
    };

    this.loading = true;
    this.companyApi.register(dto).subscribe({
      next: _ => {
        this.loading = false;
        this.toast.success('Registration successful! You can now login with your credentials.');
        this.isRegisterMode = false;
      },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }
}
