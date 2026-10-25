import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CartItem, CartService } from '../../../core/services/cart.service';
import { CheckoutFlowService, CheckoutItemResult } from '../../../core/services/checkout-flow.service';
import { FlittCheckoutService } from '../../../core/services/flitt-checkout.service';
import { CustomerStateService } from '../../../core/state/customer-state.service';
import { ToastService } from '../../../core/services/toast.service';
import { PaymentMethodApiService } from '../../../core/api/payment-method-api.service';
import { CustomerPaymentMethod } from '../../../shared/models/payment-method.model';
import { ServiceTokenDto } from '../../../shared/models/service-token.model';

type ViewState = 'loading' | 'empty' | 'summary' | 'paying' | 'pending' | 'done';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {
  state: ViewState = 'loading';

  payableItems: CartItem[] = [];
  secondaryItems: CartItem[] = [];

  results: CheckoutItemResult[] = [];

  /** Buyer opt-in: save the card token for faster future checkout. */
  saveCard = true;

  /** The customer's currently saved card (if any), shown on the summary. */
  savedMethod: CustomerPaymentMethod | null = null;

  private readonly CONTAINER = '#flitt-checkout';

  constructor(
    public cartService: CartService,
    private checkoutFlow: CheckoutFlowService,
    private flitt: FlittCheckoutService,
    private customerState: CustomerStateService,
    private toast: ToastService,
    private paymentMethods: PaymentMethodApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const customer = this.customerState.customer;
    if (!customer) { this.router.navigate(['/login']); return; }

    this.cartService.load(customer.publicKey).subscribe({
      next: () => this.afterCartLoaded(),
      error: () => {
        this.afterCartLoaded();           // fall back to whatever is already in memory
        this.toast.error('Could not refresh your cart.');
      }
    });
  }

  private afterCartLoaded(): void {
    this.refreshItems();
    this.loadSavedMethod();

    // Resume an in-flight order (e.g. after an external 3-D Secure redirect).
    if (this.checkoutFlow.hasPendingOrder()) {
      this.processOrder();
      return;
    }

    this.state = this.payableItems.length === 0 ? 'empty' : 'summary';
  }

  /** Loads the customer's saved card (masked) for display on the summary. Best-effort. */
  private loadSavedMethod(): void {
    const customer = this.customerState.customer;
    if (!customer) return;
    this.paymentMethods.get(customer.id).subscribe({
      next: m => {
        this.savedMethod = m?.hasSavedCard ? m : null;
        this.cdr.detectChanges();
      },
      error: () => { /* non-fatal: just don't show a saved card */ }
    });
  }

  /** Removes the saved card token for this customer. */
  removeSavedCard(): void {
    const customer = this.customerState.customer;
    if (!customer) return;
    this.paymentMethods.remove(customer.id).subscribe({
      next: () => {
        this.savedMethod = null;
        this.toast.success('Saved card removed.');
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('Could not remove the saved card.')
    });
  }

  private refreshItems(): void {
    const items = this.cartService.items;
    this.payableItems = items.filter(i => i.market === 'primaryMarket');
    this.secondaryItems = items.filter(i => i.market !== 'primaryMarket');
  }

  get total(): number {
    return this.payableItems.reduce((sum, i) => sum + (i.token.price ?? 0), 0);
  }

  get currency(): string {
    // All tokens are priced in GEL on this platform.
    return 'GEL';
  }

  /** How many tokens the single payment covers (used in the 'paying' view). */
  get payingCount(): number {
    return this.checkoutFlow.itemCount;
  }

  get payingTotal(): number {
    return this.checkoutFlow.total;
  }

  pay(): void {
    const customer = this.customerState.customer;
    if (!customer) { this.router.navigate(['/login']); return; }

    const started = this.checkoutFlow.begin(this.cartService.items, customer.publicKey, this.saveCard);
    if (!started) {
      this.toast.warning('There are no payable items in your cart.');
      return;
    }
    this.processOrder();
  }

  /** Pays for the whole cart with a single embedded Flitt widget / one charge. */
  private async processOrder(): Promise<void> {
    this.state = 'paying';

    // Create the single order if we don't already have one (fresh checkout, not a resume).
    if (!this.checkoutFlow.hasPendingOrder()) {
      try {
        await firstValueFrom(this.checkoutFlow.initiate());
      } catch (err: any) {
        this.toast.error(this.errorText(err, 'Could not start the payment.'));
        this.checkoutFlow.clear();
        this.refreshItems();
        this.state = this.payableItems.length === 0 ? 'empty' : 'summary';
        return;
      }
    }

    const token = this.checkoutFlow.currentToken;
    if (token) {
      await this.renderWidget(token);
    }

    try {
      await firstValueFrom(this.checkoutFlow.resolve());
    } catch {
      // Timed out waiting for a terminal status — keep the session so the buyer can retry.
      this.state = 'pending';
      return;
    }

    this.finish();
  }

  /** Ensures the container is in the DOM, then mounts the Flitt widget into it. */
  private async renderWidget(token: string): Promise<void> {
    this.cdr.detectChanges();              // make sure #flitt-checkout is rendered
    await this.tick();
    try {
      await this.flitt.render(this.CONTAINER, token);
    } catch (err: any) {
      this.toast.error(this.errorText(err, 'Could not load the payment form.'));
    }
  }

  /** Continue polling / retry after a "pending" timeout. */
  retry(): void {
    this.processOrder();
  }

  private finish(): void {
    this.results = this.checkoutFlow.results();
    this.checkoutFlow.clear();
    this.state = 'done';
  }

  get successCount(): number {
    return this.results.filter(r => r.outcome === 'success').length;
  }

  get failedCount(): number {
    return this.results.filter(r => r.outcome !== 'success').length;
  }

  goToCart(): void { this.router.navigate(['/cart']); }
  goToMarketplace(): void { this.router.navigate(['/marketplace']); }

  pictogramSrc(token: ServiceTokenDto): string | null {
    if (!token.pictogram) return null;
    return `data:image/png;base64,${token.pictogram}`;
  }

  private tick(): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  private errorText(err: any, fallback: string): string {
    const detail = typeof err?.error === 'string' ? err.error : (err?.error?.message ?? err?.message);
    return detail ? `${fallback} ${detail}` : fallback;
  }
}
