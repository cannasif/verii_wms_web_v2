import { api } from '@/lib/axios';
import { extractData } from '../utils/extract-api-data';
import type { ApiResponse } from '../types/access-control.types';
import type { MyPermissionsDto } from '../types/access-control.types';
import { useAuthStore } from '@/stores/auth-store';

interface MyPermissionsApiDto {
  isSystemAdmin: boolean;
  permissions: string[];
}

export const authAccessApi = {
  getMyPermissions: async (platform: 'web' | 'mobile' = 'web'): Promise<MyPermissionsDto> => {
    const response = await api.get<ApiResponse<MyPermissionsApiDto>>('/api/access-control/me/permissions');
    const data = extractData(response as ApiResponse<MyPermissionsApiDto>);
    const user = useAuthStore.getState().user;

    return {
      userId: user?.id ?? 0,
      roleTitle: data.isSystemAdmin ? 'System Administrator' : 'Kullanıcı',
      isSystemAdmin: data.isSystemAdmin,
      platform,
      permissionGroups: [],
      permissionCodes: data.permissions ?? [],
    };
  },
};
