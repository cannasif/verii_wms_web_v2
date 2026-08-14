import type { AuthTokenResponse, Branch, LoginResponse } from '../types/auth';

export function resolveSingleBranchId(branches: Branch[] | undefined): string | null {
  return branches?.length === 1 ? branches[0].id : null;
}

export function requireSuccessfulLogin(response: LoginResponse): AuthTokenResponse {
  const accessToken = response.data?.accessToken?.trim();
  if (!response.success || !accessToken) {
    throw new Error(response.message?.trim() ?? '');
  }

  return {
    ...response.data,
    accessToken,
  };
}
