import type { ComponentProps, ReactElement } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import ArrowDataTransferHorizontalIcon from '@hugeicons/core-free-icons/ArrowDataTransferHorizontalIcon';
import BoxesIcon from '@hugeicons/core-free-icons/BoxesIcon';
import DashboardCircleIcon from '@hugeicons/core-free-icons/DashboardCircleIcon';
import DeliveryTruck01Icon from '@hugeicons/core-free-icons/DeliveryTruck01Icon';
import Factory01Icon from '@hugeicons/core-free-icons/Factory01Icon';
import HardHatIcon from '@hugeicons/core-free-icons/HardHatIcon';
import PackageReceive01Icon from '@hugeicons/core-free-icons/PackageReceive01Icon';
import SecurityLockIcon from '@hugeicons/core-free-icons/SecurityLockIcon';
import ServerStack01Icon from '@hugeicons/core-free-icons/ServerStack01Icon';
import ShoppingCart01Icon from '@hugeicons/core-free-icons/ShoppingCart01Icon';
import WarehouseIcon from '@hugeicons/core-free-icons/WarehouseIcon';

type Hugeicon = ComponentProps<typeof HugeiconsIcon>['icon'];

const SIDEBAR_ICON_SIZE = 20;
const SIDEBAR_ICON_STROKE = 1.75;

function renderSidebarIcon(icon: Hugeicon): ReactElement {
  return <HugeiconsIcon icon={icon} size={SIDEBAR_ICON_SIZE} strokeWidth={SIDEBAR_ICON_STROKE} />;
}

export const dashboardIcon = renderSidebarIcon(DashboardCircleIcon);
export const procurementIcon = renderSidebarIcon(ShoppingCart01Icon);
export const warehouseOperationsIcon = renderSidebarIcon(WarehouseIcon);
export const warehouseTransferIcon = renderSidebarIcon(ArrowDataTransferHorizontalIcon);
export const productionIcon = renderSidebarIcon(Factory01Icon);
export const kkdIcon = renderSidebarIcon(HardHatIcon);
export const shippingIcon = renderSidebarIcon(DeliveryTruck01Icon);
export const erpIcon = renderSidebarIcon(ServerStack01Icon);
export const goodsReceiptIcon = renderSidebarIcon(PackageReceive01Icon);
export const warehouseManagementIcon = renderSidebarIcon(BoxesIcon);
export const systemIcon = renderSidebarIcon(SecurityLockIcon);
