import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { Copy, PackageSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useOptionalStockCard } from '@/features/erp-mirror/components/StockCardProvider';
import type { StockIdentityRef } from '@/features/erp-mirror/resolve-stock-mirror';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

type Props = StockIdentityRef & {
  className?: string;
  nameClassName?: string;
  /** stacked = code above name; inline = "code · name"; name/code = single line */
  layout?: 'stacked' | 'inline' | 'name' | 'code';
  emptyLabel?: string;
};

type MenuState = { x: number; y: number };

export function StockIdentityCell({
  stockId,
  stockCode,
  stockName,
  branchCode,
  className,
  nameClassName,
  layout = 'stacked',
  emptyLabel = '—',
}: Props): ReactElement {
  const { t } = useTranslation('common');
  const stockCard = useOptionalStockCard();
  const sessionBranch = useAuthStore((state) => state.branch?.code ?? null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const code = stockCode?.trim() || '';
  const name = stockName?.trim() || '';
  const resolvedBranch = branchCode?.trim() || sessionBranch || null;
  const canOpen = Boolean(stockCard) && (Boolean(stockId && stockId > 0) || Boolean(code));

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  const openMenu = (event: ReactMouseEvent) => {
    if (!canOpen) return;
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 260;
    const menuHeight = 160;
    setMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t('stockCard.codeCopied'));
    } catch {
      toast.error(t('stockCard.codeCopyFailed'));
    }
    setMenu(null);
  };

  const openDetail = () => {
    setMenu(null);
    void stockCard?.openStockCard({ stockId, stockCode: code || null, stockName: name || null, branchCode: resolvedBranch });
  };

  const body = !code && !name ? (
    <span className="text-[var(--wms-app-text-muted)]">{emptyLabel}</span>
  ) : layout === 'name' ? (
    <strong className={nameClassName}>{name || code || emptyLabel}</strong>
  ) : layout === 'code' ? (
    <strong className="font-mono">{code || emptyLabel}</strong>
  ) : layout === 'inline' ? (
    <span>
      <strong>{code || emptyLabel}</strong>
      {name ? <span className={cn('text-[var(--wms-app-text-muted)]', nameClassName)}> · {name}</span> : null}
    </span>
  ) : (
    <>
      <strong>{code || emptyLabel}</strong>
      {name ? (
        <div className={cn('text-xs text-slate-500', nameClassName)}>{name}</div>
      ) : null}
    </>
  );

  return (
    <>
      <div
        className={cn(
          canOpen && 'cursor-context-menu rounded-md outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--wms-ops-accent)]',
          className,
        )}
        onContextMenu={openMenu}
        title={canOpen ? t('stockCard.contextHint') : undefined}
      >
        {body}
      </div>
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
            ref={menuRef}
            role="menu"
            aria-label={t('stockCard.menuLabel')}
            style={{ left: menu.x, top: menu.y }}
            className="wms-ops-stock-ctx pointer-events-auto fixed z-[12060] w-64 max-w-[calc(100vw-1rem)]"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="wms-ops-stock-ctx__header">
              <div className="wms-ops-stock-ctx__title-row">
                <span className="wms-ops-stock-ctx__prompt" aria-hidden>
                  {'> '}
                </span>
                <span className="wms-ops-stock-ctx__label">{t('stockCard.menuLabel')}</span>
              </div>
              <strong className="wms-ops-stock-ctx__code">{code || emptyLabel}</strong>
              {name ? <p className="wms-ops-stock-ctx__name">{name}</p> : null}
            </div>
            <div className="wms-ops-stock-ctx__actions">
              <button
                type="button"
                role="menuitem"
                onClick={openDetail}
                className="wms-ops-stock-ctx__item"
              >
                <PackageSearch className="wms-ops-stock-ctx__icon" aria-hidden />
                <span>{t('stockCard.openDetail')}</span>
              </button>
              {code ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void copyCode()}
                  className="wms-ops-stock-ctx__item"
                >
                  <Copy className="wms-ops-stock-ctx__icon" aria-hidden />
                  <span>{t('stockCard.copyCode')}</span>
                </button>
              ) : null}
            </div>
          </div>
        </>,
        // Dialogs portal to document.body (z-50); workspace portal sits under them.
        document.body,
      )}
    </>
  );
}
