import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';

import { CustomerStateService } from '../../../core/state/customer-state.service';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { ProductApiService } from '../../../core/api/product-api.service';
import { RequestApiService } from '../../../core/api/request-api.service';
import { ServiceTokenApiService } from '../../../core/api/service-token-api.service';
import { CartService, CartMarket } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { DialogService } from '../../../core/services/dialog.service';

import { Company } from '../../../shared/models/company.model';
import { Product, ScheduleType } from '../../../shared/models/product.model';
import { Request } from '../../../shared/models/request.model';
import { ServiceTokenDto, ServiceTokenStatus } from '../../../shared/models/service-token.model';
import { GetServiceComponent, ServiceResult } from '../get-service/get-service.component';

export type MarketplaceTab = 'yourTokens' | 'primaryMarket' | 'secondaryMarket';

const TAB_KEY     = 'marketplace_active_tab';
const FILTERS_KEY = 'marketplace_filters';

@Component({
  selector: 'app-customer-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GetServiceComponent],

  templateUrl: './customer-marketplace.component.html',
  styleUrls: ['./customer-marketplace.component.scss']
})
export class CustomerMarketplaceComponent implements OnInit {
  activeTab: MarketplaceTab = 'yourTokens';
  customerPublicKey = '';
  customerName = '';
  companies: Company[] = [];

  marketCompanyId = -1;
  marketProductId = -1;
  marketRequestId = -1;

  products: Product[] = [];
  allProducts: Product[] = [];

  requests: Request[] = [];
  allRequests: Request[] = [];

  yourTokens: ServiceTokenDto[] = [];
  filteredYourTokens: ServiceTokenDto[] = [];
  primaryMarketTokens: ServiceTokenDto[] = [];
  secondaryMarketTokens: ServiceTokenDto[] = [];

  loading = false;

  // Token detail modal
  detailToken: ServiceTokenDto | null = null;
  detailTab: MarketplaceTab = 'primaryMarket';

  // Get Service QR overlay
  getServiceToken: ServiceTokenDto | null = null;

  private toast = inject(ToastService);
  private dialog = inject(DialogService);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private customerState: CustomerStateService,
    private companyApi: CompanyApiService,
    private productApi: ProductApiService,
    private requestApi: RequestApiService,
    private serviceTokenApi: ServiceTokenApiService,
    public cartService: CartService
  ) {}

  ngOnInit(): void {
    const customer = this.customerState.customer;
    if (!customer) { this.router.navigate(['/login']); return; }
    this.customerPublicKey = customer.publicKey;
    this.customerName = customer.userName;
    this.loadCompanies();
    this.loadProducts();
    this.loadRequests();
    // Restore cart from server so it survives page refreshes
    this.cartService.load(this.customerPublicKey).subscribe({
      error: err => console.error('Failed to load cart:', err)
    });

    // Check query params — e.g. from home page click after login
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] as MarketplaceTab | undefined;
      const openToken = params['openToken'] as string | undefined;

      if (tab === 'primaryMarket') {
        this.activeTab = 'primaryMarket';
        sessionStorage.setItem(TAB_KEY, 'primaryMarket');
        this.loadPrimaryMarket(false, openToken);
      } else if (tab === 'secondaryMarket') {
        this.activeTab = 'secondaryMarket';
        sessionStorage.setItem(TAB_KEY, 'secondaryMarket');
        this.loadSecondaryMarket();
      } else {
        // No query param — restore the tab the customer was on before F5
        const saved = sessionStorage.getItem(TAB_KEY) as MarketplaceTab | null;
        const restored: MarketplaceTab = (saved === 'primaryMarket' || saved === 'secondaryMarket') ? saved : 'yourTokens';
        this.activeTab = restored;
        if (restored === 'primaryMarket') this.loadPrimaryMarket();
        else if (restored === 'secondaryMarket') this.loadSecondaryMarket();
        else this.loadYourTokens();
      }
    });

    // Clear pending token after handling
    this.customerState.pendingTokenId = null;
  }

  setTab(tab: MarketplaceTab) {
    this.activeTab = tab;
    sessionStorage.setItem(TAB_KEY, tab);
    if (tab === 'yourTokens') this.loadYourTokens();
    else if (tab === 'primaryMarket') this.loadPrimaryMarket();
    else this.loadSecondaryMarket();
  }

  loadCompanies() {
    this.companyApi.getAll(0, 500, null).subscribe({
      next: list => this.companies = list ?? [],
      error: err => console.error(err)
    });
  }

  loadProducts() {
    this.productApi.getAll(0, 500, null).subscribe({
      next: list => {
        this.allProducts = list ?? [];
        this.filterProductsByCompany();
      },
      error: err => console.error(err)
    });
  }

  onCompanyChange() {
    this.marketProductId = -1;
    this.marketRequestId = -1;
    this.filterProductsByCompany();
    this.requests = [];
  }

  onProductChange() {
    this.marketRequestId = -1;
    this.filterRequestsByProduct();
  }

  private filterProductsByCompany() {
    const cId = Number(this.marketCompanyId);
    if (cId === -1) {
      this.products = [...this.allProducts];
    } else {
      this.products = this.allProducts.filter(p => Number(p.companyId) === cId);
    }
  }

  loadRequests() {
    this.requestApi.getAll(-1, 0).subscribe({
      next: list => {
        this.allRequests = list ?? [];
      },
      error: err => console.error(err)
    });
  }

  private filterRequestsByProduct() {
    const pId = Number(this.marketProductId);
    if (pId === -1) {
      this.requests = [];
    } else {
      this.requests = this.allRequests.filter(r => Number(r.productId) === pId);
    }
  }

  get isRequestFilterEnabled(): boolean {
    return Number(this.marketProductId) !== -1;
  }

  loadYourTokens(silent = false) {
    this.loading = true;
    this.serviceTokenApi.getCustomerServiceTokens(this.customerPublicKey).subscribe({
      next: list => {
        this.yourTokens = list ?? [];
        this.applyLocalYourTokensFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        if (!silent) this.toast.errorWithRetry('Failed to load your tokens.', () => this.loadYourTokens());
      }
    });
  }

  applyFilters() {
    if (this.activeTab === 'yourTokens') { this.applyLocalYourTokensFilters(); return; }
    if (this.activeTab === 'primaryMarket') { this.loadPrimaryMarket(); return; }
    this.loadSecondaryMarket();
  }

  refreshFilters() {
    this.marketCompanyId = -1;
    this.marketProductId = -1;
    this.marketRequestId = -1;
    this.filterProductsByCompany();
    this.requests = [];
    this.refreshCurrentTab();
  }

  refreshCurrentTab() {
    if (this.activeTab === 'yourTokens') this.loadYourTokens();
    else if (this.activeTab === 'primaryMarket') this.loadPrimaryMarket();
    else this.loadSecondaryMarket();
  }

  private applyLocalYourTokensFilters() {
    let result = [...(this.yourTokens ?? [])];
    const cId = Number(this.marketCompanyId);
    const pId = Number(this.marketProductId);
    const rId = Number(this.marketRequestId);
    if (!isNaN(cId) && cId !== -1) result = result.filter(t => Number(t.companyId) === cId);
    if (!isNaN(pId) && pId !== -1) result = result.filter(t => Number(t.productId) === pId);
    if (!isNaN(rId) && rId !== -1) result = result.filter(t => Number(t.requestId) === rId);
    this.filteredYourTokens = result;
  }

  // ── Token detail modal ─────────────────────────────────────
  openDetail(token: ServiceTokenDto, tab: MarketplaceTab) {
    this.detailToken = token;
    this.detailTab = tab;
  }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.detailToken && !this.getServiceToken) this.closeDetail(); }

  closeDetail() { this.detailToken = null; }

  addToCart(token: ServiceTokenDto) {
    // Use the modal's tab when adding from the detail view, otherwise the active grid tab.
    const tab = this.detailToken ? this.detailTab : this.activeTab;
    const market: CartMarket = tab === 'secondaryMarket' ? 'secondaryMarket' : 'primaryMarket';
    this.cartService.add(token, market, this.customerPublicKey).subscribe({
      next: () => {
        this.toast.success(`"${token.productName}" added to cart.`);
        this.closeDetail();   // dismiss the detail modal, just like the Close button
      },
      error: err => this.toast.error(err?.error?.message ?? err?.error ?? 'Failed to add token to cart.')
    });
  }

  // ── Cart ──────────────────────────────────────────────────
  openCart() { this.router.navigate(['/cart']); }

  // ── Logout ────────────────────────────────────────────────
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
    this.cartService.clear();
    sessionStorage.removeItem(TAB_KEY);
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // ── Get Service QR overlay ─────────────────────────────────
  openGetService(t: ServiceTokenDto) { this.getServiceToken = t; }

  onGetServiceClosed(result: ServiceResult | null) {
    this.getServiceToken = null;
    if (!result) return;
    if (result.success) {
      this.toast.success('Service granted successfully!');
      this.loadYourTokens(true);
    } else {
      this.toast.error(result.message ?? 'Service request failed.');
      this.loadYourTokens(true);
    }
  }

  // ── Mark / Cancel ─────────────────────────────────────────────────────────────────────────
  markForResell(t: ServiceTokenDto, event?: Event) {
    event?.stopPropagation();
    this.loading = true;
    this.serviceTokenApi.markServiceTokenForResell(t.id, t.rowVersion).subscribe({
      next: _ => { this.loading = false; this.toast.success('Token marked for resell.'); this.loadYourTokens(true); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  cancelReselling(t: ServiceTokenDto, event?: Event) {
    event?.stopPropagation();
    this.loading = true;
    this.serviceTokenApi.cancelReselling(t.id, t.rowVersion).subscribe({
      next: _ => { this.loading = false; this.toast.success('Reselling cancelled.'); this.loadYourTokens(true); },
      error: err => { this.loading = false; this.toast.error(err.error?.message ?? err.error); }
    });
  }

  loadPrimaryMarket(silent = false, openTokenId?: string) {
    this.loading = true;
    this.serviceTokenApi.getPrimaryMarketServiceTokens(this.marketCompanyId, this.marketRequestId).subscribe({
      next: list => {
        this.primaryMarketTokens = list ?? [];
        this.loading = false;
        if (openTokenId) {
          const t = this.primaryMarketTokens.find(x => x.id === openTokenId);
          if (t) this.openDetail(t, 'primaryMarket');
        }
      },
      error: () => { this.loading = false; if (!silent) this.toast.errorWithRetry('Failed to load primary market.', () => this.loadPrimaryMarket()); }
    });
  }

  loadSecondaryMarket(silent = false) {
    this.loading = true;
    this.serviceTokenApi.getSecondaryMarketServiceTokens(this.customerPublicKey, this.marketCompanyId, this.marketRequestId).subscribe({
      next: list => { this.secondaryMarketTokens = list ?? []; this.loading = false; },
      error: () => { this.loading = false; if (!silent) this.toast.errorWithRetry('Failed to load secondary market.', () => this.loadSecondaryMarket()); }
    });
  }

  // ── Filtered token lists (exclude items already in cart) ──
  get visiblePrimaryTokens(): ServiceTokenDto[] {
    let tokens = this.primaryMarketTokens.filter(t => !this.cartService.has(t.id));
    const pId = Number(this.marketProductId);
    if (!isNaN(pId) && pId !== -1) tokens = tokens.filter(t => Number(t.productId) === pId);
    return tokens;
  }

  get visibleSecondaryTokens(): ServiceTokenDto[] {
    let tokens = this.secondaryMarketTokens.filter(t => !this.cartService.has(t.id));
    const pId = Number(this.marketProductId);
    if (!isNaN(pId) && pId !== -1) tokens = tokens.filter(t => Number(t.productId) === pId);
    return tokens;
  }

  // ── Display helpers ────────────────────────────────────────
  statusClass(status: number): string {
    switch (status) {
      case ServiceTokenStatus.None:      return 'badge--gray';
      case ServiceTokenStatus.Available: return 'badge--green';
      case ServiceTokenStatus.Sold:      return 'badge--blue';
      case ServiceTokenStatus.InCart:    return 'badge--yellow';
      case ServiceTokenStatus.Finished:  return 'badge--gray';
      default:                           return 'badge--gray';
    }
  }

  tokenStatusLabel(status: number): string {
    switch (status) {
      case ServiceTokenStatus.None:      return 'None';
      case ServiceTokenStatus.Available: return 'Available';
      case ServiceTokenStatus.Sold:      return 'Sold';
      case ServiceTokenStatus.InCart:    return 'In Cart';
      case ServiceTokenStatus.Finished:  return 'Finished';
      default: return `Status ${status}`;
    }
  }

  scheduleTypeLabel(st: ScheduleType): string {
    if (!st) return '—';
    const base = this.schedulePeriodLabel(st.periodType);
    if (st.periodType === 0) return base;
    return st.periodNumber > 0 ? `${base} / ${st.periodNumber}` : base;
  }

  private schedulePeriodLabel(v: number): string {
    switch (v) {
      case 0: return 'Free use';  case 1: return 'Daily';
      case 2: return 'Weekly'; case 3: return 'Monthly';
      case 4: return 'Yearly'; default: return `Period ${v}`;
    }
  }

  pictogramSrc(token: ServiceTokenDto): string | null {
    if (!token.pictogram) return null;
    return `data:image/png;base64,${token.pictogram}`;
  }
}
