import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  resolveStockImageUrl,
  stockImagesApi,
  type StockImage,
} from '../api/stock-images.api';

type Props = {
  stockId: number;
  stockName?: string | null;
  className?: string;
  tabIndex?: number;
  /** Tıklanınca lightbox yerine bu callback açılır (görüntüle + yükle popup). */
  onOpen?: () => void;
  canUpload?: boolean;
};

function pickPrimaryImage(images: StockImage[] | undefined): StockImage | null {
  if (!images || images.length === 0) return null;
  return images.find((image) => image.isPrimary) ?? images[0] ?? null;
}

/**
 * Lazy stok görseli: hover ile istek atar.
 * Görsel varsa küçük önizleme; tıklanınca galeri/yükleme popup'ı açılır.
 */
export function StockImagePeekButton({
  stockId,
  stockName,
  className,
  tabIndex,
  onOpen,
  canUpload = false,
}: Props): ReactElement | null {
  const { t } = useTranslation('goods-receipt-v2');
  const tipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const leaveTimer = useRef<number | null>(null);
  const [hovering, setHovering] = useState(false);
  const [intentLoad, setIntentLoad] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  const shouldLoad = (intentLoad || lightboxOpen) && stockId > 0;
  const query = useQuery({
    queryKey: ['stock-images', stockId],
    queryFn: () => stockImagesApi.list(stockId),
    enabled: shouldLoad,
    staleTime: 5 * 60_000,
  });

  const image = pickPrimaryImage(query.data);
  const isEmpty = query.isSuccess && !image;
  const label = stockName?.trim() || t('createFlow.entryRow.stockImageFallback');

  const clearLeaveTimer = () => {
    if (leaveTimer.current != null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  const updateAnchor = () => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 220;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    const top = Math.max(8, rect.top - 12);
    setAnchor({ top, left });
  };

  const beginHover = () => {
    if (lightboxOpen) return;
    clearLeaveTimer();
    setIntentLoad(true);
    setHovering(true);
  };

  const endHover = () => {
    clearLeaveTimer();
    leaveTimer.current = window.setTimeout(() => {
      setHovering(false);
      if (!lightboxOpen) setPeekOpen(false);
    }, 120);
  };

  useEffect(() => () => clearLeaveTimer(), []);

  // Görsel geldiyse ve hâlâ hover’daysa peek aç; boşsa asla açma.
  useEffect(() => {
    if (lightboxOpen || isEmpty || !hovering || !image) {
      if (isEmpty || !hovering) setPeekOpen(false);
      return;
    }
    updateAnchor();
    setPeekOpen(true);
  }, [hovering, image, isEmpty, lightboxOpen]);

  useEffect(() => {
    if (!peekOpen || lightboxOpen) return;
    const onScroll = () => updateAnchor();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [peekOpen, lightboxOpen]);

  if (!(stockId > 0)) return null;

  const showHoverPeek = peekOpen && !lightboxOpen && Boolean(image) && Boolean(anchor);
  const opensGallery = typeof onOpen === "function";
  const titleText = canUpload
    ? isEmpty || !query.isSuccess
      ? t("createFlow.entryRow.stockImageTooltipEmpty")
      : t("createFlow.entryRow.stockImageTooltipHasImage")
    : isEmpty || !query.isSuccess
      ? t("createFlow.entryRow.stockImageEmpty")
      : t("createFlow.entryRow.stockImageTooltipView");

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          'wms-ops-stock-image-peek',
          isEmpty && 'wms-ops-stock-image-peek--empty',
          className,
        )}
        aria-label={titleText}
        aria-disabled={!opensGallery && isEmpty ? true : undefined}
        aria-describedby={showHoverPeek ? tipId : undefined}
        title={titleText}
        tabIndex={tabIndex}
        onMouseEnter={beginHover}
        onMouseLeave={endHover}
        onFocus={beginHover}
        onBlur={endHover}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          clearLeaveTimer();
          setIntentLoad(true);
          setHovering(false);
          setPeekOpen(false);
          if (opensGallery) {
            onOpen();
            return;
          }
          if (isEmpty) return;
          setLightboxOpen(true);
        }}
      >
        {query.isFetching && shouldLoad && !lightboxOpen && !isEmpty ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <ImageIcon className="size-3.5" aria-hidden />
        )}
      </button>

      {showHoverPeek && typeof document !== 'undefined'
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              className="wms-ops-stock-image-peek__popover"
              style={{
                top: anchor!.top,
                left: anchor!.left,
                transform: 'translateY(-100%)',
              }}
              onMouseEnter={beginHover}
              onMouseLeave={endHover}
            >
              <img
                src={resolveStockImageUrl(image!.url)}
                alt={image!.altText || label}
                className="wms-ops-stock-image-peek__thumb"
              />
            </div>,
            document.body,
          )
        : null}

      <Dialog
        open={lightboxOpen && !isEmpty}
        onOpenChange={(open) => {
          setLightboxOpen(open);
          if (!open) {
            setHovering(false);
            setPeekOpen(false);
          }
        }}
      >
        <DialogContent
          tone="ops"
          portalRoot="body"
          showCloseButton
          className={cn(
            'wms-ops-form wms-ops-detail-dialog wms-ops-stock-image-dialog',
            'flex w-[min(100%,34rem)] !max-w-[min(94vw,34rem)] flex-col !gap-0 overflow-hidden border-0 !p-0 shadow-none',
            'sm:w-[min(100%,38rem)] sm:!max-w-[min(94vw,38rem)]',
          )}
        >
          <DialogHeader className="wms-ops-detail-dialog__header shrink-0 border-b px-5 py-3.5 pr-14 text-left">
            <DialogTitle className="wms-ops-detail-dialog__title wms-ops-stock-image-dialog__title">
              {label}
            </DialogTitle>
          </DialogHeader>

          <div className="wms-ops-stock-image-dialog__body">
            {query.isLoading || query.isFetching ? (
              <div className="wms-ops-stock-image-dialog__state">
                <Loader2 className="size-6 animate-spin text-[var(--wms-ops-accent)]" aria-hidden />
                <span>{t('createFlow.entryRow.stockImageLoading')}</span>
              </div>
            ) : query.isError ? (
              <div className="wms-ops-stock-image-dialog__state wms-ops-stock-image-dialog__state--error">
                {t('createFlow.entryRow.stockImageError')}
              </div>
            ) : image ? (
              <img
                className="wms-ops-stock-image-dialog__img"
                src={resolveStockImageUrl(image.url)}
                alt={image.altText || label}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
