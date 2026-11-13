import React from 'react';

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate';

const STATUS_TONE: Record<string, Tone> = {
  ARRIVED: 'blue',
  PLANNED: 'blue',
  APPROVED: 'green',
  RELEASED: 'green',
  READY: 'green',
  COLLECTED: 'slate',
  COMPLETED: 'slate',
  IN_PREPARATION: 'amber',
  ON_HOLD: 'amber',
  RECONCILING: 'amber',
  RELEASE_PENDING: 'amber',
  PENDING_CREDIT: 'amber',
  PENDING: 'amber',
  REJECTED: 'red',
  BLOCKED: 'red',
  CANCELLED: 'red',
  ABSENT: 'red',
  SUCCEEDED: 'green',
  FAILED: 'red',
  Eligible: 'green',
  'Review required': 'amber',
  Ineligible: 'red',
  Blocked: 'red',
};

const TONE_CLASSES: Record<Tone, string> = {
  green: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  amber: 'text-amber-700 bg-amber-50 border-amber-200',
  red: 'text-red-700 bg-red-50 border-red-200',
  blue: 'text-sky-700 bg-sky-50 border-sky-200',
  slate: 'text-slate-700 bg-slate-100 border-slate-200',
};

const DOT_CLASSES: Record<Tone, string> = {
  green: 'bg-emerald-600',
  amber: 'bg-amber-600',
  red: 'bg-red-600',
  blue: 'bg-sky-600',
  slate: 'bg-slate-500',
};

export const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const tone = STATUS_TONE[status] ?? 'slate';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
};

export function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
