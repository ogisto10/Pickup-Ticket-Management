import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  AxCustomer,
  CreatePickupPlanRequest,
  CustomerOrdersResponse,
  PickupPlanListItem,
  PickupPlanResponse,
  UpdatePickupPlanRequest
} from '../models/planning.models';

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly api = inject(ApiService);

  searchCustomers(search: string, warehouseId?: string): Observable<AxCustomer[]> {
    return this.api.get<AxCustomer[]>('/customers', { search, warehouseId });
  }

  getCustomerSalesOrders(
    account: string,
    warehouseId: string,
    pickupDate: string
  ): Observable<CustomerOrdersResponse> {
    return this.api.get<CustomerOrdersResponse>(
      `/customers/${encodeURIComponent(account)}/sales-orders`,
      { warehouseId, pickupDate }
    );
  }

  listPlansByDate(date: string): Observable<PickupPlanListItem[]> {
    return this.api.get<PickupPlanListItem[]>('/pickup-plans', { date });
  }

  getPlanById(id: string): Observable<PickupPlanListItem> {
    return this.api.get<PickupPlanListItem>(`/pickup-plans/${id}`);
  }

  createPlan(
    request: CreatePickupPlanRequest,
    idempotencyKey?: string
  ): Observable<PickupPlanResponse> {
    return this.api.post<PickupPlanResponse>('/pickup-plans', request, idempotencyKey);
  }

  updatePlan(
    id: string,
    request: UpdatePickupPlanRequest,
    idempotencyKey?: string
  ): Observable<PickupPlanResponse> {
    return this.api.put<PickupPlanResponse>(`/pickup-plans/${id}`, request, idempotencyKey);
  }
}
