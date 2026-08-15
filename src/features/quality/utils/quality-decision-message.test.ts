import { describe, expect, it } from "vitest";
import { collapseRepeatedMessageSegments } from "./quality-decision-message";

const repeatedNetsisMessage =
  "Kalite kararı uygulandı ancak Netsis irsaliyesi oluşturulamadı: GR1202600000110 numaralı mal kabul adımı WMS'te tamamlandı ancak Netsis irsaliyesi oluşturulamadı: ERP_PRE_SEND_FAILURE - Netsis REST oturumu açılamadı. Bağlantı, şirket ve kullanıcı bilgilerini kontrol edin. http://localhost:7070 bağlantı hatası: Hedef makine etkin olarak reddettiğinden bağlantı kurulamadı. (localhost:7070) (Hedef makine etkin olarak reddettiğinden bağlantı kurulamadı.) | http://localhost:7070 bağlantı hatası: Hedef makine etkin olarak reddettiğinden bağlantı kurulamadı. (localhost:7070) (Hedef makine etkin olarak reddettiğinden bağlantı kurulamadı.) | http://localhost:7070 bağlantı hatası: Hedef makine etkin olarak reddettiğinden bağlantı kurulamadı. (localhost:7070) (Hedef makine etkin olarak reddettiğinden bağlantı kurulamadı.) | http://localhost:7070 bağlantı hatası: Hedef makine etkin olarak reddettiğinden bağlantı kurulamadı. (localhost:7070) (Hedef makine etkin olarak reddettiğinden bağlantı kurulamadı.) Mal Kabul Listesi'ndeki ERP'ye Gönder işlemiyle tekrar de";

describe("collapseRepeatedMessageSegments", () => {
  it("keeps a repeated Netsis connection error only once", () => {
    const collapsed = collapseRepeatedMessageSegments(repeatedNetsisMessage);

    expect(collapsed).toContain("Kalite kararı uygulandı ancak Netsis irsaliyesi oluşturulamadı");
    expect(collapsed).toContain("GR1202600000110");
    expect(collapsed).toContain("ERP_PRE_SEND_FAILURE");
    expect(collapsed).toContain("http://localhost:7070 bağlantı hatası");
    expect(collapsed).toContain("Mal Kabul Listesi'ndeki ERP'ye Gönder işlemiyle tekrar de");
    expect(collapsed.match(/http:\/\/localhost:7070 bağlantı hatası/g)).toHaveLength(1);
    expect(collapsed).not.toContain(" | ");
  });
});
