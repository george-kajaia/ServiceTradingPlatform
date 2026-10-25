import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { CompanyStateService } from '../../../core/state/company-state.service';
import { CompanyApiService } from '../../../core/api/company-api.service';
import { DomainApiService } from '../../../core/api/domain-api.service';
import { RequestApiService } from '../../../core/api/request-api.service';
import { ProductApiService } from '../../../core/api/product-api.service';
import { CompanyUserApiService } from '../../../core/api/company-user-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { DialogService } from '../../../core/services/dialog.service';
import { ModalDialogDirective } from '../../../shared/directives/modal-dialog.directive';

import { Company } from '../../../shared/models/company.model';
import { Request, RequestStatus } from '../../../shared/models/request.model';
import { Product, SchedulePeriodType } from '../../../shared/models/product.model';
import { CompanyUser, CompanyUserType, CompanyUserRequestDto } from '../../../shared/models/company-user.model';
import { RequestDto, DomainItemDto, CompanyUpdateDto } from '../../../shared/models/dtos.model';

type CompanyTab = 'requests' | 'products' | 'users';
type ModalMode =
  | 'none'
  | 'companyView'
  | 'companyEdit'
  | 'requestView'
  | 'requestAdd'
  | 'requestEdit'
  | 'productView'
  | 'productAdd'
  | 'productEdit'
  | 'userView'
  | 'userAdd'
  | 'userEdit';

@Component({
  selector: 'app-company-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalDialogDirective],
  templateUrl: './company-dashboard.component.html',
  styleUrls: ['./company-dashboard.component.scss']
})
export class CompanyDashboardComponent implements OnInit {
  company: Company | null = null;

  activeTab: CompanyTab = 'requests';


  // Domain lookups (for Legal Form / Economic Activity display + dropdowns)
  legalForms: DomainItemDto[] = [];
  economicActivities: DomainItemDto[] = [];

  // Company detail form (mirrors the registration form, minus credentials).
  companyForm: {
    name: string;
    taxCode: string;
    address: string;
    legalForm: number | null;
    economicActivity: number | null;
    mail: string;
    phone: string;
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
    bankAccountIban: '',
    bankAccountName: '',
    bankName: ''
  };

  // Requests tab state
  requests: Request[] = [];
  requestsLoading = false;
  selectedRequest: Request | null = null;

  // Products tab state
  products: Product[] = [];
  productsLoading = false;
  selectedProduct: Product | null = null;

  // Products query state (API does not expose CompanyId filter; we filter client-side)
  productSearch = '';
  productSkip = 0;
  productTake = 200;

  // Modal state
  modalOpen = false;
  modalMode: ModalMode = 'none';
  modalTitle = '';
  modalLoading = false;
  /** Set while loading data for a view/edit dialog (as opposed to submitting a form). */
  modalFetching = false;
  modalError = '';

  modalRequest: Request | null = null;
  modalProduct: Product | null = null;
  modalUser: CompanyUser | null = null;

  // Forms
  requestForm: RequestDto = { companyId: 0, productId: 0, serviceTokenCount: 1 };
  requestFormProductIdManual: number | null = null;

  productForm: Product = {
    id: 0,
    companyId: 0,
    name: '',
    serviceCount: 0,
    price: 0,
    term: null,
    scheduleType: { periodType: SchedulePeriodType.None, periodNumber: null }
  };

  // Users tab state
  users: CompanyUser[] = [];
  usersLoading = false;
  selectedUser: CompanyUser | null = null;

  // Users query state (GetAllUsers does not filter by CompanyId; we filter client-side)
  userSearch = '';
  userSkip = 0;
  userTake = 200;

  // Expose the enum to the template
  CompanyUserType = CompanyUserType;

  userForm: CompanyUserRequestDto = {
    userType: CompanyUserType.Other,
    companyId: 0,
    userName: '',
    password: ''
  };

  // Pictogram state
  pictogramFile: File | null = null;
  pictogramPreviewUrl: string | null = null;
  pictogramExistsOnServer = false;

  private toast = inject(ToastService);
  private dialog = inject(DialogService);

  constructor(
    private router: Router,
    private companyState: CompanyStateService,
    private companyApi: CompanyApiService,
    private domainApi: DomainApiService,
    private requestApi: RequestApiService,
    public productApi: ProductApiService,
    public companyUserApi: CompanyUserApiService
  ) {}

  ngOnInit(): void {
    this.company = this.companyState.company;

    if (!this.company) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadDomains();
    this.loadRequests();
    this.reloadProducts();
    this.reloadUsers();
  }

  setTab(tab: CompanyTab) {
    this.activeTab = tab;
  }

  // -----------------------------
  // Domain lookups
  // -----------------------------
  private loadDomains() {
    this.domainApi.getLegalForms().subscribe({
      next: items => (this.legalForms = items ?? []),
      error: err => console.error('Failed to load legal forms', err)
    });
    this.domainApi.getEconomicActivities().subscribe({
      next: items => (this.economicActivities = items ?? []),
      error: err => console.error('Failed to load economic activities', err)
    });
  }

  legalFormName(id: number | null | undefined): string {
    if (id == null) return '-';
    return this.legalForms.find(x => x.id === id)?.name ?? `#${id}`;
  }

  economicActivityName(id: number | null | undefined): string {
    if (id == null) return '-';
    return this.economicActivities.find(x => x.id === id)?.name ?? `#${id}`;
  }

  // -----------------------------
  // Company details (View / Edit)
  // -----------------------------
  private fillCompanyForm() {
    if (!this.company) return;
    this.companyForm = {
      name: this.company.name,
      taxCode: this.company.taxCode,
      address: this.company.address,
      legalForm: this.company.legalForm,
      economicActivity: this.company.economicActivity,
      mail: this.company.mail,
      phone: this.company.phone,
      // Read shape: bank account is nested under the company (GetById includes it).
      bankAccountIban: this.company.bankAccount?.iban ?? '',
      bankAccountName: this.company.bankAccount?.beneficiaryName ?? '',
      bankName: this.company.bankAccount?.bankName ?? ''
    };
  }

  onCompanyView() {
    if (!this.company) return;
    this.fillCompanyForm();
    this.openModal('companyView', 'Company details');
  }

  onCompanyEdit() {
    if (!this.company) return;
    this.fillCompanyForm();
    this.openModal('companyEdit', 'Edit company');
  }

  submitCompanyEdit() {
    if (!this.company) return;

    if (this.companyForm.legalForm == null || this.companyForm.economicActivity == null) {
      this.modalError = 'Please select a legal form and an economic activity.';
      return;
    }

    const payload: CompanyUpdateDto = {
      ...this.company,
      name: this.companyForm.name,
      taxCode: this.companyForm.taxCode,
      address: this.companyForm.address,
      legalForm: this.companyForm.legalForm,
      economicActivity: this.companyForm.economicActivity,
      mail: this.companyForm.mail,
      phone: this.companyForm.phone,
      // Write shape: the API binds onto CompanyRequestDto, so the bank account is
      // sent flat. An empty IBAN tells the API to clear the stored account.
      bankAccountIban: this.companyForm.bankAccountIban?.trim() ?? '',
      bankAccountName: this.companyForm.bankAccountName?.trim() ?? '',
      bankName: this.companyForm.bankName?.trim() ?? ''
    };

    this.modalLoading = true;
    this.modalError = '';

    this.companyApi.updateCompany(this.company.id, this.company.rowVersion, payload).subscribe({
      next: _ => {
        // Refresh from the server to pick up the new rowVersion and any server-side changes.
        this.companyApi.getById(this.company!.id).subscribe({
          next: fresh => {
            this.company = fresh;
            this.companyState.company = fresh;
            this.modalLoading = false;
            this.closeModal();
            this.toast.success('Company updated successfully.');
          },
          error: _err => {
            this.modalLoading = false;
            this.closeModal();
            this.toast.success('Company updated. Reload to see the latest values.');
          }
        });
      },
      error: err => {
        this.modalLoading = false;
        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  // -----------------------------
  // Requests
  // -----------------------------
  loadRequests(silent = false) {
    if (!this.company) return;

    this.requestsLoading = true;
    this.selectedRequest = null;

    this.requestApi.getAll(this.company.id, RequestStatus.None).subscribe({
      next: data => {
        this.requests = data ?? [];
        this.requestsLoading = false;
      },
      error: err => {
        console.error(err);
        this.requestsLoading = false;
        if (!silent) {
          this.toast.errorWithRetry(
            'Failed to load requests. Please check your connection.',
            () => this.loadRequests()
          );
        }
      }
    });
  }

  selectRequest(r: Request) {
    this.selectedRequest = r;
  }

  onRequestView() {
    if (!this.selectedRequest) return;

    this.openModal('requestView', 'Request details');
    // We already have the request object from the grid; show it directly.
    this.modalRequest = { ...this.selectedRequest };
  }

  onRequestAdd() {
    if (!this.company) return;

    this.requestForm = { companyId: this.company.id, productId: 0, serviceTokenCount: 1 };
    this.requestFormProductIdManual = null;
    this.openModal('requestAdd', 'Add new request');
  }

  submitRequestAdd() {
    if (!this.company) return;

    const productId =
      (this.requestFormProductIdManual ?? 0) > 0 ? (this.requestFormProductIdManual as number) : this.requestForm.productId;

    if (!productId || productId <= 0) {
      this.modalError = 'Please select or enter a valid Product Id.';
      return;
    }

    const dto: RequestDto = { companyId: this.company.id, productId, serviceTokenCount: this.requestForm.serviceTokenCount };

    this.modalLoading = true;
    this.modalError = '';

    this.requestApi.create(dto).subscribe({
      next: _ => {
        this.modalLoading = false;
        this.closeModal();
        this.loadRequests(true);
        this.toast.success('Request created successfully.');
      },
      error: err => {
        console.error(err);
        this.modalLoading = false;

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  onRequestEdit() {
    if (!this.company || !this.selectedRequest) return;

    this.requestForm = {
      companyId: this.company.id,
      productId: this.selectedRequest.productId,
      serviceTokenCount: this.selectedRequest.serviceTokenCount
    };
    this.requestFormProductIdManual = null;
    this.openModal('requestEdit', 'Edit request');
  }

  submitRequestEdit() {
    if (!this.company || !this.selectedRequest) return;

    const productId = this.requestForm.productId;
    if (!productId || productId <= 0) {
      this.modalError = 'Please select a valid Product Id.';
      return;
    }

    if (!this.requestForm.serviceTokenCount || this.requestForm.serviceTokenCount <= 0) {
      this.modalError = 'Please enter a valid Service Token Count.';
      return;
    }

    const dto: RequestDto = {
      companyId: this.company.id,
      productId,
      serviceTokenCount: this.requestForm.serviceTokenCount
    };

    this.modalLoading = true;
    this.modalError = '';

    this.requestApi.update(this.selectedRequest.id, this.selectedRequest.rowVersion, dto).subscribe({
      next: _ => {
        this.modalLoading = false;
        this.closeModal();
        this.loadRequests(true);
        this.toast.success('Request updated successfully.');
      },
      error: err => {
        this.modalLoading = false;

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  async onRequestDelete() {
    if (!this.selectedRequest) return;

    const confirmed = await this.dialog.confirm({
      title: 'Delete Request',
      message: `Are you sure you want to delete request #${this.selectedRequest.id}? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!confirmed) return;

    this.requestsLoading = true;

    this.requestApi.delete(this.selectedRequest.id, this.selectedRequest.rowVersion).subscribe({
      next: _ => {
        this.requestsLoading = false;
        this.selectedRequest = null;
        this.loadRequests(true);
        this.toast.success('Request deleted successfully.');
      },
      error: err => {
        this.requestsLoading = false;

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  // Row-level workflow actions (per request record)
  authorizeRequestRow(r: Request, event?: Event) {
    event?.stopPropagation();
    if (Number(r.status) !== RequestStatus.Created) return;

    this.requestsLoading = true;

    this.requestApi.authorize(r.id, r.rowVersion).subscribe({
      next: updated => {
        this.requestsLoading = false;
        this.patchRequestInList(updated);
        this.toast.success('Request authorized.');
      },
      error: err => {
        console.error(err);
        this.requestsLoading = false;
        
        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  deauthorizeRequestRow(r: Request, event?: Event) {
    event?.stopPropagation();
    if (Number(r.status) !== RequestStatus.Authorised) return;

    this.requestsLoading = true;

    this.requestApi.deauthorize(r.id, r.rowVersion).subscribe({
      next: updated => {
        this.requestsLoading = false;
        this.patchRequestInList(updated);
        this.toast.success('Request deauthorized.');
      },
      error: err => {
        console.error(err);
        this.requestsLoading = false;

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  private patchRequestInList(updated: Request | null | undefined) {
    // Some backend actions may return an empty body (null) even though the request was updated.
    // In that case, fall back to reloading the list instead of crashing the UI.
    if (!updated || (updated as any).id == null) {
      this.loadRequests();
      return;
    }

    // Defensive: ensure there are no null items in the local list.
    this.requests = (this.requests ?? []).filter((x): x is Request => !!x && (x as any).id != null);

    const idx = this.requests.findIndex(x => x.id === updated.id);
    if (idx >= 0) {
      this.requests[idx] = updated;
    } else {
      this.requests = [updated, ...this.requests];
    }

    if (this.selectedRequest?.id === updated.id) {
      this.selectedRequest = updated;
    }
  }

  // -----------------------------
  // Products
  // -----------------------------
  reloadProducts(silent = false) {
    if (!this.company) return;

    this.productSkip = 0;
    this.products = [];
    this.selectedProduct = null;
    this.loadProductsPage(true, silent);
  }

  loadProductsPage(resetSelection: boolean = false, silent = false) {
    if (!this.company) return;

    if (resetSelection) this.selectedProduct = null;
    this.productsLoading = true;

    this.productApi.getAll(this.productSkip, this.productTake, this.productSearch || null).subscribe({
      next: data => {
        const all = data ?? [];
        const mine = all.filter(p => p.companyId === this.company!.id);

        // Append while avoiding duplicates by id (in case of server-side ordering changes)
        const existing = new Map(this.products.map(p => [p.id, p]));
        for (const p of mine) existing.set(p.id, p);

        this.products = Array.from(existing.values()).sort((a, b) => a.id - b.id);
        this.productsLoading = false;
      },
      error: err => {
        console.error(err);
        this.productsLoading = false;
        if (!silent) {
          this.toast.errorWithRetry(
            'Failed to load products. Please check your connection.',
            () => this.loadProductsPage(false)
          );
        }
      }
    });
  }

  loadMoreProducts() {
    this.productSkip += this.productTake;
    this.loadProductsPage(false);
  }

  selectProduct(p: Product) {
    this.selectedProduct = p;
  }

  onProductView() {
    if (!this.selectedProduct) return;

    this.openModal('productView', 'Product details');
    this.modalLoading = true;
    this.modalFetching = true;

    this.productApi.getById(this.selectedProduct.id).subscribe({
      next: prod => {
        this.modalProduct = prod;
        this.modalLoading = false;
        this.modalFetching = false;
      },
      error: err => {
        console.error(err);
        this.modalLoading = false;
        this.modalFetching = false;
        this.closeModal();

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  onProductAdd() {
    if (!this.company) return;

    this.productForm = {
      id: 0,
      companyId: this.company.id,
      name: '',
      serviceCount: 0,
      price: 0,
      term: null,
      scheduleType: { periodType: SchedulePeriodType.None, periodNumber: null }
    };

    this.pictogramFile = null;
    this.pictogramPreviewUrl = null;
    this.pictogramExistsOnServer = false;
    this.openModal('productAdd', 'Add new product');
  }

  onPictogramSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.pictogramFile = file;
    if (file) {
      const reader = new FileReader();
      reader.onload = () => (this.pictogramPreviewUrl = reader.result as string);
      reader.readAsDataURL(file);
    } else {
      this.pictogramPreviewUrl = null;
    }
  }

  submitProductAdd() {
    if (!this.company) return;

    this.modalLoading = true;
    this.modalError = '';

    const payload: Product = {
      ...this.productForm,
      companyId: this.company.id
    };

    this.productApi.create(payload).subscribe({
      next: _ => {
        // Product created — now upload pictogram if one was selected.
        // We need the new product's ID, so we reload products to find it by name+companyId.
        if (this.pictogramFile) {
          this.reloadProducts(true);
          // Find the newly created product by reloading and matching name
          this.productApi.getAll(0, 200, payload.name).subscribe({
            next: all => {
              const created = all
                .filter(p => p.companyId === this.company!.id && p.name === payload.name)
                .sort((a, b) => b.id - a.id)[0];

              if (created && this.pictogramFile) {
                this.productApi.addPictogram(created.id, this.pictogramFile).subscribe({
                  next: () => {
                    this.modalLoading = false;
                    this.closeModal();
                    this.reloadProducts(true);
                    this.toast.success('Product created successfully with pictogram.');
                  },
                  error: err => {
                    this.modalLoading = false;
                    this.closeModal();
                    this.reloadProducts(true);
                    const message = typeof err.error === 'string' ? err.error : err.error?.message;
                    this.toast.error(`Product created but pictogram upload failed: ${message}`);
                  }
                });
              } else {
                this.modalLoading = false;
                this.closeModal();
                this.reloadProducts(true);
                this.toast.success('Product created successfully.');
              }
            },
            error: () => {
              this.modalLoading = false;
              this.closeModal();
              this.reloadProducts(true);
              this.toast.success('Product created. Pictogram upload skipped (could not resolve new product ID).');
            }
          });
        } else {
          this.modalLoading = false;
          this.closeModal();
          this.reloadProducts(true);
          this.toast.success('Product created successfully.');
        }
      },
      error: err => {
        console.error(err);
        this.modalLoading = false;
        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  onProductEdit() {
    if (!this.selectedProduct) return;
    this.openProductEdit(this.selectedProduct.id);
  }

  private openProductEdit(productId: number) {
    this.openModal('productEdit', 'Edit product');
    this.modalLoading = true;
    this.modalFetching = true;
    this.pictogramFile = null;
    this.pictogramPreviewUrl = null;
    this.pictogramExistsOnServer = false;

    this.productApi.getById(productId).subscribe({
      next: prod => {
        const term = prod.term === undefined ? null : prod.term;
        const scheduleType = prod.scheduleType ?? { periodType: SchedulePeriodType.None, periodNumber: null };
        this.productForm = { ...prod, term: term as any, scheduleType };

        // Check if a pictogram already exists by trying to load it
        const img = new Image();
        img.onload = () => {
          this.pictogramExistsOnServer = true;
          this.pictogramPreviewUrl = this.productApi.getPictogramUrl(productId);
          this.modalLoading = false;
          this.modalFetching = false;
        };
        img.onerror = () => {
          this.pictogramExistsOnServer = false;
          this.modalLoading = false;
          this.modalFetching = false;
        };
        img.src = this.productApi.getPictogramUrl(productId);
      },
      error: err => {
        console.error(err);
        this.modalLoading = false;
        this.modalFetching = false;
        this.closeModal();

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  submitProductEdit() {
    if (!this.company) return;

    this.modalLoading = true;
    this.modalError = '';

    const productId = this.productForm.id;
    const payload: Product = { ...this.productForm, companyId: this.company.id };

    this.productApi.update(productId, payload).subscribe({
      next: _ => {
        if (this.pictogramFile) {
          const upload$ = this.pictogramExistsOnServer
            ? this.productApi.updatePictogram(productId, this.pictogramFile)
            : this.productApi.addPictogram(productId, this.pictogramFile);

          upload$.subscribe({
            next: () => {
              this.modalLoading = false;
              this.closeModal();
              this.reloadProducts(true);
              this.loadRequests(true);
              this.toast.success('Product updated successfully with pictogram.');
            },
            error: err => {
              this.modalLoading = false;
              this.closeModal();
              this.reloadProducts(true);
              const message = typeof err.error === 'string' ? err.error : err.error?.message;
              this.toast.error(`Product updated but pictogram upload failed: ${message}`);
            }
          });
        } else {
          this.modalLoading = false;
          this.closeModal();
          this.reloadProducts(true);
          this.loadRequests(true);
          this.toast.success('Product updated successfully.');
        }
      },
      error: err => {
        console.error(err);
        this.modalLoading = false;
        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  async onProductDelete() {
    if (!this.selectedProduct) return;

    const productId = this.selectedProduct.id;
    const confirmed = await this.dialog.confirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete product #${productId}? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!confirmed) return;

    this.productsLoading = true;

    this.productApi.delete(productId).subscribe({
      next: _ => {
        this.productsLoading = false;
        this.selectedProduct = null;
        this.reloadProducts(true);
        this.loadRequests(true);
        this.toast.success('Product deleted successfully.');
      },
      error: err => {
        console.error(err);
        this.productsLoading = false;

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  // -----------------------------
  // Users
  // -----------------------------
  reloadUsers(silent = false) {
    if (!this.company) return;

    this.userSkip = 0;
    this.users = [];
    this.selectedUser = null;
    this.loadUsersPage(true, silent);
  }

  loadUsersPage(resetSelection: boolean = false, silent = false) {
    if (!this.company) return;

    if (resetSelection) this.selectedUser = null;
    this.usersLoading = true;

    this.companyUserApi.getAll(this.userSkip, this.userTake, this.userSearch || null).subscribe({
      next: data => {
        const all = data ?? [];
        // GetAllUsers does not filter by company; keep only this company's users.
        const mine = all.filter(u => u.companyId === this.company!.id);

        // Append while avoiding duplicates by id
        const existing = new Map(this.users.map(u => [u.id, u]));
        for (const u of mine) existing.set(u.id, u);

        this.users = Array.from(existing.values()).sort((a, b) => a.id - b.id);
        this.usersLoading = false;
      },
      error: err => {
        console.error(err);
        this.usersLoading = false;
        if (!silent) {
          this.toast.errorWithRetry(
            'Failed to load users. Please check your connection.',
            () => this.loadUsersPage(false)
          );
        }
      }
    });
  }

  loadMoreUsers() {
    this.userSkip += this.userTake;
    this.loadUsersPage(false);
  }

  selectUser(u: CompanyUser) {
    this.selectedUser = u;
  }

  onUserView() {
    if (!this.company || !this.selectedUser) return;

    this.openModal('userView', 'User details');
    this.modalLoading = true;
    this.modalFetching = true;

    // Fetch the user fresh via GetUserByName (no companyId required).
    this.companyUserApi.getByName(this.selectedUser.userName).subscribe({
      next: u => {
        this.modalUser = u;
        this.modalLoading = false;
        this.modalFetching = false;
      },
      error: err => {
        console.error(err);
        this.modalLoading = false;
        this.modalFetching = false;
        this.closeModal();

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  onUserAdd() {
    if (!this.company) return;

    this.userForm = {
      userType: CompanyUserType.Other,
      companyId: this.company.id,
      userName: '',
      password: ''
    };
    this.openModal('userAdd', 'Add new user');
  }

  submitUserAdd() {
    if (!this.company) return;

    if (!this.userForm.userName || this.userForm.userName.trim().length === 0) {
      this.modalError = 'User name is required.';
      return;
    }
    if (!this.userForm.password || this.userForm.password.length === 0) {
      this.modalError = 'Password is required.';
      return;
    }

    const dto: CompanyUserRequestDto = {
      userType: Number(this.userForm.userType),
      companyId: this.company.id,
      userName: this.userForm.userName.trim(),
      password: this.userForm.password
    };

    this.modalLoading = true;
    this.modalError = '';

    this.companyUserApi.create(dto).subscribe({
      next: _ => {
        this.modalLoading = false;
        this.closeModal();
        this.reloadUsers(true);
        this.toast.success('User created successfully.');
      },
      error: err => {
        console.error(err);
        this.modalLoading = false;
        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  onUserEdit() {
    if (!this.company || !this.selectedUser) return;

    this.openModal('userEdit', 'Edit user');
    this.modalLoading = true;
    this.modalFetching = true;

    // Fetch the user fresh via GetUserByName before editing (no companyId required).
    this.companyUserApi.getByName(this.selectedUser.userName).subscribe({
      next: u => {
        this.userForm = {
          userType: u.userType,
          companyId: this.company!.id,
          userName: u.userName,
          password: u.password
        };
        this.modalLoading = false;
        this.modalFetching = false;
      },
      error: err => {
        console.error(err);
        this.modalLoading = false;
        this.modalFetching = false;
        this.closeModal();

        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  submitUserEdit() {
    if (!this.company) return;

    if (!this.userForm.userName || this.userForm.userName.trim().length === 0) {
      this.modalError = 'User name is required.';
      return;
    }
    if (!this.userForm.password || this.userForm.password.length === 0) {
      this.modalError = 'Password is required.';
      return;
    }

    const dto: CompanyUserRequestDto = {
      userType: Number(this.userForm.userType),
      companyId: this.company.id,
      userName: this.userForm.userName.trim(),
      password: this.userForm.password
    };

    this.modalLoading = true;
    this.modalError = '';

    this.companyUserApi.update(dto).subscribe({
      next: _ => {
        this.modalLoading = false;
        this.closeModal();
        this.reloadUsers(true);
        this.toast.success('User updated successfully.');
      },
      error: err => {
        console.error(err);
        this.modalLoading = false;
        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  async onUserDelete() {
    if (!this.company || !this.selectedUser) return;

    const userName = this.selectedUser.userName;
    const confirmed = await this.dialog.confirm({
      title: 'Delete User',
      message: `Are you sure you want to delete user "${userName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!confirmed) return;

    this.usersLoading = true;

    this.companyUserApi.delete(this.company.id, userName).subscribe({
      next: _ => {
        this.usersLoading = false;
        this.selectedUser = null;
        this.reloadUsers(true);
        this.toast.success('User deleted successfully.');
      },
      error: err => {
        console.error(err);
        this.usersLoading = false;
        const message = typeof err.error === 'string' ? err.error : err.error?.message;
        this.toast.error(message);
      }
    });
  }

  userTypeLabel(type: number): string {
    switch (Number(type)) {
      case CompanyUserType.Admin:
        return 'Admin';
      case CompanyUserType.Other:
        return 'Other';
      case CompanyUserType.None:
        return 'None';
      default:
        return `Type ${type}`;
    }
  }

  // -----------------------------
  // Modal helpers
  // -----------------------------
  /** True while a create/update request is in flight (not while merely fetching view/edit data). */
  get modalSubmitting(): boolean {
    return this.modalOpen && this.modalLoading && !this.modalFetching;
  }

  /** User-initiated dismissal (close button, Cancel, Escape, backdrop). Ignored while submitting. */
  requestClose() {
    if (this.modalSubmitting) return;
    this.closeModal();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.requestClose();
  }

  openModal(mode: ModalMode, title: string) {
    this.modalOpen = true;
    this.modalMode = mode;
    this.modalTitle = title;

    this.modalLoading = false;
    this.modalFetching = false;
    this.modalError = '';

    this.modalRequest = null;
    this.modalProduct = null;
    this.modalUser = null;
  }

  closeModal() {
    this.modalOpen = false;
    this.modalMode = 'none';
    this.modalTitle = '';
    this.modalLoading = false;
    this.modalFetching = false;
    this.modalError = '';
    this.modalRequest = null;
    this.modalProduct = null;
    this.modalUser = null;
  }

  // -----------------------------
  // Display helpers
  // -----------------------------
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

  scheduleTypeLabel(periodType: number, periodNumber?: number | null): string {
    const label = this.schedulePeriodLabel(periodType);
    if (!periodNumber || periodNumber <= 0) return label;
    return `${label} / ${periodNumber}`;
  }

  schedulePeriodLabel(value: number): string {
    switch (value) {
      case SchedulePeriodType.None:
        return 'None';
      case SchedulePeriodType.Daily:
        return 'Daily';
      case SchedulePeriodType.Weekly:
        return 'Weekly';
      case SchedulePeriodType.Monthly:
        return 'Monthly';
      case SchedulePeriodType.Yearly:
        return 'Yearly';
      default:
        return `Period ${value}`;
    }
  }
}
