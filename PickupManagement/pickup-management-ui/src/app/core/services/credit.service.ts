import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  CreditDecisionRequest,
  CreditDecisionResponse,
  CreditOrderResult,
  TicketCreditContext
} from '../models/credit-warehouse.models';

@Injectable({ providedIn: 'root' })
export class CreditService {
  private readonly api = inject(ApiService);

  getCreditContext(ticketId: string): Observable<TicketCreditContext> {
    return this.api.get<TicketCreditContext>(`/tickets/${ticketId}/credit-context`);
  }

  recordDecision(
    ticketId: string,
    request: CreditDecisionRequest,
    idempotencyKey?: string
  ): Observable<CreditDecisionResponse> {
    return this.api.post<CreditDecisionResponse>(
      `/tickets/${ticketId}/credit-decision`,
      request,
      idempotencyKey
    );
  }

  releaseOrder(
    ticketId: string,
    orderId: string,
    idempotencyKey?: string
  ): Observable<CreditOrderResult> {
    return this.api.post<CreditOrderResult>(
      `/tickets/${ticketId}/orders/${orderId}/release`,
      {},
      idempotencyKey
    );
  }
}
