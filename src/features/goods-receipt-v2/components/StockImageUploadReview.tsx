import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { Crop, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import {
  clampCrop,
  cropStockImageFile,
  FULL_CROP,
  type RelativeCrop,
} from "../lib/crop-stock-image";

type Handle = "move" | "nw" | "ne" | "sw" | "se";

type Translate = (key: string, options?: Record<string, string | number>) => string;

type Props = {
  file: File;
  index: number;
  total: number;
  busy?: boolean;
  t: Translate;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
};

export function StockImageUploadReview({
  file,
  index,
  total,
  busy = false,
  t,
  onCancel,
  onConfirm,
}: Props): ReactElement {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    crop: RelativeCrop;
  } | null>(null);
  const [crop, setCrop] = useState<RelativeCrop>(FULL_CROP);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCrop(FULL_CROP);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const stage = stageRef.current;
      if (!drag || !stage) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dx = (event.clientX - drag.startX) / rect.width;
      const dy = (event.clientY - drag.startY) / rect.height;
      const previous = drag.crop;
      if (drag.handle === "move") {
        setCrop(clampCrop({ ...previous, x: previous.x + dx, y: previous.y + dy }));
        return;
      }
      if (drag.handle === "nw") {
        setCrop(clampCrop({
          x: previous.x + dx,
          y: previous.y + dy,
          width: previous.width - dx,
          height: previous.height - dy,
        }));
        return;
      }
      if (drag.handle === "ne") {
        setCrop(clampCrop({
          x: previous.x,
          y: previous.y + dy,
          width: previous.width + dx,
          height: previous.height - dy,
        }));
        return;
      }
      if (drag.handle === "sw") {
        setCrop(clampCrop({
          x: previous.x + dx,
          y: previous.y,
          width: previous.width - dx,
          height: previous.height + dy,
        }));
        return;
      }
      setCrop(clampCrop({
        x: previous.x,
        y: previous.y,
        width: previous.width + dx,
        height: previous.height + dy,
      }));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const beginDrag = (handle: Handle, event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      crop,
    };
  };

  const confirm = async () => {
    if (saving || busy) return;
    setSaving(true);
    try {
      const next = await cropStockImageFile(file, crop);
      await onConfirm(next);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("createFlow.entryRow.stockImageUpload.failed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const pending = saving || busy;
  const isLast = index >= total - 1;

  return (
    <div className="wms-ops-stock-image-review">
      <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-sm">
        <p className="font-bold text-foreground">
          {t("createFlow.entryRow.stockImageUpload.confirmTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--wms-app-text-muted)]">
          {t("createFlow.entryRow.stockImageUpload.confirmHint")}
        </p>
      </div>

      <div className="wms-ops-stock-image-crop">
        <div className="wms-ops-stock-image-crop__stage">
          <div ref={stageRef} className="wms-ops-stock-image-crop__canvas">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={file.name}
                draggable={false}
                className="wms-ops-stock-image-crop__img"
              />
            ) : null}
            <div
              className="wms-ops-stock-image-crop__frame"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.width * 100}%`,
                height: `${crop.height * 100}%`,
              }}
              onPointerDown={(event) => beginDrag("move", event)}
            >
              <span className="wms-ops-stock-image-crop__handle wms-ops-stock-image-crop__handle--nw" onPointerDown={(event) => beginDrag("nw", event)} />
              <span className="wms-ops-stock-image-crop__handle wms-ops-stock-image-crop__handle--ne" onPointerDown={(event) => beginDrag("ne", event)} />
              <span className="wms-ops-stock-image-crop__handle wms-ops-stock-image-crop__handle--sw" onPointerDown={(event) => beginDrag("sw", event)} />
              <span className="wms-ops-stock-image-crop__handle wms-ops-stock-image-crop__handle--se" onPointerDown={(event) => beginDrag("se", event)} />
            </div>
          </div>
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[var(--wms-app-text-muted)]">
          <Crop className="size-3.5" aria-hidden />
          {t("createFlow.entryRow.stockImageUpload.cropHint")}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--wms-app-text-muted)]">
        <span className="truncate font-medium text-foreground" title={file.name}>
          {file.name}
        </span>
        {total > 1 ? (
          <span>
            {t("createFlow.entryRow.stockImageUpload.fileOf", {
              current: index + 1,
              total,
            })}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <OpsActionButton type="button" variant="secondary" disabled={pending} onClick={onCancel}>
          {t("createFlow.entryRow.stockImageUpload.cancelPreview")}
        </OpsActionButton>
        <OpsActionButton
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => setCrop(FULL_CROP)}
        >
          {t("createFlow.entryRow.stockImageUpload.cropReset")}
        </OpsActionButton>
        <OpsActionButton type="button" variant="primary" disabled={pending} onClick={() => void confirm()}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {isLast
            ? t("createFlow.entryRow.stockImageUpload.confirmSave")
            : t("createFlow.entryRow.stockImageUpload.confirmNext")}
        </OpsActionButton>
      </div>
    </div>
  );
}
