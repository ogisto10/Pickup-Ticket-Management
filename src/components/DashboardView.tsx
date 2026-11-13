import React from 'react';
import { ArrowRight, Clock, Play } from 'lucide-react';
import { usePickup } from '../store/PickupContext';
import { StatusTag } from './StatusTag';

export const DashboardView: React.FC = () => {
  const { tickets, plans, integrations, runAbsentCutoff, navigate, canAccessRoute, currentRole } = usePickup();

  const arrivedCount = tickets.filter((t) => t.status === 'ARRIVED').length;
  const onHoldCount = tickets.filter((t) => t.status === 'ON_HOLD').length;
  const prepCount = tickets.filter((t) => t.status === 'APPROVED' || t.status === 'IN_PREPARATION').length;
  const readyCount = tickets.filter((t) => t.status === 'READY').length;
  const collectedCount = tickets.filter((t) => t.status === 'COLLECTED').length;
  const plannedPending = plans.filter((p) => p.status === 'PLANNED').length;
  const reconcilingCount = integrations.filter((i) => i.status === 'RECONCILING').length;

  const isReceptionRole = currentRole === 'Reception';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display">Daily Pickup Operations</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Synchronized queue counts across Commercial Planning, Reception, Credit & AX Release, and Warehouse
          </p>
        </div>

        {(currentRole === 'Supervisor' || currentRole === 'Administrator') && (
          <button
            onClick={() => runAbsentCutoff()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            Run Absent Cutoff ({plannedPending} pending)
          </button>
        )}
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Expected Planned', value: plannedPending, tone: 'text-slate-900' },
          { label: 'Waiting Credit', value: arrivedCount, tone: 'text-sky-700' },
          { label: 'On Hold', value: onHoldCount, tone: onHoldCount > 0 ? 'text-amber-700' : 'text-slate-900' },
          { label: 'In Warehouse', value: prepCount, tone: 'text-slate-900' },
          { label: 'Ready at Dock', value: readyCount, tone: 'text-emerald-700' },
          { label: 'Collected Today', value: collectedCount, tone: 'text-slate-700' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{stat.label}</div>
            <div className={`mt-2 text-2xl font-bold font-mono tabular-nums ${stat.tone}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {reconcilingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-xs text-amber-900">
            <span className="font-semibold">AX Outbox Alert:</span> {reconcilingCount} order release operation(s)
            are in <span className="font-mono font-semibold">RECONCILING</span> state awaiting idempotent AX confirmation.
          </div>
          {canAccessRoute('credit') && (
            <button
              onClick={() => navigate('credit')}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap shrink-0"
            >
              Open Credit Workbench
            </button>
          )}
        </div>
      )}

      {/* Active Tickets Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Today&apos;s Active Ticket Queue</h3>
            <p className="text-xs text-slate-500">Ordered ascending by arrival sequence position</p>
          </div>
          <div className="flex items-center gap-2">
            {canAccessRoute('reception') && (
              <button
                onClick={() => navigate('reception')}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Play className="h-3 w-3" /> Check-In Desk
              </button>
            )}
            {canAccessRoute('credit') && (
              <button
                onClick={() => navigate('credit')}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Credit Review <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No tickets issued yet today. Start at Expected Arrivals to register a customer arrival.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Queue</th>
                  <th className="py-2.5 px-4">Ticket</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Source</th>
                  <th className="py-2.5 px-4">Sales Orders</th>
                  <th className="py-2.5 px-4">Arrived</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {[...tickets]
                  .sort((a, b) => a.queuePosition - b.queuePosition)
                  .map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        #{ticket.queuePosition}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                        {ticket.ticketNumber}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{ticket.customerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{ticket.customerAccount}</div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">
                        {ticket.sourcePlanCode ? `Plan ${ticket.sourcePlanCode}` : 'Walk-In'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700">
                        {ticket.orders.map((o) => o.salesId).join(', ')}
                        {!isReceptionRole && ticket.creditHoldReason && (
                          <div className="text-[11px] text-amber-700 font-sans mt-0.5 truncate max-w-xs">
                            {ticket.creditHoldReason}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                        {ticket.arrivedAt}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={ticket.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
