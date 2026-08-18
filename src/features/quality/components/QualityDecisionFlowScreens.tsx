import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Copy, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { useTheme } from "@/components/theme-provider";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { localizeEnumValue } from "@/lib/enum-localization";
import { formatProjectNumber } from "@/lib/project-format";
import { cn } from "@/lib/utils";
import type { QualityDecisionResult } from "../api/quality.api";

export function QualityApproveSubmitScreen({
  phase,
  errorMessage,
  lineCount,
  documentNo,
  sourceLabel,
}: {
  phase: "running" | "error";
  errorMessage?: string;
  lineCount: number;
  documentNo?: string;
  sourceLabel?: string;
}): ReactElement {
  const { t } = useModuleTranslation("quality");
  const { skin } = useTheme();
  const isPremium = skin === "premium";
  const isError = phase === "error";
  const logKeys = [
    "decisionFlow.submit.log0",
    "decisionFlow.submit.log1",
    "decisionFlow.submit.log2",
    "decisionFlow.submit.log3",
    "decisionFlow.submit.log4",
  ] as const;
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    if (isError) return;
    const timer = window.setInterval(() => {
      setLogIndex((current) => (current + 1) % logKeys.length);
    }, isPremium ? 1100 : 850);
    return () => window.clearInterval(timer);
  }, [isError, isPremium, logKeys.length]);

  return (
    <div
      className={cn(
        "wms-ops-gr-submit wms-ops-gr-submit--quality",
        isError && "wms-ops-gr-submit--error",
        isPremium ? "wms-ops-gr-submit--premium" : "wms-ops-gr-submit--terminal",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="wms-ops-gr-submit__glow" aria-hidden />
      <div className="wms-ops-gr-submit__grid" aria-hidden />
      <div className="wms-ops-gr-submit__scanline" aria-hidden />

      <header className="wms-ops-gr-submit__chrome">
        <span className="wms-ops-gr-submit__chrome-traffic" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="wms-ops-gr-submit__chrome-path">
          {isError ? "wms://quality/approve/error" : "wms://quality/approve"}
        </span>
        <span className="wms-ops-gr-submit__chrome-status">
          {isError ? "FAIL" : "RUN"}
        </span>
      </header>

      <div className="wms-ops-gr-submit__inner">
        <div className="wms-ops-gr-submit__icon" aria-hidden>
          {isError ? (
            <ShieldAlert className="size-7" />
          ) : (
            <ShieldCheck className="size-7" />
          )}
          {!isError ? (
            <span className="wms-ops-gr-submit__spinner">
              <Loader2 className="size-4 animate-spin" />
            </span>
          ) : null}
        </div>

        <p className="wms-ops-gr-submit__eyebrow">
          <span className="wms-ops-gr-submit__eyebrow-prompt" aria-hidden>
            {isError ? "!" : ">"}
          </span>
          {isError
            ? t("decisionFlow.submit.errorEyebrow")
            : t("decisionFlow.submit.eyebrow")}
        </p>
        <h2 className="wms-ops-gr-submit__title">
          {isError
            ? t("decisionFlow.submit.errorTitle")
            : t("decisionFlow.submit.title")}
        </h2>
        <p className="wms-ops-gr-submit__subtitle">
          {isError
            ? t("decisionFlow.submit.errorReturning")
            : t("decisionFlow.submit.subtitle", {
                count: lineCount,
                name: sourceLabel || "—",
              })}
        </p>

        {documentNo ? (
          <div className="wms-ops-gr-submit__doc">
            <span>{t("decisionFlow.submit.documentLabel")}</span>
            <strong>{documentNo}</strong>
          </div>
        ) : null}

        {isError ? (
          <div className="wms-ops-gr-submit__error" role="alert">
            <span className="wms-ops-gr-submit__error-tag">ERR</span>
            <span>
              {errorMessage || t("decisionFlow.submit.errorFallback")}
            </span>
          </div>
        ) : (
          <>
            <div className="wms-ops-gr-submit__progress" aria-hidden>
              <span className="wms-ops-gr-submit__progress-bar" />
            </div>
            <ul className="wms-ops-gr-submit__log">
              {logKeys.map((key, index) => (
                <li
                  key={key}
                  className={cn(
                    index === logIndex && "wms-ops-gr-submit__log-item--active",
                    index < logIndex && "wms-ops-gr-submit__log-item--done",
                  )}
                >
                  <span className="wms-ops-gr-submit__log-index" aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="wms-ops-gr-submit__log-prompt" aria-hidden>
                    {index === logIndex ? ">" : index < logIndex ? "ok" : "·"}
                  </span>
                  <span className="wms-ops-gr-submit__log-text">{t(key)}</span>
                  {index === logIndex ? (
                    <span className="wms-ops-gr-submit__cursor" aria-hidden />
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function SuccessDocumentChip({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  const { t } = useModuleTranslation("quality");

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("decisionFlow.success.documentCopied"));
    } catch {
      toast.error(t("decisionFlow.success.documentCopyFailed"));
    }
  };

  return (
    <button
      type="button"
      className="wms-ops-gr-success__doc wms-ops-gr-success__doc--copyable"
      onClick={() => void copyValue()}
      title={t("decisionFlow.success.copyDocument")}
      aria-label={t("decisionFlow.success.copyDocument")}
    >
      <span className="wms-ops-gr-success__doc-label">{label}</span>
      <span className="wms-ops-gr-success__doc-row">
        <strong className="wms-ops-gr-success__doc-value">{value}</strong>
        <Copy className="wms-ops-gr-success__doc-copy-icon size-3.5" aria-hidden />
      </span>
    </button>
  );
}

export function QualityReceiptCreatedSuccessPanel({
  result,
  lineCount,
  sourceLabel,
  sourceWaybillNo,
  onDone,
}: {
  result: QualityDecisionResult;
  lineCount: number;
  sourceLabel?: string;
  sourceWaybillNo?: string;
  onDone: () => void;
}): ReactElement {
  const { t } = useModuleTranslation("quality");
  const isElectronicWaybill = Boolean(
    result.goodsReceiptElectronicWaybillNo?.trim(),
  );
  const documentValue = (
    result.goodsReceiptElectronicWaybillNo ||
    result.goodsReceiptWaybillNo ||
    sourceWaybillNo ||
    ""
  ).trim();

  return (
    <div className="wms-ops-gr-success wms-ops-gr-success--done">
      <div className="wms-ops-gr-success__glow" aria-hidden />
      <header className="wms-ops-gr-success__header">
        <div className="wms-ops-gr-success__icon" aria-hidden>
          <CheckCircle2 className="size-9" />
        </div>
        <p className="wms-ops-gr-success__eyebrow">
          {t("decisionFlow.success.eyebrow")}
        </p>
        <h2 className="wms-ops-gr-success__title">
          {t("decisionFlow.success.title")}
        </h2>
        <p className="wms-ops-gr-success__subtitle">
          {sourceLabel
            ? t("decisionFlow.success.subtitleWithSource", { name: sourceLabel })
            : t("decisionFlow.success.subtitle")}
        </p>
        {documentValue ? (
          <SuccessDocumentChip
            label={t(
              isElectronicWaybill
                ? "decisionFlow.success.electronicDocumentLabel"
                : "decisionFlow.success.documentLabel",
            )}
            value={documentValue}
          />
        ) : null}
      </header>

      <div className="wms-ops-gr-success__stats">
        <div className="wms-ops-gr-success__stat">
          <span className="wms-ops-gr-success__stat-label">
            {t("decisionFlow.success.line")}
          </span>
          <strong className="wms-ops-gr-success__stat-value">
            {formatProjectNumber(lineCount)}
          </strong>
        </div>
        <div className="wms-ops-gr-success__stat">
          <span className="wms-ops-gr-success__stat-label">
            {t("decisionFlow.success.status")}
          </span>
          <strong className="wms-ops-gr-success__stat-value wms-ops-gr-success__stat-value--status">
            {t("decisionFlow.success.statusCompleted")}
          </strong>
        </div>
        <div className="wms-ops-gr-success__stat">
          <span className="wms-ops-gr-success__stat-label">
            {t("decisionFlow.success.erp")}
          </span>
          <strong className="wms-ops-gr-success__stat-value wms-ops-gr-success__stat-value--status">
            {result.erpIntegrationStatus
              ? localizeEnumValue(result.erpIntegrationStatus)
              : "—"}
          </strong>
        </div>
      </div>

      <footer className="wms-ops-gr-success__actions">
        <OpsActionButton type="button" variant="primary" onClick={onDone}>
          {t("decisionFlow.success.backToList")}
        </OpsActionButton>
        <OpsActionButton type="button" variant="secondary" asChild>
          <Link to="/warehouse/goods-receipts/list" onClick={onDone}>
            {t("decisionFlow.success.receiptList")}
          </Link>
        </OpsActionButton>
      </footer>
    </div>
  );
}

export function QualityDecisionFlowOverlay({
  children,
}: {
  children: ReactElement;
}): ReactElement {
  return (
    <div className="wms-ops-quality-decision-flow-overlay">
      <div className="wms-ops-form wms-ops-quality-decision-flow-overlay__panel">
        {children}
      </div>
    </div>
  );
}
