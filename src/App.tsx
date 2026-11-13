/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AdminSettingsView } from './components/AdminSettingsView';
import { CreditWorkbenchView } from './components/CreditWorkbenchView';
import { DashboardView } from './components/DashboardView';
import { HistoryView } from './components/HistoryView';
import { NewPlanView, PlanningListView } from './components/PlanningView';
import { PublicDisplayView } from './components/PublicDisplayView';
import { ReceptionArrivalsView, ReceptionQueueView } from './components/ReceptionView';
import { SidebarShell } from './components/SidebarShell';
import { WarehouseWorkbenchView } from './components/WarehouseWorkbenchView';
import { PickupProvider, usePickup } from './store/PickupContext';

const PickupWorkspace: React.FC = () => {
  const { activeRoute } = usePickup();

  if (activeRoute === 'pickup-display') {
    return <PublicDisplayView />;
  }

  let content: React.ReactNode = <DashboardView />;
  switch (activeRoute) {
    case 'dashboard':
      content = <DashboardView />;
      break;
    case 'planning':
      content = <PlanningListView />;
      break;
    case 'planning-new':
      content = <NewPlanView />;
      break;
    case 'reception':
      content = <ReceptionArrivalsView />;
      break;
    case 'reception-queue':
      content = <ReceptionQueueView />;
      break;
    case 'credit':
      content = <CreditWorkbenchView />;
      break;
    case 'warehouse':
      content = <WarehouseWorkbenchView />;
      break;
    case 'history':
      content = <HistoryView />;
      break;
    case 'admin-settings':
      content = <AdminSettingsView />;
      break;
  }

  return <SidebarShell>{content}</SidebarShell>;
};

export default function App() {
  return (
    <PickupProvider>
      <PickupWorkspace />
    </PickupProvider>
  );
}
