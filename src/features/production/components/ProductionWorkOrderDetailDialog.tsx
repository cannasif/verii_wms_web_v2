import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Ban, ClipboardList, UserRoundCog } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpsCodeBadge, OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { cn } from '@/lib/utils';
import { productionApi } from '../api';
import type { PreparedNetsisProductionWorkOrder, ProductionSourceWorkOrder } from '../types';

type DetailTab = 'info' | 'content';

function listingKindLabel(kind: ProductionSourceWorkOrder['listingKind']): string {
  if (kind === 'CancellationReturnRemainder') return 'Transfer iadesi';
  if (kind === 'ManagerCancelledAssignment') return 'İptal edildi';
  if (kind === 'RestoredCancelledAssignment') return 'İş emri';
  return 'İş emri';
}

function DetailField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}): ReactElement {
  return (
    <div className={cn('wms-ops-detail-field', wide && 'wms-ops-detail-field--wide')}>
      <span className="wms-ops-detail-field__label">{label}</span>
      <span className="wms-ops-detail-field__value">{children}</span>
    </div>
  );
}

function LifecycleButton({
  label,
  icon,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: string;
  icon: ReactElement;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'wms-ops-detail-lifecycle__btn',
        danger && 'wms-ops-detail-lifecycle__btn--danger',
        disabled && 'opacity-45',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function ProductionWorkOrderDetailDialog({
  row,
  canCreateTransfer,
  canCancel,
  onClose,
  onOpenAssignment,
  onCancel,
}: {
  row: ProductionSourceWorkOrder;
  canCreateTransfer: boolean;
  canCancel: boolean;
  onClose: () => void;
  onOpenAssignment: (row: ProductionSourceWorkOrder) => void;
  onCancel: (row: ProductionSourceWorkOrder) => void;
}): ReactElement {
  const [mainTab, setMainTab] = useState<DetailTab>('info');
  const [prepared, setPrepared] = useState<PreparedNetsisProductionWorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setMainTab('info');
    setPrepared(null);
    setLoading(true);
    setError(false);
    let cancelled = false;
    void productionApi.prepareSourceWorkOrder(row)
      .then((value) => {
        if (!cancelled) setPrepared(value);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row]);

  const assignedCount = row.assignedRecipeLineCount ?? 0;
  const recipeTotal = row.recipeLineCount ?? prepared?.materials.length ?? 0;
  const showAssign = canCreateTransfer && !row.isClosed;
  const showCancel = canCancel && !row.isClosed;
  const hasLifecycle = showAssign || showCancel;
  const mainTabIndex = mainTab === 'info' ? 0 : 1;
  const value = prepared;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        portalRoot="body"
        tone="ops"
        aria-describedby={undefined}
        className={cn(
          'wms-ops-detail-dialog wms-ops-form flex !h-[min(90vh,880px)] !max-h-[calc(100dvh-2rem)] w-full !max-w-6xl flex-col !gap-0 overflow-hidden border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] !p-0',
          '[scrollbar-gutter:auto]',
        )}
      >
        <header className="wms-ops-detail-dialog__header shrink-0">
          <div className="min-w-0 pr-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
              {row.sourceSystemCode} · İş emri detayı
            </p>
            <DialogTitle className="wms-ops-detail-dialog__title">
              İş emri
              <span className="ml-2 font-mono text-base font-bold text-cyan-600 dark:text-cyan-300">
                {row.workOrderNumber}
              </span>
            </DialogTitle>
            <DialogDescription className="wms-ops-detail-dialog__description">
              {row.stockCode} · {row.stockName}
            </DialogDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <OpsStatusBadge tone={row.isClosed ? 'danger' : 'active'}>
                {row.isClosed ? 'Kapalı iş emri' : 'Açık iş emri'}
              </OpsStatusBadge>
              <OpsCodeBadge>{listingKindLabel(row.listingKind)}</OpsCodeBadge>
              {value?.mappingErrors.length ? (
                <OpsStatusBadge tone="danger">
                  {value.mappingErrors.length} eşleme hatası
                </OpsStatusBadge>
              ) : value ? (
                <OpsStatusBadge tone="done">Eşlemeler hazır</OpsStatusBadge>
              ) : null}
              {value?.existingProductionOrderId ? (
                <OpsStatusBadge tone="pending">WMS&apos;e alınmış</OpsStatusBadge>
              ) : null}
            </div>
          </div>
        </header>

        {loading || !value ? (
          <div className="wms-ops-detail-state grid min-h-0 flex-1 place-items-center px-6 py-10">
            <p className="text-sm text-[var(--wms-app-text-muted)]">
              {error ? 'İş emri detayı yüklenemedi.' : 'İş emri detayı yükleniyor…'}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="wms-ops-detail-lifecycle shrink-0 px-4 py-3 sm:px-6">
              {hasLifecycle ? (
                <div className="wms-ops-detail-lifecycle__bar">
                  {showAssign ? (
                    <LifecycleButton
                      label="Reçeteyi aç"
                      icon={<UserRoundCog className="size-4" aria-hidden />}
                      onClick={() => onOpenAssignment(row)}
                    />
                  ) : null}
                  {showCancel ? (
                    <LifecycleButton
                      label="İptal et"
                      danger
                      icon={<Ban className="size-4" aria-hidden />}
                      onClick={() => onCancel(row)}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="wms-ops-detail-lifecycle__cancelled">
                  {row.isClosed ? 'Kapalı iş emri' : 'İşlem yapılamaz'}
                </div>
              )}
            </div>

            <Tabs
              value={mainTab}
              onValueChange={(next) => setMainTab(next as DetailTab)}
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <div className="shrink-0 px-4 pt-4 sm:px-6">
                <TabsList
                  className={cn('w-full', 'wms-ops-detail-main-tabs', 'wms-ops-detail-main-tabs--cols-2')}
                  data-active-index={Math.max(mainTabIndex, 0)}
                >
                  <span className="wms-ops-detail-tab-indicator" aria-hidden />
                  <TabsTrigger value="info" className="wms-ops-detail-main-tab">
                    Bilgi
                  </TabsTrigger>
                  <TabsTrigger value="content" className="wms-ops-detail-main-tab">
                    Reçete
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="info"
                className="wms-ops-scrollbar mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
              >
                <div className="space-y-4">
                  <div className="wms-ops-detail-panel">
                    <div className="wms-ops-detail-grid">
                      <DetailField label="Kaynak">
                        {value.sourceSystemCode}
                      </DetailField>
                      <DetailField label="Tür">
                        {listingKindLabel(row.listingKind)}
                      </DetailField>
                      <DetailField label="Mamul">
                        {value.productCode} · {value.productName}
                      </DetailField>
                      <DetailField label="İş emri miktarı">
                        {formatProjectNumber(value.plannedQuantity)} {value.unitCode}
                      </DetailField>
                      <DetailField label="Tarih">
                        {formatProjectDate(value.workOrderDate)}
                      </DetailField>
                      <DetailField label="Teslim tarihi">
                        {formatProjectDate(value.deliveryDate)}
                      </DetailField>
                      <DetailField label="Proje">
                        {value.projectCode?.trim() || '—'}
                      </DetailField>
                      <DetailField label="Sipariş no">
                        {row.orderNumber?.trim() || '—'}
                      </DetailField>
                      <DetailField label="Çıkış deposu">
                        {value.sourceWarehouseCode}
                        {value.sourceWarehouseName ? ` · ${value.sourceWarehouseName}` : ''}
                      </DetailField>
                      <DetailField label="Üretim deposu">
                        {value.targetWarehouseCode}
                        {value.targetWarehouseName ? ` · ${value.targetWarehouseName}` : ''}
                      </DetailField>
                      <DetailField label="Reçete satırı">
                        {recipeTotal > 0
                          ? `${assignedCount} / ${recipeTotal} atandı`
                          : `${value.materials.length} bileşen`}
                      </DetailField>
                      {value.existingProductionDocumentNo ? (
                        <DetailField label="WMS belgesi">
                          {value.existingProductionDocumentNo}
                        </DetailField>
                      ) : null}
                      {value.mappingErrors.length > 0 ? (
                        <DetailField label="Eşleme hataları" wide>
                          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--wms-app-text-muted)]">
                            {value.mappingErrors.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </DetailField>
                      ) : null}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="content"
                className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6"
              >
                {!value.materials.length ? (
                  <div className="wms-ops-detail-empty flex flex-col items-center gap-2 border border-dashed border-[var(--wms-app-border)] p-8 text-center">
                    <ClipboardList className="size-8 opacity-40" aria-hidden />
                    <p className="text-sm text-slate-500">Bu iş emrine bağlı reçete bileşeni bulunamadı.</p>
                  </div>
                ) : (
                  <div className="wms-ops-gr-detail-lines-wrap min-h-0 flex-1 overflow-auto">
                    <table className="wms-ops-gr-detail-lines-table w-full min-w-[820px] text-sm">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Stok</th>
                          <th>Birim</th>
                          <th>Operasyon</th>
                          <th className="wms-ops-gr-detail-lines-table__num">Reçete</th>
                          <th className="wms-ops-gr-detail-lines-table__num">Fire</th>
                          <th className="wms-ops-gr-detail-lines-table__num">Toplam ihtiyaç</th>
                          <th>Eşleme</th>
                        </tr>
                      </thead>
                      <tbody>
                        {value.materials.map((material, index) => (
                          <tr key={`${material.stockCode}-${material.operationNumber}-${index}`} className={cn(material.mappingError && 'bg-amber-500/[0.04]')}>
                            <td>{index + 1}</td>
                            <td>
                              <div className="font-medium">{material.stockCode}</div>
                              {material.stockName ? (
                                <div className="wms-ops-gr-detail-lines-table__muted text-xs">{material.stockName}</div>
                              ) : null}
                            </td>
                            <td>{material.unitCode}</td>
                            <td>{material.operationNumber}</td>
                            <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(material.recipeQuantity)}</td>
                            <td className="wms-ops-gr-detail-lines-table__num">{formatProjectNumber(material.wasteQuantity)}</td>
                            <td className="wms-ops-gr-detail-lines-table__num wms-ops-gr-detail-lines-table__accent">
                              {formatProjectNumber(material.requiredQuantity)}
                            </td>
                            <td>
                              {material.mappingError ? (
                                <span className="text-amber-600">{material.mappingError}</span>
                              ) : (
                                <span className="text-emerald-600">Hazır</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
