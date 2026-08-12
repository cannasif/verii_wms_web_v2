import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { ChevronDown, ClipboardPen, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
  type GridRequest,
} from "@/components/shared/AdvancedDataGrid";
import { requiredActionColumn } from "@/components/shared/GridSystemColumns";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppInput } from "@/components/shared/AppInput";
import { PagedAppDropdown } from "@/components/shared/PagedAppDropdown";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import {
  OpsStatusBadge,
  inferDocumentTypeTone,
  inferOpsStatusTone,
} from "@/components/shared/OpsStatusBadge";
import { OpsSkinCheckbox } from "@/components/shared/OpsSkinCheckbox";
import { OpsFieldShell } from "@/components/shared/OpsFieldShell";
import { OPS_FIELD_CLASS } from "@/components/shared/ops-field-styles";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QualityInspectionStatusFilter } from "./QualityInspectionStatusFilter";
import {
  buildQualityInspectionStatusFilters,
  QUALITY_INSPECTION_STATUS_EXCLUDE_PASSED,
} from "../utils/quality-inspection-list-filters";
import { cn } from "@/lib/utils";
import { localizeEnumValue } from "@/lib/enum-localization";
import {
  formatProjectDate,
  formatProjectDateTime,
  formatProjectNumber,
} from "@/lib/project-format";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { goodsReceiptV2Api } from "@/features/goods-receipt-v2/api/goods-receipt.api";
import {
  qualityApi,
  type QualityInspection,
  type QualityInspectionDetail,
  type QualityInspectionDispositionRequest,
  type QualityInspectionLine,
} from "../api/quality.api";

const ACTIONABLE_DECISIONS = new Set(["Pending", "Hold", "Quarantined"]);
const QTY_EPS = 0.000001;

type LineDraft = {
  decision: string;
  quantity: string;
  remainderDecision: string;
  reasonCode: string;
  reasonNote: string;
  targetLocationId?: number | null;
  dispositions?: DispositionDraft[];
};

type DispositionDraft = {
  key: string;
  decision: string;
  quantity: string;
  targetLocationId: number | null;
};

function isActionableLine(line: QualityInspectionLine): boolean {
  return ACTIONABLE_DECISIONS.has(line.decision);
}

function isSerialTracked(line: QualityInspectionLine): boolean {
  return Boolean(line.serialNo?.trim());
}

type QualityLineGroup = {
  key: string;
  lines: QualityInspectionLine[];
  primary: QualityInspectionLine;
};

/** Aynı stok / mal kabul satırı altındaki serili kalemleri tek satırda toplar. */
function groupQualityLines(lines: QualityInspectionLine[]): QualityLineGroup[] {
  const groups = new Map<string, QualityInspectionLine[]>();
  const order: string[] = [];

  for (const line of lines) {
    const key = isSerialTracked(line)
      ? `serial:${line.id}`
      : `line:${line.id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(line);
  }

  return order.map((key) => {
    const groupLines = groups.get(key)!;
    return { key, lines: groupLines, primary: groupLines[0]! };
  });
}

function sumLineQuantity(lines: QualityInspectionLine[]): number {
  return roundQty(lines.reduce((sum, line) => sum + line.quantity, 0));
}

function sumActionableQuantity(lines: QualityInspectionLine[]): number {
  return roundQty(lines.reduce((sum, line) => sum + actionableQuantity(line), 0));
}

function sumSampleQuantity(lines: QualityInspectionLine[]): number {
  return roundQty(lines.reduce((sum, line) => sum + line.sampleQuantity, 0));
}

/** Backend ActionableQuantity ile aynı mantık. */
function actionableQuantity(line: QualityInspectionLine): number {
  if (line.decision === "Quarantined") {
    return Math.max(0, line.quarantineQuantity);
  }
  return Math.max(
    0,
    line.quantity -
      line.acceptedQuantity -
      line.rejectedQuantity -
      line.quarantineQuantity,
  );
}

async function notifyGoodsReceiptAfterDecision(
  detail: QualityInspectionDetail,
  openGoodsReceiptList: () => void,
  t: TFunction,
): Promise<void> {
  const docNo = detail.header.sourceDocumentNo?.trim();
  const isGoodsReceipt =
    detail.header.sourceDocumentType === "GR" ||
    detail.header.sourceDocumentType === "GoodsReceipt";
  const actionLabel = t("goodsReceiptNotice.actionLabel");

  toast.success(t("goodsReceiptNotice.decidedToastTitle"), {
    description: docNo
      ? t("goodsReceiptNotice.withDoc", { docNo })
      : t("goodsReceiptNotice.withoutDoc"),
    action: {
      label: actionLabel,
      onClick: openGoodsReceiptList,
    },
  });

  if (!isGoodsReceipt || !docNo) return;

  try {
    const page = await goodsReceiptV2Api.paged({
      pageNumber: 1,
      pageSize: 20,
      search: docNo,
      searchFields: ["documentNo"],
      filterLogic: "and",
      filters: [],
    });
    const rows = page.items ?? page.data ?? [];
    const row =
      rows.find((item) => item.documentNo === docNo) ??
      rows.find((item) =>
        item.documentNo.toLocaleUpperCase("tr-TR").includes(
          docNo.toLocaleUpperCase("tr-TR"),
        ),
      );
    if (!row) {
      toast.message(t("goodsReceiptNotice.searchable"), {
        description: docNo,
        action: { label: actionLabel, onClick: openGoodsReceiptList },
      });
      return;
    }

    const erp = row.erpIntegrationStatus;
    const erpLabel = localizeEnumValue(erp);
    if (erp === "Succeeded") {
      toast.success(t("goodsReceiptNotice.erpTransferredTitle"), {
        description: t("goodsReceiptNotice.erpTransferredDesc", { docNo }),
        action: { label: actionLabel, onClick: openGoodsReceiptList },
      });
    } else if (erp === "Pending" || erp === "Processing") {
      toast.message(t("goodsReceiptNotice.erpPendingTitle"), {
        description: t("goodsReceiptNotice.erpPendingDesc", { docNo, erpLabel }),
        action: { label: actionLabel, onClick: openGoodsReceiptList },
      });
    } else if (erp === "Failed" || erp === "CommitUncertain") {
      toast.warning(t("goodsReceiptNotice.erpFailedTitle"), {
        description: t("goodsReceiptNotice.erpFailedDesc", { docNo, erpLabel }),
        action: { label: actionLabel, onClick: openGoodsReceiptList },
      });
    } else if (erp === "NotRequired") {
      toast.message(t("goodsReceiptNotice.erpNotRequiredTitle"), {
        description: docNo,
        action: { label: actionLabel, onClick: openGoodsReceiptList },
      });
    } else {
      toast.message(t("goodsReceiptNotice.updatedTitle"), {
        description: erp
          ? t("goodsReceiptNotice.updatedDescWithErp", { docNo, erpLabel })
          : t("goodsReceiptNotice.updatedDescNoErp", { docNo }),
        action: { label: actionLabel, onClick: openGoodsReceiptList },
      });
    }
  } catch {
    toast.message(t("goodsReceiptNotice.unresolvedTitle"), {
      description: docNo,
      action: { label: actionLabel, onClick: openGoodsReceiptList },
    });
  }
}

function emptyDraft(
  defaultDecision = "",
  quantity = 0,
  remainderDecision = "Quarantined",
  targetLocationId: number | null = null,
): LineDraft {
  return {
    decision: defaultDecision,
    quantity: quantity > 0 ? String(quantity) : "",
    remainderDecision,
    reasonCode: "",
    reasonNote: "",
    targetLocationId,
  };
}

function defaultTargetForDecision(
  decision: string,
  acceptedLocationId: number | null,
  quarantineLocationId: number | null,
  rejectedLocationId: number | null,
): number | null {
  if (decision === "Accepted") return acceptedLocationId;
  if (decision === "Quarantined") return quarantineLocationId;
  if (decision === "Rejected") return rejectedLocationId;
  return null;
}

function dispositionDraft(
  decision = "Accepted",
  quantity = 0,
  targetLocationId: number | null = null,
): DispositionDraft {
  return {
    key: crypto.randomUUID(),
    decision,
    quantity: quantity > 0 ? String(roundQty(quantity)) : "",
    targetLocationId,
  };
}

function draftDispositions(
  line: QualityInspectionLine,
  draft: LineDraft,
  fallbackAcceptedLocationId: number | null,
  fallbackQuarantineLocationId: number | null,
  fallbackRejectedLocationId: number | null,
  t: TFunction,
): DispositionDraft[] {
  if (draft.dispositions?.length) return draft.dispositions;
  const allocation = buildQuantityDecision(line, draft, t);
  const result: DispositionDraft[] = [];
  if (allocation.acceptedQuantity > QTY_EPS) {
    result.push(dispositionDraft(
      "Accepted",
      allocation.acceptedQuantity,
      draft.decision === "Accepted" ? draft.targetLocationId ?? fallbackAcceptedLocationId : fallbackAcceptedLocationId,
    ));
  }
  if (allocation.quarantineQuantity > QTY_EPS) {
    result.push(dispositionDraft(
      "Quarantined",
      allocation.quarantineQuantity,
      draft.decision === "Quarantined" ? draft.targetLocationId ?? fallbackQuarantineLocationId : fallbackQuarantineLocationId,
    ));
  }
  if (allocation.rejectedQuantity > QTY_EPS) {
    result.push(dispositionDraft(
      "Rejected",
      allocation.rejectedQuantity,
      draft.decision === "Rejected" ? draft.targetLocationId ?? fallbackRejectedLocationId : fallbackRejectedLocationId,
    ));
  }
  return result;
}

function parseQty(value: string): number {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!normalized) return NaN;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function roundQty(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function remainderOptionsFor(
  decision: string,
  quarantineAvailable: boolean,
  t: TFunction,
): Array<{ value: string; label: string }> {
  const all = [
    { value: "Accepted", label: t("decisionOptions.acceptedShort") },
    { value: "Quarantined", label: t("decisionOptions.quarantinedShort") },
    { value: "Rejected", label: t("decisionOptions.rejectedShort") },
  ].filter((option) => option.value !== decision);
  return quarantineAvailable
    ? all
    : all.filter((option) => option.value !== "Quarantined");
}

function buildQuantityDecision(
  line: QualityInspectionLine,
  draft: LineDraft,
  t: TFunction,
): {
  lineId: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  quarantineQuantity: number;
} {
  const remaining = actionableQuantity(line);
  const qty = roundQty(parseQty(draft.quantity));
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error(
      t("errors.qtyMustBePositive", { stockCode: line.stockCode }),
    );
  }
  if (qty - remaining > QTY_EPS) {
    throw new Error(
      t("errors.qtyExceedsRemaining", {
        stockCode: line.stockCode,
        remaining: formatProjectNumber(remaining),
      }),
    );
  }

  const primary = draft.decision;
  if (primary === "Returned") {
    throw new Error(
      t("errors.returnedFullLineOnly", { stockCode: line.stockCode }),
    );
  }

  let accepted = 0;
  let rejected = 0;
  let quarantine = 0;
  if (primary === "Accepted") accepted = qty;
  else if (primary === "Rejected") rejected = qty;
  else if (primary === "Quarantined") quarantine = qty;
  else throw new Error(t("errors.selectValidDecision", { stockCode: line.stockCode }));

  const rest = roundQty(remaining - qty);
  if (rest > QTY_EPS) {
    if (isSerialTracked(line)) {
      throw new Error(
        t("errors.serialCannotSplit", {
          label: line.serialNo || line.stockCode,
        }),
      );
    }
    const remainder = draft.remainderDecision;
    if (!remainder || remainder === primary) {
      throw new Error(
        t("errors.selectRemainderDecision", {
          stockCode: line.stockCode,
          rest: formatProjectNumber(rest),
        }),
      );
    }
    if (remainder === "Accepted") accepted += rest;
    else if (remainder === "Rejected") rejected += rest;
    else if (remainder === "Quarantined") quarantine += rest;
    else {
      throw new Error(
        t("errors.selectRemainderAcceptRejectQuarantine", {
          stockCode: line.stockCode,
        }),
      );
    }
  }

  return {
    lineId: line.id,
    acceptedQuantity: roundQty(accepted),
    rejectedQuantity: roundQty(rejected),
    quarantineQuantity: roundQty(quarantine),
  };
}

function buildDispositionRequests(
  line: QualityInspectionLine,
  draft: LineDraft,
  fallbackAcceptedLocationId: number | null,
  fallbackQuarantineLocationId: number | null,
  fallbackRejectedLocationId: number | null,
  t: TFunction,
): QualityInspectionDispositionRequest[] {
  const parts = draftDispositions(
    line,
    draft,
    fallbackAcceptedLocationId,
    fallbackQuarantineLocationId,
    fallbackRejectedLocationId,
    t,
  );
  if (parts.length === 0) {
    throw new Error(t("errors.distributionAtLeastOne"));
  }
  const parsed = parts.map((part) => ({ ...part, parsedQuantity: roundQty(parseQty(part.quantity)) }));
  if (parsed.some((part) => !part.decision || !Number.isFinite(part.parsedQuantity) || part.parsedQuantity <= 0)) {
    throw new Error(t("errors.distributionRowsInvalid"));
  }
  const remaining = actionableQuantity(line);
  const total = roundQty(parsed.reduce((sum, part) => sum + part.parsedQuantity, 0));
  if (Math.abs(total - remaining) > QTY_EPS) {
    throw new Error(t("errors.distributionTotalMismatch", {
      total: formatProjectNumber(total),
      remaining: formatProjectNumber(remaining),
    }));
  }
  const returned = parsed.filter((part) => part.decision === "Returned");
  if (returned.length > 0 && parsed.length !== 1) {
    throw new Error(t("errors.returnedFullLineOnly", { stockCode: line.stockCode }));
  }
  if (parsed.some((part) => part.decision !== "Accepted") && !draft.reasonCode.trim()) {
    throw new Error(t("errors.reasonCodeRequiredAllRows"));
  }
  if (parsed.some((part) => (part.decision === "Rejected" || part.decision === "Quarantined") && !part.targetLocationId)) {
    throw new Error(t("errors.decisionDestinationRequired"));
  }
  return parsed.map((part) => ({
    lineId: line.id,
    decision: part.decision,
    quantity: part.parsedQuantity,
    targetLocationId: part.targetLocationId,
    reasonCode: draft.reasonCode.trim() || undefined,
    note: draft.reasonNote.trim() || undefined,
  }));
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function buildApplySummary(
  lines: QualityInspectionLine[],
  drafts: Record<number, LineDraft>,
  t: TFunction,
): { title: string; bullets: string[] } {
  const pending = lines.filter((line) => {
    const draft = drafts[line.id];
    return Boolean(draft?.decision || draft?.dispositions?.length);
  });
  const title = t("applySummary.title");
  if (pending.length === 0) {
    return {
      title,
      bullets: [t("applySummary.selectAtLeastOneDecision")],
    };
  }

  let accepted = 0;
  let rejected = 0;
  let quarantine = 0;
  let returned = 0;
  let invalid = 0;

  for (const line of pending) {
    const draft = drafts[line.id] ?? emptyDraft();
    if (draft.dispositions?.length) {
      try {
        for (const part of buildDispositionRequests(line, draft, null, null, null, t)) {
          if (part.decision === "Accepted") accepted += part.quantity;
          else if (part.decision === "Rejected") rejected += part.quantity;
          else if (part.decision === "Quarantined") quarantine += part.quantity;
          else if (part.decision === "Returned") returned += part.quantity;
        }
      } catch {
        invalid += 1;
      }
      continue;
    }
    if (draft.decision === "Returned") {
      returned += actionableQuantity(line);
      continue;
    }
    try {
      const allocation = buildQuantityDecision(line, draft, t);
      accepted += allocation.acceptedQuantity;
      rejected += allocation.rejectedQuantity;
      quarantine += allocation.quarantineQuantity;
    } catch {
      invalid += 1;
    }
  }

  const qtyParts: string[] = [];
  if (accepted > QTY_EPS) {
    qtyParts.push(t("applySummary.unitAccepted", { value: formatProjectNumber(accepted) }));
  }
  if (quarantine > QTY_EPS) {
    qtyParts.push(t("applySummary.unitQuarantine", { value: formatProjectNumber(quarantine) }));
  }
  if (rejected > QTY_EPS) {
    qtyParts.push(t("applySummary.unitRejected", { value: formatProjectNumber(rejected) }));
  }
  if (returned > QTY_EPS) {
    qtyParts.push(t("applySummary.unitReturned", { value: formatProjectNumber(returned) }));
  }

  const bullets: string[] = [
    t("applySummary.linesWillApply", { count: pending.length }),
  ];
  if (qtyParts.length > 0) {
    bullets.push(t("applySummary.quantityLabel", { parts: qtyParts.join(" · ") }));
  }
  if (invalid > 0) {
    bullets.push(t("applySummary.invalidLines", { count: invalid }));
  }
  bullets.push(t("applySummary.stockMovementNote"));
  if (quarantine > QTY_EPS) {
    bullets.push(t("applySummary.quarantineNote"));
  }
  if (rejected > QTY_EPS || returned > QTY_EPS) {
    bullets.push(t("applySummary.rejectReturnNote"));
  }
  if (accepted > QTY_EPS) {
    bullets.push(t("applySummary.acceptedNote"));
  }
  bullets.push(t("applySummary.datErpNote"));
  bullets.push(t("applySummary.checkResultNote"));

  return { title, bullets };
}

export function QualityInspectionsPage({
  quarantineOnly = false,
}: {
  quarantineOnly?: boolean;
}): ReactElement {
  const { t, moduleReady } = useModuleTranslation("quality");
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<QualityInspectionDetail | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [statusFacet, setStatusFacet] = useState(QUALITY_INSPECTION_STATUS_EXCLUDE_PASSED);
  const pageKey = quarantineOnly ? "quality-quarantine-v2" : "quality-inspections-v2";
  const statusFilters = useMemo(
    () => (quarantineOnly ? [] : buildQualityInspectionStatusFilters(statusFacet)),
    [quarantineOnly, statusFacet],
  );
  const fetchPage = useCallback(
    (request: GridRequest) =>
      qualityApi.inspectionsPaged(
        quarantineOnly
          ? {
              ...request,
              filterLogic: "and",
              filters: [
                ...request.filters,
                { column: "status", operator: "equals", value: "Quarantined" },
              ],
            }
          : {
              ...request,
              filterLogic: "and",
              filters: [...statusFilters, ...request.filters],
            },
      ),
    [quarantineOnly, statusFilters],
  );
  const toggle = useCallback(
    async (id: number) => {
      if (expandedId === id) {
        setExpandedId(null);
        setDetail(null);
        return;
      }
      setLoading(id);
      try {
        setDetail(await qualityApi.inspection(id));
        setExpandedId(id);
      } catch (error) {
        toast.error(message(error, t("list.detailFetchFailed")));
      } finally {
        setLoading(null);
      }
    },
    [expandedId, t],
  );
  const columns = useMemo<GridColumn<QualityInspection>[]>(
    () => {
      void moduleReady;
      return [
      {
        key: "inspectionNo",
        label: t("list.columns.inspectionNo"),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) => (
          <button
            type="button"
            onClick={() => void toggle(r.id)}
            className="inline-flex items-center gap-1.5 font-mono font-semibold text-cyan-600 hover:underline dark:text-cyan-300"
            aria-expanded={expandedId === r.id}
          >
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform ${
                expandedId === r.id ? "rotate-180" : ""
              }`}
            />
            {r.inspectionNo}
          </button>
        ),
      },
      {
        key: "sourceWaybillNo",
        label: t("list.columns.waybillNo"),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) => r.sourceWaybillNo || "—",
      },
      {
        key: "sourceDocumentNo",
        label: t("list.columns.sourceDocument"),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) => (
          <span className="font-mono text-xs">{r.sourceDocumentNo || "—"}</span>
        ),
      },
      {
        key: "sourceDocumentType",
        label: t("list.columns.documentType"),
        sortable: true,
        filterable: true,
        searchable: false,
        render: (r) => {
          const typeKey =
            r.sourceDocumentType === "GR" ? "GoodsReceipt" : r.sourceDocumentType;
          return (
            <div className="flex justify-center">
              <OpsStatusBadge tone={inferDocumentTypeTone(typeKey)}>
                {localizeEnumValue(typeKey)}
              </OpsStatusBadge>
            </div>
          );
        },
      },
      {
        key: "createdByName",
        label: t("list.columns.processedBy"),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) =>
          r.createdByName || t("list.unknownUser", { id: r.createdBy ?? "—" }),
      },
      {
        key: "lineCount",
        label: t("list.columns.lineCount"),
        sortable: true,
        filterable: true,
        searchable: false,
        render: (r) => (
          <span className="font-mono text-xs">
            {r.lineCount} · {formatProjectNumber(r.totalQuantity)}
          </span>
        ),
      },
      {
        key: "status",
        label: t("list.columns.status"),
        sortable: true,
        filterable: true,
        searchable: false,
        render: (r) => (
          <div className="flex justify-center">
            <OpsStatusBadge tone={inferOpsStatusTone(r.status)}>
              {localizeEnumValue(r.status)}
            </OpsStatusBadge>
          </div>
        ),
      },
      {
        key: "createdAtUtc",
        label: t("list.columns.createdAt"),
        sortable: true,
        filterable: true,
        searchable: false,
        render: (r) => formatProjectDateTime(r.createdAtUtc),
      },
      {
        key: "decidedAtUtc",
        label: t("list.columns.decidedAt"),
        sortable: true,
        filterable: true,
        searchable: false,
        render: (r) =>
          r.decidedAtUtc ? formatProjectDateTime(r.decidedAtUtc) : "—",
      },
      {
        key: "actions",
        label: t("list.columns.detail"),
        ...requiredActionColumn,
        render: (r) => (
          <button
            type="button"
            onClick={() => void toggle(r.id)}
            disabled={loading === r.id}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-cyan-500 hover:bg-cyan-500/10"
            aria-label={t("list.openAria")}
            aria-expanded={expandedId === r.id}
          >
            {loading === r.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ChevronDown
                className={`size-4 transition-transform ${expandedId === r.id ? "rotate-180" : ""}`}
              />
            )}
            <span className="text-xs font-semibold">
              {expandedId === r.id ? t("list.hide") : t("list.open")}
            </span>
          </button>
        ),
      },
    ];
    },
    [expandedId, loading, moduleReady, t, toggle],
  );
  const decided = async () => {
    setExpandedId(null);
    setDetail(null);
    await queryClient.invalidateQueries({
      queryKey: ["advanced-grid", pageKey],
    });
  };
  return (
    <AdvancedDataGrid<QualityInspection>
      pageKey={pageKey}
      refreshKey={quarantineOnly ? 0 : statusFacet}
      title={
        quarantineOnly ? t("list.titleQuarantine") : t("list.titleDefault")
      }
      description={
        quarantineOnly
          ? t("list.descriptionQuarantine")
          : t("list.descriptionDefault")
      }
      emptyMessage={
        quarantineOnly ? t("list.emptyQuarantine") : t("list.emptyDefault")
      }
      columns={columns}
      fetchPage={fetchPage}
      toolbarBelowExtra={
        quarantineOnly ? undefined : (
          <QualityInspectionStatusFilter value={statusFacet} onChange={setStatusFacet} />
        )
      }
      expandedRowId={expandedId}
      onRowDoubleClick={(row) => void toggle(row.id)}
      renderExpandedRow={(row) =>
        detail && detail.header.id === row.id ? (
          <InspectionDetailPanel
            detail={detail}
            close={() => {
              setExpandedId(null);
              setDetail(null);
            }}
            decided={() => void decided()}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> {t("list.detailLoading")}
          </div>
        )
      }
    />
  );
}

function InspectionDetailPanel({
  detail,
  close,
  decided,
}: {
  detail: QualityInspectionDetail;
  close: () => void;
  decided: () => void;
}): ReactElement {
  const { t } = useModuleTranslation("quality");
  const navigate = useNavigate();
  const actionable = useMemo(
    () => detail.lines.filter(isActionableLine),
    [detail.lines],
  );
  const passive = useMemo(
    () => detail.lines.filter((line) => !isActionableLine(line)),
    [detail.lines],
  );
  const orderedLines = useMemo(
    () => [...actionable, ...passive],
    [actionable, passive],
  );
  const displayGroups = useMemo(
    () => groupQualityLines(orderedLines),
    [orderedLines],
  );

  const options =
    detail.header.status === "Quarantined"
      ? [
          { value: "Accepted", label: t("decisionOptions.releaseAccept") },
          { value: "Rejected", label: t("decisionOptions.reject") },
          { value: "Returned", label: t("decisionOptions.returnToSupplier") },
        ]
      : [
          { value: "Accepted", label: t("decisionOptions.accept") },
          { value: "Quarantined", label: t("decisionOptions.quarantine") },
          { value: "Rejected", label: t("decisionOptions.reject") },
          { value: "Returned", label: t("decisionOptions.returnToSupplier") },
        ];

  const defaultDecision = "Accepted";
  const quarantineInOptions = options.some((o) => o.value === "Quarantined");
  const allowQuarantineRemainder =
    quarantineInOptions ||
    detail.header.status === "Quarantined" ||
    actionable.some((line) => line.decision === "Quarantined");
  const defaultRemainder = allowQuarantineRemainder
    ? "Quarantined"
    : "Rejected";
  const quarantineDestinations = detail.quarantineDestinations ?? [];
  const defaultAcceptedLocationId = detail.defaultAcceptedDestination?.locationId ?? null;
  const defaultRejectedLocationId = detail.defaultRejectedDestination?.locationId ?? null;
  const configuredDefaultQuarantineLocationId = quarantineDestinations.find((destination) => destination.isDefault)?.locationId
    ?? quarantineDestinations[0]?.locationId
    ?? null;

  const [selected, setSelected] = useState<number[]>(() =>
    actionable.map((line) => line.id),
  );
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>(() =>
    Object.fromEntries(
      actionable.map((line) => [
        line.id,
        emptyDraft(
          defaultDecision,
          actionableQuantity(line),
          defaultRemainder,
          defaultAcceptedLocationId,
        ),
      ]),
    ),
  );
  const [bulkDecision, setBulkDecision] = useState(defaultDecision);
  const [bulkQuantity, setBulkQuantity] = useState("");
  const [bulkRemainderDecision, setBulkRemainderDecision] =
    useState(defaultRemainder);
  const [bulkReasonCode, setBulkReasonCode] = useState("");
  const [bulkReasonNote, setBulkReasonNote] = useState("");
  const [headerNote, setHeaderNote] = useState(detail.note ?? "");
  const [saving, setSaving] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [openLineId, setOpenLineId] = useState<number | null>(null);

  const final =
    ["Passed", "Failed", "Released", "Cancelled"].includes(
      detail.header.status,
    ) && actionable.length === 0;

  const decidedCount = actionable.filter((line) =>
    Boolean(drafts[line.id]?.decision),
  ).length;
  const allSelected =
    actionable.length > 0 && selected.length === actionable.length;
  const someSelected = selected.length > 0 && !allSelected;
  const canApplyDecision = !final && actionable.length > 0 && decidedCount > 0;
  const bulkRemainderOptions = remainderOptionsFor(
    bulkDecision,
    allowQuarantineRemainder,
    t,
  );
  const applySummary = useMemo(
    () => buildApplySummary(actionable, drafts, t),
    [actionable, drafts, t],
  );

  const selectAll = () => setSelected(actionable.map((line) => line.id));
  const clearSelection = () => setSelected([]);

  const patchDraft = (id: number, patch: Partial<LineDraft>) =>
    setDrafts((current) => {
      const line = actionable.find((item) => item.id === id);
      const fallback = emptyDraft(
        defaultDecision,
        line ? actionableQuantity(line) : 0,
        defaultRemainder,
        defaultAcceptedLocationId,
      );
      return {
        ...current,
        [id]: { ...(current[id] ?? fallback), ...patch },
      };
    });

  const applyBulkToSelected = () => {
    if (!bulkDecision) {
      toast.error(t("errors.bulkSelectDecision"));
      return;
    }
    if (selected.length === 0) {
      toast.error(t("errors.bulkSelectAtLeastOneLine"));
      return;
    }
    if (bulkDecision !== "Accepted" && !bulkReasonCode.trim()) {
      toast.error(t("errors.bulkReasonCodeRequired"));
      return;
    }
    const bulkQty = bulkQuantity.trim() ? parseQty(bulkQuantity) : null;
    if (bulkQty != null && (!Number.isFinite(bulkQty) || bulkQty <= 0)) {
      toast.error(t("errors.bulkQuantityInvalid"));
      return;
    }

    const selectedLines = actionable.filter((line) =>
      selected.includes(line.id),
    );
    for (const line of selectedLines) {
      const remaining = actionableQuantity(line);
      if (bulkQty != null && bulkQty - remaining > QTY_EPS) {
        toast.error(
          t("errors.bulkExceedsRemaining", {
            stockCode: line.stockCode,
            remaining: formatProjectNumber(remaining),
          }),
        );
        return;
      }
      if (
        bulkQty != null &&
        remaining - bulkQty > QTY_EPS &&
        bulkDecision !== "Returned"
      ) {
        if (isSerialTracked(line)) {
          toast.error(
            t("errors.bulkSerialCannotSplit", {
              label: line.serialNo || line.stockCode,
            }),
          );
          return;
        }
        if (
          !bulkRemainderDecision ||
          bulkRemainderDecision === bulkDecision
        ) {
          toast.error(t("errors.bulkSelectRemainderDecision"));
          return;
        }
      }
    }

    setDrafts((current) => {
      const next = { ...current };
      for (const line of selectedLines) {
        const remaining = actionableQuantity(line);
        const qty =
          bulkDecision === "Returned"
            ? remaining
            : bulkQty == null
              ? remaining
              : Math.min(bulkQty, remaining);
        next[line.id] = {
          decision: bulkDecision,
          quantity: String(roundQty(qty)),
          remainderDecision:
            bulkRemainderDecision === bulkDecision
              ? defaultRemainder === bulkDecision
                ? "Rejected"
                : defaultRemainder
              : bulkRemainderDecision,
          reasonCode: bulkDecision === "Accepted" ? "" : bulkReasonCode.trim(),
          reasonNote: bulkReasonNote.trim(),
          targetLocationId: defaultTargetForDecision(
            bulkDecision,
            defaultAcceptedLocationId,
            configuredDefaultQuarantineLocationId,
            defaultRejectedLocationId,
          ),
        };
      }
      return next;
    });
    toast.success(
      t("bulkApplySuccess", {
        count: selected.length,
        label: options.find((o) => o.value === bulkDecision)?.label ?? bulkDecision,
      }),
    );
  };

  const save = async (): Promise<boolean> => {
    const pending = actionable
      .map((line) => {
        const draft = drafts[line.id] ?? emptyDraft();
        return { line, draft };
      })
      .filter((row) => row.draft.decision || row.draft.dispositions?.length);

    if (pending.length === 0) {
      toast.error(t("errors.selectAtLeastOneLineDecision"));
      return false;
    }
    if (!detail.allowPartialDecision && pending.length !== actionable.length) {
      toast.error(t("errors.partialDecisionDisabled"));
      return false;
    }
    for (const { line, draft } of pending) {
      if (draft.dispositions?.length) {
        try {
          buildDispositionRequests(
            line,
            draft,
            defaultAcceptedLocationId,
            configuredDefaultQuarantineLocationId,
            defaultRejectedLocationId,
            t,
          );
        } catch (error) {
          toast.error(message(error, t("errors.quantityDistributionInvalid")));
          return false;
        }
        continue;
      }
      const needsReason =
        draft.decision !== "Accepted" ||
        (() => {
          const qty = parseQty(draft.quantity);
          const rem = actionableQuantity(line);
          return (
            Number.isFinite(qty) &&
            rem - qty > QTY_EPS &&
            draft.remainderDecision !== "Accepted"
          );
        })();
      if (needsReason && !draft.reasonCode.trim()) {
        toast.error(t("errors.reasonCodeRequiredAllRows"));
        return false;
      }
    }

    const returnedRows = pending.filter(
      (row) => !row.draft.dispositions?.length && row.draft.decision === "Returned",
    );
    const distributionRows = pending.filter(
      (row) => row.draft.dispositions?.length || row.draft.decision !== "Returned",
    );

    let dispositionRequests: QualityInspectionDispositionRequest[] = [];
    try {
      dispositionRequests = distributionRows.flatMap(({ line, draft }) =>
        buildDispositionRequests(
          line,
          draft,
          defaultAcceptedLocationId,
          configuredDefaultQuarantineLocationId,
          defaultRejectedLocationId,
          t,
        ),
      );
    } catch (error) {
      toast.error(message(error, t("errors.quantityDistributionInvalid")));
      return false;
    }
    for (const { line, draft } of returnedRows) {
      const remaining = actionableQuantity(line);
      const qty = roundQty(parseQty(draft.quantity));
      if (!Number.isFinite(qty) || Math.abs(qty - remaining) > QTY_EPS) {
        toast.error(
          t("errors.returnedQuantityMustEqualRemaining", {
            stockCode: line.stockCode,
            remaining: formatProjectNumber(remaining),
          }),
        );
        return false;
      }
    }

    setSaving(true);
    try {
      let rowVersion = detail.rowVersion;
      const calls: Array<() => ReturnType<typeof qualityApi.decide>> = [];
      let completionMessage = "";

      if (dispositionRequests.length > 0) {
        const notes = distributionRows
          .map(({ draft }) => draft.reasonNote.trim())
          .filter(Boolean);
        const reasonCodes = [
          ...new Set(
            distributionRows
              .map(({ draft }) => draft.reasonCode.trim())
              .filter(Boolean),
          ),
        ];
        const primaryDecision =
          dispositionRequests.find((part) => part.decision === "Accepted")?.decision
          ?? dispositionRequests[0]?.decision
          ?? "Accepted";
        calls.push(async () => {
          return await qualityApi.decide(detail.header.id, {
            idempotencyKey: crypto.randomUUID(),
            decision: primaryDecision,
            note:
              [headerNote.trim(), ...notes].filter(Boolean).join(" · ") ||
              undefined,
            reasonCode: reasonCodes[0] || undefined,
            rowVersion,
            dispositions: dispositionRequests,
            quarantineLocationId: configuredDefaultQuarantineLocationId,
          });
        });
      }

      const returnedGroups = new Map<
        string,
        { reasonCode: string; lineIds: number[]; notes: string[] }
      >();
      for (const { line, draft } of returnedRows) {
        const key = draft.reasonCode.trim();
        const existing = returnedGroups.get(key);
        if (existing) {
          existing.lineIds.push(line.id);
          if (draft.reasonNote.trim()) existing.notes.push(draft.reasonNote.trim());
        } else {
          returnedGroups.set(key, {
            reasonCode: key,
            lineIds: [line.id],
            notes: draft.reasonNote.trim() ? [draft.reasonNote.trim()] : [],
          });
        }
      }
      for (const group of returnedGroups.values()) {
        calls.push(async () => {
          return await qualityApi.decide(detail.header.id, {
            idempotencyKey: crypto.randomUUID(),
            decision: "Returned",
            note:
              [headerNote.trim(), ...group.notes].filter(Boolean).join(" · ") ||
              undefined,
            reasonCode: group.reasonCode || undefined,
            lineIds: group.lineIds,
            rowVersion,
          });
        });
      }

      for (let i = 0; i < calls.length; i += 1) {
        const result = await calls[i]();
        completionMessage = result.message;
        if (i < calls.length - 1) {
          const fresh = await qualityApi.inspection(detail.header.id);
          rowVersion = fresh.rowVersion;
        }
      }
      await notifyGoodsReceiptAfterDecision(
        detail,
        () => navigate("/warehouse/goods-receipts/list"),
        t,
      );
      toast.success(
        completionMessage || t("decisionSaved"),
        { duration: 7000 }
      );
      decided();
      return true;
    } catch (error) {
      toast.error(message(error, t("errors.decisionSaveFailed")));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const docTypeKey =
    detail.header.sourceDocumentType === "GR"
      ? "GoodsReceipt"
      : detail.header.sourceDocumentType;

  return (
    <div className="wms-ops-quality-detail space-y-3 rounded-2xl bg-[var(--wms-app-panel)] p-3.5">
      <div className="wms-ops-quality-detail__head">
        <div className="wms-ops-quality-detail__identity min-w-0">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[var(--wms-brand-primary)]">
            {t("detail.eyebrow")}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight font-mono">
              {detail.header.sourceWaybillNo?.trim() || "—"}
            </h3>
            <OpsStatusBadge
              tone={inferOpsStatusTone(detail.header.status)}
              className="wms-ops-quality-detail__badge"
            >
              {localizeEnumValue(detail.header.status)}
            </OpsStatusBadge>
            <OpsStatusBadge
              tone={inferDocumentTypeTone(docTypeKey)}
              className="wms-ops-quality-detail__badge"
            >
              {localizeEnumValue(docTypeKey)}
            </OpsStatusBadge>
          </div>
          {(detail.header.warehouseCode != null || detail.header.warehouseName) ? (
            <p className="text-xs text-slate-500">
              {detail.header.warehouseCode} {detail.header.warehouseName}
            </p>
          ) : null}
        </div>

        <div className="wms-ops-quality-detail__meta">
          <MetaChip
            label={t("detail.meta.processedBy")}
            value={
              detail.header.createdByName ||
              t("list.unknownUser", { id: detail.header.createdBy ?? "—" })
            }
          />
          <MetaChip
            label={t("detail.meta.createdAt")}
            value={formatProjectDateTime(detail.header.createdAtUtc)}
          />
          <MetaChip
            label={t("detail.meta.queuedAt")}
            value={formatProjectDateTime(
              detail.header.queuedAtUtc ?? detail.header.createdAtUtc,
            )}
          />
          <MetaChip
            label={t("detail.meta.decidedAt")}
            value={
              detail.header.decidedAtUtc
                ? formatProjectDateTime(detail.header.decidedAtUtc)
                : "—"
            }
          />
          <MetaChip
            label={t("detail.meta.total")}
            value={formatProjectNumber(detail.header.totalQuantity)}
            mono
            accent
          />
        </div>

        <button
          type="button"
          onClick={close}
          className="wms-ops-quality-detail__close shrink-0 rounded-lg border border-[var(--wms-app-border)] px-2.5 py-1 text-[0.65rem] font-semibold"
        >
          {t("detail.close")}
        </button>
      </div>

      {detail.requireManagerApprovalForRelease &&
        detail.header.status === "Quarantined" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600">
            {t("detail.managerApprovalNotice")}
          </div>
        )}

      {!final && actionable.length > 0 && (
        <section className="wms-ops-quality-bulk">
          <div className="wms-ops-quality-bulk__top">
            <p className="wms-ops-quality-bulk__title">{t("detail.bulk.title")}</p>
            <span className="wms-ops-quality-bulk__count">
              {t("detail.bulk.countLabel", {
                selected: selected.length,
                total: actionable.length,
                decided: decidedCount,
              })}
            </span>
            <div className="wms-ops-quality-bulk__selects">
              <OpsActionButton
                type="button"
                variant="secondary"
                onClick={selectAll}
                className="wms-ops-quality-decide-btn wms-ops-quality-bulk__btn"
              >
                {t("detail.bulk.selectAll")}
              </OpsActionButton>
              <OpsActionButton
                type="button"
                variant="secondary"
                onClick={clearSelection}
                disabled={selected.length === 0}
                className="wms-ops-quality-decide-btn wms-ops-quality-bulk__btn"
              >
                {t("detail.bulk.clearSelection")}
              </OpsActionButton>
            </div>
          </div>
          <div className="wms-ops-quality-bulk__fields">
            <label className="wms-ops-quality-bulk__field">
              <span>{t("detail.bulk.decisionLabel")}</span>
              <AppDropdown
                value={bulkDecision || null}
                onValueChange={(value) => {
                  setBulkDecision(value);
                  if (value === bulkRemainderDecision) {
                    const next = remainderOptionsFor(
                      value,
                      allowQuarantineRemainder,
                      t,
                    )[0]?.value;
                    if (next) setBulkRemainderDecision(next);
                  }
                }}
                options={options}
                placeholder={t("detail.bulk.decisionPlaceholder")}
                className="wms-ops-quality-field wms-ops-quality-bulk__control"
                portalContainer={null}
              />
            </label>
            <label className="wms-ops-quality-bulk__field">
              <span>{t("detail.bulk.quantityLabel")}</span>
              <AppInput
                value={bulkQuantity}
                onChange={(e) => setBulkQuantity(e.target.value)}
                placeholder={t("detail.bulk.quantityPlaceholder")}
                inputMode="decimal"
                className="wms-ops-quality-field wms-ops-quality-bulk__control"
              />
            </label>
            <label className="wms-ops-quality-bulk__field">
              <span>{t("detail.bulk.remainderLabel")}</span>
              <AppDropdown
                value={bulkRemainderDecision || null}
                onValueChange={setBulkRemainderDecision}
                options={bulkRemainderOptions}
                placeholder={t("detail.bulk.remainderPlaceholder")}
                disabled={
                  bulkDecision === "Returned" || !bulkQuantity.trim()
                }
                className="wms-ops-quality-field wms-ops-quality-bulk__control"
                portalContainer={null}
              />
            </label>
            <label className="wms-ops-quality-bulk__field">
              <span>{t("detail.bulk.reasonCodeLabel")}</span>
              <AppInput
                value={bulkReasonCode}
                onChange={(e) => setBulkReasonCode(e.target.value)}
                placeholder={t("detail.bulk.reasonCodePlaceholder")}
                className="wms-ops-quality-field wms-ops-quality-bulk__control"
              />
            </label>
            <label className="wms-ops-quality-bulk__field">
              <span>{t("detail.bulk.reasonLabel")}</span>
              <AppInput
                value={bulkReasonNote}
                onChange={(e) => setBulkReasonNote(e.target.value)}
                placeholder={t("detail.bulk.reasonPlaceholder")}
                className="wms-ops-quality-field wms-ops-quality-bulk__control"
              />
            </label>
            <OpsActionButton
              type="button"
              variant="secondary"
              onClick={applyBulkToSelected}
              className="wms-ops-quality-decide-btn wms-ops-quality-bulk__apply"
            >
              {t("detail.bulk.applyButton")}
            </OpsActionButton>
          </div>
        </section>
      )}

      <div className="wms-ops-quality-lines overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[color-mix(in_oklab,var(--wms-brand-primary)_8%,transparent)] text-left">
              <th className="wms-ops-quality-lines__cell w-12 p-2.5">
                {!final && actionable.length > 0 ? (
                  <OpsSkinCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={(next) =>
                      next ? selectAll() : clearSelection()
                    }
                    aria-label={t("detail.table.selectAllAria")}
                  />
                ) : null}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.stock")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.lotSerial")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.expiry")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.quantityRemaining")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.sample")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.status")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.decision")}
              </th>
              <th className="wms-ops-quality-lines__cell w-28 p-2.5 text-center text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayGroups.map((group) => {
              const line = group.primary;
              const groupIds = group.lines.map((item) => item.id);
              const active = isActionableLine(line);
              const draft = drafts[line.id];
              const groupSelected =
                active && groupIds.every((id) => selected.includes(id));
              const groupSome =
                active &&
                !groupSelected &&
                groupIds.some((id) => selected.includes(id));
              const totalQty = sumLineQuantity(group.lines);
              const remainingQty = sumActionableQuantity(group.lines);
              const sampleQty = sumSampleQuantity(group.lines);
              const expiryDates = [
                ...new Set(
                  group.lines
                    .map((item) => item.expiryDate?.trim())
                    .filter(Boolean),
                ),
              ] as string[];

              return (
                <tr
                  key={group.key}
                  className={cn(
                    active
                      ? "bg-[color-mix(in_oklab,var(--wms-brand-primary)_6%,transparent)]"
                      : "opacity-60",
                  )}
                >
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle">
                    {active ? (
                      <OpsSkinCheckbox
                        checked={groupSelected}
                        indeterminate={groupSome}
                        onCheckedChange={(next) => {
                          setSelected((current) => {
                            if (next) {
                              return [...new Set([...current, ...groupIds])];
                            }
                            return current.filter((id) => !groupIds.includes(id));
                          });
                        }}
                        aria-label={t("detail.table.selectRowAria", {
                          stockCode: line.stockCode,
                        })}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle">
                    <strong className="block text-[0.8125rem] leading-tight">
                      {line.stockCode}
                    </strong>
                    <span className="block truncate text-xs text-slate-500">
                      {line.stockName}
                    </span>
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle font-mono text-xs">
                    <LotSerialHoverCell lines={group.lines} />
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle">
                    {expiryDates.length === 1
                      ? formatProjectDate(expiryDates[0]!)
                      : expiryDates.length > 1
                        ? t("detail.table.multipleExpiry", {
                            count: expiryDates.length,
                          })
                        : "—"}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle text-right font-mono">
                    <span className="block">
                      {formatProjectNumber(totalQty)}
                    </span>
                    {active ? (
                      <span className="block text-[0.65rem] text-slate-500">
                        {t("detail.table.remainingPrefix", {
                          value: formatProjectNumber(remainingQty),
                        })}
                      </span>
                    ) : null}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle text-right font-mono">
                    {formatProjectNumber(sampleQty)}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle">
                    {active ? (
                      <OpsStatusBadge tone="pending">{t("detail.table.subjectToControl")}</OpsStatusBadge>
                    ) : (
                      <OpsStatusBadge tone="neutral">
                        {t("detail.table.notSubjectToControl")}
                      </OpsStatusBadge>
                    )}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle">
                    {active ? (
                      draft?.decision || draft?.dispositions?.length ? (
                        <div className="space-y-1">
                          <OpsStatusBadge
                            tone={inferOpsStatusTone(draft.dispositions?.[0]?.decision ?? draft.decision)}
                          >
                            {localizeEnumValue(draft.dispositions?.[0]?.decision ?? draft.decision)}
                            {(draft.dispositions?.[0]?.quantity ?? draft.quantity)
                              ? ` · ${formatProjectNumber(
                                  group.lines.length > 1
                                    ? remainingQty
                                    : parseQty(draft.dispositions?.[0]?.quantity ?? draft.quantity) || 0,
                                )}`
                              : ""}
                          </OpsStatusBadge>
                          {(() => {
                            if (draft.dispositions?.length) {
                              return draft.dispositions.slice(1).map((part) => (
                                <OpsStatusBadge
                                  key={part.key}
                                  tone={inferOpsStatusTone(part.decision)}
                                >
                                  {localizeEnumValue(part.decision)} · {formatProjectNumber(parseQty(part.quantity) || 0)}
                                  {part.targetLocationId ? ` · #${part.targetLocationId}` : ""}
                                </OpsStatusBadge>
                              ));
                            }
                            if (group.lines.length > 1) return null;
                            const remaining = actionableQuantity(line);
                            const qty = parseQty(draft.quantity);
                            const rest =
                              Number.isFinite(qty) && remaining - qty > QTY_EPS
                                ? roundQty(remaining - qty)
                                : 0;
                            if (rest <= QTY_EPS || !draft.remainderDecision) {
                              return null;
                            }
                            return (
                              <OpsStatusBadge
                                tone={inferOpsStatusTone(
                                  draft.remainderDecision,
                                )}
                              >
                                {localizeEnumValue(draft.remainderDecision)} ·{" "}
                                {formatProjectNumber(rest)}
                              </OpsStatusBadge>
                            );
                          })()}
                          {draft.reasonCode ? (
                            <div className="font-mono text-[0.65rem] text-slate-500">
                              {draft.reasonCode}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">{t("detail.table.waitingBadge")}</span>
                      )
                    ) : (
                      <OpsStatusBadge tone={inferOpsStatusTone(line.decision)}>
                        {localizeEnumValue(line.decision)}
                      </OpsStatusBadge>
                    )}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle text-center">
                    {active && !final ? (
                      <LineDecisionPopover
                        open={openLineId === line.id}
                        onOpenChange={(open) =>
                          setOpenLineId(open ? line.id : null)
                        }
                        options={options}
                        branchCode={detail.header.branchCode}
                        quarantineDestinations={quarantineDestinations}
                        defaultAcceptedDestination={detail.defaultAcceptedDestination ?? null}
                        defaultRejectedDestination={detail.defaultRejectedDestination ?? null}
                        defaultAcceptedLocationId={defaultAcceptedLocationId}
                        defaultRejectedLocationId={defaultRejectedLocationId}
                        fallbackQuarantineLocationId={configuredDefaultQuarantineLocationId}
                        line={
                          group.lines.length > 1
                            ? {
                                ...line,
                                quantity: remainingQty,
                                sampleQuantity: sampleQty,
                                acceptedQuantity: 0,
                                rejectedQuantity: 0,
                                quarantineQuantity:
                                  line.decision === "Quarantined"
                                    ? remainingQty
                                    : 0,
                              }
                            : line
                        }
                        draft={
                          group.lines.length > 1
                            ? {
                                ...(draft ??
                                  emptyDraft(
                                    defaultDecision,
                                    remainingQty,
                                    defaultRemainder,
                                    defaultAcceptedLocationId,
                                  )),
                                quantity: String(remainingQty),
                              }
                            : draft ??
                              emptyDraft(
                                defaultDecision,
                                remainingQty,
                                defaultRemainder,
                                defaultAcceptedLocationId,
                              )
                        }
                        onChange={(patch) => {
                          for (const member of group.lines) {
                            const memberPatch = { ...patch };
                            if (
                              group.lines.length > 1 &&
                              patch.quantity != null &&
                              isSerialTracked(member)
                            ) {
                              memberPatch.quantity = String(
                                actionableQuantity(member) || 1,
                              );
                            }
                            patchDraft(member.id, memberPatch);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(detail.dispositions ?? []).length > 0 ? (
        <section className="space-y-2 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-3">
          <div>
            <p className="text-sm font-bold">{t("detail.history.title")}</p>
            <p className="text-xs text-slate-500">{t("detail.history.description")}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {detail.dispositions.map((part) => {
              const sourceLine = detail.lines.find((line) => line.id === part.lineId);
              return (
                <article key={part.id} className="rounded-xl border border-[var(--wms-app-border)] p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold">{sourceLine?.stockCode ?? `#${part.lineId}`}</span>
                    <OpsStatusBadge tone={inferOpsStatusTone(part.decision)}>
                      {localizeEnumValue(part.decision)} · {formatProjectNumber(part.quantity)}
                    </OpsStatusBadge>
                  </div>
                  <div className="mt-2 font-mono text-[0.68rem] text-slate-500">
                    {part.sourceWarehouseCode}/{part.sourceLocationCode} → {part.targetWarehouseCode}/{part.targetLocationCode}
                  </div>
                  {part.warehouseTransferId ? (
                    <div className="mt-1 text-[0.65rem] font-semibold text-cyan-600">
                      {t("detail.history.datReference", { id: part.warehouseTransferId })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {final ? (
        <section className="rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-brand-primary)_5%,transparent)] px-4 py-3 text-sm">
          <p className="font-semibold">{t("detail.completed.title")}</p>
          <p className="mt-1 text-xs text-slate-500">
            {detail.header.sourceDocumentNo
              ? t("detail.completed.descriptionWithDoc", {
                  docNo: detail.header.sourceDocumentNo,
                })
              : t("detail.completed.descriptionWithoutDoc")}
          </p>
          <OpsActionButton
            type="button"
            variant="secondary"
            className="mt-3 !min-h-8 !px-3 !text-[0.65rem]"
            onClick={() => navigate("/warehouse/goods-receipts/list")}
          >
            {t("detail.completed.goodsReceiptListButton")}
          </OpsActionButton>
        </section>
      ) : null}

      {!final && actionable.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_oklab,var(--wms-brand-primary)_22%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-brand-primary)_5%,transparent)] p-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="min-w-0 flex-1 space-y-1.5 text-sm">
            <span className="text-xs font-semibold text-slate-500">
              {t("detail.footer.generalNoteLabel")}
            </span>
            <AppInput
              value={headerNote}
              onChange={(e) => setHeaderNote(e.target.value)}
              placeholder={t("detail.footer.generalNotePlaceholder")}
              className="wms-ops-quality-field h-8 text-xs"
            />
            <span className="block text-xs text-slate-500">
              {t("detail.footer.readyCount", {
                decided: decidedCount,
                total: actionable.length,
              })}
              {detail.allowPartialDecision
                ? t("detail.footer.partialAllowed")
                : t("detail.footer.allRequired")}
            </span>
            <span className="block text-xs text-slate-500">
              {detail.header.sourceDocumentNo
                ? t("detail.footer.helperNoteWithDoc", {
                    docNo: detail.header.sourceDocumentNo,
                  })
                : t("detail.footer.helperNoteWithoutDoc")}
            </span>
          </label>
          <OpsActionButton
            type="button"
            disabled={saving || !canApplyDecision}
            onClick={() => setApplyConfirmOpen(true)}
            className="wms-ops-quality-decide-btn !min-h-8 !px-4 !text-[0.65rem]"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {t("detail.footer.applyButton")}
          </OpsActionButton>
        </section>
      )}

      <Dialog
        open={applyConfirmOpen}
        onOpenChange={(open) => {
          if (saving) return;
          setApplyConfirmOpen(open);
        }}
      >
        <DialogContent
          showCloseButton
          portalRoot="body"
          tone="ops"
          className="wms-ops-form wms-ops-detail-dialog wms-ops-quality-apply-confirm max-w-md gap-0 overflow-hidden border-0 p-0 shadow-none"
        >
          <DialogHeader className="wms-ops-detail-dialog__header relative border-b px-6 py-4 pr-14 text-left">
            <DialogTitle className="wms-ops-detail-dialog__title min-w-0 pr-2">
              {t("applyConfirm.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="wms-ops-dialog__body px-6 py-5">
            <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--wms-brand-primary)]">
              {t("applyConfirm.infoLabel")}
            </p>
            <ul className="space-y-2 text-sm leading-5 text-[color-mix(in_oklab,var(--wms-app-text)_88%,transparent)]">
              {applySummary.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--wms-brand-primary)]"
                    aria-hidden
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="wms-ops-detail-dialog__footer gap-2 border-t px-6 py-4 sm:justify-end sm:gap-2">
            <OpsActionButton
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setApplyConfirmOpen(false)}
            >
              {t("applyConfirm.cancel")}
            </OpsActionButton>
            <OpsActionButton
              type="button"
              disabled={saving || !canApplyDecision}
              className="wms-ops-quality-decide-btn"
              onClick={() => {
                void (async () => {
                  if (await save()) setApplyConfirmOpen(false);
                })();
              }}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {t("applyConfirm.confirm")}
            </OpsActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LotSerialHoverCell({
  lines,
}: {
  lines: QualityInspectionLine[];
}): ReactElement {
  const { t } = useModuleTranslation("quality");
  const serials = [
    ...new Set(
      lines
        .map((line) => line.serialNo?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const lots = [
    ...new Set(
      lines
        .map((line) => line.lotNo?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const lotLabel = lots.length === 1 ? lots[0]! : lots.length > 1 ? t("detail.table.multipleLots", { count: lots.length }) : "—";
  const summary =
    serials.length > 1
      ? `${lotLabel} · ${t("detail.table.serialCount", { count: serials.length })}`
      : `${lotLabel} / ${serials[0] || "—"}`;

  if (serials.length <= 1 && lots.length <= 1) {
    return <span>{summary}</span>;
  }

  return (
    <TooltipProvider delayDuration={160}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="wms-ops-quality-lot-serial-trigger"
            title={t("detail.table.lotSerialHoverHint")}
          >
            <span>{summary}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          sideOffset={8}
          className="wms-ops-quality-lot-serial-tooltip"
        >
          <div className="wms-ops-quality-lot-serial-tooltip__head">
            {t("detail.table.serialListLabel")}
          </div>
          <ul className="wms-ops-quality-lot-serial-tooltip__list">
            {lines.map((line) => {
              const serial = line.serialNo?.trim();
              const lot = line.lotNo?.trim();
              if (!serial && !lot) return null;
              return (
                <li key={line.id} className="wms-ops-quality-lot-serial-tooltip__item">
                  <span className="wms-ops-quality-lot-serial-tooltip__lot">
                    {lot || "—"}
                  </span>
                  <span className="wms-ops-quality-lot-serial-tooltip__sep" aria-hidden>
                    /
                  </span>
                  <span className="wms-ops-quality-lot-serial-tooltip__serial">
                    {serial || "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LineDecisionPopover({
  open,
  onOpenChange,
  options,
  branchCode,
  quarantineDestinations,
  defaultAcceptedDestination,
  defaultRejectedDestination,
  defaultAcceptedLocationId,
  defaultRejectedLocationId,
  fallbackQuarantineLocationId,
  line,
  draft,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: Array<{ value: string; label: string }>;
  branchCode: string;
  quarantineDestinations: QualityInspectionDetail["quarantineDestinations"];
  defaultAcceptedDestination: QualityInspectionDetail["defaultAcceptedDestination"];
  defaultRejectedDestination: QualityInspectionDetail["defaultRejectedDestination"];
  defaultAcceptedLocationId: number | null;
  defaultRejectedLocationId: number | null;
  fallbackQuarantineLocationId: number | null;
  line: QualityInspectionLine;
  draft: LineDraft;
  onChange: (patch: Partial<LineDraft>) => void;
}): ReactElement {
  const { t } = useModuleTranslation("quality");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const remaining = actionableQuantity(line);
  const serial = isSerialTracked(line);
  const qty = parseQty(draft.quantity);
  const hasRemainder =
    draft.decision !== "Returned" &&
    !serial &&
    Number.isFinite(qty) &&
    remaining - qty > QTY_EPS;
  const remainderChoices = remainderOptionsFor(
    draft.decision,
    options.some((o) => o.value === "Quarantined") ||
      line.decision === "Quarantined",
    t,
  );
  const advancedDispositions = draft.dispositions ?? [];
  const allocatedQuantity = roundQty(
    advancedDispositions.reduce((sum, part) => {
      const quantity = parseQty(part.quantity);
      return sum + (Number.isFinite(quantity) ? quantity : 0);
    }, 0),
  );
  const unallocatedQuantity = roundQty(Math.max(0, remaining - allocatedQuantity));
  const enableDistributionPlan = () => {
    try {
      onChange({
        dispositions: draftDispositions(
          line,
          draft,
          defaultAcceptedLocationId,
          fallbackQuarantineLocationId,
          defaultRejectedLocationId,
          t,
        ),
      });
    } catch (error) {
      toast.error(message(error, t("errors.quantityDistributionInvalid")));
    }
  };
  const patchDisposition = (key: string, patch: Partial<DispositionDraft>) =>
    onChange({
      dispositions: advancedDispositions.map((part) =>
        part.key === key ? { ...part, ...patch } : part,
      ),
    });
  const addDisposition = () =>
    onChange({
      dispositions: [
        ...advancedDispositions,
        dispositionDraft("Accepted", unallocatedQuantity, defaultAcceptedLocationId),
      ],
    });
  const removeDisposition = (key: string) =>
    onChange({
      dispositions: advancedDispositions.filter((part) => part.key !== key),
    });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(520, window.innerWidth - 16);
    const estimatedHeight = panelRef.current?.offsetHeight || 520;
    const gap = 6;
    const left = Math.min(
      Math.max(8, rect.right - panelWidth),
      window.innerWidth - panelWidth - 8,
    );
    // Always open above the trigger so it stays over the table, not outside below.
    const top = Math.max(8, rect.top - estimatedHeight - gap);
    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    // Remeasure after paint (real panel height).
    const frame = window.requestAnimationFrame(() => updatePosition());
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition, hasRemainder]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        target.closest(
          '.wms-ops-list-select-content, .wms-floating-surface, [data-radix-popper-content-wrapper], [role="listbox"]',
        )
      ) {
        return;
      }
      onOpenChange(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <OpsActionButton
        ref={triggerRef}
        type="button"
        variant="secondary"
        title={t("linePopover.triggerTitle")}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
        className={cn(
          "wms-ops-quality-decide-btn inline-flex !min-h-9 !flex-row !items-center !justify-center !gap-1.5 !whitespace-nowrap !px-2.5 !text-xs",
          (draft.decision || draft.dispositions?.length) && "wms-ops-list-toolbar-btn--active",
        )}
      >
        <ClipboardPen className="size-3.5 shrink-0" aria-hidden />
        <span>{draft.decision || draft.dispositions?.length ? t("linePopover.editLabel") : t("linePopover.decideLabel")}</span>
      </OpsActionButton>

      {open && coords
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={t("linePopover.ariaLabel")}
              style={{ top: coords.top, left: coords.left }}
              className="wms-ops-quality-decision-popover wms-ops-list-popover fixed z-[5000] max-h-[calc(100vh-1rem)] w-[min(32rem,calc(100vw-1rem))] space-y-2.5 overflow-y-auto border-0 p-3 shadow-none outline-none"
            >
              <div className="wms-ops-list-popover__section-title">
                {t("linePopover.sectionTitle")}
              </div>
              <p className="text-[0.65rem] text-slate-500">
                {t("linePopover.remainingPrefix")}{" "}
                <span className="font-mono font-semibold text-foreground">
                  {formatProjectNumber(remaining)}
                </span>
                {serial ? t("linePopover.serialNoSplit") : null}
              </p>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-2">
                <div>
                  <div className="text-xs font-bold">{t("linePopover.distributionTitle")}</div>
                  <div className="text-[0.65rem] text-slate-500">{t("linePopover.distributionDescription")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => advancedDispositions.length > 0
                    ? onChange({ dispositions: undefined })
                    : enableDistributionPlan()}
                  className="shrink-0 rounded-lg border border-cyan-500/30 px-2.5 py-1.5 text-[0.65rem] font-bold text-cyan-600"
                >
                  {advancedDispositions.length > 0
                    ? t("linePopover.useQuickDecision")
                    : t("linePopover.openDistribution")}
                </button>
              </div>
              {advancedDispositions.length === 0 ? (
                <>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-slate-500">
                  {t("linePopover.decisionLabel")}
                </span>
                <AppDropdown
                  value={draft.decision || null}
                  onValueChange={(value) => {
                    const nextRemainder = remainderOptionsFor(
                      value,
                      options.some((o) => o.value === "Quarantined") ||
                        line.decision === "Quarantined",
                      t,
                    )[0]?.value;
                    onChange({
                      decision: value,
                      targetLocationId: defaultTargetForDecision(
                        value,
                        defaultAcceptedLocationId,
                        fallbackQuarantineLocationId,
                        defaultRejectedLocationId,
                      ),
                      quantity:
                        value === "Returned" || serial
                          ? String(remaining)
                          : draft.quantity || String(remaining),
                      ...(nextRemainder &&
                      nextRemainder !== draft.remainderDecision
                        ? { remainderDecision: nextRemainder }
                        : {}),
                    });
                  }}
                  options={options}
                  placeholder={t("linePopover.decisionPlaceholder")}
                  className="wms-ops-quality-field !h-10 !min-h-10 !text-sm"
                  portalContainer={null}
                  contentClassName="!z-[5100]"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-slate-500">
                  {t("linePopover.thisDecisionQuantityLabel")}
                </span>
                <AppInput
                  value={draft.quantity}
                  onChange={(e) => onChange({ quantity: e.target.value })}
                  placeholder={formatProjectNumber(remaining)}
                  inputMode="decimal"
                  disabled={serial || draft.decision === "Returned"}
                  className="wms-ops-quality-field h-10 text-sm"
                />
              </label>
              {draft.decision && draft.decision !== "Returned" ? (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500">
                    {t("linePopover.targetLocationLabel")}
                  </span>
                  <QualityDecisionTargetPicker
                    decision={draft.decision}
                    targetLocationId={draft.targetLocationId ?? defaultTargetForDecision(
                      draft.decision,
                      defaultAcceptedLocationId,
                      fallbackQuarantineLocationId,
                      defaultRejectedLocationId,
                    )}
                    onChange={(targetLocationId) => onChange({ targetLocationId })}
                    branchCode={branchCode}
                    queryScope={`quick-${line.id}`}
                    quarantineDestinations={quarantineDestinations}
                    defaultAcceptedDestination={defaultAcceptedDestination}
                    defaultRejectedDestination={defaultRejectedDestination}
                  />
                </div>
              ) : null}
              {hasRemainder ? (
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    {t("linePopover.remainderLabel", {
                      value: formatProjectNumber(roundQty(remaining - qty)),
                    })}
                  </span>
                  <AppDropdown
                    value={draft.remainderDecision || null}
                    onValueChange={(value) =>
                      onChange({ remainderDecision: value })
                    }
                    options={remainderChoices}
                    placeholder={t("linePopover.remainderPlaceholder")}
                    className="wms-ops-quality-field !h-10 !min-h-10 !text-sm"
                    portalContainer={null}
                    contentClassName="!z-[5100]"
                  />
                </label>
              ) : null}
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[0.65rem]">
                    <span className="font-semibold">
                      {t("linePopover.allocated", { value: formatProjectNumber(allocatedQuantity) })}
                    </span>
                    <span className={unallocatedQuantity > QTY_EPS ? "font-bold text-rose-500" : "font-bold text-emerald-600"}>
                      {t("linePopover.unallocated", { value: formatProjectNumber(unallocatedQuantity) })}
                    </span>
                  </div>
                  {advancedDispositions.map((part, index) => (
                    <div key={part.key} className="space-y-2 rounded-xl border border-[var(--wms-app-border)] p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                          {t("linePopover.routeNo", { no: index + 1 })}
                        </span>
                        <button
                          type="button"
                          disabled={advancedDispositions.length === 1}
                          onClick={() => removeDisposition(part.key)}
                          aria-label={t("linePopover.removeRoute")}
                          className="inline-flex size-7 items-center justify-center rounded-lg text-rose-500 disabled:opacity-30"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                        <AppDropdown
                          value={part.decision || null}
                          onValueChange={(value) => patchDisposition(part.key, {
                            decision: value,
                            targetLocationId: value === "Accepted"
                              ? defaultAcceptedLocationId
                              : value === "Rejected"
                                ? defaultRejectedLocationId
                                : value === "Quarantined"
                                  ? fallbackQuarantineLocationId
                                  : null,
                          })}
                          options={options}
                          placeholder={t("linePopover.decisionPlaceholder")}
                          className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
                          portalContainer={null}
                          contentClassName="!z-[5100]"
                        />
                        <AppInput
                          value={part.quantity}
                          onChange={(event) => patchDisposition(part.key, { quantity: event.target.value })}
                          inputMode="decimal"
                          disabled={part.decision === "Returned"}
                          className="wms-ops-quality-field h-10 text-xs"
                        />
                      </div>
                      {part.decision === "Accepted" ? (
                        <PagedAppDropdown
                          queryKey={["quality-approved-target", branchCode, line.id, part.key]}
                          fetchPage={(request) => qualityApi.locations(request, branchCode)}
                          toOption={(location) => ({
                            value: String(location.id),
                            label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
                            description: location.warehouseName,
                            disabled: !location.isPutaway || location.isQuarantine,
                          })}
                          value={part.targetLocationId ? String(part.targetLocationId) : null}
                          selectedOption={part.targetLocationId === defaultAcceptedDestination?.locationId ? {
                            value: String(defaultAcceptedDestination.locationId),
                            label: `${defaultAcceptedDestination.warehouseCode} / ${defaultAcceptedDestination.locationCode} · ${defaultAcceptedDestination.locationName}`,
                            description: `${defaultAcceptedDestination.warehouseName} · ${t("linePopover.defaultTargetSuffix")}`,
                          } : undefined}
                          onValueChange={(value) => patchDisposition(part.key, {
                            targetLocationId: value ? Number(value) : null,
                          })}
                          staticOptions={[{
                            value: "",
                            label: t("linePopover.automaticAcceptedTarget"),
                            description: t("linePopover.automaticAcceptedTargetDescription"),
                          }]}
                          placeholder={t("linePopover.acceptedTargetPlaceholder")}
                          searchable
                          className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
                          contentClassName="!z-[5100]"
                        />
                      ) : part.decision === "Quarantined" ? (
                        <AppDropdown
                          value={part.targetLocationId ? String(part.targetLocationId) : null}
                          onValueChange={(value) => patchDisposition(part.key, { targetLocationId: value ? Number(value) : null })}
                          options={[
                            ...quarantineDestinations.map((destination) => ({
                              value: String(destination.locationId),
                              label: `${destination.warehouseCode} / ${destination.locationCode} · ${destination.locationName}`,
                              description: destination.isDefault
                                ? `${destination.warehouseName} · ${t("linePopover.defaultTargetSuffix")}`
                                : destination.warehouseName,
                            })),
                          ]}
                          placeholder={t("linePopover.quarantineTargetPlaceholder")}
                          searchable
                          className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
                          portalContainer={null}
                          contentClassName="!z-[5100]"
                        />
                      ) : part.decision === "Rejected" ? (
                        <PagedAppDropdown
                          queryKey={["quality-rejected-target", branchCode, line.id, part.key]}
                          fetchPage={(request) => qualityApi.locations(request, branchCode)}
                          toOption={(location) => ({
                            value: String(location.id),
                            label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
                            description: location.warehouseName,
                            disabled: !location.isQuarantine,
                          })}
                          value={part.targetLocationId ? String(part.targetLocationId) : null}
                          selectedOption={part.targetLocationId === defaultRejectedDestination?.locationId ? {
                            value: String(defaultRejectedDestination.locationId),
                            label: `${defaultRejectedDestination.warehouseCode} / ${defaultRejectedDestination.locationCode} · ${defaultRejectedDestination.locationName}`,
                            description: `${defaultRejectedDestination.warehouseName} · ${t("linePopover.defaultTargetSuffix")}`,
                          } : undefined}
                          onValueChange={(value) => patchDisposition(part.key, {
                            targetLocationId: value ? Number(value) : null,
                          })}
                          placeholder={t("linePopover.rejectedTargetPlaceholder")}
                          searchable
                          className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
                          contentClassName="!z-[5100]"
                        />
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addDisposition}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-500/35 px-3 py-2 text-xs font-bold text-cyan-600"
                  >
                    <Plus className="size-3.5" /> {t("linePopover.addRoute")}
                  </button>
                </div>
              )}
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-slate-500">
                  {t("linePopover.reasonCodeLabel")}
                </span>
                <AppInput
                  value={draft.reasonCode}
                  onChange={(e) => onChange({ reasonCode: e.target.value })}
                  placeholder={t("linePopover.reasonCodePlaceholder")}
                  className="wms-ops-quality-field h-10 text-sm"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-slate-500">
                  {t("linePopover.reasonLabel")}
                </span>
                <OpsFieldShell className="wms-ops-quality-field-shell">
                  <textarea
                    className={cn(
                      OPS_FIELD_CLASS,
                      "wms-ops-quality-field min-h-16 w-full resize-y border px-3 py-2 text-sm outline-none",
                    )}
                    value={draft.reasonNote}
                    onChange={(e) => onChange({ reasonNote: e.target.value })}
                    placeholder={t("linePopover.reasonPlaceholder")}
                    maxLength={500}
                  />
                </OpsFieldShell>
              </label>
              <OpsActionButton
                type="button"
                onClick={() => onOpenChange(false)}
                className="wms-ops-quality-decide-btn w-full !min-h-9 !text-xs"
              >
                {t("linePopover.confirmButton")}
              </OpsActionButton>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function QualityDecisionTargetPicker({
  decision,
  targetLocationId,
  onChange,
  branchCode,
  queryScope,
  quarantineDestinations,
  defaultAcceptedDestination,
  defaultRejectedDestination,
}: {
  decision: string;
  targetLocationId: number | null;
  onChange: (value: number | null) => void;
  branchCode: string;
  queryScope: string;
  quarantineDestinations: QualityInspectionDetail["quarantineDestinations"];
  defaultAcceptedDestination: QualityInspectionDetail["defaultAcceptedDestination"];
  defaultRejectedDestination: QualityInspectionDetail["defaultRejectedDestination"];
}): ReactElement | null {
  const { t } = useModuleTranslation("quality");
  if (decision === "Accepted") {
    return (
      <PagedAppDropdown
        queryKey={["quality-approved-target", branchCode, queryScope]}
        fetchPage={(request) => qualityApi.locations(request, branchCode)}
        toOption={(location) => ({
          value: String(location.id),
          label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
          description: location.warehouseName,
          disabled: !location.isPutaway || location.isQuarantine,
        })}
        value={targetLocationId ? String(targetLocationId) : null}
        selectedOption={targetLocationId === defaultAcceptedDestination?.locationId ? {
          value: String(defaultAcceptedDestination.locationId),
          label: `${defaultAcceptedDestination.warehouseCode} / ${defaultAcceptedDestination.locationCode} · ${defaultAcceptedDestination.locationName}`,
          description: `${defaultAcceptedDestination.warehouseName} · ${t("linePopover.defaultTargetSuffix")}`,
        } : undefined}
        onValueChange={(value) => onChange(value ? Number(value) : null)}
        staticOptions={targetLocationId ? [] : [{
          value: "",
          label: t("linePopover.automaticAcceptedTarget"),
          description: t("linePopover.automaticAcceptedTargetDescription"),
        }]}
        placeholder={t("linePopover.acceptedTargetPlaceholder")}
        searchable
        className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
        contentClassName="!z-[5100]"
      />
    );
  }
  if (decision === "Quarantined") {
    return (
      <AppDropdown
        value={targetLocationId ? String(targetLocationId) : null}
        onValueChange={(value) => onChange(value ? Number(value) : null)}
        options={quarantineDestinations.map((destination) => ({
          value: String(destination.locationId),
          label: `${destination.warehouseCode} / ${destination.locationCode} · ${destination.locationName}`,
          description: destination.isDefault
            ? `${destination.warehouseName} · ${t("linePopover.defaultTargetSuffix")}`
            : destination.warehouseName,
        }))}
        placeholder={t("linePopover.quarantineTargetPlaceholder")}
        searchable
        className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
        portalContainer={null}
        contentClassName="!z-[5100]"
      />
    );
  }
  if (decision === "Rejected") {
    return (
      <PagedAppDropdown
        queryKey={["quality-rejected-target", branchCode, queryScope]}
        fetchPage={(request) => qualityApi.locations(request, branchCode)}
        toOption={(location) => ({
          value: String(location.id),
          label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
          description: location.warehouseName,
          disabled: !location.isQuarantine,
        })}
        value={targetLocationId ? String(targetLocationId) : null}
        selectedOption={targetLocationId === defaultRejectedDestination?.locationId ? {
          value: String(defaultRejectedDestination.locationId),
          label: `${defaultRejectedDestination.warehouseCode} / ${defaultRejectedDestination.locationCode} · ${defaultRejectedDestination.locationName}`,
          description: `${defaultRejectedDestination.warehouseName} · ${t("linePopover.defaultTargetSuffix")}`,
        } : undefined}
        onValueChange={(value) => onChange(value ? Number(value) : null)}
        placeholder={t("linePopover.rejectedTargetPlaceholder")}
        searchable
        className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
        contentClassName="!z-[5100]"
      />
    );
  }
  return null;
}

function MetaChip({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  accent?: boolean;
}): ReactElement {
  return (
    <div
      className={cn(
        "wms-ops-quality-detail__chip",
        accent && "wms-ops-quality-detail__chip--accent",
      )}
    >
      <span className="wms-ops-quality-detail__chip-label">{label}</span>
      <span
        className={cn(
          "wms-ops-quality-detail__chip-value",
          mono && "wms-ops-quality-detail__chip-value--mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export const QualityQuarantinePage = (): ReactElement => (
  <QualityInspectionsPage quarantineOnly />
);
