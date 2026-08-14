import { describe, expect, it } from 'vitest';
import type { Branch, LoginResponse } from '../types/auth';
import { requireSuccessfulLogin, resolveSingleBranchId } from './login-flow';

const branch = (id: string): Branch => ({ id, code: id, name: `Branch ${id}` });

const response = (overrides: Partial<LoginResponse> = {}): LoginResponse => ({
  success: true,
  message: '',
  exceptionMessage: '',
  data: {
    accessToken: 'token',
    accessTokenExpiresAt: '2026-08-14T12:00:00Z',
    branchCode: '0',
  },
  errors: [],
  timestamp: '2026-08-14T12:00:00Z',
  statusCode: 200,
  className: '',
  ...overrides,
});

describe('login flow', () => {
  it('automatically resolves the only available branch', () => {
    expect(resolveSingleBranchId([branch('0')])).toBe('0');
    expect(resolveSingleBranchId([branch('0'), branch('1')])).toBeNull();
    expect(resolveSingleBranchId(undefined)).toBeNull();
  });

  it('accepts only a successful response containing an access token', () => {
    expect(requireSuccessfulLogin(response()).accessToken).toBe('token');
    expect(() => requireSuccessfulLogin(response({ success: false, message: 'Denied' }))).toThrow('Denied');
    expect(() => requireSuccessfulLogin(response({ data: null as never }))).toThrow();
  });
});
