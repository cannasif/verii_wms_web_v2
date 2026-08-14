import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Loader2, PackageCheck, Play, RotateCcw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { StockIdentityCell } from '@/components/shared/StockIdentityCell';
import { formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { LocationOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import {
  productionTransferApi,
  type ProductionTask,
  type ProductionTaskBoard,
  type ProductionTaskLine,
} from '../api';
import { productionTaskTypeLabel } from '../production-transfer-task-labels';
import { useProductionTaskStart } from '../hooks/useProductionTaskStart';
import { PRODUCTION_WORK_ORDERS_MY_ASSIGNMENTS_URL } from '@/features/production/components/ProductionWorkOrderTransferTabPanel';

const TABLE_HEAD_CELL = 'border border-[var(--wms-app-border)] p-3';
const TABLE_CELL = 'border border-[var(--wms-app-border)] p-3';
const CHECKBOX_HEAD_CELL = cn(TABLE_HEAD_CELL, 'w-12 text-center');
const CHECKBOX_CELL = cn(TABLE_CELL, 'text-center');

interface Props {
  transferId: number;
  documentNo: string;
  onBoardChange?: (board: ProductionTaskBoard) => void;
}

function locationOptionLabel(code?: string, name?: string): string {
  if (code && name) return `${code} · ${name}`;
  return code || name || 'Raf seçin';
}

function isOpenReturnLine(line: ProductionTaskLine): boolean {
  return line.processedQuantity + 0.0001 < line.requestedQuantity;
}

function buildDefaultTargetsFromLines(lines: ProductionTaskLine[]) {
  const targets: Record<number, string> = {};
  const labels: Record<number, string> = {};
  for (const line of lines) {
    if (line.targetLocationId) {
      targets[line.taskLineId] = String(line.targetLocationId);
      labels[line.taskLineId] = locationOptionLabel(line.targetLocationCode, line.targetLocationName);
    }
  }
  return { targets, labels };
}

export function ProductionTransferReturnSection({ transferId, documentNo, onBoardChange }: Props) {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [board, setBoard] = useState<ProductionTaskBoard>();
  const [loadError, setLoadError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [lineTargets, setLineTargets] = useState<Record<number, string>>({});
  const [lineTargetLabels, setLineTargetLabels] = useState<Record<number, string>>({});
  const [selectedLineIds, setSelectedLineIds] = useState<number[]>([]);
  const [bulkPlacementOpen, setBulkPlacementOpen] = useState(false);
  const [bulkTargetLocation, setBulkTargetLocation] = useState('');
  const [bulkTargetLabel, setBulkTargetLabel] = useState('');
  const locationLabelsRef = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const nextBoard = await productionTransferApi.taskBoard(transferId);
      setBoard(nextBoard);
      setLoadError(undefined);
      onBoardChange?.(nextBoard);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'İade görevi yüklenemedi.');
    }
  }, [onBoardChange, transferId]);

  useEffect(() => { void load(); }, [load]);

  const returnTask = useMemo(() => {
    if (!board || !currentUserId) return undefined;
    return board.tasks.find((task) =>
      task.taskType === 'CancellationReturn'
      && task.assignments.some((assignment) => assignment.userId === currentUserId)
      && !['Completed', 'Cancelled'].includes(task.status));
  }, [board, currentUserId]);

  useEffect(() => {
    if (!returnTask) return;
    setLineTargets((current) => {
      const next = { ...current };
      for (const line of returnTask.lines) {
        if (line.targetLocationId && !next[line.taskLineId]) {
          next[line.taskLineId] = String(line.targetLocationId);
        }
      }
      return next;
    });
    setLineTargetLabels((current) => {
      const next = { ...current };
      for (const line of returnTask.lines) {
        if (line.targetLocationId && !next[line.taskLineId]) {
          next[line.taskLineId] = locationOptionLabel(line.targetLocationCode, line.targetLocationName);
        }
      }
      return next;
    });
    setSelectedLineIds((current) => current.filter((id) => returnTask.lines.some((line) => line.taskLineId === id)));
  }, [returnTask]);

  const runBoardAction = useCallback(async (action: () => Promise<ProductionTaskBoard>) => {
    setBusy(true);
    try {
      const nextBoard = await action();
      setBoard(nextBoard);
      onBoardChange?.(nextBoard);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem başarısız.');
    } finally {
      setBusy(false);
    }
  }, [load, onBoardChange]);

  const {
    checkingTaskId,
    requestStart,
  } = useProductionTaskStart({ transferId, run: runBoardAction });

  const canStart = Boolean(
    returnTask
    && returnTask.assignments.some((assignment) => assignment.userId === currentUserId)
    && !['InProgress', 'PartiallyCompleted', 'Completed', 'Cancelled'].includes(returnTask.status),
  );
  const canWork = Boolean(
    returnTask
    && ['InProgress', 'PartiallyCompleted'].includes(returnTask.status)
    && returnTask.startedBy === currentUserId,
  );

  const openReturnLines = useMemo(
    () => returnTask?.lines.filter(isOpenReturnLine) ?? [],
    [returnTask],
  );

  const selectedLineIdSet = useMemo(() => new Set(selectedLineIds), [selectedLineIds]);
  const hasBulkSelection = selectedLineIds.length > 0;
  const allLinesSelected = Boolean(
    openReturnLines.length > 0
    && openReturnLines.every((line) => selectedLineIdSet.has(line.taskLineId)),
  );
  const someLinesSelected = Boolean(
    openReturnLines.some((line) => selectedLineIdSet.has(line.taskLineId)),
  );

  const isSourceRackless = Boolean(board?.sourceIsRackless);

  const returnRowsReadyToPlace = useMemo(() => {
    const selectedOnly = selectedLineIds.length > 0;
    return openReturnLines.filter((line) => {
      if (selectedOnly && !selectedLineIdSet.has(line.taskLineId)) return false;
      if (isSourceRackless) return true;
      const target = lineTargets[line.taskLineId];
      return target != null && target !== '' && Number(target) > 0;
    });
  }, [isSourceRackless, lineTargets, openReturnLines, selectedLineIdSet, selectedLineIds.length]);

  const canPlaceReturnOnShelf = returnRowsReadyToPlace.length > 0;

  const allTargetsSelected = Boolean(
    openReturnLines.length > 0
    && (isSourceRackless || openReturnLines.every((line) => {
      const value = lineTargets[line.taskLineId];
      return value != null && value !== '' && Number(value) > 0;
    })),
  );

  const hasLayoutChanges = useMemo(() => {
    if (!returnTask) return false;
    if (selectedLineIds.length > 0) return true;
    return openReturnLines.some((line) => {
      const defaultTarget = line.targetLocationId ? String(line.targetLocationId) : '';
      return (lineTargets[line.taskLineId] ?? '') !== defaultTarget;
    });
  }, [lineTargets, openReturnLines, returnTask, selectedLineIds]);

  const toggleLineSelection = (taskLineId: number, checked: boolean) => {
    setSelectedLineIds((current) => {
      if (checked) return current.includes(taskLineId) ? current : [...current, taskLineId];
      return current.filter((id) => id !== taskLineId);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedLineIds(checked ? openReturnLines.map((line) => line.taskLineId) : []);
  };

  const buildCompletePayload = (lines: ProductionTaskLine[]) =>
    lines.map((line) => ({
      taskLineId: line.taskLineId,
      targetLocationId: isSourceRackless ? undefined : Number(lineTargets[line.taskLineId]),
    }));

  const toLocationOption = useCallback((item: LocationOption) => {
    const label = `${item.code} · ${item.name}`;
    locationLabelsRef.current[String(item.id)] = label;
    return { value: String(item.id), label };
  }, []);

  const resetLayout = () => {
    if (!returnTask) return;
    const { targets, labels } = buildDefaultTargetsFromLines(openReturnLines);
    setLineTargets(targets);
    setLineTargetLabels(labels);
    setSelectedLineIds([]);
    setBulkPlacementOpen(false);
    setBulkTargetLocation('');
    setBulkTargetLabel('');
    toast.success('Raf seçimleri varsayılan değerlere döndürüldü.');
  };

  const applyBulkTargetLocation = () => {
    if (!bulkTargetLocation || Number(bulkTargetLocation) <= 0) {
      toast.error('Toplu yerleştirme için raf seçin.');
      return;
    }
    const label = bulkTargetLabel
      || locationLabelsRef.current[bulkTargetLocation]
      || bulkTargetLocation;
    const assignedCount = selectedLineIds.length;
    setLineTargets((current) => {
      const next = { ...current };
      for (const taskLineId of selectedLineIds) next[taskLineId] = bulkTargetLocation;
      return next;
    });
    setLineTargetLabels((current) => {
      const next = { ...current };
      for (const taskLineId of selectedLineIds) next[taskLineId] = label;
      return next;
    });
    setBulkPlacementOpen(false);
    setBulkTargetLocation('');
    setBulkTargetLabel('');
    setSelectedLineIds([]);
    toast.success(`${assignedCount} satır seçilen rafa atandı.`);
  };

  const handleReturnCompleted = (nextBoard: ProductionTaskBoard) => {
    setBoard(nextBoard);
    onBoardChange?.(nextBoard);
    toast.success('İptal iadesi tamamlandı.');
    navigate(PRODUCTION_WORK_ORDERS_MY_ASSIGNMENTS_URL);
  };

  const placeReturnOnShelf = async () => {
    if (!returnTask || returnRowsReadyToPlace.length === 0) return;
    setBusy(true);
    const processedLineIds = new Set<number>();
    try {
      let nextBoard = board;
      for (const line of returnRowsReadyToPlace) {
        const targetLocationId = isSourceRackless ? undefined : Number(lineTargets[line.taskLineId]);
        if (!isSourceRackless && (!Number.isFinite(targetLocationId) || (targetLocationId ?? 0) <= 0)) continue;
        nextBoard = await productionTransferApi.processReturnTaskLine(
          transferId,
          returnTask.taskId,
          line.taskLineId,
          targetLocationId,
        );
        processedLineIds.add(line.taskLineId);
      }
      if (!nextBoard) return;

      setBoard(nextBoard);
      onBoardChange?.(nextBoard);
      setLineTargets((current) => {
        const next = { ...current };
        for (const taskLineId of processedLineIds) delete next[taskLineId];
        return next;
      });
      setLineTargetLabels((current) => {
        const next = { ...current };
        for (const taskLineId of processedLineIds) delete next[taskLineId];
        return next;
      });
      setSelectedLineIds([]);

      const updatedReturnTask = nextBoard.tasks.find((task) => task.taskId === returnTask.taskId);
      if (updatedReturnTask?.status === 'Completed') {
        handleReturnCompleted(nextBoard);
        return;
      }

      toast.success(`${processedLineIds.size} satır seçilen rafa bırakıldı.`);
    } catch (error) {
      await load();
      toast.error(error instanceof Error ? error.message : 'Rafa bırakma başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const completeReturn = async (task: ProductionTask) => {
    if (!isSourceRackless && !allTargetsSelected) {
      toast.error('Tüm satırlar için hedef raf seçin.');
      return;
    }
    setBusy(true);
    try {
      const payload = buildCompletePayload(openReturnLines);
      const nextBoard = await productionTransferApi.completeCancellationReturn(transferId, task.taskId, payload);
      handleReturnCompleted(nextBoard);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İade tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <section className="wms-ops-form-card p-5">
        <p className="font-bold text-red-500">{loadError}</p>
        <button type="button" className="mt-3 text-sm font-bold text-[var(--wms-brand-primary)]" onClick={() => void load()}>
          Tekrar dene
        </button>
      </section>
    );
  }

  if (!board || !returnTask) return null;

  const showReturnTable = openReturnLines.length > 0;
  const warehouseId = board.sourceWarehouseId;

  return (
    <section className="space-y-4">
      <div className="wms-ops-form-card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--wms-app-text-muted)]">
              {productionTaskTypeLabel(returnTask.taskType)}
            </p>
            <h2 className="mt-1 text-xl font-black">{documentNo}</h2>
            <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
              {returnTask.taskNo} · Bekleme rafından seçtiğiniz rafa geri yerleştirin
            </p>
          </div>
          {canStart ? (
            <button
              type="button"
              disabled={busy || checkingTaskId === returnTask.taskId}
              onClick={() => void requestStart(returnTask.taskId, returnTask.taskNo)}
              className="inline-flex shrink-0 items-center gap-2 self-end rounded-lg bg-[var(--wms-brand-primary)] px-4 py-2 text-sm font-bold text-[var(--wms-brand-on-primary)] disabled:opacity-50"
            >
              {checkingTaskId === returnTask.taskId ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Bu işi yapıyorum
            </button>
          ) : canWork ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 self-end">
              <OpsActionButton
                variant="secondary"
                loading={false}
                disabled={!hasLayoutChanges || busy}
                onClick={resetLayout}
                className="px-4 py-2 text-sm"
              >
                <RotateCcw className="size-4" />
                Düzeni sıfırla
              </OpsActionButton>
              {!isSourceRackless && (
              <OpsActionButton
                variant="secondary"
                loading={false}
                disabled={!hasBulkSelection || busy}
                onClick={() => setBulkPlacementOpen(true)}
                className="px-4 py-2 text-sm"
              >
                <Layers className="size-4" />
                Yerleştirme rafını seç
                {hasBulkSelection ? ` (${selectedLineIds.length})` : ''}
              </OpsActionButton>
              )}
              <OpsActionButton
                variant="primary"
                disabled={busy || !canPlaceReturnOnShelf}
                onClick={() => void placeReturnOnShelf()}
                className="px-4 py-2 text-sm"
              >
                <Undo2 className="size-4" />
                Rafa bırak
                {returnRowsReadyToPlace.length > 0 ? ` (${returnRowsReadyToPlace.length})` : ''}
              </OpsActionButton>
            </div>
          ) : null}
        </div>

        {showReturnTable ? (
          <>
            {!canWork ? (
              <p className="mb-4 text-sm text-[var(--wms-app-text-muted)]">
                {isSourceRackless
                  ? 'İadeyi tamamlamak için önce "Bu işi yapıyorum" butonuna basın.'
                  : 'Hedef rafları seçip iadeyi tamamlamak için önce "Bu işi yapıyorum" butonuna basın.'}
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
              <table className="w-full min-w-[780px] border-collapse text-sm">
                <thead className="bg-black/5 text-xs uppercase text-[var(--wms-app-text-muted)] dark:bg-white/5">
                  <tr>
                    <th className={CHECKBOX_HEAD_CELL}>
                      <OpsSkinCheckbox
                        checked={allLinesSelected}
                        indeterminate={someLinesSelected && !allLinesSelected}
                        onCheckedChange={toggleSelectAll}
                        disabled={!canWork || busy}
                        aria-label="Tüm satırları seç"
                      />
                    </th>
                    <th className={cn(TABLE_HEAD_CELL, 'text-left')}>Raf</th>
                    <th className={cn(TABLE_HEAD_CELL, 'text-left')}>Stok</th>
                    <th className={cn(TABLE_HEAD_CELL, 'text-left')}>Seri</th>
                    <th className={cn(TABLE_HEAD_CELL, 'text-right')}>Miktar</th>
                  </tr>
                </thead>
                <tbody>
                  {openReturnLines.map((line) => {
                    const isBulkSelected = selectedLineIdSet.has(line.taskLineId);
                    return (
                      <tr key={line.taskLineId}>
                        <td className={CHECKBOX_CELL}>
                          <OpsSkinCheckbox
                            checked={isBulkSelected}
                            onCheckedChange={(checked) => toggleLineSelection(line.taskLineId, checked)}
                            disabled={!canWork || busy}
                            aria-label={`${line.stockCode} satırını seç`}
                          />
                        </td>
                        <td className={TABLE_CELL}>
                          {isSourceRackless ? (
                            <span className="inline-flex items-center rounded-full border border-[var(--wms-app-border)] px-3 py-1 text-xs font-semibold text-[var(--wms-app-text-muted)]">
                              Otomatik
                            </span>
                          ) : (
                          <PagedAppDropdown<LocationOption>
                            queryKey={['production-return-target-location', warehouseId, line.taskLineId]}
                            fetchPage={(request) => warehouseTransferApi.locations(request, warehouseId)}
                            toOption={toLocationOption}
                            enabled={canWork && warehouseId > 0 && !isBulkSelected}
                            dependencies={[warehouseId, line.taskLineId]}
                            value={lineTargets[line.taskLineId] ?? ''}
                            onValueChange={(value) => {
                              setLineTargets((current) => ({ ...current, [line.taskLineId]: value }));
                              setLineTargetLabels((current) => ({
                                ...current,
                                [line.taskLineId]: locationLabelsRef.current[value] ?? value,
                              }));
                            }}
                            selectedOption={lineTargets[line.taskLineId] ? {
                              value: lineTargets[line.taskLineId],
                              label: lineTargetLabels[line.taskLineId]
                                ?? locationOptionLabel(line.targetLocationCode, line.targetLocationName),
                            } : undefined}
                            placeholder={isBulkSelected ? 'Toplu atama bekliyor' : 'Raf seçin'}
                            searchable
                            disabled={!canWork || busy || isBulkSelected}
                            className="min-w-[12rem]"
                          />
                          )}
                        </td>
                        <td className={TABLE_CELL}>
                          <StockIdentityCell stockCode={line.stockCode} stockName={line.stockName} layout="stacked" />
                        </td>
                        <td className={TABLE_CELL}>{line.serialNo || '—'}</td>
                        <td className={cn(TABLE_CELL, 'text-right')}>{formatProjectNumber(line.requestedQuantity)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <OpsActionButton
                variant="secondary"
                loading={busy}
                disabled={!canWork || !allTargetsSelected}
                onClick={() => void completeReturn(returnTask)}
              >
                <PackageCheck className="size-4" />
                İadeyi tamamladım
              </OpsActionButton>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--wms-app-text-muted)]">
            İade edilecek satır bulunmuyor.
          </p>
        )}
      </div>

      {bulkPlacementOpen && !isSourceRackless ? (
        <ResponsiveDialog
          variant="lookup"
          onClose={() => {
            setBulkPlacementOpen(false);
            setBulkTargetLocation('');
            setBulkTargetLabel('');
          }}
          title="Toplu yerleştirme rafı"
          description={`Seçili ${selectedLineIds.length} satır bekleme rafından aşağıdaki rafa atanacak.`}
        >
          <PagedAppDropdown<LocationOption>
            queryKey={['production-return-bulk-target-location', warehouseId]}
            fetchPage={(request) => warehouseTransferApi.locations(request, warehouseId)}
            toOption={toLocationOption}
            enabled={warehouseId > 0}
            dependencies={[warehouseId]}
            value={bulkTargetLocation}
            onValueChange={(value) => {
              setBulkTargetLocation(value);
              setBulkTargetLabel(locationLabelsRef.current[value] ?? value);
            }}
            selectedOption={bulkTargetLocation ? {
              value: bulkTargetLocation,
              label: bulkTargetLabel || locationLabelsRef.current[bulkTargetLocation] || bulkTargetLocation,
            } : undefined}
            placeholder="Raf seçin"
            searchable
            portalContainer={null}
            contentClassName="z-[5100]"
            className="min-w-full"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setBulkPlacementOpen(false);
                setBulkTargetLocation('');
                setBulkTargetLabel('');
              }}
            >
              İptal
            </button>
            <OpsActionButton
              variant="primary"
              loading={false}
              disabled={!bulkTargetLocation}
              onClick={applyBulkTargetLocation}
            >
              Seçili satırlara ata
            </OpsActionButton>
          </div>
        </ResponsiveDialog>
      ) : null}
    </section>
  );
}
