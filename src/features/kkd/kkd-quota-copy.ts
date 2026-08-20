/** Kota aşımı / müdür onayı için operatörlere gösterilen sabit metinler. */

export const KKD_QUOTA_FULL_TITLE = 'Barkod okutma kotası dolmuştur';

export const KKD_QUOTA_FULL_MESSAGE =
  'Talep edilen malzemede personelin KKD kotası dolmuştur. Gerçek ihtiyaç varsa depo müdürü fiziksel kontrol edip sistemden onay vermelidir; onaydan sonra çıkış tamamlanır.';

export const KKD_QUOTA_FREQUENCY_HINT =
  'Bu ürün için kullanım sıklığı dolmamış olabilir; sonraki hak tarihine bakın.';

export const KKD_QUOTA_REJECT_HINT =
  'Reddederseniz yalnızca kota aşan kalem(ler) belgeden düşer; hak edilen diğer kalemler aynı ambar çıkışıyla teslim edilmeye devam eder. Personel, düşen kalem için ayrıca yeni bir talep açmalıdır.';

export function formatExcessApprovalStatus(status: string): string {
  switch (status) {
    case 'Pending':
      return 'Kota dolu — müdür onayı bekliyor';
    case 'Approved':
      return 'Müdür onayladı';
    case 'Rejected':
      return 'Müdür reddetti';
    case 'NotRequired':
    case 'None':
      return 'Onay gerekmedi';
    default:
      return status || '—';
  }
}

export function isExcessApprovalPending(status: string | null | undefined): boolean {
  return status === 'Pending';
}

export function formatErpStatus(status: string | null | undefined): string {
  switch (status) {
    case 'Pending':
      return 'Gönderilmedi';
    case 'Processing':
      return 'Gönderiliyor';
    case 'Succeeded':
      return 'Gönderildi';
    case 'Failed':
      return 'Gönderilemedi';
    case 'CommitUncertain':
      return 'Sonuç belirsiz';
    case 'NotRequired':
      return 'Gerekmiyor';
    default:
      return status || '—';
  }
}

/**
 * ERP aktarımı başlamış veya tamamlanmışsa teslim WMS üzerinden geri alınamaz; iptal ancak ambar
 * çıkışı ekranından ERP iptaliyle yürür. Sunucu da aynı kuralı uygular.
 */
export function isErpLocked(status: string | null | undefined): boolean {
  return status === 'Processing' || status === 'Succeeded' || status === 'CommitUncertain';
}

export function formatDistributionStatus(status: string): string {
  switch (status) {
    case 'Draft':
      return 'Taslak';
    case 'Validated':
      return 'Doğrulandı';
    case 'OutboundCreated':
      return 'Çıkışa hazır';
    case 'Completed':
      return 'Tamamlandı';
    case 'Cancelled':
      return 'İptal edildi';
    case 'Failed':
      return 'Başarısız';
    default:
      return status || '—';
  }
}
