import type { AuthTokenResponse, Branch, LoginRequest, LoginResponse } from '../types/auth';

export function resolveSingleBranchId(branches: Branch[] | undefined): string | null {
  return branches?.length === 1 ? branches[0].id : null;
}

type BrowserFilledLoginValues = Partial<Pick<LoginRequest, 'identifier' | 'password'>>;

export function resolveLoginSubmitValues(
  currentValues: LoginRequest,
  browserFilledValues: BrowserFilledLoginValues,
  branches: Branch[] | undefined,
): LoginRequest {
  const browserIdentifier = browserFilledValues.identifier ?? '';
  const browserPassword = browserFilledValues.password ?? '';

  return {
    identifier: browserIdentifier.length > 0 ? browserIdentifier : currentValues.identifier,
    password: browserPassword.length > 0 ? browserPassword : currentValues.password,
    branchId: currentValues.branchId || resolveSingleBranchId(branches) || '',
  };
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
