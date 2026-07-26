import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  AlertTriangle, CheckCircle2, Download, Eye, FileArchive, FileText,
  Loader2, PackageCheck, Search, ShieldCheck, UploadCloud, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdvancedDataGrid, type GridColumn } from '@/components/shared/AdvancedDataGrid';
import { requiredActionColumn, systemColumns } from '@/components/shared/GridSystemColumns';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { AppInput } from '@/components/shared/AppInput';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { formatProjectDate, formatProjectDateTime, formatProjectNumber } from '@/lib/project-format';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { useAuthStore } from '@/stores/auth-store';
import { incomingInvoiceApi } from '../api/incoming-invoice.api';
import { IncomingInvoiceGoodsReceiptDialog } from './IncomingInvoiceGoodsReceiptDialog';
import type {
  ELogoConnectionRow,
  IncomingInvoiceDetail,
  IncomingInvoiceDocumentFormat,
  IncomingInvoiceGridRow,
  IncomingInvoiceLookupKind,
} from '../types/incoming-invoice.types';

export function IncomingInvoiceArchivePage(): ReactElement {
  const { t, moduleReady } = useModuleTranslation('incoming-invoices');
  const branchCode = useAuthStore((state) => state.branch?.code ?? '0');
  const [gridVersion, setGridVersion] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState<IncomingInvoiceDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState<number | null>(null);

  const openDetail = useCallback(async (id: number): Promise<void> => {
    setDetailBusy(id);
    try { setDetail(await incomingInvoiceApi.detail(id, branchCode)); }
    catch (error) { toast.error(errorMessage(error, t('messages.detailFailed'))); }
    finally { setDetailBusy(null); }
  }, [branchCode, t]);

  const columns = useMemo<GridColumn<IncomingInvoiceGridRow>[]>(() => {
    void moduleReady;
    return [
      ...systemColumns<IncomingInvoiceGridRow>(),
      {
        key: 'invoiceNo', label: t('columns.invoiceNo'), sortable: true, filterable: true,
        render: (row) => <div><strong className="font-mono">{row.invoiceNo}</strong><p className="max-w-52 truncate text-xs text-slate-500">{row.uuid}</p></div>,
      },
      { key: 'documentKind', label: t('columns.kind'), sortable: true, filterable: true, filterType: 'enum', render: (row) => kindLabel(t, row.documentKind) },
      { key: 'issueDate', label: t('columns.issueDate'), sortable: true, filterable: true, filterType: 'date', render: (row) => formatProjectDate(row.issueDate) },
      { key: 'supplierVknOrTckn', label: t('columns.supplierTaxNo'), sortable: true, filterable: true, render: (row) => row.supplierVknOrTckn || '—' },
      { key: 'supplierName', label: t('columns.supplier'), sortable: true, filterable: true, render: (row) => row.supplierName || '—' },
      { key: 'payableAmount', label: t('columns.payable'), sortable: true, filterable: true, filterType: 'number', render: (row) => `${formatProjectNumber(row.payableAmount)} ${row.currencyCode}` },
      { key: 'lineCount', label: t('columns.lines'), sortable: true, filterable: true, filterType: 'number', render: (row) => `${row.matchedLineCount}/${row.lineCount}` },
      { key: 'archiveStatus', label: t('columns.archiveStatus'), sortable: true, filterable: true, filterType: 'enum', render: (row) => <StatusBadge tone={row.archiveStatus === 'Linked' ? 'success' : row.archiveStatus === 'Rejected' ? 'danger' : 'warning'}>{archiveLabel(t, row.archiveStatus)}</StatusBadge> },
      { key: 'validationStatus', label: t('columns.validation'), sortable: true, filterable: true, filterType: 'enum', render: (row) => <StatusBadge tone={row.validationStatus === 'Parsed' ? 'success' : row.validationStatus === 'Invalid' ? 'danger' : 'warning'}>{validationLabel(t, row.validationStatus)}</StatusBadge> },
      { key: 'importedAtUtc', label: t('columns.importedAt'), sortable: true, filterable: true, filterType: 'datetime', render: (row) => formatProjectDateTime(row.importedAtUtc) },
      {
        key: 'actions', label: t('columns.actions'), ...requiredActionColumn,
        render: (row) => <button type="button" title={t('actions.detail')} aria-label={t('actions.detail')} disabled={detailBusy === row.id} onClick={() => void openDetail(row.id)} className="grid size-11 place-items-center rounded-xl text-cyan-600 hover:bg-cyan-500/10 disabled:opacity-40">
          {detailBusy === row.id ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
        </button>,
      },
    ];
  }, [detailBusy, moduleReady, openDetail, t]);

  return <>
    <AdvancedDataGrid<IncomingInvoiceGridRow>
      key={`${gridVersion}-${branchCode}`}
      pageKey="incoming-invoice-archive"
      title={t('archive.title')}
      description={t('archive.description')}
      columns={columns}
      fetchPage={(request) => incomingInvoiceApi.paged(branchCode, request)}
      toolbarAction={{ label: t('actions.importByUuid'), run: async () => setImportOpen(true) }}
    />
    {importOpen && <ImportDialog
      branchCode={branchCode}
      onClose={() => setImportOpen(false)}
      onImported={async (id) => {
        setImportOpen(false);
        setGridVersion((value) => value + 1);
        await openDetail(id);
      }}
    />}
    {detail && <InvoiceDetailDialog
      branchCode={branchCode}
      detail={detail}
      onClose={() => setDetail(null)}
      onChanged={async () => {
        setDetail(await incomingInvoiceApi.detail(detail.header.id, branchCode));
        setGridVersion((value) => value + 1);
      }}
    />}
  </>;
}

function ImportDialog({
  branchCode, onClose, onImported,
}: {
  branchCode: string;
  onClose: () => void;
  onImported: (id: number) => Promise<void>;
}): ReactElement {
  const { t } = useModuleTranslation('incoming-invoices');
  const [connections, setConnections] = useState<ELogoConnectionRow[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [uuid, setUuid] = useState('');
  const [kind, setKind] = useState<IncomingInvoiceLookupKind>('Automatic');
  const [includePdf, setIncludePdf] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void incomingInvoiceApi.selectableConnections(branchCode)
      .then((items) => {
        if (!active) return;
        setConnections(items);
        const selected = items.find((item) => item.isDefault) ?? items[0];
        setConnectionId(selected ? String(selected.id) : '');
      })
      .catch((error) => toast.error(errorMessage(error, t('messages.connectionsFailed'))))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchCode, t]);

  const submit = async (): Promise<void> => {
    if (!connectionId) { toast.error(t('validation.connectionRequired')); return; }
    if (!isUuid(uuid)) { toast.error(t('validation.uuid')); return; }
    setSaving(true);
    try {
      const result = await incomingInvoiceApi.import({
        branchCode,
        connectionId: Number(connectionId),
        uuid: uuid.trim(),
        invoiceKind: kind,
        includePdf,
      });
      toast.success(result.replayed ? t('messages.alreadyArchived') : t('messages.imported'));
      await onImported(result.id);
    } catch (error) {
      toast.error(errorMessage(error, t('messages.importFailed')));
    } finally {
      setSaving(false);
    }
  };

  return <ResponsiveDialog onClose={onClose} title={t('import.title')} className="max-h-[calc(100dvh-1rem)]">
    <header className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-500">{t('import.eyebrow')}</p><h2 className="mt-1 text-xl font-black">{t('import.title')}</h2><p className="mt-1 text-sm text-slate-500">{t('import.description')}</p></div>
      <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X className="size-5" /></button>
    </header>
    {!loading && connections.length === 0 && <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300"><AlertTriangle className="mb-2 size-5" />{t('import.noConnection')}</div>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label={t('import.connection')} required>
        <AppDropdown value={connectionId} onValueChange={setConnectionId} disabled={loading || !connections.length} isLoading={loading} searchable options={connections.map((item) => ({ value: String(item.id), label: `${item.displayName} · ${item.vkn}`, description: item.source }))} />
      </Field>
      <Field label={t('import.documentKind')} required>
        <AppDropdown value={kind} onValueChange={(value) => setKind(value as IncomingInvoiceLookupKind)} options={[
          { value: 'Automatic', label: t('kind.automatic'), description: t('kind.automaticDescription') },
          { value: 'EInvoice', label: t('kind.eInvoice') },
          { value: 'EArchive', label: t('kind.eArchive') },
        ]} />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t('import.uuid')} required>
          <AppInput value={uuid} onChange={(event) => setUuid(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" leadingIcon={<FileArchive className="size-4" />} invalid={Boolean(uuid) && !isUuid(uuid)} />
        </Field>
      </div>
    </div>
    <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--wms-app-border)] px-4">
      <input type="checkbox" checked={includePdf} onChange={(event) => setIncludePdf(event.target.checked)} className="size-4 accent-cyan-500" />
      <span><strong className="block text-sm">{t('import.includePdf')}</strong><small className="text-slate-500">{t('import.includePdfDescription')}</small></span>
    </label>
    <div className="mt-5 rounded-2xl border border-cyan-500/25 bg-cyan-500/8 p-4 text-sm">
      <div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-500" /><p>{t('import.securityNote')}</p></div>
    </div>
    <footer className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[var(--wms-app-border)] px-5 font-semibold">{t('actions.cancel')}</button>
      <button type="button" disabled={saving || loading || !connections.length} onClick={() => void submit()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}{t('actions.import')}</button>
    </footer>
  </ResponsiveDialog>;
}

function InvoiceDetailDialog({
  branchCode, detail, onClose, onChanged,
}: {
  branchCode: string;
  detail: IncomingInvoiceDetail;
  onClose: () => void;
  onChanged: () => Promise<void>;
}): ReactElement {
  const { t } = useModuleTranslation('incoming-invoices');
  const [lineSearch, setLineSearch] = useState('');
  const [documentBusy, setDocumentBusy] = useState<IncomingInvoiceDocumentFormat | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const normalizedSearch = lineSearch.trim().toLocaleUpperCase('tr-TR');
  const lines = normalizedSearch
    ? detail.lines.filter((line) => [line.stockCode, line.buyerStockCode, line.stockName, line.externalLineId]
      .some((value) => String(value ?? '').toLocaleUpperCase('tr-TR').includes(normalizedSearch)))
    : detail.lines;
  const unmatched = detail.lines.filter((line) => !line.stockId).length;
  const eligible = detail.lines.some((line) => line.stockId && line.remainingQuantity > 0);

  const openDocument = async (format: IncomingInvoiceDocumentFormat): Promise<void> => {
    setDocumentBusy(format);
    try {
      const blob = await incomingInvoiceApi.document(detail.header.id, format, branchCode);
      const url = URL.createObjectURL(blob);
      if (format === 'Pdf') {
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = detail.documents.find((item) => item.format === format)?.fileName
          ?? `${detail.header.invoiceNo}.xml`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      }
    } catch (error) {
      toast.error(errorMessage(error, t('messages.documentFailed')));
    } finally {
      setDocumentBusy(null);
    }
  };

  return <ResponsiveDialog onClose={onClose} title={detail.header.invoiceNo} className="max-h-[calc(100dvh-1rem)] !max-w-7xl">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-500">{kindLabel(t, detail.header.documentKind)}</p><h2 className="mt-1 text-xl font-black sm:text-2xl">{detail.header.invoiceNo}</h2><p className="mt-1 break-all font-mono text-xs text-slate-500">{detail.header.uuid}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {detail.header.hasPdf && <DocumentButton label={t('actions.showPdf')} busy={documentBusy === 'Pdf'} icon={<FileText className="size-4" />} onClick={() => void openDocument('Pdf')} />}
        {detail.header.hasUbl && <DocumentButton label={t('actions.downloadUbl')} busy={documentBusy === 'UblXml'} icon={<Download className="size-4" />} onClick={() => void openDocument('UblXml')} />}
        <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X className="size-5" /></button>
      </div>
    </header>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Info label={t('detail.issueDate')} value={formatProjectDate(detail.header.issueDate)} />
      <Info label={t('detail.supplier')} value={`${detail.header.supplierVknOrTckn} · ${detail.header.supplierName}`} />
      <Info label={t('detail.customer')} value={`${detail.customerVknOrTckn} · ${detail.customerName}`} />
      <Info label={t('detail.payable')} value={`${formatProjectNumber(detail.header.payableAmount)} ${detail.header.currencyCode}`} strong />
      <Info label={t('detail.invoiceType')} value={detail.invoiceTypeCode || '—'} />
      <Info label={t('detail.profile')} value={detail.profileId || '—'} />
      <Info label={t('detail.orderReference')} value={detail.orderReferenceNo || '—'} />
      <Info label={t('detail.despatchReference')} value={detail.despatchReferenceNo || '—'} />
    </div>
    <section className={`mt-4 rounded-2xl border p-4 ${unmatched ? 'border-amber-500/30 bg-amber-500/8' : 'border-emerald-500/30 bg-emerald-500/8'}`}>
      <div className="flex gap-3">{unmatched ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />}<div><strong>{unmatched ? t('detail.reviewRequired', { count: unmatched }) : t('detail.stockMatchesReady')}</strong><p className="mt-1 text-sm text-slate-500">{detail.validationMessage}</p></div></div>
    </section>
    <section className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h3 className="text-lg font-black">{t('detail.lines')}</h3><p className="text-sm text-slate-500">{t('detail.lineSummary', { visible: lines.length, total: detail.lines.length, matched: detail.header.matchedLineCount })}</p></div>
        <label className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><AppInput className="!pl-10" value={lineSearch} onChange={(event) => setLineSearch(event.target.value)} placeholder={t('detail.searchLines')} /></label>
      </div>
      <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-[var(--wms-app-border)] md:block">
        <table className="w-full min-w-[1050px] text-sm"><thead className="bg-[var(--wms-app-panel-muted)] text-left"><tr><th className="p-3">#</th><th className="p-3">{t('detail.stock')}</th><th className="p-3">{t('detail.description')}</th><th className="p-3 text-right">{t('detail.quantity')}</th><th className="p-3 text-right">{t('detail.unitPrice')}</th><th className="p-3 text-right">{t('detail.tax')}</th><th className="p-3 text-right">{t('detail.total')}</th><th className="p-3">{t('detail.match')}</th></tr></thead>
          <tbody>{lines.map((line) => <tr key={line.id} className="border-t border-[var(--wms-app-border)]"><td className="p-3">{line.lineNo}</td><td className="p-3"><strong>{line.stockCode || '—'}</strong><p className="text-xs text-slate-500">{line.stockName}</p></td><td className="max-w-72 p-3 text-slate-600 dark:text-slate-300">{line.description || '—'}</td><td className="p-3 text-right">{formatProjectNumber(line.quantity)} {line.unitCode}</td><td className="p-3 text-right">{formatProjectNumber(line.unitPrice)}</td><td className="p-3 text-right">%{formatProjectNumber(line.taxRate)}</td><td className="p-3 text-right font-bold">{formatProjectNumber(line.lineExtensionAmount)}</td><td className="p-3"><StatusBadge tone={line.stockId ? 'success' : 'warning'}>{line.stockId ? t('match.stockMatched') : t('match.unmatched')}</StatusBadge>{line.matchMessage && <p className="mt-1 max-w-56 text-xs text-amber-600">{line.matchMessage}</p>}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-3 md:hidden">{lines.map((line) => <article key={line.id} className="rounded-2xl border border-[var(--wms-app-border)] p-4"><header className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold text-cyan-500">#{line.lineNo}</span><h4 className="font-black">{line.stockCode || '—'}</h4><p className="text-xs text-slate-500">{line.stockName}</p></div><StatusBadge tone={line.stockId ? 'success' : 'warning'}>{line.stockId ? t('match.stockMatched') : t('match.unmatched')}</StatusBadge></header><div className="mt-3 grid grid-cols-2 gap-2"><Info label={t('detail.quantity')} value={`${formatProjectNumber(line.quantity)} ${line.unitCode}`} /><Info label={t('detail.unitPrice')} value={formatProjectNumber(line.unitPrice)} /><Info label={t('detail.tax')} value={`%${formatProjectNumber(line.taxRate)}`} /><Info label={t('detail.total')} value={formatProjectNumber(line.lineExtensionAmount)} strong /></div>{line.matchMessage && <p className="mt-3 text-xs text-amber-600">{line.matchMessage}</p>}</article>)}</div>
    </section>
    <section className="mt-5 rounded-2xl border border-violet-500/25 bg-violet-500/8 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3"><PackageCheck className="mt-0.5 size-5 shrink-0 text-violet-500" /><div><strong>{t('receipt.title')}</strong><p className="mt-1 text-sm text-slate-500">{t('receipt.nextStep')}</p></div></div>
        <button type="button" disabled={!eligible} onClick={() => setReceiptOpen(true)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
          <PackageCheck className="size-4" />{t('receipt.createTask')}
        </button>
      </div>
      {detail.goodsReceipts.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{detail.goodsReceipts.map((item) => <span key={item.id} className="rounded-full border border-violet-500/25 bg-[var(--wms-app-panel)] px-3 py-1.5 text-xs font-bold">{item.documentNo} · {formatProjectNumber(item.linkedQuantity)}</span>)}</div>}
    </section>
    {receiptOpen && <IncomingInvoiceGoodsReceiptDialog
      branchCode={branchCode}
      detail={detail}
      onClose={() => setReceiptOpen(false)}
      onCreated={async () => {
        setReceiptOpen(false);
        await onChanged();
      }}
    />}
  </ResponsiveDialog>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactElement }): ReactElement {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>{children}</label>;
}
function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }): ReactElement {
  return <div className="rounded-xl border border-[var(--wms-app-border)] p-3"><span className="block text-xs text-slate-500">{label}</span><span className={`mt-1 block break-words text-sm ${strong ? 'font-black text-cyan-600' : 'font-bold'}`}>{value}</span></div>;
}
function StatusBadge({ tone, children }: { tone: 'success' | 'warning' | 'danger'; children: string }): ReactElement {
  const classes = tone === 'success' ? 'bg-emerald-500/10 text-emerald-600' : tone === 'danger' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{children}</span>;
}
function DocumentButton({ label, busy, icon, onClick }: { label: string; busy: boolean; icon: ReactElement; onClick: () => void }): ReactElement {
  return <button type="button" disabled={busy} onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-3 text-sm font-bold disabled:opacity-50">{busy ? <Loader2 className="size-4 animate-spin" /> : icon}{label}</button>;
}
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim()); }
function errorMessage(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
function kindLabel(t: (key: string, options?: Record<string, unknown>) => string, value: string): string { return value === 'EArchive' ? t('kind.eArchive') : t('kind.eInvoice'); }
function archiveLabel(t: (key: string, options?: Record<string, unknown>) => string, value: string): string { return t(`archiveStatus.${value}`, { defaultValue: value }); }
function validationLabel(t: (key: string, options?: Record<string, unknown>) => string, value: string): string { return t(`validationStatus.${value}`, { defaultValue: value }); }
