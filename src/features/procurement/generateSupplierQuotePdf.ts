import { generateProcurementPdf } from "./pdf/generateProcurementPdf";

/**
 * Tedarikçi teklifi PDF'i — ortak satın alma belge tasarım sistemini kullanır.
 * Dosya adı: Teklif_{QuoteNo}.pdf
 */
export async function generateSupplierQuotePdf(quoteId: number): Promise<void> {
  await generateProcurementPdf("quote", quoteId);
}
