import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ServiceTokenApiService } from '../../../core/api/service-token-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CustomerStateService } from '../../../core/state/customer-state.service';
import { DialogService } from '../../../core/services/dialog.service';
import { ServiceTokenDto, ServiceTokenStatus } from '../../../shared/models/service-token.model';
import { ScheduleType } from '../../../shared/models/product.model';
import { MarketplaceTab } from '../marketplace/customer-marketplace.component';
import { GetServiceComponent, ServiceResult } from '../get-service/get-service.component';

@Component({
  selector: 'app-token-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, GetServiceComponent],
  templateUrl: './token-detail.component.html',
  styleUrls: ['./token-detail.component.scss']
})
export class TokenDetailComponent implements OnInit {
  token: ServiceTokenDto | null = null;
  tab: MarketplaceTab = 'yourTokens';
  customerPublicKey = '';
  loading = false;
  showGetService = false;

  private toast = inject(ToastService);
  private customerState = inject(CustomerStateService);
  private dialog = inject(DialogService);

  constructor(private router: Router, private serviceTokenApi: ServiceTokenApiService) {}

  async logout() {
    const confirmed = await this.dialog.confirm({
      title: 'Log Out',
      message: 'Are you sure you want to log out?',
      confirmText: 'Log Out',
      cancelText: 'Cancel',
      type: 'warning'
    });
    if (!confirmed) return;
    this.customerState.customer = null;
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation() ?? history.state;
    const state = (nav as any)?.extras?.state ?? (nav as any);
    this.token = state?.token ?? null;
    this.tab   = state?.tab   ?? 'yourTokens';
    this.customerPublicKey = state?.customerPublicKey ?? '';

    if (!this.token) { this.router.navigate(['/marketplace']); }
  }

  get isYourToken()  { return this.tab === 'yourTokens'; }
  get isPrimary()    { return this.tab === 'primaryMarket'; }
  get isSecondary()  { return this.tab === 'secondaryMarket'; }

  get canMarkForResell()    { return this.isYourToken && Number((this.token as any)?.status) === 1; }
  get canCancelReselling()  { return this.isYourToken && Number((this.token as any)?.status) === 0; }
  get canGetService()       { return this.isYourToken && Number((this.token as any)?.status) === 1; }
  get canBuy()              { return this.isPrimary || this.isSecondary; }

  markForResell() {
    if (!this.token) return;
    this.loading = true;
    this.serviceTokenApi.markServiceTokenForResell(this.token.id, this.token.rowVersion).subscribe({
      next: _ => { this.loading = false; this.toast.success('Token marked for resell.'); this.goBack(); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  cancelReselling() {
    if (!this.token) return;
    this.loading = true;
    this.serviceTokenApi.cancelReselling(this.token.id, this.token.rowVersion).subscribe({
      next: _ => { this.loading = false; this.toast.success('Reselling cancelled.'); this.goBack(); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  buy() {
    if (!this.token) return;
    this.loading = true;
    const obs = this.isPrimary
      ? this.serviceTokenApi.buyPrimaryServiceToken(this.token.id, this.token.rowVersion, this.customerPublicKey)
      : this.serviceTokenApi.buySecondaryServiceToken(this.token.id, this.token.rowVersion, this.customerPublicKey);

    obs.subscribe({
      next: _ => { this.loading = false; this.toast.success('Token purchased!'); this.goBack(); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  goBack() { this.router.navigate(['/marketplace']); }

  onGetServiceClosed(result: ServiceResult | null): void {
    this.showGetService = false;
    if (!result) return;

    if (result.success) {
      this.toast.success('Service granted successfully!');
      if (this.token && result.remainingCount !== undefined && result.rowVersion !== undefined) {
        this.token = { ...this.token, remainingCount: result.remainingCount, rowVersion: result.rowVersion };
      }
    } else {
      this.toast.error(result.message ?? 'Service request failed.');
    }
  }


  // ── Template-safe getters (avoids 'as any' in templates) ──
  get tokenStatusClass(): string  { return this.statusClass((this.token as any)?.status ?? 0); }
  get tokenStatusText(): string   { return this.statusLabel((this.token as any)?.status ?? 0); }
  get tokenCompanyName(): string  { return (this.token as any)?.companyName ?? ''; }
  get tokenCompanyId(): string    { return (this.token as any)?.companyId ?? ''; }
  get tokenOwnerKey(): string     { return (this.token as any)?.ownerPublicKey ?? ''; }

  statusLabel(status: number): string {
    switch (status) {
      case ServiceTokenStatus.Available: return 'Available';
      case ServiceTokenStatus.Sold:      return 'Sold';
      case ServiceTokenStatus.Finished:  return 'Finished';
      default: return `Status ${status}`;
    }
  }

  statusClass(status: number): string {
    switch (status) {
      case ServiceTokenStatus.Available: return 'badge--green';
      case ServiceTokenStatus.Sold:      return 'badge--gray';
      default: return 'badge--gray';
    }
  }

  scheduleLabel(st: ScheduleType): string {
    if (!st) return '—';
    const labels: Record<number, string> = { 0:'Free use', 1:'Daily', 2:'Weekly', 3:'Monthly', 4:'Yearly' };
    const base = labels[st.periodType] ?? `Period ${st.periodType}`;
    if (st.periodType === 0) return base;
    return st.periodNumber > 0 ? `${base} / ${st.periodNumber}` : base;
  }
}
