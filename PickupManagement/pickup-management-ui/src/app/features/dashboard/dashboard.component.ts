import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';

interface DashboardStats {
  date: string;
  plannedCount: number;
  awaitingCreditCount: number;
  onHoldOrRejectedCount: number;
  inPreparationCount: number;
  readyCount: number;
  collectedCount: number;
  absentCount: number;
  integrationAttentionCount: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, TagModule, ButtonModule],
  template: `
    <div class="flex flex-column gap-4">
      <div class="flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 class="m-0 text-2xl font-bold text-900">Operational Dashboard</h2>
          <p class="m-0 text-600 text-sm">
            Welcome, {{ user()?.fullName }}. Live pickup summary for {{ stats()?.date || 'today' }}.
          </p>
        </div>
        <div class="flex align-items-center gap-2">
          <p-tag
            *ngIf="(stats()?.integrationAttentionCount ?? 0) > 0"
            [value]="stats()!.integrationAttentionCount + ' AX reconciliation alert(s)'"
            severity="danger"
          ></p-tag>
          <p-button
            label="Refresh"
            icon="pi pi-refresh"
            size="small"
            severity="secondary"
            [outlined]="true"
            (onClick)="loadStats()"
          ></p-button>
        </div>
      </div>

      <div class="grid" *ngIf="stats() as s">
        <div class="col-12 md:col-6 lg:col-3">
          <p-card header="Planned Today">
            <div class="text-4xl font-bold text-primary">{{ s.plannedCount }}</div>
            <div class="text-xs text-500 mt-1">Awaiting arrival at reception</div>
          </p-card>
        </div>
        <div class="col-12 md:col-6 lg:col-3">
          <p-card header="Awaiting Credit">
            <div class="text-4xl font-bold text-orange-500">{{ s.awaitingCreditCount }}</div>
            <div class="text-xs text-500 mt-1">On hold / rejected: {{ s.onHoldOrRejectedCount }}</div>
          </p-card>
        </div>
        <div class="col-12 md:col-6 lg:col-3">
          <p-card header="In Preparation">
            <div class="text-4xl font-bold text-blue-500">{{ s.inPreparationCount }}</div>
            <div class="text-xs text-500 mt-1">Active warehouse preparation</div>
          </p-card>
        </div>
        <div class="col-12 md:col-6 lg:col-3">
          <p-card header="Ready / Collected">
            <div class="text-4xl font-bold text-green-600">
              {{ s.readyCount }} / {{ s.collectedCount }}
            </div>
            <div class="text-xs text-500 mt-1">Absent plans: {{ s.absentCount }}</div>
          </p-card>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  readonly user = inject(AuthService).user;

  private queueSub?: Subscription;
  readonly stats = signal<DashboardStats | null>(null);

  ngOnInit(): void {
    this.loadStats();
    void this.realtime.connectOperations();
    this.queueSub = this.realtime.queueUpdated$.subscribe(() => this.loadStats());
  }

  ngOnDestroy(): void {
    this.queueSub?.unsubscribe();
  }

  loadStats(): void {
    this.api.get<DashboardStats>('/dashboard/stats').subscribe({
      next: (data: DashboardStats) => this.stats.set(data)
    });
  }
}
