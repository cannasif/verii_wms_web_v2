import { type ReactElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { OpsActionButton } from './OpsActionButton';
import { exportGridToExcel, exportGridToPdf, type GridExportColumn } from '@/lib/grid-export';
import { cn } from '@/lib/utils';

interface GridExportMenuProps {
  fileName: string;
  columns: GridExportColumn[];
  rows: Record<string, unknown>[];
  getExportData?: () => Promise<{ columns: GridExportColumn[]; rows: Record<string, unknown>[] }>;
}

export function GridExportMenu({ fileName, columns, rows, getExportData }: GridExportMenuProps): ReactElement {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);

  const resolveExportPayload = async (): Promise<{ columns: GridExportColumn[]; rows: Record<string, unknown>[] }> => {
    if (getExportData) return getExportData();
    return { columns, rows };
  };

  const handleExcelExport = async (): Promise<void> => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const payload = await resolveExportPayload();
      await exportGridToExcel({ fileName, columns: payload.columns, rows: payload.rows });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePdfExport = async (): Promise<void> => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const payload = await resolveExportPayload();
      await exportGridToPdf({ fileName, columns: payload.columns, rows: payload.rows });
    } finally {
      setIsExporting(false);
    }
  };

  const disabled = isExporting || (!getExportData && rows.length === 0);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <OpsActionButton type="button" variant="secondary" className="wms-ops-list-toolbar-btn wms-ops-grid-export-trigger">
          <Download className="size-3.5" aria-hidden />
          {t('common.export')}
        </OpsActionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn('wms-ops-list-dropdown w-52 min-w-[11rem]')}>
        <DropdownMenuItem onClick={() => void handleExcelExport()} disabled={disabled} className="cursor-pointer">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {t('common.exportExcel')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handlePdfExport()} disabled={disabled} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4" />
          {t('common.exportPdf')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
