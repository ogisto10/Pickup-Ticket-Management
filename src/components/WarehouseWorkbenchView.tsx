import React from 'react';
import { CheckCircle2, PackageCheck, Play, Truck } from 'lucide-react';
import { usePickup } from '../store/PickupContext';
import { StatusTag } from './StatusTag';

export const WarehouseWorkbenchView: React.FC = () => {
  const { tickets, startOrderPreparation, markOrderReady, confirmTicketCollection } = usePickup();

  const warehouseTickets = tickets
    .filter((t) => ['APPROVED', 'IN_PREPARATION', 'READY'].includes(t.status))
    .sort((a, b) => a.queuePosition - b.queuePosition);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 font-display">Warehouse Preparation & Dispatch</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Only AX-released orders appear here · Ticket advances to READY automatically once all active orders are staged
        </p>
      </div>

      {warehouseTickets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <PackageCheck className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <div className="text-sm font-semibold text-slate-900">No Released Tickets Pending</div>
          <p className="text-xs text-slate-500 mt-1">
            Approve & release a ticket in the Credit Workbench to queue orders for warehouse preparation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {warehouseTickets.map((ticket) => {
            const activeOrders = ticket.orders.filter(
              (o) => o.status !== 'CANCELLED' && o.status !== 'BLOCKED'
            );
            const readyCount = activeOrders.filter((o) => o.status === 'READY').length;

            return (
              <div key={ticket.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                      {ticket.ticketNumber}
                    </span>
                    <StatusTag status={ticket.status} />
                    <span className="text-xs font-medium text-slate-800">{ticket.customerName}</span>
                    <span className="text-xs text-slate-500 font-mono">
                      Queue #{ticket.queuePosition} · {readyCount}/{activeOrders.length} orders ready
                    </span>
                  </div>

                  {ticket.status === 'READY' && (
                    <button
                      onClick={() => confirmTicketCollection(ticket.id)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      Confirm Physical Collection
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-2 px-5">Sales ID</th>
                        <th className="py-2 px-5">Warehouse</th>
                        <th className="py-2 px-5">AX Reference</th>
                        <th className="py-2 px-5">Order Status</th>
                        <th className="py-2 px-5 text-right">Warehouse Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {ticket.orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50">
                          <td className="py-3 px-5 font-mono font-semibold text-slate-900">{order.salesId}</td>
                          <td className="py-3 px-5 font-mono text-slate-600">{order.warehouseId}</td>
                          <td className="py-3 px-5 font-mono text-slate-600">{order.axReference ?? '—'}</td>
                          <td className="py-3 px-5">
                            <StatusTag status={order.status} />
                          </td>
                          <td className="py-3 px-5 text-right">
                            {order.status === 'RELEASED' && (
                              <button
                                onClick={() => startOrderPreparation(ticket.id, order.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                              >
                                <Play className="h-3 w-3 text-sky-600" /> Start Preparation
                              </button>
                            )}
                            {order.status === 'IN_PREPARATION' && (
                              <button
                                onClick={() => markOrderReady(ticket.id, order.id)}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Mark Order Ready
                              </button>
                            )}
                            {order.status === 'READY' && (
                              <span className="text-emerald-700 font-semibold">Staged at Dock</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
