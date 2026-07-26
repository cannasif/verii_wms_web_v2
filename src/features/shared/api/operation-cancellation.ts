export type OperationCancellationRoute =
  | 'LocalCompensation'
  | 'ErpCompensation'
  | 'ManualReconciliationRequired'
  | 'AlreadyCancelled';

export interface OperationCancellationResult {
  sourceType: string;
  sourceEntityId: number;
  sourceDocumentNo: string;
  route: OperationCancellationRoute;
  operationStatus: string;
  erpStatus: string;
  erpDeleted: boolean;
  wmsReversed: boolean;
  replayed: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export function requireCompletedCancellation(
  result: OperationCancellationResult,
): OperationCancellationResult {
  if (result.wmsReversed) return result;

  throw new Error(
    result.errorMessage
      || `İptal süreci ${result.erpStatus} durumunda kaldı. ERP mutabakatı tamamlanmadan WMS stokları geri alınmadı.`,
  );
}
