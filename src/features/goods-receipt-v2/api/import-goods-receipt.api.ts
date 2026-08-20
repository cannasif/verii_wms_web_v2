import { api } from '@/lib/axios';
import { foldTurkishSearch } from '@/lib/turkish-search';
import type { DropdownPage, DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import type {
  ImportOpenFile,
  ImportOpenOrders,
  ManualGoodsReceiptResult,
} from '../types/goods-receipt.types';

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const unwrap = <T,>(value: Envelope<T>): T => {
  if (!value.success) throw new Error(value.message || 'İşlem başarısız.');
  return value.data;
};

export function pageImportOpenFiles(
  files: ImportOpenFile[],
  request: Pick<DropdownPageRequest, 'pageNumber' | 'pageSize' | 'search'>,
): DropdownPage<ImportOpenFile> {
  const query = foldTurkishSearch(request.search ?? '');
  const filtered = query
    ? files.filter((file) => foldTurkishSearch([
        file.fileNumber,
        file.customerCode,
        file.customerName,
        file.deliveryCustomerCode,
        file.deliveryCustomerName,
      ].filter(Boolean).join(' ')).includes(query))
    : [...files];
  filtered.sort((left, right) => left.fileNumber.localeCompare(
    right.fileNumber,
    'tr',
    { numeric: true, sensitivity: 'base' },
  ));

  const pageSize = Math.max(1, request.pageSize ?? 20);
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageNumber = Math.min(Math.max(1, request.pageNumber ?? 1), totalPages);
  const start = (pageNumber - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    pageNumber,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: pageNumber < totalPages,
  };
}

export const importGoodsReceiptApi = {
  openFiles: async (request: DropdownPageRequest): Promise<DropdownPage<ImportOpenFile>> => {
    const files = unwrap(await api.get<Envelope<ImportOpenFile[]>>(
      '/api/netsis-read/imports/open-files',
      { signal: request.signal },
    ));
    return pageImportOpenFiles(files, request);
  },

  openOrders: async (
    importFileNumber: string,
    branchCode: string,
    includeUnavailable = false,
  ): Promise<ImportOpenOrders> => unwrap(await api.get<Envelope<ImportOpenOrders>>(
    '/api/netsis-read/goods-receipt/import/open-orders',
    {
      params: { importFileNumber, branchCode, includeUnavailable },
    },
  )),

  createDirect: async (payload: unknown): Promise<ManualGoodsReceiptResult> =>
    unwrap(await api.post<Envelope<ManualGoodsReceiptResult>>(
      '/api/goods-receipts/import/direct',
      payload,
    )),
};
