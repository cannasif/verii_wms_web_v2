import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, ClipboardList, ScanLine, ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUIStore } from '@/stores/ui-store';
import { kkdApi } from './kkd-api';

const field = 'min-h-11 rounded-xl border border-[var(--wms-app-border)] bg-transparent px-3 text-sm outline-none focus:border-cyan-500';
const panel = 'rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5 shadow-sm';

export function KkdMaterialRequestsPage() {
  const navigate = useNavigate();
  const setPageTitle = useUIStore((state) => state.setPageTitle);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeQr, setEmployeeQr] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const employeeNumber = Number(employeeId || 0);
  const sortedOrders = useMemo(() => [...selectedOrders].sort(), [selectedOrders]);

  useEffect(() => {
    setPageTitle('Malzeme Talep Siparişleri');
    return () => setPageTitle(null);
  }, [setPageTitle]);

  const configuration = useQuery({ queryKey: ['kkd', 'material-requests', 'configuration'], queryFn: kkdApi.materialRequestConfiguration });
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

  const toggleOrder = (orderNumber: string, checked: boolean) => {
    setSelectedOrders((current) => {
      if (!checked) return current.filter((item) => item !== orderNumber);
      if (!context.data?.policy.allowMultipleOrdersPerDistribution) return [orderNumber];
      return [...new Set([...current, orderNumber])];
    });
  };

  const prepareDistribution = () => {
    if (!enabled || !employeeNumber || sortedOrders.length === 0) return;
    const params = new URLSearchParams({ employeeId: String(employeeNumber), orders: sortedOrders.join(','), taskMode: '1' });
    navigate(`/warehouse/kkd/distributions/new?${params.toString()}`);
  };

  return <section className="mx-auto w-full max-w-[1500px] space-y-5 p-4 lg:p-6">
    <header>
      <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-500">Depo İş Merkezi / Malzeme Talebi</p>
      <h1 className="mt-2 text-3xl font-black">Windbox malzeme talep siparişleri</h1>
      <p className="mt-1 text-sm text-slate-500">WMS v1 ile aynı iş kaynağı kullanılır: personelin bağlı olduğu cari bulunur ve Netsis'teki açık siparişleri gerçek satır bakiyeleriyle getirilir.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="rounded-xl border border-[var(--wms-app-border)] px-4 py-2 text-sm font-bold hover:border-cyan-500" to="/warehouse/production-transfers/task-pool">Üretim transfer görevleri</Link>
        <span className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950">Malzeme talep siparişleri</span>
      </div>
    </header>

    {configuration.isLoading && <div className={`${panel} text-sm text-slate-500`}>Şube malzeme talep politikası yükleniyor…</div>}
    {configuration.isError && <div className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-4 text-sm text-rose-500">Malzeme talep süreç parametresi okunamadı.</div>}
    {configuration.data && !enabled && <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-5 text-sm text-amber-600">
      <strong className="block text-base">Malzeme talep siparişleri kapalı</strong>
      <span>Bu kanal şubenin KKD süreç politikasından etkinleştirilmeden personel kartı veya Netsis açık siparişi okunmaz.</span>
      <Link className="mt-3 block font-black underline" to="/warehouse/kkd/policy">KKD süreç politikasını aç →</Link>
    </div>}

    {enabled && <div className={`${panel} grid gap-4 lg:grid-cols-2`}>
      <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (employeeQr.trim()) resolveEmployee.mutate(); }}>
        <label className="grid min-w-0 flex-1 gap-1 text-xs font-bold uppercase">Personel kartı / QR
          <input autoFocus className={field} value={employeeQr} onChange={(event) => setEmployeeQr(event.target.value)} placeholder="Kartı okutun veya kodu yazın" />
        </label>
        <button disabled={!employeeQr.trim() || resolveEmployee.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-500 px-4 font-black text-cyan-500 disabled:opacity-50">
          <ScanLine className="size-4" />{resolveEmployee.isPending ? 'Aranıyor…' : 'Talepleri getir'}
        </button>
      </form>
      <label className="grid gap-1 text-xs font-bold uppercase">Personel
        <select className={field} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          <option value="">Personel seçin</option>
          {employees.data?.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeCode} · {employee.fullName}</option>)}
        </select>
      </label>
    </div>}

    {enabled && context.isError && <div className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-4 text-sm text-rose-500">
      <strong className="block">Malzeme talepleri okunamadı</strong>
      <span>{context.error instanceof Error ? context.error.message : 'Personel-cari bağlantısı veya Netsis erişimi kontrol edilmelidir.'}</span>
    </div>}

    {context.data && <>
      <section className={`${panel} grid gap-4 md:grid-cols-3`}>
        <Metric label="Personel" value={`${context.data.employeeCode} · ${context.data.employeeName}`} />
        <Metric label="Netsis carisi" value={`${context.data.customerCode} · ${context.data.customerName}`} />
        <Metric label="Açık talep" value={`${context.data.orders.length} sipariş`} />
      </section>

      <section className={panel}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-lg font-black"><ClipboardList className="size-5 text-cyan-500" />Açık siparişler</h2><p className="text-sm text-slate-500">Sipariş seçildiğinde kalan kalemler aşağıda açılır; WMS stoğuyla eşleşmeyen satırlar dağıtıma alınmaz.</p></div>
          <button disabled={sortedOrders.length === 0} onClick={prepareDistribution} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-500 px-5 font-black text-slate-950 disabled:opacity-40">Seçilenleri dağıtıma hazırla <ArrowRight className="size-4" /></button>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {context.data.orders.map((order) => <label key={order.orderNumber} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selectedOrders.includes(order.orderNumber) ? 'border-cyan-500 bg-cyan-500/10' : 'border-[var(--wms-app-border)]'}`}>
            <input type="checkbox" checked={selectedOrders.includes(order.orderNumber)} onChange={(event) => toggleOrder(order.orderNumber, event.target.checked)} />
            <span className="min-w-0"><strong className="block">{order.orderNumber}</strong><small className="block text-slate-500">{order.projectCode || 'Projesiz'} · {order.orderDate ? new Date(order.orderDate).toLocaleDateString('tr-TR') : 'Tarih yok'} · Açık {order.remainingQuantity}</small></span>
          </label>)}
        </div>
        {context.data.orders.length === 0 && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-600">Bu personelin bağlı olduğu cari için açık Netsis siparişi bulunamadı.</p>}
      </section>
    </>}

    {lines.data && <section className={`${panel} overflow-auto`}>
      <h2 className="mb-3 text-lg font-black">Talep kalemleri</h2>
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead><tr className="border-b border-[var(--wms-app-border)]">{['Sipariş / sıra', 'Stok', 'Proje', 'Sipariş tarihi', 'Teslim tarihi', 'Kalan', 'WMS durumu'].map((title) => <th className="p-3" key={title}>{title}</th>)}</tr></thead>
        <tbody>{lines.data.map((line) => <tr key={`${line.orderNumber}|${line.orderLineId}`} className="border-b border-[var(--wms-app-border)]">
          <td className="p-3 font-bold">{line.orderNumber} / {line.orderLineSequence}</td>
          <td className="p-3">{line.stockCode}<small className="block text-slate-500">{line.stockName}</small></td>
          <td className="p-3">{line.projectCode || '-'}</td>
          <td className="p-3">{line.orderDate ? new Date(line.orderDate).toLocaleDateString('tr-TR') : '-'}</td>
          <td className="p-3">{line.deliveryDate ? new Date(line.deliveryDate).toLocaleDateString('tr-TR') : '-'}</td>
          <td className="p-3 font-bold">{line.remainingQuantity} {line.unitCode}</td>
          <td className="p-3">{line.isMapped ? <span className="text-emerald-500">Dağıtıma uygun</span> : <span className="inline-flex items-start gap-2 text-rose-500"><ShieldAlert className="mt-0.5 size-4 shrink-0" />{line.mappingMessage || 'WMS stok eşlemesi eksik.'}</span>}</td>
        </tr>)}</tbody>
      </table>
    </section>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}
