import { resolveAppPath } from '@/lib/api-config';
import type { jsPDF } from 'jspdf';

const PDF_FONT = {
  path: '/fonts/arial.ttf',
  vfsName: 'GridExportArial.ttf',
  fontName: 'GridExportArial',
} as const;

export async function registerPdfExportFont(doc: jsPDF): Promise<string> {
  try {
    const response = await fetch(resolveAppPath(PDF_FONT.path), { cache: 'force-cache' });
    if (response.ok) {
      const fontBytes = await response.arrayBuffer();
      const fontBinary = Array.from(new Uint8Array(fontBytes), (byte) => String.fromCharCode(byte)).join('');
      doc.addFileToVFS(PDF_FONT.vfsName, fontBinary);
      doc.addFont(PDF_FONT.vfsName, PDF_FONT.fontName, 'normal');
      doc.addFont(PDF_FONT.vfsName, PDF_FONT.fontName, 'bold');
      doc.setFont(PDF_FONT.fontName, 'normal');
      return PDF_FONT.fontName;
    }
  } catch {
    // The built-in font still allows export if the custom font cannot be loaded.
  }

  doc.setFont('helvetica', 'normal');
  return 'helvetica';
}
