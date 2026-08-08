import { type ReactElement, useState } from 'react';
import type { TFunction } from 'i18next';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { WarehouseAssistantChatResponse } from '../types/warehouse-assistant.types';
import { exportWarehouseAssistantToExcel, exportWarehouseAssistantToPdf } from '../utils/warehouse-assistant-export';

interface WarehouseAssistantExportMenuProps {
  result: WarehouseAssistantChatResponse;
  question: string;
  language: string;
  t: TFunction;
}

export function WarehouseAssistantExportMenu({ result, question, language, t }: WarehouseAssistantExportMenuProps): ReactElement {
  const [isExporting, setIsExporting] = useState<'excel' | 'pdf' | null>(null);

  const runExport = async (format: 'excel' | 'pdf'): Promise<void> => {
    if (isExporting) return;
    setIsExporting(format);
    try {
      const params = { result, question, language, t };
      if (format === 'excel') await exportWarehouseAssistantToExcel(params);
      else await exportWarehouseAssistantToPdf(params);
      toast.success(t(format === 'excel' ? 'export.successExcel' : 'export.successPdf'));
    } catch {
      toast.error(t('export.error'));
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isExporting !== null}
          aria-label={t('export.action')}
          title={t('export.action')}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-800 transition hover:bg-cyan-500/15 disabled:cursor-wait disabled:opacity-60 dark:text-cyan-200"
        >
          {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          {t('export.action')}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled={isExporting !== null} onClick={() => void runExport('excel')} className="cursor-pointer">
          <FileSpreadsheet className="mr-2 size-4 text-emerald-600" />
          {t('export.excel')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isExporting !== null} onClick={() => void runExport('pdf')} className="cursor-pointer">
          <FileText className="mr-2 size-4 text-rose-600" />
          {t('export.pdf')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
