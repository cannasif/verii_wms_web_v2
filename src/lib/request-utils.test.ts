import { describe, expect, it } from 'vitest';
import {
  getRequestAbortSignal,
  withRequestAbortSignal,
} from './request-utils';

describe('request abort signal carrier', () => {
  it('survives feature-wrapper object spread without entering JSON', () => {
    const controller = new AbortController();
    const request = withRequestAbortSignal({ pageNumber: 1, search: 'abc' }, controller.signal);
    const wrapped = { ...request, pageSize: 20 };

    expect(getRequestAbortSignal(wrapped)).toBe(controller.signal);
    expect(JSON.stringify(wrapped)).toBe('{"pageNumber":1,"search":"abc","pageSize":20}');
  });
});
