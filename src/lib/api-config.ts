const RUNTIME_CONFIG_FILE_NAME = 'runtime-settings.json';

interface RuntimeConfig {
  apiUrl?: string;
  baseUrl?: string;
  realtimeNotificationsEnabled?: boolean;
}

interface ResolvedRuntimeConfig {
  apiUrl: string;
  baseUrl: string;
  realtimeNotificationsEnabled: boolean;
}

function isValidApiUrl(value: string | undefined | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function normalizeAppBasePath(value: string | undefined | null): string {
  if (!value || typeof value !== 'string') {
    return '/';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '/';
  }

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const normalizedPath = url.pathname.trim();
      if (!normalizedPath || normalizedPath === '/') {
        return '/';
      }

      return `/${normalizedPath.replace(/^\/+|\/+$/g, '')}`;
    }
  } catch {
    return '/';
  }

  if (trimmed === '/') {
    return '/';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

let cachedApiUrl = '';
let cachedAppBasePath = normalizeAppBasePath(import.meta.env.BASE_URL || '/');
let cachedRealtimeNotificationsEnabled = false;
let configPromise: Promise<ResolvedRuntimeConfig> | null = null;
const runtimeBasePath = import.meta.env.BASE_URL || '/';

function toBaseRelativePath(fileName: string): string {
  const normalizedBase = runtimeBasePath.endsWith('/') ? runtimeBasePath : `${runtimeBasePath}/`;
  return `${normalizedBase}${fileName}`;
}

async function fetchRuntimeConfig(): Promise<ResolvedRuntimeConfig> {
  const response = await fetch(toBaseRelativePath(RUNTIME_CONFIG_FILE_NAME), {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`${RUNTIME_CONFIG_FILE_NAME} HTTP ${response.status}`);
  }

  const config = (await response.json()) as RuntimeConfig;
  if (!isValidApiUrl(config?.apiUrl)) {
    throw new Error(`${RUNTIME_CONFIG_FILE_NAME} geçerli bir apiUrl içermiyor`);
  }

  return {
    apiUrl: normalizeBaseUrl(config.apiUrl!),
    baseUrl: normalizeAppBasePath(config?.baseUrl ?? '/'),
    realtimeNotificationsEnabled: config?.realtimeNotificationsEnabled === true,
  };
}

function hydrateMemoryCache(config: ResolvedRuntimeConfig): ResolvedRuntimeConfig {
  cachedApiUrl = config.apiUrl;
  cachedAppBasePath = config.baseUrl;
  cachedRealtimeNotificationsEnabled = config.realtimeNotificationsEnabled;
  return config;
}

export function loadConfig(): Promise<string> {
  if (!configPromise) {
    configPromise = fetchRuntimeConfig().then(hydrateMemoryCache);
  }

  return configPromise.then((config) => config.apiUrl);
}

export async function getApiUrl(): Promise<string> {
  return loadConfig();
}

export function getApiBaseUrl(): string {
  return cachedApiUrl;
}

export function getAppBasePath(): string {
  return cachedAppBasePath || normalizeAppBasePath(import.meta.env.BASE_URL || '/');
}

export async function isRealtimeNotificationsEnabled(): Promise<boolean> {
  if (!configPromise) {
    await loadConfig();
  }

  return cachedRealtimeNotificationsEnabled;
}

export function resolveAppPath(path: string): string {
  if (!path) {
    return getAppBasePath();
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const [pathnameWithQuery, hashFragment] = path.split('#', 2);
  const [pathnamePart, queryString] = pathnameWithQuery.split('?', 2);
  const normalizedPathname = pathnamePart.startsWith('/') ? pathnamePart : `/${pathnamePart}`;
  const basePath = getAppBasePath();

  const resolvedPath =
    basePath === '/'
      ? normalizedPathname
      : `${basePath}${normalizedPathname === '/' ? '' : normalizedPathname}`;

  const resolvedQuery = queryString ? `?${queryString}` : '';
  const resolvedHash = hashFragment ? `#${hashFragment}` : '';

  return `${resolvedPath}${resolvedQuery}${resolvedHash}`;
}

export function isCurrentAppPath(path: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return currentPath === resolveAppPath(path);
}
