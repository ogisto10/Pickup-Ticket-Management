import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { PlanningService } from '../../core/services/planning.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  AxCustomer,
  CustomerOrderLookup,
  CustomerOrdersResponse,
  PickupPlanListItem
} from '../../core/models/planning.models';

@Component({
  selector: 'app-planning-new',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    AutoCompleteModule,
    CalendarModule,
    InputTextModule,
    InputTextareaModule,
    ButtonModule,
    TableModule,
    CheckboxModule,
    TagModule,
    MessageModule,
    TranslatePipe
  ],
  templateUrl: './planning-new.component.html'
})
export class PlanningNewComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly planningService = inject(PlanningService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly editPlanId = signal<string | null>(null);
  readonly customerSuggestions = signal<AxCustomer[]>([]);
  readonly selectedCustomerInfo = signal<AxCustomer | null>(null);
  readonly orders = signal<CustomerOrderLookup[]>([]);
  readonly selectedSalesIds = signal<Set<string>>(new Set());
  readonly alreadyPlannedForDate = signal(false);
  readonly loadingOrders = signal(false);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    pickupDate: [this.tomorrow(), [Validators.required]],
    warehouseId: ['MAIN', [Validators.required]],
    selectedCustomer: [null as AxCustomer | string | null, [Validators.required]],
    notes: ['']
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editPlanId.set(id);
      this.loadPlanForEdit(id);
    }
  }

  onSearchCustomers(event: AutoCompleteCompleteEvent): void {
    const warehouseId = this.form.controls.warehouseId.value ?? 'MAIN';
    this.planningService.searchCustomers(event.query, warehouseId).subscribe({
      next: (results: AxCustomer[]) => this.customerSuggestions.set(results),
      error: () => this.customerSuggestions.set([])
    });
  }

  onCustomerSelected(customer: AxCustomer): void {
    if (!customer.isActive) {
      this.messageService.add({
        severity: 'error',
        summary: 'Inactive Customer',
        detail: `Customer ${customer.accountNum} is blocked in AX (${customer.blockedStatus ?? 'Inactive'}).`
      });
      return;
    }

    this.selectedCustomerInfo.set(customer);
    this.selectedSalesIds.set(new Set());
    this.loadCustomerOrders(customer.accountNum);
  }

  reloadOrdersIfCustomerSelected(): void {
    const cust = this.selectedCustomerInfo();
    if (cust) {
      this.loadCustomerOrders(cust.accountNum);
    }
  }

  isOrderDisabled(order: CustomerOrderLookup): boolean {
    if (!order.isEligible) {
      return true;
    }
    if (order.isAlreadyPlanned && order.existingPlanId !== this.editPlanId()) {
      return true;
    }
    return false;
  }

  toggleOrder(salesId: string, checked: boolean): void {
    const next = new Set(this.selectedSalesIds());
    if (checked) {
      next.add(salesId);
    } else {
      next.delete(salesId);
    }
    this.selectedSalesIds.set(next);
  }

  savePlan(): void {
    const cust = this.selectedCustomerInfo();
    const pickupDate = this.form.controls.pickupDate.value;
    const warehouseId = this.form.controls.warehouseId.value?.trim() ?? 'MAIN';

    if (!cust || !pickupDate || this.selectedSalesIds().size === 0) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formattedDate = this.formatDate(pickupDate);
    const salesOrders = Array.from(this.selectedSalesIds());
    const notes = this.form.controls.notes.value?.trim() || null;

    const currentEditId = this.editPlanId();
    const request$ = currentEditId
      ? this.planningService.updatePlan(currentEditId, {
          pickupDate: formattedDate,
          warehouseId,
          salesOrders,
          notes
        })
      : this.planningService.createPlan({
          customerAccount: cust.accountNum,
          pickupDate: formattedDate,
          warehouseId,
          salesOrders,
          notes
        });

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: currentEditId ? 'Plan Updated' : 'Plan Created',
          detail: `Pickup plan saved for ${cust.accountNum} (${salesOrders.length} order(s)).`
        });
        void this.router.navigate(['/planning']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const detail =
          (err.error as { detail?: string; message?: string } | undefined)?.detail ??
          (err.error as { message?: string } | undefined)?.message ??
          'Could not save pickup plan.';
        this.messageService.add({
          severity: 'error',
          summary: 'Save Failed',
          detail
        });
      }
    });
  }

  private loadPlanForEdit(id: string): void {
    this.planningService.getPlanById(id).subscribe({
      next: (plan: PickupPlanListItem) => {
        const cust: AxCustomer = {
          accountNum: plan.customerAccount,
          name: plan.customerNameSnapshot,
          dataAreaId: 'DAT',
          isActive: true
        };
        this.selectedCustomerInfo.set(cust);
        this.form.patchValue({
          pickupDate: new Date(`${plan.pickupDate}T00:00:00`),
          warehouseId: plan.warehouseId,
          selectedCustomer: cust,
          notes: plan.notes ?? ''
        });
        this.selectedSalesIds.set(new Set(plan.orders.map((o) => o.salesId)));
        this.loadCustomerOrders(plan.customerAccount);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Not Found',
          detail: 'Pickup plan could not be loaded.'
        });
        void this.router.navigate(['/planning']);
      }
    });
  }

  private loadCustomerOrders(account: string): void {
    const pickupDate = this.form.controls.pickupDate.value ?? this.tomorrow();
    const warehouseId = this.form.controls.warehouseId.value?.trim() || 'MAIN';

    this.loadingOrders.set(true);
    this.planningService
      .getCustomerSalesOrders(account, warehouseId, this.formatDate(pickupDate))
      .subscribe({
        next: (res: CustomerOrdersResponse) => {
          this.orders.set(res.orders);
          this.alreadyPlannedForDate.set(
            res.alreadyPlannedForSelectedDate && !this.editPlanId()
          );
          this.loadingOrders.set(false);
        },
        error: () => {
          this.orders.set([]);
          this.loadingOrders.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'AX Lookup Failed',
            detail: 'Could not retrieve eligible sales orders from AX.'
          });
        }
      });
  }

  private formatDate(date: Date): string {
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
