import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactElement, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { ChevronDown, Clock3, ClipboardPen, Flag, History, Loader2, Pause, Play, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  GridRowReorderGrip,
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
import {
  QualityInspectionCreatedPeriodTabs,
  QualityInspectionStatusFilter,
} from "./QualityInspectionStatusFilter";
import {
  QualityApproveSubmitScreen,
  QualityDecisionFlowOverlay,
  QualityReceiptCreatedSuccessPanel,
} from "./QualityDecisionFlowScreens";
import { QualityDispositionImageButton } from "./QualityInspectionDispositionImageDialog";
import { QualityDispositionHistoryImages } from "./QualityInspectionLineImageGallery";
import {
  mergeQualityInspectionStatusFilters,
  QUALITY_INSPECTION_STATUS_ALL,
  type QualityInspectionCreatedPeriod,
} from "../utils/quality-inspection-list-filters";
import { localizeQualityInspectionStatus } from "../utils/quality-inspection-status-label";
import { requiresQualityDat } from "../utils/quality-dat-routing";
import {
  canToggleQualityInspectionPriority,
  qualityInspectionPriorityRowClass,
} from "../utils/quality-inspection-priority";
import {
  collectQualityProgressControlQuantities,
  formatQualityWorkOperatorName,
  capQuantityInput,
  remainingCapacityForDistributionRow,
  resolveDecisionControlQuantity,
  sanitizeIntegerQuantityInput,
} from "../utils/quality-work-operator";
import {
  applyQualityControlQuantityCache,
  clearQualityControlQuantityCache,
  extractQualityControlQuantityCache,
  readQualityControlQuantityCache,
  writeQualityControlQuantityCache,
} from "../utils/quality-control-quantity-cache";
import { useAuthStore } from "@/stores/auth-store";
import { collapseRepeatedMessageSegments } from "../utils/quality-decision-message";
import { cn } from "@/lib/utils";
import {
  preventDialogDismissIfImageLightbox,
  preventDialogEscapeIfImageLightbox,
  shouldIgnoreDialogClose,
} from "@/lib/wms-image-lightbox";
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
  type QualityInspectionWorkSummary,
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
  decisionCodeId: string;
  reasonCode: string;
  decisionCodeRequiresNote: boolean;
  reasonNote: string;
  inspectedQuantity: string;
  confirmedInspectedQuantity: string;
  targetLocationId?: number | null;
  targetWarehouseId?: number | null;
  dispositions?: DispositionDraft[];
  stagedDispositionKeys?: Record<string, string>;
};

type MaterializedDraftDispositions = {
  parts: DispositionDraft[];
  stagedDispositionKeys: Record<string, string>;
};

type DispositionDraft = {
  key: string;
  decision: string;
  quantity: string;
  targetLocationId: number | null;
  targetWarehouseId?: number | null;
};

type DispositionDraftImages = Record<number, Record<string, File[]>>;

type QualityDecisionFlow =
  | { phase: "running"; lineCount: number; sourceLabel?: string }
  | { phase: "error"; message: string; lineCount: number; sourceLabel?: string }
  | { phase: "success"; result: QualityDecisionResult; lineCount: number; sourceLabel?: string };

const QUALITY_LOCATION_VALUE_SEPARATOR = "|";
const QUALITY_DECISION_NESTED_LAYER =
  '.wms-ops-list-select-content, [data-radix-popper-content-wrapper], [data-wms-image-lightbox], [role="listbox"]';
const QUALITY_DECISION_DISMISS_IGNORE =
  `.wms-ops-quality-decision-popover, ${QUALITY_DECISION_NESTED_LAYER}, .wms-ops-list-popover, .wms-floating-surface, .wms-quality-disposition-image-dialog`;
const QUALITY_INSPECT_FLOATING_LAYER =
  `.wms-ops-quality-decision-popover, ${QUALITY_DECISION_NESTED_LAYER}, .wms-ops-list-popover, .wms-floating-surface, [data-slot="dialog-content"], [data-slot="dialog-overlay"]`;

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

function joinGroupedCodes(
  lines: QualityInspectionLine[],
  pick: (line: QualityInspectionLine) => string | null | undefined,
): string {
  const values = [
    ...new Set(
      lines.flatMap((line) =>
        (pick(line) ?? "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean),
      ),
    ),
  ];
  return values.length > 0 ? values.join(", ") : "—";
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

function draftInspectedThisDecision(draft: LineDraft | undefined): number {
  if (!draft?.confirmedInspectedQuantity?.trim()) return 0;
  const qty = roundQty(parseQty(draft.confirmedInspectedQuantity));
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
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
  const title = collapseRepeatedMessageSegments(
    primaryMessage?.trim() || t("goodsReceiptNotice.decidedToastTitle"),
  );
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
    if (tone === "warning") {
      toast.warning([title, description].filter(Boolean).join(" "), { action, duration: 7000 });
    } else if (tone === "message") toast.message(title, options);
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
    decisionCodeId: "",
    reasonCode: "",
    decisionCodeRequiresNote: false,
    reasonNote: "",
    inspectedQuantity: "",
    confirmedInspectedQuantity: "",
    targetLocationId,
    targetWarehouseId,
  };
}

function additionalControlQuantity(line: QualityInspectionLine, inspectedRaw: string): number {
  const requested = inspectedRaw.trim() ? roundQty(parseQty(inspectedRaw)) : null;
  return resolveDecisionControlQuantity(
    requested != null && Number.isFinite(requested) ? requested : null,
    remainingInspectableQuantity(line),
    minimumControlQuantity(line),
  ).additional;
}

function controlQuantityError(
  line: QualityInspectionLine,
  inspectedRaw: string,
  t: TFunction,
): string | null {
  const required = minimumControlQuantity(line);
  const maximum = remainingInspectableQuantity(line);
  const raw = inspectedRaw.trim();
  const requested = raw ? roundQty(parseQty(raw)) : null;
  if (raw && (requested == null || !Number.isFinite(requested) || requested < 0)) {
    return t("errors.controlQuantityMustBePositive", { stockCode: line.stockCode });
  }
  if (requested != null && !Number.isInteger(requested)) {
    return t("errors.controlQuantityMustBeInteger", { stockCode: line.stockCode });
  }
  const resolved = resolveDecisionControlQuantity(requested, maximum, required);
  if (resolved.missingRequired) {
    return t("errors.controlQuantityRequired", { stockCode: line.stockCode });
  }
  if (maximum > QTY_EPS && requested != null && requested - maximum > QTY_EPS) {
    return t("errors.controlQuantityExceedsRemaining", {
      stockCode: line.stockCode,
      inspected: formatProjectNumber(requested),
      remaining: formatProjectNumber(maximum),
    });
  }
  if (maximum > QTY_EPS && required - resolved.additional > QTY_EPS) {
    return t("errors.controlQuantityBelowMinimum", {
      stockCode: line.stockCode,
      inspected: formatProjectNumber(resolved.additional),
      required: formatProjectNumber(required),
    });
  }
  return null;
}

function buildControlQuantityRequest(
  line: QualityInspectionLine,
  draft: LineDraft,
  t: TFunction,
): QualityInspectionControlQuantityRequest {
  const error = controlQuantityError(line, draft.inspectedQuantity, t);
  if (error) throw new Error(error);
  return {
    lineId: line.id,
    inspectedQuantity: additionalControlQuantity(line, draft.inspectedQuantity),
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

function ensureStagedDispositionKey(
  stagedKeys: Record<string, string>,
  slot: string,
): string {
  if (!stagedKeys[slot]) {
    stagedKeys[slot] = crypto.randomUUID();
  }
  return stagedKeys[slot];
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
): MaterializedDraftDispositions {
  if (draft.dispositions?.length) {
    return {
      parts: draft.dispositions,
      stagedDispositionKeys: draft.stagedDispositionKeys ?? {},
    };
  }
  const stagedDispositionKeys = { ...(draft.stagedDispositionKeys ?? {}) };
  const allocation = buildQuantityDecision(line, draft, t);
  const result: DispositionDraft[] = [];
  if (allocation.acceptedQuantity > QTY_EPS) {
    result.push({
      key: ensureStagedDispositionKey(stagedDispositionKeys, "Accepted"),
      decision: "Accepted",
      quantity: String(roundQty(allocation.acceptedQuantity)),
      targetLocationId: draft.decision === "Accepted" ? draft.targetLocationId ?? fallbackAcceptedLocationId : fallbackAcceptedLocationId,
      targetWarehouseId: draft.decision === "Accepted" ? draft.targetWarehouseId ?? null : null,
    });
  }
  if (allocation.quarantineQuantity > QTY_EPS) {
    result.push({
      key: ensureStagedDispositionKey(stagedDispositionKeys, "Quarantined"),
      decision: "Quarantined",
      quantity: String(roundQty(allocation.quarantineQuantity)),
      targetLocationId: draft.decision === "Quarantined" ? draft.targetLocationId ?? fallbackQuarantineLocationId : fallbackQuarantineLocationId,
      targetWarehouseId: draft.decision === "Quarantined" ? draft.targetWarehouseId ?? null : null,
    });
  }
  if (allocation.rejectedQuantity > QTY_EPS) {
    result.push({
      key: ensureStagedDispositionKey(stagedDispositionKeys, "Rejected"),
      decision: "Rejected",
      quantity: String(roundQty(allocation.rejectedQuantity)),
      targetLocationId: draft.decision === "Rejected" ? draft.targetLocationId ?? fallbackRejectedLocationId : fallbackRejectedLocationId,
      targetWarehouseId: draft.decision === "Rejected" ? draft.targetWarehouseId ?? null : null,
    });
  }
  return { parts: result, stagedDispositionKeys };
}

function withMaterializedDispositionKeys(
  line: QualityInspectionLine,
  draft: LineDraft,
  fallbackAcceptedLocationId: number | null,
  fallbackQuarantineLocationId: number | null,
  fallbackRejectedLocationId: number | null,
  t: TFunction,
): LineDraft {
  if (draft.dispositions?.length) return draft;
  const { stagedDispositionKeys } = draftDispositions(
    line,
    draft,
    fallbackAcceptedLocationId,
    fallbackQuarantineLocationId,
    fallbackRejectedLocationId,
    t,
  );
  return { ...draft, stagedDispositionKeys };
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
  const { parts } = draftDispositions(
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
  if (parsed.some((part) => part.decision !== "Accepted") && !Number(draft.decisionCodeId)) {
    throw new Error(t("errors.reasonCodeRequiredAllRows"));
  }
  if (draft.decisionCodeRequiresNote && !draft.reasonNote.trim()) {
    throw new Error(t("errors.reasonNoteRequiredForCode"));
  }
  if (parsed.some((part) => part.decision === "Accepted" && !part.targetLocationId && !fallbackAcceptedLocationId)) {
    throw new Error(t("errors.inspectionWarehouseAcceptedMissing"));
  }
  if (parsed.some((part) => part.decision === "Rejected" && !part.targetLocationId)) {
    throw new Error(t("errors.inspectionWarehouseRejectMissing"));
  }
  if (parsed.some((part) => part.decision === "Quarantined" && !part.targetLocationId)) {
    throw new Error(t("errors.inspectionWarehouseQuarantineMissing"));
  }
  return parsed.map((part) => ({
    lineId: line.id,
    decision: part.decision,
    quantity: part.parsedQuantity,
    targetLocationId: part.targetLocationId,
    decisionCodeId: part.decision === "Accepted" ? undefined : Number(draft.decisionCodeId) || undefined,
    note: draft.reasonNote.trim() || undefined,
    draftDispositionKey: part.key,
  }));
}

async function uploadPendingDispositionImages(
  inspectionId: number,
  requests: QualityInspectionDispositionRequest[],
  images: DispositionDraftImages,
  t: TFunction,
): Promise<void> {
  const seen = new Set<string>();
  for (const request of requests) {
    const dedupeKey = `${request.lineId}:${request.draftDispositionKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const files = images[request.lineId]?.[request.draftDispositionKey] ?? [];
    if (files.length === 0) continue;
    try {
      await qualityApi.uploadInspectionImages(
        inspectionId,
        request.lineId,
        files,
        request.draftDispositionKey,
      );
    } catch (error) {
      throw new Error(message(error, t("linePopover.images.uploadFailed")));
    }
  }
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const DECIDED_LIST_STATUSES = new Set([
  "Passed",
  "Failed",
  "Released",
  "Cancelled",
  "Quarantined",
  "PartiallyDecided",
]);

function isAlreadyAppliedDecisionError(error: unknown): boolean {
  return /kendi kullanıcınızla başlatın|Start the GKK inspection with your own user|Avviare il controllo GKK con il proprio|Démarrez le contrôle GKK avec votre utilisateur|Inicie la inspección GKK con su usuario|Starten Sie die GKK-Prüfung mit Ihrem Benutzer/i
    .test(message(error, ""));
}

function isCommittedDecisionFollowUpError(error: unknown): boolean {
  return /WMS'te tamamlandı|Kalite kararı uygulandı|Netsis REST oturumu|Netsis irsaliyesi oluşturulamadı/i
    .test(message(error, ""));
}

function resolveDecidedListStatus(status?: string): string {
  if (status && DECIDED_LIST_STATUSES.has(status)) return status;
  return "Passed";
}

function removeInspectionFromGridCache(
  queryClient: QueryClient,
  pageKey: string,
  inspectionId: number,
): void {
  queryClient.setQueriesData({ queryKey: ["advanced-grid", pageKey] }, (current) => {
    if (!current || typeof current !== "object") return current;
    const page = current as { items?: QualityInspection[]; totalCount?: number };
    if (!Array.isArray(page.items) || !page.items.some((row) => row.id === inspectionId)) {
      return current;
    }
    return {
      ...page,
      items: page.items.filter((row) => row.id !== inspectionId),
      totalCount: Math.max(0, (page.totalCount ?? page.items.length) - 1),
    };
  });
}

async function waitUntilActiveGridSettled(
  queryClient: QueryClient,
  pageKey: string,
): Promise<void> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const queries = queryClient.getQueryCache().findAll({
      queryKey: ["advanced-grid", pageKey],
      type: "active",
    });
    if (
      queries.length > 0
      && queries.every((query) => query.state.fetchStatus === "idle" && query.state.status !== "pending")
    ) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
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
  const [editId, setEditId] = useState<number | null>(null);
  const [editDetail, setEditDetail] = useState<QualityInspectionDetail | null>(null);
  const [editLoading, setEditLoading] = useState<number | null>(null);
  const [priorityLoading, setPriorityLoading] = useState<number | null>(null);
  const [priorityReorderLoading, setPriorityReorderLoading] = useState<number | null>(null);
  const [gridSortBy, setGridSortBy] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [createdPeriod, setCreatedPeriod] = useState<QualityInspectionCreatedPeriod | null>("month");
  const [createdPeriodAnchor, setCreatedPeriodAnchor] = useState(() => new Date());
  const [listEpoch, setListEpoch] = useState(0);
  const [decisionFlow, setDecisionFlow] = useState<QualityDecisionFlow | null>(null);
  const listMovePendingRef = useRef(false);
  const lineDecisionGuardRef = useRef({ open: false, suppressInspectClose: false });
  const closeLineDecisionRef = useRef<() => void>(() => {});
  const handleDecisionFlowChange = useCallback((flow: QualityDecisionFlow | null) => {
    if (flow === null && listMovePendingRef.current) return;
    setDecisionFlow(flow);
  }, []);
  const statusFacet = selectedStatus ?? statusCatalogQuery.data?.defaultValue ?? "";
  const canPrioritizeInspections = can("WMS.QUALITY.INSPECTIONS.PRIORITIZE");
  const singleStatusFacet =
    quarantineOnly || (statusFacet !== QUALITY_INSPECTION_STATUS_ALL && statusFacet.trim().length > 0);
  const pageKey = quarantineOnly ? "quality-quarantine-v2" : "quality-inspections-v2";
  const prioritizableStatuses = useMemo(
    () => new Set(statusCatalogQuery.data?.items.filter((item) => item.canPrioritize).map((item) => item.value) ?? []),
    [statusCatalogQuery.data?.items],
  );
  const priorityDragEnabled = canPrioritizeInspections && singleStatusFacet && gridSortBy === null;
  const reorderInspectionPriority = useCallback(
    async (active: QualityInspection, over: QualityInspection) => {
      if (priorityReorderLoading !== null || over.priorityRank == null) return;
      setPriorityReorderLoading(active.id);
      try {
        await qualityApi.reorderPriority(active.id, over.priorityRank);
        await queryClient.invalidateQueries({ queryKey: ["advanced-grid", pageKey] });
        toast.success(t("list.priority.reordered"));
      } catch (error) {
        toast.error(message(error, t("list.priority.reorderFailed")));
      } finally {
        setPriorityReorderLoading(null);
      }
    },
    [pageKey, priorityReorderLoading, queryClient, t],
  );
  const fetchPage = useCallback(
    (request: GridRequest) =>
      qualityApi.inspectionsPaged(
        {
          ...request,
          filterLogic: "and",
          filters: mergeQualityInspectionStatusFilters(
            request.filters,
            quarantineOnly ? "Quarantined" : statusFacet,
            createdPeriod,
            createdPeriodAnchor,
          ),
        },
      ),
    [createdPeriod, createdPeriodAnchor, quarantineOnly, statusFacet],
  );
  const toggleInspectionPriority = useCallback(
    async (inspection: QualityInspection) => {
      if (priorityLoading !== null) return;
      setPriorityLoading(inspection.id);
      try {
        const result = await qualityApi.togglePriority(inspection.id);
        const patchPriority = (current: QualityInspectionDetail | null) =>
          current?.header.id === inspection.id
            ? { ...current, header: { ...current.header, isPriority: result.isPriority } }
            : current;
        setEditDetail(patchPriority);
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
  const handleInspectOutside = useCallback((event: {
    preventDefault: () => void;
    target: EventTarget | null;
    detail?: { originalEvent?: Event };
  }) => {
    preventDialogDismissIfImageLightbox(event);
    const target = event.detail?.originalEvent?.target ?? event.target;
    if (target instanceof Element && target.closest(QUALITY_INSPECT_FLOATING_LAYER)) {
      event.preventDefault();
      return;
    }
    if (lineDecisionGuardRef.current.open || lineDecisionGuardRef.current.suppressInspectClose) {
      event.preventDefault();
      lineDecisionGuardRef.current.open = false;
      lineDecisionGuardRef.current.suppressInspectClose = false;
      closeLineDecisionRef.current();
    }
  }, []);
  const closeEditPanel = useCallback(() => {
    lineDecisionGuardRef.current.open = false;
    lineDecisionGuardRef.current.suppressInspectClose = false;
    setEditId(null);
    setEditDetail(null);
  }, []);
  const openEdit = useCallback(
    async (id: number) => {
      if (editId === id && editDetail?.header.id === id) return;
      setEditId(id);
      if (editDetail?.header.id === id) return;
      setEditLoading(id);
      try {
        setEditDetail(await qualityApi.inspection(id));
      } catch (error) {
        setEditId(null);
        toast.error(message(error, t("list.detailFetchFailed")));
      } finally {
        setEditLoading(null);
      }
    },
    [editDetail, editId, t],
  );
  const refreshDetail = useCallback(async (id: number) => {
    const next = await qualityApi.inspection(id);
    setEditDetail((current) => current?.header.id === id ? next : current);
    await queryClient.invalidateQueries({ queryKey: ["advanced-grid", pageKey] });
  }, [pageKey, queryClient]);
  const syncWorkSummary = useCallback((inspectionId: number, work: QualityInspectionWorkSummary) => {
    setEditDetail((current) =>
      current?.header.id === inspectionId ? { ...current, work } : current,
    );
  }, []);
  const columns = useMemo<GridColumn<QualityInspection>[]>(
    () => {
      void moduleReady;
      return [
      {
        key: "inspectionNo",
        label: t("list.columns.inspectionNo"),
        width: 252,
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) => {
          const showPriorityGrip =
            priorityDragEnabled
            && r.isPriority
            && r.priorityRank != null
            && canToggleQualityInspectionPriority(r.status, prioritizableStatuses);
          return (
          <div className="inline-flex items-center gap-1">
            {showPriorityGrip ? (
              <GridRowReorderGrip label={t("list.priority.dragHandle")} />
            ) : null}
            {r.isPriority ? (
              <span
                className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-300"
                aria-label={
                  r.priorityRank != null
                    ? t("list.priority.badgeRank", { rank: r.priorityRank })
                    : t("list.priority.badge")
                }
              >
                <Flag className="size-3.5 fill-rose-500 text-rose-600" />
                {r.priorityRank != null ? (
                  <span className="min-w-3 text-[11px] font-bold leading-none tabular-nums">{r.priorityRank}</span>
                ) : null}
              </span>
            ) : null}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void openEdit(r.id);
              }}
              className="font-mono font-semibold text-cyan-600 hover:underline dark:text-cyan-300"
              aria-label={t("list.editAria")}
              title={t("list.edit")}
            >
              {r.inspectionNo}
            </button>
          </div>
          );
        },
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
        key: "projectCodes",
        label: t("list.columns.projectCode"),
        sortable: false,
        filterable: false,
        searchable: false,
        render: (r) =>
          r.projectCodes ? (
            <span className="font-mono text-xs font-semibold">{r.projectCodes}</span>
          ) : (
            "—"
          ),
        contextValue: (r) => r.projectCodes ?? undefined,
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
        label: t("list.columns.createdBy"),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) =>
          r.createdByName || t("list.unknownUser", { id: r.createdBy ?? "—" }),
      },
      {
        key: "workStartedByName",
        label: t("list.columns.workOperator"),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (r) =>
          formatQualityWorkOperatorName(r.workStartedByName, r.workStoppedByName) || "—",
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
              {localizeQualityInspectionStatus(r.status, t)}
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
            {r.workSessionCount > 0 && !r.activeWorkerName ? (
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
        width: 220,
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
            onClick={(event) => {
              event.stopPropagation();
              void openEdit(r.id);
            }}
            disabled={editLoading === r.id}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-300"
            aria-label={t("list.editAria")}
            title={t("list.edit")}
          >
            {editLoading === r.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            <span className="text-xs font-semibold">{t("list.edit")}</span>
          </button>
          </div>
        ),
      },
    ];
    },
    [can, editLoading, moduleReady, openEdit, prioritizableStatuses, priorityDragEnabled, priorityLoading, priorityReorderLoading, t, toggleInspectionPriority],
  );
  const moveInspectionToListStatus = useCallback(async (
    targetStatus: string,
    inspectionId?: number,
  ) => {
    listMovePendingRef.current = true;
    try {
      flushSync(() => {
        if (inspectionId != null) {
          removeInspectionFromGridCache(queryClient, pageKey, inspectionId);
        }
        if (!quarantineOnly) {
          setSelectedStatus(targetStatus);
        }
        setEditId(null);
        setEditDetail(null);
        setListEpoch((current) => current + 1);
      });
      try {
        await queryClient.refetchQueries({
          queryKey: ["advanced-grid", pageKey],
          type: "active",
        });
        await waitUntilActiveGridSettled(queryClient, pageKey);
      } catch {
        // Destination tab should stay even if refresh fails.
      }
    } finally {
      listMovePendingRef.current = false;
    }
  }, [pageKey, queryClient, quarantineOnly]);
  const decided = async (nextStatus?: string, inspectionId?: number) => {
    await moveInspectionToListStatus(resolveDecidedListStatus(nextStatus), inspectionId);
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
    <>
    <AdvancedDataGrid<QualityInspection>
      pageKey={pageKey}
      refreshKey={quarantineOnly ? listEpoch : `${statusFacet}:${createdPeriod ?? "all"}:${createdPeriodAnchor.getTime()}:${listEpoch}`}
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
      aboveToolbarExtra={
        quarantineOnly ? undefined : (
          <QualityInspectionStatusFilter
            value={statusFacet}
            statusOptions={statusCatalogQuery.data?.items ?? []}
            onChange={setSelectedStatus}
          />
        )
      }
      toolbarBelowExtra={
        quarantineOnly ? undefined : (
          <QualityInspectionCreatedPeriodTabs
            value={createdPeriod}
            onChange={setCreatedPeriod}
            anchor={createdPeriodAnchor}
            onAnchorChange={setCreatedPeriodAnchor}
          />
        )
      }
      onRowDoubleClick={(row) => void openEdit(row.id)}
      rowClassName={(row) => qualityInspectionPriorityRowClass(row.isPriority)}
      onSortStateChange={setGridSortBy}
      rowReorder={
        priorityDragEnabled
          ? {
              label: t("list.priority.dragHandle"),
              disabled: priorityReorderLoading !== null,
              canDragRow: (row) =>
                row.isPriority
                && row.priorityRank != null
                && canToggleQualityInspectionPriority(row.status, prioritizableStatuses),
              onReorder: reorderInspectionPriority,
            }
          : undefined
      }
    />
    {editId != null && typeof document !== "undefined"
      ? createPortal(
          <div
            aria-hidden
            className="pointer-events-auto fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
          />,
          document.body,
        )
      : null}
    <Dialog
      modal={false}
      open={editId != null}
      onOpenChange={(open) => {
        if (!open && shouldIgnoreDialogClose()) return;
        if (!open) closeEditPanel();
      }}
    >
      <DialogContent
        portalRoot="body"
        tone="ops"
        aria-describedby={undefined}
        showCloseButton
        onPointerDownOutside={handleInspectOutside}
        onInteractOutside={handleInspectOutside}
        onFocusOutside={handleInspectOutside}
        onEscapeKeyDown={(event) => {
          preventDialogEscapeIfImageLightbox(event);
          if (lineDecisionGuardRef.current.open) {
            event.preventDefault();
            lineDecisionGuardRef.current.open = false;
            closeLineDecisionRef.current();
          }
        }}
        className={cn(
          "wms-ops-detail-dialog wms-ops-form flex !h-auto max-h-[95dvh] w-[calc(100%-1rem)] !max-w-[min(96vw,92rem)] flex-col gap-0 overflow-hidden border-0 p-0 shadow-none sm:w-[calc(100%-2rem)]",
        )}
      >
        <header className="wms-ops-detail-dialog__header shrink-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
            {t("list.editEyebrow")}
          </p>
          <DialogTitle className="wms-ops-detail-dialog__title">
            {t("list.editTitle")}
            {editDetail?.header.inspectionNo ? (
              <span className="ml-2 font-mono text-base font-bold text-cyan-600 dark:text-cyan-300">
                {editDetail.header.inspectionNo}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="wms-ops-detail-dialog__description">
            {t("list.editDescription")}
          </DialogDescription>
        </header>
        <div className="wms-ops-dialog__body wms-ops-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4">
          {editDetail && editDetail.header.id === editId ? (
            <InspectionDetailPanel
              detail={editDetail}
              refresh={() => refreshDetail(editDetail.header.id)}
              decided={decided}
              moveToListStatus={moveInspectionToListStatus}
              applyBlocked={decisionFlow?.phase === "running"}
              onWorkSummaryChange={syncWorkSummary}
              onDecisionFlowChange={handleDecisionFlowChange}
              lineDecisionGuardRef={lineDecisionGuardRef}
              closeLineDecisionRef={closeLineDecisionRef}
            />
          ) : (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> {t("list.detailLoading")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    {decisionFlow && typeof document !== "undefined"
      ? createPortal(
          <QualityDecisionFlowOverlay>
            {decisionFlow.phase === "success" ? (
              <QualityReceiptCreatedSuccessPanel
                result={decisionFlow.result}
                lineCount={decisionFlow.lineCount}
                sourceLabel={decisionFlow.sourceLabel}
                onDone={() => setDecisionFlow(null)}
              />
            ) : (
              <QualityApproveSubmitScreen
                phase={decisionFlow.phase}
                errorMessage={
                  decisionFlow.phase === "error"
                    ? decisionFlow.message
                    : undefined
                }
                lineCount={decisionFlow.lineCount}
                documentNo={decisionFlow.sourceLabel}
                sourceLabel={decisionFlow.sourceLabel}
              />
            )}
          </QualityDecisionFlowOverlay>,
          document.body,
        )
      : null}
    </>
  );
}

function InspectionDetailPanel({
  detail,
  refresh,
  decided,
  moveToListStatus,
  applyBlocked = false,
  onWorkSummaryChange,
  onDecisionFlowChange,
  lineDecisionGuardRef,
  closeLineDecisionRef,
}: {
  detail: QualityInspectionDetail;
  refresh: () => Promise<void>;
  decided: (nextStatus?: string, inspectionId?: number) => void | Promise<void>;
  moveToListStatus: (targetStatus: string, inspectionId?: number) => void | Promise<void>;
  applyBlocked?: boolean;
  onWorkSummaryChange: (inspectionId: number, work: QualityInspectionWorkSummary) => void;
  onDecisionFlowChange: (flow: QualityDecisionFlow | null) => void;
  lineDecisionGuardRef: MutableRefObject<{ open: boolean; suppressInspectClose: boolean }>;
  closeLineDecisionRef: MutableRefObject<() => void>;
}): ReactElement {
  const { t } = useModuleTranslation("quality");
  const { can } = usePermissionAccess();
  const navigate = useNavigate();
  const controlQtyCacheUserId = useAuthStore((state) => state.user?.id ?? 0);
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
    ?? null;
  const configuredDefaultQuarantineLocationId = configuredDefaultQuarantineDestination?.locationId ?? null;
  const configuredDefaultQuarantineWarehouseId = configuredDefaultQuarantineDestination?.warehouseId ?? null;

  const [selected, setSelected] = useState<number[]>(() =>
    actionable.map((line) => line.id),
  );
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>(() => {
    const initial = Object.fromEntries(
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
    );
    return applyQualityControlQuantityCache(
      initial,
      actionable.map((line) => ({
        id: line.id,
        inspectedQuantity: line.inspectedQuantity,
        remainingInspectable: remainingInspectableQuantity(line),
      })),
      readQualityControlQuantityCache(
        useAuthStore.getState().user?.id ?? 0,
        detail.header.id,
      ),
      (value) => roundQty(parseQty(value)),
    );
  });
  const [dispositionDraftImages, setDispositionDraftImages] = useState<DispositionDraftImages>({});
  const skipControlQtyCacheWriteRef = useRef(false);
  const didRestoreControlQtyCacheRef = useRef(false);
  useEffect(() => {
    if (didRestoreControlQtyCacheRef.current || controlQtyCacheUserId <= 0) return;
    didRestoreControlQtyCacheRef.current = true;
    setDrafts((current) =>
      applyQualityControlQuantityCache(
        current,
        actionable.map((line) => ({
          id: line.id,
          inspectedQuantity: line.inspectedQuantity,
          remainingInspectable: remainingInspectableQuantity(line),
        })),
        readQualityControlQuantityCache(controlQtyCacheUserId, detail.header.id),
        (value) => roundQty(parseQty(value)),
      ),
    );
  }, [actionable, controlQtyCacheUserId, detail.header.id]);
  useEffect(() => {
    if (skipControlQtyCacheWriteRef.current || controlQtyCacheUserId <= 0) return;
    writeQualityControlQuantityCache(
      controlQtyCacheUserId,
      detail.header.id,
      extractQualityControlQuantityCache(drafts, actionable),
    );
  }, [actionable, controlQtyCacheUserId, detail.header.id, drafts]);
  const [bulkDecision, setBulkDecision] = useState(defaultDecision);
  const [bulkQuantity, setBulkQuantity] = useState("");
  const [bulkRemainderDecision, setBulkRemainderDecision] =
    useState(defaultRemainder);
  const [bulkDecisionCodeId, setBulkDecisionCodeId] = useState("");
  const [bulkReasonCode, setBulkReasonCode] = useState("");
  const [bulkDecisionCodeRequiresNote, setBulkDecisionCodeRequiresNote] = useState(false);
  const [bulkReasonNote, setBulkReasonNote] = useState("");
  const [headerNote, setHeaderNote] = useState(detail.note ?? "");
  const [saving, setSaving] = useState(false);
  const [saveLocked, setSaveLocked] = useState(false);
  const saveLockRef = useRef(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [openLineId, setOpenLineId] = useState<number | null>(null);
  const closeLineDecision = useCallback(() => {
    lineDecisionGuardRef.current.open = false;
    setOpenLineId(null);
  }, [lineDecisionGuardRef]);
  useEffect(() => {
    closeLineDecisionRef.current = closeLineDecision;
    lineDecisionGuardRef.current.open = openLineId != null;
    return () => {
      lineDecisionGuardRef.current.open = false;
    };
  }, [closeLineDecision, closeLineDecisionRef, lineDecisionGuardRef, openLineId]);
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
      const workSummary = await qualityApi.startInspectionWork(detail.header.id, {
        idempotencyKey: crypto.randomUUID(),
        rowVersion: detail.rowVersion,
      });
      onWorkSummaryChange(detail.header.id, workSummary);
      if (detail.header.status === "Pending") {
        await moveToListStatus("InProgress", detail.header.id);
      } else {
        await refresh();
      }
      toast.success(t(detail.work.state === "Paused" ? "detail.work.resumed" : "detail.work.started"));
    } catch (error) {
      toast.error(message(error, t("detail.work.startFailed")));
    } finally {
      setWorkBusy(null);
    }
  };

  const pauseWork = async () => {
    if (workBusy || !detail.work.canPause) return;
    const progressLines = groupQualityLines(actionable).map((group) => group.primary);
    let controlQuantities: QualityInspectionControlQuantityRequest[] = [];
    try {
      controlQuantities = collectQualityProgressControlQuantities(
        progressLines,
        drafts,
        (value) => roundQty(parseQty(value)),
      );
      for (const request of controlQuantities) {
        const line = progressLines.find((item) => item.id === request.lineId);
        if (!line) continue;
        const remaining = remainingInspectableQuantity(line);
        if (request.inspectedQuantity - remaining > QTY_EPS) {
          toast.error(t("errors.controlQuantityExceedsRemaining", {
            stockCode: line.stockCode,
            inspected: formatProjectNumber(request.inspectedQuantity),
            remaining: formatProjectNumber(remaining),
          }));
          return;
        }
      }
    } catch (error) {
      toast.error(message(error, t("errors.controlQuantityInvalid")));
      return;
    }
    setWorkBusy("pause");
    try {
      const workSummary = await qualityApi.pauseInspectionWork(detail.header.id, {
        idempotencyKey: crypto.randomUUID(),
        reason: pauseReason,
        note: pauseNote.trim() || null,
        rowVersion: detail.rowVersion,
        controlQuantities,
      });
      onWorkSummaryChange(detail.header.id, workSummary);
      skipControlQtyCacheWriteRef.current = true;
      clearQualityControlQuantityCache(controlQtyCacheUserId, detail.header.id);
      setPauseDialogOpen(false);
      setPauseNote("");
      if (detail.header.status === "InProgress") {
        await moveToListStatus("Pending", detail.header.id);
      } else {
        await refresh();
      }
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

  const setLineDispositionImages = (lineId: number, key: string, files: File[]) =>
    setDispositionDraftImages((current) => {
      const next = { ...current };
      const lineBucket = { ...(next[lineId] ?? {}) };
      if (files.length === 0) {
        delete lineBucket[key];
      } else {
        lineBucket[key] = files;
      }
      if (Object.keys(lineBucket).length === 0) delete next[lineId];
      else next[lineId] = lineBucket;
      return next;
    });

  const removeLineDispositionImages = (lineId: number, key: string) =>
    setDispositionDraftImages((current) => {
      const lineBucket = { ...(current[lineId] ?? {}) };
      delete lineBucket[key];
      const next = { ...current };
      if (Object.keys(lineBucket).length === 0) delete next[lineId];
      else next[lineId] = lineBucket;
      return next;
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
    if (bulkDecision !== "Accepted" && !Number(bulkDecisionCodeId)) {
      toast.error(t("errors.bulkReasonCodeRequired"));
      return;
    }
    if (bulkDecisionCodeRequiresNote && !bulkReasonNote.trim()) {
      toast.error(t("errors.reasonNoteRequiredForCode"));
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
          decisionCodeId: bulkDecision === "Accepted" ? "" : bulkDecisionCodeId,
          reasonCode: bulkDecision === "Accepted" ? "" : bulkReasonCode.trim(),
          decisionCodeRequiresNote: bulkDecision === "Accepted" ? false : bulkDecisionCodeRequiresNote,
          reasonNote: bulkReasonNote.trim(),
          inspectedQuantity: "",
          confirmedInspectedQuantity: "",
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
      if (needsReason && !Number(draft.decisionCodeId)) {
        toast.error(t("errors.reasonCodeRequiredAllRows"));
        return false;
      }
      if (draft.decisionCodeRequiresNote && !draft.reasonNote.trim()) {
        toast.error(t("errors.reasonNoteRequiredForCode"));
        return false;
      }
    }

    const resolvedPending = pending.map(({ line, draft }) => {
      const lineAcceptedDestination = acceptedDestinationForLine(
        line,
        detail.defaultAcceptedDestination,
      );
      return {
        line,
        draft: withMaterializedDispositionKeys(
          line,
          draft,
          lineAcceptedDestination?.locationId ?? null,
          configuredDefaultQuarantineLocationId,
          defaultRejectedLocationId,
          t,
        ),
      };
    });

    const returnedRows = resolvedPending.filter(
      (row) => !row.draft.dispositions?.length && row.draft.decision === "Returned",
    );
    const distributionRows = resolvedPending.filter(
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

    if (saveLockRef.current) return false;
    saveLockRef.current = true;
    setSaveLocked(true);
    setApplyConfirmOpen(false);
    setSaving(true);
    const sourceLabel =
      detail.header.sourceWaybillNo?.trim() ||
      detail.header.sourceDocumentNo?.trim() ||
      undefined;
    onDecisionFlowChange({
      phase: "running",
      lineCount: pending.length,
      sourceLabel,
    });
    try {
      if (dispositionRequests.length > 0) {
        await uploadPendingDispositionImages(
          detail.header.id,
          dispositionRequests,
          dispositionDraftImages,
          t,
        );
      }

      let rowVersion = detail.rowVersion;
      const calls: Array<() => ReturnType<typeof qualityApi.decide>> = [];
      let completionMessage = "";
      let receiptCreatedNow = false;
      let lastResult: QualityDecisionResult | null = null;

      if (dispositionRequests.length > 0) {
        const notes = distributionRows
          .map(({ draft }) => draft.reasonNote.trim())
          .filter(Boolean);
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
        { decisionCodeId: number; lineIds: number[]; notes: string[] }
      >();
      for (const { line, draft } of returnedRows) {
        const decisionCodeId = Number(draft.decisionCodeId);
        const key = String(decisionCodeId);
        const existing = returnedGroups.get(key);
        if (existing) {
          existing.lineIds.push(line.id);
          if (draft.reasonNote.trim()) existing.notes.push(draft.reasonNote.trim());
        } else {
          returnedGroups.set(key, {
            decisionCodeId,
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
            decisionCodeId: group.decisionCodeId,
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

      let nextStatus = "Passed";
      try {
        const fresh = await qualityApi.inspection(detail.header.id);
        if (fresh.header.status) nextStatus = fresh.header.status;
      } catch {
        // Keep the accepted-path default so the row still leaves the open tab.
      }

      const inspectionId = detail.header.id;
      skipControlQtyCacheWriteRef.current = true;
      clearQualityControlQuantityCache(controlQtyCacheUserId, inspectionId);
      setDispositionDraftImages((current) => {
        const next = { ...current };
        for (const { line } of pending) {
          delete next[line.id];
        }
        return next;
      });
      await decided(nextStatus, inspectionId);

      if (receiptCreatedNow && lastResult) {
        onDecisionFlowChange({
          phase: "success",
          result: lastResult,
          lineCount: pending.length,
          sourceLabel,
        });
        setSaving(false);
        return true;
      }

      onDecisionFlowChange(null);
      setSaving(false);
      await notifyGoodsReceiptAfterDecision(
        detail,
        () => navigate("/warehouse/goods-receipts/list"),
        t,
        completionMessage || t("decisionSaved"),
      );
      return true;
    } catch (error) {
      let committedStatus: string | null = null;
      try {
        const fresh = await qualityApi.inspection(detail.header.id);
        if (DECIDED_LIST_STATUSES.has(fresh.header.status)) {
          committedStatus = fresh.header.status;
        }
      } catch {
        if (isAlreadyAppliedDecisionError(error) || isCommittedDecisionFollowUpError(error)) {
          committedStatus = "Passed";
        }
      }
      if (committedStatus || isAlreadyAppliedDecisionError(error) || isCommittedDecisionFollowUpError(error)) {
        skipControlQtyCacheWriteRef.current = true;
        clearQualityControlQuantityCache(controlQtyCacheUserId, detail.header.id);
        await decided(committedStatus ?? "Passed", detail.header.id);
        if (isCommittedDecisionFollowUpError(error) && !isAlreadyAppliedDecisionError(error)) {
          toast.error(collapseRepeatedMessageSegments(message(error, t("errors.decisionSaveFailed"))));
        }
        onDecisionFlowChange(null);
        setSaving(false);
        return true;
      }
      const errorMessage = collapseRepeatedMessageSegments(message(error, t("errors.decisionSaveFailed")));
      toast.error(errorMessage);
      onDecisionFlowChange({
        phase: "error",
        message: errorMessage,
        lineCount: pending.length,
        sourceLabel,
      });
      await new Promise((resolve) => window.setTimeout(resolve, 2600));
      onDecisionFlowChange(null);
      return false;
    } finally {
      setSaving(false);
      saveLockRef.current = false;
      setSaveLocked(false);
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
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight font-mono">
              {detail.header.sourceWaybillNo?.trim() || "—"}
            </h3>
            <OpsStatusBadge
              tone={inferOpsStatusTone(detail.header.status)}
              className="wms-ops-quality-detail__badge"
            >
              {localizeQualityInspectionStatus(detail.header.status, t)}
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
            label={t("detail.meta.createdBy")}
            value={
              detail.header.createdByName ||
              t("list.unknownUser", { id: detail.header.createdBy ?? "—" })
            }
          />
          <MetaChip
            label={t("detail.meta.workOperator")}
            value={
              formatQualityWorkOperatorName(
                detail.header.workStartedByName,
                detail.header.workStoppedByName,
              ) || "—"
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
                portalContainer={null}
                contentClassName="!z-[6100]"
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
                      setBulkDecisionCodeId("");
                      setBulkReasonCode("");
                      setBulkDecisionCodeRequiresNote(false);
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
                  <PagedAppDropdown
                    queryKey={["quality-decision-code-bulk", detail.header.branchCode, bulkDecision]}
                    fetchPage={(request) => qualityApi.decisionCodeOptions(request, detail.header.branchCode, bulkDecision || "Accepted")}
                    toOption={(item) => ({
                      value: String(item.id),
                      label: `${item.code} · ${item.name}`,
                      description: item.requiresNote ? t("detail.bulk.reasonNoteRequired") : undefined,
                      meta: item,
                    })}
                    value={bulkDecisionCodeId || null}
                    selectedOption={bulkDecisionCodeId && bulkReasonCode ? {
                      value: bulkDecisionCodeId,
                      label: bulkReasonCode,
                    } : undefined}
                    onValueChange={(value) => {
                      setBulkDecisionCodeId(value);
                    }}
                    onOptionChange={(option) => {
                      const item = option?.meta as { code?: string; name?: string; requiresNote?: boolean } | undefined;
                      setBulkReasonCode(item?.code && item?.name ? `${item.code} · ${item.name}` : "");
                      setBulkDecisionCodeRequiresNote(Boolean(item?.requiresNote));
                    }}
                    placeholder={t("detail.bulk.reasonCodePlaceholder")}
                    className="wms-ops-quality-field wms-ops-quality-bulk__control"
                    searchFields={["code", "name"]}
                    enabled={Boolean(bulkDecision)}
                    portalContainer={null}
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

      <div className="wms-ops-quality-lines !overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
        <table className="w-full border-collapse text-sm">
          <colgroup>
            <col className="wms-ops-quality-lines__col--photo" />
            <col className="wms-ops-quality-lines__col--stock" />
            <col className="wms-ops-quality-lines__col--project" />
            <col className="wms-ops-quality-lines__col--order" />
            <col className="wms-ops-quality-lines__col--lot" />
            <col className="wms-ops-quality-lines__col--qty" />
            <col className="wms-ops-quality-lines__col--inspected" />
            <col className="wms-ops-quality-lines__col--status" />
            <col className="wms-ops-quality-lines__col--decision" />
            <col className="wms-ops-quality-lines__col--actions" />
          </colgroup>
          <thead>
            <tr className="bg-[color-mix(in_oklab,var(--wms-brand-primary)_8%,transparent)] text-center">
              <th className="wms-ops-quality-lines__cell p-2.5">
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
              <th className="wms-ops-quality-lines__cell wms-ops-quality-lines__cell--stock p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.stock")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.projectCode")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.orderNo")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.lotSerial")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-center text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.quantityRemaining")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-center text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.inspected")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.status")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-[0.65rem] font-semibold uppercase tracking-wider">
                {t("detail.table.decision")}
              </th>
              <th className="wms-ops-quality-lines__cell p-2.5 text-center text-[0.65rem] font-semibold uppercase tracking-wider">
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
              const inspectedQty = roundQty(
                sumInspectedQuantity(group.lines) + draftInspectedThisDecision(draft),
              );
              const projectCodes = joinGroupedCodes(group.lines, (item) => item.projectCodes);
              const orderNumbers = joinGroupedCodes(group.lines, (item) => item.orderNumbers);

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
                      <span className="inline-block size-9" aria-hidden />
                    )}
                  </td>
                  <td className="wms-ops-quality-lines__cell wms-ops-quality-lines__cell--stock p-2.5 align-middle">
                    <strong className="block text-[0.8125rem] leading-tight">
                      {line.stockCode}
                    </strong>
                    <span className="block truncate text-xs text-slate-500">
                      {line.stockName}
                    </span>
                  </td>
                  <td
                    className="wms-ops-quality-lines__cell p-2.5 align-middle font-mono text-xs"
                    title={projectCodes === "—" ? undefined : projectCodes}
                  >
                    {projectCodes}
                  </td>
                  <td
                    className="wms-ops-quality-lines__cell p-2.5 align-middle font-mono text-xs"
                    title={orderNumbers === "—" ? undefined : orderNumbers}
                  >
                    {orderNumbers}
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle font-mono text-xs">
                    <LotSerialHoverCell lines={group.lines} />
                  </td>
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle text-center font-mono">
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
                  <td className="wms-ops-quality-lines__cell p-2.5 align-middle text-center font-mono">
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
                        <div className="flex flex-col items-center space-y-1">
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
                        disabled={!detail.work.canPause}
                        open={openLineId === line.id}
                        onOpenChange={(open) => {
                          lineDecisionGuardRef.current.open = open;
                          setOpenLineId(open ? line.id : null);
                        }}
                        onDismissedByOutside={() => {
                          lineDecisionGuardRef.current.suppressInspectClose = true;
                          window.setTimeout(() => {
                            lineDecisionGuardRef.current.suppressInspectClose = false;
                          }, 0);
                        }}
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
                        dispositionDraftImages={dispositionDraftImages[line.id] ?? {}}
                        onDispositionDraftImagesChange={(key, files) =>
                          setLineDispositionImages(line.id, key, files)}
                        onRemoveDispositionDraftImages={(key) =>
                          removeLineDispositionImages(line.id, key)}
                        canViewImages={can("WMS.QUALITY.INSPECTIONS.IMAGES.VIEW")}
                        canUploadImages={can("WMS.QUALITY.INSPECTIONS.IMAGES.UPLOAD")}
                        canDeleteImages={can("WMS.QUALITY.INSPECTIONS.IMAGES.DELETE")}
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
                  <QualityDispositionHistoryImages images={part.images ?? []} />
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
            disabled={saving || saveLocked || applyBlocked || !canApplyDecision}
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
          if (saving || saveLocked || applyBlocked) return;
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
              disabled={saving || saveLocked || applyBlocked}
              onClick={() => setApplyConfirmOpen(false)}
            >
              {t("applyConfirm.cancel")}
            </OpsActionButton>
            <OpsActionButton
              type="button"
              disabled={saving
                || saveLocked
                || applyBlocked
                || !canApplyDecision
                || requiresDatTransfer && !Number(warehouseTransferDocumentSeriesId)}
              className="wms-ops-quality-decide-btn"
              onClick={() => save()}
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
  const expiryDates = [
    ...new Set(
      lines
        .map((line) => line.expiryDate?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const lotLabel = lots.length === 1 ? lots[0]! : lots.length > 1 ? t("detail.table.multipleLots", { count: lots.length }) : "—";
  const serialLabel =
    serials.length > 1
      ? t("detail.table.serialCount", { count: serials.length })
      : serials[0] || "—";
  const expiryLabel =
    expiryDates.length === 1
      ? formatProjectDate(expiryDates[0]!)
      : expiryDates.length > 1
        ? t("detail.table.multipleExpiry", { count: expiryDates.length })
        : "—";
  const summary = `${lotLabel} / ${serialLabel} / ${expiryLabel}`;

  if (serials.length <= 1 && lots.length <= 1 && expiryDates.length <= 1) {
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
              const expiry = line.expiryDate?.trim();
              if (!serial && !lot && !expiry) return null;
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
                  <span className="wms-ops-quality-lot-serial-tooltip__sep" aria-hidden>
                    /
                  </span>
                  <span className="wms-ops-quality-lot-serial-tooltip__expiry">
                    {expiry ? formatProjectDate(expiry) : "—"}
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
  disabled = false,
  open,
  onOpenChange,
  onDismissedByOutside,
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
  dispositionDraftImages,
  onDispositionDraftImagesChange,
  onRemoveDispositionDraftImages,
  canViewImages,
  canUploadImages,
  canDeleteImages,
}: {
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismissedByOutside?: () => void;
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
  dispositionDraftImages: Record<string, File[]>;
  onDispositionDraftImagesChange: (key: string, files: File[]) => void;
  onRemoveDispositionDraftImages: (key: string) => void;
  canViewImages: boolean;
  canUploadImages: boolean;
  canDeleteImages: boolean;
}): ReactElement {
  const { t } = useModuleTranslation("quality");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const controlSectionRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; maxHeight: number } | null>(
    null,
  );
  const [controlError, setControlError] = useState<string | null>(null);
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
  const decisionCodeFilter = advancedDispositions.find((part) => part.decision !== "Accepted")?.decision
    ?? (draft.decision !== "Accepted" ? draft.decision : hasRemainder && draft.remainderDecision !== "Accepted"
      ? draft.remainderDecision
      : draft.decision || "Accepted");
  const allocatedQuantity = roundQty(
    advancedDispositions.reduce((sum, part) => {
      const quantity = parseQty(part.quantity);
      return sum + (Number.isFinite(quantity) ? quantity : 0);
    }, 0),
  );
  const unallocatedQuantity = roundQty(Math.max(0, remaining - allocatedQuantity));
  const materializedDispositions = (() => {
    if (!draft.decision && advancedDispositions.length === 0) {
      return { parts: [] as DispositionDraft[], stagedDispositionKeys: {} as Record<string, string> };
    }
    try {
      return draftDispositions(
        line,
        draft,
        defaultAcceptedLocationId,
        fallbackQuarantineLocationId,
        defaultRejectedLocationId,
        t,
      );
    } catch {
      return { parts: [] as DispositionDraft[], stagedDispositionKeys: {} as Record<string, string> };
    }
  })();
  const editableDispositionParts = materializedDispositions.parts;
  useLayoutEffect(() => {
    if (draft.dispositions?.length) return;
    const current = draft.stagedDispositionKeys ?? {};
    const next = materializedDispositions.stagedDispositionKeys;
    const changed = Object.keys(next).some((key) => current[key] !== next[key])
      || Object.keys(current).some((key) => !(key in next));
    if (!changed) return;
    onChange({ stagedDispositionKeys: next });
  }, [
    draft.dispositions?.length,
    draft.stagedDispositionKeys,
    materializedDispositions.stagedDispositionKeys,
    onChange,
  ]);
  const enableDistributionPlan = () => {
    try {
      const { parts, stagedDispositionKeys } = draftDispositions(
        line,
        draft,
        defaultAcceptedLocationId,
        fallbackQuarantineLocationId,
        defaultRejectedLocationId,
        t,
      );
      onChange({
        stagedDispositionKeys,
        dispositions: parts.map((part) => ({
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
  const patchDisposition = (
    key: string,
    patch: Partial<DispositionDraft>,
    resetDecisionCode = false,
  ) =>
    onChange({
      dispositions: advancedDispositions.map((part) =>
        part.key === key ? { ...part, ...patch } : part,
      ),
      ...(resetDecisionCode
        ? {
            decisionCodeId: "",
            reasonCode: "",
            decisionCodeRequiresNote: false,
          }
        : {}),
    });
  const addDisposition = () => {
    if (unallocatedQuantity <= QTY_EPS) return;
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
  };
  const removeDisposition = (key: string) => {
    onRemoveDispositionDraftImages(key);
    onChange({
      dispositions: advancedDispositions.filter((part) => part.key !== key),
    });
  };
  const draftCanDeleteImages = canDeleteImages || canUploadImages;
  const dispositionImageProps = (part: DispositionDraft) => ({
    dispositionLabel: `${localizeEnumValue(part.decision)} · ${formatProjectNumber(parseQty(part.quantity) || 0)}`,
    draftFiles: dispositionDraftImages[part.key] ?? [],
    onDraftFilesChange: (files: File[]) => onDispositionDraftImagesChange(part.key, files),
    canView: canViewImages,
    canUpload: canUploadImages,
    canDelete: draftCanDeleteImages,
  });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    const panelWidth = Math.min(520, window.innerWidth - margin * 2);
    const maxHeight = Math.max(160, window.innerHeight - margin * 2);
    const contentHeight = panelRef.current?.scrollHeight || 520;
    const height = Math.min(contentHeight, maxHeight);
    const left = Math.min(
      Math.max(margin, rect.right - panelWidth),
      window.innerWidth - panelWidth - margin,
    );
    let top = rect.top - height - gap;
    if (top < margin) top = margin;
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - height - margin);
    }
    setCoords({ top, left, maxHeight });
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

  useLayoutEffect(() => {
    if (!open || !panelRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updatePosition());
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [open, updatePosition]);

  useEffect(() => {
    if (open) return;
    setControlError(null);
  }, [open]);

  const confirmControlQuantity = (): void => {
    const error = controlQuantityError(line, draft.inspectedQuantity, t);
    if (error) {
      setControlError(error);
      controlSectionRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
    setControlError(null);
    const additional = additionalControlQuantity(line, draft.inspectedQuantity);
    onChange({
      inspectedQuantity: additional > QTY_EPS ? draft.inspectedQuantity : "",
      confirmedInspectedQuantity: additional > QTY_EPS ? String(additional) : "",
    });
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      if (target.closest(QUALITY_DECISION_DISMISS_IGNORE)) return;
      onDismissedByOutside?.();
      onOpenChange(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, onDismissedByOutside, onOpenChange]);

  return (
    <>
      <OpsActionButton
        ref={triggerRef}
        type="button"
        variant="secondary"
        disabled={disabled}
        title={disabled ? t("linePopover.editDisabledUntilStart") : t("linePopover.triggerTitle")}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
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
              style={{ top: coords.top, left: coords.left, maxHeight: coords.maxHeight }}
              className="wms-ops-quality-decision-popover wms-ops-list-popover pointer-events-auto fixed z-[5000] w-[min(32rem,calc(100vw-1rem))] space-y-2.5 border-0 p-3 shadow-none outline-none"
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
              <div
                ref={controlSectionRef}
                className={cn(
                  "rounded-xl border bg-emerald-500/[0.05] p-2.5",
                  controlError ? "border-rose-500/50" : "border-emerald-500/25",
                )}
              >
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
                    onChange={(event) => {
                      setControlError(null);
                      onChange({ inspectedQuantity: sanitizeIntegerQuantityInput(event.target.value) });
                    }}
                    placeholder={formatProjectNumber(requiredControl)}
                    inputMode="numeric"
                    invalid={Boolean(controlError)}
                    aria-describedby={controlError ? `quality-control-quantity-error-${line.id}` : undefined}
                    className="wms-ops-quality-field h-10 text-sm"
                  />
                  {controlError ? (
                    <span
                      id={`quality-control-quantity-error-${line.id}`}
                      role="alert"
                      className="block text-[0.7rem] font-semibold leading-relaxed text-rose-600"
                    >
                      {controlError}
                    </span>
                  ) : (
                    <span className="block text-[0.65rem] leading-relaxed text-slate-500">
                      {t("linePopover.inspectedThisDecisionHelp", {
                        totalRequired: formatProjectNumber(totalRequiredControl),
                        required: formatProjectNumber(requiredControl),
                        previous: formatProjectNumber(line.inspectedQuantity),
                      })}
                    </span>
                  )}
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
                      decisionCodeId: "",
                      reasonCode: "",
                      decisionCodeRequiresNote: false,
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
                  onChange={(e) => onChange({
                    quantity: capQuantityInput(e.target.value, remaining),
                  })}
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
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
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
                      disabled
                    />
                    {editableDispositionParts.length <= 1 && editableDispositionParts[0] ? (
                      <QualityDispositionImageButton
                        {...dispositionImageProps(editableDispositionParts[0])}
                      />
                    ) : null}
                  </div>
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
              {editableDispositionParts.length > 1 ? (
                <div className="space-y-2">
                  {editableDispositionParts.map((part) => (
                    <div key={part.key} className="space-y-2 rounded-xl border border-[var(--wms-app-border)] p-2.5">
                      <OpsStatusBadge tone={inferOpsStatusTone(part.decision)}>
                        {localizeEnumValue(part.decision)} · {formatProjectNumber(parseQty(part.quantity) || 0)}
                      </OpsStatusBadge>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <QualityDecisionTargetPicker
                          decision={part.decision}
                          targetLocationId={part.targetLocationId ?? defaultTargetForDecision(
                            part.decision,
                            defaultAcceptedLocationId,
                            fallbackQuarantineLocationId,
                            defaultRejectedLocationId,
                          )}
                          targetWarehouseId={part.targetWarehouseId ?? defaultWarehouseForDecision(
                            part.decision,
                            defaultAcceptedWarehouseId,
                            fallbackQuarantineWarehouseId,
                            defaultRejectedWarehouseId,
                          )}
                          onChange={() => undefined}
                          branchCode={branchCode}
                          queryScope={`quick-${line.id}-${part.key}`}
                          quarantineDestinations={quarantineDestinations}
                          defaultAcceptedDestination={defaultAcceptedDestination}
                          defaultRejectedDestination={defaultRejectedDestination}
                          disabled
                        />
                        <QualityDispositionImageButton {...dispositionImageProps(part)} />
                      </div>
                    </div>
                  ))}
                </div>
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
                          }, true)}
                          options={options}
                          placeholder={t("linePopover.decisionPlaceholder")}
                          className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
                          portalContainer={null}
                          contentClassName="!z-[5100]"
                        />
                        <AppInput
                          value={part.quantity}
                          onChange={(event) => patchDisposition(part.key, {
                            quantity: capQuantityInput(
                              event.target.value,
                              remainingCapacityForDistributionRow(
                                advancedDispositions,
                                part.key,
                                remaining,
                              ),
                            ),
                          })}
                          inputMode="decimal"
                          disabled={part.decision === "Returned"}
                          className="wms-ops-quality-field h-10 text-xs"
                        />
                      </div>
                      {part.decision === "Accepted" ? (
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <PagedAppDropdown
                            queryKey={["quality-approved-target", branchCode, line.id, part.key]}
                            fetchPage={(request) => qualityApi.locations(request, branchCode)}
                            toOption={(location) => ({
                              value: encodeQualityLocationValue(location.id, location.warehouseId),
                              label: `${location.warehouseCode} / ${location.code} · ${location.name}`,
                              description: location.warehouseName,
                              disabled: location.isQuarantine,
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
                            disabled
                            hideChevron
                            className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
                            portalContainer={null}
                            contentClassName="!z-[5100]"
                          />
                          <QualityDispositionImageButton {...dispositionImageProps(part)} />
                        </div>
                      ) : part.decision === "Quarantined" ? (
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
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
                            disabled
                            hideChevron
                            className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
                            portalContainer={null}
                            contentClassName="!z-[5100]"
                          />
                          <QualityDispositionImageButton {...dispositionImageProps(part)} />
                        </div>
                      ) : part.decision === "Rejected" ? (
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
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
                            disabled
                            hideChevron
                            className="wms-ops-quality-field !h-10 !min-h-10 !text-xs"
                            portalContainer={null}
                            contentClassName="!z-[5100]"
                          />
                          <QualityDispositionImageButton {...dispositionImageProps(part)} />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addDisposition}
                    disabled={unallocatedQuantity <= QTY_EPS}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-cyan-500/35 px-3 py-2 text-xs font-bold text-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="size-3.5" /> {t("linePopover.addRoute")}
                  </button>
                </div>
              )}
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-slate-500">
                  {t("linePopover.reasonCodeLabel")}
                </span>
                <PagedAppDropdown
                  queryKey={["quality-decision-code-line", branchCode, line.id, decisionCodeFilter]}
                  fetchPage={(request) => qualityApi.decisionCodeOptions(request, branchCode, decisionCodeFilter)}
                  toOption={(item) => ({
                    value: String(item.id),
                    label: `${item.code} · ${item.name}`,
                    description: item.requiresNote ? t("linePopover.reasonNoteRequired") : undefined,
                    meta: item,
                  })}
                  value={draft.decisionCodeId || null}
                  selectedOption={draft.decisionCodeId && draft.reasonCode ? {
                    value: draft.decisionCodeId,
                    label: draft.reasonCode,
                  } : undefined}
                  onValueChange={(value) => onChange({ decisionCodeId: value })}
                  onOptionChange={(option) => {
                    const item = option?.meta as { code?: string; name?: string; requiresNote?: boolean } | undefined;
                    onChange({
                      reasonCode: item?.code && item?.name ? `${item.code} · ${item.name}` : "",
                      decisionCodeRequiresNote: Boolean(item?.requiresNote),
                    });
                  }}
                  placeholder={t("linePopover.reasonCodePlaceholder")}
                  className="wms-ops-quality-field !h-10 !min-h-10 !text-sm"
                  searchFields={["code", "name"]}
                  enabled={Boolean(decisionCodeFilter)}
                  portalContainer={null}
                  contentClassName="!z-[5100]"
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
                onClick={confirmControlQuantity}
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
  disabled = false,
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
  disabled?: boolean;
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
          disabled: location.isQuarantine,
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
        disabled={disabled}
        hideChevron={disabled}
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
        disabled={disabled}
        hideChevron={disabled}
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
        disabled={disabled}
        hideChevron={disabled}
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
