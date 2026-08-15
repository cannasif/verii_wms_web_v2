import { useEffect, useRef, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Expand, ImagePlus, Images, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  resolveStockImageUrl,
  stockImagesApi,
  type StockImage,
} from "@/features/erp-mirror/api/stock-images.api";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { cn } from "@/lib/utils";
import { StockImageUploadReview } from "./StockImageUploadReview";

type ImageTab = "view" | "upload";

type Props = {
  open: boolean;
  stockId: number;
  stockCode: string;
  stockName?: string | null;
  canUpload?: boolean;
  onClose: () => void;
};

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumBytes = 10 * 1024 * 1024;
const maximumBatch = 10;
const maximumImages = 20;

export function GoodsReceiptStockImageDialog({
  open,
  stockId,
  stockCode,
  stockName,
  canUpload = true,
  onClose,
}: Props): ReactElement | null {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const client = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<ImageTab>("view");
  const [queue, setQueue] = useState<File[]>([]);
  const [ready, setReady] = useState<File[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [preview, setPreview] = useState<StockImage | null>(null);
  const queryKey = ["stock-images", stockId] as const;
  const imagesQuery = useQuery({
    queryKey,
    queryFn: () => stockImagesApi.list(stockId),
    enabled: open && stockId > 0,
    staleTime: 60_000,
  });
  const resetQueue = () => {
    setQueue([]);
    setReady([]);
    setQueueIndex(0);
  };
  const upload = useMutation({
    mutationFn: (files: File[]) => stockImagesApi.upload(stockId, files),
    onSuccess: (images) => {
      client.setQueryData(queryKey, images);
      toast.success(t("createFlow.entryRow.stockImageUpload.saved"));
      resetQueue();
      setTab("view");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t("createFlow.entryRow.stockImageUpload.failed"),
      );
    },
  });

  const images = imagesQuery.data ?? [];
  const hasInitializedTab = useRef(false);
  const reviewing = queue[queueIndex] ?? null;
  const label = stockName?.trim() || stockCode;

  useEffect(() => {
    if (open) return;
    hasInitializedTab.current = false;
    setPreview(null);
    setQueue([]);
    setReady([]);
    setQueueIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || !imagesQuery.isSuccess || hasInitializedTab.current) return;
    hasInitializedTab.current = true;
    if (!canUpload) {
      setTab("view");
      return;
    }
    setTab(images.length === 0 ? "upload" : "view");
  }, [open, canUpload, imagesQuery.isSuccess, images.length]);

  if (!open || stockId <= 0) return null;

  const selectFiles = (files: File[]) => {
    if (upload.isPending || reviewing || files.length === 0) return;
    if (files.length > maximumBatch) {
      toast.error(t("createFlow.entryRow.stockImageUpload.batchLimit", { count: maximumBatch }));
      return;
    }
    const invalid = files.find(
      (file) =>
        !acceptedTypes.has(file.type) ||
        file.size <= 0 ||
        file.size > maximumBytes,
    );
    if (invalid) {
      toast.error(t("createFlow.entryRow.stockImageUpload.invalidFile", { name: invalid.name }));
      return;
    }
    if (images.length + files.length > maximumImages) {
      toast.error(t("createFlow.entryRow.stockImageUpload.libraryLimit", { count: maximumImages }));
      return;
    }
    setReady([]);
    setQueueIndex(0);
    setQueue(files);
  };

  const keepReviewed = async (file: File) => {
    const nextReady = [...ready, file];
    if (queueIndex >= queue.length - 1) {
      upload.mutate(nextReady);
      return;
    }
    setReady(nextReady);
    setQueueIndex((current) => current + 1);
  };

  const gallery = (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">
            {t("createFlow.entryRow.stockImageUpload.libraryTitle")}
          </h3>
          <p className="text-xs text-[var(--wms-app-text-muted)]">
            {t("createFlow.entryRow.stockImageUpload.libraryCount", {
              current: images.length,
              maximum: maximumImages,
            })}
          </p>
        </div>
        {imagesQuery.isFetching ? (
          <Loader2 className="size-4 animate-spin text-[var(--wms-ops-accent)]" aria-hidden />
        ) : null}
      </div>

      {imagesQuery.isError ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-600">
          {t("createFlow.entryRow.stockImageUpload.loadFailed")}
        </div>
      ) : imagesQuery.isLoading ? (
        <div className="grid min-h-36 place-items-center">
          <Loader2 className="size-6 animate-spin text-[var(--wms-ops-accent)]" aria-hidden />
        </div>
      ) : images.length === 0 ? (
        <div className="grid min-h-32 place-items-center rounded-xl border border-[var(--wms-app-border)] text-sm text-[var(--wms-app-text-muted)]">
          {t("createFlow.entryRow.stockImageUpload.empty")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image: StockImage) => (
            <article
              key={image.id}
              className="overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]"
            >
              <button
                type="button"
                className="wms-ops-stock-image-gallery__open relative block aspect-[4/3] w-full bg-black/5"
                onClick={() => setPreview(image)}
                aria-label={t("createFlow.entryRow.stockImageUpload.openPreview", {
                  name: image.altText || image.originalFileName,
                })}
              >
                <img
                  src={resolveStockImageUrl(image.url)}
                  alt={image.altText || image.originalFileName}
                  className="size-full object-contain"
                  loading="lazy"
                />
                {image.isPrimary ? (
                  <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black text-black">
                    {t("createFlow.entryRow.stockImageUpload.primary")}
                  </span>
                ) : null}
                <span className="wms-ops-stock-image-gallery__zoom" aria-hidden>
                  <Expand className="size-3.5" />
                </span>
              </button>
              <p className="truncate px-3 py-2 text-xs text-[var(--wms-app-text-muted)]">
                {image.altText || image.originalFileName}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );

  const uploader = reviewing ? (
    <StockImageUploadReview
      file={reviewing}
      index={queueIndex}
      total={queue.length}
      busy={upload.isPending}
      t={t}
      onCancel={resetQueue}
      onConfirm={keepReviewed}
    />
  ) : (
    <>
      <div className="mb-4 flex gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-3 text-sm">
        <Images className="mt-0.5 size-5 shrink-0 text-cyan-600" aria-hidden />
        <div>
          <p className="font-bold text-foreground">
            {t("createFlow.entryRow.stockImageUpload.stockCardNoticeTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--wms-app-text-muted)]">
            {t("createFlow.entryRow.stockImageUpload.stockCardNotice")}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "grid min-h-40 place-items-center rounded-xl border border-dashed p-5 text-center transition-colors",
          dragging
            ? "border-[var(--wms-ops-accent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_12%,transparent)]"
            : "border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_92%,transparent)]",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (!upload.isPending) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          selectFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          ref={inputRef}
          hidden
          multiple
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            selectFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <div>
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--wms-ops-accent)_12%,transparent)] text-[var(--wms-ops-accent)]">
            <ImagePlus className="size-5" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-bold">
            {t("createFlow.entryRow.stockImageUpload.dropTitle")}
          </p>
          <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
            {t("createFlow.entryRow.stockImageUpload.limits")}
          </p>
          <OpsActionButton
            className="mt-3"
            type="button"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {upload.isPending
              ? t("createFlow.entryRow.stockImageUpload.uploading")
              : t("createFlow.entryRow.stockImageUpload.select")}
          </OpsActionButton>
        </div>
      </div>
    </>
  );

  return (
    <>
      <ResponsiveDialog
        open={open}
        onClose={() => {
          if (preview) return;
          onClose();
        }}
        title={t("createFlow.entryRow.stockImageUpload.title")}
        description={t("createFlow.entryRow.stockImageUpload.description", {
          code: stockCode,
          name: label,
        })}
        className="!max-w-5xl"
      >
        {canUpload ? (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (reviewing && value !== "upload") return;
              setTab(value as ImageTab);
            }}
            className="gap-4"
          >
            <TabsList
              className="w-full wms-ops-detail-main-tabs wms-ops-detail-main-tabs--cols-2"
              data-active-index={tab === "upload" ? 1 : 0}
            >
              <span className="wms-ops-detail-tab-indicator" aria-hidden />
              <TabsTrigger value="view" className="wms-ops-detail-main-tab gap-1.5" disabled={Boolean(reviewing)}>
                <Images className="size-3.5" aria-hidden />
                {t("createFlow.entryRow.stockImageUpload.viewTab")}
              </TabsTrigger>
              <TabsTrigger value="upload" className="wms-ops-detail-main-tab gap-1.5">
                <Upload className="size-3.5" aria-hidden />
                {t("createFlow.entryRow.stockImageUpload.uploadTab")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="view" className="mt-4 outline-none">
              {gallery}
            </TabsContent>
            <TabsContent value="upload" className="mt-4 outline-none">
              {uploader}
            </TabsContent>
          </Tabs>
        ) : (
          gallery
        )}
      </ResponsiveDialog>

      {preview ? (
        <Dialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setPreview(null);
          }}
        >
          <DialogContent
            tone="ops"
            portalRoot="body"
            showCloseButton
            data-wms-image-lightbox=""
            overlayClassName="z-[80] bg-black/55"
            className={cn(
              "wms-ops-stock-image-dialog wms-ops-stock-image-preview-dialog",
              "flex w-[min(100%,36rem)] !max-w-[min(92vw,36rem)] flex-col !gap-0 overflow-hidden border-0 !p-0 shadow-none",
              "!z-[80] sm:w-[min(100%,40rem)] sm:!max-w-[min(92vw,40rem)]",
            )}
            onEscapeKeyDown={(event) => {
              event.stopPropagation();
            }}
          >
            <DialogHeader className="wms-ops-detail-dialog__header shrink-0 border-b px-5 py-3.5 pr-14 text-left">
              <DialogTitle className="wms-ops-detail-dialog__title wms-ops-stock-image-dialog__title">
                {preview.altText || preview.originalFileName}
              </DialogTitle>
              <DialogDescription className="wms-ops-detail-dialog__description mt-1 text-left normal-case tracking-normal">
                {preview.isPrimary
                  ? `${t("createFlow.entryRow.stockImageUpload.primary")} · ${label}`
                  : label}
              </DialogDescription>
            </DialogHeader>
            <div className="wms-ops-stock-image-dialog__body">
              <img
                className="wms-ops-stock-image-dialog__img"
                src={resolveStockImageUrl(preview.url)}
                alt={preview.altText || preview.originalFileName}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
