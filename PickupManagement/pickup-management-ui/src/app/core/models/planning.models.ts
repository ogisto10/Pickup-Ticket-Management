export type PickupPlanStatus =
  | 'PLANNED'
  | 'ARRIVED'
  | 'ABSENT'
  | 'CANCELLED'
  | 'COMPLETED';

export interface AxCustomer {
  accountNum: string;
  name: string;
  dataAreaId: string;
  isActive: boolean;
  blockedStatus?: string | null;
}

export interface CustomerOrderLookup {
  salesId: string;
  dataAreaId: string;
  warehouseId: string;
  orderDate: string;
  axStatus: string;
  isEligible: boolean;
  eligibilityStatus: string;
  ineligibilityReason?: string | null;
  totalAmount: number;
  currencyCode: string;
  isAlreadyPlanned: boolean;
  existingPlanId?: string | null;
}

export interface CustomerOrdersResponse {
  customerAccount: string;
  customerName: string;
  alreadyPlannedForSelectedDate: boolean;
  orders: CustomerOrderLookup[];
}

export interface PickupPlanOrderItem {
  id: string;
  dataAreaId: string;
  salesId: string;
  orderStatusSnapshot?: string | null;
}

export interface PickupPlanListItem {
  id: string;
  customerAccount: string;
  customerNameSnapshot: string;
  pickupDate: string;
  warehouseId: string;
  status: PickupPlanStatus;
  orderCount: number;
  orders: PickupPlanOrderItem[];
  notes?: string | null;
  createdBy: string;
  updatedAt: string;
}

export interface CreatePickupPlanRequest {
  customerAccount: string;
  pickupDate: string;
  warehouseId: string;
  salesOrders: string[];
  notes?: string | null;
}

export interface UpdatePickupPlanRequest {
  pickupDate: string;
  warehouseId: string;
  salesOrders: string[];
  notes?: string | null;
}

export interface PickupPlanResponse {
  id: string;
  customerAccount: string;
  customerNameSnapshot: string;
  pickupDate: string;
  warehouseId: string;
  status: PickupPlanStatus;
  salesOrders: string[];
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
