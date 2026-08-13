import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
} from "@/components/shared/AdvancedDataGrid";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { OPS_FIELD_CLASS } from "@/components/shared/ops-field-styles";
import { PagedLookupDialog } from "@/components/shared/PagedLookupDialog";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import {
  requiredActionColumn,
  systemColumns,
} from "@/components/shared/GridSystemColumns";
import { OpsStatusBadge } from "@/components/shared/OpsStatusBadge";
import type { DropdownPage } from "@/hooks/useDropdownInfiniteSearch";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { localizeEnumValue } from "@/lib/enum-localization";
import { useAuthStore } from "@/stores/auth-store";
import type { PagedResponse } from "@/types/api";
import {
  qualityApi,
  type QualityRule,
  type QualityRulePayload,
  type QualityStockGroupOption,
} from "../api/quality.api";
import { QualityRuleImportDialog } from "./QualityRuleImportDialog";

type StockOption = {
  id: number;
  erpStockCode: string;
  stockName: string;
};

type RuleForm = {
  scopeType: "Stock" | "StockGroup";
  inspectionMode: string;
  samplingMode: string;
  samplingValue: string;
  failAction: string;
  autoQuarantine: boolean;
  requireLot: boolean;
  requireSerial: boolean;
  requireExpiryDate: boolean;
  minimumRemainingShelfLifeDays: string;
  isActive: boolean;
  description: string;
};

const EMPTY_FORM: RuleForm = {
  scopeType: "Stock",
  inspectionMode: "InspectionRequired",
  samplingMode: "All",
  samplingValue: "100",
  failAction: "Quarantine",
  autoQuarantine: true,
  requireLot: false,
  requireSerial: false,
  requireExpiryDate: false,
  minimumRemainingShelfLifeDays: "",
  isActive: true,
  description: "",
};

const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages:
    page.totalPages ??
    Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: Boolean(page.hasNextPage),
});

export function QualityRulesPage() {
  const { t, moduleReady } = useModuleTranslation("quality");
  const branch = useAuthStore((state) => state.branch?.code ?? "0");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [stockLookupOpen, setStockLookupOpen] = useState(false);
  const [groupLookupOpen, setGroupLookupOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<QualityRule | null>(null);
  const [selectedStock, setSelectedStock] = useState<StockOption | null>(null);
  const [selectedGroup, setSelectedGroup] =
    useState<QualityStockGroupOption | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const samplingPreviewValue = Number(form.samplingValue) || 0;
  const samplingPreviewLot = 100;
  const samplingPreviewRequired = form.samplingMode === "Percentage"
    ? Math.min(samplingPreviewLot, Math.ceil(samplingPreviewLot * Math.min(100, Math.max(0, samplingPreviewValue)) / 100))
    : form.samplingMode === "FixedQuantity"
      ? Math.min(samplingPreviewLot, Math.max(0, samplingPreviewValue))
      : samplingPreviewLot;

  const refreshGrid = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["advanced-grid", "quality-rules"],
    });
  }, [queryClient]);

  const openCreate = () => {
    setEditingRule(null);
    setSelectedStock(null);
    setSelectedGroup(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = useCallback((rule: QualityRule) => {
    setEditingRule(rule);
    setSelectedStock(
      rule.scopeType === "Stock" && rule.stockId
        ? {
            id: rule.stockId,
            erpStockCode: rule.stockCode ?? "",
            stockName: rule.stockName ?? "",
          }
        : null,
    );
    setSelectedGroup(
      rule.scopeType === "StockGroup" && rule.stockGroupCode
        ? { code: rule.stockGroupCode, stockCount: 0 }
        : null,
    );
    setForm({
      scopeType:
        rule.scopeType === "StockGroup" ? "StockGroup" : "Stock",
      inspectionMode: rule.inspectionMode,
      samplingMode: rule.samplingMode,
      samplingValue: String(rule.samplingValue),
      failAction: rule.failAction,
      autoQuarantine: rule.autoQuarantine,
      requireLot: rule.requireLot,
      requireSerial: rule.requireSerial,
      requireExpiryDate: rule.requireExpiryDate,
      minimumRemainingShelfLifeDays:
        rule.minimumRemainingShelfLifeDays == null
          ? ""
          : String(rule.minimumRemainingShelfLifeDays),
      isActive: rule.isActive,
      description: rule.description ?? "",
    });
    setDialogOpen(true);
  }, []);

  const remove = useCallback(
    async (id: number) => {
      try {
        await qualityApi.deleteRule(id);
        await refreshGrid();
        toast.success(t("rules.toast.deleted"));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("rules.toast.deleteFailed"),
        );
      }
    },
    [refreshGrid, t],
  );

  const columns = useMemo<GridColumn<QualityRule>[]>(
    () => {
      void moduleReady;
      return [
      ...systemColumns<QualityRule>(),
      {
        key: "scopeType",
        label: t("rules.columns.scope"),
        render: (row) =>
          row.scopeType === "StockGroup" ? t("rules.scopeStockGroup") : t("rules.scopeStock"),
      },
      {
        key: "stockCode",
        label: t("rules.columns.stockOrGroup"),
        render: (row) =>
          row.stockCode
            ? `${row.stockCode} · ${row.stockName ?? ""}`
            : (row.stockGroupCode ?? "-"),
      },
      {
        key: "inspectionMode",
        label: t("rules.columns.inspection"),
        render: (row) => localizeEnumValue(row.inspectionMode),
      },
      {
        key: "samplingMode",
        label: t("rules.columns.sampling"),
        render: (row) =>
          `${localizeEnumValue(row.samplingMode)} / ${row.samplingValue}`,
      },
      {
        key: "failAction",
        label: t("rules.columns.failAction"),
        render: (row) => localizeEnumValue(row.failAction),
      },
      {
        key: "isActive",
        label: t("rules.columns.status"),
        render: (row) => (
          <OpsStatusBadge tone={row.isActive ? "done" : "pending"}>
            {row.isActive ? t("rules.statusActive") : t("rules.statusInactive")}
          </OpsStatusBadge>
        ),
      },
      {
        key: "actions",
        label: t("rules.columns.actions"),
        ...requiredActionColumn,
        render: (row) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEdit(row)}
              title={t("rules.editTitle")}
              className="rounded-lg border p-2 text-cyan-500"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => void remove(row.id)}
              title={t("rules.deleteTitle")}
              className="rounded-lg border p-2 text-red-500"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ),
      },
    ];
    },
    [moduleReady, openEdit, remove, t],
  );

  const submit = async () => {
    if (form.scopeType === "Stock" && !selectedStock) {
      toast.error(t("rules.errors.selectStock"));
      return;
    }
    if (form.scopeType === "StockGroup" && !selectedGroup) {
      toast.error(t("rules.errors.selectStockGroup"));
      return;
    }
    const samplingValue = Number(form.samplingValue);
    if (!Number.isFinite(samplingValue) || samplingValue <= 0) {
      toast.error(t("rules.errors.samplingValuePositive"));
      return;
    }
    const minimumDays = form.minimumRemainingShelfLifeDays.trim();
    if (
      minimumDays &&
      (!Number.isInteger(Number(minimumDays)) || Number(minimumDays) < 0)
    ) {
      toast.error(t("rules.errors.minimumShelfLifeInvalid"));
      return;
    }

    const payload: QualityRulePayload = {
      branchCode: branch,
      scopeType: form.scopeType,
      stockId: form.scopeType === "Stock" ? selectedStock!.id : null,
      stockGroupCode:
        form.scopeType === "StockGroup" ? selectedGroup!.code : null,
      inspectionMode: form.inspectionMode,
      samplingMode: form.samplingMode,
      samplingValue,
      failAction: form.failAction,
      autoQuarantine: form.autoQuarantine,
      requireLot: form.requireLot,
      requireSerial: form.requireSerial,
      requireExpiryDate: form.requireExpiryDate,
      minimumRemainingShelfLifeDays: minimumDays
        ? Number(minimumDays)
        : null,
      isActive: form.isActive,
      description: form.description.trim() || null,
    };

    setSaving(true);
    try {
      if (editingRule) await qualityApi.updateRule(editingRule.id, payload);
      else await qualityApi.createRule(payload);
      setDialogOpen(false);
      await refreshGrid();
      toast.success(
        editingRule
          ? t("rules.toast.updated")
          : t("rules.toast.created"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("rules.toast.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const setScope = (scopeType: string) => {
    const next = scopeType === "StockGroup" ? "StockGroup" : "Stock";
    setForm((current) => ({ ...current, scopeType: next }));
    if (next === "Stock") setSelectedGroup(null);
    else setSelectedStock(null);
  };

  return (
    <section className="space-y-4">
      <AdvancedDataGrid<QualityRule>
        pageKey="quality-rules"
        title={t("rules.title")}
        description={t("rules.description")}
        columns={columns}
        fetchPage={qualityApi.rulesPaged}
        onRowDoubleClick={openEdit}
        toolbarActions={[
          {
            label: t("rules.toolbar.importAction"),
            icon: <FileSpreadsheet className="size-3.5" />,
            run: async () => setImportOpen(true),
          },
          {
            label: t("rules.toolbar.createAction"),
            icon: <Plus className="size-3.5" />,
            run: async () => openCreate(),
          },
        ]}
      />

      <QualityRuleImportDialog
        open={importOpen}
        branchCode={branch}
        onOpenChange={setImportOpen}
        onImported={refreshGrid}
      />

      {dialogOpen && (
        <ResponsiveDialog
          onClose={() => !saving && setDialogOpen(false)}
          title={editingRule ? t("rules.dialog.editTitle") : t("rules.dialog.createTitle")}
          className="!max-w-4xl"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("rules.dialog.scopeLabel")}>
              <AppDropdown
                value={form.scopeType}
                onValueChange={setScope}
                portalContainer={null}
                options={[
                  { value: "Stock", label: t("rules.dialog.scopeStockOption") },
                  { value: "StockGroup", label: t("rules.dialog.scopeStockGroupOption") },
                ]}
              />
            </Field>

            {form.scopeType === "Stock" ? (
              <Field label={t("rules.dialog.stockField")}>
                <PagedLookupDialog<StockOption>
                  variant="ops"
                  autoSearchMinLength={2}
                  open={stockLookupOpen}
                  onOpenChange={setStockLookupOpen}
                  title={t("rules.dialog.stockLookupTitle")}
                  value={
                    selectedStock
                      ? `${selectedStock.erpStockCode} · ${selectedStock.stockName}`
                      : ""
                  }
                  placeholder={t("rules.dialog.stockLookupPlaceholder")}
                  searchPlaceholder={t("rules.dialog.stockLookupSearchPlaceholder")}
                  emptyText={t("rules.dialog.stockLookupEmpty")}
                  triggerClassName={OPS_FIELD_CLASS}
                  queryKey={["quality-stocks-lookup", branch]}
                  fetchPage={async ({
                    pageNumber,
                    pageSize,
                    search,
                    signal,
                  }) =>
                    toPagedResponse(
                      await qualityApi.stocks(
                        {
                          pageNumber,
                          pageSize,
                          search,
                          sortBy: "erpStockCode",
                          sortDirection: "asc",
                          signal: signal ?? new AbortController().signal,
                        },
                        branch,
                      ),
                    )
                  }
                  getKey={(item) => String(item.id)}
                  getLabel={(item) =>
                    `${item.erpStockCode} · ${item.stockName}`
                  }
                  onSelect={setSelectedStock}
                />
              </Field>
            ) : (
              <Field label={t("rules.dialog.stockGroupField")}>
                <PagedLookupDialog<QualityStockGroupOption>
                  variant="ops"
                  open={groupLookupOpen}
                  onOpenChange={setGroupLookupOpen}
                  title={t("rules.dialog.stockGroupLookupTitle")}
                  value={selectedGroup?.code ?? ""}
                  placeholder={t("rules.dialog.stockGroupLookupPlaceholder")}
                  searchPlaceholder={t("rules.dialog.stockGroupLookupSearchPlaceholder")}
                  emptyText={t("rules.dialog.stockGroupLookupEmpty")}
                  triggerClassName={OPS_FIELD_CLASS}
                  queryKey={["quality-stock-groups-lookup", branch]}
                  fetchPage={async ({
                    pageNumber,
                    pageSize,
                    search,
                    signal,
                  }) =>
                    toPagedResponse(
                      await qualityApi.stockGroups(
                        {
                          pageNumber,
                          pageSize,
                          search,
                          sortBy: "code",
                          sortDirection: "asc",
                          signal: signal ?? new AbortController().signal,
                        },
                        branch,
                      ),
                    )
                  }
                  getKey={(item) => item.code}
                  getLabel={(item) =>
                    `${item.code}${item.stockCount ? ` · ${t("rules.dialog.stockGroupOptionSuffix", { count: item.stockCount })}` : ""}`
                  }
                  onSelect={setSelectedGroup}
                />
              </Field>
            )}

            <SelectField
              label={t("rules.dialog.inspectionModeLabel")}
              value={form.inspectionMode}
              setValue={(inspectionMode) =>
                setForm((current) => ({ ...current, inspectionMode }))
              }
              values={["NoCheck", "QuickCheck", "InspectionRequired"]}
            />
            <SelectField
              label={t("rules.dialog.samplingModeLabel")}
              value={form.samplingMode}
              setValue={(samplingMode) =>
                setForm((current) => ({ ...current, samplingMode }))
              }
              values={[
                "All",
                "Percentage",
                "FixedQuantity",
                "EveryNthHandlingUnit",
              ]}
            />
            <Field label={t("rules.dialog.samplingValueLabel")}>
              <input
                className="input"
                type="number"
                min="0.000001"
                max={form.samplingMode === "Percentage" ? 100 : undefined}
                step="any"
                value={form.samplingValue}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    samplingValue: event.target.value,
                  }))
                }
              />
            </Field>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-3 sm:col-span-2">
              <div className="text-xs font-bold text-foreground">
                {t("rules.dialog.samplingHelp.title")}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {t(`rules.dialog.samplingHelp.${form.samplingMode}`, {
                  value: samplingPreviewValue,
                  lot: samplingPreviewLot,
                  required: samplingPreviewRequired,
                })}
              </p>
              <p className="mt-1.5 text-[0.68rem] leading-relaxed text-slate-500">
                {t("rules.dialog.samplingHelp.decisionDifference")}
              </p>
            </div>
            <SelectField
              label={t("rules.dialog.failActionLabel")}
              value={form.failAction}
              setValue={(failAction) =>
                setForm((current) => ({ ...current, failAction }))
              }
              values={[
                "Quarantine",
                "Reject",
                "ReturnToSupplier",
                "ManagerApproval",
              ]}
            />
            <Field label={t("rules.dialog.minimumShelfLifeLabel")}>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={form.minimumRemainingShelfLifeDays}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minimumRemainingShelfLifeDays: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label={t("rules.dialog.descriptionLabel")}>
              <input
                className="input"
                maxLength={500}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Toggle label={t("rules.dialog.autoQuarantineToggle")} checked={form.autoQuarantine} onChange={(autoQuarantine) => setForm((current) => ({ ...current, autoQuarantine }))} />
            <Toggle label={t("rules.dialog.requireLotToggle")} checked={form.requireLot} onChange={(requireLot) => setForm((current) => ({ ...current, requireLot }))} />
            <Toggle label={t("rules.dialog.requireSerialToggle")} checked={form.requireSerial} onChange={(requireSerial) => setForm((current) => ({ ...current, requireSerial }))} />
            <Toggle label={t("rules.dialog.requireExpiryToggle")} checked={form.requireExpiryDate} onChange={(requireExpiryDate) => setForm((current) => ({ ...current, requireExpiryDate }))} />
            <Toggle label={t("rules.dialog.activeToggle")} checked={form.isActive} onChange={(isActive) => setForm((current) => ({ ...current, isActive }))} />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <OpsActionButton type="button" variant="secondary" disabled={saving} onClick={() => setDialogOpen(false)}>
              {t("rules.dialog.cancelButton")}
            </OpsActionButton>
            <OpsActionButton type="button" variant="primary" disabled={saving} onClick={() => void submit()}>
              {editingRule ? <Save className="size-4" /> : <Plus className="size-4" />}
              {saving ? t("rules.dialog.savingButton") : editingRule ? t("rules.dialog.updateButton") : t("rules.dialog.createButton")}
            </OpsActionButton>
          </div>
        </ResponsiveDialog>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  setValue,
  values,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  values: string[];
}) {
  return (
    <Field label={label}>
      <AppDropdown
        value={value}
        onValueChange={setValue}
        portalContainer={null}
        options={values.map((option) => ({
          value: option,
          label: localizeEnumValue(option),
        }))}
      />
    </Field>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4"
      />
    </label>
  );
}
