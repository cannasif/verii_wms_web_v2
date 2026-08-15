import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdvancedDataGrid, type GridColumn } from "@/components/shared/AdvancedDataGrid";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppInput } from "@/components/shared/AppInput";
import { requiredActionColumn, systemColumns } from "@/components/shared/GridSystemColumns";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { OpsSkinCheckbox } from "@/components/shared/OpsSkinCheckbox";
import { OpsStatusBadge } from "@/components/shared/OpsStatusBadge";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { localizeEnumValue } from "@/lib/enum-localization";
import { useAuthStore } from "@/stores/auth-store";
import {
  qualityApi,
  type QualityDecisionCode,
  type QualityDecisionCodePayload,
} from "../api/quality.api";

type FormState = {
  code: string;
  name: string;
  applicableDecision: string;
  description: string;
  requiresNote: boolean;
  sortOrder: string;
  isActive: boolean;
};

const ALL_DECISIONS_VALUE = "__all__";

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  applicableDecision: ALL_DECISIONS_VALUE,
  description: "",
  requiresNote: false,
  sortOrder: "0",
  isActive: true,
};

function decisionToFormValue(decision?: string | null): string {
  return decision?.trim() ? decision : ALL_DECISIONS_VALUE;
}

function formValueToDecision(value: string): string | null {
  return value === ALL_DECISIONS_VALUE || !value.trim() ? null : value;
}

export function QualityDecisionCodesPage() {
  const { t, moduleReady } = useModuleTranslation("quality");
  const branchCode = useAuthStore((state) => state.branch?.code ?? "0");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QualityDecisionCode | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QualityDecisionCode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["advanced-grid", "quality-decision-codes"] });
  }, [queryClient]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = useCallback((row: QualityDecisionCode) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      applicableDecision: decisionToFormValue(row.applicableDecision),
      description: row.description ?? "",
      requiresNote: row.requiresNote,
      sortOrder: String(row.sortOrder),
      isActive: row.isActive,
    });
    setDialogOpen(true);
  }, []);

  const requestDelete = useCallback((row: QualityDecisionCode) => {
    setDeleteTarget(row);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await qualityApi.deleteDecisionCode(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
      toast.success(t("decisionCodes.deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("decisionCodes.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, refresh, t]);

  const columns = useMemo<GridColumn<QualityDecisionCode>[]>(() => {
    void moduleReady;
    return [
      ...systemColumns<QualityDecisionCode>(),
      { key: "code", label: t("decisionCodes.columns.code"), render: (row) => row.code, defaultSearch: true },
      { key: "name", label: t("decisionCodes.columns.name"), render: (row) => row.name, defaultSearch: true },
      {
        key: "applicableDecision",
        label: t("decisionCodes.columns.decision"),
        render: (row) => row.applicableDecision
          ? localizeEnumValue(row.applicableDecision)
          : t("decisionCodes.allDecisions"),
      },
      {
        key: "requiresNote",
        label: t("decisionCodes.columns.requiresNote"),
        render: (row) => row.requiresNote ? t("decisionCodes.yes") : t("decisionCodes.no"),
      },
      { key: "sortOrder", label: t("decisionCodes.columns.sortOrder"), render: (row) => row.sortOrder },
      {
        key: "isActive",
        label: t("decisionCodes.columns.status"),
        render: (row) => (
          <OpsStatusBadge tone={row.isActive ? "done" : "pending"}>
            {row.isActive ? t("decisionCodes.active") : t("decisionCodes.inactive")}
          </OpsStatusBadge>
        ),
      },
      {
        key: "actions",
        label: t("decisionCodes.columns.actions"),
        ...requiredActionColumn,
        render: (row) => (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => openEdit(row)} className="rounded-lg border p-2 text-cyan-600" title={t("decisionCodes.edit")}>
              <Pencil className="size-4" />
            </button>
            <button type="button" onClick={() => requestDelete(row)} className="rounded-lg border p-2 text-rose-500" title={t("decisionCodes.delete")}>
              <Trash2 className="size-4" />
            </button>
          </div>
        ),
      },
    ];
  }, [moduleReady, openEdit, requestDelete, t]);

  const submit = async () => {
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    const sortOrder = Number(form.sortOrder);
    if (!code || !name) {
      toast.error(t("decisionCodes.required"));
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      toast.error(t("decisionCodes.sortInvalid"));
      return;
    }
    const payload: QualityDecisionCodePayload = {
      branchCode,
      code,
      name,
      applicableDecision: formValueToDecision(form.applicableDecision),
      description: form.description.trim() || null,
      requiresNote: form.requiresNote,
      sortOrder,
      isActive: form.isActive,
      rowVersion: editing?.rowVersion ?? null,
    };
    setSaving(true);
    try {
      if (editing) await qualityApi.updateDecisionCode(editing.id, payload);
      else await qualityApi.createDecisionCode(payload);
      setDialogOpen(false);
      await refresh();
      toast.success(t(editing ? "decisionCodes.updated" : "decisionCodes.created"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("decisionCodes.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <AdvancedDataGrid<QualityDecisionCode>
        pageKey="quality-decision-codes"
        title={t("decisionCodes.title")}
        description={t("decisionCodes.description")}
        columns={columns}
        fetchPage={qualityApi.decisionCodesPaged}
        toolbarAction={{
          label: t("decisionCodes.add"),
          icon: <Plus className="size-4" />,
          run: async () => {
            openCreate();
          },
        }}
      />

      <ResponsiveDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t(editing ? "decisionCodes.editTitle" : "decisionCodes.createTitle")}
        description={t("decisionCodes.dialogDescription")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>{t("decisionCodes.fields.code")}</span>
            <AppInput value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} maxLength={50} />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("decisionCodes.fields.name")}</span>
            <AppInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={150} />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("decisionCodes.fields.decision")}</span>
            <AppDropdown
              value={form.applicableDecision}
              onValueChange={(value) => setForm((current) => ({ ...current, applicableDecision: value }))}
              options={[
                { value: ALL_DECISIONS_VALUE, label: t("decisionCodes.allDecisions") },
                ...["Accepted", "Rejected", "Quarantined", "Returned", "Hold"].map((value) => ({ value, label: localizeEnumValue(value) })),
              ]}
              searchable={false}
              portalContainer={null}
              contentClassName="!z-[6100]"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("decisionCodes.fields.sortOrder")}</span>
            <AppInput value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} inputMode="numeric" />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span>{t("decisionCodes.fields.description")}</span>
            <textarea className="min-h-24 w-full rounded-xl border bg-transparent p-3" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={500} />
          </label>
          <div className="flex flex-wrap gap-6 md:col-span-2">
            <label className="flex items-center gap-2 text-sm"><OpsSkinCheckbox checked={form.requiresNote} onCheckedChange={(checked) => setForm((current) => ({ ...current, requiresNote: Boolean(checked) }))} aria-label={t("decisionCodes.fields.requiresNote")} /><span>{t("decisionCodes.fields.requiresNote")}</span></label>
            <label className="flex items-center gap-2 text-sm"><OpsSkinCheckbox checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: Boolean(checked) }))} aria-label={t("decisionCodes.fields.isActive")} /><span>{t("decisionCodes.fields.isActive")}</span></label>
          </div>
        </div>
        <div className="mt-5 flex justify-end border-t pt-4">
          <OpsActionButton type="button" onClick={() => void submit()} disabled={saving}>
            <Save className="size-4" /> {saving ? t("decisionCodes.saving") : t("decisionCodes.save")}
          </OpsActionButton>
        </div>
      </ResponsiveDialog>
      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title={t("decisionCodes.delete")}
        description={
          deleteTarget
            ? t("decisionCodes.confirmDelete", { code: deleteTarget.code })
            : undefined
        }
        confirmLabel={t("decisionCodes.delete")}
        isPending={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
