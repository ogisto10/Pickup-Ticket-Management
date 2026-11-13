import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { usePickup } from '../store/PickupContext';
import { PartialOrderPolicy, QueuePolicy } from '../types/pickup';

export const AdminSettingsView: React.FC = () => {
  const { settings, updateSettings } = usePickup();
  const [form, setForm] = useState(settings);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 font-display">Pickup System Configuration</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Single-row PickupSettings table parameters + configurable open-question policies
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Ticket Prefix</label>
            <input
              type="text"
              maxLength={4}
              value={form.ticketPrefix}
              onChange={(e) => setForm({ ...form, ticketPrefix: e.target.value.toUpperCase() })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Next Sequence Number</label>
            <input
              type="number"
              min={1}
              value={form.nextSequenceNumber}
              onChange={(e) => setForm({ ...form, nextSequenceNumber: Number(e.target.value) || 1 })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Operating Time Zone</label>
            <input
              type="text"
              value={form.timeZoneId}
              onChange={(e) => setForm({ ...form, timeZoneId: e.target.value })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Arrival Cutoff Time (Absent Job)</label>
            <input
              type="time"
              value={form.arrivalCutoffTime}
              onChange={(e) => setForm({ ...form, arrivalCutoffTime: e.target.value })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">AX DataAreaId / Company</label>
            <input
              type="text"
              value={form.dataAreaId}
              onChange={(e) => setForm({ ...form, dataAreaId: e.target.value.toUpperCase() })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Default Warehouse ID</label>
            <input
              type="text"
              value={form.defaultWarehouseId}
              onChange={(e) => setForm({ ...form, defaultWarehouseId: e.target.value.toUpperCase() })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Queue Ordering Policy</label>
            <select
              value={form.queuePolicy}
              onChange={(e) => setForm({ ...form, queuePolicy: e.target.value as QueuePolicy })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-medium"
            >
              <option value="ArrivalOrder">ArrivalOrder (strict FIFO)</option>
              <option value="PriorityAndArrival">PriorityAndArrival</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Partial Order Policy (Open Question Config)
            </label>
            <select
              value={form.partialOrderPolicy}
              onChange={(e) => setForm({ ...form, partialOrderPolicy: e.target.value as PartialOrderPolicy })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-medium"
            >
              <option value="RequireAllActiveOrdersReady">RequireAllActiveOrdersReady</option>
              <option value="AllowSplitCancelledOrders">AllowSplitCancelledOrders</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            AX Release Class / AIF Service Endpoint (Configurable Open Question)
          </label>
          <input
            type="text"
            value={form.axReleaseClassName}
            onChange={(e) => setForm({ ...form, axReleaseClassName: e.target.value })}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono"
          />
        </div>

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Save className="h-3.5 w-3.5" />
            Save Pickup Settings
          </button>
        </div>
      </form>
    </div>
  );
};
