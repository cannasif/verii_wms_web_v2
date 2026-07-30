import { BarChart3, FileSpreadsheet, Layers3, Rows3, Truck } from 'lucide-react';
import { OpsProcessHub, type OpsProcessHubPhase } from '@/components/shared/OpsProcessHub';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';

export function SteelReceiptHubPage() {
  const { t, moduleReady } = useModuleTranslation('steel-receipt');

  const phases: OpsProcessHubPhase[] = [
    {
      key: 'gate',
      number: '01',
      title: t('hub.phases.gate.title'),
      description: t('hub.phases.gate.description'),
      sectionCode: 'STL-GATE',
      items: [
        { key: 'import', code: 'STL.IMP', href: '/warehouse/goods-receipts/steel/import', icon: FileSpreadsheet, title: t('hub.cards.import.title'), description: t('hub.cards.import.description') },
        { key: 'vehicles', code: 'STL.VEH', href: '/warehouse/goods-receipts/steel/vehicle-check-ins', icon: Truck, title: t('hub.cards.vehicles.title'), description: t('hub.cards.vehicles.description') },
        { key: 'plans', code: 'STL.PLN', href: '/warehouse/goods-receipts/steel/plans', icon: Rows3, title: t('hub.cards.plans.title'), description: t('hub.cards.plans.description') },
      ],
    },
    {
      key: 'putaway',
      number: '02',
      title: t('hub.phases.putaway.title'),
      description: t('hub.phases.putaway.description'),
      sectionCode: 'STL-PUT',
      items: [
        { key: 'receipt', code: 'STL.RCP', href: '/warehouse/goods-receipts/steel/receipt', icon: Layers3, title: t('hub.cards.receipt.title'), description: t('hub.cards.receipt.description') },
        { key: 'placement', code: 'STL.PLC', href: '/warehouse/goods-receipts/steel/placement', icon: Layers3, title: t('hub.cards.placement.title'), description: t('hub.cards.placement.description') },
      ],
    },
    {
      key: 'report',
      number: '03',
      title: t('hub.phases.report.title'),
      description: t('hub.phases.report.description'),
      sectionCode: 'STL-RPT',
      items: [
        { key: 'reports', code: 'STL.RPT', href: '/warehouse/goods-receipts/steel/reports', icon: BarChart3, title: t('hub.cards.reports.title'), description: t('hub.cards.reports.description') },
      ],
    },
  ];

  return (
    <OpsProcessHub
      loading={!moduleReady}
      eyebrow={t('hub.eyebrow')}
      title={t('hub.title')}
      description={t('hub.description')}
      path="/warehouse/goods-receipts/steel"
      phases={phases}
    />
  );
}
