import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, PauseCircle, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { usePickup } from '../store/PickupContext';
import { formatMoney, StatusTag } from './StatusTag';

export const CreditWorkbenchView: React.FC = () => {
  const {
    tickets,
    axCreditByCustomer,
    approveAndReleaseTicket,
    holdTicket,
    rejectTicket,
    reconcileOrderWithAx,
    clearCreditBlockInAxDemo,
  } = usePickup();

  const creditQueue = tickets
    .filter((t) => ['ARRIVED', 'ON_HOLD', 'REJECTED'].includes(t.status) || t.orders.some((o) => o.status === 'RECONCILING'))
    .sort((a, b) => a.queuePosition - b.queuePosition);

  const [selectedTicketId, setSelectedTicketId] = useState<string>(creditQueue[0]?.id ?? '');
  const [selectedSalesIds, setSelectedSalesIds] = useState<string[]>([]);
  const [simulateAxTimeout, setSimulateAxTimeout] = useState(false);
  const [reasonMode, setReasonMode] = useState<'HOLD' | 'REJECT' | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeTicket = creditQueue.find((t) => t.id === selectedTicketId) ?? creditQueue[0];

  useEffect(() => {
    if (activeTicket) {
      setSelectedTicketId(activeTicket.id);
      setSelectedSalesIds(
        activeTicket.orders
          .filter((o) => o.status === 'PENDING_CREDIT' || o.status === 'BLOCKED')
          .map((o) => o.salesId)
      );
      setErrorMsg(null);
      setReasonMode(null);
      setReasonText('');
    }
  }, [activeTicket?.id]);

  const creditInfo = activeTicket ? axCreditByCustomer[activeTicket.customerAccount] : undefined;

  const handleApproveRelease = () => {
    if (!activeTicket) return;
    setErrorMsg(null);
    const res = approveAndReleaseTicket(activeTicket.id, selectedSalesIds, simulateAxTimeout);
    if (!res.ok) setErrorMsg(res.error ?? 'AX release failed.');
  };

  const handleConfirmReason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !reasonMode) return;
    setErrorMsg(null);
    const res =
      reasonMode === 'HOLD'
        ? holdTicket(activeTicket.id, reasonText)
        : rejectTicket(activeTicket.id, reasonText);
    if (!res.ok) {
      setErrorMsg(res.error ?? 'Operation failed.');
      return;
    }
    setReasonMode(null);
    setReasonText('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 font-display">Credit Validation & AX Order Release</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Real-time AX balance check · Orders are never marked RELEASED until AX AIF confirms via operationKey
        </p>
      </div>

      {creditQueue.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
          <div className="text-sm font-semibold text-slate-900">Credit Queue Clear</div>
          <p className="text-xs text-slate-500 mt-1">
            No tickets currently waiting for credit review or AX outbox reconciliation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Queue List */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending & On-Hold Tickets ({creditQueue.length})
            </div>
            <div className="divide-y divide-slate-100">
              {creditQueue.map((ticket) => {
                const selected = activeTicket?.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full text-left px-4 py-3.5 transition-colors ${
                      selected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm tabular-nums">{ticket.ticketNumber}</span>
                      <StatusTag status={ticket.status} />
                    </div>
                    <div className={`mt-1 text-xs font-medium ${selected ? 'text-slate-200' : 'text-slate-800'}`}>
                      {ticket.customerName}
                    </div>
                    <div
                      className={`mt-1 text-[11px] font-mono tabular-nums ${
                        selected ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      #{ticket.queuePosition} · {ticket.orders.length} order(s) · Arrived {ticket.arrivedAt}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Detail Panel */}
          {activeTicket && (
            <div className="lg:col-span-8 space-y-4">
              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* AX Credit Summary */}
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-slate-900">
                        {activeTicket.ticketNumber}
                      </span>
                      <StatusTag status={activeTicket.status} />
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {activeTicket.customerName} · <span className="font-mono">{activeTicket.customerAccount}</span> · Driver {activeTicket.driverName}
                    </div>
                  </div>
                  {creditInfo?.hasCreditBlock && (
                    <button
                      onClick={() => clearCreditBlockInAxDemo(activeTicket.customerAccount)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Demo: Clear AX Credit Block
                    </button>
                  )}
                </div>

                {creditInfo && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        AX Balance
                      </div>
                      <div className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                        {formatMoney(creditInfo.balance, creditInfo.currencyCode)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Credit Limit
                      </div>
                      <div className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                        {formatMoney(creditInfo.creditLimit, creditInfo.currencyCode)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Available Credit
                      </div>
                      <div
                        className={`mt-1 font-mono text-base font-bold tabular-nums ${
                          creditInfo.creditLimit - creditInfo.balance < 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatMoney(creditInfo.creditLimit - creditInfo.balance, creditInfo.currencyCode)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Open Orders
                      </div>
                      <div className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                        {formatMoney(creditInfo.openOrdersAmount, creditInfo.currencyCode)}
                      </div>
                    </div>
                  </div>
                )}

                {creditInfo?.blockReason && (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 text-xs text-amber-900">
                    <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{creditInfo.blockReason}</span>
                  </div>
                )}
              </div>

              {/* Orders in Ticket */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Sales Orders Linked to {activeTicket.ticketNumber}
                  </span>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateAxTimeout}
                      onChange={(e) => setSimulateAxTimeout(e.target.checked)}
                    />
                    Simulate AX AIF Timeout (test RECONCILING outbox)
                  </label>
                </div>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-4 w-8"></th>
                      <th className="py-2 px-4">Sales ID</th>
                      <th className="py-2 px-4">Eligibility</th>
                      <th className="py-2 px-4 text-right">Amount</th>
                      <th className="py-2 px-4">Order Status</th>
                      <th className="py-2 px-4 text-right">AX Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {activeTicket.orders.map((order) => {
                      const canSelect = order.status === 'PENDING_CREDIT' || order.status === 'BLOCKED';
                      return (
                        <tr key={order.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4">
                            <input
                              type="checkbox"
                              disabled={!canSelect}
                              checked={selectedSalesIds.includes(order.salesId)}
                              onChange={() =>
                                setSelectedSalesIds((prev) =>
                                  prev.includes(order.salesId)
                                    ? prev.filter((id) => id !== order.salesId)
                                    : [...prev, order.salesId]
                                )
                              }
                            />
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{order.salesId}</td>
                          <td className="py-2.5 px-4">
                            <StatusTag status={order.axEligibilityStatus} />
                          </td>
                          <td className="py-2.5 px-4 font-mono text-right tabular-nums text-slate-900">
                            {formatMoney(order.totalAmountSnapshot, order.currencyCode)}
                          </td>
                          <td className="py-2.5 px-4">
                            <StatusTag status={order.status} />
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                            {order.status === 'RECONCILING' ? (
                              <button
                                onClick={() => reconcileOrderWithAx(activeTicket.id, order.id)}
                                className="inline-flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 text-[11px] font-sans font-semibold text-white hover:bg-amber-700"
                              >
                                <RefreshCw className="h-3 w-3" /> Reconcile with AX
                              </button>
                            ) : (
                              order.axReference ?? '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Action Bar */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReasonMode('HOLD');
                        setErrorMsg(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                    >
                      <PauseCircle className="h-3.5 w-3.5" /> Hold Ticket
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReasonMode('REJECT');
                        setErrorMsg(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject Ticket
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleApproveRelease}
                    disabled={selectedSalesIds.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve & Release in AX ({selectedSalesIds.length})
                  </button>
                </div>

                {reasonMode && (
                  <form
                    onSubmit={handleConfirmReason}
                    className="p-4 border-t border-slate-200 bg-white space-y-2.5"
                  >
                    <label className="block text-xs font-semibold text-slate-900">
                      Mandatory {reasonMode === 'HOLD' ? 'Credit Hold' : 'Rejection'} Reason
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        placeholder={
                          reasonMode === 'HOLD'
                            ? 'e.g. Awaiting bank transfer receipt before AX release...'
                            : 'e.g. Credit limit exceeded without manager override...'
                        }
                        className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <button
                        type="submit"
                        className={`rounded-md px-3.5 py-1.5 text-xs font-semibold text-white ${
                          reasonMode === 'HOLD'
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        Confirm {reasonMode === 'HOLD' ? 'Hold' : 'Reject'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReasonMode(null)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
