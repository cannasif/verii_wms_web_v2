import type { ComponentProps, ReactElement } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import Analytics01Icon from '@hugeicons/core-free-icons/Analytics01Icon';
import DashboardSquare01Icon from '@hugeicons/core-free-icons/DashboardSquare01Icon';
import Database01Icon from '@hugeicons/core-free-icons/Database01Icon';
import Layers01Icon from '@hugeicons/core-free-icons/Layers01Icon';
import Package01Icon from '@hugeicons/core-free-icons/Package01Icon';
import SecurityLockIcon from '@hugeicons/core-free-icons/SecurityLockIcon';

type Hugeicon = ComponentProps<typeof HugeiconsIcon>['icon'];

const SIDEBAR_ICON_SIZE = 20;
const SIDEBAR_ICON_STROKE = 1.75;

function renderSidebarIcon(icon: Hugeicon): ReactElement {
  return <HugeiconsIcon icon={icon} size={SIDEBAR_ICON_SIZE} strokeWidth={SIDEBAR_ICON_STROKE} />;
}

export const dashboardIcon = renderSidebarIcon(DashboardSquare01Icon);
export const operationsIcon = renderSidebarIcon(Layers01Icon);
export const inventoryIcon = renderSidebarIcon(Package01Icon);
export const analyticsIcon = renderSidebarIcon(Analytics01Icon);
export const masterDataIcon = renderSidebarIcon(Database01Icon);
export const systemIcon = renderSidebarIcon(SecurityLockIcon);
