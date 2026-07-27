import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
} from "@/components/shared/AdvancedDataGrid";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import {
  systemColumns,
  requiredActionColumn,
} from "@/components/shared/GridSystemColumns";
import { OpsStatusBadge } from "@/components/shared/OpsStatusBadge";
import { useAuthStore } from "@/stores/auth-store";
import { qualityApi, type QualityRule } from "../api/quality.api";
import { localizeEnumValue } from "@/lib/enum-localization";
export function QualityRulesPage() {
  const branch = useAuthStore((s) => s.branch?.code ?? "0");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [stock, setStock] = useState("");
  const [mode, setMode] = useState("InspectionRequired");
  const [sampling, setSampling] = useState("All");
  const [value, setValue] = useState("100");
  const [fail, setFail] = useState("Quarantine");
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
    if (!stock) return;
    const [id] = stock.split("|");
    try {
      await qualityApi.createRule({
        branchCode: branch,
        scopeType: "Stock",
        stockId: Number(id),
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
      setStock("");
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
          <h2 className="text-xl font-bold">Yeni kalite kuralı</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Stok">
              <PagedAppDropdown
                queryKey={["quality-stocks", branch]}
                fetchPage={(r) => qualityApi.stocks(r, branch)}
                toOption={(x) => ({
                  value: `${x.id}|${x.erpStockCode}`,
                  label: `${x.erpStockCode} · ${x.stockName}`,
                })}
                value={stock}
                onValueChange={setStock}
                searchable
                minSearchLength={2}
              />
            </Field>
            <Field label="Kontrol modu">
              <AppDropdown
                value={mode}
                onValueChange={setMode}
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
            <button
              className="min-h-11 rounded-xl border px-4 py-2"
              onClick={() => setOpen(false)}
            >
              Vazgeç
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white"
              onClick={() => void create()}
            >
              <Plus className="size-4" />
              Oluştur
            </button>
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
    <label className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}
