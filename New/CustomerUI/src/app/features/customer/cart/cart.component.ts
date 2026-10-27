import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../../core/services/cart.service';
import { ServiceTokenApiService } from '../../../core/api/service-token-api.service';
import { CustomerStateService } from '../../../core/state/customer-state.service';
import { DialogService } from '../../../core/services/dialog.service';
import { ServiceTokenDto } from '../../../shared/models/service-token.model';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type ItemStatus = 'pending' | 'processing' | 'success' | 'error';

export interface CheckoutItemState {
  item: CartItem;
  status: ItemStatus;
  errorMsg: string;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit {
  checkoutStarted = false;
  checkoutDone = false;
  checkoutLoading = false;
  checkoutStates: CheckoutItemState[] = [];

  /**
   * IDs currently being cancelled. Stored as a plain array (not Set) so that
   * Angular's default change detection picks up mutations via reassignment.
   */
  removingIds: string[] = [];

  constructor(
    public cartService: CartService,
    private serviceTokenApi: ServiceTokenApiService,
    private customerState: CustomerStateService,
    private router: Router,
    private dialog: DialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const customer = this.customerState.customer;
    if (!customer) { this.router.navigate(['/login']); return; }
    this.cartService.load(customer.publicKey).subscribe({
      error: err => console.error('Failed to load cart:', err)
    });
  }

  goBack() { this.router.navigate(['/marketplace']); }

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
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  checkout() {
    const customer = this.customerState.customer;
    if (!customer) { this.router.navigate(['/login']); return; }

    if (this.cartService.items.length === 0) return;

    // Payment now happens on the dedicated checkout page (TBC redirect flow).
    this.router.navigate(['/checkout']);
  }

  private processNext(index: number, publicKey: string) {
    if (index >= this.checkoutStates.length) {
      this.checkoutLoading = false;
      this.checkoutDone = true;
      const successIds = this.checkoutStates
        .filter(s => s.status === 'success')
        .map(s => s.item.token.id);
      successIds.forEach(id => this.cartService.removeLocal(id));
      return;
    }

    const state = this.checkoutStates[index];
    state.status = 'processing';

    const token = state.item.token;
    (token.ownerType === 0
      ? this.serviceTokenApi.buyPrimaryServiceToken(token.id, token.rowVersion, publicKey)
      : this.serviceTokenApi.buySecondaryServiceToken(token.id, token.rowVersion, publicKey)
    ).pipe(
      catchError(err => {
        state.status = 'error';
        const msg = err?.error;
        state.errorMsg = typeof msg === 'string' ? msg : (msg?.message ?? 'Purchase failed.');
        return of(null);
      })
    ).subscribe(() => {
      if (state.status !== 'error') {
        state.status = 'success';
      }
      this.processNext(index + 1, publicKey);
    });
  }

  /** Returns true while a CancelInCart API call is in flight for this token id. */
  isRemoving(id: string): boolean {
    return this.removingIds.includes(id);
  }

  /**
   * Calls CancelInCart via CartService. The BehaviorSubject emission removes the
   * card from the async-pipe list; reassigning removingIds[] triggers CD for the
   * button disabled/spinner state.
   */
  remove(id: string) {
    if (this.isRemoving(id)) return;

    // Reassign so Angular detects the change
    this.removingIds = [...this.removingIds, id];

    this.cartService.remove(id).subscribe({
      next: () => {
        this.removingIds = this.removingIds.filter(x => x !== id);
        this.cdr.markForCheck();
      },
      error: err => {
        this.removingIds = this.removingIds.filter(x => x !== id);
        this.cdr.markForCheck();
        console.error('Failed to cancel cart reservation:', err);
      }
    });
  }

  pictogramSrc(token: ServiceTokenDto): string | null {
    if (!token.pictogram) return null;
    return `data:image/png;base64,${token.pictogram}`;
  }

  scheduleLabel(token: ServiceTokenDto): string {
    const st = token.scheduleType;
    if (!st) return '—';
    const labels: Record<number, string> = { 0: 'Free use', 1: 'Daily', 2: 'Weekly', 3: 'Monthly', 4: 'Yearly' };
    const base = labels[st.periodType] ?? `Period ${st.periodType}`;
    if (st.periodType === 0) return base;
    return st.periodNumber > 0 ? `${base} / ${st.periodNumber}` : base;
  }

  get hasCheckoutableItems(): boolean {
    return this.cartService.items.length > 0;
  }

  get allDone(): boolean {
    return this.checkoutStates.every(s => s.status === 'success' || s.status === 'error');
  }

  get successCount(): number { return this.checkoutStates.filter(s => s.status === 'success').length; }
  get errorCount(): number   { return this.checkoutStates.filter(s => s.status === 'error').length; }
}
