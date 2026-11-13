import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { RealtimeService } from '../../core/services/realtime.service';

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
  imports: [CommonModule, TagModule],
  templateUrl: './pickup-display.component.html'
})
export class PickupDisplayComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);

  private displaySub?: Subscription;
  private pollSub?: Subscription;

  readonly state = signal<PublicDisplayState | null>(null);

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
