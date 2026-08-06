import { resolveAppPath } from "@/lib/api-config";
import { registerPdfExportFont } from "@/lib/pdf-export-font";
import {
  formatProjectDate,
  formatProjectNumber,
} from "@/lib/project-format";
import { procurementApi } from "../api";
import { isImageContentType } from "../ProcurementAttachments";
import type { ProcurementAttachment } from "../types";

export type JsPdfDoc = import("jspdf").jsPDF;
export type AutoTableFn = typeof import("jspdf-autotable").autoTable;

/** Editorial procurement document tokens — less box, more type. */
export const PDF = {
  margin: 16,
  footerH: 12,
  contentTop: 18,
  colors: {
    ink: [15, 23, 42] as [number, number, number],
    inkSoft: [51, 65, 85] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    soft: [148, 163, 184] as [number, number, number],
    line: [226, 232, 240] as [number, number, number],
    hair: [241, 245, 249] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    accent: [13, 148, 136] as [number, number, number],
    ok: [5, 150, 105] as [number, number, number],
    warn: [217, 119, 6] as [number, number, number],
    danger: [225, 29, 72] as [number, number, number],
  },
} as const;

export type PdfInfoItem = { label: string; value: string };
export type PdfMetaField = {
  label: string;
  value?: string;
  /** Belge no gibi kimlik alanları */
  emphasize?: boolean;
  /** Status raw key → ● ONAYLANDI */
  status?: string;
  /** 2 = satırın tamamını kaplar */
  span?: 1 | 2;
};
export type PdfMetaGroup = {
  /** Opsiyonel grup başlığı: BELGE / PLANLAMA */
  title?: string;
  fields: PdfMetaField[];
};
export type PdfImageAttachment = {
  label: string;
  stockCode?: string;
  stockName?: string;
  fileName: string;
  dataUrl: string;
  format: "JPEG" | "PNG";
  kind: "product" | "document";
};
export type PdfFileAttachment = {
  label: string;
  fileName: string;
  contentType: string;
};

export const statusLabelTr: Record<string, string> = {
  Draft: "Taslak",
  PendingApproval: "Onay Bekliyor",
  Approved: "Onaylandı",
  Rejected: "Reddedildi",
  Converted: "Tamamı Sipariş Verildi",
  PartiallyConverted: "Kısmi Sipariş Verildi",
  PartiallyApproved: "Kalem Bazlı İşlem Devam Ediyor",
  Cancelled: "İptal",
  Sent: "Gönderildi",
  Quoted: "Teklif Geldi",
  Closed: "Kapandı",
  Submitted: "Sunuldu",
  SentToSupplier: "Tedarikçiye Gönderildi",
  PartiallyReceived: "Kısmi Kabul",
  Received: "Tamamlandı",
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const fmt = (value: number) => formatProjectNumber(value);
export const fmtMoney = (value: number, currency: string) =>
  `${fmt(value)} ${currency}`;
export const fmtDate = (value?: string | null) =>
  value ? formatProjectDate(value) : "";
export const hasText = (value?: string | null): value is string =>
  Boolean(value?.trim());
export const clean = (value?: string | null) => value?.trim() ?? "";

export const lastTableY = (doc: JsPdfDoc, fallback: number) =>
  ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? fallback);

export async function createProcurementPdfDoc() {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const font = await registerPdfExportFont(doc);
  return {
    doc,
    font,
    autoTable: autoTableMod.autoTable,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    contentWidth: doc.internal.pageSize.getWidth() - PDF.margin * 2,
  };
}

export const blobToPdfImage = async (
  blob: Blob,
  maxSide = 1200,
): Promise<{ dataUrl: string; format: "JPEG" | "PNG" } | null> => {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Görsel yüklenemedi."));
      el.src = objectUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.82), format: "JPEG" };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export async function tryLoadBrandMark(): Promise<{
  dataUrl: string;
  format: "JPEG" | "PNG";
} | null> {
  try {
    const response = await fetch(resolveAppPath("/favicon.png"), {
      cache: "force-cache",
    });
    if (!response.ok) return null;
    return blobToPdfImage(await response.blob(), 256);
  } catch {
    return null;
  }
}

export async function loadAttachments(
  items: Array<{
    attachment: ProcurementAttachment;
    label: string;
    stockCode?: string;
    stockName?: string;
    kind: "product" | "document";
  }>,
): Promise<{ images: PdfImageAttachment[]; files: PdfFileAttachment[] }> {
  const images: PdfImageAttachment[] = [];
  const files: PdfFileAttachment[] = [];

  for (const item of items) {
    const { attachment, label, stockCode, stockName, kind } = item;
    if (!isImageContentType(attachment.contentType, attachment.fileName)) {
      files.push({
        label,
        fileName: attachment.fileName,
        contentType: attachment.contentType || "application/octet-stream",
      });
      continue;
    }
    try {
      const blob = await procurementApi.downloadAttachment(attachment.id);
      // Thumbnail preview only — keep PDF layout compact
      const converted = await blobToPdfImage(blob, 640);
      if (!converted) {
        files.push({
          label,
          fileName: attachment.fileName,
          contentType: attachment.contentType,
        });
        continue;
      }
      images.push({
        label,
        stockCode,
        stockName,
        fileName: attachment.fileName,
        dataUrl: converted.dataUrl,
        format: converted.format,
        kind,
      });
    } catch {
      files.push({
        label,
        fileName: `${attachment.fileName} (indirilemedi)`,
        contentType: attachment.contentType,
      });
    }
  }

  return { images, files };
}

export function ensureSpace(
  doc: JsPdfDoc,
  y: number,
  needed: number,
  pageHeight: number,
  top = PDF.contentTop,
  onNewPage?: () => void,
) {
  if (y + needed <= pageHeight - PDF.footerH - 6) return y;
  doc.addPage();
  onNewPage?.();
  return top;
}

function statusAccent(status: string): [number, number, number] {
  if (
    ["Approved", "Converted", "Submitted", "Received", "Quoted", "SentToSupplier"].includes(
      status,
    )
  )
    return PDF.colors.ok;
  if (
    [
      "PendingApproval",
      "PartiallyApproved",
      "PartiallyConverted",
      "PartiallyReceived",
      "Sent",
      "Draft",
    ].includes(status)
  )
    return PDF.colors.warn;
  if (status === "Rejected" || status === "Cancelled") return PDF.colors.danger;
  return PDF.colors.muted;
}

/** First-page editorial masthead. */
export function drawMasthead(
  doc: JsPdfDoc,
  font: string,
  opts: {
    pageWidth: number;
    brandMark: { dataUrl: string; format: "JPEG" | "PNG" } | null;
    titleLines: string[];
    documentNo: string;
    documentDate?: string | null;
  },
): number {
  const m = PDF.margin;
  const { pageWidth, brandMark, titleLines, documentNo, documentDate } = opts;

  // Thin accent rail
  doc.setFillColor(...PDF.colors.accent);
  doc.rect(0, 0, pageWidth, 0.7, "F");

  let y: number = m + 2;

  if (brandMark) {
    try {
      doc.addImage(brandMark.dataUrl, brandMark.format, m, y, 6.5, 6.5);
    } catch {
      /* typographic brand */
    }
  }

  const brandX = brandMark ? m + 8.5 : m;
  doc.setFont(font, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF.colors.ink);
  doc.text("V3Rİİ", brandX, y + 3);
  doc.setFont(font, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF.colors.muted);
  doc.text("WMS  /  PROCUREMENT", brandX, y + 6.8);

  // Right: document identity
  doc.setFont(font, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PDF.colors.ink);
  let ty = y + 2;
  for (const line of titleLines) {
    doc.text(line, pageWidth - m, ty, { align: "right" });
    ty += 6.2;
  }

  doc.setFont(font, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF.colors.accent);
  doc.text(documentNo, pageWidth - m, ty + 1.5, { align: "right" });

  if (documentDate) {
    doc.setFont(font, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF.colors.muted);
    doc.text(fmtDate(documentDate), pageWidth - m, ty + 6, { align: "right" });
  }

  y = Math.max(y + 14, ty + 10);
  doc.setDrawColor(...PDF.colors.line);
  doc.setLineWidth(0.25);
  doc.line(m, y, pageWidth - m, y);
  return y + 8;
}

/** Compact continuation header for page 2+. */
export function drawContinuationHeader(
  doc: JsPdfDoc,
  font: string,
  pageWidth: number,
  title: string,
  documentNo: string,
): number {
  const m = PDF.margin;
  doc.setFillColor(...PDF.colors.accent);
  doc.rect(0, 0, pageWidth, 0.55, "F");

  doc.setFont(font, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF.colors.muted);
  doc.text(`V3Rİİ WMS  —  ${title}`, m, 10);
  doc.setFont(font, "bold");
  doc.setTextColor(...PDF.colors.ink);
  doc.text(documentNo, pageWidth - m, 10, { align: "right" });

  doc.setDrawColor(...PDF.colors.hair);
  doc.setLineWidth(0.3);
  doc.line(m, 13, pageWidth - m, 13);
  return 18;
}

export function drawSection(
  doc: JsPdfDoc,
  font: string,
  opts: {
    index: string;
    title: string;
    subtitle?: string;
    y: number;
    pageHeight: number;
  },
): number {
  let y = ensureSpace(doc, opts.y, 16, opts.pageHeight);
  doc.setFont(font, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF.colors.accent);
  doc.text(opts.index, PDF.margin, y);

  doc.setFont(font, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF.colors.ink);
  doc.text(opts.title.toLocaleUpperCase("tr-TR"), PDF.margin + 8, y);

  y += 4.2;
  if (opts.subtitle) {
    doc.setFont(font, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF.colors.muted);
    doc.text(opts.subtitle, PDF.margin + 8, y);
    y += 5;
  } else {
    y += 2.5;
  }
  return y;
}

function metaFieldVisible(field: PdfMetaField): boolean {
  if (field.status) return true;
  return hasText(field.value);
}

function drawMetaFieldCell(
  doc: JsPdfDoc,
  font: string,
  field: PdfMetaField,
  x: number,
  y: number,
  width: number,
): number {
  doc.setFont(font, "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(...PDF.colors.soft);
  doc.text(field.label.toLocaleUpperCase("tr-TR"), x, y);

  if (field.status) {
    drawStatusLine(doc, font, field.status, x, y + 5.6);
    return 11;
  }

  const value = clean(field.value);
  if (field.emphasize) {
    doc.setFont(font, "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...PDF.colors.ink);
    const lines = doc.splitTextToSize(value, width);
    doc.text(lines.slice(0, 2), x, y + 5.8);
    return 6 + lines.slice(0, 2).length * 5;
  }

  doc.setFont(font, "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF.colors.ink);
  const lines = doc.splitTextToSize(value, width);
  doc.text(lines.slice(0, 2), x, y + 5.2);
  return 5.5 + lines.slice(0, 2).length * 4.2;
}

/**
 * Structured metadata panel — subtle surface, thin separators, 2-col grid.
 * No cards / heavy borders.
 */
export function drawDocumentMetaPanel(
  doc: JsPdfDoc,
  font: string,
  groups: PdfMetaGroup[],
  y: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const normalized = groups
    .map((g) => ({
      ...g,
      fields: g.fields.filter(metaFieldVisible),
    }))
    .filter((g) => g.fields.length > 0);
  if (!normalized.length) return y;

  type Row =
    | { kind: "group"; title: string }
    | { kind: "pair"; left: PdfMetaField; right?: PdfMetaField }
    | { kind: "full"; field: PdfMetaField };

  const rows: Row[] = [];
  for (const group of normalized) {
    if (group.title) rows.push({ kind: "group", title: group.title });
    let i = 0;
    while (i < group.fields.length) {
      const a = group.fields[i]!;
      if (a.span === 2) {
        rows.push({ kind: "full", field: a });
        i += 1;
        continue;
      }
      const b = group.fields[i + 1];
      if (b && b.span !== 2) {
        rows.push({ kind: "pair", left: a, right: b });
        i += 2;
      } else {
        rows.push({ kind: "pair", left: a });
        i += 1;
      }
    }
  }

  const m = PDF.margin;
  const padX = 5.5;
  const padY = 6;
  const innerW = pageWidth - m * 2;
  const colGap = 10;
  const colW = (innerW - padX * 2 - colGap) / 2;
  const rowGap = 3.2;
  const rowHeights = rows.map((row) => {
    if (row.kind === "group") return 5.5;
    if (row.kind === "full") {
      if (row.field.emphasize) return 14;
      if (row.field.status) return 12;
      return 12.5;
    }
    if (row.left.emphasize || row.right?.emphasize) return 14;
    if (row.left.status || row.right?.status) return 12;
    return 12.5;
  });
  const panelH =
    padY * 2 +
    rowHeights.reduce((s, h) => s + h, 0) +
    Math.max(0, rows.length - 1) * rowGap;

  y = ensureSpace(doc, y, panelH + 4, pageHeight);

  doc.setFillColor(250, 250, 252);
  doc.rect(m, y, innerW, panelH, "F");
  doc.setFillColor(...PDF.colors.accent);
  doc.rect(m, y, 0.7, panelH, "F");
  doc.setDrawColor(...PDF.colors.line);
  doc.setLineWidth(0.2);
  doc.line(m, y, m + innerW, y);
  doc.line(m, y + panelH, m + innerW, y + panelH);

  let cy = y + padY + 2.5;
  const contentX = m + padX + 1.2;

  rows.forEach((row, index) => {
    const rowH = rowHeights[index]!;
    if (row.kind === "group") {
      doc.setFont(font, "bold");
      doc.setFontSize(6.4);
      doc.setTextColor(...PDF.colors.accent);
      doc.text(row.title.toLocaleUpperCase("tr-TR"), contentX, cy + 2.2);
    } else if (row.kind === "full") {
      drawMetaFieldCell(
        doc,
        font,
        row.field,
        contentX,
        cy,
        innerW - padX * 2 - 2,
      );
    } else {
      drawMetaFieldCell(doc, font, row.left, contentX, cy, colW);
      if (row.right) {
        drawMetaFieldCell(
          doc,
          font,
          row.right,
          contentX + colW + colGap,
          cy,
          colW,
        );
      }
    }

    cy += rowH;
    if (index < rows.length - 1) {
      doc.setDrawColor(...PDF.colors.line);
      doc.setLineWidth(0.14);
      doc.line(contentX, cy + 0.6, m + innerW - padX, cy + 0.6);
      cy += rowGap;
    }
  });

  return y + panelH + 8;
}

/** Compact 2–3 col meta (özet vb.) — panel olmadan. */
export function drawMetaGrid(
  doc: JsPdfDoc,
  font: string,
  items: PdfInfoItem[],
  y: number,
  pageWidth: number,
  cols = 3,
): number {
  const usable = items.filter((x) => hasText(x.value));
  if (!usable.length) return y;

  const m = PDF.margin;
  const gap = 8;
  const colW = (pageWidth - m * 2 - gap * (cols - 1)) / cols;
  const rowH = 12;

  usable.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = m + col * (colW + gap);
    const iy = y + row * rowH;
    drawMetaFieldCell(
      doc,
      font,
      { label: item.label, value: item.value },
      x,
      iy,
      colW,
    );
  });

  return y + Math.ceil(usable.length / cols) * rowH + 4;
}

export function drawStatusLine(
  doc: JsPdfDoc,
  font: string,
  status: string,
  x: number,
  y: number,
) {
  const label = (statusLabelTr[status] ?? status).toLocaleUpperCase("tr-TR");
  const tone = statusAccent(status);
  doc.setFillColor(...tone);
  doc.circle(x + 1.1, y - 0.9, 1.1, "F");
  doc.setFont(font, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF.colors.inkSoft);
  doc.text(label, x + 4.2, y);
}

export function drawEditorialTable(
  doc: JsPdfDoc,
  autoTable: AutoTableFn,
  font: string,
  opts: {
    startY: number;
    head: string[][];
    body: string[][];
    contentWidth: number;
    columnStyles?: Record<number, object>;
    pageWidth: number;
    pageHeight: number;
    continuation?: { title: string; documentNo: string };
  },
) {
  const m = PDF.margin;
  autoTable(doc, {
    startY: opts.startY,
    head: opts.head,
    body: opts.body,
    theme: "plain",
    styles: {
      font,
      fontStyle: "normal",
      fontSize: 8,
      textColor: PDF.colors.ink,
      fillColor: PDF.colors.white,
      lineWidth: 0,
      cellPadding: { top: 3.2, bottom: 3.2, left: 0.5, right: 2 },
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 7.5,
    },
    headStyles: {
      font,
      fontStyle: "bold",
      fontSize: 6.5,
      textColor: PDF.colors.soft,
      fillColor: PDF.colors.white,
      cellPadding: { top: 2, bottom: 3.5, left: 0.5, right: 2 },
    },
    columnStyles: opts.columnStyles,
    margin: {
      left: m,
      right: m,
      top: opts.continuation ? 20 : PDF.contentTop,
      bottom: PDF.footerH + 5,
    },
    tableWidth: opts.contentWidth,
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didDrawPage: (data) => {
      if (data.pageNumber > 1 && opts.continuation) {
        drawContinuationHeader(
          doc,
          font,
          opts.pageWidth,
          opts.continuation.title,
          opts.continuation.documentNo,
        );
      }
    },
    didDrawCell: (data) => {
      const x = data.table.settings.margin.left as number;
      const tableW = opts.contentWidth;
      if (data.section === "head" && data.column.index === 0) {
        doc.setDrawColor(...PDF.colors.ink);
        doc.setLineWidth(0.35);
        doc.line(
          x,
          data.cell.y + data.cell.height,
          x + tableW,
          data.cell.y + data.cell.height,
        );
      }
      if (data.section === "body" && data.column.index === 0) {
        doc.setDrawColor(...PDF.colors.line);
        doc.setLineWidth(0.18);
        doc.line(
          x,
          data.cell.y + data.cell.height,
          x + tableW,
          data.cell.y + data.cell.height,
        );
      }
    },
  });
}

/**
 * Fiyatlandırma: sol başlık + sağ tutarlar aynı üst baseline'da.
 * Her satırda etiket ve tutar ortak Y kullanır.
 */
export function drawPricingEditorial(
  doc: JsPdfDoc,
  font: string,
  opts: {
    index: string;
    title: string;
    subtitle?: string;
    rows: Array<{ label: string; value: string; emphasize?: boolean }>;
    y: number;
    pageWidth: number;
    pageHeight: number;
  },
): number {
  const boxW = 72;
  const totalsH =
    4 + opts.rows.reduce((h, r) => h + (r.emphasize ? 12.5 : 6), 0);
  const headerH = opts.subtitle ? 10 : 5;
  const y0 = ensureSpace(
    doc,
    opts.y,
    Math.max(headerH, totalsH) + 4,
    opts.pageHeight,
  );
  const xRight = opts.pageWidth - PDF.margin - boxW;

  // Left section title — same baseline as first totals row
  doc.setFont(font, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF.colors.accent);
  doc.text(opts.index, PDF.margin, y0);

  doc.setFont(font, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF.colors.ink);
  doc.text(opts.title.toLocaleUpperCase("tr-TR"), PDF.margin + 8, y0);

  if (opts.subtitle) {
    doc.setFont(font, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF.colors.muted);
    doc.text(opts.subtitle, PDF.margin + 8, y0 + 4.2);
  }

  // Right totals — first row shares y0 with the title
  doc.setDrawColor(...PDF.colors.line);
  doc.setLineWidth(0.25);
  doc.line(xRight, y0 - 3, xRight + boxW, y0 - 3);

  let y = y0;
  for (let i = 0; i < opts.rows.length; i += 1) {
    const row = opts.rows[i]!;
    if (i > 0) y += row.emphasize ? 4 : 6;

    if (row.emphasize) {
      doc.setDrawColor(...PDF.colors.ink);
      doc.setLineWidth(0.35);
      doc.line(xRight, y, xRight + boxW, y);
      y += 5;
      doc.setFont(font, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...PDF.colors.ink);
      doc.text(row.label, xRight, y);
      doc.text(row.value, xRight + boxW, y, { align: "right" });
    } else {
      doc.setFont(font, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...PDF.colors.muted);
      doc.text(row.label, xRight, y);
      doc.setFont(font, "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PDF.colors.ink);
      doc.text(row.value, xRight + boxW, y, { align: "right" });
    }
  }

  return Math.max(y0 + headerH, y) + 8;
}

export function drawTotalsEditorial(
  doc: JsPdfDoc,
  font: string,
  rows: Array<{ label: string; value: string; emphasize?: boolean }>,
  y: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const boxW = 72;
  const needed = 4 + rows.length * 8 + 8;
  y = ensureSpace(doc, y, needed, pageHeight);
  const x = pageWidth - PDF.margin - boxW;

  doc.setDrawColor(...PDF.colors.line);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + boxW, y);
  y += 5.5;

  for (const row of rows) {
    if (row.emphasize) {
      doc.setDrawColor(...PDF.colors.ink);
      doc.setLineWidth(0.35);
      doc.line(x, y, x + boxW, y);
      y += 5;
      doc.setFont(font, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...PDF.colors.ink);
      doc.text(row.label, x, y);
      doc.text(row.value, x + boxW, y, { align: "right" });
      y += 7;
    } else {
      const rowY = y;
      doc.setFont(font, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...PDF.colors.muted);
      doc.text(row.label, x, rowY);
      doc.setFont(font, "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PDF.colors.ink);
      doc.text(row.value, x + boxW, rowY, { align: "right" });
      y += 6;
    }
  }
  return y + 6;
}

export function drawFooters(
  doc: JsPdfDoc,
  font: string,
  opts: {
    pageWidth: number;
    pageHeight: number;
    documentNo: string;
    documentLabel: string;
  },
) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const y = opts.pageHeight - 7;
    doc.setDrawColor(...PDF.colors.hair);
    doc.setLineWidth(0.25);
    doc.line(PDF.margin, y - 4, opts.pageWidth - PDF.margin, y - 4);

    doc.setFont(font, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF.colors.soft);
    doc.text("V3Rİİ WMS", PDF.margin, y);
    doc.text("PROCUREMENT", PDF.margin, y + 3);
    doc.text(opts.documentNo, opts.pageWidth / 2, y + 1.2, { align: "center" });
    doc.setFont(font, "bold");
    doc.setTextColor(...PDF.colors.muted);
    doc.text(
      `${String(i).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}`,
      opts.pageWidth - PDF.margin,
      y + 1.2,
      { align: "right" },
    );
  }
}

export type PdfAttachmentBlock = {
  /** Örn. "TALEP EKLERİ" veya "SATIR 01" */
  heading: string;
  /** Örn. "STK-001 — Plastik Kasa" */
  subheading?: string;
  caption?: string;
  images: PdfImageAttachment[];
  files: PdfFileAttachment[];
};

const THUMB_H = 22;
const THUMB_COLS = 3;

function blockHasContent(block: PdfAttachmentBlock) {
  return block.images.length > 0 || block.files.length > 0;
}

/** Attachment kind label from known contentType / extension — no guessing beyond that. */
function fileTypeLabel(contentType: string, fileName: string): string {
  if (isImageContentType(contentType, fileName)) return "GÖRSEL";
  const ct = (contentType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();
  if (ct.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (
    ct.includes("word") ||
    ct.includes("officedocument") ||
    ct.includes("msword") ||
    ct.includes("sheet") ||
    ct.includes("excel") ||
    ct.includes("text/") ||
    /\.(docx?|xlsx?|pptx?|txt|csv|rtf)$/i.test(name)
  ) {
    return "DOKÜMAN";
  }
  return "DİĞER";
}

function drawThumbGrid(
  doc: JsPdfDoc,
  font: string,
  images: PdfImageAttachment[],
  y: number,
  pageHeight: number,
  contentWidth: number,
  onNewPage?: () => void,
): number {
  if (!images.length) return y;
  const gap = 4;
  const colW = (contentWidth - gap * (THUMB_COLS - 1)) / THUMB_COLS;
  let col = 0;
  let rowTop = y;

  for (const img of images) {
    if (col === 0) {
      rowTop = ensureSpace(
        doc,
        rowTop,
        THUMB_H + 10,
        pageHeight,
        PDF.contentTop,
        onNewPage,
      );
    }
    const x = PDF.margin + col * (colW + gap);
    doc.setDrawColor(...PDF.colors.line);
    doc.setLineWidth(0.15);
    doc.rect(x, rowTop, colW, THUMB_H);

    try {
      const props = doc.getImageProperties(img.dataUrl);
      const ratio = Math.min(
        (colW - 2) / props.width,
        (THUMB_H - 2) / props.height,
        1,
      );
      const w = props.width * ratio;
      const h = props.height * ratio;
      doc.addImage(
        img.dataUrl,
        img.format,
        x + (colW - w) / 2,
        rowTop + (THUMB_H - h) / 2,
        w,
        h,
      );
    } catch {
      doc.setFont(font, "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...PDF.colors.muted);
      doc.text("Önizleme yok", x + colW / 2, rowTop + THUMB_H / 2, {
        align: "center",
      });
    }

    doc.setFont(font, "normal");
    doc.setFontSize(6);
    doc.setTextColor(...PDF.colors.muted);
    doc.text(img.fileName, x, rowTop + THUMB_H + 3.2, {
      maxWidth: colW,
    });

    col += 1;
    if (col >= THUMB_COLS) {
      col = 0;
      rowTop += THUMB_H + 9;
    }
  }

  return col === 0 ? rowTop : rowTop + THUMB_H + 9;
}

/**
 * Ekler her zaman ana akışın sonunda.
 * Talep ekleri / satır ekleri ayrı bloklar; thumbnail boyutu sabit.
 */
export function drawAttachmentsEditorial(
  doc: JsPdfDoc,
  font: string,
  y: number,
  pageWidth: number,
  pageHeight: number,
  contentWidth: number,
  sectionIndex: string,
  blocks: PdfAttachmentBlock[],
  continuation?: { title: string; documentNo: string },
): number {
  const usable = blocks.filter(blockHasContent);
  if (!usable.length) return y;

  const onNewPage = continuation
    ? () =>
        drawContinuationHeader(
          doc,
          font,
          pageWidth,
          continuation.title,
          continuation.documentNo,
        )
    : undefined;

  // Keep section heading with first content — otherwise start new page.
  const minKeep = 36;
  if (y + minKeep > pageHeight - PDF.footerH - 6) {
    doc.addPage();
    onNewPage?.();
    y = PDF.contentTop;
  }

  doc.setDrawColor(...PDF.colors.line);
  doc.setLineWidth(0.25);
  doc.line(PDF.margin, y, pageWidth - PDF.margin, y);
  y += 6;

  y = drawSection(doc, font, {
    index: sectionIndex,
    title: "Ekler",
    subtitle: "Belgeye eklenen dosya ve görseller",
    y,
    pageHeight,
  });

  let headerGroupOpened = false;
  let lineGroupOpened = false;
  for (const block of usable) {
    const isLineBlock = /satır/i.test(block.heading);

    if (!isLineBlock && !headerGroupOpened) {
      headerGroupOpened = true;
      y = ensureSpace(doc, y, 14, pageHeight, PDF.contentTop, onNewPage);
      doc.setFont(font, "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PDF.colors.ink);
      doc.text("TALEP / BELGE EKLERİ", PDF.margin, y);
      y += 3.5;
      doc.setFont(font, "normal");
      doc.setFontSize(7);
      doc.setTextColor(...PDF.colors.muted);
      doc.text("Belge veya talep seviyesinde eklenen dosyalar", PDF.margin, y);
      y += 5;
    }

    if (isLineBlock && !lineGroupOpened) {
      lineGroupOpened = true;
      y = ensureSpace(doc, y, 14, pageHeight, PDF.contentTop, onNewPage);
      doc.setFont(font, "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PDF.colors.ink);
      doc.text("SATIR / STOK EKLERİ", PDF.margin, y);
      y += 3.5;
      doc.setFont(font, "normal");
      doc.setFontSize(7);
      doc.setTextColor(...PDF.colors.muted);
      doc.text("Stok satırlarına eklenen görseller ve dosyalar", PDF.margin, y);
      y += 5;
    }

    // Keep heading + first thumb/file together
    y = ensureSpace(doc, y, 28, pageHeight, PDF.contentTop, onNewPage);

    doc.setFont(font, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF.colors.accent);
    doc.text(block.heading.toLocaleUpperCase("tr-TR"), PDF.margin, y);
    y += 4;

    if (block.subheading) {
      doc.setFont(font, "bold");
      doc.setFontSize(9);
      doc.setTextColor(...PDF.colors.ink);
      doc.text(block.subheading, PDF.margin, y, { maxWidth: contentWidth });
      y += 4.2;
    }
    if (block.caption) {
      doc.setFont(font, "normal");
      doc.setFontSize(7);
      doc.setTextColor(...PDF.colors.muted);
      doc.text(block.caption, PDF.margin, y);
      y += 3.8;
    }

    doc.setDrawColor(...PDF.colors.hair);
    doc.setLineWidth(0.2);
    doc.line(PDF.margin, y, pageWidth - PDF.margin, y);
    y += 4;

    y = drawThumbGrid(
      doc,
      font,
      block.images,
      y,
      pageHeight,
      contentWidth,
      onNewPage,
    );

    for (const file of block.files) {
      y = ensureSpace(doc, y, 7, pageHeight, PDF.contentTop, onNewPage);
      const kind = fileTypeLabel(file.contentType, file.fileName);
      doc.setFont(font, "bold");
      doc.setFontSize(7);
      doc.setTextColor(...PDF.colors.muted);
      doc.text(kind, PDF.margin, y);
      doc.setFont(font, "normal");
      doc.setTextColor(...PDF.colors.ink);
      doc.text(file.fileName, PDF.margin + 16, y, {
        maxWidth: contentWidth - 16,
      });
      y += 4.5;
    }

    y += 5;
  }

  return y;
}
