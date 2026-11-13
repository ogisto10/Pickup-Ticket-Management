import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { PickupTicketStatus } from '../../core/models/ticket.models';

interface TicketHistorySummary {
  ticketId: string;
  ticketDate: string;
  ticketNumber: string;
  queueNumber: number;
  customerAccount: string;
  customerName: string;
  warehouseId: string;
  status: PickupTicketStatus;
  arrivalTime: string;
  readyAt?: string | null;
  collectedAt?: string | null;
  creditDecisionBy?: string | null;
  creditComment?: string | null;
  orderCount: number;
}

interface WorkflowEvent {
  oldStatus?: string | null;
  newStatus: string;
  action: string;
  comment?: string | null;
  userId: string;
  occurredAt: string;
  correlationId: string;
  salesId?: string | null;
}

interface TicketAuditDetail {
  ticketId: string;
  ticketNumber: string;
  ticketDate: string;
  customerAccount: string;
  customerName: string;
  status: PickupTicketStatus;
  ticketEvents: WorkflowEvent[];
  orderEvents: WorkflowEvent[];
}

@Component({
  selector: 'app-history-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    CalendarModule,
    InputTextModule,
    TagModule,
    DialogModule
  ],
  template: `
    <div class="flex flex-column gap-4">
      <div>
        <h2 class="m-0 text-2xl font-bold text-900">Pickup History & Audit Trail</h2>
        <p class="m-0 text-600 text-sm">
          Search historical tickets and inspect immutable ticket and order workflow transitions.
        </p>
      </div>

      <p-card>
        <div class="flex flex-wrap gap-3 align-items-end mb-4">
          <div class="flex flex-column gap-2">
            <label class="font-semibold text-sm text-700">From Date</label>
            <p-calendar [(ngModel)]="dateFrom" dateFormat="yy-mm-dd" [showIcon]="true"></p-calendar>
          </div>
          <div class="flex flex-column gap-2">
            <label class="font-semibold text-sm text-700">To Date</label>
            <p-calendar [(ngModel)]="dateTo" dateFormat="yy-mm-dd" [showIcon]="true"></p-calendar>
          </div>
          <div class="flex flex-column gap-2 flex-1" style="min-width: 240px;">
            <label class="font-semibold text-sm text-700">Search (Ticket, Customer, SO)</label>
            <input
              type="text"
              pInputText
              [(ngModel)]="search"
              placeholder="e.g. A-001, 411-021, SO-001258"
              class="w-full"
            />
          </div>
          <p-button
            label="Search"
            icon="pi pi-search"
            [loading]="loading()"
            (onClick)="searchHistory()"
          ></p-button>
        </div>

        <p-table
          [value]="items()"
          [loading]="loading()"
          [paginator]="true"
          [rows]="12"
          styleClass="p-datatable-sm p-datatable-striped"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Date</th>
              <th>Ticket</th>
              <th>Customer</th>
              <th>Orders</th>
              <th>Status</th>
              <th>Arrival</th>
              <th>Collected</th>
              <th style="width: 8rem">Audit</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-item>
            <tr>
              <td>{{ item.ticketDate }}</td>
              <td class="font-bold text-primary">{{ item.ticketNumber }}</td>
              <td>{{ item.customerAccount }} — {{ item.customerName }}</td>
              <td>{{ item.orderCount }}</td>
              <td><p-tag [value]="item.status" severity="info"></p-tag></td>
              <td>{{ item.arrivalTime | date: 'short' }}</td>
              <td>{{ item.collectedAt ? (item.collectedAt | date: 'short') : '—' }}</td>
              <td>
                <p-button
                  label="Trail"
                  icon="pi pi-list"
                  size="small"
                  [outlined]="true"
                  (onClick)="openAudit(item.ticketId)"
                ></p-button>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <p-dialog
        [header]="audit() ? 'Audit Trail — ' + audit()!.ticketNumber : 'Audit Trail'"
        [(visible)]="auditVisible"
        [modal]="true"
        [style]="{ width: '820px' }"
      >
        <div *ngIf="audit() as detail" class="flex flex-column gap-4">
          <h3 class="m-0 text-base font-semibold">Ticket Workflow Events</h3>
          <p-table [value]="detail.ticketEvents" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>Time (UTC)</th>
                <th>Action</th>
                <th>Transition</th>
                <th>Actor</th>
                <th>Comment</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-ev>
              <tr>
                <td>{{ ev.occurredAt | date: 'medium' }}</td>
                <td class="font-semibold">{{ ev.action }}</td>
                <td>{{ ev.oldStatus || 'NEW' }} → {{ ev.newStatus }}</td>
                <td>{{ ev.userId }}</td>
                <td>{{ ev.comment || '—' }}</td>
              </tr>
            </ng-template>
          </p-table>

          <h3 class="m-0 text-base font-semibold">Order Workflow Events</h3>
          <p-table [value]="detail.orderEvents" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>Time (UTC)</th>
                <th>Sales Order</th>
                <th>Action</th>
                <th>Transition</th>
                <th>Actor</th>
                <th>Comment</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-ev>
              <tr>
                <td>{{ ev.occurredAt | date: 'medium' }}</td>
                <td class="font-semibold">{{ ev.salesId }}</td>
                <td>{{ ev.action }}</td>
                <td>{{ ev.oldStatus || 'NEW' }} → {{ ev.newStatus }}</td>
                <td>{{ ev.userId }}</td>
                <td>{{ ev.comment || '—' }}</td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      </p-dialog>
    </div>
  `
})
export class HistorySearchComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(false);
  readonly items = signal<TicketHistorySummary[]>([]);
  readonly audit = signal<TicketAuditDetail | null>(null);
  auditVisible = false;

  dateFrom: Date = new Date();
  dateTo: Date = new Date();
  search = '';

  ngOnInit(): void {
    this.searchHistory();
  }

  searchHistory(): void {
    this.loading.set(true);
    this.api
      .get<TicketHistorySummary[]>('/history', {
        dateFrom: this.formatDate(this.dateFrom),
        dateTo: this.formatDate(this.dateTo),
        search: this.search
      })
      .subscribe({
        next: (data: TicketHistorySummary[]) => {
          this.items.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }

  openAudit(ticketId: string): void {
    this.api.get<TicketAuditDetail>(`/history/${ticketId}/audit`).subscribe({
      next: (data: TicketAuditDetail) => {
        this.audit.set(data);
        this.auditVisible = true;
      }
    });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
