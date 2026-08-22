import { steelReceiptApi } from '../api/steel-receipt.api';

export {
  areAllPlacementSheetsSelected,
  compatiblePlacementSheetsForSelection,
  hasPendingPlacementLines,
  hasSteelReceiptPlacementDraft,
  keepPendingPlacementSelection,
  restoreSelectedLine,
  restoreSelectedLines,
  toggleAllPlacementSheetSelection,
  togglePlacementSheetSelection,
  type LoadPlacementSourceOptions,
  type SteelReceiptPlacementDraft,
} from './steel-receipt-placement-draft.helpers';

export async function isPlacementSourceStillPending(
  importReferenceNo: string,
): Promise<boolean> {
  const normalized = importReferenceNo.trim();
  if (!normalized) return false;

  const page = await steelReceiptApi.placementCandidatesPaged({
    pageNumber: 1,
    pageSize: 1,
    search: null,
    filterLogic: 'and',
    filters: [{ column: 'importReferenceNo', operator: 'equals', value: normalized }],
    sortBy: 'lineNo',
    sortDirection: 'asc',
  });

  const items = page.items ?? page.data ?? [];
  return items.length > 0;
}
