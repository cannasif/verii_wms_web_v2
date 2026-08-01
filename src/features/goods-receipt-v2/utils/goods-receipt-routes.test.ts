import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeGoodsReceiptRoutes, normalizeGoodsReceiptRoutes } from './goods-receipt-routes';

describe('normalizeGoodsReceiptRoutes', () => {
  it('reads camelCase and PascalCase route payloads', () => {
    assert.deepEqual(
      normalizeGoodsReceiptRoutes({
        items: [
          {
            RoutingBatchId: 1,
            RouteType: 'WarehouseTransfer',
            TargetDocumentId: 10,
            TargetDocumentNo: 'TRF-1',
            RoutedQuantity: 5,
          },
          {
            routingBatchId: 2,
            routeType: 'WarehouseOutbound',
            targetDocumentId: 11,
            targetDocumentNo: 'OUT-1',
            routedQuantity: 3,
          },
        ],
      }),
      [
        {
          routingBatchId: 1,
          routeType: 'WarehouseTransfer',
          targetDocumentId: 10,
          targetDocumentNo: 'TRF-1',
          routedQuantity: 5,
          replayed: false,
        },
        {
          routingBatchId: 2,
          routeType: 'WarehouseOutbound',
          targetDocumentId: 11,
          targetDocumentNo: 'OUT-1',
          routedQuantity: 3,
          replayed: false,
        },
      ],
    );
  });

  it('merges unique routes by type and document', () => {
    const merged = mergeGoodsReceiptRoutes(
      [
        {
          routingBatchId: 1,
          routeType: 'WarehouseTransfer',
          targetDocumentId: 10,
          targetDocumentNo: 'TRF-1',
          routedQuantity: 5,
          replayed: false,
        },
      ],
      [
        {
          routingBatchId: 1,
          routeType: 'WarehouseTransfer',
          targetDocumentId: 10,
          targetDocumentNo: 'TRF-1',
          routedQuantity: 5,
          replayed: false,
        },
        {
          routingBatchId: 2,
          routeType: 'WarehouseOutbound',
          targetDocumentId: 11,
          targetDocumentNo: 'OUT-1',
          routedQuantity: 2,
          replayed: false,
        },
      ],
    );
    assert.equal(merged.length, 2);
  });
});
