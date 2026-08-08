import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  matchesSerialMask,
  maxSerialRowCount,
  serialMaskToRegExp,
} from "./serial-mask";

describe("serialMaskToRegExp", () => {
  it("matches stock + date + sequence mask", () => {
    const re = serialMaskToRegExp("{STOCK}-{YY}{MM}-{N:6}", "ABC");
    assert.equal(re.test("ABC-2508-000001"), true);
    assert.equal(re.test("ABC-2508-1"), false);
    assert.equal(re.test("XYZ-2508-000001"), false);
  });
});

describe("matchesSerialMask", () => {
  it("allows any serial when mask is empty", () => {
    assert.equal(matchesSerialMask("ANY-1", null), true);
    assert.equal(matchesSerialMask("ANY-1", "   "), true);
  });

  it("rejects empty serial", () => {
    assert.equal(matchesSerialMask("  ", "{N:3}"), false);
  });

  it("validates against mask and stock code", () => {
    assert.equal(
      matchesSerialMask("ST1-2608-000042", "{STOCK}-{YY}{MM}-{N:6}", {
        stockCode: "ST1",
      }),
      true,
    );
    assert.equal(
      matchesSerialMask("bad", "{STOCK}-{YY}{MM}-{N:6}", { stockCode: "ST1" }),
      false,
    );
  });

  it("accepts bracket STOCK and hyphen N width", () => {
    assert.equal(
      matchesSerialMask("03/002-2608-000001", "[STOCK]-{YY}{MM}-{N-6}", {
        stockCode: "03/002",
      }),
      true,
    );
    assert.equal(
      matchesSerialMask("ilişlişliş", "[STOCK]-{YY}{MM}-{N-6}", {
        stockCode: "03/002",
      }),
      false,
    );
  });
});

describe("maxSerialRowCount", () => {
  it("floors positive quantities and clamps non-positive", () => {
    assert.equal(maxSerialRowCount(2), 2);
    assert.equal(maxSerialRowCount(2.9), 2);
    assert.equal(maxSerialRowCount(0), 0);
    assert.equal(maxSerialRowCount(-1), 0);
  });
});
