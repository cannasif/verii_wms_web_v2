export interface UserRow { id: number; username: string; email: string; role: string; isActive: boolean; lastLoginAt?: string; firstName: string; lastName: string; createdBy?: number | null; createdDate?: string | null; updatedBy?: number | null; updatedDate?: string | null }
export interface UserDetail extends UserRow { phoneNumber?: string; permissionGroupIds: number[] }
export interface PermissionGroupOption { id: number; name: string; description?: string; isSystemAdmin: boolean; isActive: boolean; permissionCount: number }
export interface CreateUserPayload { username: string; email: string; password: string; firstName?: string; lastName?: string; phoneNumber?: string; role: 'User' | 'Manager' | 'Admin'; isActive: boolean; permissionGroupIds: number[] }
export interface UpdateUserPayload { username: string; email: string; password?: string; firstName?: string; lastName?: string; phoneNumber?: string; role: 'User' | 'Manager' | 'Admin' | 'superadmin'; isActive: boolean; permissionGroupIds: number[] }
export type UserImportRowStatus = 'Created' | 'Skipped' | 'Failed';
export interface UserImportRowResult {
  rowNumber: number;
  status: UserImportRowStatus;
  username?: string | null;
  email?: string | null;
  message: string;
}
export interface UserImportResult {
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  rows: UserImportRowResult[];
}
