/** Kota aşımı / müdür onayı için operatörlere gösterilen sabit metinler. */

export const KKD_QUOTA_FULL_TITLE = 'Barkod okutma kotası dolmuştur';

export const KKD_QUOTA_FULL_MESSAGE =
  'Talep edilen malzemede personelin KKD kotası dolmuştur. Gerçek ihtiyaç varsa depo müdürü fiziksel kontrol edip sistemden onay vermelidir; onaydan sonra çıkış tamamlanır.';

export const KKD_QUOTA_FREQUENCY_HINT =
  'Bu ürün için kullanım sıklığı dolmamış olabilir; sonraki hak tarihine bakın.';

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
