import { type ReactElement } from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { KkdDistributionDetail } from './kkd-api';
import { formatExcessApprovalStatus, isExcessApprovalPending, KKD_QUOTA_FULL_TITLE } from './kkd-quota-copy';
import { printKkdReceipt } from './kkd-receipt-print';

/** CRM teklif önizlemesine benzer: ekranda belge + yazdır. */
export function KkdDistributionReceiptDialog({
  open,
  onOpenChange,
  detail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: KkdDistributionDetail | null;
}): ReactElement {
  const handlePrint = (): void => {
    if (!detail) return;
    const ok = printKkdReceipt(detail);
    if (!ok) toast.error('Yazdırma penceresi tarayıcı tarafından engellendi.');
    else toast.success('Yazdırma önizlemesi açıldı.');
  };

  const totalQty = detail?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const entitledQty = detail?.lines.reduce((sum, line) => sum + line.entitledQuantity, 0) ?? 0;
  const excessQty = detail?.lines.reduce((sum, line) => sum + line.excessQuantity, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <OpsDialogContent size="xl" className="wms-ops-kkd-receipt-dialog">
        <OpsDialogHeader>
          <DialogTitle className="wms-ops-detail-dialog__title">Teslim belgesi önizleme</DialogTitle>
          <DialogDescription className="wms-ops-detail-dialog__description">
            Personelin aldığı malzemeler — istenirse yazdırılabilir çıktı alınır.
          </DialogDescription>
        </OpsDialogHeader>
        <OpsDialogBody className="wms-ops-kkd-receipt-dialog__body">
          {detail ? (
            <article className="wms-ops-kkd-receipt">
              <header className="wms-ops-kkd-receipt__brand">
                <div>
                  <p className="wms-ops-kkd-receipt__eyebrow">KKD · Malzeme teslim</p>
                  <h2 className="wms-ops-kkd-receipt__title">Teslim belgesi</h2>
                </div>
                <strong className="wms-ops-kkd-receipt__doc">{detail.documentNo}</strong>
              </header>

              <dl className="wms-ops-kkd-receipt__meta">
                <div>
                  <dt>Personel</dt>
                  <dd>
                    {detail.employeeCode} · {detail.employeeName}
                  </dd>
                </div>
                <div>
                  <dt>Durum</dt>
                  <dd>{detail.status}</dd>
                </div>
                <div>
                  <dt>Depo</dt>
                  <dd>#{detail.warehouseId}</dd>
                </div>
                <div>
                  <dt>Ambar çıkışı</dt>
                  <dd>{detail.warehouseOutboundId || '—'}</dd>
                </div>
                <div>
                  <dt>Kota onayı</dt>
                  <dd>{formatExcessApprovalStatus(detail.excessApprovalStatus)}</dd>
                </div>
                <div>
                  <dt>Oluşturma</dt>
                  <dd>
                    {detail.createdDate ? new Date(detail.createdDate).toLocaleString('tr-TR') : '—'}
                  </dd>
                </div>
              </dl>

              {isExcessApprovalPending(detail.excessApprovalStatus) ? (
                <p className="wms-ops-kkd-receipt__warn">{KKD_QUOTA_FULL_TITLE}</p>
              ) : null}

              <div className="wms-ops-kkd-receipt__table-wrap">
                <table className="wms-ops-kkd-receipt__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Stok</th>
                      <th>Grup</th>
                      <th>Miktar</th>
                      <th>Hak</th>
                      <th>Fazla</th>
                      <th>Lot / seri</th>
                      <th>Sipariş</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.lineNo}</td>
                        <td>
                          <strong className="font-mono">{line.stockCode}</strong>
                          <span className="block text-[0.7rem] text-[var(--wms-app-text-muted)]">
                            {line.stockName}
                          </span>
                        </td>
                        <td className="font-mono">{line.groupCode || '—'}</td>
                        <td className="text-right">{line.quantity}</td>
                        <td className="text-right text-emerald-500">{line.entitledQuantity}</td>
                        <td className="text-right text-amber-500">{line.excessQuantity}</td>
                        <td>{[line.lotNo, line.serialNo].filter(Boolean).join(' / ') || '—'}</td>
                        <td className="font-mono">{line.openOrderNo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="wms-ops-kkd-receipt__totals">
                <span>
                  Toplam <strong>{totalQty}</strong>
                </span>
                <span>
                  Hak <strong>{entitledQty}</strong>
                </span>
                <span>
                  Fazla <strong>{excessQty}</strong>
                </span>
              </div>

              <div className="wms-ops-kkd-receipt__sign">
                <div>Teslim eden (depo)</div>
                <div>Teslim alan (personel)</div>
              </div>
            </article>
          ) : (
            <p className="text-sm text-[var(--wms-app-text-muted)]">Belge yüklenemedi.</p>
          )}
        </OpsDialogBody>
        <OpsDialogFooter>
          <OpsActionButton variant="secondary" onClick={() => onOpenChange(false)}>
            Kapat
          </OpsActionButton>
          <OpsActionButton variant="primary" disabled={!detail} onClick={handlePrint}>
            <Printer className="size-3.5 shrink-0" />
            Yazdır
          </OpsActionButton>
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}
