export const APP_ROLES = {
  Commercial: 'Commercial',
  Reception: 'Reception',
  CreditManager: 'CreditManager',
  WarehouseOperator: 'WarehouseOperator',
  Supervisor: 'Supervisor',
  Administrator: 'Administrator',
  DisplayDevice: 'DisplayDevice'
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export interface UserProfile {
  id: string;
  userName: string;
  fullName: string;
  email?: string | null;
  warehouseId?: string | null;
  roles: AppRole[];
}

export interface LoginRequest {
  userName: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: UserProfile;
}
