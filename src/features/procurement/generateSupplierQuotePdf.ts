import { resolveAppPath } from "@/lib/api-config";
import { registerPdfExportFont } from "@/lib/pdf-export-font";
import {
  formatProjectDate,
  formatProjectNumber,
} from "@/lib/project-format";
import { procurementApi } from "./api";
import { isImageContentType } from "./ProcurementAttachments";
import type {
  ProcurementAttachment,
  ProcurementDocumentDetail,
  ProcurementLineDetail,
} from "./types";

type LineMoney = {
  gross: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
};

type PdfImageAttachment = {
  label: string;
  stockCode?: string;
  stockName?: string;
  fileName: string;
  dataUrl: string;
  format: "JPEG" | "PNG";
  kind: "product" | "document";
};

type PdfFileAttachment = {
  label: string;
  fileName: string;
  contentType: string;
};

type JsPdfDoc = import("jspdf").jsPDF;

const COLORS = {
  ink: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  soft: [148, 163, 184] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  card: [248, 250, 252] as [number, number, number],
  cardBorder: [226, 232, 240] as [number, number, number],
  head: [30, 58, 138] as [number, number, number],
  brand: [30, 64, 175] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  altRow: [248, 250, 252] as [number, number, number],
};

const FOOTER_H = 16;
const MARGIN = 14;

const downloadBlob = (blob: Blob, fileName: string) => {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const money = (line: ProcurementLineDetail): LineMoney => {
  const gross = line.quantity * line.unitPrice;
  const discount = gross * (line.discountRate / 100);
  const net = gross - discount;
  const vat = net * (line.vatRate / 100);
  return { gross, discount, net, vat, total: net + vat };
};

const fmt = (value: number) => formatProjectNumber(value);

const fmtMoney = (value: number, currency: string) =>
  `${fmt(value)} ${currency}`;

const fmtDate = (value?: string | null) =>
  value ? formatProjectDate(value) : "";

const hasText = (value?: string | null): value is string =>
  Boolean(value?.trim());

const clean = (value?: string | null) => value?.trim() ?? "";

const lastTableY = (doc: JsPdfDoc, fallback: number) =>
  ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? fallback);

/** jsPDF için JPEG data URL; görselleri sınırlı çözünürlüğe indirger. */
const blobToPdfImage = async (
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

async function tryLoadBrandMark(): Promise<{
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

async function loadAttachments(
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
      const converted = await blobToPdfImage(blob, kind === "product" ? 900 : 1200);
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

function collectAttachmentRefs(
  quote: ProcurementDocumentDetail,
  request?: ProcurementDocumentDetail,
) {
  const refs: Array<{
    attachment: ProcurementAttachment;
    label: string;
    stockCode?: string;
    stockName?: string;
    kind: "product" | "document";
  }> = [];

  for (const a of quote.attachments ?? []) {
    refs.push({ attachment: a, label: "Teklif eki", kind: "document" });
  }
  for (const line of quote.lines) {
    for (const a of line.attachments ?? []) {
      refs.push({
        attachment: a,
        label: "Teklif kalemi",
        stockCode: line.stockCode,
        stockName: line.stockName,
        kind: "product",
      });
    }
  }
  if (request) {
    for (const a of request.attachments ?? []) {
      refs.push({ attachment: a, label: "Talep eki", kind: "document" });
    }
    for (const line of request.lines) {
      for (const a of line.attachments ?? []) {
        refs.push({
          attachment: a,
          label: "Talep kalemi",
          stockCode: line.stockCode,
          stockName: line.stockName,
          kind: "product",
        });
      }
    }
  }
  return refs;
}

function ensureSpace(
  doc: JsPdfDoc,
  y: number,
  needed: number,
  pageHeight: number,
  top = MARGIN + 4,
) {
  if (y + needed <= pageHeight - FOOTER_H - 4) return y;
  doc.addPage();
  return top;
}

function drawSectionTitle(doc: JsPdfDoc, font: string, title: string, y: number) {
  doc.setFont(font, "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(0.45);
  const titleW = doc.getTextWidth(title);
  doc.line(MARGIN, y + 1.6, MARGIN + Math.min(titleW, 48), y + 1.6);
  return y + 6;
}

function drawInfoCard(
  doc: JsPdfDoc,
  font: string,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  lines: string[],
) {
  doc.setFillColor(...COLORS.card);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");

  doc.setFont(font, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.brand);
  doc.text(title, x + 3.5, y + 5);

  doc.setTextColor(...COLORS.ink);
  let ty = y + 10;
  lines.forEach((line, index) => {
    if (!line) return;
    doc.setFont(font, index === 0 ? "bold" : "normal");
    doc.setFontSize(index === 0 ? 10 : 8.5);
    doc.setTextColor(...(index === 0 ? COLORS.ink : COLORS.muted));
    const wrapped = doc.splitTextToSize(line, w - 7);
    doc.text(wrapped, x + 3.5, ty);
    ty += wrapped.length * (index === 0 ? 4.4 : 3.8) + 0.6;
  });
}

function fileTypeLabel(contentType: string, fileName: string) {
  const name = fileName.toLowerCase();
  if (contentType.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (contentType.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(name))
    return "Görsel";
  if (contentType.includes("sheet") || /\.(xlsx?|csv)$/i.test(name))
    return "Tablo";
  return "Dosya";
}

/**
 * Gerçek quote detay API verisiyle A4 tedarikçi teklifi PDF'i oluşturur ve indirir.
 * Dosya adı: Teklif_{QuoteNo}.pdf
 */
export async function generateSupplierQuotePdf(quoteId: number): Promise<void> {
  const quote = await procurementApi.detail("quote", quoteId);
  if (quote.documentType !== "quote") {
    throw new Error("Seçilen belge bir tedarikçi teklifi değil.");
  }

  let request: ProcurementDocumentDetail | undefined;
  if (quote.requestId) {
    try {
      request = await procurementApi.detail("request", quote.requestId);
    } catch {
      request = undefined;
    }
  }

  const requestQtyByLineId = new Map<number, number>();
  if (request) {
    for (const line of request.lines) {
      requestQtyByLineId.set(line.id, line.quantity);
    }
  }

  const [{ images, files }, brandMark] = await Promise.all([
    loadAttachments(collectAttachmentRefs(quote, request)),
    tryLoadBrandMark(),
  ]);

  const productImages = images.filter((x) => x.kind === "product");
  const documentImages = images.filter((x) => x.kind === "document");

  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const font = await registerPdfExportFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const currency = quote.currencyCode || "TRY";
  const requestNo = clean(quote.requestNo ?? request?.documentNo);
  const requestSubject = clean(request?.subject ?? quote.subject);
  const projectCode = clean(
    quote.lines.find((l) => l.projectCode?.trim())?.projectCode,
  );
  const deliveryDates = quote.lines
    .map((x) => x.requiredDate)
    .filter((x): x is string => Boolean(x))
    .sort();
  const generalDelivery = deliveryDates[0] ?? "";
  const quoteDateLabel = fmtDate(quote.documentDate) || formatProjectDate(new Date());

  const drawFooters = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      const footerY = pageHeight - 10;
      doc.setDrawColor(...COLORS.line);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, footerY - 4.5, pageWidth - MARGIN, footerY - 4.5);

      doc.setFont(font, "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.muted);
      doc.text("V3Rİİ WMS", MARGIN, footerY);
      doc.text("Tedarikçi Teklifi", pageWidth / 2, footerY, { align: "center" });
      doc.text(`Sayfa ${i} / ${pageCount}`, pageWidth - MARGIN, footerY, {
        align: "right",
      });

      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.soft);
      doc.text(
        `${quote.documentNo}  |  ${quoteDateLabel}  ·  Bu belge V3Rİİ WMS üzerinden oluşturulmuştur.`,
        pageWidth / 2,
        footerY + 3.5,
        { align: "center" },
      );
    }
  };

  // ─── Header ───────────────────────────────────────────────
  let y = MARGIN;

  if (brandMark) {
    try {
      doc.addImage(brandMark.dataUrl, brandMark.format, MARGIN, y - 1, 8, 8);
    } catch {
      // tipografik markaya düş
    }
  }

  const brandX = brandMark ? MARGIN + 10 : MARGIN;
  doc.setFont(font, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.brand);
  doc.text("V3Rİİ", brandX, y + 2.5);
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text("WMS", brandX, y + 6.5);
  doc.setFont(font, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text("SATIN ALMA / PROCUREMENT", brandX, y + 10.5);

  doc.setFont(font, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text("TEDARİKÇİ TEKLİFİ", pageWidth - MARGIN, y + 2, { align: "right" });
  doc.setFont(font, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text("Teklif No", pageWidth - MARGIN, y + 6.5, { align: "right" });
  doc.setFont(font, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.brand);
  doc.text(quote.documentNo, pageWidth - MARGIN, y + 10.5, { align: "right" });
  doc.setFont(font, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Tarih: ${quoteDateLabel}`, pageWidth - MARGIN, y + 14.5, {
    align: "right",
  });

  y += 18;
  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(0.55);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, y + 1.2, pageWidth - MARGIN, y + 1.2);
  y += 8;

  // ─── Document title ───────────────────────────────────────
  doc.setFont(font, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text("TEDARİKÇİ TEKLİFİ", MARGIN, y);
  y += 5;
  doc.setFont(font, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    "Satın alma talebine bağlı tedarikçi fiyat ve termin teklifi",
    MARGIN,
    y,
  );
  y += 7;

  // ─── Info cards (2×2) ─────────────────────────────────────
  const gap = 4;
  const cardW = (contentWidth - gap) / 2;
  const cardH = 22;

  const supplierLines = [
    clean(quote.counterpartyName) || "—",
    hasText(quote.counterpartyCode)
      ? `Cari: ${clean(quote.counterpartyCode)}`
      : "",
    `Para birimi: ${currency}`,
  ].filter(Boolean);

  const quoteLines = [
    quote.documentNo,
    `Tarih: ${quoteDateLabel}`,
    hasText(quote.dueDate) ? `Geçerlilik: ${fmtDate(quote.dueDate)}` : "",
  ].filter(Boolean);

  drawInfoCard(doc, font, MARGIN, y, cardW, cardH, "TEDARİKÇİ", supplierLines);
  drawInfoCard(
    doc,
    font,
    MARGIN + cardW + gap,
    y,
    cardW,
    cardH,
    "TEKLİF",
    quoteLines,
  );
  y += cardH + gap;

  const requestLines = [
    requestNo || "—",
    requestSubject || "",
  ].filter(Boolean);

  const projectLines = [
    projectCode ? `Proje: ${projectCode}` : "",
    generalDelivery ? `Genel Termin: ${fmtDate(generalDelivery)}` : "",
    hasText(quote.dueDate) && !generalDelivery
      ? `Geçerlilik: ${fmtDate(quote.dueDate)}`
      : "",
  ].filter(Boolean);

  const showProjectCard = projectLines.length > 0;
  if (requestNo || requestSubject) {
    drawInfoCard(
      doc,
      font,
      MARGIN,
      y,
      showProjectCard ? cardW : contentWidth,
      cardH,
      "KAYNAK TALEP",
      requestLines,
    );
    if (showProjectCard) {
      drawInfoCard(
        doc,
        font,
        MARGIN + cardW + gap,
        y,
        cardW,
        cardH,
        "PROJE / TERMİN",
        projectLines,
      );
    }
    y += cardH + 7;
  } else if (showProjectCard) {
    drawInfoCard(
      doc,
      font,
      MARGIN,
      y,
      contentWidth,
      cardH,
      "PROJE / TERMİN",
      projectLines,
    );
    y += cardH + 7;
  }

  // ─── Description ──────────────────────────────────────────
  if (hasText(quote.description)) {
    y = ensureSpace(doc, y, 22, pageHeight);
    y = drawSectionTitle(doc, font, "AÇIKLAMA", y);
    const desc = doc.splitTextToSize(clean(quote.description), contentWidth - 8);
    const boxH = Math.min(28, desc.length * 4 + 6);
    doc.setFillColor(...COLORS.card);
    doc.setDrawColor(...COLORS.cardBorder);
    doc.roundedRect(MARGIN, y, contentWidth, boxH, 1.2, 1.2, "FD");
    doc.setFont(font, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.ink);
    doc.text(desc.slice(0, Math.floor((boxH - 4) / 4)), MARGIN + 3.5, y + 5);
    y += boxH + 7;
  }

  // ─── Lines table ──────────────────────────────────────────
  y = ensureSpace(doc, y, 28, pageHeight);
  y = drawSectionTitle(doc, font, "TEKLİF KALEMLERİ", y);

  const tableBody = quote.lines.map((line, index) => {
    const m = money(line);
    const requestedQty =
      line.sourceRequestLineId != null
        ? requestQtyByLineId.get(line.sourceRequestLineId)
        : undefined;
    return [
      String(index + 1),
      clean(line.stockCode) || "—",
      clean(line.stockName) || "—",
      requestedQty == null ? "—" : fmt(requestedQty),
      fmt(line.quantity),
      clean(line.unitCode) || "—",
      fmtMoney(line.unitPrice, currency),
      fmtDate(line.requiredDate) || "—",
      fmtMoney(m.total, currency),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [
      [
        "#",
        "Stok Kodu",
        "Stok Adı",
        "Talep",
        "Teklif",
        "Birim",
        "Birim Fiyat",
        "Termin",
        "Toplam",
      ],
    ],
    body: tableBody,
    theme: "grid",
    styles: {
      font,
      fontStyle: "normal",
      fontSize: 7.5,
      cellPadding: 1.8,
      overflow: "linebreak",
      textColor: COLORS.ink,
      lineColor: COLORS.line,
      lineWidth: 0.2,
      valign: "middle",
      minCellHeight: 6,
    },
    headStyles: {
      font,
      fontStyle: "bold",
      fillColor: COLORS.head,
      textColor: COLORS.white,
      fontSize: 7,
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: COLORS.altRow },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 20 },
      2: { cellWidth: 38 },
      3: { cellWidth: 16, halign: "right" },
      4: { cellWidth: 16, halign: "right" },
      5: { cellWidth: 12, halign: "center" },
      6: { cellWidth: 24, halign: "right" },
      7: { cellWidth: 20, halign: "center" },
      8: { cellWidth: 29, halign: "right", fontStyle: "bold" },
    },
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + 2, bottom: FOOTER_H + 4 },
    tableWidth: contentWidth,
    showHead: "everyPage",
    rowPageBreak: "avoid",
  });

  y = lastTableY(doc, y) + 6;

  // ─── Totals ───────────────────────────────────────────────
  const totals = quote.lines.reduce(
    (acc, line) => {
      const m = money(line);
      acc.gross += m.gross;
      acc.discount += m.discount;
      acc.net += m.net;
      acc.vat += m.vat;
      acc.total += m.total;
      return acc;
    },
    { gross: 0, discount: 0, net: 0, vat: 0, total: 0 },
  );

  const summaryRows: Array<[string, string, boolean]> = [
    ["Ara Toplam", fmtMoney(totals.gross, currency), false],
  ];
  if (totals.discount > 0) {
    summaryRows.push(["İskonto", fmtMoney(totals.discount, currency), false]);
  }
  if (totals.vat > 0) {
    summaryRows.push(["KDV", fmtMoney(totals.vat, currency), false]);
  }
  summaryRows.push(["GENEL TOPLAM", fmtMoney(totals.total, currency), true]);

  const boxW = 78;
  const boxH = 8 + summaryRows.length * 6 + 4;
  y = ensureSpace(doc, y, boxH + 4, pageHeight);
  const boxX = pageWidth - MARGIN - boxW;

  doc.setFillColor(...COLORS.card);
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, y, boxW, boxH, 1.5, 1.5, "FD");

  let sy = y + 6;
  for (const [label, value, emph] of summaryRows) {
    if (emph) {
      doc.setDrawColor(...COLORS.line);
      doc.setLineWidth(0.35);
      doc.line(boxX + 3, sy - 2.5, boxX + boxW - 3, sy - 2.5);
      doc.setFont(font, "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.brand);
    } else {
      doc.setFont(font, "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.muted);
    }
    doc.text(label, boxX + 4, sy);
    doc.setTextColor(...(emph ? COLORS.brand : COLORS.ink));
    doc.setFont(font, "bold");
    doc.text(value, boxX + boxW - 4, sy, { align: "right" });
    sy += emph ? 7 : 6;
  }
  y += boxH + 8;

  // ─── Conditions ───────────────────────────────────────────
  const conditions: string[] = [];
  if (hasText(quote.dueDate))
    conditions.push(`Teklif geçerlilik tarihi: ${fmtDate(quote.dueDate)}`);
  if (generalDelivery)
    conditions.push(`Genel termin / teslimat: ${fmtDate(generalDelivery)}`);
  if (totals.vat > 0)
    conditions.push(`KDV tutarı teklif satırlarına göre hesaplanmıştır.`);
  else conditions.push(`Bu teklifte KDV tutarı bulunmamaktadır.`);
  if (totals.discount > 0)
    conditions.push(`İskonto satır bazında uygulanmıştır.`);
  conditions.push(`Para birimi: ${currency}`);
  if (hasText(quote.description))
    conditions.push("Ek açıklama belgede AÇIKLAMA bölümünde yer almaktadır.");

  if (conditions.length > 0) {
    y = ensureSpace(doc, y, 18 + conditions.length * 4, pageHeight);
    y = drawSectionTitle(doc, font, "TEKLİF KOŞULLARI", y);
    doc.setFont(font, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.ink);
    for (const item of conditions) {
      y = ensureSpace(doc, y, 6, pageHeight);
      const wrapped = doc.splitTextToSize(`•  ${item}`, contentWidth);
      doc.text(wrapped, MARGIN, y);
      y += wrapped.length * 3.8 + 1.2;
    }
    y += 4;
  }

  // ─── Product images ───────────────────────────────────────
  if (productImages.length > 0) {
    y = ensureSpace(doc, y, 30, pageHeight);
    y = drawSectionTitle(doc, font, "ÜRÜN GÖRSELLERİ", y);

    const colW = (contentWidth - 4) / 2;
    const thumbH = 32;
    let col = 0;
    let rowTop = y;

    for (const img of productImages) {
      if (col === 0) {
        rowTop = ensureSpace(doc, rowTop, thumbH + 14, pageHeight);
      }
      const x = MARGIN + col * (colW + 4);
      doc.setFillColor(...COLORS.card);
      doc.setDrawColor(...COLORS.cardBorder);
      doc.roundedRect(x, rowTop, colW, thumbH + 12, 1.2, 1.2, "FD");

      try {
        const props = doc.getImageProperties(img.dataUrl);
        const ratio = Math.min(
          (colW - 6) / props.width,
          (thumbH - 4) / props.height,
          1,
        );
        const w = props.width * ratio;
        const h = props.height * ratio;
        doc.addImage(
          img.dataUrl,
          img.format,
          x + (colW - w) / 2,
          rowTop + 2,
          w,
          h,
        );
      } catch {
        doc.setFont(font, "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.muted);
        doc.text("Görsel yok", x + colW / 2, rowTop + thumbH / 2, {
          align: "center",
        });
      }

      doc.setFont(font, "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.ink);
      doc.text(clean(img.stockCode) || "—", x + 3, rowTop + thumbH + 4, {
        maxWidth: colW - 6,
      });
      doc.setFont(font, "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.muted);
      doc.text(clean(img.stockName) || img.fileName, x + 3, rowTop + thumbH + 8, {
        maxWidth: colW - 6,
      });

      col += 1;
      if (col >= 2) {
        col = 0;
        rowTop += thumbH + 16;
      }
    }
    y = col === 0 ? rowTop : rowTop + thumbH + 16;
  }

  // ─── Attachments ──────────────────────────────────────────
  const hasAttachments = files.length > 0 || documentImages.length > 0;
  if (hasAttachments) {
    y = ensureSpace(doc, y, 24, pageHeight);
    y = drawSectionTitle(doc, font, "EKLER", y);

    if (files.length > 0) {
      for (const file of files) {
        y = ensureSpace(doc, y, 7, pageHeight);
        const kind = fileTypeLabel(file.contentType, file.fileName);
        const icon = kind === "PDF" ? "[PDF]" : kind === "Görsel" ? "[GÖRSEL]" : "[DOSYA]";
        doc.setFont(font, "bold");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.brand);
        doc.text(icon, MARGIN, y);
        doc.setFont(font, "normal");
        doc.setTextColor(...COLORS.ink);
        doc.text(
          `${file.fileName}  ·  ${file.label}  ·  ${kind}`,
          MARGIN + 16,
          y,
          { maxWidth: contentWidth - 16 },
        );
        y += 5;
      }
      y += 2;
    }

    if (documentImages.length > 0) {
      const maxImgW = contentWidth;
      const maxImgH = 42;
      for (const img of documentImages) {
        y = ensureSpace(doc, y, 18, pageHeight);
        doc.setFont(font, "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.muted);
        doc.text(`${img.label} — ${img.fileName}`, MARGIN, y);
        y += 3.5;
        try {
          const props = doc.getImageProperties(img.dataUrl);
          const ratio = Math.min(
            maxImgW / props.width,
            maxImgH / props.height,
            1,
          );
          const w = props.width * ratio;
          const h = props.height * ratio;
          y = ensureSpace(doc, y, h + 4, pageHeight);
          doc.addImage(img.dataUrl, img.format, MARGIN, y, w, h);
          y += h + 5;
        } catch {
          doc.text("(Önizleme yerleştirilemedi)", MARGIN, y);
          y += 5;
        }
      }
    }
  }

  drawFooters();
  const safeNo = quote.documentNo.replace(/[^\w\-./]+/g, "_");
  downloadBlob(doc.output("blob"), `Teklif_${safeNo}.pdf`);
}
