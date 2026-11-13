import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Ticket } from 'lucide-react';
import { usePickup } from '../store/PickupContext';
import { StatusTag } from './StatusTag';

export const ReceptionArrivalsView: React.FC = () => {
  const { plans, axCustomers, axOrders, issueTicket, isSalesIdActiveInPlanOrTicket, settings } = usePickup();
  const expectedPlans = plans.filter((p) => p.status === 'PLANNED');

  const [walkInAccount, setWalkInAccount] = useState('411-021');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `idem-rcp-${Date.now().toString().slice(-5)}`);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reception receives zero financial metrics (no TotalAmount, no Balance, no CreditLimit).
  const walkInOrders = useMemo(
    () => axOrders.filter((o) => o.customerAccount === walkInAccount && !o.isCancelled),
    [axOrders, walkInAccount]
  );

  const handleCheckInPlan = (planId: string, customerAccount: string, repName: string) => {
    setErrorMsg(null);
    const res = issueTicket({
      sourcePlanId: planId,
      customerAccount,
      driverName: repName,
      vehiclePlate: 'ON-FILE',
      salesIds: [],
      idempotencyKey: `plan-checkin-${planId}`,
    });
    if (!res.ok) setErrorMsg(res.error ?? 'Ticket issuance failed.');
  };

  const handleWalkInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = issueTicket({
      customerAccount: walkInAccount,
      driverName,
      vehiclePlate,
      salesIds: selectedOrders,
      idempotencyKey,
    });
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Failed to issue walk-in ticket.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display">Reception Check-In & Ticket Issuance</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Next sequential number: <span className="font-mono font-semibold text-slate-900">{settings.ticketPrefix}-{String(settings.nextSequenceNumber).padStart(3, '0')}</span> · Financial fields intentionally hidden for Reception role
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Expected Plans */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Expected Today (Planned Appointments)</h3>
            <p className="text-xs text-slate-500">One-click arrival check-in converts PLANNED to ARRIVED and assigns locked ticket number</p>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
            {expectedPlans.length} pending
          </span>
        </div>

        {expectedPlans.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            All scheduled plans for today have checked in or closed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Plan</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Window</th>
                  <th className="py-2.5 px-4">Representative</th>
                  <th className="py-2.5 px-4">Orders</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {expectedPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{plan.planCode}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{plan.customerName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{plan.customerAccount}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{plan.plannedWindow}</td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {plan.representativeName} · <span className="font-mono">{plan.representativePhone}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">
                      {plan.orders.map((o) => o.salesId).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() =>
                          handleCheckInPlan(plan.id, plan.customerAccount, plan.representativeName)
                        }
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Ticket className="h-3.5 w-3.5" />
                        Confirm Arrival & Issue Ticket
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Walk-In Arrival */}
      <form onSubmit={handleWalkInSubmit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Walk-In / Unplanned Arrival</h3>
            <p className="text-xs text-slate-500">Issue a sequential ticket directly by selecting customer & open AX sales orders</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Idempotency-Key:</span>
            <code className="text-[11px] bg-slate-100 px-2 py-1 rounded border border-slate-200 font-mono text-slate-700">
              {idempotencyKey}
            </code>
            <button
              type="button"
              onClick={() => setIdempotencyKey(`idem-rcp-${Date.now().toString().slice(-5)}`)}
              title="Rotate Idempotency-Key for a new distinct check-in"
              className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer Account</label>
            <select
              value={walkInAccount}
              onChange={(e) => {
                setWalkInAccount(e.target.value);
                setSelectedOrders([]);
              }}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-medium"
            >
              {axCustomers
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.accountNum} value={c.accountNum}>
                    {c.accountNum} — {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Driver Name</label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="e.g. Hassan Bennis"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Plate</label>
            <input
              type="text"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              placeholder="e.g. 54920-A-6"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono"
            />
          </div>
        </div>

        <div className="border border-slate-200 rounded-md overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2 px-3 w-8"></th>
                <th className="py-2 px-3">Sales ID</th>
                <th className="py-2 px-3">Warehouse</th>
                <th className="py-2 px-3">AX Status</th>
                <th className="py-2 px-3">Active Assignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {walkInOrders.map((order) => {
                const dup = isSalesIdActiveInPlanOrTicket(order.salesId);
                return (
                  <tr key={order.salesId} className="hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.salesId)}
                        onChange={() =>
                          setSelectedOrders((prev) =>
                            prev.includes(order.salesId)
                              ? prev.filter((id) => id !== order.salesId)
                              : [...prev, order.salesId]
                          )
                        }
                      />
                    </td>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900">{order.salesId}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{order.warehouseId}</td>
                    <td className="py-2 px-3 text-slate-700">{order.axStatus}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {dup.active ? (
                        <span className="text-amber-700 font-medium">{dup.source}</span>
                      ) : (
                        <span className="text-emerald-700">Available</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-500">
            Tip: Submit twice without rotating the Idempotency-Key to verify safe idempotent replay.
          </p>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Issue Walk-In Ticket
          </button>
        </div>
      </form>
    </div>
  );
};

export const ReceptionQueueView: React.FC = () => {
  const { tickets } = usePickup();
  const sorted = [...tickets].sort((a, b) => a.queuePosition - b.queuePosition);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 font-display">Reception Live Arrival Queue</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Strict ascending arrival order · Customer financial balances and order values are excluded
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-4">Pos</th>
                <th className="py-2.5 px-4">Ticket</th>
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4">Driver & Vehicle</th>
                <th className="py-2.5 px-4">Orders</th>
                <th className="py-2.5 px-4">Arrived</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {sorted.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-500 tabular-nums">
                    #{t.queuePosition}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                    {t.ticketNumber}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{t.customerName}</div>
                    <div className="text-[11px] font-mono text-slate-500">{t.customerAccount}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    {t.driverName} · <span className="font-mono">{t.vehiclePlate}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-700">
                    {t.orders.map((o) => o.salesId).join(', ')}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">{t.arrivedAt}</td>
                  <td className="py-3 px-4">
                    <StatusTag status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
