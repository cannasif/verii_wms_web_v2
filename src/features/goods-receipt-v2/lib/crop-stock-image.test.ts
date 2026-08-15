import { describe, expect, it } from "vitest";
import { clampCrop, FULL_CROP, isNearlyFullCrop } from "./crop-stock-image";

describe("crop-stock-image", () => {
  it("keeps a full crop inside bounds", () => {
    expect(clampCrop(FULL_CROP)).toEqual(FULL_CROP);
    expect(isNearlyFullCrop(FULL_CROP)).toBe(true);
  });

  it("rejects a crop that would leave the image", () => {
    const crop = clampCrop({ x: 0.8, y: 0.8, width: 0.5, height: 0.5 });
    expect(crop.x + crop.width).toBeLessThanOrEqual(1);
    expect(crop.y + crop.height).toBeLessThanOrEqual(1);
    expect(isNearlyFullCrop(crop)).toBe(false);
  });
});
