import express, { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const PORT = Number(process.env.PORT || 3000);

type AppRole =
  | 'Commercial'
  | 'Reception'
  | 'CreditManager'
  | 'WarehouseOperator'
  | 'Supervisor'
  | 'Administrator'
  | 'DisplayDevice';

interface UserRecord {
  id: string;
  userName: string;
  fullName: string;
  email: string;
  warehouseId: string;
  roles: AppRole[];
}

interface AxCustomerRecord {
  accountNum: string;
  name: string;
  dataAreaId: string;
  isActive: boolean;
  blockedStatus: string | null;
  balance: number;
  creditLimit: number;
  openOrdersAmount: number;
  hasCreditBlock: boolean;
  blockReason: string | null;
}

interface AxSalesOrderRecord {
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
}

type PickupPlanStatus = 'PLANNED' | 'ARRIVED' | 'ABSENT' | 'CANCELLED' | 'COMPLETED';
type PickupTicketStatus =
  | 'ARRIVED'
  | 'APPROVED'
  | 'ON_HOLD'
  | 'REJECTED'
  | 'IN_PREPARATION'
  | 'READY'
  | 'COLLECTED'
  | 'CANCELLED';

type PickupTicketOrderStatus =
  | 'PENDING_CREDIT'
  | 'RELEASE_PENDING'
  | 'RECONCILING'
  | 'RELEASED'
  | 'IN_PREPARATION'
  | 'READY'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'COLLECTED';

interface PickupPlanOrderRecord {
  id: string;
  dataAreaId: string;
  salesId: string;
  orderStatusSnapshot: string | null;
}

interface PickupPlanRecord {
  id: string;
  customerAccount: string;
  customerNameSnapshot: string;
  pickupDate: string;
  warehouseId: string;
  status: PickupPlanStatus;
  orders: PickupPlanOrderRecord[];
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketOrderRecord {
  id: string;
  pickupPlanOrderId: string;
  dataAreaId: string;
  salesId: string;
  status: PickupTicketOrderStatus;
  creditStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ON_HOLD';
  warehouseStatus: 'PENDING' | 'PREPARING' | 'READY' | 'COLLECTED';
  lastAxSyncAt: string | null;
  axReference: string | null;
  blockingReason: string | null;
}

interface WorkflowEventRecord {
  oldStatus: string | null;
  newStatus: string;
  action: string;
  comment: string | null;
  userId: string;
  occurredAt: string;
  correlationId: string;
  salesId?: string | null;
}

interface TicketRecord {
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
  creditDecisionBy: string | null;
  creditDecisionAt: string | null;
  creditComment: string | null;
  readyAt: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  orders: TicketOrderRecord[];
  ticketEvents: WorkflowEventRecord[];
  orderEvents: WorkflowEventRecord[];
}

interface PickupSettingsRecord {
  id: string;
  warehouseId: string;
  ticketPrefix: string;
  nextDailySequence: number;
  businessTimeZone: string;
  queuePolicy: 'FIFO' | 'PRIORITY_OVERRIDE';
  axDataAreaId: string;
  partialOrderPolicy: 'BLOCK_TICKET' | 'ALLOW_REMOVAL_BY_SUPERVISOR';
  currentSequenceDate: string | null;
  arrivalCutoffTime: string | null;
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY = dateOffset(0);
const TOMORROW = dateOffset(1);

const DEV_PASSWORD = process.env.DEVELOPMENT_SEED_PASSWORD || 'PickupDev!2026';

const USERS: UserRecord[] = [
  { id: 'u-commercial', userName: 'commercial', fullName: 'Commercial Operator', email: 'commercial@pickup.local', warehouseId: 'MAIN', roles: ['Commercial'] },
  { id: 'u-reception', userName: 'reception', fullName: 'Reception Operator', email: 'reception@pickup.local', warehouseId: 'MAIN', roles: ['Reception'] },
  { id: 'u-credit', userName: 'credit', fullName: 'Credit Manager', email: 'credit@pickup.local', warehouseId: 'MAIN', roles: ['CreditManager'] },
  { id: 'u-warehouse', userName: 'warehouse', fullName: 'Warehouse Operator', email: 'warehouse@pickup.local', warehouseId: 'MAIN', roles: ['WarehouseOperator'] },
  { id: 'u-supervisor', userName: 'supervisor', fullName: 'Operations Supervisor', email: 'supervisor@pickup.local', warehouseId: 'MAIN', roles: ['Supervisor'] },
  { id: 'u-admin', userName: 'admin', fullName: 'System Administrator', email: 'admin@pickup.local', warehouseId: 'MAIN', roles: ['Administrator'] },
  { id: 'u-display', userName: 'display', fullName: 'Reception Display Terminal', email: 'display@pickup.local', warehouseId: 'MAIN', roles: ['DisplayDevice'] }
];

const tokens = new Map<string, UserRecord>();
const idempotencyStore = new Map<string, { status: number; body: unknown }>();

const AX_CUSTOMERS: AxCustomerRecord[] = [
  { accountNum: '411-021', name: 'Atlas Building Supplies', dataAreaId: 'DAT', isActive: true, blockedStatus: null, balance: 18500, creditLimit: 50000, openOrdersAmount: 14200, hasCreditBlock: false, blockReason: null },
  { accountNum: '411-035', name: 'Horizon Industrial Group', dataAreaId: 'DAT', isActive: true, blockedStatus: null, balance: 48200, creditLimit: 50000, openOrdersAmount: 9600, hasCreditBlock: false, blockReason: 'Near credit limit - review required' },
  { accountNum: '411-048', name: 'Meridian Logistics Co.', dataAreaId: 'DAT', isActive: true, blockedStatus: null, balance: 62400, creditLimit: 60000, openOrdersAmount: 7800, hasCreditBlock: true, blockReason: 'Credit limit exceeded in AX' },
  { accountNum: '411-090', name: 'Northstar Retail Partners', dataAreaId: 'DAT', isActive: true, blockedStatus: null, balance: 4200, creditLimit: 35000, openOrdersAmount: 5100, hasCreditBlock: false, blockReason: null },
  { accountNum: '411-999', name: 'Inactive Account Demo', dataAreaId: 'DAT', isActive: false, blockedStatus: 'All', balance: 0, creditLimit: 0, openOrdersAmount: 0, hasCreditBlock: true, blockReason: 'Customer stopped for invoicing and delivery' }
];

const AX_ORDERS: AxSalesOrderRecord[] = [
  { salesId: 'SO-001258', dataAreaId: 'DAT', customerAccount: '411-021', warehouseId: 'MAIN', orderDate: dateOffset(-2), axStatus: 'Open order', isEligible: true, eligibilityStatus: 'Eligible', ineligibilityReason: null, totalAmount: 4800, currencyCode: 'USD', isReleased: false, isCancelled: false },
  { salesId: 'SO-001264', dataAreaId: 'DAT', customerAccount: '411-021', warehouseId: 'MAIN', orderDate: dateOffset(-1), axStatus: 'Open order', isEligible: true, eligibilityStatus: 'Review required', ineligibilityReason: null, totalAmount: 5200, currencyCode: 'USD', isReleased: false, isCancelled: false },
  { salesId: 'SO-001275', dataAreaId: 'DAT', customerAccount: '411-021', warehouseId: 'MAIN', orderDate: TODAY, axStatus: 'Open order', isEligible: true, eligibilityStatus: 'Eligible', ineligibilityReason: null, totalAmount: 4200, currencyCode: 'USD', isReleased: false, isCancelled: false },
  { salesId: 'SO-001281', dataAreaId: 'DAT', customerAccount: '411-021', warehouseId: 'MAIN', orderDate: TODAY, axStatus: 'Canceled', isEligible: false, eligibilityStatus: 'Ineligible', ineligibilityReason: 'Sales order is cancelled in AX', totalAmount: 1900, currencyCode: 'USD', isReleased: false, isCancelled: true },
  { salesId: 'SO-001301', dataAreaId: 'DAT', customerAccount: '411-035', warehouseId: 'MAIN', orderDate: dateOffset(-1), axStatus: 'Released for pickup', isEligible: true, eligibilityStatus: 'Eligible', ineligibilityReason: null, totalAmount: 6100, currencyCode: 'USD', isReleased: true, isCancelled: false },
  { salesId: 'SO-001304', dataAreaId: 'DAT', customerAccount: '411-035', warehouseId: 'MAIN', orderDate: TODAY, axStatus: 'Open order', isEligible: true, eligibilityStatus: 'Review required', ineligibilityReason: null, totalAmount: 3500, currencyCode: 'USD', isReleased: false, isCancelled: false },
  { salesId: 'SO-001410', dataAreaId: 'DAT', customerAccount: '411-048', warehouseId: 'MAIN', orderDate: TODAY, axStatus: 'Open order', isEligible: true, eligibilityStatus: 'Review required', ineligibilityReason: null, totalAmount: 7800, currencyCode: 'USD', isReleased: false, isCancelled: false },
  { salesId: 'SO-001502', dataAreaId: 'DAT', customerAccount: '411-090', warehouseId: 'MAIN', orderDate: TODAY, axStatus: 'Open order', isEligible: true, eligibilityStatus: 'Eligible', ineligibilityReason: null, totalAmount: 5100, currencyCode: 'USD', isReleased: false, isCancelled: false }
];

const settingsStore: PickupSettingsRecord[] = [
  {
    id: 'set-main',
    warehouseId: 'MAIN',
    ticketPrefix: 'A-',
    nextDailySequence: 3,
    businessTimeZone: 'UTC',
    queuePolicy: 'FIFO',
    axDataAreaId: 'DAT',
    partialOrderPolicy: 'BLOCK_TICKET',
    currentSequenceDate: TODAY,
    arrivalCutoffTime: '17:00:00'
  }
];

const nowIso = () => new Date().toISOString();

const pickupPlans: PickupPlanRecord[] = [
  {
    id: 'plan-1',
    customerAccount: '411-021',
    customerNameSnapshot: 'Atlas Building Supplies',
    pickupDate: TODAY,
    warehouseId: 'MAIN',
    status: 'PLANNED',
    orders: [
      { id: 'po-1', dataAreaId: 'DAT', salesId: 'SO-001258', orderStatusSnapshot: 'Open order' },
      { id: 'po-2', dataAreaId: 'DAT', salesId: 'SO-001264', orderStatusSnapshot: 'Open order' }
    ],
    notes: 'Flatbed truck arriving before noon',
    createdBy: 'commercial',
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: 'plan-2',
    customerAccount: '411-090',
    customerNameSnapshot: 'Northstar Retail Partners',
    pickupDate: TODAY,
    warehouseId: 'MAIN',
    status: 'ARRIVED',
    orders: [
      { id: 'po-3', dataAreaId: 'DAT', salesId: 'SO-001502', orderStatusSnapshot: 'Open order' }
    ],
    notes: 'Driver at Gate 2',
    createdBy: 'commercial',
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: 'plan-3',
    customerAccount: '411-035',
    customerNameSnapshot: 'Horizon Industrial Group',
    pickupDate: TODAY,
    warehouseId: 'MAIN',
    status: 'ARRIVED',
    orders: [
      { id: 'po-4', dataAreaId: 'DAT', salesId: 'SO-001301', orderStatusSnapshot: 'Open order' }
    ],
    notes: 'Priority dock pickup',
    createdBy: 'commercial',
    createdAt: nowIso(),
    updatedAt: nowIso()
  },
  {
    id: 'plan-4',
    customerAccount: '411-035',
    customerNameSnapshot: 'Horizon Industrial Group',
    pickupDate: TOMORROW,
    warehouseId: 'MAIN',
    status: 'PLANNED',
    orders: [
      { id: 'po-5', dataAreaId: 'DAT', salesId: 'SO-001304', orderStatusSnapshot: 'Open order' }
    ],
    notes: 'Scheduled tomorrow morning',
    createdBy: 'commercial',
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
];

const tickets: TicketRecord[] = [
  {
    ticketId: 'tkt-1',
    pickupPlanId: 'plan-2',
    ticketDate: TODAY,
    dailySequence: 1,
    ticketNumber: 'A-001',
    queueNumber: 1,
    arrivalTime: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    customerAccount: '411-090',
    customerName: 'Northstar Retail Partners',
    warehouseId: 'MAIN',
    status: 'ARRIVED',
    creditDecisionBy: null,
    creditDecisionAt: null,
    creditComment: null,
    readyAt: null,
    collectedAt: null,
    collectedBy: null,
    orders: [
      {
        id: 'to-1',
        pickupPlanOrderId: 'po-3',
        dataAreaId: 'DAT',
        salesId: 'SO-001502',
        status: 'PENDING_CREDIT',
        creditStatus: 'PENDING',
        warehouseStatus: 'PENDING',
        lastAxSyncAt: null,
        axReference: null,
        blockingReason: null
      }
    ],
    ticketEvents: [
      {
        oldStatus: null,
        newStatus: 'ARRIVED',
        action: 'ARRIVAL_CONFIRMED',
        comment: 'Issued at Reception Desk',
        userId: 'reception',
        occurredAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        correlationId: 'seed-1'
      }
    ],
    orderEvents: [
      {
        oldStatus: null,
        newStatus: 'PENDING_CREDIT',
        action: 'ORDER_ATTACHED',
        comment: null,
        userId: 'reception',
        occurredAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        correlationId: 'seed-1',
        salesId: 'SO-001502'
      }
    ]
  },
  {
    ticketId: 'tkt-2',
    pickupPlanId: 'plan-3',
    ticketDate: TODAY,
    dailySequence: 2,
    ticketNumber: 'A-002',
    queueNumber: 2,
    arrivalTime: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    customerAccount: '411-035',
    customerName: 'Horizon Industrial Group',
    warehouseId: 'MAIN',
    status: 'READY',
    creditDecisionBy: 'credit',
    creditDecisionAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    creditComment: 'Credit balance verified and approved',
    readyAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    collectedAt: null,
    collectedBy: null,
    orders: [
      {
        id: 'to-2',
        pickupPlanOrderId: 'po-4',
        dataAreaId: 'DAT',
        salesId: 'SO-001301',
        status: 'READY',
        creditStatus: 'APPROVED',
        warehouseStatus: 'READY',
        lastAxSyncAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        axReference: `AX-REL-${TODAY.replace(/-/g, '')}-SO-001301`,
        blockingReason: null
      }
    ],
    ticketEvents: [
      {
        oldStatus: null,
        newStatus: 'ARRIVED',
        action: 'ARRIVAL_CONFIRMED',
        comment: null,
        userId: 'reception',
        occurredAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        correlationId: 'seed-2'
      },
      {
        oldStatus: 'ARRIVED',
        newStatus: 'APPROVED',
        action: 'CREDIT_DECISION',
        comment: 'Credit balance verified and approved',
        userId: 'credit',
        occurredAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        correlationId: 'seed-3'
      },
      {
        oldStatus: 'IN_PREPARATION',
        newStatus: 'READY',
        action: 'TICKET_READY',
        comment: 'All sales orders staged for pickup',
        userId: 'warehouse',
        occurredAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        correlationId: 'seed-4'
      }
    ],
    orderEvents: [
      {
        oldStatus: 'PENDING_CREDIT',
        newStatus: 'RELEASED',
        action: 'AX_RELEASE',
        comment: 'Released via AX AIF adapter',
        userId: 'credit',
        occurredAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        correlationId: 'seed-3',
        salesId: 'SO-001301'
      },
      {
        oldStatus: 'IN_PREPARATION',
        newStatus: 'READY',
        action: 'ORDER_READY',
        comment: 'Pallet ready at Gate 1',
        userId: 'warehouse',
        occurredAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        correlationId: 'seed-4',
        salesId: 'SO-001301'
      }
    ]
  }
];

interface AuthedRequest extends Request {
  user?: UserRecord;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const user = tokens.get(token);
  if (!user) {
    res.status(401).json({ detail: 'Authentication required.' });
    return;
  }
  req.user = user;
  next();
}

function requireRoles(allowed: AppRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const roles = req.user?.roles || [];
    if (!allowed.some((r) => roles.includes(r))) {
      res.status(403).json({ detail: 'Insufficient permissions for this operation.' });
      return;
    }
    next();
  };
}

function checkIdempotency(req: Request, res: Response): string | null {
  const key = (req.headers['idempotency-key'] as string | undefined)?.trim();
  if (!key) return null;
  const scopedKey = `${req.method}:${req.path}:${key}`;
  const cached = idempotencyStore.get(scopedKey);
  if (cached) {
    res.status(cached.status).json(cached.body);
    return '__REPLAYED__';
  }
  return scopedKey;
}

function sendIdempotent(res: Response, cacheKey: string | null, status: number, body: unknown): void {
  if (cacheKey && cacheKey !== '__REPLAYED__') {
    idempotencyStore.set(cacheKey, { status, body });
  }
  res.status(status).json(body);
}

function toQueueItem(t: TicketRecord) {
  return {
    ticketId: t.ticketId,
    pickupPlanId: t.pickupPlanId,
    ticketDate: t.ticketDate,
    ticketNumber: t.ticketNumber,
    queueNumber: t.queueNumber,
    arrivalTime: t.arrivalTime,
    customerAccount: t.customerAccount,
    customerName: t.customerName,
    warehouseId: t.warehouseId,
    status: t.status,
    orderCount: t.orders.filter((o) => o.status !== 'CANCELLED').length,
    readyOrderCount: t.orders.filter((o) => o.status === 'READY' || o.status === 'COLLECTED').length,
    creditComment: t.creditComment
  };
}

function toTicketDetail(t: TicketRecord) {
  return {
    ticketId: t.ticketId,
    pickupPlanId: t.pickupPlanId,
    ticketDate: t.ticketDate,
    dailySequence: t.dailySequence,
    ticketNumber: t.ticketNumber,
    queueNumber: t.queueNumber,
    arrivalTime: t.arrivalTime,
    customerAccount: t.customerAccount,
    customerName: t.customerName,
    warehouseId: t.warehouseId,
    status: t.status,
    creditDecisionBy: t.creditDecisionBy,
    creditDecisionAt: t.creditDecisionAt,
    creditComment: t.creditComment,
    readyAt: t.readyAt,
    collectedAt: t.collectedAt,
    orders: t.orders.map((o) => ({
      id: o.id,
      pickupPlanOrderId: o.pickupPlanOrderId,
      dataAreaId: o.dataAreaId,
      salesId: o.salesId,
      status: o.status,
      creditStatus: o.creditStatus,
      warehouseStatus: o.warehouseStatus,
      lastAxSyncAt: o.lastAxSyncAt
    }))
  };
}

function issueTicketForPlan(plan: PickupPlanRecord, actor: string): TicketRecord {
  const existing = tickets.find((t) => t.pickupPlanId === plan.id && t.status !== 'CANCELLED');
  if (existing) return existing;

  const settings = settingsStore.find((s) => s.warehouseId === plan.warehouseId) ?? settingsStore[0];
  if (settings.currentSequenceDate !== TODAY) {
    settings.currentSequenceDate = TODAY;
    settings.nextDailySequence = 1;
  }

  const seq = settings.nextDailySequence++;
  const ticketNumber = `${settings.ticketPrefix}${String(seq).padStart(3, '0')}`;
  const todayTickets = tickets.filter((t) => t.ticketDate === TODAY);
  const queueNumber = todayTickets.length + 1;
  const arrivalTime = nowIso();
  const correlationId = crypto.randomUUID();

  const newTicket: TicketRecord = {
    ticketId: `tkt-${crypto.randomUUID().slice(0, 8)}`,
    pickupPlanId: plan.id,
    ticketDate: TODAY,
    dailySequence: seq,
    ticketNumber,
    queueNumber,
    arrivalTime,
    customerAccount: plan.customerAccount,
    customerName: plan.customerNameSnapshot,
    warehouseId: plan.warehouseId,
    status: 'ARRIVED',
    creditDecisionBy: null,
    creditDecisionAt: null,
    creditComment: null,
    readyAt: null,
    collectedAt: null,
    collectedBy: null,
    orders: plan.orders.map((po, idx) => ({
      id: `to-${Date.now()}-${idx}`,
      pickupPlanOrderId: po.id,
      dataAreaId: po.dataAreaId,
      salesId: po.salesId,
      status: 'PENDING_CREDIT',
      creditStatus: 'PENDING',
      warehouseStatus: 'PENDING',
      lastAxSyncAt: null,
      axReference: null,
      blockingReason: null
    })),
    ticketEvents: [
      {
        oldStatus: null,
        newStatus: 'ARRIVED',
        action: 'ARRIVAL_CONFIRMED',
        comment: 'Issued daily pickup ticket',
        userId: actor,
        occurredAt: arrivalTime,
        correlationId
      }
    ],
    orderEvents: plan.orders.map((po) => ({
      oldStatus: null,
      newStatus: 'PENDING_CREDIT',
      action: 'ORDER_ATTACHED',
      comment: null,
      userId: actor,
      occurredAt: arrivalTime,
      correlationId,
      salesId: po.salesId
    }))
  };

  plan.status = 'ARRIVED';
  plan.updatedAt = arrivalTime;
  tickets.push(newTicket);
  return newTicket;
}

const app = express();
app.use(express.json());

// Auth
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { userName, password } = req.body as { userName?: string; password?: string };
  const normalized = (userName || '').trim().toLowerCase();
  const user = USERS.find((u) => u.userName.toLowerCase() === normalized);

  if (!user || password !== DEV_PASSWORD) {
    res.status(401).json({ detail: 'Invalid username or password.' });
    return;
  }

  const accessToken = `pickup-jwt-${crypto.randomBytes(24).toString('hex')}`;
  tokens.set(accessToken, user);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  res.json({ accessToken, expiresAt, user });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
  res.json(req.user);
});

// AX Customer & Order Lookups
app.get('/api/customers', requireAuth, (req: Request, res: Response) => {
  const term = String(req.query.search || '').trim().toLowerCase();
  const results = AX_CUSTOMERS.filter(
    (c) =>
      !term ||
      c.accountNum.toLowerCase().includes(term) ||
      c.name.toLowerCase().includes(term)
  ).map((c) => ({
    accountNum: c.accountNum,
    name: c.name,
    dataAreaId: c.dataAreaId,
    isActive: c.isActive,
    blockedStatus: c.blockedStatus
  }));
  res.json(results);
});

app.get('/api/customers/:account/sales-orders', requireAuth, (req: Request, res: Response) => {
  const account = req.params.account;
  const warehouseId = String(req.query.warehouseId || 'MAIN');
  const pickupDate = String(req.query.pickupDate || TODAY);

  const cust = AX_CUSTOMERS.find((c) => c.accountNum.toLowerCase() === account.toLowerCase());
  if (!cust) {
    res.status(404).json({ detail: 'Customer not found in AX.' });
    return;
  }

  const activePlansForDate = pickupPlans.filter(
    (p) =>
      p.customerAccount === cust.accountNum &&
      p.pickupDate === pickupDate &&
      (p.status === 'PLANNED' || p.status === 'ARRIVED')
  );

  const orders = AX_ORDERS.filter(
    (o) =>
      o.customerAccount === cust.accountNum &&
      (!warehouseId || o.warehouseId.toLowerCase() === warehouseId.toLowerCase())
  ).map((o) => {
    const existingPlan = pickupPlans.find(
      (p) =>
        (p.status === 'PLANNED' || p.status === 'ARRIVED') &&
        p.orders.some((po) => po.salesId === o.salesId)
    );
    return {
      salesId: o.salesId,
      dataAreaId: o.dataAreaId,
      warehouseId: o.warehouseId,
      orderDate: o.orderDate,
      axStatus: o.axStatus,
      isEligible: o.isEligible,
      eligibilityStatus: o.eligibilityStatus,
      ineligibilityReason: o.ineligibilityReason,
      totalAmount: o.totalAmount,
      currencyCode: o.currencyCode,
      isAlreadyPlanned: Boolean(existingPlan),
      existingPlanId: existingPlan?.id ?? null
    };
  });

  res.json({
    customerAccount: cust.accountNum,
    customerName: cust.name,
    alreadyPlannedForSelectedDate: activePlansForDate.length > 0,
    orders
  });
});

// Pickup Planning
app.get('/api/pickup-plans', requireAuth, (req: Request, res: Response) => {
  const date = String(req.query.date || TODAY);
  const filtered = pickupPlans
    .filter((p) => p.pickupDate === date)
    .map((p) => ({
      id: p.id,
      customerAccount: p.customerAccount,
      customerNameSnapshot: p.customerNameSnapshot,
      pickupDate: p.pickupDate,
      warehouseId: p.warehouseId,
      status: p.status,
      orderCount: p.orders.length,
      orders: p.orders,
      notes: p.notes,
      createdBy: p.createdBy,
      updatedAt: p.updatedAt
    }));
  res.json(filtered);
});

app.get('/api/pickup-plans/:id', requireAuth, (req: Request, res: Response) => {
  const plan = pickupPlans.find((p) => p.id === req.params.id);
  if (!plan) {
    res.status(404).json({ detail: 'Pickup plan not found.' });
    return;
  }
  res.json({ ...plan, orderCount: plan.orders.length });
});

app.post(
  '/api/pickup-plans',
  requireAuth,
  requireRoles(['Commercial', 'Supervisor', 'Administrator']),
  (req: AuthedRequest, res: Response) => {
    const cacheKey = checkIdempotency(req, res);
    if (cacheKey === '__REPLAYED__') return;

    const { customerAccount, pickupDate, warehouseId, salesOrders, notes } = req.body as {
      customerAccount: string;
      pickupDate: string;
      warehouseId: string;
      salesOrders: string[];
      notes?: string | null;
    };

    const cust = AX_CUSTOMERS.find((c) => c.accountNum === customerAccount);
    if (!cust || !cust.isActive) {
      res.status(400).json({ detail: 'Customer is missing or inactive in AX.' });
      return;
    }

    if (!Array.isArray(salesOrders) || salesOrders.length === 0) {
      res.status(400).json({ detail: 'At least one eligible sales order must be selected.' });
      return;
    }

    for (const salesId of salesOrders) {
      const axOrder = AX_ORDERS.find((o) => o.salesId === salesId && o.customerAccount === cust.accountNum);
      if (!axOrder || !axOrder.isEligible || axOrder.isCancelled) {
        res.status(400).json({ detail: `Sales order ${salesId} is not eligible for pickup.` });
        return;
      }
      const conflict = pickupPlans.find(
        (p) =>
          (p.status === 'PLANNED' || p.status === 'ARRIVED') &&
          p.orders.some((po) => po.salesId === salesId)
      );
      if (conflict) {
        res.status(409).json({ detail: `Sales order ${salesId} is already in an active pickup plan.` });
        return;
      }
    }

    const plan: PickupPlanRecord = {
      id: `plan-${crypto.randomUUID().slice(0, 8)}`,
      customerAccount: cust.accountNum,
      customerNameSnapshot: cust.name,
      pickupDate,
      warehouseId: warehouseId || 'MAIN',
      status: 'PLANNED',
      orders: salesOrders.map((salesId, idx) => ({
        id: `po-${Date.now()}-${idx}`,
        dataAreaId: 'DAT',
        salesId,
        orderStatusSnapshot: 'Open order'
      })),
      notes: notes ?? null,
      createdBy: req.user!.userName,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    pickupPlans.push(plan);
    sendIdempotent(res, cacheKey, 201, {
      id: plan.id,
      customerAccount: plan.customerAccount,
      customerNameSnapshot: plan.customerNameSnapshot,
      pickupDate: plan.pickupDate,
      warehouseId: plan.warehouseId,
      status: plan.status,
      salesOrders: plan.orders.map((o) => o.salesId),
      notes: plan.notes,
      createdBy: plan.createdBy,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt
    });
  }
);

app.put(
  '/api/pickup-plans/:id',
  requireAuth,
  requireRoles(['Commercial', 'Supervisor', 'Administrator']),
  (req: AuthedRequest, res: Response) => {
    const plan = pickupPlans.find((p) => p.id === req.params.id);
    if (!plan) {
      res.status(404).json({ detail: 'Pickup plan not found.' });
      return;
    }
    if (plan.status !== 'PLANNED') {
      res.status(409).json({ detail: 'Only plans in PLANNED status can be modified.' });
      return;
    }

    const { pickupDate, warehouseId, salesOrders, notes } = req.body as {
      pickupDate: string;
      warehouseId: string;
      salesOrders: string[];
      notes?: string | null;
    };

    if (!Array.isArray(salesOrders) || salesOrders.length === 0) {
      res.status(400).json({ detail: 'Select at least one sales order.' });
      return;
    }

    plan.pickupDate = pickupDate;
    plan.warehouseId = warehouseId;
    plan.notes = notes ?? null;
    plan.orders = salesOrders.map((salesId, idx) => ({
      id: `po-${Date.now()}-${idx}`,
      dataAreaId: 'DAT',
      salesId,
      orderStatusSnapshot: 'Open order'
    }));
    plan.updatedAt = nowIso();

    res.json({
      id: plan.id,
      customerAccount: plan.customerAccount,
      customerNameSnapshot: plan.customerNameSnapshot,
      pickupDate: plan.pickupDate,
      warehouseId: plan.warehouseId,
      status: plan.status,
      salesOrders: plan.orders.map((o) => o.salesId),
      notes: plan.notes,
      createdBy: plan.createdBy,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt
    });
  }
);

// Reception Arrival & Walk-in
app.post(
  '/api/pickup-plans/:id/arrival',
  requireAuth,
  requireRoles(['Reception', 'Supervisor', 'Administrator']),
  (req: AuthedRequest, res: Response) => {
    const cacheKey = checkIdempotency(req, res);
    if (cacheKey === '__REPLAYED__') return;

    const plan = pickupPlans.find((p) => p.id === req.params.id);
    if (!plan) {
      res.status(404).json({ detail: 'Pickup plan not found.' });
      return;
    }
    if (plan.status === 'CANCELLED' || plan.status === 'ABSENT') {
      res.status(409).json({ detail: `Cannot confirm arrival for a plan in ${plan.status} status.` });
      return;
    }

    const ticket = issueTicketForPlan(plan, req.user!.userName);
    sendIdempotent(res, cacheKey, 200, {
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      queueNumber: ticket.queueNumber,
      status: ticket.status,
      arrivalTime: ticket.arrivalTime,
      customerAccount: ticket.customerAccount,
      customerName: ticket.customerName,
      orderCount: ticket.orders.length
    });
  }
);

app.post(
  '/api/tickets/walk-in',
  requireAuth,
  requireRoles(['Reception', 'Supervisor', 'Administrator']),
  (req: AuthedRequest, res: Response) => {
    const cacheKey = checkIdempotency(req, res);
    if (cacheKey === '__REPLAYED__') return;

    const { customerAccount, warehouseId, salesOrders, notes } = req.body as {
      customerAccount: string;
      warehouseId: string;
      salesOrders: string[];
      notes?: string | null;
    };

    const cust = AX_CUSTOMERS.find((c) => c.accountNum === customerAccount);
    if (!cust || !cust.isActive) {
      res.status(400).json({ detail: 'Customer not found or inactive in AX.' });
      return;
    }

    const plan: PickupPlanRecord = {
      id: `plan-${crypto.randomUUID().slice(0, 8)}`,
      customerAccount: cust.accountNum,
      customerNameSnapshot: cust.name,
      pickupDate: TODAY,
      warehouseId: warehouseId || 'MAIN',
      status: 'PLANNED',
      orders: salesOrders.map((salesId, idx) => ({
        id: `po-${Date.now()}-${idx}`,
        dataAreaId: 'DAT',
        salesId,
        orderStatusSnapshot: 'Open order'
      })),
      notes: notes ?? 'Authorized walk-in arrival',
      createdBy: req.user!.userName,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    pickupPlans.push(plan);
    const ticket = issueTicketForPlan(plan, req.user!.userName);
    sendIdempotent(res, cacheKey, 201, {
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      queueNumber: ticket.queueNumber,
      status: ticket.status,
      arrivalTime: ticket.arrivalTime,
      customerAccount: ticket.customerAccount,
      customerName: ticket.customerName,
      orderCount: ticket.orders.length
    });
  }
);

app.get('/api/tickets/queue', requireAuth, (req: Request, res: Response) => {
  const date = String(req.query.date || TODAY);
  const list = tickets
    .filter((t) => t.ticketDate === date)
    .sort((a, b) => a.queueNumber - b.queueNumber)
    .map(toQueueItem);
  res.json(list);
});

app.get('/api/tickets/:id', requireAuth, (req: Request, res: Response) => {
  const ticket = tickets.find((t) => t.ticketId === req.params.id);
  if (!ticket) {
    res.status(404).json({ detail: 'Ticket not found.' });
    return;
  }
  res.json(toTicketDetail(ticket));
});

// Credit Management (Strictly CreditManager only per Rule 8)
app.get(
  '/api/tickets/:id/credit-context',
  requireAuth,
  requireRoles(['CreditManager']),
  (req: Request, res: Response) => {
    const ticket = tickets.find((t) => t.ticketId === req.params.id);
    if (!ticket) {
      res.status(404).json({ detail: 'Ticket not found.' });
      return;
    }

    const cust = AX_CUSTOMERS.find((c) => c.accountNum === ticket.customerAccount);
    res.json({
      ticket: toTicketDetail(ticket),
      customerCredit: cust
        ? {
            customerAccount: cust.accountNum,
            dataAreaId: cust.dataAreaId,
            balance: cust.balance,
            creditLimit: cust.creditLimit,
            openOrdersAmount: cust.openOrdersAmount,
            currencyCode: 'USD',
            hasCreditBlock: cust.hasCreditBlock,
            blockReason: cust.blockReason
          }
        : null,
      orders: ticket.orders.map((o) => {
        const ax = AX_ORDERS.find((a) => a.salesId === o.salesId);
        const blockedByCustomer = Boolean(cust?.hasCreditBlock);
        const eligible = Boolean(ax && ax.isEligible && !ax.isCancelled && !blockedByCustomer);
        return {
          orderId: o.id,
          dataAreaId: o.dataAreaId,
          salesId: o.salesId,
          status: o.status,
          creditStatus: o.creditStatus,
          isEligible: eligible,
          isAlreadyReleased: o.status === 'RELEASED' || o.status === 'IN_PREPARATION' || o.status === 'READY' || o.status === 'COLLECTED',
          isCancelled: Boolean(ax?.isCancelled || o.status === 'CANCELLED'),
          axStatus: ax?.axStatus ?? 'Open order',
          eligibilityLabel: blockedByCustomer ? 'Credit Blocked' : ax?.eligibilityStatus ?? 'Eligible',
          blockingReason: blockedByCustomer ? cust?.blockReason : ax?.ineligibilityReason ?? o.blockingReason,
          lastAxSyncAt: o.lastAxSyncAt
        };
      })
    });
  }
);

app.post(
  '/api/tickets/:id/credit-decision',
  requireAuth,
  requireRoles(['CreditManager']),
  (req: AuthedRequest, res: Response) => {
    const cacheKey = checkIdempotency(req, res);
    if (cacheKey === '__REPLAYED__') return;

    const ticket = tickets.find((t) => t.ticketId === req.params.id);
    if (!ticket) {
      res.status(404).json({ detail: 'Ticket not found.' });
      return;
    }

    const { decision, comment, orders } = req.body as {
      decision: 'APPROVED' | 'ON_HOLD' | 'REJECTED';
      comment?: string | null;
      orders?: Array<{ salesId: string; approveForRelease: boolean }>;
    };

    if ((decision === 'ON_HOLD' || decision === 'REJECTED') && !comment?.trim()) {
      res.status(400).json({ detail: 'A comment is mandatory when placing on hold or rejecting.' });
      return;
    }

    const actor = req.user!.userName;
    const correlationId = crypto.randomUUID();
    const now = nowIso();
    const oldTicketStatus = ticket.status;
    ticket.creditDecisionBy = actor;
    ticket.creditDecisionAt = now;
    ticket.creditComment = comment?.trim() || null;

    const cust = AX_CUSTOMERS.find((c) => c.accountNum === ticket.customerAccount);
    const approveMap = new Map((orders || []).map((o) => [o.salesId, o.approveForRelease]));
    const orderResults = [];

    if (decision === 'REJECTED' || decision === 'ON_HOLD') {
      ticket.status = decision;
      for (const ord of ticket.orders) {
        if (ord.status !== 'COLLECTED' && ord.status !== 'CANCELLED') {
          const prev = ord.status;
          ord.creditStatus = decision;
          ord.status = decision === 'REJECTED' ? 'BLOCKED' : 'PENDING_CREDIT';
          ticket.orderEvents.push({
            oldStatus: prev,
            newStatus: ord.status,
            action: `CREDIT_${decision}`,
            comment: ticket.creditComment,
            userId: actor,
            occurredAt: now,
            correlationId,
            salesId: ord.salesId
          });
        }
        orderResults.push({
          orderId: ord.id,
          salesId: ord.salesId,
          creditStatus: ord.creditStatus,
          orderStatus: ord.status,
          releaseOutcome: ord.status,
          axReference: ord.axReference,
          errorMessage: ticket.creditComment
        });
      }
    } else {
      let anyReleased = false;
      for (const ord of ticket.orders) {
        if (ord.status === 'RELEASED' || ord.status === 'IN_PREPARATION' || ord.status === 'READY' || ord.status === 'COLLECTED') {
          anyReleased = true;
          orderResults.push({
            orderId: ord.id,
            salesId: ord.salesId,
            creditStatus: 'APPROVED' as const,
            orderStatus: ord.status,
            releaseOutcome: 'RELEASED',
            axReference: ord.axReference,
            errorMessage: null
          });
          continue;
        }

        const shouldRelease = approveMap.has(ord.salesId) ? approveMap.get(ord.salesId)! : true;
        const ax = AX_ORDERS.find((a) => a.salesId === ord.salesId);

        if (!shouldRelease) {
          ord.creditStatus = 'ON_HOLD';
          orderResults.push({
            orderId: ord.id,
            salesId: ord.salesId,
            creditStatus: 'ON_HOLD' as const,
            orderStatus: ord.status,
            releaseOutcome: ord.status,
            axReference: null,
            errorMessage: 'Not selected for release.'
          });
          continue;
        }

        if (!ax || ax.isCancelled || cust?.hasCreditBlock) {
          const prev = ord.status;
          ord.creditStatus = 'APPROVED';
          ord.status = 'BLOCKED';
          ord.blockingReason = cust?.hasCreditBlock
            ? cust.blockReason || 'Credit block active in AX'
            : ax?.ineligibilityReason || 'Ineligible in AX';
          ticket.orderEvents.push({
            oldStatus: prev,
            newStatus: 'BLOCKED',
            action: 'AX_RELEASE_BLOCKED',
            comment: ord.blockingReason,
            userId: actor,
            occurredAt: now,
            correlationId,
            salesId: ord.salesId
          });
          orderResults.push({
            orderId: ord.id,
            salesId: ord.salesId,
            creditStatus: 'APPROVED' as const,
            orderStatus: 'BLOCKED' as const,
            releaseOutcome: 'BLOCKED',
            axReference: null,
            errorMessage: ord.blockingReason
          });
          continue;
        }

        const prev = ord.status;
        ord.creditStatus = 'APPROVED';
        ord.status = 'RELEASED';
        ord.lastAxSyncAt = now;
        ord.axReference = `AX-REL-${TODAY.replace(/-/g, '')}-${ord.salesId}`;
        ord.blockingReason = null;
        ax.isReleased = true;
        ax.axStatus = 'Released for pickup';
        anyReleased = true;

        ticket.orderEvents.push({
          oldStatus: prev,
          newStatus: 'RELEASED',
          action: 'AX_RELEASE_CONFIRMED',
          comment: `Ref: ${ord.axReference}`,
          userId: actor,
          occurredAt: now,
          correlationId,
          salesId: ord.salesId
        });

        orderResults.push({
          orderId: ord.id,
          salesId: ord.salesId,
          creditStatus: 'APPROVED' as const,
          orderStatus: 'RELEASED' as const,
          releaseOutcome: 'RELEASED',
          axReference: ord.axReference,
          errorMessage: null
        });
      }

      ticket.status = anyReleased ? 'APPROVED' : 'ON_HOLD';
    }

    ticket.ticketEvents.push({
      oldStatus: oldTicketStatus,
      newStatus: ticket.status,
      action: 'CREDIT_DECISION',
      comment: ticket.creditComment,
      userId: actor,
      occurredAt: now,
      correlationId
    });

    sendIdempotent(res, cacheKey, 200, {
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      ticketStatus: ticket.status,
      decision,
      comment: ticket.creditComment,
      orders: orderResults
    });
  }
);

app.post(
  '/api/tickets/:id/orders/:orderId/release',
  requireAuth,
  requireRoles(['CreditManager']),
  (req: AuthedRequest, res: Response) => {
    const ticket = tickets.find((t) => t.ticketId === req.params.id);
    const ord = ticket?.orders.find((o) => o.id === req.params.orderId);
    if (!ticket || !ord) {
      res.status(404).json({ detail: 'Ticket or order not found.' });
      return;
    }

    const ax = AX_ORDERS.find((a) => a.salesId === ord.salesId);
    const cust = AX_CUSTOMERS.find((c) => c.accountNum === ticket.customerAccount);
    if (!ax || ax.isCancelled || cust?.hasCreditBlock) {
      ord.status = 'BLOCKED';
      ord.blockingReason = cust?.hasCreditBlock
        ? cust.blockReason || 'Credit block in AX'
        : 'Ineligible in AX';
      res.json({
        orderId: ord.id,
        salesId: ord.salesId,
        creditStatus: ord.creditStatus,
        orderStatus: ord.status,
        releaseOutcome: 'BLOCKED',
        axReference: null,
        errorMessage: ord.blockingReason
      });
      return;
    }

    const prev = ord.status;
    const now = nowIso();
    ord.creditStatus = 'APPROVED';
    ord.status = 'RELEASED';
    ord.lastAxSyncAt = now;
    ord.axReference = `AX-REL-${TODAY.replace(/-/g, '')}-${ord.salesId}`;
    ord.blockingReason = null;
    if (ticket.status === 'ARRIVED' || ticket.status === 'ON_HOLD') {
      ticket.status = 'APPROVED';
    }
    ticket.orderEvents.push({
      oldStatus: prev,
      newStatus: 'RELEASED',
      action: 'AX_RELEASE_CONFIRMED',
      comment: `Ref: ${ord.axReference}`,
      userId: req.user!.userName,
      occurredAt: now,
      correlationId: crypto.randomUUID(),
      salesId: ord.salesId
    });

    res.json({
      orderId: ord.id,
      salesId: ord.salesId,
      creditStatus: ord.creditStatus,
      orderStatus: ord.status,
      releaseOutcome: 'RELEASED',
      axReference: ord.axReference,
      errorMessage: null
    });
  }
);

// Warehouse Preparation & Collection
function evaluateTicketReady(ticket: TicketRecord, actor: string): boolean {
  const activeOrders = ticket.orders.filter((o) => o.status !== 'CANCELLED');
  if (activeOrders.length > 0 && activeOrders.every((o) => o.status === 'READY')) {
    const prev = ticket.status;
    ticket.status = 'READY';
    ticket.readyAt = nowIso();
    ticket.ticketEvents.push({
      oldStatus: prev,
      newStatus: 'READY',
      action: 'TICKET_READY',
      comment: 'All active orders marked ready by warehouse',
      userId: actor,
      occurredAt: ticket.readyAt,
      correlationId: crypto.randomUUID()
    });
    return true;
  }
  return false;
}

app.post(
  '/api/tickets/:id/orders/:orderId/preparation',
  requireAuth,
  requireRoles(['WarehouseOperator', 'Supervisor', 'Administrator']),
  (req: AuthedRequest, res: Response) => {
    const ticket = tickets.find((t) => t.ticketId === req.params.id);
    const ord = ticket?.orders.find((o) => o.id === req.params.orderId);
    if (!ticket || !ord) {
      res.status(404).json({ detail: 'Ticket or order not found.' });
      return;
    }
    if (ord.status !== 'RELEASED') {
      res.status(409).json({ detail: 'Only AX-released orders can start preparation.' });
      return;
    }

    const now = nowIso();
    const prevOrd = ord.status;
    ord.status = 'IN_PREPARATION';
    ord.warehouseStatus = 'PREPARING';
    if (ticket.status === 'APPROVED') {
      const prevT = ticket.status;
      ticket.status = 'IN_PREPARATION';
      ticket.ticketEvents.push({
        oldStatus: prevT,
        newStatus: 'IN_PREPARATION',
        action: 'PREPARATION_STARTED',
        comment: null,
        userId: req.user!.userName,
        occurredAt: now,
        correlationId: crypto.randomUUID()
      });
    }
    ticket.orderEvents.push({
      oldStatus: prevOrd,
      newStatus: 'IN_PREPARATION',
      action: 'ORDER_PREP_STARTED',
      comment: null,
      userId: req.user!.userName,
      occurredAt: now,
      correlationId: crypto.randomUUID(),
      salesId: ord.salesId
    });

    res.json({
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      ticketStatus: ticket.status,
      orderId: ord.id,
      salesId: ord.salesId,
      orderStatus: ord.status,
      warehouseStatus: ord.warehouseStatus,
      ticketReadyForCollection: false,
      readyAt: ticket.readyAt
    });
  }
);

app.post(
  '/api/tickets/:id/orders/:orderId/ready',
  requireAuth,
  requireRoles(['WarehouseOperator', 'Supervisor', 'Administrator']),
  (req: AuthedRequest, res: Response) => {
    const ticket = tickets.find((t) => t.ticketId === req.params.id);
    const ord = ticket?.orders.find((o) => o.id === req.params.orderId);
    if (!ticket || !ord) {
      res.status(404).json({ detail: 'Ticket or order not found.' });
      return;
    }
    if (ord.status !== 'RELEASED' && ord.status !== 'IN_PREPARATION') {
      res.status(409).json({ detail: 'Order must be RELEASED or IN_PREPARATION to mark ready.' });
      return;
    }

    const now = nowIso();
    const prevOrd = ord.status;
    ord.status = 'READY';
    ord.warehouseStatus = 'READY';
    ticket.orderEvents.push({
      oldStatus: prevOrd,
      newStatus: 'READY',
      action: 'ORDER_READY',
      comment: null,
      userId: req.user!.userName,
      occurredAt: now,
      correlationId: crypto.randomUUID(),
      salesId: ord.salesId
    });

    const isTicketReady = evaluateTicketReady(ticket, req.user!.userName);
    res.json({
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      ticketStatus: ticket.status,
      orderId: ord.id,
      salesId: ord.salesId,
      orderStatus: ord.status,
      warehouseStatus: ord.warehouseStatus,
      ticketReadyForCollection: isTicketReady,
      readyAt: ticket.readyAt
    });
  }
);

app.post(
  '/api/tickets/:id/orders/:orderId/remove-blocked',
  requireAuth,
  requireRoles(['Supervisor', 'Administrator']),
  (req: AuthedRequest, res: Response) => {
    const ticket = tickets.find((t) => t.ticketId === req.params.id);
    const ord = ticket?.orders.find((o) => o.id === req.params.orderId);
    if (!ticket || !ord) {
      res.status(404).json({ detail: 'Ticket or order not found.' });
      return;
    }

    const reason = (req.body as { reason?: string })?.reason || 'Removed by supervisor';
    const now = nowIso();
    const prev = ord.status;
    ord.status = 'CANCELLED';
    ticket.orderEvents.push({
      oldStatus: prev,
      newStatus: 'CANCELLED',
      action: 'BLOCKED_ORDER_REMOVED',
      comment: reason,
      userId: req.user!.userName,
      occurredAt: now,
      correlationId: crypto.randomUUID(),
      salesId: ord.salesId
    });

    const isTicketReady = evaluateTicketReady(ticket, req.user!.userName);
    res.json({
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      ticketStatus: ticket.status,
      orderId: ord.id,
      salesId: ord.salesId,
      orderStatus: ord.status,
      warehouseStatus: ord.warehouseStatus,
      ticketReadyForCollection: isTicketReady,
      readyAt: ticket.readyAt
    });
  }
);

app.post(
  '/api/tickets/:id/collection',
  requireAuth,
  requireRoles(['WarehouseOperator', 'Supervisor', 'Administrator']),
  (req: AuthedRequest, res: Response) => {
    const ticket = tickets.find((t) => t.ticketId === req.params.id);
    if (!ticket) {
      res.status(404).json({ detail: 'Ticket not found.' });
      return;
    }
    if (ticket.status !== 'READY') {
      res.status(409).json({ detail: 'Only READY tickets can be confirmed as collected.' });
      return;
    }

    const now = nowIso();
    const prev = ticket.status;
    ticket.status = 'COLLECTED';
    ticket.collectedAt = now;
    ticket.collectedBy = req.user!.userName;
    for (const ord of ticket.orders) {
      if (ord.status === 'READY') {
        ord.status = 'COLLECTED';
        ord.warehouseStatus = 'COLLECTED';
      }
    }

    const plan = pickupPlans.find((p) => p.id === ticket.pickupPlanId);
    if (plan) {
      plan.status = 'COMPLETED';
      plan.updatedAt = now;
    }

    ticket.ticketEvents.push({
      oldStatus: prev,
      newStatus: 'COLLECTED',
      action: 'CLIENT_COLLECTED',
      comment: 'Client pickup completed at dock',
      userId: req.user!.userName,
      occurredAt: now,
      correlationId: crypto.randomUUID()
    });

    res.json({
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      ticketStatus: ticket.status,
      collectedAt: now,
      collectedBy: req.user!.userName
    });
  }
);

// Dashboard
app.get('/api/dashboard/stats', requireAuth, (_req: Request, res: Response) => {
  const todayPlans = pickupPlans.filter((p) => p.pickupDate === TODAY);
  const todayTickets = tickets.filter((t) => t.ticketDate === TODAY);

  res.json({
    date: TODAY,
    plannedCount: todayPlans.filter((p) => p.status === 'PLANNED').length,
    awaitingCreditCount: todayTickets.filter((t) => t.status === 'ARRIVED').length,
    onHoldOrRejectedCount: todayTickets.filter((t) => t.status === 'ON_HOLD' || t.status === 'REJECTED').length,
    inPreparationCount: todayTickets.filter((t) => t.status === 'APPROVED' || t.status === 'IN_PREPARATION').length,
    readyCount: todayTickets.filter((t) => t.status === 'READY').length,
    collectedCount: todayTickets.filter((t) => t.status === 'COLLECTED').length,
    absentCount: todayPlans.filter((p) => p.status === 'ABSENT').length,
    integrationAttentionCount: todayTickets.reduce(
      (sum, t) => sum + t.orders.filter((o) => o.status === 'RECONCILING' || o.status === 'BLOCKED').length,
      0
    )
  });
});

// Public Display (Rule 1: ticket numbers ONLY — no customer name, account, SO, or money)
app.get('/api/display/state', (_req: Request, res: Response) => {
  const readyTickets = tickets
    .filter((t) => t.ticketDate === TODAY && t.status === 'READY')
    .sort((a, b) => (b.readyAt || '').localeCompare(a.readyAt || ''))
    .map((t) => ({
      ticketNumber: t.ticketNumber,
      readyAt: t.readyAt
    }));

  const inPreparationCount = tickets.filter(
    (t) => t.ticketDate === TODAY && (t.status === 'APPROVED' || t.status === 'IN_PREPARATION')
  ).length;

  res.json({
    businessDate: TODAY,
    nowServingTicketNumber: readyTickets[0]?.ticketNumber ?? null,
    readyTickets,
    inPreparationCount,
    generatedAtUtc: nowIso()
  });
});

// History & Audit (Supervisor / Administrator)
app.get(
  '/api/history',
  requireAuth,
  requireRoles(['Supervisor', 'Administrator']),
  (req: Request, res: Response) => {
    const dateFrom = String(req.query.dateFrom || TODAY);
    const dateTo = String(req.query.dateTo || TODAY);
    const search = String(req.query.search || '').trim().toLowerCase();

    const list = tickets
      .filter((t) => t.ticketDate >= dateFrom && t.ticketDate <= dateTo)
      .filter(
        (t) =>
          !search ||
          t.ticketNumber.toLowerCase().includes(search) ||
          t.customerAccount.toLowerCase().includes(search) ||
          t.customerName.toLowerCase().includes(search) ||
          t.orders.some((o) => o.salesId.toLowerCase().includes(search))
      )
      .map((t) => ({
        ticketId: t.ticketId,
        ticketDate: t.ticketDate,
        ticketNumber: t.ticketNumber,
        queueNumber: t.queueNumber,
        customerAccount: t.customerAccount,
        customerName: t.customerName,
        warehouseId: t.warehouseId,
        status: t.status,
        arrivalTime: t.arrivalTime,
        readyAt: t.readyAt,
        collectedAt: t.collectedAt,
        creditDecisionBy: t.creditDecisionBy,
        creditComment: t.creditComment,
        orderCount: t.orders.length
      }));

    res.json(list);
  }
);

app.get(
  '/api/history/:ticketId/audit',
  requireAuth,
  requireRoles(['Supervisor', 'Administrator']),
  (req: Request, res: Response) => {
    const ticket = tickets.find((t) => t.ticketId === req.params.ticketId);
    if (!ticket) {
      res.status(404).json({ detail: 'Ticket not found.' });
      return;
    }

    res.json({
      ticketId: ticket.ticketId,
      ticketNumber: ticket.ticketNumber,
      ticketDate: ticket.ticketDate,
      customerAccount: ticket.customerAccount,
      customerName: ticket.customerName,
      status: ticket.status,
      ticketEvents: ticket.ticketEvents,
      orderEvents: ticket.orderEvents
    });
  }
);

// Settings (Administrator)
app.get(
  '/api/settings',
  requireAuth,
  requireRoles(['Administrator']),
  (_req: Request, res: Response) => {
    res.json(settingsStore);
  }
);

app.put(
  '/api/settings/:warehouseId',
  requireAuth,
  requireRoles(['Administrator']),
  (req: Request, res: Response) => {
    const s = settingsStore.find((item) => item.warehouseId === req.params.warehouseId);
    if (!s) {
      res.status(404).json({ detail: 'Warehouse settings not found.' });
      return;
    }

    const body = req.body as Partial<PickupSettingsRecord>;
    if (body.axDataAreaId) s.axDataAreaId = body.axDataAreaId;
    if (body.ticketPrefix) s.ticketPrefix = body.ticketPrefix;
    if (body.businessTimeZone) s.businessTimeZone = body.businessTimeZone;
    if (body.queuePolicy) s.queuePolicy = body.queuePolicy;
    if (body.partialOrderPolicy) s.partialOrderPolicy = body.partialOrderPolicy;
    if (body.arrivalCutoffTime !== undefined) s.arrivalCutoffTime = body.arrivalCutoffTime;

    res.json(s);
  }
);

// Serve built Angular frontend
const angularDistDir = path.resolve(
  process.cwd(),
  'PickupManagement',
  'pickup-management-ui',
  'dist',
  'pickup-management-ui',
  'browser'
);

if (fs.existsSync(angularDistDir)) {
  app.use(express.static(angularDistDir));
  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/hubs/')) {
      res.status(404).json({ detail: 'Endpoint not found.' });
      return;
    }
    res.sendFile(path.join(angularDistDir, 'index.html'));
  });
} else {
  app.get('*', (_req: Request, res: Response) => {
    res
      .status(503)
      .send('Angular frontend build output not found yet. Run npm run build.');
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Angular + Pickup API server listening on http://0.0.0.0:${PORT}`);
});
