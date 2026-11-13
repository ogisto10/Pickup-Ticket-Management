import React from 'react';
import {
  CalendarPlus,
  ClipboardCheck,
  Clock3,
  History,
  LayoutDashboard,
  Monitor,
  PackageCheck,
  Settings,
  ShieldCheck,
  Ticket,
  UserCheck,
  X,
} from 'lucide-react';
import { ROLE_DEFINITIONS } from '../data/seedData';
import { usePickup } from '../store/PickupContext';
import { AppRole, AppRoute } from '../types/pickup';

interface NavItem {
  route: AppRoute;
  label: string;
  section: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { route: 'dashboard', label: 'Operations Dashboard', section: 'Overview', icon: LayoutDashboard },
  { route: 'planning', label: 'Pickup Plans', section: 'Commercial', icon: ClipboardCheck },
  { route: 'planning-new', label: 'New Pickup Plan', section: 'Commercial', icon: CalendarPlus },
  { route: 'reception', label: 'Expected Arrivals', section: 'Reception Desk', icon: UserCheck },
  { route: 'reception-queue', label: 'Live Ticket Queue', section: 'Reception Desk', icon: Ticket },
  { route: 'credit', label: 'Credit Workbench', section: 'Credit & AX', icon: ShieldCheck },
  { route: 'warehouse', label: 'Warehouse Picking', section: 'Warehouse', icon: PackageCheck },
  { route: 'pickup-display', label: 'Public Display Board', section: 'Public Hall', icon: Monitor },
  { route: 'history', label: 'History & Audit Log', section: 'Compliance', icon: History },
  { route: 'admin-settings', label: 'Pickup Settings', section: 'Administration', icon: Settings },
];

const ROUTE_TITLES: Record<AppRoute, { group: string; page: string }> = {
  dashboard: { group: 'Operations', page: 'Live Overview' },
  planning: { group: 'Commercial', page: 'Scheduled Pickup Plans' },
  'planning-new': { group: 'Commercial', page: 'Schedule New Pickup' },
  reception: { group: 'Reception Desk', page: 'Expected Arrivals & Check-In' },
  'reception-queue': { group: 'Reception Desk', page: 'Arrival Sequence Queue' },
  credit: { group: 'Credit & AX 2012 R3', page: 'Credit Validation & Release' },
  warehouse: { group: 'Warehouse', page: 'Order Preparation & Collection' },
  'pickup-display': { group: 'Waiting Hall', page: 'Public Queue Monitor' },
  history: { group: 'Compliance', page: 'Workflow History & Outbox' },
  'admin-settings': { group: 'Administration', page: 'System Configuration' },
};

export const SidebarShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentRole, activeRoute, canAccessRoute, switchRole, navigate, toasts, dismissToast, settings } =
    usePickup();

  const breadcrumb = ROUTE_TITLES[activeRoute];
  const accessibleNav = NAV_ITEMS.filter((item) => canAccessRoute(item.route));
  const sections = Array.from(new Set(accessibleNav.map((i) => i.section)));

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-[260px] shrink-0 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800">
        <div className="px-5 py-4 border-b border-slate-800">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Client Pickup Ticket
          </div>
          <div className="mt-0.5 text-base font-bold text-white font-display tracking-tight">
            Pickup Management
          </div>
          <div className="mt-1 text-xs text-slate-400 tabular-nums">
            Company {settings.dataAreaId} · Whse {settings.defaultWarehouseId}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {sections.map((section) => (
            <div key={section}>
              <div className="px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {section}
              </div>
              <div className="space-y-0.5">
                {accessibleNav
                  .filter((i) => i.section === section)
                  .map((item) => {
                    const Icon = item.icon;
                    const active = activeRoute === item.route;
                    return (
                      <button
                        key={item.route}
                        onClick={() => navigate(item.route)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors text-left ${
                          active
                            ? 'bg-slate-800 text-white border border-slate-700'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        {/* Role Switcher */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Active RBAC Role
          </label>
          <select
            value={currentRole}
            onChange={(e) => switchRole(e.target.value as AppRole)}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {(Object.keys(ROLE_DEFINITIONS) as AppRole[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_DEFINITIONS[role].label} ({ROLE_DEFINITIONS[role].userName})
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {ROLE_DEFINITIONS[currentRole].summary}
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-slate-400 font-medium">{breadcrumb.group}</span>
            <span className="text-slate-300">/</span>
            <h1 className="font-display font-semibold text-slate-900 truncate">{breadcrumb.page}</h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
              <Clock3 className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Cutoff {settings.arrivalCutoffTime} · {settings.timeZoneId}
              </span>
            </div>
            {canAccessRoute('pickup-display') && activeRoute !== 'pickup-display' && (
              <button
                onClick={() => navigate('pickup-display')}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Monitor className="h-3.5 w-3.5" />
                Public Display
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => {
            const borderClass =
              toast.severity === 'success'
                ? 'border-emerald-200 bg-white'
                : toast.severity === 'warn'
                ? 'border-amber-200 bg-white'
                : toast.severity === 'error'
                ? 'border-red-200 bg-white'
                : 'border-slate-200 bg-white';
            const dotClass =
              toast.severity === 'success'
                ? 'bg-emerald-600'
                : toast.severity === 'warn'
                ? 'bg-amber-600'
                : toast.severity === 'error'
                ? 'bg-red-600'
                : 'bg-sky-600';
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto rounded-lg border ${borderClass} p-3.5 shadow-lg flex items-start gap-3`}
              >
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-900">{toast.title}</div>
                  <div className="mt-0.5 text-xs text-slate-600">{toast.detail}</div>
                </div>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="text-slate-400 hover:text-slate-700 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
