import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OpsActionButton } from './OpsActionButton';
import { cn } from '@/lib/utils';

type DeleteConfirmDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  itemLabel?: string | null;
  confirmLabel?: string;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

/**
 * v1-parity destructive confirm dialog (ops delete DNA + built-in close).
 */
export function DeleteConfirmDialog({
  open,
  title,
  description,
  itemLabel,
  confirmLabel,
  isPending = false,
  onOpenChange,
  onConfirm,
}: DeleteConfirmDialogProps): ReactElement {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('common.deleteConfirmTitle', { defaultValue: 'Kaydı sil' });
  const resolvedLabel = itemLabel ?? t('common.selected', { defaultValue: 'seçili' });
  const resolvedConfirm = confirmLabel ?? t('common.delete', { defaultValue: 'Sil' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        portalRoot="body"
        tone="ops"
        className={cn(
          'wms-ops-form wms-ops-detail-dialog wms-ops-delete-dialog max-w-md gap-0 overflow-hidden border-0 p-0 shadow-none',
        )}
      >
        <DialogHeader className="wms-ops-delete-dialog__header wms-ops-detail-dialog__header relative border-b px-6 py-4 pr-14 text-left">
          <DialogTitle className="wms-ops-detail-dialog__title wms-ops-delete-dialog__title min-w-0 pr-2">
            {resolvedTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="wms-ops-delete-dialog__body px-6 py-5">
          {description ? (
            <p className="wms-ops-delete-dialog__message">{description}</p>
          ) : (
            <p className="wms-ops-delete-dialog__message">
              <span className="wms-ops-subtitle-prefix" aria-hidden>
                {'> '}
              </span>
              <span className="wms-ops-delete-dialog__target">{resolvedLabel}</span>
              <span className="wms-ops-delete-dialog__suffix">
                {t('common.deleteConfirmSuffix', {
                  defaultValue: 'kaydını silmek istediğine emin misin? Bu işlem geri alınamaz.',
                })}
              </span>
            </p>
          )}
        </div>

        <DialogFooter className="wms-ops-delete-dialog__footer gap-2 border-t px-6 py-4 sm:justify-end sm:gap-2">
          <OpsActionButton
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('common.cancel', { defaultValue: 'Vazgeç' })}
          </OpsActionButton>
          <button
            type="button"
            className="wms-ops-action-btn wms-ops-delete-btn"
            onClick={() => void onConfirm()}
            disabled={isPending}
          >
            <span className="wms-ops-delete-btn__label">
              {isPending ? t('common.processing', { defaultValue: 'İşleniyor…' }) : resolvedConfirm}
            </span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
