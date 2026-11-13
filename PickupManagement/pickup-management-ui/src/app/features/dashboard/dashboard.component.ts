import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

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
  imports: [CommonModule, CardModule, TagModule, ButtonModule, TranslatePipe],
  templateUrl: './dashboard.component.html'
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
