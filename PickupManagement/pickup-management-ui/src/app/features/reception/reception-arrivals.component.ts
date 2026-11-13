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
  template: `
    <div class="flex flex-column gap-4">
      <div class="flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <h2 class="m-0 text-2xl font-bold text-900">Reception — Planned Arrivals</h2>
          <p class="m-0 text-600 text-sm">
            Confirm client arrival and issue a unique daily pickup ticket.
          </p>
        </div>
        <p-button
          label="Walk-In Arrival"
          icon="pi pi-user-plus"
          severity="secondary"
          [outlined]="true"
          (onClick)="openWalkInDialog()"
        ></p-button>
      </div>

      <p-card>
        <div class="flex flex-wrap gap-3 align-items-end mb-4">
          <div class="flex flex-column gap-2">
            <label for="arrivalDate" class="font-semibold text-sm text-700">Planned Date</label>
            <div class="flex gap-2 align-items-center">
              <p-calendar
                inputId="arrivalDate"
                [(ngModel)]="selectedDate"
                dateFormat="yy-mm-dd"
                [showIcon]="true"
                (onSelect)="loadPlans()"
              ></p-calendar>
              <p-button
                label="Today"
                size="small"
                severity="secondary"
                [outlined]="true"
                (onClick)="selectDateOffset(0)"
              ></p-button>
              <p-button
                label="Tomorrow"
                size="small"
                severity="secondary"
                [outlined]="true"
                (onClick)="selectDateOffset(1)"
              ></p-button>
            </div>
          </div>

          <div class="flex flex-column gap-2 flex-1" style="min-width: 240px;">
            <label for="searchClient" class="font-semibold text-sm text-700">
              Search by account or customer name
            </label>
            <span class="p-input-icon-left w-full">
              <i class="pi pi-search"></i>
              <input
                id="searchClient"
                type="text"
                pInputText
                [(ngModel)]="searchText"
                placeholder="e.g. 411-021 or Atlas"
                class="w-full"
              />
            </span>
          </div>

          <p-button
            label="Refresh"
            icon="pi pi-refresh"
            severity="secondary"
            [outlined]="true"
            [loading]="loading()"
            (onClick)="loadPlans()"
          ></p-button>
        </div>

        <p-table
          [value]="filteredPlans()"
          [loading]="loading()"
          [paginator]="true"
          [rows]="10"
          styleClass="p-datatable-sm p-datatable-striped"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Customer Account</th>
              <th>Customer Name</th>
              <th>Warehouse</th>
              <th>Sales Orders</th>
              <th>Plan Status</th>
              <th style="width: 14rem">Action</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-plan>
            <tr>
              <td class="font-semibold">{{ plan.customerAccount }}</td>
              <td>{{ plan.customerNameSnapshot }}</td>
              <td>{{ plan.warehouseId }}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  <p-tag
                    *ngFor="let o of plan.orders"
                    [value]="o.salesId"
                    severity="secondary"
                  ></p-tag>
                </div>
              </td>
              <td>
                <p-tag
                  [value]="plan.status"
                  [severity]="planStatusSeverity(plan.status)"
                ></p-tag>
              </td>
              <td>
                <p-button
                  *ngIf="plan.status === 'PLANNED'"
                  label="Confirm Arrival"
                  icon="pi pi-ticket"
                  size="small"
                  [loading]="issuingPlanId() === plan.id"
                  [disabled]="issuingPlanId() !== null"
                  (onClick)="confirmArrival(plan)"
                ></p-button>
                <p-button
                  *ngIf="plan.status === 'ARRIVED'"
                  label="View Ticket"
                  icon="pi pi-eye"
                  size="small"
                  severity="secondary"
                  [outlined]="true"
                  [loading]="issuingPlanId() === plan.id"
                  (onClick)="confirmArrival(plan)"
                ></p-button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="6" class="text-center p-4 text-600">
                No planned pickups found for {{ formatDate(selectedDate) }}.
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <!-- Issued Ticket Dialog -->
      <p-dialog
        header="Pickup Ticket Issued"
        [(visible)]="ticketDialogVisible"
        [modal]="true"
        [style]="{ width: '420px' }"
      >
        <div *ngIf="issuedTicket() as ticket" class="flex flex-column align-items-center gap-3 py-2 text-center">
          <div class="text-sm text-600">Daily Ticket Number</div>
          <div class="text-5xl font-bold text-primary">{{ ticket.ticketNumber }}</div>
          <p-tag [value]="'Queue #' + ticket.queueNumber" severity="info"></p-tag>

          <div class="w-full border-top-1 surface-border pt-3 text-left flex flex-column gap-2 text-sm">
            <div class="flex justify-content-between">
              <span class="text-600">Customer:</span>
              <span class="font-semibold">{{ ticket.customerAccount }} — {{ ticket.customerName }}</span>
            </div>
            <div class="flex justify-content-between">
              <span class="text-600">Sales Orders:</span>
              <span class="font-semibold">{{ ticket.orderCount }}</span>
            </div>
            <div class="flex justify-content-between">
              <span class="text-600">Arrival Time (UTC):</span>
              <span class="font-semibold">{{ ticket.arrivalTime | date: 'medium' }}</span>
            </div>
            <div class="flex justify-content-between">
              <span class="text-600">Status:</span>
              <p-tag [value]="ticket.status" severity="success"></p-tag>
            </div>
          </div>
        </div>

        <ng-template pTemplate="footer">
          <p-button
            label="Print Ticket"
            icon="pi pi-print"
            severity="secondary"
            [outlined]="true"
            (onClick)="printTicket()"
          ></p-button>
          <p-button
            label="Done"
            icon="pi pi-check"
            (onClick)="ticketDialogVisible = false"
          ></p-button>
        </ng-template>
      </p-dialog>

      <!-- Authorized Walk-In Dialog -->
      <p-dialog
        header="Authorized Walk-In Arrival"
        [(visible)]="walkInDialogVisible"
        [modal]="true"
        [style]="{ width: '680px' }"
      >
        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-2">
            <label class="font-semibold text-sm text-700">Search Customer in AX</label>
            <p-autoComplete
              [(ngModel)]="walkInCustomer"
              [suggestions]="walkInCustomerSuggestions()"
              (completeMethod)="searchWalkInCustomers($event)"
              (onSelect)="onWalkInCustomerSelected($event.value)"
              field="name"
              [dropdown]="true"
              placeholder="Account or customer name"
              styleClass="w-full"
              inputStyleClass="w-full"
            ></p-autoComplete>
          </div>

          <p-table
            [value]="walkInOrders()"
            [loading]="loadingWalkInOrders()"
            styleClass="p-datatable-sm"
          >
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 3rem">Select</th>
                <th>Sales Order</th>
                <th>AX Status</th>
                <th>Eligibility</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-order>
              <tr>
                <td>
                  <p-checkbox
                    [binary]="true"
                    [ngModel]="walkInSelectedOrders().has(order.salesId)"
                    [disabled]="!order.isEligible || order.isAlreadyPlanned"
                    (onChange)="toggleWalkInOrder(order.salesId, $event.checked)"
                  ></p-checkbox>
                </td>
                <td class="font-semibold">{{ order.salesId }}</td>
                <td>{{ order.axStatus }}</td>
                <td>
                  <p-tag
                    [value]="order.isAlreadyPlanned ? 'Already planned' : order.eligibilityStatus"
                    [severity]="order.isEligible && !order.isAlreadyPlanned ? 'success' : 'warning'"
                  ></p-tag>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>

        <ng-template pTemplate="footer">
          <p-button
            label="Cancel"
            severity="secondary"
            [outlined]="true"
            (onClick)="walkInDialogVisible = false"
          ></p-button>
          <p-button
            label="Issue Walk-In Ticket"
            icon="pi pi-ticket"
            [loading]="issuingWalkIn()"
            [disabled]="!walkInCustomer || walkInSelectedOrders().size === 0 || issuingWalkIn()"
            (onClick)="submitWalkIn()"
          ></p-button>
        </ng-template>
      </p-dialog>
    </div>
  `
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
