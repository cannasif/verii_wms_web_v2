export const loadAppLayout = () => import('@/layouts/AppLayout');
export const loadProfilePage = () => import('@/features/user-detail/components/ProfilePage');
export const loadErpMirrorPages = () => import('@/features/erp-mirror/components/ErpMirrorPages');
export const loadUserManagementPage = () => import('@/features/user-management');
export const loadPermissionGroupsPage = () => import('@/features/permission-groups');
export const loadAuditLogsPage = () => import('@/features/audit-logs');
export const loadPermissionsPage = () => import('@/features/permissions/components/PermissionsPage');
export const loadSmtpSettingsPage = () => import('@/features/smtp/components/SmtpSettingsPage');
export const loadHangfirePage = () => import('@/features/hangfire/components/HangfirePage');
export const loadLocationDefinitionsPage = () => import('@/features/locations');
export const loadStockMovementsPage = () => import('@/features/stock-movements/components/StockMovementsPage');
export const loadStockBalancePages = () => import('@/features/stock-balances/components/StockBalancePages');
export const loadWarehouseAssistantPage = () => import('@/features/warehouse-assistant/components/WarehouseAssistantPage');
export const loadProjectSettingsPage = () => import('@/features/project-settings/ProjectSettingsPage');
export const loadProcessParametersHubPage = () => import('@/features/process-parameters/ProcessParametersHubPage');
export const loadDocumentSeriesPage = () => import('@/features/document-series');
export const loadBarcodeDesignerPage = () => import('@/features/barcode-designer');
export const loadBarcodePolicyPage = () => import('@/features/barcode-policy');
export const loadIncomingInvoiceArchivePage = () => import('@/features/incoming-invoices/components/IncomingInvoiceArchivePage');
export const loadELogoConnectionsPage = () => import('@/features/incoming-invoices/components/ELogoConnectionsPage');
export const loadSupplierStockMappingsPage = () => import('@/features/supplier-stock-mappings/SupplierStockMappingsPage');
export const loadKkdPages = () => import('@/features/kkd');

export const loadGoodsReceiptAssignedTasksPage = () => import('@/features/goods-receipt-v2/components/GoodsReceiptTasksPage');
export const loadGoodsReceiptCreatePage = () => import('@/features/goods-receipt-v2/components/GoodsReceiptCreatePage');
export const loadGoodsReceiptManualPage = () => import('@/features/goods-receipt-v2/components/GoodsReceiptManualPage');
export const loadGoodsReceiptHubPage = () => import('@/features/goods-receipt-v2/components/GoodsReceiptHubPage');
export const loadGoodsReceiptLabelsPage = () => import('@/features/goods-receipt-v2/components/GoodsReceiptLabelsPage');
export const loadGoodsReceiptListPage = () => import('@/features/goods-receipt-v2/components/GoodsReceiptListPage');
export const loadGoodsReceiptPolicyPage = () => import('@/features/goods-receipt-policy/GoodsReceiptPolicyPage');

export const loadQualitySettingsPage = () => import('@/features/quality/components/QualitySettingsPage');
export const loadQualityRulesPage = () => import('@/features/quality/components/QualityRulesPage');
export const loadQualityDecisionCodesPage = () => import('@/features/quality/components/QualityDecisionCodesPage');
export const loadQualityInspectionsPage = () => import('@/features/quality/components/QualityInspectionsPage');
export const loadQualityReportsPage = () => import('@/features/quality/components/QualityReportsPage');
export const loadSerialNumberRulesPage = () => import('@/features/serial-number-rules');

export const loadSteelReceiptHubPage = () => import('@/features/steel-receipt/components/SteelReceiptHubPage');
export const loadSteelReceiptImportPage = () => import('@/features/steel-receipt/components/SteelReceiptImportPage');
export const loadSteelReceiptPlansPage = () => import('@/features/steel-receipt/components/SteelReceiptPlansPage');
export const loadSteelReceiptInspectionPage = () => import('@/features/steel-receipt/components/SteelReceiptInspectionPage');
export const loadSteelReceiptOperationsPage = () => import('@/features/steel-receipt/components/SteelReceiptOperationsPage');
export const loadSteelReceiptReportsPage = () => import('@/features/steel-receipt/components/SteelReceiptReportsPage');
export const loadVehicleCheckInPage = () => import('@/features/vehicle-check-in/components/VehicleCheckInPage');
export const loadVehicleCheckInListPage = () => import('@/features/vehicle-check-in/components/VehicleCheckInListPage');

export const loadWarehouseTransferHubPage = () => import('@/features/warehouse-transfer-v2/components/WarehouseTransferHubPage');
export const loadWarehouseTransferCreateHubPage = () => import('@/features/warehouse-transfer-v2/WarehouseTransferCreateHubPage');
export const loadWarehouseTransferDraftPage = () => import('@/features/warehouse-transfer-v2/components/WarehouseTransferDraftPage');
export const loadWarehouseTransferListPage = () => import('@/features/warehouse-transfer-v2/components/WarehouseTransferListPage');
export const loadWarehouseTransferPolicyPage = () => import('@/features/warehouse-transfer-v2/components/WarehouseTransferPolicyPage');
export const loadWarehouseTransferOperationPage = () => import('@/features/warehouse-transfer-v2/WarehouseTransferOperationPage');
export const loadProductionTransferPages = () => import('@/features/production-transfer/ProductionTransferPages');
export const loadSubcontractingTransferPages = () => import('@/features/subcontracting-transfer/SubcontractingTransferPages');
export const loadProductionPages = () => import('@/features/production/ProductionPages');
export const loadGeneratorProductionPages = () => import('@/features/generator-production/GeneratorProductionPages');
export const loadProcurementPage = () => import('@/features/procurement/ProcurementPage');
export const loadSupplierQuoteEntryPage = () => import('@/features/procurement/SupplierQuoteEntryPage');
export const loadSupplierQuotePortalPage = () => import('@/features/procurement/SupplierQuotePortalPage');

export const loadShippingHubPage = () => import('@/features/shipping-v2/ShippingHubPage');
export const loadShippingCreatePage = () => import('@/features/shipping-v2/ShippingCreatePage');
export const loadShippingListPage = () => import('@/features/shipping-v2/ShippingListPage');
export const loadShippingPolicyPage = () => import('@/features/shipping-v2/ShippingPolicyPage');
export const loadShippingOperationPage = () => import('@/features/shipping-v2/ShippingOperationPage');

export const loadWarehouseInboundTasksPage = () => import('@/features/warehouse-inbound/components/WarehouseInboundTasksPage');
export const loadWarehouseInboundCreatePage = () => import('@/features/warehouse-inbound/components/WarehouseInboundCreatePage');
export const loadWarehouseInboundManualPage = () => import('@/features/warehouse-inbound/components/WarehouseInboundManualPage');
export const loadWarehouseInboundHubPage = () => import('@/features/warehouse-inbound/components/WarehouseInboundHubPage');
export const loadWarehouseInboundLabelsPage = () => import('@/features/warehouse-inbound/components/WarehouseInboundLabelsPage');
export const loadWarehouseInboundListPage = () => import('@/features/warehouse-inbound/components/WarehouseInboundListPage');
export const loadWarehouseInboundPolicyPage = () => import('@/features/warehouse-inbound/WarehouseInboundPolicyPage');
export const loadWarehouseOutboundHubPage = () => import('@/features/warehouse-outbound/WarehouseOutboundHubPage');
export const loadWarehouseOutboundCreatePage = () => import('@/features/warehouse-outbound/WarehouseOutboundCreatePage');
export const loadWarehouseOutboundListPage = () => import('@/features/warehouse-outbound/WarehouseOutboundListPage');
export const loadWarehouseOutboundPolicyPage = () => import('@/features/warehouse-outbound/WarehouseOutboundPolicyPage');
export const loadWarehouseOutboundOperationPage = () => import('@/features/warehouse-outbound/WarehouseOutboundOperationPage');
export const loadPackingPages = () => import('@/features/packing');
export const loadInventoryCountPage = () => import('@/features/inventory-count');
const routePreloaders: Array<[prefix: string, load: () => Promise<unknown>]> = [
  ['/warehouse/inventory-counts', loadInventoryCountPage],
  ['/warehouse/assistant', loadWarehouseAssistantPage],
  ['/procurement/quotes/new', loadSupplierQuoteEntryPage],
  ['/procurement', loadProcurementPage],
  ['/warehouse/kkd', loadKkdPages],
  ['/warehouse/goods-receipts/supplier-stock-mappings', loadSupplierStockMappingsPage],
  ['/warehouse/incoming-invoices/connections', loadELogoConnectionsPage],
  ['/warehouse/incoming-invoices', loadIncomingInvoiceArchivePage],
  ['/warehouse/packing', loadPackingPages],
  ['/warehouse/warehouse-inbounds/settings', loadWarehouseInboundPolicyPage],
  ['/warehouse/warehouse-inbounds/assigned', loadWarehouseInboundTasksPage],
  ['/warehouse/warehouse-inbounds/tasks', loadWarehouseInboundTasksPage],
  ['/warehouse/warehouse-inbounds/labels', loadWarehouseInboundLabelsPage],
  ['/warehouse/warehouse-inbounds/orderless', loadWarehouseInboundManualPage],
  ['/warehouse/warehouse-inbounds/direct', loadWarehouseInboundManualPage],
  ['/warehouse/warehouse-inbounds/list', loadWarehouseInboundListPage],
  ['/warehouse/warehouse-inbounds/new', loadWarehouseInboundCreatePage],
  ['/warehouse/warehouse-inbounds', loadWarehouseInboundHubPage],
  ['/warehouse/warehouse-outbounds/settings', loadWarehouseOutboundPolicyPage],
  ['/warehouse/warehouse-outbounds/list', loadWarehouseOutboundListPage],
  ['/warehouse/warehouse-outbounds/new', loadWarehouseOutboundCreatePage],
  ['/warehouse/warehouse-outbounds', loadWarehouseOutboundHubPage],  ['/warehouse/goods-receipts/steel/vehicle-check-ins', loadVehicleCheckInListPage],
  ['/warehouse/goods-receipts/steel/vehicle-check-in', loadVehicleCheckInPage],
  ['/warehouse/goods-receipts/steel/reports', loadSteelReceiptReportsPage],
  ['/warehouse/goods-receipts/steel/inspection', loadSteelReceiptInspectionPage],
  ['/warehouse/goods-receipts/steel/operations', loadSteelReceiptOperationsPage],
  ['/warehouse/goods-receipts/steel/receipt', loadSteelReceiptOperationsPage],
  ['/warehouse/goods-receipts/steel/placement', loadSteelReceiptOperationsPage],
  ['/warehouse/goods-receipts/steel/import', loadSteelReceiptImportPage],
  ['/warehouse/goods-receipts/steel/plans', loadSteelReceiptPlansPage],
  ['/warehouse/goods-receipts/steel', loadSteelReceiptHubPage],
  ['/warehouse/goods-receipts/assigned', loadGoodsReceiptAssignedTasksPage],
  ['/warehouse/goods-receipts/tasks', loadGoodsReceiptAssignedTasksPage],
  ['/warehouse/goods-receipts/labels', loadGoodsReceiptLabelsPage],
  ['/warehouse/goods-receipts/orderless', loadGoodsReceiptManualPage],
  ['/warehouse/goods-receipts/direct', loadGoodsReceiptManualPage],
  ['/warehouse/goods-receipts/list', loadGoodsReceiptListPage],
  ['/warehouse/goods-receipts/new', loadGoodsReceiptCreatePage],
  ['/warehouse/goods-receipts/success-preview', loadGoodsReceiptCreatePage],
  ['/warehouse/goods-receipts', loadGoodsReceiptHubPage],
  ['/warehouse/transfers/settings', loadWarehouseTransferPolicyPage],
  ['/warehouse/transfers/list', loadWarehouseTransferListPage],
  ['/warehouse/transfers/new', loadWarehouseTransferDraftPage],
  ['/warehouse/transfers', loadWarehouseTransferHubPage],
  ['/warehouse/production/generator', loadGeneratorProductionPages],
  ['/warehouse/production', loadProductionPages],
  ['/warehouse/production-transfers', loadProductionTransferPages],
  ['/warehouse/subcontracting-transfers', loadSubcontractingTransferPages],
  ['/warehouse/shipments/settings', loadShippingPolicyPage],
  ['/warehouse/shipments/list', loadShippingListPage],
  ['/warehouse/shipments/new', loadShippingCreatePage],
  ['/warehouse/shipments', loadShippingHubPage],
  ['/warehouse/quality/inspections', loadQualityInspectionsPage],
  ['/warehouse/quality/reports', loadQualityReportsPage],
  ['/warehouse/quality/quarantine', loadQualityInspectionsPage],
  ['/warehouse/quality/settings', loadQualitySettingsPage],
  ['/warehouse/quality/rules', loadQualityRulesPage],
  ['/warehouse/quality/decision-codes', loadQualityDecisionCodesPage],
  ['/warehouse/process-parameters', loadProcessParametersHubPage],
  ['/warehouse/barcode-designer', loadBarcodeDesignerPage],
  ['/warehouse/barcode-policy', loadBarcodePolicyPage],
  ['/warehouse/document-series', loadDocumentSeriesPage],
  ['/warehouse/serial-number-rules', loadSerialNumberRulesPage],
  ['/warehouse/stock-movements', loadStockMovementsPage],
  ['/warehouse/location-balances', loadStockBalancePages],
  ['/warehouse/stock-balances', loadStockBalancePages],
  ['/warehouse/serial-balances', loadStockBalancePages],
  ['/warehouse/locations', loadLocationDefinitionsPage],
  ['/erp/', loadErpMirrorPages],
  ['/system/users', loadUserManagementPage],
  ['/system/permission-groups', loadPermissionGroupsPage],
  ['/system/permissions', loadPermissionsPage],
  ['/system/audit-logs', loadAuditLogsPage],
  ['/system/smtp', loadSmtpSettingsPage],
  ['/system/hangfire', loadHangfirePage],
  ['/system/project-settings', loadProjectSettingsPage],
  ['/profile', loadProfilePage],
];

export function preloadRoute(pathname: string): void {
  const match = routePreloaders.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (match) void match[1]().catch(() => undefined);
}
