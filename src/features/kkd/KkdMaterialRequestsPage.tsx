import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, ClipboardList, Factory, ScanLine, Settings2, ShieldAlert, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AppDropdownOption } from '@/components/shared/AppDropdown';
import { AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import { OpsGridEmptyState } from '@/components/shared/OpsGridEmptyState';
import { OpsLoadingState } from '@/components/shared/OpsLoadingState';
import { OpsSelect } from '@/components/shared/OpsSelect';
import { OpsSkinCheckbox } from '@/components/shared/OpsSkinCheckbox';
import { OpsStatusBadge } from '@/components/shared/OpsStatusBadge';
import { cn } from '@/lib/utils';
import {
  KKD_CELL,
  KKD_HEAD_CELL,
  KkdCallout,
  KkdField,
  KkdMetric,
  KkdPage,
  KkdPanel,
  KkdSelectableCard,
  KkdTableShell,
} from './kkd-ops-ui';
import { kkdApi } from './kkd-api';

export function KkdMaterialRequestsPage(): ReactElement {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('');
  const [employeeQr, setEmployeeQr] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const employeeNumber = Number(employeeId || 0);
  const sortedOrders = useMemo(() => [...selectedOrders].sort(), [selectedOrders]);

  const configuration = useQuery({
    queryKey: ['kkd', 'material-requests', 'configuration'],
    queryFn: kkdApi.materialRequestConfiguration,
  });
  const enabled = configuration.data?.isEnabled === true;
  const employees = useQuery({ queryKey: ['kkd', 'employees'], queryFn: kkdApi.employees, enabled });
  const context = useQuery({
    queryKey: ['kkd', 'material-requests', 'context', employeeNumber],
    queryFn: () => kkdApi.materialRequestContext(employeeNumber),
    enabled: enabled && employeeNumber > 0,
  });
  const lines = useQuery({
    queryKey: ['kkd', 'material-requests', 'lines', employeeNumber, sortedOrders.join('|')],
    queryFn: () => kkdApi.materialRequestOrderLines(employeeNumber, sortedOrders),
    enabled: enabled && employeeNumber > 0 && sortedOrders.length > 0,
  });
  const resolveEmployee = useMutation({
    mutationFn: () => kkdApi.resolveEmployeeQr(employeeQr.trim()),
    onSuccess: (employee) => {
      setEmployeeId(String(employee.id));
      toast.success(`${employee.employeeCode} · ${employee.fullName} bulundu.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Personel kartı çözümlenemedi.'),
  });

  useEffect(() => setSelectedOrders([]), [employeeId]);

  const toggleOrder = (orderNumber: string): void => {
    setSelectedOrders((current) => {
      if (current.includes(orderNumber)) return current.filter((item) => item !== orderNumber);
      if (!context.data?.policy.allowMultipleOrdersPerDistribution) return [orderNumber];
      return [...new Set([...current, orderNumber])];
    });
  };

  const prepareDistribution = (): void => {
    if (!enabled || !employeeNumber || sortedOrders.length === 0) return;
    const params = new URLSearchParams({
      employeeId: String(employeeNumber),
      orders: sortedOrders.join(','),
      taskMode: '1',
    });
    navigate(`/warehouse/kkd/distributions/new?${params.toString()}`);
  };

  const employeeOptions: AppDropdownOption[] = (employees.data ?? []).map((employee) => ({
    value: String(employee.id),
    label: `${employee.employeeCode} · ${employee.fullName}`,
  }));
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
        <div className="flex flex-wrap gap-1.5">
          <OpsActionButton variant="secondary" className="wms-ops-list-toolbar-btn" asChild>
            <Link to="/warehouse/production-transfers/task-pool">
              <Factory className="size-3.5 shrink-0" />
              Üretim transfer görevleri
            </Link>
          </OpsActionButton>
          <OpsActionButton variant="primary" className="wms-ops-list-toolbar-btn" asChild>
            <Link to="/warehouse/production-transfers/material-requests" aria-current="page">
              <ClipboardList className="size-3.5 shrink-0" />
              Malzeme talep siparişleri
            </Link>
          </OpsActionButton>
        </div>
      }
    >
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
          description="Kartı okutun veya listeden seçin; bağlı cari ve açık talepler otomatik getirilir."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (employeeQr.trim()) resolveEmployee.mutate();
              }}
            >
              <KkdField label="Personel kartı / QR" className="flex-1">
                <AppInput
                  autoFocus
                  value={employeeQr}
                  onChange={(event) => setEmployeeQr(event.target.value)}
                  placeholder="Kartı okutun veya kodu yazın"
                />
              </KkdField>
              <OpsActionButton
                type="submit"
                variant="secondary"
                disabled={!employeeQr.trim()}
                loading={resolveEmployee.isPending}
                loadingLabel={<>Aranıyor…</>}
              >
                <ScanLine className="size-3.5 shrink-0" />
                Talepleri getir
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
              <OpsLoadingState code="CTX" message="Personel carisi ve açık talepler okunuyor…" compact />
            </div>
          ) : null}

          {context.data ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <KkdMetric label="Personel" value={`${context.data.employeeCode} · ${context.data.employeeName}`} />
              <KkdMetric
                label="Netsis carisi"
                value={`${context.data.customerCode} · ${context.data.customerName}`}
              />
              <KkdMetric label="Açık talep" value={`${context.data.orders.length} sipariş`} />
            </div>
          ) : null}
        </KkdPanel>
      ) : null}

      {enabled && context.isError ? (
        <KkdCallout
          tone="danger"
          icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}
          title="Malzeme talepleri okunamadı"
        >
          {context.error instanceof Error
            ? context.error.message
            : 'Personel-cari bağlantısı veya Netsis erişimi kontrol edilmelidir.'}
        </KkdCallout>
      ) : null}

      {context.data ? (
        <KkdPanel
          code="ORD_02"
          icon={<ClipboardList className="size-4" strokeWidth={1.75} />}
          title="Açık siparişler"
          description="Sipariş seçildiğinde kalan kalemler aşağıda açılır; WMS stoğuyla eşleşmeyen satırlar dağıtıma alınmaz."
          actions={
            <OpsActionButton
              variant="primary"
              className="wms-ops-list-toolbar-btn"
              disabled={sortedOrders.length === 0}
              onClick={prepareDistribution}
            >
              Seçilenleri dağıtıma hazırla
              <ArrowRight className="size-3.5 shrink-0" />
            </OpsActionButton>
          }
        >
          {context.data.orders.length === 0 ? (
            <KkdCallout tone="warn" icon={<ShieldAlert className="size-4" strokeWidth={1.75} />}>
              Bu personelin bağlı olduğu cari için açık Netsis siparişi bulunamadı.
            </KkdCallout>
          ) : (
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
                    <strong className="block font-mono">{order.orderNumber}</strong>
                    <span className="block text-xs text-[var(--wms-app-text-muted)]">
                      {order.projectCode || 'Projesiz'} ·{' '}
                      {order.orderDate ? new Date(order.orderDate).toLocaleDateString('tr-TR') : 'Tarih yok'} · Açık{' '}
                      {order.remainingQuantity}
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
          title="Talep kalemleri"
          description="Kalan miktarlar Netsis satır bakiyesinden anlık okunur."
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
