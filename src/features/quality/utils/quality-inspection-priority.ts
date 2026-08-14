export function canToggleQualityInspectionPriority(
  status: string,
  prioritizableStatuses: ReadonlySet<string>,
): boolean {
  return prioritizableStatuses.has(status);
}

export function qualityInspectionPriorityRowClass(isPriority: boolean): string | undefined {
  return isPriority
    ? "border-l-4 border-l-rose-500 bg-rose-500/10 hover:bg-rose-500/15 dark:bg-rose-500/10"
    : undefined;
}
