import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BoxIcon,
  Eye,
  Loader2,
  MoveRight,
  PackageCheck,
  PackageMinus,
  Plus,
  Printer,
  RotateCcw,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
} from "@/components/shared/AdvancedDataGrid";
import { AppDropdown } from "@/components/shared/AppDropdown";
import {
  systemColumns,
  requiredActionColumn,
} from "@/components/shared/GridSystemColumns";
import {
  OpsDialogBody,
  OpsDialogContent,
  OpsDialogFooter,
  OpsDialogHeader,
} from "@/components/shared/OpsDialogShell";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { localizeEnumValue } from "@/lib/enum-localization";
import {
  formatProjectDateTime,
  formatProjectNumber,
} from "@/lib/project-format";
import { packingApi } from "./packing-api";
import type {
  HandlingUnit,
  MaterialRow,
  PackingSourceDocumentOption,
  PackingSourceLine,
  PackingSourceType,
  SessionDetail,
  SessionRow,
  StationRow,
  UnitLine,
} from "./types";

const page = { page: 1, pageSize: 100, search: "", sorts: [], filters: [] };

function usePackingSourceLabels() {
  const { t } = useModuleTranslation("packing");
  return useMemo<Record<PackingSourceType, string>>(
    () => ({
      WarehouseOutbound: t("sourceTypes.warehouseOutbound"),
      Shipment: t("sourceTypes.shipment"),
      WarehouseTransfer: t("sourceTypes.warehouseTransfer"),
    }),
    [t],
  );
}

export function PackingWorkbenchPage() {
  const { t, moduleReady } = useModuleTranslation("packing");
  const sourceLabels = usePackingSourceLabels();
  const qc = useQueryClient();
  const [create, setCreate] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const open = async (id: number) => {
    setLoading(true);
    try {
      setDetail(await packingApi.detail(id));
    } catch (e) {
      toast.error(message(e, "Oturum açılamadı."));
    } finally {
      setLoading(false);
    }
  };
  const cols = useMemo<GridColumn<SessionRow>[]>(
    () => {
      if (!moduleReady) return [];
      return [
      ...systemColumns<SessionRow>(),
      {
        key: "packingNo",
        label: t("columns.packingNo"),
        render: (r) => r.packingNo,
      },
      {
        key: "sourceType",
        label: t("columns.sourceType"),
        render: (r) =>
          sourceLabels[r.sourceType as PackingSourceType] ?? r.sourceType,
      },
      {
        key: "sourceDocumentNo",
        label: t("columns.sourceDocumentNo"),
        render: (r) => r.sourceDocumentNo ?? "-",
      },
      {
        key: "customerCode",
        label: t("columns.customerCode"),
        render: (r) => r.customerCode ?? "-",
      },
      {
        key: "status",
        label: t("columns.status"),
        render: (r) => localizeEnumValue(r.status),
      },
      {
        key: "handlingUnitCount",
        label: t("columns.handlingUnitCount"),
        render: (r) => r.handlingUnitCount,
      },
      {
        key: "totalQuantity",
        label: t("columns.totalQuantity"),
        render: (r) => formatProjectNumber(r.totalQuantity),
      },
      {
        key: "totalGrossWeight",
        label: t("columns.totalGrossWeight"),
        render: (r) => formatProjectNumber(r.totalGrossWeight),
      },
      {
        key: "openedAtUtc",
        label: t("columns.openedAtUtc"),
        render: (r) => formatProjectDateTime(r.openedAtUtc),
      },
      {
        key: "actions",
        label: t("actions"),
        ...requiredActionColumn,
        render: (r) => (
          <button
            onClick={() => void open(r.id)}
            className="rounded-lg border p-2 text-cyan-500"
            title={t("open")}
          >
            <Eye className="size-4" />
          </button>
        ),
      },
    ];
    },
    [moduleReady, sourceLabels, t],
  );
  const refresh = async () => {
    await qc.invalidateQueries({
      queryKey: ["advanced-grid", "packing-sessions"],
    });
    if (detail) setDetail(await packingApi.detail(detail.header.id));
  };
  if (!moduleReady) {
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-cyan-500" />
      </section>
    );
  }
  return (
    <section className="relative space-y-4">
      <header className="rounded-2xl border bg-gradient-to-r from-cyan-500/10 via-[var(--wms-app-panel)] to-violet-500/10 p-4 sm:p-6">
        <div className="flex items-center gap-2 text-cyan-500">
          <PackageCheck />
          <span className="text-xs font-bold uppercase tracking-widest">
            {t("title")}
          </span>
        </div>
        <h1 className="mt-2 text-xl font-black sm:text-2xl">
          {t("workbench")}
        </h1>
        <p className="text-sm text-slate-500">{t("workbenchDescription")}</p>
      </header>
      <AdvancedDataGrid<SessionRow>
        pageKey="packing-sessions"
        title={t("workbench")}
        columns={cols}
        fetchPage={packingApi.sessions}
        toolbarAction={{
          label: t("newSession"),
          run: async () => setCreate(true),
        }}
      />
      {create && (
        <CreateSessionModal
          close={() => setCreate(false)}
          done={async (d) => {
            setCreate(false);
            await refresh();
            setDetail(d);
          }}
        />
      )}
      {detail && (
        <SessionModal
          detail={detail}
          close={() => setDetail(null)}
          refresh={refresh}
        />
      )}{" "}
      {loading && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Paketleme oturumu yükleniyor"
          className="absolute inset-0 z-[120] grid min-h-48 place-items-center rounded-2xl bg-black/30 backdrop-blur-[1px]"
        >
          <Loader2 className="size-8 animate-spin text-cyan-500" />
        </div>
      )}
    </section>
  );
}

function CreateSessionModal({
  close,
  done,
}: {
  close: () => void;
  done: (d: SessionDetail) => Promise<void>;
}) {
  const sourceLabels = usePackingSourceLabels();
  const [sourceType, setSourceType] =
    useState<PackingSourceType>("WarehouseOutbound");
  const [sources, setSources] = useState<PackingSourceDocumentOption[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [stationId, setStationId] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSourceId("");
    setStationId("");
    void Promise.all([
      packingApi.sourceDocuments(sourceType, page as never),
      packingApi.stations(page as never),
    ])
      .then(([o, s]) => {
        setSources(
          o.items.filter((x) =>
            sourceType === "WarehouseTransfer"
              ? ["Picked", "PartiallyPicked"].includes(x.status)
              : ["Picked", "Packing", "Packed"].includes(x.status),
          ),
        );
        setStations(s.items.filter((x) => x.isActive));
      })
      .catch((e: Error) => toast.error(e.message));
  }, [sourceType]);
  const selected = sources.find((x) => String(x.id) === sourceId);
  const validStations = stations.filter(
    (x) => !selected || x.warehouseId === selected.sourceWarehouseId,
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !stationId) {
      toast.error("Toplanmış kaynak belge ve paketleme istasyonu seçin.");
      return;
    }
    setSaving(true);
    try {
      await done(
        await packingApi.createSession({
          idempotencyKey: crypto.randomUUID(),
          branchCode: "0",
          sourceType,
          sourceHeaderId: selected.id,
          warehouseId: selected.sourceWarehouseId,
          packingStationId: Number(stationId),
          notes: null,
        }),
      );
    } catch (x) {
      toast.error(message(x, "Oturum açılamadı."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <OpsDialogContent size="lg">
        <OpsDialogHeader>
          <DialogTitle className="wms-ops-detail-dialog__title">Paketleme oturumu aç</DialogTitle>
        </OpsDialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <OpsDialogBody className="space-y-4">
          <Field label="Kaynak tipi">
            <AppDropdown
              value={sourceType}
              onValueChange={(v) => setSourceType(v as PackingSourceType)}
              options={Object.entries(sourceLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Field>
          <Field label="Toplanmış kaynak belge">
            <AppDropdown
              value={sourceId}
              onValueChange={(v) => {
                setSourceId(v);
                setStationId("");
              }}
              searchable
              options={sources.map((x) => ({
                value: String(x.id),
                label: `${x.documentNo} · ${localizeEnumValue(x.status)}`,
              }))}
            />
          </Field>
          <Field label="Paketleme istasyonu">
            <AppDropdown
              value={stationId}
              onValueChange={setStationId}
              searchable
              options={validStations.map((x) => ({
                value: String(x.id),
                label: `${x.code} · ${x.name}`,
              }))}
            />
          </Field>
          </OpsDialogBody>
          <OpsDialogFooter>
            <button
              type="button"
              onClick={close}
              className="rounded-xl border px-4 py-2"
            >
              Vazgeç
            </button>
            <button
              disabled={saving}
              className="rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-950"
            >
              {saving ? "Açılıyor…" : "Oturumu aç"}
            </button>
          </OpsDialogFooter>
        </form>
      </OpsDialogContent>
    </Dialog>
  );
}

function SessionModal({
  detail,
  close,
  refresh,
}: {
  detail: SessionDetail;
  close: () => void;
  refresh: () => Promise<void>;
}) {
  const sourceLabels = usePackingSourceLabels();
  const [add, setAdd] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent
        tone="ops"
        portalRoot="body"
        className="max-h-[calc(100%-2rem)] w-full !max-w-6xl overflow-hidden p-0"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b bg-[var(--wms-app-panel)] p-5 pr-14">
          <div>
            <DialogTitle className="wms-ops-detail-dialog__title text-xl">
              {detail.header.packingNo}
            </DialogTitle>
            <p className="text-sm text-slate-500">
              {sourceLabels[detail.header.sourceType as PackingSourceType]} ·{" "}
              {detail.header.sourceDocumentNo} ·{" "}
              {localizeEnumValue(detail.header.status)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAdd(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-950"
            >
              <Plus className="size-4" />
              Koli / palet aç
            </button>
          </div>
        </header>
        <div className="wms-ops-scrollbar max-h-[calc(100%-5rem)] overflow-auto">
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          {detail.handlingUnits.map((u) => (
            <UnitCard
              key={u.id}
              sessionId={detail.header.id}
              unit={u}
              units={detail.handlingUnits}
              refresh={refresh}
            />
          ))}
        </div>
        {!detail.handlingUnits.length && (
          <div className="p-10 text-center text-slate-500">
            Henüz koli veya palet açılmadı.
          </div>
        )}
        </div>
        {add && (
          <CreateUnitModal
            sessionId={detail.header.id}
            units={detail.handlingUnits}
            close={() => setAdd(false)}
            done={async () => {
              setAdd(false);
              await refresh();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UnitCard({
  sessionId,
  unit,
  units,
  refresh,
}: {
  sessionId: number;
  unit: HandlingUnit;
  units: HandlingUnit[];
  refresh: () => Promise<void>;
}) {
  const [pack, setPack] = useState(false);
  const [measured, setMeasured] = useState(
    unit.measuredGrossWeight ? String(unit.measuredGrossWeight) : "",
  );
  const [targetId, setTargetId] = useState("");
  const busy = unit.status !== "Open";
  const closeUnit = async () => {
    const value = measured.trim() === "" ? null : Number(measured);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      toast.error("Geçerli bir brüt ağırlık girin.");
      return;
    }
    try {
      await packingApi.close(unit.id, {
        idempotencyKey: crypto.randomUUID(),
        measuredGrossWeight: value,
        reason: null,
      });
      toast.success("Paket kapatıldı.");
      await refresh();
    } catch (e) {
      toast.error(message(e, "Paket kapatılamadı."));
    }
  };
  const reopen = async () => {
    try {
      await packingApi.reopen(unit.id);
      toast.success("Paket yeniden açıldı.");
      await refresh();
    } catch (e) {
      toast.error(message(e, "Paket açılamadı."));
    }
  };
  const readScale = async () => {
    try {
      const reading = await packingApi.readScale(unit.id);
      setMeasured(String(reading.grossWeight));
      toast.success(
        `Stabil tartım: ${formatProjectNumber(reading.grossWeight)}`,
      );
    } catch (e) {
      toast.error(message(e, "Terazi okunamadı."));
    }
  };
  const print = async () => {
    try {
      const job = await packingApi.print(unit.id);
      toast.success(`Etiket işi kuyruğa alındı (#${job.id}).`);
    } catch (e) {
      toast.error(message(e, "Etiket kuyruğa alınamadı."));
    }
  };
  const unpack = async (line: UnitLine) => {
    try {
      await packingApi.unpack(unit.id, {
        idempotencyKey: crypto.randomUUID(),
        handlingUnitLineId: line.id,
        quantity: line.quantity,
        reason: "Operatör düzeltmesi",
      });
      toast.success("Satır paketten çıkarıldı.");
      await refresh();
    } catch (e) {
      toast.error(message(e, "Satır çıkarılamadı."));
    }
  };
  const move = async (line: UnitLine) => {
    if (!targetId) {
      toast.error("Önce hedef paketi seçin.");
      return;
    }
    try {
      await packingApi.move(unit.id, {
        idempotencyKey: crypto.randomUUID(),
        handlingUnitLineId: line.id,
        targetHandlingUnitId: Number(targetId),
        quantity: line.quantity,
        reason: "Operatör repack işlemi",
      });
      toast.success("Satır hedef pakete taşındı.");
      await refresh();
    } catch (e) {
      toast.error(message(e, "Satır taşınamadı."));
    }
  };
  const targets = units.filter((x) => x.id !== unit.id && x.status === "Open");
  return (
    <article className="rounded-2xl border p-4">
      <div className="flex justify-between gap-3">
        <div className="flex gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-cyan-500/10 text-cyan-500">
            <BoxIcon />
          </div>
          <div>
            <h3 className="font-black">{unit.handlingUnitNo}</h3>
            <p className="font-mono text-xs text-slate-500">
              {unit.sscc || "SSCC yok"}
            </p>
          </div>
        </div>
        <span className="h-fit rounded-full bg-slate-500/10 px-3 py-1 text-xs font-bold">
          {localizeEnumValue(unit.status)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Metric label="Satır" value={unit.lines.length} />
        <Metric
          label="Miktar"
          value={formatProjectNumber(
            unit.lines.reduce((s, x) => s + x.quantity, 0),
          )}
        />
        <Metric label="Brüt" value={formatProjectNumber(unit.grossWeight)} />
      </div>
      {!busy && targets.length > 0 && (
        <div className="mt-3">
          <AppDropdown
            value={targetId}
            onValueChange={setTargetId}
            options={[
              { value: "", label: "Repack hedef paketi seçin" },
              ...targets.map((x) => ({
                value: String(x.id),
                label: x.handlingUnitNo,
              })),
            ]}
          />
        </div>
      )}
      <div className="mt-3 space-y-1">
        {unit.lines.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-slate-500/5 px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">
              {l.stockCode}
              {l.serialNo ? ` · ${l.serialNo}` : l.lotNo ? ` · ${l.lotNo}` : ""}
            </span>
            <b className="whitespace-nowrap">
              {formatProjectNumber(l.quantity)} {l.unitCode}
            </b>
            {!busy && (
              <div className="flex gap-1">
                <button
                  onClick={() => void unpack(l)}
                  className="rounded-lg border p-1.5 text-amber-500"
                  title="Paketten çıkar"
                >
                  <PackageMinus className="size-4" />
                </button>
                {targets.length > 0 && (
                  <button
                    onClick={() => void move(l)}
                    className="rounded-lg border p-1.5 text-cyan-500"
                    title="Başka pakete taşı"
                  >
                    <MoveRight className="size-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {!busy && (
          <>
            <input
              className="input !w-36"
              type="number"
              min="0"
              step="any"
              placeholder="Brüt ağırlık"
              value={measured}
              onChange={(e) => setMeasured(e.target.value)}
            />
            <button
              onClick={() => void readScale()}
              className="rounded-xl border p-2"
              title="Teraziden oku"
            >
              <Scale className="size-4" />
            </button>
            <button
              onClick={() => setPack(true)}
              className="rounded-xl border px-3 py-2 text-sm font-bold"
            >
              Ürün ekle
            </button>
            <button
              onClick={() => void closeUnit()}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
            >
              Kapat
            </button>
          </>
        )}
        {["Closed", "Released"].includes(unit.status) && (
          <>
            <button
              onClick={() => void print()}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"
            >
              <Printer className="size-4" />
              Etiket bas
            </button>
            <button
              onClick={() => void reopen()}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"
            >
              <RotateCcw className="size-4" />
              Yeniden aç
            </button>
          </>
        )}
      </div>
      {pack && (
        <PackLineModal
          sessionId={sessionId}
          unitId={unit.id}
          close={() => setPack(false)}
          done={async () => {
            setPack(false);
            await refresh();
          }}
        />
      )}
    </article>
  );
}

function CreateUnitModal({
  sessionId,
  units,
  close,
  done,
}: {
  sessionId: number;
  units: HandlingUnit[];
  close: () => void;
  done: () => Promise<void>;
}) {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [materialId, setMaterialId] = useState("");
  const [parentId, setParentId] = useState("");
  useEffect(() => {
    void packingApi
      .materials(page as never)
      .then((x) => setMaterials(x.items.filter((y) => y.isActive)))
      .catch((e: Error) => toast.error(e.message));
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await packingApi.createUnit(sessionId, {
        idempotencyKey: crypto.randomUUID(),
        packagingMaterialId: Number(materialId),
        parentHandlingUnitId: parentId ? Number(parentId) : null,
        handlingUnitNo: null,
        sscc: null,
        length: null,
        width: null,
        height: null,
      });
      await done();
    } catch (x) {
      toast.error(message(x, "Paket açılamadı."));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <OpsDialogContent size="md">
        <OpsDialogHeader>
          <DialogTitle className="wms-ops-detail-dialog__title">Koli / palet aç</DialogTitle>
        </OpsDialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <OpsDialogBody className="space-y-4">
          <Field label="Ambalaj malzemesi">
            <AppDropdown
              value={materialId}
              onValueChange={setMaterialId}
              searchable
              options={materials.map((x) => ({
                value: String(x.id),
                label: `${x.code} · ${x.name}`,
              }))}
            />
          </Field>
          <Field label="Üst paket (opsiyonel)">
            <AppDropdown
              value={parentId}
              onValueChange={setParentId}
              searchable
              options={[
                { value: "", label: "Üst paket yok" },
                ...units
                  .filter((x) => x.status === "Open")
                  .map((x) => ({
                    value: String(x.id),
                    label: x.handlingUnitNo,
                  })),
              ]}
            />
          </Field>
          </OpsDialogBody>
          <OpsDialogFooter>
          <button className="w-full rounded-xl bg-cyan-500 py-2 font-bold text-slate-950">
            Aç
          </button>
          </OpsDialogFooter>
        </form>
      </OpsDialogContent>
    </Dialog>
  );
}

function PackLineModal({
  sessionId,
  unitId,
  close,
  done,
}: {
  sessionId: number;
  unitId: number;
  close: () => void;
  done: () => Promise<void>;
}) {
  const [lines, setLines] = useState<PackingSourceLine[]>([]);
  const [f, setF] = useState({
    sourceLineId: "",
    quantity: "1",
    lotNo: "",
    serialNo: "",
  });
  useEffect(() => {
    void packingApi
      .sourceLines(sessionId)
      .then(setLines)
      .catch((e: Error) => toast.error(e.message));
  }, [sessionId]);
  const selected = lines.find((x) => String(x.id) === f.sourceLineId);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await packingApi.pack(unitId, {
        idempotencyKey: crypto.randomUUID(),
        sourceLineId: Number(f.sourceLineId),
        quantity: Number(f.quantity),
        lotNo: f.lotNo || null,
        serialNo: f.serialNo || null,
      });
      await done();
    } catch (x) {
      toast.error(message(x, "Ürün eklenemedi."));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <OpsDialogContent size="lg">
        <OpsDialogHeader>
          <DialogTitle className="wms-ops-detail-dialog__title">Pakete ürün ekle</DialogTitle>
        </OpsDialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <OpsDialogBody className="grid gap-3 md:grid-cols-2">
          <Field label="Paketlenebilir kaynak satırı">
            <AppDropdown
              value={f.sourceLineId}
              onValueChange={(v) => {
                const line = lines.find((x) => String(x.id) === v);
                setF((x) => ({
                  ...x,
                  sourceLineId: v,
                  quantity: String(line?.remainingQuantity ?? 1),
                }));
              }}
              searchable
              options={lines.map((x) => ({
                value: String(x.id),
                label: `${x.lineNo} · ${x.stockCode} · Kalan ${formatProjectNumber(x.remainingQuantity)} ${x.unitCode}`,
              }))}
            />
          </Field>
          <Field label="Miktar">
            <input
              className="input"
              type="number"
              min="0.000001"
              max={selected?.remainingQuantity}
              value={f.quantity}
              onChange={(e) =>
                setF((x) => ({ ...x, quantity: e.target.value }))
              }
            />
          </Field>
          <Field label="Lot">
            <input
              className="input"
              value={f.lotNo}
              onChange={(e) => setF((x) => ({ ...x, lotNo: e.target.value }))}
            />
          </Field>
          <Field label="Seri">
            <input
              className="input"
              value={f.serialNo}
              onChange={(e) =>
                setF((x) => ({ ...x, serialNo: e.target.value }))
              }
            />
          </Field>
          </OpsDialogBody>
          <OpsDialogFooter>
          <button className="w-full rounded-xl bg-cyan-500 py-2 font-bold text-slate-950 md:col-span-2">
            Ürünü ekle
          </button>
          </OpsDialogFooter>
        </form>
      </OpsDialogContent>
    </Dialog>
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
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-500/5 p-2">
      <span className="block text-xs text-slate-500">{label}</span>
      <b>{value}</b>
    </div>
  );
}
function message(value: unknown, fallback: string) {
  return value instanceof Error ? value.message : fallback;
}
