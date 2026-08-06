import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  UsersRound,
  Warehouse,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { AppDropdownOption } from '@/components/shared/AppDropdown';
import { AppDateInput, AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsSelect } from '@/components/shared/OpsSelect';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { PagedAppDropdown } from '@/components/shared/PagedAppDropdown';
import { OPS_SELECT_TRIGGER_CLASS } from '@/components/shared/ops-field-styles';
import type {
  ActiveUserOption,
  LocationOption,
  WarehouseOption,
} from '@/features/goods-receipt-v2/types/goods-receipt.types';
import { warehouseOutboundApi } from '@/features/warehouse-outbound/warehouseOutbound-api';
import { cn } from '@/lib/utils';
import {
  KKD_CELL,
  KKD_HEAD_CELL,
  KkdCallout,
  KkdField,
  KkdMetric,
  KkdPage,
  KkdPanel,
  KkdRowCheckbox,
  KkdSelectableCard,
  KkdTableShell,
  KkdTextarea,
} from './kkd-ops-ui';
import { kkdApi, type KkdDistributionCreateResult, type KkdOpenOrderLine } from './kkd-api';

const today = (): string => new Date().toLocaleDateString('en-CA');
const lineKey = (line: KkdOpenOrderLine): string => `${line.orderNumber}|${line.orderLineId}`;
type LineEdit = {
  selected: boolean;
  quantity: number;
  sourceLocationId?: number;
  sourceLocationValue?: string | null;
  lotNo: string;
  serials: string;
};
const encodeUser = (user: ActiveUserOption): string => encodeURIComponent(JSON.stringify(user));
const decodeUser = (value: string | null): ActiveUserOption | null =>
  value ? (JSON.parse(decodeURIComponent(value)) as ActiveUserOption) : null;

export function KkdDistributionCreatePage(): ReactElement {
  const [searchParams] = useSearchParams();
  const [initialSelection] = useState(() => ({
    employeeId: searchParams.get('employeeId')?.trim() || '',
    orders: [
      ...new Set(
        (searchParams.get('orders') || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ],
    taskMode: searchParams.get('taskMode') === '1',
  }));
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees });
  const series = useQuery({ queryKey: ['kkd', 'distribution-series'], queryFn: kkdApi.distributionSeries });
  const [employeeId, setEmployeeId] = useState(initialSelection.employeeId);
  const [employeeQr, setEmployeeQr] = useState('');
  const employeeNumber = Number(employeeId || 0);
  const context = useQuery({
    queryKey: ['kkd', 'distribution-context', employeeNumber],
    queryFn: () => kkdApi.distributionContext(employeeNumber),
    enabled: employeeNumber > 0,
  });
  const [orders, setOrders] = useState<string[]>(initialSelection.orders);
  const sortedOrders = useMemo(() => [...orders].sort(), [orders]);
  const orderLines = useQuery({
    queryKey: ['kkd', 'distribution-lines', employeeNumber, sortedOrders.join('|')],
    queryFn: () => kkdApi.distributionOrderLines(employeeNumber, sortedOrders),
    enabled: employeeNumber > 0 && sortedOrders.length > 0,
  });
  const [warehouseValue, setWarehouseValue] = useState<string | null>(null);
  const warehouseId = Number(warehouseValue?.split('|')[0] || 0);
  const [seriesId, setSeriesId] = useState('');
  const [documentDate, setDocumentDate] = useState(today());
  const [description, setDescription] = useState('');
  const [edits, setEdits] = useState<Record<string, LineEdit>>({});
  const [result, setResult] = useState<KkdDistributionCreateResult>();
  const [assignees, setAssignees] = useState<ActiveUserOption[]>([]);
  const resolveEmployee = useMutation({
    mutationFn: () => kkdApi.resolveEmployeeQr(employeeQr.trim()),
    onSuccess: (employee) => {
      setEmployeeId(String(employee.id));
      toast.success(`${employee.employeeCode} · ${employee.fullName} seçildi.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Personel QR kodu çözümlenemedi.'),
  });

  useEffect(() => {
    setOrders(employeeId === initialSelection.employeeId ? initialSelection.orders : []);
    setEdits({});
    setWarehouseValue(null);
    setAssignees([]);
    setResult(undefined);
  }, [employeeId, initialSelection]);

  useEffect(() => {
    const preferred = series.data?.find((x) => x.isDefault) ?? series.data?.[0];
    if (preferred && !seriesId) setSeriesId(String(preferred.id));
  }, [series.data, seriesId]);

  const patch = (line: KkdOpenOrderLine, value: Partial<LineEdit>): void =>
    setEdits((current) => {
      const key = lineKey(line);
      const existing =
        current[key] ?? { selected: false, quantity: Math.min(1, line.remainingQuantity), lotNo: '', serials: '' };
      return { ...current, [key]: { ...existing, ...value } };
    });
  const selected = (orderLines.data ?? []).filter((x) => edits[lineKey(x)]?.selected);

  const create = useMutation({
    mutationFn: async () => {
      if (!employeeNumber || !warehouseId || !seriesId || selected.length === 0) {
        throw new Error('Personel, kaynak depo, belge serisi ve en az bir sipariş kalemi zorunludur.');
      }
      const lines = selected.map((line) => {
        const edit = edits[lineKey(line)];
        if (!line.isMapped || !line.stockId) {
          throw new Error(line.mappingMessage || `${line.stockCode} WMS stoğuyla eşleşmiyor.`);
        }
        if (!edit.sourceLocationId) throw new Error(`${line.stockCode} için kaynak raf seçilmelidir.`);
        if (edit.quantity <= 0 || edit.quantity > line.remainingQuantity) {
          throw new Error(`${line.stockCode} miktarı 0 ile ${line.remainingQuantity} arasında olmalıdır.`);
        }
        const serials = edit.serials
          .split(/[\n,;]+/)
          .map((x) => x.trim())
          .filter(Boolean);
        const trackings = serials.length
          ? serials.map((serialNo) => ({
              quantity: 1,
              lotNo: edit.lotNo.trim() || null,
              serialNo,
              handlingUnitNo: null,
              manufacturingDate: null,
              expirationDate: null,
              sourceLocationId: edit.sourceLocationId!,
            }))
          : edit.lotNo.trim()
            ? [
                {
                  quantity: edit.quantity,
                  lotNo: edit.lotNo.trim(),
                  serialNo: null,
                  handlingUnitNo: null,
                  manufacturingDate: null,
                  expirationDate: null,
                  sourceLocationId: edit.sourceLocationId,
                },
              ]
            : null;
        if (serials.length && serials.length !== edit.quantity) {
          throw new Error(`${line.stockCode} için seri sayısı teslim miktarıyla aynı olmalıdır.`);
        }
        return {
          stockId: line.stockId,
          yapCodeId: null,
          quantity: edit.quantity,
          unitCode: line.unitCode || null,
          sourceLocationId: edit.sourceLocationId,
          orderNumber: line.orderNumber,
          orderLineId: line.orderLineId,
          requireHandlingUnit: false,
          description: null,
          trackings,
        };
      });
      return kkdApi.createDistribution({
        idempotencyKey: crypto.randomUUID(),
        employeeId: employeeNumber,
        warehouseId,
        documentSeriesId: Number(seriesId),
        documentDate,
        stagingLocationId: null,
        loadingLocationId: null,
        description: description.trim() || null,
        lines,
        createWarehouseTask: initialSelection.taskMode,
        assignedUserIds: initialSelection.taskMode ? assignees.map((x) => x.id) : null,
      });
    },
    onSuccess: (value) => {
      setResult(value);
      toast.success(
        value.excessApprovalStatus === 'Pending'
          ? `${value.documentNo} oluşturuldu; kota aşımı için yönetici onayı bekleniyor.`
          : `${value.documentNo} oluşturuldu; ambar çıkış operasyonuna hazır.`,
      );
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'KKD dağıtımı oluşturulamadı.'),
  });

  const employeeOptions: AppDropdownOption[] = (employees.data ?? []).map((employee) => ({
    value: String(employee.id),
    label: `${employee.employeeCode} · ${employee.fullName}`,
  }));
  const seriesOptions: AppDropdownOption[] = (series.data ?? []).map((item) => ({
    value: String(item.id),
    label: `${item.code} · ${item.name}`,
    description: item.isDefault ? 'Varsayılan seri' : item.previewDocumentNumber,
  }));
  const lineColumns = ['Seç', 'Sipariş / sıra', 'Stok', 'Proje', 'Açık miktar', 'Eşleme'];

  return (
    <KkdPage
      title={initialSelection.taskMode ? 'Malzeme Talebi Görevi' : 'Yeni KKD Dağıtımı'}
      description={
        initialSelection.taskMode
          ? 'Windbox siparişini depo çalışanına görev olarak atayın; fiziksel çıkış tamamlandığında hak ve ERP kaydı birlikte sonuçlansın.'
          : 'Personelin açık Netsis siparişinden hakkını ayırın; fiziksel çıkış tamamlandığında hak tüketimi ve ERP ambar çıkışı otomatik sonuçlansın.'
      }
    >
      {result ? (
        <KkdCallout
          tone="success"
          icon={<CheckCircle2 className="size-5" strokeWidth={1.75} />}
          title={`${result.documentNo} hazır`}
          actions={
            <OpsActionButton variant="primary" className="wms-ops-list-toolbar-btn" asChild>
              <Link to={`/warehouse/warehouse-outbounds/${result.warehouseOutboundId}/operations`}>
                <PackageCheck className="size-3.5 shrink-0" />
                Ambar çıkış operasyonunu aç
              </Link>
            </OpsActionButton>
          }
        >
          {result.totalQuantity} toplam · {result.entitledQuantity} hak · {result.excessQuantity} sipariş fazlası
        </KkdCallout>
      ) : null}

      <KkdPanel
        code="EMP_01"
        icon={<UserRound className="size-4" strokeWidth={1.75} />}
        title="Personel seçimi"
        description="Kartı okutun veya listeden seçin; bağlı Netsis carisi otomatik çözümlenir."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (employeeQr.trim()) resolveEmployee.mutate();
            }}
          >
            <KkdField label="Personel QR kodu" className="flex-1">
              <AppInput
                autoFocus
                value={employeeQr}
                onChange={(event) => setEmployeeQr(event.target.value)}
                placeholder="Kartı okutun veya QR kodunu yazın"
              />
            </KkdField>
            <OpsActionButton
              type="submit"
              variant="secondary"
              disabled={!employeeQr.trim()}
              loading={resolveEmployee.isPending}
              loadingLabel={<>Çözümleniyor…</>}
            >
              <ScanLine className="size-3.5 shrink-0" />
              Çözümle
            </OpsActionButton>
          </form>
          <KkdField label="Personel">
            <OpsSelect
              value={employeeId}
              onValueChange={setEmployeeId}
              options={employeeOptions}
              placeholder="Personel seçin"
              searchable
            />
          </KkdField>
        </div>

        {context.isLoading ? (
          <div className="mt-3">
            <OpsLoadingState code="CTX" message="Personel carisi ve açık siparişler okunuyor…" compact />
          </div>
        ) : null}

        {context.data ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <KkdMetric label="Personel" value={`${context.data.employeeCode} · ${context.data.employeeName}`} />
            <KkdMetric label="Bağlı Netsis carisi" value={`${context.data.customerCode} · ${context.data.customerName}`} />
            <KkdMetric label="Şube" value={context.data.branchCode} hint={`${context.data.orders.length} açık sipariş`} />
          </div>
        ) : null}
      </KkdPanel>

      {context.data ? (
        <KkdCallout tone="info" icon={<ShieldCheck className="size-4" strokeWidth={1.75} />} title="Etkin KKD süreç politikası">
          {context.data.policy.requireOpenOrder
            ? 'Açık Netsis siparişi zorunlu.'
            : 'Siparişsiz dağıtıma izin veriliyor.'}{' '}
          {context.data.policy.allowMultipleOrdersPerDistribution
            ? 'Birden fazla sipariş seçilebilir.'
            : 'Dağıtım tek siparişle sınırlandırılmıştır.'}{' '}
          {context.data.policy.allowOpenOrderExcess
            ? 'Açık sipariş bakiyesi içinde hak üstü teslim yapılabilir.'
            : 'Teslim, hesaplanan KKD hakkını aşamaz.'}{' '}
          {context.data.policy.requireManagerApprovalForExcess ? 'Hak üstü teslim yönetici fiziksel onayı bekler.' : ''}
          {context.data.preferredStocks.length > 0 ? (
            <div className="mt-1.5">
              <strong>Personelin grup tercihleri:</strong>{' '}
              {context.data.preferredStocks.map((x) => `${x.groupCode}: ${x.stockCode}`).join(' · ')}
            </div>
          ) : null}
        </KkdCallout>
      ) : null}

      {context.data ? (
        <KkdPanel
          code="ORD_02"
          icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
          title="Açık Netsis siparişleri"
          description="Her teslim satırı gerçek sipariş satırına bağlı kalır."
          actions={<OpsStatusBadge tone="neutral">{orders.length} seçili</OpsStatusBadge>}
        >
          {context.data.orders.length === 0 ? (
            <KkdCallout tone="warn" icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}>
              {context.data.policy.requireOpenOrder
                ? 'Bu personele bağlı cari için açık Netsis siparişi bulunmadığından dağıtım başlatılamaz.'
                : 'Bu personele bağlı cari için açık Netsis siparişi bulunamadı.'}
            </KkdCallout>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {context.data.orders.map((order) => {
                const isSelected = orders.includes(order.orderNumber);
                const toggle = (): void =>
                  setOrders((current) => {
                    if (isSelected) return current.filter((x) => x !== order.orderNumber);
                    if (!context.data?.policy.allowMultipleOrdersPerDistribution) return [order.orderNumber];
                    return [...new Set([...current, order.orderNumber])];
                  });
                return (
                  <KkdSelectableCard
                    key={order.orderNumber}
                    selected={isSelected}
                    onToggle={toggle}
                    control={
                      <OpsSkinCheckbox checked={isSelected} onCheckedChange={toggle} aria-label={order.orderNumber} />
                    }
                  >
                    <strong className="block font-mono">{order.orderNumber}</strong>
                    <span className="block text-xs text-[var(--wms-app-text-muted)]">
                      {order.projectCode || 'Projesiz'} · Açık {order.remainingQuantity}
                    </span>
                  </KkdSelectableCard>
                );
              })}
            </div>
          )}
        </KkdPanel>
      ) : null}

      {sortedOrders.length > 0 ? (
        <KkdPanel
          code="LIN_03"
          icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
          title="Sipariş kalemleri"
          description="WMS stoğuyla eşleşmeyen satırlar dağıtıma alınamaz."
          actions={<OpsStatusBadge tone="neutral">{selected.length} kalem</OpsStatusBadge>}
          bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
        >
          <KkdTableShell minWidthClass="min-w-[900px]" className="border-x-0 border-b-0">
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
              {orderLines.isLoading ? (
                <tr>
                  <td colSpan={lineColumns.length} className="wms-ops-grid-state-cell">
                    <OpsLoadingState code="FETCH" message="Sipariş kalemleri okunuyor…" compact />
                  </td>
                </tr>
              ) : (orderLines.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={lineColumns.length} className="wms-ops-grid-state-cell">
                    <OpsGridEmptyState message="Seçilen siparişlerde açık kalem bulunamadı." />
                  </td>
                </tr>
              ) : (
                orderLines.data?.map((line) => (
                  <tr key={lineKey(line)}>
                    <td className={cn(KKD_CELL, 'text-center')}>
                      <KkdRowCheckbox
                        checked={edits[lineKey(line)]?.selected || false}
                        disabled={!line.isMapped}
                        onCheckedChange={(checked) => patch(line, { selected: checked })}
                        ariaLabel={`${line.stockCode} kalemini seç`}
                      />
                    </td>
                    <td className={cn(KKD_CELL, 'font-mono font-black text-[var(--wms-brand-primary)]')}>
                      {line.orderNumber} / {line.orderLineSequence}
                    </td>
                    <td className={KKD_CELL}>
                      <strong className="block">{line.stockCode}</strong>
                      <span className="text-xs text-[var(--wms-app-text-muted)]">{line.stockName}</span>
                    </td>
                    <td className={KKD_CELL}>{line.projectCode || '—'}</td>
                    <td className={cn(KKD_CELL, 'text-right font-bold')}>
                      {line.remainingQuantity} {line.unitCode}
                    </td>
                    <td className={KKD_CELL}>
                      {line.isMapped ? (
                        <OpsStatusBadge tone="done">WMS ile eşleşti</OpsStatusBadge>
                      ) : (
                        <span className="inline-flex items-start gap-2 text-rose-500">
                          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                          <span className="text-xs">{line.mappingMessage}</span>
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

      {selected.length > 0 ? (
        <KkdPanel
          code="OUT_04"
          icon={<Warehouse className="size-4" strokeWidth={1.75} />}
          title="Teslim ve stok çıkış ayrıntıları"
          description="Kaynak depo, belge serisi ve satır bazında raf/seri bilgisi ambar çıkışını oluşturur."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <KkdField label="Kaynak depo">
              <div className="wms-ops-field-shell">
                <PagedAppDropdown<WarehouseOption>
                  queryKey={['kkd-warehouses', context.data?.branchCode]}
                  fetchPage={(request) => warehouseOutboundApi.warehouses(request, context.data?.branchCode || '0')}
                  toOption={(item) => ({
                    value: `${item.id}|${item.warehouseCode}`,
                    label: `${item.warehouseCode} · ${item.warehouseName}`,
                  })}
                  value={warehouseValue}
                  onValueChange={(value) => {
                    setWarehouseValue(value);
                    setEdits((current) =>
                      Object.fromEntries(
                        Object.entries(current).map(([key, item]) => [
                          key,
                          { ...item, sourceLocationId: undefined, sourceLocationValue: null },
                        ]),
                      ),
                    );
                  }}
                  placeholder="Kaynak depo seçin"
                  searchable
                  className={OPS_SELECT_TRIGGER_CLASS}
                />
              </div>
            </KkdField>
            <KkdField label="Ambar çıkış belge serisi">
              <OpsSelect
                value={seriesId}
                onValueChange={setSeriesId}
                options={seriesOptions}
                placeholder="Seri seçin"
                searchable
              />
            </KkdField>
            <KkdField label="Belge tarihi">
              <AppDateInput value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
            </KkdField>
          </div>

          <div className="mt-4 space-y-3">
            {selected.map((line) => {
              const edit = edits[lineKey(line)];
              return (
                <article
                  key={lineKey(line)}
                  className="border border-[var(--wms-ops-card-border)] bg-[color-mix(in_oklab,var(--wms-ops-field-bg)_82%,transparent)] p-3.5"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block">
                        {line.stockCode} · {line.stockName}
                      </strong>
                      <span className="text-xs text-[var(--wms-app-text-muted)]">
                        {line.orderNumber} / sıra {line.orderLineSequence} · en fazla {line.remainingQuantity}
                      </span>
                    </div>
                    <OpsStatusBadge tone="active">{line.unitCode || 'ADET'}</OpsStatusBadge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <KkdField label="Miktar">
                      <AppInput
                        type="number"
                        min="0.000001"
                        max={line.remainingQuantity}
                        step="any"
                        value={edit.quantity}
                        onChange={(event) => patch(line, { quantity: Number(event.target.value) })}
                      />
                    </KkdField>
                    <KkdField label="Kaynak raf">
                      <div className="wms-ops-field-shell">
                        <PagedAppDropdown<LocationOption>
                          queryKey={['kkd-location', warehouseId, lineKey(line)]}
                          fetchPage={(request) => warehouseOutboundApi.locations(request, warehouseId)}
                          toOption={(item) => ({
                            value: String(item.id),
                            label: `${item.code} · ${item.name}`,
                            description: item.locationType,
                          })}
                          enabled={warehouseId > 0}
                          dependencies={[warehouseId]}
                          value={edit.sourceLocationValue}
                          onValueChange={(value) =>
                            patch(line, { sourceLocationValue: value, sourceLocationId: Number(value) })
                          }
                          placeholder="Kaynak raf seçin"
                          searchable
                          className={OPS_SELECT_TRIGGER_CLASS}
                        />
                      </div>
                    </KkdField>
                    <KkdField label="Lot" hint="Varsa lot numarası.">
                      <AppInput value={edit.lotNo} onChange={(event) => patch(line, { lotNo: event.target.value })} />
                    </KkdField>
                    <KkdField label="Seriler" hint="Satır veya virgülle ayırın.">
                      <KkdTextarea
                        value={edit.serials}
                        onChange={(value) => patch(line, { serials: value })}
                        className="font-mono"
                        ariaLabel={`${line.stockCode} seri numaraları`}
                      />
                    </KkdField>
                  </div>
                </article>
              );
            })}
          </div>

          {initialSelection.taskMode ? (
            <div className="mt-4 border border-[color-mix(in_oklab,var(--wms-ops-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_6%,transparent)] p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <UsersRound className="size-4 shrink-0 text-[var(--wms-ops-accent)]" strokeWidth={1.75} />
                <strong className="text-[0.8rem]">Depo görevlileri</strong>
                <OpsStatusBadge tone="neutral">Opsiyonel</OpsStatusBadge>
              </div>
              <p className="mb-3 text-[0.72rem] leading-5 text-[var(--wms-app-text-muted)]">
                İsterseniz talebi şimdi atayın. Boş bırakırsanız açık görev oluşur ve görev havuzundan sonradan
                atanabilir; sevk politikası atamayı zorunlu tutuyorsa API işlemi güvenli biçimde durdurur.
              </p>
              <div className="wms-ops-field-shell">
                <PagedAppDropdown<ActiveUserOption>
                  queryKey={['kkd-material-request-users']}
                  fetchPage={warehouseOutboundApi.users}
                  toOption={(user) => ({
                    value: encodeUser(user),
                    label: `${user.firstName} ${user.lastName}`.trim() || user.username,
                    description: `${user.username} · ${user.email}`,
                    disabled: assignees.some((x) => x.id === user.id),
                  })}
                  value={null}
                  onValueChange={(value) => {
                    const user = decodeUser(value);
                    if (user) {
                      setAssignees((current) => (current.some((x) => x.id === user.id) ? current : [...current, user]));
                    }
                  }}
                  placeholder="Depo çalışanı ekle"
                  searchable
                  minSearchLength={1}
                  className={OPS_SELECT_TRIGGER_CLASS}
                />
              </div>
              {assignees.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {assignees.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-2 border border-[color-mix(in_oklab,var(--wms-ops-accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--wms-ops-accent)_10%,transparent)] px-2.5 py-1 text-xs"
                    >
                      <strong>{`${user.firstName} ${user.lastName}`.trim() || user.username}</strong>
                      <button
                        type="button"
                        onClick={() => setAssignees((current) => current.filter((x) => x.id !== user.id))}
                        className="text-rose-500"
                        aria-label={`${user.username} atamasını kaldır`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <KkdField label="Açıklama" className="mt-4">
            <KkdTextarea
              value={description}
              onChange={setDescription}
              className="min-h-24"
              ariaLabel="Dağıtım açıklaması"
            />
          </KkdField>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <OpsActionButton
              variant="primary"
              loading={create.isPending}
              loadingLabel={
                <>
                  <PackageCheck className="size-3.5 shrink-0" />
                  Hazırlanıyor…
                </>
              }
              onClick={() => create.mutate()}
            >
              <PackageCheck className="size-3.5 shrink-0" />
              Dağıtımı ve ambar çıkışını hazırla
            </OpsActionButton>
          </div>
        </KkdPanel>
      ) : null}
    </KkdPage>
  );
}
