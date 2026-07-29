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
        toast.success("Kalite kuralı silindi.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Kalite kuralı silinemedi.",
        );
      }
    },
    [refreshGrid],
  );

  const columns = useMemo<GridColumn<QualityRule>[]>(
    () => [
      ...systemColumns<QualityRule>(),
      {
        key: "scopeType",
        label: "Kapsam",
        render: (row) =>
          row.scopeType === "StockGroup" ? "Stok grubu" : "Stok",
      },
      {
        key: "stockCode",
        label: "Stok / grup",
        render: (row) =>
          row.stockCode
            ? `${row.stockCode} · ${row.stockName ?? ""}`
            : (row.stockGroupCode ?? "-"),
      },
      {
        key: "inspectionMode",
        label: "Kontrol",
        render: (row) => localizeEnumValue(row.inspectionMode),
      },
      {
        key: "samplingMode",
        label: "Örnekleme",
        render: (row) =>
          `${localizeEnumValue(row.samplingMode)} / ${row.samplingValue}`,
      },
      {
        key: "failAction",
        label: "Başarısızlık",
        render: (row) => localizeEnumValue(row.failAction),
      },
      {
        key: "isActive",
        label: "Durum",
        render: (row) => (
          <OpsStatusBadge tone={row.isActive ? "done" : "pending"}>
            {row.isActive ? "Aktif" : "Pasif"}
          </OpsStatusBadge>
        ),
      },
      {
        key: "actions",
        label: "İşlemler",
        ...requiredActionColumn,
        render: (row) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEdit(row)}
              title="Düzenle"
              className="rounded-lg border p-2 text-cyan-500"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => void remove(row.id)}
              title="Sil"
              className="rounded-lg border p-2 text-red-500"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ),
      },
    ],
    [openEdit, remove],
  );

  const submit = async () => {
    if (form.scopeType === "Stock" && !selectedStock) {
      toast.error("Stok seçiniz.");
      return;
    }
    if (form.scopeType === "StockGroup" && !selectedGroup) {
      toast.error("Stok grubu seçiniz.");
      return;
    }
    const samplingValue = Number(form.samplingValue);
    if (!Number.isFinite(samplingValue) || samplingValue <= 0) {
      toast.error("Örnekleme değeri sıfırdan büyük olmalıdır.");
      return;
    }
    const minimumDays = form.minimumRemainingShelfLifeDays.trim();
    if (
      minimumDays &&
      (!Number.isInteger(Number(minimumDays)) || Number(minimumDays) < 0)
    ) {
      toast.error("Minimum raf ömrü sıfır veya pozitif tam sayı olmalıdır.");
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
          ? "Kalite kuralı güncellendi."
          : "Kalite kuralı oluşturuldu.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kalite kuralı kaydedilemedi.",
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
        title="Kalite Kuralları"
        description="Stok veya stok grubu bazında kontrol, örnekleme ve başarısızlık aksiyonlarını yönetin."
        columns={columns}
        fetchPage={qualityApi.rulesPaged}
        onRowDoubleClick={openEdit}
        toolbarActions={[
          {
            label: "Excel ile toplu ekle",
            icon: <FileSpreadsheet className="size-3.5" />,
            run: async () => setImportOpen(true),
          },
          {
            label: "Yeni kalite kuralı",
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
          title={editingRule ? "Kalite Kuralını Düzenle" : "Yeni Kalite Kuralı"}
          className="!max-w-4xl"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Kural kapsamı">
              <AppDropdown
                value={form.scopeType}
                onValueChange={setScope}
                portalContainer={null}
                options={[
                  { value: "Stock", label: "Stok" },
                  { value: "StockGroup", label: "Stok grubu" },
                ]}
              />
            </Field>

            {form.scopeType === "Stock" ? (
              <Field label="Stok">
                <PagedLookupDialog<StockOption>
                  variant="ops"
                  autoSearchMinLength={2}
                  open={stockLookupOpen}
                  onOpenChange={setStockLookupOpen}
                  title="Stok seçimi"
                  value={
                    selectedStock
                      ? `${selectedStock.erpStockCode} · ${selectedStock.stockName}`
                      : ""
                  }
                  placeholder="Stok seçiniz"
                  searchPlaceholder="Stok kodu veya adı ara…"
                  emptyText="Stok bulunamadı."
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
              <Field label="Stok grubu">
                <PagedLookupDialog<QualityStockGroupOption>
                  variant="ops"
                  open={groupLookupOpen}
                  onOpenChange={setGroupLookupOpen}
                  title="Stok grubu seçimi"
                  value={selectedGroup?.code ?? ""}
                  placeholder="Stok grubu seçiniz"
                  searchPlaceholder="Grup kodu ara…"
                  emptyText="Stok grubu bulunamadı."
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
                    `${item.code}${item.stockCount ? ` · ${item.stockCount} stok` : ""}`
                  }
                  onSelect={setSelectedGroup}
                />
              </Field>
            )}

            <SelectField
              label="Kontrol modu"
              value={form.inspectionMode}
              setValue={(inspectionMode) =>
                setForm((current) => ({ ...current, inspectionMode }))
              }
              values={["NoCheck", "QuickCheck", "InspectionRequired"]}
            />
            <SelectField
              label="Örnekleme"
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
            <Field label="Örnekleme değeri">
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
            <SelectField
              label="Başarısızlık aksiyonu"
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
            <Field label="Minimum kalan raf ömrü (gün)">
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
            <Field label="Açıklama">
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
            <Toggle label="Otomatik karantinaya al" checked={form.autoQuarantine} onChange={(autoQuarantine) => setForm((current) => ({ ...current, autoQuarantine }))} />
            <Toggle label="Lot zorunlu" checked={form.requireLot} onChange={(requireLot) => setForm((current) => ({ ...current, requireLot }))} />
            <Toggle label="Seri zorunlu" checked={form.requireSerial} onChange={(requireSerial) => setForm((current) => ({ ...current, requireSerial }))} />
            <Toggle label="Son kullanma tarihi zorunlu" checked={form.requireExpiryDate} onChange={(requireExpiryDate) => setForm((current) => ({ ...current, requireExpiryDate }))} />
            <Toggle label="Kural aktif" checked={form.isActive} onChange={(isActive) => setForm((current) => ({ ...current, isActive }))} />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <OpsActionButton type="button" variant="secondary" disabled={saving} onClick={() => setDialogOpen(false)}>
              Vazgeç
            </OpsActionButton>
            <OpsActionButton type="button" variant="primary" disabled={saving} onClick={() => void submit()}>
              {editingRule ? <Save className="size-4" /> : <Plus className="size-4" />}
              {saving ? "Kaydediliyor…" : editingRule ? "Güncelle" : "Oluştur"}
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
