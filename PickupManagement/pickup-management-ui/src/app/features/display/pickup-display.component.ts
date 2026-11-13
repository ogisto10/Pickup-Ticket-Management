import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { APP_ROLES } from '../../core/models/auth.models';
import { LanguageSwitcherComponent } from '../../core/i18n/language-switcher.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface PublicDisplayTicket {
  ticketNumber: string;
  readyAt?: string | null;
}

interface PublicDisplayState {
  businessDate: string;
  nowServingTicketNumber?: string | null;
  readyTickets: PublicDisplayTicket[];
  inPreparationCount: number;
  generatedAtUtc: string;
}

@Component({
  selector: 'app-pickup-display',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, TagModule, LanguageSwitcherComponent, TranslatePipe],
  templateUrl: './pickup-display.component.html'
})
export class PickupDisplayComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);

  private displaySub?: Subscription;
  private pollSub?: Subscription;

  readonly state = signal<PublicDisplayState | null>(null);

  canReturnToConsole(): boolean {
    return this.auth.hasAnyRole([
      APP_ROLES.Reception,
      APP_ROLES.Supervisor,
      APP_ROLES.Administrator
    ]);
  }

  signOut(): void {
    this.auth.logout();
  }

  ngOnInit(): void {
    this.refreshState();
    void this.realtime.connectPublicDisplay();
    this.displaySub = this.realtime.displayChanged$.subscribe(() => {
      this.refreshState();
    });
    // Fallback recovery poll in case network drops temporarily.
    this.pollSub = interval(30000).subscribe(() => this.refreshState());
  }

  ngOnDestroy(): void {
    this.displaySub?.unsubscribe();
    this.pollSub?.unsubscribe();
  }

  refreshState(): void {
    this.api.get<PublicDisplayState>('/display/state').subscribe({
      next: (data: PublicDisplayState) => this.state.set(data)
    });
  }
}
