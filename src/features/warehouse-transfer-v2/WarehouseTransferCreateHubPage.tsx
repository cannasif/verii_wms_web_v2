import { useState } from 'react';
import { ArrowLeftRight, PackageMinus } from 'lucide-react';
import { WarehouseOutboundCreatePage } from '@/features/warehouse-outbound/WarehouseOutboundCreatePage';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { WarehouseTransferDraftPage } from './components/WarehouseTransferDraftPage';

type OperationMode = 'Transfer' | 'WarehouseIssue';

export function WarehouseTransferCreateHubPage() {
  const { can } = usePermissionAccess();
  const [mode, setMode] = useState<OperationMode>('Transfer');
  const canTransfer = can('WMS.WAREHOUSE_TRANSFER.CREATE');
  const canIssue = can('WMS.WAREHOUSE_OUTBOUND.CREATE');

  if (!canTransfer && !canIssue) {
    return <section className="mx-auto max-w-2xl rounded-2xl border border-rose-500/30 bg-[var(--wms-app-panel)] p-8 text-center"><h1 className="text-xl font-black">İşlem oluşturma yetkiniz yok</h1><p className="mt-2 text-sm text-[var(--wms-app-text-muted)]">Depo transferi veya ambar çıkış oluşturma yetkilerinden biri gereklidir.</p></section>;
  }

  const effectiveMode = mode === 'Transfer' && !canTransfer ? 'WarehouseIssue' : mode === 'WarehouseIssue' && !canIssue ? 'Transfer' : mode;
  return <section className="space-y-5">
    <header className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--wms-brand-primary)]">Ortak transfer / yeni işlem</p>
      <h1 className="mt-2 text-3xl font-black">Transfer veya ambar çıkış emri oluştur</h1>
      <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">İşlem türü domain kurallarını belirler. Depo transferinde hedef depo zorunlu ve cari şirket içidir; ambar çıkışında hedef depo kullanılmaz, çıkış carisi seçilir.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <button type="button" disabled={!canTransfer} onClick={()=>setMode('Transfer')} className={`rounded-xl border p-4 text-left transition disabled:opacity-40 ${effectiveMode==='Transfer'?'border-[var(--wms-brand-primary)] bg-[var(--wms-brand-primary)]/10':'border-[var(--wms-app-border)]'}`}><span className="flex items-center gap-2 font-black"><ArrowLeftRight className="size-5"/>Depolar arası transfer</span><small className="mt-1 block text-[var(--wms-app-text-muted)]">Kaynak ve hedef depo arasında izlenebilir çıkış, transit, kabul ve raflama.</small></button>
        <button type="button" disabled={!canIssue} onClick={()=>setMode('WarehouseIssue')} className={`rounded-xl border p-4 text-left transition disabled:opacity-40 ${effectiveMode==='WarehouseIssue'?'border-amber-500 bg-amber-500/10':'border-[var(--wms-app-border)]'}`}><span className="flex items-center gap-2 font-black"><PackageMinus className="size-5"/>Ambar çıkış fişi</span><small className="mt-1 block text-[var(--wms-app-text-muted)]">Seçilen cari için tek depodan stok çıkışı ve Netsis belge akışı.</small></button>
      </div>
    </header>
    {effectiveMode === 'Transfer' ? <WarehouseTransferDraftPage /> : <WarehouseOutboundCreatePage />}
  </section>;
}
