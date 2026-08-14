import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { ChevronDown, Clock3, ClipboardPen, Flag, History, Loader2, Pause, Play, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
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
  DialogDescription,
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
  QualityApproveSubmitScreen,
  QualityDecisionFlowOverlay,
  QualityReceiptCreatedSuccessPanel,
} from "./QualityDecisionFlowScreens";
import { mergeQualityInspectionStatusFilters } from "../utils/quality-inspection-list-filters";
import { requiresQualityDat } from "../utils/quality-dat-routing";
import {
  canToggleQualityInspectionPriority,
  qualityInspectionPriorityRowClass,
} from "../utils/quality-inspection-priority";
import { cn } from "@/lib/utils";
import { localizeEnumValue } from "@/lib/enum-localization";
import {
  formatProjectDate,
  formatProjectDateTime,
  formatProjectNumber,
} from "@/lib/project-format";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { usePermissionAccess } from "@/features/access-control/hooks/usePermissionAccess";
import { goodsReceiptV2Api } from "@/features/goods-receipt-v2/api/goods-receipt.api";
import {
  qualityApi,
  type QualityDecisionResult,
  type QualityInspection,
  type QualityInspectionControlQuantityRequest,
  type QualityInspectionDetail,
  type QualityInspectionDispositionRequest,
  type QualityInspectionLine,
  type QualityInspectionWorkSession,
  type QualityInspectionWorkStopReason,
} from "../api/quality.api";

const ACTIONABLE_DECISIONS = new Set(["Pending", "Hold", "Quarantined"]);
const QTY_EPS = 0.000001;
const QUALITY_WORK_STOP_REASONS: QualityInspectionWorkStopReason[] = [
  "Break",
  "MaterialWait",
  "EquipmentIssue",
  "DocumentationWait",
  "SupervisorWait",
  "ShiftEnd",
  "Handover",
  "Other",
];

type LineDraft = {
  decision: string;
  quantity: string;
  remainderDecision: string;
  reasonCode: string;
  reasonNote: string;
  inspectedQuantity: string;
  targetLocationId?: number | null;
  targetWarehouseId?: number | null;
  dispositions?: DispositionDraft[];
};

type DispositionDraft = {
  key: string;
  decision: string;
  quantity: string;
  targetLocationId: number | null;
  targetWarehouseId?: number | null;
};

const QUALITY_LOCATION_VALUE_SEPARATOR = "|";

function encodeQualityLocationValue(locationId: number, warehouseId: number): string {
  return `${locationId}${QUALITY_LOCATION_VALUE_SEPARATOR}${warehouseId}`;
}

function decodeQualityLocationValue(value: string): { targetLocationId: number | null; targetWarehouseId: number | null } {
  if (!value) return { targetLocationId: null, targetWarehouseId: null };
  const [locationValue, warehouseValue] = value.split(QUALITY_LOCATION_VALUE_SEPARATOR);
  const locationId = Number(locationValue);
  const warehouseId = Number(warehouseValue);
  return {
    targetLocationId: Number.isFinite(locationId) && locationId > 0 ? locationId : null,
    targetWarehouseId: Number.isFinite(warehouseId) && warehouseId > 0 ? warehouseId : null,
  };
}

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

function sumInspectedQuantity(lines: QualityInspectionLine[]): number {
  return roundQty(lines.reduce((sum, line) => sum + line.inspectedQuantity, 0));
}

function totalMinimumControlQuantity(line: QualityInspectionLine): number {
  return roundQty(
    Math.min(Math.max(0, line.sampleQuantity), Math.max(0, line.quantity)),
  );
}

function minimumControlQuantity(line: QualityInspectionLine): number {
  return roundQty(
    Math.max(0, totalMinimumControlQuantity(line) - line.inspectedQuantity),
  );
}

function remainingInspectableQuantity(line: QualityInspectionLine): number {
  return roundQty(Math.max(0, line.quantity - line.inspectedQuantity));
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
  primaryMessage?: string | null,
): Promise<void> {
  const docNo = detail.header.sourceDocumentNo?.trim();
  const isGoodsReceipt =
    detail.header.sourceDocumentType === "GR" ||
    detail.header.sourceDocumentType === "GoodsReceipt";
  const actionLabel = t("goodsReceiptNotice.actionLabel");
  const title =
    primaryMessage?.trim() || t("goodsReceiptNotice.decidedToastTitle");
  const fallbackDescription = docNo
    ? t("goodsReceiptNotice.withDoc", { docNo })
    : t("goodsReceiptNotice.withoutDoc");
  const action = {
    label: actionLabel,
    onClick: openGoodsReceiptList,
  };

  if (!isGoodsReceipt || !docNo) {
    toast.success(title, {
      description: fallbackDescription,
      action,
      duration: 7000,
    });
    return;
  }

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
      toast.success(title, {
        description: `${fallbackDescription} ${t("goodsReceiptNotice.searchable")}`,
        action,
        duration: 7000,
      });
      return;
    }

    const erp = row.erpIntegrationStatus;
    const erpLabel = localizeEnumValue(erp);
    let description = fallbackDescription;
    let tone: "success" | "message" | "warning" = "success";

    if (erp === "Succeeded") {
      description = t("goodsReceiptNotice.erpTransferredDesc", { docNo });
      tone = "success";
    } else if (erp === "Pending" || erp === "Processing") {
      description = t("goodsReceiptNotice.erpPendingDesc", { docNo, erpLabel });
      tone = "message";
    } else if (erp === "Failed" || erp === "CommitUncertain") {
      description = t("goodsReceiptNotice.erpFailedDesc", { docNo, erpLabel });
      tone = "warning";
    } else if (erp === "NotRequired") {
      description = `${t("goodsReceiptNotice.erpNotRequiredTitle")} (${docNo})`;
      tone = "message";
    } else if (erp) {
      description = t("goodsReceiptNotice.updatedDescWithErp", { docNo, erpLabel });
      tone = "message";
    } else {
      description = t("goodsReceiptNotice.updatedDescNoErp", { docNo });
      tone = "message";
    }

    const options = { description, action, duration: 7000 };
    if (tone === "warning") toast.warning(title, options);
    else if (tone === "message") toast.message(title, options);
    else toast.success(title, options);
  } catch {
    toast.success(title, {
      description: t("goodsReceiptNotice.unresolvedTitle"),
      action,
      duration: 7000,
    });
  }
}

function emptyDraft(
  defaultDecision = "",
  quantity = 0,
  remainderDecision = "Quarantined",
  targetLocationId: number | null = null,
  targetWarehouseId: number | null = null,
): LineDraft {
  return {
    decision: defaultDecision,
    quantity: quantity > 0 ? String(quantity) : "",
    remainderDecision,
    reasonCode: "",
    reasonNote: "",
    inspectedQuantity: "",
    targetLocationId,
    targetWarehouseId,
  };
}

function buildControlQuantityRequest(
  line: QualityInspectionLine,
  draft: LineDraft,
  t: TFunction,
): QualityInspectionControlQuantityRequest {
  const required = minimumControlQuantity(line);
  const maximum = remainingInspectableQuantity(line);
  if (!draft.inspectedQuantity.trim()) {
    throw new Error(t("errors.controlQuantityRequired", { stockCode: line.stockCode }));
  }
  const inspected = roundQty(parseQty(draft.inspectedQuantity));
  if (!Number.isFinite(inspected) || inspected < 0) {
    throw new Error(t("errors.controlQuantityMustBePositive", { stockCode: line.stockCode }));
  }
  if (inspected - maximum > QTY_EPS) {
    throw new Error(t("errors.controlQuantityExceedsRemaining", {
      stockCode: line.stockCode,
      inspected: formatProjectNumber(inspected),
      remaining: formatProjectNumber(maximum),
    }));
  }
  if (required - inspected > QTY_EPS) {
    throw new Error(t("errors.controlQuantityBelowMinimum", {
      stockCode: line.stockCode,
      inspected: formatProjectNumber(inspected),
      required: formatProjectNumber(required),
    }));
  }
  return { lineId: line.id, inspectedQuantity: inspected };
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

function defaultWarehouseForDecision(
  decision: string,
  acceptedWarehouseId: number | null,
  quarantineWarehouseId: number | null,
  rejectedWarehouseId: number | null,
): number | null {
  if (decision === "Accepted") return acceptedWarehouseId;
  if (decision === "Quarantined") return quarantineWarehouseId;
  if (decision === "Rejected") return rejectedWarehouseId;
  return null;
}

function acceptedDestinationForLine(
  line: QualityInspectionLine,
  fallback: QualityInspectionDetail["defaultAcceptedDestination"],
) {
  return line.defaultAcceptedDestination ?? fallback ?? null;
}

function dispositionDraft(
  decision = "Accepted",
  quantity = 0,
  targetLocationId: number | null = null,
  targetWarehouseId: number | null = null,
): DispositionDraft {
  return {
    key: crypto.randomUUID(),
    decision,
    quantity: quantity > 0 ? String(roundQty(quantity)) : "",
    targetLocationId,
    targetWarehouseId,
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
      draft.decision === "Accepted" ? draft.targetWarehouseId ?? null : null,
    ));
  }
  if (allocation.quarantineQuantity > QTY_EPS) {
    result.push(dispositionDraft(
      "Quarantined",
      allocation.quarantineQuantity,
      draft.decision === "Quarantined" ? draft.targetLocationId ?? fallbackQuarantineLocationId : fallbackQuarantineLocationId,
      draft.decision === "Quarantined" ? draft.targetWarehouseId ?? null : null,
    ));
  }
  if (allocation.rejectedQuantity > QTY_EPS) {
    result.push(dispositionDraft(
      "Rejected",
      allocation.rejectedQuantity,
      draft.decision === "Rejected" ? draft.targetLocationId ?? fallbackRejectedLocationId : fallbackRejectedLocationId,
      draft.decision === "Rejected" ? draft.targetWarehouseId ?? null : null,
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
  const { can } = usePermissionAccess();
  const queryClient = useQueryClient();
  const statusCatalogQuery = useQuery({
    queryKey: ["quality-inspection-status-options"],
    queryFn: qualityApi.inspectionStatusOptions,
    enabled: !quarantineOnly,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<QualityInspectionDetail | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [priorityLoading, setPriorityLoading] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const statusFacet = selectedStatus ?? statusCatalogQuery.data?.defaultValue ?? "";
  const prioritizableStatuses = useMemo(
    () => new Set(statusCatalogQuery.data?.items.filter((item) => item.canPrioritize).map((item) => item.value) ?? []),
    [statusCatalogQuery.data?.items],
  );
  const pageKey = quarantineOnly ? "quality-quarantine-v2" : "quality-inspections-v2";
  const fetchPage = useCallback(
    (request: GridRequest) =>
      qualityApi.inspectionsPaged(
        {
          ...request,
          filterLogic: "and",
          filters: mergeQualityInspectionStatusFilters(
            request.filters,
            quarantineOnly ? "Quarantined" : statusFacet,
          ),
        },
      ),
    [quarantineOnly, statusFacet],
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
  const toggleInspectionPriority = useCallback(
    async (inspection: QualityInspection) => {
      if (priorityLoading !== null) return;
      setPriorityLoading(inspection.id);
      try {
        const result = await qualityApi.togglePriority(inspection.id);
        setDetail((current) => current?.header.id === inspection.id
          ? { ...current, header: { ...current.header, isPriority: result.isPriority } }
          : current);
        await queryClient.invalidateQueries({ queryKey: ["advanced-grid", pageKey] });
        toast.success(result.isPriority ? t("list.priority.added") : t("list.priority.removed"));
      } catch (error) {
        toast.error(message(error, t("list.priority.failed")));
      } finally {
        setPriorityLoading(null);
      }
    },
    [pageKey, priorityLoading, queryClient, t],
  );
  const refreshDetail = useCallback(async (id: number) => {
    setDetail(await qualityApi.inspection(id));
    await queryClient.invalidateQueries({ queryKey: ["advanced-grid", pageKey] });
  }, [pageKey, queryClient]);
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
            {r.isPriority ? (
              <Flag className="size-3.5 fill-rose-500 text-rose-600" aria-label={t("list.priority.badge")} />
            ) : null}
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
        key: "workState",
        label: t("list.columns.work"),
        sortable: true,
        filterable: true,
        searchable: false,
        render: (r) => (
          <div className="flex min-w-36 flex-col items-start gap-1">
            <OpsStatusBadge tone={inferOpsStatusTone(r.workState)}>
              {t(`detail.work.states.${r.workState}`)}
            </OpsStatusBadge>
            {r.activeWorkerName ? (
              <span className="max-w-44 truncate text-[11px] text-muted-foreground" title={r.activeWorkerName}>
                {r.activeWorkerName}
              </span>
            ) : r.workSessionCount > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                {t("detail.work.sessions")}: {r.workSessionCount}
              </span>
            ) : null}
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
        width: 260,
        render: (r) => (
          <div className="flex items-center justify-center gap-1">
          {can("WMS.QUALITY.INSPECTIONS.PRIORITIZE") && canToggleQualityInspectionPriority(r.status, prioritizableStatuses) ? (
            <button
              type="button"
              onClick={() => void toggleInspectionPriority(r)}
              disabled={priorityLoading !== null}
              className={cn(
                "inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold",
                r.isPriority
                  ? "bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-300"
                  : "text-slate-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-slate-300 dark:hover:text-rose-300",
              )}
              aria-label={r.isPriority ? t("list.priority.remove") : t("list.priority.give")}
              title={r.isPriority ? t("list.priority.remove") : t("list.priority.give")}
            >
              {priorityLoading === r.id ? <Loader2 className="size-4 animate-spin" /> : <Flag className={cn("size-4", r.isPriority && "fill-current")} />}
              <span>{r.isPriority ? t("list.priority.remove") : t("list.priority.give")}</span>
            </button>
          ) : null}
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
          </div>
        ),
      },
    ];
    },
    [can, expandedId, loading, moduleReady, prioritizableStatuses, priorityLoading, t, toggle, toggleInspectionPriority],
  );
  const decided = async () => {
    setExpandedId(null);
    setDetail(null);
    await queryClient.invalidateQueries({
      queryKey: ["advanced-grid", pageKey],
    });
  };
  if (!quarantineOnly && statusCatalogQuery.isPending) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] text-sm text-slate-500">
        <Loader2 className="size-5 animate-spin" /> {t("list.statusOptionsLoading")}
      </div>
    );
  }
  if (!quarantineOnly && statusCatalogQuery.isError) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
        <p className="text-sm font-semibold text-rose-600">{t("list.statusOptionsFailed")}</p>
        <OpsActionButton type="button" onClick={() => statusCatalogQuery.refetch()}>
          {t("list.retry")}
        </OpsActionButton>
      </div>
    );
  }
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
          <QualityInspectionStatusFilter
            value={statusFacet}
            defaultValue={statusCatalogQuery.data?.defaultValue ?? statusFacet}
            statusOptions={statusCatalogQuery.data?.items ?? []}
            onChange={setSelectedStatus}
          />
        )
      }
      expandedRowId={expandedId}
      onRowDoubleClick={(row) => void toggle(row.id)}
      rowClassName={(row) => qualityInspectionPriorityRowClass(row.isPriority)}
      renderExpandedRow={(row) =>
        detail && detail.header.id === row.id ? (
          <InspectionDetailPanel
            detail={detail}
            refresh={() => refreshDetail(row.id)}
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
  refresh,
  close,
  decided,
}: {
  detail: QualityInspectionDetail;
  refresh: () => Promise<void>;
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
  const defaultAcceptedWarehouseId = detail.defaultAcceptedDestination?.warehouseId ?? null;
  const defaultRejectedLocationId = detail.defaultRejectedDestination?.locationId ?? null;
  const defaultRejectedWarehouseId = detail.defaultRejectedDestination?.warehouseId ?? null;
  const configuredDefaultQuarantineDestination = quarantineDestinations.find((destination) => destination.isDefault)
    ?? quarantineDestinations[0]
    ?? null;
  const configuredDefaultQuarantineLocationId = configuredDefaultQuarantineDestination?.locationId ?? null;
  const configuredDefaultQuarantineWarehouseId = configuredDefaultQuarantineDestination?.warehouseId ?? null;

  const [selected, setSelected] = useState<number[]>(() =>
    actionable.map((line) => line.id),
  );
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>(() =>
    Object.fromEntries(
      actionable.map((line) => {
        const acceptedDestination = acceptedDestinationForLine(
          line,
          detail.defaultAcceptedDestination,
        );
        return [
          line.id,
          emptyDraft(
            defaultDecision,
            actionableQuantity(line),
            defaultRemainder,
            acceptedDestination?.locationId ?? null,
            acceptedDestination?.warehouseId ?? null,
          ),
        ];
      }),
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
  const [decisionFlow, setDecisionFlow] = useState<
    | { phase: "running" }
    | { phase: "error"; message: string }
    | { phase: "success"; result: QualityDecisionResult; lineCount: number }
    | null
  >(null);
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [workBusy, setWorkBusy] = useState<"start" | "pause" | null>(null);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<QualityInspectionWorkStopReason>("Break");
  const [pauseNote, setPauseNote] = useState("");
  const datDocumentSeries = useMemo(
    () => detail.warehouseTransferDocumentSeries ?? [],
    [detail.warehouseTransferDocumentSeries],
  );
  const [warehouseTransferDocumentSeriesId, setWarehouseTransferDocumentSeriesId] = useState<string>(() =>
    String(datDocumentSeries.find((series) => series.isDefault)?.id ?? ""),
  );

  const startWork = async () => {
    if (workBusy || !detail.work.canStart) return;
    setWorkBusy("start");
    try {
      await qualityApi.startInspectionWork(detail.header.id, {
        idempotencyKey: crypto.randomUUID(),
        rowVersion: detail.rowVersion,
      });
      await refresh();
      toast.success(t(detail.work.state === "Paused" ? "detail.work.resumed" : "detail.work.started"));
    } catch (error) {
      toast.error(message(error, t("detail.work.startFailed")));
    } finally {
      setWorkBusy(null);
    }
  };

  const pauseWork = async () => {
    if (workBusy || !detail.work.canPause) return;
    setWorkBusy("pause");
    try {
      await qualityApi.pauseInspectionWork(detail.header.id, {
        idempotencyKey: crypto.randomUUID(),
        reason: pauseReason,
        note: pauseNote.trim() || null,
        rowVersion: detail.rowVersion,
      });
      setPauseDialogOpen(false);
      setPauseNote("");
      await refresh();
      toast.success(t("detail.work.paused"));
    } catch (error) {
      toast.error(message(error, t("detail.work.pauseFailed")));
    } finally {
      setWorkBusy(null);
    }
  };

  useEffect(() => {
    setDrafts((current) => {
      let changed = false;
      const next = { ...current };
      for (const line of actionable) {
        const destination = acceptedDestinationForLine(
          line,
          detail.defaultAcceptedDestination,
        );
        if (!destination) continue;
        const draft = next[line.id];
        if (!draft) continue;
        let updatedDraft = draft;
        if (draft.decision === "Accepted"
            && (!draft.targetLocationId || !draft.targetWarehouseId)) {
          updatedDraft = {
            ...updatedDraft,
            targetLocationId: destination.locationId,
            targetWarehouseId: destination.warehouseId,
          };
        }
        if (draft.dispositions?.some((part) =>
          part.decision === "Accepted" && (!part.targetLocationId || !part.targetWarehouseId))) {
          updatedDraft = {
            ...updatedDraft,
            dispositions: draft.dispositions.map((part) =>
              part.decision === "Accepted" && (!part.targetLocationId || !part.targetWarehouseId)
                ? {
                    ...part,
                    targetLocationId: destination.locationId,
                    targetWarehouseId: destination.warehouseId,
                  }
                : part),
          };
        }
        if (updatedDraft !== draft) {
          next[line.id] = updatedDraft;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [actionable, detail.defaultAcceptedDestination]);

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
  const canApplyDecision = detail.canDecideInventoryDisposition
    && detail.work.canApplyDecision
    && !final
    && actionable.length > 0
    && decidedCount > 0;
  const requiresDatTransfer = useMemo(() => {
    const targets = actionable.flatMap((line) => {
      const draft = drafts[line.id];
      if (!draft?.decision && !draft?.dispositions?.length) return [];
      if (draft.dispositions?.length) {
        return draft.dispositions.map((part) => ({
          decision: part.decision,
          targetWarehouseId: part.targetWarehouseId ?? defaultWarehouseForDecision(
            part.decision,
            defaultAcceptedWarehouseId,
            configuredDefaultQuarantineWarehouseId,
            defaultRejectedWarehouseId,
          ),
        }));
      }
      const targetsForLine = [{
        decision: draft.decision,
        targetWarehouseId: draft.targetWarehouseId ?? defaultWarehouseForDecision(
          draft.decision,
          defaultAcceptedWarehouseId,
          configuredDefaultQuarantineWarehouseId,
          defaultRejectedWarehouseId,
        ),
      }];
      const quantity = parseQty(draft.quantity);
      if (draft.decision !== "Returned"
          && Number.isFinite(quantity)
          && actionableQuantity(line) - quantity > QTY_EPS) {
        targetsForLine.push({
          decision: draft.remainderDecision,
          targetWarehouseId: defaultWarehouseForDecision(
            draft.remainderDecision,
            defaultAcceptedWarehouseId,
            configuredDefaultQuarantineWarehouseId,
            defaultRejectedWarehouseId,
          ),
        });
      }
      return targetsForLine;
    });
    return requiresQualityDat(detail.header.warehouseId, targets);
  }, [
    actionable,
    configuredDefaultQuarantineWarehouseId,
    defaultAcceptedWarehouseId,
    defaultRejectedWarehouseId,
    detail.header.warehouseId,
    drafts,
  ]);

  useEffect(() => {
    if (!requiresDatTransfer) return;
    const currentId = Number(warehouseTransferDocumentSeriesId);
    if (datDocumentSeries.some((series) => series.id === currentId)) return;
    setWarehouseTransferDocumentSeriesId(String(
      datDocumentSeries.find((series) => series.isDefault)?.id ?? "",
    ));
  }, [datDocumentSeries, requiresDatTransfer, warehouseTransferDocumentSeriesId]);
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
      const acceptedDestination = line
        ? acceptedDestinationForLine(line, detail.defaultAcceptedDestination)
        : detail.defaultAcceptedDestination;
      const fallback = emptyDraft(
        defaultDecision,
        line ? actionableQuantity(line) : 0,
        defaultRemainder,
        acceptedDestination?.locationId ?? null,
        acceptedDestination?.warehouseId ?? null,
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
        const lineAcceptedDestination = acceptedDestinationForLine(
          line,
          detail.defaultAcceptedDestination,
        );
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
          inspectedQuantity: "",
          targetLocationId: defaultTargetForDecision(
            bulkDecision,
            lineAcceptedDestination?.locationId ?? null,
            configuredDefaultQuarantineLocationId,
            defaultRejectedLocationId,
          ),
          targetWarehouseId: defaultWarehouseForDecision(
            bulkDecision,
            lineAcceptedDestination?.warehouseId ?? null,
            configuredDefaultQuarantineWarehouseId,
            defaultRejectedWarehouseId,
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
    if (!detail.canDecideInventoryDisposition) {
      toast.error(t("errors.receiptMustBeCompletedBeforeQualityRouting"));
      return false;
    }
    if (requiresDatTransfer && !Number(warehouseTransferDocumentSeriesId)) {
      toast.error(t("errors.datDocumentSeriesRequired"));
      return false;
    }
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
    let controlRequests: QualityInspectionControlQuantityRequest[] = [];
    try {
      controlRequests = pending.map(({ line, draft }) =>
        buildControlQuantityRequest(line, draft, t),
      );
    } catch (error) {
      toast.error(message(error, t("errors.controlQuantityInvalid")));
      return false;
    }
    for (const { line, draft } of pending) {
      if (draft.dispositions?.length) {
        try {
          const lineAcceptedDestination = acceptedDestinationForLine(
            line,
            detail.defaultAcceptedDestination,
          );
          buildDispositionRequests(
            line,
            draft,
            lineAcceptedDestination?.locationId ?? null,
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
      dispositionRequests = distributionRows.flatMap(({ line, draft }) => {
        const lineAcceptedDestination = acceptedDestinationForLine(
          line,
          detail.defaultAcceptedDestination,
        );
        return buildDispositionRequests(
          line,
          draft,
          lineAcceptedDestination?.locationId ?? null,
          configuredDefaultQuarantineLocationId,
          defaultRejectedLocationId,
          t,
        );
      });
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

    setApplyConfirmOpen(false);
    setSaving(true);
    setDecisionFlow({ phase: "running" });
    const startedAt = Date.now();
    try {
      let rowVersion = detail.rowVersion;
      const calls: Array<() => ReturnType<typeof qualityApi.decide>> = [];
      let completionMessage = "";
      let receiptCreatedNow = false;
      let lastResult: QualityDecisionResult | null = null;

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
            controlQuantities: controlRequests.filter((control) =>
              distributionRows.some((row) => row.line.id === control.lineId),
            ),
            quarantineLocationId: configuredDefaultQuarantineLocationId,
            warehouseTransferDocumentSeriesId: requiresDatTransfer
              ? Number(warehouseTransferDocumentSeriesId)
              : null,
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
            controlQuantities: controlRequests.filter((control) =>
              group.lineIds.includes(control.lineId),
            ),
            rowVersion,
          });
        });
      }

      for (let i = 0; i < calls.length; i += 1) {
        const result = await calls[i]();
        lastResult = result;
        completionMessage = result.message;
        if (result.erpDocumentCreatedNow) receiptCreatedNow = true;
        if (i < calls.length - 1) {
          const fresh = await qualityApi.inspection(detail.header.id);
          rowVersion = fresh.rowVersion;
        }
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed < 1400) {
        await new Promise((resolve) => window.setTimeout(resolve, 1400 - elapsed));
      }

      if (receiptCreatedNow && lastResult) {
        setDecisionFlow({
          phase: "success",
          result: lastResult,
          lineCount: pending.length,
        });
        return true;
      }

      setDecisionFlow(null);
      await notifyGoodsReceiptAfterDecision(
        detail,
        () => navigate("/warehouse/goods-receipts/list"),
        t,
        completionMessage || t("decisionSaved"),
      );
      decided();
      return true;
    } catch (error) {
      const errorMessage = message(error, t("errors.decisionSaveFailed"));
      toast.error(errorMessage);
      setDecisionFlow({ phase: "error", message: errorMessage });
      await new Promise((resolve) => window.setTimeout(resolve, 2600));
      setDecisionFlow(null);
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

      <QualityInspectionWorkPanel
        work={detail.work}
        sessions={detail.workSessions ?? []}
        busy={workBusy}
        onStart={() => void startWork()}
        onPause={() => setPauseDialogOpen(true)}
      />

      <Dialog
        open={pauseDialogOpen}
        onOpenChange={(open) => {
          if (workBusy) return;
          setPauseDialogOpen(open);
        }}
      >
        <DialogContent
          portalRoot="body"
          tone="ops"
          className="wms-ops-form max-w-lg gap-0 overflow-hidden border-0 p-0 shadow-none"
        >
          <DialogHeader className="border-b px-6 py-4 text-left">
            <DialogTitle>{t("detail.work.pauseDialog.title")}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-500">
              {t("detail.work.pauseDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <label className="block space-y-1.5 text-sm font-semibold">
              <span>{t("detail.work.pauseDialog.reason")}</span>
              <AppDropdown
                value={pauseReason}
                onValueChange={(value) => setPauseReason(value as QualityInspectionWorkStopReason)}
                options={QUALITY_WORK_STOP_REASONS.map((reason) => ({
                  value: reason,
                  label: t(`detail.work.stopReasons.${reason}`),
                }))}
                className="wms-ops-quality-field"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold">
              <span>{t("detail.work.pauseDialog.note")}</span>
              <textarea
                value={pauseNote}
                onChange={(event) => setPauseNote(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={t("detail.work.pauseDialog.notePlaceholder")}
                className="wms-ops-quality-field min-h-24 w-full resize-y rounded-xl border px-3 py-2 text-sm"
              />
              <span className="block text-xs font-normal text-slate-500">
                {pauseReason === "Other"
                  ? t("detail.work.pauseDialog.noteRequired")
                  : t("detail.work.pauseDialog.noteHelp")}
              </span>
            </label>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <OpsActionButton
              type="button"
              variant="secondary"
              disabled={Boolean(workBusy)}
              onClick={() => setPauseDialogOpen(false)}
            >
              {t("detail.work.pauseDialog.cancel")}
            </OpsActionButton>
            <OpsActionButton
              type="button"
              disabled={Boolean(workBusy) || (pauseReason === "Other" && !pauseNote.trim())}
              onClick={() => void pauseWork()}
            >
              {workBusy === "pause" ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />}
              {t("detail.work.pauseDialog.confirm")}
            </OpsActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!final && actionable.length > 0 && (
        <section
          className={cn(
            "wms-ops-quality-bulk",
            !bulkPanelOpen && "wms-ops-quality-bulk--collapsed",
          )}
        >
          <button
            type="button"
            className="wms-ops-quality-bulk__secret-toggle"
            aria-expanded={bulkPanelOpen}
            aria-label={t("detail.bulk.toggleAria")}
            title={t("detail.bulk.toggleAria")}
            onClick={() => setBulkPanelOpen((open) => !open)}
          >
            <ChevronDown
              className={cn(
                "wms-ops-quality-bulk__secret-chevron",
                bulkPanelOpen && "wms-ops-quality-bulk__secret-chevron--open",
              )}
              aria-hidden
            />
          </button>

          {bulkPanelOpen ? (
            <>
              <div className="wms-ops-quality-bulk__top">
                <p className="wms-ops-quality-bulk__title">
                  {t("detail.bulk.title")}
                </p>
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
            </>
          ) : null}
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
              <th className="wms-ops-quality-lines__cell p-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.inspected")}
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
              const lineAcceptedDestination = acceptedDestinationForLine(
                line,
                detail.defaultAcceptedDestination,
              );
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
              const inspectedQty = sumInspectedQuantity(group.lines);
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
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle text-right font-mono">
                    <span className="block font-semibold">{formatProjectNumber(inspectedQty)}</span>
                    <span className="block text-[0.65rem] text-slate-500">
                      {t("detail.table.inspectedProgress", {
                        value: sampleQty > 0
                          ? Math.min(100, Math.round((inspectedQty / sampleQty) * 100))
                          : 0,
                      })}
                    </span>
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
                        defaultAcceptedDestination={lineAcceptedDestination}
                        defaultRejectedDestination={detail.defaultRejectedDestination ?? null}
                        defaultAcceptedLocationId={lineAcceptedDestination?.locationId ?? null}
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
                                    lineAcceptedDestination?.locationId ?? null,
                                    lineAcceptedDestination?.warehouseId ?? null,
                                  )),
                                quantity: String(remainingQty),
                              }
                            : draft ??
                              emptyDraft(
                                defaultDecision,
                                remainingQty,
                                defaultRemainder,
                                lineAcceptedDestination?.locationId ?? null,
                                lineAcceptedDestination?.warehouseId ?? null,
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

      {(detail.controls ?? []).length > 0 ? (
        <section className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
          <div>
            <p className="text-sm font-bold">{t("detail.controlHistory.title")}</p>
            <p className="text-xs text-slate-500">{t("detail.controlHistory.description")}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {detail.controls.map((control) => {
              const sourceLine = detail.lines.find((line) => line.id === control.lineId);
              return (
                <article key={control.id} className="rounded-xl border border-emerald-500/20 bg-[var(--wms-app-panel)] p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold">{sourceLine?.stockCode ?? `#${control.lineId}`}</span>
                    <OpsStatusBadge tone={control.inspectedQuantity + QTY_EPS >= control.requiredQuantity ? "done" : "pending"}>
                      {t("detail.controlHistory.quantity", {
                        inspected: formatProjectNumber(control.inspectedQuantity),
                        required: formatProjectNumber(control.requiredQuantity),
                      })}
                    </OpsStatusBadge>
                  </div>
                  <div className="mt-2 text-[0.68rem] text-slate-500">
                    {t("detail.controlHistory.lotQuantity", { value: formatProjectNumber(control.lotQuantity) })}
                    {" · "}
                    {formatProjectDateTime(control.inspectedAtUtc)}
                    {" · "}
                    {t("detail.controlHistory.user", { id: control.inspectedBy })}
                  </div>
                  <div className="mt-1 font-mono text-[0.65rem] text-slate-500">{control.outcomeSummary}</div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

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
            {!detail.canDecideInventoryDisposition ? (
              <span className="block text-xs font-semibold text-rose-600">
                {t("detail.footer.receiptNotCompletedWarning", {
                  status: localizeEnumValue(detail.sourceOperationStatus ?? "InProgress"),
                })}
              </span>
            ) : null}
            {detail.canDecideInventoryDisposition && !detail.work.canApplyDecision ? (
              <span className="block text-xs font-semibold text-amber-700 dark:text-amber-300">
                {detail.work.activeWorkerName
                  ? t("detail.work.decisionLockedByOther", { name: detail.work.activeWorkerName })
                  : t("detail.work.decisionRequiresStart")}
              </span>
            ) : null}
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
            {requiresDatTransfer ? (
              <div className="mt-4 space-y-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
                <div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    {t("applyConfirm.datSeries.title")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {t("applyConfirm.datSeries.description", {
                      sourceWarehouse: detail.header.warehouseName
                        || detail.header.warehouseCode
                        || detail.header.warehouseId,
                    })}
                  </p>
                </div>
                <AppDropdown
                  value={warehouseTransferDocumentSeriesId || null}
                  onValueChange={setWarehouseTransferDocumentSeriesId}
                  options={datDocumentSeries.map((series) => ({
                    value: String(series.id),
                    label: `${series.code} · ${series.name}`,
                    description: series.isDefault
                      ? t("applyConfirm.datSeries.defaultDescription", {
                          preview: series.previewDocumentNumber,
                        })
                      : series.previewDocumentNumber,
                  }))}
                  placeholder={t("applyConfirm.datSeries.placeholder")}
                  searchable
                  portalContainer={null}
                  contentClassName="!z-[6100]"
                />
                {datDocumentSeries.length === 0 ? (
                  <p className="text-xs font-semibold text-rose-600">
                    {t("applyConfirm.datSeries.notConfigured")}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                {t("applyConfirm.sameWarehouseNotice")}
              </p>
            )}
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
              disabled={saving
                || !canApplyDecision
                || requiresDatTransfer && !Number(warehouseTransferDocumentSeriesId)}
              className="wms-ops-quality-decide-btn"
              onClick={() => {
                void save();
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

      {decisionFlow && typeof document !== "undefined"
        ? createPortal(
            <QualityDecisionFlowOverlay>
              {decisionFlow.phase === "success" ? (
                <QualityReceiptCreatedSuccessPanel
                  result={decisionFlow.result}
                  lineCount={decisionFlow.lineCount}
                  sourceLabel={
                    detail.header.sourceWaybillNo?.trim() ||
                    detail.header.sourceDocumentNo?.trim() ||
                    undefined
                  }
                  onDone={() => {
                    setDecisionFlow(null);
                    decided();
                  }}
                />
              ) : (
                <QualityApproveSubmitScreen
                  phase={decisionFlow.phase}
                  errorMessage={
                    decisionFlow.phase === "error"
                      ? decisionFlow.message
                      : undefined
                  }
                  lineCount={decidedCount}
                  documentNo={
                    detail.header.sourceWaybillNo?.trim() ||
                    detail.header.sourceDocumentNo?.trim() ||
                    undefined
                  }
                  sourceLabel={
                    detail.header.sourceWaybillNo?.trim() ||
                    detail.header.sourceDocumentNo?.trim() ||
                    undefined
                  }
                />
              )}
            </QualityDecisionFlowOverlay>,
            document.body,
          )
        : null}
    </div>
  );
}

function QualityInspectionWorkPanel({
  work,
  sessions,
  busy,
  onStart,
  onPause,
}: {
  work: QualityInspectionDetail["work"];
  sessions: QualityInspectionWorkSession[];
  busy: "start" | "pause" | null;
  onStart: () => void;
  onPause: () => void;
}): ReactElement {
  const { t } = useModuleTranslation("quality");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (work.state !== "Running") return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [work.state]);

  useEffect(() => setNow(Date.now()), [work.serverNowUtc]);

  const liveDelta = work.state === "Running"
    ? Math.max(0, Math.floor((now - new Date(work.serverNowUtc).getTime()) / 1000))
    : 0;
  const totalSeconds = work.totalWorkedSeconds + liveDelta;
  const activeSession = sessions.find((session) => !session.endedAtUtc) ?? null;
  const startLabel = work.state === "Paused"
    ? t("detail.work.resume")
    : t("detail.work.start");

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-400/30 bg-[var(--wms-app-panel-muted)] p-3.5 shadow-[0_12px_32px_color-mix(in_oklab,var(--wms-brand-primary)_8%,transparent)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Clock3 className="size-4 text-cyan-600" aria-hidden />
            <h4 className="text-sm font-bold">{t("detail.work.title")}</h4>
            <OpsStatusBadge tone={work.state === "Running" ? "active" : work.state === "Completed" ? "done" : "pending"}>
              {t(`detail.work.states.${work.state}`)}
            </OpsStatusBadge>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{t("detail.work.description")}</p>
          {work.activeWorkerName ? (
            <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
              {t("detail.work.activeWorker", {
                name: work.activeWorkerName,
                startedAt: work.activeStartedAtUtc ? formatProjectDateTime(work.activeStartedAtUtc) : "—",
              })}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[33rem]">
          <WorkMetric icon={<Clock3 className="size-3.5" />} label={t("detail.work.totalTime")} value={formatDurationSeconds(totalSeconds)} />
          <WorkMetric icon={<Clock3 className="size-3.5" />} label={t("detail.work.myTime")} value={formatDurationSeconds(work.currentUserWorkedSeconds + (work.canApplyDecision ? liveDelta : 0))} />
          <WorkMetric icon={<Users className="size-3.5" />} label={t("detail.work.participants")} value={String(work.participantCount)} />
          <WorkMetric icon={<History className="size-3.5" />} label={t("detail.work.sessions")} value={String(work.sessionCount)} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--wms-app-border)] pt-3">
        {work.canStart ? (
          <OpsActionButton type="button" disabled={Boolean(busy)} onClick={onStart}>
            {busy === "start" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {startLabel}
          </OpsActionButton>
        ) : null}
        {work.canPause ? (
          <OpsActionButton type="button" variant="secondary" disabled={Boolean(busy)} onClick={onPause}>
            <Pause className="size-4" />
            {t("detail.work.pause")}
          </OpsActionButton>
        ) : null}
        {!work.canStart && !work.canPause && work.state === "Running" ? (
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            {t("detail.work.otherWorkerLock", { name: work.activeWorkerName ?? "—" })}
          </span>
        ) : null}
        {sessions.length > 0 ? (
          <button
            type="button"
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <History className="size-4" />
            {t("detail.work.history")}
            <ChevronDown className={cn("size-3.5 transition-transform", historyOpen && "rotate-180")} />
          </button>
        ) : null}
      </div>

      {historyOpen ? (
        <div className="mt-3 grid gap-2 border-t border-[var(--wms-app-border)] pt-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => {
            const sessionSeconds = session.endedAtUtc
              ? session.durationSeconds
              : activeSession?.id === session.id
                ? Math.max(0, Math.floor((now - new Date(session.startedAtUtc).getTime()) / 1000))
                : session.durationSeconds;
            return (
              <article key={session.id} className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{session.workerName}</p>
                    <p className="mt-0.5 text-slate-500">#{session.sequenceNo} · {formatProjectDateTime(session.startedAtUtc)}</p>
                  </div>
                  <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300">{formatDurationSeconds(sessionSeconds)}</span>
                </div>
                <p className="mt-2 text-slate-500">
                  {session.endedAtUtc
                    ? t("detail.work.historyEnded", { date: formatProjectDateTime(session.endedAtUtc) })
                    : t("detail.work.historyRunning")}
                </p>
                {session.stopReason ? (
                  <p className="mt-1 font-semibold">{t(`detail.work.stopReasons.${session.stopReason}`)}</p>
                ) : null}
                {session.stopNote ? <p className="mt-1 leading-5 text-slate-500">{session.stopNote}</p> : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function WorkMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }): ReactElement {
  return (
    <div className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] px-3 py-2">
      <span className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-wide text-slate-500">{icon}{label}</span>
      <strong className="mt-1 block font-mono text-sm">{value}</strong>
    </div>
  );
}

function formatDurationSeconds(value: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
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
  const totalRequiredControl = totalMinimumControlQuantity(line);
  const requiredControl = minimumControlQuantity(line);
  const inspectedThisDecision = draft.inspectedQuantity;
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
  const fallbackQuarantineWarehouseId = quarantineDestinations.find(
    (destination) => destination.locationId === fallbackQuarantineLocationId,
  )?.warehouseId ?? null;
  const defaultAcceptedWarehouseId = defaultAcceptedDestination?.warehouseId ?? null;
  const defaultRejectedWarehouseId = defaultRejectedDestination?.warehouseId ?? null;
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
        ).map((part) => ({
          ...part,
          targetWarehouseId: part.targetWarehouseId ?? defaultWarehouseForDecision(
            part.decision,
            defaultAcceptedWarehouseId,
            fallbackQuarantineWarehouseId,
            defaultRejectedWarehouseId,
          ),
        })),
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
        dispositionDraft(
          "Accepted",
          unallocatedQuantity,
          defaultAcceptedLocationId,
          defaultAcceptedWarehouseId,
        ),
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
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-foreground">
                      {t("linePopover.controlQuantityTitle")}
                    </div>
                    <div className="mt-0.5 text-[0.65rem] text-slate-500">
                      {t("linePopover.controlQuantitySummary", {
                        totalRequired: formatProjectNumber(totalRequiredControl),
                        required: formatProjectNumber(requiredControl),
                        lotQuantity: formatProjectNumber(line.quantity),
                        previous: formatProjectNumber(line.inspectedQuantity),
                      })}
                    </div>
                  </div>
                  <span className="rounded-lg bg-emerald-500/10 px-2 py-1 font-mono text-[0.65rem] font-bold text-emerald-700 dark:text-emerald-300">
                    {t("linePopover.previouslyInspected", {
                      value: formatProjectNumber(line.inspectedQuantity),
                    })}
                  </span>
                </div>
                <label className="mt-2 block space-y-1 text-sm">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t("linePopover.inspectedThisDecisionLabel")}
                  </span>
                  <AppInput
                    value={inspectedThisDecision}
                    onChange={(event) => onChange({ inspectedQuantity: event.target.value })}
                    placeholder={formatProjectNumber(requiredControl)}
                    inputMode="decimal"
                    className="wms-ops-quality-field h-10 text-sm"
                  />
                  <span className="block text-[0.65rem] leading-relaxed text-slate-500">
                    {t("linePopover.inspectedThisDecisionHelp", {
                      totalRequired: formatProjectNumber(totalRequiredControl),
                      required: formatProjectNumber(requiredControl),
                      previous: formatProjectNumber(line.inspectedQuantity),
                    })}
                  </span>
                </label>
              </div>
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
                      targetWarehouseId: defaultWarehouseForDecision(
                        value,
                        defaultAcceptedWarehouseId,
                        fallbackQuarantineWarehouseId,
                        defaultRejectedWarehouseId,
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
                <span className="block text-[0.65rem] leading-relaxed text-slate-500">
                  {t("linePopover.decisionQuantityHelp")}
                </span>
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
                    targetWarehouseId={draft.targetWarehouseId ?? defaultWarehouseForDecision(
                      draft.decision,
                      defaultAcceptedWarehouseId,
                      fallbackQuarantineWarehouseId,
                      defaultRejectedWarehouseId,
                    )}
                    onChange={(targetLocationId, targetWarehouseId) => onChange({
                      targetLocationId,
                      targetWarehouseId,
                    })}
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
                            targetWarehouseId: defaultWarehouseForDecision(
                              value,
                              defaultAcceptedWarehouseId,
                              fallbackQuarantineWarehouseId,
                              defaultRejectedWarehouseId,
                            ),
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
                            value: encodeQualityLocationValue(location.id, location.warehouseId),
                            label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
                            description: location.warehouseName,
                            disabled: !location.isPutaway || location.isQuarantine,
                          })}
                          value={part.targetLocationId && part.targetWarehouseId
                            ? encodeQualityLocationValue(part.targetLocationId, part.targetWarehouseId)
                            : null}
                          selectedOption={part.targetLocationId === defaultAcceptedDestination?.locationId ? {
                            value: encodeQualityLocationValue(
                              defaultAcceptedDestination.locationId,
                              defaultAcceptedDestination.warehouseId,
                            ),
                            label: `${defaultAcceptedDestination.warehouseCode} / ${defaultAcceptedDestination.locationCode} · ${defaultAcceptedDestination.locationName}`,
                            description: `${defaultAcceptedDestination.warehouseName} · ${t("linePopover.defaultTargetSuffix")}`,
                          } : undefined}
                          onValueChange={(value) => patchDisposition(
                            part.key,
                            decodeQualityLocationValue(value),
                          )}
                          staticOptions={[{
                            value: "",
                            label: t("linePopover.automaticAcceptedTarget"),
                            description: t("linePopover.automaticAcceptedTargetDescription"),
                          }]}
                          placeholder={t("linePopover.acceptedTargetPlaceholder")}
                          searchable
                          className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
                          portalContainer={null}
                          contentClassName="!z-[5100]"
                        />
                      ) : part.decision === "Quarantined" ? (
                        <AppDropdown
                          value={part.targetLocationId && part.targetWarehouseId
                            ? encodeQualityLocationValue(part.targetLocationId, part.targetWarehouseId)
                            : null}
                          onValueChange={(value) => patchDisposition(
                            part.key,
                            decodeQualityLocationValue(value),
                          )}
                          options={[
                            ...quarantineDestinations.map((destination) => ({
                              value: encodeQualityLocationValue(
                                destination.locationId,
                                destination.warehouseId,
                              ),
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
                            value: encodeQualityLocationValue(location.id, location.warehouseId),
                            label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
                            description: location.warehouseName,
                            disabled: !location.isQuarantine,
                          })}
                          value={part.targetLocationId && part.targetWarehouseId
                            ? encodeQualityLocationValue(part.targetLocationId, part.targetWarehouseId)
                            : null}
                          selectedOption={part.targetLocationId === defaultRejectedDestination?.locationId ? {
                            value: encodeQualityLocationValue(
                              defaultRejectedDestination.locationId,
                              defaultRejectedDestination.warehouseId,
                            ),
                            label: `${defaultRejectedDestination.warehouseCode} / ${defaultRejectedDestination.locationCode} · ${defaultRejectedDestination.locationName}`,
                            description: `${defaultRejectedDestination.warehouseName} · ${t("linePopover.defaultTargetSuffix")}`,
                          } : undefined}
                          onValueChange={(value) => patchDisposition(
                            part.key,
                            decodeQualityLocationValue(value),
                          )}
                          placeholder={t("linePopover.rejectedTargetPlaceholder")}
                          searchable
                          className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
                          portalContainer={null}
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
  targetWarehouseId,
  onChange,
  branchCode,
  queryScope,
  quarantineDestinations,
  defaultAcceptedDestination,
  defaultRejectedDestination,
}: {
  decision: string;
  targetLocationId: number | null;
  targetWarehouseId: number | null;
  onChange: (locationId: number | null, warehouseId: number | null) => void;
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
          value: encodeQualityLocationValue(location.id, location.warehouseId),
          label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
          description: location.warehouseName,
          disabled: !location.isPutaway || location.isQuarantine,
        })}
        value={targetLocationId && targetWarehouseId
          ? encodeQualityLocationValue(targetLocationId, targetWarehouseId)
          : null}
        selectedOption={targetLocationId === defaultAcceptedDestination?.locationId ? {
          value: encodeQualityLocationValue(
            defaultAcceptedDestination.locationId,
            defaultAcceptedDestination.warehouseId,
          ),
          label: `${defaultAcceptedDestination.warehouseCode} / ${defaultAcceptedDestination.locationCode} · ${defaultAcceptedDestination.locationName}`,
          description: `${defaultAcceptedDestination.warehouseName} · ${t("linePopover.defaultTargetSuffix")}`,
        } : undefined}
        onValueChange={(value) => {
          const target = decodeQualityLocationValue(value);
          onChange(target.targetLocationId, target.targetWarehouseId);
        }}
        staticOptions={targetLocationId ? [] : [{
          value: "",
          label: t("linePopover.automaticAcceptedTarget"),
          description: t("linePopover.automaticAcceptedTargetDescription"),
        }]}
        placeholder={t("linePopover.acceptedTargetPlaceholder")}
        searchable
        className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
        portalContainer={null}
        contentClassName="!z-[5100]"
      />
    );
  }
  if (decision === "Quarantined") {
    return (
      <AppDropdown
        value={targetLocationId && targetWarehouseId
          ? encodeQualityLocationValue(targetLocationId, targetWarehouseId)
          : null}
        onValueChange={(value) => {
          const target = decodeQualityLocationValue(value);
          onChange(target.targetLocationId, target.targetWarehouseId);
        }}
        options={quarantineDestinations.map((destination) => ({
          value: encodeQualityLocationValue(destination.locationId, destination.warehouseId),
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
          value: encodeQualityLocationValue(location.id, location.warehouseId),
          label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
          description: location.warehouseName,
          disabled: !location.isQuarantine,
        })}
        value={targetLocationId && targetWarehouseId
          ? encodeQualityLocationValue(targetLocationId, targetWarehouseId)
          : null}
        selectedOption={targetLocationId === defaultRejectedDestination?.locationId ? {
          value: encodeQualityLocationValue(
            defaultRejectedDestination.locationId,
            defaultRejectedDestination.warehouseId,
          ),
          label: `${defaultRejectedDestination.warehouseCode} / ${defaultRejectedDestination.locationCode} · ${defaultRejectedDestination.locationName}`,
          description: `${defaultRejectedDestination.warehouseName} · ${t("linePopover.defaultTargetSuffix")}`,
        } : undefined}
        onValueChange={(value) => {
          const target = decodeQualityLocationValue(value);
          onChange(target.targetLocationId, target.targetWarehouseId);
        }}
        placeholder={t("linePopover.rejectedTargetPlaceholder")}
        searchable
        className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
        portalContainer={null}
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
