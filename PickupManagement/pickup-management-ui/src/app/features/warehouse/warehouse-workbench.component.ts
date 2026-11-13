import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { RealtimeService } from '../../core/services/realtime.service';
import { TicketService } from '../../core/services/ticket.service';
import { WarehouseService } from '../../core/services/warehouse.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { APP_ROLES } from '../../core/models/auth.models';
import {
  CollectionResult,
  OrderPreparationResult
} from '../../core/models/credit-warehouse.models';
import {
  PickupTicketStatus,
  TicketDetail,
  TicketQueueItem
} from '../../core/models/ticket.models';

@Component({
  selector: 'app-warehouse-workbench',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    TagModule,
    DialogModule,
    ProgressBarModule,
    TranslatePipe
  ],
  templateUrl: './warehouse-workbench.component.html'
})
export class WarehouseWorkbenchComponent implements OnInit, OnDestroy {
  private readonly ticketService = inject(TicketService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);

  protected readonly Math = Math;
  private queueSub?: Subscription;

  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly tickets = signal<TicketQueueItem[]>([]);
  readonly selectedTicket = signal<TicketDetail | null>(null);
  dialogVisible = false;

  ngOnInit(): void {
    this.loadTickets();
    void this.realtimeService.connectOperations();
    this.queueSub = this.realtimeService.queueUpdated$.subscribe(() => {
      this.loadTickets();
      const openId = this.selectedTicket()?.ticketId;
      if (openId && this.dialogVisible) {
        this.refreshOpenTicket(openId);
      }
    });
  }

  ngOnDestroy(): void {
    this.queueSub?.unsubscribe();
  }

  isSupervisor(): boolean {
    return this.authService.hasAnyRole([APP_ROLES.Supervisor, APP_ROLES.Administrator]);
  }

  loadTickets(): void {
    this.loading.set(true);
    this.ticketService.getQueue(this.todayString()).subscribe({
      next: (items: TicketQueueItem[]) => {
        this.tickets.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  openTicket(ticketId: string): void {
    this.refreshOpenTicket(ticketId);
    this.dialogVisible = true;
  }

  startPreparation(ticketId: string, orderId: string): void {
    this.busy.set(true);
    this.warehouseService.startPreparation(ticketId, orderId).subscribe({
      next: (res: OrderPreparationResult) => {
        this.busy.set(false);
        this.messageService.add({
          severity: 'info',
          summary: 'Preparation Started',
          detail: `${res.salesId} is now in preparation.`
        });
        this.refreshOpenTicket(ticketId);
        this.loadTickets();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.showError(err, 'Could not start preparation.');
      }
    });
  }

  markReady(ticketId: string, orderId: string): void {
    this.busy.set(true);
    this.warehouseService.markOrderReady(ticketId, orderId).subscribe({
      next: (res: OrderPreparationResult) => {
        this.busy.set(false);
        this.messageService.add({
          severity: 'success',
          summary: res.ticketReadyForCollection ? 'Ticket READY' : 'Order Ready',
          detail: res.ticketReadyForCollection
            ? `Ticket ${res.ticketNumber} is now READY for pickup.`
            : `${res.salesId} marked ready.`
        });
        this.refreshOpenTicket(ticketId);
        this.loadTickets();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.showError(err, 'Could not mark order ready.');
      }
    });
  }

  removeBlocked(ticketId: string, orderId: string): void {
    this.busy.set(true);
    this.warehouseService
      .removeBlockedOrder(ticketId, orderId, 'Removed by supervisor per partial-order policy')
      .subscribe({
        next: (res: OrderPreparationResult) => {
          this.busy.set(false);
          this.messageService.add({
            severity: 'warn',
            summary: 'Blocked Order Removed',
            detail: `${res.salesId} removed from ticket ${res.ticketNumber}.`
          });
          this.refreshOpenTicket(ticketId);
          this.loadTickets();
        },
        error: (err: HttpErrorResponse) => {
          this.busy.set(false);
          this.showError(err, 'Could not remove blocked order.');
        }
      });
  }

  confirmCollection(ticketId: string): void {
    this.busy.set(true);
    this.warehouseService.confirmCollection(ticketId).subscribe({
      next: (res: CollectionResult) => {
        this.busy.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Collected',
          detail: `Ticket ${res.ticketNumber} collection confirmed.`
        });
        this.dialogVisible = false;
        this.loadTickets();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.showError(err, 'Could not confirm collection.');
      }
    });
  }

  private refreshOpenTicket(ticketId: string): void {
    this.ticketService.getTicketDetail(ticketId).subscribe({
      next: (detail: TicketDetail) => this.selectedTicket.set(detail)
    });
  }

  private showError(err: HttpErrorResponse, fallback: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Operation Failed',
      detail: (err.error as { detail?: string } | undefined)?.detail ?? fallback
    });
  }

  ticketSeverity(status: PickupTicketStatus): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
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

  orderSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    switch (status) {
      case 'RELEASED':
      case 'READY':
      case 'COLLECTED':
        return 'success';
      case 'IN_PREPARATION':
      case 'RELEASE_PENDING':
      case 'RECONCILING':
        return 'warning';
      case 'BLOCKED':
      case 'CANCELLED':
        return 'danger';
      default:
        return 'info';
    }
  }

  private todayString(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
