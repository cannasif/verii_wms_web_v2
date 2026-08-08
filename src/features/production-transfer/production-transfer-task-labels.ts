export const PRODUCTION_TASK_TYPE_LABELS: Record<string, string> = {
  Pick: 'Toplama',
  Dispatch: 'Sevk',
  Receive: 'Kabul',
  Putaway: 'Yerleştirme',
  CancellationReturn: 'İptal İadesi',
  AssignmentReturn: 'İade',
};

export const productionTaskTypeLabel = (type: string): string =>
  PRODUCTION_TASK_TYPE_LABELS[type] ?? type;
