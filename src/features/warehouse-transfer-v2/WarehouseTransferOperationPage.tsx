import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, CheckCircle2, Loader2, PlayCircle, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { TrackingPlanEditor, type TrackingPlanRow } from '@/components/shared/TrackingPlanEditor';
import { WarehouseBarcodeScanner } from '@/features/barcode-resolution/WarehouseBarcodeScanner';
import { completeGoodsReceiptDocumentNo, normalizeGoodsReceiptDocumentNo } from '@/features/goods-receipt-v2/utils/goods-receipt-document-reference';
import { localizeEnumValue } from '@/lib/enum-localization';
import { formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { transferApiFor, warehouseTransferApi, type TransferApiVariant } from './api/warehouse-transfer.api';
import {
  fetchStockSourceLocationsPage,
  stockSourceLocationOption,
} from './utils/stock-source-location-options';
import { transferDetailQueryKey } from './utils/transfer-detail-query-key';
import { TransferLinePickedSources } from './components/TransferLinePickedSources';
import type { WarehouseTransferDetail } from './types/warehouse-transfer.types';

type Phase = 'pick' | 'dispatch' | 'receive' | 'putaway';
type EditLine = {
  lineId: number;
  quantity: number;
  sourceLocationId: number | null;
  targetLocationId: number | null;
  sourceValue: string | null;
  targetValue: string | null;
  trackings: TrackingPlanRow[];
};

const phaseOptions = [
  { value: 'pick', label: '01 · Toplama' },
  { value: 'dispatch', label: '02 · Kaynak depodan sevk' },
  { value: 'receive', label: '03 · Hedef depo kabulü' },
  { value: 'putaway', label: '04 · Hedef rafa yerleştirme' },
];

export function WarehouseTransferOperationPage({ variant = 'warehouse' }: { variant?: TransferApiVariant }) {
  const id = Number(useParams().id);
  const queryClient = useQueryClient();
  const transferApi = useMemo(() => transferApiFor(variant), [variant]);
  const listUrl = variant === 'production' ? '/warehouse/production-transfers/list'
    : variant === 'subcontracting' ? '/warehouse/subcontracting-transfers/list' : '/warehouse/transfers/list';
  const detailQueryKey = useMemo(() => transferDetailQueryKey(variant, id), [id, variant]);
  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => transferApi.detail(id),
    enabled: Number.isFinite(id) && id > 0,
  });
  const detail = detailQuery.data;
  const loadError = detailQuery.error instanceof Error
    ? detailQuery.error.message
    : detailQuery.isError ? 'Transfer kaydı açılamadı.' : undefined;
  const reloadDetail = useCallback(async () => {
    await detailQuery.refetch();
  }, [detailQuery]);
  const [phase, setPhase] = useState<Phase>('pick');
  const [lines, setLines] = useState<EditLine[]>([]);
  const [reason, setReason] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [waybillNo, setWaybillNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [submittingLineId, setSubmittingLineId] = useState<number>();

  useEffect(() => {
    if (detailQuery.isError && detailQuery.error instanceof Error) {
      toast.error(detailQuery.error.message);
    }
  }, [detailQuery.error, detailQuery.isError]);

  const remaining = useCallback((line: WarehouseTransferDetail['lines'][number]) => {
    switch (phase) {
      case 'pick': return line.requestedQuantity - line.pickedQuantity;
      case 'dispatch': return line.pickedQuantity - line.shippedQuantity;
      case 'receive': return line.shippedQuantity - line.receivedQuantity;
      case 'putaway': return line.receivedQuantity - line.putawayQuantity;
    }
  }, [phase]);

  const trackingRemaining = useCallback((tracking: WarehouseTransferDetail['lines'][number]['trackings'][number]) => {
    switch (phase) {
      case 'pick': return tracking.plannedQuantity - tracking.pickedQuantity;
      case 'dispatch': return tracking.pickedQuantity - tracking.shippedQuantity;
      case 'receive': return tracking.shippedQuantity - tracking.receivedQuantity;
      case 'putaway': return tracking.receivedQuantity - tracking.putawayQuantity;
    }
  }, [phase]);

  // Kaynak/hedef depo aynıysa satırın varsayılan kaynak/hedef rafı her fazda geçerlidir. Depolar
  // farklıysa, toplama fazının hedefi kaynak depo içinde kalmak zorunda (backend:
  // WarehouseTransferOperationService.BuildMovementRequest — Pick için targetWarehouse=SourceWarehouseId),
  // bu yüzden o durumda satırın (hedef depodaki) nihai rafı toplamaya önceden doldurulmaz — boş gelir,
  // kullanıcı elle seçer. Aynı mantık simetrik olarak kaynak raf için kabul/yerleştirme fazlarında geçerli.
  const sameWarehouse = detail?.header.sourceWarehouseId === detail?.header.targetWarehouseId;
  const productionExcludedSourceLocationIds = useMemo(() => {
    if (!detail || variant !== 'production') return undefined;
    const ids = new Set<number>();
    if (detail.draft.sourceStagingLocationId) ids.add(detail.draft.sourceStagingLocationId);
    if (detail.draft.targetPutawayLocationId) ids.add(detail.draft.targetPutawayLocationId);
    detail.lines.forEach((row) => {
      if (row.defaultTargetLocationId) ids.add(row.defaultTargetLocationId);
    });
    return ids.size > 0 ? [...ids] : undefined;
  }, [detail, variant]);
  const isExcludedSourceLocation = useCallback((locationId?: number | null) =>
    Boolean(locationId && productionExcludedSourceLocationIds?.includes(locationId)),
  [productionExcludedSourceLocationIds]);
  useEffect(() => {
    if (!detail) return;
    setLines(detail.lines.filter((line) => remaining(line) > 0).map((line) => ({
      lineId: line.id,
      quantity: remaining(line),
      sourceLocationId: (phase === 'pick' || phase === 'dispatch' || sameWarehouse) && line.defaultSourceLocationId && !isExcludedSourceLocation(line.defaultSourceLocationId)
        ? line.defaultSourceLocationId
        : null,
      targetLocationId: (phase !== 'pick' || sameWarehouse) ? line.defaultTargetLocationId ?? null : null,
      sourceValue: (phase === 'pick' || phase === 'dispatch' || sameWarehouse) && line.defaultSourceLocationId && !isExcludedSourceLocation(line.defaultSourceLocationId)
        ? String(line.defaultSourceLocationId)
        : null,
      targetValue: (phase !== 'pick' || sameWarehouse) && line.defaultTargetLocationId ? String(line.defaultTargetLocationId) : null,
      // Draft'ta zaten girilmiş planlı seri/lot kayıtları varsa önceden doldur — pick sırasında
      // bunlarla birebir aynı değer gönderilmesi backend'de zorunlu (aksi halde 409 Conflict).
      trackings: line.trackings
        .map((t) => ({ tracking: t, qty: trackingRemaining(t) }))
        .filter((x) => x.qty > 0)
        .map(({ tracking: t, qty }) => ({
          localId: String(t.id),
          quantity: qty,
          lotNo: t.lotNo ?? undefined,
          serialNo: t.serialNo ?? undefined,
          handlingUnitNo: t.handlingUnitNo ?? undefined,
          manufacturingDate: t.manufacturingDate ?? undefined,
          expirationDate: t.expirationDate ?? undefined,
        })),
    })));
  }, [detail, phase, remaining, trackingRemaining, sameWarehouse, isExcludedSourceLocation]);

  const sourceWarehouseId = detail
    ? phase === 'pick' || phase === 'dispatch' ? detail.header.sourceWarehouseId : detail.header.targetWarehouseId
    : 0;
  const targetWarehouseId = detail
    ? phase === 'pick' ? detail.header.sourceWarehouseId : detail.header.targetWarehouseId
    : 0;
  const patch = (lineId: number, value: Partial<EditLine>) =>
    setLines((current) => current.map((line) => line.lineId === lineId ? { ...line, ...value } : line));

  const transition = async (action: 'approve' | 'release') => {
    setBusy(true);
    try {
      const result = await transferApi.transition(id, action, reason);
      toast.success(`${result.documentNo}: ${localizeEnumValue(result.status)}`);
      await reloadDetail();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const completeLine = async (line: WarehouseTransferDetail['lines'][number]) => {
    const edit = lines.find((x) => x.lineId === line.id);
    if (!edit) return;
    if (!edit.sourceLocationId || !edit.targetLocationId)
      return toast.error('Kaynak ve hedef raf seçimlerini tamamlayın.');
    const isTracked = line.trackingType !== 'None';
    const submissions = isTracked
      ? edit.trackings.filter((row) => row.quantity > 0)
      : [{ localId: 'single', quantity: edit.quantity, lotNo: undefined, serialNo: undefined } satisfies TrackingPlanRow];
    if (!submissions.length) return toast.error('İşlenecek miktar girilmedi.');
    if (isTracked) {
      const invalid = submissions.some((row) => {
        if ((line.trackingType === 'Serial' || line.trackingType === 'LotAndSerial') && (!row.serialNo?.trim() || row.quantity !== 1)) return true;
        return (line.trackingType === 'Lot' || line.trackingType === 'LotAndSerial') && !row.lotNo?.trim();
      });
      if (invalid) return toast.error('Seri, lot ve miktar bilgilerini stok takip kuralına uygun doldurun.');
    }
    setSubmittingLineId(line.id);
    try {
      let result;
      for (const row of submissions) {
        result = await transferApi.operate(id, phase, {
          lines: [{
            lineId: line.id,
            quantity: row.quantity,
            sourceLocationId: edit.sourceLocationId,
            targetLocationId: edit.targetLocationId,
            lotNo: row.lotNo?.trim() || null,
            serialNo: row.serialNo?.trim() || null,
          }],
          reason,
          vehiclePlate,
          driverName,
          waybillNo,
        });
      }
      if (result) toast.success(`#${line.lineNo} · ${line.stockCode}: ${localizeEnumValue(result.status)}`);
      await reloadDetail();
      if (variant === 'production') {
        void queryClient.invalidateQueries({ queryKey: ['production-transfer', 'board', id] });
        void queryClient.invalidateQueries({ queryKey: ['wt-op-source'] });
        void queryClient.invalidateQueries({ queryKey: ['production-transfer', 'picked-sources', id] });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operasyon tamamlanamadı.');
    } finally {
      setSubmittingLineId(undefined);
    }
  };

  const totals = useMemo(() => detail ? {
    requested: detail.lines.reduce((x, y) => x + y.requestedQuantity, 0),
    picked: detail.lines.reduce((x, y) => x + y.pickedQuantity, 0),
    shipped: detail.lines.reduce((x, y) => x + y.shippedQuantity, 0),
    received: detail.lines.reduce((x, y) => x + y.receivedQuantity, 0),
    putaway: detail.lines.reduce((x, y) => x + y.putawayQuantity, 0),
  } : null, [detail]);

  if (loadError) return <OperationLoadError message={loadError} listUrl={listUrl} />;
  if (detailQuery.isLoading || !detail || !totals) return <div className="grid min-h-80 place-items-center"><Loader2 className="size-7 animate-spin text-violet-500" /></div>;

  return <section className="space-y-5">
    <header className="rounded-2xl border bg-gradient-to-r from-violet-500/10 via-[var(--wms-app-panel)] to-cyan-500/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-violet-500">Transfer Operasyon Merkezi</p><h1 className="mt-1 text-2xl font-black">{detail.header.documentNo}</h1><p className="text-sm text-slate-500">{detail.header.sourceWarehouseCode} {detail.header.sourceWarehouseName} → {detail.header.targetWarehouseCode} {detail.header.targetWarehouseName}</p></div>
        <Link to={listUrl} className="rounded-xl border px-4 py-2 text-sm">Kayıtlara dön</Link>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        <Metric label="Plan" value={totals.requested} /><Metric label="Toplanan" value={totals.picked} /><Metric label="Sevk" value={totals.shipped} /><Metric label="Kabul" value={totals.received} /><Metric label="Yerleşen" value={totals.putaway} />
      </div>
    </header>

    <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-black">Belge kapıları</h2><p className="text-xs text-slate-500">Durum: {localizeEnumValue(detail.header.status)} · Onay: {localizeEnumValue(detail.header.approvalStatus)}</p></div>
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => void transition('approve')} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500 px-4 py-2 text-emerald-500"><ShieldCheck className="size-4" />Onayla</button>
          <button disabled={busy} onClick={() => void transition('release')} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-white"><PlayCircle className="size-4" />Serbest bırak</button>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border bg-[var(--wms-app-panel)] p-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Operasyon"><AppDropdown value={phase} onValueChange={(value) => setPhase(value as Phase)} options={phaseOptions} /></Field>
        <Field label="Araç plakası"><input className="input" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} /></Field>
        <Field label="Şoför"><input className="input" value={driverName} onChange={(e) => setDriverName(e.target.value)} /></Field>
        <Field label="İrsaliye"><input className="input" maxLength={15} value={waybillNo} onChange={(e) => setWaybillNo(normalizeGoodsReceiptDocumentNo(e.target.value))} onBlur={() => setWaybillNo(completeGoodsReceiptDocumentNo(waybillNo))} /></Field>
      </div>
      <Field label="İşlem notu"><input className="input mt-3" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>

      <div className="mt-5">
        <WarehouseBarcodeScanner
          branchCode={detail.header.branchCode}
          purpose="Outbound"
          warehouseId={sourceWarehouseId}
          disabled={busy}
          title={`${phaseOptions.find((item) => item.value === phase)?.label ?? 'Transfer'} barkodunu okut`}
          description="Okutulan etiket mevcut stok/seri/lot ve raf bakiyesiyle eşleştirilir; ilgili transfer kalemi otomatik doldurulur."
          onResolved={(value) => {
            const targetLine = detail.lines.find((item) => item.stockId === value.stockId && remaining(item) > 0);
            if (!targetLine) {
              toast.error(`${value.stockCode} için bu transferde açık kalem bulunamadı.`);
              return;
            }
            const available = remaining(targetLine);
            const quantity = value.quantity ?? (value.serialNo ? 1 : Math.min(1, available));
            const isTracked = targetLine.trackingType !== 'None';
            const edit = lines.find((x) => x.lineId === targetLine.id);
            patch(targetLine.id, {
              ...(isTracked
                ? { trackings: [...(edit?.trackings ?? []), { localId: crypto.randomUUID(), quantity: Math.min(quantity, available), lotNo: value.lotNo ?? undefined, serialNo: value.serialNo ?? undefined }] }
                : { quantity: Math.min(quantity, available) }),
              sourceLocationId: value.suggestedLocationId ?? null,
              sourceValue: value.suggestedLocationId ? String(value.suggestedLocationId) : null,
            });
          }}
        />
      </div>

      <div className="mt-5 space-y-3">
        {detail.lines.map((line) => {
          const edit = lines.find((x) => x.lineId === line.id);
          const available = remaining(line);
          return <div
            key={line.id}
            className={cn(
              'rounded-xl p-4',
              variant === 'production'
                ? 'border-2 border-[color-mix(in_oklab,var(--wms-brand-primary)_38%,var(--wms-app-border))] bg-[var(--wms-app-surface)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--wms-brand-primary)_10%,transparent)]'
                : 'border border-[var(--wms-app-border)]',
              available <= 0 && 'opacity-50',
            )}
          >
            <div className="mb-3 flex justify-between gap-3"><div><strong>#{line.lineNo} · {line.stockCode}</strong><p className="text-xs text-slate-500">{line.stockName} · {line.yapCode || 'YAP yok'} · Kullanılabilir {formatProjectNumber(Math.max(0, available))}</p></div><CheckCircle2 className={`size-5 ${available <= 0 ? 'text-emerald-500' : 'text-slate-500'}`} /></div>
            {edit && <>
              {variant === 'production' && phase === 'pick' && line.pickedQuantity > 0 && (
                <div className="mb-3">
                  <TransferLinePickedSources
                    transferId={id}
                    lineId={line.id}
                    inlineSources={line.pickedSourceLocations}
                  />
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {line.trackingType === 'None' && <Field label="Miktar"><input className="input" type="number" min="0.000001" max={available} step="0.000001" value={edit.quantity} onChange={(e) => patch(line.id, { quantity: Number(e.target.value) })} /></Field>}
                <Field label="Kaynak raf">
                  <PagedAppDropdown
                    queryKey={['wt-op-source', variant, phase, line.id, sourceWarehouseId, line.stockId, line.yapCodeId, line.defaultSourceLocationId]}
                    fetchPage={(request) => variant === 'production' && phase === 'pick'
                      ? fetchStockSourceLocationsPage(
                        request,
                        detail.header.branchCode,
                        sourceWarehouseId,
                        line.stockId,
                        line.yapCodeId,
                        productionExcludedSourceLocationIds,
                      )
                      : warehouseTransferApi.locations(request, sourceWarehouseId).then((page) => ({
                        ...page,
                        items: page.items.map((row) => ({ id: row.id, code: row.code, name: row.name })),
                      }))}
                    toOption={stockSourceLocationOption}
                    enabled={variant !== 'production' || phase !== 'pick' || sourceWarehouseId > 0}
                    selectedOption={(phase === 'pick' || phase === 'dispatch' || sameWarehouse) && line.defaultSourceLocationId && !isExcludedSourceLocation(line.defaultSourceLocationId)
                      ? {
                        value: String(line.defaultSourceLocationId),
                        label: `${line.defaultSourceLocationCode} · ${line.defaultSourceLocationName}`,
                      }
                      : undefined}
                    value={edit.sourceValue}
                    onValueChange={(value) => patch(line.id, { sourceValue: value, sourceLocationId: Number(value) })}
                    searchable
                  />
                </Field>
                <Field label="Hedef raf">
                  <PagedAppDropdown
                    queryKey={['wt-op-target', phase, line.id, targetWarehouseId]}
                    fetchPage={(request) => warehouseTransferApi.locations(request, targetWarehouseId)}
                    toOption={(x) => ({ value: String(x.id), label: `${x.code} · ${x.name}` })}
                    selectedOption={(phase !== 'pick' || sameWarehouse) && line.defaultTargetLocationId ? { value: String(line.defaultTargetLocationId), label: `${line.defaultTargetLocationCode} · ${line.defaultTargetLocationName}` } : undefined}
                    value={edit.targetValue}
                    onValueChange={(value) => patch(line.id, { targetValue: value, targetLocationId: Number(value) })}
                    searchable
                  />
                </Field>
              </div>
              {line.trackingType !== 'None' && <TrackingPlanEditor
                mode={line.trackingType}
                quantity={available}
                value={edit.trackings}
                onChange={(trackings) => patch(line.id, { trackings })}
                accent="violet"
                compact
              />}
              <div className="mt-3 flex justify-end">
                <OpsActionButton
                  variant="primary"
                  loading={submittingLineId === line.id}
                  onClick={() => void completeLine(line)}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold"
                >
                  <ArrowLeftRight className="size-4" />
                  Stoğu tamamla
                </OpsActionButton>
              </div>
            </>}
          </div>;
        })}
      </div>
    </section>
  </section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-[var(--wms-app-panel)] p-3"><p className="text-xs text-slate-500">{label}</p><strong>{formatProjectNumber(value)}</strong></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1 text-sm"><span className="font-semibold">{label}</span>{children}</label>;
}

function OperationLoadError({ message, listUrl }: { message: string; listUrl: string }) {
  return <section className="mx-auto mt-12 max-w-xl rounded-2xl border border-rose-500/30 bg-[var(--wms-app-panel)] p-8 text-center">
    <h1 className="text-xl font-black">Transfer operasyonu açılamadı</h1>
    <p className="mt-2 text-sm text-slate-500">{message}</p>
    <Link to={listUrl} className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2 text-sm font-bold text-white">Transfer listesine dön</Link>
  </section>;
}
