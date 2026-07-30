import { ClipboardList, PackageCheck, Settings2, ShoppingCart, Truck, UserRoundCog } from 'lucide-react';
import { OpsProcessHub, type OpsProcessHubPhase } from '@/components/shared/OpsProcessHub';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

export function WarehouseOutboundHubPage() {
  const { t, moduleReady } = useModuleTranslation('warehouse-outbound');

  const phases: OpsProcessHubPhase[] = [
    {
      key: 'start',
      number: '01',
      title: t('hub.phases.start.title', { defaultValue: 'Çıkışı Başlat' }),
      description: t('hub.phases.start.description', {
        defaultValue: 'Sipariş kaynağı ve emir yürütme biçimine göre doğru çıkış senaryosunu seçin.',
      }),
      sectionCode: 'WO-START',
      items: [
        { key: 'orderedAssigned', code: 'WO.OA', href: '/warehouse/warehouse-outbounds/new', icon: ClipboardList, title: t('hub.cards.orderedAssigned.title'), description: t('hub.cards.orderedAssigned.description') },
        { key: 'stockAssigned', code: 'WO.SA', href: '/warehouse/warehouse-outbounds/new', icon: UserRoundCog, title: t('hub.cards.stockAssigned.title'), description: t('hub.cards.stockAssigned.description') },
        { key: 'orderedDirect', code: 'WO.OD', href: '/warehouse/warehouse-outbounds/new', icon: ShoppingCart, title: t('hub.cards.orderedDirect.title'), description: t('hub.cards.orderedDirect.description') },
        { key: 'stockDirect', code: 'WO.SD', href: '/warehouse/warehouse-outbounds/new', icon: Truck, title: t('hub.cards.stockDirect.title'), description: t('hub.cards.stockDirect.description') },
      ],
    },
    {
      key: 'manage',
      number: '02',
      title: t('hub.phases.manage.title', { defaultValue: 'İzle ve Yönet' }),
      description: t('hub.phases.manage.description', {
        defaultValue: 'Kayıtları izleyin ve ambar çıkış süreç politikasını yönetin.',
      }),
      sectionCode: 'WO-MGMT',
      items: [
        { key: 'records', code: 'WO.REC', href: '/warehouse/warehouse-outbounds/list', icon: PackageCheck, title: t('hub.records.title'), description: t('hub.records.description') },
        { key: 'settings', code: 'WO.SET', href: '/warehouse/warehouse-outbounds/settings', icon: Settings2, title: t('hub.settings.title'), description: t('hub.settings.description'), featured: true },
      ],
    },
  ];

  return (
    <OpsProcessHub
      loading={!moduleReady}
      eyebrow={t('title')}
      title={t('hub.title')}
      description={t('hub.description')}
      path="/warehouse/warehouse-outbounds"
      phases={phases}
    />
  );
}
