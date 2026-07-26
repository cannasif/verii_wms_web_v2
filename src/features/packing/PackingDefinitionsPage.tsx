import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
} from "@/components/shared/AdvancedDataGrid";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import {
  systemColumns,
  requiredActionColumn,
} from "@/components/shared/GridSystemColumns";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { packingApi } from "./packing-api";
import type {
  MaterialRow,
  MaterialType,
  SpecificationRow,
  StationRow,
} from "./types";

type Tab = "materials" | "stations" | "specifications";
type Editable = MaterialRow | StationRow | SpecificationRow;

export function PackingDefinitionsPage() {
  const { t } = useModuleTranslation("packing");
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("materials");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Editable | null>(null);
  const open = (row: Editable | null = null) => {
    setEditing(row);
    setModal(true);
  };
  const invalidate = async () =>
    qc.invalidateQueries({ queryKey: ["advanced-grid", gridKey(tab)] });
  const remove = async (id: number) => {
    if (!window.confirm("Bu tanımı silmek istediğinize emin misiniz?")) return;
    try {
      if (tab === "materials") await packingApi.deleteMaterial(id);
      else if (tab === "stations") await packingApi.deleteStation(id);
      else await packingApi.deleteSpecification(id);
      toast.success("Kayıt silindi.");
      await invalidate();
    } catch (error) {
      toast.error(message(error));
    }
  };
  const actions = (row: Editable) => (
    <div className="flex gap-1">
      <button
        title="Düzenle"
        className="rounded-lg border p-2 text-cyan-500"
        onClick={() => open(row)}
      >
        <Pencil className="size-4" />
      </button>
      <button
        title="Sil"
        className="rounded-lg border p-2 text-rose-500"
        onClick={() => void remove(row.id)}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
  const materialColumns: GridColumn<MaterialRow>[] = [
    ...systemColumns<MaterialRow>(),
    { key: "code", label: "Kod", render: (r) => r.code },
    { key: "name", label: "Ad", render: (r) => r.name },
    { key: "type", label: "Tip", render: (r) => r.type },
    { key: "tareWeight", label: "Dara", render: (r) => r.tareWeight },
    {
      key: "maxNetWeight",
      label: "Azami net",
      render: (r) => r.maxNetWeight ?? "-",
    },
    {
      key: "maxGrossWeight",
      label: "Azami brüt",
      render: (r) => r.maxGrossWeight ?? "-",
    },
    {
      key: "maxVolume",
      label: "Azami hacim",
      render: (r) => r.maxVolume ?? "-",
    },
    {
      key: "isReturnable",
      label: "İadeli",
      render: (r) => (r.isReturnable ? "Evet" : "Hayır"),
    },
    {
      key: "isActive",
      label: "Aktif",
      render: (r) => (r.isActive ? "Aktif" : "Pasif"),
    },
    {
      key: "actions",
      label: t("actions"),
      ...requiredActionColumn,
      render: (r) => actions(r),
    },
  ];
  const stationColumns: GridColumn<StationRow>[] = [
    ...systemColumns<StationRow>(),
    { key: "code", label: "Kod", render: (r) => r.code },
    { key: "name", label: "Ad", render: (r) => r.name },
    { key: "warehouseId", label: "Depo", render: (r) => r.warehouseId },
    { key: "locationId", label: "Raf", render: (r) => r.locationId ?? "-" },
    {
      key: "scaleDeviceCode",
      label: "Tartı cihazı",
      render: (r) => r.scaleDeviceCode ?? "-",
    },
    {
      key: "printerDefinitionId",
      label: "Yazıcı",
      render: (r) => r.printerDefinitionId ?? "-",
    },
    {
      key: "isActive",
      label: "Aktif",
      render: (r) => (r.isActive ? "Aktif" : "Pasif"),
    },
    {
      key: "actions",
      label: t("actions"),
      ...requiredActionColumn,
      render: (r) => actions(r),
    },
  ];
  const specificationColumns: GridColumn<SpecificationRow>[] = [
    ...systemColumns<SpecificationRow>(),
    {
      key: "packagingMaterialCode",
      label: "Ambalaj",
      render: (r) => `${r.packagingMaterialCode} · ${r.packagingMaterialName}`,
    },
    {
      key: "stockCode",
      label: "Stok",
      render: (r) =>
        r.stockCode ? `${r.stockCode} · ${r.stockName ?? ""}` : "Tümü",
    },
    {
      key: "stockGroupCode",
      label: "Stok grubu",
      render: (r) => r.stockGroupCode ?? "Tümü",
    },
    {
      key: "customerCode",
      label: "Müşteri",
      render: (r) =>
        r.customerCode ? `${r.customerCode} · ${r.customerName ?? ""}` : "Tümü",
    },
    {
      key: "unitsPerHandlingUnit",
      label: "Paket başına",
      render: (r) => r.unitsPerHandlingUnit ?? "-",
    },
    {
      key: "maxNetWeight",
      label: "Azami net",
      render: (r) => r.maxNetWeight ?? "-",
    },
    {
      key: "maxVolume",
      label: "Azami hacim",
      render: (r) => r.maxVolume ?? "-",
    },
    { key: "priority", label: "Öncelik", render: (r) => r.priority },
    {
      key: "isActive",
      label: "Aktif",
      render: (r) => (r.isActive ? "Aktif" : "Pasif"),
    },
    {
      key: "actions",
      label: t("actions"),
      ...requiredActionColumn,
      render: (r) => actions(r),
    },
  ];
  return (
    <section className="space-y-4">
      <header className="rounded-2xl border bg-[var(--wms-app-panel)] p-5">
        <div className="flex items-center gap-2 text-cyan-500">
          <Boxes />
          <span className="text-xs font-bold uppercase tracking-widest">
            {t("title")}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-black">{t("definitions")}</h1>
        <p className="text-sm text-slate-500">
          Ambalaj, istasyon ve stok/müşteri bazlı paketleme kapasite kurallarını
          tek yerden yönetin.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {(["materials", "stations", "specifications"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === value ? "bg-cyan-500 text-slate-950" : "border"}`}
          >
            {value === "materials"
              ? t("materials")
              : value === "stations"
                ? t("stations")
                : "Paketleme spesifikasyonları"}
          </button>
        ))}
      </div>
      {tab === "materials" && (
        <AdvancedDataGrid<MaterialRow>
          pageKey={gridKey(tab)}
          title={t("materials")}
          columns={materialColumns}
          fetchPage={packingApi.materials}
          toolbarAction={{ label: t("newMaterial"), run: async () => open() }}
        />
      )}
      {tab === "stations" && (
        <AdvancedDataGrid<StationRow>
          pageKey={gridKey(tab)}
          title={t("stations")}
          columns={stationColumns}
          fetchPage={packingApi.stations}
          toolbarAction={{ label: t("newStation"), run: async () => open() }}
        />
      )}
      {tab === "specifications" && (
        <AdvancedDataGrid<SpecificationRow>
          pageKey={gridKey(tab)}
          title="Paketleme spesifikasyonları"
          description="Öncelik ve kapsam eşleşmesine göre paket kapasitesini belirler."
          columns={specificationColumns}
          fetchPage={packingApi.specifications}
          toolbarAction={{
            label: "Yeni spesifikasyon",
            run: async () => open(),
          }}
        />
      )}
      {modal && (
        <DefinitionModal
          kind={tab}
          editing={editing}
          close={() => setModal(false)}
          done={async () => {
            setModal(false);
            await invalidate();
          }}
        />
      )}
    </section>
  );
}

function DefinitionModal({
  kind,
  editing,
  close,
  done,
}: {
  kind: Tab;
  editing: Editable | null;
  close: () => void;
  done: () => Promise<void>;
}) {
  const initial = toForm(kind, editing);
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (kind === "materials") {
        const payload = {
          branchCode: f.branchCode,
          code: f.code,
          name: f.name,
          type: f.type,
          tareWeight: num(f.tareWeight) ?? 0,
          maxNetWeight: num(f.maxNetWeight),
          maxGrossWeight: num(f.maxGrossWeight),
          innerLength: num(f.innerLength),
          innerWidth: num(f.innerWidth),
          innerHeight: num(f.innerHeight),
          maxVolume: num(f.maxVolume),
          isReturnable: f.isReturnable,
          isActive: f.isActive,
          description: empty(f.description),
        };
        if (editing) await packingApi.updateMaterial(editing.id, payload);
        else await packingApi.createMaterial(payload);
      } else if (kind === "stations") {
        const payload = {
          branchCode: f.branchCode,
          warehouseId: Number(f.warehouseId),
          locationId: num(f.locationId),
          code: f.code,
          name: f.name,
          scaleDeviceCode: empty(f.scaleDeviceCode),
          printerDefinitionId: num(f.printerDefinitionId),
          isActive: f.isActive,
          description: empty(f.description),
        };
        if (editing) await packingApi.updateStation(editing.id, payload);
        else await packingApi.createStation(payload);
      } else {
        const payload = {
          branchCode: f.branchCode,
          stockId: num(f.stockId),
          stockGroupCode: empty(f.stockGroupCode)?.toUpperCase() ?? null,
          customerId: num(f.customerId),
          packagingMaterialId: Number(f.packagingMaterialId),
          unitsPerHandlingUnit: num(f.unitsPerHandlingUnit),
          maxNetWeight: num(f.maxNetWeight),
          maxVolume: num(f.maxVolume),
          priority: Number(f.priority),
          isActive: f.isActive,
          notes: empty(f.notes),
        };
        if (editing) await packingApi.updateSpecification(editing.id, payload);
        else await packingApi.createSpecification(payload);
      }
      toast.success(editing ? "Kayıt güncellendi." : "Kayıt oluşturuldu.");
      await done();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setSaving(false);
    }
  };
  const patch = (value: Partial<FormState>) =>
    setF((current) => ({ ...current, ...value }));
  const input = (key: keyof FormState, label: string, type = "text") => (
    <Field label={label}>
      <input
        className="input"
        type={type}
        step={type === "number" ? "0.000001" : undefined}
        value={String(f[key] ?? "")}
        onChange={(event) => patch({ [key]: event.target.value })}
      />
    </Field>
  );
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="!max-w-3xl bg-[var(--wms-app-panel)]">
        <DialogTitle>{title(kind, Boolean(editing))}</DialogTitle>
        <form
          onSubmit={submit}
          className="grid max-h-[75vh] gap-4 overflow-auto p-1 md:grid-cols-2"
        >
          {input("branchCode", "Şube kodu")}
          {kind === "materials" && (
            <>
              {input("code", "Kod")}
              {input("name", "Ad")}
              <Field label="Tip">
                <AppDropdown
                  value={f.type}
                  onValueChange={(type) => patch({ type })}
                  options={(
                    [
                      "Box",
                      "Pallet",
                      "Crate",
                      "Bag",
                      "Envelope",
                      "Drum",
                      "ReturnableContainer",
                      "Other",
                    ] as MaterialType[]
                  ).map((value) => ({ value, label: value }))}
                  searchable
                />
              </Field>
              {input("tareWeight", "Dara", "number")}
              {input("maxNetWeight", "Azami net ağırlık", "number")}
              {input("maxGrossWeight", "Azami brüt ağırlık", "number")}
              {input("innerLength", "İç uzunluk", "number")}
              {input("innerWidth", "İç genişlik", "number")}
              {input("innerHeight", "İç yükseklik", "number")}
              {input("maxVolume", "Azami hacim", "number")}
              {input("description", "Açıklama")}
              <Check
                label="İadeli ambalaj"
                value={f.isReturnable}
                set={(value) => patch({ isReturnable: value })}
              />
              <Check
                label="Aktif"
                value={f.isActive}
                set={(value) => patch({ isActive: value })}
              />
            </>
          )}
          {kind === "stations" && (
            <>
              {input("code", "Kod")}
              {input("name", "Ad")}
              <Field label="Depo">
                <PagedAppDropdown
                  queryKey={["packing-warehouses", f.branchCode]}
                  fetchPage={(request) =>
                    packingApi.warehouseOptions(request, f.branchCode)
                  }
                  toOption={(item) => ({
                    value: String(item.id),
                    label: `${item.warehouseCode} · ${item.warehouseName}`,
                  })}
                  selectedOption={
                    f.warehouseId
                      ? {
                          value: f.warehouseId,
                          label: `Depo #${f.warehouseId}`,
                        }
                      : undefined
                  }
                  value={f.warehouseId || null}
                  onValueChange={(warehouseId) =>
                    patch({ warehouseId: warehouseId ?? "", locationId: "" })
                  }
                  searchable
                />
              </Field>
              <Field label="Paketleme rafı">
                <PagedAppDropdown
                  queryKey={["packing-locations", f.warehouseId]}
                  fetchPage={(request) =>
                    packingApi.locationOptions(request, Number(f.warehouseId))
                  }
                  toOption={(item) => ({
                    value: String(item.id),
                    label: `${item.code} · ${item.name}`,
                    description: item.locationType,
                  })}
                  enabled={Boolean(f.warehouseId)}
                  selectedOption={
                    f.locationId
                      ? { value: f.locationId, label: `Raf #${f.locationId}` }
                      : undefined
                  }
                  value={f.locationId || null}
                  onValueChange={(locationId) =>
                    patch({ locationId: locationId ?? "" })
                  }
                  searchable
                />
              </Field>
              {input("scaleDeviceCode", "Tartı cihaz kodu")}
              {input("printerDefinitionId", "Yazıcı tanım ID", "number")}
              {input("description", "Açıklama")}
              <Check
                label="Aktif"
                value={f.isActive}
                set={(value) => patch({ isActive: value })}
              />
            </>
          )}
          {kind === "specifications" && (
            <>
              <Field label="Ambalaj malzemesi">
                <PagedAppDropdown
                  queryKey={["packing-material-options", f.branchCode]}
                  fetchPage={(request) =>
                    packingApi.materialOptions(request, f.branchCode)
                  }
                  toOption={(item) => ({
                    value: String(item.id),
                    label: `${item.code} · ${item.name}`,
                  })}
                  selectedOption={
                    f.packagingMaterialId
                      ? {
                          value: f.packagingMaterialId,
                          label:
                            f.packagingMaterialLabel ||
                            `Ambalaj #${f.packagingMaterialId}`,
                        }
                      : undefined
                  }
                  value={f.packagingMaterialId || null}
                  onValueChange={(packagingMaterialId) =>
                    patch({ packagingMaterialId: packagingMaterialId ?? "" })
                  }
                  searchable
                />
              </Field>
              <Field label="Stok (opsiyonel)">
                <PagedAppDropdown
                  queryKey={["packing-stock-options", f.branchCode]}
                  fetchPage={(request) =>
                    packingApi.stockOptions(request, f.branchCode)
                  }
                  toOption={(item) => ({
                    value: String(item.id),
                    label: `${item.erpStockCode} · ${item.stockName ?? ""}`,
                  })}
                  selectedOption={
                    f.stockId
                      ? {
                          value: f.stockId,
                          label: f.stockLabel || `Stok #${f.stockId}`,
                        }
                      : undefined
                  }
                  value={f.stockId || null}
                  onValueChange={(stockId) => patch({ stockId: stockId ?? "" })}
                  searchable
                  minSearchLength={2}
                />
              </Field>
              {input("stockGroupCode", "Stok grubu (opsiyonel)")}
              <Field label="Müşteri (opsiyonel)">
                <PagedAppDropdown
                  queryKey={["packing-customer-options", f.branchCode]}
                  fetchPage={(request) =>
                    packingApi.customerOptions(request, f.branchCode)
                  }
                  toOption={(item) => ({
                    value: String(item.id),
                    label: `${item.customerCode} · ${item.customerName}`,
                  })}
                  selectedOption={
                    f.customerId
                      ? {
                          value: f.customerId,
                          label: f.customerLabel || `Müşteri #${f.customerId}`,
                        }
                      : undefined
                  }
                  value={f.customerId || null}
                  onValueChange={(customerId) =>
                    patch({ customerId: customerId ?? "" })
                  }
                  searchable
                  minSearchLength={2}
                />
              </Field>
              {input("unitsPerHandlingUnit", "Paket başına miktar", "number")}
              {input("maxNetWeight", "Azami net ağırlık", "number")}
              {input("maxVolume", "Azami hacim", "number")}
              {input("priority", "Öncelik", "number")}
              {input("notes", "Not")}
              <Check
                label="Aktif"
                value={f.isActive}
                set={(value) => patch({ isActive: value })}
              />
              <p className="md:col-span-2 rounded-xl border p-3 text-xs text-slate-500">
                Stok, stok grubu ve müşteri boş bırakılırsa şube geneli
                varsayılan kural oluşur. Öncelik yüksek olan kural önce
                değerlendirilir; eşitlikte daha özel kapsam kazanır.
              </p>
            </>
          )}
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border px-4 py-2"
            >
              Vazgeç
            </button>
            <button
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-950 disabled:opacity-50"
            >
              <Plus className="size-4" />
              {editing ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FormState {
  branchCode: string;
  code: string;
  name: string;
  type: string;
  tareWeight: string;
  maxNetWeight: string;
  maxGrossWeight: string;
  innerLength: string;
  innerWidth: string;
  innerHeight: string;
  maxVolume: string;
  isReturnable: boolean;
  isActive: boolean;
  description: string;
  warehouseId: string;
  locationId: string;
  scaleDeviceCode: string;
  printerDefinitionId: string;
  stockId: string;
  stockLabel: string;
  stockGroupCode: string;
  customerId: string;
  customerLabel: string;
  packagingMaterialId: string;
  packagingMaterialLabel: string;
  unitsPerHandlingUnit: string;
  priority: string;
  notes: string;
}
function toForm(kind: Tab, row: Editable | null): FormState {
  const base: FormState = {
    branchCode: "0",
    code: "",
    name: "",
    type: "Box",
    tareWeight: "0",
    maxNetWeight: "",
    maxGrossWeight: "",
    innerLength: "",
    innerWidth: "",
    innerHeight: "",
    maxVolume: "",
    isReturnable: false,
    isActive: true,
    description: "",
    warehouseId: "",
    locationId: "",
    scaleDeviceCode: "",
    printerDefinitionId: "",
    stockId: "",
    stockLabel: "",
    stockGroupCode: "",
    customerId: "",
    customerLabel: "",
    packagingMaterialId: "",
    packagingMaterialLabel: "",
    unitsPerHandlingUnit: "",
    priority: "100",
    notes: "",
  };
  if (!row) return base;
  if (kind === "materials") {
    const value = row as MaterialRow;
    return {
      ...base,
      ...strings(value, [
        "code",
        "name",
        "type",
        "tareWeight",
        "maxNetWeight",
        "maxGrossWeight",
        "innerLength",
        "innerWidth",
        "innerHeight",
        "maxVolume",
        "description",
      ]),
      branchCode: value.branchCode,
      isReturnable: value.isReturnable,
      isActive: value.isActive,
    };
  }
  if (kind === "stations") {
    const value = row as StationRow;
    return {
      ...base,
      ...strings(value, [
        "code",
        "name",
        "warehouseId",
        "locationId",
        "scaleDeviceCode",
        "printerDefinitionId",
        "description",
      ]),
      branchCode: value.branchCode,
      isActive: value.isActive,
    };
  }
  const value = row as SpecificationRow;
  return {
    ...base,
    branchCode: value.branchCode,
    stockId: text(value.stockId),
    stockLabel: value.stockCode
      ? `${value.stockCode} · ${value.stockName ?? ""}`
      : "",
    stockGroupCode: value.stockGroupCode ?? "",
    customerId: text(value.customerId),
    customerLabel: value.customerCode
      ? `${value.customerCode} · ${value.customerName ?? ""}`
      : "",
    packagingMaterialId: String(value.packagingMaterialId),
    packagingMaterialLabel: `${value.packagingMaterialCode} · ${value.packagingMaterialName}`,
    unitsPerHandlingUnit: text(value.unitsPerHandlingUnit),
    maxNetWeight: text(value.maxNetWeight),
    maxVolume: text(value.maxVolume),
    priority: String(value.priority),
    isActive: value.isActive,
    notes: value.notes ?? "",
  };
}
function strings<T extends object>(value: T, keys: (keyof T)[]) {
  return Object.fromEntries(keys.map((key) => [key, text(value[key])]));
}
function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}
function num(value: string) {
  return value.trim() === "" ? null : Number(value);
}
function empty(value: string) {
  return value.trim() === "" ? null : value.trim();
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "İşlem tamamlanamadı.";
}
function gridKey(tab: Tab) {
  return tab === "materials"
    ? "packing-materials"
    : tab === "stations"
      ? "packing-stations"
      : "packing-specifications";
}
function title(kind: Tab, editing: boolean) {
  const subject =
    kind === "materials"
      ? "ambalaj malzemesi"
      : kind === "stations"
        ? "paketleme istasyonu"
        : "paketleme spesifikasyonu";
  return `${editing ? "Düzenle" : "Yeni"} ${subject}`;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}
function Check({
  label,
  value,
  set,
}: {
  label: string;
  value: boolean;
  set: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm">
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => set(event.target.checked)}
      />
      {label}
    </label>
  );
}
