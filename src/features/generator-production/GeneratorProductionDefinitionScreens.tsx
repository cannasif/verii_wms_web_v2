import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ChevronRight,
  Clock3,
  Factory,
  GitBranch,
  Loader2,
  PackageSearch,
  Plus,
  RotateCcw,
  Route,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UsersRound,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { generatorProductionApi } from "./api";
import type {
  GeneratorPartType,
  GeneratorPolicy,
  GeneratorRule,
  SaveGeneratorOperationMaterialRequest,
  SaveGeneratorProductRequest,
  SaveGeneratorStationCapabilityRequest,
} from "./types";
import {
  GeneratorEmpty,
  GeneratorLoading,
  GeneratorMetric,
  GeneratorPageHeader,
  GeneratorTag,
  generatorError,
  generatorPartLabel,
  gpField,
  gpPanel,
  gpPrimaryButton,
  gpSecondaryButton,
  useGeneratorDefinitions,
} from "./GeneratorProductionScreenKit";

const root = "/warehouse/production/generator/definitions";
const definitionCards = [
  {
    href: `${root}/parameters`,
    icon: SlidersHorizontal,
    code: "GP.DEF.POL",
    title: "Üretim Parametreleri",
    text: "Proje varsayılanları, planlama pencereleri ve yürütme politikaları.",
  },
  {
    href: `${root}/stations`,
    icon: Factory,
    code: "GP.DEF.STA",
    title: "İstasyonlar",
    text: "SA, RA, FA ve sevkiyat istasyonlarının kapasite ve ekipman özellikleri.",
  },
  {
    href: `${root}/routes`,
    icon: Route,
    code: "GP.DEF.ROU",
    title: "Operasyon Rotaları",
    text: "Stator, rotor, taşıyıcı kol ve final montaj operasyon sıraları.",
  },
  {
    href: `${root}/products`,
    icon: Boxes,
    code: "GP.DEF.PRD",
    title: "Ürün, Yetkinlik ve Malzeme",
    text: "Ürün rotaları, üretilebilir istasyon matrisi ve operasyon bazlı malzeme ihtiyaçları.",
  },
  {
    href: `${root}/calendar`,
    icon: CalendarDays,
    code: "GP.DEF.CAL",
    title: "Vardiya ve Takvim",
    text: "İstasyon vardiya kapasiteleri ve istisna günleri.",
  },
  {
    href: `${root}/resources`,
    icon: Wrench,
    code: "GP.DEF.RES",
    title: "Kaynaklar",
    text: "Personel, kaynak, fırın, lazer, vinç ve taşıma kaynakları.",
  },
  {
    href: `${root}/rules`,
    icon: GitBranch,
    code: "GP.DEF.RUL",
    title: "Planlama Kuralları",
    text: "Planı engelleyen veya uyarı üreten iş kuralları.",
  },
];

export function GeneratorProductionDefinitionsHubPage(): ReactElement {
  const queryClient = useQueryClient();
  const definitions = useGeneratorDefinitions();
  const bootstrap = useMutation({
    mutationFn: generatorProductionApi.bootstrap,
    onSuccess: (result) => {
      toast.success(
        `${result.stationCount} istasyon, ${result.routeCount} rota kuruldu.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["generator-production"],
      });
    },
    onError: (error) => toast.error(generatorError(error)),
  });
  return (
    <section className="space-y-5">
      <GeneratorPageHeader
        eyebrow="Jeneratör Üretim / Tanımlar"
        title="Üretim Modeli Tanımları"
        description="Planlama motorunu besleyen ana verileri ayrı sorumluluk ekranlarında yönetin."
        actions={
          !definitions.data?.isBootstrapped ? (
            <button
              className={gpPrimaryButton}
              disabled={definitions.isLoading || bootstrap.isPending}
              onClick={() => bootstrap.mutate()}
            >
              {bootstrap.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}{" "}
              Başlangıç tanımlarını kur
            </button>
          ) : undefined
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <GeneratorMetric
          icon={SlidersHorizontal}
          label="Politika"
          value={definitions.data?.policy.id ? 1 : 0}
        />
        <GeneratorMetric
          icon={Factory}
          label="İstasyon"
          value={definitions.data?.stations.length ?? 0}
        />
        <GeneratorMetric
          icon={Route}
          label="Rota"
          value={definitions.data?.routes.length ?? 0}
        />
        <GeneratorMetric
          icon={UsersRound}
          label="Vardiya"
          value={definitions.data?.shifts.length ?? 0}
        />
        <GeneratorMetric
          icon={Wrench}
          label="Kaynak"
          value={definitions.data?.resources.length ?? 0}
        />
        <GeneratorMetric
          icon={GitBranch}
          label="Kural"
          value={definitions.data?.rules.length ?? 0}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {definitionCards.map(({ href, icon: Icon, code, title, text }) => (
          <Link
            key={href}
            className={`${gpPanel} group p-5 transition hover:-translate-y-0.5 hover:border-[var(--wms-brand-primary)]`}
            to={href}
          >
            <div className="flex items-start justify-between">
              <span className="rounded-xl bg-[color-mix(in_oklab,var(--wms-brand-primary)_14%,transparent)] p-3 text-[var(--wms-brand-primary)]">
                <Icon className="size-6" />
              </span>
              <span className="font-mono text-xs font-bold text-[var(--wms-app-text-muted)]">
                {code}
              </span>
            </div>
            <h2 className="mt-5 text-lg font-black">{title}</h2>
            <p className="mt-2 text-sm text-[var(--wms-app-text-muted)]">
              {text}
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[var(--wms-brand-primary)]">
              Aç{" "}
              <ChevronRight className="size-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function GeneratorProductionParametersPage(): ReactElement {
  const queryClient = useQueryClient();
  const definitions = useGeneratorDefinitions();
  const [form, setForm] = useState<GeneratorPolicy>();
  useEffect(() => {
    if (definitions.data?.policy) setForm(definitions.data.policy);
  }, [definitions.data?.policy]);
  const save = useMutation({
    mutationFn: (payload: GeneratorPolicy) =>
      generatorProductionApi.updatePolicy(payload),
    onSuccess: (result) => {
      setForm(result);
      toast.success("Jeneratör üretim parametreleri kaydedildi.");
      void queryClient.invalidateQueries({
        queryKey: ["generator-production"],
      });
    },
    onError: (error) => toast.error(generatorError(error)),
  });
  const set = <K extends keyof GeneratorPolicy>(
    key: K,
    value: GeneratorPolicy[K],
  ) => setForm((current) => (current ? { ...current, [key]: value } : current));

  if (definitions.isError)
    return (
      <section className="space-y-5">
        <GeneratorPageHeader
          eyebrow="Jeneratör Üretim / Tanımlar"
          title="Üretim Parametreleri"
          description="Planlama ve yürütme davranışlarını şube bazında yönetin."
        />
        <div
          className={`${gpPanel} flex flex-wrap items-center justify-between gap-3 border-amber-500/50 p-5`}
        >
          <div>
            <strong>Üretim parametreleri yüklenemedi.</strong>
            <p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">
              Bağlantıyı veya bekleyen veritabanı güncellemesini kontrol edin.
            </p>
          </div>
          <button
            className={gpPrimaryButton}
            onClick={() => definitions.refetch()}
          >
            Tekrar dene
          </button>
        </div>
      </section>
    );
  if (definitions.isLoading || !form)
    return (
      <section className="space-y-5">
        <GeneratorPageHeader
          eyebrow="Jeneratör Üretim / Tanımlar"
          title="Üretim Parametreleri"
          description="Planlama ve yürütme davranışlarını şube bazında yönetin."
        />
        <GeneratorLoading />
      </section>
    );
  const isDirty =
    JSON.stringify(form) !== JSON.stringify(definitions.data?.policy);
  return (
    <section className="space-y-5">
      <GeneratorPageHeader
        eyebrow="Jeneratör Üretim / Tanımlar"
        title="Üretim Parametreleri"
        description="Günlük kullanılan ayarlar önde, teknik sınırlar gelişmiş bölümde. Değişiklikler bu şube için geçerlidir."
        actions={
          <>
            <button
              className={gpSecondaryButton}
              disabled={!isDirty || save.isPending}
              onClick={() =>
                definitions.data?.policy && setForm(definitions.data.policy)
              }
            >
              <RotateCcw className="size-4" /> Değişiklikleri geri al
            </button>
            <button
              className={gpPrimaryButton}
              disabled={!isDirty || save.isPending}
              onClick={() => save.mutate(form)}
            >
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}{" "}
              Değişiklikleri kaydet
            </button>
          </>
        }
      />
      {!form.id && (
        <div className={`${gpPanel} border-amber-500/50 p-4 text-sm`}>
          <strong>Bu şube için politika kaydı henüz oluşturulmamış.</strong>
          <p className="mt-1 text-[var(--wms-app-text-muted)]">
            İlk kaydetme işlemi şubeye özel RII_GP_POLICY kaydını oluşturur.
          </p>
        </div>
      )}
      {isDirty && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
          role="status"
        >
          <strong>Kaydedilmemiş değişiklikler var.</strong>
          <span className="text-[var(--wms-app-text-muted)]">
            Etkili olması için “Değişiklikleri kaydet” düğmesine basın.
          </span>
        </div>
      )}
      <div>
        <h2 className="text-lg font-black">Günlük ayarlar</h2>
        <p className="text-sm text-[var(--wms-app-text-muted)]">
          Yeni iş ve normal planlama davranışını belirleyen temel değerler.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <PolicySection
          code="GP.POL.PROJECT"
          title="Proje varsayılanları"
          description="Yeni jeneratör projelerinde kullanılan sınırlar ve başlangıç değerleri."
        >
          <PolicyNumber
            label="Asgari öncelik"
            value={form.minimumProjectPriority}
            min={0}
            max={100}
            onChange={(value) => set("minimumProjectPriority", value)}
          />
          <PolicyNumber
            label="Varsayılan öncelik"
            value={form.defaultProjectPriority}
            min={form.minimumProjectPriority}
            max={form.maximumProjectPriority}
            onChange={(value) => set("defaultProjectPriority", value)}
          />
          <PolicyNumber
            label="Azami öncelik"
            value={form.maximumProjectPriority}
            min={0}
            max={100}
            onChange={(value) => set("maximumProjectPriority", value)}
          />
          <PolicyNumber
            label="Varsayılan adet"
            value={form.defaultProjectQuantity}
            min={1}
            max={form.maximumProjectQuantity}
            onChange={(value) => set("defaultProjectQuantity", value)}
          />
          <PolicyNumber
            label="Azami proje adedi"
            value={form.maximumProjectQuantity}
            min={1}
            max={10000}
            onChange={(value) => set("maximumProjectQuantity", value)}
          />
          <PolicyNumber
            label="Varsayılan teslim süresi"
            hint="Gün"
            value={form.defaultLeadTimeDays}
            min={1}
            max={3650}
            onChange={(value) => set("defaultLeadTimeDays", value)}
          />
        </PolicySection>
        <PolicySection
          code="GP.POL.PLAN"
          title="Planlama politikası"
          description="Plan motorunun sıralama, takvim ve görünüm sınırları."
        >
          <label className="text-sm font-bold">
            Proje sıralama stratejisi
            <select
              className={`${gpField} mt-1`}
              value={form.planningOrderStrategy}
              onChange={(event) =>
                set(
                  "planningOrderStrategy",
                  event.target
                    .value as GeneratorPolicy["planningOrderStrategy"],
                )
              }
            >
              <option value="PriorityThenDelivery">
                Öncelik, ardından teslim tarihi
              </option>
              <option value="DeliveryThenPriority">
                Teslim tarihi, ardından öncelik
              </option>
              <option value="ManualOrderThenDelivery">
                Manuel sıra, ardından teslim tarihi
              </option>
            </select>
          </label>
          <PolicyNumber
            label="Plan gerekçesi asgari uzunluk"
            hint="Karakter"
            value={form.minimumPlanReasonLength}
            min={3}
            max={1000}
            onChange={(value) => set("minimumPlanReasonLength", value)}
          />
          <PolicyNumber
            label="Varsayılan Gantt penceresi"
            hint="Gün"
            value={form.ganttDefaultWindowDays}
            min={1}
            max={Math.max(
              1,
              form.maximumScheduleRangeDays - form.schedulePastDays,
            )}
            onChange={(value) => set("ganttDefaultWindowDays", value)}
          />
          <PolicyNumber
            label="Mal kabul ve kalite tamponu"
            hint="Gün"
            value={form.inboundQualityBufferDays}
            min={0}
            max={365}
            onChange={(value) => set("inboundQualityBufferDays", value)}
          />
        </PolicySection>
      </div>
      <details className={`${gpPanel} gp-details`}>
        <summary>
          Gelişmiş güvenlik ve görünüm ayarları{" "}
          <small>
            Takvim sınırları, Andon yenileme ve operasyon kontrolleri
          </small>
        </summary>
        <div className="grid gap-4 p-5 pt-0 xl:grid-cols-2">
          <PolicySection
            code="GP.POL.WINDOW"
            title="Takvim ve görünüm sınırları"
            description="Plan ekranlarının okuyacağı tarih aralığı ve plan motorunun güvenlik sınırı."
          >
            <PolicyNumber
              label="Azami takvim aralığı"
              hint="Gün"
              value={form.maximumScheduleRangeDays}
              min={1}
              max={3660}
              onChange={(value) => set("maximumScheduleRangeDays", value)}
            />
            <PolicyNumber
              label="Geçmiş plan penceresi"
              hint="Gün"
              value={form.schedulePastDays}
              min={0}
              max={form.maximumScheduleRangeDays}
              onChange={(value) => set("schedulePastDays", value)}
            />
            <PolicyNumber
              label="Gelecek plan penceresi"
              hint="Gün"
              value={form.scheduleFutureDays}
              min={1}
              max={form.maximumScheduleRangeDays}
              onChange={(value) => set("scheduleFutureDays", value)}
            />
            <PolicyNumber
              label="Takvim arama güvenlik sınırı"
              hint="Gün"
              value={form.workingCalendarSearchLimitDays}
              min={1}
              max={36600}
              onChange={(value) => set("workingCalendarSearchLimitDays", value)}
            />
          </PolicySection>
          <PolicySection
            code="GP.POL.EXEC"
            title="Yürütme güvenliği"
            description="İstasyon operasyonlarının güvenli durum geçişleri."
          >
            <PolicyNumber
              label="Operasyon gerekçesi asgari uzunluk"
              hint="Karakter"
              value={form.minimumOperationReasonLength}
              min={3}
              max={1000}
              onChange={(value) => set("minimumOperationReasonLength", value)}
            />
            <PolicyNumber
              label="Andon yenileme sıklığı"
              hint="Saniye"
              value={form.andonRefreshSeconds}
              min={5}
              max={3600}
              onChange={(value) => set("andonRefreshSeconds", value)}
            />
            <PolicyToggle
              label="Final montaj için bileşen zorunlu"
              checked={form.requireComponentForFinalAssembly}
              onChange={(value) =>
                set("requireComponentForFinalAssembly", value)
              }
            />
            <PolicyToggle
              label="Başlatmada malzeme uygunluğu zorunlu"
              checked={form.requireMaterialAvailabilityToStart}
              onChange={(value) =>
                set("requireMaterialAvailabilityToStart", value)
              }
            />
            <PolicyToggle
              label="Tamamlamada açık problem olmamalı"
              checked={form.requireProblemClosureToComplete}
              onChange={(value) =>
                set("requireProblemClosureToComplete", value)
              }
            />
            <PolicyToggle
              label="Tamamlamada pozitif miktar zorunlu"
              checked={form.requirePositiveCompletionQuantity}
              onChange={(value) =>
                set("requirePositiveCompletionQuantity", value)
              }
            />
          </PolicySection>
        </div>
      </details>
      <div className={`${gpPanel} flex gap-3 p-4 text-sm`}>
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
        <p>
          <strong>Parametrik çalışma:</strong> Bu değerler yalnızca ekranda
          tutulmaz; proje doğrulama, planlama sırası, takvim sınırı ve operasyon
          durum geçişleri API tarafından doğrudan bu şube kaydından okunur.
        </p>
      </div>
    </section>
  );
}

function PolicySection({
  code,
  title,
  description,
  children,
}: {
  code: string;
  title: string;
  description: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className={`${gpPanel} p-5`}>
      <p className="font-mono text-[10px] font-black text-[var(--wms-brand-primary)]">
        {code}
      </p>
      <h2 className="mt-1 text-lg font-black">{title}</h2>
      <p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">
        {description}
      </p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function PolicyNumber({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <label className="block text-sm font-bold">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {hint && (
          <small className="font-normal text-[var(--wms-app-text-muted)]">
            {hint}
          </small>
        )}
      </span>
      <input
        className={`${gpField} mt-1`}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function PolicyToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): ReactElement {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--wms-app-border)] p-3 text-sm font-bold">
      <span>{label}</span>
      <input
        className="size-4 accent-[var(--wms-brand-primary)]"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function GeneratorProductionStationsPage(): ReactElement {
  const definitions = useGeneratorDefinitions();
  return (
    <section className="space-y-5">
      <GeneratorPageHeader
        eyebrow="Jeneratör Üretim / Tanımlar"
        title="İstasyonlar ve Kapasite"
        description="Üretim alanı, paralel iş, personel, vinç ve taşıma gereksinimlerini istasyon bazında izleyin."
      />
      {definitions.isLoading ? (
        <GeneratorLoading />
      ) : (
        <div className={`${gpPanel} overflow-auto`}>
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--wms-app-border)]">
                <th className="p-3">Sıra</th>
                <th className="p-3">Kod</th>
                <th className="p-3">İstasyon</th>
                <th className="p-3">Alan</th>
                <th className="p-3">Paralel iş</th>
                <th className="p-3">Personel</th>
                <th className="p-3">Özellik</th>
                <th className="p-3">Durum</th>
              </tr>
            </thead>
            <tbody>
              {definitions.data?.stations.map((station) => (
                <tr
                  key={station.id}
                  className="border-b border-[var(--wms-app-border)]"
                >
                  <td className="p-3">{station.planningOrder}</td>
                  <td className="p-3 font-mono font-black text-[var(--wms-brand-primary)]">
                    {station.code}
                  </td>
                  <td className="p-3">
                    <strong>{station.name}</strong>
                    {station.description && (
                      <p className="text-xs text-[var(--wms-app-text-muted)]">
                        {station.description}
                      </p>
                    )}
                  </td>
                  <td className="p-3">{station.area}</td>
                  <td className="p-3">{station.maxParallelJobs}</td>
                  <td className="p-3">{station.defaultPersonnelCapacity}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {station.isBottleneck && (
                        <GeneratorTag tone="warning">Darboğaz</GeneratorTag>
                      )}
                      {station.isCritical && (
                        <GeneratorTag tone="danger">Kritik</GeneratorTag>
                      )}
                      {station.requiresCrane && (
                        <GeneratorTag>Vinç</GeneratorTag>
                      )}
                      {station.requiresTransport && (
                        <GeneratorTag>Taşıma</GeneratorTag>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <GeneratorTag
                      tone={station.isActive ? "success" : "danger"}
                    >
                      {station.isActive ? "Aktif" : "Pasif"}
                    </GeneratorTag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function GeneratorProductionRoutesPage(): ReactElement {
  const definitions = useGeneratorDefinitions();
  return (
    <section className="space-y-5">
      <GeneratorPageHeader
        eyebrow="Jeneratör Üretim / Tanımlar"
        title="Operasyon Rotaları"
        description="Her bileşenin hangi istasyonlardan, hangi sırayla ve kaç dakikalık standart süreyle geçtiğini inceleyin."
      />
      {definitions.isLoading ? (
        <GeneratorLoading />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {definitions.data?.routes.map((route) => (
            <article key={route.id} className={`${gpPanel} p-5`}>
              <header className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold text-[var(--wms-brand-primary)]">
                    {route.code} · v{route.versionNumber}
                  </p>
                  <h2 className="mt-1 text-lg font-black">{route.name}</h2>
                </div>
                <GeneratorTag tone={route.isActive ? "success" : "danger"}>
                  {generatorPartLabel(route.partType)}
                </GeneratorTag>
              </header>
              <ol className="mt-5 space-y-2">
                {route.operations.map((operation, index) => (
                  <li
                    key={operation.id}
                    className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-xl border border-[var(--wms-app-border)] p-3"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-[var(--wms-brand-primary)] text-xs font-black text-[var(--wms-brand-on-primary)]">
                      {index + 1}
                    </span>
                    <div>
                      <strong className="font-mono text-xs text-[var(--wms-brand-primary)]">
                        {operation.stationCode} · {operation.operationCode}
                      </strong>
                      <p className="text-sm font-bold">
                        {operation.operationName}
                      </p>
                    </div>
                    <div className="text-right">
                      <strong className="text-sm">
                        {operation.durationMinutes} dk
                      </strong>
                      <p className="text-[10px] text-[var(--wms-app-text-muted)]">
                        {operation.minimumDurationMinutes}–
                        {operation.maximumDurationMinutes}
                      </p>
                      {operation.isCritical && (
                        <GeneratorTag tone="warning">Kritik</GeneratorTag>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

const emptyProduct: SaveGeneratorProductRequest = {
  code: "",
  name: "",
  generatorType: "",
  producedStockId: null,
  producedStockCode: "",
  description: "",
  isActive: true,
  routes: [],
};
const emptyCapability: SaveGeneratorStationCapabilityRequest = {
  productId: 0,
  routeOperationId: 0,
  stationId: 0,
  isPrimary: true,
  efficiencyPercent: 100,
  setupMinutes: 0,
  isActive: true,
};
const emptyMaterial: SaveGeneratorOperationMaterialRequest = {
  productId: 0,
  routeOperationId: 0,
  stockId: 0,
  yapCodeId: null,
  warehouseId: 0,
  unitCode: "ADET",
  quantityPerUnit: 1,
  wasteRate: 0,
  needOffsetMinutes: 0,
  isMandatory: true,
};

export function GeneratorProductionProductsPage(): ReactElement {
  const queryClient = useQueryClient();
  const definitions = useGeneratorDefinitions();
  const stocks = useQuery({
    queryKey: ["generator-production", "stock-options"],
    queryFn: () => generatorProductionApi.stocks(),
  });
  const [productId, setProductId] = useState<number>();
  const [product, setProduct] = useState(emptyProduct);
  const [capabilityId, setCapabilityId] = useState<number>();
  const [capability, setCapability] = useState(emptyCapability);
  const [materialId, setMaterialId] = useState<number>();
  const [material, setMaterial] = useState(emptyMaterial);
  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ["generator-production"] });
  const saveProduct = useMutation({
    mutationFn: () =>
      generatorProductionApi.saveProduct({ ...product, id: productId }),
    onSuccess: () => {
      toast.success("Ürün ve rota eşleştirmeleri kaydedildi.");
      setProductId(undefined);
      setProduct(emptyProduct);
      refresh();
    },
    onError: (error) => toast.error(generatorError(error)),
  });
  const saveCapability = useMutation({
    mutationFn: () =>
      generatorProductionApi.saveStationCapability({
        ...capability,
        id: capabilityId,
      }),
    onSuccess: () => {
      toast.success("Ürün-istasyon yeteneği kaydedildi.");
      setCapabilityId(undefined);
      setCapability(emptyCapability);
      refresh();
    },
    onError: (error) => toast.error(generatorError(error)),
  });
  const saveMaterial = useMutation({
    mutationFn: () =>
      generatorProductionApi.saveMaterial({ ...material, id: materialId }),
    onSuccess: () => {
      toast.success("Operasyon malzeme ihtiyacı kaydedildi.");
      setMaterialId(undefined);
      setMaterial(emptyMaterial);
      refresh();
    },
    onError: (error) => toast.error(generatorError(error)),
  });
  const remove = useMutation({
    mutationFn: ({
      kind,
      id,
    }: {
      kind: "product" | "capability" | "material";
      id: number;
    }) =>
      kind === "product"
        ? generatorProductionApi.deleteProduct(id)
        : kind === "capability"
          ? generatorProductionApi.deleteStationCapability(id)
          : generatorProductionApi.deleteMaterial(id),
    onSuccess: () => {
      toast.success("Tanım silindi.");
      refresh();
    },
    onError: (error) => toast.error(generatorError(error)),
  });
  if (definitions.isLoading) return <GeneratorLoading />;
  const routesByPart = (part: GeneratorPartType) =>
    definitions.data?.routes.filter((x) => x.partType === part && x.isActive) ??
    [];
  const operationOptionsFor = (selectedProductId: number) => {
    const selectedProduct = definitions.data?.products.find(
      (x) => x.id === selectedProductId,
    );
    const selectedRouteIds = new Set(
      selectedProduct?.routes.map((x) => x.routeId) ?? [],
    );
    return (
      definitions.data?.routes
        .filter((x) => selectedRouteIds.has(x.id))
        .flatMap((x) => x.operations) ?? []
    );
  };
  const capabilityOperationOptions = operationOptionsFor(capability.productId);
  const materialOperationOptions = operationOptionsFor(material.productId);
  const setProductRoute = (partType: GeneratorPartType, routeId: number) =>
    setProduct((current) => ({
      ...current,
      routes: [
        ...current.routes.filter((x) => x.partType !== partType),
        ...(routeId ? [{ partType, routeId }] : []),
      ],
    }));
  const editProduct = (
    row: NonNullable<typeof definitions.data>["products"][number],
  ) => {
    setProductId(row.id);
    setProduct({
      code: row.code,
      name: row.name,
      generatorType: row.generatorType ?? "",
      producedStockId: row.producedStockId ?? null,
      producedStockCode: row.producedStockCode ?? "",
      description: row.description ?? "",
      isActive: row.isActive,
      routes: row.routes.map((x) => ({
        partType: x.partType,
        routeId: x.routeId,
      })),
      rowVersion: row.rowVersion,
    });
  };
  const editCapability = (
    row: NonNullable<typeof definitions.data>["stationCapabilities"][number],
  ) => {
    setCapabilityId(row.id);
    setCapability({
      productId: row.productId,
      routeOperationId: row.routeOperationId,
      stationId: row.stationId,
      isPrimary: row.isPrimary,
      efficiencyPercent: row.efficiencyPercent,
      setupMinutes: row.setupMinutes,
      isActive: row.isActive,
      rowVersion: row.rowVersion,
    });
  };
  const editMaterial = (
    row: NonNullable<typeof definitions.data>["materials"][number],
  ) => {
    setMaterialId(row.id);
    setMaterial({
      productId: row.productId,
      routeOperationId: row.routeOperationId,
      stockId: row.stockId,
      yapCodeId: row.yapCodeId ?? null,
      warehouseId: row.warehouseId,
      unitCode: row.unitCode,
      quantityPerUnit: row.quantityPerUnit,
      wasteRate: row.wasteRate,
      needOffsetMinutes: row.needOffsetMinutes,
      isMandatory: row.isMandatory,
      rowVersion: row.rowVersion,
    });
  };
  return (
    <section className="space-y-5">
      <GeneratorPageHeader
        eyebrow="Jeneratör Üretim / Ana Veri"
        title="Ürün, İstasyon Yetkinliği ve Malzeme"
        description="Önce ürünün rota sürümünü, sonra her operasyonu yapabilen istasyonları ve BOM'dan gelen operasyon malzemelerini tanımlayın."
      />
      <section className={`${gpPanel} p-5`}>
        <header className="flex items-start gap-3">
          <Boxes className="size-6 text-[var(--wms-brand-primary)]" />
          <div>
            <h2 className="font-black">1. Jeneratör ürünü ve rota sürümü</h2>
            <p className="text-xs text-[var(--wms-app-text-muted)]">
              BOM genel Production modülünde kalır; burada ürünün planlamada
              kullanacağı onaylı rota sürümleri seçilir.
            </p>
          </div>
        </header>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveProduct.mutate();
          }}
        >
          <label className="text-sm font-bold">
            Ürün kodu
            <input
              required
              className={`${gpField} mt-1`}
              value={product.code}
              onChange={(e) => setProduct({ ...product, code: e.target.value })}
            />
          </label>
          <label className="text-sm font-bold">
            Ürün adı
            <input
              required
              className={`${gpField} mt-1`}
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
            />
          </label>
          <label className="text-sm font-bold">
            Jeneratör tipi
            <input
              className={`${gpField} mt-1`}
              value={product.generatorType ?? ""}
              onChange={(e) =>
                setProduct({ ...product, generatorType: e.target.value })
              }
            />
          </label>
          <label className="text-sm font-bold">
            Üretilen stok
            <select
              className={`${gpField} mt-1`}
              value={product.producedStockId ?? ""}
              onChange={(e) => {
                const stock = stocks.data?.find(
                  (x) => x.id === Number(e.target.value),
                );
                setProduct({
                  ...product,
                  producedStockId: stock?.id ?? null,
                  producedStockCode: stock?.erpStockCode ?? "",
                });
              }}
            >
              <option value="">Stok kartı seçin</option>
              {stocks.data?.map((stock) => (
                <option key={stock.id} value={stock.id}>
                  {stock.erpStockCode} · {stock.stockName}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              "Stator",
              "Rotor",
              "Stiffener",
              "FinalAssembly",
            ] as GeneratorPartType[]
          ).map((part) => (
            <label key={part} className="text-sm font-bold">
              {generatorPartLabel(part)} rotası
              <select
                className={`${gpField} mt-1`}
                value={
                  product.routes.find((x) => x.partType === part)?.routeId ?? ""
                }
                onChange={(e) => setProductRoute(part, Number(e.target.value))}
              >
                <option value="">Kullanılmaz</option>
                {routesByPart(part).map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.code} · v{route.versionNumber}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="flex items-center justify-between rounded-xl border border-[var(--wms-app-border)] p-3 text-sm font-bold">
            Aktif
            <input
              type="checkbox"
              checked={product.isActive}
              onChange={(e) =>
                setProduct({ ...product, isActive: e.target.checked })
              }
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              className={gpPrimaryButton}
              disabled={saveProduct.isPending}
            >
              {saveProduct.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {productId ? "Güncelle" : "Ürün oluştur"}
            </button>
            {productId && (
              <button
                type="button"
                className={gpSecondaryButton}
                onClick={() => {
                  setProductId(undefined);
                  setProduct(emptyProduct);
                }}
              >
                Vazgeç
              </button>
            )}
          </div>
        </form>
        <div className="mt-5 overflow-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Ürün</th>
                <th className="p-3">Tip</th>
                <th className="p-3">Rotalar</th>
                <th className="p-3">Durum</th>
                <th className="p-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {definitions.data?.products.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--wms-app-border)]"
                >
                  <td className="p-3">
                    <strong>{row.code}</strong>
                    <p className="text-xs">{row.name}</p>
                  </td>
                  <td className="p-3">{row.generatorType || "—"}</td>
                  <td className="p-3">
                    {row.routes.map((x) => x.routeCode).join(", ")}
                  </td>
                  <td className="p-3">
                    <GeneratorTag tone={row.isActive ? "success" : "danger"}>
                      {row.isActive ? "Aktif" : "Pasif"}
                    </GeneratorTag>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        className={gpSecondaryButton}
                        onClick={() => editProduct(row)}
                      >
                        Düzenle
                      </button>
                      <button
                        className="rounded-lg p-2 text-red-500"
                        onClick={() =>
                          window.confirm(`${row.code} silinsin mi?`) &&
                          remove.mutate({ kind: "product", id: row.id })
                        }
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={`${gpPanel} p-5`}>
        <header className="flex items-start gap-3">
          <Factory className="size-6 text-[var(--wms-brand-primary)]" />
          <div>
            <h2 className="font-black">
              2. Ürün–operasyon–istasyon yetenek matrisi
            </h2>
            <p className="text-xs text-[var(--wms-app-text-muted)]">
              Bir eşleştirme yoksa plan motoru o ürünü ilgili operasyonda
              üretemez.
            </p>
          </div>
        </header>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveCapability.mutate();
          }}
        >
          <MasterSelect
            label="Ürün"
            value={capability.productId}
            onChange={(value) =>
              setCapability({
                ...capability,
                productId: value,
                routeOperationId: 0,
              })
            }
            options={
              definitions.data?.products
                .filter((x) => x.isActive)
                .map((x) => ({
                  value: x.id,
                  label: `${x.code} · ${x.name}`,
                })) ?? []
            }
          />
          <MasterSelect
            label="Operasyon"
            value={capability.routeOperationId}
            onChange={(value) =>
              setCapability({ ...capability, routeOperationId: value })
            }
            options={capabilityOperationOptions.map((x) => ({
              value: x.id,
              label: `${x.operationCode} · ${x.operationName}`,
            }))}
          />
          <MasterSelect
            label="İstasyon"
            value={capability.stationId}
            onChange={(value) =>
              setCapability({ ...capability, stationId: value })
            }
            options={
              definitions.data?.stations
                .filter((x) => x.isActive)
                .map((x) => ({
                  value: x.id,
                  label: `${x.code} · ${x.name}`,
                })) ?? []
            }
          />
          <label className="text-sm font-bold">
            Verimlilik (%)
            <input
              required
              type="number"
              min={1}
              max={300}
              className={`${gpField} mt-1`}
              value={capability.efficiencyPercent}
              onChange={(e) =>
                setCapability({
                  ...capability,
                  efficiencyPercent: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="text-sm font-bold">
            Hazırlık süresi (dk)
            <input
              required
              type="number"
              min={0}
              max={10080}
              className={`${gpField} mt-1`}
              value={capability.setupMinutes}
              onChange={(e) =>
                setCapability({
                  ...capability,
                  setupMinutes: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-[var(--wms-app-border)] p-3 text-sm font-bold">
            Birincil istasyon
            <input
              type="checkbox"
              checked={capability.isPrimary}
              onChange={(e) =>
                setCapability({ ...capability, isPrimary: e.target.checked })
              }
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              className={gpPrimaryButton}
              disabled={
                !capability.productId ||
                !capability.routeOperationId ||
                !capability.stationId ||
                saveCapability.isPending
              }
            >
              <Plus className="size-4" />
              {capabilityId ? "Yeteneği güncelle" : "Yetenek ekle"}
            </button>
            {capabilityId && (
              <button type="button" className={gpSecondaryButton} onClick={() => { setCapabilityId(undefined); setCapability(emptyCapability); }}>
                Vazgeç
              </button>
            )}
          </div>
        </form>
        <div className="mt-5 overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Ürün</th>
                <th className="p-3">Operasyon</th>
                <th className="p-3">İstasyon</th>
                <th className="p-3">Verim / hazırlık</th>
                <th className="p-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {definitions.data?.stationCapabilities.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--wms-app-border)]"
                >
                  <td className="p-3 font-black">{row.productCode}</td>
                  <td className="p-3">
                    {row.operationCode} · {row.operationName}
                  </td>
                  <td className="p-3">
                    {row.stationCode} · {row.stationName}
                    {row.isPrimary && (
                      <GeneratorTag tone="success">Birincil</GeneratorTag>
                    )}
                  </td>
                  <td className="p-3">
                    %{row.efficiencyPercent} · {row.setupMinutes} dk
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button className={gpSecondaryButton} onClick={() => editCapability(row)}>Düzenle</button>
                      <button
                        aria-label="Yeteneği sil"
                        className="rounded-lg p-2 text-red-500"
                        onClick={() => window.confirm(`${row.productCode} / ${row.operationCode} / ${row.stationCode} yeteneği silinsin mi?`) && remove.mutate({ kind: "capability", id: row.id })}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={`${gpPanel} p-5`}>
        <header className="flex items-start gap-3">
          <PackageSearch className="size-6 text-[var(--wms-brand-primary)]" />
          <div>
            <h2 className="font-black">
              3. Operasyon malzemesi ve ihtiyaç zamanı
            </h2>
            <p className="text-xs text-[var(--wms-app-text-muted)]">
              Bağlı Production planı veya dış iş emri reçetesi otomatik
              kullanılır. Buradaki kayıt yalnız ürün/operasyon bazlı planlama
              istisnasıdır.
            </p>
          </div>
        </header>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveMaterial.mutate();
          }}
        >
          <MasterSelect
            label="Ürün"
            value={material.productId}
            onChange={(value) =>
              setMaterial({
                ...material,
                productId: value,
                routeOperationId: 0,
              })
            }
            options={
              definitions.data?.products
                .filter((x) => x.isActive)
                .map((x) => ({
                  value: x.id,
                  label: `${x.code} · ${x.name}`,
                })) ?? []
            }
          />
          <MasterSelect
            label="Operasyon"
            value={material.routeOperationId}
            onChange={(value) =>
              setMaterial({ ...material, routeOperationId: value })
            }
            options={materialOperationOptions.map((x) => ({
              value: x.id,
              label: `${x.operationCode} · ${x.operationName}`,
            }))}
          />
          <label className="text-sm font-bold">
            Stok
            <select
              required
              className={`${gpField} mt-1`}
              value={material.stockId || ""}
              onChange={(e) => {
                const stock = stocks.data?.find(
                  (x) => x.id === Number(e.target.value),
                );
                setMaterial({
                  ...material,
                  stockId: stock?.id ?? 0,
                  unitCode: stock?.unitCode || stock?.baseUnitCode || "ADET",
                });
              }}
            >
              <option value="">Stok seçin</option>
              {stocks.data?.map((stock) => (
                <option key={stock.id} value={stock.id}>
                  {stock.erpStockCode} · {stock.stockName}
                </option>
              ))}
            </select>
          </label>
          <MasterSelect
            label="Kaynak depo"
            value={material.warehouseId}
            onChange={(value) =>
              setMaterial({ ...material, warehouseId: value })
            }
            options={
              definitions.data?.warehouses.map((x) => ({
                value: x.id,
                label: `${x.code} · ${x.name}`,
              })) ?? []
            }
          />
          <label className="text-sm font-bold">
            Adet başına miktar
            <input
              required
              type="number"
              min={0.000001}
              step="any"
              className={`${gpField} mt-1`}
              value={material.quantityPerUnit}
              onChange={(e) =>
                setMaterial({
                  ...material,
                  quantityPerUnit: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="text-sm font-bold">
            Fire (%)
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              className={`${gpField} mt-1`}
              value={material.wasteRate}
              onChange={(e) =>
                setMaterial({ ...material, wasteRate: Number(e.target.value) })
              }
            />
          </label>
          <label className="text-sm font-bold">
            İhtiyaç ofseti (dk)
            <input
              type="number"
              min={-10080}
              max={10080}
              className={`${gpField} mt-1`}
              value={material.needOffsetMinutes}
              onChange={(e) =>
                setMaterial({
                  ...material,
                  needOffsetMinutes: Number(e.target.value),
                })
              }
            />
            <small className="text-[var(--wms-app-text-muted)]">
              0: operasyon başında, negatif: önceden
            </small>
          </label>
          <div className="flex items-end gap-2">
            <button
              className={gpPrimaryButton}
              disabled={
                !material.productId ||
                !material.routeOperationId ||
                !material.stockId ||
                !material.warehouseId ||
                saveMaterial.isPending
              }
            >
              <Plus className="size-4" />
              {materialId ? "Malzemeyi güncelle" : "Malzeme ekle"}
            </button>
            {materialId && (
              <button type="button" className={gpSecondaryButton} onClick={() => { setMaterialId(undefined); setMaterial(emptyMaterial); }}>
                Vazgeç
              </button>
            )}
          </div>
        </form>
        <div className="mt-5 overflow-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Ürün / operasyon</th>
                <th className="p-3">Malzeme</th>
                <th className="p-3">Depo</th>
                <th className="p-3">Miktar</th>
                <th className="p-3">Zaman</th>
                <th className="p-3">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {definitions.data?.materials.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--wms-app-border)]"
                >
                  <td className="p-3">
                    <strong>{row.productCode}</strong>
                    <p className="text-xs">{row.operationCode}</p>
                  </td>
                  <td className="p-3">
                    <strong>{row.stockCode}</strong>
                    <p className="text-xs">{row.stockName}</p>
                  </td>
                  <td className="p-3">
                    {row.warehouseCode} · {row.warehouseName}
                  </td>
                  <td className="p-3">
                    {row.quantityPerUnit} {row.unitCode} + %{row.wasteRate}
                  </td>
                  <td className="p-3">{row.needOffsetMinutes} dk</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button className={gpSecondaryButton} onClick={() => editMaterial(row)}>Düzenle</button>
                      <button
                        aria-label="Malzeme tanımını sil"
                        className="rounded-lg p-2 text-red-500"
                        onClick={() => window.confirm(`${row.productCode} / ${row.operationCode} için ${row.stockCode} malzemesi silinsin mi?`) && remove.mutate({ kind: "material", id: row.id })}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function MasterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: Array<{ value: number; label: string }>;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <label className="text-sm font-bold">
      {label}
      <select
        required
        className={`${gpField} mt-1`}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        <option value="">Seçin</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function weekdays(mask: number): string {
  const names = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  return (
    names.filter((_, index) => (mask & (1 << index)) !== 0).join(", ") || "—"
  );
}

export function GeneratorProductionCalendarPage(): ReactElement {
  const definitions = useGeneratorDefinitions();
  return (
    <section className="space-y-5">
      <GeneratorPageHeader
        eyebrow="Jeneratör Üretim / Tanımlar"
        title="Vardiya ve Üretim Takvimi"
        description="Sonlu kapasite planlamasında kullanılan çalışma saatlerini, istasyon kapasitelerini ve özel günleri görün."
      />
      {definitions.isLoading ? (
        <GeneratorLoading />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {definitions.data?.shifts.map((shift) => (
              <article
                key={shift.id}
                className={`${gpPanel} flex items-center gap-4 p-5`}
              >
                <span className="rounded-xl bg-[color-mix(in_oklab,var(--wms-brand-primary)_14%,transparent)] p-3 text-[var(--wms-brand-primary)]">
                  <Clock3 className="size-6" />
                </span>
                <div className="flex-1">
                  <p className="font-mono text-xs font-bold text-[var(--wms-brand-primary)]">
                    {shift.code}
                  </p>
                  <h2 className="font-black">{shift.name}</h2>
                  <p className="text-sm text-[var(--wms-app-text-muted)]">
                    {shift.startTime.slice(0, 5)} – {shift.endTime.slice(0, 5)}
                  </p>
                </div>
                <GeneratorTag tone={shift.isActive ? "success" : "normal"}>
                  {shift.isActive ? "Aktif" : "Pasif"}
                </GeneratorTag>
              </article>
            ))}
          </div>
          <section className={`${gpPanel} overflow-auto`}>
            <header className="border-b border-[var(--wms-app-border)] p-4">
              <h2 className="font-black">İstasyon vardiya kapasiteleri</h2>
            </header>
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--wms-app-border)]">
                  <th className="p-3">İstasyon</th>
                  <th className="p-3">Vardiya</th>
                  <th className="p-3">Çalışma günleri</th>
                  <th className="p-3">Dakika</th>
                  <th className="p-3">Personel</th>
                  <th className="p-3">Makine</th>
                  <th className="p-3">Destek</th>
                </tr>
              </thead>
              <tbody>
                {definitions.data?.stationShifts.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--wms-app-border)]"
                  >
                    <td className="p-3">
                      <strong className="font-mono">{row.stationCode}</strong>
                      <p className="text-xs text-[var(--wms-app-text-muted)]">
                        {row.stationName}
                      </p>
                    </td>
                    <td className="p-3">{row.shiftName}</td>
                    <td className="p-3">{weekdays(row.weekdayMask)}</td>
                    <td className="p-3">{row.capacityMinutes}</td>
                    <td className="p-3">{row.personnelCapacity}</td>
                    <td className="p-3">{row.machineCapacity}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {row.craneAvailable && (
                          <GeneratorTag>Vinç</GeneratorTag>
                        )}
                        {row.transportAvailable && (
                          <GeneratorTag>Taşıma</GeneratorTag>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className={`${gpPanel} p-4`}>
            <h2 className="font-black">Takvim istisnaları</h2>
            <div className="mt-3">
              {definitions.data?.calendarExceptions.length ? (
                definitions.data.calendarExceptions.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--wms-app-border)] py-3 text-sm"
                  >
                    <div>
                      <strong>
                        {row.exceptionDate} ·{" "}
                        {row.stationCode || "Tüm istasyonlar"}
                      </strong>
                      <p className="text-xs text-[var(--wms-app-text-muted)]">
                        {row.reason}
                      </p>
                    </div>
                    <GeneratorTag tone={row.isWorking ? "success" : "danger"}>
                      {row.isWorking
                        ? `${row.capacityMinutes ?? 0} dk çalışır`
                        : "Çalışılmaz"}
                    </GeneratorTag>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--wms-app-text-muted)]">
                  Tanımlı özel çalışma veya tatil günü yok.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

export function GeneratorProductionResourcesPage(): ReactElement {
  const definitions = useGeneratorDefinitions();
  return (
    <section className="space-y-5">
      <GeneratorPageHeader
        eyebrow="Jeneratör Üretim / Tanımlar"
        title="Üretim Kaynakları"
        description="Ortak kaynakların toplam kapasitesini ve hangi istasyonlar tarafından kullanıldığını izleyin."
      />
      {definitions.isLoading ? (
        <GeneratorLoading />
      ) : definitions.data?.resources.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {definitions.data.resources.map((resource) => (
            <article key={resource.id} className={`${gpPanel} p-5`}>
              <header className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs font-bold text-[var(--wms-brand-primary)]">
                    {resource.code}
                  </p>
                  <h2 className="font-black">{resource.name}</h2>
                  <p className="text-xs text-[var(--wms-app-text-muted)]">
                    {resource.resourceType}
                  </p>
                </div>
                <strong className="text-3xl font-black">
                  {resource.capacity}
                </strong>
              </header>
              <div className="mt-3 flex gap-2">
                <GeneratorTag
                  tone={resource.isExclusive ? "warning" : "normal"}
                >
                  {resource.isExclusive
                    ? "Paylaşımlı kritik kaynak"
                    : "Genel kaynak"}
                </GeneratorTag>
                <GeneratorTag tone={resource.isActive ? "success" : "danger"}>
                  {resource.isActive ? "Aktif" : "Pasif"}
                </GeneratorTag>
              </div>
              <div className="mt-5 space-y-2">
                {resource.stations.map((station) => (
                  <div
                    key={station.stationId}
                    className="flex items-center justify-between rounded-xl border border-[var(--wms-app-border)] p-3 text-sm"
                  >
                    <div>
                      <strong className="font-mono text-xs">
                        {station.stationCode}
                      </strong>
                      <p className="text-xs text-[var(--wms-app-text-muted)]">
                        {station.stationName}
                      </p>
                    </div>
                    <span className="font-black">
                      ×{station.requiredQuantity}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <GeneratorEmpty text="Üretim kaynağı tanımlı değil." />
      )}
    </section>
  );
}

export function GeneratorProductionRulesPage(): ReactElement {
  const definitions = useGeneratorDefinitions();
  return (
    <section className="space-y-5">
      <GeneratorPageHeader
        eyebrow="Jeneratör Üretim / Tanımlar"
        title="Planlama Kuralları"
        description="Kural seviyelerini, etkinlik durumunu ve kural parametrelerini kod değişikliği yapmadan yönetin."
      />
      <div className={`${gpPanel} flex gap-3 p-4 text-sm`}>
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
        <p>
          <strong>Sistem bütünlüğü kuralları</strong> kapatılamaz veya hata
          seviyesinden düşürülemez. Danışman kurallar şube ihtiyacına göre
          yönetilebilir.
        </p>
      </div>
      {definitions.isLoading ? (
        <GeneratorLoading />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {definitions.data?.rules.map((rule) => (
            <RuleEditor key={rule.id} rule={rule} />
          ))}
        </div>
      )}
    </section>
  );
}

function RuleEditor({ rule }: { rule: GeneratorRule }): ReactElement {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(rule);
  useEffect(() => setForm(rule), [rule]);
  const save = useMutation({
    mutationFn: generatorProductionApi.updateRule,
    onSuccess: (result) => {
      setForm(result);
      toast.success(`${result.code} kuralı kaydedildi.`);
      void queryClient.invalidateQueries({
        queryKey: ["generator-production", "definitions"],
      });
    },
    onError: (error) => toast.error(generatorError(error)),
  });
  const Icon =
    form.severity === "Error"
      ? AlertTriangle
      : form.severity === "Warning"
        ? AlertTriangle
        : Settings2;
  const iconColor =
    form.severity === "Error"
      ? "text-red-500"
      : form.severity === "Warning"
        ? "text-amber-500"
        : "text-sky-500";

  return (
    <article className={`${gpPanel} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-1 size-5 shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] font-bold text-[var(--wms-brand-primary)]">
                {form.code}
              </p>
              <h2 className="font-black">{form.name}</h2>
            </div>
            <div className="flex gap-1">
              <GeneratorTag tone={form.isEnabled ? "success" : "normal"}>
                {form.isEnabled ? "Etkin" : "Devre dışı"}
              </GeneratorTag>
              {form.isSystemRequired && (
                <GeneratorTag tone="danger">Sistem zorunlu</GeneratorTag>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm text-[var(--wms-app-text-muted)]">
            {form.description}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Önem seviyesi
          <select
            className={`${gpField} mt-1`}
            disabled={form.isSystemRequired}
            value={form.severity}
            onChange={(event) =>
              setForm({
                ...form,
                severity: event.target.value as GeneratorRule["severity"],
              })
            }
          >
            <option value="Information">Bilgi</option>
            <option value="Warning">Uyarı</option>
            <option value="Error">Hata / engelleyici</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 self-end rounded-xl border border-[var(--wms-app-border)] px-3 text-sm font-bold">
          <span>Kural etkin</span>
          <input
            className="size-4 accent-[var(--wms-brand-primary)]"
            type="checkbox"
            disabled={form.isSystemRequired}
            checked={form.isEnabled}
            onChange={(event) =>
              setForm({ ...form, isEnabled: event.target.checked })
            }
          />
        </label>
        <label className="text-sm font-bold sm:col-span-2">
          Kural parametreleri (JSON)
          <textarea
            className={`${gpField} mt-1 min-h-24 py-3 font-mono text-xs`}
            value={form.parametersJson ?? ""}
            onChange={(event) =>
              setForm({ ...form, parametersJson: event.target.value })
            }
            placeholder='Örnek: {"toleranceMinutes": 0}'
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          className={gpSecondaryButton}
          disabled={save.isPending}
          onClick={() => save.mutate(form)}
        >
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}{" "}
          Kaydet
        </button>
      </div>
    </article>
  );
}
