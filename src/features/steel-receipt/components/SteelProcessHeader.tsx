import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {InboundProcessHeader} from '@/features/inbound-operations/components/InboundProcessHeader';

const STEP_KEYS=['gate','plan','inspection','receipt','placement'] as const;
const STEP_HREFS={
  gate:'/warehouse/goods-receipts/steel/vehicle-check-in',
  plan:'/warehouse/goods-receipts/steel/import',
  inspection:'/warehouse/goods-receipts/steel/inspection',
  receipt:'/warehouse/goods-receipts/steel/receipt',
  placement:'/warehouse/goods-receipts/steel/placement',
} as const;

export function SteelProcessHeader({currentStep,title,description,notice}:{currentStep:string;title:string;description:string;notice?:string}){
  const {t}=useTranslation('common');
  const P='steelGoodReceiptAcceptance.processHeader';
  const steps=useMemo(()=>STEP_KEYS.map(key=>({
    key,
    label:t(`${P}.steps.${key}.label`),
    description:t(`${P}.steps.${key}.description`),
    href:STEP_HREFS[key],
  })),[t]);
  return <div data-no-auto-localize="true"><InboundProcessHeader eyebrow={t(`${P}.eyebrow`)} title={title} description={description} steps={steps} currentStep={currentStep} notice={notice}/></div>;
}
