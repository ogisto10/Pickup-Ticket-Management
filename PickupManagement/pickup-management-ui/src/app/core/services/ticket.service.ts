import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ArrivalTicketResponse,
  TicketDetail,
  TicketQueueItem,
  WalkInArrivalRequest
} from '../models/ticket.models';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly api = inject(ApiService);

  confirmArrival(
    pickupPlanId: string,
    idempotencyKey: string
  ): Observable<ArrivalTicketResponse> {
    return this.api.post<ArrivalTicketResponse>(
      `/pickup-plans/${pickupPlanId}/arrival`,
      {},
      idempotencyKey
    );
  }

  registerWalkIn(
    request: WalkInArrivalRequest,
    idempotencyKey?: string
  ): Observable<ArrivalTicketResponse> {
    return this.api.post<ArrivalTicketResponse>(
      '/tickets/walk-in',
      request,
      idempotencyKey
    );
  }

  getQueue(date: string): Observable<TicketQueueItem[]> {
    return this.api.get<TicketQueueItem[]>('/tickets/queue', { date });
  }

  getTicketDetail(ticketId: string): Observable<TicketDetail> {
    return this.api.get<TicketDetail>(`/tickets/${ticketId}`);
  }
}
