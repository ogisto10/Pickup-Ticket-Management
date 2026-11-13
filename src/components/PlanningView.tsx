import React, { useMemo, useState } from 'react';
import { AlertCircle, Plus, Search, Trash2 } from 'lucide-react';
import { TODAY_ISO } from '../data/seedData';
import { usePickup } from '../store/PickupContext';
import { formatMoney, StatusTag } from './StatusTag';

export const PlanningListView: React.FC = () => {
  const { plans, cancelPlan, navigate } = usePickup();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return plans.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.planCode.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.customerAccount.toLowerCase().includes(q) ||
        p.orders.some((o) => o.salesId.toLowerCase().includes(q))
      );
    });
  }, [plans, searchTerm, statusFilter]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display">Commercial Pickup Plans</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Schedule customer pickup windows and lock eligible AX sales orders against double-booking
          </p>
        </div>
        <button
          onClick={() => navigate('planning-new')}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          New Pickup Plan
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search plan code, customer, or SO number..."
            className="w-full rounded-md border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {['ALL', 'PLANNED', 'ARRIVED', 'ABSENT', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs text-slate-500">No pickup plans match the current filter.</p>
            <button
              onClick={() => navigate('planning-new')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" /> Create Pickup Plan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Plan Code</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Window</th>
                  <th className="py-2.5 px-4">Representative</th>
                  <th className="py-2.5 px-4">Linked AX Orders</th>
                  <th className="py-2.5 px-4 text-right">Order Value</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {filtered.map((plan) => {
                  const totalValue = plan.orders.reduce((s, o) => s + o.totalAmountSnapshot, 0);
                  return (
                    <tr key={plan.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                        {plan.planCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{plan.customerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{plan.customerAccount}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 font-mono tabular-nums">
                        <div>{plan.plannedDate}</div>
                        <div className="text-slate-500">{plan.plannedWindow}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <div>{plan.representativeName}</div>
                        <div className="text-slate-500 font-mono">{plan.representativePhone}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-800">
                        {plan.orders.map((o) => o.salesId).join(', ')}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-800 text-right tabular-nums">
                        {formatMoney(totalValue)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusTag status={plan.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {plan.status === 'PLANNED' ? (
                          <button
                            onClick={() => cancelPlan(plan.id, 'Cancelled from planning grid')}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" /> Cancel
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const NewPlanView: React.FC = () => {
  const { axCustomers, axOrders, createPlan, isSalesIdActiveInPlanOrTicket, navigate } = usePickup();

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('411-021');
  const [plannedDate, setPlannedDate] = useState(TODAY_ISO);
  const [plannedWindow, setPlannedWindow] = useState('14:00 - 15:30');
  const [representativeName, setRepresentativeName] = useState('');
  const [representativePhone, setRepresentativePhone] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSalesIds, setSelectedSalesIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const matchingCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return axCustomers.filter(
      (c) => !q || c.accountNum.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [axCustomers, customerSearch]);

  const customerOrders = useMemo(
    () => axOrders.filter((o) => o.customerAccount === selectedAccount),
    [axOrders, selectedAccount]
  );

  const selectedCustomer = axCustomers.find((c) => c.accountNum === selectedAccount);

  const toggleOrder = (salesId: string) => {
    setSelectedSalesIds((prev) =>
      prev.includes(salesId) ? prev.filter((id) => id !== salesId) : [...prev, salesId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = createPlan({
      customerAccount: selectedAccount,
      plannedDate,
      plannedWindow,
      representativeName,
      representativePhone,
      notes,
      salesIds: selectedSalesIds,
    });
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Failed to create plan.');
      return;
    }
    navigate('planning');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display">Schedule New Pickup Plan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Queries live AX 2012 R3 customers and eligible sales orders before saving
          </p>
        </div>
        <button
          onClick={() => navigate('planning')}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to Plans
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Customer & Logistics */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            1. AX Customer & Pickup Slot
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Filter AX Customers</label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Account or name..."
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => {
                setSelectedAccount(e.target.value);
                setSelectedSalesIds([]);
                setErrorMsg(null);
              }}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {matchingCustomers.map((c) => (
                <option key={c.accountNum} value={c.accountNum}>
                  {c.accountNum} — {c.name} {!c.isActive ? '(BLOCKED / INACTIVE)' : ''}
                </option>
              ))}
            </select>
            {selectedCustomer && !selectedCustomer.isActive && (
              <p className="mt-1 text-[11px] text-red-600">
                Inactive customer in AX (Blocked: {selectedCustomer.blockedStatus}). Planning will be rejected.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Planned Date</label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Time Window</label>
              <select
                value={plannedWindow}
                onChange={(e) => setPlannedWindow(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs"
              >
                <option value="09:00 - 10:30">09:00 - 10:30</option>
                <option value="10:30 - 12:00">10:30 - 12:00</option>
                <option value="14:00 - 15:30">14:00 - 15:30</option>
                <option value="15:30 - 17:00">15:30 - 17:00</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Representative / Driver</label>
              <input
                type="text"
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                placeholder="e.g. Mohamed Alami"
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                value={representativePhone}
                onChange={(e) => setRepresentativePhone(e.target.value)}
                placeholder="+212 6XX-XXX-XXX"
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Loading dock instructions..."
              className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Right: AX Eligible Sales Orders */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              2. Eligible AX Sales Orders ({selectedAccount})
            </div>

            {customerOrders.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-md">
                No open sales orders found in AX for this customer account.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-3 w-8"></th>
                      <th className="py-2 px-3">Sales ID</th>
                      <th className="py-2 px-3">AX Status</th>
                      <th className="py-2 px-3">Eligibility</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {customerOrders.map((order) => {
                      const dup = isSalesIdActiveInPlanOrTicket(order.salesId);
                      const checked = selectedSalesIds.includes(order.salesId);
                      return (
                        <tr key={order.salesId} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOrder(order.salesId)}
                              className="rounded border-slate-300"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                            {order.salesId}
                            {dup.active && (
                              <div className="text-[11px] font-sans font-normal text-amber-700">
                                Already linked to {dup.source}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{order.axStatus}</td>
                          <td className="py-2.5 px-3">
                            <StatusTag status={order.eligibilityStatus} />
                            {order.ineligibilityReason && (
                              <div className="text-[11px] text-red-600 mt-0.5">{order.ineligibilityReason}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-900">
                            {formatMoney(order.totalAmount, order.currencyCode)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-600 tabular-nums">
              Selected orders: <span className="font-semibold text-slate-900">{selectedSalesIds.length}</span>
            </div>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Save Pickup Plan
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
