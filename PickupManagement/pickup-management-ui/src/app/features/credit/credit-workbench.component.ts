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
    MessageModule
  ],
  template: `
    <div class="flex flex-column gap-4">
      <div class="flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <h2 class="m-0 text-2xl font-bold text-900">Credit Workbench</h2>
          <p class="m-0 text-600 text-sm">
            Review AX financial balances, approve payment/credit, and trigger sales order release.
          </p>
        </div>

        <div class="flex gap-2">
          <p-button
            label="Call Next Eligible Ticket"
            icon="pi pi-step-forward"
            [disabled]="loadingQueue()"
            (onClick)="callNextEligibleTicket()"
          ></p-button>
          <p-button
            label="Refresh"
            icon="pi pi-refresh"
            severity="secondary"
            [outlined]="true"
            [loading]="loadingQueue()"
            (onClick)="loadQueue()"
          ></p-button>
        </div>
      </div>

      <div class="grid">
        <!-- Left Queue Panel (ascending arrival order) -->
        <div class="col-12 lg:col-5">
          <p-card header="Arrival Queue">
            <p-table
              [value]="queue()"
              [loading]="loadingQueue()"
              selectionMode="single"
              [rows]="12"
              [paginator]="true"
              styleClass="p-datatable-sm"
            >
              <ng-template pTemplate="header">
                <tr>
                  <th>Queue #</th>
                  <th>Ticket</th>
                  <th>Customer</th>
                  <th>Status</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-item>
                <tr
                  class="cursor-pointer"
                  [ngClass]="{ 'bg-primary-50': context()?.ticket?.ticketId === item.ticketId }"
                  (click)="selectTicket(item.ticketId)"
                >
                  <td class="font-bold">#{{ item.queueNumber }}</td>
                  <td class="font-bold text-primary">{{ item.ticketNumber }}</td>
                  <td>
                    <div class="font-semibold text-sm">{{ item.customerAccount }}</div>
                    <div class="text-xs text-600">{{ item.customerName }}</div>
                  </td>
                  <td>
                    <p-tag
                      [value]="item.status"
                      [severity]="ticketSeverity(item.status)"
                    ></p-tag>
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="4" class="text-center p-4 text-600">
                    No tickets in today's queue.
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </p-card>
        </div>

        <!-- Right Credit Review & Release Panel -->
        <div class="col-12 lg:col-7">
          <p-card *ngIf="!context()" header="Ticket Review">
            <p class="m-0 text-600">
              Select a ticket from the queue or click "Call Next Eligible Ticket" to begin credit review.
            </p>
          </p-card>

          <p-card *ngIf="context() as ctx">
            <div class="flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
              <div>
                <div class="flex align-items-center gap-2">
                  <span class="text-3xl font-bold text-primary">{{ ctx.ticket.ticketNumber }}</span>
                  <p-tag [value]="'Queue #' + ctx.ticket.queueNumber" severity="info"></p-tag>
                  <p-tag
                    [value]="ctx.ticket.status"
                    [severity]="ticketSeverity(ctx.ticket.status)"
                  ></p-tag>
                </div>
                <div class="text-sm text-700 mt-1">
                  <strong>{{ ctx.ticket.customerAccount }}</strong> — {{ ctx.ticket.customerName }}
                  · {{ ctx.orders.length }} sales order(s)
                </div>
              </div>
            </div>

            <div class="grid mb-3" *ngIf="ctx.customerCredit as credit">
              <div class="col-12 md:col-4">
                <div class="surface-100 border-round p-3">
                  <div class="text-xs text-600 uppercase">AX Customer Balance</div>
                  <div class="text-xl font-bold text-900 mt-1">
                    {{ credit.balance | number: '1.2-2' }} {{ credit.currencyCode }}
                  </div>
                </div>
              </div>
              <div class="col-12 md:col-4">
                <div class="surface-100 border-round p-3">
                  <div class="text-xs text-600 uppercase">AX Credit Limit</div>
                  <div class="text-xl font-bold text-900 mt-1">
                    {{ credit.creditLimit | number: '1.2-2' }} {{ credit.currencyCode }}
                  </div>
                </div>
              </div>
              <div class="col-12 md:col-4">
                <div class="surface-100 border-round p-3">
                  <div class="text-xs text-600 uppercase">AX Open Orders</div>
                  <div class="text-xl font-bold text-900 mt-1">
                    {{ credit.openOrdersAmount | number: '1.2-2' }} {{ credit.currencyCode }}
                  </div>
                </div>
              </div>
            </div>

            <p-message
              *ngIf="ctx.customerCredit?.hasCreditBlock"
              severity="error"
              [text]="'AX Credit Block: ' + (ctx.customerCredit?.blockReason || 'Credit review required')"
              styleClass="w-full mb-3"
            ></p-message>

            <h3 class="mt-0 mb-2 text-base font-semibold text-900">Sales Order Eligibility</h3>
            <p-table [value]="ctx.orders" styleClass="p-datatable-sm p-datatable-striped mb-3">
              <ng-template pTemplate="header">
                <tr>
                  <th style="width: 3rem">Approve</th>
                  <th>Sales Order</th>
                  <th>AX Eligibility</th>
                  <th>Order Status</th>
                  <th style="width: 9rem">AX Release</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-order>
                <tr>
                  <td>
                    <p-checkbox
                      [binary]="true"
                      [ngModel]="approvedOrders().has(order.salesId)"
                      [disabled]="order.isCancelled || order.status === 'RELEASED' || order.status === 'IN_PREPARATION' || order.status === 'READY' || order.status === 'COLLECTED'"
                      (onChange)="toggleOrderApproval(order.salesId, $event.checked)"
                    ></p-checkbox>
                  </td>
                  <td class="font-semibold">{{ order.salesId }}</td>
                  <td>
                    <div class="flex flex-column gap-1">
                      <p-tag
                        [value]="order.eligibilityLabel"
                        [severity]="order.isEligible ? 'success' : 'warning'"
                      ></p-tag>
                      <small *ngIf="order.blockingReason" class="text-red-600">
                        {{ order.blockingReason }}
                      </small>
                    </div>
                  </td>
                  <td>
                    <p-tag
                      [value]="order.status"
                      [severity]="orderSeverity(order.status)"
                    ></p-tag>
                  </td>
                  <td>
                    <p-button
                      *ngIf="order.status === 'BLOCKED' || order.status === 'RECONCILING' || order.status === 'RELEASE_PENDING' || order.status === 'PENDING_CREDIT'"
                      label="Release"
                      icon="pi pi-send"
                      size="small"
                      [outlined]="true"
                      [disabled]="!order.isEligible || order.isCancelled || submitting()"
                      (onClick)="releaseSingleOrder(ctx.ticket.ticketId, order.orderId)"
                    ></p-button>
                    <span *ngIf="order.status === 'RELEASED' || order.status === 'IN_PREPARATION' || order.status === 'READY'" class="text-xs text-green-700 font-semibold">
                      AX Confirmed
                    </span>
                  </td>
                </tr>
              </ng-template>
            </p-table>

            <form [formGroup]="decisionForm" class="flex flex-column gap-3">
              <div class="flex flex-column gap-2">
                <label for="creditComment" class="font-semibold text-sm text-700">
                  Decision Comment (mandatory for Hold / Reject)
                </label>
                <textarea
                  id="creditComment"
                  pInputTextarea
                  rows="2"
                  formControlName="comment"
                  placeholder="Enter payment verification note or hold/rejection reason"
                ></textarea>
              </div>

              <div class="flex flex-wrap gap-2 justify-content-end">
                <p-button
                  label="Reject"
                  icon="pi pi-times"
                  severity="danger"
                  [outlined]="true"
                  [loading]="submitting()"
                  [disabled]="submitting()"
                  (onClick)="submitDecision('REJECTED')"
                ></p-button>
                <p-button
                  label="Place On Hold"
                  icon="pi pi-pause"
                  severity="warning"
                  [outlined]="true"
                  [loading]="submitting()"
                  [disabled]="submitting()"
                  (onClick)="submitDecision('ON_HOLD')"
                ></p-button>
                <p-button
                  label="Approve & Release in AX"
                  icon="pi pi-check"
                  severity="success"
                  [loading]="submitting()"
                  [disabled]="submitting()"
                  (onClick)="submitDecision('APPROVED')"
                ></p-button>
              </div>
            </form>
          </p-card>
        </div>
      </div>
    </div>
  `
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
