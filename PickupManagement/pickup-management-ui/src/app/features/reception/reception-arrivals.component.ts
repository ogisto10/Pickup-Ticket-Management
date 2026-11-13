import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { PlanningService } from '../../core/services/planning.service';
import { TicketService } from '../../core/services/ticket.service';
import {
  AxCustomer,
  CustomerOrderLookup,
  CustomerOrdersResponse,
  PickupPlanListItem,
  PickupPlanStatus
} from '../../core/models/planning.models';
import { ArrivalTicketResponse } from '../../core/models/ticket.models';

@Component({
  selector: 'app-reception-arrivals',
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
    DialogModule,
    AutoCompleteModule,
    CheckboxModule
  ],
  templateUrl: './reception-arrivals.component.html'
})
export class ReceptionArrivalsComponent implements OnInit {
  private readonly planningService = inject(PlanningService);
  private readonly ticketService = inject(TicketService);
  private readonly apiService = inject(ApiService);
  private readonly messageService = inject(MessageService);

  // Retain one Idempotency-Key per plan arrival attempt so retries return the same ticket.
  private readonly arrivalKeys = new Map<string, string>();

  readonly loading = signal(false);
  readonly plans = signal<PickupPlanListItem[]>([]);
  readonly issuingPlanId = signal<string | null>(null);
  readonly issuedTicket = signal<ArrivalTicketResponse | null>(null);
  ticketDialogVisible = false;

  selectedDate: Date = new Date();
  searchText = '';

  // Walk-in dialog state
  walkInDialogVisible = false;
  walkInCustomer: AxCustomer | null = null;
  readonly walkInCustomerSuggestions = signal<AxCustomer[]>([]);
  readonly walkInOrders = signal<CustomerOrderLookup[]>([]);
  readonly walkInSelectedOrders = signal<Set<string>>(new Set());
  readonly loadingWalkInOrders = signal(false);
  readonly issuingWalkIn = signal(false);

  readonly filteredPlans = computed(() => {
    const term = this.searchText.trim().toLowerCase();
    const list = this.plans();
    if (!term) {
      return list;
    }
    return list.filter(
      (p) =>
        p.customerAccount.toLowerCase().includes(term) ||
        p.customerNameSnapshot.toLowerCase().includes(term)
    );
  });

  ngOnInit(): void {
    this.loadPlans();
  }

  selectDateOffset(days: number): void {
    const d = new Date();
    d.setDate(d.getDate() + days);
    this.selectedDate = d;
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.planningService.listPlansByDate(this.formatDate(this.selectedDate)).subscribe({
      next: (data: PickupPlanListItem[]) => {
        this.plans.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Load Failed',
          detail: 'Could not load planned arrivals.'
        });
      }
    });
  }

  confirmArrival(plan: PickupPlanListItem): void {
    const existingKey = this.arrivalKeys.get(plan.id) ?? this.apiService.newIdempotencyKey();
    this.arrivalKeys.set(plan.id, existingKey);

    this.issuingPlanId.set(plan.id);
    this.ticketService.confirmArrival(plan.id, existingKey).subscribe({
      next: (ticket: ArrivalTicketResponse) => {
        this.issuingPlanId.set(null);
        this.issuedTicket.set(ticket);
        this.ticketDialogVisible = true;
        this.loadPlans();
      },
      error: (err: HttpErrorResponse) => {
        this.issuingPlanId.set(null);
        this.messageService.add({
          severity: 'error',
          summary: 'Arrival Failed',
          detail: (err.error as { detail?: string } | undefined)?.detail ?? 'Could not issue ticket.'
        });
      }
    });
  }

  printTicket(): void {
    window.print();
  }

  openWalkInDialog(): void {
    this.walkInCustomer = null;
    this.walkInOrders.set([]);
    this.walkInSelectedOrders.set(new Set());
    this.walkInDialogVisible = true;
  }

  searchWalkInCustomers(event: AutoCompleteCompleteEvent): void {
    this.planningService.searchCustomers(event.query, 'MAIN').subscribe({
      next: (list: AxCustomer[]) => this.walkInCustomerSuggestions.set(list),
      error: () => this.walkInCustomerSuggestions.set([])
    });
  }

  onWalkInCustomerSelected(customer: AxCustomer): void {
    this.walkInCustomer = customer;
    this.walkInSelectedOrders.set(new Set());
    this.loadingWalkInOrders.set(true);
    this.planningService
      .getCustomerSalesOrders(customer.accountNum, 'MAIN', this.formatDate(new Date()))
      .subscribe({
        next: (res: CustomerOrdersResponse) => {
          this.walkInOrders.set(res.orders);
          this.loadingWalkInOrders.set(false);
        },
        error: () => {
          this.walkInOrders.set([]);
          this.loadingWalkInOrders.set(false);
        }
      });
  }

  toggleWalkInOrder(salesId: string, checked: boolean): void {
    const next = new Set(this.walkInSelectedOrders());
    if (checked) {
      next.add(salesId);
    } else {
      next.delete(salesId);
    }
    this.walkInSelectedOrders.set(next);
  }

  submitWalkIn(): void {
    if (!this.walkInCustomer || this.walkInSelectedOrders().size === 0) {
      return;
    }

    this.issuingWalkIn.set(true);
    this.ticketService
      .registerWalkIn({
        customerAccount: this.walkInCustomer.accountNum,
        warehouseId: 'MAIN',
        salesOrders: Array.from(this.walkInSelectedOrders()),
        notes: 'Authorized walk-in arrival'
      })
      .subscribe({
        next: (ticket: ArrivalTicketResponse) => {
          this.issuingWalkIn.set(false);
          this.walkInDialogVisible = false;
          this.issuedTicket.set(ticket);
          this.ticketDialogVisible = true;
          this.loadPlans();
        },
        error: (err: HttpErrorResponse) => {
          this.issuingWalkIn.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Walk-In Failed',
            detail: (err.error as { detail?: string } | undefined)?.detail ?? 'Could not issue walk-in ticket.'
          });
        }
      });
  }

  planStatusSeverity(status: PickupPlanStatus): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    switch (status) {
      case 'PLANNED':
        return 'info';
      case 'ARRIVED':
        return 'warning';
      case 'COMPLETED':
        return 'success';
      case 'ABSENT':
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
