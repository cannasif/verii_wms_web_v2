# WMS v2 Web QA ve Performans Denetimi

Tarih: 6 Ağustos 2026

## Kapsam

- React web mimarisi, oturum sürekliliği, 90 erişilebilir rota, ortak layout, sidebar, navbar ve modal katmanı incelendi.
- Kritik depo akışları masaüstü ve 390 x 844 mobil görünümde çalıştırıldı.
- Boş ve hatalı form durumları, çoklu sekme, hızlı navigasyon ve sidebar aç/kapat stresi test edildi.
- Geliştirme ve üretim paketleri Lighthouse ile ayrı ölçüldü.
- API derlemesi ve otomatik test paketi doğrulandı.

## Mimari özet

- React 19.1, Vite 6.4 ve React Router 7 kullanılıyor.
- Sunucu verisi TanStack Query, istemci UI durumu Zustand, HTTP katmanı Axios ile yönetiliyor.
- Rotalar `lazy` import ile yükleniyor; Vite tarafında vendor ve özellik bazlı chunk ayrımı mevcut.
- API .NET 10 modüler monolith, EF Core, Repository/Unit of Work ve modül bazlı servis yapısında.

## Doğrulanan sonuçlar

- 90/90 navigasyon rotası açıldı; 404, 500, access denied veya istemsiz login yönlendirmesi görülmedi.
- Kritik ekranlarda tarayıcı konsol hatası ve başarısız ağ isteği görülmedi.
- Üç eşzamanlı sekme aynı oturumla çalıştı ve yeni session üretmeden kimliği korudu.
- Araç/SAC kabul formu zorunlu plaka, araç görseli ve levha koşulları sağlanmadan gönderime izin vermedi.
- Profil penceresinin eksik dialog açıklaması giderildi.
- Mobil mal kabul listesi modal ve grid görünümü taşma/kapanma açısından kontrol edildi.
- Web production build başarılı; ESLint 0 hata ile tamamlandı. Kalan 54 uyarı mevcut kod tabanındaki hook/fast-refresh bakım borcudur.
- API Release build 0 hata ve 0 uyarı ile tamamlandı.
- API testlerinde izole SQL gerektirmeyen 327 test geçti. Tam paketteki 8 başarısız test ürün hatası değil, `UnknownPlateIntegrationTestConnection` adlı izole test veritabanının bilinçli olarak tanımlanmamasından kaynaklanıyor.

## Performans ölçümü

Üretim paketi login/session-recovery yüklemesi:

| Ölçüm | Sonuç |
| --- | ---: |
| Lighthouse Performance | 63-94* |
| Accessibility | 95 |
| Best Practices | 96 |
| FCP | 1.1-4.5 sn* |
| LCP | 1.4-6.2 sn* |
| TBT | 0 ms |
| CLS | 0.01 |
| Main thread işi | 0.1-0.7 sn |
| İlk yük payload | 756 KiB |

Geliştirme sunucusundaki 55 performans skoru üretim sonucu değildir. Vite'ın kaynak modüllerini, React geliştirme kodunu ve yaklaşık 16 MiB debug transferini içerir; performans kabul kriteri olarak kullanılmamalıdır.

\* Üretim preview login ekranı canlı API ile session-recovery veya yerel API ile şube yükleme yoluna göre farklı LCP üretiyor. İki senaryoda da TBT 0 ms kaldı; fark JavaScript bloklanmasından değil ilk görünür login içeriğinin veri beklemesinden kaynaklanıyor. Gerçek kullanıcı kabul metriği authenticated dashboard üzerinde RUM ile izlenmelidir.

## Kök neden analizi

Sorun yalnızca tek Windows bilgisayarında görülüyor; aynı build diğer cihazlarda ve headless üretim ölçümünde ana iş parçacığını bloke etmiyor. Kodda ise tam ekran sidebar/navbar üzerinde `backdrop-filter`, sürekli `will-change`, geniş blur katmanları ve animasyonlu arka planlar bulunuyordu. Bu kombinasyon yüksek DPI, entegre GPU seçimi, eski grafik sürücüsü veya Chrome'un yazılımsal compositing yoluna düşmesi halinde ciddi kare kaybı oluşturabilir.

Bu nedenle en güçlü kök neden, React hesaplama yükünden çok cihazın GPU/compositor yolu ile pahalı CSS katmanlarının birleşimidir. Kesin cihaz doğrulaması için sorunlu bilgisayarda `chrome://gpu` çıktısı, Performance kaydı ve aynı testin donanım hızlandırma açık/kapalı karşılaştırması alınmalıdır.

## Uygulanan düzeltmeler

- Sidebar ve navbar üzerindeki kalıcı backdrop blur kaldırıldı; opak ve düşük maliyetli yüzeylere geçirildi.
- Sidebar genişlik animasyonu ve kalıcı `will-change` kaldırıldı; yalnız transform animasyonu bırakıldı.
- 720/620 px blur objeleri statik radial gradient katmanlarına dönüştürüldü ve paint alanı sınırlandı.
- `prefers-reduced-motion` ve yavaş güncelleme cihazları için shell efektleri devre dışı bırakıldı.
- Sidebar, navbar ve dashboard Zustand abonelikleri alan bazlı selector'lara ayrıldı; ilgisiz store değişikliklerinde tüm ağacın render edilmesi engellendi.
- Grid satır sayfalama ve tercih kalıcılığı hesapları kararlı hale getirildi.
- Lazy localization yüklenirken oluşan sahte eksik anahtar konsol uyarıları kaldırıldı.
- QA raporları ve ekran görüntüleri Git kapsamı dışında tutuldu.

## Sorunlu Windows cihazında kabul kontrolü

1. Chrome güncellenmeli ve `chrome://gpu` ekranında Compositing/WebGL alanlarının hardware accelerated olduğu doğrulanmalı.
2. GPU sürücüsü cihaz üreticisinden güncellenmeli; hibrit GPU'lu laptopta Chrome yüksek performanslı GPU ile ayrıca denenmeli.
3. Windows ölçeklendirme 100%, 125% ve 150% değerlerinde ayrı ayrı test edilmeli.
4. Temiz Chrome profili ve eklentisiz gizli pencere karşılaştırılmalı.
5. Donanım hızlandırma açık ve kapalı iki Performance kaydı alınmalı; FPS, GPU process ve raster süreleri karşılaştırılmalı.
6. Kullanıcı ayarındaki depo arka plan animasyonu kapalıyken sonuç tekrar ölçülmeli.

## Artifactler

Git'e eklenmeyen yerel `qa-artifacts` klasöründe Lighthouse HTML/JSON raporları ve masaüstü/mobil ekran görüntüleri bulunur.
