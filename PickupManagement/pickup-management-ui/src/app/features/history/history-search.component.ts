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
  templateUrl: './history-search.component.html'
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
