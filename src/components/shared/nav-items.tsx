import type { ReactElement } from 'react';
import type { TFunction } from 'i18next';
import type { MyPermissionsDto } from '@/features/access-control/types/access-control.types';
import { hasPermission } from '@/features/access-control/utils/hasPermission';
import { localizeLegacyUiText } from '@/lib/legacy-ui-localization';
import {
  dashboardIcon,
  erpIcon,
  goodsReceiptIcon,
  kkdIcon,
  procurementIcon,
  productionIcon,
  reportsIcon,
  shippingIcon,
  systemIcon,
  warehouseOperationsIcon,
} from './sidebar/sidebar-icons';

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
  { title: 'sidebar.dashboard', titleFallback: 'Gösterge Paneli', href: '/dashboard', icon: dashboardIcon },
  { title: 'sidebar.procurement', titleFallback: 'Satınalma', icon: procurementIcon, children: [
    { title: 'sidebar.procurementWorkspace', titleFallback: 'Süreç Merkezi', href: '/procurement', searchAliases: ['satınalma', 'süreç', 'procure to pay'], requiredPermission: 'WMS.PROCUREMENT.VIEW' },
    { title: 'sidebar.procurementRequests', titleFallback: 'Satınalma Talepleri', href: '/procurement/requests', searchAliases: ['ihtiyaç', 'talep'], requiredPermission: 'WMS.PROCUREMENT.VIEW' },
    { title: 'sidebar.procurementRfqs', titleFallback: 'Teklif Talepleri', href: '/procurement/rfqs', searchAliases: ['rfq', 'fiyat toplama'], requiredPermission: 'WMS.PROCUREMENT.VIEW' },
    { title: 'sidebar.procurementQuotes', titleFallback: 'Tedarikçi Teklifleri', href: '/procurement/quotes', searchAliases: ['teklif', 'tedarikçi'], requiredPermission: 'WMS.PROCUREMENT.VIEW' },
    { title: 'sidebar.procurementOrders', titleFallback: 'Satınalma Siparişleri', href: '/procurement/orders', searchAliases: ['satınalma siparişi', 'sipariş'], requiredPermission: 'WMS.PROCUREMENT.VIEW' },
  ] },
  { title: 'sidebar.goodsReceipt', titleFallback: 'Mal Kabul', icon: goodsReceiptIcon, children: [
    { title: 'sidebar.goodsReceiptOps', titleFallback: 'Operasyon', children: [
      { title: 'sidebar.goodsReceiptHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/goods-receipts', searchAliases: ['mal kabul', 'süreç', 'başlangıç'], requiredPermission: 'WMS.GOODS_RECEIPT.VIEW' },
      { title: 'sidebar.goodsReceiptCreate', titleFallback: 'Siparişten Emir', href: '/warehouse/goods-receipts/new', searchAliases: ['mal kabul', 'sipariş', 'emir', 'rezervasyon', 'netsis'], requiredPermission: 'WMS.GOODS_RECEIPT.CREATE' },
      { title: 'sidebar.goodsReceiptOrderless', titleFallback: 'Siparişsiz Emir', href: '/warehouse/goods-receipts/orderless', searchAliases: ['mal kabul', 'siparişsiz', 'emir', 'irsaliye'], requiredPermission: 'WMS.GOODS_RECEIPT.CREATE' },
      { title: 'sidebar.goodsReceiptDirect', titleFallback: 'Yurt İçi Mal Kabul', href: '/warehouse/goods-receipts/direct', searchAliases: ['mal kabul', 'emirsiz', 'direkt', 'barkod', 'yurt içi', 'doğrudan'], requiredPermission: 'WMS.GOODS_RECEIPT.RECEIVE' },
      { title: 'sidebar.goodsReceiptImport', titleFallback: 'İthalat Mal Kabul', href: '/warehouse/goods-receipts/import', searchAliases: ['mal kabul', 'ithalat', 'import', 'yurt dışı'], requiredPermission: 'WMS.GOODS_RECEIPT.RECEIVE' },
      { title: 'sidebar.goodsReceiptTasks', titleFallback: 'Emir Yönetimi', href: '/warehouse/goods-receipts/tasks', searchAliases: ['mal kabul', 'emir', 'atama', 'kullanıcı'], requiredPermission: 'WMS.GOODS_RECEIPT.VIEW' },
      { title: 'sidebar.goodsReceiptAssigned', titleFallback: 'Bana Atanan Emirler', href: '/warehouse/goods-receipts/assigned', searchAliases: ['mal kabul', 'atanan', 'görev', 'toplama'], requiredPermission: 'WMS.GOODS_RECEIPT.RECEIVE' },
      { title: 'sidebar.goodsReceiptLabels', titleFallback: 'Ön Etiketler', href: '/warehouse/goods-receipts/labels', searchAliases: ['mal kabul', 'ön etiket', 'barkod', 'yazdır'], requiredPermission: 'WMS.GOODS_RECEIPT.VIEW' },
      { title: 'sidebar.goodsReceiptList', titleFallback: 'Mal Kabul Kayıtları', href: '/warehouse/goods-receipts/list', searchAliases: ['mal kabul', 'liste', 'irsaliye', 'görev'], requiredPermission: 'WMS.GOODS_RECEIPT.VIEW' },
    ] },
    { title: 'sidebar.incomingInvoiceArchive', titleFallback: 'Gelen e-Belgeler', children: [
      { title: 'sidebar.supplierStockMappings', titleFallback: 'Tedarikçi Stok Eşleme', href: '/warehouse/goods-receipts/supplier-stock-mappings', searchAliases: ['tedarikçi', 'stok', 'eşleme', 'e-fatura', 'ocr', 'ürün kodu'], requiredPermission: 'WMS.GOODS_RECEIPT.SUPPLIER_STOCK_MAPPING.VIEW' },
      { title: 'sidebar.incomingInvoiceArchiveLookup', titleFallback: 'e-Fatura / e-Arşiv Sorgula', href: '/warehouse/incoming-invoices', searchAliases: ['e-fatura', 'e-arşiv', 'fatura', 'ubl', 'pdf', 'uuid'], requiredPermission: 'WMS.INCOMING_INVOICE.VIEW' },
      { title: 'sidebar.incomingInvoiceArchiveConnections', titleFallback: 'eLogo Bağlantıları', href: '/warehouse/incoming-invoices/connections', searchAliases: ['elogo', 'fatura', 'bağlantı', 'entegratör'], requiredPermission: 'WMS.INCOMING_INVOICE.CONNECTIONS.MANAGE' },
    ] },
    { title: 'sidebar.steelReceiptGroup', titleFallback: 'SAC İşlemleri', children: [
      { title: 'sidebar.steelReceipt', titleFallback: 'SAC Süreç Merkezi', href: '/warehouse/goods-receipts/steel', searchAliases: ['sac', 'levha', 'çelik', 'mal kabul'], requiredPermission: 'WMS.STEEL_RECEIPT.VIEW' },
      { title: 'sidebar.steelReceiptImport', titleFallback: 'Excel Beklenti Aktarımı', href: '/warehouse/goods-receipts/steel/import', searchAliases: ['sac', 'excel', 'aktarım'], requiredPermission: 'WMS.STEEL_RECEIPT.IMPORT' },
      { title: 'sidebar.steelVehicleCheckInList', titleFallback: 'Araç Girişi / Saha Kabul', href: '/warehouse/goods-receipts/steel/vehicle-check-ins', searchAliases: ['sac', 'araç', 'plaka', 'saha', 'kabul', 'liste'], requiredPermission: 'WMS.STEEL_RECEIPT.VEHICLE.VIEW' },
      { title: 'sidebar.steelReceiptPlans', titleFallback: 'Beklenen Levha Listesi', href: '/warehouse/goods-receipts/steel/plans', searchAliases: ['sac', 'beklenen', 'levha', 'liste'], requiredPermission: 'WMS.STEEL_RECEIPT.VIEW' },
      { title: 'sidebar.steelReceiptReceipt', titleFallback: 'Alış İrsaliyesi / Mal Kabul', href: '/warehouse/goods-receipts/steel/receipt', searchAliases: ['sac', 'alış', 'irsaliye', 'doğrudan', 'mal kabul'], requiredPermission: 'WMS.STEEL_RECEIPT.CONVERT' },
      { title: 'sidebar.steelReceiptPlacement', titleFallback: 'Saha / Raf Yerleştirme', href: '/warehouse/goods-receipts/steel/placement', searchAliases: ['sac', 'yerleştirme', 'raf'], requiredPermission: 'WMS.STEEL_RECEIPT.PUTAWAY' },
    ] },
  ] },
  { title: 'sidebar.warehouseOperations', titleFallback: 'Depo(Ambar) İşlemleri', icon: warehouseOperationsIcon, children: [
    { title: 'sidebar.warehouseInbound', titleFallback: 'Ambar Giriş', children: [
      { title: 'sidebar.warehouseInboundHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/warehouse-inbounds', requiredPermission: 'WMS.WAREHOUSE_INBOUND.VIEW' },
      { title: 'sidebar.warehouseInboundCreate', titleFallback: 'Giriş Emri Oluştur', href: '/warehouse/warehouse-inbounds/new', requiredPermission: 'WMS.WAREHOUSE_INBOUND.CREATE' },
      { title: 'sidebar.warehouseInboundDirect', titleFallback: 'Doğrudan Giriş', href: '/warehouse/warehouse-inbounds/direct', requiredPermission: 'WMS.WAREHOUSE_INBOUND.RECEIVE' },
      { title: 'sidebar.warehouseInboundTasks', titleFallback: 'Emir ve Atamalar', href: '/warehouse/warehouse-inbounds/tasks', requiredPermission: 'WMS.WAREHOUSE_INBOUND.VIEW' },
      { title: 'sidebar.warehouseInboundList', titleFallback: 'Giriş Kayıtları', href: '/warehouse/warehouse-inbounds/list', requiredPermission: 'WMS.WAREHOUSE_INBOUND.VIEW' },
    ] },
    { title: 'sidebar.warehouseOutbound', titleFallback: 'Ambar Çıkış', children: [
      { title: 'sidebar.warehouseOutboundHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/warehouse-outbounds', requiredPermission: 'WMS.WAREHOUSE_OUTBOUND.VIEW' },
      { title: 'sidebar.warehouseOutboundCreate', titleFallback: 'Çıkış Emri Oluştur', href: '/warehouse/warehouse-outbounds/new', requiredPermission: 'WMS.WAREHOUSE_OUTBOUND.CREATE' },
      { title: 'sidebar.warehouseOutboundList', titleFallback: 'Çıkış Kayıtları', href: '/warehouse/warehouse-outbounds/list', requiredPermission: 'WMS.WAREHOUSE_OUTBOUND.VIEW' },
    ] },
    { title: 'sidebar.warehouseTransfer', titleFallback: 'Depolar Arası Transfer', children: [
      { title: 'sidebar.normalTransferGroup', titleFallback: 'Normal Transfer', children: [
        { title: 'sidebar.warehouseTransferHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/transfers', searchAliases: ['depo', 'transfer', 'süreç', 'transit'], requiredPermission: 'WMS.WAREHOUSE_TRANSFER.VIEW' },
        { title: 'sidebar.warehouseTransferCreate', titleFallback: 'Transfer Taslağı', href: '/warehouse/transfers/new', searchAliases: ['depo', 'transfer', 'emir', 'taslak'], requiredPermission: 'WMS.WAREHOUSE_TRANSFER.CREATE' },
        { title: 'sidebar.warehouseTransferList', titleFallback: 'Transfer Kayıtları', href: '/warehouse/transfers/list', searchAliases: ['depo', 'transfer', 'liste', 'kayıt'], requiredPermission: 'WMS.WAREHOUSE_TRANSFER.VIEW' },
      ] },
      { title: 'sidebar.subcontractingIssueGroup', titleFallback: 'Fasona Çıkış', children: [
        { title: 'sidebar.subcontractingIssueCreate', titleFallback: 'Fasona Çıkış Oluştur', href: '/warehouse/subcontracting-transfers/issue/new', searchAliases: ['fason', 'fasona çıkış', 'tedarikçi', 'emir'], requiredPermission: 'WMS.SUBCONTRACTING_TRANSFER.CREATE' },
        { title: 'sidebar.subcontractingIssueList', titleFallback: 'Fasona Çıkış Kayıtları', href: '/warehouse/subcontracting-transfers/issue/list', searchAliases: ['fason', 'çıkış', 'liste'], requiredPermission: 'WMS.SUBCONTRACTING_TRANSFER.VIEW' },
      ] },
      { title: 'sidebar.subcontractingReceiptGroup', titleFallback: 'Fasondan Giriş', children: [
        { title: 'sidebar.subcontractingReceiptCreate', titleFallback: 'Fasondan Giriş Oluştur', href: '/warehouse/subcontracting-transfers/receipt/new', searchAliases: ['fason', 'fasondan giriş', 'dönüş', 'kalite'], requiredPermission: 'WMS.SUBCONTRACTING_TRANSFER.CREATE' },
        { title: 'sidebar.subcontractingReceiptList', titleFallback: 'Fasondan Giriş Kayıtları', href: '/warehouse/subcontracting-transfers/receipt/list', searchAliases: ['fason', 'giriş', 'dönüş', 'liste'], requiredPermission: 'WMS.SUBCONTRACTING_TRANSFER.VIEW' },
      ] },
      { title: 'sidebar.productionTransferGroup', titleFallback: 'Üretime Transfer', children: [
        { title: 'sidebar.productionTransferHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/production-transfers', searchAliases: ['üretim', 'hammadde', 'besleme', 'yarı mamul', 'mamul'], requiredPermission: 'WMS.PRODUCTION_TRANSFER.VIEW' },
        { title: 'sidebar.productionTransferCreate', titleFallback: 'Üretim Transferi Oluştur', href: '/warehouse/production-transfers/new', searchAliases: ['üretim', 'transfer', 'emir', 'görev'], requiredPermission: 'WMS.PRODUCTION_TRANSFER.CREATE' },
        { title: 'sidebar.productionTransferList', titleFallback: 'Üretim Transfer Kayıtları', href: '/warehouse/production-transfers/list', searchAliases: ['üretim', 'transfer', 'liste'], requiredPermission: 'WMS.PRODUCTION_TRANSFER.VIEW' },
        { title: 'sidebar.productionTransferTaskPool', titleFallback: 'Görev Havuzu', href: '/warehouse/production-transfers/task-pool', searchAliases: ['üretim', 'görev', 'atama', 'iş yükü'], requiredPermission: 'WMS.PRODUCTION_TRANSFER.ASSIGN' },
      ] },
    ] },
    { title: 'sidebar.warehouseManagement', titleFallback: 'Depo Yönetimi', children: [
      { title: 'sidebar.warehouseAssistant', titleFallback: 'Depo Asistanı', href: '/warehouse/assistant', searchAliases: ['asistan', 'chatbot', 'yapay zeka', 'stok sor', 'seri sor', 'işlemlerim'] },
      { title: 'sidebar.locationDefinitions', titleFallback: 'Raf Tanımları', href: '/warehouse/locations', searchAliases: ['lokasyon', 'raf', 'adres', 'göz'], requiredPermission: 'WMS.LOCATIONS.VIEW' },
      { title: 'sidebar.stockMovements', titleFallback: 'Stok Hareketleri', href: '/warehouse/stock-movements', searchAliases: ['stok', 'hareket', 'mal kabul', 'transfer', 'sevk', 'iade'], requiredPermission: 'WMS.STOCK_MOVEMENTS.VIEW' },
      { title: 'sidebar.locationBalances', titleFallback: 'Raf Bakiyeleri', href: '/warehouse/location-balances', searchAliases: ['raf', 'bakiye', 'lot', 'seri', 'yap'], requiredPermission: 'WMS.STOCK_BALANCES.VIEW' },
      { title: 'sidebar.warehouseBalances', titleFallback: 'Depo Stok Bakiyesi', href: '/warehouse/stock-balances', searchAliases: ['depo', 'stok', 'bakiye', 'drill down'], requiredPermission: 'WMS.STOCK_BALANCES.VIEW' },
      { title: 'sidebar.serialBalances', titleFallback: 'Stok Seri Bakiyesi', href: '/warehouse/serial-balances', searchAliases: ['stok', 'seri', 'bakiye', 'izlenebilirlik', 'lot'], requiredPermission: 'WMS.STOCK_BALANCES.VIEW' },
      { title: 'sidebar.inventoryCounts', titleFallback: 'Sayım Yönetimi', href: '/warehouse/inventory-counts', searchAliases: ['sayım', 'envanter', 'fiziksel sayım', 'döngüsel sayım', 'kör sayım', 'fark'], requiredPermission: 'WMS.INVENTORY_COUNT.VIEW' },
      { title: 'sidebar.packing', titleFallback: 'Paketleme', children: [
        { title: 'sidebar.packingWorkbench', titleFallback: 'Paketleme İstasyonu', href: '/warehouse/packing', searchAliases: ['paket', 'koli', 'palet', 'sscc', 'tartı'], requiredPermission: 'WMS.PACKING.VIEW' },
        { title: 'sidebar.packingDefinitions', titleFallback: 'Paketleme Tanımları', href: '/warehouse/packing/definitions', searchAliases: ['ambalaj', 'koli', 'palet', 'istasyon'], requiredPermission: 'WMS.PACKING.DEFINITIONS.VIEW' },
      ] },
    ] },
  ] },
  { title: 'sidebar.production', titleFallback: 'Üretim ve Kalite', icon: productionIcon, children: [
    { title: 'sidebar.generalProductionGroup', titleFallback: 'Genel Üretim', children: [
      { title: 'sidebar.productionHub', titleFallback: 'Üretim Süreç Merkezi', href: '/warehouse/production', searchAliases: ['üretim', 'plan', 'iş emri', 'mamul', 'sarf'], requiredPermission: 'WMS.PRODUCTION.VIEW' },
      { title: 'sidebar.productionWorkOrders', titleFallback: 'Üretime Transfer İş Emirleri', href: '/warehouse/production/work-orders', searchAliases: ['üretim', 'netsis', 'iş emri', 'üretime transfer', 'reçete', 'bom'], requiredPermission: 'WMS.PRODUCTION.VIEW' },
      { title: 'sidebar.productionCreate', titleFallback: 'Üretim Planı Oluştur', href: '/warehouse/production/new', searchAliases: ['üretim', 'plan', 'iş emri', 'bom', 'rota'], requiredPermission: 'WMS.PRODUCTION.CREATE' },
      { title: 'sidebar.productionList', titleFallback: 'Üretim Planları', href: '/warehouse/production/list', searchAliases: ['üretim', 'plan', 'emir', 'liste', 'serbest bırak'], requiredPermission: 'WMS.PRODUCTION.VIEW' },
    ] },
    { title: 'sidebar.generatorProductionGroup', titleFallback: 'Jeneratör Üretim', children: [
      { title: 'sidebar.generatorProductionHub', titleFallback: 'Jeneratör Üretim Merkezi', href: '/warehouse/production/generator', searchAliases: ['jeneratör', 'generator', 'stator', 'rotor', 'sa', 'ra', 'fa'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.VIEW' },
      { title: 'sidebar.generatorProductionPlanningGroup', titleFallback: 'Planlama', children: [
        { title: 'sidebar.generatorProductionProjects', titleFallback: 'Jeneratör Projeleri', href: '/warehouse/production/generator/projects', searchAliases: ['jeneratör', 'proje', 'teslim'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.VIEW' },
        { title: 'sidebar.generatorProductionProjectCreate', titleFallback: 'Yeni Jeneratör Projesi', href: '/warehouse/production/generator/projects/new', searchAliases: ['jeneratör', 'yeni proje'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.CREATE' },
        { title: 'sidebar.generatorProductionPlanning', titleFallback: 'Planlama Havuzu', href: '/warehouse/production/generator/planning', searchAliases: ['jeneratör', 'planlama', 'önizleme'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.PLAN' },
        { title: 'sidebar.generatorProductionGantt', titleFallback: 'Üretim Planı ve Gantt', href: '/warehouse/production/generator/gantt', searchAliases: ['jeneratör', 'gantt', 'kapasite'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.VIEW' },
        { title: 'sidebar.generatorProductionScenarios', titleFallback: 'Senaryo Simülasyonu', href: '/warehouse/production/generator/scenarios', searchAliases: ['jeneratör', 'senaryo', 'simülasyon'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.PLAN' },
        { title: 'sidebar.generatorProductionAssistant', titleFallback: 'Planlama Asistanı', href: '/warehouse/production/generator/assistant', searchAliases: ['jeneratör', 'asistan', 'öneri'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.PLAN' },
        { title: 'sidebar.generatorProductionRevisions', titleFallback: 'Plan Revizyonları', href: '/warehouse/production/generator/revisions', searchAliases: ['jeneratör', 'revizyon', 'plan geçmişi'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.VIEW' },
      ] },
      { title: 'sidebar.generatorProductionExecutionGroup', titleFallback: 'Üretim Yürütme', children: [
        { title: 'sidebar.generatorProductionStationBoard', titleFallback: 'Canlı İstasyon Panosu', href: '/warehouse/production/generator/station-board', searchAliases: ['jeneratör', 'istasyon', 'canlı hat'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.VIEW' },
        { title: 'sidebar.generatorProductionFactoryMap', titleFallback: 'Üretim Haritası', href: '/warehouse/production/generator/factory-map', searchAliases: ['jeneratör', 'harita', 'fabrika'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.VIEW' },
        { title: 'sidebar.generatorProductionAndon', titleFallback: 'İstasyon Operasyonları', href: '/warehouse/production/generator/andon', searchAliases: ['jeneratör', 'andon', 'operasyon', 'başlat', 'tamamla'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.OPERATE' },
        { title: 'sidebar.generatorProductionMaterials', titleFallback: 'Malzeme Kontrol', href: '/warehouse/production/generator/materials', searchAliases: ['jeneratör', 'malzeme', 'eksik'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.VIEW' },
        { title: 'sidebar.generatorProductionOutbound', titleFallback: 'Paketleme ve Sevkiyata Devir', href: '/warehouse/production/generator/outbound', searchAliases: ['jeneratör', 'paketleme', 'sevkiyat'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.VIEW' },
      ] },
      { title: 'sidebar.generatorProductionReports', titleFallback: 'Üretim Analiz Merkezi', href: '/warehouse/production/generator/reports', searchAliases: ['jeneratör', 'rapor', 'analiz', 'gecikme'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.VIEW' },
      { title: 'sidebar.generatorProductionDefinitions', titleFallback: 'Tanımlar', children: [
        { title: 'sidebar.generatorProductionDefinitionsHub', titleFallback: 'Tanım Merkezi', href: '/warehouse/production/generator/definitions', searchAliases: ['jeneratör', 'tanım'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.SETTINGS.VIEW' },
        { title: 'sidebar.generatorProductionStations', titleFallback: 'İstasyonlar ve Kapasite', href: '/warehouse/production/generator/definitions/stations', searchAliases: ['sa', 'ra', 'fa', 'istasyon', 'kapasite'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.SETTINGS.VIEW' },
        { title: 'sidebar.generatorProductionRoutes', titleFallback: 'Operasyon Rotaları', href: '/warehouse/production/generator/definitions/routes', searchAliases: ['rota', 'operasyon sırası'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.SETTINGS.VIEW' },
        { title: 'sidebar.generatorProductionProducts', titleFallback: 'Ürün, Yetkinlik ve Malzeme', href: '/warehouse/production/generator/definitions/products', searchAliases: ['jeneratör ürünü', 'istasyon yeteneği', 'bom', 'reçete', 'malzeme'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.SETTINGS.VIEW' },
        { title: 'sidebar.generatorProductionCalendar', titleFallback: 'Vardiya ve Takvim', href: '/warehouse/production/generator/definitions/calendar', searchAliases: ['vardiya', 'takvim', 'tatil'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.SETTINGS.VIEW' },
        { title: 'sidebar.generatorProductionResources', titleFallback: 'Üretim Kaynakları', href: '/warehouse/production/generator/definitions/resources', searchAliases: ['kaynak', 'vinç', 'fırın', 'personel'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.SETTINGS.VIEW' },
        { title: 'sidebar.generatorProductionRules', titleFallback: 'Planlama Kuralları', href: '/warehouse/production/generator/definitions/rules', searchAliases: ['kural', 'çakışma', 'öncelik'], requiredPermission: 'WMS.GENERATOR_PRODUCTION.SETTINGS.VIEW' },
      ] },
    ] },
    { title: 'sidebar.qualityControl', titleFallback: 'Kalite', children: [
      { title: 'sidebar.qualityControlInspections', titleFallback: 'Kalite İnceleme Listesi', href: '/warehouse/quality/inspections', searchAliases: ['kalite', 'kontrol', 'karantina', 'onay'], requiredPermission: 'WMS.QUALITY.INSPECTIONS.VIEW' },
      { title: 'sidebar.qualityReports', titleFallback: 'GKK Raporları', href: '/warehouse/quality/reports', searchAliases: ['kalite', 'gkk', 'rapor', 'süre', 'mola', 'kontrol miktarı'], requiredPermission: 'WMS.QUALITY.INSPECTIONS.VIEW' },
      { title: 'sidebar.qualityQuarantine', titleFallback: 'Karantina Kararları', href: '/warehouse/quality/quarantine', searchAliases: ['kalite', 'karantina', 'serbest bırak', 'ret', 'iade'], requiredPermission: 'WMS.QUALITY.INSPECTIONS.VIEW' },
      { title: 'sidebar.qualityControlRules', titleFallback: 'Kalite Kural Tanımları', href: '/warehouse/quality/rules', searchAliases: ['kalite', 'örnekleme', 'stok kuralı', 'kural tanımları'], requiredPermission: 'WMS.QUALITY.RULES.VIEW' },
      { title: 'sidebar.qualityDecisionCodes', titleFallback: 'Kalite Karar Kodları', href: '/warehouse/quality/decision-codes', searchAliases: ['kalite', 'karar', 'ret', 'karantina', 'neden kodu'], requiredPermission: 'WMS.QUALITY.DECISION_CODES.VIEW' },
    ] },
  ] },
  { title: 'sidebar.shipping', titleFallback: 'Sevkiyat İşlemleri', icon: shippingIcon, children: [
    { title: 'sidebar.shippingHub', titleFallback: 'Süreç Merkezi', href: '/warehouse/shipments', searchAliases: ['sevk', 'outbound', 'toplama', 'paketleme'], requiredPermission: 'WMS.SHIPPING.VIEW' },
    { title: 'sidebar.shippingCreate', titleFallback: 'Sevk Oluştur', href: '/warehouse/shipments/new', searchAliases: ['sevk', 'sipariş', 'emir', 'doğrudan'], requiredPermission: 'WMS.SHIPPING.CREATE' },
    { title: 'sidebar.shippingList', titleFallback: 'Sevk Kayıtları', href: '/warehouse/shipments/list', searchAliases: ['sevk', 'liste', 'yükleme', 'irsaliye'], requiredPermission: 'WMS.SHIPPING.VIEW' },
  ] },
  { title: 'sidebar.kkd', titleFallback: 'KKD', icon: kkdIcon, children: [
    { title: 'sidebar.kkdOverview', titleFallback: 'KKD Süreç Merkezi', href: '/warehouse/kkd', searchAliases: ['kkd', 'iş güvenliği', 'koruyucu donanım'], requiredPermission: 'WMS.KKD.DEFINITIONS.VIEW' },
    { title: 'sidebar.kkdDefinitions', titleFallback: 'Tanımlar', href: '/warehouse/kkd/definitions', searchAliases: ['kkd', 'departman', 'rol', 'personel', 'hak', 'matris'], requiredPermission: 'WMS.KKD.DEFINITIONS.VIEW' },
    { title: 'sidebar.kkdEntitlement', titleFallback: 'Hak Sorgulama', href: '/warehouse/kkd/entitlement', searchAliases: ['kkd', 'hak', 'kontrol'], requiredPermission: 'WMS.KKD.ENTITLEMENT.CHECK' },
    { title: 'sidebar.kkdRequests', titleFallback: 'Açık KKD Talepleri', href: '/warehouse/kkd/requests', searchAliases: ['kkd', 'açık talep', 'hazırlama', 'beden', 'stok seçimi'], requiredPermission: 'WMS.KKD.REQUESTS.VIEW' },
    { title: 'sidebar.kkdDistributionNew', titleFallback: 'KKD Malzeme Talep Siparişleri', href: '/warehouse/kkd/distributions/new', searchAliases: ['kkd', 'teslim', 'personel', 'sipariş', 'malzeme', 'talep', 'windbox'], requiredPermission: 'WMS.KKD.DISTRIBUTION.OPERATE' },
    { title: 'sidebar.kkdDistributions', titleFallback: 'Dağıtım ve Ambar Çıkış', href: '/warehouse/kkd/distributions', searchAliases: ['kkd', 'dağıtım', 'ambar çıkış', 'teslim'], requiredPermission: 'WMS.KKD.DISTRIBUTION.OPERATE' },
  ] },
  { title: 'sidebar.erp', titleFallback: 'Entegrasyonlar', icon: erpIcon, children: [
    { title: 'sidebar.erpWarehouses', titleFallback: 'Depolar', href: '/erp/warehouses', requiredPermission: 'ERP.MIRROR.VIEW' },
    { title: 'sidebar.erpStocks', titleFallback: 'Stoklar', href: '/erp/stocks', requiredPermission: 'ERP.MIRROR.VIEW' },
    { title: 'sidebar.erpCustomers', titleFallback: 'Cariler', href: '/erp/customers', requiredPermission: 'ERP.MIRROR.VIEW' },
    { title: 'sidebar.erpConfigurationCodes', titleFallback: 'Yapılandırma Kodları', href: '/erp/configuration-codes', searchAliases: ['yapılandırma', 'konfigürasyon', 'varyant', 'yapkod'], requiredPermission: 'ERP.MIRROR.VIEW' },
  ] },
  { title: 'sidebar.reports', titleFallback: 'Raporlar', icon: reportsIcon, children: [
    { title: 'sidebar.kkdReports', titleFallback: 'KKD Raporları', href: '/warehouse/kkd/reports', searchAliases: ['kkd', 'rapor', 'kullanım', 'doğrulama'], requiredPermission: 'WMS.KKD.REPORTS.VIEW' },
    { title: 'sidebar.steelReceiptReports', titleFallback: 'SAC Operasyon Raporları', href: '/warehouse/goods-receipts/steel/reports', searchAliases: ['sac', 'rapor', 'izlenebilirlik', 'istisna', 'bekleyen'], requiredPermission: 'WMS.STEEL_RECEIPT.VIEW' },
  ] },
  { title: 'sidebar.systemGroup', titleFallback: 'Parametreler ve Sistem Ayarları', icon: systemIcon, children: [
    { title: 'sidebar.projectSettings', titleFallback: 'Genel Proje Ayarları', href: '/system/project-settings', searchAliases: ['genel', 'proje', 'sayı', 'tarih', 'saat', 'format'], requiredPermission: 'SYSTEM.PROJECT_SETTINGS.VIEW' },
    { title: 'sidebar.userManagement', titleFallback: 'Kullanıcı Yönetimi', href: '/system/users', requiredPermission: 'SYSTEM.USERS.VIEW' },
    { title: 'sidebar.permissionDefinitions', titleFallback: 'İzin Tanımları', href: '/system/permissions', requiredPermission: 'SYSTEM.PERMISSIONS.VIEW' },
    { title: 'sidebar.permissionGroups', titleFallback: 'İzin Grupları', href: '/system/permission-groups', requiredPermission: 'SYSTEM.PERMISSIONS.VIEW' },
    { title: 'sidebar.auditLogs', titleFallback: 'Audit Kayıtları', href: '/system/audit-logs', requiredPermission: 'SYSTEM.AUDIT.VIEW' },
    { title: 'sidebar.mailSettings', titleFallback: 'SMTP Ayarları', href: '/system/smtp', requiredPermission: 'SYSTEM.SMTP.MANAGE' },
    { title: 'sidebar.hangfireMonitoring', titleFallback: 'Hangfire İzleme', href: '/system/hangfire', requiredPermission: 'SYSTEM.HANGFIRE.VIEW' },
    { title: 'sidebar.processParameters', titleFallback: 'Süreç Parametreleri', href: '/warehouse/process-parameters', searchAliases: ['süreç', 'parametre', 'politika', 'ayar'], children: [
      { title: 'sidebar.goodsReceiptSettings', titleFallback: 'Mal Kabul Süreç Ayarları', href: '/warehouse/process-parameters/goods-receipt', searchAliases: ['fazla kabul', 'onay', 'erp', 'kalite', 'politika'], requiredPermission: 'WMS.GOODS_RECEIPT.SETTINGS.VIEW' },
      { title: 'sidebar.warehouseInboundSettings', titleFallback: 'Ambar Giriş Ayarları', href: '/warehouse/process-parameters/inbound', requiredPermission: 'WMS.WAREHOUSE_INBOUND.SETTINGS.VIEW' },
      { title: 'sidebar.warehouseOutboundSettings', titleFallback: 'Ambar Çıkış Ayarları', href: '/warehouse/process-parameters/outbound', requiredPermission: 'WMS.WAREHOUSE_OUTBOUND.SETTINGS.VIEW' },
      { title: 'sidebar.warehouseTransferSettings', titleFallback: 'Transfer Süreç Ayarları', href: '/warehouse/process-parameters/transfer', searchAliases: ['depo', 'transfer', 'ayar', 'politika', 'rezervasyon'], requiredPermission: 'WMS.WAREHOUSE_TRANSFER.SETTINGS.VIEW' },
      { title: 'sidebar.subcontractingTransferSettings', titleFallback: 'Fason Ayarları', href: '/warehouse/process-parameters/subcontracting', searchAliases: ['fason', 'ayar', 'kalite', 'termin'], requiredPermission: 'WMS.SUBCONTRACTING_TRANSFER.SETTINGS.VIEW' },
      { title: 'sidebar.productionTransferSettings', titleFallback: 'Üretim Transfer Ayarları', href: '/warehouse/process-parameters/production-transfer', searchAliases: ['üretim', 'malzeme', 'uygunluk', 'tolerans'], requiredPermission: 'WMS.PRODUCTION_TRANSFER.SETTINGS.VIEW' },
      { title: 'sidebar.shippingSettings', titleFallback: 'Sevkiyat Süreç Ayarları', href: '/warehouse/process-parameters/shipping', searchAliases: ['sevk', 'ayar', 'rezervasyon', 'paketleme'], requiredPermission: 'WMS.SHIPPING.SETTINGS.VIEW' },
      { title: 'sidebar.qualityControlSettings', titleFallback: 'Kalite Genel Ayarlar', href: '/warehouse/process-parameters/quality', searchAliases: ['kalite', 'karantina', 'bekletme', 'ayar'], requiredPermission: 'WMS.QUALITY.SETTINGS.VIEW' },
      { title: 'sidebar.packingSettings', titleFallback: 'Paketleme Ayarları', href: '/warehouse/process-parameters/packing', searchAliases: ['paket', 'politika', 'sscc', 'tolerans'], requiredPermission: 'WMS.PACKING.SETTINGS.VIEW' },
      { title: 'sidebar.documentSeries', titleFallback: 'Belge Seri Tanımları', href: '/warehouse/process-parameters/document-series', searchAliases: ['belge', 'seri', 'numara', 'mal kabul', 'transfer', 'sevk', 'ambar'], requiredPermission: 'WMS.DOCUMENT_SERIES.VIEW' },
      { title: 'sidebar.barcodeDesigner', titleFallback: 'Barkod Tasarım ve Baskı', href: '/warehouse/process-parameters/barcode-designer', searchAliases: ['barkod', 'etiket', 'tasarım', 'pdf', 'yazıcı', 'gs1', 'sscc'], requiredPermission: 'WMS.BARCODE_DESIGNER.VIEW' },
      { title: 'sidebar.barcodePolicy', titleFallback: 'Genel Barkod Politikası', href: '/warehouse/process-parameters/barcode-policy', searchAliases: ['barkod', 'politika', 'stok', 'seri', 'lot', 'raf', 'palet', 'belge', 'benzersiz'], requiredPermission: 'WMS.BARCODE_POLICY.VIEW' },
      { title: 'sidebar.kkdPolicy', titleFallback: 'KKD Süreç Politikası', href: '/warehouse/process-parameters/kkd-policy', searchAliases: ['kkd', 'politika', 'sipariş zorunlu', 'parametre'], requiredPermission: 'WMS.KKD.POLICY.VIEW' },
    ] },
  ] },
];

/** Route'a en uygun (en uzun href eşleşmeli) nav zincirini döndürür. */
export function findNavTrail(items: NavItem[], pathname: string): NavItem[] | null {
  let bestTrail: NavItem[] | null = null;
  let bestLength = 0;

  const walk = (nodes: NavItem[], trail: NavItem[]): void => {
    for (const item of nodes) {
      const nextTrail = [...trail, item];
      if (item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))) {
        if (!bestTrail || item.href.length > bestLength) {
          bestTrail = nextTrail;
          bestLength = item.href.length;
        }
      }
      if (item.children?.length) {
        walk(item.children, nextTrail);
      }
    }
  };

  walk(items, []);
  return bestTrail;
}

export function resolveNavTrailLabels(
  t: TFunction,
  language: string,
  pathname: string,
): string[] | null {
  const trail = findNavTrail(WMS_NAV_ITEMS, pathname);
  if (!trail || trail.length === 0) return null;

  const labels = trail.map((item) => resolveNavItemTitle(t, language, item));
  if (labels.length > 3) {
    return [labels[1], labels[labels.length - 2], labels[labels.length - 1]];
  }
  return labels;
}

export function filterAuthorizedNavItems(items: NavItem[], permissions: MyPermissionsDto): NavItem[] {
  return items.flatMap((item) => {
    if (item.requiredPermission && !hasPermission(permissions, item.requiredPermission)) return [];

    const children = item.children ? filterAuthorizedNavItems(item.children, permissions) : undefined;
    if (item.children && children?.length === 0 && !item.href) return [];

    return [{ ...item, children }];
  });
}
