import { getApiBaseUrl } from '@/lib/api-config';
import { withSessionRefreshLock } from '@/lib/session-refresh-lock';
import { isTokenValid } from '@/utils/jwt';

const accessTokenStorageKey = 'wms.session.access-token.v1';
const sessionChannelName = 'wms.auth.session.v1';
const defaultRetryDelaysMs = [250, 750, 1500];
let sessionChannel: BroadcastChannel | null | undefined;

interface AuthTokenEnvelope {
  data?: { accessToken?: string };
  Data?: { AccessToken?: string; accessToken?: string };
}

interface SessionChannelMessage {
  type: 'access-token-request' | 'access-token-response';
  requestId: string;
  token?: string;
}

export class SessionRefreshError extends Error {
  readonly status?: number;
  readonly definitive: boolean;
  readonly rootCause?: unknown;

  constructor(message: string, options?: { status?: number; definitive?: boolean; cause?: unknown }) {
    super(message);
    this.name = 'SessionRefreshError';
    this.status = options?.status;
    this.definitive = options?.definitive === true;
    this.rootCause = options?.cause;
  }
}

export function readSessionAccessToken(): string | null {
  ensureSessionChannel();
  try {
    return sessionStorage.getItem(accessTokenStorageKey);
  } catch {
    return null;
  }
}

export function writeSessionAccessToken(token: string): void {
  ensureSessionChannel();
  try {
    sessionStorage.setItem(accessTokenStorageKey, token);
  } catch {
    // The HttpOnly refresh cookie remains the source of truth when storage is unavailable.
  }
}

export function clearSessionAccessToken(): void {
  try {
    sessionStorage.removeItem(accessTokenStorageKey);
  } catch {
    // Storage can be disabled by browser policy; clearing the in-memory store is still sufficient.
  }
}

export function isDefinitiveSessionRefreshError(error: unknown): boolean {
  return error instanceof SessionRefreshError && error.definitive;
}

export async function requestSessionAccessToken(): Promise<string> {
  return withSessionRefreshLock(async () => {
    const peerToken = await requestAccessTokenFromPeer();
    if (peerToken) {
      writeSessionAccessToken(peerToken);
      return peerToken;
    }

    let lastError: SessionRefreshError | null = null;

    for (let attempt = 0; attempt <= defaultRetryDelaysMs.length; attempt += 1) {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });

        if (!response.ok) {
          const definitive = response.status === 401 || response.status === 403;
          const error = new SessionRefreshError(
            definitive
              ? 'Oturum artık geçerli değil.'
              : 'Oturum servisine geçici olarak ulaşılamıyor.',
            { status: response.status, definitive },
          );

          if (definitive || !isRetryableStatus(response.status) || attempt === defaultRetryDelaysMs.length) {
            throw error;
          }

          lastError = error;
          await delay(resolveRetryDelay(response, attempt));
          continue;
        }

        const token = extractAccessToken(await response.json() as AuthTokenEnvelope);
        if (!token) {
          throw new SessionRefreshError('Oturum yenileme yanıtı geçersiz.', {
            status: response.status,
            definitive: false,
          });
        }

        writeSessionAccessToken(token);
        return token;
      } catch (error) {
        if (error instanceof SessionRefreshError) {
          if (error.definitive || attempt === defaultRetryDelaysMs.length) {
            throw error;
          }
          lastError = error;
        } else {
          lastError = new SessionRefreshError('Oturum servisine bağlanılamıyor.', {
            definitive: false,
            cause: error,
          });
        }

        if (attempt === defaultRetryDelaysMs.length) {
          throw lastError;
        }

        await delay(defaultRetryDelaysMs[attempt]);
      }
    }

    throw lastError ?? new SessionRefreshError('Oturum yenilenemedi.', { definitive: false });
  });
}

function ensureSessionChannel(): BroadcastChannel | null {
  if (sessionChannel !== undefined) {
    return sessionChannel;
  }

  if (typeof BroadcastChannel === 'undefined') {
    sessionChannel = null;
    return sessionChannel;
  }

  sessionChannel = new BroadcastChannel(sessionChannelName);
  sessionChannel.addEventListener('message', (event: MessageEvent<SessionChannelMessage>) => {
    if (event.data?.type !== 'access-token-request' || !event.data.requestId) {
      return;
    }

    let token: string | null = null;
    try {
      token = sessionStorage.getItem(accessTokenStorageKey);
    } catch {
      return;
    }

    if (!token || !isTokenValid(token, 30)) {
      return;
    }

    sessionChannel?.postMessage({
      type: 'access-token-response',
      requestId: event.data.requestId,
      token,
    } satisfies SessionChannelMessage);
  });

  return sessionChannel;
}

function requestAccessTokenFromPeer(timeoutMs = 150): Promise<string | null> {
  const channel = ensureSessionChannel();
  if (!channel) {
    return Promise.resolve(null);
  }

  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const finish = (token: string | null): void => {
      window.clearTimeout(timeoutId);
      channel.removeEventListener('message', onMessage);
      resolve(token);
    };
    const onMessage = (event: MessageEvent<SessionChannelMessage>): void => {
      if (
        event.data?.type !== 'access-token-response'
        || event.data.requestId !== requestId
        || !event.data.token
        || !isTokenValid(event.data.token, 30)
      ) {
        return;
      }
      finish(event.data.token);
    };
    const timeoutId = window.setTimeout(() => finish(null), timeoutMs);
    channel.addEventListener('message', onMessage);
    channel.postMessage({
      type: 'access-token-request',
      requestId,
    } satisfies SessionChannelMessage);
  });
}

function extractAccessToken(payload: AuthTokenEnvelope): string | null {
  return payload.data?.accessToken
    ?? payload.Data?.accessToken
    ?? payload.Data?.AccessToken
    ?? null;
}

function isRetryableStatus(status: number): boolean {
  return status === 408
    || status === 425
    || status === 429
    || status >= 500;
}

function resolveRetryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 5000);
    }
  }

  return defaultRetryDelaysMs[attempt];
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
