import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { APP_ROLES } from './core/models/auth.models';
import { AppShellComponent } from './layout/app-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'pickup-display',
    canActivate: [
      authGuard,
      roleGuard([
        APP_ROLES.DisplayDevice,
        APP_ROLES.Reception,
        APP_ROLES.Supervisor,
        APP_ROLES.Administrator
      ])
    ],
    loadComponent: () =>
      import('./features/display/pickup-display.component').then(
        (m) => m.PickupDisplayComponent
      )
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        canActivate: [
          roleGuard([
            APP_ROLES.Commercial,
            APP_ROLES.Reception,
            APP_ROLES.CreditManager,
            APP_ROLES.WarehouseOperator,
            APP_ROLES.Supervisor,
            APP_ROLES.Administrator
          ])
        ],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          )
      },
      {
        path: 'planning',
        canActivate: [
          roleGuard([
            APP_ROLES.Commercial,
            APP_ROLES.Supervisor,
            APP_ROLES.Administrator
          ])
        ],
        loadComponent: () =>
          import('./features/planning/planning-list.component').then(
            (m) => m.PlanningListComponent
          )
      },
      {
        path: 'planning/new',
        canActivate: [
          roleGuard([
            APP_ROLES.Commercial,
            APP_ROLES.Supervisor,
            APP_ROLES.Administrator
          ])
        ],
        loadComponent: () =>
          import('./features/planning/planning-new.component').then(
            (m) => m.PlanningNewComponent
          )
      },
      {
        path: 'planning/:id/edit',
        canActivate: [
          roleGuard([
            APP_ROLES.Commercial,
            APP_ROLES.Supervisor,
            APP_ROLES.Administrator
          ])
        ],
        loadComponent: () =>
          import('./features/planning/planning-new.component').then(
            (m) => m.PlanningNewComponent
          )
      },
      {
        path: 'reception',
        canActivate: [
          roleGuard([
            APP_ROLES.Reception,
            APP_ROLES.Supervisor,
            APP_ROLES.Administrator
          ])
        ],
        loadComponent: () =>
          import('./features/reception/reception-arrivals.component').then(
            (m) => m.ReceptionArrivalsComponent
          )
      },
      {
        path: 'reception/queue',
        canActivate: [
          roleGuard([
            APP_ROLES.Reception,
            APP_ROLES.CreditManager,
            APP_ROLES.Supervisor,
            APP_ROLES.Administrator
          ])
        ],
        loadComponent: () =>
          import('./features/reception/reception-queue.component').then(
            (m) => m.ReceptionQueueComponent
          )
      },
      {
        path: 'credit',
        canActivate: [roleGuard([APP_ROLES.CreditManager])],
        loadComponent: () =>
          import('./features/credit/credit-workbench.component').then(
            (m) => m.CreditWorkbenchComponent
          )
      },
      {
        path: 'warehouse',
        canActivate: [
          roleGuard([
            APP_ROLES.WarehouseOperator,
            APP_ROLES.Supervisor,
            APP_ROLES.Administrator
          ])
        ],
        loadComponent: () =>
          import('./features/warehouse/warehouse-workbench.component').then(
            (m) => m.WarehouseWorkbenchComponent
          )
      },
      {
        path: 'history',
        canActivate: [
          roleGuard([APP_ROLES.Supervisor, APP_ROLES.Administrator])
        ],
        loadComponent: () =>
          import('./features/history/history-search.component').then(
            (m) => m.HistorySearchComponent
          )
      },
      {
        path: 'admin/settings',
        canActivate: [roleGuard([APP_ROLES.Administrator])],
        loadComponent: () =>
          import('./features/admin/admin-settings.component').then(
            (m) => m.AdminSettingsComponent
          )
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
