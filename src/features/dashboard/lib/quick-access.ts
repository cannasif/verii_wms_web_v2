import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  ClipboardCheck,
  Factory,
  Package,
  PackagePlus,
  PackageSearch,
  PackageMinus,
  ScanLine,
  Send,
  ShieldCheck,
  UserRoundCheck,
  Waypoints,
} from 'lucide-react';

export const QUICK_ACCESS_SLOT_COUNT = 6;

export const QUICK_ACCESS_IDS = [
  'goods-receipt-new',
  'transfer-new',
  'shipment-new',
  'inventory-count',
  'stock-query',
  'quality-control',
  'goods-receipt-assigned',
  'warehouse-inbound-new',
  'warehouse-outbound-new',
  'packing',
  'stock-movements',
  'production-transfer-new',
] as const;

export type QuickAccessId = (typeof QUICK_ACCESS_IDS)[number];

export type QuickAccessTone = 'violet' | 'blue' | 'green' | 'cyan' | 'amber' | 'rose' | 'indigo' | 'teal';

export type QuickAccessAction = {
  id: QuickAccessId;
  permission: string;
  permissionAliases?: readonly string[];
  titleKey: string;
  descriptionKey: string;
  href: string;
  icon: LucideIcon;
  tone: QuickAccessTone;
};

export const QUICK_ACCESS_CATALOG: readonly QuickAccessAction[] = [
  {
    id: 'goods-receipt-new',
    permission: 'wms.goods-receipt.create',
    titleKey: 'dashboard.quickAccessItems.goodsReceiptNew',
    descriptionKey: 'dashboard.quickAccessItems.goodsReceiptNewHint',
    href: '/warehouse/goods-receipts/new',
    icon: ClipboardCheck,
    tone: 'violet',
  },
  {
    id: 'transfer-new',
    permission: 'wms.transfer.create',
    titleKey: 'dashboard.quickAccessItems.transferNew',
    descriptionKey: 'dashboard.quickAccessItems.transferNewHint',
    href: '/warehouse/transfers/new-operation',
    icon: ArrowLeftRight,
    tone: 'blue',
  },
  {
    id: 'shipment-new',
    permission: 'wms.shipment.create',
    titleKey: 'dashboard.quickAccessItems.shipmentNew',
    descriptionKey: 'dashboard.quickAccessItems.shipmentNewHint',
    href: '/warehouse/shipments/new',
    icon: Send,
    tone: 'green',
  },
  {
    id: 'inventory-count',
    permission: 'wms.inventory-count.view',
    titleKey: 'dashboard.quickAccessItems.inventoryCount',
    descriptionKey: 'dashboard.quickAccessItems.inventoryCountHint',
    href: '/warehouse/inventory-counts',
    icon: ScanLine,
    tone: 'cyan',
  },
  {
    id: 'stock-query',
    permission: 'wms.warehouse-balance.view',
    titleKey: 'dashboard.quickAccessItems.stockQuery',
    descriptionKey: 'dashboard.quickAccessItems.stockQueryHint',
    href: '/warehouse/stock-balances',
    icon: PackageSearch,
    tone: 'amber',
  },
  {
    id: 'quality-control',
    permission: 'wms.quality.inspections.view',
    titleKey: 'dashboard.quickAccessItems.qualityControl',
    descriptionKey: 'dashboard.quickAccessItems.qualityControlHint',
    href: '/warehouse/quality/inspections',
    icon: ShieldCheck,
    tone: 'rose',
  },
  {
    id: 'goods-receipt-assigned',
    permission: 'wms.goods-receipt.view',
    permissionAliases: ['WMS.GOODS_RECEIPT.VIEW', 'WMS.GOODS_RECEIPT.RECEIVE', 'wms.goods-receipt.receive'],
    titleKey: 'dashboard.quickAccessItems.goodsReceiptAssigned',
    descriptionKey: 'dashboard.quickAccessItems.goodsReceiptAssignedHint',
    href: '/warehouse/goods-receipts/assigned',
    icon: UserRoundCheck,
    tone: 'indigo',
  },
  {
    id: 'warehouse-inbound-new',
    permission: 'wms.warehouse.inbound.create',
    permissionAliases: ['WMS.WAREHOUSE_INBOUND.CREATE'],
    titleKey: 'dashboard.quickAccessItems.warehouseInbound',
    descriptionKey: 'dashboard.quickAccessItems.warehouseInboundHint',
    href: '/warehouse/warehouse-inbounds/new',
    icon: PackagePlus,
    tone: 'teal',
  },
  {
    id: 'warehouse-outbound-new',
    permission: 'wms.warehouse.outbound.create',
    permissionAliases: ['WMS.WAREHOUSE_OUTBOUND.CREATE'],
    titleKey: 'dashboard.quickAccessItems.warehouseOutbound',
    descriptionKey: 'dashboard.quickAccessItems.warehouseOutboundHint',
    href: '/warehouse/warehouse-outbounds/new',
    icon: PackageMinus,
    tone: 'blue',
  },
  {
    id: 'packing',
    permission: 'WMS.PACKING.VIEW',
    permissionAliases: ['wms.package.view'],
    titleKey: 'dashboard.quickAccessItems.packing',
    descriptionKey: 'dashboard.quickAccessItems.packingHint',
    href: '/warehouse/packing',
    icon: Package,
    tone: 'amber',
  },
  {
    id: 'stock-movements',
    permission: 'WMS.STOCK_MOVEMENTS.VIEW',
    permissionAliases: ['wms.stock-movements.view'],
    titleKey: 'dashboard.quickAccessItems.stockMovements',
    descriptionKey: 'dashboard.quickAccessItems.stockMovementsHint',
    href: '/warehouse/stock-movements',
    icon: Waypoints,
    tone: 'cyan',
  },
  {
    id: 'production-transfer-new',
    permission: 'WMS.PRODUCTION_TRANSFER.CREATE',
    permissionAliases: ['wms.production-transfer.create'],
    titleKey: 'dashboard.quickAccessItems.productionTransfer',
    descriptionKey: 'dashboard.quickAccessItems.productionTransferHint',
    href: '/warehouse/production-transfers/new',
    icon: Factory,
    tone: 'violet',
  },
] as const;

export const DEFAULT_QUICK_ACCESS_IDS: readonly QuickAccessId[] = QUICK_ACCESS_IDS.slice(
  0,
  QUICK_ACCESS_SLOT_COUNT,
);

const idSet = new Set<string>(QUICK_ACCESS_IDS);
const STORAGE_KEY = 'wms.dashboard.quickAccess.v1';

export function isQuickAccessId(value: unknown): value is QuickAccessId {
  return typeof value === 'string' && idSet.has(value);
}

export function coerceQuickAccessIds(value: unknown): QuickAccessId[] {
  if (!Array.isArray(value)) return [...DEFAULT_QUICK_ACCESS_IDS];

  const ids: QuickAccessId[] = [];
  for (const item of value) {
    if (!isQuickAccessId(item) || ids.includes(item)) continue;
    ids.push(item);
    if (ids.length === QUICK_ACCESS_SLOT_COUNT) break;
  }

  return ids.length > 0 ? ids : [...DEFAULT_QUICK_ACCESS_IDS];
}

function storageKeyForUser(userKey?: string | null): string {
  const trimmed = userKey?.trim();
  return trimmed ? `${STORAGE_KEY}:${trimmed}` : STORAGE_KEY;
}

export function readQuickAccessIds(userKey?: string | null): QuickAccessId[] {
  if (typeof window === 'undefined') return [...DEFAULT_QUICK_ACCESS_IDS];
  try {
    const raw = window.localStorage.getItem(storageKeyForUser(userKey));
    if (!raw) return [...DEFAULT_QUICK_ACCESS_IDS];
    return coerceQuickAccessIds(JSON.parse(raw) as unknown);
  } catch {
    return [...DEFAULT_QUICK_ACCESS_IDS];
  }
}

export function writeQuickAccessIds(ids: QuickAccessId[], userKey?: string | null): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    storageKeyForUser(userKey),
    JSON.stringify(coerceQuickAccessIds(ids)),
  );
}

export function resolveAllowedQuickAccess(
  can: (permission: string) => boolean,
): QuickAccessAction[] {
  return QUICK_ACCESS_CATALOG.filter((action) => {
    if (can(action.permission)) return true;
    return (action.permissionAliases ?? []).some((alias) => can(alias));
  });
}

/** Preference order ∩ yetki; eksik slotları yetkili havuzdan doldur. */
export function resolveVisibleQuickAccess(
  preferredIds: readonly QuickAccessId[],
  can: (permission: string) => boolean,
): QuickAccessAction[] {
  const allowed = resolveAllowedQuickAccess(can);
  const byId = new Map(allowed.map((action) => [action.id, action]));
  const picked: QuickAccessAction[] = [];

  for (const id of preferredIds) {
    const action = byId.get(id);
    if (!action) continue;
    picked.push(action);
    byId.delete(id);
    if (picked.length === QUICK_ACCESS_SLOT_COUNT) return picked;
  }

  for (const action of allowed) {
    if (!byId.has(action.id)) continue;
    picked.push(action);
    byId.delete(action.id);
    if (picked.length === QUICK_ACCESS_SLOT_COUNT) break;
  }

  return picked;
}
