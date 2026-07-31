import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Barcode,
  Check,
  Eye,
  Loader2,
  Play,
  Printer,
  Save,
  ScanLine,
  Tags,
  UserRoundCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
} from "@/components/shared/AdvancedDataGrid";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppDateInput } from "@/components/shared/AppInput";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import {
  requiredActionColumn,
  systemColumns,
} from "@/components/shared/GridSystemColumns";
import { StockIdentityCell } from "@/components/shared/StockIdentityCell";
import { WarehouseBarcodeScanner } from "@/features/barcode-resolution/WarehouseBarcodeScanner";
import {
  formatProjectDateTime,
  formatProjectNumber,
} from "@/lib/project-format";
import { goodsReceiptV2Api } from "../api/goods-receipt.api";
import { goodsReceiptEnumLabel } from "../localization/enum-labels";
import type {
  ActiveUserOption,
  GoodsReceiptLabelBatchDetail,
  GoodsReceiptLabelRow,
  GoodsReceiptTaskDetail,
  GoodsReceiptTaskGridRow,
} from "../types/goods-receipt.types";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";
import { printReceiptLabels } from "../utils/goods-receipt-label-output";
import {
  activePreLabelsForTask,
  isGoodsReceiptLabelBarcode,
  printedPreLabelsForTask,
} from "../utils/goods-receipt-pre-label-flow";

export function GoodsReceiptTasksPage({
  assignedOnly = false,
}: {
  assignedOnly?: boolean;
}): ReactElement {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const { t: tGrid, i18n } = useTranslation("common");
  const gridLanguage = i18n.resolvedLanguage ?? i18n.language;
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<GoodsReceiptTaskDetail | null>(null);
  const [users, setUsers] = useState<ActiveUserOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const pageKey = assignedOnly
    ? "goods-receipt-my-tasks"
    : "goods-receipt-tasks";
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["advanced-grid", pageKey],
    });
  };
  const open = useCallback(
    async (row: GoodsReceiptTaskGridRow) => {
      setBusy(row.id);
      try {
        const result = await goodsReceiptV2Api.taskDetail(row.id);
        setDetail(result);
        setSelectedUsers(result.assignments.map((x) => x.userId));
        if (!assignedOnly && users.length === 0)
          setUsers(await goodsReceiptV2Api.activeUsers());
      } catch (error) {
        toast.error(message(error, t("tasks.modal.errors.detailFetchFailed")));
      } finally {
        setBusy(null);
      }
    },
    [assignedOnly, users.length, t],
  );
  const act = async (kind: "accept" | "start") => {
    if (!detail) return;
    setBusy(detail.task.id);
    try {
      setDetail(
        kind === "accept"
          ? await goodsReceiptV2Api.acceptTask(detail.task.id)
          : await goodsReceiptV2Api.startTask(detail.task.id),
      );
      toast.success(
        kind === "accept" ? t("tasks.modal.toast.accepted") : t("tasks.modal.toast.started"),
      );
      await refresh();
    } catch (error) {
      toast.error(message(error, t("tasks.modal.errors.actionFailed")));
    } finally {
      setBusy(null);
    }
  };
  const saveAssignments = async () => {
    if (!detail || selectedUsers.length === 0) {
      toast.error(t("tasks.modal.errors.selectAtLeastOneUser"));
      return;
    }
    setBusy(detail.task.id);
    try {
      setDetail(
        await goodsReceiptV2Api.replaceTaskAssignments(
          detail.task.id,
          selectedUsers,
          detail.task.rowVersion,
        ),
      );
      toast.success(t("tasks.modal.toast.assignmentsUpdated"));
      await refresh();
    } catch (error) {
      toast.error(message(error, t("tasks.modal.errors.assignmentsUpdateFailed")));
    } finally {
      setBusy(null);
    }
  };
  const reload = async () => {
    if (!detail) return;
    setDetail(await goodsReceiptV2Api.taskDetail(detail.task.id));
    await refresh();
  };
  const columns = useMemo<GridColumn<GoodsReceiptTaskGridRow>[]>(
    () => [
      ...systemColumns<GoodsReceiptTaskGridRow>(),
      {
        key: "taskNo",
        label: tGrid("dataGrid.goodsReceiptTasks.taskNo"),
        sortable: true,
        filterable: true,
        render: (row) => (
          <span className="font-mono font-semibold">{row.taskNo}</span>
        ),
      },
      {
        key: "documentNo",
        label: tGrid("dataGrid.goodsReceiptTasks.documentNo"),
        sortable: true,
        filterable: true,
        render: (row) => row.documentNo,
      },
      {
        key: "processType",
        label: tGrid("dataGrid.goodsReceiptTasks.processType"),
        sortable: true,
        filterable: true,
        render: (row) =>
          goodsReceiptEnumLabel(t, "processType", row.processType),
      },
      {
        key: "supplierCode",
        label: tGrid("dataGrid.goodsReceiptTasks.supplierCode"),
        sortable: true,
        filterable: true,
        render: (row) => row.supplierCode || "—",
      },
      {
        key: "supplierName",
        label: tGrid("dataGrid.goodsReceiptTasks.supplierName"),
        sortable: true,
        filterable: true,
        render: (row) => row.supplierName || "—",
      },
      {
        key: "warehouseCode",
        label: tGrid("dataGrid.goodsReceiptTasks.warehouseCode"),
        sortable: true,
        filterable: true,
        render: (row) => row.warehouseCode,
      },
      {
        key: "warehouseName",
        label: tGrid("dataGrid.goodsReceiptTasks.warehouseName"),
        sortable: true,
        filterable: true,
        render: (row) => row.warehouseName,
      },
      {
        key: "status",
        label: tGrid("dataGrid.goodsReceiptTasks.status"),
        sortable: true,
        filterable: true,
        render: (row) => goodsReceiptEnumLabel(t, "taskStatus", row.status),
      },
      {
        key: "myAssignmentStatus",
        label: tGrid("dataGrid.goodsReceiptTasks.myAssignmentStatus"),
        sortable: true,
        filterable: true,
        render: (row) =>
          goodsReceiptEnumLabel(t, "assignmentStatus", row.myAssignmentStatus),
      },
      {
        key: "plannedQuantity",
        label: tGrid("dataGrid.goodsReceiptTasks.plannedQuantity"),
        sortable: true,
        filterable: true,
        render: (row) => formatProjectNumber(row.plannedQuantity),
      },
      {
        key: "processedQuantity",
        label: tGrid("dataGrid.goodsReceiptTasks.processedQuantity"),
        sortable: true,
        filterable: true,
        render: (row) => formatProjectNumber(row.processedQuantity),
      },
      {
        key: "actions",
        label: tGrid("dataGrid.goodsReceiptTasks.actions"),
        ...requiredActionColumn,
        render: (row) => (
          <button
            type="button"
            disabled={busy === row.id}
            onClick={() => void open(row)}
            className="rounded-lg p-2 text-cyan-500 hover:bg-cyan-500/10"
            aria-label={tGrid("dataGrid.goodsReceiptTasks.viewTask")}
          >
            {busy === row.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        ),
      },
    ],
    [busy, gridLanguage, open, t, tGrid],
  );
  return (
    <>
      <AdvancedDataGrid
        pageKey={pageKey}
        title={
          assignedOnly
            ? tGrid("dataGrid.goodsReceiptTasks.assignedTitle")
            : tGrid("dataGrid.goodsReceiptTasks.title")
        }
        description={
          assignedOnly
            ? tGrid("dataGrid.goodsReceiptTasks.assignedDescription")
            : tGrid("dataGrid.goodsReceiptTasks.description")
        }
        columns={columns}
        fetchPage={
          assignedOnly
            ? goodsReceiptV2Api.myTasksPaged
            : goodsReceiptV2Api.tasksPaged
        }
      />
      {detail && (
        <TaskModal
          detail={detail}
          assignedOnly={assignedOnly}
          users={users}
          selectedUsers={selectedUsers}
          setSelectedUsers={setSelectedUsers}
          busy={busy === detail.task.id}
          close={() => setDetail(null)}
          accept={() => void act("accept")}
          start={() => void act("start")}
          save={() => void saveAssignments()}
          reload={() => void reload()}
        />
      )}
    </>
  );
}

function TaskModal({
  detail,
  assignedOnly,
  users,
  selectedUsers,
  setSelectedUsers,
  busy,
  close,
  accept,
  start,
  save,
  reload,
}: {
  detail: GoodsReceiptTaskDetail;
  assignedOnly: boolean;
  users: ActiveUserOption[];
  selectedUsers: number[];
  setSelectedUsers: (ids: number[]) => void;
  busy: boolean;
  close: () => void;
  accept: () => void;
  start: () => void;
  save: () => void;
  reload: () => void;
}): ReactElement {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const [labelsRevision, setLabelsRevision] = useState(0);
  const toggle = (id: number) =>
    setSelectedUsers(
      selectedUsers.includes(id)
        ? selectedUsers.filter((x) => x !== id)
        : [...selectedUsers, id],
    );
  return (
    <ResponsiveDialog
      onClose={close}
      title={t("tasks.modal.title", { taskNo: detail.task.taskNo })}
      description={t("tasks.modal.description")}
      className="!max-w-6xl"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-500">
            {t("tasks.modal.eyebrow")}
          </p>
          <h2 className="text-xl font-bold">{detail.task.taskNo}</h2>
          <p className="text-sm text-slate-500">
            {detail.task.documentNo} · {detail.task.supplierCode}{" "}
            {detail.task.supplierName}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("close")}
          className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="size-5" />
        </button>
      </header>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Info
          label={t("tasks.modal.info.status")}
          value={goodsReceiptEnumLabel(t, "taskStatus", detail.task.status)}
        />
        <Info
          label={t("tasks.modal.info.warehouse")}
          value={`${detail.task.warehouseCode} · ${detail.task.warehouseName}`}
        />
        <Info label={t("tasks.modal.info.priority")} value={String(detail.task.priority)} />
        <Info
          label={t("tasks.modal.info.planned")}
          value={formatProjectNumber(detail.task.plannedQuantity)}
        />
        <Info
          label={t("tasks.modal.info.started")}
          value={
            detail.task.startedAtUtc
              ? formatProjectDateTime(detail.task.startedAtUtc)
              : "—"
          }
        />
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--wms-app-border)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left dark:bg-white/5">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">{t("tasks.modal.table.stock")}</th>
              <th className="p-3">{t("list.yap")}</th>
              <th className="p-3 text-right">{t("tasks.modal.info.planned")}</th>
              <th className="p-3 text-right">{t("tasks.modal.table.received")}</th>
              <th className="p-3">{t("tasks.modal.info.status")}</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((line) => (
              <tr
                key={line.id}
                className="border-t border-[var(--wms-app-border)]"
              >
                <td className="p-3">{line.sequenceNo}</td>
                <td className="p-3">
                  <StockIdentityCell
                    stockId={line.stockId}
                    stockCode={line.stockCode}
                    stockName={line.stockName}
                    branchCode={detail.task.branchCode}
                  />
                  <div
                    className={`mt-1 text-[11px] font-semibold ${
                      line.requireQualityControl
                        ? "text-amber-500"
                        : "text-emerald-500"
                    }`}
                  >
                    {line.requireQualityControl
                      ? t("tasks.modal.line.qualityRequired")
                      : t("tasks.modal.line.directDispatch")}
                  </div>
                </td>
                <td className="p-3">{line.yapCode || "—"}</td>
                <td className="p-3 text-right">
                  {formatProjectNumber(line.plannedQuantity)} {line.unitCode}
                </td>
                <td className="p-3 text-right">
                  {formatProjectNumber(line.processedQuantity)}
                </td>
                <td className="p-3">
                  {goodsReceiptEnumLabel(t, "lineStatus", line.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assignedOnly ? (
        <>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={busy || detail.task.myAssignmentStatus !== "Assigned"}
              onClick={accept}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 px-4 py-2 font-semibold text-cyan-500 disabled:opacity-40"
            >
              <Check className="size-4" />
              {t("tasks.modal.actions.acceptAssignment")}
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !["Assigned", "Accepted"].includes(
                  detail.task.myAssignmentStatus || "",
                )
              }
              onClick={start}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
            >
              <Play className="size-4" />
              {t("tasks.modal.actions.startTask")}
            </button>
          </div>
          {detail.task.labelStrategy === "PreGenerate" && (
            <PreLabelPanel
              detail={detail}
              onLabelsChanged={() => setLabelsRevision((value) => value + 1)}
            />
          )}
          {detail.task.labelStrategy === "GenerateOnReceipt" && (
            <ReceiptGeneratedLabelsPanel detail={detail} />
          )}
          {detail.task.status === "InProgress" && (
            <TaskScanPanel
              detail={detail}
              labelsRevision={labelsRevision}
              reload={reload}
            />
          )}
        </>
      ) : (
        <>
          <section className="mt-5 rounded-xl border border-[var(--wms-app-border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <UserRoundCog className="size-5 text-cyan-500" />
              <h3 className="font-bold">{t("createFlow.assignees.title")}</h3>
            </div>
            <div className="grid max-h-56 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--wms-app-border)] p-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => toggle(user.id)}
                  />
                  <span>
                    <strong className="block text-sm">
                      {`${user.firstName} ${user.lastName}`.trim() ||
                        user.username}
                    </strong>
                    <small className="text-slate-500">
                      {user.username} · {user.email}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={busy || selectedUsers.length === 0}
                onClick={save}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {t("tasks.modal.actions.saveAssignments")}
              </button>
            </div>
          </section>
          {detail.task.labelStrategy === "PreGenerate" && (
            <PreLabelPanel
              detail={detail}
              onLabelsChanged={() => setLabelsRevision((value) => value + 1)}
            />
          )}
          {detail.task.labelStrategy === "GenerateOnReceipt" && (
            <ReceiptGeneratedLabelsPanel detail={detail} />
          )}
        </>
      )}
    </ResponsiveDialog>
  );
}

function ReceiptGeneratedLabelsPanel({
  detail,
}: {
  detail: GoodsReceiptTaskDetail;
}): ReactElement {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const [labels, setLabels] = useState<GoodsReceiptLabelRow[]>([]);
  const [busy, setBusy] = useState(false);
  const processedKey = detail.lines.map((x) => x.processedQuantity).join("|");

  useEffect(() => {
    let active = true;
    setBusy(true);
    void goodsReceiptV2Api
      .receiptLabels(detail.task.goodsReceiptId)
      .then((items) => {
        if (active) setLabels(items.filter((x) => x.status !== "Consumed"));
      })
      .catch((error) => {
        if (active) toast.error(message(error, t("tasks.modal.receiptLabels.fetchFailed")));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [detail.task.goodsReceiptId, processedKey, t]);

  const unprinted = labels.filter((x) => x.printCount === 0);
  const print = async () => {
    if (labels.length === 0) return;
    setBusy(true);
    try {
      printReceiptLabels(labels, `${detail.task.documentNo} ${t("tasks.modal.receiptLabels.title").toLowerCase()}`);
      if (unprinted.length > 0)
        await goodsReceiptV2Api.markLabelsPrinted(unprinted.map((x) => x.id));
      setLabels((current) =>
        current.map((x) => ({ ...x, printCount: Math.max(1, x.printCount) })),
      );
      toast.success(t("manual.result.labelsPrintedToast"));
    } catch (error) {
      toast.error(message(error, t("tasks.modal.receiptLabels.printFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Tags className="mt-0.5 size-5 text-violet-500" />
          <div>
            <h3 className="font-bold">{t("tasks.modal.receiptLabels.title")}</h3>
            <p className="text-xs text-slate-500">
              {t("tasks.modal.receiptLabels.hint")}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy || labels.length === 0}
          onClick={() => void print()}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 px-4 py-2 font-semibold text-violet-500 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Printer className="size-4" />
          )}
          {labels.length === 0
            ? t("tasks.modal.receiptLabels.noneYet")
            : t("tasks.modal.receiptLabels.printButton", { count: labels.length })}
        </button>
      </div>
    </section>
  );
}

function PreLabelPanel({
  detail,
  onLabelsChanged,
}: {
  detail: GoodsReceiptTaskDetail;
  onLabelsChanged: () => void;
}): ReactElement {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] =
    useState<GoodsReceiptLabelBatchDetail | null>(null);
  const [existingLabels, setExistingLabels] = useState<GoodsReceiptLabelRow[]>([]);
  const generationIdempotencyKey = useRef(crypto.randomUUID());
  const openTaskLineIds = useMemo(
    () =>
      new Set(
        detail.lines
          .filter((line) => line.processedQuantity < line.plannedQuantity)
          .map((line) => line.id),
      ),
    [detail.lines],
  );
  const openLineKey = [...openTaskLineIds].join("|");
  const hasOpenLines = openTaskLineIds.size > 0;
  const generatedLabels = generated?.labels ?? [];
  const availableLabels =
    generatedLabels.length > 0 ? generatedLabels : existingLabels;
  const printedCount = availableLabels.filter(
    (label) => label.status === "Printed" || label.printCount > 0,
  ).length;

  useEffect(() => {
    let active = true;
    setBusy(true);
    void goodsReceiptV2Api
      .receiptLabels(detail.task.goodsReceiptId)
      .then((labels) => {
        if (active)
          setExistingLabels(activePreLabelsForTask(labels, openTaskLineIds));
      })
      .catch((error) => {
        if (active) toast.error(message(error, t("tasks.modal.preLabel.existingFetchFailed")));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [detail.task.goodsReceiptId, openLineKey, openTaskLineIds, t]);

  const create = async () => {
    const lines = detail.lines
      .filter((x) => x.processedQuantity < x.plannedQuantity)
      .map((x) => ({ taskLineId: x.id, labelCount: 1 }));
    if (lines.length === 0) {
      toast.error(t("tasks.modal.preLabel.noOpenLinesError"));
      return;
    }
    setBusy(true);
    try {
      const result = await goodsReceiptV2Api.generateLabels(
        detail.task.goodsReceiptId,
        detail.task.id,
        lines,
        t("tasks.modal.preLabel.batchName"),
        generationIdempotencyKey.current,
      );
      setGenerated(result);
      setExistingLabels(result.labels);
      onLabelsChanged();
      toast.success(
        t("tasks.modal.preLabel.generatedToast", { count: result.batch.totalLabelCount }),
      );
    } catch (error) {
      toast.error(message(error, t("tasks.modal.preLabel.createFailed")));
    } finally {
      setBusy(false);
    }
  };
  const print = async () => {
    const labelIds = availableLabels.map((x) => x.id);
    if (labelIds.length === 0) {
      toast.error(t("tasks.modal.preLabel.noPrintableLabels"));
      return;
    }
    setBusy(true);
    try {
      printReceiptLabels(
        availableLabels,
        generated?.batch.batchNo ?? `${detail.task.taskNo} ${t("tasks.modal.preLabel.printTitleSuffix")}`,
      );
      await goodsReceiptV2Api.markLabelsPrinted(labelIds);
      setExistingLabels((current) =>
        current.map((label) =>
          labelIds.includes(label.id)
            ? { ...label, status: "Printed", printCount: label.printCount + 1 }
            : label,
        ),
      );
      setGenerated((current) =>
        current
          ? {
              ...current,
              labels: current.labels.map((label) => ({
                ...label,
                status: "Printed",
                printCount: label.printCount + 1,
              })),
            }
          : current,
      );
      onLabelsChanged();
      toast.success(t("tasks.modal.preLabel.markedPrintedToast"));
    } catch (error) {
      toast.error(message(error, t("manual.result.labelsPrintFailed")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Tags className="mt-0.5 size-5 text-cyan-500" />
          <div>
            <h3 className="font-bold">{t("tasks.modal.preLabel.title")}</h3>
            <p className="text-xs text-slate-500">
              {t("tasks.modal.preLabel.hint")}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy || availableLabels.length > 0 || !hasOpenLines}
          onClick={() => void create()}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Barcode className="size-4" />
          )}
          {availableLabels.length > 0
            ? t("tasks.modal.preLabel.activeExists")
            : hasOpenLines
              ? t("tasks.modal.preLabel.createButton")
              : t("tasks.modal.preLabel.noOpenLines")}
        </button>
      </div>
      {availableLabels.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/25 bg-[var(--wms-app-surface)] p-3">
          <div className="text-sm">
            <strong className="block">
              {generated?.batch.batchNo ?? detail.task.taskNo}
            </strong>
            <span className="text-xs text-slate-500">
              {t("tasks.modal.preLabel.statusLine", { count: availableLabels.length, printed: printedCount })}
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void print()}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 px-4 py-2 font-semibold text-cyan-500 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
            {printedCount === availableLabels.length
              ? t("tasks.modal.preLabel.reprintButton")
              : t("tasks.modal.preLabel.printButton")}
          </button>
        </div>
      )}
    </section>
  );
}

function TaskScanPanel({
  detail,
  labelsRevision,
  reload,
}: {
  detail: GoodsReceiptTaskDetail;
  labelsRevision: number;
  reload: () => void;
}): ReactElement {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const openLines = useMemo(
    () =>
      detail.lines.filter(
        (line) => line.processedQuantity < line.plannedQuantity,
      ),
    [detail.lines],
  );
  const [lineId, setLineId] = useState(String(openLines[0]?.id ?? ""));
  const [barcode, setBarcode] = useState("");
  const [barcodeSource, setBarcodeSource] = useState("");
  const [printedLabels, setPrintedLabels] = useState<GoodsReceiptLabelRow[]>([]);
  const [quantity, setQuantity] = useState("");
  const [lot, setLot] = useState("");
  const [serial, setSerial] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [busy, setBusy] = useState(false);
  const scanIdempotencyKey = useRef(crypto.randomUUID());
  const navigate = useNavigate();
  const selectedLine = openLines.find((x) => String(x.id) === lineId);
  const requiresPreLabel = detail.task.labelStrategy === "PreGenerate";
  const hasValidBarcode =
    barcode.trim().length > 0 &&
    (!requiresPreLabel || isGoodsReceiptLabelBarcode(barcodeSource));
  const openLineKey = openLines.map((line) => line.id).join("|");

  useEffect(() => {
    if (!requiresPreLabel) {
      setPrintedLabels([]);
      return;
    }
    let active = true;
    void goodsReceiptV2Api
      .receiptLabels(detail.task.goodsReceiptId)
      .then((labels) => {
        if (active)
          setPrintedLabels(
            printedPreLabelsForTask(labels, new Set(openLines.map((line) => line.id))),
          );
      })
      .catch((error) => {
        if (active) toast.error(message(error, t("tasks.modal.scan.printedLabelsFetchFailed")));
      });
    return () => {
      active = false;
    };
  }, [
    detail.task.goodsReceiptId,
    labelsRevision,
    openLineKey,
    openLines,
    requiresPreLabel,
    t,
  ]);

  const submit = async () => {
    if (!lineId || !hasValidBarcode) {
      toast.error(t("tasks.modal.scan.validateFirst"));
      return;
    }
    setBusy(true);
    try {
      const result = await goodsReceiptV2Api.receiveTaskScan(detail.task.id, {
        idempotencyKey: scanIdempotencyKey.current,
        taskLineId: Number(lineId),
        barcode: barcode.trim(),
        quantity: quantity ? Number(quantity) : undefined,
        lotNo: lot.trim() || undefined,
        serialNo: serial.trim() || undefined,
        manufacturingDate: manufacturingDate || undefined,
        expirationDate: expirationDate || undefined,
        deviceId: navigator.userAgent.slice(0, 100),
      });
      if (result.qualityInspectionId) {
        toast.success(t("tasks.modal.scan.sentToQualityToast"), {
          action: {
            label: t("manual.result.qualityListButton"),
            onClick: () => navigate("/warehouse/quality/inspections"),
          },
        });
      } else {
        toast.success(
          result.replayed
            ? t("tasks.modal.scan.replayedToast")
            : t("tasks.modal.scan.processedToast"),
        );
      }
      if (result.generatedLabelId)
        toast.success(t("tasks.modal.scan.labelGeneratedToast"));
      setBarcode("");
      setBarcodeSource("");
      setQuantity("");
      setLot("");
      setSerial("");
      setManufacturingDate("");
      setExpirationDate("");
      scanIdempotencyKey.current = crypto.randomUUID();
      reload();
    } catch (error) {
      toast.error(message(error, t("tasks.modal.scan.acceptFailed")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-5 space-y-4">
      {requiresPreLabel && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            printedLabels.length > 0
              ? "border-cyan-500/30 bg-cyan-500/5"
              : "border-amber-500/30 bg-amber-500/5"
          }`}
        >
          {printedLabels.length > 0
            ? t("tasks.modal.scan.preLabelReadyBanner", { count: printedLabels.length })
            : t("tasks.modal.scan.preLabelRequiredBanner")}
        </div>
      )}
      <WarehouseBarcodeScanner
        branchCode={detail.task.branchCode ?? "0"}
        purpose="Inbound"
        warehouseId={detail.task.warehouseId}
        expectedStockId={selectedLine?.stockId}
        disabled={busy}
        title={t("tasks.modal.scan.scannerTitle")}
        description={
          requiresPreLabel
            ? t("tasks.modal.scan.scannerDescriptionPreLabel")
            : t("tasks.modal.scan.scannerDescriptionGeneral")
        }
        onResolved={(value) => {
          if (requiresPreLabel && !isGoodsReceiptLabelBarcode(value.source)) {
            setBarcode("");
            setBarcodeSource("");
            toast.error(t("tasks.modal.scan.wrongBarcodeError"));
            return;
          }
          const matched = openLines.find(
            (x) =>
              x.stockId === value.stockId &&
              (!value.yapCode || x.yapCode === value.yapCode),
          );
          if (matched) setLineId(String(matched.id));
          setBarcode(value.rawBarcode);
          setBarcodeSource(value.source);
          setQuantity(value.quantity != null ? String(value.quantity) : "");
          setLot(value.lotNo ?? "");
          setSerial(value.serialNo ?? "");
          setManufacturingDate(value.manufacturingDate ?? "");
          setExpirationDate(value.expirationDate ?? "");
        }}
      />
      <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="mb-4 flex items-start gap-3">
          <ScanLine className="mt-0.5 size-5 text-emerald-500" />
          <div>
            <h3 className="font-bold">{t("tasks.modal.scan.resolvedTitle")}</h3>
            <p className="text-xs text-slate-500">
              {t("tasks.modal.scan.resolvedHint")}
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AppDropdown
            value={lineId}
            onValueChange={setLineId}
            options={openLines.map((x) => ({
              value: String(x.id),
              label: `${x.sequenceNo} · ${x.stockCode}`,
              description: t("tasks.modal.scan.remainingLabel", {
                quantity: formatProjectNumber(x.plannedQuantity - x.processedQuantity),
                unit: x.unitCode,
              }),
            }))}
          />
          <input
            className="input"
            type="number"
            min="0.000001"
            step="0.000001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={t("manual.quantity")}
          />
          <input
            className="input"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            placeholder={t("manual.lot")}
          />
          <input
            className="input"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder={t("manual.serial")}
          />
          <AppDateInput
            value={manufacturingDate}
            onChange={(e) => setManufacturingDate(e.target.value)}
            aria-label={t("manual.manufacturingDate")}
          />
          <AppDateInput
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            aria-label={t("manual.expirationDate")}
          />
          <button
            type="button"
            disabled={busy || !hasValidBarcode}
            onClick={() => void submit()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {selectedLine?.requireQualityControl
              ? t("createFlow.sendToQuality")
              : t("createFlow.createDirect")}
          </button>
        </div>
      </section>
    </section>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-xl border border-[var(--wms-app-border)] p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <strong className="mt-1 block text-sm">{value}</strong>
    </div>
  );
}
function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
export const GoodsReceiptAssignedTasksPage = (): ReactElement => (
  <GoodsReceiptTasksPage assignedOnly />
);
