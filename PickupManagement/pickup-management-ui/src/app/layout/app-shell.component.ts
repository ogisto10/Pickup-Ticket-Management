import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../core/services/auth.service';
import { APP_ROLES, AppRole } from '../core/models/auth.models';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: readonly AppRole[];
}

const ALL_OPERATIONAL_ROLES: readonly AppRole[] = [
  APP_ROLES.Commercial,
  APP_ROLES.Reception,
  APP_ROLES.CreditManager,
  APP_ROLES.WarehouseOperator,
  APP_ROLES.Supervisor,
  APP_ROLES.Administrator
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ToolbarModule,
    ButtonModule,
    TagModule
  ],
  template: `
    <div class="layout-shell">
      <p-toolbar styleClass="border-noround border-x-none border-top-none px-4 py-2 surface-card">
        <div class="p-toolbar-group-start flex align-items-center gap-3">
          <i class="pi pi-ticket text-primary text-2xl"></i>
          <div>
            <div class="font-bold text-900 text-lg">Client Pickup Ticket Management</div>
            <div class="text-xs text-500" *ngIf="user()?.warehouseId">
              Warehouse: {{ user()?.warehouseId }}
            </div>
          </div>
        </div>

        <div class="p-toolbar-group-end flex align-items-center gap-3" *ngIf="user() as currentUser">
          <div class="text-right hidden sm:block">
            <div class="font-semibold text-900 text-sm">{{ currentUser.fullName }}</div>
            <div class="flex gap-1 justify-content-end mt-1">
              <p-tag
                *ngFor="let role of currentUser.roles"
                [value]="role"
                severity="info"
                [rounded]="false"
              ></p-tag>
            </div>
          </div>
          <p-button
            label="Sign out"
            icon="pi pi-sign-out"
            severity="secondary"
            [outlined]="true"
            size="small"
            (onClick)="logout()"
          ></p-button>
        </div>
      </p-toolbar>

      <div class="layout-body">
        <aside class="layout-sidebar p-3">
          <div class="text-xs font-semibold text-500 uppercase mb-2 px-2">Navigation</div>
          <nav class="flex flex-column gap-1">
            <a
              *ngFor="let item of visibleNavItems()"
              [routerLink]="item.route"
              routerLinkActive="bg-primary-50 text-primary font-semibold"
              [routerLinkActiveOptions]="{ exact: item.route === '/planning' || item.route === '/reception' }"
              class="flex align-items-center gap-2 px-3 py-2 border-round text-700 no-underline hover:surface-hover transition-colors transition-duration-150"
            >
              <i [class]="item.icon"></i>
              <span>{{ item.label }}</span>
            </a>
          </nav>
        </aside>

        <main class="layout-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.authService.user;

  private readonly navItems: NavItem[] = [
    {
      label: 'Operational Dashboard',
      icon: 'pi pi-chart-bar',
      route: '/dashboard',
      roles: ALL_OPERATIONAL_ROLES
    },
    {
      label: 'Planned Pickups',
      icon: 'pi pi-calendar',
      route: '/planning',
      roles: [APP_ROLES.Commercial, APP_ROLES.Supervisor, APP_ROLES.Administrator]
    },
    {
      label: 'New Pickup Plan',
      icon: 'pi pi-plus-circle',
      route: '/planning/new',
      roles: [APP_ROLES.Commercial, APP_ROLES.Supervisor, APP_ROLES.Administrator]
    },
    {
      label: "Today's Arrivals",
      icon: 'pi pi-users',
      route: '/reception',
      roles: [APP_ROLES.Reception, APP_ROLES.Supervisor, APP_ROLES.Administrator]
    },
    {
      label: 'Live Ticket Queue',
      icon: 'pi pi-list',
      route: '/reception/queue',
      roles: [APP_ROLES.Reception, APP_ROLES.CreditManager, APP_ROLES.Supervisor, APP_ROLES.Administrator]
    },
    {
      label: 'Credit Workbench',
      icon: 'pi pi-verified',
      route: '/credit',
      roles: [APP_ROLES.CreditManager]
    },
    {
      label: 'Warehouse Preparation',
      icon: 'pi pi-box',
      route: '/warehouse',
      roles: [APP_ROLES.WarehouseOperator, APP_ROLES.Supervisor, APP_ROLES.Administrator]
    },
    {
      label: 'Public Ticket Display',
      icon: 'pi pi-desktop',
      route: '/pickup-display',
      roles: [APP_ROLES.DisplayDevice, APP_ROLES.Reception, APP_ROLES.Supervisor, APP_ROLES.Administrator]
    },
    {
      label: 'Pickup History',
      icon: 'pi pi-history',
      route: '/history',
      roles: [APP_ROLES.Supervisor, APP_ROLES.Administrator]
    },
    {
      label: 'Settings',
      icon: 'pi pi-cog',
      route: '/admin/settings',
      roles: [APP_ROLES.Administrator]
    }
  ];

  readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => this.authService.hasAnyRole(item.roles))
  );

  logout(): void {
    this.authService.logout();
  }
}
