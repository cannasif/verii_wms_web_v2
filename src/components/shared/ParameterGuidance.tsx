import { useId, type ReactElement, type ReactNode } from "react";
import {
  BookOpenCheck,
  ChevronDown,
  CircleHelp,
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
  warning?: string;
  resourceKey?: string;
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
        </div>
      </div>
    </aside>
  );
}

export function ParameterFieldGuide({
  guidance,
  currentValue,
  className,
}: {
  guidance: ParameterGuidanceContent;
  currentValue?: string;
  className?: string;
}): ReactElement {
  const contentId = useId();
  const { t } = useModuleTranslation("settings-guidance");
  const localizedGuidance = localizeGuidance(guidance, t);
  const localizedCurrentValue = localizeCurrentValue(currentValue, t);

  return (
    <div className={cn("mt-2", className)}>
      <div className="flex items-start gap-2 text-xs leading-5 text-[var(--wms-app-text-muted)]">
        <CircleHelp
          className="mt-0.5 size-3.5 shrink-0 text-[var(--wms-brand-primary)]"
          aria-hidden
        />
        <p>
          {localizedCurrentValue ? (
            <span className="mr-1 font-bold text-[var(--wms-app-text)]">
              {t("labels.current", {
                value: localizedCurrentValue,
                defaultValue: `Şu anda: ${localizedCurrentValue}.`,
              })}
            </span>
          ) : null}
          {localizedGuidance.summary}
        </p>
      </div>

      <details className="group mt-2 rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_94%,var(--wms-brand-primary))]">
        <summary
          aria-controls={contentId}
          className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-[var(--wms-brand-primary)] marker:content-none"
        >
          <span>{t("labels.details", { defaultValue: "Etki ve örnek" })}</span>
          <ChevronDown
            className="size-3.5 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div
          id={contentId}
          className="grid gap-3 border-t border-[var(--wms-app-border)] p-3 text-xs leading-5 sm:grid-cols-2"
        >
          <GuideBlock
            icon={<BookOpenCheck />}
            title={t("labels.effect", { defaultValue: "Bu seçimde ne olur?" })}
          >
            {localizedGuidance.effect}
          </GuideBlock>
          <GuideBlock
            icon={<MapPinned />}
            title={t("labels.affects", { defaultValue: "Nereleri etkiler?" })}
          >
            <ul className="space-y-1">
              {localizedGuidance.affects.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </GuideBlock>
          <GuideBlock
            icon={<PlayCircle />}
            title={t("labels.scenario", { defaultValue: "Örnek senaryo" })}
            className="sm:col-span-2"
          >
            {localizedGuidance.scenario}
          </GuideBlock>
          {localizedGuidance.warning ? (
            <GuideBlock
              icon={<TriangleAlert />}
              title={t("labels.warning", { defaultValue: "Dikkat" })}
              className="border-amber-500/25 bg-amber-500/8 text-amber-700 sm:col-span-2 dark:text-amber-300"
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
  guidance: ParameterGuidanceContent;
  disabled?: boolean;
  className?: string;
}): ReactElement {
  const inputId = useId();
  const { t } = useModuleTranslation("settings-guidance");

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
      <ParameterFieldGuide
        guidance={guidance}
        currentValue={
          checked
            ? t("labels.enabled", { defaultValue: "Açık" })
            : t("labels.disabled", { defaultValue: "Kapalı" })
        }
      />
    </article>
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
