import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Ban, Eye, FileText, Loader2, Printer, RefreshCw, Scale } from 'lucide-react';
import { toast } from 'sonner';
import {
  AdvancedDataGrid,
  type GridColumn,
  type GridRequest,
} from '@/components/shared/AdvancedDataGrid';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsStatusBadge, inferOpsStatusTone, inferQualityStatusTone } from '@/components/shared/OpsStatusBadge';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { formatProjectDate } from '@/lib/project-format';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import { goodsReceiptEnumLabel, goodsReceiptEnumHint } from '../localization/enum-labels';
import type { GoodsReceiptGridRow } from '../types/goods-receipt.types';
import { canCancelGoodsReceiptFromWms } from '../utils/goods-receipt-cancel';
import { previewReceiptLabelsPdf, printableLabels, printReceiptLabels } from '../utils/goods-receipt-label-output';
import {
  buildGoodsReceiptListFacetFilters,
  EMPTY_GOODS_RECEIPT_LIST_FACETS,
  type GoodsReceiptListFacets,
} from '../utils/goods-receipt-list-filters';
import {
  resolveGoodsReceiptWaybillNo,
  resolveGoodsReceiptWaybillReference,
} from '../utils/goods-receipt-waybill';
import { enrichGoodsReceiptListWaybills } from '../utils/enrich-goods-receipt-list-waybills';
import {
  GoodsReceiptDetailDialog,
  type GoodsReceiptDetailViewState,
} from './GoodsReceiptDetailDialog';
import { GoodsReceiptErpRetryDialog } from './GoodsReceiptErpRetryDialog';
import { GoodsReceiptListFiltersPopover } from './GoodsReceiptListFiltersPopover';
import type { GoodsReceiptLifecycleAction } from './GoodsReceiptLifecycleDialog';

type OutputMode = 'print' | 'pdf';

const ERP_RETRY_STATUSES = ['Pending', 'Failed', 'CommitUncertain'] as const;

export function GoodsReceiptListPage(): ReactElement {
  const { t, moduleReady } = useModuleTranslation('goods-receipt-v2');
  const { can } = usePermissionAccess();
  const [detailView, setDetailView] = useState<GoodsReceiptDetailViewState | null>(null);
  const [erpRetryRow, setErpRetryRow] = useState<GoodsReceiptGridRow | null>(null);
  const [listFacets, setListFacets] = useState<GoodsReceiptListFacets>(EMPTY_GOODS_RECEIPT_LIST_FACETS);
  const [outputBusy, setOutputBusy] = useState('');
  const [gridVersion, setGridVersion] = useState(0);

  const facetFilters = useMemo(
    () => buildGoodsReceiptListFacetFilters(listFacets),
    [listFacets],
  );

  const fetchPage = useCallback(
    async (request: GridRequest) => {
      const page = await goodsReceiptV2Api.paged({
        ...request,
        filterLogic: 'and',
        filters: [...facetFilters, ...request.filters],
      });
      return {
        ...page,
        items: await enrichGoodsReceiptListWaybills(page.items),
      };
    },
    [facetFilters],
  );

  const canRetryErp = useCallback(
    (row: GoodsReceiptGridRow) =>
      can('WMS.GOODS_RECEIPT.ERP_RETRY')
      && row.status !== 'Cancelled'
      && ERP_RETRY_STATUSES.includes(row.erpIntegrationStatus as (typeof ERP_RETRY_STATUSES)[number]),
    [can],
  );

  const canCancelRow = useCallback(
    (row: GoodsReceiptGridRow) =>
      can('WMS.GOODS_RECEIPT.CANCEL')
      && canCancelGoodsReceiptFromWms({
        status: row.status,
        erpIntegrationStatus: row.erpIntegrationStatus,
      }),
    [can],
  );

  const openDetail = useCallback(
    async (id: number, startAction?: GoodsReceiptLifecycleAction | null) => {
      setDetailView({ id, loading: true, detail: null, startAction });
      try {
        const detail = await goodsReceiptV2Api.detail(id);
        setDetailView({ id, loading: false, detail, startAction });
      } catch (error) {
        setDetailView(null);
        toast.error(message(error, t('list.detailLoadError')));
      }
    },
    [t],
  );

  const output = useCallback(
    async (receiptId: number, lineId: number | undefined, mode: OutputMode, title: string) => {
      const key = `${receiptId}:${lineId ?? 'all'}:${mode}`;
      setOutputBusy(key);
      try {
        const labels = printableLabels(await goodsReceiptV2Api.receiptLabels(receiptId, lineId));
        if (!labels.length) throw new Error(lineId ? t('list.noLineLabels') : t('list.noReceiptLabels'));
        if (mode === 'pdf') {
          await previewReceiptLabelsPdf(labels, `${title}.pdf`);
          toast.success(t('list.pdfReady', { count: labels.length }));
          return;
        }
        printReceiptLabels(labels, title);
        await goodsReceiptV2Api.markLabelsPrinted(labels.map((x) => x.id));
        toast.success(t('list.sentToPrinter', { count: labels.length }));
      } catch (error) {
        toast.error(message(error, t('list.outputError')));
      } finally {
        setOutputBusy('');
      }
    },
    [t],
  );

  const columns = useMemo<GridColumn<GoodsReceiptGridRow>[]>(() => {
    void moduleReady;
    return [
      ...systemColumns<GoodsReceiptGridRow>({ searchable: ['createdBy', 'updatedBy'] }),
      {
        key: 'documentDate',
        label: t('list.documentDate'),
        sortable: true,
        filterable: true,
        searchable: false,
        render: (r) => formatProjectDate(r.documentDate),
      },
      {
        key: 'waybillNo',
        label: t('list.waybillReference'),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) => {
          const reference = resolveGoodsReceiptWaybillReference(r);
          return reference ? (
            <div className="min-w-0 text-left">
              <div className="truncate font-mono text-xs font-semibold">{reference.number}</div>
              <div className="text-[0.65rem] opacity-70">
                {t(reference.kind === 'electronic'
                  ? 'createFlow.waybill.eReceiptNumber'
                  : 'createFlow.waybill.receiptNumber')}
              </div>
            </div>
          ) : '—';
        },
      },
      {
        key: 'orderNumbers',
        label: t('list.orderNo'),
        sortable: false,
        filterable: false,
        searchable: false,
        render: (r) => (
          r.orderNumbers
            ? <span className="font-mono text-xs font-semibold">{r.orderNumbers}</span>
            : '—'
        ),
        contextValue: (r) => r.orderNumbers ?? undefined,
      },
      {
        key: 'projectCodes',
        label: t('list.projectCode'),
        sortable: false,
        filterable: false,
        searchable: false,
        render: (r) => (
          r.projectCodes
            ? <span className="font-mono text-xs font-semibold">{r.projectCodes}</span>
            : '—'
        ),
        contextValue: (r) => r.projectCodes ?? undefined,
      },
      {
        key: 'supplierName',
        label: t('list.supplier'),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) => (
          <div className="min-w-0 text-left">
            <div className="truncate font-medium">{r.supplierName || r.supplierCode || '—'}</div>
            {r.supplierName && r.supplierCode ? (
              <div className="truncate font-mono text-[0.65rem] opacity-70">{r.supplierCode}</div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'warehouseName',
        label: t('list.warehouse'),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) => (
          <div className="min-w-0 text-left">
            <div className="truncate font-medium">{r.warehouseName}</div>
            <div className="truncate font-mono text-[0.65rem] opacity-70">{r.warehouseCode}</div>
          </div>
        ),
      },
      {
        key: 'processType',
        label: t('list.processType'),
        sortable: true,
        filterable: true,
        render: (r) => goodsReceiptEnumLabel(t, 'processType', r.processType),
      },
      {
        key: 'status',
        label: t('list.status'),
        sortable: true,
        filterable: true,
        render: (r) => (
          <div className="flex justify-center">
            <OpsStatusBadge
              tone={inferOpsStatusTone(r.status)}
              title={goodsReceiptEnumHint(t, 'operationStatus', r.status)}
            >
              {goodsReceiptEnumLabel(t, 'operationStatus', r.status)}
            </OpsStatusBadge>
          </div>
        ),
      },
      {
        key: 'qualityStatus',
        label: t('list.quality'),
        sortable: true,
        filterable: true,
        render: (r) => (
          <div className="flex justify-center">
            <OpsStatusBadge
              tone={inferQualityStatusTone(r.qualityStatus)}
              title={goodsReceiptEnumHint(t, 'qualityStatus', r.qualityStatus)}
            >
              {goodsReceiptEnumLabel(t, 'qualityStatus', r.qualityStatus)}
            </OpsStatusBadge>
          </div>
        ),
      },
      {
        key: 'erpIntegrationStatus',
        label: t('list.erpPosting'),
        sortable: true,
        filterable: true,
        render: (r) => (
          <div className="flex justify-center">
            <OpsStatusBadge tone={inferOpsStatusTone(r.erpIntegrationStatus)}>
              {goodsReceiptEnumLabel(t, 'erpStatus', r.erpIntegrationStatus)}
            </OpsStatusBadge>
          </div>
        ),
      },
      {
        key: 'lineCount',
        label: t('list.line'),
        sortable: true,
        filterable: true,
        searchable: false,
        render: (r) => r.lineCount,
      },
      {
        key: 'actions',
        label: t('list.actions'),
        ...requiredActionColumn,
        render: (r) => (
          <div className="wms-ops-row-actions">
            <ActionButton
              title={t('list.showDetail')}
              busy={detailView?.loading === true && detailView.id === r.id}
              onClick={() => void openDetail(r.id)}
              icon={<Eye className="size-3.5" />}
            />
            {canRetryErp(r) ? (
              <ActionButton
                title={
                  r.erpIntegrationStatus === 'CommitUncertain'
                    ? t('list.erpReconcile')
                    : t('list.sendToErp')
                }
                busy={false}
                onClick={() => setErpRetryRow(r)}
                icon={
                  r.erpIntegrationStatus === 'CommitUncertain'
                    ? <Scale className="size-3.5" />
                    : <RefreshCw className="size-3.5" />
                }
              />
            ) : null}
            {canCancelRow(r) ? (
              <ActionButton
                title={t('list.cancel')}
                busy={detailView?.loading === true && detailView.id === r.id && detailView.startAction === 'cancel'}
                onClick={() => void openDetail(r.id, 'cancel')}
                icon={<Ban className="size-3.5" />}
              />
            ) : null}
            <ActionButton
              title={t('list.printAllLabels')}
              busy={outputBusy === `${r.id}:all:print`}
              onClick={() => void output(r.id, undefined, 'print', resolveGoodsReceiptWaybillNo(r) || `receipt-${r.id}`)}
              icon={<Printer className="size-3.5" />}
            />
            <ActionButton
              title={t('list.showAllLabelsPdf')}
              busy={outputBusy === `${r.id}:all:pdf`}
              onClick={() => void output(r.id, undefined, 'pdf', resolveGoodsReceiptWaybillNo(r) || `receipt-${r.id}`)}
              icon={<FileText className="size-3.5" />}
            />
          </div>
        ),
      },
    ];
  }, [canCancelRow, canRetryErp, detailView?.id, detailView?.loading, detailView?.startAction, moduleReady, openDetail, output, outputBusy, t]);

  const lifecycleCompleted = useCallback(
    async () => {
      const id = detailView?.detail?.header.id ?? detailView?.id;
      if (!id) return;
      setDetailView({ id, loading: false, detail: await goodsReceiptV2Api.detail(id) });
      setGridVersion((value) => value + 1);
    },
    [detailView?.detail?.header.id, detailView?.id],
  );

  const routingCompleted = useCallback(
    async () => {
      const id = detailView?.detail?.header.id ?? detailView?.id;
      if (!id) return;
      setDetailView({ id, loading: false, detail: await goodsReceiptV2Api.detail(id) });
      setGridVersion((value) => value + 1);
    },
    [detailView?.detail?.header.id, detailView?.id],
  );

  return (
    <>
      <AdvancedDataGrid<GoodsReceiptGridRow>
        pageKey="goods-receipts-list-v6"
        refreshKey={`${gridVersion}:${JSON.stringify(listFacets)}`}
        eyebrow={
          <>
            <span>{t('list.eyebrowParent')}</span>
            <span className="mx-2 opacity-60">/</span>
            <span>{t('list.eyebrowModule')}</span>
          </>
        }
        emptyMessage={t('list.empty')}
        title={t('list.title')}
        description={t('list.description')}
        columns={columns}
        fetchPage={fetchPage}
        toolbarBelowExtra={
          <GoodsReceiptListFiltersPopover facets={listFacets} onFacetsChange={setListFacets} />
        }
      />
      {detailView ? (
        <GoodsReceiptDetailDialog
          state={detailView}
          close={() => setDetailView(null)}
          output={output}
          busyKey={outputBusy}
          onLifecycleCompleted={lifecycleCompleted}
          onRoutingCompleted={routingCompleted}
        />
      ) : null}
      {erpRetryRow ? (
        <GoodsReceiptErpRetryDialog
          header={erpRetryRow}
          close={() => setErpRetryRow(null)}
          completed={async () => {
            setErpRetryRow(null);
            setGridVersion((value) => value + 1);
          }}
        />
      ) : null}
    </>
  );
}

function ActionButton({
  title,
  busy,
  onClick,
  icon,
}: {
  title: string;
  busy: boolean;
  onClick: () => void;
  icon: ReactElement;
}): ReactElement {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={busy}
      onClick={onClick}
      className="wms-ops-grid-icon-btn disabled:opacity-40"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : icon}
    </button>
  );
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
