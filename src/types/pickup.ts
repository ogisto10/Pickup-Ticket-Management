export type AppRole =
  | 'Commercial'
  | 'Reception'
  | 'CreditManager'
  | 'WarehouseOperator'
  | 'Supervisor'
  | 'Administrator'
  | 'DisplayDevice';

export type PickupPlanStatus = 'PLANNED' | 'ARRIVED' | 'ABSENT' | 'CANCELLED' | 'COMPLETED';

export type PickupTicketStatus =
  | 'ARRIVED'
  | 'APPROVED'
  | 'ON_HOLD'
  | 'REJECTED'
  | 'IN_PREPARATION'
  | 'READY'
  | 'COLLECTED'
  | 'CANCELLED';

export type PickupTicketOrderStatus =
  | 'PENDING_CREDIT'
  | 'RELEASE_PENDING'
  | 'RECONCILING'
  | 'RELEASED'
  | 'IN_PREPARATION'
  | 'READY'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'COLLECTED';

export type OrderCreditStatus = 'PENDING' | 'APPROVED' | 'ON_HOLD' | 'REJECTED';

export type OrderWarehouseStatus = 'NOT_STARTED' | 'IN_PREPARATION' | 'READY' | 'COLLECTED';

export type QueuePolicy = 'ArrivalOrder' | 'PriorityAndArrival';

export type PartialOrderPolicy = 'RequireAllActiveOrdersReady' | 'AllowSplitCancelledOrders';

export interface AxCustomer {
  accountNum: string;
  name: string;
  dataAreaId: string;
  isActive: boolean;
  blockedStatus: string | null;
}

export interface AxCustomerCreditInfo {
  accountNum: string;
  dataAreaId: string;
  balance: number;
  creditLimit: number;
  openOrdersAmount: number;
  currencyCode: string;
  hasCreditBlock: boolean;
  blockReason: string | null;
}

export interface AxSalesOrder {
  salesId: string;
  dataAreaId: string;
  customerAccount: string;
  warehouseId: string;
  orderDate: string;
  axStatus: string;
  isEligible: boolean;
  eligibilityStatus: string;
  ineligibilityReason: string | null;
  totalAmount: number;
  currencyCode: string;
  isReleased: boolean;
  isCancelled: boolean;
  warehouseProgress: string;
}

export interface PickupPlanOrder {
  id: string;
  salesId: string;
  warehouseId: string;
  axStatusAtPlanning: string;
  totalAmountSnapshot: number;
  currencyCode: string;
}

export interface PickupPlan {
  id: string;
  planCode: string;
  customerAccount: string;
  customerName: string;
  dataAreaId: string;
  plannedDate: string;
  plannedWindow: string;
  representativeName: string;
  representativePhone: string;
  notes: string;
  status: PickupPlanStatus;
  createdBy: string;
  createdAt: string;
  orders: PickupPlanOrder[];
}

export interface PickupTicketOrder {
  id: string;
  salesId: string;
  warehouseId: string;
  status: PickupTicketOrderStatus;
  creditStatus: OrderCreditStatus;
  warehouseStatus: OrderWarehouseStatus;
  axEligible: boolean;
  axEligibilityStatus: string;
  axIneligibilityReason: string | null;
  axReference: string | null;
  operationKey: string | null;
  totalAmountSnapshot: number;
  currencyCode: string;
  decisionReason: string | null;
}

export interface PickupTicket {
  id: string;
  ticketNumber: string;
  pickupDate: string;
  queuePosition: number;
  customerAccount: string;
  customerName: string;
  dataAreaId: string;
  sourcePlanId: string | null;
  sourcePlanCode: string | null;
  driverName: string;
  vehiclePlate: string;
  isWalkIn: boolean;
  status: PickupTicketStatus;
  arrivedAt: string;
  approvedAt: string | null;
  readyAt: string | null;
  collectedAt: string | null;
  creditHoldReason: string | null;
  orders: PickupTicketOrder[];
}

export interface WorkflowHistoryEntry {
  id: string;
  entityType: 'Plan' | 'Ticket' | 'Order';
  entityRef: string;
  ticketNumber: string | null;
  fromStatus: string;
  toStatus: string;
  actorName: string;
  actorRole: AppRole;
  reason: string | null;
  timestamp: string;
}

export interface IntegrationAttemptEntry {
  id: string;
  operationKey: string;
  salesId: string;
  ticketNumber: string;
  status: 'SUCCEEDED' | 'RECONCILING' | 'FAILED';
  axReference: string | null;
  errorMessage: string | null;
  attemptCount: number;
  timestamp: string;
}

export interface PickupSettings {
  ticketPrefix: string;
  nextSequenceNumber: number;
  lastSequenceDate: string;
  timeZoneId: string;
  dataAreaId: string;
  defaultWarehouseId: string;
  queuePolicy: QueuePolicy;
  partialOrderPolicy: PartialOrderPolicy;
  arrivalCutoffTime: string;
  axReleaseClassName: string;
}

export type AppRoute =
  | 'dashboard'
  | 'planning'
  | 'planning-new'
  | 'reception'
  | 'reception-queue'
  | 'credit'
  | 'warehouse'
  | 'pickup-display'
  | 'history'
  | 'admin-settings';

export interface ToastNotification {
  id: string;
  severity: 'success' | 'info' | 'warn' | 'error';
  title: string;
  detail: string;
}
