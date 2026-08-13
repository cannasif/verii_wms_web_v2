import { useRef, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Images, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import {
  resolveStockImageUrl,
  stockImagesApi,
  type StockImage,
} from "@/features/erp-mirror/api/stock-images.api";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  stockId: number;
  stockCode: string;
  stockName?: string | null;
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
  onClose,
}: Props): ReactElement | null {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const client = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const queryKey = ["stock-images", stockId] as const;
  const imagesQuery = useQuery({
    queryKey,
    queryFn: () => stockImagesApi.list(stockId),
    enabled: open && stockId > 0,
    staleTime: 60_000,
  });
  const upload = useMutation({
    mutationFn: (files: File[]) => stockImagesApi.upload(stockId, files),
    onSuccess: (images) => {
      client.setQueryData(queryKey, images);
      toast.success(t("createFlow.entryRow.stockImageUpload.saved"));
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t("createFlow.entryRow.stockImageUpload.failed"),
      );
    },
  });

  if (!open || stockId <= 0) return null;
  const images = imagesQuery.data ?? [];

  const selectFiles = (files: File[]) => {
    if (upload.isPending || files.length === 0) return;
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
    upload.mutate(files);
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={t("createFlow.entryRow.stockImageUpload.title")}
      description={t("createFlow.entryRow.stockImageUpload.description", {
        code: stockCode,
        name: stockName?.trim() || stockCode,
      })}
      className="!max-w-5xl"
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-3 text-sm">
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

        <section>
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
                  <div className="relative aspect-[4/3] bg-black/5">
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
                  </div>
                  <p className="truncate px-3 py-2 text-xs text-[var(--wms-app-text-muted)]">
                    {image.altText || image.originalFileName}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </ResponsiveDialog>
  );
}
