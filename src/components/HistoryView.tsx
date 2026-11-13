import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { usePickup } from '../store/PickupContext';
import { StatusTag } from './StatusTag';

export const HistoryView: React.FC = () => {
  const { history, integrations } = usePickup();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'WORKFLOW' | 'INTEGRATION'>('WORKFLOW');

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) =>
        h.entityRef.toLowerCase().includes(q) ||
        (h.ticketNumber ?? '').toLowerCase().includes(q) ||
        h.actorName.toLowerCase().includes(q) ||
        (h.reason ?? '').toLowerCase().includes(q)
    );
  }, [history, search]);

  const filteredIntegrations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return integrations;
    return integrations.filter(
      (i) =>
        i.salesId.toLowerCase().includes(q) ||
        i.ticketNumber.toLowerCase().includes(q) ||
        i.operationKey.toLowerCase().includes(q) ||
        (i.axReference ?? '').toLowerCase().includes(q)
    );
  }, [integrations, search]);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 font-display">Pickup History & AX Integration Outbox</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Immutable audit log of plan, ticket, and order transitions plus AX release outbox attempts
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('WORKFLOW')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === 'WORKFLOW' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Workflow Audit Log ({history.length})
          </button>
          <button
            onClick={() => setTab('INTEGRATION')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === 'INTEGRATION'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            AX Release Outbox ({integrations.length})
          </button>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter ticket, SO, actor, or operationKey..."
            className="w-full rounded-md border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {tab === 'WORKFLOW' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Entity</th>
                  <th className="py-2.5 px-4">Transition</th>
                  <th className="py-2.5 px-4">Actor & Role</th>
                  <th className="py-2.5 px-4">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums">{item.timestamp}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-700">{item.entityType}</span>{' '}
                      <span className="font-mono font-semibold text-slate-900">{item.entityRef}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-slate-500">{item.fromStatus}</span>
                        <span className="text-slate-400">→</span>
                        <StatusTag status={item.toStatus} />
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {item.actorName} <span className="text-slate-400">· {item.actorRole}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{item.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Ticket / SO</th>
                  <th className="py-2.5 px-4">Operation Key</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">AX Reference / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredIntegrations.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums">{entry.timestamp}</td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                      {entry.ticketNumber} · {entry.salesId}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{entry.operationKey}</td>
                    <td className="py-2.5 px-4">
                      <StatusTag status={entry.status} />
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 font-mono">
                      {entry.axReference ?? entry.errorMessage ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
