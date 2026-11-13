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
    TagModule
  ],
  template: `
    <div class="flex flex-column gap-4">
      <div class="flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <h2 class="m-0 text-2xl font-bold text-900">Live Ticket Queue</h2>
          <p class="m-0 text-600 text-sm">
            Tickets ordered by arrival sequence with live SignalR updates.
          </p>
        </div>

        <div class="flex align-items-center gap-2">
          <p-calendar
            [(ngModel)]="selectedDate"
            dateFormat="yy-mm-dd"
            [showIcon]="true"
            (onSelect)="loadQueue()"
          ></p-calendar>
          <p-button
            label="Refresh"
            icon="pi pi-refresh"
            severity="secondary"
            [outlined]="true"
            [loading]="loading()"
            (onClick)="loadQueue()"
          ></p-button>
        </div>
      </div>

      <p-card>
        <p-table
          [value]="queue()"
          [loading]="loading()"
          [paginator]="true"
          [rows]="15"
          styleClass="p-datatable-sm p-datatable-striped"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Queue #</th>
              <th>Ticket</th>
              <th>Customer Account</th>
              <th>Customer Name</th>
              <th>Arrival Time</th>
              <th>Orders Ready</th>
              <th>Status</th>
              <th>Comment</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-item>
            <tr>
              <td class="font-bold">#{{ item.queueNumber }}</td>
              <td class="font-bold text-primary text-lg">{{ item.ticketNumber }}</td>
              <td class="font-semibold">{{ item.customerAccount }}</td>
              <td>{{ item.customerName }}</td>
              <td>{{ item.arrivalTime | date: 'shortTime' }}</td>
              <td>{{ item.readyOrderCount }} / {{ item.orderCount }}</td>
              <td>
                <p-tag
                  [value]="item.status"
                  [severity]="statusSeverity(item.status)"
                ></p-tag>
              </td>
              <td>{{ item.creditComment || '—' }}</td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="8" class="text-center p-4 text-600">
                No tickets issued for {{ formatDate(selectedDate) }}.
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
    </div>
  `
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

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
