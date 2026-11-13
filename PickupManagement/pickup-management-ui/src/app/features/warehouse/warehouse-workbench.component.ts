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
    ProgressBarModule
  ],
  template: `
    <div class="flex flex-column gap-4">
      <div class="flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <h2 class="m-0 text-2xl font-bold text-900">Warehouse Preparation Workbench</h2>
          <p class="m-0 text-600 text-sm">
            Prepare AX-released sales orders, mark readiness, and confirm client collection.
          </p>
        </div>

        <p-button
          label="Refresh"
          icon="pi pi-refresh"
          severity="secondary"
          [outlined]="true"
          [loading]="loading()"
          (onClick)="loadTickets()"
        ></p-button>
      </div>

      <p-card>
        <p-table
          [value]="tickets()"
          [loading]="loading()"
          [paginator]="true"
          [rows]="12"
          styleClass="p-datatable-sm p-datatable-striped"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Queue #</th>
              <th>Ticket</th>
              <th>Customer Account</th>
              <th>Customer Name</th>
              <th>Orders</th>
              <th style="width: 14rem">Preparation Progress</th>
              <th>Status</th>
              <th style="width: 12rem">Actions</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-item>
            <tr>
              <td class="font-bold">#{{ item.queueNumber }}</td>
              <td class="font-bold text-primary text-lg">{{ item.ticketNumber }}</td>
              <td class="font-semibold">{{ item.customerAccount }}</td>
              <td>{{ item.customerName }}</td>
              <td>{{ item.readyOrderCount }} / {{ item.orderCount }}</td>
              <td>
                <p-progressBar
                  [value]="item.orderCount ? Math.round((item.readyOrderCount / item.orderCount) * 100) : 0"
                  [showValue]="true"
                  [style]="{ height: '16px' }"
                ></p-progressBar>
              </td>
              <td>
                <p-tag
                  [value]="item.status"
                  [severity]="ticketSeverity(item.status)"
                ></p-tag>
              </td>
              <td>
                <p-button
                  label="Open Orders"
                  icon="pi pi-box"
                  size="small"
                  [outlined]="true"
                  (onClick)="openTicket(item.ticketId)"
                ></p-button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="8" class="text-center p-4 text-600">
                No tickets available for preparation today.
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <!-- Ticket Orders Preparation Dialog -->
      <p-dialog
        [header]="selectedTicket() ? 'Ticket ' + selectedTicket()!.ticketNumber + ' — Orders' : 'Ticket Orders'"
        [(visible)]="dialogVisible"
        [modal]="true"
        [style]="{ width: '780px' }"
      >
        <div *ngIf="selectedTicket() as ticket" class="flex flex-column gap-3">
          <div class="flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <strong>{{ ticket.customerAccount }}</strong> — {{ ticket.customerName }}
            </div>
            <p-tag
              [value]="ticket.status"
              [severity]="ticketSeverity(ticket.status)"
            ></p-tag>
          </div>

          <p-table [value]="ticket.orders" styleClass="p-datatable-sm p-datatable-striped">
            <ng-template pTemplate="header">
              <tr>
                <th>Sales Order</th>
                <th>Status</th>
                <th>Warehouse Status</th>
                <th>Actions</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-order>
              <tr>
                <td class="font-semibold">{{ order.salesId }}</td>
                <td>
                  <p-tag
                    [value]="order.status"
                    [severity]="orderSeverity(order.status)"
                  ></p-tag>
                </td>
                <td>{{ order.warehouseStatus }}</td>
                <td>
                  <div class="flex gap-2 flex-wrap">
                    <p-button
                      *ngIf="order.status === 'RELEASED'"
                      label="Start Preparation"
                      icon="pi pi-play"
                      size="small"
                      [loading]="busy()"
                      (onClick)="startPreparation(ticket.ticketId, order.id)"
                    ></p-button>
                    <p-button
                      *ngIf="order.status === 'RELEASED' || order.status === 'IN_PREPARATION'"
                      label="Mark Ready"
                      icon="pi pi-check"
                      severity="success"
                      size="small"
                      [loading]="busy()"
                      (onClick)="markReady(ticket.ticketId, order.id)"
                    ></p-button>
                    <p-button
                      *ngIf="order.status === 'BLOCKED' && isSupervisor()"
                      label="Remove Blocked"
                      icon="pi pi-trash"
                      severity="danger"
                      size="small"
                      [outlined]="true"
                      [loading]="busy()"
                      (onClick)="removeBlocked(ticket.ticketId, order.id)"
                    ></p-button>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>

        <ng-template pTemplate="footer">
          <p-button
            label="Close"
            severity="secondary"
            [outlined]="true"
            (onClick)="dialogVisible = false"
          ></p-button>
          <p-button
            *ngIf="selectedTicket()?.status === 'READY'"
            label="Confirm Collection"
            icon="pi pi-check-circle"
            severity="success"
            [loading]="busy()"
            (onClick)="confirmCollection(selectedTicket()!.ticketId)"
          ></p-button>
        </ng-template>
      </p-dialog>
    </div>
  `
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
