import { ClipboardList, PackageCheck, PackagePlus, Rows3, Settings2, UserCheck, UsersRound } from 'lucide-react';
import { OpsProcessHub, type OpsProcessHubPhase } from '@/components/shared/OpsProcessHub';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

export function WarehouseInboundHubPage() {
  const { t, moduleReady } = useModuleTranslation('warehouse-inbound');

  const phases: OpsProcessHubPhase[] = [
    {
      key: 'start',
      number: '01',
      title: t('hub.phases.start.title'),
      description: t('hub.phases.start.description'),
      sectionCode: 'WI-START',
      items: [
        { key: 'fromOrder', code: 'WI.ORD', href: '/warehouse/warehouse-inbounds/new', icon: ClipboardList, title: t('hub.items.fromOrder.title'), description: t('hub.items.fromOrder.description') },
        { key: 'orderless', code: 'WI.OLS', href: '/warehouse/warehouse-inbounds/orderless', icon: PackagePlus, title: t('hub.items.orderless.title'), description: t('hub.items.orderless.description') },
        { key: 'direct', code: 'WI.DIR', href: '/warehouse/warehouse-inbounds/direct', icon: PackageCheck, title: t('hub.items.direct.title'), description: t('hub.items.direct.description') },
      ],
    },
    {
      key: 'execute',
      number: '02',
      title: t('hub.phases.execute.title'),
      description: t('hub.phases.execute.description'),
      sectionCode: 'WI-EXEC',
      items: [
        { key: 'tasks', code: 'WI.TSK', href: '/warehouse/warehouse-inbounds/tasks', icon: UsersRound, title: t('hub.items.tasks.title'), description: t('hub.items.tasks.description') },
        { key: 'assigned', code: 'WI.ASN', href: '/warehouse/warehouse-inbounds/assigned', icon: UserCheck, title: t('hub.items.assigned.title'), description: t('hub.items.assigned.description') },
      ],
    },
    {
      key: 'manage',
      number: '03',
      title: t('hub.phases.manage.title'),
      description: t('hub.phases.manage.description'),
      sectionCode: 'WI-MGMT',
      items: [
        { key: 'records', code: 'WI.REC', href: '/warehouse/warehouse-inbounds/list', icon: Rows3, title: t('hub.items.records.title'), description: t('hub.items.records.description') },
        { key: 'settings', code: 'WI.SET', href: '/warehouse/warehouse-inbounds/settings', icon: Settings2, title: t('hub.items.settings.title'), description: t('hub.items.settings.description'), featured: true },
      ],
    },
  ];

  return (
    <OpsProcessHub
      loading={!moduleReady}
      eyebrow={t('hub.eyebrow')}
      title={t('hub.title')}
      description={t('hub.description')}
      phases={phases}
    />
  );
}
