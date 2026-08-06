import { procurementApi } from "../api";
import type {
  ProcurementAttachment,
  ProcurementDocumentDetail,
  ProcurementDocumentType,
  ProcurementLineDetail,
} from "../types";
import {
  clean,
  createProcurementPdfDoc,
  downloadBlob,
  drawAttachmentsEditorial,
  drawDocumentMetaPanel,
  drawEditorialTable,
  drawFooters,
  drawMasthead,
  drawMetaGrid,
  drawPricingEditorial,
  drawSection,
  ensureSpace,
  fmt,
  fmtDate,
  fmtMoney,
  hasText,
  lastTableY,
  loadAttachments,
  PDF,
  type PdfAttachmentBlock,
  type PdfMetaGroup,
  tryLoadBrandMark,
} from "./procurementPdfKit";

type LineMoney = {
  gross: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
};

const money = (line: ProcurementLineDetail): LineMoney => {
  const gross = line.quantity * line.unitPrice;
  const discount = gross * (line.discountRate / 100);
  const net = gross - discount;
  const vat = net * (line.vatRate / 100);
  return { gross, discount, net, vat, total: net + vat };
};

const DOC: Record<
  ProcurementDocumentType,
  {
    titleLines: string[];
    shortTitle: string;
    filePrefix: string;
    linesCaption: string;
    linesSubtitle: string;
  }
> = {
  request: {
    titleLines: ["SATIN ALMA", "TALEBİ"],
    shortTitle: "SATIN ALMA TALEBİ",
    filePrefix: "Talep",
    linesCaption: "Talep Kalemleri",
    linesSubtitle: "Satın alma kapsamında talep edilen ürünler",
  },
  rfq: {
    titleLines: ["TEKLİF", "TALEBİ"],
    shortTitle: "TEKLİF TALEBİ (RFQ)",
    filePrefix: "RFQ",
    linesCaption: "RFQ Kalemleri",
    linesSubtitle: "Tedarikçilerden fiyat istenen ürünler",
  },
  quote: {
    titleLines: ["TEDARİKÇİ", "TEKLİFİ"],
    shortTitle: "TEDARİKÇİ TEKLİFİ",
    filePrefix: "Teklif",
    linesCaption: "Teklif Kalemleri",
    linesSubtitle: "Fiyat, miktar ve termin bilgileri",
  },
  order: {
    titleLines: ["SATIN ALMA", "SİPARİŞİ"],
    shortTitle: "SATIN ALMA SİPARİŞİ",
    filePrefix: "Siparis",
    linesCaption: "Sipariş Kalemleri",
    linesSubtitle: "Tedarikçiye iletilecek sipariş satırları",
  },
};

type AttachRef = {
  attachment: ProcurementAttachment;
  label: string;
  stockCode?: string;
  stockName?: string;
  kind: "product" | "document";
};

async function buildAttachmentBlocks(
  detail: ProcurementDocumentDetail,
  request?: ProcurementDocumentDetail,
): Promise<PdfAttachmentBlock[]> {
  const blocks: PdfAttachmentBlock[] = [];

  const loadHeader = async (
    heading: string,
    caption: string,
    attachments: ProcurementAttachment[] | undefined,
  ) => {
    const list = attachments ?? [];
    if (!list.length) return;
    const refs: AttachRef[] = list.map((a) => ({
      attachment: a,
      label: heading,
      kind: "document" as const,
    }));
    const { images, files } = await loadAttachments(refs);
    blocks.push({ heading, caption, images, files });
  };

  // Document-level attachments (never mixed with line/stock attachments)
  if (detail.documentType === "request") {
    await loadHeader(
      "Talep Ekleri",
      "Talep seviyesinde eklenen dosyalar",
      detail.attachments,
    );
  } else if (detail.documentType === "rfq") {
    await loadHeader(
      "RFQ Ekleri",
      "RFQ seviyesinde eklenen dosyalar",
      detail.attachments,
    );
    if (request) {
      await loadHeader(
        "Talep Ekleri",
        "Kaynak talebe eklenen dosyalar",
        request.attachments,
      );
    }
  } else if (detail.documentType === "quote") {
    await loadHeader(
      "Teklif Ekleri",
      "Teklif seviyesinde eklenen dosyalar",
      detail.attachments,
    );
    if (request) {
      await loadHeader(
        "Talep Ekleri",
        "Kaynak talebe eklenen dosyalar",
        request.attachments,
      );
    }
  } else if (detail.documentType === "order") {
    await loadHeader(
      "Sipariş Ekleri",
      "Sipariş seviyesinde eklenen dosyalar",
      detail.attachments,
    );
    if (request) {
      await loadHeader(
        "Talep Ekleri",
        "Kaynak talebe eklenen dosyalar",
        request.attachments,
      );
    }
  } else {
    await loadHeader(
      "Belge Ekleri",
      "Belge seviyesinde eklenen dosyalar",
      detail.attachments,
    );
  }

  // Line / stock attachments — grouped per line, never mixed into header list
  const lineSources: Array<{
    sourceLabel: string;
    lines: ProcurementDocumentDetail["lines"];
  }> = [{ sourceLabel: "", lines: detail.lines }];
  // Quote PDF: also surface request-line photos that never moved onto the quote
  if (request && detail.documentType === "quote") {
    lineSources.push({ sourceLabel: "Talep · ", lines: request.lines });
  }

  for (const source of lineSources) {
    for (let i = 0; i < source.lines.length; i += 1) {
      const line = source.lines[i]!;
      const lineAtts = line.attachments ?? [];
      if (!lineAtts.length) continue;
      const refs: AttachRef[] = lineAtts.map((a) => ({
        attachment: a,
        label: "Satır eki",
        stockCode: line.stockCode,
        stockName: line.stockName,
        kind: "product" as const,
      }));
      const { images, files } = await loadAttachments(refs);
      const stockBit = [clean(line.stockCode), clean(line.stockName)]
        .filter(Boolean)
        .join(" — ");
      blocks.push({
        heading: `${source.sourceLabel}Satır ${String(i + 1).padStart(2, "0")}`,
        subheading: stockBit || `Kalem ${i + 1}`,
        caption: "Bu satıra ait ekler",
        images,
        files,
      });
    }
  }

  return blocks;
}

function docNoLabel(type: ProcurementDocumentType) {
  if (type === "request") return "Talep No";
  if (type === "rfq") return "RFQ No";
  if (type === "quote") return "Teklif No";
  return "Sipariş No";
}

function metaSectionCopy(type: ProcurementDocumentType) {
  if (type === "request")
    return {
      title: "Talep Bilgileri",
      subtitle: "Talep ve süreç detayları",
    };
  if (type === "rfq")
    return {
      title: "RFQ Bilgileri",
      subtitle: "Teklif turu ve süreç detayları",
    };
  if (type === "quote")
    return {
      title: "Teklif Bilgileri",
      subtitle: "Teklif kimliği ve geçerlilik",
    };
  return {
    title: "Sipariş Bilgileri",
    subtitle: "Sipariş kimliği ve kaynak bilgiler",
  };
}

/** Structured metadata groups — only real fields, no empty placeholders. */
function metaGroupsFor(detail: ProcurementDocumentDetail): PdfMetaGroup[] {
  const type = detail.documentType;
  const project = detail.lines.find((l) => hasText(l.projectCode))?.projectCode;
  const dueLabel =
    type === "rfq" || type === "quote" ? "Geçerlilik" : "Termin";

  const identity: PdfMetaGroup = {
    title: "Belge",
    fields: [
      {
        label: docNoLabel(type),
        value: detail.documentNo,
        emphasize: true,
      },
      { label: "Durum", status: detail.status },
    ],
  };

  const timing: PdfMetaGroup = {
    title: "Tarihler",
    fields: [
      {
        label: "Belge Tarihi",
        value: fmtDate(detail.documentDate),
      },
      ...(hasText(detail.dueDate)
        ? [{ label: dueLabel, value: fmtDate(detail.dueDate) }]
        : []),
    ],
  };

  const context: PdfMetaGroup = {
    title: type === "request" ? "Talep" : "Bağlam",
    fields: [
      ...(hasText(detail.subject)
        ? [{ label: "Konu", value: clean(detail.subject), span: 2 as const }]
        : []),
      ...(hasText(detail.requestNo)
        ? [{ label: "Kaynak Talep", value: clean(detail.requestNo) }]
        : []),
      ...(hasText(project) ? [{ label: "Proje", value: clean(project) }] : []),
      ...(hasText(detail.currencyCode) &&
      (type === "quote" || type === "order" || type === "rfq")
        ? [{ label: "Para Birimi", value: detail.currencyCode }]
        : []),
      ...(detail.exchangeRate && detail.exchangeRate !== 1
        ? [{ label: "Kur", value: fmt(detail.exchangeRate) }]
        : []),
      ...(detail.suppliers?.length && type === "rfq"
        ? [
            {
              label: "Tedarikçiler",
              value: detail.suppliers
                .map((s) => clean(s.supplierName) || clean(s.supplierCode))
                .filter(Boolean)
                .join(", "),
              span: 2 as const,
            },
          ]
        : []),
      { label: "Kalem Sayısı", value: String(detail.lines.length) },
    ],
  };

  return [identity, timing, context].filter((g) => g.fields.length > 0);
}

function supplierMetaGroups(detail: ProcurementDocumentDetail): PdfMetaGroup[] {
  return [
    {
      fields: [
        ...(hasText(detail.counterpartyCode)
          ? [
              {
                label: "Cari Kodu",
                value: clean(detail.counterpartyCode),
                emphasize: true,
              },
            ]
          : []),
        ...(hasText(detail.counterpartyName)
          ? [
              {
                label: "Tedarikçi",
                value: clean(detail.counterpartyName),
                span: hasText(detail.counterpartyCode) ? (1 as const) : (2 as const),
              },
            ]
          : []),
      ],
    },
  ];
}

function buildTable(
  detail: ProcurementDocumentDetail,
  requestQtyByLineId?: Map<number, number>,
) {
  const currency = detail.currencyCode || "TRY";

  if (detail.documentType === "quote") {
    return {
      withMoney: true as const,
      head: [
        [
          "#",
          "Stok Kodu",
          "Ürün / Açıklama",
          "Talep",
          "Teklif",
          "Birim Fiyat",
          "Termin",
          "Tutar",
        ],
      ],
      body: detail.lines.map((line, i) => {
        const m = money(line);
        const requestedQty =
          line.sourceRequestLineId != null
            ? requestQtyByLineId?.get(line.sourceRequestLineId)
            : undefined;
        return [
          String(i + 1).padStart(2, "0"),
          clean(line.stockCode) || "—",
          clean(line.stockName) || "—",
          requestedQty == null ? "—" : fmt(requestedQty),
          `${fmt(line.quantity)} ${clean(line.unitCode)}`.trim(),
          fmtMoney(line.unitPrice, currency),
          fmtDate(line.requiredDate) || "—",
          fmtMoney(m.total, currency),
        ];
      }),
      columnStyles: {
        0: { cellWidth: 8, halign: "left" as const },
        1: { cellWidth: 22, fontStyle: "normal" as const },
        2: { cellWidth: 42, fontStyle: "bold" as const },
        3: { cellWidth: 16, halign: "right" as const },
        4: { cellWidth: 20, halign: "right" as const },
        5: { cellWidth: 24, halign: "right" as const },
        6: { cellWidth: 20, halign: "right" as const },
        7: { cellWidth: 26, halign: "right" as const, fontStyle: "bold" as const },
      },
    };
  }

  if (detail.documentType === "order") {
    return {
      withMoney: true as const,
      head: [
        [
          "#",
          "Stok Kodu",
          "Ürün / Açıklama",
          "Miktar",
          "Birim Fiyat",
          "Termin",
          "Tutar",
        ],
      ],
      body: detail.lines.map((line, i) => {
        const m = money(line);
        return [
          String(i + 1).padStart(2, "0"),
          clean(line.stockCode) || "—",
          clean(line.stockName) || "—",
          `${fmt(line.quantity)} ${clean(line.unitCode)}`.trim(),
          fmtMoney(line.unitPrice, currency),
          fmtDate(line.requiredDate) || "—",
          fmtMoney(m.total, currency),
        ];
      }),
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 24 },
        2: { cellWidth: 52, fontStyle: "bold" as const },
        3: { cellWidth: 22, halign: "right" as const },
        4: { cellWidth: 26, halign: "right" as const },
        5: { cellWidth: 22, halign: "right" as const },
        6: { cellWidth: 28, halign: "right" as const, fontStyle: "bold" as const },
      },
    };
  }

  return {
    withMoney: false as const,
    head: [["#", "Stok Kodu", "Ürün / Açıklama", "Miktar", "Birim", "Termin"]],
    body: detail.lines.map((line, i) => [
      String(i + 1).padStart(2, "0"),
      clean(line.stockCode) || "—",
      clean(line.stockName) || "—",
      fmt(line.quantity),
      clean(line.unitCode) || "—",
      fmtDate(line.requiredDate) || "—",
    ]),
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 28 },
      2: { cellWidth: 78, fontStyle: "bold" as const },
      3: { cellWidth: 22, halign: "right" as const },
      4: { cellWidth: 18, halign: "right" as const },
      5: { cellWidth: 26, halign: "right" as const },
    },
  };
}

/**
 * Kurumsal editorial satın alma PDF'i.
 * Talep / RFQ / Teklif / Sipariş — aynı tasarım ailesi.
 */
export async function generateProcurementPdf(
  type: ProcurementDocumentType,
  id: number,
): Promise<void> {
  const detail = await procurementApi.detail(type, id);
  if (detail.documentType !== type) {
    throw new Error("Belge türü uyuşmuyor.");
  }

  const requestQtyByLineId = new Map<number, number>();
  let request: ProcurementDocumentDetail | undefined;
  if (detail.requestId && type !== "request") {
    try {
      request = await procurementApi.detail("request", detail.requestId);
      for (const line of request.lines) {
        requestQtyByLineId.set(line.id, line.quantity);
      }
    } catch {
      request = undefined;
    }
  }

  const [attachmentBlocks, brandMark, ctx] = await Promise.all([
    buildAttachmentBlocks(detail, request),
    tryLoadBrandMark(),
    createProcurementPdfDoc(),
  ]);

  const { doc, font, autoTable, pageWidth, pageHeight, contentWidth } = ctx;
  const meta = DOC[type];
  const currency = detail.currencyCode || "TRY";

  let y = drawMasthead(doc, font, {
    pageWidth,
    brandMark,
    titleLines: meta.titleLines,
    documentNo: detail.documentNo,
    documentDate: detail.documentDate,
  });

  let section = 1;
  const idx = () => String(section++).padStart(2, "0");

  const metaCopy = metaSectionCopy(type);
  y = drawSection(doc, font, {
    index: idx(),
    title: metaCopy.title,
    subtitle: metaCopy.subtitle,
    y,
    pageHeight,
  });
  y = drawDocumentMetaPanel(
    doc,
    font,
    metaGroupsFor(detail),
    y,
    pageWidth,
    pageHeight,
  );

  if (
    (type === "quote" || type === "order") &&
    (hasText(detail.counterpartyName) || hasText(detail.counterpartyCode))
  ) {
    y = drawSection(doc, font, {
      index: idx(),
      title: "Tedarikçi",
      subtitle: "Teklif / sipariş karşı tarafı",
      y,
      pageHeight,
    });
    y = drawDocumentMetaPanel(
      doc,
      font,
      supplierMetaGroups(detail),
      y,
      pageWidth,
      pageHeight,
    );
  }

  // 03 Kalemler → 04 Fiyatlandırma (ekler araya giremez)
  y = drawSection(doc, font, {
    index: idx(),
    title: meta.linesCaption,
    subtitle: meta.linesSubtitle,
    y,
    pageHeight,
  });

  const table = buildTable(detail, requestQtyByLineId);
  drawEditorialTable(doc, autoTable, font, {
    startY: y,
    head: table.head,
    body: table.body,
    contentWidth,
    columnStyles: table.columnStyles as Record<number, object>,
    pageWidth,
    pageHeight,
    continuation: {
      title: meta.shortTitle,
      documentNo: detail.documentNo,
    },
  });
  y = lastTableY(doc, y) + 10;

  if (table.withMoney) {
    const totals = detail.lines.reduce(
      (acc, line) => {
        const m = money(line);
        acc.gross += m.gross;
        acc.discount += m.discount;
        acc.vat += m.vat;
        acc.total += m.total;
        return acc;
      },
      { gross: 0, discount: 0, vat: 0, total: 0 },
    );

    const rows: Array<{ label: string; value: string; emphasize?: boolean }> = [
      { label: "Ara Toplam", value: fmtMoney(totals.gross, currency) },
    ];
    if (totals.discount > 0)
      rows.push({
        label: "İskonto",
        value: fmtMoney(totals.discount, currency),
      });
    if (totals.vat > 0)
      rows.push({ label: "KDV", value: fmtMoney(totals.vat, currency) });
    rows.push({
      label: "Genel Toplam",
      value: fmtMoney(totals.total, currency),
      emphasize: true,
    });
    y = drawPricingEditorial(doc, font, {
      index: idx(),
      title: "Fiyatlandırma",
      subtitle: "Satır tutarlarından hesaplanan özet",
      rows,
      y,
      pageWidth,
      pageHeight,
    });
  } else {
    const totalQty = detail.lines.reduce((s, l) => s + (l.quantity || 0), 0);
    y = drawSection(doc, font, {
      index: idx(),
      title: "Özet",
      y,
      pageHeight,
    });
    y = drawMetaGrid(
      doc,
      font,
      [
        { label: "Toplam Kalem", value: String(detail.lines.length) },
        { label: "Toplam Miktar", value: fmt(totalQty) },
      ],
      y,
      pageWidth,
      3,
    );
  }

  // 05 Notlar — fiyatlandırmadan sonra, eklerden önce
  if (hasText(detail.description)) {
    y = drawSection(doc, font, {
      index: idx(),
      title: "Notlar / Açıklamalar",
      y,
      pageHeight,
    });
    const desc = doc.splitTextToSize(clean(detail.description), contentWidth);
    doc.setFont(font, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF.colors.inkSoft);
    y = ensureSpace(doc, y, desc.length * 4.2 + 4, pageHeight);
    doc.text(desc, PDF.margin, y);
    y += desc.length * 4.2 + 6;
  }

  // 06 Ekler — her zaman en sonda; talep / satır ayrımı korunur
  if (attachmentBlocks.some((b) => b.images.length || b.files.length)) {
    drawAttachmentsEditorial(
      doc,
      font,
      y,
      pageWidth,
      pageHeight,
      contentWidth,
      idx(),
      attachmentBlocks,
      {
        title: meta.shortTitle,
        documentNo: detail.documentNo,
      },
    );
  }

  drawFooters(doc, font, {
    pageWidth,
    pageHeight,
    documentNo: detail.documentNo,
    documentLabel: meta.shortTitle,
  });

  const safeNo = detail.documentNo.replace(/[^\w\-./]+/g, "_");
  downloadBlob(doc.output("blob"), `${meta.filePrefix}_${safeNo}.pdf`);
}
