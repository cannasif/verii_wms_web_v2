import { ClipboardList, PackageCheck, PackageOpen, Rows3, Settings2, Truck, UserRoundCog } from 'lucide-react';
import { OpsProcessHub, type OpsProcessHubPhase } from '@/components/shared/OpsProcessHub';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

export function WarehouseTransferHubPage() {
  const { t, moduleReady } = useModuleTranslation('warehouse-transfer-v2');

  const phases: OpsProcessHubPhase[] = [
    {
      key: 'start',
      number: '01',
      title: t('hub.startTitle'),
      description: t('hub.startDescription'),
      sectionCode: 'TR-START',
      items: [
        { key: 'orderedErp', code: 'TR.OE', href: '/warehouse/transfers/new', icon: ClipboardList, title: t('hub.cards.orderedErp.title'), description: t('hub.cards.orderedErp.description') },
        { key: 'orderedStock', code: 'TR.OS', href: '/warehouse/transfers/new', icon: UserRoundCog, title: t('hub.cards.orderedStock.title'), description: t('hub.cards.orderedStock.description') },
        { key: 'directErp', code: 'TR.DE', href: '/warehouse/transfers/new', icon: Truck, title: t('hub.cards.directErp.title'), description: t('hub.cards.directErp.description') },
        { key: 'directStock', code: 'TR.DS', href: '/warehouse/transfers/new', icon: PackageOpen, title: t('hub.cards.directStock.title'), description: t('hub.cards.directStock.description') },
      ],
    },
    {
      key: 'execute',
      number: '02',
      title: t('hub.executeTitle'),
      description: t('hub.executeDescription'),
      sectionCode: 'TR-EXEC',
      items: [
        { key: 'source', code: 'TR.SRC', icon: PackageOpen, title: t('hub.source.title'), description: t('hub.source.description'), disabled: true, badge: t('hub.operationSlice') },
        { key: 'target', code: 'TR.TGT', icon: PackageCheck, title: t('hub.target.title'), description: t('hub.target.description'), disabled: true, badge: t('hub.operationSlice') },
        { key: 'records', code: 'TR.REC', href: '/warehouse/transfers/list', icon: Rows3, title: t('hub.records.title'), description: t('hub.records.description') },
      ],
    },
    {
      key: 'manage',
      number: '03',
      title: t('hub.settings.title'),
      description: t('hub.settings.description'),
      sectionCode: 'TR-MGMT',
      items: [
        { key: 'settings', code: 'TR.SET', href: '/warehouse/transfers/settings', icon: Settings2, title: t('hub.settings.title'), description: t('hub.settings.description'), featured: true },
      ],
    },
  ];

  return (
    <OpsProcessHub
      loading={!moduleReady}
      eyebrow={t('title')}
      title={t('hubTitle')}
      description={t('hubDescription')}
      path="/warehouse/transfers"
      phases={phases}
    />
  );
}
