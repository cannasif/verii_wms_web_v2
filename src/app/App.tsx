import { lazy, Suspense, type ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/components/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/components/ResetPasswordPage';
import { DashboardPage } from '@/features/dashboard/components/DashboardPage';
import { OpsRouteLoadingState } from '@/components/shared/OpsRouteLoadingState';
import {
  loadAppLayout, loadAuditLogsPage, loadBarcodeDesignerPage, loadBarcodePolicyPage, loadDocumentSeriesPage,
  loadELogoConnectionsPage, loadErpMirrorPages, loadGoodsReceiptAssignedTasksPage, loadGoodsReceiptCreatePage, loadGoodsReceiptHubPage,
  loadGoodsReceiptLabelsPage, loadGoodsReceiptListPage, loadGoodsReceiptManualPage, loadGoodsReceiptPolicyPage,
  loadHangfirePage, loadIncomingInvoiceArchivePage, loadLocationDefinitionsPage, loadPermissionGroupsPage, loadPermissionsPage, loadProfilePage,
  loadKkdPages,
  loadProjectSettingsPage, loadQualityDecisionCodesPage, loadQualityInspectionsPage, loadQualityReportsPage, loadQualityRulesPage, loadQualitySettingsPage,
  loadProductionPages, loadGeneratorProductionPages, loadProductionTransferPages, loadSubcontractingTransferPages,
  loadProcurementPage,
  loadSupplierQuoteEntryPage,
  loadSupplierQuotePortalPage,
  loadSerialNumberRulesPage, loadShippingCreatePage, loadShippingHubPage, loadShippingListPage,
  loadShippingOperationPage, loadShippingPolicyPage, loadSmtpSettingsPage, loadSteelReceiptHubPage,
  loadSupplierStockMappingsPage,
  loadSteelReceiptImportPage, loadSteelReceiptInspectionPage, loadSteelReceiptOperationsPage,
  loadSteelReceiptPlansPage, loadSteelReceiptReportsPage, loadStockBalancePages, loadStockMovementsPage, loadUserManagementPage, loadWarehouseAssistantPage,
  loadVehicleCheckInListPage, loadVehicleCheckInPage, loadWarehouseTransferDraftPage,
  loadWarehouseTransferCreateHubPage, loadWarehouseTransferHubPage, loadWarehouseTransferListPage, loadWarehouseTransferOperationPage,
  loadWarehouseTransferPolicyPage,
  loadInventoryCountPage,
  loadProcessParametersHubPage,
} from './route-loaders';

import {
  loadWarehouseInboundCreatePage, loadWarehouseInboundHubPage, loadWarehouseInboundLabelsPage,
  loadWarehouseInboundListPage, loadWarehouseInboundManualPage, loadWarehouseInboundPolicyPage,
  loadWarehouseInboundTasksPage, loadWarehouseOutboundCreatePage, loadWarehouseOutboundHubPage,
  loadWarehouseOutboundListPage, loadWarehouseOutboundOperationPage, loadWarehouseOutboundPolicyPage,
  loadPackingPages,
} from './route-loaders';
const AppLayout = lazy(() => loadAppLayout().then((m) => ({ default: m.AppLayout })));
const ProfilePage = lazy(() => loadProfilePage().then((m) => ({ default: m.ProfilePage })));
const CustomerMirrorPage = lazy(() => loadErpMirrorPages().then((m) => ({ default: m.CustomerMirrorPage })));
const StockMirrorPage = lazy(() => loadErpMirrorPages().then((m) => ({ default: m.StockMirrorPage })));
const WarehouseMirrorPage = lazy(() => loadErpMirrorPages().then((m) => ({ default: m.WarehouseMirrorPage })));
const ConfigurationCodeMirrorPage = lazy(() => loadErpMirrorPages().then((m) => ({ default: m.ConfigurationCodeMirrorPage })));
const UserManagementPage = lazy(() => loadUserManagementPage().then((m) => ({ default: m.UserManagementPage })));
const PermissionGroupsPage = lazy(() => loadPermissionGroupsPage().then((m) => ({ default: m.PermissionGroupsPage })));
const AuditLogsPage = lazy(() => loadAuditLogsPage().then((m) => ({ default: m.AuditLogsPage })));
const PermissionsPage = lazy(() => loadPermissionsPage().then((m) => ({ default: m.PermissionsPage })));
const SmtpSettingsPage = lazy(() => loadSmtpSettingsPage().then((m) => ({ default: m.SmtpSettingsPage })));
const HangfirePage = lazy(() => loadHangfirePage().then((m) => ({ default: m.HangfirePage })));
const LocationDefinitionsPage = lazy(() => loadLocationDefinitionsPage().then((m) => ({ default: m.LocationDefinitionsPage })));
const StockMovementsPage = lazy(() => loadStockMovementsPage().then((m) => ({ default: m.StockMovementsPage })));
const LocationBalancesPage = lazy(() => loadStockBalancePages().then((m) => ({ default: m.LocationBalancesPage })));
const SerialBalancesPage = lazy(() => loadStockBalancePages().then((m) => ({ default: m.SerialBalancesPage })));
const WarehouseBalancesPage = lazy(() => loadStockBalancePages().then((m) => ({ default: m.WarehouseBalancesPage })));
const WarehouseAssistantPage = lazy(() => loadWarehouseAssistantPage().then((m) => ({ default: m.WarehouseAssistantPage })));
const ProjectSettingsPage = lazy(() => loadProjectSettingsPage().then((m) => ({ default: m.ProjectSettingsPage })));
const ProcessParametersHubPage = lazy(() => loadProcessParametersHubPage().then((m) => ({ default: m.ProcessParametersHubPage })));
const ProcessParametersIndexRedirect = lazy(() => loadProcessParametersHubPage().then((m) => ({ default: m.ProcessParametersIndexRedirect })));
const DocumentSeriesPage = lazy(() => loadDocumentSeriesPage().then((m) => ({ default: m.DocumentSeriesPage })));
const BarcodeDesignerPage = lazy(() => loadBarcodeDesignerPage().then((m) => ({ default: m.BarcodeDesignerPage })));
const BarcodePolicyPage = lazy(() => loadBarcodePolicyPage().then((m) => ({ default: m.BarcodePolicyPage })));
const IncomingInvoiceArchivePage = lazy(() => loadIncomingInvoiceArchivePage().then((m) => ({ default: m.IncomingInvoiceArchivePage })));
const ELogoConnectionsPage = lazy(() => loadELogoConnectionsPage().then((m) => ({ default: m.ELogoConnectionsPage })));
const SupplierStockMappingsPage = lazy(() => loadSupplierStockMappingsPage().then((m) => ({ default: m.SupplierStockMappingsPage })));
const KkdOverviewPage = lazy(() => loadKkdPages().then((m) => ({ default: m.KkdOverviewPage })));
const KkdDefinitionsPage = lazy(() => loadKkdPages().then((m) => ({ default: m.KkdDefinitionsPage })));
const KkdEntitlementPage = lazy(() => loadKkdPages().then((m) => ({ default: m.KkdEntitlementPage })));
const KkdDistributionsPage = lazy(() => loadKkdPages().then((m) => ({ default: m.KkdDistributionsPage })));
const KkdDistributionCreatePage = lazy(() => loadKkdPages().then((m) => ({ default: m.KkdDistributionCreatePage })));
const KkdMaterialRequestsPage = lazy(() => loadKkdPages().then((m) => ({ default: m.KkdMaterialRequestsPage })));
const KkdRequestsPage = lazy(() => loadKkdPages().then((m) => ({ default: m.KkdRequestsPage })));
const KkdPreparationPickingPage = lazy(() => loadKkdPages().then((m) => ({ default: m.KkdPreparationPickingPage })));
const KkdReportsPage = lazy(() => loadKkdPages().then((m) => ({ default: m.KkdReportsPage })));
const KkdPolicyPage = lazy(() => loadKkdPages().then((m) => ({ default: m.KkdPolicyPage })));
const GoodsReceiptAssignedTasksPage = lazy(() => loadGoodsReceiptAssignedTasksPage().then((m) => ({ default: m.GoodsReceiptAssignedTasksPage })));
const GoodsReceiptTasksPage = lazy(() => loadGoodsReceiptAssignedTasksPage().then((m) => ({ default: m.GoodsReceiptTasksPage })));
const GoodsReceiptCreatePage = lazy(() => loadGoodsReceiptCreatePage().then((m) => ({ default: m.GoodsReceiptCreatePage })));
const GoodsReceiptSuccessPreviewPage = lazy(() => loadGoodsReceiptCreatePage().then((m) => ({ default: m.GoodsReceiptSuccessPreviewPage })));
const GoodsReceiptDirectPage = lazy(() => loadGoodsReceiptManualPage().then((m) => ({ default: m.GoodsReceiptDirectPage })));
const GoodsReceiptImportPage = lazy(() => loadGoodsReceiptManualPage().then((m) => ({ default: m.GoodsReceiptImportPage })));
const GoodsReceiptOrderlessPage = lazy(() => loadGoodsReceiptManualPage().then((m) => ({ default: m.GoodsReceiptOrderlessPage })));
const GoodsReceiptHubPage = lazy(() => loadGoodsReceiptHubPage().then((m) => ({ default: m.GoodsReceiptHubPage })));
const GoodsReceiptLabelsPage = lazy(() => loadGoodsReceiptLabelsPage().then((m) => ({ default: m.GoodsReceiptLabelsPage })));
const GoodsReceiptListPage = lazy(() => loadGoodsReceiptListPage().then((m) => ({ default: m.GoodsReceiptListPage })));
const GoodsReceiptPolicyPage = lazy(() => loadGoodsReceiptPolicyPage().then((m) => ({ default: m.GoodsReceiptPolicyPage })));
const QualityInspectionsPage = lazy(() => loadQualityInspectionsPage().then((m) => ({ default: m.QualityInspectionsPage })));
const QualityQuarantinePage = lazy(() => loadQualityInspectionsPage().then((m) => ({ default: m.QualityQuarantinePage })));
const QualityRulesPage = lazy(() => loadQualityRulesPage().then((m) => ({ default: m.QualityRulesPage })));
const QualityDecisionCodesPage = lazy(() => loadQualityDecisionCodesPage().then((m) => ({ default: m.QualityDecisionCodesPage })));
const QualitySettingsPage = lazy(() => loadQualitySettingsPage().then((m) => ({ default: m.QualitySettingsPage })));
const QualityReportsPage = lazy(() => loadQualityReportsPage().then((m) => ({ default: m.QualityReportsPage })));
const SerialNumberRulesPage = lazy(() => loadSerialNumberRulesPage().then((m) => ({ default: m.SerialNumberRulesPage })));
const SteelReceiptHubPage = lazy(() => loadSteelReceiptHubPage().then((m) => ({ default: m.SteelReceiptHubPage })));
const SteelReceiptImportPage = lazy(() => loadSteelReceiptImportPage().then((m) => ({ default: m.SteelReceiptImportPage })));
const SteelReceiptPlansPage = lazy(() => loadSteelReceiptPlansPage().then((m) => ({ default: m.SteelReceiptPlansPage })));
const SteelReceiptInspectionPage = lazy(() => loadSteelReceiptInspectionPage().then((m) => ({ default: m.SteelReceiptInspectionPage })));
const SteelReceiptOperationsPage = lazy(() => loadSteelReceiptOperationsPage().then((m) => ({ default: m.SteelReceiptOperationsPage })));
const SteelReceiptReportsPage = lazy(() => loadSteelReceiptReportsPage().then((m) => ({ default: m.SteelReceiptReportsPage })));
const VehicleCheckInListPage = lazy(() => loadVehicleCheckInListPage().then((m) => ({ default: m.VehicleCheckInListPage })));
const VehicleCheckInPage = lazy(() => loadVehicleCheckInPage().then((m) => ({ default: m.VehicleCheckInPage })));
const WarehouseTransferDraftPage = lazy(() => loadWarehouseTransferDraftPage().then((m) => ({ default: m.WarehouseTransferDraftPage })));
const WarehouseTransferHubPage = lazy(() => loadWarehouseTransferHubPage().then((m) => ({ default: m.WarehouseTransferHubPage })));
const WarehouseTransferCreateHubPage = lazy(() => loadWarehouseTransferCreateHubPage().then((m) => ({ default: m.WarehouseTransferCreateHubPage })));
const WarehouseTransferListPage = lazy(() => loadWarehouseTransferListPage().then((m) => ({ default: m.WarehouseTransferListPage })));
const WarehouseTransferPolicyPage = lazy(() => loadWarehouseTransferPolicyPage().then((m) => ({ default: m.WarehouseTransferPolicyPage })));
const WarehouseTransferOperationPage = lazy(() => loadWarehouseTransferOperationPage().then((m) => ({ default: m.WarehouseTransferOperationPage })));
const ProductionTransferHubPage = lazy(() => loadProductionTransferPages().then((m) => ({ default: m.ProductionTransferHubPage })));
const ProductionTransferDraftPage = lazy(() => loadProductionTransferPages().then((m) => ({ default: m.ProductionTransferDraftPage })));
const ProductionTransferListPage = lazy(() => loadProductionTransferPages().then((m) => ({ default: m.ProductionTransferListPage })));
const ProductionTransferPolicyPage = lazy(() => loadProductionTransferPages().then((m) => ({ default: m.ProductionTransferPolicyPage })));
const ProductionTransferOperationPage = lazy(() => loadProductionTransferPages().then((m) => ({ default: m.ProductionTransferOperationPage })));
const ProductionTransferTaskPoolPage = lazy(() => loadProductionTransferPages().then((m) => ({ default: m.ProductionTransferTaskPoolPage })));
const ProductionHubPage = lazy(() => loadProductionPages().then((m) => ({ default: m.ProductionHubPage })));
const GeneratorProductionHubPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionHubPage })));
const GeneratorProductionProjectsPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionProjectsPage })));
const GeneratorProductionProjectListPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionProjectListPage })));
const GeneratorProductionProjectCreatePage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionProjectCreatePage })));
const GeneratorProductionProjectDetailPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionProjectDetailPage })));
const GeneratorProductionScenarioPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionScenarioPage })));
const GeneratorProductionAssistantPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionAssistantPage })));
const GeneratorProductionGanttPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionGanttPage })));
const GeneratorProductionAndonPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionAndonPage })));
const GeneratorProductionDefinitionsPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionDefinitionsPage })));
const GeneratorProductionDefinitionsHubPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionDefinitionsHubPage })));
const GeneratorProductionParametersPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionParametersPage })));
const GeneratorProductionStationsPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionStationsPage })));
const GeneratorProductionRoutesPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionRoutesPage })));
const GeneratorProductionProductsPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionProductsPage })));
const GeneratorProductionCalendarPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionCalendarPage })));
const GeneratorProductionResourcesPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionResourcesPage })));
const GeneratorProductionRulesPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionRulesPage })));
const GeneratorProductionStationBoardPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionStationBoardPage })));
const GeneratorProductionFactoryMapPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionFactoryMapPage })));
const GeneratorProductionMaterialControlPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionMaterialControlPage })));
const GeneratorProductionOutboundPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionOutboundPage })));
const GeneratorProductionReportsPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionReportsPage })));
const GeneratorProductionRevisionsPage = lazy(() => loadGeneratorProductionPages().then((m) => ({ default: m.GeneratorProductionRevisionsPage })));
const ProcurementHubPage = lazy(() => loadProcurementPage().then((m) => ({ default: m.ProcurementHubPage })));
const ProcurementRequestsPage = lazy(() => loadProcurementPage().then((m) => ({ default: m.ProcurementRequestsPage })));
const ProcurementRfqsPage = lazy(() => loadProcurementPage().then((m) => ({ default: m.ProcurementRfqsPage })));
const ProcurementQuotesPage = lazy(() => loadProcurementPage().then((m) => ({ default: m.ProcurementQuotesPage })));
const ProcurementOrdersPage = lazy(() => loadProcurementPage().then((m) => ({ default: m.ProcurementOrdersPage })));
const SupplierQuoteEntryPage = lazy(() => loadSupplierQuoteEntryPage().then((m) => ({ default: m.SupplierQuoteEntryPage })));
const SupplierQuotePortalPage = lazy(() => loadSupplierQuotePortalPage().then((m) => ({ default: m.SupplierQuotePortalPage })));
const ProductionCreatePage = lazy(() => loadProductionPages().then((m) => ({ default: m.ProductionCreatePage })));
const ProductionListPage = lazy(() => loadProductionPages().then((m) => ({ default: m.ProductionListPage })));
const ProductionWorkOrdersPage = lazy(() => loadProductionPages().then((m) => ({ default: m.ProductionWorkOrdersPage })));
const SubcontractingTransferHubPage = lazy(() => loadSubcontractingTransferPages().then((m) => ({ default: m.SubcontractingTransferHubPage })));
const SubcontractingTransferDraftPage = lazy(() => loadSubcontractingTransferPages().then((m) => ({ default: m.SubcontractingTransferDraftPage })));
const SubcontractingTransferListPage = lazy(() => loadSubcontractingTransferPages().then((m) => ({ default: m.SubcontractingTransferListPage })));
const SubcontractingTransferPolicyPage = lazy(() => loadSubcontractingTransferPages().then((m) => ({ default: m.SubcontractingTransferPolicyPage })));
const SubcontractingTransferOperationPage = lazy(() => loadSubcontractingTransferPages().then((m) => ({ default: m.SubcontractingTransferOperationPage })));
const SubcontractingIssueDraftPage = lazy(() => loadSubcontractingTransferPages().then((m) => ({ default: m.SubcontractingIssueDraftPage })));
const SubcontractingIssueListPage = lazy(() => loadSubcontractingTransferPages().then((m) => ({ default: m.SubcontractingIssueListPage })));
const SubcontractingReceiptDraftPage = lazy(() => loadSubcontractingTransferPages().then((m) => ({ default: m.SubcontractingReceiptDraftPage })));
const SubcontractingReceiptListPage = lazy(() => loadSubcontractingTransferPages().then((m) => ({ default: m.SubcontractingReceiptListPage })));
const ShippingCreatePage = lazy(() => loadShippingCreatePage().then((m) => ({ default: m.ShippingCreatePage })));
const ShippingHubPage = lazy(() => loadShippingHubPage().then((m) => ({ default: m.ShippingHubPage })));
const ShippingListPage = lazy(() => loadShippingListPage().then((m) => ({ default: m.ShippingListPage })));
const ShippingPolicyPage = lazy(() => loadShippingPolicyPage().then((m) => ({ default: m.ShippingPolicyPage })));
const ShippingOperationPage = lazy(() => loadShippingOperationPage().then((m) => ({ default: m.ShippingOperationPage })));

const WarehouseInboundCreatePage = lazy(() => loadWarehouseInboundCreatePage().then((m) => ({ default: m.WarehouseInboundCreatePage })));
const WarehouseInboundDirectPage = lazy(() => loadWarehouseInboundManualPage().then((m) => ({ default: m.WarehouseInboundDirectPage })));
const WarehouseInboundOrderlessPage = lazy(() => loadWarehouseInboundManualPage().then((m) => ({ default: m.WarehouseInboundOrderlessPage })));
const WarehouseInboundHubPage = lazy(() => loadWarehouseInboundHubPage().then((m) => ({ default: m.WarehouseInboundHubPage })));
const WarehouseInboundLabelsPage = lazy(() => loadWarehouseInboundLabelsPage().then((m) => ({ default: m.WarehouseInboundLabelsPage })));
const WarehouseInboundListPage = lazy(() => loadWarehouseInboundListPage().then((m) => ({ default: m.WarehouseInboundListPage })));
const WarehouseInboundTasksPage = lazy(() => loadWarehouseInboundTasksPage().then((m) => ({ default: m.WarehouseInboundTasksPage })));
const WarehouseInboundAssignedTasksPage = lazy(() => loadWarehouseInboundTasksPage().then((m) => ({ default: m.WarehouseInboundAssignedTasksPage })));
const WarehouseInboundPolicyPage = lazy(() => loadWarehouseInboundPolicyPage().then((m) => ({ default: m.WarehouseInboundPolicyPage })));
const WarehouseOutboundCreatePage = lazy(() => loadWarehouseOutboundCreatePage().then((m) => ({ default: m.WarehouseOutboundCreatePage })));
const WarehouseOutboundHubPage = lazy(() => loadWarehouseOutboundHubPage().then((m) => ({ default: m.WarehouseOutboundHubPage })));
const WarehouseOutboundListPage = lazy(() => loadWarehouseOutboundListPage().then((m) => ({ default: m.WarehouseOutboundListPage })));
const WarehouseOutboundPolicyPage = lazy(() => loadWarehouseOutboundPolicyPage().then((m) => ({ default: m.WarehouseOutboundPolicyPage })));
const WarehouseOutboundOperationPage = lazy(() => loadWarehouseOutboundOperationPage().then((m) => ({ default: m.WarehouseOutboundOperationPage })));
const PackingWorkbenchPage = lazy(() => loadPackingPages().then((m) => ({ default: m.PackingWorkbenchPage })));
const PackingDefinitionsPage = lazy(() => loadPackingPages().then((m) => ({ default: m.PackingDefinitionsPage })));
const PackingPolicyPage = lazy(() => loadPackingPages().then((m) => ({ default: m.PackingPolicyPage })));
const InventoryCountPage = lazy(() => loadInventoryCountPage().then((m) => ({ default: m.InventoryCountPage })));
function Dashboard(): ReactElement {
  return <DashboardPage />;
}

function AccessDenied(): ReactElement {
  const { t } = useTranslation('common');

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-amber-500/30 bg-[var(--wms-app-panel)] p-8 text-center shadow-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-500">403</p>
      <h1 className="mt-2 text-2xl font-bold">{t('common.accessDenied')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('common.accessDeniedMessage')}</p>
    </section>
  );
}

export function App(): ReactElement {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/supplier/quotes/:token" element={<SupplierQuotePortalPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="access-denied" element={<AccessDenied />} />
          <Route path="erp/warehouses" element={<WarehouseMirrorPage />} />
          <Route path="erp/stocks" element={<StockMirrorPage />} />
          <Route path="erp/customers" element={<CustomerMirrorPage />} />
          <Route path="erp/configuration-codes" element={<ConfigurationCodeMirrorPage />} />
          <Route path="erp/yapkodlar" element={<Navigate to="/erp/configuration-codes" replace />} />
          <Route path="warehouse/warehouse-inbounds" element={<WarehouseInboundHubPage />} />
          <Route path="warehouse/warehouse-inbounds/new" element={<WarehouseInboundCreatePage />} />
          <Route path="warehouse/warehouse-inbounds/orderless" element={<WarehouseInboundOrderlessPage />} />
          <Route path="warehouse/warehouse-inbounds/direct" element={<WarehouseInboundDirectPage />} />
          <Route path="warehouse/warehouse-inbounds/list" element={<WarehouseInboundListPage />} />
          <Route path="warehouse/warehouse-inbounds/tasks" element={<WarehouseInboundTasksPage />} />
          <Route path="warehouse/warehouse-inbounds/assigned" element={<WarehouseInboundAssignedTasksPage />} />
          <Route path="warehouse/warehouse-inbounds/labels" element={<WarehouseInboundLabelsPage />} />
          <Route path="warehouse/warehouse-inbounds/settings" element={<Navigate to="/warehouse/process-parameters/inbound" replace />} />
          <Route path="warehouse/warehouse-outbounds" element={<WarehouseOutboundHubPage />} />
          <Route path="warehouse/warehouse-outbounds/new" element={<WarehouseOutboundCreatePage />} />
          <Route path="warehouse/warehouse-outbounds/list" element={<WarehouseOutboundListPage />} />
          <Route path="warehouse/warehouse-outbounds/:id/operations" element={<WarehouseOutboundOperationPage />} />
          <Route path="warehouse/warehouse-outbounds/settings" element={<Navigate to="/warehouse/process-parameters/outbound" replace />} />
          <Route path="warehouse/locations" element={<LocationDefinitionsPage />} />
          <Route path="warehouse/kkd" element={<KkdOverviewPage />} />
          <Route path="warehouse/kkd/definitions" element={<KkdDefinitionsPage />} />
          <Route path="warehouse/kkd/entitlement" element={<KkdEntitlementPage />} />
          <Route path="warehouse/kkd/requests" element={<KkdRequestsPage />} />
          <Route path="warehouse/kkd/requests/:requestId/preparation-tasks/:taskId/pick" element={<KkdPreparationPickingPage />} />
          <Route path="warehouse/kkd/distributions" element={<KkdDistributionsPage />} />
          <Route path="warehouse/kkd/distributions/new" element={<KkdDistributionCreatePage />} />
          <Route path="warehouse/production-transfers/material-requests" element={<KkdMaterialRequestsPage />} />
          <Route path="warehouse/kkd/reports" element={<KkdReportsPage />} />
          <Route path="warehouse/kkd/policy" element={<Navigate to="/warehouse/process-parameters/kkd-policy" replace />} />
          <Route path="warehouse/packing" element={<PackingWorkbenchPage />} />
          <Route path="warehouse/packing/definitions" element={<PackingDefinitionsPage />} />
          <Route path="warehouse/packing/settings" element={<Navigate to="/warehouse/process-parameters/packing" replace />} />
          <Route path="warehouse/inventory-counts" element={<InventoryCountPage />} />
          <Route path="warehouse/transfers" element={<WarehouseTransferHubPage />} />
          <Route path="warehouse/transfers/new" element={<WarehouseTransferDraftPage />} />
          <Route path="warehouse/transfers/new-operation" element={<WarehouseTransferCreateHubPage />} />
          <Route path="warehouse/transfers/list" element={<WarehouseTransferListPage />} />
          <Route path="warehouse/transfers/:id/operations" element={<WarehouseTransferOperationPage />} />
          <Route path="warehouse/transfers/settings" element={<Navigate to="/warehouse/process-parameters/transfer" replace />} />
          <Route path="warehouse/production" element={<ProductionHubPage />} />
          <Route path="warehouse/production/generator" element={<GeneratorProductionHubPage />} />
          <Route path="warehouse/production/generator/projects" element={<GeneratorProductionProjectListPage />} />
          <Route path="warehouse/production/generator/projects/new" element={<GeneratorProductionProjectCreatePage />} />
          <Route path="warehouse/production/generator/projects/:id" element={<GeneratorProductionProjectDetailPage />} />
          <Route path="warehouse/production/generator/planning" element={<GeneratorProductionProjectsPage />} />
          <Route path="warehouse/production/generator/scenarios" element={<GeneratorProductionScenarioPage />} />
          <Route path="warehouse/production/generator/assistant" element={<GeneratorProductionAssistantPage />} />
          <Route path="warehouse/production/generator/gantt" element={<div className="gp-page--gantt"><GeneratorProductionGanttPage /></div>} />
          <Route path="warehouse/production/generator/revisions" element={<GeneratorProductionRevisionsPage />} />
          <Route path="warehouse/production/generator/station-board" element={<div className="gp-page--live"><GeneratorProductionStationBoardPage /></div>} />
          <Route path="warehouse/production/generator/factory-map" element={<GeneratorProductionFactoryMapPage />} />
          <Route path="warehouse/production/generator/andon" element={<div className="gp-page--live"><GeneratorProductionAndonPage /></div>} />
          <Route path="warehouse/production/generator/materials" element={<GeneratorProductionMaterialControlPage />} />
          <Route path="warehouse/production/generator/outbound" element={<GeneratorProductionOutboundPage />} />
          <Route path="warehouse/production/generator/reports" element={<GeneratorProductionReportsPage />} />
          <Route path="warehouse/production/generator/definitions" element={<GeneratorProductionDefinitionsHubPage />} />
          <Route path="warehouse/production/generator/definitions/parameters" element={<GeneratorProductionParametersPage />} />
          <Route path="warehouse/production/generator/definitions/all" element={<GeneratorProductionDefinitionsPage />} />
          <Route path="warehouse/production/generator/definitions/stations" element={<GeneratorProductionStationsPage />} />
          <Route path="warehouse/production/generator/definitions/routes" element={<GeneratorProductionRoutesPage />} />
          <Route path="warehouse/production/generator/definitions/products" element={<GeneratorProductionProductsPage />} />
          <Route path="warehouse/production/generator/definitions/calendar" element={<GeneratorProductionCalendarPage />} />
          <Route path="warehouse/production/generator/definitions/resources" element={<GeneratorProductionResourcesPage />} />
          <Route path="warehouse/production/generator/definitions/rules" element={<GeneratorProductionRulesPage />} />
          <Route path="procurement" element={<ProcurementHubPage />} />
          <Route path="procurement/requests" element={<ProcurementRequestsPage />} />
          <Route path="procurement/rfqs" element={<ProcurementRfqsPage />} />
          <Route path="procurement/quotes" element={<ProcurementQuotesPage />} />
          <Route path="procurement/quotes/new" element={<SupplierQuoteEntryPage />} />
          <Route path="procurement/orders" element={<ProcurementOrdersPage />} />
          <Route path="warehouse/production/new" element={<ProductionCreatePage />} />
          <Route path="warehouse/production/list" element={<ProductionListPage />} />
          <Route path="warehouse/production/work-orders" element={<ProductionWorkOrdersPage />} />
          <Route path="warehouse/production-transfers" element={<ProductionTransferHubPage />} />
          <Route path="warehouse/production-transfers/new" element={<ProductionTransferDraftPage />} />
          <Route path="warehouse/production-transfers/list" element={<ProductionTransferListPage />} />
          <Route path="warehouse/production-transfers/task-pool" element={<ProductionTransferTaskPoolPage />} />
          <Route path="warehouse/production-transfers/:id/operations" element={<ProductionTransferOperationPage />} />
          <Route path="warehouse/production-transfers/settings" element={<Navigate to="/warehouse/process-parameters/production-transfer" replace />} />
          <Route path="warehouse/subcontracting-transfers" element={<SubcontractingTransferHubPage />} />
          <Route path="warehouse/subcontracting-transfers/new" element={<SubcontractingTransferDraftPage />} />
          <Route path="warehouse/subcontracting-transfers/list" element={<SubcontractingTransferListPage />} />
          <Route path="warehouse/subcontracting-transfers/:id/operations" element={<SubcontractingTransferOperationPage />} />
          <Route path="warehouse/subcontracting-transfers/settings" element={<Navigate to="/warehouse/process-parameters/subcontracting" replace />} />
          <Route path="warehouse/subcontracting-transfers/issue/new" element={<SubcontractingIssueDraftPage />} />
          <Route path="warehouse/subcontracting-transfers/issue/list" element={<SubcontractingIssueListPage />} />
          <Route path="warehouse/subcontracting-transfers/receipt/new" element={<SubcontractingReceiptDraftPage />} />
          <Route path="warehouse/subcontracting-transfers/receipt/list" element={<SubcontractingReceiptListPage />} />
          <Route path="warehouse/shipments" element={<ShippingHubPage />} />
          <Route path="warehouse/shipments/new" element={<ShippingCreatePage />} />
          <Route path="warehouse/shipments/list" element={<ShippingListPage />} />
          <Route path="warehouse/shipments/:id/operations" element={<ShippingOperationPage />} />
          <Route path="warehouse/shipments/settings" element={<Navigate to="/warehouse/process-parameters/shipping" replace />} />
          <Route path="warehouse/goods-receipts" element={<GoodsReceiptHubPage />} />
          <Route path="warehouse/goods-receipts/new" element={<GoodsReceiptCreatePage />} />
          <Route path="warehouse/goods-receipts/orderless" element={<GoodsReceiptOrderlessPage />} />
          <Route path="warehouse/goods-receipts/direct" element={<GoodsReceiptDirectPage />} />
          <Route path="warehouse/goods-receipts/import" element={<GoodsReceiptImportPage />} />
          <Route path="warehouse/goods-receipts/success-preview" element={<GoodsReceiptSuccessPreviewPage />} />
          <Route path="warehouse/goods-receipts/list" element={<GoodsReceiptListPage />} />
          <Route path="warehouse/incoming-invoices" element={<IncomingInvoiceArchivePage />} />
          <Route path="warehouse/incoming-invoices/connections" element={<ELogoConnectionsPage />} />
          <Route path="warehouse/goods-receipts/supplier-stock-mappings" element={<SupplierStockMappingsPage />} />
          <Route path="warehouse/goods-receipts/tasks" element={<GoodsReceiptTasksPage />} />
          <Route path="warehouse/goods-receipts/assigned" element={<GoodsReceiptAssignedTasksPage />} />
          <Route path="warehouse/goods-receipts/labels" element={<GoodsReceiptLabelsPage />} />
          <Route path="warehouse/goods-receipts/steel" element={<SteelReceiptHubPage />} />
          <Route path="warehouse/goods-receipts/steel/vehicle-check-in" element={<VehicleCheckInPage />} />
          <Route path="warehouse/goods-receipts/steel/vehicle-check-ins" element={<VehicleCheckInListPage />} />
          <Route path="warehouse/goods-receipts/steel/import" element={<SteelReceiptImportPage />} />
          <Route path="warehouse/goods-receipts/steel/plans" element={<SteelReceiptPlansPage />} />
          <Route path="warehouse/goods-receipts/steel/inspection" element={<SteelReceiptInspectionPage />} />
          <Route path="warehouse/goods-receipts/steel/operations" element={<SteelReceiptOperationsPage />} />
          <Route path="warehouse/goods-receipts/steel/receipt" element={<SteelReceiptOperationsPage initialTab="receipt" />} />
          <Route path="warehouse/goods-receipts/steel/placement" element={<SteelReceiptOperationsPage initialTab="placement" />} />
          <Route path="warehouse/goods-receipts/steel/reports" element={<SteelReceiptReportsPage />} />
          <Route path="warehouse/goods-receipt-settings" element={<Navigate to="/warehouse/process-parameters/goods-receipt" replace />} />
          <Route path="warehouse/quality/settings" element={<Navigate to="/warehouse/process-parameters/quality" replace />} />
          <Route path="warehouse/quality/rules" element={<QualityRulesPage />} />
          <Route path="warehouse/quality/decision-codes" element={<QualityDecisionCodesPage />} />
          <Route path="warehouse/quality/inspections" element={<QualityInspectionsPage />} />
          <Route path="warehouse/quality/reports" element={<QualityReportsPage />} />
          <Route path="warehouse/quality/quarantine" element={<QualityQuarantinePage />} />
          <Route path="warehouse/stock-movements" element={<StockMovementsPage />} />
          <Route path="warehouse/location-balances" element={<LocationBalancesPage />} />
          <Route path="warehouse/stock-balances" element={<WarehouseBalancesPage />} />
          <Route path="warehouse/serial-balances" element={<SerialBalancesPage />} />
          <Route path="warehouse/assistant" element={<WarehouseAssistantPage />} />
          <Route path="warehouse/serial-number-rules" element={<SerialNumberRulesPage />} />
          <Route path="warehouse/stock-tracking-policies" element={<Navigate to="/erp/stocks" replace />} />
          <Route path="warehouse/document-series" element={<Navigate to="/warehouse/process-parameters/document-series" replace />} />
          <Route path="warehouse/process-parameters" element={<ProcessParametersHubPage />}>
            <Route index element={<ProcessParametersIndexRedirect />} />
            <Route path="goods-receipt" element={<GoodsReceiptPolicyPage />} />
            <Route path="inbound" element={<WarehouseInboundPolicyPage />} />
            <Route path="outbound" element={<WarehouseOutboundPolicyPage />} />
            <Route path="transfer" element={<WarehouseTransferPolicyPage />} />
            <Route path="subcontracting" element={<SubcontractingTransferPolicyPage />} />
            <Route path="production-transfer" element={<ProductionTransferPolicyPage />} />
            <Route path="shipping" element={<ShippingPolicyPage />} />
            <Route path="quality" element={<QualitySettingsPage />} />
            <Route path="packing" element={<PackingPolicyPage />} />
            <Route path="document-series" element={<DocumentSeriesPage />} />
            <Route path="barcode-designer" element={<BarcodeDesignerPage />} />
            <Route path="barcode-policy" element={<BarcodePolicyPage />} />
            <Route path="kkd-policy" element={<KkdPolicyPage />} />
          </Route>
          <Route path="warehouse/barcode-designer" element={<Navigate to="/warehouse/process-parameters/barcode-designer" replace />} />
          <Route path="warehouse/barcode-policy" element={<Navigate to="/warehouse/process-parameters/barcode-policy" replace />} />
          <Route path="warehouse/barcode-rules" element={<Navigate to="/warehouse/process-parameters/barcode-policy" replace />} />
          <Route path="system/users" element={<UserManagementPage />} />
          <Route path="system/permissions" element={<PermissionsPage />} />
          <Route path="system/permission-groups" element={<PermissionGroupsPage />} />
          <Route path="system/audit-logs" element={<AuditLogsPage />} />
          <Route path="system/smtp" element={<SmtpSettingsPage />} />
          <Route path="system/hangfire" element={<HangfirePage />} />
          <Route path="system/project-settings" element={<ProjectSettingsPage />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function RouteLoader(): ReactElement {
  const { t } = useTranslation('common');

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--wms-app-background)] p-6">
      <OpsRouteLoadingState message={t('common.loading')} code="BOOT" />
    </div>
  );
}
