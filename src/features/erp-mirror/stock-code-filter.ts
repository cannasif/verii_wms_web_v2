export const STOCK_CODE_FILTER_DIMENSIONS = [
  'groupCode',
  'code1',
  'code2',
  'code3',
  'code4',
  'code5',
] as const;

export type StockCodeFilterDimension = (typeof STOCK_CODE_FILTER_DIMENSIONS)[number];

export type StockCodeFilterOption = {
  value: string;
  label: string;
};

export type StockCodeFilterSelections = Record<StockCodeFilterDimension, string[]>;

export const EMPTY_STOCK_CODE_FILTER_SELECTIONS: StockCodeFilterSelections = {
  groupCode: [],
  code1: [],
  code2: [],
  code3: [],
  code4: [],
  code5: [],
};

export function createEmptyStockCodeFilterSelections(): StockCodeFilterSelections {
  return {
    groupCode: [],
    code1: [],
    code2: [],
    code3: [],
    code4: [],
    code5: [],
  };
}

export function countStockCodeFilterSelections(selections: StockCodeFilterSelections): number {
  return STOCK_CODE_FILTER_DIMENSIONS.reduce((sum, dimension) => sum + selections[dimension].length, 0);
}

export function hasStockCodeFilterSelection(selections: StockCodeFilterSelections): boolean {
  return countStockCodeFilterSelections(selections) > 0;
}

export function cloneStockCodeFilterSelections(
  selections: StockCodeFilterSelections,
): StockCodeFilterSelections {
  return {
    groupCode: [...selections.groupCode],
    code1: [...selections.code1],
    code2: [...selections.code2],
    code3: [...selections.code3],
    code4: [...selections.code4],
    code5: [...selections.code5],
  };
}

export function stockCodeFilterSelectionsEqual(
  left: StockCodeFilterSelections,
  right: StockCodeFilterSelections,
): boolean {
  return STOCK_CODE_FILTER_DIMENSIONS.every(
    (dimension) => left[dimension].join('|') === right[dimension].join('|'),
  );
}

export function toggleStockCodeFilterValue(
  selections: StockCodeFilterSelections,
  dimension: StockCodeFilterDimension,
  value: string,
): StockCodeFilterSelections {
  const current = selections[dimension];
  const nextValues = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return { ...selections, [dimension]: nextValues };
}

export function readStockCodeFieldValue(
  row: object,
  dimension: StockCodeFilterDimension,
): string | undefined {
  const record = row as Record<string, unknown>;
  const aliases: Record<StockCodeFilterDimension, string[]> = {
    groupCode: ['groupCode', 'GroupCode', 'grupKodu', 'GrupKodu'],
    code1: ['code1', 'Code1', 'kod1', 'Kod1'],
    code2: ['code2', 'Code2', 'kod2', 'Kod2'],
    code3: ['code3', 'Code3', 'kod3', 'Kod3'],
    code4: ['code4', 'Code4', 'kod4', 'Kod4'],
    code5: ['code5', 'Code5', 'kod5', 'Kod5'],
  };

  for (const key of aliases[dimension]) {
    const raw = record[key];
    if (raw == null) continue;
    const value = String(raw).trim();
    if (value) return value;
  }
  return undefined;
}

export function extractStockCodeFilterOptions(
  rows: object[],
): Record<StockCodeFilterDimension, StockCodeFilterOption[]> {
  const result = {} as Record<StockCodeFilterDimension, StockCodeFilterOption[]>;
  for (const dimension of STOCK_CODE_FILTER_DIMENSIONS) {
    const byValue = new Map<string, string>();
    for (const row of rows) {
      const value = readStockCodeFieldValue(row, dimension);
      if (!value) continue;
      if (!byValue.has(value)) byValue.set(value, value);
    }
    result[dimension] = Array.from(byValue.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  }
  return result;
}

export function stockMatchesCodeFilterSelections(
  row: object,
  selections: StockCodeFilterSelections,
): boolean {
  return STOCK_CODE_FILTER_DIMENSIONS.every((dimension) => {
    const selected = selections[dimension];
    if (selected.length === 0) return true;
    const value = readStockCodeFieldValue(row, dimension);
    return value != null && selected.includes(value);
  });
}

export function filterStockCodeOptions(
  options: StockCodeFilterOption[],
  search: string,
): StockCodeFilterOption[] {
  const query = search.trim().toLocaleLowerCase('tr');
  if (!query) return options;
  return options.filter((option) => {
    const label = option.label.toLocaleLowerCase('tr');
    const value = option.value.toLocaleLowerCase('tr');
    return label.includes(query) || value.includes(query);
  });
}
