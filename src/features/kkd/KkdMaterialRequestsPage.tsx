import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Factory,
  ScanLine,
  Settings2,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsQrCaptureField } from '@/components/shared/OpsQrCaptureField';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { cn } from '@/lib/utils';
import { KkdEmployeeLookupField } from './KkdEmployeeLookupField';
import {
  KKD_CELL,
  KKD_HEAD_CELL,
  KkdCallout,
  KkdField,
  KkdFlowSteps,
  KkdMetric,
  KkdPage,
  KkdPanel,
  KkdSelectableCard,
  KkdTableShell,
} from './kkd-ops-ui';
import { kkdApi } from './kkd-api';

const MATERIAL_FLOW_STEPS = [
  { id: 'select', label: 'Sipariş seçimi' },
  { id: 'distribute', label: 'Dağıtım görevi' },
] as const;

function parseResumeSelection(searchParams: URLSearchParams): { employeeId: string; orders: string[] } {
  return {
    employeeId: searchParams.get('employeeId')?.trim() || '',
    orders: [
      ...new Set(
        (searchParams.get('orders') || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ],
  };
}

function flashInvalidFields(): void {
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
}

function contextErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Personel-cari bağlantısı veya Netsis erişimi kontrol edilmelidir.';
}

export function KkdMaterialRequestsPage(): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [resume] = useState(() => parseResumeSelection(searchParams));
  /** Listeden / QR çözümünden seçilen personel (henüz talepler yüklenmemiş olabilir). */
  const [pickedEmployeeId, setPickedEmployeeId] = useState(resume.employeeId);
  /** Talepleri getir ile sabitlenen personel — sorgular buna bağlı. */
  const [activeEmployeeId, setActiveEmployeeId] = useState(resume.employeeId);
  const [employeeQr, setEmployeeQr] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>(resume.orders);
  const [fieldErrors, setFieldErrors] = useState<{ qr?: boolean; employee?: boolean }>({});
  const activeEmployeeNumber = Number(activeEmployeeId || 0);
  const sortedOrders = useMemo(() => [...selectedOrders].sort(), [selectedOrders]);
  const previousEmployeeIdRef = useRef(resume.employeeId);

  const configuration = useQuery({
    queryKey: ['kkd', 'material-requests', 'configuration'],
    queryFn: kkdApi.materialRequestConfiguration,
  });
  const enabled = configuration.data?.isEnabled === true;
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees, enabled });
  const context = useQuery({
    queryKey: ['kkd', 'material-requests', 'context', activeEmployeeNumber],
    queryFn: () => kkdApi.materialRequestContext(activeEmployeeNumber),
    enabled: enabled && activeEmployeeNumber > 0,
    retry: false,
  });
  const lines = useQuery({
    queryKey: ['kkd', 'material-requests', 'lines', activeEmployeeNumber, sortedOrders.join('|')],
    queryFn: () => kkdApi.materialRequestOrderLines(activeEmployeeNumber, sortedOrders),
    enabled: enabled && activeEmployeeNumber > 0 && sortedOrders.length > 0,
  });
  const resolveEmployee = useMutation({
    mutationFn: (qrCode: string) => kkdApi.resolveEmployeeQr(qrCode.trim()),
  });
  const requestsBusy = resolveEmployee.isPending || context.isFetching;

  useEffect(() => {
    if (previousEmployeeIdRef.current === activeEmployeeId) return;
    previousEmployeeIdRef.current = activeEmployeeId;
    setSelectedOrders([]);
  }, [activeEmployeeId]);

  useEffect(() => {
    if (!fieldErrors.qr && !fieldErrors.employee) return;
    const timer = window.setTimeout(() => flashInvalidFields(), 40);
    return () => window.clearTimeout(timer);
  }, [fieldErrors]);

  useEffect(() => {
    if (!context.isError || !context.error) return;
    toast.error(contextErrorMessage(context.error));
  }, [context.isError, context.errorUpdatedAt, context.error]);

  const pickEmployee = (employeeId: string): void => {
    setPickedEmployeeId(employeeId);
    setEmployeeQr('');
    setActiveEmployeeId('');
    setSelectedOrders([]);
    setFieldErrors({});
  };

  const onQrChange = (value: string): void => {
    setEmployeeQr(value);
    setFieldErrors((current) => (current.qr || current.employee ? {} : current));
    if (!value.trim()) return;
    // Son dokunuş QR: listeden seçimi bırak, eski sonuçları temizle.
    setPickedEmployeeId('');
    setActiveEmployeeId('');
    setSelectedOrders([]);
  };

  const loadEmployeeRequests = (employeeId: string): void => {
    setFieldErrors({});
    setPickedEmployeeId(employeeId);
    if (activeEmployeeId === employeeId) {
      void context.refetch();
      return;
    }
    setActiveEmployeeId(employeeId);
  };

  const loadRequests = (qrOverride?: string): void => {
    if (requestsBusy) return;
    const qr = (qrOverride ?? employeeQr).trim();
    if (qr) {
      setFieldErrors({});
      setEmployeeQr(qr);
      resolveEmployee.mutate(qr, {
        onSuccess: (employee) => {
          const id = String(employee.id);
          setEmployeeQr('');
          toast.success(`${employee.employeeCode} · ${employee.fullName} bulundu.`);
          loadEmployeeRequests(id);
        },
        onError: (error) => {
          setFieldErrors({ qr: true });
          toast.error(error instanceof Error ? error.message : 'Personel kartı çözümlenemedi.');
        },
      });
      return;
    }
    if (pickedEmployeeId) {
      loadEmployeeRequests(pickedEmployeeId);
      return;
    }
    setFieldErrors({ qr: true, employee: true });
    toast.error('Personel seçin veya kart / QR okutun.');
  };

  const toggleOrder = (orderNumber: string): void => {
    setSelectedOrders((current) => {
      if (current.includes(orderNumber)) return current.filter((item) => item !== orderNumber);
      if (!context.data?.policy.allowMultipleOrdersPerDistribution) return [orderNumber];
      return [...new Set([...current, orderNumber])];
    });
  };

  const prepareDistribution = (): void => {
    if (!enabled || !activeEmployeeNumber || sortedOrders.length === 0) return;
    const params = new URLSearchParams({
      employeeId: String(activeEmployeeNumber),
      orders: sortedOrders.join(','),
      taskMode: '1',
    });
    navigate(`/warehouse/kkd/distributions/new?${params.toString()}`);
  };

  const lineColumns = [
    'Sipariş / sıra',
    'Stok',
    'Proje',
    'Sipariş tarihi',
    'Teslim tarihi',
    'Kalan',
    'WMS durumu',
  ];

  return (
    <KkdPage
      title="Windbox Malzeme Talep Siparişleri"
      description="WMS v1 ile aynı iş kaynağı kullanılır: personelin bağlı olduğu cari bulunur ve Netsis'teki açık siparişleri gerçek satır bakiyeleriyle getirilir."
      actions={
        <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" asChild>
          <Link to="/warehouse/production-transfers/task-pool">
            <Factory className="size-3.5 shrink-0" />
            Üretim transfer görevleri
          </Link>
        </OpsActionButton>
      }
    >
      {enabled ? (
        <KkdFlowSteps steps={[...MATERIAL_FLOW_STEPS]} currentId="select" className="mb-3" />
      ) : null}

      {configuration.isLoading ? (
        <KkdPanel
          code="CFG"
          icon={<Settings2 className="size-4" strokeWidth={1.75} />}
          title="Şube politikası"
          description="Malzeme talep kanalının açık olup olmadığı okunuyor."
        >
          <OpsLoadingState code="POLICY" message="Şube malzeme talep politikası yükleniyor…" />
        </KkdPanel>
      ) : null}

      {configuration.isError ? (
        <KkdCallout tone="danger" icon={<ShieldAlert className="size-4" strokeWidth={1.75} />} title="Politika okunamadı">
          Malzeme talep süreç parametresi okunamadı.
        </KkdCallout>
      ) : null}

      {configuration.data && !enabled ? (
        <KkdCallout
          tone="warn"
          icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}
          title="Malzeme talep siparişleri kapalı"
          actions={
            <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" asChild>
              <Link to="/warehouse/kkd/policy">
                <Settings2 className="size-3.5 shrink-0" />
                KKD süreç politikasını aç
              </Link>
            </OpsActionButton>
          }
        >
          Bu kanal şubenin KKD süreç politikasından etkinleştirilmeden personel kartı veya Netsis açık siparişi
          okunmaz.
        </KkdCallout>
      ) : null}

      {enabled ? (
        <KkdPanel
          code="EMP_01"
          icon={<UserRound className="size-4" strokeWidth={1.75} />}
          title="Personel seçimi"
          description="Kart / QR okutunca (Enter, Tab veya kamera) personel seçilir ve talepler gelir. Listeden seçince Talepleri getir’e basın."
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              loadRequests();
            }}
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <KkdField label="Personel kartı / QR">
                <OpsQrCaptureField
                  autoFocus
                  value={employeeQr}
                  onChange={onQrChange}
                  onCommit={(code) => loadRequests(code)}
                  disabled={resolveEmployee.isPending}
                  invalid={Boolean(fieldErrors.qr)}
                  placeholder="Kartı okutun veya kodu yazın"
                />
              </KkdField>
              <KkdEmployeeLookupField
                value={pickedEmployeeId}
                employees={employees.data}
                onChange={pickEmployee}
                disabled={resolveEmployee.isPending}
                invalid={Boolean(fieldErrors.employee)}
              />
            </div>
            <div className="flex justify-stretch sm:justify-end">
              <OpsActionButton
                type="submit"
                variant="secondary"
                className="w-full sm:w-auto"
                loading={requestsBusy}
                loadingLabel={<>Aranıyor…</>}
              >
                <ScanLine className="size-3.5 shrink-0" />
                Talepleri getir
              </OpsActionButton>
            </div>
          </form>

          {activeEmployeeNumber > 0 && context.isLoading ? (
            <div className="mt-3">
              <OpsLoadingState code="CTX" message="Personel carisi ve açık talepler okunuyor…" compact />
            </div>
          ) : null}

          {activeEmployeeNumber > 0 && context.data ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <KkdMetric
                tone="person"
                icon={<UserRound className="size-4" strokeWidth={1.75} />}
                label="Personel"
                value={`${context.data.employeeCode} · ${context.data.employeeName}`}
              />
              <KkdMetric
                tone="customer"
                icon={<Building2 className="size-4" strokeWidth={1.75} />}
                label="Netsis carisi"
                value={`${context.data.customerCode} · ${context.data.customerName}`}
              />
              <KkdMetric
                tone="orders"
                icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
                label="Açık talep"
                value={`${context.data.orders.length} sipariş`}
              />
            </div>
          ) : null}
        </KkdPanel>
      ) : null}

      {enabled && activeEmployeeNumber > 0 && context.isError ? (
        <KkdCallout
          tone="danger"
          icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}
          title="Malzeme talepleri okunamadı"
        >
          {contextErrorMessage(context.error)}
        </KkdCallout>
      ) : null}

      {activeEmployeeNumber > 0 && context.data ? (
        <KkdPanel
          code="ORD_02"
          icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
          title="Açık siparişler"
          description="Sipariş seçilince kalemler aşağıda açılır. Dağıtıma hazırla ile 2. adıma (dağıtım görevi) geçilir."
        >
          {context.data.orders.length === 0 ? (
            <KkdCallout tone="warn" icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}>
              Bu personelin bağlı olduğu cari için açık Netsis siparişi bulunamadı.
            </KkdCallout>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {context.data.orders.map((order) => {
                  const isSelected = selectedOrders.includes(order.orderNumber);
                  return (
                    <KkdSelectableCard
                      key={order.orderNumber}
                      selected={isSelected}
                      onToggle={() => toggleOrder(order.orderNumber)}
                      control={
                        <OpsSkinCheckbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOrder(order.orderNumber)}
                          aria-label={order.orderNumber}
                        />
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <strong className="block min-w-0 font-mono text-[0.92rem] leading-5">
                          {order.orderNumber}
                        </strong>
                        <OpsStatusBadge tone={isSelected ? 'active' : 'neutral'}>
                          Açık {order.remainingQuantity}
                        </OpsStatusBadge>
                      </div>
                      <span className="mt-1 block text-xs text-[var(--wms-app-text-muted)]">
                        {order.projectCode || 'Projesiz'} ·{' '}
                        {order.orderDate ? new Date(order.orderDate).toLocaleDateString('tr-TR') : 'Tarih yok'}
                      </span>
                    </KkdSelectableCard>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-[color-mix(in_oklab,var(--wms-ops-card-border)_80%,transparent)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--wms-app-text-muted)]">
                  {sortedOrders.length === 0
                    ? 'Henüz sipariş seçilmedi.'
                    : `${sortedOrders.length} sipariş seçildi — sonraki adım: dağıtım görevi.`}
                </p>
                <OpsActionButton
                  type="button"
                  variant="primary"
                  className="w-full sm:w-auto sm:ml-auto"
                  disabled={sortedOrders.length === 0}
                  onClick={prepareDistribution}
                >
                  Seçilenleri dağıtıma hazırla
                  <ArrowRight className="size-3.5 shrink-0" />
                </OpsActionButton>
              </div>
            </>
          )}
        </KkdPanel>
      ) : null}

      {sortedOrders.length > 0 ? (
        <KkdPanel
          code="LIN_03"
          icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
          title="Talep kalemleri"
          description="Kalan miktarlar Netsis satır bakiyesinden anlık okunur. WMS stoğuyla eşleşmeyen satırlar dağıtıma alınmaz."
          bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
        >
          <KkdTableShell minWidthClass="min-w-[1000px]" className="border-x-0 border-b-0">
            <thead className="sticky top-0 z-10">
              <tr>
                {lineColumns.map((column) => (
                  <th key={column} className={KKD_HEAD_CELL}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.isLoading ? (
                <tr>
                  <td colSpan={lineColumns.length} className="wms-ops-grid-state-cell">
                    <OpsLoadingState code="FETCH" message="Talep kalemleri okunuyor…" compact />
                  </td>
                </tr>
              ) : (lines.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={lineColumns.length} className="wms-ops-grid-state-cell">
                    <OpsGridEmptyState message="Seçilen siparişlerde açık kalem bulunamadı." />
                  </td>
                </tr>
              ) : (
                lines.data?.map((line) => (
                  <tr key={`${line.orderNumber}|${line.orderLineId}`}>
                    <td className={cn(KKD_CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>
                      {line.orderNumber} / {line.orderLineSequence}
                    </td>
                    <td className={KKD_CELL}>
                      <strong className="block">{line.stockCode}</strong>
                      <span className="text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</span>
                    </td>
                    <td className={KKD_CELL}>{line.projectCode || '—'}</td>
                    <td className={cn(KKD_CELL, 'whitespace-nowrap')}>
                      {line.orderDate ? new Date(line.orderDate).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td className={cn(KKD_CELL, 'whitespace-nowrap')}>
                      {line.deliveryDate ? new Date(line.deliveryDate).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td className={cn(KKD_CELL, 'text-right font-bold')}>
                      {line.remainingQuantity} {line.unitCode}
                    </td>
                    <td className={KKD_CELL}>
                      {line.isMapped ? (
                        <OpsStatusBadge tone="done">Dağıtıma uygun</OpsStatusBadge>
                      ) : (
                        <span className="inline-flex items-start gap-2 text-rose-500">
                          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                          <span className="text-xs">{line.mappingMessage || 'WMS stok eşlemesi eksik.'}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </KkdTableShell>
        </KkdPanel>
      ) : null}
    </KkdPage>
  );
}
