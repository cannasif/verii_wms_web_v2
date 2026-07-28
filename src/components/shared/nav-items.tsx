import type { ReactElement } from 'react';
import type { TFunction } from 'i18next';
import type { MyPermissionsDto } from '@/features/access-control/types/access-control.types';
import { hasPermission } from '@/features/access-control/utils/hasPermission';
import { localizeLegacyUiText } from '@/lib/legacy-ui-localization';
import { dashboardIcon, inventoryIcon, masterDataIcon, operationsIcon, systemIcon } from './sidebar/sidebar-icons';

export interface NavItem {
  title: string;
  titleFallback?: string;
  searchAliases?: string[];
  href?: string;
  icon?: ReactElement;
  children?: NavItem[];
  requiredPermission?: string;
}

export function resolveNavItemTitle(
  t: TFunction,
  language: string,
  item: NavItem,
): string {
  const translated = t(item.title, { defaultValue: '' }).trim();
  if (translated && translated !== item.title) return translated;
  return localizeLegacyUiText(item.titleFallback ?? item.title, language);
}

export const WMS_NAV_ITEMS: NavItem[] = [
  { title: 'sidebar.dashboard', titleFallback: 'Dashboard', href: '/dashboard', icon: dashboardIcon },
  { title: 'sidebar.warehouseOperations', titleFallback: 'Ambar İşlemleri', icon: operationsIcon, children: [
    { title: 'sidebar.warehouseInbound', titleFallback: 'Ambar Giriş', children: [
      { title: 'sidebar.warehouseInboundHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/warehouse-inbounds', requiredPermission: 'WMS.WAREHOUSE_INBOUND.VIEW' },
      { title: 'sidebar.warehouseInboundCreate', titleFallback: 'Giriş Emri Oluştur', href: '/warehouse/warehouse-inbounds/new', requiredPermission: 'WMS.WAREHOUSE_INBOUND.CREATE' },
      { title: 'sidebar.warehouseInboundDirect', titleFallback: 'Doğrudan Giriş', href: '/warehouse/warehouse-inbounds/direct', requiredPermission: 'WMS.WAREHOUSE_INBOUND.RECEIVE' },
      { title: 'sidebar.warehouseInboundTasks', titleFallback: 'Emir ve Atamalar', href: '/warehouse/warehouse-inbounds/tasks', requiredPermission: 'WMS.WAREHOUSE_INBOUND.VIEW' },
      { title: 'sidebar.warehouseInboundList', titleFallback: 'Giriş Kayıtları', href: '/warehouse/warehouse-inbounds/list', requiredPermission: 'WMS.WAREHOUSE_INBOUND.VIEW' },
      { title: 'sidebar.warehouseInboundSettings', titleFallback: 'Giriş Ayarları', href: '/warehouse/warehouse-inbounds/settings', requiredPermission: 'WMS.WAREHOUSE_INBOUND.SETTINGS.VIEW' },
    ] },
    { title: 'sidebar.warehouseOutbound', titleFallback: 'Ambar Çıkış', children: [
      { title: 'sidebar.warehouseOutboundHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/warehouse-outbounds', requiredPermission: 'WMS.WAREHOUSE_OUTBOUND.VIEW' },
      { title: 'sidebar.warehouseOutboundCreate', titleFallback: 'Çıkış Emri Oluştur', href: '/warehouse/warehouse-outbounds/new', requiredPermission: 'WMS.WAREHOUSE_OUTBOUND.CREATE' },
      { title: 'sidebar.warehouseOutboundList', titleFallback: 'Çıkış Kayıtları', href: '/warehouse/warehouse-outbounds/list', requiredPermission: 'WMS.WAREHOUSE_OUTBOUND.VIEW' },
      { title: 'sidebar.warehouseOutboundSettings', titleFallback: 'Çıkış Ayarları', href: '/warehouse/warehouse-outbounds/settings', requiredPermission: 'WMS.WAREHOUSE_OUTBOUND.SETTINGS.VIEW' },
    ] },
  ] },  { title: 'sidebar.warehouseTransfer', titleFallback: 'Depolar Arası Transfer', icon: operationsIcon, children: [
    { title: 'sidebar.normalTransferGroup', titleFallback: 'Normal Transfer', children: [
      { title: 'sidebar.warehouseTransferHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/transfers', searchAliases: ['depo', 'transfer', 'süreç', 'transit'], requiredPermission: 'WMS.WAREHOUSE_TRANSFER.VIEW' },
      { title: 'sidebar.warehouseTransferCreate', titleFallback: 'Transfer Taslağı', href: '/warehouse/transfers/new', searchAliases: ['depo', 'transfer', 'emir', 'taslak'], requiredPermission: 'WMS.WAREHOUSE_TRANSFER.CREATE' },
      { title: 'sidebar.warehouseTransferList', titleFallback: 'Transfer Kayıtları', href: '/warehouse/transfers/list', searchAliases: ['depo', 'transfer', 'liste', 'kayıt'], requiredPermission: 'WMS.WAREHOUSE_TRANSFER.VIEW' },
      { title: 'sidebar.warehouseTransferSettings', titleFallback: 'Süreç Ayarları', href: '/warehouse/transfers/settings', searchAliases: ['depo', 'transfer', 'ayar', 'politika', 'rezervasyon'], requiredPermission: 'WMS.WAREHOUSE_TRANSFER.SETTINGS.VIEW' },
    ] },
    { title: 'sidebar.subcontractingIssueGroup', titleFallback: 'Fasona Çıkış', children: [
      { title: 'sidebar.subcontractingIssueCreate', titleFallback: 'Fasona Çıkış Oluştur', href: '/warehouse/subcontracting-transfers/issue/new', searchAliases: ['fason', 'fasona çıkış', 'tedarikçi', 'emir'], requiredPermission: 'WMS.SUBCONTRACTING_TRANSFER.CREATE' },
      { title: 'sidebar.subcontractingIssueList', titleFallback: 'Fasona Çıkış Kayıtları', href: '/warehouse/subcontracting-transfers/issue/list', searchAliases: ['fason', 'çıkış', 'liste'], requiredPermission: 'WMS.SUBCONTRACTING_TRANSFER.VIEW' },
    ] },
    { title: 'sidebar.subcontractingReceiptGroup', titleFallback: 'Fasondan Giriş', children: [
      { title: 'sidebar.subcontractingReceiptCreate', titleFallback: 'Fasondan Giriş Oluştur', href: '/warehouse/subcontracting-transfers/receipt/new', searchAliases: ['fason', 'fasondan giriş', 'dönüş', 'kalite'], requiredPermission: 'WMS.SUBCONTRACTING_TRANSFER.CREATE' },
      { title: 'sidebar.subcontractingReceiptList', titleFallback: 'Fasondan Giriş Kayıtları', href: '/warehouse/subcontracting-transfers/receipt/list', searchAliases: ['fason', 'giriş', 'dönüş', 'liste'], requiredPermission: 'WMS.SUBCONTRACTING_TRANSFER.VIEW' },
      { title: 'sidebar.subcontractingTransferSettings', titleFallback: 'Fason Ayarları', href: '/warehouse/subcontracting-transfers/settings', searchAliases: ['fason', 'ayar', 'kalite', 'termin'], requiredPermission: 'WMS.SUBCONTRACTING_TRANSFER.SETTINGS.VIEW' },
    ] },
    { title: 'sidebar.productionTransferGroup', titleFallback: 'Üretime Transfer', children: [
      { title: 'sidebar.productionTransferHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/production-transfers', searchAliases: ['üretim', 'hammadde', 'besleme', 'yarı mamul', 'mamul'], requiredPermission: 'WMS.PRODUCTION_TRANSFER.VIEW' },
      { title: 'sidebar.productionTransferCreate', titleFallback: 'Üretim Transferi Oluştur', href: '/warehouse/production-transfers/new', searchAliases: ['üretim', 'transfer', 'emir', 'görev'], requiredPermission: 'WMS.PRODUCTION_TRANSFER.CREATE' },
      { title: 'sidebar.productionTransferList', titleFallback: 'Üretim Transfer Kayıtları', href: '/warehouse/production-transfers/list', searchAliases: ['üretim', 'transfer', 'liste'], requiredPermission: 'WMS.PRODUCTION_TRANSFER.VIEW' },
      { title: 'sidebar.productionTransferSettings', titleFallback: 'Üretim Transfer Ayarları', href: '/warehouse/production-transfers/settings', searchAliases: ['üretim', 'malzeme', 'uygunluk', 'tolerans'], requiredPermission: 'WMS.PRODUCTION_TRANSFER.SETTINGS.VIEW' },
    ] },
  ] },
  { title: 'sidebar.production', titleFallback: 'Üretim', icon: operationsIcon, children: [
    { title: 'sidebar.productionHub', titleFallback: 'Üretim Süreç Merkezi', href: '/warehouse/production', searchAliases: ['üretim', 'plan', 'iş emri', 'mamul', 'sarf'], requiredPermission: 'WMS.PRODUCTION.VIEW' },
    { title: 'sidebar.productionCreate', titleFallback: 'Üretim Planı Oluştur', href: '/warehouse/production/new', searchAliases: ['üretim', 'plan', 'iş emri', 'bom', 'rota'], requiredPermission: 'WMS.PRODUCTION.CREATE' },
    { title: 'sidebar.productionList', titleFallback: 'Üretim Planları', href: '/warehouse/production/list', searchAliases: ['üretim', 'plan', 'emir', 'liste', 'serbest bırak'], requiredPermission: 'WMS.PRODUCTION.VIEW' },
  ] },
  { title: 'sidebar.shipping', titleFallback: 'Sevk', icon: operationsIcon, children: [
    { title: 'sidebar.shippingHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/shipments', searchAliases: ['sevk', 'outbound', 'toplama', 'paketleme'], requiredPermission: 'WMS.SHIPPING.VIEW' },
    { title: 'sidebar.shippingCreate', titleFallback: 'Sevk Oluştur', href: '/warehouse/shipments/new', searchAliases: ['sevk', 'sipariş', 'emir', 'doğrudan'], requiredPermission: 'WMS.SHIPPING.CREATE' },
    { title: 'sidebar.shippingList', titleFallback: 'Sevk Kayıtları', href: '/warehouse/shipments/list', searchAliases: ['sevk', 'liste', 'yükleme', 'irsaliye'], requiredPermission: 'WMS.SHIPPING.VIEW' },
    { title: 'sidebar.shippingSettings', titleFallback: 'Süreç Ayarları', href: '/warehouse/shipments/settings', searchAliases: ['sevk', 'ayar', 'rezervasyon', 'paketleme'], requiredPermission: 'WMS.SHIPPING.SETTINGS.VIEW' },
  ] },
  { title: 'sidebar.erp', titleFallback: 'ERP', icon: masterDataIcon, children: [
    { title: 'sidebar.erpWarehouses', titleFallback: 'Depolar', href: '/erp/warehouses', requiredPermission: 'ERP.MIRROR.VIEW' },
    { title: 'sidebar.erpStocks', titleFallback: 'Stoklar', href: '/erp/stocks', requiredPermission: 'ERP.MIRROR.VIEW' },
    { title: 'sidebar.erpCustomers', titleFallback: 'Cariler', href: '/erp/customers', requiredPermission: 'ERP.MIRROR.VIEW' },
    { title: 'sidebar.erpConfigurationCodes', titleFallback: 'Yapılandırma Kodları', href: '/erp/configuration-codes', searchAliases: ['yapılandırma', 'konfigürasyon', 'varyant', 'yapkod'], requiredPermission: 'ERP.MIRROR.VIEW' },
  ] },
  { title: 'sidebar.goodsReceipt', titleFallback: 'Mal Kabul', icon: operationsIcon, children: [
    { title: 'sidebar.goodsReceiptOps', titleFallback: 'Operasyon', children: [
      { title: 'sidebar.goodsReceiptHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/goods-receipts', searchAliases: ['mal kabul', 'süreç', 'başlangıç'], requiredPermission: 'WMS.GOODS_RECEIPT.VIEW' },
      { title: 'sidebar.goodsReceiptCreate', titleFallback: 'Siparişten Emir', href: '/warehouse/goods-receipts/new', searchAliases: ['mal kabul', 'sipariş', 'emir', 'rezervasyon', 'netsis'], requiredPermission: 'WMS.GOODS_RECEIPT.CREATE' },
      { title: 'sidebar.goodsReceiptOrderless', titleFallback: 'Siparişsiz Emir', href: '/warehouse/goods-receipts/orderless', searchAliases: ['mal kabul', 'siparişsiz', 'emir', 'irsaliye'], requiredPermission: 'WMS.GOODS_RECEIPT.CREATE' },
      { title: 'sidebar.goodsReceiptDirect', titleFallback: 'Doğrudan Mal Kabul', href: '/warehouse/goods-receipts/direct', searchAliases: ['mal kabul', 'emirsiz', 'direkt', 'barkod'], requiredPermission: 'WMS.GOODS_RECEIPT.RECEIVE' },
      { title: 'sidebar.goodsReceiptTasks', titleFallback: 'Emir Yönetimi', href: '/warehouse/goods-receipts/tasks', searchAliases: ['mal kabul', 'emir', 'atama', 'kullanıcı'], requiredPermission: 'WMS.GOODS_RECEIPT.VIEW' },
      { title: 'sidebar.goodsReceiptAssigned', titleFallback: 'Bana Atanan Emirler', href: '/warehouse/goods-receipts/assigned', searchAliases: ['mal kabul', 'atanan', 'görev', 'toplama'], requiredPermission: 'WMS.GOODS_RECEIPT.RECEIVE' },
      { title: 'sidebar.goodsReceiptLabels', titleFallback: 'Ön Etiketler', href: '/warehouse/goods-receipts/labels', searchAliases: ['mal kabul', 'ön etiket', 'barkod', 'yazdır'], requiredPermission: 'WMS.GOODS_RECEIPT.VIEW' },
      { title: 'sidebar.goodsReceiptList', titleFallback: 'Mal Kabul Kayıtları', href: '/warehouse/goods-receipts/list', searchAliases: ['mal kabul', 'liste', 'irsaliye', 'görev'], requiredPermission: 'WMS.GOODS_RECEIPT.VIEW' },
      { title: 'sidebar.goodsReceiptSettings', titleFallback: 'Süreç Ayarları', href: '/warehouse/goods-receipt-settings', searchAliases: ['fazla kabul', 'onay', 'erp', 'kalite', 'politika'], requiredPermission: 'WMS.GOODS_RECEIPT.SETTINGS.VIEW' },
    ] },
    { title: 'sidebar.incomingInvoiceArchive', titleFallback: 'Gelen e-Belgeler', children: [
      { title: 'sidebar.incomingInvoiceArchiveLookup', titleFallback: 'e-Fatura / e-Arşiv Sorgula', href: '/warehouse/incoming-invoices', searchAliases: ['e-fatura', 'e-arşiv', 'fatura', 'ubl', 'pdf', 'uuid'], requiredPermission: 'WMS.INCOMING_INVOICE.VIEW' },
      { title: 'sidebar.incomingInvoiceArchiveConnections', titleFallback: 'eLogo Bağlantıları', href: '/warehouse/incoming-invoices/connections', searchAliases: ['elogo', 'fatura', 'bağlantı', 'entegratör'], requiredPermission: 'WMS.INCOMING_INVOICE.CONNECTIONS.MANAGE' },
    ] },
    { title: 'sidebar.steelReceiptGroup', titleFallback: 'SAC İşlemleri', children: [
      { title: 'sidebar.steelReceipt', titleFallback: 'SAC Süreç Merkezi', href: '/warehouse/goods-receipts/steel', searchAliases: ['sac', 'levha', 'çelik', 'mal kabul'], requiredPermission: 'WMS.STEEL_RECEIPT.VIEW' },
      { title: 'sidebar.steelVehicleCheckIn', titleFallback: 'Araç Giriş / Saha Kabul', href: '/warehouse/goods-receipts/steel/vehicle-check-in', searchAliases: ['sac', 'araç', 'plaka', 'saha', 'kabul'], requiredPermission: 'WMS.STEEL_RECEIPT.VEHICLE.VIEW' },
      { title: 'sidebar.steelVehicleCheckInList', titleFallback: 'Araç Giriş Kayıtları', href: '/warehouse/goods-receipts/steel/vehicle-check-ins', searchAliases: ['sac', 'araç', 'plaka', 'liste'], requiredPermission: 'WMS.STEEL_RECEIPT.VEHICLE.VIEW' },
      { title: 'sidebar.steelReceiptImport', titleFallback: 'Excel Beklenti Aktarımı', href: '/warehouse/goods-receipts/steel/import', searchAliases: ['sac', 'excel', 'aktarım'], requiredPermission: 'WMS.STEEL_RECEIPT.IMPORT' },
      { title: 'sidebar.steelReceiptPlans', titleFallback: 'Beklenen Levha Listesi', href: '/warehouse/goods-receipts/steel/plans', searchAliases: ['sac', 'beklenen', 'levha', 'liste'], requiredPermission: 'WMS.STEEL_RECEIPT.VIEW' },
      { title: 'sidebar.steelReceiptInspection', titleFallback: 'Saha Kalite Onayı', href: '/warehouse/goods-receipts/steel/inspection', searchAliases: ['sac', 'kontrol', 'levha', 'kalite', 'onay'], requiredPermission: 'WMS.STEEL_RECEIPT.INSPECT' },
      { title: 'sidebar.steelReceiptReceipt', titleFallback: 'Alış İrsaliyesi Oluşturma', href: '/warehouse/goods-receipts/steel/receipt', searchAliases: ['sac', 'alış', 'irsaliye', 'emir'], requiredPermission: 'WMS.STEEL_RECEIPT.CONVERT' },
      { title: 'sidebar.steelReceiptPlacement', titleFallback: 'Saha / Raf Yerleştirme', href: '/warehouse/goods-receipts/steel/placement', searchAliases: ['sac', 'yerleştirme', 'raf'], requiredPermission: 'WMS.STEEL_RECEIPT.PUTAWAY' },
      { title: 'sidebar.steelReceiptReports', titleFallback: 'SAC Operasyon Raporları', href: '/warehouse/goods-receipts/steel/reports', searchAliases: ['sac', 'rapor', 'izlenebilirlik', 'istisna', 'bekleyen'], requiredPermission: 'WMS.STEEL_RECEIPT.VIEW' },
    ] },
  ] },
  { title: 'sidebar.warehouseManagement', titleFallback: 'Depo Yönetimi', icon: inventoryIcon, children: [
    { title: 'sidebar.locationDefinitions', titleFallback: 'Raf Tanımları', href: '/warehouse/locations', searchAliases: ['lokasyon', 'raf', 'adres', 'göz'], requiredPermission: 'WMS.LOCATIONS.VIEW' },
    { title: 'sidebar.documentSeries', titleFallback: 'Belge Seri Tanımları', href: '/warehouse/document-series', searchAliases: ['belge', 'seri', 'numara', 'mal kabul', 'transfer', 'sevk', 'ambar'], requiredPermission: 'WMS.DOCUMENT_SERIES.VIEW' },
    { title: 'sidebar.barcodeDesigner', titleFallback: 'Barkod Tasarım ve Baskı', href: '/warehouse/barcode-designer', searchAliases: ['barkod', 'etiket', 'tasarım', 'pdf', 'yazıcı', 'gs1', 'sscc'], requiredPermission: 'WMS.BARCODE_DESIGNER.VIEW' },
    { title: 'sidebar.barcodePolicy', titleFallback: 'Genel Barkod Politikası', href: '/warehouse/barcode-policy', searchAliases: ['barkod', 'politika', 'stok', 'seri', 'lot', 'raf', 'palet', 'belge', 'benzersiz'], requiredPermission: 'WMS.BARCODE_POLICY.VIEW' },
    { title: 'sidebar.stockMovements', titleFallback: 'Stok Hareketleri', href: '/warehouse/stock-movements', searchAliases: ['stok', 'hareket', 'mal kabul', 'transfer', 'sevk', 'iade'], requiredPermission: 'WMS.STOCK_MOVEMENTS.VIEW' },
    { title: 'sidebar.locationBalances', titleFallback: 'Raf Bakiyeleri', href: '/warehouse/location-balances', searchAliases: ['raf', 'bakiye', 'lot', 'seri', 'yap'], requiredPermission: 'WMS.STOCK_BALANCES.VIEW' },
    { title: 'sidebar.warehouseBalances', titleFallback: 'Depo Stok Bakiyesi', href: '/warehouse/stock-balances', searchAliases: ['depo', 'stok', 'bakiye', 'drill down'], requiredPermission: 'WMS.STOCK_BALANCES.VIEW' },
    { title: 'sidebar.serialBalances', titleFallback: 'Stok Seri Bakiyesi', href: '/warehouse/serial-balances', searchAliases: ['stok', 'seri', 'bakiye', 'izlenebilirlik', 'lot'], requiredPermission: 'WMS.STOCK_BALANCES.VIEW' },
    { title: 'sidebar.qualityControl', titleFallback: 'Kalite', children: [
      { title: 'sidebar.qualityControlInspections', titleFallback: 'Kalite İnceleme Listesi', href: '/warehouse/quality/inspections', searchAliases: ['kalite', 'kontrol', 'karantina', 'onay'], requiredPermission: 'WMS.QUALITY.INSPECTIONS.VIEW' },
      { title: 'sidebar.qualityQuarantine', titleFallback: 'Karantina Kararları', href: '/warehouse/quality/quarantine', searchAliases: ['kalite', 'karantina', 'serbest bırak', 'ret', 'iade'], requiredPermission: 'WMS.QUALITY.INSPECTIONS.VIEW' },
      { title: 'sidebar.qualityControlRules', titleFallback: 'Stok Kuralları', href: '/warehouse/quality/rules', searchAliases: ['kalite', 'örnekleme', 'stok kuralı'], requiredPermission: 'WMS.QUALITY.RULES.VIEW' },
      { title: 'sidebar.qualityControlSettings', titleFallback: 'Genel Ayarlar', href: '/warehouse/quality/settings', searchAliases: ['kalite', 'karantina', 'bekletme', 'ayar'], requiredPermission: 'WMS.QUALITY.SETTINGS.VIEW' },
    ] },
    { title: 'sidebar.packing', titleFallback: 'Paketleme', children: [
      { title: 'sidebar.packingWorkbench', titleFallback: 'Paketleme İstasyonu', href: '/warehouse/packing', searchAliases: ['paket', 'koli', 'palet', 'sscc', 'tartı'], requiredPermission: 'WMS.PACKING.VIEW' },
      { title: 'sidebar.packingDefinitions', titleFallback: 'Paketleme Tanımları', href: '/warehouse/packing/definitions', searchAliases: ['ambalaj', 'koli', 'palet', 'istasyon'], requiredPermission: 'WMS.PACKING.DEFINITIONS.VIEW' },
      { title: 'sidebar.packingSettings', titleFallback: 'Paketleme Ayarları', href: '/warehouse/packing/settings', searchAliases: ['paket', 'politika', 'sscc', 'tolerans'], requiredPermission: 'WMS.PACKING.SETTINGS.VIEW' },
    ] },
  ] },
  { title: 'sidebar.systemGroup', titleFallback: 'Sistem ve Yetki', icon: systemIcon, children: [
    { title: 'sidebar.projectSettings', titleFallback: 'Genel Proje Ayarları', href: '/system/project-settings', searchAliases: ['genel', 'proje', 'sayı', 'tarih', 'saat', 'format'], requiredPermission: 'SYSTEM.PROJECT_SETTINGS.VIEW' },
    { title: 'sidebar.userManagement', titleFallback: 'Kullanıcı Yönetimi', href: '/system/users', requiredPermission: 'SYSTEM.USERS.VIEW' },
    { title: 'sidebar.permissionDefinitions', titleFallback: 'İzin Tanımları', href: '/system/permissions', requiredPermission: 'SYSTEM.PERMISSIONS.VIEW' },
    { title: 'sidebar.permissionGroups', titleFallback: 'İzin Grupları', href: '/system/permission-groups', requiredPermission: 'SYSTEM.PERMISSIONS.VIEW' },
    { title: 'sidebar.auditLogs', titleFallback: 'Audit Kayıtları', href: '/system/audit-logs', requiredPermission: 'SYSTEM.AUDIT.VIEW' },
    { title: 'sidebar.mailSettings', titleFallback: 'SMTP Ayarları', href: '/system/smtp', requiredPermission: 'SYSTEM.SMTP.MANAGE' },
    { title: 'sidebar.hangfireMonitoring', titleFallback: 'Hangfire İzleme', href: '/system/hangfire', requiredPermission: 'SYSTEM.HANGFIRE.VIEW' },
  ] },
];

export function filterAuthorizedNavItems(items: NavItem[], permissions: MyPermissionsDto): NavItem[] {
  return items.flatMap((item) => {
    if (item.requiredPermission && !hasPermission(permissions, item.requiredPermission)) return [];

    const children = item.children ? filterAuthorizedNavItems(item.children, permissions) : undefined;
    if (item.children && children?.length === 0 && !item.href) return [];

    return [{ ...item, children }];
  });
}
