import { useMemo } from 'react';
import { useMyPermissionsQuery } from './useMyPermissionsQuery';
import { hasPermission } from '../utils/hasPermission';

export const usePermissionAccess = () => {
  const query = useMyPermissionsQuery();

  const api = useMemo(
    () => ({
      can: (permissionCode: string): boolean => hasPermission(query.data, permissionCode),
      permissions: query.data,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: query.refetch,
    }),
    [query.data, query.isError, query.isLoading, query.refetch]
  );

  return api;
};
