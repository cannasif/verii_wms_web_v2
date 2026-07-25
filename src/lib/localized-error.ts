import i18n from '@/lib/i18n';

interface ApiErrorLike {
  message?: string | null;
  exceptionMessage?: string | null;
  errors?: string[] | null;
}

export function getLocalizedText(key: string): string {
  return i18n.t(key);
}

export function getApiErrorMessage(response: ApiErrorLike, fallbackKey: string): string {
  if (response.message?.trim()) return response.message;
  if (response.exceptionMessage?.trim()) return response.exceptionMessage;
  if (response.errors?.length) return response.errors.join(' ');
  return getLocalizedText(fallbackKey);
}

export function createRequiredIdError(type: 'header' | 'line' | 'package' | 'record' = 'record'): Error {
  const keyMap: Record<typeof type, string> = {
    header: 'common.errors.headerIdRequired',
    line: 'common.errors.lineIdRequired',
    package: 'common.errors.packageIdRequired',
    record: 'common.errors.recordIdRequired',
  };

  return new Error(getLocalizedText(keyMap[type]));
}
