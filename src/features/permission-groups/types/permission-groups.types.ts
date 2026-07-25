export interface PermissionRow { id: number; code: string; name: string; description?: string; isActive: boolean; availableOnWeb: boolean; availableOnMobile: boolean; createdBy?: number | null; createdDate?: string | null; updatedBy?: number | null; updatedDate?: string | null }
export interface PermissionGroupRow { id: number; name: string; description?: string; isSystemAdmin: boolean; isActive: boolean; permissionCount: number; createdBy?: number | null; createdDate?: string | null; updatedBy?: number | null; updatedDate?: string | null }
export interface PermissionGroupDetail { id: number; name: string; description?: string; isSystemAdmin: boolean; isActive: boolean; permissionIds: number[]; permissionCodes: string[] }
export interface PermissionGroupStats { total: number; active: number; systemAdmin: number }
export interface PermissionGroupPayload { name: string; description?: string; isSystemAdmin: boolean; isActive: boolean; permissionIds: number[] }
