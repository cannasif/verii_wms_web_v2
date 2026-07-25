import type { PagedResponse } from '@/types/api';

const MAX_SERVER_PAGE_SIZE = 200;

interface FetchAllPagedDataOptions<T> {
  fetchPage: (pageNumber: number, pageSize: number) => Promise<PagedResponse<T>>;
  pageSize?: number;
}

export async function fetchAllPagedData<T>({
  fetchPage,
  pageSize = MAX_SERVER_PAGE_SIZE,
}: FetchAllPagedDataOptions<T>): Promise<T[]> {
  const normalizedPageSize = Math.min(Math.max(1, Math.trunc(pageSize)), MAX_SERVER_PAGE_SIZE);
  const firstPage = await fetchPage(1, normalizedPageSize);
  const totalPages = Math.max(firstPage.totalPages ?? 1, 1);

  if (totalPages === 1) {
    return firstPage.data ?? [];
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2, normalizedPageSize)),
  );

  return [
    ...(firstPage.data ?? []),
    ...remainingPages.flatMap((page) => page.data ?? []),
  ];
}
