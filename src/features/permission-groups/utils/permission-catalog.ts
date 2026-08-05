import type { PermissionRow } from '../types/permission-groups.types';

const ACTION_LABELS: Record<string, string> = {
  VIEW: 'Görüntüleme',
  CREATE: 'Oluşturma',
  UPDATE: 'Güncelleme',
  DELETE: 'Silme',
  MANAGE: 'Yönetme',
  OPERATE: 'İşlem yürütme',
  APPROVE: 'Onaylama',
  ASSIGN: 'Atama',
  CANCEL: 'İptal',
  COMPLETE: 'Tamamlama',
  RELEASE: 'Serbest bırakma',
  RECEIVE: 'Kabul işlemi',
  POST: 'Kayıt oluşturma',
  REVERSE: 'Ters kayıt',
  RECONCILE: 'Uzlaştırma',
  TRIGGER: 'Tetikleme',
  SYNC: 'Eşitleme',
  GENERATE: 'Üretme',
  PUBLISH: 'Yayınlama',
  PRINT: 'Yazdırma',
  DECIDE: 'Karar verme',
  CONVERT: 'Dönüştürme',
  IMPORT: 'İçe aktarma',
  INSPECT: 'Kontrol',
  PUTAWAY: 'Raf yerleştirme',
  CHECK: 'Kontrol etme',
  CLOSE: 'Kapatma',
  REOPEN: 'Yeniden açma',
  OCR_IMPORT: 'OCR ile içe aktarma',
  CREATE_GOODS_RECEIPT: 'Mal kabul oluşturma',
  ERP_RETRY: 'ERP aktarımını yineleme',
  UNKNOWN_PLATE_RESOLVE: 'Bilinmeyen plakayı çözümleme',
};

const MODULE_LABELS: Array<[string, string]> = [
  ['SYSTEM.USERS', 'Kullanıcı Yönetimi'],
  ['SYSTEM.PERMISSIONS', 'Yetki ve İzin Yönetimi'],
  ['SYSTEM.PROJECT_SETTINGS', 'Genel Proje Ayarları'],
  ['SYSTEM.SMTP', 'E-posta / SMTP'],
  ['SYSTEM.HANGFIRE', 'Arka Plan İşleri'],
  ['SYSTEM.AUDIT', 'Denetim Kayıtları'],
  ['ERP.NETSIS_READ', 'Netsis Okuma Servisleri'],
  ['ERP.MIRROR', 'ERP Eşlenmiş Veriler'],
  ['WMS.GOODS_RECEIPT', 'Mal Kabul'],
  ['WMS.STEEL_RECEIPT', 'Sac Mal Kabul'],
  ['WMS.QUALITY', 'Kalite Yönetimi'],
  ['WMS.WAREHOUSE_TRANSFER', 'Depolar Arası Transfer'],
  ['WMS.SUBCONTRACTING_TRANSFER', 'Fason Transfer'],
  ['WMS.PRODUCTION_TRANSFER', 'Üretime Transfer'],
  ['WMS.WAREHOUSE_INBOUND', 'Ambar Giriş'],
  ['WMS.WAREHOUSE_OUTBOUND', 'Ambar Çıkış'],
  ['WMS.SHIPPING', 'Sevkiyat'],
  ['WMS.PRODUCTION', 'Üretim'],
  ['WMS.PROCUREMENT', 'Satınalma'],
  ['WMS.PACKING', 'Paketleme'],
  ['WMS.KKD', 'KKD Yönetimi'],
  ['WMS.INCOMING_INVOICE', 'Gelen Fatura ve e-Arşiv'],
  ['WMS.STOCK_MOVEMENTS', 'Stok Hareketleri'],
  ['WMS.STOCK_BALANCES', 'Stok Bakiyeleri'],
  ['WMS.LOCATIONS', 'Raf ve Konumlar'],
  ['WMS.DOCUMENT_SERIES', 'Belge Serileri'],
  ['WMS.BARCODE_DESIGNER', 'Barkod Tasarımı'],
  ['WMS.BARCODE_POLICY', 'Barkod Politikası'],
  ['WMS.SERIAL_RULES', 'Seri Kuralları'],
  ['WMS.VEHICLECHECKIN', 'Araç Kabul'],
];

const TOKEN_LABELS: Record<string, string> = {
  SETTINGS: 'Ayarları',
  DEFINITIONS: 'Tanımları',
  INSPECTIONS: 'Kontrolleri',
  RULES: 'Kuralları',
  POLICY: 'Politikası',
  VEHICLE: 'Araçları',
  CONNECTIONS: 'Bağlantıları',
  SUPPLIER_STOCK_MAPPING: 'Tedarikçi stok eşlemeleri',
  REQUEST: 'Talepleri',
  RFQ: 'Teklif talepleri',
  QUOTE: 'Teklifleri',
  ORDER: 'Siparişleri',
  EMPLOYEES: 'Personelleri',
  MATRICES: 'Hak matrisleri',
  OVERRIDES: 'Ek hakları',
  ENTITLEMENT: 'Hak sorgulaması',
  DISTRIBUTION: 'Dağıtımı',
  REPORTS: 'Raporları',
};

const normalize = (value: string) => value.trim().toLocaleLowerCase('tr-TR');

function getModule(code: string): { key: string; label: string } {
  const match = MODULE_LABELS.find(([prefix]) => code === prefix || code.startsWith(`${prefix}.`));
  if (match) return { key: match[0], label: match[1] };
  const parts = code.split('.');
  return { key: parts.slice(0, Math.min(2, parts.length)).join('.'), label: parts.slice(0, 2).join(' / ') };
}

function getAction(code: string): string {
  const matched = Object.keys(ACTION_LABELS)
    .sort((left, right) => right.length - left.length)
    .find(action => code.endsWith(`.${action}`));
  return matched ? ACTION_LABELS[matched] : 'İşlem';
}

function getScopeDetail(code: string, moduleKey: string): string | null {
  const remainder = code.slice(moduleKey.length + 1);
  if (!remainder) return null;
  const segments = remainder.split('.');
  segments.pop();
  if (!segments.length) return null;
  return segments.map(segment => TOKEN_LABELS[segment] ?? segment.replace(/_/g, ' ')).join(' / ');
}

export type PermissionCatalogItem = PermissionRow & {
  moduleKey: string;
  moduleLabel: string;
  actionLabel: string;
  scopeDetail: string | null;
  searchText: string;
};

export type PermissionCatalogGroup = {
  key: string;
  label: string;
  items: PermissionCatalogItem[];
};

export function buildPermissionCatalog(permissions: PermissionRow[], search: string): PermissionCatalogGroup[] {
  const term = normalize(search);
  const groups = new Map<string, PermissionCatalogGroup>();

  for (const permission of permissions) {
    const module = getModule(permission.code);
    const item: PermissionCatalogItem = {
      ...permission,
      moduleKey: module.key,
      moduleLabel: module.label,
      actionLabel: getAction(permission.code),
      scopeDetail: getScopeDetail(permission.code, module.key),
      searchText: normalize(`${permission.code} ${permission.name} ${permission.description ?? ''} ${module.label} ${getAction(permission.code)}`),
    };
    if (term && !item.searchText.includes(term)) continue;
    const group = groups.get(module.key) ?? { key: module.key, label: module.label, items: [] };
    group.items.push(item);
    groups.set(module.key, group);
  }

  return [...groups.values()]
    .map(group => ({ ...group, items: group.items.sort((a, b) => a.name.localeCompare(b.name, 'tr')) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}
