import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Barcode,
  Check,
  Eye,
  ListChecks,
  Loader2,
  PackageOpen,
  Play,
  Printer,
  Save,
  ScanLine,
  Search,
  Tags,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdvancedDataGrid,
  type GridColumn,
} from "@/components/shared/AdvancedDataGrid";
import { AppDropdown } from "@/components/shared/AppDropdown";
import { AppDateInput } from "@/components/shared/AppInput";
import { OpsActionButton } from "@/components/shared/OpsActionButton";
import { OpsSkinCheckbox } from "@/components/shared/OpsSkinCheckbox";
import {
  OpsCodeBadge,
  OpsStatusBadge,
  inferOpsStatusTone,
} from "@/components/shared/OpsStatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
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
  resolveGoodsReceiptWaybillNo,
  resolveGoodsReceiptWaybillReference,
} from "../utils/goods-receipt-waybill";
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
      ...systemColumns<GoodsReceiptTaskGridRow>({ searchable: ['id', 'createdBy', 'updatedBy'] }),
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
        key: "waybillNo",
        label: t("list.waybillReference"),
        sortable: true,
        filterable: true,
        searchable: true,
        defaultSearch: true,
        render: (row) => resolveGoodsReceiptWaybillNo(row) || "—",
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
            className="wms-ops-grid-icon-btn disabled:opacity-40"
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

const LABEL_STRATEGY_KEYS: Record<string, string> = {
  None: "createFlow.labelOptions.none",
  PreGenerate: "createFlow.labelOptions.preGenerate",
  SupplierLabel: "createFlow.labelOptions.supplierLabel",
  GenerateOnReceipt: "createFlow.labelOptions.generateOnReceipt",
};

type TaskModalTab = "info" | "lines" | "ops";

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
  const [tab, setTab] = useState<TaskModalTab>("lines");
  const [labelsRevision, setLabelsRevision] = useState(0);
  const [lineSearch, setLineSearch] = useState("");
  const task = detail.task;
  const supplier =
    [task.supplierCode, task.supplierName].filter(Boolean).join(" · ") || "—";
  const acceptAvailable = task.myAssignmentStatus === "Assigned";
  const startAvailable = ["Assigned", "Accepted"].includes(
    task.myAssignmentStatus || "",
  );

  const normalizedLineSearch = lineSearch.trim().toLocaleUpperCase("tr-TR");
  const visibleLines = useMemo(() => {
    if (!normalizedLineSearch) return detail.lines;
    return detail.lines.filter((line) =>
      [line.stockCode, line.stockName, line.yapCode, String(line.sequenceNo)].some(
        (value) =>
          String(value ?? "")
            .toLocaleUpperCase("tr-TR")
            .includes(normalizedLineSearch),
      ),
    );
  }, [detail.lines, normalizedLineSearch]);

  const tabIndex = tab === "info" ? 0 : tab === "lines" ? 1 : 2;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        portalRoot="body"
        tone="ops"
        aria-describedby={undefined}
        className={cn(
          "wms-ops-detail-dialog wms-ops-form flex !h-[min(90vh,880px)] !max-h-[calc(100dvh-2rem)] w-full !max-w-6xl flex-col !gap-0 overflow-hidden border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] !p-0",
          "[scrollbar-gutter:auto]",
        )}
      >
        <header className="wms-ops-detail-dialog__header shrink-0">
          <div className="min-w-0 pr-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
              {t("tasks.modal.eyebrow")}
            </p>
            <DialogTitle className="wms-ops-detail-dialog__title">
              {t("tasks.taskNo")}
              <span className="ml-2 font-mono text-base font-bold text-cyan-600 dark:text-cyan-300">
                {task.taskNo}
              </span>
            </DialogTitle>
            <DialogDescription className="wms-ops-detail-dialog__description">
              {`${resolveGoodsReceiptWaybillNo(task) || t("list.noWaybillShort")} · ${supplier}`}
            </DialogDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <OpsStatusBadge tone={inferOpsStatusTone(task.status)}>
                {goodsReceiptEnumLabel(t, "taskStatus", task.status)}
              </OpsStatusBadge>
              {task.myAssignmentStatus ? (
                <OpsStatusBadge tone={inferOpsStatusTone(task.myAssignmentStatus)}>
                  {goodsReceiptEnumLabel(t, "assignmentStatus", task.myAssignmentStatus)}
                </OpsStatusBadge>
              ) : null}
              <OpsCodeBadge>{`${task.warehouseCode} · ${task.warehouseName}`}</OpsCodeBadge>
            </div>
          </div>
        </header>

        {assignedOnly ? (
          <div className="wms-ops-detail-lifecycle shrink-0 px-4 py-3 sm:px-6">
            <div className="wms-ops-detail-lifecycle__bar">
              <LifecycleButton
                label={t("tasks.modal.actions.acceptAssignment")}
                icon={<Check className="size-4" />}
                onClick={accept}
                disabled={busy || !acceptAvailable}
              />
              <LifecycleButton
                label={t("tasks.modal.actions.startTask")}
                icon={
                  busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )
                }
                onClick={start}
                disabled={busy || !startAvailable}
              />
            </div>
          </div>
        ) : null}

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as TaskModalTab)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="shrink-0 px-4 pt-4 sm:px-6">
            <TabsList
              className={cn(
                "w-full",
                "wms-ops-detail-main-tabs",
                "wms-ops-detail-main-tabs--cols-3",
              )}
              data-active-index={tabIndex}
            >
              <span className="wms-ops-detail-tab-indicator" aria-hidden />
              <TabsTrigger value="info" className="wms-ops-detail-main-tab">
                {t("tasks.modal.tabs.info")}
              </TabsTrigger>
              <TabsTrigger value="lines" className="wms-ops-detail-main-tab">
                {t("tasks.modal.tabs.lines")}
              </TabsTrigger>
              <TabsTrigger value="ops" className="wms-ops-detail-main-tab">
                {assignedOnly
                  ? t("tasks.modal.tabs.operation")
                  : t("tasks.modal.tabs.assignments")}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="info"
            className="wms-ops-scrollbar mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
          >
            <div className="space-y-4">
              <div className="wms-ops-detail-panel">
                <div className="wms-ops-detail-grid">
                  <TaskField label={t("tasks.taskNo")}>{task.taskNo}</TaskField>
                  <TaskField
                    label={t(resolveGoodsReceiptWaybillReference(task)?.kind === "electronic"
                      ? "createFlow.waybill.eReceiptNumber"
                      : "createFlow.waybill.receiptNumber")}
                  >
                    {resolveGoodsReceiptWaybillNo(task) || "—"}
                  </TaskField>
                  <TaskField label={t("tasks.supplierName")}>{supplier}</TaskField>
                  <TaskField label={t("tasks.modal.info.warehouse")}>
                    {`${task.warehouseCode} · ${task.warehouseName}`}
                  </TaskField>
                  <TaskField label={t("tasks.processType")}>
                    {goodsReceiptEnumLabel(t, "processType", task.processType)}
                  </TaskField>
                  <TaskField label={t("labelStrategy")}>
                    {LABEL_STRATEGY_KEYS[task.labelStrategy]
                      ? t(LABEL_STRATEGY_KEYS[task.labelStrategy])
                      : task.labelStrategy || "—"}
                  </TaskField>
                  <TaskField label={t("tasks.modal.info.priority")}>
                    {String(task.priority)}
                  </TaskField>
                  <TaskField label={t("tasks.modal.info.planned")}>
                    {formatProjectNumber(task.plannedQuantity)}
                  </TaskField>
                  <TaskField label={t("tasks.modal.table.received")}>
                    {formatProjectNumber(task.processedQuantity)}
                  </TaskField>
                  <TaskField label={t("tasks.modal.info.started")}>
                    {task.startedAtUtc ? formatProjectDateTime(task.startedAtUtc) : "—"}
                  </TaskField>
                  <TaskField label={t("tasks.modal.info.due")}>
                    {task.dueAtUtc ? formatProjectDateTime(task.dueAtUtc) : "—"}
                  </TaskField>
                  <TaskField label={t("list.line")}>{String(task.lineCount)}</TaskField>
                </div>
              </div>

              <section className="wms-ops-task-panel">
                <div className="wms-ops-task-panel__head">
                  <div className="wms-ops-task-panel__title-row">
                    <span className="wms-ops-task-panel__icon" aria-hidden>
                      <UserRoundCog className="size-3.5" />
                    </span>
                    <h3 className="wms-ops-task-panel__title">
                      {t("tasks.modal.assignments.currentTitle")}
                    </h3>
                  </div>
                  <span className="wms-ops-task-panel__count">
                    {t("tasks.modal.assignments.selectedCount", {
                      count: detail.assignments.length,
                    })}
                  </span>
                </div>
                <div className="wms-ops-task-panel__body">
                  {detail.assignments.length === 0 ? (
                    <div className="wms-ops-task-empty">
                      {t("tasks.modal.assignments.noneAssigned")}
                    </div>
                  ) : (
                    <div className="wms-ops-task-assignees">
                      {detail.assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="wms-ops-task-assignee wms-ops-task-assignee--readonly"
                        >
                          <div className="wms-ops-task-assignee__body">
                            <span className="wms-ops-task-assignee__name">
                              {assignment.displayName || assignment.username}
                            </span>
                            <span className="wms-ops-task-assignee__meta">
                              {assignment.username}
                            </span>
                          </div>
                          <OpsStatusBadge tone={inferOpsStatusTone(assignment.status)}>
                            {goodsReceiptEnumLabel(t, "assignmentStatus", assignment.status)}
                          </OpsStatusBadge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent
            value="lines"
            className="wms-ops-scrollbar mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
          >
            <section className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="wms-ops-detail-section-title !border-0 !p-0">
                    {t("tasks.modal.tabs.lines")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("list.linesShown", {
                      visible: visibleLines.length,
                      total: detail.lines.length,
                    })}
                  </p>
                </div>
                <label className="relative block w-full sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={lineSearch}
                    onChange={(event) => setLineSearch(event.target.value)}
                    className="input wms-ops-detail-search min-h-11 !pl-10"
                    placeholder={t("list.lineSearchPlaceholder")}
                    aria-label={t("list.lineSearchAria")}
                  />
                </label>
              </div>

              {visibleLines.length === 0 ? (
                <div className="wms-ops-task-empty">
                  <PackageOpen className="size-7 opacity-40" aria-hidden />
                  {t("list.noMatchingLines")}
                </div>
              ) : (
                <div className="wms-ops-gr-detail-lines-wrap overflow-x-auto">
                  <table className="wms-ops-gr-detail-lines-table w-full min-w-[880px] text-sm">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t("list.stock")}</th>
                        <th>{t("list.yap")}</th>
                        <th className="wms-ops-gr-detail-lines-table__num">
                          {t("tasks.modal.info.planned")}
                        </th>
                        <th className="wms-ops-gr-detail-lines-table__num">
                          {t("tasks.modal.table.received")}
                        </th>
                        <th className="wms-ops-gr-detail-lines-table__num">
                          {t("list.remaining")}
                        </th>
                        <th>{t("list.status")}</th>
                        <th>{t("list.quality")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLines.map((line) => (
                        <tr key={line.id}>
                          <td>{line.sequenceNo}</td>
                          <td>
                            <StockIdentityCell
                              stockId={line.stockId}
                              stockCode={line.stockCode}
                              stockName={line.stockName}
                              branchCode={task.branchCode}
                              nameClassName="wms-ops-gr-detail-lines-table__muted"
                            />
                          </td>
                          <td>{line.yapCode || "—"}</td>
                          <td className="wms-ops-gr-detail-lines-table__num">
                            {`${formatProjectNumber(line.plannedQuantity)} ${line.unitCode}`}
                          </td>
                          <td className="wms-ops-gr-detail-lines-table__num">
                            {formatProjectNumber(line.processedQuantity)}
                          </td>
                          <td className="wms-ops-gr-detail-lines-table__num wms-ops-gr-detail-lines-table__accent">
                            {formatProjectNumber(
                              Math.max(0, line.plannedQuantity - line.processedQuantity),
                            )}
                          </td>
                          <td>
                            <OpsStatusBadge tone={inferOpsStatusTone(line.status)}>
                              {goodsReceiptEnumLabel(t, "lineStatus", line.status)}
                            </OpsStatusBadge>
                          </td>
                          <td>
                            <span
                              className={cn(
                                "wms-ops-task-line-flag",
                                line.requireQualityControl
                                  ? "wms-ops-task-line-flag--quality"
                                  : "wms-ops-task-line-flag--direct",
                              )}
                            >
                              {line.requireQualityControl
                                ? t("tasks.modal.line.qualityRequired")
                                : t("tasks.modal.line.directDispatch")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent
            value="ops"
            className="wms-ops-scrollbar mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
          >
            {assignedOnly ? (
              <div className="space-y-3">
                {task.labelStrategy === "PreGenerate" && (
                  <PreLabelPanel
                    detail={detail}
                    onLabelsChanged={() => setLabelsRevision((value) => value + 1)}
                  />
                )}
                {task.labelStrategy === "GenerateOnReceipt" && (
                  <ReceiptGeneratedLabelsPanel detail={detail} />
                )}
                {task.status === "InProgress" ? (
                  <TaskScanPanel
                    detail={detail}
                    labelsRevision={labelsRevision}
                    reload={reload}
                  />
                ) : (
                  <div className="wms-ops-task-note">
                    {t("tasks.modal.scan.startFirst")}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <AssigneePickerPanel
                  users={users}
                  selectedUsers={selectedUsers}
                  setSelectedUsers={setSelectedUsers}
                  busy={busy}
                  save={save}
                />
                {task.labelStrategy === "PreGenerate" && (
                  <PreLabelPanel
                    detail={detail}
                    onLabelsChanged={() => setLabelsRevision((value) => value + 1)}
                  />
                )}
                {task.labelStrategy === "GenerateOnReceipt" && (
                  <ReceiptGeneratedLabelsPanel detail={detail} />
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AssigneePickerPanel({
  users,
  selectedUsers,
  setSelectedUsers,
  busy,
  save,
}: {
  users: ActiveUserOption[];
  selectedUsers: number[];
  setSelectedUsers: (ids: number[]) => void;
  busy: boolean;
  save: () => void;
}): ReactElement {
  const { t } = useModuleTranslation("goods-receipt-v2");
  const [search, setSearch] = useState("");
  const normalized = search.trim().toLocaleUpperCase("tr-TR");
  const visibleUsers = useMemo(() => {
    if (!normalized) return users;
    return users.filter((user) =>
      [user.firstName, user.lastName, user.username, user.email].some((value) =>
        String(value ?? "")
          .toLocaleUpperCase("tr-TR")
          .includes(normalized),
      ),
    );
  }, [normalized, users]);
  const visibleIds = visibleUsers.map((user) => user.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedUsers.includes(id));

  const toggle = (id: number) =>
    setSelectedUsers(
      selectedUsers.includes(id)
        ? selectedUsers.filter((x) => x !== id)
        : [...selectedUsers, id],
    );
  const toggleVisible = () =>
    setSelectedUsers(
      allVisibleSelected
        ? selectedUsers.filter((id) => !visibleIds.includes(id))
        : [...new Set([...selectedUsers, ...visibleIds])],
    );

  return (
    <section className="wms-ops-task-panel">
      <div className="wms-ops-task-panel__head">
        <div className="wms-ops-task-panel__title-row">
          <span className="wms-ops-task-panel__icon" aria-hidden>
            <UserRoundCog className="size-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="wms-ops-task-panel__title">
              {t("createFlow.assignees.title")}
            </h3>
            <p className="wms-ops-task-panel__hint">
              {t("tasks.modal.assignments.hint")}
            </p>
          </div>
        </div>
        <span className="wms-ops-task-panel__count">
          {t("tasks.modal.assignments.selectedCount", { count: selectedUsers.length })}
        </span>
        <div className="wms-ops-task-panel__actions">
          <label className="relative block w-48">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input min-h-9 !pl-9 text-sm"
              placeholder={t("tasks.modal.assignments.searchPlaceholder")}
              aria-label={t("tasks.modal.assignments.searchPlaceholder")}
            />
          </label>
          <button
            type="button"
            className="wms-ops-task-chip-btn"
            disabled={visibleIds.length === 0}
            onClick={toggleVisible}
          >
            <ListChecks className="size-3.5" />
            {allVisibleSelected
              ? t("tasks.modal.assignments.clearVisible")
              : t("tasks.modal.assignments.selectVisible")}
          </button>
          <OpsActionButton
            onClick={save}
            loading={busy}
            disabled={selectedUsers.length === 0}
          >
            <Save className="size-4" />
            {t("tasks.modal.actions.saveAssignments")}
          </OpsActionButton>
        </div>
      </div>
      <div className="wms-ops-task-panel__body">
        {visibleUsers.length === 0 ? (
          <div className="wms-ops-task-empty">
            {t("tasks.modal.assignments.noUsers")}
          </div>
        ) : (
          <div className="wms-ops-task-assignees">
            {visibleUsers.map((user) => {
              const checked = selectedUsers.includes(user.id);
              const name =
                `${user.firstName} ${user.lastName}`.trim() || user.username;
              return (
                <div
                  key={user.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(user.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggle(user.id);
                    }
                  }}
                  className={cn(
                    "wms-ops-task-assignee",
                    checked && "wms-ops-task-assignee--selected",
                  )}
                >
                  <OpsSkinCheckbox
                    checked={checked}
                    onCheckedChange={() => toggle(user.id)}
                    aria-label={name}
                  />
                  <span className="wms-ops-task-assignee__body">
                    <span className="wms-ops-task-assignee__name">{name}</span>
                    <span
                      className="wms-ops-task-assignee__meta"
                      title={`${user.username} · ${user.email}`}
                    >
                      {`${user.username} · ${user.email}`}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function LifecycleButton({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: ReactElement;
  onClick: () => void;
  disabled?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "wms-ops-detail-lifecycle__btn",
        disabled && "opacity-45",
      )}
    >
      {icon}
      {label}
    </button>
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
      printReceiptLabels(labels, `${resolveGoodsReceiptWaybillNo(detail.task) || `receipt-${detail.task.goodsReceiptId}`} ${t("tasks.modal.receiptLabels.title").toLowerCase()}`);
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
    <section className="wms-ops-task-panel wms-ops-task-panel--violet">
      <div className="wms-ops-task-panel__head">
        <div className="wms-ops-task-panel__title-row">
          <span className="wms-ops-task-panel__icon" aria-hidden>
            <Tags className="size-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="wms-ops-task-panel__title">
              {t("tasks.modal.receiptLabels.title")}
            </h3>
            <p className="wms-ops-task-panel__hint">
              {t("tasks.modal.receiptLabels.hint")}
            </p>
          </div>
        </div>
        <div className="wms-ops-task-panel__actions">
          <OpsActionButton
            variant="secondary"
            disabled={labels.length === 0}
            loading={busy}
            onClick={() => void print()}
          >
            <Printer className="size-4" />
            {labels.length === 0
              ? t("tasks.modal.receiptLabels.noneYet")
              : t("tasks.modal.receiptLabels.printButton", { count: labels.length })}
          </OpsActionButton>
        </div>
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
    <section className="wms-ops-task-panel">
      <div className="wms-ops-task-panel__head">
        <div className="wms-ops-task-panel__title-row">
          <span className="wms-ops-task-panel__icon" aria-hidden>
            <Tags className="size-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="wms-ops-task-panel__title">
              {t("tasks.modal.preLabel.title")}
            </h3>
            <p className="wms-ops-task-panel__hint">
              {t("tasks.modal.preLabel.hint")}
            </p>
          </div>
        </div>
        <div className="wms-ops-task-panel__actions">
          <OpsActionButton
            disabled={availableLabels.length > 0 || !hasOpenLines}
            loading={busy}
            onClick={() => void create()}
          >
            <Barcode className="size-4" />
            {availableLabels.length > 0
              ? t("tasks.modal.preLabel.activeExists")
              : hasOpenLines
                ? t("tasks.modal.preLabel.createButton")
                : t("tasks.modal.preLabel.noOpenLines")}
          </OpsActionButton>
        </div>
      </div>
      {availableLabels.length > 0 && (
        <div className="wms-ops-task-panel__body">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <strong className="block truncate font-mono text-sm">
                {generated?.batch.batchNo ?? detail.task.taskNo}
              </strong>
              <span className="text-xs text-slate-500">
                {t("tasks.modal.preLabel.statusLine", {
                  count: availableLabels.length,
                  printed: printedCount,
                })}
              </span>
            </div>
            <OpsActionButton
              variant="secondary"
              loading={busy}
              onClick={() => void print()}
            >
              <Printer className="size-4" />
              {printedCount === availableLabels.length
                ? t("tasks.modal.preLabel.reprintButton")
                : t("tasks.modal.preLabel.printButton")}
            </OpsActionButton>
          </div>
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
    <section className="space-y-3">
      {requiresPreLabel && (
        <div
          className={cn(
            "wms-ops-task-note",
            printedLabels.length === 0 && "wms-ops-task-note--warn",
          )}
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
      <section className="wms-ops-task-panel wms-ops-task-panel--emerald">
        <div className="wms-ops-task-panel__head">
          <div className="wms-ops-task-panel__title-row">
            <span className="wms-ops-task-panel__icon" aria-hidden>
              <ScanLine className="size-3.5" />
            </span>
            <div className="min-w-0">
              <h3 className="wms-ops-task-panel__title">
                {t("tasks.modal.scan.resolvedTitle")}
              </h3>
              <p className="wms-ops-task-panel__hint">
                {t("tasks.modal.scan.resolvedHint")}
              </p>
            </div>
          </div>
        </div>
        <div className="wms-ops-task-panel__body wms-ops-task-form-grid">
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
          <OpsActionButton
            disabled={!hasValidBarcode}
            loading={busy}
            onClick={() => void submit()}
            className="justify-center"
          >
            <Check className="size-4" />
            {selectedLine?.requireQualityControl
              ? t("createFlow.sendToQuality")
              : t("createFlow.createDirect")}
          </OpsActionButton>
        </div>
      </section>
    </section>
  );
}

function TaskField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="wms-ops-detail-field">
      <span className="wms-ops-detail-field__label">{label}</span>
      <span className="wms-ops-detail-field__value">{children}</span>
    </div>
  );
}
function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
export const GoodsReceiptAssignedTasksPage = (): ReactElement => (
  <GoodsReceiptTasksPage assignedOnly />
);
