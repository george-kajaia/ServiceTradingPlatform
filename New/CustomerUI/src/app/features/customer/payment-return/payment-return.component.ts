import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CheckoutFlowService, CheckoutItemResult } from '../../../core/services/checkout-flow.service';

type ViewState = 'verifying' | 'done' | 'pending';

/**
 * Landing page for the case where the embedded Flitt checkout performs a full-page redirect
 * (e.g. an external 3-D Secure step). Flitt redirects (POST) to the backend api/Payment/Return,
 * which bounces the browser here as a GET.
 *
 * The inline checkout page clears its session as soon as it has shown its own "payment complete"
 * summary. So if we arrive here with NO active session, the payment was already confirmed inline
 * and showing a summary again would just duplicate it — we go straight to the marketplace. We
 * only confirm and render a summary when a session is still active, i.e. the inline page never
 * got to finish (the genuine full-page-redirect case), so this is the single confirmation.
 */
@Component({
  selector: 'app-payment-return',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-return.component.html',
  styleUrls: ['./payment-return.component.scss']
})
export class PaymentReturnComponent implements OnInit {
  state: ViewState = 'verifying';
  results: CheckoutItemResult[] = [];

  constructor(
    private checkoutFlow: CheckoutFlowService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const session = this.checkoutFlow.getSession();
    if (session && session.currentOrderId) {
      this.verify();
    } else {
      // Already confirmed inline — skip the duplicate summary.
      this.router.navigate(['/marketplace']);
    }
  }

  /** Polls the order to a terminal state, then shows the summary. */
  verify(): void {
    this.state = 'verifying';
    this.checkoutFlow.resolve().subscribe({
      next: () => this.finish(),
      error: () => {
        // Timed out / couldn't confirm. Leave the session intact so the user can retry.
        this.state = 'pending';
      }
    });
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

  goToMarketplace(): void { this.router.navigate(['/marketplace']); }
  goToCart(): void { this.router.navigate(['/cart']); }
}
