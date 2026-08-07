import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import {
  ArrowDown,
  ArrowUp,
  Barcode,
  Boxes,
  FileText,
  Layers3,
  Loader2,
  MapPin,
  Pencil,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
} from "@/components/shared/AdvancedDataGrid";
import { AppDropdown } from "@/components/shared/AppDropdown";
import {
  ParameterFieldGuide,
  ParameterPageGuide,
  type ParameterGuidanceContent,
} from "@/components/shared/ParameterGuidance";
import {
  OpsDialogBody,
  OpsDialogContent,
  OpsDialogFooter,
  OpsDialogHeader,
} from "@/components/shared/OpsDialogShell";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissionAccess } from "@/features/access-control/hooks/usePermissionAccess";
import { parameterGuidance } from "@/features/settings-guidance/parameter-guidance.catalog";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { barcodePolicyApi } from "../api/barcode-policy.api";
import type {
  BarcodeGeneratePayload,
  BarcodePolicy,
  BarcodePolicyField,
  BarcodePolicyProfile,
  BarcodePolicyProfileUpdate,
  BarcodePolicyScope,
  BarcodePolicySegment,
  BarcodePolicySegmentType,
  BarcodeValueTransform,
  GeneratedBarcodeRow,
} from "../types/barcode-policy.types";

const fields: BarcodePolicyField[] = [
  "StockCode",
  "SerialNo",
  "YapCode",
  "LotNo",
  "WarehouseCode",
  "LocationCode",
  "DocumentNo",
];
const scopes: BarcodePolicyScope[] = [
  "ProductSerial",
  "ProductLot",
  "Location",
  "Logistics",
  "Document",
];
const inputs: Record<BarcodePolicyScope, BarcodePolicyField[]> = {
  ProductSerial: ["StockCode", "SerialNo", "YapCode"],
  ProductLot: ["StockCode", "LotNo", "YapCode"],
  Location: ["WarehouseCode", "LocationCode"],
  Logistics: ["DocumentNo"],
  Document: ["DocumentNo"],
};
const icons: Record<BarcodePolicyScope, ReactNode> = {
  ProductSerial: <Tag />,
  ProductLot: <Layers3 />,
  Location: <MapPin />,
  Logistics: <Boxes />,
  Document: <FileText />,
};
const segment = (
  order: number,
  type: BarcodePolicySegmentType = "Field",
): BarcodePolicySegment => ({
  order,
  segmentType: type,
  sourceField: type === "Field" ? "StockCode" : null,
  literalValue: "",
  isRequired: type !== "Date",
  transform: "Upper",
  sequenceLength: 8,
  dateFormat: "yyyyMMdd",
});
const sample = (): BarcodeGeneratePayload => ({
  idempotencyKey: crypto.randomUUID(),
  stockCode: "STK-0001",
  serialNo: "SN-2026-000001",
  yapCode: "YAP-01",
  lotNo: "LOT-260722",
  warehouseCode: "01",
  locationCode: "A-01-02",
  documentNo: "MK-2026-000001",
});

export function BarcodePolicyPage() {
  const { t, moduleReady } = useModuleTranslation("barcode-policy");
  const { can } = usePermissionAccess();
  const cache = useQueryClient();
  const [policy, setPolicy] = useState<BarcodePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BarcodePolicyProfile | null>(null);
  const [testing, setTesting] = useState<BarcodePolicyProfile | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPolicy(await barcodePolicyApi.get());
    } catch (e) {
      toast.error(message(e, t("messages.failed")));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    if (moduleReady) void load();
  }, [load, moduleReady]);
  const history = useMemo<GridColumn<GeneratedBarcodeRow>[]>(
    () =>
      moduleReady
        ? [
            { key: "id", label: t("history.id"), render: (r) => r.id },
            {
              key: "scope",
              label: t("history.scope"),
              render: (r) => t(`scope.${r.scope}`),
            },
            {
              key: "policyVersion",
              label: t("history.version"),
              render: (r) => `v${r.policyVersion}`,
            },
            {
              key: "barcodeValue",
              label: t("history.barcode"),
              render: (r) => (
                <span className="font-mono font-semibold">
                  {r.barcodeValue}
                </span>
              ),
            },
            {
              key: "stockCode",
              label: t("history.stock"),
              render: (r) => r.stockCode || "-",
            },
            {
              key: "serialNo",
              label: t("history.serial"),
              render: (r) => r.serialNo || "-",
            },
            {
              key: "lotNo",
              label: t("history.lot"),
              render: (r) => r.lotNo || "-",
            },
            {
              key: "locationCode",
              label: t("history.location"),
              render: (r) => r.locationCode || "-",
            },
            {
              key: "documentNo",
              label: t("history.document"),
              render: (r) => r.documentNo || "-",
            },
            {
              key: "sequenceNo",
              label: t("history.sequence"),
              render: (r) => r.sequenceNo,
            },
            {
              key: "generatedAt",
              label: t("history.generatedAt"),
              render: (r) => new Date(r.generatedAt).toLocaleString(),
            },
          ]
        : [],
    [moduleReady, t],
  );
  if (!moduleReady)
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-slate-500" />
      </section>
    );
  if (loading)
    return (
      <section className="grid min-h-[50vh] place-items-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="size-6 animate-spin" />
          {t("page.loading")}
        </div>
      </section>
    );
  if (!policy) return null;
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--wms-brand-primary)]">
              {policy.policyKey}
            </p>
            <h1 className="mt-1 text-2xl font-bold">{t("page.title")}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {t("page.description")}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge
              text={`${t("page.version")} v${policy.currentVersion}`}
              active
            />
            <Badge
              text={t(policy.isActive ? "page.active" : "page.inactive")}
              active={policy.isActive}
            />
          </div>
        </div>
        <ParameterPageGuide
          translationKey="barcode"
          className="mt-5"
          title="Barkod politikası ayar rehberi"
          description="Her profil kartı hangi operasyonda kullanıldığını gösterir. Düzenleme ekranında segmentler soldan sağa birleştirilir; zorunlu alan boşsa üretim engellenir, sıra segmenti ise benzersiz değeri atomik üretir."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scopes.map((scope) => {
            const profile = policy.profiles.find((x) => x.scope === scope);
            if (!profile) return null;
            return (
              <article
                key={scope}
                className="rounded-2xl border border-[var(--wms-app-border)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)] [&>svg]:size-5">
                      {icons[scope]}
                    </span>
                    <div>
                      <h2 className="font-bold">{t(`scope.${scope}`)}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {t(`scopeHelp.${scope}`)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    text={
                      profile.isEnabled ? t("page.active") : t("page.inactive")
                    }
                    active={profile.isEnabled}
                  />
                </div>
                <div className="mt-4 rounded-xl bg-black/5 p-3 font-mono text-sm dark:bg-white/5">
                  {previewPattern(profile)}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {t("history.sequence")}: {profile.nextSequence}
                  </span>
                  <span>
                    {profile.segments.length} {t("form.segments").toLowerCase()}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  {can("WMS.BARCODE_POLICY.MANAGE") && (
                    <button
                      onClick={() => setEditing(profile)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm"
                    >
                      <Pencil className="size-4" />
                      {t("actions.edit")}
                    </button>
                  )}
                  {can("WMS.BARCODE_POLICY.GENERATE") && (
                    <button
                      onClick={() => setTesting(profile)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-3 py-2 text-sm font-semibold text-white"
                    >
                      <Sparkles className="size-4" />
                      {t("actions.test")}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <AdvancedDataGrid
        pageKey="generated-barcodes-policy-v1"
        title={t("page.historyTitle")}
        description={t("page.historyDescription")}
        columns={history}
        fetchPage={barcodePolicyApi.generatedPaged}
      />
      {editing && (
        <ProfileDialog
          profile={editing}
          t={t}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setPolicy(next);
            setEditing(null);
          }}
          onConflict={load}
        />
      )}{" "}
      {testing && (
        <GenerateDialog
          profile={testing}
          t={t}
          onClose={() => setTesting(null)}
          onGenerated={() =>
            void cache.invalidateQueries({
              queryKey: ["advanced-grid", "generated-barcodes-policy-v1"],
            })
          }
        />
      )}
    </div>
  );
}

function ProfileDialog({
  profile,
  t,
  onClose,
  onSaved,
  onConflict,
}: {
  profile: BarcodePolicyProfile;
  t: TFunction;
  onClose: () => void;
  onSaved: (p: BarcodePolicy) => void;
  onConflict: () => Promise<void>;
}) {
  const [form, setForm] = useState<BarcodePolicyProfileUpdate>({
    displayName: profile.displayName,
    prefix: profile.prefix,
    separator: profile.separator,
    isEnabled: profile.isEnabled,
    concurrencyToken: profile.concurrencyToken,
    segments: profile.segments.map((x, i) => ({ ...x, order: i + 1 })),
  });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof BarcodePolicyProfileUpdate, value: unknown) =>
    setForm((v) => ({ ...v, [key]: value }) as BarcodePolicyProfileUpdate);
  const normalize = (items: BarcodePolicySegment[]) =>
    items.map((x, i) => ({ ...x, order: i + 1 }));
  const update = (index: number, next: Partial<BarcodePolicySegment>) =>
    set(
      "segments",
      form.segments.map((x, i) => (i === index ? { ...x, ...next } : x)),
    );
  const move = (index: number, delta: number) => {
    const items = [...form.segments],
      to = index + delta;
    if (to < 0 || to >= items.length) return;
    [items[index], items[to]] = [items[to], items[index]];
    set("segments", normalize(items));
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(await barcodePolicyApi.updateProfile(profile.scope, form));
      toast.success(t("messages.saved"));
    } catch (error) {
      toast.error(message(error, t("messages.failed")));
      if (message(error, "").toLowerCase().includes("değiş")) {
        await onConflict();
        toast.info(t("messages.concurrency"));
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <OpsDialogContent
        size="full"
        className="max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)]"
      >
        <OpsDialogHeader>
          <div>
            <DialogTitle className="wms-ops-detail-dialog__title">
              {t(`scope.${profile.scope}`)}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {t(`scopeHelp.${profile.scope}`)}
            </DialogDescription>
          </div>
        </OpsDialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <OpsDialogBody className="space-y-5">
            <ParameterPageGuide
              translationKey="barcodeProfile"
              title="Barkod profilini nasıl düzenlemeliyim?"
              description="Her değişiklik aşağıdaki açıklamayı ve örnek barkod davranışını anında günceller. Parçalar yukarıdan aşağıya sıralanır; ön ek ve ayraçla birleştirilerek tek barkod değeri oluşur."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <Field label={t("form.name")}>
                <input
                  required
                  maxLength={150}
                  className="input"
                  value={form.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                />
                <ParameterFieldGuide
                  guidance={parameterGuidance(
                    "barcode",
                    "displayName",
                    form.displayName,
                  )}
                  currentValue={form.displayName}
                />
              </Field>
              <Field label={t("form.prefix")}>
                <input
                  maxLength={30}
                  className="input"
                  value={form.prefix ?? ""}
                  onChange={(e) => set("prefix", e.target.value.toUpperCase())}
                />
                <ParameterFieldGuide
                  guidance={parameterGuidance("barcode", "prefix", form.prefix)}
                  currentValue={form.prefix || "Ön ek yok"}
                />
              </Field>
              <Field label={t("form.separator")}>
                <input
                  required
                  maxLength={5}
                  className="input font-mono"
                  value={form.separator}
                  onChange={(e) => set("separator", e.target.value)}
                />
                <ParameterFieldGuide
                  guidance={parameterGuidance(
                    "barcode",
                    "separator",
                    form.separator,
                  )}
                  currentValue={form.separator}
                />
              </Field>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isEnabled}
                    onChange={(e) => set("isEnabled", e.target.checked)}
                  />
                  {t("form.enabled")}
                </label>
                <ParameterFieldGuide
                  guidance={parameterGuidance(
                    "barcode",
                    "isEnabled",
                    form.isEnabled,
                  )}
                  currentValue={form.isEnabled ? "Açık" : "Kapalı"}
                />
              </div>
            </div>
            <section className="rounded-2xl border p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{t("form.segments")}</h3>
                  <p className="text-xs text-slate-500">
                    {t("form.segmentsHelp")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "segments",
                      normalize([
                        ...form.segments,
                        segment(form.segments.length + 1),
                      ]),
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2"
                >
                  <Tag className="size-4" />
                  {t("actions.add")}
                </button>
              </div>
              <div className="space-y-2">
                {form.segments.map((item, index) => (
                  <div
                    key={`${index}-${item.order}`}
                    className="grid gap-2 rounded-xl border p-3 lg:grid-cols-[70px_130px_1fr_120px_100px_100px]"
                  >
                    <div className="flex items-center gap-1">
                      <span>{item.order}</span>
                      <button
                        type="button"
                        aria-label="up"
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="down"
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </div>
                    <AppDropdown
                      value={item.segmentType}
                      onValueChange={(v) =>
                        update(index, {
                          segmentType: v as BarcodePolicySegmentType,
                          sourceField: v === "Field" ? "StockCode" : null,
                        })
                      }
                      options={(
                        [
                          "Field",
                          "Literal",
                          "Sequence",
                          "Date",
                        ] as BarcodePolicySegmentType[]
                      ).map((v) => ({
                        value: v,
                        label: t(`segmentType.${v}`),
                      }))}
                    />
                    {item.segmentType === "Field" ? (
                      <AppDropdown
                        value={item.sourceField ?? "StockCode"}
                        onValueChange={(v) =>
                          update(index, {
                            sourceField: v as BarcodePolicyField,
                          })
                        }
                        options={fields.map((v) => ({
                          value: v,
                          label: t(`field.${v}`),
                        }))}
                      />
                    ) : item.segmentType === "Literal" ? (
                      <input
                        className="input"
                        placeholder={t("form.literal")}
                        value={item.literalValue ?? ""}
                        onChange={(e) =>
                          update(index, { literalValue: e.target.value })
                        }
                      />
                    ) : item.segmentType === "Sequence" ? (
                      <input
                        className="input"
                        type="number"
                        min="4"
                        max="18"
                        value={item.sequenceLength}
                        onChange={(e) =>
                          update(index, {
                            sequenceLength: Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      <AppDropdown
                        value={item.dateFormat}
                        onValueChange={(v) => update(index, { dateFormat: v })}
                        options={["yyyyMMdd", "yyMMdd", "yyyyMM", "yyyy"].map(
                          (v) => ({ value: v, label: v }),
                        )}
                      />
                    )}
                    <AppDropdown
                      value={item.transform}
                      onValueChange={(v) =>
                        update(index, { transform: v as BarcodeValueTransform })
                      }
                      options={["Upper", "Lower", "None"].map((v) => ({
                        value: v,
                        label: t(`transform.${v}`),
                      }))}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.isRequired}
                        onChange={(e) =>
                          update(index, { isRequired: e.target.checked })
                        }
                      />
                      {t("form.required")}
                    </label>
                    <button
                      type="button"
                      disabled={item.segmentType === "Sequence"}
                      onClick={() =>
                        set(
                          "segments",
                          normalize(
                            form.segments.filter((_, i) => i !== index),
                          ),
                        )
                      }
                      className="inline-flex items-center justify-center gap-1 rounded-lg border text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="size-4" />
                      {t("actions.remove")}
                    </button>
                    <ParameterFieldGuide
                      className="lg:col-span-6"
                      guidance={barcodeSegmentGuidance(item, t)}
                      currentValue={t("guidance.segment.current", {
                        order: item.order,
                        type: t(`segmentType.${item.segmentType}`),
                      })}
                    />
                  </div>
                ))}
              </div>
            </section>
          </OpsDialogBody>
          <OpsDialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2"
            >
              {t("actions.cancel")}
            </button>
            <button
              disabled={busy}
              className="rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 font-semibold text-white"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("actions.save")
              )}
            </button>
          </OpsDialogFooter>
        </form>
      </OpsDialogContent>
    </Dialog>
  );
}

function barcodeSegmentGuidance(
  item: BarcodePolicySegment,
  t: TFunction,
): ParameterGuidanceContent {
  const tr = (key: string, options?: Record<string, unknown>): string =>
    String(t(`guidance.${key}`, options));
  const transformText = tr(`transform.${item.transform}`);
  const requiredText = tr(
    `required.${item.isRequired ? "required" : "optional"}`,
  );

  if (item.segmentType === "Sequence") {
    return {
      summary: tr("sequence.summary", { length: item.sequenceLength }),
      effect: tr("sequence.effect"),
      affects: [
        tr("sequence.affects.uniqueness"),
        tr("sequence.affects.concurrency"),
        tr("sequence.affects.idempotency"),
      ],
      scenario: tr("sequence.scenario", {
        length: item.sequenceLength,
        value: String(765).padStart(item.sequenceLength, "0"),
      }),
      warning: tr("sequence.warning"),
    };
  }

  if (item.segmentType === "Date") {
    return {
      summary: tr("date.summary", { format: item.dateFormat }),
      effect: tr("date.effect", { transform: transformText, requiredText }),
      affects: [
        tr("date.affects.pattern"),
        tr("date.affects.readability"),
        tr("date.affects.tracking"),
      ],
      scenario:
        item.dateFormat === "yyyyMMdd"
          ? tr("date.scenarioExact")
          : tr("date.scenario", { format: item.dateFormat }),
    };
  }

  if (item.segmentType === "Literal") {
    return {
      summary: tr("literal.summary", {
        value: item.literalValue || tr("literal.empty"),
      }),
      effect: tr("literal.effect", { transform: transformText, requiredText }),
      affects: [
        tr("literal.affects.type"),
        tr("literal.affects.scanner"),
        tr("literal.affects.pattern"),
      ],
      scenario: tr("literal.scenario"),
      warning: item.literalValue
        ? undefined
        : tr("literal.warning"),
    };
  }

  const sourceName = String(t(`field.${item.sourceField ?? "StockCode"}`));
  return {
    summary: tr("field.summary", { source: sourceName, transform: transformText }),
    effect: tr("field.effect", { source: sourceName, requiredText }),
    affects: [
      tr("field.affects.resolution"),
      tr("field.affects.matching"),
      tr("field.affects.validation"),
    ],
    scenario: tr("field.scenario", {
      source: sourceName,
      value: item.transform === "Upper" ? "ABC-01" : "abc-01",
    }),
    warning: item.isRequired
      ? tr("field.warning", { source: sourceName })
      : undefined,
  };
}

function GenerateDialog({
  profile,
  t,
  onClose,
  onGenerated,
}: {
  profile: BarcodePolicyProfile;
  t: TFunction;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [data, setData] = useState(sample);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (reserve: boolean) => {
    setBusy(true);
    try {
      const response = reserve
        ? await barcodePolicyApi.generate(profile.scope, data)
        : await barcodePolicyApi.preview(profile.scope, data);
      setResult(response.value);
      toast.success(t(reserve ? "messages.generated" : "messages.previewed"));
      if (reserve) onGenerated();
    } catch (e) {
      toast.error(message(e, t("messages.failed")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <OpsDialogContent size="lg">
        <OpsDialogHeader>
          <div>
            <DialogTitle className="wms-ops-detail-dialog__title">
              {t(`scope.${profile.scope}`)}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {previewPattern(profile)}
            </DialogDescription>
          </div>
        </OpsDialogHeader>
        <OpsDialogBody>
          <div className="grid gap-3 sm:grid-cols-2">
            {inputs[profile.scope].map((field) => (
              <Field key={field} label={t(`field.${field}`)}>
                <input
                  className="input"
                  value={valueOf(data, field)}
                  onChange={(e) =>
                    setData(setValue(data, field, e.target.value))
                  }
                />
              </Field>
            ))}
            <Field label={t("form.idempotency")}>
              <input
                className="input font-mono text-xs"
                value={data.idempotencyKey}
                onChange={(e) =>
                  setData({ ...data, idempotencyKey: e.target.value })
                }
              />
            </Field>
          </div>
          {result && (
            <div className="mt-4 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-5">
              <Barcode className="mb-2 size-6 text-cyan-500" />
              <div className="break-all font-mono text-lg font-bold">
                {result}
              </div>
            </div>
          )}
        </OpsDialogBody>
        <OpsDialogFooter>
          <button
            disabled={busy}
            onClick={() => void run(false)}
            className="rounded-xl border px-4 py-2"
          >
            {t("actions.preview")}
          </button>
          <button
            disabled={busy}
            onClick={() => void run(true)}
            className="rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 font-semibold text-white"
          >
            {t("actions.generate")}
          </button>
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}

function previewPattern(profile: BarcodePolicyProfile) {
  return [
    profile.prefix,
    ...profile.segments.map((x) =>
      x.segmentType === "Field"
        ? `{${x.sourceField}}`
        : x.segmentType === "Sequence"
          ? `{SEQ:${x.sequenceLength}}`
          : x.segmentType === "Date"
            ? `{${x.dateFormat}}`
            : x.literalValue,
    ),
  ]
    .filter(Boolean)
    .join(profile.separator);
}
function valueOf(data: BarcodeGeneratePayload, field: BarcodePolicyField) {
  const map: Record<BarcodePolicyField, keyof BarcodeGeneratePayload> = {
    StockCode: "stockCode",
    SerialNo: "serialNo",
    YapCode: "yapCode",
    LotNo: "lotNo",
    WarehouseCode: "warehouseCode",
    LocationCode: "locationCode",
    DocumentNo: "documentNo",
  };
  return String(data[map[field]] ?? "");
}
function setValue(
  data: BarcodeGeneratePayload,
  field: BarcodePolicyField,
  value: string,
) {
  const map: Record<BarcodePolicyField, keyof BarcodeGeneratePayload> = {
    StockCode: "stockCode",
    SerialNo: "serialNo",
    YapCode: "yapCode",
    LotNo: "lotNo",
    WarehouseCode: "warehouseCode",
    LocationCode: "locationCode",
    DocumentNo: "documentNo",
  };
  return { ...data, [map[field]]: value };
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
function Badge({ text, active }: { text: string; active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-500/15 text-emerald-600" : "bg-slate-500/15 text-slate-500"}`}
    >
      {text}
    </span>
  );
}
function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
