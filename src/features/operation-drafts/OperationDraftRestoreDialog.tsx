import { RotateCcw, Trash2 } from 'lucide-react';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';

interface Props {
  open: boolean;
  operationName: string;
  updatedAt?: string | null;
  onRestore: () => void;
  onDiscard: () => void | Promise<void>;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('tr-TR', {
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
  if (!open) return null;
  const formattedDate = formatDate(updatedAt);
  return (
    <ResponsiveDialog
      title="Yarım kalan işleminiz var"
      description={`Bu kullanıcı ve şube için kaydedilmemiş bir ${operationName} taslağı bulundu.`}
      onClose={() => undefined}
      showCloseButton={false}
      className="!max-w-lg"
    >
      {formattedDate ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium">
          Son otomatik kayıt: {formattedDate}
        </div>
      ) : null}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <OpsActionButton type="button" variant="secondary" onClick={() => void onDiscard()}>
          <Trash2 className="size-4" />
          Sil ve yeni başla
        </OpsActionButton>
        <OpsActionButton type="button" variant="primary" onClick={onRestore}>
          <RotateCcw className="size-4" />
          Taslağı yükle
        </OpsActionButton>
      </div>
    </ResponsiveDialog>
  );
}
