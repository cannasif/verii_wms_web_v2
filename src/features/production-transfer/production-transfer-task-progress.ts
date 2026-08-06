import type { ProductionTask } from './api';

// Devret sonrası satırlar çocuk göreve taşınır; plan paydası aynı görev tipindeki tüm görevlerin
// transferLineId bazında tekilleştirilmiş istenen miktarından, işlenen ise kullanıcının startedBy
// olduğu görevlerdeki toplanan miktardan hesaplanır.
export function taskLineageHasProgress(task: ProductionTask, tasks: ProductionTask[]): boolean {
  let cursor: ProductionTask | undefined = task;
  while (cursor) {
    if (cursor.lines.some((line) => line.processedQuantity > 0)) return true;
    cursor = tasks.find((t) => t.taskId === cursor?.previousTaskId);
  }
  return false;
}

/**
 * Kullanıcının görev tipindeki tamamlanma yüzdesi.
 * Plan: aynı tipteki tüm görevlerin transferLineId bazında tekilleştirilmiş istenen miktarı.
 * İşlenen: kullanıcının startedBy olduğu görevlerdeki toplanan miktar.
 */
export function computeProductionTaskProgress(task: ProductionTask, allTasks: ProductionTask[], userId: number) {
  const seenLineIds = new Set<number>();
  let planned = 0;
  for (const t of allTasks) {
    if (t.taskType !== task.taskType || t.status === 'Cancelled') continue;
    for (const line of t.lines) {
      if (seenLineIds.has(line.transferLineId)) continue;
      seenLineIds.add(line.transferLineId);
      planned += line.totalRequestedQuantity;
    }
  }
  const processed = allTasks
    .filter((t) => t.taskType === task.taskType && t.status !== 'Cancelled' && t.startedBy === userId)
    .flatMap((t) => t.lines)
    .reduce((sum, line) => sum + Math.min(line.totalRequestedQuantity, line.processedQuantity), 0);
  return {
    planned,
    processed,
    percent: planned <= 0 ? 0 : Math.round(processed * 10000 / planned) / 100,
  };
}
