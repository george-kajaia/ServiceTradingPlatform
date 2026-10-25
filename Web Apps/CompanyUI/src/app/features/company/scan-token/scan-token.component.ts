import {
  Component, OnDestroy, AfterViewInit,
  Output, EventEmitter, ViewChild, ElementRef, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { ServiceTokenApiService } from '../../../core/api/service-token-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalDialogDirective } from '../../../shared/directives/modal-dialog.directive';

interface QrPayload {
  tokenId: string;
  rowVersion: number;
  connectionId: string;
}

// Actual flow: scanning -> submitting (automatic redemption POST in flight) -> closed.
// Camera denied / invalid QR / missing data land in 'error' and can be retried.
type ScanState = 'scanning' | 'submitting' | 'error';

const MAX_UINT = 4294967295;

function isQrPayload(value: unknown): value is QrPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['tokenId'] === 'string' && v['tokenId'].length > 0 &&
    typeof v['connectionId'] === 'string' && v['connectionId'].length > 0 &&
    typeof v['rowVersion'] === 'number' && Number.isInteger(v['rowVersion']) &&
    v['rowVersion'] >= 0 && v['rowVersion'] <= MAX_UINT
  );
}

@Component({
  selector: 'app-scan-token',
  standalone: true,
  imports: [CommonModule, ModalDialogDirective],
  templateUrl: './scan-token.component.html',
  styleUrls: ['./scan-token.component.scss']
})
export class ScanTokenComponent implements AfterViewInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();
  @ViewChild('videoEl', { static: false }) videoEl?: ElementRef<HTMLVideoElement>;

  state: ScanState = 'scanning';
  errorMessage = '';

  private reader = new BrowserMultiFormatReader();
  private controls: IScannerControls | null = null;
  private handling = false;
  private destroyed = false;

  private serviceTokenApi = inject(ServiceTokenApiService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  async ngAfterViewInit(): Promise<void> {
    await this.startScanner();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopScanner();
  }

  private async startScanner(): Promise<void> {
    const video = this.videoEl?.nativeElement;
    if (!video || this.destroyed) return;
    try {
      const controls = await this.reader.decodeFromVideoDevice(
        undefined,
        video,
        result => {
          if (result) {
            void this.onQrDetected(result.getText());
          }
        }
      );
      if (this.destroyed) {
        // Component was torn down while the camera was still starting.
        controls.stop();
        return;
      }
      this.controls = controls;
    } catch {
      if (this.destroyed) return;
      this.state = 'error';
      this.errorMessage = 'Camera access denied. Please allow camera permissions and try again.';
      this.cdr.detectChanges();
    }
  }

  private stopScanner(): void {
    if (this.controls) {
      this.controls.stop();
      this.controls = null;
    }
  }

  private async onQrDetected(text: string): Promise<void> {
    // Guard synchronously: the decoder can fire again before the stop below completes.
    if (this.handling) return;
    this.handling = true;
    this.stopScanner();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.fail('Invalid QR code. Please ask the customer to regenerate it.');
      return;
    }

    if (!isQrPayload(parsed)) {
      this.fail('QR code is missing required data.');
      return;
    }

    this.state = 'submitting';
    this.cdr.detectChanges();

    this.serviceTokenApi.getService(parsed.tokenId, parsed.rowVersion, parsed.connectionId).subscribe({
      next: () => {
        this.toast.success('Service confirmed and customer notified.');
        this.closed.emit();
      },
      error: (err: HttpErrorResponse) => {
        // Even on error the API notifies customer via SignalR
        const body: unknown = err.error;
        const message = typeof body === 'string'
          ? body
          : (body as { message?: unknown } | null)?.message;
        this.toast.error(typeof message === 'string' ? message : 'Service request failed.');
        this.closed.emit();
      }
    });
  }

  private fail(message: string): void {
    this.state = 'error';
    this.errorMessage = message;
    this.cdr.detectChanges();
  }

  /** Dismissal is ignored while the redemption request is in flight. */
  cancel(): void {
    if (this.state === 'submitting') return;
    this.closed.emit();
  }

  async rescan(): Promise<void> {
    if (this.state === 'submitting') return;
    this.handling = false;
    this.state = 'scanning';
    this.errorMessage = '';
    this.cdr.detectChanges();
    await this.startScanner();
  }
}
