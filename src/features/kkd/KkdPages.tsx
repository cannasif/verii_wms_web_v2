import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Boxes,
  Check,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  Gauge,
  Grid3X3,
  PackageCheck,
  RefreshCw,
  Save,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { AppDropdownOption } from '@/components/shared/AppDropdown';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsProcessHub, type OpsProcessHubPhase } from '@/components/shared/OpsProcessHub';
import { OpsSelect } from '@/components/shared/OpsSelect';
import { OpsStatusBadge, inferOpsStatusTone } from '@/components/shared/OpsStatusBadge';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { OPS_SELECT_TRIGGER_CLASS } from '@/components/shared/ops-field-styles';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { cn } from '@/lib/utils';
import {
  KKD_CELL,
  KKD_HEAD_CELL,
  KkdCallout,
  KkdCheckRow,
  KkdField,
  KkdMetric,
  KkdPage,
  KkdPanel,
  KkdTableShell,
} from './kkd-ops-ui';
import { kkdApi, type KkdEntitlementResult, type KkdPolicy, type KkdRemainingEntitlement } from './kkd-api';
import { KkdMatrixManager } from './KkdMatrixManager';
import { KkdOverrideManager } from './KkdOverrideManager';

export function KkdOverviewPage(): ReactElement {
  const { can } = usePermissionAccess();
  const departments = useQuery({ queryKey: ['kkd', 'departments'], queryFn: kkdApi.departments });
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const matrices = useQuery({ queryKey: ['kkd', 'matrices'], queryFn: kkdApi.matrices });
  const distributions = useQuery({ queryKey: ['kkd', 'distributions'], queryFn: kkdApi.distributions });
  const materialRequests = useQuery({
    queryKey: ['kkd', 'material-requests', 'configuration'],
    queryFn: kkdApi.materialRequestConfiguration,
    enabled: can('WMS.KKD.DISTRIBUTION.OPERATE'),
  });

  const count = (value?: unknown[]): string | undefined => (value ? String(value.length) : undefined);
  const pendingApprovals = distributions.data?.filter((item) => item.excessApprovalStatus === 'Pending').length ?? 0;

  const phases: OpsProcessHubPhase[] = [
    {
      key: 'define',
      number: '01',
      title: 'Tanım ve hak kurgusu',
      description: 'Organizasyon, personel ve KKD hak matrisini kurup teslim öncesi hak sonucunu doğrulayın.',
      sectionCode: 'KKD-DEF',
      items: [
        {
          key: 'definitions',
          code: 'KKD.DEF',
          href: '/warehouse/kkd/definitions',
          icon: Grid3X3,
          title: 'Tanımlar ve hak matrisi',
          description: 'Departman, rol, personel ve tüm yaşam döngüsü kuralları tek matris motorunda.',
          badge: count(matrices.data) ? `${count(matrices.data)} matris` : undefined,
        },
        {
          key: 'entitlement',
          code: 'KKD.ENT',
          href: '/warehouse/kkd/entitlement',
          icon: BadgeCheck,
          title: 'Hak sorgulama',
          description: 'Stok özel/grup kuralı, dönem, sıklık ve ek hak sonucunu teslimden önce görün.',
          badge: count(employees.data) ? `${count(employees.data)} personel` : undefined,
        },
      ],
    },
    {
      key: 'operate',
      number: '02',
      title: 'Dağıtım ve ambar çıkışı',
      description: 'Açık Netsis siparişinden teslim açın; fiziksel çıkış ve hak tüketimi aynı belge zincirinde ilerlesin.',
      sectionCode: 'KKD-OPS',
      items: [
        ...(materialRequests.data?.isEnabled
          ? [
              {
                key: 'material-requests',
                code: 'KKD.MRQ',
                href: '/warehouse/production-transfers/material-requests',
                icon: ClipboardList,
                title: 'Malzeme talep siparişleri',
                description: 'Personel kartından bağlı carinin canlı Netsis açık siparişlerini getirip dağıtıma hazırlayın.',
              },
            ]
          : []),
        {
          key: 'distribution-new',
          code: 'KKD.NEW',
          href: '/warehouse/kkd/distributions/new',
          icon: PackageCheck,
          title: 'Yeni KKD dağıtımı',
          description: 'Açık siparişten teslim ve fiziksel ambar çıkışını tek akışta başlatın.',
        },
        {
          key: 'distributions',
          code: 'KKD.DST',
          href: '/warehouse/kkd/distributions',
          icon: Boxes,
          title: 'Dağıtım kayıtları',
          description: 'Teslim, hak tüketimi, kota aşım onayı ve ERP ambar çıkış sonucunu izleyin.',
          badge: pendingApprovals > 0 ? `${pendingApprovals} onay bekliyor` : count(distributions.data),
        },
      ],
    },
    {
      key: 'manage',
      number: '03',
      title: 'İzleme ve yönetim',
      description: 'Kullanım, doğrulama kayıtları ve şube süreç parametrelerini yönetin.',
      sectionCode: 'KKD-MGMT',
      items: [
        {
          key: 'reports',
          code: 'KKD.RPT',
          href: '/warehouse/kkd/reports',
          icon: Gauge,
          title: 'KKD raporları',
          description: 'Departman, rol veya KKD grubu bazında teslim, hak ve sipariş fazlasını izleyin.',
          badge: count(departments.data) ? `${count(departments.data)} departman` : undefined,
        },
        {
          key: 'policy',
          code: 'KKD.POL',
          href: '/warehouse/kkd/policy',
          icon: Settings2,
          title: 'KKD süreç politikası',
          description: 'Sipariş zorunluluğu, hak üstü teslim ve operasyon güvenlik kurallarını yönetin.',
          featured: true,
        },
      ],
    },
  ];

  return (
    <OpsProcessHub
      eyebrow="KKD / Kişisel Koruyucu Donanım"
      title="KKD Süreç Merkezi"
      description="Organizasyon, hak matrisi, teslim ve Netsis ambar çıkışını tek izlenebilir akışta yönetin."
      path="/warehouse/kkd"
      phases={phases}
      callout={{
        title: 'Süreç sınırı',
        text: 'Oturum şubesi, personel carisi, canlı sipariş bakiyesi, stok eşleşmesi, seri/lot politikası, kaynak raf ve gerçek ambar çıkışı doğrulamaları politikadan bağımsız olarak her dağıtımda uygulanır.',
      }}
    />
  );
}

type PolicyForm = Omit<KkdPolicy, 'id' | 'branchCode' | 'updatedBy' | 'updatedDate'>;

const POLICY_DEFAULTS: PolicyForm = {
  enableMaterialRequestOrderFlow: true,
  requireOpenOrder: true,
  allowOpenOrderExcess: true,
  allowMultipleOrdersPerDistribution: true,
  requireEmployeeUserLink: false,
  allowFutureDatedDistribution: false,
  requireManagerApprovalForExcess: true,
};

const toPolicyForm = (value: KkdPolicy): PolicyForm => ({
  enableMaterialRequestOrderFlow: value.enableMaterialRequestOrderFlow,
  requireOpenOrder: value.requireOpenOrder,
  allowOpenOrderExcess: value.allowOpenOrderExcess,
  allowMultipleOrdersPerDistribution: value.allowMultipleOrdersPerDistribution,
  requireEmployeeUserLink: value.requireEmployeeUserLink,
  allowFutureDatedDistribution: value.allowFutureDatedDistribution,
  requireManagerApprovalForExcess: value.requireManagerApprovalForExcess,
});

export function KkdPolicyPage(): ReactElement {
  const query = useQuery({ queryKey: ['kkd', 'policy'], queryFn: kkdApi.policy });
  const [form, setForm] = useState<PolicyForm>(POLICY_DEFAULTS);

  useEffect(() => {
    if (query.data) setForm(toPolicyForm(query.data));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () => kkdApi.savePolicy(form),
    onSuccess: (value) => {
      setForm(toPolicyForm(value));
      toast.success('KKD süreç politikası kaydedildi.');
    },
    onError: (error) => toast.error(message(error)),
  });

  const set = (key: keyof PolicyForm, value: boolean): void =>
    setForm((current) => ({ ...current, [key]: value }));

  const orderChannel: Array<[keyof PolicyForm, string, string]> = [
    [
      'enableMaterialRequestOrderFlow',
      'Malzeme talep siparişlerini etkinleştir',
      'Açık olduğunda personel kartından bağlı carinin canlı Netsis açık siparişleri okunabilir.',
    ],
    [
      'requireOpenOrder',
      'Açık Netsis siparişi zorunlu',
      'Açık olduğunda siparişsiz KKD dağıtımı oluşturulamaz.',
    ],
    [
      'allowMultipleOrdersPerDistribution',
      'Tek dağıtımda birden fazla sipariş',
      'Kapalı olduğunda bütün kalemler aynı Netsis siparişine ait olmalıdır.',
    ],
  ];

  const quotaControls: Array<[keyof PolicyForm, string, string]> = [
    [
      'allowOpenOrderExcess',
      'Açık siparişle hak üstü teslime izin ver',
      'Kapalı olduğunda yalnızca hesaplanan KKD hakkı kadar teslim yapılabilir.',
    ],
    [
      'requireManagerApprovalForExcess',
      'Kota aşımında yönetici fiziksel onayı',
      'Açık olduğunda hak üstü KKD için ambar çıkışı, yetkili yönetici onayı gelmeden serbest bırakılamaz.',
    ],
  ];

  const operationGuards: Array<[keyof PolicyForm, string, string]> = [
    [
      'requireEmployeeUserLink',
      'Personel–WMS kullanıcısı bağlantısı zorunlu',
      'Açık olduğunda kullanıcı hesabına bağlanmamış personele teslim yapılamaz.',
    ],
    [
      'allowFutureDatedDistribution',
      'İleri tarihli dağıtıma izin ver',
      'Kapalı olduğunda belge tarihi bugünden ileri seçilemez.',
    ],
  ];

  const checkGrid = (rows: Array<[keyof PolicyForm, string, string]>): ReactElement => (
    <div className="grid gap-2.5 lg:grid-cols-2">
      {rows.map(([key, title, description]) => (
        <KkdCheckRow
          key={key}
          checked={form[key]}
          onCheckedChange={(checked) => set(key, checked)}
          disabled={query.isLoading || mutation.isPending}
          title={title}
          description={description}
        />
      ))}
    </div>
  );

  return (
    <KkdPage
      title="KKD Süreç Politikası"
      description="Şube bazında dağıtım ön koşullarını yönetin; değişiklikler yeni dağıtımlarda servis katmanında zorunlu uygulanır."
      className="max-w-6xl"
    >
      {query.isLoading ? (
        <KkdPanel title="Politika" code="KKD.POL" icon={<Settings2 className="size-4" strokeWidth={1.75} />}>
          <OpsLoadingState code="POLICY" message="Şube KKD süreç politikası yükleniyor…" />
        </KkdPanel>
      ) : (
        <>
          <KkdPanel
            code="ORD_01"
            icon={<ClipboardCheck className="size-4" strokeWidth={1.75} />}
            title="Sipariş kanalı"
            description="Teslimin hangi sipariş kaynağından ve kaç sipariş üzerinden açılabileceğini belirler."
          >
            {checkGrid(orderChannel)}
          </KkdPanel>

          <KkdPanel
            code="QTA_02"
            icon={<ShieldCheck className="size-4" strokeWidth={1.75} />}
            title="Hak ve kota kontrolü"
            description="Hesaplanan KKD hakkının üzerine çıkılabilmesi ve bunun onay zincirini yönetir."
          >
            {checkGrid(quotaControls)}
          </KkdPanel>

          <KkdPanel
            code="OPS_03"
            icon={<Users className="size-4" strokeWidth={1.75} />}
            title="Operasyon güvenliği"
            description="Personel–kullanıcı bağlantısı ve belge tarihi kısıtlarını yönetir."
          >
            {checkGrid(operationGuards)}
            <KkdCallout
              tone="warn"
              icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}
              title="Kapatılamayan kontroller"
              className="mt-4"
            >
              Oturum şubesi, personel carisi, canlı sipariş bakiyesi, stok eşleşmesi, seri/lot politikası, kaynak raf
              ve gerçek ambar çıkışı doğrulamaları her zaman uygulanır.
            </KkdCallout>
          </KkdPanel>

          <div className="wms-ops-form-card wms-ops-data-grid-shell flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-none border border-[var(--wms-ops-card-border)] px-4 py-3 shadow-none sm:px-6">
            <p className="min-w-0 text-[0.72rem] leading-5 text-[var(--wms-app-text-muted)]">
              Değişiklikler yalnızca oturum şubesi için geçerlidir ve kaydettiğiniz anda yeni dağıtımlara uygulanır.
            </p>
            <OpsActionButton
              variant="primary"
              loading={mutation.isPending}
              loadingLabel={
                <>
                  <Save className="size-3.5 shrink-0" />
                  Kaydediliyor…
                </>
              }
              onClick={() => mutation.mutate()}
            >
              <Save className="size-3.5 shrink-0" />
              Politikayı kaydet
            </OpsActionButton>
          </div>
        </>
      )}
    </KkdPage>
  );
}

type DefinitionTab = 'department' | 'role' | 'employee' | 'matrix' | 'override';

const DEFINITION_TABS: Array<[DefinitionTab, string]> = [
  ['department', 'Departman'],
  ['role', 'Rol'],
  ['employee', 'Personel'],
  ['matrix', 'Hak matrisi'],
  ['override', 'Personel ek hakları'],
];

export function KkdDefinitionsPage(): ReactElement {
  const qc = useQueryClient();
  const [tab, setTab] = useState<DefinitionTab>('department');
  const departments = useQuery({ queryKey: ['kkd', 'departments'], queryFn: kkdApi.departments });
  const roles = useQuery({ queryKey: ['kkd', 'roles'], queryFn: () => kkdApi.roles() });
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const matrices = useQuery({ queryKey: ['kkd', 'matrices'], queryFn: kkdApi.matrices });
  const [form, setForm] = useState<Record<string, string>>({
    isActive: 'true',
    employmentStartDate: new Date().toLocaleDateString('en-CA'),
    initialQuantity: '1',
    recurringQuantity: '1',
    recurringInterval: '1',
  });
  const change = (key: string, value: string): void => setForm((current) => ({ ...current, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      // Ops seçim bileşenleri native `required` doğrulaması yapmadığından zorunlu
      // ilişkiler burada kontrol edilir; aksi halde sunucuya 0 id gönderilir.
      if (tab !== 'department' && !n(form.departmentId)) throw new Error('Departman seçilmelidir.');
      if ((tab === 'employee' || tab === 'matrix') && !n(form.roleId)) throw new Error('Rol seçilmelidir.');
      if ((tab === 'employee' || tab === 'matrix') && !n(form.customerId)) throw new Error('Entegre cari seçilmelidir.');
      if (tab === 'matrix' && !form.groupCode) throw new Error('Stok grubu seçilmelidir.');
      if (tab === 'department') return kkdApi.saveDepartment({ code: form.code, name: form.name, isActive: true });
      if (tab === 'role') return kkdApi.saveRole({ departmentId: n(form.departmentId), code: form.code, name: form.name, isActive: true });
      if (tab === 'employee') {
        return kkdApi.saveEmployee({
          customerId: n(form.customerId),
          userId: n(form.userId) || null,
          employeeCode: form.code,
          firstName: form.firstName,
          lastName: form.lastName,
          departmentId: n(form.departmentId),
          roleId: n(form.roleId),
          qrCode: form.qrCode,
          employmentStartDate: form.employmentStartDate,
          isActive: true,
        });
      }
      return kkdApi.saveMatrix({
        customerId: n(form.customerId),
        departmentId: n(form.departmentId),
        roleId: n(form.roleId),
        code: form.code,
        name: form.name,
        effectiveFrom: form.effectiveFrom || null,
        effectiveTo: form.effectiveTo || null,
        isActive: true,
        description: form.description || null,
        rules: [
          {
            groupCode: form.groupCode,
            groupName: form.groupName || null,
            stockId: n(form.stockId) || null,
            standardCode: form.standardCode || null,
            standardName: null,
            annualIssueCount: n(form.annualIssueCount) || null,
            annualQuantity: n(form.annualQuantity) || null,
            maxCarryQuantity: n(form.maxCarryQuantity) || null,
            allowBulkIssue: form.allowBulkIssue === 'true',
            isMandatory: form.isMandatory === 'true',
            sortOrder: 1,
            isActive: true,
            description: null,
            phases: [
              {
                phaseType: 'Initial',
                offsetMonths: 0,
                quantity: n(form.initialQuantity),
                allowBulkIssue: form.allowBulkIssue === 'true',
                frequencyDays: n(form.frequencyDays) || null,
                quantityPerFrequency: n(form.frequencyQuantity) || null,
                periodType: null,
                periodInterval: null,
                sortOrder: 1,
                isActive: true,
              },
              {
                phaseType: 'AfterMonths',
                offsetMonths: n(form.afterMonths) || 3,
                quantity: n(form.afterQuantity) || 0,
                allowBulkIssue: form.allowBulkIssue === 'true',
                frequencyDays: null,
                quantityPerFrequency: null,
                periodType: null,
                periodInterval: null,
                sortOrder: 2,
                isActive: n(form.afterQuantity) > 0,
              },
              {
                phaseType: 'Recurring',
                offsetMonths: 0,
                quantity: n(form.recurringQuantity),
                allowBulkIssue: form.allowBulkIssue === 'true',
                frequencyDays: n(form.frequencyDays) || null,
                quantityPerFrequency: n(form.frequencyQuantity) || null,
                periodType: form.periodType || 'Year',
                periodInterval: n(form.recurringInterval) || 1,
                sortOrder: 3,
                isActive: true,
              },
            ],
          },
        ],
      });
    },
    onSuccess: async () => {
      toast.success('KKD tanımı kaydedildi.');
      setForm({
        isActive: 'true',
        employmentStartDate: new Date().toLocaleDateString('en-CA'),
        initialQuantity: '1',
        recurringQuantity: '1',
        recurringInterval: '1',
      });
      await qc.invalidateQueries({ queryKey: ['kkd'] });
    },
    onError: (error) => toast.error(message(error)),
  });

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    mutation.mutate();
  };

  const listRows = rows(tab, {
    departments: departments.data,
    roles: roles.data,
    employees: employees.data,
    matrices: matrices.data,
  });
  const listLoading =
    (tab === 'department' && departments.isLoading) ||
    (tab === 'role' && roles.isLoading) ||
    (tab === 'employee' && employees.isLoading) ||
    (tab === 'matrix' && matrices.isLoading);

  return (
    <KkdPage
      title="KKD Tanımları"
      description="V1 kurallarını tek matris motorunda, tarih ve yaşam döngüsü fazlarıyla yönetin."
      actions={
        <div className="flex flex-wrap gap-1.5">
          {DEFINITION_TABS.map(([key, label]) => (
            <OpsActionButton
              key={key}
              variant={tab === key ? 'primary' : 'secondary'}
              className="wms-ops-list-toolbar-btn"
              onClick={() => setTab(key)}
            >
              {label}
            </OpsActionButton>
          ))}
        </div>
      }
    >
      {tab === 'matrix' ? (
        <KkdMatrixManager />
      ) : tab === 'override' ? (
        <KkdOverrideManager />
      ) : (
      <div className="grid gap-4 xl:grid-cols-[minmax(340px,.75fr)_1.25fr]">
        <KkdPanel
          code="DEF_NEW"
          icon={<Sparkles className="size-4" strokeWidth={1.75} />}
          title="Yeni tanım"
          description="Kaydedilen tanım anında listeye ve hak motoruna yansır."
        >
          <form className="grid content-start gap-3" onSubmit={submit}>
            {(tab === 'role' || tab === 'employee') && (
              <KkdField label="Departman">
                <OpsSelect
                  value={form.departmentId ?? ''}
                  onValueChange={(value) => change('departmentId', value)}
                  options={lookupOptions(departments.data)}
                  placeholder="Departman seçin"
                  searchable
                />
              </KkdField>
            )}
            {tab === 'employee' && (
              <KkdField label="Rol">
                <OpsSelect
                  value={form.roleId ?? ''}
                  onValueChange={(value) => change('roleId', value)}
                  options={lookupOptions(roles.data)}
                  placeholder="Rol seçin"
                  searchable
                />
              </KkdField>
            )}
            <KkdField label={tab === 'employee' ? 'Personel kodu' : 'Kod'}>
              <AppInput value={form.code ?? ''} onChange={(event) => change('code', event.target.value)} required />
            </KkdField>
            {tab !== 'employee' && (
              <KkdField label="Ad">
                <AppInput value={form.name ?? ''} onChange={(event) => change('name', event.target.value)} required />
              </KkdField>
            )}
            {tab === 'employee' && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <KkdField label="Ad">
                    <AppInput value={form.firstName ?? ''} onChange={(event) => change('firstName', event.target.value)} required />
                  </KkdField>
                  <KkdField label="Soyad">
                    <AppInput value={form.lastName ?? ''} onChange={(event) => change('lastName', event.target.value)} required />
                  </KkdField>
                </div>
                <CustomerLookupField value={form.customerId} onChange={(value) => change('customerId', value)} />
                <KkdField label="Kullanıcı ID" hint="Opsiyonel; WMS kullanıcı hesabıyla eşleştirir.">
                  <AppInput
                    type="number"
                    value={form.userId ?? ''}
                    onChange={(event) => change('userId', event.target.value)}
                  />
                </KkdField>
                <KkdField label="QR kodu">
                  <AppInput value={form.qrCode ?? ''} onChange={(event) => change('qrCode', event.target.value)} required />
                </KkdField>
                <KkdField label="İşe giriş tarihi">
                  <AppDateInput
                    value={form.employmentStartDate ?? ''}
                    onChange={(event) => change('employmentStartDate', event.target.value)}
                    required
                  />
                </KkdField>
              </>
            )}
            <OpsActionButton
              type="submit"
              variant="primary"
              className="mt-1 w-full"
              loading={mutation.isPending}
              loadingLabel={
                <>
                  <Save className="size-3.5 shrink-0" />
                  Kaydediliyor…
                </>
              }
            >
              <Save className="size-3.5 shrink-0" />
              Kaydet
            </OpsActionButton>
          </form>
        </KkdPanel>

        <KkdPanel
          code="DEF_LST"
          icon={<Grid3X3 className="size-4" strokeWidth={1.75} />}
          title="Tanım listesi"
          description={`Aktif sekme: ${DEFINITION_TABS.find(([key]) => key === tab)?.[1] ?? ''}`}
          actions={
            <OpsActionButton
              variant="secondary"
              className="wms-ops-list-toolbar-btn"
              onClick={() => void qc.invalidateQueries({ queryKey: ['kkd'] })}
            >
              <RefreshCw className="size-3.5 shrink-0" />
              <span className="hidden md:inline">Yenile</span>
            </OpsActionButton>
          }
          bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
        >
          <KkdTableShell minWidthClass="min-w-[640px]" className="border-x-0 border-b-0">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={KKD_HEAD_CELL}>Kod</th>
                <th className={KKD_HEAD_CELL}>Ad / kapsam</th>
                <th className={KKD_HEAD_CELL}>Durum</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr>
                  <td colSpan={3} className="wms-ops-grid-state-cell">
                    <OpsLoadingState code="FETCH" message="Tanımlar yükleniyor…" compact />
                  </td>
                </tr>
              ) : listRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="wms-ops-grid-state-cell">
                    <OpsGridEmptyState message="Bu sekmede kayıtlı tanım bulunamadı." />
                  </td>
                </tr>
              ) : (
                listRows.map((row) => (
                  <tr key={row.id}>
                    <td className={cn(KKD_CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>{row.code}</td>
                    <td className={KKD_CELL}>{row.name}</td>
                    <td className={KKD_CELL}>
                      <OpsStatusBadge tone={row.active ? 'active' : 'neutral'}>
                        {row.active ? 'Aktif' : 'Pasif'}
                      </OpsStatusBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </KkdTableShell>
        </KkdPanel>
      </div>
      )}
    </KkdPage>
  );
}

function CustomerLookupField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <KkdField label="Entegre cari">
      <div className="wms-ops-field-shell">
        <PagedAppDropdown
          queryKey="kkd-customer-lookup"
          fetchPage={kkdApi.customersPaged}
          toOption={(item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` })}
          value={value || null}
          onValueChange={onChange}
          placeholder="Cari kodu veya adıyla seçin"
          searchPlaceholder="Cari ara"
          searchable
          minSearchLength={1}
          searchFields={['code', 'name']}
          className={OPS_SELECT_TRIGGER_CLASS}
        />
      </div>
    </KkdField>
  );
}

export function MatrixFields({
  form,
  change,
}: {
  form: Record<string, string>;
  change: (key: string, value: string) => void;
}): ReactElement {
  return (
    <>
      <CustomerLookupField value={form.customerId} onChange={(value) => change('customerId', value)} />
      <KkdField label="Stok grubu">
        <div className="wms-ops-field-shell">
          <PagedAppDropdown
            queryKey="kkd-stock-group-lookup"
            fetchPage={kkdApi.stockGroupsPaged}
            toOption={(item) => ({ value: item.code, label: item.code, description: `${item.stockCount} stok` })}
            value={form.groupCode || null}
            onValueChange={(value) => {
              change('groupCode', value);
              change('stockId', '');
              change('stockLookupValue', '');
            }}
            placeholder="Stok grubu seçin"
            searchPlaceholder="Grup kodu ara"
            searchable
            minSearchLength={1}
            searchFields={['code']}
            className={OPS_SELECT_TRIGGER_CLASS}
          />
        </div>
      </KkdField>
      <KkdField label="Stok" hint="Boş bırakılırsa kural tüm stok grubuna uygulanır.">
        <div className="wms-ops-field-shell">
          <PagedAppDropdown
            queryKey={['kkd-stock-lookup', form.groupCode || 'all']}
            fetchPage={(request) => kkdApi.stocksPaged(request, form.groupCode)}
            toOption={(item) => ({
              value: `${item.id}|${encodeURIComponent(item.groupCode || '')}`,
              label: `${item.code} · ${item.name}`,
              description: [item.groupCode, item.unitCode].filter(Boolean).join(' · '),
            })}
            value={form.stockLookupValue || null}
            onValueChange={(value) => {
              if (!value) {
                change('stockId', '');
                change('stockLookupValue', '');
                return;
              }
              const [id, group = ''] = value.split('|');
              change('stockId', id);
              change('stockLookupValue', value);
              if (group) change('groupCode', decodeURIComponent(group));
            }}
            staticOptions={[{ value: '', label: 'Tüm stok grubu için uygula' }]}
            placeholder="İsteğe bağlı stok seçin"
            searchPlaceholder="Stok kodu veya adıyla ara"
            searchable
            minSearchLength={1}
            searchFields={['code', 'name']}
            className={OPS_SELECT_TRIGGER_CLASS}
          />
        </div>
      </KkdField>
      <KkdField label="Standart kodu">
        <AppInput value={form.standardCode ?? ''} onChange={(event) => change('standardCode', event.target.value)} />
      </KkdField>
      <div className="grid grid-cols-2 gap-3">
        <KkdField label="İlk teslim miktarı">
          <AppInput
            type="number"
            step="any"
            value={form.initialQuantity ?? ''}
            onChange={(event) => change('initialQuantity', event.target.value)}
            required
          />
        </KkdField>
        <KkdField label="Ay sonrası">
          <AppInput
            type="number"
            step="any"
            value={form.afterMonths ?? ''}
            onChange={(event) => change('afterMonths', event.target.value)}
          />
        </KkdField>
        <KkdField label="Ay sonrası miktar">
          <AppInput
            type="number"
            step="any"
            value={form.afterQuantity ?? ''}
            onChange={(event) => change('afterQuantity', event.target.value)}
          />
        </KkdField>
        <KkdField label="Periyodik miktar">
          <AppInput
            type="number"
            step="any"
            value={form.recurringQuantity ?? ''}
            onChange={(event) => change('recurringQuantity', event.target.value)}
            required
          />
        </KkdField>
        <KkdField label="Dönem aralığı">
          <AppInput
            type="number"
            step="any"
            value={form.recurringInterval ?? ''}
            onChange={(event) => change('recurringInterval', event.target.value)}
            required
          />
        </KkdField>
        <KkdField label="Dönem">
          <OpsSelect
            value={form.periodType || 'Year'}
            onValueChange={(value) => change('periodType', value)}
            options={[
              { value: 'Day', label: 'Gün' },
              { value: 'Month', label: 'Ay' },
              { value: 'Year', label: 'Yıl' },
            ]}
          />
        </KkdField>
        <KkdField label="Sıklık (gün)">
          <AppInput
            type="number"
            step="any"
            value={form.frequencyDays ?? ''}
            onChange={(event) => change('frequencyDays', event.target.value)}
          />
        </KkdField>
        <KkdField label="Sıklık miktarı">
          <AppInput
            type="number"
            step="any"
            value={form.frequencyQuantity ?? ''}
            onChange={(event) => change('frequencyQuantity', event.target.value)}
          />
        </KkdField>
        <KkdField label="Yıllık teslim sayısı">
          <AppInput
            type="number"
            step="any"
            value={form.annualIssueCount ?? ''}
            onChange={(event) => change('annualIssueCount', event.target.value)}
          />
        </KkdField>
        <KkdField label="Yıllık miktar">
          <AppInput
            type="number"
            step="any"
            value={form.annualQuantity ?? ''}
            onChange={(event) => change('annualQuantity', event.target.value)}
          />
        </KkdField>
        <KkdField label="Devreden üst sınır" className="col-span-2">
          <AppInput
            type="number"
            step="any"
            value={form.maxCarryQuantity ?? ''}
            onChange={(event) => change('maxCarryQuantity', event.target.value)}
          />
        </KkdField>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <KkdCheckRow
          checked={form.allowBulkIssue === 'true'}
          onCheckedChange={(checked) => change('allowBulkIssue', String(checked))}
          title="Toplu teslim izni"
          description="Faz miktarının tamamı tek seferde verilebilir."
        />
        <KkdCheckRow
          checked={form.isMandatory === 'true'}
          onCheckedChange={(checked) => change('isMandatory', String(checked))}
          title="Zorunlu KKD"
          description="Bu kalem personel için zorunlu koruyucu donanımdır."
        />
      </div>
    </>
  );
}

export function KkdEntitlementPage(): ReactElement {
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const [employeeId, setEmployeeId] = useState('');
  const [stockId, setStockId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [result, setResult] = useState<KkdEntitlementResult>();
  const [atDate, setAtDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [remainingItems, setRemainingItems] = useState<KkdRemainingEntitlement[]>([]);
  const mutation = useMutation({
    mutationFn: () => kkdApi.check({ employeeId: n(employeeId), stockId: n(stockId), quantity: n(quantity) }),
    onSuccess: setResult,
    onError: (error) => toast.error(message(error)),
  });
  const remainingMutation = useMutation({
    mutationFn: () => kkdApi.remainingEntitlements(n(employeeId), atDate),
    onSuccess: setRemainingItems,
    onError: (error) => {
      setRemainingItems([]);
      toast.error(message(error));
    },
  });

  return (
    <KkdPage
      title="KKD Hak Sorgulama"
      description="Stok özel kuralı, grup kuralı, faz, sıklık, yıllık sınır ve ek hak birlikte hesaplanır."
      className="max-w-6xl"
    >
      <KkdPanel
        code="ENT_01"
        icon={<BadgeCheck className="size-4" strokeWidth={1.75} />}
        title="Hak kontrolü"
        description="Teslim öncesi personelin kalan hakkını ve uygunluk gerekçesini görün."
      >
        <form
          className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <KkdField label="Personel">
            <OpsSelect
              value={employeeId}
              onValueChange={setEmployeeId}
              options={employeeOptions(employees.data)}
              placeholder="Personel seçin"
              searchable
            />
          </KkdField>
          <KkdField label="Stok">
            <div className="wms-ops-field-shell">
              <PagedAppDropdown
                queryKey="kkd-entitlement-stock-lookup"
                fetchPage={(request) => kkdApi.stocksPaged(request)}
                toOption={(item) => ({
                  value: String(item.id),
                  label: `${item.code} · ${item.name}`,
                  description: [item.groupCode, item.unitCode].filter(Boolean).join(' · '),
                })}
                value={stockId || null}
                onValueChange={setStockId}
                placeholder="Stok kodu veya adıyla seçin"
                searchPlaceholder="Stok ara"
                searchable
                minSearchLength={1}
                searchFields={['code', 'name']}
                className={OPS_SELECT_TRIGGER_CLASS}
              />
            </div>
          </KkdField>
          <KkdField label="Miktar">
            <AppInput
              type="number"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </KkdField>
          <OpsActionButton
            type="submit"
            variant="primary"
            className="w-full"
            loading={mutation.isPending}
            loadingLabel={<>Kontrol ediliyor…</>}
            disabled={!employeeId || !stockId}
          >
            <ShieldCheck className="size-3.5 shrink-0" />
            Kontrol et
          </OpsActionButton>
        </form>
      </KkdPanel>

      <KkdPanel
        code="ENT_ALL"
        icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
        title="Personelin tüm kalan hakları"
        description="V1'deki kalan hak görünümünü; stok, grup, dönem, ana hak, ek hak ve sonraki kullanım tarihiyle birlikte gösterir."
        actions={
          <OpsActionButton
            variant="secondary"
            className="wms-ops-list-toolbar-btn"
            loading={remainingMutation.isPending}
            disabled={!employeeId}
            onClick={() => remainingMutation.mutate()}
          >
            <RefreshCw className={cn('size-3.5', remainingMutation.isPending && 'animate-spin')} />
            Kalan hakları getir
          </OpsActionButton>
        }
      >
        <div className="mb-3 grid items-end gap-3 sm:grid-cols-[minmax(220px,360px)_auto]">
          <KkdField label="Hesaplama tarihi">
            <AppDateInput value={atDate} onChange={(event) => setAtDate(event.target.value)} />
          </KkdField>
          <p className="pb-2 text-xs text-[var(--wms-app-text-muted)]">
            Üstte seçilen personelin geçerli matris ve personel ek hakları birlikte hesaplanır.
          </p>
        </div>
        {remainingMutation.isPending ? (
          <OpsLoadingState code="ENT" message="Kalan haklar hesaplanıyor…" compact />
        ) : remainingItems.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {remainingItems.map((item) => (
              <div key={`${item.groupCode}-${item.stockId}`} className="rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface-muted)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="block font-mono text-[var(--wms-brand-primary)]">{item.groupCode}</strong>
                    <span className="text-xs text-[var(--wms-app-text-muted)]">{item.groupName}</span>
                  </div>
                  <OpsStatusBadge tone={item.totalRemainingQuantity > 0 ? 'active' : 'neutral'}>
                    {item.totalRemainingQuantity > 0 ? 'HAK VAR' : 'HAK YOK'}
                  </OpsStatusBadge>
                </div>
                <p className="mt-3 text-sm font-semibold">{item.stockCode} · {item.stockName}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <KkdMetric label="Ana hak" value={item.matrixRemainingQuantity} />
                  <KkdMetric label="Ek hak" value={item.overrideRemainingQuantity} />
                  <KkdMetric label="Toplam" value={item.totalRemainingQuantity} />
                </div>
                <div className="mt-3 text-xs text-[var(--wms-app-text-muted)]">
                  <span>Dönem: {item.phaseType || '—'}</span>
                  <span className="block">Son kullanım: {item.lastUsageAtUtc ? new Date(item.lastUsageAtUtc).toLocaleString('tr-TR') : '—'}</span>
                  <span className="block">Sonraki hak: {item.nextEligibleDate ? new Date(item.nextEligibleDate).toLocaleDateString('tr-TR') : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <OpsGridEmptyState message={employeeId ? 'Kalan hakları görmek için “Kalan hakları getir” düğmesini kullanın.' : 'Önce üst bölümden personel seçin.'} />
        )}
      </KkdPanel>

      {result ? (
        <KkdPanel
          code={result.reasonCode || 'ENT_RES'}
          icon={
            result.isAllowed ? (
              <Check className="size-4" strokeWidth={2} />
            ) : (
              <ShieldAlert className="size-4" strokeWidth={1.75} />
            )
          }
          title={result.isAllowed ? 'Teslime uygun' : 'Teslime uygun değil'}
          description={result.message}
          actions={
            <OpsStatusBadge tone={result.isAllowed ? 'done' : 'danger'}>
              {result.isAllowed ? 'UYGUN' : 'ENGELLİ'}
            </OpsStatusBadge>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KkdMetric label="Grup" value={result.groupCode || '—'} />
            <KkdMetric label="Faz" value={result.phaseType || '—'} />
            <KkdMetric label="Ana hak" value={result.matrixRemainingQuantity} hint="Matristen kalan" />
            <KkdMetric label="Ek hak" value={result.overrideRemainingQuantity} hint="Ek tanımdan kalan" />
          </div>
          {result.nextEligibleDate ? (
            <KkdCallout tone="info" icon={<ClipboardCheck className="size-4" strokeWidth={1.75} />} className="mt-3">
              Sonraki hak tarihi: <strong>{new Date(result.nextEligibleDate).toLocaleDateString('tr-TR')}</strong>
            </KkdCallout>
          ) : null}
        </KkdPanel>
      ) : null}
    </KkdPage>
  );
}

export function KkdDistributionsPage(): ReactElement {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const query = useQuery({
    queryKey: ['kkd', 'distributions', 'paged', page, search],
    queryFn: () => kkdApi.distributionsPaged({ pageNumber: page, pageSize: 25, search: search || undefined }),
  });
  const detail = useQuery({
    queryKey: ['kkd', 'distributions', 'detail', selectedId],
    queryFn: () => kkdApi.distributionDetail(selectedId!),
    enabled: Boolean(selectedId),
  });
  const qc = useQueryClient();
  const { can } = usePermissionAccess();
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const decision = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) =>
      kkdApi.decideExcessApproval(id, approve, reasons[id] || ''),
    onSuccess: async () => {
      toast.success('Kota aşım kararı kaydedildi.');
      await qc.invalidateQueries({ queryKey: ['kkd', 'distributions'] });
    },
    onError: (error) => toast.error(message(error)),
  });
  const canManageOverrides = can('WMS.KKD.OVERRIDES.MANAGE');
  const columns = ['Belge', 'Personel', 'Toplam', 'Hak', 'Fazla', 'Kota aşım onayı', 'Durum', 'Ambar çıkışı', 'İşlemler'];

  return (
    <KkdPage
      title="KKD Dağıtımları"
      description="Teslim kaydı, hak tüketimi, fiziksel ambar çıkışı ve ERP sonucu aynı belge zincirinde izlenir."
      actions={
        <div className="flex flex-wrap gap-1.5">
          <OpsActionButton
            variant="secondary"
            className="wms-ops-list-toolbar-btn"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={cn('size-3.5 shrink-0', query.isFetching && 'animate-spin')} />
            <span className="hidden md:inline">Yenile</span>
          </OpsActionButton>
          <OpsActionButton variant="primary" className="wms-ops-list-toolbar-btn" asChild>
            <Link to="/warehouse/kkd/distributions/new">
              <PackageCheck className="size-3.5 shrink-0" />
              Yeni dağıtım
            </Link>
          </OpsActionButton>
        </div>
      }
    >
      <KkdPanel
        code="KKD.DST"
        icon={<Boxes className="size-4" strokeWidth={1.75} />}
        title="Dağıtım kayıtları"
        description="Kota aşımı bekleyen belgeler fiziksel çıkış için yönetici onayı ister."
        bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
      >
        <div className="border-b border-[var(--wms-app-border)] p-3">
          <AppInput
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Belge no, personel kodu veya personel adı ara"
          />
        </div>
        <KkdTableShell minWidthClass="min-w-[1180px]" className="border-x-0 border-b-0">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((column) => (
                <th key={column} className={KKD_HEAD_CELL}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={columns.length} className="wms-ops-grid-state-cell">
                  <OpsLoadingState code="FETCH" message="KKD dağıtımları yükleniyor…" compact />
                </td>
              </tr>
            ) : (query.data?.items.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={columns.length} className="wms-ops-grid-state-cell">
                  <OpsGridEmptyState message="Bu şubede kayıtlı KKD dağıtımı bulunamadı." />
                </td>
              </tr>
            ) : (
              query.data?.items.map((row) => {
                const reason = reasons[row.id] || '';
                const isPending = row.excessApprovalStatus === 'Pending';
                return (
                  <tr key={row.id}>
                    <td className={cn(KKD_CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>
                      {row.documentNo}
                    </td>
                    <td className={KKD_CELL}>
                      <strong className="block">{row.employeeCode}</strong>
                      <span className="text-xs text-[var(--wms-app-text-muted)]">{row.employeeName}</span>
                    </td>
                    <td className={cn(KKD_CELL, 'text-right font-bold')}>{row.totalQuantity}</td>
                    <td className={cn(KKD_CELL, 'text-right text-emerald-500')}>{row.entitledQuantity}</td>
                    <td className={cn(KKD_CELL, 'text-right', row.excessQuantity > 0 && 'text-amber-500')}>
                      {row.excessQuantity}
                    </td>
                    <td className={KKD_CELL}>
                      <OpsStatusBadge tone={inferOpsStatusTone(row.excessApprovalStatus)}>
                        {row.excessApprovalStatus}
                      </OpsStatusBadge>
                      {row.excessApprovalReason ? (
                        <div className="mt-1 text-xs text-[var(--wms-app-text-muted)]">{row.excessApprovalReason}</div>
                      ) : null}
                      {canManageOverrides && isPending ? (
                        <div className="mt-2 flex min-w-[300px] flex-wrap items-center gap-1.5">
                          <AppInput
                            value={reason}
                            onChange={(event) =>
                              setReasons((current) => ({ ...current, [row.id]: event.target.value }))
                            }
                            placeholder="Fiziksel kontrol notu"
                            className="min-w-44"
                          />
                          <OpsActionButton
                            variant="primary"
                            className="wms-ops-list-toolbar-btn"
                            disabled={decision.isPending || reason.trim().length < 5}
                            onClick={() => decision.mutate({ id: row.id, approve: true })}
                          >
                            <Check className="size-3.5 shrink-0" />
                            Onayla
                          </OpsActionButton>
                          <OpsActionButton
                            variant="secondary"
                            className="wms-ops-list-toolbar-btn !text-rose-500"
                            disabled={decision.isPending || reason.trim().length < 5}
                            onClick={() => decision.mutate({ id: row.id, approve: false })}
                          >
                            <X className="size-3.5 shrink-0" />
                            Reddet
                          </OpsActionButton>
                        </div>
                      ) : null}
                    </td>
                    <td className={KKD_CELL}>
                      <OpsStatusBadge tone={inferOpsStatusTone(row.status)}>{row.status}</OpsStatusBadge>
                    </td>
                    <td className={KKD_CELL}>
                      {row.warehouseOutboundId ? (
                        <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" asChild>
                          <Link to={`/warehouse/warehouse-outbounds/${row.warehouseOutboundId}/operations`}>
                            <PackageCheck className="size-3.5 shrink-0" />
                            Operasyonu aç
                          </Link>
                        </OpsActionButton>
                      ) : (
                        <span className="text-[var(--wms-app-text-muted)]">—</span>
                      )}
                    </td>
                    <td className={KKD_CELL}>
                      <OpsActionButton
                        variant="secondary"
                        className="wms-ops-list-toolbar-btn"
                        onClick={() => setSelectedId(row.id)}
                      >
                        <ClipboardCheck className="size-3.5" /> Detay
                      </OpsActionButton>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </KkdTableShell>
        {query.data ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--wms-app-border)] p-3 text-sm">
            <span>{query.data.totalCount} kayıt · Sayfa {query.data.pageNumber}/{Math.max(1, query.data.totalPages)}</span>
            <div className="flex gap-2">
              <OpsActionButton variant="secondary" disabled={!query.data.hasPreviousPage} onClick={() => setPage((value) => value - 1)}>Önceki</OpsActionButton>
              <OpsActionButton variant="secondary" disabled={!query.data.hasNextPage} onClick={() => setPage((value) => value + 1)}>Sonraki</OpsActionButton>
            </div>
          </div>
        ) : null}
      </KkdPanel>

      {selectedId ? (
        <KkdPanel
          code={`DST_${selectedId}`}
          icon={<ClipboardCheck className="size-4" />}
          title={detail.data?.documentNo || 'Dağıtım detayı'}
          description="Belge özeti, stok kalemleri, hak/fazla ayrımı, sipariş ve izlenebilirlik bilgileri."
          actions={<OpsActionButton variant="secondary" onClick={() => setSelectedId(null)}><X className="size-3.5" /> Kapat</OpsActionButton>}
          bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
        >
          {detail.isLoading ? <div className="p-4"><OpsLoadingState code="DETAIL" message="Dağıtım detayı yükleniyor…" compact /></div>
            : detail.data ? (
              <>
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
                  <KkdMetric label="Personel" value={`${detail.data.employeeCode} · ${detail.data.employeeName}`} />
                  <KkdMetric label="Durum" value={detail.data.status} />
                  <KkdMetric label="Kota onayı" value={detail.data.excessApprovalStatus} />
                  <KkdMetric label="Depo" value={detail.data.warehouseId} />
                  <KkdMetric label="Ambar çıkışı" value={detail.data.warehouseOutboundId || '—'} />
                </div>
                {detail.data.failureReason ? <KkdCallout tone="danger" className="mx-4 mb-4">{detail.data.failureReason}</KkdCallout> : null}
                <KkdTableShell minWidthClass="min-w-[980px]" className="border-x-0 border-b-0">
                  <thead><tr>{['#', 'Stok kodu', 'Stok adı', 'Grup', 'Toplam', 'Hak', 'Fazla', 'Raf', 'Lot / seri', 'Sipariş'].map((column) => <th key={column} className={KKD_HEAD_CELL}>{column}</th>)}</tr></thead>
                  <tbody>{detail.data.lines.map((line) => (
                    <tr key={line.id}>
                      <td className={KKD_CELL}>{line.lineNo}</td>
                      <td className={cn(KKD_CELL, 'font-mono font-bold')}>{line.stockCode}</td>
                      <td className={KKD_CELL}>{line.stockName}</td>
                      <td className={KKD_CELL}>{line.groupCode}</td>
                      <td className={KKD_CELL}>{line.quantity}</td>
                      <td className={cn(KKD_CELL, 'text-emerald-500')}>{line.entitledQuantity}</td>
                      <td className={cn(KKD_CELL, line.excessQuantity > 0 && 'text-amber-500')}>{line.excessQuantity}</td>
                      <td className={KKD_CELL}>{line.sourceLocationId}</td>
                      <td className={KKD_CELL}>{[line.lotNo, line.serialNo].filter(Boolean).join(' / ') || '—'}</td>
                      <td className={KKD_CELL}>{line.openOrderNo || '—'}</td>
                    </tr>
                  ))}</tbody>
                </KkdTableShell>
              </>
            ) : <div className="p-4"><OpsGridEmptyState message="Dağıtım detayı yüklenemedi." /></div>}
        </KkdPanel>
      ) : null}
    </KkdPage>
  );
}

export function KkdReportsPage(): ReactElement {
  const [dimension, setDimension] = useState<'Department' | 'Role' | 'Group'>('Group');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const usage = useQuery({
    queryKey: ['kkd', 'reports', 'usage', dimension, from, to],
    queryFn: () => kkdApi.usageReport(dimension, from, to),
  });
  const logs = useQuery({ queryKey: ['kkd', 'reports', 'validation-logs'], queryFn: kkdApi.validationLogs });
  const usageColumns = ['Kod', 'Ad', 'Dağıtım', 'Personel', 'Teslim', 'Hak', 'Sipariş fazlası'];
  const logColumns = ['Zaman', 'Neden', 'Personel', 'Stok / grup', 'Miktar', 'Mesaj'];

  return (
    <KkdPage
      title="KKD Raporları"
      description="Teslim edilen, hak içinden karşılanan ve açık siparişle verilen fazla miktarı departman, rol veya KKD grubu bazında izleyin."
    >
      <KkdPanel
        code="RPT_FLT"
        icon={<FileSpreadsheet className="size-4" strokeWidth={1.75} />}
        title="Rapor filtresi"
        description="Kırılım ve tarih aralığı yalnızca tamamlanmış dağıtımları kapsar."
      >
        <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KkdField label="Kırılım">
            <OpsSelect
              value={dimension}
              onValueChange={(value) => setDimension(value as typeof dimension)}
              options={[
                { value: 'Group', label: 'KKD grubu' },
                { value: 'Department', label: 'Departman' },
                { value: 'Role', label: 'Rol' },
              ]}
            />
          </KkdField>
          <KkdField label="Başlangıç">
            <AppDateInput value={from} onChange={(event) => setFrom(event.target.value)} />
          </KkdField>
          <KkdField label="Bitiş">
            <AppDateInput value={to} onChange={(event) => setTo(event.target.value)} />
          </KkdField>
          <OpsActionButton
            variant="secondary"
            className="w-full"
            disabled={usage.isFetching || logs.isFetching}
            onClick={() => {
              void usage.refetch();
              void logs.refetch();
            }}
          >
            <RefreshCw className={cn('size-3.5 shrink-0', (usage.isFetching || logs.isFetching) && 'animate-spin')} />
            Yenile
          </OpsActionButton>
        </div>
      </KkdPanel>

      <KkdPanel
        code="RPT_USE"
        icon={<Gauge className="size-4" strokeWidth={1.75} />}
        title="Kullanım özeti"
        description="Seçili kırılımda teslim, hak ve sipariş fazlası miktarları."
        bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
      >
        <KkdTableShell minWidthClass="min-w-[760px]" className="border-x-0 border-b-0">
          <thead className="sticky top-0 z-10">
            <tr>
              {usageColumns.map((column) => (
                <th key={column} className={KKD_HEAD_CELL}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usage.isLoading ? (
              <tr>
                <td colSpan={usageColumns.length} className="wms-ops-grid-state-cell">
                  <OpsLoadingState code="FETCH" message="Kullanım özeti hesaplanıyor…" compact />
                </td>
              </tr>
            ) : (usage.data?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={usageColumns.length} className="wms-ops-grid-state-cell">
                  <OpsGridEmptyState message="Seçilen aralıkta tamamlanmış KKD dağıtımı yok." />
                </td>
              </tr>
            ) : (
              usage.data?.map((row) => (
                <tr key={row.code}>
                  <td className={cn(KKD_CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>{row.code}</td>
                  <td className={KKD_CELL}>{row.name}</td>
                  <td className={cn(KKD_CELL, 'text-right')}>{row.distributionCount}</td>
                  <td className={cn(KKD_CELL, 'text-right')}>{row.employeeCount}</td>
                  <td className={cn(KKD_CELL, 'text-right font-bold')}>{row.deliveredQuantity}</td>
                  <td className={cn(KKD_CELL, 'text-right text-emerald-500')}>{row.entitledQuantity}</td>
                  <td className={cn(KKD_CELL, 'text-right', row.excessQuantity > 0 && 'text-amber-500')}>
                    {row.excessQuantity}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </KkdTableShell>
      </KkdPanel>

      <KkdPanel
        code="RPT_LOG"
        icon={<ScrollText className="size-4" strokeWidth={1.75} />}
        title="Son doğrulama kayıtları"
        description="Reddedilen hak kontrollerinin denetim izi."
        bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
      >
        <KkdTableShell minWidthClass="min-w-[760px]" className="border-x-0 border-b-0">
          <thead className="sticky top-0 z-10">
            <tr>
              {logColumns.map((column) => (
                <th key={column} className={KKD_HEAD_CELL}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.isLoading ? (
              <tr>
                <td colSpan={logColumns.length} className="wms-ops-grid-state-cell">
                  <OpsLoadingState code="FETCH" message="Doğrulama kayıtları yükleniyor…" compact />
                </td>
              </tr>
            ) : (logs.data?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={logColumns.length} className="wms-ops-grid-state-cell">
                  <OpsGridEmptyState message="Kayıtlı doğrulama reddi bulunamadı." />
                </td>
              </tr>
            ) : (
              logs.data?.map((row) => (
                <tr key={row.id}>
                  <td className={cn(KKD_CELL, 'whitespace-nowrap')}>
                    {row.createdDate ? new Date(row.createdDate).toLocaleString('tr-TR') : '—'}
                  </td>
                  <td className={KKD_CELL}>
                    <OpsStatusBadge tone="danger">{row.reasonCode}</OpsStatusBadge>
                  </td>
                  <td className={KKD_CELL}>{row.employeeId ?? '—'}</td>
                  <td className={KKD_CELL}>
                    {row.stockId ?? '—'} / {row.groupCode || '—'}
                  </td>
                  <td className={cn(KKD_CELL, 'text-right')}>{row.attemptedQuantity}</td>
                  <td className={KKD_CELL}>{row.message || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </KkdTableShell>
      </KkdPanel>
    </KkdPage>
  );
}

function lookupOptions(items?: Array<{ id: number; code: string; name: string }>): AppDropdownOption[] {
  return (items ?? []).map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }));
}

function employeeOptions(items?: Array<{ id: number; employeeCode: string; fullName: string }>): AppDropdownOption[] {
  return (items ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.employeeCode} · ${item.fullName}`,
  }));
}

function n(value?: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'İşlem başarısız.';
}

function rows(
  tab: string,
  data: {
    departments?: Array<{ id: number; code: string; name: string; isActive: boolean }>;
    roles?: Array<{ id: number; code: string; name: string; isActive: boolean }>;
    employees?: Array<{
      id: number;
      employeeCode: string;
      fullName: string;
      departmentName: string;
      roleName: string;
      isActive: boolean;
    }>;
    matrices?: Array<{ id: number; code: string; name: string; ruleCount: number; isActive: boolean }>;
  },
): Array<{ id: number; code: string; name: string; active: boolean }> {
  if (tab === 'department') {
    return (data.departments || []).map((x) => ({ id: x.id, code: x.code, name: x.name, active: x.isActive }));
  }
  if (tab === 'role') {
    return (data.roles || []).map((x) => ({ id: x.id, code: x.code, name: x.name, active: x.isActive }));
  }
  if (tab === 'employee') {
    return (data.employees || []).map((x) => ({
      id: x.id,
      code: x.employeeCode,
      name: `${x.fullName} · ${x.departmentName} / ${x.roleName}`,
      active: x.isActive,
    }));
  }
  return (data.matrices || []).map((x) => ({
    id: x.id,
    code: x.code,
    name: `${x.name} · ${x.ruleCount} kural`,
    active: x.isActive,
  }));
}
