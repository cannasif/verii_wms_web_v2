import type { KkdDistributionDetail } from './kkd-api';
import { formatErpStatus, formatExcessApprovalStatus } from './kkd-quota-copy';

const escapeHtml = (value: string | number | null | undefined): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');

const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('tr-TR');
};

/** Teslim belgesi HTML’i — yazdırma penceresi ve önizleme için. */
export function buildKkdReceiptHtml(detail: KkdDistributionDetail): string {
  const totalQty = detail.lines.reduce((sum, line) => sum + line.quantity, 0);
  const entitledQty = detail.lines.reduce((sum, line) => sum + line.entitledQuantity, 0);
  const excessQty = detail.lines.reduce((sum, line) => sum + line.excessQuantity, 0);
  const rows = detail.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.lineNo)}</td>
        <td class="mono">${escapeHtml(line.stockCode)}</td>
        <td>${escapeHtml(line.stockName)}</td>
        <td class="mono">${escapeHtml(line.groupCode || '—')}</td>
        <td class="num">${escapeHtml(line.quantity)}</td>
        <td class="num">${escapeHtml(line.entitledQuantity)}</td>
        <td class="num">${escapeHtml(line.excessQuantity)}</td>
        <td>${escapeHtml([line.lotNo, line.serialNo].filter(Boolean).join(' / ') || '—')}</td>
        <td class="mono">${escapeHtml(line.openOrderNo || '—')}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(detail.documentNo)} · KKD Teslim Belgesi</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font: 12px/1.45 "Segoe UI", ui-sans-serif, system-ui, sans-serif;
      background: #fff;
    }
    .sheet { max-width: 190mm; margin: 0 auto; }
    .brand {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 2px solid #0ea5e9;
    }
    .brand h1 {
      margin: 0;
      font-size: 20px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .brand .doc {
      text-align: right;
      font-family: ui-monospace, Consolas, monospace;
      font-size: 13px;
      font-weight: 700;
      color: #0369a1;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 18px;
      margin: 14px 0 18px;
      padding: 12px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
    }
    .meta dt {
      margin: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
    }
    .meta dd {
      margin: 2px 0 0;
      font-size: 13px;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 8px;
      vertical-align: top;
    }
    th {
      background: #e0f2fe;
      text-align: left;
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #0c4a6e;
    }
    .mono { font-family: ui-monospace, Consolas, monospace; font-weight: 700; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .totals {
      display: flex;
      justify-content: flex-end;
      gap: 18px;
      margin-top: 12px;
      font-size: 12px;
    }
    .totals strong { color: #0369a1; }
    .note {
      margin-top: 16px;
      padding: 10px 12px;
      border-left: 3px solid #f59e0b;
      background: #fffbeb;
      font-size: 11px;
      color: #92400e;
    }
    .sign {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 36px;
    }
    .sign .box {
      border-top: 1px solid #94a3b8;
      padding-top: 8px;
      font-size: 11px;
      color: #475569;
      text-align: center;
    }
    .foot {
      margin-top: 24px;
      font-size: 10px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="brand">
      <div>
        <h1>KKD Teslim Belgesi</h1>
        <div>Malzeme teslim alındı belgesi · isteğe bağlı çıktı</div>
      </div>
      <div class="doc">${escapeHtml(detail.documentNo)}</div>
    </header>
    <dl class="meta">
      <div><dt>Personel</dt><dd>${escapeHtml(detail.employeeCode)} · ${escapeHtml(detail.employeeName)}</dd></div>
      <div><dt>Durum</dt><dd>${escapeHtml(detail.status)}</dd></div>
      <div><dt>Depo</dt><dd>#${escapeHtml(detail.warehouseId)}</dd></div>
      <div><dt>Ambar çıkışı</dt><dd>${escapeHtml(detail.warehouseOutboundDocumentNo || detail.warehouseOutboundId || '—')}</dd></div>
      <div><dt>Kaynak</dt><dd>${escapeHtml(detail.kkdRequestNo ? `Talep · ${detail.kkdRequestNo}` : 'Sipariş kanalı')}</dd></div>
      <div><dt>Netsis</dt><dd>${escapeHtml(formatErpStatus(detail.erpStatus))}${detail.erpDocumentNo ? ` · ${escapeHtml(detail.erpDocumentNo)}` : ''}</dd></div>
      <div><dt>Teslim tarihi</dt><dd>${escapeHtml(formatDateTime(detail.completedAtUtc ?? detail.createdDate))}</dd></div>
      ${excessQty > 0 ? `<div><dt>Kota onayı</dt><dd>${escapeHtml(formatExcessApprovalStatus(detail.excessApprovalStatus))}</dd></div>` : ''}
    </dl>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Stok kodu</th><th>Stok adı</th><th>Grup</th>
          <th>Miktar</th><th>Hak</th><th>Fazla</th><th>Lot / seri</th><th>Sipariş</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <span>Toplam: <strong>${escapeHtml(totalQty)}</strong></span>
      <span>Hak: <strong>${escapeHtml(entitledQty)}</strong></span>
      <span>Fazla: <strong>${escapeHtml(excessQty)}</strong></span>
    </div>
    ${
      detail.excessApprovalReason
        ? `<div class="note">Kota notu: ${escapeHtml(detail.excessApprovalReason)}</div>`
        : ''
    }
    <div class="sign">
      <div class="box">Teslim eden (depo)${detail.deliveredByName ? ` · ${escapeHtml(detail.deliveredByName)}` : ''}</div>
      <div class="box">Teslim alan (personel) · ${escapeHtml(detail.employeeName)}</div>
    </div>
    <p class="foot">Bu belge bilgilendirme amaçlıdır. Sistem kaydı: ${escapeHtml(detail.correlationId || detail.id)}</p>
  </div>
</body>
</html>`;
}

/**
 * Belgeyi yeni sekmeye yazar ve yazdırma önizlemesini açar.
 *
 * Pencere "noopener" ile açılamaz: tarayıcı o durumda boş bir sekme açıp null döndürür, dolayısıyla
 * belge hiç yazılamaz. Bağı biz kesiyoruz. Ayrıca boş sayfanın load olayı belge yazılmadan önce
 * geçtiği için yazdırma, belge hazır olduğunda tetiklenir.
 */
export function printKkdReceipt(detail: KkdDistributionDetail): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  try {
    win.opener = null;
  } catch {
    // Tarayıcı izin vermezse belge yine de aynı köken altında ve bizim ürettiğimiz içeriktir.
  }
  win.document.open();
  win.document.write(buildKkdReceiptHtml(detail));
  win.document.close();
  win.focus();

  const print = (): void => {
    win.focus();
    win.print();
  };
  if (win.document.readyState === 'complete') window.setTimeout(print, 120);
  else win.addEventListener('load', print, { once: true });
  return true;
}
