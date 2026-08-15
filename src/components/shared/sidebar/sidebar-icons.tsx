import type { ComponentProps, ReactElement } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import HardHatIcon from '@hugeicons/core-free-icons/HardHatIcon';
import ShoppingCart01Icon from '@hugeicons/core-free-icons/ShoppingCart01Icon';
import { useTheme } from '@/components/theme-provider';
import dashboardPremium from '@/assets/nav-menu/metrikgunesi_dashboard.png';
import dashboardTerminal from '@/assets/nav-menu/metrikgunesi_dashboard_cyber.png';
import goodsReceiptPremium from '@/assets/nav-menu/akan_nehir_malkabul.png';
import goodsReceiptTerminal from '@/assets/nav-menu/akan_nehir_malkabul_cyber.png';
import warehousePremium from '@/assets/nav-menu/otomatik_rota_depo_ve_ambar_islemleri.png';
import warehouseTerminal from '@/assets/nav-menu/otomatik_rota_depo_ve_ambar_islemleri_cyber.png';
import productionPremium from '@/assets/nav-menu/odakl_kontrol_uretim_ve_kalite.png';
import productionTerminal from '@/assets/nav-menu/odakl_kontrol_uretim_ve_kalite_cyber.png';
import shippingPremium from '@/assets/nav-menu/yorunge_sevk_sevkiyat_islemleri.png';
import shippingTerminal from '@/assets/nav-menu/yorunge_sevk_sevkiyat_islemleri_cyber.png';
import integrationsPremium from '@/assets/nav-menu/kusursuz_baglant_entegrasyonlar.png';
import integrationsTerminal from '@/assets/nav-menu/kusursuz_baglant_entegrasyonlar_cyber.png';
import reportsPremium from '@/assets/nav-menu/prizmaanalizi_raporlar.png';
import reportsTerminal from '@/assets/nav-menu/prizmaanalizi_raporlar_cyber.png';
import systemPremium from '@/assets/nav-menu/hassas_ayar_sistem_yetki_ayar.png';
import systemTerminal from '@/assets/nav-menu/hassas_ayar_sistem_yetki_ayar_cyber.png';

type Hugeicon = ComponentProps<typeof HugeiconsIcon>['icon'];

const SIDEBAR_ICON_SIZE = 28;
const SIDEBAR_ICON_STROKE = 2;

type SkinIconPair = {
  premium: string;
  terminal: string;
};

const NAV_PNG_ICONS = {
  dashboard: { premium: dashboardPremium, terminal: dashboardTerminal },
  goodsReceipt: { premium: goodsReceiptPremium, terminal: goodsReceiptTerminal },
  warehouseOperations: { premium: warehousePremium, terminal: warehouseTerminal },
  production: { premium: productionPremium, terminal: productionTerminal },
  shipping: { premium: shippingPremium, terminal: shippingTerminal },
  integrations: { premium: integrationsPremium, terminal: integrationsTerminal },
  reports: { premium: reportsPremium, terminal: reportsTerminal },
  system: { premium: systemPremium, terminal: systemTerminal },
} as const satisfies Record<string, SkinIconPair>;

type NavPngIconKind = keyof typeof NAV_PNG_ICONS;

function renderSidebarIcon(icon: Hugeicon): ReactElement {
  return (
    <HugeiconsIcon
      icon={icon}
      size={SIDEBAR_ICON_SIZE}
      strokeWidth={SIDEBAR_ICON_STROKE}
      className="nav-menu-vector-icon"
    />
  );
}

function NavPngIcon({ kind }: { kind: NavPngIconKind }): ReactElement {
  const { skin } = useTheme();
  const pair = NAV_PNG_ICONS[kind];
  const src = skin === 'premium' ? pair.premium : pair.terminal;

  return (
    <span className="nav-png-icon" data-nav-icon={kind} aria-hidden>
      <img src={src} alt="" draggable={false} />
    </span>
  );
}

export const dashboardIcon = <NavPngIcon kind="dashboard" />;
export const procurementIcon = renderSidebarIcon(ShoppingCart01Icon);
export const warehouseOperationsIcon = <NavPngIcon kind="warehouseOperations" />;
export const productionIcon = <NavPngIcon kind="production" />;
export const kkdIcon = renderSidebarIcon(HardHatIcon);
export const shippingIcon = <NavPngIcon kind="shipping" />;
export const erpIcon = <NavPngIcon kind="integrations" />;
export const goodsReceiptIcon = <NavPngIcon kind="goodsReceipt" />;
export const reportsIcon = <NavPngIcon kind="reports" />;
export const systemIcon = <NavPngIcon kind="system" />;
