import {
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyableDataCellValueProps {
  label: string;
  value: string | number | null | undefined;
  children?: ReactNode;
  className?: string;
}

interface MenuPosition {
  x: number;
  y: number;
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Some browsers expose Clipboard API but deny it outside a secure context.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard unavailable');
}

export function CopyableDataCellValue({
  label,
  value,
  children,
  className,
}: CopyableDataCellValueProps): ReactElement {
  const { t } = useTranslation('common');
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const copyValue = value == null ? '' : String(value).trim();
  const canCopy = copyValue.length > 0;

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  const openMenu = (event: ReactMouseEvent<HTMLSpanElement>) => {
    if (!canCopy) return;
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 320;
    const menuHeight = 175;
    setMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };

  const copy = async () => {
    try {
      await copyText(copyValue);
      toast.success(t('dataGrid.cellCopied'));
      setMenu(null);
    } catch {
      toast.error(t('dataGrid.cellCopyFailed'));
    }
  };

  return (
    <>
      <span
        className={cn('block min-w-0', canCopy && 'cursor-context-menu', className)}
        onContextMenu={openMenu}
        title={canCopy ? copyValue : undefined}
      >
        {children ?? copyValue}
      </span>

      {menu && createPortal(
        <>
          <div
            className="pointer-events-auto fixed inset-0 z-[12050]"
            aria-hidden
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMenu(null);
            }}
          />
          <div
            role="menu"
            aria-label={t('dataGrid.cellMenu')}
            style={{ left: menu.x, top: menu.y }}
            className="pointer-events-auto fixed z-[12060] w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-2 text-sm shadow-2xl"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="rounded-xl bg-[var(--wms-app-panel-muted)] px-3 py-2.5">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--wms-app-text-muted)]">
                {t('dataGrid.selectedCell')}
              </span>
              <strong className="mt-1 block truncate">{label}</strong>
              <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-[var(--wms-app-text-muted)]">
                {copyValue}
              </p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => void copy()}
              className="mt-2 inline-flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-medium hover:bg-[var(--wms-brand-soft)]"
            >
              <Copy className="size-4 text-[var(--wms-brand-primary)]" aria-hidden />
              {t('dataGrid.copyCell')}
            </button>
          </div>
        </>,
        // Dialogs portal to document.body (z-50); workspace portal sits under them.
        document.body,
      )}
    </>
  );
}
