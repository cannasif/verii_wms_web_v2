import { useId, type ReactElement, type ReactNode } from "react";
import {
  BookOpenCheck,
  ChevronDown,
  CircleCheckBig,
  CircleHelp,
  ClipboardCheck,
  MapPinned,
  PlayCircle,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";

export type ParameterGuidanceContent = {
  summary: string;
  effect: string;
  affects: readonly string[];
  scenario: string;
  decision?: string;
  warning?: string;
  resourceKey?: string;
};

export type ParameterToggleGuidance = {
  enabled: ParameterGuidanceContent;
  disabled: ParameterGuidanceContent;
};

export function ParameterPageGuide({
  title,
  description,
  translationKey = "default",
  className,
}: {
  title?: string;
  description?: string;
  translationKey?: string;
  className?: string;
}): ReactElement {
  const { t } = useModuleTranslation("settings-guidance");
  const resolvedTitle = t(`pages.${translationKey}.title`, {
    defaultValue: title ?? "Ayarları nasıl kullanmalıyım?",
  });
  const resolvedDescription = t(`pages.${translationKey}.description`, {
    defaultValue:
      description ??
      "Her alanın altında mevcut seçimin kısa sonucu bulunur. “Etki ve örnek” bölümünü açarak hangi işlemleri etkilediğini ve gerçek kullanım senaryosunu görebilirsiniz.",
  });
  const checklistValue = t(`pages.${translationKey}.checklist`, {
    returnObjects: true,
    defaultValue: t("pages.default.checklist", { returnObjects: true }),
  });
  const checklist = Array.isArray(checklistValue)
    ? checklistValue.map(String)
    : [];

  return (
    <aside
      className={cn(
        "rounded-2xl border border-[color-mix(in_oklab,var(--wms-brand-primary)_28%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-brand-primary)_7%,var(--wms-app-panel))] p-4",
        className,
      )}
      aria-label={resolvedTitle}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]">
          <BookOpenCheck className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-[var(--wms-app-text)]">
            {resolvedTitle}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--wms-app-text-muted)]">
            {resolvedDescription}
          </p>
          <ol className="mt-3 grid gap-2 text-[0.72rem] leading-5 text-[var(--wms-app-text-muted)] sm:grid-cols-3">
            {["checkValue", "readResult", "openExample"].map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-2 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] px-3 py-2"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--wms-brand-soft)] text-[0.65rem] font-black text-[var(--wms-brand-primary)]">
                  {index + 1}
                </span>
                <span>{t(`instructions.${step}`)}</span>
              </li>
            ))}
          </ol>
          {checklist.length > 0 ? (
            <details className="group mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[.045]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-black text-amber-700 marker:content-none dark:text-amber-300">
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="size-4" aria-hidden />
                  {t("labels.beforeSave")}
                </span>
                <ChevronDown
                  className="size-3.5 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <ul className="grid gap-2 border-t border-amber-500/20 p-3 text-[0.72rem] leading-5 text-[var(--wms-app-text-muted)] sm:grid-cols-3">
                {checklist.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CircleCheckBig
                      className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-300"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export function ParameterFieldGuide({
  guidance,
  currentValue,
  className,
  showSummary = true,
}: {
  guidance: ParameterGuidanceContent;
  currentValue?: string;
  className?: string;
  showSummary?: boolean;
}): ReactElement {
  const contentId = useId();
  const { t } = useModuleTranslation("settings-guidance");
  const localizedGuidance = localizeGuidance(guidance, t);
  const localizedCurrentValue = localizeCurrentValue(currentValue, t);

  return (
    <div className={cn("mt-2", className)}>
      {showSummary ? (
        <div className="flex items-start gap-2 rounded-xl bg-[color-mix(in_oklab,var(--wms-brand-primary)_4%,transparent)] px-2.5 py-2 text-xs leading-5 text-[var(--wms-app-text-muted)]">
          <CircleHelp
            className="mt-0.5 size-3.5 shrink-0 text-[var(--wms-brand-primary)]"
            aria-hidden
          />
          <div className="min-w-0">
            {localizedCurrentValue ? (
              <p className="font-black text-[var(--wms-brand-primary)]">
                {t("labels.current", {
                  value: localizedCurrentValue,
                  defaultValue: `Seçili değer: ${localizedCurrentValue}`,
                })}
              </p>
            ) : null}
            <p className={cn("text-[var(--wms-app-text)]", localizedCurrentValue && "mt-0.5")}>
              <span className="font-black">
                {t("labels.shortResult", { defaultValue: "Sonuç:" })}{" "}
              </span>
              {localizedGuidance.summary}
            </p>
          </div>
        </div>
      ) : null}

      <details className={cn("group rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_94%,var(--wms-brand-primary))]", showSummary && "mt-2")}>
        <summary
          aria-controls={contentId}
          className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-[var(--wms-brand-primary)] marker:content-none"
        >
          <span>{localizedCurrentValue
            ? t("labels.detailsForState", {
                state: localizedCurrentValue,
                defaultValue: `${localizedCurrentValue} durumunun ayrıntısını ve örneğini göster`,
              })
            : t("labels.details", { defaultValue: "Basit açıklamayı ve örneği göster" })}</span>
          <ChevronDown
            className="size-3.5 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div
          id={contentId}
          className="grid gap-3 border-t border-[var(--wms-app-border)] p-3 text-xs leading-5"
        >
          <GuideBlock
            icon={<BookOpenCheck />}
            title={t("labels.effect", {
              defaultValue: "1. Bu seçeneği seçerseniz ne olur?",
            })}
          >
            {localizedGuidance.effect}
          </GuideBlock>
          {localizedGuidance.decision ? (
            <GuideBlock
              icon={<CircleCheckBig />}
              title={t("labels.decision", {
                defaultValue: "2. Bu seçeneği ne zaman tercih etmelisiniz?",
              })}
            >
              {localizedGuidance.decision}
            </GuideBlock>
          ) : null}
          <GuideBlock
            icon={<PlayCircle />}
            title={t("labels.scenario", {
              defaultValue: "3. Gerçek örnek: işlem nasıl ilerler?",
            })}
            className="border-[color-mix(in_oklab,var(--wms-brand-primary)_20%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-brand-primary)_5%,var(--wms-app-panel))]"
          >
            {localizedGuidance.scenario}
          </GuideBlock>
          <GuideBlock
            icon={<MapPinned />}
            title={t("labels.affects", {
              defaultValue: "4. Hangi ekranlar ve işlemler değişir?",
            })}
          >
            <ul className="grid gap-1 sm:grid-cols-2">
              {localizedGuidance.affects.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </GuideBlock>
          {localizedGuidance.warning ? (
            <GuideBlock
              icon={<TriangleAlert />}
              title={t("labels.warning", {
                defaultValue: "5. Dikkat: yanlış seçimde ne olabilir?",
              })}
              className="border border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300"
            >
              {localizedGuidance.warning}
            </GuideBlock>
          ) : null}
        </div>
      </details>
    </div>
  );
}

export function ParameterToggleCard({
  title,
  checked,
  onCheckedChange,
  guidance,
  disabled,
  className,
}: {
  title: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  guidance: ParameterToggleGuidance;
  disabled?: boolean;
  className?: string;
}): ReactElement {
  const inputId = useId();
  const { t } = useModuleTranslation("settings-guidance");
  const enabledGuidance = localizeGuidance(guidance.enabled, t);
  const disabledGuidance = localizeGuidance(guidance.disabled, t);
  const selectedGuidance = checked ? guidance.enabled : guidance.disabled;
  const selectedState = checked
    ? String(t("labels.enabled", { defaultValue: "Açık" }))
    : String(t("labels.disabled", { defaultValue: "Kapalı" }));

  return (
    <article
      className={cn(
        "rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-3 transition",
        checked &&
          "border-[color-mix(in_oklab,var(--wms-brand-primary)_40%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-brand-primary)_4%,var(--wms-app-panel))]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label
            htmlFor={inputId}
            className="cursor-pointer text-sm font-bold text-[var(--wms-app-text)]"
          >
            {title}
          </label>
          <p
            className={cn(
              "mt-0.5 text-[0.68rem] font-bold uppercase tracking-[0.12em]",
              checked
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-[var(--wms-app-text-muted)]",
            )}
          >
            {checked
              ? t("labels.enabled", { defaultValue: "Açık" })
              : t("labels.disabled", { defaultValue: "Kapalı" })}
          </p>
        </div>
        <input
          id={inputId}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--wms-brand-primary)]"
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ToggleStateResult
          active={checked}
          label={String(t("labels.enabledResult", { defaultValue: "Açık yaparsanız" }))}
          result={enabledGuidance.summary}
          selectedLabel={String(t("labels.selected", { defaultValue: "Şu an seçili" }))}
        />
        <ToggleStateResult
          active={!checked}
          label={String(t("labels.disabledResult", { defaultValue: "Kapalı bırakırsanız" }))}
          result={disabledGuidance.summary}
          selectedLabel={String(t("labels.selected", { defaultValue: "Şu an seçili" }))}
        />
      </div>
      <ParameterFieldGuide
        guidance={selectedGuidance}
        currentValue={selectedState}
        showSummary={false}
      />
    </article>
  );
}

function ToggleStateResult({
  active,
  label,
  result,
  selectedLabel,
}: {
  active: boolean;
  label: string;
  result: string;
  selectedLabel: string;
}): ReactElement {
  return (
    <section
      className={cn(
        "rounded-xl border px-3 py-2.5 text-xs leading-5",
        active
          ? "border-[color-mix(in_oklab,var(--wms-brand-primary)_45%,var(--wms-app-border))] bg-[var(--wms-brand-soft)] text-[var(--wms-app-text)]"
          : "border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_96%,black)] text-[var(--wms-app-text-muted)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-black uppercase tracking-[0.08em]">{label}</span>
        {active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wms-brand-primary)] px-2 py-0.5 text-[0.62rem] font-black text-white">
            <CircleCheckBig className="size-3" aria-hidden /> {selectedLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-1">{result}</p>
    </section>
  );
}

type GuidanceTranslator = (
  key: string,
  options?: Record<string, unknown>,
) => unknown;

function localizeGuidance(
  guidance: ParameterGuidanceContent,
  t: GuidanceTranslator,
): ParameterGuidanceContent {
  if (!guidance.resourceKey) return guidance;

  const translatedAffects = t(`${guidance.resourceKey}.affects`, {
    returnObjects: true,
    defaultValue: guidance.affects,
  });

  return {
    ...guidance,
    summary: String(
      t(`${guidance.resourceKey}.summary`, { defaultValue: guidance.summary }),
    ),
    effect: String(
      t(`${guidance.resourceKey}.effect`, { defaultValue: guidance.effect }),
    ),
    affects: Array.isArray(translatedAffects)
      ? translatedAffects.map(String)
      : guidance.affects,
    scenario: String(
      t(`${guidance.resourceKey}.scenario`, {
        defaultValue: guidance.scenario,
      }),
    ),
    decision: guidance.decision
      ? String(
          t(`${guidance.resourceKey}.decision`, {
            defaultValue: guidance.decision,
          }),
        )
      : undefined,
    warning: guidance.warning
      ? String(
          t(`${guidance.resourceKey}.warning`, {
            defaultValue: guidance.warning,
          }),
        )
      : undefined,
  };
}

function localizeCurrentValue(
  value: string | undefined,
  t: GuidanceTranslator,
): string | undefined {
  if (!value) return value;
  if (["Açık", "Open", "Enabled"].includes(value)) {
    return String(t("labels.enabled", { defaultValue: value }));
  }
  if (["Kapalı", "Closed", "Disabled"].includes(value)) {
    return String(t("labels.disabled", { defaultValue: value }));
  }
  if (value === "Ön ek yok") {
    return String(t("labels.noPrefix", { defaultValue: value }));
  }

  const days = value.match(/^(\d+)\s+gün$/i);
  if (days) {
    return String(
      t("units.days", {
        count: Number(days[1]),
        value: days[1],
        defaultValue: value,
      }),
    );
  }

  const revisions = value.match(/^(\d+)\s+revizyon$/i);
  if (revisions) {
    return String(
      t("units.revisions", {
        count: Number(revisions[1]),
        value: revisions[1],
        defaultValue: value,
      }),
    );
  }

  return value;
}

function GuideBlock({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <section
      className={cn(
        "rounded-lg bg-black/[.025] p-2.5 text-[var(--wms-app-text-muted)] dark:bg-white/[.035]",
        className,
      )}
    >
      <h3 className="mb-1 flex items-center gap-1.5 font-black text-[var(--wms-app-text)] [&>svg]:size-3.5 [&>svg]:text-[var(--wms-brand-primary)]">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
