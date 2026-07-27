import { registerPdfExportFont } from './pdf-export-font';

export interface GridExportColumn {
  key: string;
  label: string;
}

type GridExportRow = Record<string, unknown>;

interface GridExportParams {
  fileName: string;
  columns: GridExportColumn[];
  rows: GridExportRow[];
}

type XlsxModule = {
  utils: {
    json_to_sheet: (rows: Record<string, string | number>[]) => unknown;
    book_new: () => unknown;
    book_append_sheet: (workbook: unknown, worksheet: unknown, sheetName: string) => void;
  };
  writeFile: (workbook: unknown, fileName: string) => void;
};

const normalizeCellValue = (value: unknown): string | number => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  return String(value);
};

const mapRowsForExport = (columns: GridExportColumn[], rows: GridExportRow[]): Record<string, string | number>[] => {
  return rows.map((row) => {
    const mapped: Record<string, string | number> = {};
    columns.forEach((column) => {
      mapped[column.label] = normalizeCellValue(row[column.key]);
    });
    return mapped;
  });
};

const downloadBlob = (blob: Blob, fileName: string): void => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const fallbackExportExcel = (params: GridExportParams): void => {
  const { fileName, columns, rows } = params;
  const headers = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${escapeHtml(String(normalizeCellValue(row[column.key])))}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadBlob(blob, `${fileName}.xls`);
};

export async function exportGridToExcel(params: GridExportParams): Promise<void> {
  const exportRows = mapRowsForExport(params.columns, params.rows);
  try {
    const XLSX = await import('xlsx') as XlsxModule;
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${params.fileName}.xlsx`);
  } catch {
    fallbackExportExcel(params);
  }
}

export async function exportGridToPdf(params: GridExportParams): Promise<void> {
  const exportRows = mapRowsForExport(params.columns, params.rows);
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pdfFont = await registerPdfExportFont(doc);
  const head = [params.columns.map((column) => column.label)];
  const body = exportRows.map((row) => params.columns.map((column) => row[column.label] ?? ''));

  autoTable(doc, {
    head,
    body,
    theme: 'grid',
    styles: {
      font: pdfFont,
      fontStyle: 'normal',
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      lineColor: [180, 188, 200],
      lineWidth: 0.35,
    },
    headStyles: {
      font: pdfFont,
      fontStyle: 'bold',
      fillColor: [27, 39, 66],
      textColor: 255,
    },
    margin: { top: 24, left: 12, right: 12 },
    tableWidth: 'auto',
  });

  downloadBlob(doc.output('blob'), `${params.fileName}.pdf`);
}
