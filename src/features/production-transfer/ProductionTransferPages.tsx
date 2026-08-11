import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, ChevronDown, ChevronRight, ClipboardList, Factory, PackageCheck, Play, RefreshCw, Rows3, Save, Settings2, ShieldAlert, Trash2, UserPlus, Warehouse } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
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
import { warehouseTransferApi, transferApiFor } from '@/features/warehouse-transfer-v2/api/warehouse-transfer.api';
import { productionTransferApi, type ProductionTask, type ProductionTaskBoard, type ProductionTransferPolicy } from './api';
import { analyzeProductionCancellationReadiness } from './production-transfer-cancellation';
import { sumTransferPickedQuantity } from './production-transfer-cancellation-loader';
import { computeProductionTaskProgress, taskLineageHasProgress } from './production-transfer-task-progress';
import { ProductionTransferCancellationPanel } from './components/ProductionTransferCancellationPanel';
import { ProductionTransferExecutionPage } from './components/ProductionTransferExecutionPage';
import { ProductionTransferReturnSection } from './components/ProductionTransferReturnSection';
import { ProductionTaskSourceLocationCell } from './components/ProductionTaskSourceLocationCell';
import { ProductionTaskStartShortageDialog } from './components/ProductionTaskStartShortageDialog';
import { useProductionTaskSourceAvailability } from './hooks/useProductionTaskSourceAvailability';
import { useProductionTaskStart } from './hooks/useProductionTaskStart';
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
  return <ProductionTransferExecutionPage/>;
}
export function ProductionTransferPolicyPage(){
  const {t,moduleReady}=useModuleTranslation('production-transfer');
  const branchCode=useAuthStore(x=>x.branch?.code??'0');
  const[form,setForm]=useState<ProductionTransferPolicy>();
  const[busy,setBusy]=useState(false);
  useEffect(()=>{void productionTransferApi.policy(branchCode).then(setForm).catch((e:Error)=>toast.error(e.message));},[branchCode]);
  if(!moduleReady||!form)return <section className="wms-ops-form wms-ops-pt-policy mx-auto max-w-6xl px-4 py-16"><OpsLoadingState code="POLICY" message={t('policy.loading',{defaultValue:'Politika yükleniyor…'})}/></section>;
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

const TASK_TYPE_LABELS: Record<string, string> = {
  Pick: 'Toplama', Dispatch: 'Sevk', Receive: 'Kabul', Putaway: 'Yerleştirme',
  CancellationReturn: 'İptal İadesi',
};
const taskTypeLabel = (type: string): string => TASK_TYPE_LABELS[type] ?? type;

export function ProductionTaskPanel(){
  const id=Number(useParams().id);
  const currentUserId=useAuthStore(x=>x.user?.id);
  const branchCode=useAuthStore(x=>x.branch?.code??'0');
  const{can}=usePermissionAccess();
  const queryClient=useQueryClient();
  const boardQueryKey=useMemo(()=>['production-transfer','board',id] as const,[id]);
  const boardQuery=useQuery({queryKey:boardQueryKey,queryFn:()=>productionTransferApi.taskBoard(id),enabled:Number.isFinite(id)&&id>0});
  const detailQuery=useQuery({queryKey:['production-transfer','detail',id],queryFn:()=>transferApiFor('production').detail(id),enabled:Number.isFinite(id)&&id>0});
  const board=boardQuery.data;
  const detail=detailQuery.data;
  const{getAvailable:sourceAvailable,isLoading:sourceAvailabilityLoading}=useProductionTaskSourceAvailability(board,detail,branchCode);
  const[selectedUsers,setSelectedUsers]=useState<Record<number,number>>({});
  const[handoffReasons,setHandoffReasons]=useState<Record<number,string>>({});
  const[assignmentTaskId,setAssignmentTaskId]=useState<number|''>('');
  const[expandedWorkloadUserIds,setExpandedWorkloadUserIds]=useState<Set<number>>(new Set());
  const toggleWorkloadExpanded=(userId:number)=>setExpandedWorkloadUserIds(current=>{
    const next=new Set(current);
    if(next.has(userId))next.delete(userId);else next.add(userId);
    return next;
  });
  const[busy,setBusy]=useState(false);
  const canAssign=can('WMS.PRODUCTION_TRANSFER.ASSIGN');
  const canCancel=can('WMS.PRODUCTION_TRANSFER.CANCEL');
  const[policy,setPolicy]=useState<ProductionTransferPolicy>();
  useEffect(()=>{
    if(!Number.isFinite(id)||id<=0)return;
    void productionTransferApi.policy(branchCode).then(setPolicy).catch((e:Error)=>toast.error(e.message));
  },[branchCode,id]);
  const run=useCallback(async(action:()=>Promise<ProductionTaskBoard>)=>{
    setBusy(true);
    try{
      queryClient.setQueryData(boardQueryKey,await action());
      void queryClient.invalidateQueries({queryKey:['production-task-source-locations']});
      await queryClient.refetchQueries({queryKey:['production-transfer','detail',id]});
      void queryClient.invalidateQueries({queryKey:['wt-op-source']});
      void queryClient.invalidateQueries({queryKey:['production-transfer','picked-sources',id]});
    }catch(e){
      toast.error(e instanceof Error?e.message:'İşlem başarısız.');
    }finally{
      setBusy(false);
    }
  },[boardQueryKey,id,queryClient]);
  const refreshBoard=useCallback(()=>void queryClient.invalidateQueries({queryKey:boardQueryKey}),[boardQueryKey,queryClient]);
  const{
    shortageDialog,
    checkingTaskId,
    requestStart,
    confirmPartialStart,
    cancelPartialStart,
  }=useProductionTaskStart({transferId:id,run});
  if(boardQuery.isLoading||detailQuery.isLoading)return <section className="animate-pulse rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5"><div className="h-4 w-40 rounded bg-[var(--wms-app-border)]"/><div className="mt-3 h-24 rounded-xl bg-[var(--wms-app-border)]/60"/></section>;
  if(!board||board.tasks.length===0)return null;
  const transferPickedQuantity=detailQuery.data?sumTransferPickedQuantity(detailQuery.data):0;
  const cancellationReadiness=analyzeProductionCancellationReadiness(board,{transferPickedQuantity});
  const activeReturnTask=board.tasks.find(task=>
    task.taskType==='CancellationReturn'
    &&task.assignments.some(assignment=>assignment.userId===currentUserId)
    &&!['Completed','Cancelled'].includes(task.status));
  return <section className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--wms-brand-primary)]">Üretim transfer görevi</p><h2 className="text-xl font-black">{board.documentNo}</h2></div><span className="rounded-full border border-[var(--wms-app-border)] px-3 py-1 text-xs font-bold">{board.transferStatus}</span></div>
    {activeReturnTask?(<ProductionTransferReturnSection transferId={id} documentNo={board.documentNo} onBoardChange={nextBoard=>queryClient.setQueryData(boardQueryKey,nextBoard)}/>):null}
    <div className="space-y-4">{board.tasks.filter(task=>!activeReturnTask||task.taskId!==activeReturnTask.taskId).map(task=><article key={task.taskId} className="rounded-xl border border-[var(--wms-app-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{task.taskNo}</strong>{task.taskType==='CancellationReturn'?<span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-500">{taskTypeLabel(task.taskType)}</span>:<span className="ml-2 text-xs text-[var(--wms-app-text-muted)]">{taskTypeLabel(task.taskType)}</span>}<span className="ml-2 text-xs text-[var(--wms-app-text-muted)]">{task.status}</span>{task.completedAtUtc&&<span className="ml-2 text-xs text-[var(--wms-app-text-muted)]">· {new Date(task.completedAtUtc).toLocaleString('tr-TR')}</span>}</div>
        <div className="flex flex-wrap gap-2">{task.taskType!=='CancellationReturn'&&task.lines.some(x=>x.missingQuantity>0||x.processedQuantity>0&&x.processedQuantity<x.requestedQuantity)&&!['Completed','Cancelled'].includes(task.status)&&<button disabled={busy} onClick={()=>void run(()=>productionTransferApi.refreshRoute(id,task.taskId))} className="inline-flex items-center gap-2 rounded-lg border border-amber-500 px-3 py-2 text-xs font-bold text-amber-500"><RefreshCw className="size-4"/>Rotayı güncelle</button>}{task.assignments.some(x=>x.userId===currentUserId)&&!['InProgress','PartiallyCompleted','Completed','Cancelled'].includes(task.status)&&<button disabled={busy||checkingTaskId===task.taskId} onClick={()=>void requestStart(task.taskId,task.taskNo)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--wms-brand-primary)] px-3 py-2 text-xs font-bold text-[var(--wms-brand-on-primary)]"><Play className="size-4"/>Bu işi yapıyorum</button>}</div></div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase text-[var(--wms-app-text-muted)]"><tr><th className="p-2">Stok</th><th className="p-2">Kaynak raf</th><th className="p-2 text-right">İstenen</th><th className="p-2 text-right">Rezerve</th><th className="p-2 text-right">Eksik</th><th className="p-2 text-right">Toplanan</th></tr></thead><tbody>{task.lines.map(line=><tr key={line.taskLineId} className="border-t border-[var(--wms-app-border)]"><td className="p-2"><strong>{line.stockCode}</strong><div className="text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</div></td><ProductionTaskSourceLocationCell line={line} getAvailable={sourceAvailable} loading={sourceAvailabilityLoading}/><td className="p-2 text-right">{line.requestedQuantity}</td><td className="p-2 text-right text-emerald-500">{line.reservedQuantity}</td><td className="p-2 text-right text-red-500">{line.missingQuantity}</td><td className="p-2 text-right">{line.processedQuantity}</td></tr>)}</tbody></table></div>
      {task.assignments.length>0&&<div className="mt-3 flex flex-wrap items-center gap-2">{task.assignments.map(a=><span key={a.userId} className="inline-flex items-center gap-2 rounded-full border border-[var(--wms-app-border)] px-3 py-1 text-xs">{a.username}{a.isPrimary?' · Birincil':''}</span>)}</div>}
    </article>)}</div>
    {canAssign&&board.tasks.length>0&&(()=>{
      const assignableTasks=board.tasks.filter(t=>!['Completed','Cancelled'].includes(t.status));
      // ÖNEMLİ: arama sadece assignableTasks içinde yapılmalı — board.tasks içinde ararsak,
      // önceki bir devir turunda seçilip artık Completed olmuş eski bir görevin id'si
      // assignmentTaskId'de saklı kalmışsa (kullanıcı tekrar seçim yapmadıysa), o eski/kapanmış
      // görev sessizce bulunup üzerinde işlem yapılır — tam da yaşanan "yanlış görevde sessizce
      // silindi" sorununun nedeni budur. board.tasks Id'ye göre artan sırada (en eski önce)
      // geldiği için, seçim yoksa/geçersizse en güncel (en son) atanabilir göreve odaklan.
      const task=assignableTasks.find(t=>t.taskId===assignmentTaskId)??assignableTasks[assignableTasks.length-1];
      // İş emri devirle bölünmüş olabilir (A kısmen yaptı, kalanı B'ye devretti) — iş emri henüz
      // bitmediğinden A'nın topladığı stok da iade kapsamına girmeli. Bu yüzden "iade gerekir mi"
      // sorusu tek görevin kendi satırlarına değil, previousTaskId zincirinin tamamına bakmalı.
      const lineageHasProgress=(t?:ProductionTask)=>t?taskLineageHasProgress(t,board.tasks):false;
      return <div className="mt-4 rounded-xl border border-[var(--wms-app-border)] p-4">
        <div className="mb-3 flex items-center gap-2 font-bold"><UserPlus className="size-4"/>Görev ataması</div>
        <select className="input mb-3 w-full sm:max-w-md" value={task?.taskId??''} onChange={e=>setAssignmentTaskId(Number(e.target.value))}>
          {assignableTasks.length===0&&<option value="">Atanabilir görev yok</option>}
          {assignableTasks.map(t=><option key={t.taskId} value={t.taskId}>{t.taskNo} · {t.status}{lineageHasProgress(t)?' · toplanmış stok var':''}</option>)}
        </select>
        {task&&<div className="flex flex-wrap items-center gap-2">
          {task.assignments.map(a=>{
            const hasProgress=lineageHasProgress(task);
            return <span key={a.userId} className="inline-flex items-center gap-2 rounded-full border border-[var(--wms-app-border)] px-3 py-1 text-xs">
              <span>{a.username}{a.isPrimary?' · Birincil':''}</span>
              <button title={hasProgress?'Toplanmış stok varken atama kaldırılamaz; kalan işi devredin veya eksik teslim ile tamamlayın':'Atamayı kaldır'} disabled={busy||hasProgress} onClick={()=>void run(()=>productionTransferApi.removeAssignment(id,task.taskId,a.userId))}><Trash2 className="size-3.5 text-red-500"/></button>
            </span>;
          })}
          <select className="input min-w-52" value={selectedUsers[task.taskId]??''} onChange={e=>setSelectedUsers(x=>({...x,[task.taskId]:Number(e.target.value)}))}><option value="">Depo çalışanı seçin</option>{board.eligibleAssignees.filter(u=>(u.warehouseIds.length===0||u.warehouseIds.includes(task.warehouseId))&&!task.assignments.some(a=>a.userId===u.userId)).map(u=><option key={u.userId} value={u.userId}>{u.username}</option>)}</select>
          <button disabled={busy||!selectedUsers[task.taskId]} onClick={()=>void run(()=>productionTransferApi.assignTask(id,task.taskId,selectedUsers[task.taskId]))} className="inline-flex items-center gap-2 rounded-lg border border-[var(--wms-brand-primary)] px-3 py-2 text-xs font-bold text-[var(--wms-brand-primary)]"><UserPlus className="size-4"/>Ata</button>
          {task.assignments.length>0&&task.lines.some(line=>line.processedQuantity<line.requestedQuantity)&&<><input className="input min-w-56" value={handoffReasons[task.taskId]??''} onChange={e=>setHandoffReasons(x=>({...x,[task.taskId]:e.target.value}))} placeholder="Devir nedeni (opsiyonel)"/><button disabled={busy||!selectedUsers[task.taskId]} onClick={()=>void run(()=>productionTransferApi.handoffTask(id,task.taskId,selectedUsers[task.taskId],handoffReasons[task.taskId]))} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"><UserPlus className="size-4"/>Kalan işi devret</button></>}
        </div>}
      </div>;
    })()}
    {canAssign&&board.workloads.length>0&&(()=>{
      const startedWorkloads=board.workloads.filter(w=>board.tasks.some(t=>t.startedBy===w.userId));
      if(startedWorkloads.length===0)return null;
      return <div className="mt-4 grid gap-2 md:grid-cols-3">{startedWorkloads.map(w=>{
      const myTasks=board.tasks.filter(t=>t.assignments.some(a=>a.userId===w.userId));
      const activeTask=myTasks.find(t=>t.status==='InProgress'&&t.startedBy===w.userId);
      const nonCancelledTasks=myTasks.filter(t=>t.status!=='Cancelled');
      const currentTask=activeTask??nonCancelledTasks[nonCancelledTasks.length-1];
      const currentProgress=currentTask?computeProductionTaskProgress(currentTask,board.tasks,w.userId):null;
      // Completed olsa da, eğer bu görev bir devirle başka bir göreve devam ediyorsa (başka bir
      // görev bunu previousTaskId ile referans veriyorsa) iş emri gerçekte bitmedi — "Tamamladı"
      // yerine "Devretti" göster, aksi halde işin bittiği yanlış izlenimi oluşur.
      const wasHandedOff=currentTask?.status==='Completed'&&board.tasks.some(t=>t.previousTaskId===currentTask.taskId);
      const currentLabel=activeTask?'Şu an yapıyor':wasHandedOff?'Devretti':currentTask?.status==='Completed'?'Tamamladı':'Bu transferdeki görev';
      const expanded=expandedWorkloadUserIds.has(w.userId);
      return <div key={w.userId} className="rounded-xl bg-[var(--wms-app-surface)] p-3 text-sm">
        <button type="button" onClick={()=>toggleWorkloadExpanded(w.userId)} className="flex w-full items-center justify-between gap-2 text-left">
          <strong>{w.username}</strong>
          {expanded?<ChevronDown className="size-4 text-[var(--wms-app-text-muted)]"/>:<ChevronRight className="size-4 text-[var(--wms-app-text-muted)]"/>}
        </button>
        <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">Atanan {w.assignedTaskCount} · Tamamlanan {w.completedTaskCount}</div>
        {currentProgress&&currentTask?<>
          <div className="mt-1 text-xs font-semibold text-[var(--wms-brand-primary)]">{currentLabel}: {currentTask.taskNo}</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--wms-app-border)]"><span className="block h-full bg-emerald-500" style={{width:`${Math.min(100,Math.max(0,currentProgress.percent))}%`}}/></div>
          <div className="mt-1 text-xs font-bold">{currentProgress.processed} / {currentProgress.planned} · %{currentProgress.percent}</div>
        </>:<div className="mt-2 text-xs text-[var(--wms-app-text-muted)]">Bu transferde aktif görev yok.</div>}
        {expanded&&<div className="mt-3 space-y-2 border-t border-[var(--wms-app-border)] pt-2">
          <div className="rounded-lg bg-[var(--wms-app-panel)] p-2 text-xs text-[var(--wms-app-text-muted)]">
            <div className="font-bold text-[var(--wms-app-text)]">Tüm görevlerde toplam</div>
            <div className="mt-1">{w.processedQuantity} / {w.plannedQuantity} · %{w.completionPercent}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[.65rem] font-bold uppercase tracking-wide text-[var(--wms-app-text-muted)]">Atanmış İşler ({myTasks.length})</div>
            {myTasks.length===0&&<p className="text-xs text-[var(--wms-app-text-muted)]">Atanmış görev yok.</p>}
            {myTasks.map(t=><div key={t.taskId} className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${t.taskId===currentTask?.taskId?'bg-[var(--wms-brand-primary)]/10 font-bold':''}`}>
              <span>{t.taskNo}</span><span className="text-[var(--wms-app-text-muted)]">{t.status}</span>
            </div>)}
          </div>
        </div>}
      </div>;
      })}</div>;
    })()}
    <ProductionTransferCancellationPanel
      transferId={id}
      transferStatus={board.transferStatus}
      sourceWarehouseId={board.sourceWarehouseId}
      readiness={cancellationReadiness}
      policy={policy}
      canCancel={canCancel}
      canAssign={canAssign}
      busy={busy}
      onRun={run}
      onCancelled={refreshBoard}
    />
    {shortageDialog&&(
      <ProductionTaskStartShortageDialog
        taskNo={shortageDialog.taskNo}
        shortages={shortageDialog.shortages}
        busy={busy}
        onConfirm={confirmPartialStart}
        onCancel={cancelPartialStart}
      />
    )}
  </section>;
}

function TransferReturnLocationPanel({branchCode}:{branchCode:string}){
  const[warehouseValue,setWarehouseValue]=useState<string|null>(null);
  const[returnLocationValue,setReturnLocationValue]=useState<string|null>(null);
  const[productionLocationValue,setProductionLocationValue]=useState<string|null>(null);
  const[pickingStagingLocationValue,setPickingStagingLocationValue]=useState<string|null>(null);
  const[autoPickThreshold,setAutoPickThreshold]=useState('');
  const[busy,setBusy]=useState(false);
  const warehouseId=Number(warehouseValue||0);
  useEffect(()=>{
    if(!warehouseId){setReturnLocationValue(null);setProductionLocationValue(null);setPickingStagingLocationValue(null);setAutoPickThreshold('');return;}
    void productionTransferApi.returnSetting(warehouseId).then(x=>{
      setReturnLocationValue(x.defaultTransferReturnLocationId?String(x.defaultTransferReturnLocationId):null);
      setProductionLocationValue(x.defaultProductionTransferLocationId?String(x.defaultProductionTransferLocationId):null);
      setPickingStagingLocationValue(x.productionPickingStagingLocationId?String(x.productionPickingStagingLocationId):null);
      setAutoPickThreshold(
        x.autoPickWithoutConfirmMaxQuantity && x.autoPickWithoutConfirmMaxQuantity > 0
          ? String(Math.floor(x.autoPickWithoutConfirmMaxQuantity))
          : '',
      );
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
      setReturnLocationValue(result.defaultTransferReturnLocationId?String(result.defaultTransferReturnLocationId):null);
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
    description="Hedef raf satırda seçilmemişse üretim transfer rafı otomatik kullanılır. İptal iade rafı yalnız geri dönüş operasyonlarında kullanılır."
  >
    <div className="grid items-end gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <PolicyField label="Depo">
        <div className="wms-ops-field-shell">
          <PagedAppDropdown<WarehouseOption> queryKey={['production-location-warehouse',branchCode]} fetchPage={r=>warehouseTransferApi.warehouses(r,branchCode)} toOption={x=>({value:String(x.id),label:`${x.warehouseCode} · ${x.warehouseName}`})} value={warehouseValue} onValueChange={setWarehouseValue} placeholder="Depo seçin" searchable className={OPS_SELECT_TRIGGER_CLASS}/>
        </div>
      </PolicyField>
      <PolicyField label="Toplama sanal rafı">
        <div className="wms-ops-field-shell">
          <PagedAppDropdown<LocationOption> queryKey={['production-picking-staging-location',warehouseId]} fetchPage={r=>warehouseTransferApi.locations(r,warehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`})} enabled={warehouseId>0} dependencies={[warehouseId]} value={pickingStagingLocationValue} onValueChange={setPickingStagingLocationValue} placeholder="Raf seçin" searchable className={OPS_SELECT_TRIGGER_CLASS}/>
        </div>
      </PolicyField>
      <PolicyField label="Varsayılan üretim transfer rafı">
        <div className="wms-ops-field-shell">
          <PagedAppDropdown<LocationOption> queryKey={['production-default-target-location',warehouseId]} fetchPage={r=>warehouseTransferApi.locations(r,warehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`})} enabled={warehouseId>0} dependencies={[warehouseId]} value={productionLocationValue} onValueChange={setProductionLocationValue} placeholder="Raf seçin" searchable className={OPS_SELECT_TRIGGER_CLASS}/>
        </div>
      </PolicyField>
      <PolicyField label="Varsayılan iptal iade rafı">
        <div className="wms-ops-field-shell">
          <PagedAppDropdown<LocationOption> queryKey={['production-return-location',warehouseId]} fetchPage={r=>warehouseTransferApi.locations(r,warehouseId)} toOption={x=>({value:String(x.id),label:`${x.code} · ${x.name}`})} enabled={warehouseId>0} dependencies={[warehouseId]} value={returnLocationValue} onValueChange={setReturnLocationValue} placeholder="Raf seçin" searchable className={OPS_SELECT_TRIGGER_CLASS}/>
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
