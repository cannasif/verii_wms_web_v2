import type { DropdownPage, DropdownPageRequest } from '@/hooks/useDropdownInfiniteSearch';
import { steelReceiptApi } from '../api/steel-receipt.api';
import type { SteelLineRow, SteelPendingPlacementSource, SteelReceiptSource } from '../types/steel-receipt.types';
import {
  groupPlacementImportSources,
  sortPlacementImportSources,
} from './steel-receipt-placement.helpers';

export {
  filterPlacementLinesBySearch,
  filterPlacementPendingLines,
  groupPlacementImportSources,
  isPlacementPendingLine,
  sortPlacementImportSources,
} from './steel-receipt-placement.helpers';

const PLACEMENT_PAGE_SIZE = 500;

async function loadImportDateByReference(branchCode: string): Promise<Map<string, string>> {
  const plansPage = await steelReceiptApi.plansPaged({
    pageNumber: 1,
    pageSize: PLACEMENT_PAGE_SIZE,
    search: null,
    filterLogic: 'and',
    filters: [{ column: 'branchCode', operator: 'equals', value: branchCode }],
    sortBy: 'importedAtUtc',
    sortDirection: 'desc',
  });
  return new Map(
    (plansPage.items ?? plansPage.data ?? []).map((plan) => [plan.importReferenceNo, plan.importedAtUtc]),
  );
}

async function enrichPlacementImportSources(
  sources: SteelPendingPlacementSource[],
): Promise<SteelPendingPlacementSource[]> {
  return Promise.all(sources.map(async (source) => {
    try {
      const meta = await steelReceiptApi.receiptSource(source.importReferenceNo);
      return {
        ...source,
        supplierCode: meta.supplierCode,
        supplierName: meta.supplierName,
        sourceFileName: meta.sourceFileName,
      };
    } catch {
      return source;
    }
  }));
}

export async function fetchPlacementImportSourcesPage(
  branchCode: string,
  request: DropdownPageRequest,
): Promise<DropdownPage<SteelPendingPlacementSource>> {
  const [candidatesPage, importDateByReference] = await Promise.all([
    steelReceiptApi.placementCandidatesPaged({
      pageNumber: 1,
      pageSize: PLACEMENT_PAGE_SIZE,
      search: request.search ?? null,
      searchFields: request.searchFields ?? ['importReferenceNo', 'dCode', 'stockCode', 'supplierSerialNo'],
      filterLogic: 'and',
      filters: [],
      sortBy: 'lineNo',
      sortDirection: 'asc',
    }),
    loadImportDateByReference(branchCode),
  ]);

  const lines = candidatesPage.items ?? candidatesPage.data ?? [];
  const grouped = sortPlacementImportSources(
    groupPlacementImportSources(lines).map((source) => ({
      ...source,
      importedAtUtc: importDateByReference.get(source.importReferenceNo),
    })),
  );
  const pageNumber = request.pageNumber ?? 1;
  const pageSize = request.pageSize ?? 20;
  const start = (pageNumber - 1) * pageSize;
  const pageItems = grouped.slice(start, start + pageSize);
  const items = await enrichPlacementImportSources(pageItems);

  return {
    items,
    pageNumber,
    pageSize,
    totalCount: grouped.length,
    totalPages: Math.max(1, Math.ceil(grouped.length / pageSize)),
    hasNextPage: start + pageSize < grouped.length,
  };
}

export async function loadPlacementSource(reference: string): Promise<{
  source: SteelReceiptSource;
  pendingLines: SteelLineRow[];
}> {
  const normalized = reference.trim();
  const [source, candidatesPage] = await Promise.all([
    steelReceiptApi.receiptSource(normalized),
    steelReceiptApi.placementCandidatesPaged({
      pageNumber: 1,
      pageSize: PLACEMENT_PAGE_SIZE,
      search: null,
      filterLogic: 'and',
      filters: [{ column: 'importReferenceNo', operator: 'equals', value: normalized }],
      sortBy: 'lineNo',
      sortDirection: 'asc',
    }),
  ]);

  const pendingLines = candidatesPage.items ?? candidatesPage.data ?? [];
  return { source, pendingLines };
}
