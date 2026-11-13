import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  CollectionResult,
  OrderPreparationResult
} from '../models/credit-warehouse.models';

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private readonly api = inject(ApiService);

  startPreparation(
    ticketId: string,
    orderId: string,
    comment?: string | null,
    idempotencyKey?: string
  ): Observable<OrderPreparationResult> {
    return this.api.post<OrderPreparationResult>(
      `/tickets/${ticketId}/orders/${orderId}/preparation`,
      { comment: comment ?? null },
      idempotencyKey
    );
  }

  markOrderReady(
    ticketId: string,
    orderId: string,
    comment?: string | null,
    idempotencyKey?: string
  ): Observable<OrderPreparationResult> {
    return this.api.post<OrderPreparationResult>(
      `/tickets/${ticketId}/orders/${orderId}/ready`,
      { comment: comment ?? null },
      idempotencyKey
    );
  }

  removeBlockedOrder(
    ticketId: string,
    orderId: string,
    reason: string,
    idempotencyKey?: string
  ): Observable<OrderPreparationResult> {
    return this.api.post<OrderPreparationResult>(
      `/tickets/${ticketId}/orders/${orderId}/remove-blocked`,
      { reason },
      idempotencyKey
    );
  }

  confirmCollection(
    ticketId: string,
    comment?: string | null,
    idempotencyKey?: string
  ): Observable<CollectionResult> {
    return this.api.post<CollectionResult>(
      `/tickets/${ticketId}/collection`,
      { comment: comment ?? null },
      idempotencyKey
    );
  }
}
