import { type ReactElement, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, MoreHorizontal } from 'lucide-react';
import { OpsActionButton } from './OpsActionButton';
import { exportGridToExcel, exportGridToPdf, type GridExportColumn } from '@/lib/grid-export';
import { cn } from '@/lib/utils';

/** Ops buton CSS'i ikonların display'ini ezdiği için görünürlük utility yerine JS ile çözülür. */
function useCompactViewport(enabled: boolean): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const query = window.matchMedia('(max-width: 767px)');
    const sync = (): void => setCompact(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [enabled]);

  return enabled && compact;
}

interface GridExportMenuProps {
  fileName: string;
  columns: GridExportColumn[];
  rows: Record<string, unknown>[];
  getExportData?: () => Promise<{ columns: GridExportColumn[]; rows: Record<string, unknown>[] }>;
  /** Dar ekranda metin yerine üç noktalı kompakt tetikleyici gösterir. */
  compactMobile?: boolean;
  /** Dialog içinden kullanırken menünün dialog arkasında kalmaması için portal hedefi. */
  portalContainer?: HTMLElement | null;
}

export function GridExportMenu({
  fileName,
  columns,
  rows,
  getExportData,
  compactMobile = false,
  portalContainer,
}: GridExportMenuProps): ReactElement {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const compact = useCompactViewport(compactMobile);

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
          {compact ? (
            <MoreHorizontal className="size-4" aria-label={t('common.export')} />
          ) : (
            <>
              <Download className="size-3.5" aria-hidden />
              <span className={compactMobile ? undefined : 'hidden md:inline'}>{t('common.export')}</span>
            </>
          )}
        </OpsActionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        container={portalContainer}
        className={cn('wms-ops-list-dropdown w-52 min-w-[11rem]')}
      >
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
