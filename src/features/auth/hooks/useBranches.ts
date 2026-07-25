import { useQuery } from '@tanstack/react-query';
import { lookupApi } from '@/features/shared/api/lookup-api';
import type { Branch } from '../types/auth';
import { AUTH_QUERY_KEYS } from '../utils/query-keys';

export const useBranches = () => {
  return useQuery<Branch[]>({
    queryKey: [AUTH_QUERY_KEYS.BRANCHES],
    queryFn: async ({ signal }): Promise<Branch[]> => {
      try {
        const data = await lookupApi.getBranches({ signal });
        const branches = data.map((branch) => ({
          id: String(branch.subeKodu),
          name: branch.unvan && branch.unvan.trim().length > 0 ? branch.unvan : '-',
          code: String(branch.subeKodu),
        }));

        if (branches.length > 0) {
          return branches;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[auth] Branch list could not be loaded, using development fallback branch.', error);
        }
      }

      return [{ id: '0', name: 'V3RII.CO', code: '0' }];
    },
    staleTime: Infinity,
  });
};
