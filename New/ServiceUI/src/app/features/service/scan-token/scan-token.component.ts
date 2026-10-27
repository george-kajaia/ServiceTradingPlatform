import {
  Component, OnInit, OnDestroy, AfterViewInit,
  Output, EventEmitter, ViewChild, ElementRef, ChangeDetectorRef, HostListener, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { ServiceTokenApiService } from '../../../core/api/service-token-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServiceTokenDto, ServiceTokenStatus, OwnerType } from '../../../shared/models/service-token.model';
import { ScheduleType } from '../../../shared/models/product.model';

interface QrPayload {
  tokenId: string;
  rowVersion: number;
  connectionId: string;
}

type ScanState = 'scanning' | 'loading' | 'confirm' | 'submitting' | 'error';

@Component({
  selector: 'app-scan-token',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scan-token.component.html',
  styleUrls: ['./scan-token.component.scss']
})
export class ScanTokenComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();
  @ViewChild('videoEl', { static: false }) videoEl!: ElementRef<HTMLVideoElement>;

  state: ScanState = 'scanning';
  errorMessage = '';

  token: ServiceTokenDto | null = null;
  payload: QrPayload | null = null;

  private reader = new BrowserMultiFormatReader();
  private controls: IScannerControls | null = null;

  private serviceTokenApi = inject(ServiceTokenApiService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {}

  async ngAfterViewInit(): Promise<void> {
    await this.startScanner();
  }

  async ngOnDestroy(): Promise<void> {
    await this.stopScanner();
  }

  private async startScanner(): Promise<void> {
    try {
      this.controls = await this.reader.decodeFromVideoDevice(
        undefined,
        this.videoEl.nativeElement,
        (result, err) => {
          if (result) {
            this.onQrDetected(result.getText());
          }
        }
      );
    } catch {
      this.state = 'error';
      this.errorMessage = 'Camera access denied. Please allow camera permissions and try again.';
    }
  }

  private async stopScanner(): Promise<void> {
    if (this.controls) {
      this.controls.stop();
      this.controls = null;
    }
  }

  private async onQrDetected(text: string): Promise<void> {
    // Stop scanning immediately after first successful read
    await this.stopScanner();

    try {
      this.payload = JSON.parse(text) as QrPayload;
    } catch {
      this.state = 'error';
      this.errorMessage = 'Invalid QR code. Please ask the customer to regenerate it.';
      return;
    }

    if (!this.payload.tokenId || this.payload.rowVersion === undefined || !this.payload.connectionId) {
      this.state = 'error';
      this.errorMessage = 'QR code is missing required data.';
      return;
    }

    // Fetch full token details to show in confirmation modal
    this.state = 'loading';
    this.serviceTokenApi.getService(
      this.payload.tokenId,
      this.payload.rowVersion,
      this.payload.connectionId
    ).subscribe({
      next: () => {
        this.toast.success('Service confirmed and customer notified.');
        this.closed.emit();
      },
      error: err => {
        // Even on error the API notifies customer via SignalR
        this.toast.error(err.error?.message ?? err.error ?? 'Service request failed.');
        this.closed.emit();
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  cancel(): void {
    this.closed.emit();
  }

  async rescan(): Promise<void> {
    this.state = 'scanning';
    this.token = null;
    this.payload = null;
    this.errorMessage = '';
    this.cdr.detectChanges();
    await this.startScanner();
  }

  // ── Display helpers ────────────────────────────────────────
  statusLabel(status: number): string {
    switch (status) {
      case ServiceTokenStatus.Available: return 'Available';
      case ServiceTokenStatus.Sold:      return 'Sold';
      case ServiceTokenStatus.Finished:  return 'Finished';
      default: return `Status ${status}`;
    }
  }

  ownerTypeLabel(ownerType: number): string {
    return ownerType === OwnerType.Customer ? 'Customer' : 'Company';
  }

  scheduleLabel(st: ScheduleType): string {
    if (!st) return '—';
    const labels: Record<number, string> = { 0: 'None', 1: 'Daily', 2: 'Weekly', 3: 'Monthly', 4: 'Yearly' };
    const base = labels[st.periodType] ?? `Period ${st.periodType}`;
    return st.periodNumber ? `${base} / ${st.periodNumber}` : base;
  }
}
