import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { CreditService } from '../../core/services/credit.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { TicketService } from '../../core/services/ticket.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  CreditDecisionResponse,
  CreditOrderResult,
  TicketCreditContext
} from '../../core/models/credit-warehouse.models';
import { PickupTicketStatus, TicketQueueItem } from '../../core/models/ticket.models';

@Component({
  selector: 'app-credit-workbench',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    TagModule,
    CheckboxModule,
    InputTextareaModule,
    MessageModule,
    TranslatePipe
  ],
  templateUrl: './credit-workbench.component.html'
})
export class CreditWorkbenchComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly ticketService = inject(TicketService);
  private readonly creditService = inject(CreditService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly messageService = inject(MessageService);

  private queueSub?: Subscription;

  readonly loadingQueue = signal(false);
  readonly submitting = signal(false);
  readonly queue = signal<TicketQueueItem[]>([]);
  readonly context = signal<TicketCreditContext | null>(null);
  readonly approvedOrders = signal<Set<string>>(new Set());

  readonly decisionForm = this.fb.group({
    comment: ['']
  });

  ngOnInit(): void {
    this.loadQueue();
    void this.realtimeService.connectOperations();
    this.queueSub = this.realtimeService.queueUpdated$.subscribe(() => {
      this.loadQueue();
      const activeId = this.context()?.ticket.ticketId;
      if (activeId) {
        this.selectTicket(activeId);
      }
    });
  }

  ngOnDestroy(): void {
    this.queueSub?.unsubscribe();
  }

  loadQueue(): void {
    this.loadingQueue.set(true);
    this.ticketService.getQueue(this.todayString()).subscribe({
      next: (items: TicketQueueItem[]) => {
        this.queue.set(items);
        this.loadingQueue.set(false);
      },
      error: () => {
        this.loadingQueue.set(false);
      }
    });
  }

  callNextEligibleTicket(): void {
    const next = this.queue().find(
      (t) => t.status === 'ARRIVED' || t.status === 'ON_HOLD'
    );
    if (!next) {
      this.messageService.add({
        severity: 'info',
        summary: 'Queue Clear',
        detail: 'No tickets awaiting credit decision.'
      });
      return;
    }
    this.selectTicket(next.ticketId);
  }

  selectTicket(ticketId: string): void {
    this.creditService.getCreditContext(ticketId).subscribe({
      next: (ctx: TicketCreditContext) => {
        this.context.set(ctx);
        const preselected = new Set(
          ctx.orders
            .filter((o) => o.isEligible && !o.isCancelled)
            .map((o) => o.salesId)
        );
        this.approvedOrders.set(preselected);
        this.decisionForm.patchValue({ comment: ctx.ticket.creditComment ?? '' });
      },
      error: (err: HttpErrorResponse) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Load Failed',
          detail: (err.error as { detail?: string } | undefined)?.detail ?? 'Could not load credit context.'
        });
      }
    });
  }

  toggleOrderApproval(salesId: string, checked: boolean): void {
    const next = new Set(this.approvedOrders());
    if (checked) {
      next.add(salesId);
    } else {
      next.delete(salesId);
    }
    this.approvedOrders.set(next);
  }

  submitDecision(decision: 'APPROVED' | 'ON_HOLD' | 'REJECTED'): void {
    const ctx = this.context();
    if (!ctx) {
      return;
    }

    const comment = this.decisionForm.controls.comment.value?.trim() || null;
    if ((decision === 'ON_HOLD' || decision === 'REJECTED') && !comment) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Reason Required',
        detail: 'Please provide a comment when placing a ticket on hold or rejecting it.'
      });
      return;
    }

    this.submitting.set(true);
    this.creditService
      .recordDecision(ctx.ticket.ticketId, {
        decision,
        comment,
        orders: ctx.orders.map((o) => ({
          salesId: o.salesId,
          approveForRelease: this.approvedOrders().has(o.salesId)
        }))
      })
      .subscribe({
        next: (res: CreditDecisionResponse) => {
          this.submitting.set(false);
          const released = res.orders.filter((o) => o.releaseOutcome === 'RELEASED').length;
          const pending = res.orders.filter(
            (o) => o.releaseOutcome === 'RELEASE_PENDING' || o.releaseOutcome === 'RECONCILING'
          ).length;
          const blocked = res.orders.filter((o) => o.releaseOutcome === 'BLOCKED').length;

          this.messageService.add({
            severity: blocked > 0 || pending > 0 ? 'warn' : 'success',
            summary: `Decision Recorded (${res.ticketStatus})`,
            detail: `Released: ${released}, Pending/Reconciling: ${pending}, Blocked: ${blocked}`
          });

          this.loadQueue();
          this.selectTicket(ctx.ticket.ticketId);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Credit Decision Failed',
            detail: (err.error as { detail?: string } | undefined)?.detail ?? 'Could not record credit decision.'
          });
        }
      });
  }

  releaseSingleOrder(ticketId: string, orderId: string): void {
    this.submitting.set(true);
    this.creditService.releaseOrder(ticketId, orderId).subscribe({
      next: (res: CreditOrderResult) => {
        this.submitting.set(false);
        this.messageService.add({
          severity: res.releaseOutcome === 'RELEASED' ? 'success' : 'warn',
          summary: `${res.salesId}: ${res.releaseOutcome}`,
          detail: res.errorMessage ?? 'AX release processed.'
        });
        this.loadQueue();
        this.selectTicket(ticketId);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Release Failed',
          detail: (err.error as { detail?: string } | undefined)?.detail ?? 'Could not release order.'
        });
      }
    });
  }

  ticketSeverity(status: PickupTicketStatus): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    switch (status) {
      case 'ARRIVED':
        return 'info';
      case 'APPROVED':
      case 'IN_PREPARATION':
        return 'warning';
      case 'READY':
      case 'COLLECTED':
        return 'success';
      case 'ON_HOLD':
      case 'REJECTED':
      case 'CANCELLED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  orderSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    switch (status) {
      case 'RELEASED':
      case 'READY':
      case 'COLLECTED':
        return 'success';
      case 'IN_PREPARATION':
      case 'RELEASE_PENDING':
      case 'RECONCILING':
        return 'warning';
      case 'BLOCKED':
      case 'CANCELLED':
        return 'danger';
      default:
        return 'info';
    }
  }

  private todayString(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
