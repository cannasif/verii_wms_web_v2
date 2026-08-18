import { describe, expect, it } from 'vitest';
import type { ProductionTransferPickingRow } from './api';
import {
  applyRacklessPickQuantityCap,
  expandRacklessPartialShortageRows,
  hasRacklessRowShortage,
  resolveRacklessStockBalanceTone,
} from './production-transfer-rackless-picking';

function row(overrides: Partial<ProductionTransferPickingRow> = {}): ProductionTransferPickingRow {
  return {
    taskLineId: 1,
    wtLineId: 10,
    lineNo: 1,
    sourceLocationId: 26,
    sourceLocationCode: '01/026',
    stockId: 13,
    stockCode: '01/013',
    requestedQuantity: 3,
    remainingQuantity: 3,
    processedQuantity: 0,
    canPick: true,
    ...overrides,
  };
}

describe('rackless picking display', () => {
  it('treats assigned default location without pickable balance as shortage', () => {
    const assigned = row({ canPick: false });

    expect(hasRacklessRowShortage(assigned)).toBe(true);
    expect(resolveRacklessStockBalanceTone(assigned)).toBe('shortage');
  });

  it('keeps reserved or available rows stocked even when lookup available is zero', () => {
    expect(resolveRacklessStockBalanceTone(row({ canPick: true }))).toBe('stocked');
  });

  it('splits a frozen canPick=false row when later balance covers only part of remaining', () => {
    const lookup = new Map([['13|26', 2]]);
    const expanded = expandRacklessPartialShortageRows([row({ canPick: false })], lookup);

    expect(expanded).toHaveLength(2);
    expect(expanded[0]).toMatchObject({ remainingQuantity: 2, canPick: true, displaySplit: 'stocked' });
    expect(expanded[1]).toMatchObject({ remainingQuantity: 1, canPick: false, displaySplit: 'shortage' });
  });

  it('splits any remaining/available mix, not only a 2/1 case', () => {
    const cases = [
      { remaining: 8, available: 5, pickable: 5, missing: 3 },
      { remaining: 10, available: 1, pickable: 1, missing: 9 },
      { remaining: 4.5, available: 0.5, pickable: 0.5, missing: 4 },
    ];

    for (const item of cases) {
      const expanded = expandRacklessPartialShortageRows(
        [row({ remainingQuantity: item.remaining, requestedQuantity: item.remaining, canPick: false })],
        new Map([['13|26', item.available]]),
      );

      expect(expanded).toHaveLength(2);
      expect(expanded[0]).toMatchObject({ remainingQuantity: item.pickable, canPick: true, displaySplit: 'stocked' });
      expect(expanded[1]).toMatchObject({ remainingQuantity: item.missing, canPick: false, displaySplit: 'shortage' });
    }
  });

  it('marks a fully covered frozen row pickable without splitting', () => {
    const expanded = expandRacklessPartialShortageRows(
      [row({ canPick: false, remainingQuantity: 3 })],
      new Map([['13|26', 10]]),
    );

    expect(expanded).toHaveLength(1);
    expect(expanded[0].canPick).toBe(true);
    expect(expanded[0].displaySplit).toBeUndefined();
    expect(expanded[0].remainingQuantity).toBe(3);
  });

  it('keeps a reserved row stocked when lookup available is zero', () => {
    const expanded = expandRacklessPartialShortageRows(
      [row({ canPick: true })],
      new Map([['13|26', 0]]),
    );

    expect(expanded).toHaveLength(1);
    expect(expanded[0].canPick).toBe(true);
    expect(expanded[0].displaySplit).toBeUndefined();
  });

  it('does not change a different stock row when only one stock lookup is refreshed', () => {
    const other = row({
      taskLineId: 2,
      wtLineId: 11,
      lineNo: 2,
      stockId: 99,
      stockCode: '01/099',
      canPick: false,
    });
    const expanded = expandRacklessPartialShortageRows(
      [row({ canPick: false }), other],
      new Map([['13|26', 2]]),
    );

    expect(expanded).toHaveLength(3);
    expect(expanded[0].stockId).toBe(13);
    expect(expanded[0].displaySplit).toBe('stocked');
    expect(expanded[2]).toMatchObject({ stockId: 99, canPick: false, remainingQuantity: 3 });
    expect(expanded[2].displaySplit).toBeUndefined();
  });
});

describe('rackless pick quantity cap', () => {
  function match(overrides: Partial<import('./api').ResolveProductionTransferBarcodeResult> = {}) {
    return {
      taskLineId: 1,
      wtLineId: 10,
      sourceLocationId: 26,
      sourceLocationCode: '01/026',
      stockId: 13,
      stockCode: '01/013',
      remainingQuantity: 3,
      maxPickQuantity: 3,
      defaultQuantity: 3,
      isSerial: false,
      canPick: true,
      ...overrides,
    };
  }

  it('caps pick quantity to available balance for any remaining/available mix', () => {
    const cases = [
      { remaining: 3, available: 2, expected: 2 },
      { remaining: 8, available: 5, expected: 5 },
      { remaining: 10, available: 1, expected: 1 },
      { remaining: 3, available: 10, expected: 3 },
    ];

    for (const item of cases) {
      const capped = applyRacklessPickQuantityCap(
        match({ remainingQuantity: item.remaining, maxPickQuantity: item.remaining, defaultQuantity: item.remaining }),
        new Map([['13|26', item.available]]),
        true,
      );
      expect(capped.maxPickQuantity).toBe(item.expected);
      expect(capped.defaultQuantity).toBe(item.expected);
      expect(capped.remainingQuantity).toBe(item.expected);
    }
  });

  it('does not zero out reserved picks when available is 0', () => {
    const capped = applyRacklessPickQuantityCap(match(), new Map([['13|26', 0]]), true);
    expect(capped.maxPickQuantity).toBe(3);
    expect(capped.defaultQuantity).toBe(3);
    expect(capped.remainingQuantity).toBe(3);
  });

  it('does not change serial or racked (disabled) matches', () => {
    const serial = applyRacklessPickQuantityCap(
      match({ isSerial: true }),
      new Map([['13|26', 2]]),
      true,
    );
    const racked = applyRacklessPickQuantityCap(match(), new Map([['13|26', 2]]), false);

    expect(serial.maxPickQuantity).toBe(3);
    expect(racked.maxPickQuantity).toBe(3);
  });
});
