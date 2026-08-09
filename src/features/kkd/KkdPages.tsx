import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
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
  Pencil,
  Plus,
  Power,
  Printer,
  RefreshCw,
  Save,
  ScrollText,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AppDropdown, type AppDropdownOption } from '@/components/shared/AppDropdown';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsProcessHub, type OpsProcessHubPhase } from '@/components/shared/OpsProcessHub';
import { OpsSelect } from '@/components/shared/OpsSelect';
import { OpsStatusBadge, inferOpsStatusTone } from '@/components/shared/OpsStatusBadge';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { PagedLookupDialog } from '@/components/shared/PagedLookupDialog';
import { ParameterPageGuide, ParameterToggleCard } from '@/components/shared/ParameterGuidance';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { OPS_SELECT_TRIGGER_CLASS } from '@/components/shared/ops-field-styles';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DropdownPage } from '@/hooks/useDropdownInfiniteSearch';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { stockMovementsApi } from '@/features/stock-movements/api/stock-movements.api';
import { cn } from '@/lib/utils';
import type { PagedResponse } from '@/types/api';
import { parameterToggleGuidance } from '@/features/settings-guidance/parameter-guidance.catalog';
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
import {
  kkdApi,
  type KkdCustomerLookup,
  type KkdDistribution,
  type KkdEntitlementResult,
  type KkdLookup,
  type KkdPolicy,
  type KkdRemainingEntitlement,
} from './kkd-api';
import { KkdMatrixManager } from './KkdMatrixManager';
import { KkdOverrideManager } from './KkdOverrideManager';
import { KkdDistributionReceiptDialog } from './KkdDistributionReceiptDialog';
import {
  formatDistributionStatus,
  formatExcessApprovalStatus,
  isExcessApprovalPending,
  KKD_QUOTA_FREQUENCY_HINT,
  KKD_QUOTA_FULL_MESSAGE,
  KKD_QUOTA_FULL_TITLE,
  KKD_QUOTA_REJECT_HINT,
} from './kkd-quota-copy';

const toPagedResponse = <T,>(page: DropdownPage<T>): PagedResponse<T> => ({
  data: page.items,
  totalCount: page.totalCount,
  pageNumber: page.pageNumber,
  pageSize: page.pageSize,
  totalPages: page.totalPages ?? Math.max(1, Math.ceil(page.totalCount / Math.max(page.pageSize, 1))),
  hasPreviousPage: page.pageNumber > 1,
  hasNextPage: Boolean(page.hasNextPage),
});

const lookupLabel = (item: { code: string; name: string }): string => `${item.code} · ${item.name}`;

function pageLocalLookups(
  items: KkdLookup[],
  search: string,
  pageNumber: number,
  pageSize: number,
): PagedResponse<KkdLookup> {
  const query = search.trim().toLocaleLowerCase('tr-TR');
  const filtered = query
    ? items.filter((item) => `${item.code} ${item.name}`.toLocaleLowerCase('tr-TR').includes(query))
    : items;
  const start = (pageNumber - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);
  const totalCount = filtered.length;
  return {
    data,
    totalCount,
    pageNumber,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / Math.max(pageSize, 1))),
    hasPreviousPage: pageNumber > 1,
    hasNextPage: start + pageSize < totalCount,
  };
}

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
        ...(can('WMS.KKD.REQUESTS.VIEW')
          ? [
              {
                key: 'open-requests',
                code: 'KKD.REQ',
                href: '/warehouse/kkd/requests',
                icon: ClipboardList,
                title: 'Açık KKD talepleri',
                description: 'Tüm personelin açık taleplerini tek kuyrukta görün; grup taleplerini stok ve bedene bağlayıp hazırlayın.',
                featured: true,
              },
            ]
          : []),
        {
          key: 'distribution-new',
          code: 'KKD.NEW',
          href: '/warehouse/kkd/distributions/new',
          icon: PackageCheck,
          title: 'KKD Malzeme Talep Siparişleri',
          description: materialRequests.data?.isEnabled
            ? 'Personel kartından Netsis açık siparişlerini seçip kalem, depo ve görev atamasıyla dağıtım / ambar çıkışını tek sayfada hazırlayın.'
            : 'Açık siparişten teslim ve fiziksel ambar çıkışını tek akışta başlatın (malzeme talep kanalı şube politikasından açılır).',
          featured: Boolean(materialRequests.data?.isEnabled),
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
      {rows.map(([key, title]) => (
        <ParameterToggleCard
          key={key}
          checked={form[key]}
          onCheckedChange={(checked) => set(key, checked)}
          disabled={query.isLoading || mutation.isPending}
          title={title}
          guidance={parameterToggleGuidance('kkd', key)}
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
      <ParameterPageGuide translationKey="kkd" title="KKD süreç ayar rehberi" description="Sipariş kanalı, hak aşımı, yönetici onayı ve personel güvenlik kurallarının dağıtım ve ambar çıkışına etkisini örneklerle gösterir." />
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
type DefinitionStatusFilter = 'all' | 'active' | 'inactive';

const DEFINITION_TABS: Array<[DefinitionTab, string]> = [
  ['department', 'Departman'],
  ['role', 'Rol'],
  ['employee', 'Personel'],
  ['matrix', 'Hak matrisi'],
  ['override', 'Personel ek hakları'],
];

const emptyDefinitionForm = (): Record<string, string> => ({
  isActive: 'true',
  employmentStartDate: new Date().toLocaleDateString('en-CA'),
  initialQuantity: '1',
  recurringQuantity: '1',
  recurringInterval: '1',
});

const splitFullName = (fullName: string): { firstName: string; lastName: string } => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

export function KkdDefinitionsPage(): ReactElement {
  const qc = useQueryClient();
  const [tab, setTab] = useState<DefinitionTab>('department');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DefinitionStatusFilter>('all');
  const [statusConfirm, setStatusConfirm] = useState<{
    id: number;
    code: string;
    name: string;
    active: boolean;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [departmentLookupOpen, setDepartmentLookupOpen] = useState(false);
  const [roleLookupOpen, setRoleLookupOpen] = useState(false);
  const departments = useQuery({ queryKey: ['kkd', 'departments'], queryFn: kkdApi.departments });
  const roles = useQuery({ queryKey: ['kkd', 'roles'], queryFn: () => kkdApi.roles() });
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const matrices = useQuery({ queryKey: ['kkd', 'matrices'], queryFn: kkdApi.matrices });
  const [form, setForm] = useState<Record<string, string>>(emptyDefinitionForm);
  const isEditing = editingId != null;
  const formActive = form.isActive !== 'false';

  const clearError = (key: string): void =>
    setFieldErrors((current) => (current[key] ? { ...current, [key]: false } : current));
  const change = (key: string, value: string): void => {
    setForm((current) => ({ ...current, [key]: value }));
    clearError(key);
  };
  const setDepartmentId = (value: string): void => {
    setForm((current) => ({
      ...current,
      departmentId: value,
      ...(tab === 'employee' ? { roleId: '' } : null),
    }));
    clearError('departmentId');
    if (tab === 'employee') clearError('roleId');
  };

  const resetForm = (): void => {
    setEditingId(null);
    setFieldErrors({});
    setForm(emptyDefinitionForm());
  };

  const departmentRoles = useQuery({
    queryKey: ['kkd', 'roles', form.departmentId || 'none'],
    queryFn: () => kkdApi.roles(Number(form.departmentId)),
    enabled: Boolean(form.departmentId) && tab === 'employee',
  });

  const selectedDepartment = useMemo(
    () => departments.data?.find((item) => String(item.id) === form.departmentId),
    [departments.data, form.departmentId],
  );
  const selectedRole = useMemo(
    () => departmentRoles.data?.find((item) => String(item.id) === form.roleId),
    [departmentRoles.data, form.roleId],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      // Ops seçim bileşenleri native `required` doğrulaması yapmadığından zorunlu
      // ilişkiler burada kontrol edilir; aksi halde sunucuya 0 id gönderilir.
      if (tab === 'role' && !isEditing && !n(form.departmentId)) throw new Error('Departman seçilmelidir.');
      if (tab === 'employee' && !n(form.departmentId)) throw new Error('Departman seçilmelidir.');
      if (tab === 'employee' && !n(form.roleId)) throw new Error('Rol seçilmelidir.');
      if (tab === 'employee' && !n(form.customerId)) throw new Error('Entegre cari seçilmelidir.');
      if (tab === 'department') {
        return kkdApi.saveDepartment({
          code: form.code.trim(),
          name: form.name.trim(),
          isActive: formActive,
        });
      }
      if (tab === 'role') {
        return kkdApi.saveRole({
          ...(n(form.departmentId) ? { departmentId: n(form.departmentId) } : {}),
          code: form.code.trim(),
          name: form.name.trim(),
          isActive: formActive,
        });
      }
      return kkdApi.saveEmployee({
        customerId: n(form.customerId),
        userId: n(form.userId) || null,
        employeeCode: form.code.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        departmentId: n(form.departmentId),
        roleId: n(form.roleId),
        qrCode: form.qrCode.trim(),
        employmentStartDate: form.employmentStartDate,
        isActive: formActive,
      });
    },
    onSuccess: async () => {
      toast.success(isEditing ? 'KKD tanımı güncellendi.' : 'KKD tanımı kaydedildi.');
      resetForm();
      await qc.invalidateQueries({ queryKey: ['kkd'] });
    },
    onError: (error) => toast.error(message(error)),
  });

  const toggleActive = useMutation({
    mutationFn: async (row: { id: number; code: string; name: string; active: boolean }) => {
      const nextActive = !row.active;
      if (tab === 'department') {
        const department = departments.data?.find((item) => item.id === row.id);
        if (!department) throw new Error('Departman kaydı bulunamadı.');
        return kkdApi.saveDepartment({
          code: department.code,
          name: department.name,
          isActive: nextActive,
        });
      }
      if (tab === 'role') {
        const role = roles.data?.find((item) => item.id === row.id);
        if (!role) throw new Error('Rol kaydı bulunamadı.');
        return kkdApi.saveRole({
          ...(role.departmentId ? { departmentId: role.departmentId } : {}),
          code: role.code,
          name: role.name,
          isActive: nextActive,
        });
      }
      const employee = employees.data?.find((item) => item.id === row.id);
      if (!employee) throw new Error('Personel kaydı bulunamadı.');
      const names = splitFullName(employee.fullName);
      return kkdApi.saveEmployee({
        customerId: employee.customerId,
        userId: null,
        employeeCode: employee.employeeCode,
        firstName: names.firstName,
        lastName: names.lastName,
        departmentId: employee.departmentId,
        roleId: employee.roleId,
        qrCode: employee.qrCode,
        employmentStartDate: employee.employmentStartDate,
        isActive: nextActive,
      });
    },
    onSuccess: async (_data, row) => {
      toast.success(row.active ? 'Tanım pasife alındı.' : 'Tanım aktifleştirildi.');
      setStatusConfirm(null);
      if (editingId === row.id) resetForm();
      await qc.invalidateQueries({ queryKey: ['kkd'] });
    },
    onError: (error) => toast.error(message(error)),
  });

  const validateForm = (): boolean => {
    const next: Record<string, boolean> = {};
    if (tab === 'role' && !isEditing && !n(form.departmentId)) next.departmentId = true;
    if (tab === 'employee' && !n(form.departmentId)) next.departmentId = true;
    if (tab === 'employee' && !n(form.roleId)) next.roleId = true;
    if (tab === 'employee' && !n(form.customerId)) next.customerId = true;
    if (!form.code?.trim()) next.code = true;
    if (tab === 'employee') {
      if (!form.firstName?.trim()) next.firstName = true;
      if (!form.lastName?.trim()) next.lastName = true;
      if (!form.qrCode?.trim()) next.qrCode = true;
      if (!form.employmentStartDate?.trim()) next.employmentStartDate = true;
    } else if (!form.name?.trim()) {
      next.name = true;
    }
    setFieldErrors(next);
    if (Object.values(next).some(Boolean)) {
      toast.error('Zorunlu alanları kontrol edin.');
      window.requestAnimationFrame(() => {
        document
          .querySelectorAll(
            '.wms-ops-form [aria-invalid="true"], .wms-ops-form .wms-ops-field-shell--error, .wms-ops-form .app-input-shell[data-invalid="true"]',
          )
          .forEach((node) => {
            const el = node as HTMLElement;
            el.classList.remove('wms-error-focus-flash');
            void el.offsetWidth;
            el.classList.add('wms-error-focus-flash');
            window.setTimeout(() => el.classList.remove('wms-error-focus-flash'), 2600);
          });
      });
      return false;
    }
    return true;
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!validateForm()) return;
    mutation.mutate();
  };

  const switchTab = (key: DefinitionTab): void => {
    setTab(key);
    setListSearch('');
    setStatusFilter('all');
    setStatusConfirm(null);
    resetForm();
  };

  const beginEdit = (id: number): void => {
    setFieldErrors({});
    if (tab === 'department') {
      const item = departments.data?.find((row) => row.id === id);
      if (!item) return;
      setEditingId(id);
      setForm({
        ...emptyDefinitionForm(),
        code: item.code,
        name: item.name,
        isActive: item.isActive ? 'true' : 'false',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (tab === 'role') {
      const item = roles.data?.find((row) => row.id === id);
      if (!item) return;
      setEditingId(id);
      setForm({
        ...emptyDefinitionForm(),
        code: item.code,
        name: item.name,
        departmentId: item.departmentId ? String(item.departmentId) : '',
        isActive: item.isActive ? 'true' : 'false',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const item = employees.data?.find((row) => row.id === id);
    if (!item) return;
    const names = splitFullName(item.fullName);
    setEditingId(id);
    setForm({
      ...emptyDefinitionForm(),
      code: item.employeeCode,
      firstName: names.firstName,
      lastName: names.lastName,
      customerId: String(item.customerId),
      customerLabel: `Cari #${item.customerId}`,
      departmentId: String(item.departmentId),
      roleId: String(item.roleId),
      qrCode: item.qrCode,
      employmentStartDate: item.employmentStartDate?.slice(0, 10) || new Date().toLocaleDateString('en-CA'),
      isActive: item.isActive ? 'true' : 'false',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const listRows = useMemo(
    () =>
      rows(tab, {
        departments: departments.data,
        roles: roles.data,
        employees: employees.data,
        matrices: matrices.data,
      }),
    [tab, departments.data, roles.data, employees.data, matrices.data],
  );

  const filteredRows = useMemo(() => {
    const term = listSearch.trim().toLocaleLowerCase('tr-TR');
    return listRows.filter((row) => {
      if (statusFilter === 'active' && !row.active) return false;
      if (statusFilter === 'inactive' && row.active) return false;
      if (!term) return true;
      return `${row.code} ${row.name}`.toLocaleLowerCase('tr-TR').includes(term);
    });
  }, [listRows, listSearch, statusFilter]);

  const activeCount = listRows.filter((row) => row.active).length;
  const inactiveCount = listRows.length - activeCount;
  const listLoading =
    (tab === 'department' && departments.isLoading) ||
    (tab === 'role' && roles.isLoading) ||
    (tab === 'employee' && employees.isLoading) ||
    (tab === 'matrix' && matrices.isLoading);
  const tabLabel = DEFINITION_TABS.find(([key]) => key === tab)?.[1] ?? '';
  const activeTabIndex = Math.max(
    DEFINITION_TABS.findIndex(([key]) => key === tab),
    0,
  );

  return (
    <KkdPage
      title="KKD Tanımları"
      description="Departman, rol ve personel tanımlarını oluşturun; hak matrisi ile personel ek haklarını buradan yönetin."
      subRow={
        <div className="wms-ops-kkd-definition-tabs wms-ops-detail-dialog w-full min-w-0">
          <Tabs
            value={tab}
            onValueChange={(value) => switchTab(value as DefinitionTab)}
            className="gap-0"
          >
            <TabsList
              className={cn('w-full', 'wms-ops-detail-main-tabs', 'wms-ops-detail-main-tabs--cols-5')}
              data-active-index={activeTabIndex}
            >
              <span className="wms-ops-detail-tab-indicator" aria-hidden />
              {DEFINITION_TABS.map(([key, label]) => (
                <TabsTrigger key={key} value={key} className="wms-ops-detail-main-tab" title={label}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      }
    >
      {tab === 'matrix' ? (
        <KkdMatrixManager />
      ) : tab === 'override' ? (
        <KkdOverrideManager />
      ) : (
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,.7fr)_1.3fr] xl:items-stretch">
        <KkdPanel
          code={isEditing ? `DEF_${editingId}` : 'DEF_NEW'}
          icon={
            isEditing ? (
              <Pencil className="size-4" strokeWidth={1.75} />
            ) : (
              <Plus className="size-4" strokeWidth={1.75} />
            )
          }
          title={isEditing ? 'Tanımı düzenle' : 'Yeni tanım'}
          description={
            isEditing
              ? 'Değişiklikler kaydedilince listeye ve hak motoruna yansır.'
              : 'Kaydedilen tanım anında listeye ve hak motoruna yansır.'
          }
          className="min-w-0"
        >
          <form className="grid content-start gap-3" onSubmit={submit} noValidate>
            {(tab === 'role' || tab === 'employee') && (
              <KkdField
                label="Departman"
                hint={tab === 'role' && isEditing && !form.departmentId ? 'API departman dönmediyse mevcut bağ korunur.' : undefined}
              >
                <PagedLookupDialog<KkdLookup>
                  variant="ops"
                  triggerMode="combobox"
                  autoSearchMinLength={1}
                  invalid={Boolean(fieldErrors.departmentId)}
                  open={departmentLookupOpen}
                  onOpenChange={setDepartmentLookupOpen}
                  title="Departman seç"
                  description="Kod veya ad yazarak arayın; arama ikonu veya çift tık ile liste penceresini açın."
                  value={selectedDepartment ? lookupLabel(selectedDepartment) : ''}
                  placeholder="Departman yazın veya seçin"
                  searchPlaceholder="Departman ara"
                  emptyText="Departman bulunamadı."
                  queryKey={['kkd', 'department-lookup']}
                  fetchPage={async ({ pageNumber, pageSize, search }) =>
                    pageLocalLookups(departments.data ?? [], search, pageNumber, pageSize)
                  }
                  getKey={(item) => String(item.id)}
                  getLabel={lookupLabel}
                  onSelect={(item) => setDepartmentId(String(item.id))}
                />
              </KkdField>
            )}
            {tab === 'employee' && (
              <KkdField label="Rol" hint={!form.departmentId ? 'Önce departman seçin.' : undefined}>
                <PagedLookupDialog<KkdLookup>
                  variant="ops"
                  triggerMode="combobox"
                  autoSearchMinLength={1}
                  invalid={Boolean(fieldErrors.roleId)}
                  disabled={!form.departmentId}
                  open={roleLookupOpen}
                  onOpenChange={setRoleLookupOpen}
                  title="Rol seç"
                  description="Yalnızca seçilen departmana bağlı roller listelenir."
                  value={selectedRole ? lookupLabel(selectedRole) : ''}
                  placeholder={form.departmentId ? 'Rol yazın veya seçin' : 'Önce departman seçin'}
                  searchPlaceholder="Rol ara"
                  emptyText="Bu departmanda rol bulunamadı."
                  queryKey={['kkd', 'role-lookup', form.departmentId || 'none']}
                  fetchPage={async ({ pageNumber, pageSize, search }) =>
                    pageLocalLookups(departmentRoles.data ?? [], search, pageNumber, pageSize)
                  }
                  getKey={(item) => String(item.id)}
                  getLabel={lookupLabel}
                  onSelect={(item) => change('roleId', String(item.id))}
                />
              </KkdField>
            )}
            {tab === 'employee' ? (
              <>
                <KkdField label="Personel kodu">
                  <AppInput
                    value={form.code ?? ''}
                    onChange={(event) => change('code', event.target.value)}
                    invalid={Boolean(fieldErrors.code)}
                    disabled={isEditing}
                  />
                </KkdField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <KkdField label="Ad">
                    <AppInput
                      value={form.firstName ?? ''}
                      onChange={(event) => change('firstName', event.target.value)}
                      invalid={Boolean(fieldErrors.firstName)}
                    />
                  </KkdField>
                  <KkdField label="Soyad">
                    <AppInput
                      value={form.lastName ?? ''}
                      onChange={(event) => change('lastName', event.target.value)}
                      invalid={Boolean(fieldErrors.lastName)}
                    />
                  </KkdField>
                </div>
                <CustomerLookupField
                  value={form.customerId}
                  displayValue={form.customerLabel}
                  invalid={Boolean(fieldErrors.customerId)}
                  onChange={(value, label) => {
                    setForm((current) => ({ ...current, customerId: value, customerLabel: label }));
                    clearError('customerId');
                  }}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <KkdField label="Kullanıcı ID" hint="Opsiyonel">
                    <AppInput
                      type="number"
                      value={form.userId ?? ''}
                      onChange={(event) => change('userId', event.target.value)}
                    />
                  </KkdField>
                  <KkdField label="QR kodu">
                    <AppInput
                      value={form.qrCode ?? ''}
                      onChange={(event) => change('qrCode', event.target.value)}
                      invalid={Boolean(fieldErrors.qrCode)}
                    />
                  </KkdField>
                </div>
                <KkdField label="İşe giriş tarihi">
                  <AppDateInput
                    value={form.employmentStartDate ?? ''}
                    onChange={(event) => change('employmentStartDate', event.target.value)}
                    invalid={Boolean(fieldErrors.employmentStartDate)}
                  />
                </KkdField>
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <KkdField label="Kod">
                  <AppInput
                    value={form.code ?? ''}
                    onChange={(event) => change('code', event.target.value)}
                    invalid={Boolean(fieldErrors.code)}
                    disabled={isEditing}
                  />
                </KkdField>
                <KkdField label="Ad">
                  <AppInput
                    value={form.name ?? ''}
                    onChange={(event) => change('name', event.target.value)}
                    invalid={Boolean(fieldErrors.name)}
                  />
                </KkdField>
              </div>
            )}
            <KkdCheckRow
              checked={formActive}
              onCheckedChange={(checked) => change('isActive', checked ? 'true' : 'false')}
              title="Tanım aktif"
              description="Pasif kayıtlar hak hesabına katılmaz; geçmiş dağıtımlar korunur."
            />
            <div className="mt-1 flex flex-wrap gap-2">
              <OpsActionButton
                type="submit"
                variant="primary"
                className="min-w-[10rem] flex-1"
                loading={mutation.isPending}
                loadingLabel={
                  <>
                    <Save className="size-3.5 shrink-0" />
                    Kaydediliyor…
                  </>
                }
              >
                <Save className="size-3.5 shrink-0" />
                {isEditing ? 'Değişiklikleri kaydet' : 'Kaydet'}
              </OpsActionButton>
              {isEditing ? (
                <OpsActionButton type="button" variant="secondary" onClick={resetForm}>
                  <X className="size-3.5 shrink-0" />
                  Vazgeç
                </OpsActionButton>
              ) : null}
            </div>
          </form>
        </KkdPanel>

        <KkdPanel
          code="DEF_LST"
          icon={<Grid3X3 className="size-4" strokeWidth={1.75} />}
          title="Tanım listesi"
          description={`${tabLabel}: ${listRows.length} kayıt · ${activeCount} aktif · ${inactiveCount} pasif`}
          className="flex min-h-0 min-w-0 flex-col xl:h-full"
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
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0 sm:px-0 sm:py-0"
        >
          <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--wms-app-border)] p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--wms-app-text-muted)]"
                aria-hidden
              />
              <AppInput
                className="pl-8"
                value={listSearch}
                onChange={(event) => setListSearch(event.target.value)}
                placeholder="Kod veya ad ile ara"
                aria-label="Tanım ara"
              />
            </div>
            <div className="w-full sm:w-[11.5rem] sm:shrink-0">
              <OpsSelect
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as DefinitionStatusFilter)}
                options={[
                  { value: 'all', label: `Tümü (${listRows.length})` },
                  { value: 'active', label: `Aktif (${activeCount})` },
                  { value: 'inactive', label: `Pasif (${inactiveCount})` },
                ]}
                placeholder="Durum filtresi"
                className={OPS_SELECT_TRIGGER_CLASS}
              />
            </div>
          </div>
          <KkdTableShell fill minWidthClass="min-w-[640px]" className="border-x-0 border-b-0" maxHeightClass={false}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={KKD_HEAD_CELL}>Kod</th>
                <th className={KKD_HEAD_CELL}>Ad / kapsam</th>
                <th className={KKD_HEAD_CELL}>Durum</th>
                <th className={cn(KKD_HEAD_CELL, 'w-[1%] whitespace-nowrap')}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr>
                  <td colSpan={4} className="wms-ops-grid-state-cell">
                    <OpsLoadingState code="FETCH" message="Tanımlar yükleniyor…" compact />
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="wms-ops-grid-state-cell">
                    <OpsGridEmptyState
                      message={
                        listRows.length === 0
                          ? 'Bu sekmede kayıtlı tanım bulunamadı.'
                          : 'Arama veya filtreye uygun tanım yok.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(editingId === row.id && 'bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)]')}
                    >
                      <td className={cn(KKD_CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>{row.code}</td>
                      <td className={KKD_CELL}>{row.name}</td>
                      <td className={KKD_CELL}>
                        <OpsStatusBadge tone={row.active ? 'active' : 'neutral'}>
                          {row.active ? 'Aktif' : 'Pasif'}
                        </OpsStatusBadge>
                      </td>
                      <td className={KKD_CELL}>
                        <div className="wms-ops-row-actions">
                          <button
                            type="button"
                            title="Düzenle"
                            aria-label="Düzenle"
                            className="wms-ops-grid-icon-btn"
                            onClick={() => beginEdit(row.id)}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title={row.active ? 'Pasife al' : 'Aktifleştir'}
                            aria-label={row.active ? 'Pasife al' : 'Aktifleştir'}
                            className={cn(
                              'wms-ops-grid-icon-btn',
                              row.active && 'wms-ops-grid-icon-btn--danger',
                            )}
                            disabled={toggleActive.isPending}
                            onClick={() => setStatusConfirm(row)}
                          >
                            <Power className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </KkdTableShell>
        </KkdPanel>
      </div>
      )}
      <ResponsiveDialog
        open={Boolean(statusConfirm)}
        onClose={() => {
          if (!toggleActive.isPending) setStatusConfirm(null);
        }}
        title={statusConfirm?.active ? 'Tanımı pasife al' : 'Tanımı aktifleştir'}
        description="Bu işlem hak motorundaki tanım durumunu değiştirir."
        className="!max-w-md"
      >
        {statusConfirm ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--wms-app-text-muted)]">
              <span className="font-semibold text-[var(--wms-app-text)]">
                {statusConfirm.code} · {statusConfirm.name}
              </span>
              {statusConfirm.active
                ? ' kaydını pasife almak istediğine emin misin? Pasif tanımlar hak hesabına katılmaz.'
                : ' kaydını yeniden aktifleştirmek istediğine emin misin?'}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <OpsActionButton
                type="button"
                variant="secondary"
                disabled={toggleActive.isPending}
                onClick={() => setStatusConfirm(null)}
              >
                Vazgeç
              </OpsActionButton>
              <OpsActionButton
                type="button"
                variant={statusConfirm.active ? 'secondary' : 'primary'}
                className={statusConfirm.active ? 'wms-ops-action-btn--danger' : undefined}
                loading={toggleActive.isPending}
                loadingLabel={statusConfirm.active ? 'Pasife alınıyor…' : 'Aktifleştiriliyor…'}
                onClick={() => toggleActive.mutate(statusConfirm)}
              >
                <Power className="size-3.5 shrink-0" />
                {statusConfirm.active ? 'Pasife al' : 'Aktifleştir'}
              </OpsActionButton>
            </div>
          </div>
        ) : null}
      </ResponsiveDialog>
    </KkdPage>
  );
}

function CustomerLookupField({
  value,
  displayValue,
  onChange,
  invalid,
}: {
  value?: string;
  displayValue?: string;
  onChange: (value: string, label: string) => void;
  invalid?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(displayValue ?? '');

  useEffect(() => {
    if (!value) {
      setLabel('');
      return;
    }
    if (displayValue) setLabel(displayValue);
  }, [displayValue, value]);

  return (
    <KkdField label="Entegre cari">
      <PagedLookupDialog<KkdCustomerLookup>
        variant="ops"
        triggerMode="combobox"
        autoSearchMinLength={1}
        invalid={invalid}
        open={open}
        onOpenChange={setOpen}
        title="Entegre cari seç"
        description="Cari kodu veya adıyla arayın; arama ikonu veya çift tık ile liste penceresini açın."
        value={label}
        placeholder="Cari kodu veya adıyla yazın"
        searchPlaceholder="Cari ara"
        emptyText="Cari bulunamadı."
        queryKey={['kkd', 'customer-lookup-dialog']}
        fetchPage={async ({ pageNumber, pageSize, search, signal }) =>
          toPagedResponse(
            await kkdApi.customersPaged({
              pageNumber,
              pageSize,
              search,
              searchFields: ['code', 'name'],
              sortBy: 'code',
              sortDirection: 'asc',
              signal: signal ?? new AbortController().signal,
            }),
          )
        }
        getKey={(item) => String(item.id)}
        getLabel={lookupLabel}
        onSelect={(item) => {
          const nextLabel = lookupLabel(item);
          setLabel(nextLabel);
          onChange(String(item.id), nextLabel);
        }}
      />
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
      <CustomerLookupField
        value={form.customerId}
        displayValue={form.customerLabel}
        onChange={(value, label) => {
          change('customerId', value);
          change('customerLabel', label);
        }}
      />
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
                  <OpsStatusBadge tone={item.totalRemainingQuantity > 0 ? 'active' : 'danger'}>
                    {item.totalRemainingQuantity > 0 ? 'HAK VAR' : 'KOTA DOLU'}
                  </OpsStatusBadge>
                </div>
                <p className="mt-3 text-sm font-semibold">{item.stockCode} · {item.stockName}</p>
                {item.totalRemainingQuantity <= 0 ? (
                  <p className="mt-2 text-xs leading-5 text-amber-600 dark:text-amber-400">
                    {KKD_QUOTA_FULL_TITLE}. {item.message || KKD_QUOTA_FULL_MESSAGE}
                  </p>
                ) : null}
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
          title={result.isAllowed ? 'Teslime uygun' : KKD_QUOTA_FULL_TITLE}
          description={
            result.isAllowed
              ? result.message
              : result.message || KKD_QUOTA_FULL_MESSAGE
          }
          actions={
            <OpsStatusBadge tone={result.isAllowed ? 'done' : 'danger'}>
              {result.isAllowed ? 'UYGUN' : 'KOTA DOLU'}
            </OpsStatusBadge>
          }
        >
          {!result.isAllowed ? (
            <KkdCallout tone="warn" icon={<ShieldAlert className="size-4" strokeWidth={1.75} />} className="mb-3">
              {KKD_QUOTA_FULL_MESSAGE}
              {result.nextEligibleDate ? (
                <span className="mt-1 block">
                  {KKD_QUOTA_FREQUENCY_HINT} Sonraki hak:{' '}
                  <strong>{new Date(result.nextEligibleDate).toLocaleDateString('tr-TR')}</strong>
                </span>
              ) : null}
            </KkdCallout>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KkdMetric label="Grup" value={result.groupCode || '—'} />
            <KkdMetric label="Faz" value={result.phaseType || '—'} />
            <KkdMetric label="Ana hak" value={result.matrixRemainingQuantity} hint="Matristen kalan" />
            <KkdMetric label="Ek hak" value={result.overrideRemainingQuantity} hint="Ek tanımdan kalan" />
          </div>
          {result.isAllowed && result.nextEligibleDate ? (
            <KkdCallout tone="info" icon={<ClipboardCheck className="size-4" strokeWidth={1.75} />} className="mt-3">
              Sonraki hak tarihi: <strong>{new Date(result.nextEligibleDate).toLocaleDateString('tr-TR')}</strong>
            </KkdCallout>
          ) : null}
        </KkdPanel>
      ) : null}
    </KkdPage>
  );
}

const DISTRIBUTION_PAGE_SIZE_OPTIONS: AppDropdownOption[] = [10, 20, 50, 100].map((size) => ({
  value: String(size),
  label: String(size),
}));

export function KkdDistributionsPage(): ReactElement {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<{ row: KkdDistribution; approve: boolean } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const query = useQuery({
    queryKey: ['kkd', 'distributions', 'all'],
    queryFn: () => kkdApi.distributions(),
  });
  const warehousesQuery = useQuery({
    queryKey: ['stock-movements', 'warehouses'],
    queryFn: stockMovementsApi.getWarehouses,
    staleTime: 5 * 60 * 1000,
  });
  const filteredRows = useMemo(() => {
    const needle = search.toLocaleLowerCase('tr-TR');
    const warehouseId = Number(warehouseFilter || 0);
    return (query.data ?? []).filter((row) => {
      if (warehouseId > 0 && row.warehouseId !== warehouseId) return false;
      if (!needle) return true;
      return `${row.documentNo} ${row.employeeCode} ${row.employeeName}`
        .toLocaleLowerCase('tr-TR')
        .includes(needle);
    });
  }, [query.data, search, warehouseFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, page, pageSize, totalPages]);
  const warehouseOptions = useMemo((): AppDropdownOption[] => {
    const known = [...(warehousesQuery.data ?? [])].sort((a, b) => a.warehouseCode - b.warehouseCode);
    return [
      { value: '', label: 'Tüm depolar' },
      ...known.map((warehouse) => ({
        value: String(warehouse.id),
        label: `${warehouse.warehouseCode} · ${warehouse.warehouseName}`,
      })),
    ];
  }, [warehousesQuery.data]);
  const selectedWarehouseLabel = useMemo(
    () => warehouseOptions.find((option) => option.value === warehouseFilter)?.label,
    [warehouseOptions, warehouseFilter],
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const detail = useQuery({
    queryKey: ['kkd', 'distributions', 'detail', selectedId],
    queryFn: () => kkdApi.distributionDetail(selectedId!),
    enabled: Boolean(selectedId),
  });
  const qc = useQueryClient();
  const { can } = usePermissionAccess();
  const decision = useMutation({
    mutationFn: ({ id, approve, reason }: { id: number; approve: boolean; reason: string }) =>
      kkdApi.decideExcessApproval(id, approve, reason),
    onSuccess: async () => {
      toast.success('Kota aşım kararı kaydedildi.');
      await qc.invalidateQueries({ queryKey: ['kkd', 'distributions'] });
      setDecisionTarget(null);
    },
    onError: (error) => toast.error(message(error)),
  });
  const canManageOverrides = can('WMS.KKD.OVERRIDES.MANAGE');
  const columns = ['Belge', 'Personel', 'Depo', 'Toplam', 'Hak', 'Fazla', 'Kota aşım onayı', 'Durum', 'İşlemler'];
  const openDecision = (row: KkdDistribution, approve: boolean) => {
    setDecisionReason('');
    setDecisionTarget({ row, approve });
  };

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
              Yeni talep siparişi
            </Link>
          </OpsActionButton>
        </div>
      }
    >
      <KkdPanel
        code="KKD.DST"
        icon={<Boxes className="size-4" strokeWidth={1.75} />}
        title="Dağıtım kayıtları"
        description="Kota aşımı bekleyen belgelerde “barkod okutma kotası dolmuştur” uyarısı görünür; fiziksel kontrol sonrası müdür onaylar."
        bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
      >
        <div className="grid gap-2 border-b border-[var(--wms-app-border)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)]">
          <AppInput
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Belge no, personel kodu veya personel adı ara"
          />
          <OpsSelect
            value={warehouseFilter}
            onValueChange={(value) => {
              setWarehouseFilter(value);
              setPage(1);
            }}
            options={warehouseOptions}
            placeholder={warehousesQuery.isLoading ? 'Depolar yükleniyor…' : 'Depo filtrele'}
            searchable
          />
        </div>
        {warehouseFilter ? (
          <div className="flex items-center gap-2 border-b border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_6%,transparent)] px-3 py-2 text-[0.72rem] text-[var(--wms-app-text-muted)]">
            <Warehouse className="size-3.5 shrink-0 text-[var(--wms-ops-accent)]" strokeWidth={1.75} />
            Yalnızca {selectedWarehouseLabel ?? `depo #${warehouseFilter}`} kayıtları gösteriliyor.
          </div>
        ) : null}
        <KkdTableShell minWidthClass="min-w-[1040px]" className="border-x-0 border-b-0">
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
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="wms-ops-grid-state-cell">
                  <OpsGridEmptyState message="Bu filtrelerle KKD dağıtımı bulunamadı." />
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const isPending = isExcessApprovalPending(row.excessApprovalStatus);
                return (
                  <tr key={row.id}>
                    <td className={cn(KKD_CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>
                      {row.documentNo}
                    </td>
                    <td className={KKD_CELL}>
                      <strong className="block">{row.employeeCode}</strong>
                      <span className="text-xs text-[var(--wms-app-text-muted)]">{row.employeeName}</span>
                    </td>
                    <td className={cn(KKD_CELL, 'font-mono')}>#{row.warehouseId}</td>
                    <td className={cn(KKD_CELL, 'text-right font-bold')}>{row.totalQuantity}</td>
                    <td className={cn(KKD_CELL, 'text-right text-emerald-500')}>{row.entitledQuantity}</td>
                    <td className={cn(KKD_CELL, 'text-right', row.excessQuantity > 0 && 'text-amber-500')}>
                      {row.excessQuantity}
                    </td>
                    <td className={KKD_CELL}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <OpsStatusBadge
                          tone={inferOpsStatusTone(row.excessApprovalStatus)}
                          title={row.excessApprovalReason || (isPending ? KKD_QUOTA_FULL_MESSAGE : undefined)}
                        >
                          {formatExcessApprovalStatus(row.excessApprovalStatus)}
                        </OpsStatusBadge>
                        {canManageOverrides && isPending ? (
                          <div className="wms-ops-row-actions">
                            <button
                              type="button"
                              title="Onayla"
                              aria-label="Onayla"
                              className="wms-ops-grid-icon-btn wms-ops-grid-icon-btn--approve"
                              onClick={() => openDecision(row, true)}
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Reddet"
                              aria-label="Reddet"
                              className="wms-ops-grid-icon-btn wms-ops-grid-icon-btn--danger"
                              onClick={() => openDecision(row, false)}
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className={KKD_CELL}>
                      <OpsStatusBadge tone={inferOpsStatusTone(row.status)}>
                        {formatDistributionStatus(row.status)}
                      </OpsStatusBadge>
                    </td>
                    <td className={KKD_CELL}>
                      <div className="wms-ops-row-actions">
                        <button
                          type="button"
                          title="Detay"
                          aria-label="Detay"
                          className="wms-ops-grid-icon-btn"
                          onClick={() => setSelectedId(row.id)}
                        >
                          <ClipboardCheck className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Teslim belgesi"
                          aria-label="Teslim belgesi"
                          className="wms-ops-grid-icon-btn"
                          onClick={() => {
                            setSelectedId(row.id);
                            setReceiptOpen(true);
                          }}
                        >
                          <Printer className="size-3.5" />
                        </button>
                        {row.warehouseOutboundId ? (
                          <Link
                            to={`/warehouse/warehouse-outbounds/${row.warehouseOutboundId}/operations`}
                            title="Ambar çıkış operasyonu"
                            aria-label="Ambar çıkış operasyonu"
                            className="wms-ops-grid-icon-btn"
                          >
                            <PackageCheck className="size-3.5" />
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </KkdTableShell>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--wms-app-border)] p-3 text-sm">
          <div className="flex items-center gap-2 text-[var(--wms-app-text-muted)]">
            <span>
              {filteredRows.length} kayıt · Sayfa {Math.min(page, totalPages)}/{totalPages}
            </span>
            <AppDropdown
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
              options={DISTRIBUTION_PAGE_SIZE_OPTIONS}
              ariaLabel="Sayfa başına kayıt"
              className="h-9 w-20"
            />
          </div>
          <div className="flex gap-2">
            <OpsActionButton variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Önceki
            </OpsActionButton>
            <OpsActionButton
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Sonraki
            </OpsActionButton>
          </div>
        </div>
      </KkdPanel>

      <ResponsiveDialog
        open={Boolean(decisionTarget)}
        onClose={() => setDecisionTarget(null)}
        title={decisionTarget ? `${decisionTarget.row.documentNo} · ${decisionTarget.approve ? 'Onayla' : 'Reddet'}` : ''}
        description={decisionTarget ? `${decisionTarget.row.employeeCode} · ${decisionTarget.row.employeeName}` : undefined}
        className="!max-w-lg"
      >
        {decisionTarget ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-none border border-amber-500/35 bg-amber-500/10 p-3">
              <strong className="block text-[0.82rem]">{KKD_QUOTA_FULL_TITLE}</strong>
              <p className="mt-1 text-[0.78rem] leading-5 text-[var(--wms-app-text-muted)]">{KKD_QUOTA_FULL_MESSAGE}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-none border border-[var(--wms-app-border)] p-2">
                <span className="block text-[var(--wms-app-text-muted)]">Toplam</span>
                <strong className="text-sm">{decisionTarget.row.totalQuantity}</strong>
              </div>
              <div className="rounded-none border border-[var(--wms-app-border)] p-2">
                <span className="block text-[var(--wms-app-text-muted)]">Hak</span>
                <strong className="text-sm text-emerald-500">{decisionTarget.row.entitledQuantity}</strong>
              </div>
              <div className="rounded-none border border-[var(--wms-app-border)] p-2">
                <span className="block text-[var(--wms-app-text-muted)]">Fazla</span>
                <strong className="text-sm text-amber-500">{decisionTarget.row.excessQuantity}</strong>
              </div>
            </div>
            {!decisionTarget.approve ? (
              <p className="text-[0.78rem] leading-5 text-[var(--wms-app-text-muted)]">{KKD_QUOTA_REJECT_HINT}</p>
            ) : null}
            <AppInput
              value={decisionReason}
              onChange={(event) => setDecisionReason(event.target.value)}
              placeholder="Fiziksel kontrol notu (zorunlu, en az 5 karakter)"
            />
            <div className="flex justify-end gap-2 pt-1">
              <OpsActionButton variant="secondary" onClick={() => setDecisionTarget(null)}>
                Vazgeç
              </OpsActionButton>
              <OpsActionButton
                variant={decisionTarget.approve ? 'primary' : 'secondary'}
                className={decisionTarget.approve ? undefined : '!text-rose-500'}
                disabled={decision.isPending || decisionReason.trim().length < 5}
                onClick={() =>
                  decision.mutate({
                    id: decisionTarget.row.id,
                    approve: decisionTarget.approve,
                    reason: decisionReason.trim(),
                  })
                }
              >
                {decisionTarget.approve ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
                {decisionTarget.approve ? 'Onayla' : 'Reddet'}
              </OpsActionButton>
            </div>
          </div>
        ) : null}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={detail.data?.documentNo || 'Dağıtım detayı'}
        description="Belge özeti, stok kalemleri, hak/fazla ayrımı, sipariş ve izlenebilirlik bilgileri."
        className="!max-w-4xl"
      >
        {selectedId ? (
          <>
            <div className="mb-3 flex justify-end">
              <OpsActionButton variant="secondary" disabled={!detail.data} onClick={() => setReceiptOpen(true)}>
                <Printer className="size-3.5" /> Teslim belgesi
              </OpsActionButton>
            </div>
            {detail.isLoading ? (
              <OpsLoadingState code="DETAIL" message="Dağıtım detayı yükleniyor…" compact />
            ) : detail.data ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <KkdMetric label="Personel" value={`${detail.data.employeeCode} · ${detail.data.employeeName}`} />
                  <KkdMetric label="Durum" value={formatDistributionStatus(detail.data.status)} />
                  <KkdMetric
                    label="Kota onayı"
                    value={formatExcessApprovalStatus(detail.data.excessApprovalStatus)}
                  />
                  <KkdMetric label="Depo" value={detail.data.warehouseId} />
                  <KkdMetric label="Ambar çıkışı" value={detail.data.warehouseOutboundId || '—'} />
                </div>
                {isExcessApprovalPending(detail.data.excessApprovalStatus) ? (
                  <KkdCallout
                    tone="warn"
                    className="mt-4"
                    icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}
                    title={KKD_QUOTA_FULL_TITLE}
                  >
                    {KKD_QUOTA_FULL_MESSAGE}
                    {detail.data.excessApprovalReason ? (
                      <p className="mt-2 text-[0.78rem]">Kontrol notu: {detail.data.excessApprovalReason}</p>
                    ) : null}
                  </KkdCallout>
                ) : null}
                {detail.data.failureReason ? <KkdCallout tone="danger" className="mt-4">{detail.data.failureReason}</KkdCallout> : null}
                <KkdTableShell minWidthClass="min-w-[980px]" className="mt-4">
                  <thead><tr>{['#', 'Stok kodu', 'Stok adı', 'Grup', 'Toplam', 'Hak', 'Fazla', 'Raf', 'Lot / seri', 'Sipariş'].map((column) => <th key={column} className={KKD_HEAD_CELL}>{column}</th>)}</tr></thead>
                  <tbody>{detail.data.lines.map((line) => (
                    <tr key={line.id}>
                      <td className={KKD_CELL}>{line.lineNo}</td>
                      <td className={cn(KKD_CELL, 'font-mono font-bold')}>{line.stockCode}</td>
                      <td className={KKD_CELL}>{line.stockName}</td>
                      <td className={KKD_CELL}>{line.groupCode || '—'}</td>
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
            ) : (
              <OpsGridEmptyState message="Dağıtım detayı yüklenemedi." />
            )}
          </>
        ) : null}
      </ResponsiveDialog>

      <KkdDistributionReceiptDialog
        open={receiptOpen && Boolean(detail.data)}
        onOpenChange={setReceiptOpen}
        detail={detail.data ?? null}
      />
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
    roles?: Array<{
      id: number;
      code: string;
      name: string;
      isActive: boolean;
      departmentName?: string;
    }>;
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
    return (data.roles || []).map((x) => ({
      id: x.id,
      code: x.code,
      name: x.departmentName ? `${x.name} · ${x.departmentName}` : x.name,
      active: x.isActive,
    }));
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
