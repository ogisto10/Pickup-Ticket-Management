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

export type OrderCreditStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ON_HOLD';
export type OrderWarehouseStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COLLECTED';

export interface ArrivalTicketResponse {
  ticketId: string;
  ticketNumber: string;
  queueNumber: number;
  status: PickupTicketStatus;
  arrivalTime: string;
  customerAccount: string;
  customerName: string;
  orderCount: number;
}

export interface WalkInArrivalRequest {
  customerAccount: string;
  warehouseId: string;
  salesOrders: string[];
  notes?: string | null;
}

export interface TicketQueueItem {
  ticketId: string;
  pickupPlanId: string;
  ticketDate: string;
  ticketNumber: string;
  queueNumber: number;
  arrivalTime: string;
  customerAccount: string;
  customerName: string;
  warehouseId: string;
  status: PickupTicketStatus;
  orderCount: number;
  readyOrderCount: number;
  creditComment?: string | null;
}

export interface TicketOrderDetail {
  id: string;
  pickupPlanOrderId: string;
  dataAreaId: string;
  salesId: string;
  status: PickupTicketOrderStatus;
  creditStatus: OrderCreditStatus;
  warehouseStatus: OrderWarehouseStatus;
  lastAxSyncAt?: string | null;
}

export interface TicketDetail {
  ticketId: string;
  pickupPlanId: string;
  ticketDate: string;
  dailySequence: number;
  ticketNumber: string;
  queueNumber: number;
  arrivalTime: string;
  customerAccount: string;
  customerName: string;
  warehouseId: string;
  status: PickupTicketStatus;
  creditDecisionBy?: string | null;
  creditDecisionAt?: string | null;
  creditComment?: string | null;
  readyAt?: string | null;
  collectedAt?: string | null;
  orders: TicketOrderDetail[];
}
