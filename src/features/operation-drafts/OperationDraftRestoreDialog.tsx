import { RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { getLocaleForFormatting } from '@/lib/i18n';

interface Props {
  open: boolean;
  operationName: string;
  updatedAt?: string | null;
  onRestore: () => void;
  onDiscard: () => void | Promise<void>;
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

export function OperationDraftRestoreDialog({
  open,
  operationName,
  updatedAt,
  onRestore,
  onDiscard,
}: Props) {
  const { t, i18n } = useTranslation('common');
  if (!open) return null;
  const formattedDate = formatDate(updatedAt, getLocaleForFormatting(i18n.language));
  return (
    <ResponsiveDialog
      title={t('operationDraftRestore.title')}
      description={t('operationDraftRestore.description', { operationName })}
      onClose={() => undefined}
      showCloseButton={false}
      className="!max-w-lg"
    >
      {formattedDate ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium">
          {t('operationDraftRestore.lastAutoSave', { date: formattedDate })}
        </div>
      ) : null}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <OpsActionButton type="button" variant="secondary" onClick={() => void onDiscard()}>
          <Trash2 className="size-4" />
          {t('operationDraftRestore.discard')}
        </OpsActionButton>
        <OpsActionButton type="button" variant="primary" onClick={onRestore}>
          <RotateCcw className="size-4" />
          {t('operationDraftRestore.restore')}
        </OpsActionButton>
      </div>
    </ResponsiveDialog>
  );
}
