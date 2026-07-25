import { getApiBaseUrl } from '@/lib/axios';

export function getFullProfileImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = getApiBaseUrl();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
