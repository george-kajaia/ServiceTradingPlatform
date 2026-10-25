import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AdminStateService } from '../../../core/state/admin-state.service';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { RequestApiService } from '../../../core/api/request-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { DialogService } from '../../../core/services/dialog.service';

import { Company } from '../../../shared/models/company.model';
import { Request, RequestStatus } from '../../../shared/models/request.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  activeTab: 'companies' | 'requests' = 'companies';

  companies: Company[] = [];
  filteredCompanies: Company[] = [];
  companyFilter = {
    name: '',
    taxCode: '',
    status: '' as '' | '0' | '1'
  };

  requests: Request[] = [];
  filteredRequests: Request[] = [];
  requestFilter = {
    companyId: '',
    status: '' as '' | '0' | '1' | '2' | '3'
  };

  loading = false;

  private toast = inject(ToastService);
  private dialog = inject(DialogService);

  constructor(
    private adminState: AdminStateService,
    private router: Router,
    private companyApi: CompanyApiService,
    private requestApi: RequestApiService
  ) {}

  ngOnInit(): void {
    if (!this.adminState.admin) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadCompanies();
  }

  setTab(tab: 'companies' | 'requests') {
    this.activeTab = tab;

    if (tab === 'companies') {
      this.loadCompanies();
    } else {
      this.loadRequests();
    }
  }

  // -----------------------------
  // Companies
  // -----------------------------
  loadCompanies(silent = false) {
    this.loading = true;

    this.companyApi.getAll(0, 500, null).subscribe({
      next: list => {
        this.companies = list ?? [];
        this.loading = false;
        this.applyCompanyFilter();
      },
      error: err => {
        console.error(err);
        this.loading = false;
        if (!silent) {
          this.toast.errorWithRetry(
            'Failed to load companies. Please check your connection.',
            () => this.loadCompanies()
          );
        }
      }
    });
  }

  applyCompanyFilter() {
    this.filteredCompanies = this.companies.filter(c => {
      const matchesName = !this.companyFilter.name || c.name.toLowerCase().includes(this.companyFilter.name.toLowerCase());
      const matchesTax = !this.companyFilter.taxCode || c.taxCode.toLowerCase().includes(this.companyFilter.taxCode.toLowerCase());
      const matchesStatus = !this.companyFilter.status || c.status === Number(this.companyFilter.status);
      return matchesName && matchesTax && matchesStatus;
    });
  }

  clearCompanyFilter() {
    this.companyFilter = { name: '', taxCode: '', status: '' };
    this.applyCompanyFilter();
  }

  approveCompany(company: Company) {
    this.companyApi.approveCompany(company.id, company.rowVersion).subscribe({
      next: _ => {
        this.toast.success('Company approved successfully.');
        this.loadCompanies(true);
      },
      error: err => {
        console.error(err);

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  // -----------------------------
  // Requests
  // -----------------------------
  loadRequests(silent = false) {
    this.loading = true;

    let cid = -1;
    if (this.requestFilter.companyId) {
      const parsed = Number(this.requestFilter.companyId);
      if (!Number.isNaN(parsed)) cid = parsed;
    }

    let status = 0;
    if (this.requestFilter.status) {
      const parsed = Number(this.requestFilter.status);
      if (!Number.isNaN(parsed)) status = parsed;
    }

    this.requestApi.getAll(cid, status).subscribe({
      next: list => {
        this.requests = list ?? [];
        this.loading = false;
        this.applyRequestFilter();
      },
      error: err => {
        console.error(err);
        this.loading = false;
        if (!silent) {
          this.toast.errorWithRetry(
            'Failed to load requests. Please check your connection.',
            () => this.loadRequests()
          );
        }
      }
    });
  }

  applyRequestFilter() {
    this.filteredRequests = this.requests.filter(r => {
      const matchesStatus = !this.requestFilter.status || Number(r.status) === Number(this.requestFilter.status);
      return matchesStatus;
    });
  }

  clearRequestFilter() {
    this.requestFilter.status = '';
    this.requestFilter.companyId = '';
    this.applyRequestFilter();
  }

  authorizeRequest(r: Request) {
    this.requestApi.authorize(r.id, r.rowVersion).subscribe({
      next: _ => {
        this.toast.success('Request authorized successfully.');
        this.loadRequests(true);
      },
      error: err => {
        console.error(err);

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  deauthorizeRequest(r: Request) {
    this.requestApi.deauthorize(r.id, r.rowVersion).subscribe({
      next: _ => {
        this.toast.success('Request deauthorized.');
        this.loadRequests(true);
      },
      error: err => {
        console.error(err);

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  approveRequest(r: Request) {
    this.requestApi.approve(r.id, r.rowVersion).subscribe({
      next: _ => {
        this.toast.success('Request approved successfully.');
        this.loadRequests(true);
      },
      error: err => {
        console.error(err);

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  async deleteRequest(r: Request) {
    const confirmed = await this.dialog.confirm({
      title: 'Delete Request',
      message: `Are you sure you want to delete request #${r.id}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    this.requestApi.delete(r.id, r.rowVersion).subscribe({
      next: _ => {
        this.toast.success('Request deleted.');
        this.loadRequests(true);
      },
      error: err => {
        console.error(err);

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  requestStatusLabel(status: number): string {
    switch (status) {
      case RequestStatus.None:
        return 'None';
      case RequestStatus.Created:
        return 'Created';
      case RequestStatus.Authorised:
        return 'Authorised';
      case RequestStatus.Approved:
        return 'Approved';
      default:
        return `Status ${status}`;
    }
  }
}
