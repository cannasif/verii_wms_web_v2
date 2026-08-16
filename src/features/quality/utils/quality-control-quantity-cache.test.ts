import { describe, expect, it } from "vitest";
import {
  applyQualityControlQuantityCache,
  clearQualityControlQuantityCache,
  extractQualityControlQuantityCache,
  qualityControlQuantityCacheKey,
  readQualityControlQuantityCache,
  writeQualityControlQuantityCache,
} from "./quality-control-quantity-cache";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
    data,
  };
}

describe("quality control quantity cache", () => {
  it("writes and reads only lines that have a typed quantity", () => {
    const storage = memoryStorage();
    writeQualityControlQuantityCache(
      7,
      11,
      extractQualityControlQuantityCache(
        {
          1: { inspectedQuantity: "5", confirmedInspectedQuantity: "5" },
          2: { inspectedQuantity: "", confirmedInspectedQuantity: "" },
        },
        [
          { id: 1, inspectedQuantity: 0 },
          { id: 2, inspectedQuantity: 0 },
        ],
      ),
      storage,
    );

    expect(readQualityControlQuantityCache(7, 11, storage)).toEqual({
      1: {
        inspectedQuantity: "5",
        confirmedInspectedQuantity: "5",
        baselineInspectedQuantity: 0,
      },
    });
    expect(storage.data[qualityControlQuantityCacheKey(7, 11)]).toBeTruthy();
  });

  it("restores the typed quantity after a refresh when the server still has the same baseline", () => {
    const restored = applyQualityControlQuantityCache(
      { 1: { inspectedQuantity: "", confirmedInspectedQuantity: "" } },
      [{ id: 1, inspectedQuantity: 0, remainingInspectable: 10 }],
      {
        1: {
          inspectedQuantity: "5",
          confirmedInspectedQuantity: "5",
          baselineInspectedQuantity: 0,
        },
      },
      Number,
    );

    expect(restored[1]).toEqual({
      inspectedQuantity: "5",
      confirmedInspectedQuantity: "5",
    });
  });

  it("does not restore after pause already persisted the quantity", () => {
    const restored = applyQualityControlQuantityCache(
      { 1: { inspectedQuantity: "", confirmedInspectedQuantity: "" } },
      [{ id: 1, inspectedQuantity: 5, remainingInspectable: 5 }],
      {
        1: {
          inspectedQuantity: "5",
          confirmedInspectedQuantity: "5",
          baselineInspectedQuantity: 0,
        },
      },
      Number,
    );

    expect(restored[1]).toEqual({
      inspectedQuantity: "",
      confirmedInspectedQuantity: "",
    });
  });

  it("does not restore when the lot is already fully inspected", () => {
    const restored = applyQualityControlQuantityCache(
      { 1: { inspectedQuantity: "", confirmedInspectedQuantity: "" } },
      [{ id: 1, inspectedQuantity: 10, remainingInspectable: 0 }],
      {
        1: {
          inspectedQuantity: "4",
          confirmedInspectedQuantity: "4",
          baselineInspectedQuantity: 10,
        },
      },
      Number,
    );

    expect(restored[1].inspectedQuantity).toBe("");
  });

  it("clears the stored entry", () => {
    const storage = memoryStorage();
    writeQualityControlQuantityCache(
      7,
      11,
      {
        1: {
          inspectedQuantity: "5",
          confirmedInspectedQuantity: "5",
          baselineInspectedQuantity: 0,
        },
      },
      storage,
    );
    clearQualityControlQuantityCache(7, 11, storage);
    expect(readQualityControlQuantityCache(7, 11, storage)).toEqual({});
  });
});
