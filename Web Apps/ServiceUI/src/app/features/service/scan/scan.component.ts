import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CompanyStateService } from '../../../core/state/company-state.service';
import { Company } from '../../../shared/models/company.model';
import { ScanTokenComponent } from '../scan-token/scan-token.component';

@Component({
  selector: 'app-service-scan',
  standalone: true,
  imports: [CommonModule, RouterLink, ScanTokenComponent],
  templateUrl: './scan.component.html',
  styleUrls: ['./scan.component.scss']
})
export class ServiceScanComponent implements OnInit {
  company: Company | null = null;

  // Scan Token overlay
  showScanner = false;

  constructor(
    private router: Router,
    private companyState: CompanyStateService
  ) {}

  ngOnInit(): void {
    this.company = this.companyState.company;

    if (!this.company) {
      this.router.navigate(['/login']);
      return;
    }
  }

  logout(): void {
    this.companyState.company = null;
    this.companyState.companyUser = null;
    this.router.navigate(['/login']);
  }
}
