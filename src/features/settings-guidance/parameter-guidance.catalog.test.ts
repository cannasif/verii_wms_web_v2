import { describe, expect, it } from "vitest";
import { parameterGuidance } from "./parameter-guidance.catalog";

describe("parameter guidance catalog", () => {
  it.each([
    ["goodsReceipt", "erpPostingPolicy", "AfterQualityApproval"],
    ["quality", "defaultFailAction", "ReturnToSupplier"],
    ["packing", "closePolicy", "AutoWhenComplete"],
    ["transfer", "directPostingPolicy", "TwoStepTransit"],
    ["production", "productionOrderSource", "ErpAndWms"],
    ["procurement", "supplierQuoteChannelMode", "PortalRequired"],
    ["project", "timeZoneId", "Europe/Istanbul"],
    ["barcode", "prefix", "WMS-S"],
  ] as const)(
    "%s.%s için eksiksiz etki ve senaryo döndürür",
    (module, field, value) => {
      const guide = parameterGuidance(module, field, value);

      expect(guide.summary.length).toBeGreaterThan(12);
      expect(guide.effect.length).toBeGreaterThan(12);
      expect(guide.affects.length).toBeGreaterThan(0);
      expect(guide.scenario.length).toBeGreaterThan(12);
    },
  );

  it("açık ve kapalı durumlarda aynı açıklamayı göstermez", () => {
    const enabled = parameterGuidance("shipping", "requireApproval", true);
    const disabled = parameterGuidance("shipping", "requireApproval", false);

    expect(enabled.effect).not.toBe(disabled.effect);
    expect(enabled.scenario).not.toBe(disabled.scenario);
  });

  it("kalite sonrası ERP kuralını başarısız karar dahil doğru açıklar", () => {
    const guide = parameterGuidance(
      "goodsReceipt",
      "erpPostingPolicy",
      "AfterQualityApproval",
    );

    expect(guide.effect).toContain("Passed veya Failed");
    expect(guide.scenario).toContain("irsaliye");
  });
});
