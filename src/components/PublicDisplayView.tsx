import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { usePickup } from '../store/PickupContext';

export const PublicDisplayView: React.FC = () => {
  const { tickets, currentRole, navigate, switchRole } = usePickup();
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Strictly sanitized: ticketNumber + display category only.
  // Never expose customer names, accounts, balances, or sales order IDs.
  const nowServing = tickets
    .filter((t) => t.status === 'APPROVED' || t.status === 'IN_PREPARATION')
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .map((t) => t.ticketNumber);

  const ordersReady = tickets
    .filter((t) => t.status === 'READY')
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .map((t) => t.ticketNumber);

  const waiting = tickets
    .filter((t) => t.status === 'ARRIVED' || t.status === 'ON_HOLD')
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .map((t) => t.ticketNumber);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Client Pickup Waiting Hall
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-white mt-0.5">
            Pickup Queue Monitor
          </h1>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="font-mono text-2xl font-bold tabular-nums text-slate-100">{clock}</div>
            <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              Sanitized Display (Ticket Numbers Only)
            </div>
          </div>

          {currentRole === 'DisplayDevice' ? (
            <button
              onClick={() => switchRole('Administrator')}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Switch to Admin
            </button>
          ) : (
            <button
              onClick={() => navigate('dashboard')}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Exit Display
            </button>
          )}
        </div>
      </header>

      {/* Main Split Board */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        {/* NOW SERVING (Preparing) */}
        <section className="p-8 flex flex-col">
          <div className="text-sm font-bold uppercase tracking-widest text-sky-400 mb-6">
            Now Preparing ({nowServing.length})
          </div>
          {nowServing.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border border-dashed border-slate-800 rounded-xl text-sm text-slate-500">
              No tickets currently in warehouse preparation
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {nowServing.map((num) => (
                <div
                  key={num}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-8 text-center"
                >
                  <div className="font-mono text-4xl font-bold tracking-tight tabular-nums text-white">
                    {num}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-wider text-sky-400 font-semibold">
                    In Preparation
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ORDERS READY */}
        <section className="p-8 flex flex-col bg-slate-900/40">
          <div className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-6">
            Ready for Pickup ({ordersReady.length})
          </div>
          {ordersReady.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border border-dashed border-slate-800 rounded-xl text-sm text-slate-500">
              No tickets staged at pickup dock yet
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {ordersReady.map((num) => (
                <div
                  key={num}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-6 py-8 text-center"
                >
                  <div className="font-mono text-5xl font-bold tracking-tight tabular-nums text-emerald-300">
                    {num}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                    Proceed to Dock
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Waiting Footer */}
      <footer className="px-8 py-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center gap-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          In Queue ({waiting.length}):
        </span>
        {waiting.length === 0 ? (
          <span className="text-xs text-slate-600">None</span>
        ) : (
          <div className="flex flex-wrap gap-3 font-mono text-sm font-semibold text-slate-300 tabular-nums">
            {waiting.map((num) => (
              <span key={num} className="px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                {num}
              </span>
            ))}
          </div>
        )}
      </footer>
    </div>
  );
};
