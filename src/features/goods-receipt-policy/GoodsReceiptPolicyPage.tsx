import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, PlugZap, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { AppDropdown } from '@/components/shared/AppDropdown';
import { usePermissionAccess } from '@/features/access-control/hooks/usePermissionAccess';
import { goodsReceiptV2Api } from '@/features/goods-receipt-v2/api/goods-receipt.api';
import { api } from '@/lib/axios';
import { useAuthStore } from '@/stores/auth-store';

type Policy = {
  id: number;
  branchCode: string;
  overReceiptPolicy: string;
  overReceiptTolerancePercent: number;
  allowUnderReceipt: boolean;
  requireShortCloseApproval: boolean;
  requireReceiptApproval: boolean;
  requireQualityApproval: boolean;
  requireErpApproval: boolean;
  holdInventoryUntilQualityDecision: boolean;
  blockPutawayUntilQualityDecision: boolean;
  inventoryAvailabilityPolicy: string;
  erpPostingPolicy: string;
  allowOrderlessReceipt: boolean;
  allowUnplannedReceipt: boolean;
};

type Envelope<T> = { success: boolean; data: T; message?: string };

const unwrap = <T,>(value: Envelope<T>): T => {
  if (!value.success) throw new Error(value.message || 'İşlem başarısız.');
  return value.data;
};

export function GoodsReceiptPolicyPage() {
  const branch = useAuthStore((state) => state.branch?.code ?? '0');
  const { can } = usePermissionAccess();
  const [form, setForm] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingErp, setTestingErp] = useState(false);

  useEffect(() => {
    api.get<Envelope<Policy>>(`/api/goods-receipt-policy?branchCode=${encodeURIComponent(branch)}`)
      .then((value) => setForm(unwrap(value)))
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Politika yüklenemedi.'));
  }, [branch]);

  const set = <K extends keyof Policy>(key: K, value: Policy[K]) =>
    setForm((current) => current ? { ...current, [key]: value } : current);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      setForm(unwrap(await api.put<Envelope<Policy>>('/api/goods-receipt-policy', form)));
      toast.success('Mal kabul politikası kaydedildi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const testErpLogin = async () => {
    setTestingErp(true);
    try {
      await goodsReceiptV2Api.testErpLogin();
      toast.success('Netsis REST login başarılı. Token güvenli biçimde alındı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Netsis REST login başarısız.');
    } finally {
      setTestingErp(false);
    }
  };

  if (!form) {
    return <div className="grid min-h-72 place-items-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header>
        <div className="flex items-center gap-2 text-cyan-500">
          <SlidersHorizontal />
          <span className="text-xs font-bold uppercase tracking-widest">Mal Kabul</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold">Mal Kabul Süreç Politikası</h1>
        <p className="text-sm text-slate-500">
          Fazla/eksik kabul, operasyon onayı, kalite kapısı, stok kullanılabilirliği ve ERP gönderim zamanını merkezi yönetin.
        </p>
      </header>

      <div className="rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Fazla kabul">
            <AppDropdown
              value={form.overReceiptPolicy}
              onValueChange={(value) => {
                set('overReceiptPolicy', value);
                if (value === 'NotAllowed') set('overReceiptTolerancePercent', 0);
              }}
              options={[
                { value: 'NotAllowed', label: 'İzin verme' },
                { value: 'WithinTolerance', label: 'Tolerans içinde izin ver' },
                { value: 'ApprovalRequired', label: 'Tolerans içinde onaya gönder' },
              ]}
            />
          </Field>
          <Field label="Fazla kabul toleransı (%)">
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              disabled={form.overReceiptPolicy === 'NotAllowed'}
              value={form.overReceiptTolerancePercent}
              onChange={(event) => set('overReceiptTolerancePercent', Number(event.target.value))}
            />
          </Field>
          <Field label="Stok ne zaman kullanılabilir?">
            <AppDropdown
              value={form.inventoryAvailabilityPolicy}
              onValueChange={(value) => set('inventoryAvailabilityPolicy', value)}
              options={[
                ['Immediate', 'Kabulde hemen'],
                ['AfterReceiptApproval', 'Mal kabul onayından sonra'],
                ['AfterQualityApproval', 'Kalite onayından sonra'],
                ['AfterAllApprovals', 'Tüm onaylardan sonra'],
              ].map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="ERP kaydı ne zaman?">
            <AppDropdown
              value={form.erpPostingPolicy}
              onValueChange={(value) => set('erpPostingPolicy', value)}
              options={[
                ['AfterReceipt', 'Kabul tamamlanınca'],
                ['AfterReceiptApproval', 'Mal kabul onayından sonra'],
                ['AfterQualityApproval', 'Kalite onayından sonra'],
                ['AfterAllApprovals', 'Tüm onaylardan sonra'],
              ].map(([value, label]) => ({ value, label }))}
            />
          </Field>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Toggle label="Eksik kabule izin ver" value={form.allowUnderReceipt} set={(value) => set('allowUnderReceipt', value)} />
          <Toggle label="Eksik kapatmada onay iste" value={form.requireShortCloseApproval} set={(value) => set('requireShortCloseApproval', value)} />
          <Toggle label="Kabul sonrası operasyon onayı iste" value={form.requireReceiptApproval} set={(value) => set('requireReceiptApproval', value)} />
          <Toggle label="Kalite onayı iste" value={form.requireQualityApproval} set={(value) => set('requireQualityApproval', value)} />
          <Toggle label="ERP onayı iste" value={form.requireErpApproval} set={(value) => set('requireErpApproval', value)} />
          <Toggle label="Kalite kararına kadar stoğu beklet" value={form.holdInventoryUntilQualityDecision} set={(value) => set('holdInventoryUntilQualityDecision', value)} />
          <Toggle label="Kalite kararına kadar rafa kaldırmayı beklet" value={form.blockPutawayUntilQualityDecision} set={(value) => set('blockPutawayUntilQualityDecision', value)} />
          <Toggle label="Emirsiz kabule izin ver" value={form.allowOrderlessReceipt} set={(value) => set('allowOrderlessReceipt', value)} />
          <Toggle label="Plansız kabule izin ver" value={form.allowUnplannedReceipt} set={(value) => set('allowUnplannedReceipt', value)} />
        </div>

        <div className="mt-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm">
          Bu ayarlar emir oluşturulurken başlığa snapshot olarak yazılır. Sonradan ayar değişse bile devam eden emir aynı kurallarla tamamlanır.
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {can('WMS.GOODS_RECEIPT.SETTINGS.MANAGE') ? (
            <button
              type="button"
              onClick={() => void testErpLogin()}
              disabled={testingErp}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/50 px-5 py-2.5 font-semibold text-cyan-700 disabled:opacity-50 dark:text-cyan-300"
            >
              {testingErp ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
              Netsis REST Login Testi
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Politikayı kaydet
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, value, set }: { label: string; value: boolean; set: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => set(event.target.checked)}
        className="size-4"
      />
    </label>
  );
}
