import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { RealtimeService } from '../../core/services/realtime.service';
import { TicketService } from '../../core/services/ticket.service';
import { PickupTicketStatus, TicketQueueItem } from '../../core/models/ticket.models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-reception-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    CalendarModule,
    TagModule,
    TranslatePipe
  ],
  templateUrl: './reception-queue.component.html'
})
export class ReceptionQueueComponent implements OnInit, OnDestroy {
  private readonly ticketService = inject(TicketService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly messageService = inject(MessageService);

  private queueSub?: Subscription;

  readonly loading = signal(false);
  readonly queue = signal<TicketQueueItem[]>([]);
  selectedDate: Date = new Date();

  ngOnInit(): void {
    this.loadQueue();
    void this.realtimeService.connectOperations();
    this.queueSub = this.realtimeService.queueUpdated$.subscribe(() => {
      this.loadQueue();
    });
  }

  ngOnDestroy(): void {
    this.queueSub?.unsubscribe();
  }

  loadQueue(): void {
    this.loading.set(true);
    this.ticketService.getQueue(this.formatDate(this.selectedDate)).subscribe({
      next: (items: TicketQueueItem[]) => {
        this.queue.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Queue Error',
          detail: 'Could not load ticket queue.'
        });
      }
    });
  }

  statusSeverity(status: PickupTicketStatus): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    switch (status) {
      case 'ARRIVED':
        return 'info';
      case 'APPROVED':
      case 'IN_PREPARATION':
        return 'warning';
      case 'READY':
      case 'COLLECTED':
        return 'success';
      case 'ON_HOLD':
      case 'REJECTED':
      case 'CANCELLED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
