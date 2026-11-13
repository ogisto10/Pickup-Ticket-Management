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
  template: `
    <div class="min-h-screen surface-900 text-0 p-5 flex flex-column gap-5">
      <header class="text-center border-bottom-1 surface-border pb-4">
        <h1 class="m-0 text-5xl font-bold tracking-wider">CLIENT PICKUP</h1>
        <p class="m-0 mt-2 text-2xl text-300">
          Please proceed to the collection counter when your number appears.
        </p>
      </header>

      <section class="grid">
        <div class="col-12 lg:col-5">
          <div class="surface-800 border-round-xl p-5 text-center h-full flex flex-column justify-content-center align-items-center gap-3">
            <div class="text-xl uppercase tracking-widest text-primary-300 font-semibold">
              NOW SERVING
            </div>
            <div class="text-8xl font-bold text-primary-300">
              {{ state()?.nowServingTicketNumber || '---' }}
            </div>
            <div class="text-lg text-300" *ngIf="state()?.nowServingTicketNumber">
              Please proceed to the pickup counter.
            </div>
            <div class="text-lg text-400" *ngIf="!state()?.nowServingTicketNumber">
              Waiting for next ready ticket
            </div>
          </div>
        </div>

        <div class="col-12 lg:col-7">
          <div class="surface-800 border-round-xl p-5 h-full flex flex-column gap-4">
            <div class="flex justify-content-between align-items-center">
              <h2 class="m-0 text-2xl uppercase tracking-wider text-green-400">
                ORDERS READY
              </h2>
              <p-tag
                [value]="(state()?.inPreparationCount ?? 0) + ' in preparation'"
                severity="info"
              ></p-tag>
            </div>

            <div class="grid" *ngIf="(state()?.readyTickets?.length ?? 0) > 0; else noReady">
              <div
                class="col-12 sm:col-6 md:col-4"
                *ngFor="let ticket of state()?.readyTickets"
              >
                <div class="surface-900 border-1 border-green-500 border-round-lg p-4 text-center">
                  <div class="text-4xl font-bold text-green-400">
                    {{ ticket.ticketNumber }}
                  </div>
                  <div class="text-sm text-300 mt-1">Ready for collection</div>
                </div>
              </div>
            </div>

            <ng-template #noReady>
              <div class="text-center py-6 text-400 text-xl">
                No tickets currently ready for collection.
              </div>
            </ng-template>
          </div>
        </div>
      </section>
    </div>
  `
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
