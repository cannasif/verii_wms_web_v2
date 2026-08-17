import type { ReactElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  imageSrc: string;
  imageAlt: string;
  overlayClassName?: string;
  contentClassName?: string;
};

export function WmsOpsStockImagePreviewDialog({
  open,
  onClose,
  title,
  description,
  imageSrc,
  imageAlt,
  overlayClassName = "z-[80] bg-black/55",
  contentClassName = "!z-[80]",
}: Props): ReactElement {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        tone="ops"
        portalRoot="body"
        showCloseButton
        data-wms-image-lightbox=""
        overlayClassName={overlayClassName}
        className={cn(
          "wms-ops-stock-image-dialog wms-ops-stock-image-preview-dialog",
          "flex w-[min(100%,36rem)] !max-w-[min(92vw,36rem)] flex-col !gap-0 overflow-hidden border-0 !p-0 shadow-none",
          "sm:w-[min(100%,40rem)] sm:!max-w-[min(92vw,40rem)]",
          contentClassName,
        )}
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
        }}
      >
        <DialogHeader className="wms-ops-detail-dialog__header shrink-0 border-b px-5 py-3.5 pr-14 text-left">
          <DialogTitle className="wms-ops-detail-dialog__title wms-ops-stock-image-dialog__title">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="wms-ops-detail-dialog__description mt-1 text-left normal-case tracking-normal">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="wms-ops-stock-image-dialog__body">
          <img className="wms-ops-stock-image-dialog__img" src={imageSrc} alt={imageAlt} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
