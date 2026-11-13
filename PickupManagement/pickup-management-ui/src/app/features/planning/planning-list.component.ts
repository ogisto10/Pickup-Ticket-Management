import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { PlanningService } from '../../core/services/planning.service';
import { PickupPlanListItem, PickupPlanStatus } from '../../core/models/planning.models';

@Component({
  selector: 'app-planning-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    TableModule,
    ButtonModule,
    CalendarModule,
    InputTextModule,
    TagModule,
    TooltipModule
  ],
  template: `
    <div class="flex flex-column gap-4">
      <div class="flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <h2 class="m-0 text-2xl font-bold text-900">Planned Pickups</h2>
          <p class="m-0 text-600 text-sm">
            Manage client pickup visits and assigned AX sales orders before arrival.
          </p>
        </div>
        <p-button
          label="New Pickup Plan"
          icon="pi pi-plus"
          routerLink="/planning/new"
        ></p-button>
      </div>

      <p-card>
        <div class="flex flex-wrap gap-3 align-items-end mb-4">
          <div class="flex flex-column gap-2">
            <label for="pickupDate" class="font-semibold text-sm text-700">Pickup Date</label>
            <p-calendar
              inputId="pickupDate"
              [(ngModel)]="selectedDate"
              dateFormat="yy-mm-dd"
              [showIcon]="true"
              (onSelect)="loadPlans()"
            ></p-calendar>
          </div>

          <div class="flex flex-column gap-2 flex-1" style="min-width: 240px;">
            <label for="searchTerm" class="font-semibold text-sm text-700">Filter by customer or order</label>
            <span class="p-input-icon-left w-full">
              <i class="pi pi-search"></i>
              <input
                id="searchTerm"
                type="text"
                pInputText
                [(ngModel)]="searchText"
                placeholder="Customer account, name, or SO number"
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
              <th>Status</th>
              <th>Created By</th>
              <th style="width: 8rem">Actions</th>
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
                  [severity]="statusSeverity(plan.status)"
                ></p-tag>
              </td>
              <td>{{ plan.createdBy }}</td>
              <td>
                <p-button
                  *ngIf="plan.status === 'PLANNED'"
                  icon="pi pi-pencil"
                  label="Edit"
                  size="small"
                  [outlined]="true"
                  [routerLink]="['/planning', plan.id, 'edit']"
                ></p-button>
                <span *ngIf="plan.status !== 'PLANNED'" class="text-xs text-500">Locked</span>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="7" class="text-center p-4 text-600">
                No pickup plans found for {{ formatDate(selectedDate) }}.
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
    </div>
  `
})
export class PlanningListComponent implements OnInit {
  private readonly planningService = inject(PlanningService);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(false);
  readonly plans = signal<PickupPlanListItem[]>([]);

  selectedDate: Date = this.tomorrow();
  searchText = '';

  readonly filteredPlans = computed(() => {
    const term = this.searchText.trim().toLowerCase();
    const list = this.plans();
    if (!term) {
      return list;
    }
    return list.filter(
      (p) =>
        p.customerAccount.toLowerCase().includes(term) ||
        p.customerNameSnapshot.toLowerCase().includes(term) ||
        p.orders.some((o) => o.salesId.toLowerCase().includes(term))
    );
  });

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    const dateStr = this.formatDate(this.selectedDate);
    this.planningService.listPlansByDate(dateStr).subscribe({
      next: (data: PickupPlanListItem[]) => {
        this.plans.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Load Failed',
          detail: 'Could not retrieve pickup plans.'
        });
      }
    });
  }

  statusSeverity(status: PickupPlanStatus): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
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

  private tomorrow(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
}
