import type { AxiosRequestConfig } from 'axios';

const activeRequests = new Map<string, symbol>();

function canonicalize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
    return [...value.entries()].sort(([left], [right]) => left.localeCompare(right));
  }
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return [...value.entries()].map(([key, entry]) => [
      key,
      typeof entry === 'string'
        ? entry
        : { name: 'name' in entry ? entry.name : '', size: entry.size, type: entry.type },
    ]);
  }
  if (value instanceof ArrayBuffer) return { byteLength: value.byteLength };
  if (typeof Blob !== 'undefined' && value instanceof Blob) return { size: value.size, type: value.type };
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen));

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item, seen)]),
  );
}

export function buildApiRequestFingerprint(config: AxiosRequestConfig): string {
  const method = (config._wmsOriginalMethod ?? config.method ?? 'get').toLowerCase();
  return JSON.stringify({
    method,
    url: `${config.baseURL ?? ''}${config.url ?? ''}`,
    params: canonicalize(config.params),
    data: canonicalize(config.data),
  });
}

export function beginInFlightRequest(key: string): symbol | null {
  if (activeRequests.has(key)) return null;
  const token = Symbol(key);
  activeRequests.set(key, token);
  return token;
}

export function endInFlightRequest(key: string | undefined, token: symbol | undefined): void {
  if (!key || !token || activeRequests.get(key) !== token) return;
  activeRequests.delete(key);
}

export function resetInFlightRequestsForTests(): void {
  activeRequests.clear();
}
