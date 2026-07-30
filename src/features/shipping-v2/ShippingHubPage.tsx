import { ClipboardList, PackageCheck, Settings2, ShoppingCart, Truck, UserRoundCog } from 'lucide-react';
import { OpsProcessHub, type OpsProcessHubPhase } from '@/components/shared/OpsProcessHub';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

export function ShippingHubPage() {
  const { t, moduleReady } = useModuleTranslation('shipping-v2');

  const phases: OpsProcessHubPhase[] = [
    {
      key: 'start',
      number: '01',
      title: t('hub.phases.start.title', { defaultValue: 'Sevki Başlat' }),
      description: t('hub.phases.start.description', {
        defaultValue: 'Sipariş kaynağı ve emir yürütme biçimine göre doğru sevk senaryosunu seçin.',
      }),
      sectionCode: 'SHP-START',
      items: [
        { key: 'orderedAssigned', code: 'SHP.OA', href: '/warehouse/shipments/new', icon: ClipboardList, title: t('hub.cards.orderedAssigned.title'), description: t('hub.cards.orderedAssigned.description') },
        { key: 'stockAssigned', code: 'SHP.SA', href: '/warehouse/shipments/new', icon: UserRoundCog, title: t('hub.cards.stockAssigned.title'), description: t('hub.cards.stockAssigned.description') },
        { key: 'orderedDirect', code: 'SHP.OD', href: '/warehouse/shipments/new', icon: ShoppingCart, title: t('hub.cards.orderedDirect.title'), description: t('hub.cards.orderedDirect.description') },
        { key: 'stockDirect', code: 'SHP.SD', href: '/warehouse/shipments/new', icon: Truck, title: t('hub.cards.stockDirect.title'), description: t('hub.cards.stockDirect.description') },
      ],
    },
    {
      key: 'manage',
      number: '02',
      title: t('hub.phases.manage.title', { defaultValue: 'İzle ve Yönet' }),
      description: t('hub.phases.manage.description', {
        defaultValue: 'Kayıtları izleyin ve sevk süreç politikasını yönetin.',
      }),
      sectionCode: 'SHP-MGMT',
      items: [
        { key: 'records', code: 'SHP.REC', href: '/warehouse/shipments/list', icon: PackageCheck, title: t('hub.records.title'), description: t('hub.records.description') },
        { key: 'settings', code: 'SHP.SET', href: '/warehouse/shipments/settings', icon: Settings2, title: t('hub.settings.title'), description: t('hub.settings.description'), featured: true },
      ],
    },
  ];

  return (
    <OpsProcessHub
      loading={!moduleReady}
      eyebrow={t('title')}
      title={t('hub.title')}
      description={t('hub.description')}
      path="/warehouse/shipments"
      phases={phases}
    />
  );
}
