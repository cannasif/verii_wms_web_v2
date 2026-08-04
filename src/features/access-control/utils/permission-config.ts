export const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/procurement': 'WMS.PROCUREMENT.VIEW',
  '/erp/warehouses': 'ERP.MIRROR.VIEW',
  '/erp/stocks': 'ERP.MIRROR.VIEW',
  '/erp/customers': 'ERP.MIRROR.VIEW',
  '/erp/configuration-codes': 'ERP.MIRROR.VIEW',
  '/erp/yapkodlar': 'ERP.MIRROR.VIEW',
  '/system/users': 'SYSTEM.USERS.VIEW',
  '/system/permissions': 'SYSTEM.PERMISSIONS.VIEW',
  '/system/permission-groups': 'SYSTEM.PERMISSIONS.VIEW',
  '/system/audit-logs': 'SYSTEM.AUDIT.VIEW',
  '/system/smtp': 'SYSTEM.SMTP.MANAGE',
  '/system/hangfire': 'SYSTEM.HANGFIRE.VIEW',
  '/system/project-settings': 'SYSTEM.PROJECT_SETTINGS.VIEW',
  '/warehouse/locations': 'WMS.LOCATIONS.VIEW',
  '/warehouse/document-series': 'WMS.DOCUMENT_SERIES.VIEW',
  '/warehouse/barcode-designer': 'WMS.BARCODE_DESIGNER.VIEW',
  '/warehouse/barcode-policy': 'WMS.BARCODE_POLICY.VIEW',
  '/warehouse/stock-movements': 'WMS.STOCK_MOVEMENTS.VIEW',
  '/warehouse/location-balances': 'WMS.STOCK_BALANCES.VIEW',
  '/warehouse/stock-balances': 'WMS.STOCK_BALANCES.VIEW',
  '/warehouse/serial-balances': 'WMS.STOCK_BALANCES.VIEW',
  '/warehouse/packing': 'WMS.PACKING.VIEW',
  '/warehouse/packing/definitions': 'WMS.PACKING.DEFINITIONS.VIEW',
  '/warehouse/packing/settings': 'WMS.PACKING.SETTINGS.VIEW',
  '/warehouse/goods-receipts/supplier-stock-mappings': 'WMS.GOODS_RECEIPT.SUPPLIER_STOCK_MAPPING.VIEW',
  '/goods-receipt/create': 'wms.goods-receipt.create',
  '/goods-receipt/edit/:id': 'wms.goods-receipt.update',
  '/goods-receipt/approval': 'wms.goods-receipt.update',
  '/goods-receipt/list': 'wms.goods-receipt.view',
  '/goods-receipt/assigned': 'wms.goods-receipt.view',
  '/incoming-invoice-archive': 'wms.goods-receipt.view',
  '/incoming-invoice-archive/connections': 'wms.goods-receipt.update',
  '/transfer/create': 'wms.transfer.create',
  '/transfer/edit/:id': 'wms.transfer.update',
  '/transfer/list': 'wms.transfer.view',
  '/transfer/assigned': 'wms.transfer.view',
  '/transfer/approval': 'wms.transfer.update',
  '/transfer/chains': 'wms.transfer.view',
  '/subcontracting/issue/create': 'wms.subcontracting.issue.create',
  '/subcontracting/issue/edit/:id': 'wms.subcontracting.issue.update',
  '/subcontracting/issue/process': 'wms.subcontracting.issue.create',
  '/subcontracting/issue/list': 'wms.subcontracting.issue.view',
  '/subcontracting/issue/assigned': 'wms.subcontracting.issue.view',
  '/subcontracting/issue/approval': 'wms.subcontracting.issue.update',
  '/subcontracting/receipt/create': 'wms.subcontracting.receipt.create',
  '/subcontracting/receipt/edit/:id': 'wms.subcontracting.receipt.update',
  '/subcontracting/receipt/process': 'wms.subcontracting.receipt.create',
  '/subcontracting/receipt/list': 'wms.subcontracting.receipt.view',
  '/subcontracting/receipt/assigned': 'wms.subcontracting.receipt.view',
  '/subcontracting/receipt/approval': 'wms.subcontracting.receipt.update',
  '/warehouse/inbound/create': 'wms.warehouse.inbound.create',
  '/warehouse/inbound/edit/:id': 'wms.warehouse.inbound.update',
  '/warehouse/inbound/list': 'wms.warehouse.inbound.view',
  '/warehouse/inbound/assigned': 'wms.warehouse.inbound.view',
  '/warehouse/inbound/approval': 'wms.warehouse.inbound.update',
  '/warehouse/outbound/create': 'wms.warehouse.outbound.create',
  '/warehouse/outbound/edit/:id': 'wms.warehouse.outbound.update',
  '/warehouse/outbound/process': 'wms.warehouse.outbound.create',
  '/warehouse/outbound/list': 'wms.warehouse.outbound.view',
  '/warehouse/outbound/assigned': 'wms.warehouse.outbound.view',
  '/warehouse/outbound/approval': 'wms.warehouse.outbound.update',
  '/shipment/create': 'wms.shipment.create',
  '/shipment/edit/:id': 'wms.shipment.update',
  '/shipment/process': 'wms.shipment.create',
  '/shipment/list': 'wms.shipment.view',
  '/shipment/assigned': 'wms.shipment.view',
  '/shipment/approval': 'wms.shipment.update',
  '/service-allocation/allocation-queue': 'wms.service-allocation.view',
  '/service-allocation/cases/new': 'wms.service-allocation.create',
  '/service-allocation/cases': 'wms.service-allocation.view',
  '/service-allocation/cases/:id/edit': 'wms.service-allocation.update',
  '/service-allocation/document-links': 'wms.service-allocation.view',
  '/service-allocation/reports': 'wms.service-allocation.view',
  '/production/create': 'wms.production.create',
  '/production/detail': 'wms.production.view',
  '/production/process': 'wms.production.view',
  '/production/assigned': 'wms.production.view',
  '/production/approval': 'wms.production.update',
  '/production/list': 'wms.production.view',
  '/production-transfer/create': 'wms.production-transfer.create',
  '/production-transfer/edit/:id': 'wms.production-transfer.update',
  '/production-transfer/detail': 'wms.production-transfer.view',
  '/production-transfer/approval': 'wms.production-transfer.update',
  '/production-transfer/list': 'wms.production-transfer.view',
  '/inventory-count/create': 'wms.inventory-count.create',
  '/inventory-count/edit/:id': 'wms.inventory-count.update',
  '/inventory-count/process': 'wms.inventory-count.update',
  '/inventory-count/list': 'wms.inventory-count.view',
  '/inventory-count/assigned': 'wms.inventory-count.view',
  '/inventory/3d-warehouse': 'wms.inventory-count.view',
  '/inventory/3d-outside-warehouse': 'wms.inventory-count.view',
  '/reports': 'wms.reports.view',
  '/parameters/gr': 'wms.parameters.gr.view',
  '/parameters/wt': 'wms.parameters.wt.view',
  '/parameters/wo': 'wms.parameters.wo.view',
  '/parameters/wi': 'wms.parameters.wi.view',
  '/parameters/sh': 'wms.parameters.sh.view',
  '/parameters/srt': 'wms.parameters.srt.view',
  '/parameters/sit': 'wms.parameters.sit.view',
  '/parameters/pt': 'wms.parameters.pt.view',
  '/parameters/pr': 'wms.parameters.pr.view',
  '/parameters/ic': 'wms.parameters.ic.view',
  '/parameters/p': 'wms.parameters.p.view',
  '/package/create': 'wms.package.create',
  '/package/edit/:id': 'wms.package.update',
  '/package/detail/:id': 'wms.package.view',
  '/package/package-detail/:id': 'wms.package.view',
  '/package/settings': 'wms.package.update',
  '/package/station': 'wms.package.update',
  '/package/list': 'wms.package.view',
  '/access-control/user-management': 'access-control.user-management.view',
  '/access-control/permission-definitions': 'access-control.permission-definitions.view',
  '/access-control/permission-groups': 'access-control.permission-groups.view',
  '/access-control/user-group-assignments': 'access-control.user-group-assignments.view',
  '/access-control/wms-scope-policies': 'access-control.wms-scope-policies.view',
  '/access-control/wms-scope-assignments': 'access-control.wms-scope-assignments.view',
  '/users/mail-settings': 'access-control.mail-settings.view',
  '/hangfire-monitoring': 'access-control.hangfire-monitoring.view',
  '/trace-explorer': 'access-control.trace-explorer.view',
  '/erp/shelves': 'wms.shelf.view',
  '/erp/warehouse-stock-balance': 'wms.warehouse-balance.view',
  '/erp/warehouse-serial-balance': 'wms.warehouse-balance.view',
  '/erp/barcodes': 'wms.print-management.view',
  '/erp/barcode-designer': 'wms.print-management.view',
  '/erp/barcode-designer/new': 'wms.print-management.create',
  '/erp/barcode-designer/:id/edit': 'wms.print-management.update',
  '/erp/barcode-designer/:id/print': 'wms.print-management.view',
  '/erp/printer-management': 'wms.print-management.view',
};

export const PATH_TO_PERMISSION_PATTERNS: Array<{ pattern: RegExp; permission: string }> = [
  { pattern: /^\/procurement(\/|$)/, permission: 'WMS.PROCUREMENT.VIEW' },
  { pattern: /^\/erp\/(warehouses|stocks|customers|configuration-codes|yapkodlar)(\/|$)/, permission: 'ERP.MIRROR.VIEW' },
  { pattern: /^\/system\/users(\/|$)/, permission: 'SYSTEM.USERS.VIEW' },
  { pattern: /^\/system\/(permissions|permission-groups)(\/|$)/, permission: 'SYSTEM.PERMISSIONS.VIEW' },
  { pattern: /^\/system\/audit-logs(\/|$)/, permission: 'SYSTEM.AUDIT.VIEW' },
  { pattern: /^\/system\/smtp(\/|$)/, permission: 'SYSTEM.SMTP.MANAGE' },
  { pattern: /^\/system\/hangfire(\/|$)/, permission: 'SYSTEM.HANGFIRE.VIEW' },
  { pattern: /^\/system\/project-settings(\/|$)/, permission: 'SYSTEM.PROJECT_SETTINGS.VIEW' },
  { pattern: /^\/warehouse\/barcode-policy(\/|$)/, permission: 'WMS.BARCODE_POLICY.VIEW' },
  { pattern: /^\/warehouse\/goods-receipts\/supplier-stock-mappings(\/|$)/, permission: 'WMS.GOODS_RECEIPT.SUPPLIER_STOCK_MAPPING.VIEW' },
  { pattern: /^\/goods-receipt\/create(\/|$)/, permission: 'wms.goods-receipt.create' },
  { pattern: /^\/goods-receipt\/edit\/\d+(\/|$)/, permission: 'wms.goods-receipt.update' },
  { pattern: /^\/goods-receipt\/approval(\/|$)/, permission: 'wms.goods-receipt.update' },
  { pattern: /^\/goods-receipt(\/|$)/, permission: 'wms.goods-receipt.view' },
  { pattern: /^\/incoming-invoice-archive\/connections(\/|$)/, permission: 'wms.goods-receipt.update' },
  { pattern: /^\/incoming-invoice-archive(\/|$)/, permission: 'wms.goods-receipt.view' },
  { pattern: /^\/transfer\/create(\/|$)/, permission: 'wms.transfer.create' },
  { pattern: /^\/transfer\/edit\/\d+(\/|$)/, permission: 'wms.transfer.update' },
  { pattern: /^\/transfer\/approval(\/|$)/, permission: 'wms.transfer.update' },
  { pattern: /^\/transfer(\/|$)/, permission: 'wms.transfer.view' },
  { pattern: /^\/subcontracting\/issue\/create(\/|$)/, permission: 'wms.subcontracting.issue.create' },
  { pattern: /^\/subcontracting\/issue\/edit\/\d+(\/|$)/, permission: 'wms.subcontracting.issue.update' },
  { pattern: /^\/subcontracting\/issue\/process(\/|$)/, permission: 'wms.subcontracting.issue.create' },
  { pattern: /^\/subcontracting\/issue\/approval(\/|$)/, permission: 'wms.subcontracting.issue.update' },
  { pattern: /^\/subcontracting\/issue(\/|$)/, permission: 'wms.subcontracting.issue.view' },
  { pattern: /^\/subcontracting\/receipt\/create(\/|$)/, permission: 'wms.subcontracting.receipt.create' },
  { pattern: /^\/subcontracting\/receipt\/edit\/\d+(\/|$)/, permission: 'wms.subcontracting.receipt.update' },
  { pattern: /^\/subcontracting\/receipt\/process(\/|$)/, permission: 'wms.subcontracting.receipt.create' },
  { pattern: /^\/subcontracting\/receipt\/approval(\/|$)/, permission: 'wms.subcontracting.receipt.update' },
  { pattern: /^\/subcontracting\/receipt(\/|$)/, permission: 'wms.subcontracting.receipt.view' },
  { pattern: /^\/warehouse\/inbound\/create(\/|$)/, permission: 'wms.warehouse.inbound.create' },
  { pattern: /^\/warehouse\/inbound\/edit\/\d+(\/|$)/, permission: 'wms.warehouse.inbound.update' },
  { pattern: /^\/warehouse\/inbound\/approval(\/|$)/, permission: 'wms.warehouse.inbound.update' },
  { pattern: /^\/warehouse\/inbound(\/|$)/, permission: 'wms.warehouse.inbound.view' },
  { pattern: /^\/warehouse\/outbound\/create(\/|$)/, permission: 'wms.warehouse.outbound.create' },
  { pattern: /^\/warehouse\/outbound\/edit\/\d+(\/|$)/, permission: 'wms.warehouse.outbound.update' },
  { pattern: /^\/warehouse\/outbound\/process(\/|$)/, permission: 'wms.warehouse.outbound.create' },
  { pattern: /^\/warehouse\/outbound\/approval(\/|$)/, permission: 'wms.warehouse.outbound.update' },
  { pattern: /^\/warehouse\/outbound(\/|$)/, permission: 'wms.warehouse.outbound.view' },
  { pattern: /^\/shipment\/create(\/|$)/, permission: 'wms.shipment.create' },
  { pattern: /^\/shipment\/edit\/\d+(\/|$)/, permission: 'wms.shipment.update' },
  { pattern: /^\/shipment\/process(\/|$)/, permission: 'wms.shipment.create' },
  { pattern: /^\/shipment\/approval(\/|$)/, permission: 'wms.shipment.update' },
  { pattern: /^\/shipment(\/|$)/, permission: 'wms.shipment.view' },
  { pattern: /^\/service-allocation\/cases\/new(\/|$)/, permission: 'wms.service-allocation.create' },
  { pattern: /^\/service-allocation\/cases\/\d+\/edit(\/|$)/, permission: 'wms.service-allocation.update' },
  { pattern: /^\/service-allocation(\/|$)/, permission: 'wms.service-allocation.view' },
  { pattern: /^\/production\/create(\/|$)/, permission: 'wms.production.create' },
  { pattern: /^\/production\/approval(\/|$)/, permission: 'wms.production.update' },
  { pattern: /^\/production(\/|$)/, permission: 'wms.production.view' },
  { pattern: /^\/production-transfer\/create(\/|$)/, permission: 'wms.production-transfer.create' },
  { pattern: /^\/production-transfer\/edit\/\d+(\/|$)/, permission: 'wms.production-transfer.update' },
  { pattern: /^\/production-transfer\/approval(\/|$)/, permission: 'wms.production-transfer.update' },
  { pattern: /^\/production-transfer(\/|$)/, permission: 'wms.production-transfer.view' },
  { pattern: /^\/inventory-count\/create(\/|$)/, permission: 'wms.inventory-count.create' },
  { pattern: /^\/inventory-count\/edit\/\d+(\/|$)/, permission: 'wms.inventory-count.update' },
  { pattern: /^\/inventory-count\/process(\/|$)/, permission: 'wms.inventory-count.update' },
  { pattern: /^\/inventory-count(\/|$)/, permission: 'wms.inventory-count.view' },
  { pattern: /^\/inventory(\/|$)/, permission: 'wms.inventory-count.view' },
  { pattern: /^\/reports(\/|$)/, permission: 'wms.reports.view' },
  { pattern: /^\/parameters(\/|$)/, permission: 'wms.parameters.gr.view' },
  { pattern: /^\/package\/create(\/|$)/, permission: 'wms.package.create' },
  { pattern: /^\/package\/edit\/\d+(\/|$)/, permission: 'wms.package.update' },
  { pattern: /^\/package\/settings(\/|$)/, permission: 'wms.package.update' },
  { pattern: /^\/package\/station(\/|$)/, permission: 'wms.package.update' },
  { pattern: /^\/package(\/|$)/, permission: 'wms.package.view' },
  { pattern: /^\/access-control\/user-management(\/|$)/, permission: 'access-control.user-management.view' },
  { pattern: /^\/access-control\/permission-definitions(\/|$)/, permission: 'access-control.permission-definitions.view' },
  { pattern: /^\/access-control\/permission-groups(\/|$)/, permission: 'access-control.permission-groups.view' },
  { pattern: /^\/access-control\/user-group-assignments(\/|$)/, permission: 'access-control.user-group-assignments.view' },
  { pattern: /^\/access-control\/wms-scope-policies(\/|$)/, permission: 'access-control.wms-scope-policies.view' },
  { pattern: /^\/access-control\/wms-scope-assignments(\/|$)/, permission: 'access-control.wms-scope-assignments.view' },
  { pattern: /^\/users\/mail-settings(\/|$)/, permission: 'access-control.mail-settings.view' },
  { pattern: /^\/hangfire-monitoring(\/|$)/, permission: 'access-control.hangfire-monitoring.view' },
  { pattern: /^\/trace-explorer(\/|$)/, permission: 'access-control.trace-explorer.view' },
  { pattern: /^\/erp\/customers(\/|$)/, permission: 'wms.print-management.view' },
  { pattern: /^\/erp\/stocks(\/|$)/, permission: 'wms.print-management.view' },
  { pattern: /^\/erp\/warehouses(\/|$)/, permission: 'wms.print-management.view' },
  { pattern: /^\/erp\/shelves(\/|$)/, permission: 'wms.shelf.view' },
  { pattern: /^\/erp\/warehouse-stock-balance(\/|$)/, permission: 'wms.warehouse-balance.view' },
  { pattern: /^\/erp\/warehouse-serial-balance(\/|$)/, permission: 'wms.warehouse-balance.view' },
  { pattern: /^\/erp\/(configuration-codes|yapkodlar)(\/|$)/, permission: 'wms.print-management.view' },
  { pattern: /^\/erp\/barcodes(\/|$)/, permission: 'wms.print-management.view' },
  { pattern: /^\/erp\/barcode-designer\/new(\/|$)/, permission: 'wms.print-management.create' },
  { pattern: /^\/erp\/barcode-designer\/\d+\/edit(\/|$)/, permission: 'wms.print-management.update' },
  { pattern: /^\/erp\/barcode-designer\/\d+\/print(\/|$)/, permission: 'wms.print-management.view' },
  { pattern: /^\/erp\/barcode-designer(\/|$)/, permission: 'wms.print-management.view' },
  { pattern: /^\/erp\/printer-management(\/|$)/, permission: 'wms.print-management.view' },
];

const PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete'] as const;

type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
type PermissionScopeDisplay = { key: string; fallback: string };

export function isLeafPermissionCode(code: string): boolean {
  if (code === 'dashboard.view' || code === 'wms.reports.view') return true;
  const parts = code.split('.').filter(Boolean);
  const last = parts[parts.length - 1];
  return !!last && PERMISSION_ACTIONS.includes(last as PermissionAction);
}

export const ACCESS_CONTROL_ADMIN_PERMISSIONS = [
  'access-control.permission-definitions.view',
  'access-control.permission-groups.view',
  'access-control.user-management.view',
  'access-control.user-group-assignments.view',
  'access-control.wms-scope-policies.view',
  'access-control.wms-scope-assignments.view',
] as const;

export const RBAC_FALLBACK_PERMISSION = 'access-control.permission-definitions.view' as const;

export const ACCESS_CONTROL_ADMIN_FALLBACK_TO_SYSTEM_ADMIN = true as const;

export const ACCESS_CONTROL_ADMIN_ONLY_PATTERNS: RegExp[] = [];

export const PERMISSION_CODE_ALIASES: Record<string, string[]> = {
  'access-control.user-group-assignments.view': ['access-control.user-management.view'],
  'access-control.user-group-assignments.update': ['access-control.user-management.update'],
  'access-control.wms-scope-assignments.view': ['access-control.wms-scope-policies.view'],
};

export const PERMISSION_SCOPE_DISPLAY: Record<string, PermissionScopeDisplay> = {
  dashboard: { key: 'sidebar.dashboard', fallback: 'Dashboard' },
  'wms.goods-receipt': { key: 'sidebar.goodsReceipt', fallback: 'Mal Kabul' },
  'wms.transfer': { key: 'sidebar.transfer', fallback: 'Transfer' },
  'wms.subcontracting.issue': { key: 'sidebar.subcontractingIssueCreate', fallback: 'Fason Çıkış' },
  'wms.subcontracting.receipt': { key: 'sidebar.subcontractingReceiptCreate', fallback: 'Fason Giriş' },
  'wms.warehouse.inbound': { key: 'sidebar.warehouseInboundCreate', fallback: 'Ambar Giriş' },
  'wms.warehouse.outbound': { key: 'sidebar.warehouseOutboundCreate', fallback: 'Ambar Çıkış' },
  'wms.shipment': { key: 'sidebar.shipment', fallback: 'Sevkiyat' },
  'wms.service-allocation': { key: 'sidebar.serviceAllocation', fallback: 'Servis ve Hakediş' },
  'wms.production': { key: 'sidebar.production', fallback: 'Üretim' },
  'wms.production-transfer': { key: 'sidebar.productionTransfer', fallback: 'Üretim Transferi' },
  'wms.package': { key: 'sidebar.package', fallback: 'Paketleme' },
  'wms.warehouse-balance': { key: 'sidebar.erpWarehouseStockBalance', fallback: 'Depo Stok Bakiyesi' },
  'wms.shelf': { key: 'sidebar.erpShelves', fallback: 'Raf Tanımları' },
  'wms.print-management': { key: 'sidebar.erpPrinterManagement', fallback: 'Yazıcılar ve Baskı İşleri' },
  'wms.inventory-count': { key: 'sidebar.inventoryCount', fallback: 'Sayım' },
  'wms.reports': { key: 'sidebar.reports', fallback: 'Raporlar' },
  'wms.parameters.gr': { key: 'sidebar.parametersGr', fallback: 'Mal Kabul Parametreleri' },
  'wms.parameters.wt': { key: 'sidebar.parametersWt', fallback: 'Transfer Parametreleri' },
  'wms.parameters.wo': { key: 'sidebar.parametersWo', fallback: 'Depo Çıkış Parametreleri' },
  'wms.parameters.wi': { key: 'sidebar.parametersWi', fallback: 'Depo Giriş Parametreleri' },
  'wms.parameters.sh': { key: 'sidebar.parametersSh', fallback: 'Sevkiyat Parametreleri' },
  'wms.parameters.srt': { key: 'sidebar.parametersSrt', fallback: 'Taşeron Giriş Parametreleri' },
  'wms.parameters.sit': { key: 'sidebar.parametersSit', fallback: 'Taşeron Çıkış Parametreleri' },
  'wms.parameters.pt': { key: 'sidebar.parametersPt', fallback: 'Üretim Transfer Parametreleri' },
  'wms.parameters.pr': { key: 'sidebar.parametersPr', fallback: 'Üretim Parametreleri' },
  'wms.parameters.ic': { key: 'sidebar.parametersIc', fallback: 'Sayım Parametreleri' },
  'wms.parameters.p': { key: 'sidebar.parametersP', fallback: 'Paket Parametreleri' },
  'access-control.user-management': { key: 'sidebar.userManagement', fallback: 'Kullanıcı Yönetimi' },
  'access-control.permission-definitions': { key: 'sidebar.permissionDefinitions', fallback: 'İzin Tanımları' },
  'access-control.permission-groups': { key: 'sidebar.permissionGroups', fallback: 'İzin Grupları' },
  'access-control.user-group-assignments': { key: 'sidebar.userGroupAssignments', fallback: 'Kullanıcı Grup Atamaları' },
  'access-control.wms-scope-policies': { key: 'sidebar.wmsScopePolicies', fallback: 'WMS Kapsam Politikaları' },
  'access-control.wms-scope-assignments': { key: 'sidebar.wmsScopeAssignments', fallback: 'WMS Kapsam Atamaları' },
  'access-control.mail-settings': { key: 'sidebar.mailSettings', fallback: 'Mail Ayarları' },
  'access-control.hangfire-monitoring': { key: 'sidebar.hangfireMonitoring', fallback: 'Hangfire İzleme' },
  'access-control.trace-explorer': { key: 'sidebar.traceExplorer', fallback: 'Trace Explorer' },
};

const ACTION_FALLBACKS: Record<PermissionAction, string> = {
  view: 'Görüntüle',
  create: 'Oluştur',
  update: 'Güncelle',
  delete: 'Sil',
};

function buildCrudPermissionDisplay(
  scope: string,
  meta: PermissionScopeDisplay,
): Record<string, PermissionScopeDisplay> {
  return Object.fromEntries(
    PERMISSION_ACTIONS.map((action) => [
      `${scope}.${action}`,
      {
        key: meta.key,
        fallback: `${meta.fallback} ${ACTION_FALLBACKS[action]}`,
      },
    ]),
  );
}

const CRUD_SCOPE_CODES = Object.keys(PERMISSION_SCOPE_DISPLAY).filter(
  (scope) => scope !== 'dashboard' && scope !== 'wms.reports',
);

export const PERMISSION_CODE_DISPLAY: Record<string, PermissionScopeDisplay> = {
  'dashboard.view': { key: 'sidebar.dashboard', fallback: 'Dashboard' },
  'wms.reports.view': { key: 'sidebar.reports', fallback: 'Raporları Görüntüle' },
  ...Object.fromEntries(
    CRUD_SCOPE_CODES.flatMap((scope) => Object.entries(buildCrudPermissionDisplay(scope, PERMISSION_SCOPE_DISPLAY[scope]))),
  ),
};

export function getPermissionDisplayMeta(code: string): { key: string; fallback: string } | null {
  return PERMISSION_CODE_DISPLAY[code] ?? null;
}

type PermissionTranslateFn = (key: string, fallback?: string) => string;

export function resolvePermissionDisplayLabel(
  code: string,
  name: string | null | undefined,
  translate: PermissionTranslateFn,
): string {
  const meta = getPermissionDisplayMeta(code);
  if (!meta) {
    const trimmedName = (name ?? '').trim();
    return trimmedName || code;
  }

  const scope = getPermissionScope(code);
  const scopeMeta = getPermissionScopeDisplayMeta(scope);
  const parts = code.split('.').filter(Boolean);
  const action = parts[parts.length - 1];
  const isCrudAction = Boolean(action && PERMISSION_ACTIONS.includes(action as PermissionAction));

  if (scopeMeta && isCrudAction) {
    const scopeLabel = translate(scopeMeta.key, scopeMeta.fallback);
    const actionLabel = getPermissionActionLabel(`scope.${action}`);
    const actionText = translate(actionLabel.key, actionLabel.fallback);
    return `${scopeLabel} ${actionText}`;
  }

  return translate(meta.key, meta.fallback);
}

export function getPermissionScope(code: string): string {
  const parts = code.split('.').filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && PERMISSION_ACTIONS.includes(last as PermissionAction)) {
    return parts.slice(0, -1).join('.');
  }
  return code;
}

export function getPermissionScopeDisplayMeta(scope: string): { key: string; fallback: string } | null {
  return PERMISSION_SCOPE_DISPLAY[scope] ?? null;
}

export function getPermissionModuleDisplayMeta(prefix: string): { key: string; fallback: string } | null {
  if (prefix === 'access-control') {
    return { key: 'sidebar.accessControl', fallback: 'Access Control' };
  }
  if (prefix === 'wms') {
    return { key: 'sidebar.dashboard', fallback: 'WMS' };
  }
  if (prefix === 'dashboard') {
    return { key: 'sidebar.dashboard', fallback: 'Dashboard' };
  }
  return null;
}

export function getPermissionActionLabel(code: string): { key: string; fallback: string } {
  const parts = code.split('.').filter(Boolean);
  const action = parts[parts.length - 1];
  switch (action) {
    case 'create':
      return { key: 'common.create', fallback: 'Create' };
    case 'update':
      return { key: 'common.update', fallback: 'Update' };
    case 'delete':
      return { key: 'common.delete', fallback: 'Delete' };
    case 'view':
    default:
      return { key: 'common.view', fallback: 'View' };
  }
}

export const PERMISSION_CODE_CATALOG: string[] = Array.from(
  new Set(
    [...Object.values(ROUTE_PERMISSION_MAP), ...Object.keys(PERMISSION_CODE_DISPLAY)]
      .filter((code) => code && code !== 'admin-only')
      .map((code) => code.trim())
  )
).sort((a, b) => a.localeCompare(b));

export function isPermissionCodeAvailableOnMobile(code: string): boolean {
  return code === 'dashboard.view'
    || code.startsWith('wms.goods-receipt.')
    || code.startsWith('wms.transfer.')
    || code.startsWith('wms.warehouse.inbound.')
    || code.startsWith('wms.warehouse.outbound.')
    || code.startsWith('wms.shipment.')
    || code.startsWith('wms.inventory-count.')
    || code.startsWith('wms.package.');
}

export function getRoutesForPermissionCode(code: string): string[] {
  return Object.entries(ROUTE_PERMISSION_MAP)
    .filter(([, permission]) => permission === code)
    .map(([route]) => route)
    .sort((a, b) => a.localeCompare(b));
}
