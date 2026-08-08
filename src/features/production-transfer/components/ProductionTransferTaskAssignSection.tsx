import { useState, type ReactElement } from 'react';
import { RotateCcw, Trash2, UserPlus } from 'lucide-react';
import { productionTransferApi, type ProductionTask, type ProductionTaskBoard } from '../api';
import { taskLineageHasProgress } from '../production-transfer-task-progress';
import { productionTaskTypeLabel } from '../production-transfer-task-labels';

export function ProductionTransferTaskAssignSection({
  transferId,
  board,
  busy,
  run,
  canAssign,
}: {
  transferId: number;
  board: ProductionTaskBoard;
  busy: boolean;
  run: (action: () => Promise<ProductionTaskBoard>) => Promise<void>;
  canAssign: boolean;
}): ReactElement | null {
  const [selectedUsers, setSelectedUsers] = useState<Record<number, number>>({});
  const [handoffReasons, setHandoffReasons] = useState<Record<number, string>>({});
  const [assignmentTaskId, setAssignmentTaskId] = useState<number | ''>('');

  if (!canAssign || board.tasks.length === 0) return null;

  const assignableTasks = board.tasks.filter((task) => !['Completed', 'Cancelled'].includes(task.status));
  const task = assignableTasks.find((item) => item.taskId === assignmentTaskId)
    ?? assignableTasks[assignableTasks.length - 1];
  const lineageHasProgress = (value?: ProductionTask) =>
    value ? taskLineageHasProgress(value, board.tasks) : false;

  return (
    <div className="rounded-xl border border-[var(--wms-app-border)] p-4">
      <div className="mb-3 flex items-center gap-2 font-bold">
        <UserPlus className="size-4" aria-hidden />
        Görev ataması
      </div>
      <select
        className="input mb-3 w-full sm:max-w-md"
        value={task?.taskId ?? ''}
        onChange={(event) => setAssignmentTaskId(Number(event.target.value))}
      >
        {assignableTasks.length === 0 && <option value="">Atanabilir görev yok</option>}
        {assignableTasks.map((item) => (
          <option key={item.taskId} value={item.taskId}>
            {item.taskNo} · {item.status}
            {lineageHasProgress(item) ? ' · toplanmış stok var' : ''}
          </option>
        ))}
      </select>
      {task ? (
        <div className="flex flex-wrap items-center gap-2">
          {task.assignments.map((assignment) => {
            const hasProgress = lineageHasProgress(task);
            const returnTask = board.tasks.find((item) =>
              item.originTaskId === task.taskId
              && item.originUserId === assignment.userId
              && item.status !== 'Cancelled');
            return (
              <span
                key={assignment.userId}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--wms-app-border)] px-3 py-1 text-xs"
              >
                <span>
                  {assignment.username}
                  {assignment.isPrimary ? ' · Birincil' : ''}
                </span>
                {hasProgress && returnTask && returnTask.status !== 'Completed' ? (
                  <span
                    className="text-amber-500"
                    title={`${returnTask.taskNo} tamamlanmadan atama kaldırılamaz`}
                  >
                    İade bekleniyor
                  </span>
                ) : null}
                {hasProgress && !returnTask ? (
                  <button
                    type="button"
                    title="İade görevi oluştur — atamayı kaldırmadan önce toplanan stok eski rafına konmalı"
                    disabled={busy}
                    onClick={() => void run(() =>
                      productionTransferApi.requestAssignmentReturn(transferId, task.taskId, assignment.userId))}
                  >
                    <RotateCcw className="size-3.5 text-amber-500" aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  title="Atamayı kaldır"
                  disabled={busy}
                  onClick={() => void run(() =>
                    productionTransferApi.removeAssignment(transferId, task.taskId, assignment.userId))}
                >
                  <Trash2 className="size-3.5 text-red-500" aria-hidden />
                </button>
              </span>
            );
          })}
          <select
            className="input min-w-52"
            value={selectedUsers[task.taskId] ?? ''}
            onChange={(event) =>
              setSelectedUsers((current) => ({ ...current, [task.taskId]: Number(event.target.value) }))}
          >
            <option value="">Depo çalışanı seçin</option>
            {board.eligibleAssignees
              .filter((user) =>
                (user.warehouseIds.length === 0 || user.warehouseIds.includes(task.warehouseId))
                && !task.assignments.some((assignment) => assignment.userId === user.userId))
              .map((user) => (
                <option key={user.userId} value={user.userId}>{user.username}</option>
              ))}
          </select>
          <button
            type="button"
            disabled={busy || !selectedUsers[task.taskId]}
            onClick={() => void run(() =>
              productionTransferApi.assignTask(transferId, task.taskId, selectedUsers[task.taskId]))}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--wms-brand-primary)] px-3 py-2 text-xs font-bold text-[var(--wms-brand-primary)]"
          >
            <UserPlus className="size-4" aria-hidden />
            Ata
          </button>
          {task.assignments.length > 0
            && task.lines.some((line) => line.processedQuantity < line.requestedQuantity) ? (
              <>
                <input
                  className="input min-w-56"
                  value={handoffReasons[task.taskId] ?? ''}
                  onChange={(event) =>
                    setHandoffReasons((current) => ({ ...current, [task.taskId]: event.target.value }))}
                  placeholder="Devir nedeni (opsiyonel)"
                />
                <button
                  type="button"
                  disabled={busy || !selectedUsers[task.taskId]}
                  onClick={() => void run(() =>
                    productionTransferApi.handoffTask(
                      transferId,
                      task.taskId,
                      selectedUsers[task.taskId],
                      handoffReasons[task.taskId],
                    ))}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
                >
                  <UserPlus className="size-4" aria-hidden />
                  Kalan işi devret
                </button>
              </>
            ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-[var(--wms-app-text-muted)]">
        İade ataması oluştur, kalan işi devret ve ata işlemleri operasyon panelindeki kurallarla aynıdır.
        Görev türü: {productionTaskTypeLabel(task?.taskType ?? 'Pick')}.
      </p>
    </div>
  );
}
