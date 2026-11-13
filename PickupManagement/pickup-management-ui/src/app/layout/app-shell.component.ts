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
  templateUrl: './app-shell.component.html'
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
