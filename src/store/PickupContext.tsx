import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  INITIAL_AX_CREDIT,
  INITIAL_AX_CUSTOMERS,
  INITIAL_AX_ORDERS,
  INITIAL_HISTORY,
  INITIAL_INTEGRATIONS,
  INITIAL_PLANS,
  INITIAL_SETTINGS,
  INITIAL_TICKETS,
  ROLE_DEFINITIONS,
  TODAY_ISO,
} from '../data/seedData';
import {
  AppRole,
  AppRoute,
  AxCustomer,
  AxCustomerCreditInfo,
  AxSalesOrder,
  IntegrationAttemptEntry,
  PickupPlan,
  PickupSettings,
  PickupTicket,
  PickupTicketOrderStatus,
  PickupTicketStatus,
  ToastNotification,
  WorkflowHistoryEntry,
} from '../types/pickup';

const ROUTE_PERMISSIONS: Record<AppRoute, AppRole[]> = {
  dashboard: ['Supervisor', 'Administrator', 'Commercial', 'Reception', 'CreditManager', 'WarehouseOperator'],
  planning: ['Commercial', 'Supervisor', 'Administrator'],
  'planning-new': ['Commercial', 'Supervisor', 'Administrator'],
  reception: ['Reception', 'Supervisor', 'Administrator'],
  'reception-queue': ['Reception', 'Supervisor', 'Administrator'],
  credit: ['CreditManager', 'Supervisor', 'Administrator'],
  warehouse: ['WarehouseOperator', 'Supervisor', 'Administrator'],
  'pickup-display': ['DisplayDevice', 'Reception', 'Supervisor', 'Administrator'],
  history: ['Commercial', 'Reception', 'CreditManager', 'WarehouseOperator', 'Supervisor', 'Administrator'],
  'admin-settings': ['Administrator'],
};

export interface CreatePlanInput {
  customerAccount: string;
  plannedDate: string;
  plannedWindow: string;
  representativeName: string;
  representativePhone: string;
  notes: string;
  salesIds: string[];
}

export interface IssueTicketInput {
  sourcePlanId?: string;
  customerAccount: string;
  driverName: string;
  vehiclePlate: string;
  salesIds: string[];
  idempotencyKey?: string;
}

interface PickupContextValue {
  currentRole: AppRole;
  activeRoute: AppRoute;
  settings: PickupSettings;
  axCustomers: AxCustomer[];
  axCreditByCustomer: Record<string, AxCustomerCreditInfo>;
  axOrders: AxSalesOrder[];
  plans: PickupPlan[];
  tickets: PickupTicket[];
  history: WorkflowHistoryEntry[];
  integrations: IntegrationAttemptEntry[];
  toasts: ToastNotification[];
  canAccessRoute: (route: AppRoute, role?: AppRole) => boolean;
  switchRole: (role: AppRole) => void;
  navigate: (route: AppRoute) => void;
  dismissToast: (id: string) => void;
  createPlan: (input: CreatePlanInput) => { ok: boolean; error?: string };
  cancelPlan: (planId: string, reason: string) => { ok: boolean; error?: string };
  issueTicket: (input: IssueTicketInput) => { ok: boolean; ticket?: PickupTicket; error?: string; replayed?: boolean };
  holdTicket: (ticketId: string, reason: string) => { ok: boolean; error?: string };
  rejectTicket: (ticketId: string, reason: string) => { ok: boolean; error?: string };
  approveAndReleaseTicket: (
    ticketId: string,
    selectedSalesIds: string[],
    simulateAxTimeout?: boolean
  ) => { ok: boolean; error?: string };
  reconcileOrderWithAx: (ticketId: string, orderId: string) => { ok: boolean; error?: string };
  startOrderPreparation: (ticketId: string, orderId: string) => { ok: boolean; error?: string };
  markOrderReady: (ticketId: string, orderId: string) => { ok: boolean; error?: string };
  confirmTicketCollection: (ticketId: string) => { ok: boolean; error?: string };
  runAbsentCutoff: () => number;
  updateSettings: (next: PickupSettings) => { ok: boolean; error?: string };
  clearCreditBlockInAxDemo: (customerAccount: string) => void;
  isSalesIdActiveInPlanOrTicket: (salesId: string) => { active: boolean; source?: string };
}

const PickupContext = createContext<PickupContextValue | null>(null);

function nowTime(): string {
  return new Date().toTimeString().slice(0, 8);
}

function padTicketNumber(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

export const PickupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<AppRole>('Administrator');
  const [activeRoute, setActiveRoute] = useState<AppRoute>('dashboard');
  const [settings, setSettings] = useState<PickupSettings>(INITIAL_SETTINGS);
  const [axCustomers] = useState<AxCustomer[]>(INITIAL_AX_CUSTOMERS);
  const [axCreditByCustomer, setAxCreditByCustomer] =
    useState<Record<string, AxCustomerCreditInfo>>(INITIAL_AX_CREDIT);
  const [axOrders, setAxOrders] = useState<AxSalesOrder[]>(INITIAL_AX_ORDERS);
  const [plans, setPlans] = useState<PickupPlan[]>(INITIAL_PLANS);
  const [tickets, setTickets] = useState<PickupTicket[]>(INITIAL_TICKETS);
  const [history, setHistory] = useState<WorkflowHistoryEntry[]>(INITIAL_HISTORY);
  const [integrations, setIntegrations] = useState<IntegrationAttemptEntry[]>(INITIAL_INTEGRATIONS);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [idempotencyTickets, setIdempotencyTickets] = useState<Record<string, string>>({});

  const pushToast = (severity: ToastNotification['severity'], title: string, detail: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ id, severity, title, detail }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const canAccessRoute = (route: AppRoute, role: AppRole = currentRole) => {
    return ROUTE_PERMISSIONS[route].includes(role);
  };

  const switchRole = (role: AppRole) => {
    setCurrentRole(role);
    const landing = ROLE_DEFINITIONS[role].landingRoute;
    setActiveRoute(landing);
    pushToast('info', `Switched role to ${ROLE_DEFINITIONS[role].label}`, `Signed in as ${ROLE_DEFINITIONS[role].userName}`);
  };

  const navigate = (route: AppRoute) => {
    if (!canAccessRoute(route, currentRole)) {
      pushToast('warn', 'Access denied (403)', `Role ${ROLE_DEFINITIONS[currentRole].label} cannot open this view.`);
      return;
    }
    setActiveRoute(route);
  };

  const appendHistory = (entries: Omit<WorkflowHistoryEntry, 'id' | 'timestamp'>[]) => {
    const stamp = nowTime();
    setHistory((prev) => [
      ...entries.map((e, idx) => ({
        ...e,
        id: `hist-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: stamp,
      })),
      ...prev,
    ]);
  };

  const isSalesIdActiveInPlanOrTicket = (salesId: string) => {
    const activePlan = plans.find(
      (p) =>
        (p.status === 'PLANNED' || p.status === 'ARRIVED') &&
        p.orders.some((o) => o.salesId === salesId)
    );
    if (activePlan) {
      return { active: true, source: `Plan ${activePlan.planCode} (${activePlan.status})` };
    }
    const activeTicket = tickets.find(
      (t) =>
        t.status !== 'CANCELLED' &&
        t.status !== 'COLLECTED' &&
        t.status !== 'REJECTED' &&
        t.orders.some((o) => o.salesId === salesId && o.status !== 'CANCELLED')
    );
    if (activeTicket) {
      return { active: true, source: `Ticket ${activeTicket.ticketNumber} (${activeTicket.status})` };
    }
    return { active: false };
  };

  const createPlan = (input: CreatePlanInput) => {
    if (!['Commercial', 'Supervisor', 'Administrator'].includes(currentRole)) {
      return { ok: false, error: 'Unauthorized: Commercial, Supervisor, or Administrator role required.' };
    }
    const customer = axCustomers.find((c) => c.accountNum === input.customerAccount);
    if (!customer || !customer.isActive) {
      return { ok: false, error: 'Customer account is inactive or blocked in AX.' };
    }
    if (input.salesIds.length === 0) {
      return { ok: false, error: 'Select at least one eligible AX sales order.' };
    }

    const selectedOrders: AxSalesOrder[] = [];
    for (const salesId of input.salesIds) {
      const axOrder = axOrders.find((o) => o.salesId === salesId && o.customerAccount === customer.accountNum);
      if (!axOrder) {
        return { ok: false, error: `Sales order ${salesId} was not found for this customer.` };
      }
      if (!axOrder.isEligible || axOrder.isCancelled) {
        return { ok: false, error: `Sales order ${salesId} is ineligible (${axOrder.ineligibilityReason ?? axOrder.axStatus}).` };
      }
      const dup = isSalesIdActiveInPlanOrTicket(salesId);
      if (dup.active) {
        return { ok: false, error: `Duplicate active order blocked: ${salesId} is already in ${dup.source}.` };
      }
      selectedOrders.push(axOrder);
    }

    const nextIndex = plans.length + 1;
    const planCode = `PLN-${TODAY_ISO.slice(0, 4)}-${String(nextIndex).padStart(3, '0')}`;
    const newPlan: PickupPlan = {
      id: `plan-${Date.now()}`,
      planCode,
      customerAccount: customer.accountNum,
      customerName: customer.name,
      dataAreaId: settings.dataAreaId,
      plannedDate: input.plannedDate || TODAY_ISO,
      plannedWindow: input.plannedWindow || '14:00 - 15:30',
      representativeName: input.representativeName.trim() || 'Authorized Carrier',
      representativePhone: input.representativePhone.trim() || '—',
      notes: input.notes.trim(),
      status: 'PLANNED',
      createdBy: ROLE_DEFINITIONS[currentRole].userName,
      createdAt: nowTime(),
      orders: selectedOrders.map((o, idx) => ({
        id: `po-${Date.now()}-${idx}`,
        salesId: o.salesId,
        warehouseId: o.warehouseId,
        axStatusAtPlanning: o.axStatus,
        totalAmountSnapshot: o.totalAmount,
        currencyCode: o.currencyCode,
      })),
    };

    setPlans((prev) => [newPlan, ...prev]);
    appendHistory([
      {
        entityType: 'Plan',
        entityRef: newPlan.planCode,
        ticketNumber: null,
        fromStatus: 'NEW',
        toStatus: 'PLANNED',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: `Scheduled ${newPlan.plannedWindow} with ${newPlan.orders.length} AX order(s)`,
      },
    ]);
    pushToast('success', `Plan ${newPlan.planCode} created`, `${customer.name} · ${selectedOrders.length} order(s)`);
    return { ok: true };
  };

  const cancelPlan = (planId: string, reason: string) => {
    if (!['Commercial', 'Supervisor', 'Administrator'].includes(currentRole)) {
      return { ok: false, error: 'Unauthorized role for plan cancellation.' };
    }
    const target = plans.find((p) => p.id === planId);
    if (!target) return { ok: false, error: 'Plan not found.' };
    if (target.status !== 'PLANNED') {
      return { ok: false, error: `Only PLANNED entries can be cancelled (current: ${target.status}).` };
    }
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, status: 'CANCELLED' } : p)));
    appendHistory([
      {
        entityType: 'Plan',
        entityRef: target.planCode,
        ticketNumber: null,
        fromStatus: 'PLANNED',
        toStatus: 'CANCELLED',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: reason || 'Cancelled by Commercial',
      },
    ]);
    pushToast('info', `Plan ${target.planCode} cancelled`, 'Linked sales orders are now free for re-planning.');
    return { ok: true };
  };

  const issueTicket = (input: IssueTicketInput) => {
    if (!['Reception', 'Supervisor', 'Administrator'].includes(currentRole)) {
      return { ok: false, error: 'Unauthorized: Reception, Supervisor, or Administrator role required.' };
    }
    const replayKey = input.idempotencyKey;
    if (replayKey && idempotencyTickets[replayKey]) {
      const existingTicket = tickets.find((t) => t.id === idempotencyTickets[replayKey]);
      if (existingTicket) {
        pushToast(
          'info',
          `Idempotency Replay: ${existingTicket.ticketNumber}`,
          'Same Idempotency-Key returned existing ticket without incrementing sequence.'
        );
        return { ok: true, ticket: existingTicket, replayed: true };
      }
    }

    const plan = input.sourcePlanId ? plans.find((p) => p.id === input.sourcePlanId) : undefined;
    if (input.sourcePlanId && !plan) {
      return { ok: false, error: 'Referenced pickup plan was not found.' };
    }
    if (plan && plan.status !== 'PLANNED') {
      return { ok: false, error: `Plan ${plan.planCode} is already ${plan.status}.` };
    }

    const customer = axCustomers.find((c) => c.accountNum === (plan?.customerAccount ?? input.customerAccount));
    if (!customer || !customer.isActive) {
      return { ok: false, error: 'Customer account is inactive or blocked in AX.' };
    }

    const orderIds = plan ? plan.orders.map((o) => o.salesId) : input.salesIds;
    if (orderIds.length === 0) {
      return { ok: false, error: 'At least one sales order is required to issue a pickup ticket.' };
    }

    const ticketOrders = [];
    for (const salesId of orderIds) {
      const axOrder = axOrders.find((o) => o.salesId === salesId);
      if (!axOrder || axOrder.isCancelled) {
        return { ok: false, error: `Sales order ${salesId} is cancelled or missing in AX.` };
      }
      const conflict = tickets.find(
        (t) =>
          t.status !== 'CANCELLED' &&
          t.status !== 'COLLECTED' &&
          t.status !== 'REJECTED' &&
          t.orders.some((o) => o.salesId === salesId && o.status !== 'CANCELLED')
      );
      if (conflict) {
        return { ok: false, error: `Sales order ${salesId} already has active ticket ${conflict.ticketNumber}.` };
      }
      ticketOrders.push(axOrder);
    }

    const seq = settings.nextSequenceNumber;
    const ticketNumber = padTicketNumber(settings.ticketPrefix, seq);
    const queuePosition =
      tickets.filter((t) => t.pickupDate === TODAY_ISO).reduce((max, t) => Math.max(max, t.queuePosition), 0) + 1;

    const newTicket: PickupTicket = {
      id: `tkt-${Date.now()}`,
      ticketNumber,
      pickupDate: TODAY_ISO,
      queuePosition,
      customerAccount: customer.accountNum,
      customerName: customer.name,
      dataAreaId: settings.dataAreaId,
      sourcePlanId: plan?.id ?? null,
      sourcePlanCode: plan?.planCode ?? null,
      driverName: input.driverName.trim() || plan?.representativeName || 'Walk-in Driver',
      vehiclePlate: input.vehiclePlate.trim() || 'N/A',
      isWalkIn: !plan,
      status: 'ARRIVED',
      arrivedAt: nowTime(),
      approvedAt: null,
      readyAt: null,
      collectedAt: null,
      creditHoldReason: null,
      orders: ticketOrders.map((o, idx) => ({
        id: `to-${Date.now()}-${idx}`,
        salesId: o.salesId,
        warehouseId: o.warehouseId,
        status: 'PENDING_CREDIT',
        creditStatus: 'PENDING',
        warehouseStatus: 'NOT_STARTED',
        axEligible: o.isEligible,
        axEligibilityStatus: o.eligibilityStatus,
        axIneligibilityReason: o.ineligibilityReason,
        axReference: null,
        operationKey: null,
        totalAmountSnapshot: o.totalAmount,
        currencyCode: o.currencyCode,
        decisionReason: null,
      })),
    };

    setSettings((prev) => ({ ...prev, nextSequenceNumber: prev.nextSequenceNumber + 1 }));
    setTickets((prev) => [...prev, newTicket]);

    if (plan) {
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, status: 'ARRIVED' } : p)));
    }
    const idemKey = input.idempotencyKey;
    if (idemKey) {
      setIdempotencyTickets((prev) => ({ ...prev, [idemKey]: newTicket.id }));
    }

    appendHistory([
      {
        entityType: 'Ticket',
        entityRef: newTicket.ticketNumber,
        ticketNumber: newTicket.ticketNumber,
        fromStatus: 'NEW',
        toStatus: 'ARRIVED',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: plan ? `Checked in from ${plan.planCode}` : 'Walk-in customer arrival',
      },
      ...(plan
        ? [
            {
              entityType: 'Plan' as const,
              entityRef: plan.planCode,
              ticketNumber: newTicket.ticketNumber,
              fromStatus: 'PLANNED',
              toStatus: 'ARRIVED',
              actorName: ROLE_DEFINITIONS[currentRole].userName,
              actorRole: currentRole,
              reason: `Issued ticket ${newTicket.ticketNumber}`,
            },
          ]
        : []),
    ]);

    pushToast('success', `Ticket ${newTicket.ticketNumber} issued`, `Queue #${queuePosition} · ${customer.name}`);
    return { ok: true, ticket: newTicket };
  };

  const holdTicket = (ticketId: string, reason: string) => {
    if (!['CreditManager', 'Supervisor', 'Administrator'].includes(currentRole)) {
      return { ok: false, error: 'Unauthorized: CreditManager, Supervisor, or Administrator required.' };
    }
    if (!reason.trim()) {
      return { ok: false, error: 'Mandatory reason is required to place a ticket on credit hold.' };
    }
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return { ok: false, error: 'Ticket not found.' };
    if (!['ARRIVED', 'ON_HOLD', 'REJECTED'].includes(ticket.status)) {
      return { ok: false, error: `Cannot place ticket on hold from status ${ticket.status}.` };
    }

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: 'ON_HOLD',
              creditHoldReason: reason.trim(),
              orders: t.orders.map((o) =>
                o.status === 'PENDING_CREDIT' || o.status === 'BLOCKED'
                  ? { ...o, creditStatus: 'ON_HOLD', decisionReason: reason.trim() }
                  : o
              ),
            }
          : t
      )
    );

    appendHistory([
      {
        entityType: 'Ticket',
        entityRef: ticket.ticketNumber,
        ticketNumber: ticket.ticketNumber,
        fromStatus: ticket.status,
        toStatus: 'ON_HOLD',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: reason.trim(),
      },
    ]);
    pushToast('warn', `Ticket ${ticket.ticketNumber} placed ON HOLD`, reason.trim());
    return { ok: true };
  };

  const rejectTicket = (ticketId: string, reason: string) => {
    if (!['CreditManager', 'Supervisor', 'Administrator'].includes(currentRole)) {
      return { ok: false, error: 'Unauthorized: CreditManager, Supervisor, or Administrator required.' };
    }
    if (!reason.trim()) {
      return { ok: false, error: 'Mandatory reason is required to reject a ticket.' };
    }
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return { ok: false, error: 'Ticket not found.' };
    if (!['ARRIVED', 'ON_HOLD'].includes(ticket.status)) {
      return { ok: false, error: `Cannot reject ticket from status ${ticket.status}.` };
    }

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: 'REJECTED',
              creditHoldReason: reason.trim(),
              orders: t.orders.map((o) => ({
                ...o,
                status: 'BLOCKED',
                creditStatus: 'REJECTED',
                decisionReason: reason.trim(),
              })),
            }
          : t
      )
    );

    appendHistory([
      {
        entityType: 'Ticket',
        entityRef: ticket.ticketNumber,
        ticketNumber: ticket.ticketNumber,
        fromStatus: ticket.status,
        toStatus: 'REJECTED',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: reason.trim(),
      },
    ]);
    pushToast('error', `Ticket ${ticket.ticketNumber} REJECTED`, reason.trim());
    return { ok: true };
  };

  const approveAndReleaseTicket = (
    ticketId: string,
    selectedSalesIds: string[],
    simulateAxTimeout = false
  ) => {
    if (!['CreditManager', 'Supervisor', 'Administrator'].includes(currentRole)) {
      return { ok: false, error: 'Unauthorized: CreditManager, Supervisor, or Administrator required.' };
    }
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return { ok: false, error: 'Ticket not found.' };
    if (!['ARRIVED', 'ON_HOLD', 'REJECTED'].includes(ticket.status)) {
      return { ok: false, error: `Ticket ${ticket.ticketNumber} is already ${ticket.status}.` };
    }
    if (selectedSalesIds.length === 0) {
      return { ok: false, error: 'Select at least one order to approve and release in AX.' };
    }

    const creditInfo = axCreditByCustomer[ticket.customerAccount];
    if (creditInfo?.hasCreditBlock) {
      return {
        ok: false,
        error: `AX validation blocked release: ${creditInfo.blockReason ?? 'Customer has a credit block in AX'}. Clear the AX block or place on hold.`,
      };
    }

    const stamp = nowTime();
    const historyBatch: Omit<WorkflowHistoryEntry, 'id' | 'timestamp'>[] = [];
    const newIntegrations: IntegrationAttemptEntry[] = [];
    let releasedCount = 0;
    let reconcilingCount = 0;

    const updatedOrders = ticket.orders.map((order) => {
      if (!selectedSalesIds.includes(order.salesId)) {
        return order;
      }
      const axOrder = axOrders.find((a) => a.salesId === order.salesId);
      if (!axOrder || axOrder.isCancelled) {
        historyBatch.push({
          entityType: 'Order',
          entityRef: order.salesId,
          ticketNumber: ticket.ticketNumber,
          fromStatus: order.status,
          toStatus: 'BLOCKED',
          actorName: ROLE_DEFINITIONS[currentRole].userName,
          actorRole: currentRole,
          reason: 'Sales order cancelled in AX during release validation',
        });
        return {
          ...order,
          status: 'BLOCKED' as PickupTicketOrderStatus,
          creditStatus: 'REJECTED' as const,
          axEligible: false,
          axIneligibilityReason: 'Sales order cancelled in AX',
        };
      }

      const operationKey = order.operationKey ?? `op-${ticket.ticketNumber}-${order.salesId}-${Date.now().toString().slice(-4)}`;

      if (simulateAxTimeout) {
        reconcilingCount++;
        newIntegrations.push({
          id: `int-${Date.now()}-${order.salesId}`,
          operationKey,
          salesId: order.salesId,
          ticketNumber: ticket.ticketNumber,
          status: 'RECONCILING',
          axReference: null,
          errorMessage: 'AX AIF endpoint timeout — awaiting idempotent reconciliation via operationKey.',
          attemptCount: 1,
          timestamp: stamp,
        });
        historyBatch.push({
          entityType: 'Order',
          entityRef: order.salesId,
          ticketNumber: ticket.ticketNumber,
          fromStatus: order.status,
          toStatus: 'RECONCILING',
          actorName: ROLE_DEFINITIONS[currentRole].userName,
          actorRole: currentRole,
          reason: `AX timeout (operationKey: ${operationKey}) — never marked RELEASED until AX confirms`,
        });
        return {
          ...order,
          status: 'RECONCILING' as PickupTicketOrderStatus,
          creditStatus: 'APPROVED' as const,
          operationKey,
          decisionReason: 'Approved by credit; awaiting AX confirmation',
        };
      }

      releasedCount++;
      const axReference = `AX-REL-${TODAY_ISO.replace(/-/g, '')}-${order.salesId}`;
      newIntegrations.push({
        id: `int-${Date.now()}-${order.salesId}`,
        operationKey,
        salesId: order.salesId,
        ticketNumber: ticket.ticketNumber,
        status: 'SUCCEEDED',
        axReference,
        errorMessage: null,
        attemptCount: 1,
        timestamp: stamp,
      });
      historyBatch.push({
        entityType: 'Order',
        entityRef: order.salesId,
        ticketNumber: ticket.ticketNumber,
        fromStatus: order.status,
        toStatus: 'RELEASED',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: `AX release confirmed (${axReference})`,
      });
      return {
        ...order,
        status: 'RELEASED' as PickupTicketOrderStatus,
        creditStatus: 'APPROVED' as const,
        operationKey,
        axReference,
        decisionReason: 'Approved & released in AX',
      };
    });

    // Update AX mock orders state for confirmed releases
    if (releasedCount > 0) {
      setAxOrders((prev) =>
        prev.map((a) =>
          selectedSalesIds.includes(a.salesId) && !simulateAxTimeout && !a.isCancelled
            ? { ...a, isReleased: true, axStatus: 'Released for pickup', warehouseProgress: 'Released' }
            : a
        )
      );
    }

    const nextTicketStatus: PickupTicketStatus = releasedCount > 0 ? 'APPROVED' : ticket.status;
    if (nextTicketStatus !== ticket.status) {
      historyBatch.unshift({
        entityType: 'Ticket',
        entityRef: ticket.ticketNumber,
        ticketNumber: ticket.ticketNumber,
        fromStatus: ticket.status,
        toStatus: nextTicketStatus,
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: `${releasedCount} order(s) confirmed released by AX`,
      });
    }

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: nextTicketStatus,
              approvedAt: nextTicketStatus === 'APPROVED' ? stamp : t.approvedAt,
              creditHoldReason: null,
              orders: updatedOrders,
            }
          : t
      )
    );
    setIntegrations((prev) => [...newIntegrations, ...prev]);
    appendHistory(historyBatch);

    if (reconcilingCount > 0) {
      pushToast(
        'warn',
        `AX Timeout on ${ticket.ticketNumber}`,
        `${reconcilingCount} order(s) moved to RECONCILING. Run "Reconcile with AX" to query GetPickupIntegrationStatus.`
      );
    } else {
      pushToast(
        'success',
        `Ticket ${ticket.ticketNumber} Approved`,
        `${releasedCount} sales order(s) confirmed RELEASED in AX and queued for Warehouse.`
      );
    }
    return { ok: true };
  };

  const reconcileOrderWithAx = (ticketId: string, orderId: string) => {
    if (!['CreditManager', 'Supervisor', 'Administrator'].includes(currentRole)) {
      return { ok: false, error: 'Unauthorized role to reconcile AX outbox.' };
    }
    const ticket = tickets.find((t) => t.id === ticketId);
    const order = ticket?.orders.find((o) => o.id === orderId);
    if (!ticket || !order || order.status !== 'RECONCILING') {
      return { ok: false, error: 'Order is not in RECONCILING state.' };
    }

    const axRef = `AX-REL-${TODAY_ISO.replace(/-/g, '')}-${order.salesId}`;
    const stamp = nowTime();

    setAxOrders((prev) =>
      prev.map((a) =>
        a.salesId === order.salesId
          ? { ...a, isReleased: true, axStatus: 'Released for pickup', warehouseProgress: 'Released' }
          : a
      )
    );

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        const orders = t.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'RELEASED' as PickupTicketOrderStatus,
                axReference: axRef,
                decisionReason: 'Reconciled via GetPickupIntegrationStatusAsync',
              }
            : o
        );
        const hasReleased = orders.some((o) => o.status === 'RELEASED');
        return {
          ...t,
          status: hasReleased && (t.status === 'ARRIVED' || t.status === 'ON_HOLD') ? 'APPROVED' : t.status,
          approvedAt: t.approvedAt ?? stamp,
          orders,
        };
      })
    );

    setIntegrations((prev) =>
      prev.map((item) =>
        item.operationKey === order.operationKey
          ? {
              ...item,
              status: 'SUCCEEDED',
              axReference: axRef,
              errorMessage: null,
              attemptCount: item.attemptCount + 1,
              timestamp: stamp,
            }
          : item
      )
    );

    appendHistory([
      {
        entityType: 'Order',
        entityRef: order.salesId,
        ticketNumber: ticket.ticketNumber,
        fromStatus: 'RECONCILING',
        toStatus: 'RELEASED',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: `Reconciled via operationKey ${order.operationKey} -> ${axRef}`,
      },
    ]);

    pushToast('success', `Reconciled ${order.salesId}`, `AX confirmed ${axRef}; order forwarded to Warehouse.`);
    return { ok: true };
  };

  const startOrderPreparation = (ticketId: string, orderId: string) => {
    if (!['WarehouseOperator', 'Supervisor', 'Administrator'].includes(currentRole)) {
      return { ok: false, error: 'Unauthorized: WarehouseOperator, Supervisor, or Administrator required.' };
    }
    const ticket = tickets.find((t) => t.id === ticketId);
    const order = ticket?.orders.find((o) => o.id === orderId);
    if (!ticket || !order) return { ok: false, error: 'Ticket or order not found.' };
    if (order.status !== 'RELEASED') {
      return { ok: false, error: `Order must be RELEASED in AX before preparation (current: ${order.status}).` };
    }

    setAxOrders((prev) =>
      prev.map((a) => (a.salesId === order.salesId ? { ...a, warehouseProgress: 'Picking' } : a))
    );

    const prevTicketStatus = ticket.status;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: t.status === 'APPROVED' ? 'IN_PREPARATION' : t.status,
              orders: t.orders.map((o) =>
                o.id === orderId
                  ? { ...o, status: 'IN_PREPARATION', warehouseStatus: 'IN_PREPARATION' }
                  : o
              ),
            }
          : t
      )
    );

    appendHistory([
      {
        entityType: 'Order',
        entityRef: order.salesId,
        ticketNumber: ticket.ticketNumber,
        fromStatus: 'RELEASED',
        toStatus: 'IN_PREPARATION',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: 'Warehouse picking started',
      },
      ...(prevTicketStatus === 'APPROVED'
        ? [
            {
              entityType: 'Ticket' as const,
              entityRef: ticket.ticketNumber,
              ticketNumber: ticket.ticketNumber,
              fromStatus: 'APPROVED',
              toStatus: 'IN_PREPARATION',
              actorName: ROLE_DEFINITIONS[currentRole].userName,
              actorRole: currentRole,
              reason: 'First order entered preparation',
            },
          ]
        : []),
    ]);
    pushToast('info', `${order.salesId} in preparation`, `Ticket ${ticket.ticketNumber}`);
    return { ok: true };
  };

  const markOrderReady = (ticketId: string, orderId: string) => {
    if (!['WarehouseOperator', 'Supervisor', 'Administrator'].includes(currentRole)) {
      return { ok: false, error: 'Unauthorized: WarehouseOperator, Supervisor, or Administrator required.' };
    }
    const ticket = tickets.find((t) => t.id === ticketId);
    const order = ticket?.orders.find((o) => o.id === orderId);
    if (!ticket || !order) return { ok: false, error: 'Ticket or order not found.' };
    if (order.status !== 'IN_PREPARATION' && order.status !== 'RELEASED') {
      return { ok: false, error: `Order cannot be marked ready from ${order.status}.` };
    }

    const stamp = nowTime();
    setAxOrders((prev) =>
      prev.map((a) => (a.salesId === order.salesId ? { ...a, warehouseProgress: 'Ready' } : a))
    );

    const nextOrders = ticket.orders.map((o) =>
      o.id === orderId
        ? { ...o, status: 'READY' as PickupTicketOrderStatus, warehouseStatus: 'READY' as const }
        : o
    );

    const activeOrders = nextOrders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'BLOCKED');
    const allActiveReady = activeOrders.length > 0 && activeOrders.every((o) => o.status === 'READY');

    const prevTicketStatus = ticket.status;
    const nextTicketStatus: PickupTicketStatus = allActiveReady ? 'READY' : 'IN_PREPARATION';

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: nextTicketStatus,
              readyAt: allActiveReady ? stamp : t.readyAt,
              orders: nextOrders,
            }
          : t
      )
    );

    const entries: Omit<WorkflowHistoryEntry, 'id' | 'timestamp'>[] = [
      {
        entityType: 'Order',
        entityRef: order.salesId,
        ticketNumber: ticket.ticketNumber,
        fromStatus: order.status,
        toStatus: 'READY',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: 'Staged at pickup dock',
      },
    ];
    if (allActiveReady && prevTicketStatus !== 'READY') {
      entries.push({
        entityType: 'Ticket',
        entityRef: ticket.ticketNumber,
        ticketNumber: ticket.ticketNumber,
        fromStatus: prevTicketStatus,
        toStatus: 'READY',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: 'All active sales orders marked READY — published to Public Display',
      });
    }
    appendHistory(entries);

    if (allActiveReady) {
      pushToast('success', `Ticket ${ticket.ticketNumber} is READY`, 'Ticket number published to Public Queue Display.');
    } else {
      const readyCount = activeOrders.filter((o) => o.status === 'READY').length;
      pushToast(
        'info',
        `${order.salesId} Ready (${readyCount}/${activeOrders.length})`,
        `Ticket ${ticket.ticketNumber} stays IN_PREPARATION until all active orders are ready.`
      );
    }
    return { ok: true };
  };

  const confirmTicketCollection = (ticketId: string) => {
    if (!['WarehouseOperator', 'Supervisor', 'Administrator'].includes(currentRole)) {
      return { ok: false, error: 'Unauthorized: WarehouseOperator, Supervisor, or Administrator required.' };
    }
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return { ok: false, error: 'Ticket not found.' };
    if (ticket.status !== 'READY') {
      return { ok: false, error: 'Ticket must be READY before confirming physical collection.' };
    }

    const stamp = nowTime();
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: 'COLLECTED',
              collectedAt: stamp,
              orders: t.orders.map((o) =>
                o.status === 'READY'
                  ? { ...o, status: 'COLLECTED', warehouseStatus: 'COLLECTED' }
                  : o
              ),
            }
          : t
      )
    );

    if (ticket.sourcePlanId) {
      setPlans((prev) =>
        prev.map((p) => (p.id === ticket.sourcePlanId ? { ...p, status: 'COMPLETED' } : p))
      );
    }

    appendHistory([
      {
        entityType: 'Ticket',
        entityRef: ticket.ticketNumber,
        ticketNumber: ticket.ticketNumber,
        fromStatus: 'READY',
        toStatus: 'COLLECTED',
        actorName: ROLE_DEFINITIONS[currentRole].userName,
        actorRole: currentRole,
        reason: 'Customer signature verified at pickup dock',
      },
    ]);

    pushToast('success', `Ticket ${ticket.ticketNumber} COLLECTED`, 'Removed from public display board.');
    return { ok: true };
  };

  const runAbsentCutoff = () => {
    const targetPlans = plans.filter((p) => p.status === 'PLANNED');
    if (targetPlans.length === 0) {
      pushToast('info', 'Absent Cutoff Worker', 'No remaining PLANNED appointments to mark absent.');
      return 0;
    }
    setPlans((prev) => prev.map((p) => (p.status === 'PLANNED' ? { ...p, status: 'ABSENT' } : p)));
    appendHistory(
      targetPlans.map((p) => ({
        entityType: 'Plan',
        entityRef: p.planCode,
        ticketNumber: null,
        fromStatus: 'PLANNED',
        toStatus: 'ABSENT',
        actorName: 'AbsentCutoffWorker',
        actorRole: currentRole,
        reason: `Cutoff ${settings.arrivalCutoffTime} (${settings.timeZoneId}) reached without customer check-in`,
      }))
    );
    pushToast('warn', `Absent cutoff applied (${targetPlans.length} plan(s))`, 'Unclaimed orders released back to eligible pool.');
    return targetPlans.length;
  };

  const updateSettings = (next: PickupSettings) => {
    if (currentRole !== 'Administrator') {
      return { ok: false, error: 'Only Administrators can modify PickupSettings.' };
    }
    setSettings(next);
    pushToast('success', 'PickupSettings saved', `Prefix ${next.ticketPrefix} · Cutoff ${next.arrivalCutoffTime}`);
    return { ok: true };
  };

  const clearCreditBlockInAxDemo = (customerAccount: string) => {
    setAxCreditByCustomer((prev) => {
      const existing = prev[customerAccount];
      if (!existing) return prev;
      return {
        ...prev,
        [customerAccount]: {
          ...existing,
          hasCreditBlock: false,
          creditLimit: Math.max(existing.creditLimit, existing.balance + 15000),
          blockReason: null,
        },
      };
    });
    pushToast('success', `AX Demo: Credit cleared for ${customerAccount}`, 'Credit limit raised and credit block removed in mock AX.');
  };

  const value = useMemo<PickupContextValue>(
    () => ({
      currentRole,
      activeRoute,
      settings,
      axCustomers,
      axCreditByCustomer,
      axOrders,
      plans,
      tickets,
      history,
      integrations,
      toasts,
      canAccessRoute,
      switchRole,
      navigate,
      dismissToast,
      createPlan,
      cancelPlan,
      issueTicket,
      holdTicket,
      rejectTicket,
      approveAndReleaseTicket,
      reconcileOrderWithAx,
      startOrderPreparation,
      markOrderReady,
      confirmTicketCollection,
      runAbsentCutoff,
      updateSettings,
      clearCreditBlockInAxDemo,
      isSalesIdActiveInPlanOrTicket,
    }),
    [currentRole, activeRoute, settings, axCustomers, axCreditByCustomer, axOrders, plans, tickets, history, integrations, toasts]
  );

  return <PickupContext.Provider value={value}>{children}</PickupContext.Provider>;
};

export function usePickup(): PickupContextValue {
  const ctx = useContext(PickupContext);
  if (!ctx) {
    throw new Error('usePickup must be used inside PickupProvider');
  }
  return ctx;
}
