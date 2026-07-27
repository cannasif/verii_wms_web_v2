import { useCallback, useMemo, useState, type ReactElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Barcode,
  Check,
  Eye,
  Loader2,
  Play,
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
import { WarehouseBarcodeScanner } from "@/features/barcode-resolution/WarehouseBarcodeScanner";
import {
  formatProjectDateTime,
  formatProjectNumber,
} from "@/lib/project-format";
import { goodsReceiptV2Api } from "../api/goods-receipt.api";
import { goodsReceiptEnumLabel } from "../localization/enum-labels";
import type {
  ActiveUserOption,
  GoodsReceiptTaskDetail,
  GoodsReceiptTaskGridRow,
} from "../types/goods-receipt.types";
import { useModuleTranslation } from "@/hooks/useModuleTranslation";

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
        toast.error(message(error, "Emir detayı alınamadı."));
      } finally {
        setBusy(null);
      }
    },
    [assignedOnly, users.length],
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
        kind === "accept" ? "Emir kabul edildi." : "Emir başlatıldı.",
      );
      await refresh();
    } catch (error) {
      toast.error(message(error, "İşlem tamamlanamadı."));
    } finally {
      setBusy(null);
    }
  };
  const saveAssignments = async () => {
    if (!detail || selectedUsers.length === 0) {
      toast.error("En az bir kullanıcı seçin.");
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
      toast.success("Emir atamaları güncellendi.");
      await refresh();
    } catch (error) {
      toast.error(message(error, "Atamalar güncellenemedi."));
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
  const toggle = (id: number) =>
    setSelectedUsers(
      selectedUsers.includes(id)
        ? selectedUsers.filter((x) => x !== id)
        : [...selectedUsers, id],
    );
  return (
    <ResponsiveDialog
      onClose={close}
      title={`Mal kabul emri ${detail.task.taskNo}`}
      description="Emir kalemleri, atamaları ve fiziksel kabul işlemleri."
      className="!max-w-6xl"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-500">
            Mal Kabul Emri
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
          aria-label="Pencereyi kapat"
          className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="size-5" />
        </button>
      </header>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Info
          label="Durum"
          value={goodsReceiptEnumLabel(t, "taskStatus", detail.task.status)}
        />
        <Info
          label="Depo"
          value={`${detail.task.warehouseCode} · ${detail.task.warehouseName}`}
        />
        <Info label="Öncelik" value={String(detail.task.priority)} />
        <Info
          label="Planlanan"
          value={formatProjectNumber(detail.task.plannedQuantity)}
        />
        <Info
          label="Başlama"
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
              <th className="p-3">Stok</th>
              <th className="p-3">Yapı</th>
              <th className="p-3 text-right">Planlanan</th>
              <th className="p-3 text-right">Toplanan</th>
              <th className="p-3">Durum</th>
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
                  <strong>{line.stockCode}</strong>
                  <div className="text-xs text-slate-500">{line.stockName}</div>
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
              Atamayı Kabul Et
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
              Emri Başlat
            </button>
          </div>
          {detail.task.status === "InProgress" && (
            <TaskScanPanel detail={detail} reload={reload} />
          )}
        </>
      ) : (
        <>
          <section className="mt-5 rounded-xl border border-[var(--wms-app-border)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <UserRoundCog className="size-5 text-cyan-500" />
              <h3 className="font-bold">Emir Sorumluları</h3>
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
                Atamaları Kaydet
              </button>
            </div>
          </section>
          <PreLabelPanel detail={detail} />
        </>
      )}
    </ResponsiveDialog>
  );
}

function PreLabelPanel({
  detail,
}: {
  detail: GoodsReceiptTaskDetail;
}): ReactElement {
  const [busy, setBusy] = useState(false);
  const create = async () => {
    const lines = detail.lines
      .filter((x) => x.processedQuantity < x.plannedQuantity)
      .map((x) => ({ taskLineId: x.id, labelCount: 1 }));
    if (lines.length === 0) {
      toast.error("Etiket üretilecek açık emir satırı yok.");
      return;
    }
    setBusy(true);
    try {
      const result = await goodsReceiptV2Api.generateLabels(
        detail.task.goodsReceiptId,
        detail.task.id,
        lines,
        "Emir ön etiket paketi",
      );
      toast.success(
        `${result.batch.totalLabelCount} ön etiket üretildi. Ön Etiketler ekranından yazdırabilirsiniz.`,
      );
    } catch (error) {
      toast.error(message(error, "Ön etiket üretilemedi."));
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
            <h3 className="font-bold">Önceden barkod basma</h3>
            <p className="text-xs text-slate-500">
              Açık satırlar için emir bağlantılı benzersiz etiket oluşturur.
              Etiket yazdırılmadan kabulde kullanılamaz.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Barcode className="size-4" />
          )}
          Ön Etiket Oluştur
        </button>
      </div>
    </section>
  );
}

function TaskScanPanel({
  detail,
  reload,
}: {
  detail: GoodsReceiptTaskDetail;
  reload: () => void;
}): ReactElement {
  const openLines = detail.lines.filter(
    (x) => x.processedQuantity < x.plannedQuantity,
  );
  const [lineId, setLineId] = useState(String(openLines[0]?.id ?? ""));
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lot, setLot] = useState("");
  const [serial, setSerial] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedLine = openLines.find((x) => String(x.id) === lineId);
  const submit = async () => {
    if (!lineId || !barcode.trim()) {
      toast.error("Önce barkodu çözümleyin ve emir satırını doğrulayın.");
      return;
    }
    setBusy(true);
    try {
      const result = await goodsReceiptV2Api.receiveTaskScan(detail.task.id, {
        idempotencyKey: crypto.randomUUID(),
        taskLineId: Number(lineId),
        barcode: barcode.trim(),
        quantity: quantity ? Number(quantity) : undefined,
        lotNo: lot.trim() || undefined,
        serialNo: serial.trim() || undefined,
        manufacturingDate: manufacturingDate || undefined,
        expirationDate: expirationDate || undefined,
        deviceId: navigator.userAgent.slice(0, 100),
      });
      toast.success(
        result.replayed
          ? "Okutma daha önce işlenmişti."
          : "Barkod doğrulandı; seri/lot, stok hareketi, bakiye ve kalite tek işlemde işlendi.",
      );
      setBarcode("");
      setQuantity("");
      setLot("");
      setSerial("");
      setManufacturingDate("");
      setExpirationDate("");
      reload();
    } catch (error) {
      toast.error(message(error, "Barkod kabul edilemedi."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-5 space-y-4">
      <WarehouseBarcodeScanner
        branchCode={detail.task.branchCode ?? "0"}
        purpose="Inbound"
        warehouseId={detail.task.warehouseId}
        expectedStockId={selectedLine?.stockId}
        disabled={busy}
        title="Mal kabul barkodunu okut"
        description="Sistem etiketi, GS1, tedarikçi stok barkodu veya seçili stok için seri barkodu çözümlenir."
        onResolved={(value) => {
          const matched = openLines.find(
            (x) =>
              x.stockId === value.stockId &&
              (!value.yapCode || x.yapCode === value.yapCode),
          );
          if (matched) setLineId(String(matched.id));
          setBarcode(value.rawBarcode);
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
            <h3 className="font-bold">Çözümlenen kabul kaydı</h3>
            <p className="text-xs text-slate-500">
              Son onayda stok hareketi, raf/seri bakiyesi ve gerekiyorsa kalite
              kaydı aynı transaction içinde oluşur.
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
              description: `Kalan ${formatProjectNumber(x.plannedQuantity - x.processedQuantity)} ${x.unitCode}`,
            }))}
          />
          <input
            className="input"
            type="number"
            min="0.000001"
            step="0.000001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Miktar"
          />
          <input
            className="input"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            placeholder="Lot"
          />
          <input
            className="input"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Seri"
          />
          <AppDateInput
            value={manufacturingDate}
            onChange={(e) => setManufacturingDate(e.target.value)}
            aria-label="Üretim tarihi"
          />
          <AppDateInput
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            aria-label="Son kullanma tarihi"
          />
          <button
            type="button"
            disabled={busy || !barcode}
            onClick={() => void submit()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Kabulü işle
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
