import type { LucideIcon } from 'lucide-react';
import {
  Barcode,
  Boxes,
  ClipboardCheck,
  FileDigit,
  Package,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Printer,
  Settings2,
  ShieldCheck,
  Shuffle,
  Truck,
} from 'lucide-react';

export type ProcessParameterSection = {
  key: string;
  legacyHref: string;
  permission: string;
  titleKey: string;
  titleFallback: string;
  icon: LucideIcon;
};

export const PROCESS_PARAMETER_SECTIONS: ProcessParameterSection[] = [
  {
    key: 'goods-receipt',
    legacyHref: '/warehouse/goods-receipt-settings',
    permission: 'WMS.GOODS_RECEIPT.SETTINGS.VIEW',
    titleKey: 'sidebar.goodsReceiptSettings',
    titleFallback: 'Mal Kabul Süreç Ayarları',
    icon: PackageCheck,
  },
  {
    key: 'inbound',
    legacyHref: '/warehouse/warehouse-inbounds/settings',
    permission: 'WMS.WAREHOUSE_INBOUND.SETTINGS.VIEW',
    titleKey: 'sidebar.warehouseInboundSettings',
    titleFallback: 'Ambar Giriş Ayarları',
    icon: PackagePlus,
  },
  {
    key: 'outbound',
    legacyHref: '/warehouse/warehouse-outbounds/settings',
    permission: 'WMS.WAREHOUSE_OUTBOUND.SETTINGS.VIEW',
    titleKey: 'sidebar.warehouseOutboundSettings',
    titleFallback: 'Ambar Çıkış Ayarları',
    icon: PackageMinus,
  },
  {
    key: 'transfer',
    legacyHref: '/warehouse/transfers/settings',
    permission: 'WMS.WAREHOUSE_TRANSFER.SETTINGS.VIEW',
    titleKey: 'sidebar.warehouseTransferSettings',
    titleFallback: 'Transfer Süreç Ayarları',
    icon: Shuffle,
  },
  {
    key: 'subcontracting',
    legacyHref: '/warehouse/subcontracting-transfers/settings',
    permission: 'WMS.SUBCONTRACTING_TRANSFER.SETTINGS.VIEW',
    titleKey: 'sidebar.subcontractingTransferSettings',
    titleFallback: 'Fason Ayarları',
    icon: Boxes,
  },
  {
    key: 'production-transfer',
    legacyHref: '/warehouse/production-transfers/settings',
    permission: 'WMS.PRODUCTION_TRANSFER.SETTINGS.VIEW',
    titleKey: 'sidebar.productionTransferSettings',
    titleFallback: 'Üretim Transfer Ayarları',
    icon: Settings2,
  },
  {
    key: 'shipping',
    legacyHref: '/warehouse/shipments/settings',
    permission: 'WMS.SHIPPING.SETTINGS.VIEW',
    titleKey: 'sidebar.shippingSettings',
    titleFallback: 'Sevkiyat Süreç Ayarları',
    icon: Truck,
  },
  {
    key: 'quality',
    legacyHref: '/warehouse/quality/settings',
    permission: 'WMS.QUALITY.SETTINGS.VIEW',
    titleKey: 'sidebar.qualityControlSettings',
    titleFallback: 'Kalite Parametreleri',
    icon: ClipboardCheck,
  },
  {
    key: 'packing',
    legacyHref: '/warehouse/packing/settings',
    permission: 'WMS.PACKING.SETTINGS.VIEW',
    titleKey: 'sidebar.packingSettings',
    titleFallback: 'Paketleme Ayarları',
    icon: Package,
  },
  {
    key: 'document-series',
    legacyHref: '/warehouse/document-series',
    permission: 'WMS.DOCUMENT_SERIES.VIEW',
    titleKey: 'sidebar.documentSeries',
    titleFallback: 'Belge Seri Tanımları',
    icon: FileDigit,
  },
  {
    key: 'barcode-designer',
    legacyHref: '/warehouse/barcode-designer',
    permission: 'WMS.BARCODE_DESIGNER.VIEW',
    titleKey: 'sidebar.barcodeDesigner',
    titleFallback: 'Barkod Tasarım ve Baskı',
    icon: Printer,
  },
  {
    key: 'barcode-policy',
    legacyHref: '/warehouse/barcode-policy',
    permission: 'WMS.BARCODE_POLICY.VIEW',
    titleKey: 'sidebar.barcodePolicy',
    titleFallback: 'Genel Barkod Politikası',
    icon: Barcode,
  },
  {
    key: 'kkd-policy',
    legacyHref: '/warehouse/kkd/policy',
    permission: 'WMS.KKD.POLICY.VIEW',
    titleKey: 'sidebar.kkdPolicy',
    titleFallback: 'KKD Süreç Politikası',
    icon: ShieldCheck,
  },
];

export function processParameterHubPath(sectionKey: string): string {
  return `/warehouse/process-parameters/${sectionKey}`;
}

export function findProcessParameterSection(sectionKey: string | undefined): ProcessParameterSection | undefined {
  if (!sectionKey) return undefined;
  return PROCESS_PARAMETER_SECTIONS.find((section) => section.key === sectionKey);
}
