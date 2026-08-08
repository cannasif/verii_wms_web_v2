import type {
  ParameterGuidanceContent,
  ParameterToggleGuidance,
} from "@/components/shared/ParameterGuidance";
import type { TFunction } from "i18next";

type ValueGuide =
  ParameterGuidanceContent | Record<string, ParameterGuidanceContent>;

const g = (
  summary: string,
  effect: string,
  affects: readonly string[],
  scenario: string,
  warning?: string,
): ParameterGuidanceContent => ({
  summary,
  effect,
  affects,
  scenario,
  warning,
});

const onOff = (
  on: Omit<ParameterGuidanceContent, "summary"> & { summary?: string },
  off: Omit<ParameterGuidanceContent, "summary"> & { summary?: string },
): Record<string, ParameterGuidanceContent> => ({
  true: {
    ...on,
    summary: on.summary ?? on.effect,
  },
  false: {
    ...off,
    summary: off.summary ?? off.effect,
  },
});

const inbound: Record<string, ValueGuide> = {
  overReceiptPolicy: {
    NotAllowed: g(
      "Siparişteki açık miktardan fazlası kabul edilemez.",
      "Kabul miktarı açık sipariş bakiyesini aşarsa satır kaydedilmez.",
      ["Siparişli mal kabul miktar kontrolü", "Fazla kabul hata mesajı"],
      "Siparişte 100 AD açıkken 105 AD okutulursa işlem 100 AD üzerinde engellenir.",
    ),
    WithinTolerance: g(
      "Fazla kabul yalnız tanımlanan yüzde sınırı içinde yapılabilir.",
      "Açık miktar, tolerans yüzdesi kadar aşılabilir; daha fazlası engellenir.",
      ["Siparişli mal kabul", "Fazla kabul toleransı"],
      "100 AD sipariş ve %5 toleransta en fazla 105 AD kabul edilir.",
    ),
    ApprovalRequired: g(
      "Fazla miktar kaydedilir ancak yetkili onayı olmadan süreç ilerlemez.",
      "Aşan miktar onay bekleyen istisna olarak işaretlenir.",
      ["Mal kabul onay kuyruğu", "ERP aktarım kapısı"],
      "100 AD siparişe 108 AD gelirse kayıt açılır; amir onayı sonrası tamamlanır.",
    ),
  },
  overReceiptTolerancePercent: g(
    "“Tolerans içinde” seçimindeki azami fazla kabul oranıdır.",
    "Yüzde, siparişin açık miktarı üzerinden hesaplanır.",
    ["Sipariş satırı miktar doğrulaması"],
    "Açık miktar 200 ve tolerans %2 ise 204 adede kadar kabul mümkündür.",
    "Fazla kabul politikası “Yasak” ise bu alan kullanılmaz.",
  ),
  inventoryAvailabilityPolicy: {
    Immediate: g(
      "Kabul edilen stok bekleme olmadan kullanılabilir bakiyeye geçer.",
      "Stok; transfer, sevk ve rezervasyon işlemlerine hemen açılır.",
      ["Depo ve raf bakiyesi", "Rezervasyon", "Sevk/transfer"],
      "10 AD kabul biter bitmez başka bir transfer emrinde seçilebilir.",
    ),
    AfterReceiptApproval: g(
      "Stok, mal kabul onayı verilene kadar bloke kalır.",
      "Fiziksel kayıt oluşur fakat kullanılabilir bakiye onaydan sonra açılır.",
      ["Mal kabul onayı", "Kullanılabilir bakiye"],
      "Operatör kabulü bitirir; amir onaylayınca stok sevke açılır.",
    ),
    AfterQualityApproval: g(
      "Kalite planına giren stok kalite kararı gelene kadar kullanılamaz.",
      "Kalitesiz stoklar etkilenmez; kaliteye ayrılanlar bekleme statüsünde tutulur.",
      ["Kalite inceleme", "Karantina/kullanılabilir bakiye"],
      "Numune kontrolden geçince 20 AD stok kullanılabilir duruma alınır.",
    ),
    AfterAllApprovals: g(
      "Mal kabul, kalite ve gerekli ERP onaylarının tamamı beklenir.",
      "Tanımlı bütün onay kapıları geçilmeden stok serbest bırakılmaz.",
      ["Mal kabul", "Kalite", "ERP onayları", "Kullanılabilir bakiye"],
      "Kalite onayı verilse bile mal kabul amir onayı eksikse stok beklemeye devam eder.",
    ),
  },
  erpPostingPolicy: {
    AfterReceipt: g(
      "Mal kabul tamamlanınca ERP irsaliyesi gönderilmeye hazır olur.",
      "Başka onay kapısı yoksa ERP kuyruğu hemen tetiklenir.",
      ["Mal kabul tamamlama", "ERP alış irsaliyesi"],
      "Kalite gerekmeyen kabul bittiğinde Netsis alış irsaliyesi oluşturulur.",
    ),
    AfterReceiptApproval: g(
      "ERP kaydı için mal kabul amir onayı beklenir.",
      "Operatör tamamlaması tek başına ERP aktarımı başlatmaz.",
      ["Mal kabul onayı", "ERP kuyruğu"],
      "Operatör kabulü bitirir; amir onaylayınca irsaliye gönderilir.",
    ),
    AfterQualityApproval: g(
      "Kalite planı olan kabulde kalite kararı tamamlanmadan ERP kaydı atılmaz.",
      "Kalite sonucu Passed veya Failed olabilir; kararın tamamlanması beklenir.",
      ["Kalite inceleme sonucu", "ERP alış irsaliyesi"],
      "Ürün başarısız kalite sonucu alsa da karar verildikten sonra zorunlu alış irsaliyesi gönderilebilir.",
    ),
    AfterAllApprovals: g(
      "ERP aktarımı tanımlı tüm onaylar bittikten sonra yapılır.",
      "Mal kabul, kalite ve ERP onay kapıları birlikte değerlendirilir.",
      ["Mal kabul onayı", "Kalite kararı", "ERP onayı"],
      "Kalite tamamlanmış olsa bile ERP yetkili onayı yoksa aktarım bekler.",
    ),
  },
  erpQualityGatePolicy: {
    None: g(
      "Kalite planı ERP aktarımını bekletmez.",
      "Manuel veya kural bazlı kalite incelemesi olsa bile ERP zamanlamasını yalnız ERP aktarım politikası belirler.",
      ["ERP alış irsaliyesi", "Kalite entegrasyon kapısı"],
      "Ürün kaliteye gönderilir; irsaliye kalite sonucu beklenmeden aktarılabilir.",
    ),
    RuleBasedOnly: g(
      "Yalnız stok/kalite kuralından doğan incelemeler ERP aktarımını bekletir.",
      "Operatörün manuel kaliteye gönderdiği ürün ERP kapısı oluşturmaz.",
      ["Stok kalite kuralı", "ERP aktarım kuyruğu"],
      "Kalite zorunlu stok bekler; yalnız şüpheli görülüp manuel gönderilen stok irsaliyeyi bekletmez.",
    ),
    AnyQualityPlan: g(
      "Kural bazlı veya manuel açılan her kalite planı ERP aktarımını bekletir.",
      "Kalite kararı tamamlanmadan alış irsaliyesi kuyruğa alınmaz.",
      ["Manuel kalite planı", "Kural bazlı kalite", "ERP aktarımı"],
      "Operatör şüpheli ürünü elle kaliteye gönderirse irsaliye kalite sonucu gelene kadar atılmaz.",
    ),
  },
  allowUnderReceipt: onOff(
    {
      effect:
        "Sipariş miktarının bir kısmı kabul edilerek belge açık bırakılabilir.",
      affects: ["Siparişli kabul", "Kalan açık miktar"],
      scenario:
        "100 AD siparişten 60 AD gelir; 60 kabul edilir, 40 açık kalır.",
    },
    {
      effect: "Sipariş satırı eksik miktarla normal tamamlanamaz.",
      affects: ["Siparişli kabul"],
      scenario:
        "100 AD sipariş için 60 AD okutulduğunda tamamlama engellenir veya kısa kapama gerekir.",
    },
  ),
  requireShortCloseApproval: onOff(
    {
      effect:
        "Eksik kalan sipariş miktarını kapatmak için yönetici onayı gerekir.",
      affects: ["Kısa kapama", "Onay kuyruğu"],
      scenario:
        "60/100 kabul sonrası kalan 40 iptal edilecekse amir onayı istenir.",
    },
    {
      effect: "Yetkili operatör eksik satırı ek onay olmadan kapatabilir.",
      affects: ["Kısa kapama"],
      scenario: "60/100 kabul sonrası kalan 40 doğrudan kapatılabilir.",
    },
  ),
  requireReceiptApproval: onOff(
    {
      effect: "Fiziksel kabul sonrası ayrı mal kabul onayı oluşturulur.",
      affects: ["Kabul durumu", "Stok serbest bırakma", "ERP aktarımı"],
      scenario:
        "Depocu kabulü bitirir; amir “Onayla” demeden süreç tamamlanmış sayılmaz.",
    },
    {
      effect: "Operatörün mal kabulü tamamlaması kabul onayı yerine geçer.",
      affects: ["Kabul durumu"],
      scenario:
        "Depocu işlemi bitirdiğinde kayıt bir sonraki uygun adıma geçer.",
    },
  ),
  requireQualityApproval: onOff(
    {
      effect:
        "Kalite planı oluşan stoklarda karar tamamlanmadan süreç serbest bırakılmaz.",
      affects: ["Kalite inceleme", "Stok statüsü"],
      scenario: "Kaliteye giden parti sonuçlanana kadar karantinada tutulur.",
    },
    {
      effect: "Kalite kuralı yoksa ayrı kalite onayı aranmaz.",
      affects: ["Kalite kapısı"],
      scenario: "Kalite tanımı olmayan stok doğrudan sonraki adıma geçer.",
    },
  ),
  requireErpApproval: onOff(
    {
      effect: "ERP gönderimi öncesinde yetkili kullanıcı onayı gerekir.",
      affects: ["ERP aktarım kuyruğu", "Yetki kontrolü"],
      scenario:
        "İrsaliye hazırdır; ERP sorumlusu onaylayınca Netsis’e gönderilir.",
    },
    {
      effect:
        "Diğer kapılar tamamlanınca ERP gönderimi otomatik ilerleyebilir.",
      affects: ["ERP aktarım kuyruğu"],
      scenario: "Kalite biter bitmez irsaliye otomatik gönderilir.",
    },
  ),
  holdInventoryUntilQualityDecision: onOff(
    {
      effect: "Kalite bekleyen miktar kullanılabilir stoktan ayrılır.",
      affects: ["Raf bakiyesi statüsü", "Rezervasyon ve sevk"],
      scenario:
        "100 AD fiziksel raftadır fakat kalite bitene kadar sevk emrine ayrılamaz.",
    },
    {
      effect:
        "Kalite incelemesi stok kullanılabilirliğini tek başına bloke etmez.",
      affects: ["Kullanılabilir bakiye"],
      scenario:
        "Kalite kaydı açık olsa da diğer politikalar izin veriyorsa stok seçilebilir.",
    },
  ),
  blockPutawayUntilQualityDecision: onOff(
    {
      summary:
        "Kalite kararı çıkana kadar normal stok rafı seçilemez; ürün yalnız kabul, geçici bekleme veya kalite rafında tutulur.",
      effect:
        "Kalite bekleyen satır için hedef depodaki normal toplama rafları kapatılır. Yalnız Receiving (Kabul), Staging (Geçici Bekleme) veya tanımlı kalite bekleme rafı seçilebilir. Kalite kararı tamamlandıktan sonra ürün ayrı bir raflama adımıyla nihai stok rafına taşınır.",
      affects: ["Mal kabul raf seçimi ve raflama görevi", "Kalite bekleme rafı"],
      scenario:
        "100 AD ürün kalite kontrolüne ayrıldı. Operatör KABUL-01 veya KALITE-BEKLEME rafını seçebilir; SATIS-RAF-10 seçilemez. Kalite sonucu verildikten sonra 100 AD için nihai raflama görevi açılır.",
      decision:
        "Kalite sonucu belli olmadan ürünü normal stok raflarına karıştırmak istemiyorsanız Açık kullanın. Depoda en az bir Kabul, Geçici Bekleme veya kalite bekleme rafı tanımlı olmalıdır.",
    },
    {
      summary:
        "Kalite sonucu beklenirken hedef depodaki normal aktif raflar seçilebilir.",
      effect:
        "Ürün kalite kontrolünü beklese bile operatör hedef depodaki normal aktif stok rafını seçebilir ve ürünü fiziksel olarak o rafa yerleştirebilir. Bu seçim stok miktarını otomatik olarak kullanılabilir yapmaz; kullanılabilirlik ayrıca ‘Kalite kararına kadar stoğu beklet’ ayarıyla belirlenir.",
      affects: ["Mal kabul raf seçimi, raflama ve stok kullanılabilirlik statüsü"],
      scenario:
        "100 AD ürün SATIS-RAF-10 rafına konur. ‘Kalite kararına kadar stoğu beklet’ ayarı Açıksa ürün aynı rafta görünür fakat sevk ve transferde kullanılamaz; kalite kararı sonrası kullanılabilir olur.",
      decision:
        "Kalite bekleyen ürünü depo içinde ayrıca bir bekleme alanına taşımadan doğrudan nihai rafına koymak istiyorsanız Kapalı kullanın.",
    },
  ),
  allowOrderlessReceipt: onOff(
    {
      effect:
        "Satınalma siparişi olmadan irsaliye ve stok kalemiyle kabul açılabilir.",
      affects: ["Siparişsiz mal kabul"],
      scenario: "Acil gelen malzeme sipariş bağlantısı olmadan kabul edilir.",
    },
    {
      effect: "Her mal kabul geçerli bir siparişe bağlanmalıdır.",
      affects: ["Yeni mal kabul başlangıcı"],
      scenario: "Sipariş seçmeden devam etmek isteyen kullanıcı engellenir.",
    },
  ),
  allowUnplannedReceipt: onOff(
    {
      effect: "Önceden emir açılmadan doğrudan fiziksel kabul yapılabilir.",
      affects: ["Doğrudan kabul", "Görev oluşturma"],
      scenario: "Kapıya gelen araç için anlık kabul başlatılır.",
    },
    {
      effect: "Fiziksel kabulden önce mal kabul emri/görevi gerekir.",
      affects: ["Mal kabul görevleri"],
      scenario: "Depocu yalnız kendisine atanmış kabul emrini çalıştırabilir.",
    },
  ),
  showAllocatedOpenOrderLines: onOff(
    {
      effect:
        "Başka açık WMS kabulüne ayrılmış sipariş satırları uyarıyla birlikte listelenir.",
      affects: ["Netsis sipariş seçimi"],
      scenario:
        "Aynı sipariş kalemi başka emirdeyse kullanıcı bunu görür fakat mükerrer miktar kontrolü devam eder.",
    },
    {
      effect:
        "Başka WMS kabulüne ayrılmış satırlar sipariş seçiminde gizlenir.",
      affects: ["Netsis sipariş seçimi"],
      scenario: "Operatör yalnız henüz tahsis edilmemiş açık satırları görür.",
    },
  ),
  warehouseDefaultWarehouse: g(
    "Varsayılan raf önerisinin ait olduğu depodur.",
    "Mal kabulde depo seçildiğinde bu depo için tanımlı varsayılan raf kullanılabilir.",
    ["Mal kabul depo/raf seçimi"],
    "01 depoda gelen ürünler için KABUL-01 rafı varsayılan gelir.",
  ),
  warehouseDefaultLocation: g(
    "Seçilen depoda mal kabulün ilk yerleştirileceği varsayılan raftır.",
    "Operatör değiştirmedikçe yeni kabul satırlarına bu raf önerilir.",
    ["Mal kabul raf önerisi", "Raf bakiyesi"],
    "01 depo seçildiğinde KABUL-01 otomatik seçilir.",
  ),
  assignmentUser: g(
    "Depo yetkisi atanacak WMS kullanıcısıdır.",
    "Seçilen kullanıcı yalnız kendisine verilen depolarda mal kabul işlemi yapabilir.",
    ["Mal kabul kullanıcı-depo yetkisi"],
    "Depocu A yalnız 01 ve 02 depolarında işlem yapacak şekilde atanır.",
  ),
};

const outbound: Record<string, ValueGuide> = {
  allowOrderBasedTask: onOff(
    {
      effect: "Siparişten görevli çıkış/sevk emri açılabilir.",
      affects: ["Yeni emir", "Görev atama"],
      scenario: "Satış siparişi seçilir ve toplama görevi personele atanır.",
    },
    {
      effect: "Sipariş kaynaklı görevli akış menüde kullanılamaz.",
      affects: ["Yeni emir"],
      scenario: "Kullanıcı siparişten emir açamaz.",
    },
  ),
  allowStockBasedTask: onOff(
    {
      effect: "Sipariş olmadan stoktan görevli çıkış açılabilir.",
      affects: ["Serbest stok çıkışı", "Görev atama"],
      scenario: "Numune sevki için stok seçilip toplama emri atanır.",
    },
    {
      effect: "Siparişsiz görevli çıkış engellenir.",
      affects: ["Yeni emir"],
      scenario: "Serbest stoktan görev açma seçeneği kullanılamaz.",
    },
  ),
  allowOrderBasedDirect: onOff(
    {
      effect: "Siparişten, görev atamadan doğrudan işlem yapılabilir.",
      affects: ["Doğrudan çıkış/sevk"],
      scenario:
        "Küçük sipariş operatör tarafından aynı ekranda toplanıp tamamlanır.",
    },
    {
      effect: "Siparişli işlemler görevli akıştan yürütülür.",
      affects: ["Doğrudan işlem"],
      scenario: "Sipariş seçilse de önce görev oluşturmak gerekir.",
    },
  ),
  allowStockBasedDirect: onOff(
    {
      effect: "Siparişsiz stok doğrudan çıkışa alınabilir.",
      affects: ["Doğrudan serbest çıkış"],
      scenario: "Hurda veya numune stok anlık çıkarılır.",
    },
    {
      effect: "Siparişsiz doğrudan çıkış engellenir.",
      affects: ["Yeni çıkış"],
      scenario: "Belgesiz stok seçimiyle ilerlenemez.",
    },
  ),
  reservationPolicy: {
    None: g(
      "Emir miktarı için stok rezervasyonu yapılmaz.",
      "Diğer işler aynı bakiyeyi görebilir; kesin kontrol toplamada yapılır.",
      ["Kullanılabilir bakiye", "Toplama"],
      "İki emir aynı stoğu görebilir; önce toplayan miktarı kullanır.",
      "Yoğun operasyonlarda görev başında stok yetersizliği oluşabilir.",
    ),
    OnCreate: g(
      "Emir taslak olarak oluşturulurken stok rezerve edilir.",
      "Miktar diğer emirlere kapatılır.",
      ["Emir oluşturma", "Rezervasyon bakiyesi"],
      "100 AD emir açılınca 100 AD hemen kullanılabilir bakiyeden düşer.",
    ),
    OnRelease: g(
      "Emir serbest bırakılıp operasyona verildiğinde rezervasyon yapılır.",
      "Taslaklar stok bağlamaz; aktif görev stok bağlar.",
      ["Emir serbest bırakma", "Rezervasyon"],
      "Planlayıcı taslağı hazırlar; onaylayıp yayımlayınca stok ayrılır.",
    ),
  },
  shortagePolicy: {
    Block: g(
      "Eksik stokla işlem tamamlanamaz.",
      "Talep edilen miktarın tamamı bulunmalıdır.",
      ["Toplama tamamlama"],
      "10 AD istenir, 8 AD varsa tamamlama engellenir.",
    ),
    AllowPartial: g(
      "Bulunan miktar kadar kısmi işlem tamamlanabilir.",
      "Kalan miktar açık/eksik olarak izlenir.",
      ["Kısmi toplama", "Kalan miktar"],
      "10 AD emrin 8 AD’si sevk edilir, 2 AD açık kalır.",
    ),
    RequireApproval: g(
      "Eksik miktar yetkili onayıyla tamamlanabilir.",
      "Operatör tek başına kısa kapama yapamaz.",
      ["İstisna onayı", "Kısa kapama"],
      "8/10 toplamada amir onayı sonrası sevk tamamlanır.",
    ),
  },
  overPickPolicy: {
    Block: g(
      "Emir miktarından fazla toplama engellenir.",
      "Okutulan toplam plan miktarını aşamaz.",
      ["Barkod okutma", "Toplama"],
      "10 AD emir için 11. okutma reddedilir.",
    ),
    AllowWithinTolerance: g(
      "Fazla toplama yalnız yüzde toleransı içinde kabul edilir.",
      "Üst sınır plan miktarı üzerinden hesaplanır.",
      ["Toplama miktar kontrolü"],
      "100 AD ve %2 toleransta 102 AD’ye izin verilir.",
    ),
    RequireApproval: g(
      "Fazla toplama yetkili onayına düşer.",
      "Aşan miktar onaysız sevk edilemez.",
      ["İstisna onayı", "Sevk kapısı"],
      "11/10 toplama amir onayı bekler.",
    ),
  },
  packingPolicy: {
    NotRequired: g(
      "Paket kapatmadan çıkış tamamlanabilir.",
      "Paket/SSCC adımı zorunlu değildir.",
      ["Paketleme", "Sevk tamamlama"],
      "Paletsiz ürün doğrudan yüklemeye geçer.",
    ),
    Optional: g(
      "Paketleme kullanılabilir fakat zorunlu değildir.",
      "Operasyona göre paketli veya paketsiz ilerlenebilir.",
      ["Paketleme"],
      "Koli ürün paketlenir, dökme ürün doğrudan sevk edilir.",
    ),
    Required: g(
      "Tüm uygun miktar paketlenmeden çıkış tamamlanamaz.",
      "Paket kapanışı sevk kapısıdır.",
      ["Paketleme", "SSCC/etiket", "Sevk tamamlama"],
      "Toplanan 20 AD koliye alınmadan yükleme onayı verilemez.",
    ),
  },
  minimumFulfillmentPercent: g(
    "Kısmi tamamlama için gereken asgari karşılama oranıdır.",
    "Toplanan miktar bu oranın altındaysa tamamlama engellenir.",
    ["Kısmi toplama", "Kısa kapama"],
    "100 AD emirde oran %80 ise en az 80 AD toplanmalıdır.",
  ),
  overPickTolerancePercent: g(
    "Toleranslı fazla toplamanın azami yüzdesidir.",
    "Yalnız fazla toplama politikası toleranslı olduğunda kullanılır.",
    ["Toplama miktar kontrolü"],
    "50 AD ve %4 toleransta en fazla 52 AD toplanabilir.",
  ),
  requireApproval: onOff(
    {
      effect: "Emir operasyona çıkmadan yetkili onayı gerekir.",
      affects: ["Emir durumu", "Görev yayını"],
      scenario:
        "Planlayıcı taslağı oluşturur; amir onayı sonrası depocu görür.",
    },
    {
      effect: "Emir uygun olduğunda doğrudan operasyona alınabilir.",
      affects: ["Emir durumu"],
      scenario: "Taslak kaydedilip görev hemen başlatılır.",
    },
  ),
  requireAssigneeForTask: onOff(
    {
      effect: "Görevli akışta en az bir kullanıcı atanmalıdır.",
      affects: ["Görev oluşturma", "Atanmış emirler"],
      scenario: "Personel seçilmeden emir serbest bırakılamaz.",
    },
    {
      effect: "Görev kullanıcı atanmadan havuza bırakılabilir.",
      affects: ["Görev havuzu"],
      scenario: "Boş görev daha sonra bir çalışan tarafından alınır.",
    },
  ),
  allowMultipleAssignees: onOff(
    {
      effect: "Aynı görev birden fazla kullanıcı/ekibe atanabilir.",
      affects: ["Görev atama", "İlerleme"],
      scenario: "Büyük sipariş iki depocu tarafından paralel toplanır.",
    },
    {
      effect: "Görev yalnız tek sorumluya atanabilir.",
      affects: ["Görev atama"],
      scenario: "İkinci kullanıcı seçildiğinde önceki atama değiştirilir.",
    },
  ),
  autoReleaseTaskBased: onOff(
    {
      effect: "Geçerli görevli emir kaydedilince otomatik serbest bırakılır.",
      affects: ["Görev yayını"],
      scenario:
        "Atama tamamlanır tamamlanmaz görev personelin listesine düşer.",
    },
    {
      effect: "Görev ayrıca serbest bırakma işlemine ihtiyaç duyar.",
      affects: ["Görev durumu"],
      scenario: "Planlayıcı taslağı kontrol edip sonra yayımlar.",
    },
  ),
  allowPartialPicking: onOff(
    {
      effect: "Toplama oturumu plan miktarının altında kapatılabilir.",
      affects: ["Toplama", "Kalan miktar"],
      scenario: "10 AD’den 6 AD toplanır ve oturum kısmi kapatılır.",
    },
    {
      effect: "Toplama tamamlanmak için tüm miktarı bekler.",
      affects: ["Toplama tamamlama"],
      scenario: "6/10 durumda tamamla düğmesi engellenir.",
    },
  ),
  allowPartialShipment: onOff(
    {
      effect: "Toplanan miktarın bir kısmı sevk/çıkış olarak tamamlanabilir.",
      affects: ["Sevk tamamlama", "Kalan emir"],
      scenario: "10 AD’nin 6’sı araçla çıkar, 4’ü açık kalır.",
    },
    {
      effect: "Belge ancak bütün uygun miktar hazır olduğunda tamamlanır.",
      affects: ["Sevk tamamlama"],
      scenario: "6/10 hazırken araç çıkışı onaylanamaz.",
    },
  ),
  requireSourceLocation: onOff(
    {
      effect: "Her satırda kaynak raf seçimi veya barkod doğrulaması gerekir.",
      affects: ["Toplama", "Raf bakiyesi"],
      scenario: "Stok doğru olsa bile yanlış raf barkodu reddedilir.",
    },
    {
      effect:
        "Kaynak raf satırda zorunlu değildir; sistem uygun bakiyeden çözebilir.",
      affects: ["Toplama"],
      scenario: "Operatör yalnız ürün barkoduyla ilerleyebilir.",
    },
  ),
  requireShipmentInformation: onOff(
    {
      effect:
        "Araç, sürücü veya taşıma bilgileri girilmeden çıkış tamamlanamaz.",
      affects: ["Yükleme", "Belge tamamlama"],
      scenario: "Plaka eksikken sevki tamamla işlemi engellenir.",
    },
    {
      effect: "Taşıma bilgileri isteğe bağlıdır.",
      affects: ["Yükleme"],
      scenario: "Dahili ambar çıkışı plakasız tamamlanabilir.",
    },
  ),
  requireLoadingConfirmation: onOff(
    {
      effect: "Toplama sonrası ayrı yükleme onayı gerekir.",
      affects: ["Yükleme kontrolü", "Sevk durumu"],
      scenario:
        "Toplanan koli araçta barkodla doğrulandıktan sonra sevk edilir.",
    },
    {
      effect: "Toplama/paketleme tamamlanınca ayrı yükleme adımı aranmaz.",
      affects: ["Sevk durumu"],
      scenario: "Küçük teslimat doğrudan tamamlanır.",
    },
  ),
  autoPostErpAfterApproval: onOff(
    {
      effect:
        "Son operasyon onayından sonra ERP kaydı otomatik kuyruğa alınır.",
      affects: ["ERP sevk/ambar çıkışı"],
      scenario: "Yükleme onayı verilince Netsis kaydı otomatik gönderilir.",
    },
    {
      effect:
        "ERP aktarımı kullanıcı veya entegrasyon görevi tarafından ayrıca başlatılır.",
      affects: ["ERP kuyruğu"],
      scenario: "Operasyon tamamlanır; ERP sorumlusu sonradan gönderir.",
    },
  ),
};

const transfer: Record<string, ValueGuide> = {
  ...Object.fromEntries(
    [
      "allowOrderBasedTask",
      "allowStockBasedTask",
      "allowOrderBasedDirect",
      "allowStockBasedDirect",
      "reservationPolicy",
      "minimumFulfillmentPercent",
      "requireApproval",
      "requireAssigneeForTask",
      "allowMultipleAssignees",
      "autoReleaseTaskBased",
      "allowPartialPicking",
      "requireSourceLocation",
      "requireShipmentInformation",
    ].map((key) => [key, outbound[key]]),
  ),
  discrepancyPolicy: {
    Block: g(
      "Kaynak çıkış ve hedef kabul miktarı farklıysa işlem engellenir.",
      "Eksik/fazla teslim kapatılamaz.",
      ["Transfer kabulü", "Miktar mutabakatı"],
      "10 AD çıktı, 9 AD ulaştıysa kabul tamamlanamaz.",
    ),
    AllowWithReason: g(
      "Miktar farkı gerekçe girilerek kabul edilebilir.",
      "Fark ve açıklama denetim kaydına yazılır.",
      ["Transfer kabulü", "Audit"],
      "1 AD hasarlıysa “taşımada hasar” gerekçesiyle 9 AD kabul edilir.",
    ),
    RequireApproval: g(
      "Miktar farkı yetkili onayına gönderilir.",
      "Onay gelmeden hedef bakiye kesinleşmez.",
      ["Transfer istisna onayı"],
      "9/10 kabul amir onayı sonrası kapanır.",
    ),
  },
  allowPartialShipment: onOff(
    {
      effect: "Kaynak depodan emrin bir kısmı sevk edilebilir.",
      affects: ["Transfer sevki", "Kalan miktar"],
      scenario: "100 AD transferin 60 AD’si ilk araçla çıkar.",
    },
    {
      effect: "Kaynak sevki tüm plan miktarını bekler.",
      affects: ["Transfer sevki"],
      scenario: "60/100 hazırken sevk tamamlanamaz.",
    },
  ),
  allowPartialReceipt: onOff(
    {
      effect: "Hedef depo gelen miktarı kısmi kabul edebilir.",
      affects: ["Transfer kabulü"],
      scenario: "İlk araçtaki 60 AD kabul edilir, 40 AD transit kalır.",
    },
    {
      effect: "Hedef kabul bütün sevk miktarını bekler.",
      affects: ["Transfer kabulü"],
      scenario: "Parça teslimatta belge kapanmaz.",
    },
  ),
  requireDestinationAcceptance: onOff(
    {
      effect:
        "Kaynak çıkışından sonra hedef kullanıcının ayrı kabul onayı gerekir.",
      affects: ["Transit stok", "Hedef kabul"],
      scenario:
        "Stok yoldadır; hedef depocu teslim al deyince hedef bakiyeye geçer.",
    },
    {
      effect: "Kaynak çıkışı hedef bakiyeyi doğrudan güncelleyebilir.",
      affects: ["Transfer tamamlama"],
      scenario: "Aynı saha içi kısa transfer tek adımda tamamlanır.",
    },
  ),
  createTransitInventory: onOff(
    {
      effect: "Kaynak çıkış ve hedef kabul arasında transit bakiye tutulur.",
      affects: ["Transit stok", "Depo bakiyesi"],
      scenario:
        "Araçtaki 100 AD kaynakta yok, hedefte yok; transit olarak görünür.",
    },
    {
      effect: "Ayrı transit stok statüsü oluşturulmaz.",
      affects: ["Depo bakiyesi"],
      scenario: "Tek adımlı transferde stok doğrudan hedefe geçer.",
    },
  ),
  requirePutaway: onOff(
    {
      effect: "Hedef kabul sonrası raflama görevi tamamlanmalıdır.",
      affects: ["Raflama", "Hedef raf bakiyesi"],
      scenario: "Kabul alanındaki ürün hedef rafa okutulmadan süreç kapanmaz.",
    },
    {
      effect: "Hedef kabul seçilen rafa doğrudan bakiye yazabilir.",
      affects: ["Hedef raf bakiyesi"],
      scenario: "Kabulde hedef raf seçilir ve ayrı görev açılmaz.",
    },
  ),
  requireTargetLocation: onOff(
    {
      effect: "Transfer satırında hedef raf zorunludur.",
      affects: ["Emir oluşturma", "Hedef raf bakiyesi"],
      scenario: "Hedef raf seçilmeden satır kaydedilemez.",
    },
    {
      effect: "Hedef raf kabul/raflama aşamasında belirlenebilir.",
      affects: ["Hedef kabul"],
      scenario: "Emir yalnız hedef depoyla açılır; depocu uygun rafı seçer.",
    },
  ),
  directPostingPolicy: {
    OneStep: g(
      "Kaynak çıkışı ve hedef girişi tek işlemde tamamlanır.",
      "Transit bekleme ve hedef kabul adımı oluşmaz.",
      ["Stok hareketi", "Kaynak/hedef bakiye"],
      "Aynı tesis içindeki depo transferi anında hedefe geçer.",
    ),
    TwoStepTransit: g(
      "Kaynak çıkışı, transit ve hedef kabul ayrı durumlarda izlenir.",
      "Fiziksel teslim alınana kadar stok transit kalır.",
      ["Transit bakiye", "Hedef kabul"],
      "Şehirler arası sevkte araç çıkınca transit, hedef onaylayınca tamamlanır.",
    ),
  },
};

const quality: Record<string, ValueGuide> = {
  defaultInspectionMode: {
    NoCheck: g(
      "Varsayılan olarak kalite kontrol planı açılmaz.",
      "Stok kuralı ayrıca kalite istemiyorsa ürün doğrudan kabul akışında kalır.",
      ["Mal kabul", "Kalite planı oluşturma"],
      "Standart ambalaj malzemesi kalite kaydı açılmadan kabul edilir.",
    ),
    QuickCheck: g(
      "Ürün kısa kontrol adımlarına yönlendirilir.",
      "Tam laboratuvar incelemesi yerine hızlı görsel/ölçü kontrolü açılır.",
      ["Kalite inceleme", "Kontrol şablonu"],
      "Operatör ambalaj ve miktarı kontrol ederek karar verir.",
    ),
    InspectionRequired: g(
      "Tam kalite incelemesi zorunlu olur.",
      "Karar verilmeden kalite süreci tamamlanmaz.",
      ["Kalite planı", "Karantina", "Stok serbest bırakma"],
      "Hammadde numune ve ölçüm sonuçları girilene kadar bekler.",
    ),
  },
  defaultFailAction: {
    Quarantine: g(
      "Başarısız ürün karantina statüsüne alınır.",
      "Stok kullanılabilir bakiyeden ayrılır ve karantina rafına yönelir.",
      ["Kalite kararı", "Karantina bakiyesi"],
      "Ölçüm dışı parti inceleme için karantina rafına taşınır.",
    ),
    Reject: g(
      "Başarısız ürün reddedilmiş statüsüne alınır.",
      "Ürün normal operasyonda kullanılamaz.",
      ["Kalite kararı", "Red rafı"],
      "Hasarlı ürün red rafına alınır.",
    ),
    ReturnToSupplier: g(
      "Başarısız ürün tedarikçiye iade sürecine hazırlanır.",
      "İade edilebilir stok statüsü ve takip kaydı oluşur.",
      ["Kalite kararı", "Tedarikçi iadesi"],
      "Yanlış spesifikasyonlu parti iade listesine düşer.",
    ),
    ManagerApproval: g(
      "Başarısız sonuç nihai işlem için yönetici kararına gider.",
      "Karantina, şartlı kabul veya iade kararı yetkili tarafından seçilir.",
      ["Kalite onay kuyruğu"],
      "Sınır değerdeki ürün kalite müdürü onayına gönderilir.",
    ),
  },
  defaultQualityLocationId: g(
    "Kalite incelemesi bekleyen ürünlerin varsayılan rafıdır.",
    "Otomatik kalite yönlendirmesinde bu raf önerilir.",
    ["Mal kabul sonrası yönlendirme", "Kalite bekleme bakiyesi"],
    "Kaliteye gönderilen ürün KLT-01 rafına yerleştirilir.",
  ),
  defaultQuarantineLocationId: g(
    "Karantina kararı verilen ürünlerin varsayılan rafıdır.",
    "Başarısız/şüpheli stok bu lokasyona yöneltilir.",
    ["Karantina hareketi", "Raf bakiyesi"],
    "Failed sonucu alan parti KRN-01 rafına alınır.",
  ),
  defaultRejectLocationId: g(
    "Reddedilen ürünlerin varsayılan rafıdır.",
    "Red kararı sonrası önerilen hedef lokasyonu belirler.",
    ["Red hareketi", "Raf bakiyesi"],
    "İade bekleyen ürün RED-01 rafında tutulur.",
  ),
  autoCreateInspectionOnReceipt: onOff(
    {
      effect:
        "Kalite kuralına uyan mal kabul satırı için inceleme otomatik açılır.",
      affects: ["Mal kabul tamamlama", "Kalite listesi"],
      scenario:
        "Kalite zorunlu stok kabul edilince operatör ayrıca kayıt açmaz.",
    },
    {
      effect: "İnceleme yetkili kullanıcı tarafından manuel açılır.",
      affects: ["Kalite listesi"],
      scenario:
        "Kabul tamamlanır; kalite görevlisi gerekli görürse plan oluşturur.",
    },
  ),
  holdInventoryUntilDecision: onOff(
    {
      effect: "Kalite kararı gelene kadar stok kullanılamaz.",
      affects: ["Kullanılabilir bakiye", "Sevk/transfer"],
      scenario: "Rafında görünen parti sevk emrine seçilemez.",
    },
    {
      effect: "Kalite kaydı stok kullanılabilirliğini tek başına bloke etmez.",
      affects: ["Kullanılabilir bakiye"],
      scenario:
        "Kontrol devam ederken diğer politikalar izin verirse stok kullanılabilir.",
    },
  ),
  blockPutawayUntilDecision: onOff(
    {
      effect: "Kalite bekleyen ürün nihai rafa taşınamaz.",
      affects: ["Raflama görevi"],
      scenario: "Ürün kalite alanında bekler; karar sonrası normal rafa gider.",
    },
    {
      effect: "Kalite beklerken fiziksel raflama yapılabilir.",
      affects: ["Raflama"],
      scenario: "Ürün normal rafa alınır fakat kalite statüsü korunur.",
    },
  ),
  blockErpPostingUntilDecision: onOff(
    {
      effect: "Kalite kararı tamamlanmadan ERP irsaliyesi gönderilmez.",
      affects: ["ERP alış irsaliyesi"],
      scenario:
        "Passed veya Failed kararı verilince zorunlu irsaliye gönderilir.",
    },
    {
      effect: "Kalite sonucu ERP aktarımını bekletmez.",
      affects: ["ERP aktarımı"],
      scenario: "İnceleme açıkken irsaliye ERP’ye gidebilir.",
    },
  ),
  requireManagerApprovalForRelease: onOff(
    {
      effect:
        "Karantinadan kullanılabilir stoğa dönüş için yönetici onayı gerekir.",
      affects: ["Kalite serbest bırakma"],
      scenario: "Kalite Passed verir; müdür onaylayınca stok açılır.",
    },
    {
      effect: "Yetkili kalite kullanıcısının kararı stoğu serbest bırakır.",
      affects: ["Kalite kararı"],
      scenario: "Passed sonucu sonrası stok hemen açılır.",
    },
  ),
  allowPartialDecision: onOff(
    {
      effect: "Bir kalite partisinin miktarı farklı sonuçlara bölünebilir.",
      affects: ["Kalite karar satırları", "Stok statüleri"],
      scenario: "100 AD’nin 95’i kabul, 5’i red yapılır.",
    },
    {
      effect: "Partinin tamamına tek kalite kararı verilir.",
      affects: ["Kalite kararı"],
      scenario: "100 AD’nin tamamı Passed veya Failed olur.",
    },
  ),
  allowDirectReceiptWhenNoRule: onOff(
    {
      effect: "Kalite kuralı olmayan stok kalite beklemeden kabul edilir.",
      affects: ["Mal kabul", "Kalite planı"],
      scenario: "Kuralı olmayan sarf malzemesi doğrudan stok olur.",
    },
    {
      effect: "Kural olmasa da kalite kararı/manuel yönlendirme gerekir.",
      affects: ["Mal kabul tamamlama"],
      scenario: "Her ürün kalite ekibine yönlendirilmeden tamamlanamaz.",
    },
  ),
  blockReceiptWhenLotMissing: onOff(
    {
      effect: "Lot takipli stokta lot girilmeden kabul tamamlanamaz.",
      affects: ["Mal kabul doğrulaması"],
      scenario: "Lot alanı boşsa kullanıcıya düzeltme hatası gösterilir.",
    },
    {
      effect: "Kalite modülü lot eksikliğini ayrıca engellemez.",
      affects: ["Mal kabul"],
      scenario: "Stok takip politikası izin veriyorsa lotsuz ilerlenir.",
    },
  ),
  blockReceiptWhenSerialMissing: onOff(
    {
      effect:
        "Seri takipli stokta gerekli seri sayısı girilmeden kabul tamamlanamaz.",
      affects: ["Barkod/seri doğrulama"],
      scenario: "3 AD miktar kadar seri isteniyorsa üç seri okutulmalıdır.",
    },
    {
      effect: "Kalite modülü seri eksikliğini ayrıca engellemez.",
      affects: ["Mal kabul"],
      scenario: "Stok takip politikası uygunsa serisiz ilerlenebilir.",
    },
  ),
  blockReceiptWhenExpiryMissing: onOff(
    {
      effect: "SKT zorunlu stokta tarih girilmeden kabul tamamlanamaz.",
      affects: ["Mal kabul doğrulaması"],
      scenario: "Gıda lotunun son kullanma tarihi boşsa kayıt reddedilir.",
    },
    {
      effect: "Kalite modülü SKT eksikliğini ayrıca engellemez.",
      affects: ["Mal kabul"],
      scenario: "Stok politikası zorunlu değilse tarihsiz ilerlenir.",
    },
  ),
};

const packing: Record<string, ValueGuide> = {
  requirePacking: onOff(
    {
      effect: "Sevk/çıkış öncesinde paket oluşturmak zorunludur.",
      affects: ["Paketleme iş merkezi", "Sevk kapısı"],
      scenario: "Toplanan ürün koliye alınmadan sevk tamamlanamaz.",
    },
    {
      effect: "Paketleme adımı isteğe bağlıdır.",
      affects: ["Sevk tamamlama"],
      scenario: "Dökme ürün doğrudan yüklemeye geçer.",
    },
  ),
  allowPartialPacking: onOff(
    {
      effect: "Toplanan miktarın bir bölümü paketlenip açık bırakılabilir.",
      affects: ["Paket satırları", "Kalan miktar"],
      scenario: "100 AD’nin 60’ı ilk koli grubuna alınır.",
    },
    {
      effect: "Uygun miktarın tamamı aynı paketleme oturumunda beklenir.",
      affects: ["Paket kapatma"],
      scenario: "60/100 paketlendiğinde işlem kapanmaz.",
    },
  ),
  allowMixedStock: onOff(
    {
      effect: "Aynı pakette farklı stok kodları bulunabilir.",
      affects: ["Paket içerik doğrulaması"],
      scenario: "Aynı müşterinin üç farklı ürünü tek kolide toplanır.",
    },
    {
      effect: "Her paket tek stok kodu taşır.",
      affects: ["Paket içerik doğrulaması"],
      scenario: "Farklı stok okutulduğunda yeni paket istenir.",
    },
  ),
  allowMixedLot: onOff(
    {
      effect: "Aynı stok için farklı lotlar aynı pakete alınabilir.",
      affects: ["Lot izlenebilirliği", "Paket içeriği"],
      scenario: "LOT-A ve LOT-B aynı palete konur.",
    },
    {
      effect: "Paket tek lotla sınırlıdır.",
      affects: ["Paket içeriği"],
      scenario: "İkinci lot için yeni koli/palet açılır.",
    },
  ),
  allowMixedCustomer: onOff(
    {
      effect: "Aynı paket farklı müşterilere ait satırları içerebilir.",
      affects: ["Müşteri ayrımı", "Paket etiketi"],
      scenario:
        "İç transfer konsolidasyonunda çoklu müşteri paketi hazırlanır.",
    },
    {
      effect: "Paket tek müşteriye ait olur.",
      affects: ["Paket doğrulama"],
      scenario: "Başka müşterinin ürünü okutulursa reddedilir.",
    },
  ),
  requireSerialLotScan: onOff(
    {
      effect: "Seri/lot bilgisi barkodla doğrulanmadan ürün pakete eklenmez.",
      affects: ["Paketleme okutma", "İzlenebilirlik"],
      scenario:
        "Serili cihazın seri barkodu okutularak kolideki kimliği doğrulanır.",
    },
    {
      effect:
        "Takip bilgisi mevcut stok seçiminden alınabilir; ek okutma aranmaz.",
      affects: ["Paketleme"],
      scenario: "Serisiz üründe miktar girişiyle paketlenir.",
    },
  ),
  requireWeight: onOff(
    {
      effect: "Paket kapanışında gerçek ağırlık zorunludur.",
      affects: ["Paket kapatma", "Taşıma belgesi"],
      scenario: "Koli tartılmadan kapatılamaz.",
    },
    {
      effect: "Ağırlık isteğe bağlıdır.",
      affects: ["Paket kapatma"],
      scenario: "Adet bazlı küçük paket ağırlıksız kapatılır.",
    },
  ),
  requireDimensions: onOff(
    {
      effect: "En, boy ve yükseklik girilmeden paket kapanmaz.",
      affects: ["Paket kapatma", "Hacim hesabı"],
      scenario: "Kargo kolisinin üç ölçüsü kaydedilir.",
    },
    {
      effect: "Paket ölçüleri isteğe bağlıdır.",
      affects: ["Paket kapatma"],
      scenario: "Standart kasa ek ölçü girmeden kapatılır.",
    },
  ),
  requireSscc: onOff(
    {
      effect: "Her lojistik birim geçerli SSCC taşımalıdır.",
      affects: ["Paket etiketi", "Barkod doğrulama"],
      scenario: "Palet kapanırken SSCC etiketi oluşturulur.",
    },
    {
      effect: "SSCC olmadan paket kapatılabilir.",
      affects: ["Paket etiketi"],
      scenario: "İç kullanım kutusu yerel paket numarasıyla izlenir.",
    },
  ),
  autoGenerateSscc: onOff(
    {
      effect: "SSCC zorunluysa sistem sıradaki benzersiz numarayı üretir.",
      affects: ["Barkod kuralı", "Paket etiketi"],
      scenario: "Yeni palet açıldığında kullanıcı numara yazmaz.",
    },
    {
      effect: "SSCC kullanıcıdan/harici sistemden alınır.",
      affects: ["Paket oluşturma"],
      scenario: "Tedarikçinin SSCC barkodu okutulur.",
    },
  ),
  autoPrintLabelOnClose: onOff(
    {
      effect: "Paket kapanınca etiket yazdırma işi otomatik açılır.",
      affects: ["Yazıcı kuyruğu", "Paket etiketi"],
      scenario: "Koli kapatılır kapatılmaz etiketi çıkar.",
    },
    {
      effect: "Etiket kullanıcı komutuyla yazdırılır.",
      affects: ["Etiket ekranı"],
      scenario: "Operatör paket listesinden “Etiket bas” seçer.",
    },
  ),
  allowReopen: onOff(
    {
      effect: "Kapatılmış paket yetkili işlemle yeniden açılabilir.",
      affects: ["Paket durumu", "Audit"],
      scenario: "Eksik ürün fark edilince paket yeniden açılır.",
    },
    {
      effect: "Kapatılan paket değiştirilemez.",
      affects: ["Paket durumu"],
      scenario: "Düzeltme için iptal/yeni paket gerekir.",
    },
  ),
  allowRepack: onOff(
    {
      effect: "Paket içeriği başka pakete taşınabilir.",
      affects: ["Yeniden paketleme", "Paket hareketi"],
      scenario: "Hasarlı koli içeriği yeni koliye aktarılır.",
    },
    {
      effect: "Paketler arası içerik taşıma engellenir.",
      affects: ["Paket işlemleri"],
      scenario: "Yanlış koli için iptal süreci gerekir.",
    },
  ),
  weightTolerancePercent: g(
    "Beklenen ve gerçek paket ağırlığı arasındaki izin verilen farktır.",
    "Tolerans aşılırsa paket kapanışı uyarılır veya engellenir.",
    ["Paket tartım kontrolü"],
    "Beklenen 100 kg ve %2 toleransta 98–102 kg kabul edilir.",
  ),
  closePolicy: {
    Manual: g(
      "Paket kullanıcı “Kapat” dediğinde kapanır.",
      "İçerik tam olsa bile kullanıcı kontrolü beklenir.",
      ["Paket kapanışı"],
      "Operatör son kontrol sonrası paketi kapatır.",
    ),
    AutoWhenComplete: g(
      "Planlanan içerik tamamlanınca paket otomatik kapanır.",
      "Ek kapatma tıklaması gerekmez.",
      ["Paketleme okutma", "Etiket"],
      "Son ürün okutulunca koli kapanır ve etiket süreci başlar.",
    ),
  },
  releasePolicy: {
    Manual: g(
      "Kapalı paket sevke ayrıca serbest bırakılır.",
      "Paket kapanışı tek başına sevk edilebilir yapmaz.",
      ["Paket serbest bırakma"],
      "Kalite kontrol sonrası amir paketi sevke açar.",
    ),
    OnClose: g(
      "Paket kapanınca otomatik sevke hazır olur.",
      "Ayrı serbest bırakma adımı atlanır.",
      ["Sevk hazırlığı"],
      "Koli kapanır kapanmaz yükleme listesinde görünür.",
    ),
  },
};

const project: Record<string, ValueGuide> = {
  numberLocale: {
    "tr-TR": g(
      "Sayılar Türkçe ayırıcılarla gösterilir.",
      "Binlik ayırıcı nokta, ondalık ayırıcı virgül olur.",
      ["Tüm miktar, bakiye, fiyat ve rapor ekranları"],
      "1234,5 değeri 1.234,50 olarak görünür.",
    ),
    "en-US": g(
      "Sayılar İngilizce (ABD) ayırıcılarıyla gösterilir.",
      "Binlik ayırıcı virgül, ondalık ayırıcı nokta olur.",
      ["Tüm sayısal gösterimler"],
      "1234,5 değeri 1,234.50 olarak görünür.",
    ),
    "de-DE": g(
      "Sayılar Almanca ayırıcılarla gösterilir.",
      "Binlik ayırıcı nokta, ondalık ayırıcı virgül olur.",
      ["Tüm sayısal gösterimler"],
      "1234,5 değeri 1.234,50 olarak görünür.",
    ),
  },
  decimalPlaces: g(
    "Miktar ve sayısal değerlerde gösterilecek ondalık basamak sayısıdır.",
    "Hesaplanan değer değişmez; yalnız kullanıcıya gösterim ve giriş hassasiyeti standardize edilir.",
    ["Gridler", "Formlar", "PDF/Excel çıktıları"],
    "3 basamak seçilirse 1,5 miktarı 1,500 görünür.",
  ),
  dateFormat: g(
    "Tarihlerin ekranda hangi sırayla gösterileceğini belirler.",
    "Veritabanındaki UTC tarih değişmez; yalnız sunum biçimi değişir.",
    ["Tüm tarih alanları", "Rapor ve belgeler"],
    "dd.MM.yyyy seçiminde 8 Ağustos 2026, 08.08.2026 görünür.",
  ),
  timeFormat: g(
    "Saat gösteriminin 24/12 saat ve saniye biçimini belirler.",
    "Kaydedilen UTC zaman değişmez; kullanıcı görünümü değişir.",
    ["Tüm saat ve tarih/saat alanları"],
    "HH:mm:ss seçiminde saat 16:05:09 görünür.",
  ),
  yearFormat: g(
    "Yılın iki veya dört haneli gösterimini belirler.",
    "Belge verisini değil yalnız görünümü etkiler.",
    ["Yıl etiketleri ve raporlar"],
    "yyyy seçiminde 2026, yy seçiminde 26 görünür.",
  ),
  timeZoneId: g(
    "UTC kayıtların kullanıcıya çevrileceği varsayılan saat dilimidir.",
    "API tarihleri UTC kalır; ekranda seçilen bölge saatine dönüştürülür.",
    ["Audit zamanları", "Operasyon tarihleri", "Raporlar"],
    "13:00 UTC, Europe/Istanbul seçiminde 16:00 gösterilir.",
    "Saat dilimi değişikliği eski kayıtların UTC değerini değiştirmez.",
  ),
  passwordMinimumLength: g(
    "Yeni veya değiştirilen parolaların asgari karakter sayısıdır.",
    "Kimlik modülü daha kısa parolaları reddeder.",
    ["Kullanıcı oluşturma", "Parola değiştirme", "Şifre sıfırlama"],
    "8 seçildiyse 7 karakterli parola kaydedilemez.",
  ),
  passwordMaximumLength: g(
    "Sistemin kabul ettiği üst parola sınırıdır.",
    "Güvenlik altyapısının sabit üst limitidir ve bu ekrandan değiştirilemez.",
    ["Kimlik doğrulama"],
    "Kullanıcı en fazla gösterilen karakter sayısında parola belirler.",
  ),
  sendSerialsToErp: onOff(
    {
      effect:
        "WMS operasyonlarındaki seri bilgileri ERP belge satırlarına da gönderilir.",
      affects: [
        "Mal kabul",
        "Transfer",
        "Sevk ve ambar işlemlerinin ERP kayıtları",
      ],
      scenario:
        "Serili ürün kabulünde seri listesi Netsis irsaliyesine aktarılır.",
    },
    {
      effect:
        "Seriler yalnız WMS içinde izlenir; ERP’ye belge miktarı gönderilir.",
      affects: ["ERP entegrasyonu", "WMS seri sicili"],
      scenario:
        "WMS seri bazında stok tutar, Netsis’e yalnız 10 AD miktar gider.",
    },
  ),
};

const subcontracting: Record<string, ValueGuide> = {
  requireSupplier: onOff(
    {
      effect: "Her fason giriş/çıkış belgesi bir tedarikçiye bağlanır.",
      affects: ["Fason emir oluşturma", "ERP cari eşlemesi"],
      scenario: "Boyaya gönderilen malzeme seçilen fason carisiyle kaydedilir.",
    },
    {
      effect: "Tedarikçi seçimi zorunlu değildir.",
      affects: ["Fason emir oluşturma"],
      scenario: "İç atölye transferi cari seçmeden açılır.",
    },
  ),
  requireSubcontractOrderForReceipt: onOff(
    {
      effect: "Fason dönüş kabulü geçerli fason siparişine dayanmalıdır.",
      affects: ["Fason giriş", "Sipariş bakiyesi"],
      scenario: "Sipariş numarası olmayan dönüş kabul edilmez.",
    },
    {
      effect: "Siparişsiz fason dönüş kabulü mümkün olabilir.",
      affects: ["Fason giriş"],
      scenario: "Acil işlem sipariş bağlantısı olmadan kabul edilir.",
    },
  ),
  requireIssueBeforeReceipt: onOff(
    {
      effect: "Dönüş miktarı daha önce fasona gönderilmiş miktarı aşamaz.",
      affects: ["Fason giriş", "Gönderilen/kalan miktar"],
      scenario: "10 AD gönderilmişse en fazla 10 AD dönüş alınır.",
    },
    {
      effect: "Önceki fason çıkışı olmadan dönüş kaydı açılabilir.",
      affects: ["Fason giriş"],
      scenario: "Sisteme geçiş öncesi gönderilmiş ürün doğrudan kabul edilir.",
    },
  ),
  allowOrderlessIssue: onOff(
    {
      effect: "Fason siparişi olmadan tedarikçiye malzeme çıkışı açılabilir.",
      affects: ["Fason çıkış"],
      scenario: "Numune işleme için siparişsiz malzeme gönderilir.",
    },
    {
      effect: "Her fason çıkışı siparişe bağlanır.",
      affects: ["Fason çıkış"],
      scenario: "Sipariş seçmeden emir kaydedilemez.",
    },
  ),
  allowOrderlessReceipt: onOff(
    {
      effect: "Sipariş olmadan fason dönüş kabulü yapılabilir.",
      affects: ["Fason giriş"],
      scenario: "Eski dönem işi siparişsiz geri alınır.",
    },
    {
      effect: "Fason dönüş için sipariş zorunludur.",
      affects: ["Fason giriş"],
      scenario: "Sipariş seçimi yapılmadan kabul başlatılamaz.",
    },
  ),
  allowSupplierToSupplier: onOff(
    {
      effect:
        "Malzeme ana depoya dönmeden bir fasoncudan diğerine yönlendirilebilir.",
      affects: ["Fason transfer rotası"],
      scenario: "Boyacıdan çıkan ürün doğrudan galvanizciye gönderilir.",
    },
    {
      effect: "Fasonlar arası doğrudan transfer engellenir.",
      affects: ["Fason transfer rotası"],
      scenario: "Ürün önce şirket deposuna kabul edilmelidir.",
    },
  ),
  allowPartialIssue: onOff(
    {
      effect: "Planlanan fason çıkışın bir kısmı sevk edilebilir.",
      affects: ["Fason çıkış", "Kalan miktar"],
      scenario: "100 AD’nin 60 AD’si ilk araçla gönderilir.",
    },
    {
      effect: "Fason çıkış tüm miktarı bekler.",
      affects: ["Fason çıkış"],
      scenario: "60/100 hazırken çıkış tamamlanmaz.",
    },
  ),
  allowPartialReceipt: onOff(
    {
      effect: "Fason dönüşü parça parça kabul edilebilir.",
      affects: ["Fason giriş", "Kalan miktar"],
      scenario: "100 AD işin 40 AD’si bugün kabul edilir.",
    },
    {
      effect: "Dönüş kabulü tüm miktarı bekler.",
      affects: ["Fason giriş"],
      scenario: "40/100 dönüşte belge kapanmaz.",
    },
  ),
  requireQualityOnReceipt: onOff(
    {
      effect: "Fason dönüşü kalite kontrolüne yönlenir.",
      affects: ["Fason giriş", "Kalite inceleme"],
      scenario: "Kaplama dönüşü kalite onayı sonrası stoğa açılır.",
    },
    {
      effect: "Fason dönüş için otomatik kalite kapısı aranmaz.",
      affects: ["Fason giriş"],
      scenario: "Standart işlem görmüş ürün doğrudan stoğa alınır.",
    },
  ),
  requireTaskAssignment: onOff(
    {
      effect: "Fason operasyon emri bir kullanıcıya atanmalıdır.",
      affects: ["Görev havuzu", "Atanmış emirler"],
      scenario: "Depocu seçilmeden çıkış görevi yayımlanmaz.",
    },
    {
      effect: "Emir atamasız görev havuzunda ilerleyebilir.",
      affects: ["Görev havuzu"],
      scenario: "Uygun operatör görevi kendisi alır.",
    },
  ),
  requireApproval: onOff(
    {
      effect: "Fason belge operasyona çıkmadan yetkili onayı gerekir.",
      affects: ["Emir onayı"],
      scenario: "Planlayıcı emri açar; amir onaylayınca depoya düşer.",
    },
    {
      effect: "Geçerli belge doğrudan operasyona alınabilir.",
      affects: ["Emir durumu"],
      scenario: "Emir kaydedilince görev başlayabilir.",
    },
  ),
  allowOverReceipt: onOff(
    {
      effect:
        "Fason dönüş, tanımlı tolerans içinde gönderilenden fazla olabilir.",
      affects: ["Fason giriş miktar kontrolü"],
      scenario: "Fire/ölçüm farkıyla 100 yerine 101 kg kabul edilir.",
    },
    {
      effect: "Gönderilen miktardan fazla dönüş engellenir.",
      affects: ["Fason giriş"],
      scenario: "100 AD çıkışa 101 AD kabul reddedilir.",
    },
  ),
  overReceiptTolerancePercent: g(
    "Fason fazla dönüşünün azami yüzdesidir.",
    "Yalnız fazla kabule izin verildiğinde kullanılır.",
    ["Fason giriş miktar kontrolü"],
    "100 kg ve %2 toleransta en fazla 102 kg kabul edilir.",
  ),
  defaultLeadTimeDays: g(
    "Yeni fason işlerde varsayılan termin gün sayısıdır.",
    "Planlanan dönüş tarihi belge tarihine bu gün eklenerek önerilir.",
    ["Fason emir termin tarihi", "Gecikme raporları"],
    "5 gün seçilirse 8 Ağustos’ta açılan iş 13 Ağustos terminli gelir.",
  ),
};

const production: Record<string, ValueGuide> = {
  productionOrderSource: {
    NetsisErpFunctions: g(
      "İş emri ve reçete anlık Netsis fonksiyonlarından okunur.",
      "WMS entegrasyon kaynak tabloları listede kullanılmaz.",
      ["Üretim emri seçimi", "Reçete kalemleri"],
      "Operatör Netsis’te açık iş emrini seçer ve malzeme satırlarını getirir.",
    ),
    WmsIntegrationTables: g(
      "İş emri ve reçete WMS entegrasyon tablolarından okunur.",
      "Windbox gibi dış sistem RII_PR_SOURCE_ORDER ve satırlarını besler.",
      ["Üretim emri seçimi", "Dış sistem entegrasyonu"],
      "Windbox WINDBOX kaynak koduyla emir yazar; WMS bu emri listeler.",
    ),
    ErpAndWms: g(
      "ERP ve WMS kaynaklı emirler birlikte listelenir.",
      "Kaynak sistem etiketi ve benzersiz anahtarıyla çakışma önlenir.",
      ["Üretim emri seçimi"],
      "Aynı numaralı ERP ve WINDBOX emri kaynak etiketiyle ayrı görünür.",
    ),
  },
  wmsSourceSystemCode: g(
    "WMS entegrasyon tablosunda okunacak dış sistem kodudur.",
    "Yalnız bu koda ait aktif ve sürümlü emirler listelenir.",
    ["RII_PR_SOURCE_ORDER", "Üretim emri seçimi"],
    "WINDBOX yazılırsa SourceSystemCode=WINDBOX kayıtları gelir.",
  ),
  requireProductionOrderReference: onOff(
    {
      effect: "Transfer geçerli üretim iş emrine bağlanmalıdır.",
      affects: ["Üretime transfer oluşturma"],
      scenario: "İş emri seçilmeden transfer kaydedilemez.",
    },
    {
      effect: "İş emri olmadan plansız üretime transfer açılabilir.",
      affects: ["Manuel transfer"],
      scenario: "Acil tüketim stok ve miktar seçilerek açılır.",
    },
  ),
  allowManualTransfer: onOff(
    {
      effect: "Plansız/manüel üretime transfer seçeneği kullanılabilir.",
      affects: ["Yeni üretime transfer"],
      scenario: "İş emri gelmeden acil malzeme üretime gönderilir.",
    },
    {
      effect: "Yalnız kaynak iş emrine dayalı transfer açılır.",
      affects: ["Yeni transfer"],
      scenario: "Manuel stok seçimi menüde kullanılamaz.",
    },
  ),
  requireErpMasterDataForManualTransfer: onOff(
    {
      effect:
        "Manuel transferde stok/depo/yapı kodu ERP aynasından doğrulanır.",
      affects: ["Manuel transfer doğrulaması"],
      scenario: "ERP’de tanımsız stokla plansız transfer açılamaz.",
    },
    {
      effect: "Manuel transfer WMS ana verisiyle ilerleyebilir.",
      affects: ["Manuel transfer"],
      scenario: "WMS’de aktif stok varsa ERP kontrolü olmadan seçilebilir.",
    },
  ),
  allowAutomaticGeneration: onOff(
    {
      effect: "Uygun kaynak emirlerden transfer otomatik üretilebilir.",
      affects: ["Entegrasyon işi", "Transfer taslağı"],
      scenario: "Onaylı üretim emri geldiğinde transfer taslağı oluşur.",
    },
    {
      effect: "Transfer kullanıcı tarafından başlatılır.",
      affects: ["Yeni transfer"],
      scenario: "İş emri listeden seçilip elle transfer oluşturulur.",
    },
  ),
  checkMaterialAvailability: onOff(
    {
      effect: "Emir açma/başlatmada kaynak stok uygunluğu kontrol edilir.",
      affects: ["Emir doğrulama", "Kaynak bakiye"],
      scenario: "10 AD gerekli, 8 AD varsa eksik uyarısı gösterilir.",
    },
    {
      effect:
        "Ön stok uygunluğu kontrolü yapılmaz; kesin kontrol toplamaya kalır.",
      affects: ["Toplama"],
      scenario: "Emir açılır fakat operatör rafta eksik görebilir.",
    },
  ),
  blockOnShortage: onOff(
    {
      effect: "Stok eksikse üretim transferi başlatılamaz.",
      affects: ["Görev başlatma"],
      scenario: "8/10 stokta görev bloke edilir.",
    },
    {
      effect: "Eksik stok uyarıyla kabul edilip kısmi akışa geçebilir.",
      affects: ["Görev başlatma", "Eksik miktar"],
      scenario: "8/10 stokla görev başlar, 2 AD kalan olarak izlenir.",
    },
  ),
  requireTaskAssignment: outbound.requireAssigneeForTask,
  requireSourceProductionLocation: onOff(
    {
      effect: "Toplamada üretim kaynak rafı barkodla doğrulanır.",
      affects: ["Toplama", "Raf bakiyesi"],
      scenario: "Doğru stok yanlış raftan okutulursa reddedilir.",
    },
    {
      effect: "Kaynak raf zorunluluğu uygulanmaz.",
      affects: ["Toplama"],
      scenario: "Sistem uygun bakiyeden kaynak çözebilir.",
    },
  ),
  requireTargetProductionLocation: onOff(
    {
      effect: "Üretim alanındaki hedef raf tanımlı olmalıdır.",
      affects: ["Teslim/transfer onayı", "Hedef raf bakiyesi"],
      scenario: "Malzeme üretim staging rafına atanır.",
    },
    {
      effect: "Hedef raf seçimi zorunlu değildir.",
      affects: ["Transfer tamamlama"],
      scenario: "Malzeme hedef depo seviyesinde teslim edilir.",
    },
  ),
  allowPartialSupply: onOff(
    {
      effect:
        "Talebin bir kısmı üretime teslim edilip kalan için yeni iş emri açılabilir.",
      affects: ["Transfer onayı", "Kalan emir"],
      scenario:
        "10 AD talebin 8 AD’si teslim edilir; 2 AD için devam emri oluşur.",
    },
    {
      effect: "Transfer onayı tüm talep miktarını bekler.",
      affects: ["Transfer onayı"],
      scenario: "8/10 durumda tamamla engellenir.",
    },
  ),
  allowOverIssue: onOff(
    {
      effect: "Üretime plan üstü çıkış tolerans içinde yapılabilir.",
      affects: ["Toplama miktarı", "Transfer onayı"],
      scenario: "100 kg talebe 101 kg toleransla verilir.",
    },
    {
      effect: "Talep miktarından fazla çıkış engellenir.",
      affects: ["Barkod okutma"],
      scenario: "10 AD talepte 11. ürün reddedilir.",
    },
  ),
  overIssueTolerancePercent: g(
    "Üretime fazla çıkışın azami yüzdesidir.",
    "Yalnız fazla çıkış açıkken uygulanır.",
    ["Toplama miktar kontrolü"],
    "100 kg ve %1 toleransta en fazla 101 kg verilir.",
  ),
  requireApproval: onOff(
    {
      effect: "Üretime teslim alan kişi/amir son transfer onayı verir.",
      affects: ["İkinci adım transfer onayı"],
      scenario:
        "Depocu toplar; üretim sorumlusu fiziksel teslim alınca onaylar.",
    },
    {
      effect: "Toplama tamamlanınca transfer otomatik tamamlanabilir.",
      affects: ["Transfer durumu"],
      scenario: "Ayrı teslim alan onayı aranmaz.",
    },
  ),
  erpPostingPolicy: {
    AfterHandover: g(
      "Fiziksel teslim onaylanınca üretim transferi Netsis'e otomatik gönderilir.",
      "WMS stok ve raf hareketini önce transaction içinde tamamlar; Netsis çağrısı daha sonra idempotent olarak çalışır. Netsis başarısız olsa bile tamamlanan WMS hareketi kaybolmaz ve kayıt üzerinden tekrar denenebilir.",
      ["Transferi onayla", "Netsis DAT belgesi", "ERP gönderim geçmişi"],
      "Depocu 10 AD toplar, talep sahibi teslimi onaylar; WMS transferi tamamlar ve aynı belgeyi Netsis'e otomatik gönderir.",
    ),
    Manual: g(
      "Fiziksel transfer WMS'te tamamlanır ancak Netsis'e otomatik gönderilmez.",
      "ERP gönderme yetkisi bulunan kullanıcı tamamlanan kayıt içindeki 'Netsis'e Gönder / Tekrar Dene' düğmesini kullanmalıdır.",
      ["Tamamlanan transfer", "Netsis'e manuel gönderim"],
      "Gece vardiyası transferi tamamlar; muhasebe veya yetkili depo yöneticisi belgeyi daha sonra Netsis'e yollar.",
    ),
    Disabled: g(
      "Bu üretim transferi için Netsis belgesi oluşturulmaz.",
      "Yalnız WMS stok, seri, depo ve raf bakiyeleri güncellenir. Kullanıcı ekranında Netsis'e gönderme düğmesi gösterilmez.",
      ["WMS iç hareket", "ERP dışı süreç"],
      "ERP'de izlenmeyen geçici üretim alanı hareketi yalnız WMS içinde tamamlanır.",
    ),
  },
  cancellationReturnPolicy: {
    OriginalSourceLocation: g(
      "İptalde stok özgün toplandığı rafa döner.",
      "Hareket kaydı kaynak rafı korur.",
      ["İptal iadesi", "Raf bakiyesi"],
      "Toplanan seri iptal edilince aynı kaynak rafa geri alınır.",
    ),
    WarehouseDefaultReturnLocation: g(
      "İptalde deponun varsayılan iade rafı kullanılır.",
      "Depo iade rafı yoksa işlem engellenir.",
      ["İptal iadesi", "Depo raf ayarı"],
      "İptal edilen malzeme IADE-01 rafına gider.",
    ),
    ManagerSelectionRequired: g(
      "İptalde hedef iade rafını yönetici seçer.",
      "Raf seçilmeden ters hareket tamamlanmaz.",
      ["İptal ekranı", "Yetki"],
      "Hasarlı ürün kaynak yerine karantina rafına seçilir.",
    ),
  },
};

const kkd: Record<string, ValueGuide> = {
  enableMaterialRequestOrderFlow: onOff(
    {
      effect: "Personel malzeme talepleri Netsis açık siparişleriyle çalışır.",
      affects: ["KKD dağıtım", "Üretim görev havuzu"],
      scenario: "Personelin carisine ait açık sipariş kalemleri seçilir.",
    },
    {
      effect: "Sipariş kaynaklı malzeme talep kanalı kapalıdır.",
      affects: ["KKD dağıtım"],
      scenario: "Dağıtım yalnız hak matrisi/manual süreçten açılır.",
    },
  ),
  requireOpenOrder: onOff(
    {
      effect: "Dağıtım için açık Netsis siparişi zorunludur.",
      affects: ["Yeni KKD dağıtımı"],
      scenario: "Açık siparişi olmayan personele belge açılamaz.",
    },
    {
      effect: "Hak varsa siparişsiz KKD dağıtımı yapılabilir.",
      affects: ["Yeni dağıtım"],
      scenario: "Dönemsel eldiven hakkı sipariş olmadan teslim edilir.",
    },
  ),
  allowMultipleOrdersPerDistribution: onOff(
    {
      effect: "Tek dağıtım farklı siparişlerden kalem içerebilir.",
      affects: ["KKD dağıtım satırları"],
      scenario: "Ayakkabı ve baret iki siparişten aynı teslimde verilir.",
    },
    {
      effect: "Bir dağıtım tek siparişe bağlıdır.",
      affects: ["KKD dağıtımı"],
      scenario: "Başka sipariş kalemi için ayrı belge açılır.",
    },
  ),
  allowOpenOrderExcess: onOff(
    {
      effect:
        "Açık sipariş varsa hak matrisinin üstünde teslim mümkün olabilir.",
      affects: ["Hak kontrolü", "Kota"],
      scenario: "Yıllık hakkı biten personele açık siparişten ek ürün verilir.",
    },
    {
      effect: "Teslim hesaplanan hak miktarını aşamaz.",
      affects: ["Hak sorgulama"],
      scenario: "Hakkı 1 olan personele ikinci ürün engellenir.",
    },
  ),
  requireManagerApprovalForExcess: onOff(
    {
      effect: "Hak üstü teslim yönetici onayı olmadan ambar çıkışına dönüşmez.",
      affects: ["KKD onayı", "Ambar çıkışı"],
      scenario: "Fazla baret talebi müdür onayına düşer.",
    },
    {
      effect:
        "Yetkili operatör izin verilen fazlayı ek onaysız tamamlayabilir.",
      affects: ["KKD dağıtımı"],
      scenario: "Açık siparişli ek teslim doğrudan yapılır.",
    },
  ),
  requireEmployeeUserLink: onOff(
    {
      effect: "Personel kartı aktif WMS kullanıcısına bağlı olmalıdır.",
      affects: ["Personel doğrulama", "İzlenebilirlik"],
      scenario: "Kullanıcı bağlantısı olmayan personele teslim engellenir.",
    },
    {
      effect: "WMS hesabı olmayan personele de kayıt açılabilir.",
      affects: ["KKD dağıtımı"],
      scenario: "Saha çalışanına personel kartı üzerinden teslim yapılır.",
    },
  ),
  allowFutureDatedDistribution: onOff(
    {
      effect: "İleri tarihli planlı KKD dağıtımı kaydedilebilir.",
      affects: ["Belge tarihi", "Hak dönemi"],
      scenario: "Gelecek hafta başlayacak personelin teslimi planlanır.",
    },
    {
      effect: "Belge tarihi bugünden ileri olamaz.",
      affects: ["Yeni dağıtım"],
      scenario: "Yarın tarihi seçildiğinde doğrulama hatası gelir.",
    },
  ),
};

const procurement: Record<string, ValueGuide> = {
  allowMultipleRfqsPerRequest: onOff(
    {
      effect: "Aynı talepten birden fazla teklif turu açılabilir.",
      affects: ["Teklif talebi oluşturma", "Belge zinciri"],
      scenario:
        "İlk tur pahalı bulunur; aynı talep için ikinci tedarikçi turu açılır.",
    },
    {
      effect: "Talep tek aktif teklif turuyla sınırlandırılır.",
      affects: ["Teklif talebi"],
      scenario: "İkinci RFQ açmak için önce mevcut tur kapatılır.",
    },
  ),
  allowPartialRfqLines: onOff(
    {
      effect: "Talebin seçilen kalem/miktarı fiyatlamaya çıkarılabilir.",
      affects: ["RFQ satırları", "Açık talep miktarı"],
      scenario: "10 kalemlik talebin yalnız acil 3 kalemi RFQ’ya alınır.",
    },
    {
      effect: "Talebin tüm açık kalemleri birlikte RFQ’ya alınır.",
      affects: ["RFQ oluşturma"],
      scenario: "Kalem seçerek kısmi tur açılamaz.",
    },
  ),
  allowMultipleQuotesPerSupplier: onOff(
    {
      effect:
        "Aynı tedarikçi aynı tur için birden fazla teklif kaydı sunabilir.",
      affects: ["Teklif kayıtları"],
      scenario: "Tedarikçi alternatif marka için ikinci teklif verir.",
    },
    {
      effect: "Tedarikçi başına tek teklif kaydı tutulur.",
      affects: ["Teklif girişi"],
      scenario: "Yeni fiyat mevcut teklif revizyonuyla güncellenir.",
    },
  ),
  allowSplitAwardsAcrossSuppliers: onOff(
    {
      effect: "Talep kalemleri/miktarları farklı tedarikçilere bölünebilir.",
      affects: ["Teklif karşılaştırma", "Sipariş oluşturma"],
      scenario: "5 kalem A firmasına, 3 kalem B firmasına verilir.",
    },
    {
      effect: "Ödül tek tedarikçide bütün olarak sonuçlanır.",
      affects: ["Teklif onayı"],
      scenario: "Talebin tamamı seçilen firmaya verilir.",
    },
  ),
  allowPartialOrderLines: onOff(
    {
      effect: "Teklifin seçilen miktarı siparişe dönüştürülebilir.",
      affects: ["Satınalma siparişi", "Kalan teklif miktarı"],
      scenario: "100 AD teklifin 60 AD’si sipariş edilir.",
    },
    {
      effect: "Teklif satırı tam miktarla siparişe dönüşür.",
      affects: ["Sipariş oluşturma"],
      scenario: "60/100 sipariş girişi engellenir.",
    },
  ),
  allowMultipleOrdersPerQuote: onOff(
    {
      effect: "Aynı tekliften birden fazla sipariş oluşturulabilir.",
      affects: ["Teklif-sipariş zinciri"],
      scenario: "60 AD bugün, kalan 40 AD sonraki siparişte açılır.",
    },
    {
      effect: "Teklif tek siparişe dönüşür.",
      affects: ["Sipariş oluşturma"],
      scenario: "İkinci sipariş açma engellenir.",
    },
  ),
  allowSupplierQuantityChange: onOff(
    {
      effect: "Tedarikçi talep edilenden farklı miktar önerebilir.",
      affects: ["Portal teklif satırları"],
      scenario:
        "100 istenen ürün için minimum paket nedeniyle 120 teklif edilir.",
    },
    {
      effect: "Teklif miktarı talep miktarıyla aynı kalır.",
      affects: ["Teklif girişi"],
      scenario: "Tedarikçi yalnız fiyat ve termin girer.",
    },
  ),
  allowZeroUnitPrice: onOff(
    {
      effect: "Bedelsiz/numune kaleminde sıfır fiyat kabul edilir.",
      affects: ["Teklif doğrulama"],
      scenario: "Numune ürün 0 TL ile gönderilir.",
    },
    {
      effect: "Her teklif kaleminde pozitif fiyat gerekir.",
      affects: ["Teklif gönderme"],
      scenario: "0 fiyatlı kalem teklif gönderimini engeller.",
    },
  ),
  requireSupplierDeliveryDate: onOff(
    {
      effect: "Her teklif kaleminde termin tarihi zorunludur.",
      affects: ["Teklif gönderme", "Karşılaştırma"],
      scenario: "Termin boşsa tedarikçi teklifi gönderemez.",
    },
    {
      effect: "Termin tarihi isteğe bağlıdır.",
      affects: ["Teklif girişi"],
      scenario: "Yalnız fiyatla teklif verilebilir.",
    },
  ),
  allowSupplierRevisions: onOff(
    {
      effect: "Gönderilmiş teklif için revizyon turu açılabilir.",
      affects: ["Tedarikçi portalı", "Teklif geçmişi"],
      scenario:
        "Satınalma fiyat revizyonu ister; tedarikçi yeni sürüm gönderir.",
    },
    {
      effect: "Gönderilen teklif değiştirilemez.",
      affects: ["Teklif durumu"],
      scenario: "Değişiklik için yeni teklif kaydı/tur gerekir.",
    },
  ),
  supplierQuoteChannelMode: {
    InternalOnly: g(
      "Teklifleri yalnız satınalma personeli sistem içinde girer.",
      "Tedarikçiye dış bağlantı gönderilmez.",
      ["Teklif girişi"],
      "E-posta teklifi satınalma uzmanı sisteme kaydeder.",
    ),
    PortalOptional: g(
      "Teklif portal veya iç kullanıcı tarafından girilebilir.",
      "Her iki kanal birlikte kullanılabilir.",
      ["Tedarikçi portalı", "İç teklif girişi"],
      "Bir firma bağlantıdan, diğeri telefonla verdiği teklifi personel üzerinden girer.",
    ),
    PortalRequired: g(
      "Teklif yalnız tedarikçinin güvenli bağlantısından gönderilir.",
      "İç kullanıcı tedarikçi adına nihai teklif giremez.",
      ["Tedarikçi portalı"],
      "Tedarikçi e-postadaki bağlantıdan fiyat ve termin girer.",
    ),
  },
  invitationValidityDays: g(
    "Tedarikçi bağlantısının kaç gün geçerli olacağını belirler.",
    "Süre sonunda tokenla teklif ekranı açılamaz.",
    ["Tedarikçi daveti", "Portal güvenliği"],
    "7 gün seçilirse sekizinci gün bağlantı süresi dolmuş görünür.",
  ),
  maximumSupplierRevisionCount: g(
    "Bir teklif için izin verilen azami revizyon turudur.",
    "Sınır dolduğunda yeni revizyon istenemez.",
    ["Teklif revizyon geçmişi"],
    "2 seçildiyse tedarikçi en fazla iki yeni sürüm gönderebilir.",
  ),
  allowSupplierDraftSave: onOff(
    {
      effect: "Tedarikçi teklifi göndermeden ara kayıt yapabilir.",
      affects: ["Tedarikçi portalı"],
      scenario: "Çok kalemli teklif bugün kaydedilip yarın tamamlanır.",
    },
    {
      effect: "Portal girişi tek oturumda gönderilmelidir.",
      affects: ["Tedarikçi portalı"],
      scenario: "Sayfa kapanırsa gönderilmemiş giriş saklanmaz.",
    },
  ),
};

const barcode: Record<string, ValueGuide> = {
  displayName: g(
    "Profilin kullanıcıya görünen adıdır; üretilen barkod değerini değiştirmez.",
    "Kart, düzenleme penceresi ve operasyon seçimlerinde bu açıklayıcı ad gösterilir.",
    ["Barkod politika kartı", "Kullanıcı seçimi", "Operasyon ekranları"],
    "“Ürün / Seri” adı operatöre profilin seri takipli stoklar için olduğunu anlatır; barkod içeriğine yazılmaz.",
  ),
  prefix: g(
    "Barkodun başına sabit bir tür kodu ekler.",
    "Tarayıcı, barkodun hangi profile ait olduğunu daha hızlı ayırt edebilir; boş bırakılırsa barkod ilk segmentle başlar.",
    ["Barkod deseni", "Tarayıcı yönlendirmesi", "Etiket çıktısı"],
    "Ön ek WMS-S ise barkod WMS-S/150-01/SN-1 biçiminde başlar.",
    "Ön eki değiştirmek daha önce basılmış etiketleri değiştirmez; yeni üretilen barkodlar yeni ön eki kullanır.",
  ),
  separator: g(
    "Ön ek ve segmentler arasındaki ayraç karakteridir.",
    "Barkod üretilirken tüm parçalar bu değerle birleştirilir; çözümleme ve insan tarafından okunabilirlik buna göre değişir.",
    ["Barkod deseni", "Barkod ayrıştırma", "Etiket çıktısı"],
    "Ayraç “/” ise STK-1, SN-10 ve LOT-A değerleri STK-1/SN-10/LOT-A olur.",
    "Stok kodu veya seri değerinde seçilen ayraç kullanılıyorsa ayrıştırma belirsizleşebilir.",
  ),
  isEnabled: onOff(
    {
      summary:
        "Profil yeni barkod üretimi ve önizleme işlemlerinde kullanılabilir.",
      effect: "Bu kapsamdaki operasyonlar tanımlı desenle barkod üretebilir.",
      affects: [
        "Mal kabul etiketi",
        "Barkod üretim servisi",
        "Operasyon ekranları",
      ],
      scenario:
        "Ürün / Seri profili açıkken mal kabulde seri etiketi oluşturulur.",
    },
    {
      summary:
        "Profil yeni barkod üretimine kapatılır; geçmiş barkodlar korunur.",
      effect:
        "Bu kapsama yeni barkod üretme isteği engellenir, mevcut kayıtlar ve basılmış etiketler silinmez.",
      affects: ["Yeni barkod üretimi", "Etiket basma"],
      scenario:
        "Profil kapatıldıktan sonra yeni seri etiketi üretilemez; dün basılmış etiket hâlâ sorgulanabilir.",
    },
  ),
};

const catalog: Record<string, Record<string, ValueGuide>> = {
  inbound,
  goodsReceipt: inbound,
  outbound,
  shipping: outbound,
  transfer,
  quality,
  packing,
  project,
  subcontracting,
  production,
  kkd,
  procurement,
  barcode,
};

export function parameterGuidance(
  module: keyof typeof catalog,
  field: string,
  value: unknown,
): ParameterGuidanceContent {
  const definition = catalog[module][field];
  if (!definition) {
    return withResourceKey(
      g(
        "Bu değer yeni oluşturulan işlemlerin çalışma kuralını belirler.",
        "Değişiklik kaydedildikten sonra yeni operasyonlarda uygulanır; mevcut tamamlanmış kayıtlar geriye dönük değiştirilmez.",
        ["İlgili modülün yeni kayıt ve doğrulama adımları"],
        "Ayar değiştirildikten sonra açılan ilk yeni işlem seçilen kurala göre doğrulanır.",
      ),
      module,
      field,
      "_fallback",
    );
  }
  if (isGuide(definition)) {
    return withResourceKey(definition, module, field, "default");
  }

  const valueKey = String(value);
  const resolved = definition[valueKey];
  return withResourceKey(
    resolved ??
      g(
        "Seçilen değer bu alanın operasyon davranışını belirler.",
        "Değer kaydedildiğinde ilgili modülün yeni işlemlerinde uygulanır.",
        ["İlgili modül"],
        `Yeni işlem “${String(value)}” kuralıyla başlatılır.`,
      ),
    module,
    field,
    resolved ? valueKey : "_fallback",
  );
}

export function parameterToggleGuidance(
  module: keyof typeof catalog,
  field: string,
): ParameterToggleGuidance {
  return {
    enabled: parameterGuidance(module, field, true),
    disabled: parameterGuidance(module, field, false),
  };
}

export function buildParameterGuidanceSourceResource(): Record<string, unknown> {
  const guidance: Record<string, Record<string, Record<string, ParameterGuidanceContent>>> = {};

  for (const [module, fields] of Object.entries(catalog)) {
    guidance[module] = {};
    for (const [field, definition] of Object.entries(fields)) {
      guidance[module][field] = {};
      if (isGuide(definition)) {
        guidance[module][field].default = stripResourceKey(
          enrichGuidance(definition),
        );
        continue;
      }

      for (const [value, content] of Object.entries(definition)) {
        guidance[module][field][value] = stripResourceKey(
          enrichGuidance(content),
        );
      }
    }
  }

  return { guidance };
}

export type ParameterGuidanceHint = {
  module: string;
  field: string;
  value?: string;
};

export type ParameterGuidanceOption = {
  value: string;
  guidance: ParameterGuidanceContent;
};

const parameterQuestionWords = [
  "parametre", "ayar", "secenek", "seçenek", "dropdown", "acilir liste", "açılır liste", "politika", "kural",
  "ne ise yarar", "ne işe yarar", "ne demek", "secersem", "seçersem", "acarsam", "açarsam",
  "what does", "parameter", "setting", "option",
];

const fieldAliases: Record<string, readonly string[]> = {
  "goodsReceipt.blockPutawayUntilQualityDecision": ["kalite bekleyen üründe hangi raflar seçilebilir", "kalite beklerken raflama", "kalite raf seçimi"],
  "goodsReceipt.erpPostingPolicy": ["mal kabul erp aktarım zamanı", "irsaliye ne zaman netsise atılır", "erp kayıt zamanı"],
  "goodsReceipt.erpQualityGatePolicy": ["kalite erp aktarımını bekletsin", "manuel kalite planı erp", "kalite kapısı"],
  "goodsReceipt.inventoryAvailabilityPolicy": ["stok ne zaman kullanılabilir", "mal kabul stok kullanılabilirliği"],
  "project.sendSerialsToErp": ["serileri erpye aktar", "seri netsise gitsin mi"],
  "production.productionOrderSource": ["üretim emri kaynağı", "iş emri nereden okunsun", "erp ve wms emirleri"],
  "transfer.directPostingPolicy": ["transfer erp kayıt biçimi", "dat kayıt biçimi"],
  "shipping.reservationPolicy": ["sevk rezervasyon politikası", "sevk stok ayırma"],
};

export function resolveParameterGuidanceHint(
  question: string,
  t?: TFunction,
): ParameterGuidanceHint | null {
  const normalizedQuestion = normalizeSearchText(question);
  if (!parameterQuestionWords.some((word) => normalizedQuestion.includes(normalizeSearchText(word)))) return null;
  const tokens = meaningfulTokens(normalizedQuestion);
  let best: { score: number; module: string; field: string; value?: string } | null = null;

  for (const [module, fields] of Object.entries(catalog)) {
    for (const [field, definition] of Object.entries(fields)) {
      const options = isGuide(definition)
        ? [["default", definition] as const]
        : Object.entries(definition);
      const aliasText = fieldAliases[`${module}.${field}`]?.join(" ") ?? "";
      const fieldText = normalizeSearchText(`${splitCamelCase(field)} ${aliasText}`);
      let score = scoreText(normalizedQuestion, tokens, fieldText) * 2;
      let selectedValue: string | undefined;
      let selectedScore = 0;

      for (const [value, rawGuidance] of options) {
        const guidance = localizeParameterGuidance(
          withResourceKey(rawGuidance, module, field, value),
          t,
        );
        const optionText = normalizeSearchText([
          value,
          guidance.summary,
          guidance.effect,
          guidance.scenario,
          guidance.decision,
          guidance.warning,
          ...guidance.affects,
        ].filter(Boolean).join(" "));
        const optionScore = scoreText(normalizedQuestion, tokens, optionText);
        score += Math.min(optionScore, 8);
        if (optionScore > selectedScore && optionMentioned(normalizedQuestion, value, optionText)) {
          selectedScore = optionScore;
          selectedValue = value === "default" ? undefined : value;
        }
      }

      if (!best || score > best.score) best = { score, module, field, value: selectedValue };
    }
  }

  return best && best.score >= 4
    ? { module: best.module, field: best.field, value: best.value }
    : null;
}

export function parameterGuidanceOptions(
  module: string,
  field: string,
  t?: TFunction,
): ParameterGuidanceOption[] {
  const definition = catalog[module]?.[field];
  if (!definition) return [];
  const options = isGuide(definition)
    ? [["default", definition] as const]
    : Object.entries(definition);
  return options.map(([value, guidance]) => ({
    value,
    guidance: localizeParameterGuidance(withResourceKey(guidance, module, field, value), t),
  }));
}

export function localizeParameterGuidance(
  guidance: ParameterGuidanceContent,
  t?: TFunction,
): ParameterGuidanceContent {
  if (!t || !guidance.resourceKey) return guidance;
  const translatedAffects = t(`${guidance.resourceKey}.affects`, {
    returnObjects: true,
    defaultValue: guidance.affects,
  });
  return {
    ...guidance,
    summary: String(t(`${guidance.resourceKey}.summary`, { defaultValue: guidance.summary })),
    effect: String(t(`${guidance.resourceKey}.effect`, { defaultValue: guidance.effect })),
    affects: Array.isArray(translatedAffects) ? translatedAffects.map(String) : guidance.affects,
    scenario: String(t(`${guidance.resourceKey}.scenario`, { defaultValue: guidance.scenario })),
    decision: guidance.decision
      ? String(t(`${guidance.resourceKey}.decision`, { defaultValue: guidance.decision }))
      : undefined,
    warning: guidance.warning
      ? String(t(`${guidance.resourceKey}.warning`, { defaultValue: guidance.warning }))
      : undefined,
  };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCamelCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function meaningfulTokens(value: string): string[] {
  const stopWords = new Set(["parametre", "ayar", "secenek", "nedir", "icin", "bunu", "bunu", "olur", "hangi", "what", "does", "this", "setting", "option"]);
  return [...new Set(value.split(" ").filter((token) => token.length >= 3 && !stopWords.has(token)))];
}

function scoreText(question: string, tokens: readonly string[], candidate: string): number {
  let score = candidate && question.includes(candidate) ? 8 : 0;
  for (const token of tokens) if (candidate.includes(token)) score += token.length >= 7 ? 2 : 1;
  return score;
}

function optionMentioned(question: string, value: string, optionText: string): boolean {
  const normalizedValue = normalizeSearchText(value);
  if (normalizedValue && question.includes(normalizedValue)) return true;
  if (value === "true") return /\b(acik|aktif|evet|acarsam|on|enabled|true)\b/.test(question);
  if (value === "false") return /\b(kapali|pasif|hayir|off|disabled|false)\b/.test(question);
  return scoreText(question, meaningfulTokens(question), optionText) >= 5;
}

function withResourceKey(
  content: ParameterGuidanceContent,
  module: string,
  field: string,
  value: string,
): ParameterGuidanceContent {
  const enriched = enrichGuidance(content);
  return {
    ...enriched,
    resourceKey: `guidance.${module}.${field}.${value}`,
  };
}

function enrichGuidance(
  content: ParameterGuidanceContent,
): ParameterGuidanceContent {
  if (content.decision) return content;

  return {
    ...content,
    decision: `Bu seçenek özellikle şu işlemleri yönetir: ${content.affects.join(", ")}. Bu işlemlerde “${content.summary}” sonucunu istiyorsanız bu değeri seçin.`,
  };
}

function stripResourceKey(
  content: ParameterGuidanceContent,
): ParameterGuidanceContent {
  const result = { ...content };
  delete result.resourceKey;
  return result;
}

function isGuide(value: ValueGuide): value is ParameterGuidanceContent {
  return (
    typeof value.summary === "string" &&
    typeof value.effect === "string" &&
    Array.isArray(value.affects)
  );
}
