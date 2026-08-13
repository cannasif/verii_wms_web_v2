import { describe, expect, it } from "vitest";
import {
  canToggleQualityInspectionPriority,
  qualityInspectionPriorityRowClass,
} from "./quality-inspection-priority";

describe("quality inspection priority", () => {
  it.each(["Pending", "InProgress", "PartiallyDecided", "Quarantined"])(
    "allows open status %s",
    (status) => expect(canToggleQualityInspectionPriority(status)).toBe(true),
  );

  it.each(["Passed", "Failed", "Released", "Cancelled"])(
    "blocks terminal status %s",
    (status) => expect(canToggleQualityInspectionPriority(status)).toBe(false),
  );

  it("returns a red row emphasis only for prioritized records", () => {
    expect(qualityInspectionPriorityRowClass(true)).toContain("rose-500");
    expect(qualityInspectionPriorityRowClass(false)).toBeUndefined();
  });
});
