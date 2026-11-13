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
  templateUrl: './planning-list.component.html'
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
