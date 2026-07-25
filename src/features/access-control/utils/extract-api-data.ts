import type { ApiResponse } from '../types/access-control.types';
import { getLocalizedText } from '@/lib/localized-error';

export function extractData<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || response.exceptionMessage || getLocalizedText('common.errors.requestFailed'));
  }
  return response.data;
}
