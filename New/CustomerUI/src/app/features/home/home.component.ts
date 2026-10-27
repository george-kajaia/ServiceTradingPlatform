import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ServiceTokenApiService } from '../../core/api/service-token-api.service';
import { CustomerStateService } from '../../core/state/customer-state.service';
import { ServiceTokenDto } from '../../shared/models/service-token.model';
import { environment } from '../../../environments/environment';

interface FaqItem { q: string; a: string; open: boolean; }

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  faqs: FaqItem[] = [
    { q: 'What are service tokens?', a: 'Service tokens are digital vouchers issued by companies that you can purchase, redeem for a specific service, or resell to others on the platform.', open: false },
    { q: 'How do I buy service tokens?', a: 'Register as a customer on this page, browse available tokens in the marketplace, and purchase directly from the issuing company.', open: false },
    { q: 'Can I resell tokens I have purchased?', a: 'Yes. You have full flexibility to either redeem your tokens for the service or resell them to other buyers on the platform at any time.', open: false },
    { q: 'Is my data secure on this platform?', a: 'All data is encrypted in transit and at rest. We never share your information with third parties, and our infrastructure meets GDPR compliance requirements.', open: false },
    { q: 'What types of services can I buy tokens for?', a: 'Service Tokens is cross-industry. You will find tokens from service businesses across many sectors — from fitness to consulting.', open: false },
    { q: 'How do I redeem a token for service?', a: 'Once you hold a token, you can redeem it directly through your customer dashboard. The issuing company will then fulfil the service.', open: false },
  ];

  year = new Date().getFullYear();
  featuredTokens: ServiceTokenDto[] = [];
  featuredLoading = true;

  constructor(
    private serviceTokenApi: ServiceTokenApiService,
    private customerState: CustomerStateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.serviceTokenApi.getPrimaryMarketServiceTokens(-1, -1).subscribe({
      next: list => {
        this.featuredTokens = (list ?? []).slice(0, environment.homeFeaturedLimit);
        this.featuredLoading = false;
      },
      error: () => { this.featuredLoading = false; }
    });
  }

  toggleFaq(item: FaqItem): void { item.open = !item.open; }

  onFeaturedCardClick(token: ServiceTokenDto): void {
    this.customerState.pendingTokenId = token.id;
    this.router.navigate(['/login']);
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
}
