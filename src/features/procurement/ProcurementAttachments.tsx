import {
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ExternalLink,
  FileImage,
  FileText,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { procurementApi } from "./api";
import type {
  ProcurementAttachment,
  ProcurementAttachmentOwnerType,
} from "./types";

export const PROCUREMENT_ATTACHMENT_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf";

export type PendingAttachment = {
  key: string;
  file: File;
  previewUrl: string | null;
};

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageContentType(contentType: string, fileName?: string) {
  if (contentType.startsWith("image/")) return true;
  const name = (fileName ?? "").toLowerCase();
  return /\.(jpe?g|png|webp)$/i.test(name);
}

export function createPendingAttachment(file: File): PendingAttachment {
  const previewUrl = isImageContentType(file.type, file.name)
    ? URL.createObjectURL(file)
    : null;
  return { key: crypto.randomUUID(), file, previewUrl };
}

export function revokePendingAttachments(files: PendingAttachment[]) {
  for (const item of files) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
}

export async function uploadPendingAttachments(
  ownerType: ProcurementAttachmentOwnerType,
  ownerId: number,
  files: PendingAttachment[],
): Promise<void> {
  for (const item of files) {
    await procurementApi.uploadAttachment(ownerType, ownerId, item.file);
  }
}

function AttachmentIcon({
  contentType,
  fileName,
}: {
  contentType: string;
  fileName: string;
}) {
  if (isImageContentType(contentType, fileName))
    return <FileImage className="size-4 shrink-0 text-cyan-400" />;
  return <FileText className="size-4 shrink-0 text-cyan-400" />;
}

export function PendingAttachmentsEditor({
  title,
  hint,
  files,
  onChange,
  compact = false,
}: {
  title: string;
  hint?: string;
  files: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
  compact?: boolean;
}): ReactElement {
  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      const allowed =
        /^(image\/(jpeg|png|webp)|application\/pdf)$/i.test(file.type) ||
        /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
      if (!allowed) {
        toast.error(`Desteklenmeyen dosya: ${file.name}`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Dosya 10 MB sınırını aşıyor: ${file.name}`);
        continue;
      }
      next.push(createPendingAttachment(file));
    }
    onChange(next);
  };

  const remove = (key: string) => {
    const target = files.find((x) => x.key === key);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(files.filter((x) => x.key !== key));
  };

  return (
    <section
      className={
        compact
          ? "space-y-2"
          : "space-y-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </h3>
          {hint ? (
            <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
              {hint}
            </p>
          ) : null}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-bold text-cyan-400 hover:bg-cyan-500/10">
          <Upload className="size-3.5" />
          Dosya ekle
          <input
            type="file"
            className="hidden"
            accept={PROCUREMENT_ATTACHMENT_ACCEPT}
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      {files.length === 0 ? (
        <p className="text-xs text-slate-500">Henüz dosya eklenmedi.</p>
      ) : (
        <div className="space-y-2">
          {files.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-xl border border-cyan-500/15 bg-[var(--wms-app-panel)] p-2"
            >
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.file.name}
                  className="size-12 rounded-lg object-cover"
                />
              ) : (
                <div className="grid size-12 place-items-center rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                  <AttachmentIcon
                    contentType={item.file.type}
                    fileName={item.file.name}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={item.file.name}>
                  {item.file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {formatAttachmentSize(item.file.size)}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1.5 text-rose-400 hover:bg-rose-500/10"
                title="Kaldır"
                onClick={() => remove(item.key)}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function SavedAttachmentsViewer({
  title,
  hint,
  attachments,
  canDelete = false,
  onChanged,
  emptyText = "Kayıtlı ek bulunmuyor.",
}: {
  title: string;
  hint?: string;
  attachments: ProcurementAttachment[];
  canDelete?: boolean;
  onChanged?: () => void;
  emptyText?: string;
}): ReactElement {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(
    () => () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  const open = async (item: ProcurementAttachment) => {
    try {
      const blob = await procurementApi.downloadAttachment(item.id);
      const url = URL.createObjectURL(blob);
      if (isImageContentType(item.contentType, item.fileName)) {
        setPreview({ url, title: item.fileName });
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dosya açılamadı.");
    }
  };

  const remove = async (item: ProcurementAttachment) => {
    if (!window.confirm(`"${item.fileName}" eki silinsin mi?`)) return;
    setBusyId(item.id);
    try {
      await procurementApi.removeAttachment(item.id);
      toast.success("Ek silindi.");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ek silinemedi.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
        {hint ? (
          <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">{hint}</p>
        ) : null}
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyText}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {attachments.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-xl border border-cyan-500/15 bg-[var(--wms-app-panel)] p-2"
            >
              <AttachmentIcon
                contentType={item.contentType}
                fileName={item.fileName}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" title={item.fileName}>
                  {item.fileName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {formatAttachmentSize(item.fileSize)}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-cyan-400 hover:bg-cyan-500/10"
                title="Görüntüle"
                onClick={() => void open(item)}
              >
                <ExternalLink className="size-4" />
              </button>
              {canDelete ? (
                <button
                  type="button"
                  className="rounded p-1 text-rose-400 hover:bg-rose-500/10"
                  title="Sil"
                  disabled={busyId === item.id}
                  onClick={() => void remove(item)}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {preview ? (
        <ResponsiveDialog
          open
          onClose={() => {
            URL.revokeObjectURL(preview.url);
            setPreview(null);
          }}
          title={preview.title}
          className="!max-w-3xl"
        >
          <img
            src={preview.url}
            alt={preview.title}
            className="max-h-[70vh] w-full rounded-xl object-contain"
          />
        </ResponsiveDialog>
      ) : null}
    </section>
  );
}

export function LineAttachmentBadge({
  count,
  onClick,
  label = "Ek",
}: {
  count: number;
  onClick: () => void;
  label?: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
        count > 0
          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
          : "border-cyan-500/20 text-slate-400 hover:border-cyan-500/35 hover:text-cyan-300"
      }`}
      title={count > 0 ? `${count} ek` : "Dosya ekle"}
    >
      <Paperclip className="size-3.5" />
      {count > 0 ? (
        <span>
          {label} {count}
        </span>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}

export function LineAttachmentsDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}): ReactElement | null {
  if (!open) return null;
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={title}
      description={subtitle}
      className="!max-w-xl"
    >
      <div className="space-y-4">
        {children}
        <div className="flex justify-end">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            Kapat
          </OpsActionButton>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
