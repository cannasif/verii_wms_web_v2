import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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
  systemColumns,
  requiredActionColumn,
} from "@/components/shared/GridSystemColumns";
import { OpsStatusBadge } from "@/components/shared/OpsStatusBadge";
import type { DropdownPage } from "@/hooks/useDropdownInfiniteSearch";
import { localizeEnumValue } from "@/lib/enum-localization";
import { useAuthStore } from "@/stores/auth-store";
import type { PagedResponse } from "@/types/api";
import { qualityApi, type QualityRule } from "../api/quality.api";

type StockOption = {
  id: number;
  erpStockCode: string;
  stockName: string;
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
  const branch = useAuthStore((s) => s.branch?.code ?? "0");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [stockLookupOpen, setStockLookupOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockOption | null>(null);
  const [mode, setMode] = useState("InspectionRequired");
  const [sampling, setSampling] = useState("All");
  const [value, setValue] = useState("100");
  const [fail, setFail] = useState("Quarantine");

  const stockDisplay = selectedStock
    ? `${selectedStock.erpStockCode} · ${selectedStock.stockName}`
    : "";

  const resetForm = () => {
    setSelectedStock(null);
    setMode("InspectionRequired");
    setSampling("All");
    setValue("100");
    setFail("Quarantine");
  };

  const remove = useCallback(
    async (id: number) => {
      try {
        await qualityApi.deleteRule(id);
        await qc.invalidateQueries({
          queryKey: ["advanced-grid", "quality-rules"],
        });
        toast.success("Kural silindi.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Silinemedi.");
      }
    },
    [qc],
  );

  const columns = useMemo<GridColumn<QualityRule>[]>(
    () => [
      ...systemColumns<QualityRule>(),
      {
        key: "stockCode",
        label: "Stok",
        render: (r) =>
          r.stockCode
            ? `${r.stockCode} · ${r.stockName ?? ""}`
            : (r.stockGroupCode ?? "-"),
      },
      {
        key: "inspectionMode",
        label: "Kontrol",
        render: (r) => r.inspectionMode,
      },
      {
        key: "samplingMode",
        label: "Örnekleme",
        render: (r) =>
          `${localizeEnumValue(r.samplingMode)} / ${r.samplingValue}`,
      },
      { key: "failAction", label: "Başarısızlık", render: (r) => r.failAction },
      {
        key: "isActive",
        label: "Durum",
        render: (r) => (
          <OpsStatusBadge tone={r.isActive ? "done" : "pending"}>
            {r.isActive ? "Aktif" : "Pasif"}
          </OpsStatusBadge>
        ),
      },
      {
        key: "actions",
        label: "İşlemler",
        ...requiredActionColumn,
        render: (r) => (
          <button
            onClick={() => void remove(r.id)}
            title="Sil"
            className="rounded-lg border p-2 text-red-500"
          >
            <Trash2 className="size-4" />
          </button>
        ),
      },
    ],
    [remove],
  );

  const create = async () => {
    if (!selectedStock) {
      toast.error("Stok seçiniz.");
      return;
    }
    try {
      await qualityApi.createRule({
        branchCode: branch,
        scopeType: "Stock",
        stockId: selectedStock.id,
        stockGroupCode: null,
        inspectionMode: mode,
        samplingMode: sampling,
        samplingValue: Number(value),
        failAction: fail,
        autoQuarantine: fail === "Quarantine",
        requireLot: false,
        requireSerial: false,
        requireExpiryDate: false,
        minimumRemainingShelfLifeDays: null,
        isActive: true,
        description: null,
      });
      setOpen(false);
      resetForm();
      await qc.invalidateQueries({
        queryKey: ["advanced-grid", "quality-rules"],
      });
      toast.success("Kalite kuralı oluşturuldu.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Oluşturulamadı.");
    }
  };

  return (
    <section className="space-y-4">
      <AdvancedDataGrid<QualityRule>
        pageKey="quality-rules"
        title="Kalite Kuralları"
        description="Stok bazında kontrol, örnekleme ve başarısızlık aksiyonunu belirleyin."
        columns={columns}
        fetchPage={qualityApi.rulesPaged}
        toolbarAction={{
          label: "Yeni kalite kuralı",
          run: async () => {
            resetForm();
            setOpen(true);
          },
        }}
      />
      {open && (
        <ResponsiveDialog
          onClose={() => setOpen(false)}
          title="Yeni kalite kuralı"
          className="!max-w-2xl"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Stok">
              <PagedLookupDialog<StockOption>
                variant="ops"
                autoSearchMinLength={2}
                open={stockLookupOpen}
                onOpenChange={setStockLookupOpen}
                title="Stok seçimi"
                value={stockDisplay}
                placeholder="Seçiniz"
                searchPlaceholder="Stok kod / ad ara…"
                emptyText="Stok bulunamadı."
                triggerClassName={OPS_FIELD_CLASS}
                queryKey={["quality-stocks-lookup", branch]}
                fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
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
            <Field label="Kontrol modu">
              <AppDropdown
                value={mode}
                onValueChange={setMode}
                portalContainer={null}
                options={["QuickCheck", "InspectionRequired"].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Field>
            <Field label="Örnekleme">
              <AppDropdown
                value={sampling}
                onValueChange={setSampling}
                portalContainer={null}
                options={[
                  "All",
                  "Percentage",
                  "FixedQuantity",
                  "EveryNthHandlingUnit",
                ].map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field label="Örnekleme değeri">
              <input
                className="input"
                type="number"
                min="0.000001"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            <Field label="Başarısızlık aksiyonu">
              <AppDropdown
                value={fail}
                onValueChange={setFail}
                portalContainer={null}
                options={[
                  "Quarantine",
                  "Reject",
                  "ReturnToSupplier",
                  "ManagerApproval",
                ].map((value) => ({ value, label: value }))}
              />
            </Field>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <OpsActionButton
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Vazgeç
            </OpsActionButton>
            <OpsActionButton
              type="button"
              variant="primary"
              onClick={() => void create()}
            >
              <Plus className="size-4" />
              Oluştur
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
