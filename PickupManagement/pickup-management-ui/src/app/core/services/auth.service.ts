import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { APP_ROLES, AppRole, LoginRequest, LoginResponse, UserProfile } from '../models/auth.models';

const TOKEN_STORAGE_KEY = 'pickup_mgmt_access_token';
const USER_STORAGE_KEY = 'pickup_mgmt_user_profile';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<UserProfile | null>(this.readStoredUser());
  private readonly _token = signal<string | null>(this.readStoredToken());

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token() && !!this._user());

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, credentials)
      .pipe(
        tap((response: LoginResponse) => {
          localStorage.setItem(TOKEN_STORAGE_KEY, response.accessToken);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
          this._token.set(response.accessToken);
          this._user.set(response.user);
        })
      );
  }

  refreshProfile(): Observable<UserProfile> {
    return this.http
      .get<UserProfile>(`${environment.apiBaseUrl}/auth/me`)
      .pipe(
        tap((profile: UserProfile) => {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
          this._user.set(profile);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    this._token.set(null);
    this._user.set(null);
    void this.router.navigate(['/login']);
  }

  hasAnyRole(allowedRoles: readonly AppRole[]): boolean {
    const current = this._user();
    if (!current) {
      return false;
    }
    return allowedRoles.some((role) => current.roles.includes(role));
  }

  getDefaultRoute(): string {
    const roles = this._user()?.roles ?? [];
    if (roles.includes(APP_ROLES.DisplayDevice) && roles.length === 1) {
      return '/pickup-display';
    }
    return '/dashboard';
  }

  private readStoredToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  private readStoredUser(): UserProfile | null {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  }
}
