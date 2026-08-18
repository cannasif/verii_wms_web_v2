import { ClipboardList, PackageCheck, PackagePlus, Rows3, Settings2, UserCheck, UsersRound } from 'lucide-react';
import { OpsProcessHub, type OpsProcessHubPhase } from '@/components/shared/OpsProcessHub';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

export function GoodsReceiptHubPage() {
  const { t, moduleReady } = useModuleTranslation('goods-receipt-v2');

  const phases: OpsProcessHubPhase[] = [
    {
      key: 'start',
      number: '01',
      title: t('hub.phases.start.title'),
      description: t('hub.phases.start.description'),
      sectionCode: 'GR-START',
      items: [
        { key: 'ordered', code: 'GR.ORD', href: '/warehouse/goods-receipts/new', icon: ClipboardList, title: t('hub.cards.ordered.title'), description: t('hub.cards.ordered.description') },
        { key: 'orderless', code: 'GR.OLS', href: '/warehouse/goods-receipts/orderless', icon: PackagePlus, title: t('hub.cards.orderless.title'), description: t('hub.cards.orderless.description') },
        { key: 'direct', code: 'GR.DIR', href: '/warehouse/goods-receipts/direct', icon: PackageCheck, title: t('hub.cards.direct.title'), description: t('hub.cards.direct.description') },
        { key: 'import', code: 'GR.IMP', href: '/warehouse/goods-receipts/import', icon: PackageCheck, title: t('hub.cards.import.title'), description: t('hub.cards.import.description') },
      ],
    },
    {
      key: 'execute',
      number: '02',
      title: t('hub.phases.execute.title'),
      description: t('hub.phases.execute.description'),
      sectionCode: 'GR-EXEC',
      items: [
        { key: 'tasks', code: 'GR.TSK', href: '/warehouse/goods-receipts/tasks', icon: UsersRound, title: t('hub.cards.tasks.title'), description: t('hub.cards.tasks.description') },
        { key: 'assigned', code: 'GR.ASN', href: '/warehouse/goods-receipts/assigned', icon: UserCheck, title: t('hub.cards.assigned.title'), description: t('hub.cards.assigned.description') },
      ],
    },
    {
      key: 'manage',
      number: '03',
      title: t('hub.phases.manage.title'),
      description: t('hub.phases.manage.description'),
      sectionCode: 'GR-MGMT',
      items: [
        { key: 'records', code: 'GR.REC', href: '/warehouse/goods-receipts/list', icon: Rows3, title: t('hub.cards.records.title'), description: t('hub.cards.records.description') },
        { key: 'settings', code: 'GR.SET', href: '/warehouse/goods-receipt-settings', icon: Settings2, title: t('hub.cards.settings.title'), description: t('hub.cards.settings.description'), featured: true },
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
