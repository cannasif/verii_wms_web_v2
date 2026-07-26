import axios from 'axios';
import { getLanguageForHttpHeader } from './i18n';
import { useAuthStore } from '@/stores/auth-store';
import { withSessionRefreshLock } from '@/lib/session-refresh-lock';
import { getUserFromToken } from '@/utils/jwt';
import { isRequestCanceled } from './request-utils';
import {
  loadConfig,
  getApiUrl,
  getApiBaseUrl,
  isCurrentAppPath,
  resolveAppPath,
} from './api-config';

export { loadConfig, getApiUrl, getApiBaseUrl, resolveAppPath };

export async function ensureApiReady(): Promise<void> {
  const base = await loadConfig();
  api.defaults.baseURL = base;
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

function appendPathSegment(url: string | undefined, segment: string): string | undefined {
  if (!url) return url;

  const [path, query] = url.split('?');
  const nextPath = path.endsWith(`/${segment}`) ? path : `${path.replace(/\/$/, '')}/${segment}`;
  return query ? `${nextPath}?${query}` : nextPath;
}

function hasNumericTailSegment(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0].replace(/\/$/, '');
  const tail = path.slice(path.lastIndexOf('/') + 1);
  return /^\d+$/.test(tail);
}

function shouldSkipBranchInjection(payload: unknown): boolean {
  return payload == null
    || typeof payload !== 'object'
    || payload instanceof FormData
    || payload instanceof Blob
    || payload instanceof ArrayBuffer;
}

function shouldReplaceBranchCode(value: unknown): boolean {
  return value == null
    || (typeof value === 'string' && (value.trim() === '' || value.trim() === '0'))
    || (typeof value === 'number' && value === 0);
}

function applyBranchCodeToPayload(payload: unknown, branchCode: string, visited = new WeakSet<object>()): void {
  if (shouldSkipBranchInjection(payload)) {
    return;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      applyBranchCodeToPayload(item, branchCode, visited);
    }
    return;
  }

  const target = payload as Record<string, unknown>;
  if (visited.has(target)) {
    return;
  }

  visited.add(target);

  if (Object.prototype.hasOwnProperty.call(target, 'branchCode') && shouldReplaceBranchCode(target.branchCode)) {
    target.branchCode = branchCode;
  }

  for (const value of Object.values(target)) {
    applyBranchCodeToPayload(value, branchCode, visited);
  }
}

function normalizeApiEnvelope(payload: unknown): unknown {
  if (
    (typeof Blob !== 'undefined' && payload instanceof Blob) ||
    payload instanceof ArrayBuffer
  ) {
    return payload;
  }

  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const source = payload as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...source };

  if (normalized.success === undefined && typeof source.Success === 'boolean') {
    normalized.success = source.Success;
  }
  if (normalized.message === undefined && typeof source.Message === 'string') {
    normalized.message = source.Message;
  }
  if (normalized.exceptionMessage === undefined && typeof source.ExceptionMessage === 'string') {
    normalized.exceptionMessage = source.ExceptionMessage;
  }
  if (normalized.traceId === undefined && typeof source.TraceId === 'string') {
    normalized.traceId = source.TraceId;
  }
  if (normalized.data === undefined && source.Data !== undefined) {
    normalized.data = source.Data;
  }
  if (normalized.errorCode === undefined && typeof source.ErrorCode === 'string') {
    normalized.errorCode = source.ErrorCode;
  }
  if (normalized.details === undefined && source.Details !== undefined) {
    normalized.details = source.Details;
  }
  if (normalized.errors === undefined && Array.isArray(source.Errors)) {
    normalized.errors = source.Errors;
  }
  if (normalized.timestamp === undefined && typeof source.Timestamp === 'string') {
    normalized.timestamp = source.Timestamp;
  }
  if (normalized.statusCode === undefined && typeof source.StatusCode === 'number') {
    normalized.statusCode = source.StatusCode;
  }
  if (normalized.className === undefined && typeof source.ClassName === 'string') {
    normalized.className = source.ClassName;
  }

  return normalized;
}

function extractApiErrorMessage(payload: unknown): string | null {
  if (payload == null || typeof payload !== 'object') {
    return null;
  }

  const errorPayload = payload as Record<string, unknown>;

  const message = errorPayload.message;
  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  const exceptionMessage = errorPayload.exceptionMessage;
  if (typeof exceptionMessage === 'string' && exceptionMessage.trim().length > 0) {
    return exceptionMessage;
  }

  const errors = errorPayload.errors;
  if (Array.isArray(errors)) {
    const firstError = errors.find((item) => typeof item === 'string' && item.trim().length > 0);
    if (typeof firstError === 'string') {
      return firstError;
    }
  }

  return null;
}

api.interceptors.request.use((config) => {
  // Runtime config is resolved during bootstrap; requests should use the hydrated in-memory value
  // instead of awaiting config.json again through loadConfig() on every call.
  config.baseURL = getApiBaseUrl() || api.defaults.baseURL || config.baseURL;
  config.headers['X-Language'] = getLanguageForHttpHeader();

  const originalMethod = (config.method ?? 'get').toLowerCase();
  const useNativeHttpMethod = config.useNativeHttpMethod === true;
  if (!useNativeHttpMethod) {
    if (originalMethod === 'put') {
      config.method = 'post';
      if (hasNumericTailSegment(config.url)) {
        config.url = appendPathSegment(config.url, 'update');
      }
    } else if (originalMethod === 'patch') {
      config.method = 'post';
    } else if (originalMethod === 'delete') {
      config.method = 'post';
      config.url = appendPathSegment(config.url, 'delete');
    }
  }

  const method = config.method?.toLowerCase();
  const hasBody = config.data !== undefined && config.data !== null && config.data !== '';
  const isMultipart = typeof FormData !== 'undefined' && config.data instanceof FormData;
  // Axios must generate the multipart boundary itself, so the JSON default has to be dropped.
  if (isMultipart || ((method === 'get' || method === 'delete' || method === 'head') && !hasBody)) {
    if (typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else if (config.headers && typeof config.headers === 'object') {
      delete config.headers['Content-Type'];
    }
  }

  const skipAuth = config.skipAuth === true;
  if (!skipAuth) {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const branch = useAuthStore.getState().branch;
    if (branch?.code) {
      config.headers['X-Branch-Code'] = branch.code;
      applyBranchCodeToPayload(config.data, branch.code);
    }
  }

  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = withSessionRefreshLock(async () => {
      const rawResponse = await axios.post(
        `${getApiBaseUrl()}/api/auth/refresh`,
        {},
        { withCredentials: true, headers: { 'Content-Type': 'application/json' } },
      );
      const response = rawResponse as { data?: unknown };
      const envelope = normalizeApiEnvelope(response.data) as { data?: { accessToken?: string } };
      const token = envelope.data?.accessToken;
      const user = token ? getUserFromToken(token) : null;
      if (!token || !user) throw new Error('Session refresh response is invalid.');
      const state = useAuthStore.getState();
      state.setAuth(user, token, state.branch);
      return token;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => {
    if (response.status === 204 || response.data === '' || response.data == null) {
      return {
        success: true,
        message: '',
        exceptionMessage: '',
        data: true,
        errors: [],
        timestamp: '',
        statusCode: response.status,
        className: '',
      };
    }

    response.data = normalizeApiEnvelope(response.data);
    return response.data;
  },
  async (error) => {
    if (isRequestCanceled(error)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && error.config?.skipSessionExpiredOn401 !== true && error.config?._retry !== true) {
      error.config._retry = true;
      try {
        await refreshAccessToken();
        return api.request(error.config);
      } catch {
        useAuthStore.getState().logout(false);
        if (!isCurrentAppPath('/auth/login?sessionExpired=true')) {
          window.location.href = resolveAppPath('/auth/login?sessionExpired=true');
        }
      }
    }

    const apiError = normalizeApiEnvelope(error.response?.data);
    if (error.response) {
      error.response.data = apiError;
    }

    const apiMessage = extractApiErrorMessage(apiError);
    const apiTraceId = typeof (apiError as { traceId?: unknown })?.traceId === 'string'
      ? (apiError as { traceId: string }).traceId
      : null;
    const isScopeRestricted = error.response?.status === 403;
    if (apiMessage) {
      error.message = apiMessage;
    }
    if (apiTraceId) {
      (error as Error & { traceId?: string }).traceId = apiTraceId;
    }
    if (isScopeRestricted) {
      (error as Error & { scopeRestricted?: boolean }).scopeRestricted = true;
      if (apiTraceId && !error.message.includes(apiTraceId)) {
        error.message = `${error.message} (TraceId: ${apiTraceId})`;
      }
    }

    return Promise.reject(error);
  }
);

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuth?: boolean;
    skipSessionExpiredOn401?: boolean;
    useNativeHttpMethod?: boolean;
    _retry?: boolean;
  }

  export interface AxiosInstance {
    get<T = unknown>(url: string, config?: import('axios').AxiosRequestConfig): Promise<T>;
    post<T = unknown>(url: string, data?: unknown, config?: import('axios').AxiosRequestConfig): Promise<T>;
    put<T = unknown>(url: string, data?: unknown, config?: import('axios').AxiosRequestConfig): Promise<T>;
    delete<T = unknown>(url: string, config?: import('axios').AxiosRequestConfig): Promise<T>;
    patch<T = unknown>(url: string, data?: unknown, config?: import('axios').AxiosRequestConfig): Promise<T>;
  }
}
