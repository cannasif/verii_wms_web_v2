import { describe, expect, it } from "vitest";
import {
  buildParameterGuidanceSourceResource,
  parameterGuidance,
  parameterGuidanceOptions,
  resolveParameterGuidanceHint,
  parameterToggleGuidance,
} from "./parameter-guidance.catalog";

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
      expect(guide.decision?.length).toBeGreaterThan(20);
      expect(guide.decision).toContain(guide.affects[0]);
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

  it("bool alanlarda kullanıcıya açık ve kapalı sonuçlarını birlikte verir", () => {
    const comparison = parameterToggleGuidance(
      "goodsReceipt",
      "blockPutawayUntilQualityDecision",
    );

    expect(comparison.enabled.summary).toContain("normal stok rafı seçilemez");
    expect(comparison.disabled.summary).toContain("normal aktif raflar seçilebilir");
    expect(comparison.enabled.scenario).toContain("KABUL-01");
    expect(comparison.disabled.scenario).toContain("SATIS-RAF-10");
  });

  it("açık/kapalı alanlarda genel cümle yerine gerçek operasyon sonucunu gösterir", () => {
    const enabled = parameterGuidance(
      "shipping",
      "allowOrderBasedTask",
      true,
    );
    const disabled = parameterGuidance(
      "shipping",
      "allowOrderBasedTask",
      false,
    );

    expect(enabled.summary).toBe(enabled.effect);
    expect(enabled.summary).toContain("Siparişten");
    expect(disabled.summary).toBe(disabled.effect);
    expect(disabled.summary).toContain("kullanılamaz");
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

  it("katalogdaki her seçenek karar desteği ve operasyon örneği içerir", () => {
    const resource = buildParameterGuidanceSourceResource() as {
      guidance: Record<
        string,
        Record<string, Record<string, Record<string, unknown>>>
      >;
    };

    Object.values(resource.guidance).forEach((fields) => {
      Object.values(fields).forEach((values) => {
        Object.values(values).forEach((guide) => {
          expect(String(guide.summary ?? "").trim().length).toBeGreaterThan(12);
          expect(String(guide.effect ?? "").trim().length).toBeGreaterThan(12);
          expect(String(guide.decision ?? "").trim().length).toBeGreaterThan(20);
          expect(String(guide.scenario ?? "").trim().length).toBeGreaterThan(12);
          expect(Array.isArray(guide.affects)).toBe(true);
          expect((guide.affects as unknown[]).length).toBeGreaterThan(0);
        });
      });
    });
  });

  it("doğal dildeki parametre sorusunu doğru modül ve alana bağlar", () => {
    const hint = resolveParameterGuidanceHint(
      "Kalite bekleyen üründe hangi raflar seçilebilir parametresini açarsam ne olur?",
    );

    expect(hint).toMatchObject({
      module: "goodsReceipt",
      field: "blockPutawayUntilQualityDecision",
      value: "true",
    });
  });

  it("seçenek belirtilmezse dropdown içindeki tüm senaryoları karşılaştırmaya hazırlar", () => {
    const hint = resolveParameterGuidanceHint("Mal kabul ERP aktarım zamanı ayarı ne işe yarıyor?");
    expect(hint).toMatchObject({ module: "goodsReceipt", field: "erpPostingPolicy" });

    const options = parameterGuidanceOptions(hint!.module, hint!.field);
    expect(options.length).toBeGreaterThan(2);
    expect(options.every((option) => option.guidance.scenario.length > 12)).toBe(true);
  });
});
