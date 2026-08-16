import { describe, expect, it } from "vitest";
import {
  collectQualityProgressControlQuantities,
  formatQualityWorkOperatorName,
  resolveDecisionControlQuantity,
} from "./quality-work-operator";

describe("resolveDecisionControlQuantity", () => {
  it("does not require another entry when the lot is already fully inspected", () => {
    expect(resolveDecisionControlQuantity(null, 0, 0)).toEqual({
      additional: 0,
      missingRequired: false,
    });
    expect(resolveDecisionControlQuantity(5, 0, 0)).toEqual({
      additional: 0,
      missingRequired: false,
    });
  });

  it("still requires the outstanding sample when more can be inspected", () => {
    expect(resolveDecisionControlQuantity(null, 95, 7)).toEqual({
      additional: 0,
      missingRequired: true,
    });
    expect(resolveDecisionControlQuantity(7, 95, 7)).toEqual({
      additional: 7,
      missingRequired: false,
    });
    expect(resolveDecisionControlQuantity(5, 95, 7)).toEqual({
      additional: 5,
      missingRequired: false,
    });
  });
});

describe("collectQualityProgressControlQuantities", () => {
  it("prefers the confirmed physical control quantity", () => {
    expect(
      collectQualityProgressControlQuantities(
        [{ id: 1 }, { id: 1 }],
        { 1: { confirmedInspectedQuantity: "10", inspectedQuantity: "4" } },
        Number,
      ),
    ).toEqual([{ lineId: 1, inspectedQuantity: 10 }]);
  });

  it("falls back to the typed quantity when confirm was not pressed", () => {
    expect(
      collectQualityProgressControlQuantities(
        [{ id: 2 }],
        { 2: { inspectedQuantity: "6" } },
        Number,
      ),
    ).toEqual([{ lineId: 2, inspectedQuantity: 6 }]);
  });
});

describe("formatQualityWorkOperatorName", () => {
  it("returns null when nobody started or stopped work", () => {
    expect(formatQualityWorkOperatorName(null, null)).toBeNull();
    expect(formatQualityWorkOperatorName("  ", "")).toBeNull();
  });

  it("shows the starter while work is running", () => {
    expect(formatQualityWorkOperatorName("Ali Yılmaz", null)).toBe("Ali Yılmaz");
  });

  it("collapses the same starter and stopper into one name", () => {
    expect(formatQualityWorkOperatorName("Ali Yılmaz", "Ali Yılmaz")).toBe("Ali Yılmaz");
  });

  it("shows both names when another user stopped the session", () => {
    expect(formatQualityWorkOperatorName("Ali Yılmaz", "Ayşe Demir")).toBe("Ali Yılmaz → Ayşe Demir");
  });
});
