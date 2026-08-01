import type { GoodsReceiptRouteType, GoodsReceiptRoutingResult } from '../types/goods-receipt.types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readNumber(record: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  }
  return 0;
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  }
  return '';
}

function readRouteType(raw: unknown): GoodsReceiptRouteType | null {
  if (raw === 'WarehouseTransfer' || raw === 'WarehouseOutbound') return raw;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized.includes('transfer')) return 'WarehouseTransfer';
    if (normalized.includes('outbound') || normalized.includes('shipment')) return 'WarehouseOutbound';
  }
  if (raw === 0 || raw === 1) {
    return raw === 0 ? 'WarehouseTransfer' : 'WarehouseOutbound';
  }
  return null;
}

function normalizeRoute(raw: unknown): GoodsReceiptRoutingResult | null {
  const record = asRecord(raw);
  if (!record) return null;
  const routeType = readRouteType(record.routeType ?? record.RouteType ?? record.type ?? record.Type);
  const targetDocumentNo = readString(
    record,
    'targetDocumentNo',
    'TargetDocumentNo',
    'documentNo',
    'DocumentNo',
  );
  if (!routeType || !targetDocumentNo) return null;
  return {
    routingBatchId: readNumber(record, 'routingBatchId', 'RoutingBatchId', 'id', 'Id'),
    routeType,
    targetDocumentId: readNumber(record, 'targetDocumentId', 'TargetDocumentId'),
    targetDocumentNo,
    routedQuantity: readNumber(record, 'routedQuantity', 'RoutedQuantity', 'quantity', 'Quantity'),
    replayed: Boolean(record.replayed ?? record.Replayed),
  };
}

/** Detail / routes endpoint payload → yönlendirme satırları. */
export function normalizeGoodsReceiptRoutes(raw: unknown): GoodsReceiptRoutingResult[] {
  if (!raw) return [];
  const record = asRecord(raw);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(record?.items)
      ? record.items
      : Array.isArray(record?.Items)
        ? record.Items
        : Array.isArray(record?.routes)
          ? record.routes
          : Array.isArray(record?.Routes)
            ? record.Routes
            : [];

  const routes: GoodsReceiptRoutingResult[] = [];
  for (const item of list) {
    const route = normalizeRoute(item);
    if (route) routes.push(route);
  }
  return routes;
}

export function mergeGoodsReceiptRoutes(
  ...groups: Array<GoodsReceiptRoutingResult[] | null | undefined>
): GoodsReceiptRoutingResult[] {
  const map = new Map<string, GoodsReceiptRoutingResult>();
  for (const group of groups) {
    for (const route of group ?? []) {
      const key = `${route.routeType}:${route.targetDocumentId || route.targetDocumentNo}:${route.routingBatchId}`;
      map.set(key, route);
    }
  }
  return Array.from(map.values());
}
