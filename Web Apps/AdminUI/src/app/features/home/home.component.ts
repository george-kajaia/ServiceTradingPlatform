import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

const PWA_DISMISS_KEY = 'pwa-install-dismissed-at';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  showInstallBanner = false;
  private deferredPrompt: any = null;
  private beforeInstallHandler = (e: Event) => {
    e.preventDefault();
    this.deferredPrompt = e;
    if (!this.wasDismissedToday()) {
      this.showInstallBanner = true;
    }
  };

  ngOnInit(): void {
    window.addEventListener('beforeinstallprompt', this.beforeInstallHandler);

    window.addEventListener('appinstalled', () => {
      this.showInstallBanner = false;
      this.deferredPrompt = null;
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeinstallprompt', this.beforeInstallHandler);
  }

  async installApp(): Promise<void> {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      this.showInstallBanner = false;
    }
    this.deferredPrompt = null;
  }

  dismissBanner(): void {
    this.showInstallBanner = false;
    localStorage.setItem(PWA_DISMISS_KEY, new Date().toDateString());
  }

  private wasDismissedToday(): boolean {
    const dismissed = localStorage.getItem(PWA_DISMISS_KEY);
    return dismissed === new Date().toDateString();
  }
}
