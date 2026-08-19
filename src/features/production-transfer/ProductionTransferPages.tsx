import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ClipboardList, Factory, PackageCheck, RefreshCw, Rows3, Save, Settings2, ShieldAlert, UserPlus, Warehouse } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsProcessHub, type OpsProcessHubCard, type OpsProcessHubPhase } from '@/components/shared/OpsProcessHub';
import { OpsSelect } from '@/components/shared/OpsSelect';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OPS_SELECT_TRIGGER_CLASS } from '@/components/shared/ops-field-styles';
import { OpsPageHeader } from '@/components/shared/OpsPageHeader';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { WarehouseTransferDraftPage, type ProductionTransferInitialSource } from '@/features/warehouse-transfer-v2/components/WarehouseTransferDraftPage';
import { WarehouseTransferListPage } from '@/features/warehouse-transfer-v2/components/WarehouseTransferListPage';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { warehouseTransferApi } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import { productionTransferApi, type ProductionTransferPolicy } from './api';
import { ProductionTransferExecutionPage } from './components/ProductionTransferExecutionPage';
import type { ActiveUserOption, LocationOption, WarehouseOption } from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { ParameterFieldGuide, ParameterPageGuide, ParameterToggleCard } from '@/components/shared/ParameterGuidance';
import type { PreparedNetsisProductionWorkOrder } from '@/features/production/types';
import { kkdApi } from '@/features/kkd/kkd-api';
import { parameterGuidance, parameterToggleGuidance } from '@/features/settings-guidance/parameter-guidance.catalog';

export function ProductionTransferHubPage() {
  const { t, moduleReady } = useModuleTranslation('production-transfer');
  const { can } = usePermissionAccess();
  const materialRequests = useQuery({
    queryKey: ['kkd', 'material-requests', 'configuration'],
    queryFn: kkdApi.materialRequestConfiguration,
    enabled: can('WMS.KKD.DISTRIBUTION.OPERATE'),
  });

  const executeItems: OpsProcessHubCard[] = [];
  if (can('WMS.PRODUCTION_TRANSFER.ASSIGN')) {
    executeItems.push({
      key: 'taskPool',
      code: 'PT.TSK',
      href: '/warehouse/production-transfers/task-pool',
      icon: UserPlus,
      title: t('hub.cards.taskPool.title'),
      description: t('hub.cards.taskPool.description'),
    });
  }
  if (can('WMS.KKD.DISTRIBUTION.OPERATE') && materialRequests.data?.isEnabled) {
    executeItems.push({
      key: 'materialRequests',
      code: 'PT.MRQ',
      href: '/warehouse/kkd/distributions/new',
      icon: Boxes,
      title: t('hub.cards.materialRequests.title'),
      description: t('hub.cards.materialRequests.description'),
    });
  }

  const phases: OpsProcessHubPhase[] = [
    {
      key: 'start',
      number: '01',
      title: t('hub.phases.start.title'),
      description: t('hub.phases.start.description'),
      sectionCode: 'PT-START',
      items: [
        {
          key: 'create',
          code: 'PT.NEW',
          href: '/warehouse/production-transfers/new',
          icon: Factory,
          title: t('hub.cards.create.title'),
          description: t('hub.cards.create.description'),
          featured: true,
        },
      ],
    },
    ...(executeItems.length > 0
      ? [
          {
            key: 'execute',
            number: '02',
            title: t('hub.phases.execute.title'),
            description: t('hub.phases.execute.description'),
            sectionCode: 'PT-EXEC',
            items: executeItems,
          } satisfies OpsProcessHubPhase,
        ]
      : []),
    {
      key: 'manage',
      number: executeItems.length > 0 ? '03' : '02',
      title: t('hub.phases.manage.title'),
      description: t('hub.phases.manage.description'),
      sectionCode: 'PT-MGMT',
      items: [
        {
          key: 'list',
          code: 'PT.REC',
          href: '/warehouse/production-transfers/list',
          icon: Rows3,
          title: t('hub.cards.list.title'),
          description: t('hub.cards.list.description'),
        },
        {
          key: 'settings',
          code: 'PT.SET',
          href: '/warehouse/production-transfers/settings',
          icon: Settings2,
          title: t('hub.cards.settings.title'),
          description: t('hub.cards.settings.description'),
          featured: true,
        },
      ],
    },
  ];

  return (
    <OpsProcessHub
      loading={!moduleReady}
      eyebrow={t('hub.eyebrow')}
      title={t('hub.title')}
      description={t('hub.description')}
      path="/warehouse/production-transfers"
      phases={phases}
    />
  );
}
export function ProductionTransferTaskPoolPage(){
  const {can}=usePermissionAccess();
  const query=useQuery({queryKey:['production-transfer','task-pool'],queryFn:productionTransferApi.taskPool});
  const materialRequests=useQuery({queryKey:['kkd','material-requests','configuration'],queryFn:kkdApi.materialRequestConfiguration,enabled:can('WMS.KKD.DISTRIBUTION.OPERATE')});
  return <section className="space-y-5"><header><p className="text-xs font-bold uppercase tracking-widest text-[var(--wms-brand-primary)]">Depo iş merkezi / yönetici</p><h1 className="mt-2 text-2xl font-black">Görev havuzu</h1><p className="text-sm text-[var(--wms-app-text-muted)]">Üretim transferlerini ve etkinleştirilmişse Netsis açık siparişlerinden gelen personel malzeme taleplerini aynı iş merkezinden yönetin.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-xl bg-[var(--wms-brand-primary)] px-4 py-2 text-sm font-bold text-[var(--wms-brand-on-primary)]">Üretim transfer görevleri</span>{materialRequests.data?.isEnabled&&<Link className="rounded-xl border border-[var(--wms-app-border)] px-4 py-2 text-sm font-bold hover:border-[var(--wms-brand-primary)]" to="/warehouse/kkd/distributions/new">KKD Malzeme Talep Siparişleri</Link>}</div></header><section className="overflow-auto rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-4"><table className="w-full min-w-[1050px] text-left text-sm"><thead><tr className="border-b border-[var(--wms-app-border)]">{['Transfer','Görev','Depo','Tür','Durum','Planlanan','Yapılan','Kalan','Atananlar','İşlem'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{query.data?.map(row=><tr key={row.taskId} className="border-b border-[var(--wms-app-border)]"><td className="p-3"><strong>{row.documentNo}</strong><div className="text-xs text-[var(--wms-app-text-muted)]">{row.transferStatus}</div></td><td className="p-3 font-bold">{row.taskNo}</td><td className="p-3">#{row.warehouseId}</td><td className="p-3">{row.taskType}</td><td className="p-3">{row.taskStatus}</td><td className="p-3 text-right">{row.plannedQuantity}</td><td className="p-3 text-right text-emerald-500">{row.processedQuantity}</td><td className="p-3 text-right text-amber-500">{row.remainingQuantity}</td><td className="p-3">{row.assignedUsers.join(', ')||'Atanmamış'}</td><td className="p-3"><Link className="font-bold text-[var(--wms-brand-primary)]" to={`/warehouse/production-transfers/${row.transferId}/operations`}>Aç / ata →</Link></td></tr>)}</tbody></table>{query.isLoading&&<p className="p-4 text-sm text-[var(--wms-app-text-muted)]">Görevler yükleniyor…</p>}{query.data?.length===0&&<p className="p-4 text-sm text-[var(--wms-app-text-muted)]">Aktif üretim transfer görevi bulunamadı.</p>}</section></section>;
}
export function ProductionTransferDraftPage(){
  const location=useLocation();
  const navigationState=location.state as {netsisProduction?:PreparedNetsisProductionWorkOrder;assignees?:ActiveUserOption[]}|null;
  const source=navigationState?.netsisProduction;
  const initial:ProductionTransferInitialSource|undefined=source?.sourceWarehouseId&&source.targetWarehouseId&&source.materials.every(x=>x.stockId)?{
    sourceSystemCode:source.sourceSystemCode,workOrderNumber:source.workOrderNumber,projectCode:source.projectCode,
    existingProductionHeaderId:source.existingProductionHeaderId,existingProductionOrderId:source.existingProductionOrderId,
    sourceWarehouse:{id:source.sourceWarehouseId,code:source.sourceWarehouseCode},
    targetWarehouse:{id:source.targetWarehouseId,code:source.targetWarehouseCode},
    materials:source.materials.map(x=>({stockId:x.stockId!,stockCode:x.stockCode,stockName:x.stockName,unitCode:x.unitCode,yapCodeId:x.yapCodeId,configurationCode:x.configurationCode,quantity:x.requiredQuantity})),
  }:undefined;
  return <WarehouseTransferDraftPage variant="production" initialProductionSource={initial} initialAssignees={navigationState?.assignees}/>;
}
export function ProductionTransferListPage(){return <WarehouseTransferListPage variant="production"/>;}
export function ProductionTransferOperationPage(){
  return <ProductionTransferExecutionPage />;
}
export function ProductionTransferPolicyPage(){
  const {t,moduleReady}=useModuleTranslation('production-transfer');
  const branchCode=useAuthStore(x=>x.branch?.code??'0');
  const[form,setForm]=useState<ProductionTransferPolicy>();
  const[loadError,setLoadError]=useState<string>();
  const[busy,setBusy]=useState(false);
  const loadPolicy=useCallback(async()=>{
    setLoadError(undefined);
    setForm(undefined);
    try{setForm(await productionTransferApi.policy(branchCode));}
    catch(e){const detail=e instanceof Error?e.message:t('policy.loadFailed');setLoadError(detail);toast.error(detail);}
  },[branchCode,t]);
  useEffect(()=>{void loadPolicy();},[loadPolicy]);
  if(!moduleReady)return <section className="wms-ops-form wms-ops-pt-policy mx-auto max-w-6xl px-4 py-16"><OpsLoadingState code="POLICY" message={t('policy.loading',{defaultValue:'Politika yükleniyor…'})}/></section>;
  if(loadError)return <section className="wms-ops-form wms-ops-pt-policy mx-auto max-w-3xl px-4 py-16">
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
      <ShieldAlert className="mx-auto size-9 text-rose-500"/>
      <h1 className="mt-3 text-xl font-black">{t('policy.loadFailed')}</h1>
      <p className="mt-2 text-sm text-[var(--wms-app-text-muted)]">{t('policy.loadFailedHint')}</p>
      <p className="mt-3 rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-3 text-sm">{loadError}</p>
      <OpsActionButton className="mt-4" onClick={loadPolicy}><RefreshCw className="size-4"/>{t('policy.retry')}</OpsActionButton>
    </div>
  </section>;
  if(!form)return <section className="wms-ops-form wms-ops-pt-policy mx-auto max-w-6xl px-4 py-16"><OpsLoadingState code="POLICY" message={t('policy.loading',{defaultValue:'Politika yükleniyor…'})}/></section>;
  const set=<K extends keyof ProductionTransferPolicy>(key:K,value:ProductionTransferPolicy[K])=>setForm(x=>x?{...x,[key]:value}:x);
  const save=async()=>{setBusy(true);try{setForm(await productionTransferApi.updatePolicy(form));toast.success(t('policy.saved'));}catch(e){toast.error(e instanceof Error?e.message:t('policy.saveFailed'));}finally{setBusy(false);}};
  const orderChecks:Array<[BooleanPolicyKey,string]>=[
    ['requireProductionOrderReference',t('policy.fields.requireProductionOrderReference')],
    ['allowManualTransfer',t('policy.fields.allowManualTransfer')],
    ['requireErpMasterDataForManualTransfer',t('policy.fields.requireErpMasterDataForManualTransfer',{defaultValue:'Plansız/manüel transferde ERP ana verisini zorunlu doğrula'})],
    ['allowAutomaticGeneration',t('policy.fields.allowAutomaticGeneration')],
    ['checkMaterialAvailability',t('policy.fields.checkMaterialAvailability')],
    ['blockOnShortage',t('policy.fields.blockOnShortage')],
    ['requireTaskAssignment',t('policy.fields.requireTaskAssignment')],
  ];
  const executionChecks:Array<[BooleanPolicyKey,string]>=[
    ['requireSourceProductionLocation',t('policy.fields.requireSourceProductionLocation')],
    ['requireTargetProductionLocation',t('policy.fields.requireTargetProductionLocation')],
    ['allowPartialSupply',t('policy.fields.allowPartialSupply')],
    ['allowOverIssue',t('policy.fields.allowOverIssue')],
    ['requireApproval',t('policy.fields.requireApproval')],
  ];
  const cancellationChoices:Array<{value:ProductionTransferPolicy['cancellationReturnPolicy'];title:string;text:string}>=[
    {value:'OriginalSourceLocation',title:t('policy.cancellation.original',{defaultValue:'Özgün kaynak raf'}),text:t('policy.cancellation.originalHint',{defaultValue:'Hareket görmüş stok toplandığı rafa geri konur.'})},
    {value:'WarehouseDefaultReturnLocation',title:t('policy.cancellation.warehouseDefault',{defaultValue:'Deponun varsayılan iade rafı'}),text:t('policy.cancellation.warehouseDefaultHint',{defaultValue:'Depo ayarındaki iade rafı kullanılır; raf tanımlı değilse iptal engellenir.'})},
    {value:'ManagerSelectionRequired',title:t('policy.cancellation.managerSelection',{defaultValue:'Yönetici seçim yapmak zorunda'}),text:t('policy.cancellation.managerSelectionHint',{defaultValue:'İptal ekranında iade rafı elle seçilmeden işlem tamamlanmaz.'})},
  ];
  return <section className="wms-ops-form wms-ops-pt-policy mx-auto max-w-6xl space-y-4">
    <OpsPageHeader
      title={t('policy.title')}
      description={t('policy.description')}
      hintLabel={t('policy.howItWorks',{defaultValue:'Bu sayfa ne yapar?'})}
    />
    <ParameterPageGuide translationKey="production" title="Üretime transfer ayar rehberi" description="İş emri kaynağı, stok uygunluğu, görev, raf, kısmi/fazla teslim, ikinci adım onayı ve iptal iadesinin sonucunu gerçek senaryolarla açıklar." />

    <PolicySection
      code="SRC_01"
      icon={<Factory className="size-4" strokeWidth={1.75}/>}
      title={t('policy.sections.source',{defaultValue:'İş emri ve reçete kaynağı'})}
      description={t('policy.sections.sourceHint',{defaultValue:'Üretim emirlerinin hangi sistemden okunacağını ve dış sistem kodunu belirler.'})}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <PolicyField label={t('policy.fields.productionOrderSource',{defaultValue:'Üretim verisini nereden oku?'})} guideKey="productionOrderSource" value={form.productionOrderSource}>
          <OpsSelect
            value={form.productionOrderSource}
            onValueChange={value=>set('productionOrderSource',value as ProductionTransferPolicy['productionOrderSource'])}
            options={[
              {value:'NetsisErpFunctions',label:t('policy.source.netsis',{defaultValue:'Netsis ERP fonksiyonlarından oku'}),description:t('policy.source.netsisHint',{defaultValue:'İş emri ve reçete Netsis read fonksiyonlarından anlık hazırlanır.'})},
              {value:'WmsIntegrationTables',label:t('policy.source.wms',{defaultValue:'WMS entegrasyon tablolarından oku'}),description:t('policy.source.wmsHint',{defaultValue:'Windbox gibi onaylı bir planlama sistemi WMS kaynak tablolarını besler.'})},
              {value:'ErpAndWms',label:t('policy.source.combined',{defaultValue:'ERP ve WMS emirlerini birlikte listele'}),description:t('policy.source.combinedHint',{defaultValue:'Her iki kaynaktaki emirler kaynak etiketiyle gösterilir; aynı numaralı emirler karışmaz.'})},
            ]}
          />
        </PolicyField>
        <PolicyField
          htmlFor="pt-policy-source-system-code"
          label={t('policy.fields.wmsSourceSystemCode',{defaultValue:'Kaynak sistem kodu'})}
          hint={t('policy.fields.wmsSourceSystemCodeHint',{defaultValue:'RII_PR_SOURCE_ORDER kayıtlarındaki SourceSystemCode ile birebir eşleşir.'})}
          guideKey="wmsSourceSystemCode"
          value={form.wmsSourceSystemCode}
          currentValue={form.wmsSourceSystemCode || 'Tanımlanmadı'}
        >
          <AppInput
            id="pt-policy-source-system-code"
            maxLength={50}
            disabled={form.productionOrderSource==='NetsisErpFunctions'}
            value={form.wmsSourceSystemCode}
            onChange={e=>set('wmsSourceSystemCode',e.target.value.toUpperCase())}
            placeholder="WINDBOX"
          />
        </PolicyField>
      </div>
      <PolicyCallout
        title={t('policy.source.boundaryTitle',{defaultValue:'Entegrasyon sınırı'})}
        text={t('policy.source.boundaryText',{defaultValue:'Dış sistem yalnızca sürümlü kaynak iş emri ve reçete tablolarını besler. WMS operasyon emri, transfer, rezervasyon ve stok hareketini kendi transaction sınırında oluşturur.'})}
      />
    </PolicySection>

    <PolicySection
      code="ORD_02"
      icon={<ClipboardList className="size-4" strokeWidth={1.75}/>}
      title={t('policy.sections.order')}
      description={t('policy.sections.orderHint',{defaultValue:'Transfer emrinin nasıl açılacağını ve hangi kontrollerin zorunlu olduğunu belirler.'})}
    >
      <div className="wms-ops-pt-policy-check-grid">
        {orderChecks.map(([key,label])=>(
          <PolicyCheckRow key={key} guideKey={key} checked={form[key]} onCheckedChange={value=>set(key,value)} label={label}/>
        ))}
      </div>
    </PolicySection>

    <PolicySection
      code="EXE_03"
      icon={<PackageCheck className="size-4" strokeWidth={1.75}/>}
      title={t('policy.sections.execution')}
      description={t('policy.sections.executionHint',{defaultValue:'Toplama ve teslim aşamasındaki raf, tolerans ve onay kurallarıdır.'})}
    >
      <div className="wms-ops-pt-policy-check-grid">
        {executionChecks.map(([key,label])=>(
          <PolicyCheckRow key={key} guideKey={key} checked={form[key]} onCheckedChange={value=>set(key,value)} label={label}/>
        ))}
      </div>
      <div className="mt-4">
        <PolicyField
          label={t('policy.fields.erpPostingPolicy',{defaultValue:'Tamamlanan üretim transferi Netsis’e ne zaman gönderilsin?'})}
          guideKey="erpPostingPolicy"
          value={form.erpPostingPolicy}
          currentValue={t(`policy.erpPosting.${form.erpPostingPolicy}.title`)}
        >
          <OpsSelect
            value={form.erpPostingPolicy}
            onValueChange={value=>set('erpPostingPolicy',value as ProductionTransferPolicy['erpPostingPolicy'])}
            options={(['AfterHandover','Manual','Disabled'] as const).map(value=>({
              value,
              label:t(`policy.erpPosting.${value}.title`),
              description:t(`policy.erpPosting.${value}.description`),
            }))}
          />
        </PolicyField>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <PolicyField
          htmlFor="pt-policy-over-issue-tolerance"
          label={t('policy.fields.overIssueTolerancePercent')}
          hint={t('policy.fields.overIssueTolerancePercentHint',{defaultValue:'Fazla çıkışa izin verildiğinde uygulanacak üst sınır.'})}
          guideKey="overIssueTolerancePercent"
          value={form.overIssueTolerancePercent}
          currentValue={`%${form.overIssueTolerancePercent}`}
        >
          <AppInput
            id="pt-policy-over-issue-tolerance"
            type="number"
            min={0}
            max={100}
            step=".01"
            disabled={!form.allowOverIssue}
            value={form.overIssueTolerancePercent}
            onChange={e=>set('overIssueTolerancePercent',Number(e.target.value))}
            trailingContent={<span className="px-2 text-xs font-semibold opacity-70">%</span>}
          />
        </PolicyField>
        <PolicyField label={t('policy.fields.cancellationReturnPolicy',{defaultValue:'İptalde stok nereye dönsün?'})} guideKey="cancellationReturnPolicy" value={form.cancellationReturnPolicy}>
          <div className="grid gap-2 md:grid-cols-3" role="radiogroup" aria-label={t('policy.fields.cancellationReturnPolicy',{defaultValue:'İptalde stok nereye dönsün?'})}>
            {cancellationChoices.map(choice=>(
              <PolicyChoice
                key={choice.value}
                checked={form.cancellationReturnPolicy===choice.value}
                onSelect={()=>set('cancellationReturnPolicy',choice.value)}
                title={choice.title}
                text={choice.text}
              />
            ))}
          </div>
        </PolicyField>
      </div>
    </PolicySection>

    <TransferReturnLocationPanel branchCode={branchCode}/>

    <div className="wms-ops-form-card wms-ops-pt-policy-card wms-ops-pt-policy-actionbar overflow-hidden rounded-none border border-[var(--wms-ops-card-border)]">
      <p className="wms-ops-pt-policy-actionbar__note">{t('policy.saveHint',{defaultValue:'Değişiklikler yalnızca bu şube için geçerlidir ve kaydettiğiniz anda yeni transferlere uygulanır.'})}</p>
      <OpsActionButton
        variant="primary"
        loading={busy}
        loadingLabel={<><Save className="size-4"/>{t('policy.saving',{defaultValue:'Kaydediliyor…'})}</>}
        onClick={()=>void save()}
      >
        <Save className="size-4"/>{t('policy.save',{defaultValue:'Kaydet'})}
      </OpsActionButton>
    </div>
  </section>;
}

type LocationLabel = { value: string; label: string } | undefined;

function TransferReturnLocationPanel({branchCode}:{branchCode:string}){
  const[warehouseValue,setWarehouseValue]=useState<string|null>(null);
  const[returnLocationValue,setReturnLocationValue]=useState<string|null>(null);
  const[productionLocationValue,setProductionLocationValue]=useState<string|null>(null);
  const[pickingStagingLocationValue,setPickingStagingLocationValue]=useState<string|null>(null);
  const[autoPickThreshold,setAutoPickThreshold]=useState('');
  const[busy,setBusy]=useState(false);
  const[returnLocationOption,setReturnLocationOption]=useState<LocationLabel>();
  const[productionLocationOption,setProductionLocationOption]=useState<LocationLabel>();
  const[pickingStagingLocationOption,setPickingStagingLocationOption]=useState<LocationLabel>();
  const warehouseId=Number(warehouseValue||0);

  const resolveLocationOption = async (id: number | undefined | null): Promise<LocationLabel> => {
    if (!id) return undefined;
    try {
      const loc = await productionTransferApi.locationById(id);
      return { value: String(loc.id), label: `${loc.code} · ${loc.name}` };
    } catch { return undefined; }
  };

  useEffect(()=>{
    if(!warehouseId){setReturnLocationValue(null);setProductionLocationValue(null);setPickingStagingLocationValue(null);setAutoPickThreshold('');setReturnLocationOption(undefined);setProductionLocationOption(undefined);setPickingStagingLocationOption(undefined);return;}
    void productionTransferApi.returnSetting(warehouseId).then(async x=>{
      setReturnLocationValue(x.defaultProductionTransferReturnLocationId?String(x.defaultProductionTransferReturnLocationId):null);
      setProductionLocationValue(x.defaultProductionTransferLocationId?String(x.defaultProductionTransferLocationId):null);
      setPickingStagingLocationValue(x.productionPickingStagingLocationId?String(x.productionPickingStagingLocationId):null);
      setAutoPickThreshold(
        x.autoPickWithoutConfirmMaxQuantity && x.autoPickWithoutConfirmMaxQuantity > 0
          ? String(Math.floor(x.autoPickWithoutConfirmMaxQuantity))
          : '',
      );
      const [retOpt, prodOpt, stagOpt] = await Promise.all([
        resolveLocationOption(x.defaultProductionTransferReturnLocationId),
        resolveLocationOption(x.defaultProductionTransferLocationId),
        resolveLocationOption(x.productionPickingStagingLocationId),
      ]);
      setReturnLocationOption(retOpt);
      setProductionLocationOption(prodOpt);
      setPickingStagingLocationOption(stagOpt);
    }).catch((e:Error)=>toast.error(e.message));
  },[warehouseId]);
  const save=async()=>{
    if(!warehouseId)return;
    const trimmedThreshold = autoPickThreshold.trim();
    let parsedThreshold: number | null = null;
    if (trimmedThreshold !== '') {
      const value = Number(trimmedThreshold.replace(',', '.'));
      if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
        toast.error('Onaysız toplama eşiği geçerli bir tam sayı olmalıdır.');
        return;
      }
      parsedThreshold = value;
    }
    setBusy(true);
    try{
      const result=await productionTransferApi.updateReturnSetting(
        warehouseId,
        returnLocationValue?Number(returnLocationValue):undefined,
        productionLocationValue?Number(productionLocationValue):undefined,
        pickingStagingLocationValue?Number(pickingStagingLocationValue):undefined,
        parsedThreshold,
      );
      setReturnLocationValue(result.defaultProductionTransferReturnLocationId?String(result.defaultProductionTransferReturnLocationId):null);
      setProductionLocationValue(result.defaultProductionTransferLocationId?String(result.defaultProductionTransferLocationId):null);
      setPickingStagingLocationValue(result.productionPickingStagingLocationId?String(result.productionPickingStagingLocationId):null);
      setAutoPickThreshold(
        result.autoPickWithoutConfirmMaxQuantity && result.autoPickWithoutConfirmMaxQuantity > 0
          ? String(Math.floor(result.autoPickWithoutConfirmMaxQuantity))
          : '',
      );
      toast.success('Depo üretim transfer ayarları kaydedildi.');
    }catch(e){toast.error(e instanceof Error?e.message:'Ayar kaydedilemedi.');}
    finally{setBusy(false);}
  };
  return <PolicySection
    code="LOC_04"
    icon={<Warehouse className="size-4" strokeWidth={1.75}/>}
    title="Depo varsayılan üretim transfer rafları"
    description="Üretim hedef rafı ve üretim iptal/iade rafı yalnız üretim transferi akışında kullanılır; normal depolar arası transfer ayarlarını değiştirmez. İptal iade görevinde satırın hedefi, ürünün toplandığı raf olarak önerilir ve görevde değiştirilebilir."
  >
    <div className="grid items-end gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <PolicyField label="Depo">
        <div className="wms-ops-field-shell">
          <PagedAppDropdown<WarehouseOption> queryKey={['production-location-warehouse',branchCode]} fetchPage={r=>warehouseTransferApi.warehouses(r,branchCode)} toOption={x=>({value:String(x.id),label:`${x.warehouseCode} · ${x.warehouseName}`})} value={warehouseValue} onValueChange={setWarehouseValue} placeholder="Depo seçin" searchable className={OPS_SELECT_TRIGGER_CLASS}/>
        </div>
      </PolicyField>
      <PolicyField
        label="Toplama sanal rafı"
        hint="Depo görevlisinin üretim için topladığı ürünler, teslim alınana veya iade edilene kadar bu bekleme rafında tutulur."
      >
        <div className="wms-ops-field-shell">
          <PagedAppDropdown<LocationOption> queryKey={['production-picking-staging-location',warehouseId]} fetchPage={r=>warehouseTransferApi.locations(r,warehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`})} enabled={warehouseId>0} dependencies={[warehouseId]} selectedOption={pickingStagingLocationOption} value={pickingStagingLocationValue} onValueChange={setPickingStagingLocationValue} placeholder="Raf seçin" searchable className={OPS_SELECT_TRIGGER_CLASS}/>
        </div>
      </PolicyField>
      <PolicyField
        label="Varsayılan üretim transfer rafı"
        hint="Üretime teslim edilen ürünlerin hedef rafı satırda belirtilmemişse bu raf otomatik kullanılır."
      >
        <div className="wms-ops-field-shell">
          <PagedAppDropdown<LocationOption> queryKey={['production-default-target-location',warehouseId]} fetchPage={r=>warehouseTransferApi.locations(r,warehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`})} enabled={warehouseId>0} dependencies={[warehouseId]} selectedOption={productionLocationOption} value={productionLocationValue} onValueChange={setProductionLocationValue} placeholder="Raf seçin" searchable className={OPS_SELECT_TRIGGER_CLASS}/>
        </div>
      </PolicyField>
      <PolicyField
        label="Varsayılan üretim iptal/iade rafı"
        hint="İptal iade görevinde satır hedefi ürünün toplandığı raftır. Bu alan depo varsayılanıdır; görevdeki öneriyi değiştirmez ve normal DAT ayarını etkilemez."
      >
        <div className="wms-ops-field-shell">
          <PagedAppDropdown<LocationOption> queryKey={['production-return-location',warehouseId]} fetchPage={r=>warehouseTransferApi.locations(r,warehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`})} enabled={warehouseId>0} dependencies={[warehouseId]} selectedOption={returnLocationOption} value={returnLocationValue} onValueChange={setReturnLocationValue} placeholder="Raf seçin" searchable className={OPS_SELECT_TRIGGER_CLASS}/>
        </div>
      </PolicyField>
      <OpsActionButton
        variant="secondary"
        disabled={warehouseId<=0}
        loading={busy}
        loadingLabel={<><Save className="size-4"/>Kaydediliyor…</>}
        onClick={()=>void save()}
      >
        <Save className="size-4"/>Kaydet
      </OpsActionButton>
    </div>
    <div className="mt-4 grid items-end gap-4 xl:grid-cols-[minmax(0,16rem)_1fr]">
      <PolicyField label="Onaysız toplama eşiği (adet)">
        <AppInput
          inputMode="numeric"
          pattern="[0-9]*"
          value={autoPickThreshold}
          onChange={(event) => setAutoPickThreshold(event.target.value.replace(/[^\d]/g, ''))}
          placeholder="Kapalı"
          disabled={warehouseId <= 0}
        />
      </PolicyField>
      <p className="pb-2 text-sm text-[var(--wms-app-text-muted)]">
        Serisiz stokta varsayılan miktar bu eşiğe eşit veya küçükse miktar popup&apos;ı açılmadan toplanır. Boş bırakılırsa her zaman miktar sorulur.
      </p>
    </div>
  </PolicySection>;
}

type BooleanPolicyKey={[K in keyof ProductionTransferPolicy]:ProductionTransferPolicy[K] extends boolean?K:never}[keyof ProductionTransferPolicy];

function PolicySection({code,icon,title,description,children}:{code:string;icon:ReactNode;title:ReactNode;description?:ReactNode;children:ReactNode}){
  return <section className="wms-ops-form-card wms-ops-pt-policy-card overflow-hidden rounded-none border border-[var(--wms-ops-card-border)]">
    <header className="wms-ops-pt-policy-card__head">
      <span className="wms-ops-pt-policy-card__icon">{icon}</span>
      <div className="wms-ops-pt-policy-card__heading">
        <h2 className="wms-ops-pt-terminal__title">{title}</h2>
        {description?<p className="wms-ops-pt-policy-hint mt-1">{description}</p>:null}
      </div>
      <span className="wms-ops-code-badge shrink-0">{code}</span>
    </header>
    <div className="wms-ops-pt-policy-card__body">{children}</div>
  </section>;
}

function PolicyField({label,hint,htmlFor,className,children,guideKey,value,currentValue}:{label:ReactNode;hint?:ReactNode;htmlFor?:string;className?:string;children:ReactNode;guideKey?:string;value?:unknown;currentValue?:string}){
  return <div className={cn('min-w-0 space-y-1.5',className)}>
    {htmlFor
      ?<label className="wms-ops-pt-policy-label" htmlFor={htmlFor}>{label}</label>
      :<span className="wms-ops-pt-policy-label">{label}</span>}
    {children}
    {hint?<span className="wms-ops-pt-policy-hint">{hint}</span>:null}
    {guideKey?<ParameterFieldGuide guidance={parameterGuidance('production',guideKey,value)} currentValue={currentValue??String(value)}/>:null}
  </div>;
}

function PolicyCheckRow({checked,onCheckedChange,label,guideKey}:{checked:boolean;onCheckedChange:(value:boolean)=>void;label:string;guideKey:string}){
  return <ParameterToggleCard title={label} checked={checked} onCheckedChange={onCheckedChange} guidance={parameterToggleGuidance('production',guideKey)}/>;
}

function PolicyChoice({checked,onSelect,title,text}:{checked:boolean;onSelect:()=>void;title:string;text:string}){
  return <div
    role="radio"
    aria-checked={checked}
    tabIndex={0}
    className={cn('wms-ops-pt-policy-choice',checked&&'wms-ops-pt-policy-choice--on')}
    onClick={onSelect}
    onKeyDown={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();onSelect();}}}
  >
    <OpsSkinCheckbox checked={checked} onCheckedChange={onSelect} aria-label={title} className="mt-0.5"/>
    <span className="min-w-0">
      <span className="wms-ops-pt-policy-choice__title">{title}</span>
      <span className="wms-ops-pt-policy-choice__text">{text}</span>
    </span>
  </div>;
}

function PolicyCallout({title,text}:{title:string;text:string}){
  return <div className="wms-ops-pt-policy-callout mt-4">
    <ShieldAlert className="wms-ops-pt-policy-callout__icon size-4" strokeWidth={1.75}/>
    <span className="min-w-0">
      <span className="wms-ops-pt-policy-callout__title">{title}</span>
      <span className="wms-ops-pt-policy-callout__text">{text}</span>
    </span>
  </div>;
}
