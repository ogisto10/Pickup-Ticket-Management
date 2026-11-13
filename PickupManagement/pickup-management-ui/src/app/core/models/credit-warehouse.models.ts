import {
  OrderCreditStatus,
  OrderWarehouseStatus,
  PickupTicketOrderStatus,
  PickupTicketStatus,
  TicketDetail
} from './ticket.models';

export interface AxCustomerCreditInfo {
  customerAccount: string;
  dataAreaId: string;
  balance: number;
  creditLimit: number;
  openOrdersAmount: number;
  currencyCode: string;
  hasCreditBlock: boolean;
  blockReason?: string | null;
}

export interface CreditOrderContext {
  orderId: string;
  dataAreaId: string;
  salesId: string;
  status: PickupTicketOrderStatus;
  creditStatus: OrderCreditStatus;
  isEligible: boolean;
  isAlreadyReleased: boolean;
  isCancelled: boolean;
  axStatus: string;
  eligibilityLabel: string;
  blockingReason?: string | null;
  lastAxSyncAt?: string | null;
}

export interface TicketCreditContext {
  ticket: TicketDetail;
  customerCredit?: AxCustomerCreditInfo | null;
  orders: CreditOrderContext[];
}

export interface CreditOrderDecisionInput {
  salesId: string;
  approveForRelease: boolean;
}

export interface CreditDecisionRequest {
  decision: 'APPROVED' | 'ON_HOLD' | 'REJECTED';
  comment?: string | null;
  orders?: CreditOrderDecisionInput[];
}

export interface CreditOrderResult {
  orderId: string;
  salesId: string;
  creditStatus: OrderCreditStatus;
  orderStatus: PickupTicketOrderStatus;
  releaseOutcome: string;
  axReference?: string | null;
  errorMessage?: string | null;
}

export interface CreditDecisionResponse {
  ticketId: string;
  ticketNumber: string;
  ticketStatus: PickupTicketStatus;
  decision: OrderCreditStatus;
  comment?: string | null;
  orders: CreditOrderResult[];
}

export interface OrderPreparationResult {
  ticketId: string;
  ticketNumber: string;
  ticketStatus: PickupTicketStatus;
  orderId: string;
  salesId: string;
  orderStatus: PickupTicketOrderStatus;
  warehouseStatus: OrderWarehouseStatus;
  ticketReadyForCollection: boolean;
  readyAt?: string | null;
}

export interface CollectionResult {
  ticketId: string;
  ticketNumber: string;
  ticketStatus: PickupTicketStatus;
  collectedAt: string;
  collectedBy: string;
}
