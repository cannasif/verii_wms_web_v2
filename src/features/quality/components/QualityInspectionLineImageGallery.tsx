import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Expand, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { WmsOpsStockImagePreviewDialog } from "@/components/shared/WmsOpsStockImagePreviewDialog";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatProjectDateTime } from "@/lib/project-format";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import {
  qualityApi,
  type QualityInspectionImage,
} from "../api/quality.api";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_SIZE = 10;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type GalleryProps = {
  inspectionId: number;
  lineId: number;
  draftDispositionKey?: string;
  canView: boolean;
  canUpload: boolean;
  canDelete: boolean;
  compact?: boolean;
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function fileSize(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function ImageWithPrivateSource({
  image,
  onPreview,
  onDelete,
  canDelete,
  compact = false,
}: {
  image: QualityInspectionImage;
  onPreview: (image: QualityInspectionImage, source: string) => void;
  onDelete: (image: QualityInspectionImage) => void;
  canDelete: boolean;
  compact?: boolean;
}): ReactElement {
  const { t } = useModuleTranslation("quality");
  const [source, setSource] = useState<string | null>(null);
  const content = useQuery({
    queryKey: ["quality-inspection-image-content", image.id],
    queryFn: () => qualityApi.inspectionImageContent(image.contentUrl),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!content.data) {
      setSource(null);
      return;
    }
    const next = URL.createObjectURL(content.data);
    setSource(next);
    return () => URL.revokeObjectURL(next);
  }, [content.data]);

  if (compact) {
    return (
      <div className="group relative size-14 shrink-0 overflow-hidden rounded-lg border border-cyan-500/25 bg-slate-950/5">
        <button
          type="button"
          disabled={!source}
          onClick={() => source && onPreview(image, source)}
          className="size-full disabled:cursor-wait"
          aria-label={t("linePopover.images.preview", { name: image.originalFileName })}
        >
          {source ? (
            <img src={source} alt={image.caption || image.originalFileName} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-cyan-600">
              <Loader2 className="size-4 animate-spin" aria-hidden />
            </span>
          )}
        </button>
        {canDelete ? (
          <button
            type="button"
            onClick={() => onDelete(image)}
            className="absolute right-0.5 top-0.5 inline-flex size-5 items-center justify-center rounded bg-background/90 text-red-600 opacity-0 transition group-hover:opacity-100"
            aria-label={t("linePopover.images.delete")}
          >
            <Trash2 className="size-3" aria-hidden />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <article className="group relative overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]">
      <button
        type="button"
        disabled={!source}
        onClick={() => source && onPreview(image, source)}
        className="wms-ops-stock-image-gallery__open relative block aspect-[4/3] w-full bg-black/5 text-left disabled:cursor-wait"
        aria-label={t("linePopover.images.preview", { name: image.originalFileName })}
      >
        {source ? (
          <img
            src={source}
            alt={image.caption || image.originalFileName}
            className="size-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-cyan-600">
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </span>
        )}
        {source ? (
          <span className="wms-ops-stock-image-gallery__zoom" aria-hidden>
            <Expand className="size-3.5" />
          </span>
        ) : null}
      </button>
      <div className="space-y-0.5 px-3 py-2">
        <div className="truncate text-xs text-[var(--wms-app-text-muted)]" title={image.originalFileName}>
          {image.originalFileName}
        </div>
        <div className="flex items-center justify-between gap-2 text-[0.6rem] text-slate-500">
          <span>{fileSize(image.fileLength)}</span>
          <span>{image.uploadedAtUtc ? formatProjectDateTime(image.uploadedAtUtc) : "—"}</span>
        </div>
      </div>
      {canDelete ? (
        <button
          type="button"
          onClick={() => onDelete(image)}
          className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-lg border border-red-400/30 bg-background/90 text-red-600 shadow-sm hover:bg-red-50"
          aria-label={t("linePopover.images.delete")}
          title={t("linePopover.images.delete")}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </article>
  );
}

export function QualityInspectionLineImageGallery({
  inspectionId,
  lineId,
  draftDispositionKey,
  canView,
  canUpload,
  canDelete,
  compact = false,
}: GalleryProps): ReactElement | null {
  const { t } = useModuleTranslation("quality");
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ image: QualityInspectionImage; source: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<QualityInspectionImage | null>(null);
  const queryKey = ["quality-inspection-images", inspectionId, lineId, draftDispositionKey ?? "all"] as const;
  const images = useQuery({
    queryKey,
    queryFn: () => qualityApi.inspectionImages(inspectionId, lineId, draftDispositionKey),
    enabled: canView,
  });
  const upload = useMutation({
    mutationFn: (files: File[]) => {
      if (!draftDispositionKey) {
        throw new Error(t("linePopover.images.routeKeyRequired"));
      }
      return qualityApi.uploadInspectionImages(inspectionId, lineId, files, draftDispositionKey);
    },
    onSuccess: (items) => {
      queryClient.setQueryData(queryKey, items);
      toast.success(t("linePopover.images.uploaded"));
    },
    onError: (error) => toast.error(errorMessage(error, t("linePopover.images.uploadFailed"))),
  });
  const remove = useMutation({
    mutationFn: (image: QualityInspectionImage) => qualityApi.deleteInspectionImage(inspectionId, lineId, image.id),
    onSuccess: (_, image) => {
      queryClient.setQueryData<QualityInspectionImage[]>(queryKey, (current) => current?.filter((item) => item.id !== image.id) ?? []);
      queryClient.removeQueries({ queryKey: ["quality-inspection-image-content", image.id] });
      setPendingDelete(null);
      toast.success(t("linePopover.images.deleted"));
    },
    onError: (error) => toast.error(errorMessage(error, t("linePopover.images.deleteFailed"))),
  });

  if (!canView) return null;

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    if (files.length > MAX_BATCH_SIZE) {
      toast.error(t("linePopover.images.batchLimit", { count: MAX_BATCH_SIZE }));
      return;
    }
    const invalidType = files.find((file) => !ALLOWED_TYPES.has(file.type));
    if (invalidType) {
      toast.error(t("linePopover.images.invalidType"));
      return;
    }
    const oversized = files.find((file) => file.size <= 0 || file.size > MAX_FILE_SIZE);
    if (oversized) {
      toast.error(t("linePopover.images.sizeLimit"));
      return;
    }
    upload.mutate(files);
  };

  return (
    <section
      className={compact
        ? "space-y-2 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.03] p-2"
        : "space-y-2 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.035] p-2.5"}
      aria-label={t("linePopover.images.routeTitle")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Camera className="size-3.5 text-cyan-600" aria-hidden />
            {compact ? t("linePopover.images.routeTitle") : t("linePopover.images.title")}
          </div>
          {!compact ? (
            <p className="mt-0.5 text-[0.65rem] leading-relaxed text-slate-500">{t("linePopover.images.routeDescription")}</p>
          ) : null}
        </div>
        {canUpload && draftDispositionKey ? (
          <>
            <input ref={inputRef} type="file" multiple hidden accept="image/jpeg,image/png,image/webp" onChange={onFiles} />
            <button
              type="button"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-cyan-500/30 px-2.5 text-[0.65rem] font-bold text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-cyan-300"
            >
              {upload.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ImagePlus className="size-3.5" aria-hidden />}
              {upload.isPending ? t("linePopover.images.uploading") : t("linePopover.images.add")}
            </button>
          </>
        ) : null}
      </div>

      {images.isLoading ? (
        <div className={compact ? "flex min-h-14 items-center justify-center text-cyan-600" : "flex min-h-20 items-center justify-center text-cyan-600"}>
          <Loader2 className="size-5 animate-spin" aria-hidden />
        </div>
      ) : images.isError ? (
        <button type="button" onClick={() => images.refetch()} className="w-full rounded-lg border border-red-400/20 p-2 text-left text-[0.68rem] text-red-600">{t("linePopover.images.loadFailed")}</button>
      ) : (images.data?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-cyan-500/20 p-2 text-center text-[0.68rem] text-slate-500">{t("linePopover.images.empty")}</div>
      ) : compact ? (
        <div className="flex flex-wrap gap-2">
          {images.data?.map((image) => (
            <ImageWithPrivateSource
              key={image.id}
              image={image}
              compact
              canDelete={canDelete}
              onPreview={(item, source) => setPreview({ image: item, source })}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.data?.map((image) => (
            <ImageWithPrivateSource
              key={image.id}
              image={image}
              canDelete={canDelete}
              onPreview={(item, source) => setPreview({ image: item, source })}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}

      {preview && preview.source ? (
        <WmsOpsStockImagePreviewDialog
          open
          onClose={() => setPreview(null)}
          title={preview.image.originalFileName}
          description={preview.image.caption || t("linePopover.images.previewDescription")}
          imageSrc={preview.source}
          imageAlt={preview.image.caption || preview.image.originalFileName}
        />
      ) : null}

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && !remove.isPending && setPendingDelete(null)}>
        <DialogContent tone="plain" data-wms-image-lightbox className="max-w-md gap-4 p-4 sm:p-6">
          <DialogHeader className="pr-10 text-left">
            <DialogTitle>{t("linePopover.images.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("linePopover.images.deleteDescription", { name: pendingDelete?.originalFileName ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" disabled={remove.isPending} onClick={() => setPendingDelete(null)} className="rounded-lg border px-3 py-2 text-sm">{t("linePopover.images.cancel")}</button>
            <button type="button" disabled={remove.isPending} onClick={() => pendingDelete && remove.mutate(pendingDelete)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {remove.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
              {t("linePopover.images.delete")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function QualityDispositionHistoryImages({
  images,
}: {
  images: QualityInspectionImage[];
}): ReactElement | null {
  const { t } = useModuleTranslation("quality");
  const [preview, setPreview] = useState<{ image: QualityInspectionImage; source: string } | null>(null);
  if (images.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {t("detail.history.images")}
      </div>
      <div className="flex flex-wrap gap-2">
        {images.map((image) => (
          <ImageWithPrivateSource
            key={image.id}
            image={image}
            compact
            canDelete={false}
            onPreview={(item, source) => setPreview({ image: item, source })}
            onDelete={() => undefined}
          />
        ))}
      </div>
      {preview && preview.source ? (
        <WmsOpsStockImagePreviewDialog
          open
          onClose={() => setPreview(null)}
          title={preview.image.originalFileName}
          description={t("linePopover.images.previewDescription")}
          imageSrc={preview.source}
          imageAlt={preview.image.originalFileName}
        />
      ) : null}
    </div>
  );
}

export function QualityInspectionLineImageGalleryDialog({
  inspectionId,
  lineId,
  draftDispositionKey,
  canView,
  canUpload,
  canDelete,
}: GalleryProps): ReactElement | null {
  const { t } = useModuleTranslation("quality");
  const [open, setOpen] = useState(false);
  if (!canView) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-500/25 px-2.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-500/[0.06] dark:text-cyan-300"
        title={t("linePopover.images.openGallery")}
      >
        <Camera className="size-3.5" aria-hidden />
        {t("linePopover.images.gallery")}
      </button>
      <DialogContent
        tone="plain"
        data-wms-image-lightbox
        className="max-h-[90vh] max-w-4xl gap-4 overflow-y-auto border-cyan-500/20 bg-background p-4 sm:p-6"
      >
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>{t("linePopover.images.title")}</DialogTitle>
          <DialogDescription>{t("linePopover.images.routeDescription")}</DialogDescription>
        </DialogHeader>
        <QualityInspectionLineImageGallery
          inspectionId={inspectionId}
          lineId={lineId}
          draftDispositionKey={draftDispositionKey}
          canView={canView}
          canUpload={canUpload}
          canDelete={canDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
