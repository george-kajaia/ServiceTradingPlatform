import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

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
    { q: 'What are service tokens?', a: 'Service tokens are digital vouchers issued by a company that customers can purchase, redeem for a specific service, or resell to others. They are entirely digital and require no physical logistics.', open: false },
    { q: 'How does redeeming a token work?', a: 'When a customer wants to use a service, they present a QR code for their token. A staff member signs in here and scans it to confirm the service and notify the customer instantly.', open: false },
    { q: 'Can customers resell the tokens they purchase?', a: 'Yes. Customers have full flexibility to either redeem their tokens for the service or resell them to other buyers on the platform.', open: false },
    { q: 'Is the data secure on this platform?', a: 'All data is encrypted in transit and at rest. We never share information with third parties, and our infrastructure meets GDPR compliance requirements.', open: false },
    { q: 'What types of services are supported?', a: 'Service Tokens is cross-industry. Any service business — from fitness studios to consulting firms — can issue and redeem tokens.', open: false },
  ];

  year = new Date().getFullYear();

  ngOnInit(): void {}

  toggleFaq(item: FaqItem): void { item.open = !item.open; }
}
