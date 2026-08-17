import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from "react";
import { Camera, Expand, ImagePlus, Images, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { WmsOpsStockImagePreviewDialog } from "@/components/shared/WmsOpsStockImagePreviewDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_SIZE = 10;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const QUALITY_EDIT_IMAGE_DIALOG_Z = "z-[5200]";
const QUALITY_EDIT_IMAGE_PREVIEW_Z = "z-[5300]";
const QUALITY_EDIT_IMAGE_DELETE_Z = "z-[5400]";

type SharedProps = {
  dispositionLabel: string;
  draftFiles: File[];
  onDraftFilesChange: (files: File[]) => void;
  canView: boolean;
  canUpload: boolean;
  canDelete: boolean;
};

type DialogProps = SharedProps & {
  open: boolean;
  onClose: () => void;
};

function imageKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

function mergeDraftFiles(current: File[], incoming: File[]): File[] {
  const keys = new Set(current.map(imageKey));
  const unique = incoming.filter((file) => {
    const key = imageKey(file);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
  return [...current, ...unique];
}

function usePrefersCameraCapture(): boolean {
  const [prefer, setPrefer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(pointer: coarse), (max-width: 1023px)");
    const sync = (): void => setPrefer(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return prefer;
}

function DraftImageTile({
  file,
  canDelete,
  onPreview,
  onDelete,
}: {
  file: File;
  canDelete: boolean;
  onPreview: (file: File, source: string) => void;
  onDelete: (file: File) => void;
}): ReactElement {
  const { t } = useModuleTranslation("quality");
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setSource(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <article className="group relative overflow-hidden rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]">
      <button
        type="button"
        disabled={!source}
        onClick={() => source && onPreview(file, source)}
        className="wms-ops-stock-image-gallery__open relative block aspect-[4/3] w-full bg-black/5 text-left disabled:cursor-wait"
        aria-label={t("linePopover.images.preview", { name: file.name })}
      >
        {source ? (
          <img
            src={source}
            alt={file.name}
            className="size-full object-contain"
            loading="lazy"
          />
        ) : null}
        {source ? (
          <span className="wms-ops-stock-image-gallery__zoom" aria-hidden>
            <Expand className="size-3.5" />
          </span>
        ) : null}
      </button>
      <p className="truncate px-3 py-2 text-xs text-[var(--wms-app-text-muted)]">
        {file.name}
      </p>
      {canDelete ? (
        <button
          type="button"
          onClick={() => onDelete(file)}
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

export function QualityInspectionDispositionImageDialog({
  open,
  onClose,
  dispositionLabel,
  draftFiles,
  onDraftFilesChange,
  canView,
  canUpload,
  canDelete,
}: DialogProps): ReactElement | null {
  const { t } = useModuleTranslation("quality");
  const prefersCamera = usePrefersCameraCapture();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<"view" | "upload">("view");
  const hasInitializedTab = useRef(false);
  const [preview, setPreview] = useState<{ file: File; source: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<File | null>(null);

  useEffect(() => {
    if (open) return;
    hasInitializedTab.current = false;
    setPreview(null);
    setPendingDelete(null);
    setTab("view");
  }, [open]);

  useEffect(() => {
    if (!open || hasInitializedTab.current) return;
    hasInitializedTab.current = true;
    if (!canUpload) {
      setTab("view");
      return;
    }
    setTab(draftFiles.length === 0 ? "upload" : "view");
  }, [open, canUpload, draftFiles.length]);

  if (!open || !canView) return null;

  const selectFiles = (files: File[]) => {
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
    onDraftFilesChange(mergeDraftFiles(draftFiles, files));
    setTab("view");
  };

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    selectFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const confirmPanel = (): void => {
    if (preview || pendingDelete) return;
    onClose();
  };

  const confirmFooter = (
    <div className="mt-4 flex justify-end border-t border-[var(--wms-app-border)] pt-4">
      <OpsActionButton
        type="button"
        onClick={confirmPanel}
        className="wms-ops-quality-decide-btn !min-h-9 !px-4 !text-xs"
      >
        {t("linePopover.images.confirmButton")}
      </OpsActionButton>
    </div>
  );

  const gallery = (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">{t("linePopover.images.libraryTitle")}</h3>
          <p className="text-xs text-[var(--wms-app-text-muted)]">
            {t("linePopover.images.libraryCount", { count: draftFiles.length })}
          </p>
        </div>
      </div>
      {draftFiles.length === 0 ? (
        <div className="grid min-h-32 place-items-center rounded-xl border border-[var(--wms-app-border)] text-sm text-[var(--wms-app-text-muted)]">
          {t("linePopover.images.empty")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {draftFiles.map((file) => (
            <DraftImageTile
              key={imageKey(file)}
              file={file}
              canDelete={canDelete}
              onPreview={(item, source) => setPreview({ file: item, source })}
              onDelete={setPendingDelete}
            />
          ))}
        </div>
      )}
    </>
  );

  const uploader = (
    <>
      <div className="mb-4 flex gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-3 text-sm">
        <Images className="mt-0.5 size-5 shrink-0 text-cyan-600" aria-hidden />
        <div>
          <p className="font-bold text-foreground">{t("linePopover.images.draftNoticeTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--wms-app-text-muted)]">
            {t("linePopover.images.draftNotice")}
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
          if (canUpload) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (canUpload) selectFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          ref={inputRef}
          hidden
          multiple
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFiles}
        />
        {prefersCamera ? (
          <input
            ref={cameraInputRef}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={onFiles}
          />
        ) : null}
        <div>
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--wms-ops-accent)_12%,transparent)] text-[var(--wms-ops-accent)]">
            <ImagePlus className="size-5" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-bold">
            {t(
              prefersCamera
                ? "linePopover.images.dropTitleCamera"
                : "linePopover.images.dropTitle",
            )}
          </p>
          <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
            {t("linePopover.images.limits")}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <OpsActionButton
              type="button"
              disabled={!canUpload}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden />
              {t("linePopover.images.select")}
            </OpsActionButton>
            {prefersCamera ? (
              <OpsActionButton
                type="button"
                variant="secondary"
                disabled={!canUpload}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="size-4" aria-hidden />
                {t("linePopover.images.capture")}
              </OpsActionButton>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <ResponsiveDialog
        open={open}
        onClose={() => {
          if (preview || pendingDelete) return;
          onClose();
        }}
        title={t("linePopover.images.dialogTitle")}
        description={t("linePopover.images.dialogDescription", { label: dispositionLabel })}
        className={cn("wms-quality-disposition-image-dialog !max-w-5xl", QUALITY_EDIT_IMAGE_DIALOG_Z)}
        overlayClassName={cn("wms-quality-disposition-image-dialog", QUALITY_EDIT_IMAGE_DIALOG_Z, "bg-black/55")}
      >
        {canUpload ? (
          <Tabs value={tab} onValueChange={(value) => setTab(value as "view" | "upload")} className="gap-4">
            <TabsList
              className="w-full wms-ops-detail-main-tabs wms-ops-detail-main-tabs--cols-2"
              data-active-index={tab === "upload" ? 1 : 0}
            >
              <span className="wms-ops-detail-tab-indicator" aria-hidden />
              <TabsTrigger value="view" className="wms-ops-detail-main-tab gap-1.5">
                <Images className="size-3.5" aria-hidden />
                {t("linePopover.images.viewTab")}
              </TabsTrigger>
              <TabsTrigger value="upload" className="wms-ops-detail-main-tab gap-1.5">
                <Upload className="size-3.5" aria-hidden />
                {t("linePopover.images.uploadTab")}
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
        {confirmFooter}
      </ResponsiveDialog>

      {preview && preview.source ? (
        <WmsOpsStockImagePreviewDialog
          open
          onClose={() => setPreview(null)}
          title={preview.file.name}
          description={t("linePopover.images.previewDescription")}
          imageSrc={preview.source}
          imageAlt={preview.file.name}
          overlayClassName={cn(QUALITY_EDIT_IMAGE_PREVIEW_Z, "bg-black/55")}
          contentClassName={QUALITY_EDIT_IMAGE_PREVIEW_Z}
        />
      ) : null}

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(openState) => !openState && setPendingDelete(null)}
      >
        <DialogContent
          tone="plain"
          portalRoot="body"
          data-wms-image-lightbox=""
          overlayClassName={QUALITY_EDIT_IMAGE_DELETE_Z}
          className={cn("max-w-md gap-4 p-4 sm:p-6", QUALITY_EDIT_IMAGE_DELETE_Z)}
        >
          <DialogHeader className="pr-10 text-left">
            <DialogTitle>{t("linePopover.images.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("linePopover.images.deleteDescription", {
                name: pendingDelete?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              {t("linePopover.images.cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!pendingDelete) return;
                const key = imageKey(pendingDelete);
                onDraftFilesChange(draftFiles.filter((file) => imageKey(file) !== key));
                setPendingDelete(null);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
            >
              <Trash2 className="size-4" aria-hidden />
              {t("linePopover.images.delete")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function QualityDispositionImageButton({
  dispositionLabel,
  draftFiles,
  onDraftFilesChange,
  canView,
  canUpload,
  canDelete,
}: SharedProps): ReactElement | null {
  const { t } = useModuleTranslation("quality");
  const [open, setOpen] = useState(false);

  if (!canView && !canUpload) return null;

  const count = draftFiles.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-cyan-500/30 px-2.5 text-[0.65rem] font-bold text-cyan-700 hover:bg-cyan-500/[0.06] dark:text-cyan-300"
        title={t("linePopover.images.openGallery")}
        aria-label={t("linePopover.images.openGallery")}
      >
        <Camera className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{t("linePopover.images.add")}</span>
        {count > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-cyan-600 px-1.5 py-0.5 text-[0.6rem] font-black text-white">
            {count}
          </span>
        ) : null}
      </button>
      <QualityInspectionDispositionImageDialog
        open={open}
        onClose={() => setOpen(false)}
        dispositionLabel={dispositionLabel}
        draftFiles={draftFiles}
        onDraftFilesChange={onDraftFilesChange}
        canView={canView}
        canUpload={canUpload}
        canDelete={canDelete}
      />
    </>
  );
}
