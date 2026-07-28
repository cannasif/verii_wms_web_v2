import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Eye, FileText, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { OpsStatusBadge, inferOpsStatusTone, inferQualityStatusTone } from '@/components/shared/OpsStatusBadge';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { formatProjectDate, formatProjectNumber } from '@/lib/project-format';
import { goodsReceiptV2Api } from '../api/goods-receipt.api';
import { goodsReceiptEnumLabel, goodsReceiptEnumHint } from '../localization/enum-labels';
import type { GoodsReceiptGridRow } from '../types/goods-receipt.types';
import { previewReceiptLabelsPdf, printableLabels, printReceiptLabels } from '../utils/goods-receipt-label-output';
import {
  GoodsReceiptDetailDialog,
  type GoodsReceiptDetailViewState,
} from './GoodsReceiptDetailDialog';

type OutputMode = 'print' | 'pdf';

export function GoodsReceiptListPage(): ReactElement {
  const { t, moduleReady } = useModuleTranslation('goods-receipt-v2');
  const [detailView, setDetailView] = useState<GoodsReceiptDetailViewState | null>(null);
  const [outputBusy, setOutputBusy] = useState('');
  const [gridVersion, setGridVersion] = useState(0);

  const openDetail = useCallback(
    async (id: number) => {
      setDetailView({ id, loading: true, detail: null });
      try {
        const detail = await goodsReceiptV2Api.detail(id);
        setDetailView({ id, loading: false, detail });
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
      ...systemColumns<GoodsReceiptGridRow>(),
      {
        key: 'documentNo',
        label: t('list.documentNo'),
        sortable: true,
        filterable: true,
        render: (r) => <span className="font-mono text-xs font-semibold">{r.documentNo}</span>,
      },
      {
        key: 'documentDate',
        label: t('list.documentDate'),
        sortable: true,
        filterable: true,
        render: (r) => formatProjectDate(r.documentDate),
      },
      {
        key: 'supplierCode',
        label: t('list.supplier'),
        sortable: true,
        filterable: true,
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
        key: 'warehouseCode',
        label: t('list.warehouse'),
        sortable: true,
        filterable: true,
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
        key: 'waybillNo',
        label: t('list.waybill'),
        sortable: true,
        filterable: true,
        render: (r) => r.waybillNo || '—',
      },
      {
        key: 'lineCount',
        label: t('list.line'),
        sortable: true,
        filterable: true,
        render: (r) => r.lineCount,
      },
      {
        key: 'expectedQuantity',
        label: t('list.expected'),
        sortable: true,
        filterable: true,
        render: (r) => formatProjectNumber(r.expectedQuantity),
      },
      {
        key: 'receivedQuantity',
        label: t('list.received'),
        sortable: true,
        filterable: true,
        render: (r) => formatProjectNumber(r.receivedQuantity),
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
            <ActionButton
              title={t('list.printAllLabels')}
              busy={outputBusy === `${r.id}:all:print`}
              onClick={() => void output(r.id, undefined, 'print', r.documentNo)}
              icon={<Printer className="size-3.5" />}
            />
            <ActionButton
              title={t('list.showAllLabelsPdf')}
              busy={outputBusy === `${r.id}:all:pdf`}
              onClick={() => void output(r.id, undefined, 'pdf', r.documentNo)}
              icon={<FileText className="size-3.5" />}
            />
          </div>
        ),
      },
    ];
  }, [detailView?.id, detailView?.loading, moduleReady, openDetail, output, outputBusy, t]);

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
        pageKey="goods-receipts"
        refreshKey={gridVersion}
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
        fetchPage={goodsReceiptV2Api.paged}
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
