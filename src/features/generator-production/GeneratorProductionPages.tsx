import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Boxes, CalendarRange, CheckCircle2, ChevronRight, CircleStop, Factory, GitBranch,
  Loader2, PlayCircle, Plus, RefreshCw, Route, Settings2, Sparkles, Trash2, UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatProjectDate, formatProjectDateTime } from '@/lib/project-format';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { generatorProductionApi } from './api';
import { GeneratorPageHeader, GeneratorTaskSteps, GeneratorWorkflow } from './GeneratorProductionScreenKit';
import type { GeneratorOperationAction, GeneratorPlanPreview, GeneratorProjectRow, GeneratorRuleSeverity, GeneratorScheduleRow } from './types';

const panel = 'gp-panel rounded-2xl border border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]';
const field = 'min-h-11 w-full rounded-xl border border-[var(--wms-app-border)] bg-[var(--wms-app-surface)] px-3 text-sm text-[var(--wms-app-text)] outline-none focus:border-[var(--wms-brand-primary)]';
const primaryButton = 'gp-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--wms-brand-primary)] px-4 text-sm font-bold text-[var(--wms-brand-on-primary)] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'gp-secondary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--wms-app-border)] px-4 text-sm font-bold hover:border-[var(--wms-brand-primary)] disabled:cursor-not-allowed disabled:opacity-50';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'İşlem tamamlanamadı.';
}

export function GeneratorProductionHubPage(): ReactElement {
  const { t } = useModuleTranslation('generator-production');
  const overview = useQuery({ queryKey: ['generator-production', 'overview'], queryFn: generatorProductionApi.overview });
  const cards = [
    { label: t('overview.projects', { defaultValue: 'Toplam proje' }), value: overview.data?.projectCount ?? 0, icon: Boxes },
    { label: t('overview.planned', { defaultValue: 'Planlanan' }), value: overview.data?.plannedProjectCount ?? 0, icon: CalendarRange },
    { label: t('overview.active', { defaultValue: 'Aktif üretim' }), value: overview.data?.activeProjectCount ?? 0, icon: PlayCircle },
    { label: t('overview.delayed', { defaultValue: 'Geciken operasyon' }), value: overview.data?.delayedOperationCount ?? 0, icon: AlertTriangle },
  ];
  const projectCount = overview.data?.projectCount ?? 0;
  const plannedCount = overview.data?.plannedProjectCount ?? 0;
  const activeCount = overview.data?.activeProjectCount ?? 0;
  const delayedCount = overview.data?.delayedOperationCount ?? 0;
  const waitingCount = Math.max(0, projectCount - plannedCount - activeCount);
  const nextAction = delayedCount > 0
    ? { title: `${delayedCount} geciken operasyonu kontrol edin`, text: 'Teslim riski oluşmadan önce gecikme nedenlerini ve istasyon yükünü açın.', href: '/warehouse/production/generator/reports', button: 'Riskleri göster', tone: 'danger' }
    : activeCount > 0
      ? { title: `${activeCount} proje üretimde`, text: 'İstasyonlardaki sıradaki işleri ve açık blokajları takip edin.', href: '/warehouse/production/generator/station-board', button: 'Üretimi takip et', tone: 'normal' }
      : waitingCount > 0
        ? { title: `${waitingCount} proje plan bekliyor`, text: 'Projeleri seçip güvenli plan önizlemesini oluşturun.', href: '/warehouse/production/generator/planning', button: 'Planlamaya başla', tone: 'normal' }
        : { title: 'Yeni bir jeneratör işiyle başlayın', text: 'Proje ve teslim bilgilerini girin; sistem kalan adımlarda sizi yönlendirecek.', href: '/warehouse/production/generator/projects/new', button: 'Yeni proje oluştur', tone: 'success' };
  const primaryActions = [
    { href: '/warehouse/production/generator/projects/new', icon: Plus, step: '1', title: 'Yeni iş oluştur', text: 'Proje, müşteri, teslim tarihi ve üretim kapsamını girin.', badge: `${projectCount} proje` },
    { href: '/warehouse/production/generator/planning', icon: Sparkles, step: '2', title: 'Planı hazırla', text: 'Projeleri seçin; kapasite planını kontrol edip tek adımda uygulayın.', badge: `${waitingCount} bekleyen` },
    { href: '/warehouse/production/generator/station-board', icon: Factory, step: '3', title: 'Üretimi takip et', text: 'İstasyonları, devam eden işleri ve blokajları canlı görün.', badge: `${activeCount} aktif` },
  ];
  const tools = [
    { href: '/warehouse/production/generator/projects', icon: Boxes, title: 'Tüm projeler' },
    { href: '/warehouse/production/generator/gantt', icon: CalendarRange, title: t('hub.gantt.title', { defaultValue: 'Gantt planı' }) },
    { href: '/warehouse/production/generator/scenarios', icon: GitBranch, code: 'GP.SIM', title: 'Senaryo Simülasyonu', text: 'Alternatif başlangıçları mevcut planı değiştirmeden hesaplayın ve karşılaştırın.' },
    { href: '/warehouse/production/generator/assistant', icon: Sparkles, code: 'GP.AST', title: 'Planlama Asistanı', text: 'Öncelik ve teslim tarihine göre açıklanabilir planlama önerilerini görün.' },
    { href: '/warehouse/production/generator/reports', icon: GitBranch, title: 'Raporlar ve riskler' },
    { href: '/warehouse/production/generator/definitions', icon: Settings2, title: t('hub.definitions.title', { defaultValue: 'Üretim tanımları' }) },
  ];
  return (
    <section className="space-y-6">
      <GeneratorPageHeader
        eyebrow={t('hub.eyebrow', { defaultValue: 'Üretim ve Kalite / Jeneratör Üretim' })}
        title={t('hub.title', { defaultValue: 'Jeneratör Üretim Merkezi' })}
        description={t('hub.description', { defaultValue: 'Stator, rotor ve taşıyıcı kol akışlarını final montajla tek teslim planında birleştirin.' })}
        actions={<Link className={primaryButton} to="/warehouse/production/generator/projects/new"><Plus className="size-4" /> Yeni proje</Link>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => <article key={label} className={`${panel} gp-metric p-4`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--wms-app-text-muted)]">{label}</span><span className="gp-metric__icon"><Icon className="size-5 text-[var(--wms-brand-primary)]" /></span></div><strong className="mt-3 block text-3xl font-black tracking-tight">{overview.isLoading ? '…' : value}</strong></article>)}
      </div>
      <section className={`${panel} gp-next-action ${nextAction.tone === 'danger' ? 'is-danger' : nextAction.tone === 'success' ? 'is-success' : ''}`} aria-live="polite"><div><p className="text-xs font-black uppercase tracking-widest text-[var(--wms-brand-primary)]">Şimdi ne yapmalıyım?</p><h2>{overview.isLoading ? 'Durum kontrol ediliyor…' : nextAction.title}</h2><p>{nextAction.text}</p></div><Link className={primaryButton} to={nextAction.href}>{nextAction.button}<ChevronRight className="size-4" /></Link></section>
      <GeneratorWorkflow current={projectCount === 0 ? 'project' : waitingCount > 0 ? 'planning' : activeCount > 0 ? 'production' : 'tracking'} />
      <div>
        <div className="mb-3"><h2 className="text-lg font-black">En çok kullanılan işlemler</h2><p className="text-sm text-[var(--wms-app-text-muted)]">Soldan sağa ilerleyin; sistem her adımda gerekli kontrolleri yapar.</p></div>
        <div className="grid gap-4 lg:grid-cols-3">{primaryActions.map(({ href, icon: Icon, step, title, text, badge }) => <Link key={href} to={href} className={`${panel} gp-task-card group`}><span className="gp-task-card__step">{step}</span><span className="gp-task-card__icon"><Icon className="size-7" /></span><div><h3>{title}</h3><p>{text}</p></div><span className="gp-task-card__badge">{badge}</span><ChevronRight className="gp-task-card__arrow size-5" /></Link>)}</div>
      </div>
      <details className={`${panel} gp-details`}><summary>Diğer araçlar ve yönetim ekranları</summary><div className="gp-tool-grid">{tools.map(({ href, icon: Icon, title }) => <Link key={href} to={href}><Icon className="size-5" /><span>{title}</span><ChevronRight className="ml-auto size-4" /></Link>)}</div></details>
      <details className={`${panel} gp-details`}><summary>Üretim akışı nasıl birleşiyor?</summary><div className="flex gap-3 p-4 pt-0 text-sm"><GitBranch className="mt-0.5 size-5 shrink-0 text-[var(--wms-brand-primary)]" /><p>Stator, rotor ve taşıyıcı kol kendi rotalarında paralel ilerler. Üçü hazır olduğunda final montaj otomatik olarak doğru sıraya yerleşir.</p></div></details>
    </section>
  );
}

export function GeneratorProductionProjectsPage(): ReactElement {
  const queryClient = useQueryClient();
  const definitions = useQuery({ queryKey: ['generator-production', 'definitions'], queryFn: generatorProductionApi.definitions });
  const [selected, setSelected] = useState<number[]>([]);
  const [preview, setPreview] = useState<GeneratorPlanPreview | null>(null);
  const [reason, setReason] = useState('Teslim planı ve istasyon kapasitesi doğrulandı.');
  const projects = useQuery({ queryKey: ['generator-production', 'projects'], queryFn: () => generatorProductionApi.projects({ pageNumber: 1, pageSize: 200, search: '', filterLogic: 'and', filters: [] }) });
  const remove = useMutation({ mutationFn: generatorProductionApi.deleteProject, onSuccess: () => { toast.success('Taslak proje silindi.'); void queryClient.invalidateQueries({ queryKey: ['generator-production'] }); }, onError: (error) => toast.error(errorMessage(error)) });
  const previewMutation = useMutation({ mutationFn: () => generatorProductionApi.preview(selected), onSuccess: setPreview, onError: (error) => toast.error(errorMessage(error)) });
  const applyMutation = useMutation({
    mutationFn: () => generatorProductionApi.apply(selected, reason),
    onSuccess: (result) => { toast.success(`${result.operationCount} operasyon planlandı.`); setPreview(null); setSelected([]); void queryClient.invalidateQueries({ queryKey: ['generator-production'] }); },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const planableRows = (projects.data?.items ?? []).filter((row) => ['Draft', 'ReadyToPlan', 'Planned'].includes(row.status));
  const selectedRows = planableRows.filter((row) => selected.includes(row.id));
  const toggle = (id: number) => { setPreview(null); setSelected((value) => value.includes(id) ? value.filter((x) => x !== id) : [...value, id]); };
  const toggleAll = () => { setPreview(null); setSelected(selected.length === planableRows.length ? [] : planableRows.map((row) => row.id)); };
  return (
    <section className="space-y-5">
      <GeneratorPageHeader eyebrow="Jeneratör Üretim / Planlama" title="Planı Hazırla" description="Üç basit adım: projeleri seçin, güvenli önizlemeyi kontrol edin, planı uygulayın." actions={<><Link className={secondaryButton} to="/warehouse/production/generator/gantt"><CalendarRange className="size-4" /> Gantt'ı aç</Link><Link className={primaryButton} to="/warehouse/production/generator/projects/new"><Plus className="size-4" /> Yeni proje</Link></>} />
      <GeneratorWorkflow current="planning" />
      <GeneratorTaskSteps items={[
        { title: 'Projeleri seç', text: selected.length ? `${selected.length} proje seçildi` : 'Planlanacak işleri işaretleyin', state: selected.length ? 'done' : 'current' },
        { title: 'Planı kontrol et', text: preview ? `${preview.items.length} operasyon hazırlandı` : 'Önizleme gerçek planı değiştirmez', state: preview ? 'done' : selected.length ? 'current' : 'waiting' },
        { title: 'Onayla ve uygula', text: 'Kontroller geçerse planı kaydedin', state: preview ? 'current' : 'waiting' },
      ]} />
      {definitions.isError && <div className={`${panel} flex flex-wrap items-center justify-between gap-3 border-red-500/50 p-4`}><div><strong>Planlama ayarları alınamadı.</strong><p className="text-sm text-[var(--wms-app-text-muted)]">Bağlantıyı veya bekleyen veritabanı güncellemesini kontrol edin.</p></div><button className={secondaryButton} onClick={() => definitions.refetch()}>Tekrar dene</button></div>}
      {!definitions.isLoading && !definitions.isError && !definitions.data?.isBootstrapped && <div className={`${panel} flex flex-wrap items-center justify-between gap-3 border-amber-500/50 p-4`}><div><strong>SA/RA/FA tanımları henüz kurulmamış.</strong><p className="text-sm text-[var(--wms-app-text-muted)]">İlk planı oluşturmadan önce başlangıç istasyon ve rotalarını kurun.</p></div><Link className={primaryButton} to="/warehouse/production/generator/definitions">Tanımlara git</Link></div>}
      <section className={`${panel} overflow-hidden`}><header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--wms-app-border)] p-4"><div><h2 className="font-black">Planlanabilir projeler</h2><p className="text-xs text-[var(--wms-app-text-muted)]">Taslak, planlamaya hazır veya yeniden planlanacak projeler seçilebilir.</p></div>{planableRows.length > 0 && <button type="button" className={secondaryButton} onClick={toggleAll}>{selected.length === planableRows.length ? 'Seçimi temizle' : `Uygun olanların tümünü seç (${planableRows.length})`}</button>}</header><div className="overflow-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead><tr className="border-b border-[var(--wms-app-border)] text-xs uppercase tracking-wide text-[var(--wms-app-text-muted)]"><th className="p-3">Seç</th><th className="p-3">Proje</th><th className="p-3">Tip / seri</th><th className="p-3">Durum</th><th className="p-3">Öncelik</th><th className="p-3">Adet</th><th className="p-3">Başlangıç</th><th className="p-3">Teslim</th><th className="p-3">İlerleme</th><th className="p-3">İşlem</th></tr></thead><tbody>{projects.data?.items.map((row) => <ProjectRow key={row.id} row={row} selected={selected.includes(row.id)} onToggle={() => toggle(row.id)} onDelete={() => remove.mutate(row.id)} />)}</tbody></table>{projects.isLoading && <p className="p-5 text-sm text-[var(--wms-app-text-muted)]">Projeler yükleniyor…</p>}{projects.data?.items.length === 0 && <div className="p-5"><p className="text-sm text-[var(--wms-app-text-muted)]">Planlanacak proje yok.</p><Link className={`${primaryButton} mt-3`} to="/warehouse/production/generator/projects/new"><Plus className="size-4" /> İlk projeyi oluştur</Link></div>}</div></section>

      <div className={`${panel} gp-sticky-actions`}><div><strong>{selected.length ? `${selected.length} proje seçildi` : 'Önce proje seçin'}</strong><p className="text-sm text-[var(--wms-app-text-muted)]">{selectedRows.length ? selectedRows.map((row) => row.projectCode).join(', ') : 'Önizleme, kaydetmeden önce tarih ve kapasite sorunlarını gösterir.'}</p></div><button disabled={!selected.length || !definitions.data?.isBootstrapped || previewMutation.isPending} className={primaryButton} onClick={() => previewMutation.mutate()}>{previewMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Seçilenlerin planını kontrol et</button></div>
      {preview && <PlanPreviewPanel preview={preview} reason={reason} minimumReasonLength={definitions.data?.policy.minimumPlanReasonLength ?? 1} setReason={setReason} applying={applyMutation.isPending} onApply={() => applyMutation.mutate()} onClose={() => setPreview(null)} />}
    </section>
  );
}

function ProjectRow({ row, selected, onToggle, onDelete }: { row: GeneratorProjectRow; selected: boolean; onToggle: () => void; onDelete: () => void }): ReactElement {
  const canPlan = ['Draft', 'ReadyToPlan', 'Planned'].includes(row.status);
  return <tr className="border-b border-[var(--wms-app-border)] hover:bg-[color-mix(in_oklab,var(--wms-brand-primary)_5%,transparent)]"><td className="p-3"><input type="checkbox" aria-label={`${row.projectCode} seç`} disabled={!canPlan} checked={selected} onChange={onToggle} /></td><td className="p-3"><strong>{row.projectCode}</strong><div className="text-xs text-[var(--wms-app-text-muted)]">{row.projectName}</div></td><td className="p-3">{row.generatorType || '—'}<div className="text-xs text-[var(--wms-app-text-muted)]">{row.serialNumber || 'Seri yok'}</div></td><td className="p-3"><StatusBadge status={row.status} /></td><td className="p-3 font-black">{row.priority}</td><td className="p-3">{row.quantity}</td><td className="p-3">{formatProjectDate(row.plannedStartAtUtc)}</td><td className="p-3">{formatProjectDate(row.plannedDeliveryAtUtc)}</td><td className="p-3"><strong>{row.completedOperationCount}/{row.operationCount}</strong></td><td className="p-3">{['Draft', 'ReadyToPlan'].includes(row.status) && <button className="rounded-lg p-2 text-red-500 hover:bg-red-500/10" aria-label="Sil" onClick={onDelete}><Trash2 className="size-4" /></button>}</td></tr>;
}

function StatusBadge({ status }: { status: string }): ReactElement {
  const labels: Record<string, string> = { Draft: 'Taslak', ReadyToPlan: 'Planlamaya hazır', Planned: 'Planlandı', Released: 'Serbest', InProgress: 'Üretimde', OnHold: 'Beklemede', Completed: 'Tamamlandı', Cancelled: 'İptal' };
  return <span className="inline-flex rounded-full bg-[color-mix(in_oklab,var(--wms-brand-primary)_12%,transparent)] px-2.5 py-1 text-xs font-bold text-[var(--wms-brand-primary)]">{labels[status] ?? status}</span>;
}

function PlanPreviewPanel({ preview, reason, minimumReasonLength, setReason, applying, onApply, onClose }: { preview: GeneratorPlanPreview; reason: string; minimumReasonLength: number; setReason: (value: string) => void; applying: boolean; onApply: () => void; onClose: () => void }): ReactElement {
  const projectCount = new Set(preview.items.map((x) => x.projectId)).size;
  const end = preview.items.length ? new Date(Math.max(...preview.items.map((x) => new Date(x.plannedEndAtUtc).getTime()))) : null;
  const blockingIssues = preview.issues.filter((issue) => issue.severity === 'Error').length;
  return <section className={`${panel} space-y-4 p-5`} aria-live="polite"><header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-[var(--wms-brand-primary)]">Kontrol sonucu</p><h2 className="mt-1 text-xl font-black">{blockingIssues ? `${blockingIssues} engel çözülmeli` : 'Plan uygulanmaya hazır'}</h2><p className="text-sm text-[var(--wms-app-text-muted)]">{projectCount} proje · {preview.items.length} operasyon · Tahmini bitiş {end ? formatProjectDateTime(end) : '—'}</p></div><button type="button" className={secondaryButton} onClick={onClose}>Önizlemeyi kapat</button></header>{preview.issues.length > 0 ? <div className="space-y-2">{preview.issues.map((issue, index) => <div role={issue.severity === 'Error' ? 'alert' : undefined} key={`${issue.ruleCode}-${index}`} className={`flex gap-2 rounded-xl border p-3 text-sm ${issue.severity === 'Error' ? 'border-red-500/50 bg-red-500/5' : 'border-amber-500/50 bg-amber-500/5'}`}><AlertTriangle className="size-5 shrink-0" /><div><strong>{issue.severity === 'Error' ? 'Düzeltilmesi gerekiyor' : 'Dikkat'} · {issue.ruleCode}</strong><p>{issue.message}</p></div></div>)}</div> : <div className="flex gap-3 rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-600"><CheckCircle2 className="size-5 shrink-0" /><div><strong>Tüm kontroller geçti.</strong><p>Plan henüz kaydedilmedi. Aşağıdaki onay düğmesiyle uygulayabilirsiniz.</p></div></div>}<details className="gp-details rounded-xl border border-[var(--wms-app-border)]"><summary>{preview.items.length} operasyonun tarih ve istasyon ayrıntılarını göster</summary><div className="max-h-72 overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-[var(--wms-app-border)]"><th className="p-3">Proje</th><th className="p-3">Bileşen</th><th className="p-3">İstasyon</th><th className="p-3">Operasyon</th><th className="p-3">Başlangıç</th><th className="p-3">Bitiş</th></tr></thead><tbody>{preview.items.map((item) => <tr key={item.key} className="border-b border-[var(--wms-app-border)]"><td className="p-3 font-bold">{item.projectCode} / {item.unitIndex}</td><td className="p-3">{partLabel(item.partType)}</td><td className="p-3 font-mono">{item.stationCode}</td><td className="p-3">{item.operationName}</td><td className="p-3">{formatProjectDateTime(item.plannedStartAtUtc)}</td><td className="p-3">{formatProjectDateTime(item.plannedEndAtUtc)}</td></tr>)}</tbody></table></div></details><div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><label className="block text-sm font-bold">Neden bu planı uyguluyorsunuz?<textarea className={`${field} mt-1 min-h-20 py-3`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örnek: Teslim tarihi ve istasyon kapasitesi kontrol edildi." /><small className="mt-1 block font-normal text-[var(--wms-app-text-muted)]">En az {minimumReasonLength} karakter · Bu açıklama plan geçmişinde saklanır.</small></label><button className={`${primaryButton} min-w-48`} disabled={!preview.canApply || reason.trim().length < minimumReasonLength || applying} onClick={onApply}>{applying ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Planı onayla ve kaydet</button></div></section>;
}

export function GeneratorProductionGanttPage(): ReactElement {
  const definitions = useQuery({ queryKey: ['generator-production', 'definitions'], queryFn: generatorProductionApi.definitions });
  const policy = definitions.data?.policy;
  const [windowDays, setWindowDays] = useState<number>();
  useEffect(() => { if (windowDays === undefined && policy) setWindowDays(policy.ganttDefaultWindowDays); }, [policy, windowDays]);
  const range = useMemo(() => {
    if (!policy || windowDays === undefined) return undefined;
    const from = new Date(); from.setDate(from.getDate() - policy.schedulePastDays); from.setHours(0, 0, 0, 0);
    const to = new Date(); to.setDate(to.getDate() + windowDays); to.setHours(0, 0, 0, 0);
    return { from, to };
  }, [policy, windowDays]);
  const schedule = useQuery({ queryKey: ['generator-production', 'schedule', range?.from.toISOString(), range?.to.toISOString()], queryFn: () => generatorProductionApi.schedule(range!.from.toISOString(), range!.to.toISOString()), enabled: Boolean(range) });
  const grouped = useMemo(() => Object.entries((schedule.data ?? []).reduce<Record<string, GeneratorScheduleRow[]>>((groups, row) => {
    const key = `${row.stationCode} · ${row.stationName}`;
    (groups[key] ??= []).push(row);
    return groups;
  }, {})), [schedule.data]);
  if (!policy || !range || windowDays === undefined) return <div className={`${panel} p-6 text-sm text-[var(--wms-app-text-muted)]`}>Üretim parametreleri yükleniyor…</div>;
  const total = range.to.getTime() - range.from.getTime();
  return <section className="space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--wms-brand-primary)]">Jeneratör Üretim / Plan</p><h1 className="mt-2 text-2xl font-black">İstasyon Gantt Planı</h1><p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">SA, RA ve FA istasyonlarında uygulanmış planı görüntüleyin.</p></div><div className="flex gap-2"><label className="text-xs font-bold text-[var(--wms-app-text-muted)]">Gelecek pencere (gün)<input type="number" min={1} max={policy.maximumScheduleRangeDays - policy.schedulePastDays} className={`${field} mt-1 w-40`} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} /></label><button className={secondaryButton} onClick={() => schedule.refetch()}><RefreshCw className="size-4" /> Yenile</button></div></header><div className={`${panel} overflow-auto`}><div className="min-w-[1400px]"><div className="sticky top-0 z-10 grid grid-cols-[260px_1fr] border-b border-[var(--wms-app-border)] bg-[var(--wms-app-panel)]"><div className="p-3 text-sm font-black">İstasyon</div><div className="relative h-12">{Array.from({ length: Math.ceil((policy.schedulePastDays + windowDays) / 7) + 1 }, (_, index) => { const date = new Date(range.from); date.setDate(date.getDate() + index * 7); const left = ((date.getTime() - range.from.getTime()) / total) * 100; return <span key={index} className="absolute top-3 text-xs text-[var(--wms-app-text-muted)]" style={{ left: `${left}%` }}>{formatProjectDate(date)}</span>; })}</div></div>{grouped.map(([station, rows]) => <div key={station} className="grid min-h-20 grid-cols-[260px_1fr] border-b border-[var(--wms-app-border)]"><div className="p-3"><strong className="font-mono text-sm">{station.split(' · ')[0]}</strong><p className="text-xs text-[var(--wms-app-text-muted)]">{station.split(' · ')[1]}</p></div><div className="relative bg-[linear-gradient(to_right,color-mix(in_oklab,var(--wms-app-border)_60%,transparent)_1px,transparent_1px)] bg-[length:calc(100%/6.43)_100%]">{(rows ?? []).map((row, index) => <GanttBar key={row.id} row={row} index={index} from={range.from.getTime()} total={total} />)}</div></div>)}{schedule.isLoading && <p className="p-6 text-sm text-[var(--wms-app-text-muted)]">Plan yükleniyor…</p>}{!schedule.isLoading && grouped.length === 0 && <p className="p-6 text-sm text-[var(--wms-app-text-muted)]">Bu tarih aralığında uygulanmış operasyon planı yok.</p>}</div></div><div className="flex flex-wrap gap-4 text-xs text-[var(--wms-app-text-muted)]"><span className="flex items-center gap-2"><i className="size-3 rounded bg-[var(--wms-brand-primary)]" /> Normal operasyon</span><span className="flex items-center gap-2"><i className="size-3 rounded bg-amber-500" /> Kritik operasyon</span><span className="flex items-center gap-2"><i className="size-3 rounded bg-red-500" /> Problem / malzeme eksikliği</span></div></section>;
}

function GanttBar({ row, index, from, total }: { row: GeneratorScheduleRow; index: number; from: number; total: number }): ReactElement {
  const start = new Date(row.plannedStartAtUtc).getTime(); const end = new Date(row.plannedEndAtUtc).getTime();
  const left = Math.max(0, ((start - from) / total) * 100); const width = Math.max(0.4, ((end - start) / total) * 100);
  const color = row.hasProblem || row.hasMaterialShortage ? 'bg-red-500' : row.isCritical ? 'bg-amber-500' : 'bg-[var(--wms-brand-primary)]';
  return <div title={`${row.projectCode} · ${row.operationName}\n${formatProjectDateTime(row.plannedStartAtUtc)} – ${formatProjectDateTime(row.plannedEndAtUtc)}`} className={`absolute h-7 overflow-hidden rounded-md px-2 py-1 text-[10px] font-black text-white shadow-sm ${color}`} style={{ left: `${left}%`, width: `${width}%`, top: `${8 + (index % 2) * 32}px` }}><span className="whitespace-nowrap">{row.projectCode} · {row.operationCode}</span></div>;
}

export function GeneratorProductionAndonPage(): ReactElement {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{ row: GeneratorScheduleRow; action: GeneratorOperationAction } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const definitions = useQuery({ queryKey: ['generator-production', 'definitions'], queryFn: generatorProductionApi.definitions });
  const policy = definitions.data?.policy;
  const range = useMemo(() => { if (!policy) return undefined; const from = new Date(); from.setDate(from.getDate() - policy.schedulePastDays); const to = new Date(); to.setDate(to.getDate() + policy.scheduleFutureDays); return { from: from.toISOString(), to: to.toISOString() }; }, [policy]);
  const schedule = useQuery({ queryKey: ['generator-production', 'schedule', range?.from, range?.to], queryFn: () => generatorProductionApi.schedule(range!.from, range!.to), enabled: Boolean(range), refetchInterval: policy ? policy.andonRefreshSeconds * 1_000 : undefined });
  const transition = useMutation({
    mutationFn: (input: { row: GeneratorScheduleRow; action: GeneratorOperationAction; reason?: string }) => generatorProductionApi.transitionOperation(
      input.row.id, input.action, input.row.rowVersion, input.reason, input.action === 'Complete' ? { goodQuantity: 1, defectQuantity: 0, scrapQuantity: 0 } : undefined,
    ),
    onSuccess: () => { toast.success('Operasyon güncellendi.'); setPendingAction(null); setActionReason(''); void queryClient.invalidateQueries({ queryKey: ['generator-production'] }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const activeRows = (schedule.data ?? []).filter((x) => !['Completed', 'Cancelled'].includes(x.status));
  const grouped = Object.entries(activeRows.reduce<Record<string, GeneratorScheduleRow[]>>((result, row) => { (result[`${row.stationCode} · ${row.stationName}`] ??= []).push(row); return result; }, {}));
  const execute = (row: GeneratorScheduleRow, action: GeneratorOperationAction) => {
    if (['Pause', 'ReportProblem', 'ResolveProblem'].includes(action)) { setPendingAction({ row, action }); setActionReason(''); return; }
    if (action === 'Complete' && !window.confirm(`${row.projectCode} / ${row.operationName} operasyonu tamamlandı olarak işaretlensin mi?`)) return;
    transition.mutate({ row, action });
  };
  const reasonMinimum = policy?.minimumOperationReasonLength ?? 1;
  const actionLabels: Partial<Record<GeneratorOperationAction, string>> = { Pause: 'Operasyonu duraklat', ReportProblem: 'Problemi bildir', ResolveProblem: 'Problemi çözüldü olarak işaretle' };
  return <section className="gp-page gp-page--live space-y-5"><GeneratorPageHeader eyebrow="Jeneratör Üretim / Üretimi Yürüt" title="İstasyon Operasyonları" description={policy ? `Ekran ${policy.andonRefreshSeconds} saniyede bir yenilenir. Her iş kartında yalnızca o anda yapılabilecek işlemler gösterilir.` : 'Aktif istasyon işleri ve yapılabilecek işlemler burada gösterilir.'} actions={<button className={secondaryButton} onClick={() => schedule.refetch()}><RefreshCw className="size-4" /> Şimdi yenile</button>} /><GeneratorWorkflow current="production" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Factory} label="Aktif operasyon" value={activeRows.length} /><Metric icon={PlayCircle} label="Devam eden" value={activeRows.filter((x) => x.status === 'InProgress').length} /><Metric icon={CircleStop} label="Duraklatılan" value={activeRows.filter((x) => x.status === 'Paused').length} /><Metric icon={AlertTriangle} label="Açık problem" value={activeRows.filter((x) => x.hasProblem || x.hasMaterialShortage).length} /></div>{schedule.isLoading && <div className={`${panel} p-6`}>Operasyonlar yükleniyor…</div>}<div className="grid gap-4 xl:grid-cols-2">{grouped.map(([station, rows]) => <article key={station} className={`${panel} overflow-hidden`}><header className="flex items-center justify-between border-b border-[var(--wms-app-border)] p-4"><div><strong className="font-mono text-sm text-[var(--wms-brand-primary)]">{station.split(' · ')[0]}</strong><h2 className="font-black">{station.split(' · ')[1]}</h2></div><span className="rounded-full border border-[var(--wms-app-border)] px-2 py-1 text-xs font-bold">{rows.length} iş</span></header><div className="space-y-3 p-4">{rows.sort((a, b) => new Date(a.plannedStartAtUtc).getTime() - new Date(b.plannedStartAtUtc).getTime()).map((row) => <div key={row.id} className={`rounded-xl border p-3 ${row.hasProblem || row.hasMaterialShortage ? 'border-red-500/60' : 'border-[var(--wms-app-border)]'}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{row.projectCode} / Ünite {row.unitIndex}</strong><p className="text-sm">{row.operationName}</p><p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">{formatProjectDateTime(row.plannedStartAtUtc)} – {formatProjectDateTime(row.plannedEndAtUtc)}</p></div><StatusBadge status={row.status} /></div>{row.hasProblem && <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs font-bold text-red-500">Operasyonda açık problem var. Tamamlamadan önce problemi çözün.</p>}{row.hasMaterialShortage && <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs font-bold text-amber-500">Malzeme eksiği var. İş başlatılamaz veya tamamlanamaz.</p>}<p className="mt-3 text-xs font-black uppercase tracking-wide text-[var(--wms-app-text-muted)]">Yapabileceğiniz işlemler</p><div className="mt-2 flex flex-wrap gap-2">{['Planned', 'Ready'].includes(row.status) && <button className={primaryButton} disabled={transition.isPending || row.hasMaterialShortage} onClick={() => execute(row, 'Start')}><PlayCircle className="size-4" /> İşi başlat</button>}{row.status === 'InProgress' && <><button className={secondaryButton} disabled={transition.isPending} onClick={() => execute(row, 'Pause')}><CircleStop className="size-4" /> Duraklat</button><button className={primaryButton} disabled={transition.isPending || row.hasProblem || row.hasMaterialShortage} onClick={() => execute(row, 'Complete')}><CheckCircle2 className="size-4" /> İşi tamamla</button></>}{row.status === 'Paused' && <button className={primaryButton} disabled={transition.isPending} onClick={() => execute(row, 'Resume')}><PlayCircle className="size-4" /> Devam et</button>}{row.hasProblem ? <button className={secondaryButton} disabled={transition.isPending} onClick={() => execute(row, 'ResolveProblem')}>Problemi çözdüm</button> : <button className={`${secondaryButton} text-red-500`} disabled={transition.isPending} onClick={() => execute(row, 'ReportProblem')}><AlertTriangle className="size-4" /> Problem bildir</button>}</div></div>)}</div></article>)}</div>{!schedule.isLoading && grouped.length === 0 && <div className={`${panel} p-6 text-sm text-[var(--wms-app-text-muted)]`}>Aktif operasyon bulunmuyor. Önce planlama ekranından bir planı onaylayın.</div>}{pendingAction && <div className="gp-dialog-backdrop"><section className={`${panel} gp-dialog`} role="dialog" aria-modal="true" aria-labelledby="gp-operation-dialog-title"><div><p className="text-xs font-black uppercase tracking-widest text-[var(--wms-brand-primary)]">{pendingAction.row.projectCode} · {pendingAction.row.operationName}</p><h2 id="gp-operation-dialog-title" className="mt-1 text-xl font-black">{actionLabels[pendingAction.action]}</h2><p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">Nedeni yazın. Bu açıklama operasyon geçmişinde saklanır.</p></div><label className="mt-4 block text-sm font-bold">Açıklama<textarea autoFocus className={`${field} mt-1 min-h-28 py-3`} value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="Ne oldu veya nasıl çözüldü?" /><small className="mt-1 block font-normal text-[var(--wms-app-text-muted)]">En az {reasonMinimum} karakter</small></label><div className="mt-5 flex justify-end gap-2"><button className={secondaryButton} disabled={transition.isPending} onClick={() => setPendingAction(null)}>Vazgeç</button><button className={primaryButton} disabled={transition.isPending || actionReason.trim().length < reasonMinimum} onClick={() => transition.mutate({ ...pendingAction, reason: actionReason.trim() })}>{transition.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Kaydet</button></div></section></div>}</section>;
}

export function GeneratorProductionDefinitionsPage(): ReactElement {
  const queryClient = useQueryClient(); const definitions = useQuery({ queryKey: ['generator-production', 'definitions'], queryFn: generatorProductionApi.definitions });
  const bootstrap = useMutation({ mutationFn: generatorProductionApi.bootstrap, onSuccess: (result) => { toast.success(`${result.stationCount} istasyon ve ${result.routeCount} rota oluşturuldu.`); void queryClient.invalidateQueries({ queryKey: ['generator-production'] }); }, onError: (error) => toast.error(errorMessage(error)) });
  return <section className="space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--wms-brand-primary)]">Jeneratör Üretim / Tanımlar</p><h1 className="mt-2 text-2xl font-black">SA / RA / FA Üretim Modeli</h1><p className="mt-1 text-sm text-[var(--wms-app-text-muted)]">Prototipteki değerli fabrika tanımları WMS veri yapısıyla yönetilir.</p></div>{!definitions.data?.isBootstrapped && <button disabled={definitions.isLoading || bootstrap.isPending} className={primaryButton} onClick={() => bootstrap.mutate()}>{bootstrap.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Başlangıç tanımlarını kur</button>}</header>{definitions.isLoading ? <div className={`${panel} p-6`}>Tanımlar yükleniyor…</div> : <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Factory} label="İstasyon" value={definitions.data?.stations.length ?? 0} /><Metric icon={Route} label="Rota" value={definitions.data?.routes.length ?? 0} /><Metric icon={UsersRound} label="Vardiya" value={definitions.data?.shifts.length ?? 0} /><Metric icon={GitBranch} label="Kural" value={definitions.data?.rules.length ?? 0} /></div><section className={`${panel} overflow-hidden`}><header className="border-b border-[var(--wms-app-border)] p-4"><h2 className="text-lg font-black">İstasyonlar</h2></header><div className="overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-[var(--wms-app-border)]"><th className="p-3">Sıra</th><th className="p-3">Kod</th><th className="p-3">İstasyon</th><th className="p-3">Alan</th><th className="p-3">Paralel iş</th><th className="p-3">Özellik</th></tr></thead><tbody>{definitions.data?.stations.map((station) => <tr key={station.id} className="border-b border-[var(--wms-app-border)]"><td className="p-3">{station.planningOrder}</td><td className="p-3 font-mono font-bold">{station.code}</td><td className="p-3">{station.name}</td><td className="p-3">{station.area}</td><td className="p-3">{station.maxParallelJobs}</td><td className="p-3"><div className="flex flex-wrap gap-1">{station.isBottleneck && <Tag text="Darboğaz" tone="warning" />}{station.isCritical && <Tag text="Kritik" tone="danger" />}{station.requiresCrane && <Tag text="Vinç" />}{station.requiresTransport && <Tag text="Taşıma" />}</div></td></tr>)}</tbody></table></div></section><section className="grid gap-4 xl:grid-cols-2">{definitions.data?.routes.map((route) => <article key={route.id} className={`${panel} p-4`}><div className="flex items-start justify-between"><div><span className="font-mono text-xs font-bold text-[var(--wms-brand-primary)]">{route.code} · v{route.versionNumber}</span><h2 className="mt-1 text-lg font-black">{route.name}</h2></div><Tag text={partLabel(route.partType)} /></div><ol className="mt-4 space-y-2">{route.operations.map((operation, index) => <li key={operation.id} className="flex items-center gap-3 rounded-xl border border-[var(--wms-app-border)] p-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--wms-brand-primary)] text-xs font-black text-[var(--wms-brand-on-primary)]">{index + 1}</span><div className="min-w-0 flex-1"><strong className="font-mono text-xs">{operation.stationCode}</strong><p className="truncate text-sm">{operation.operationName}</p></div><span className="text-xs text-[var(--wms-app-text-muted)]">{operation.durationMinutes} dk</span>{operation.isCritical && <AlertTriangle className="size-4 text-amber-500" />}</li>)}</ol></article>)}</section><section className={`${panel} p-4`}><h2 className="text-lg font-black">Planlama kuralları</h2><div className="mt-3 grid gap-2 lg:grid-cols-2">{definitions.data?.rules.map((rule) => <div key={rule.id} className="flex gap-3 rounded-xl border border-[var(--wms-app-border)] p-3"><RuleIcon severity={rule.severity} /><div><strong className="text-sm">{rule.name}</strong><p className="font-mono text-[10px] text-[var(--wms-brand-primary)]">{rule.code}</p><p className="mt-1 text-xs text-[var(--wms-app-text-muted)]">{rule.description}</p></div></div>)}</div></section></>}</section>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Factory; label: string; value: number }): ReactElement { return <div className={`${panel} gp-metric flex items-center gap-3 p-4`}><span className="gp-metric__icon text-[var(--wms-brand-primary)]"><Icon className="size-5" /></span><div><strong className="block text-2xl font-black">{value}</strong><span className="text-xs font-black uppercase tracking-[0.1em] text-[var(--wms-app-text-muted)]">{label}</span></div></div>; }
function Tag({ text, tone = 'normal' }: { text: string; tone?: 'normal' | 'warning' | 'danger' }): ReactElement { const colors = tone === 'danger' ? 'bg-red-500/15 text-red-500' : tone === 'warning' ? 'bg-amber-500/15 text-amber-500' : 'bg-[color-mix(in_oklab,var(--wms-brand-primary)_12%,transparent)] text-[var(--wms-brand-primary)]'; return <span className={`rounded-full px-2 py-1 text-[10px] font-black ${colors}`}>{text}</span>; }
function RuleIcon({ severity }: { severity: GeneratorRuleSeverity }): ReactElement { return severity === 'Error' ? <AlertTriangle className="size-5 shrink-0 text-red-500" /> : severity === 'Warning' ? <AlertTriangle className="size-5 shrink-0 text-amber-500" /> : <CheckCircle2 className="size-5 shrink-0 text-sky-500" />; }
function partLabel(part: string): string { return ({ Stator: 'Stator', Rotor: 'Rotor', Stiffener: 'Taşıyıcı kol', FinalAssembly: 'Final montaj', Common: 'Ortak', Outbound: 'Sevkiyat' } as Record<string, string>)[part] ?? part; }

export {
  GeneratorProductionAssistantPage,
  GeneratorProductionProjectCreatePage,
  GeneratorProductionProjectDetailPage,
  GeneratorProductionProjectListPage,
  GeneratorProductionScenarioPage,
} from './GeneratorProductionProjectScreens';
export {
  GeneratorProductionCalendarPage,
  GeneratorProductionDefinitionsHubPage,
  GeneratorProductionParametersPage,
  GeneratorProductionResourcesPage,
  GeneratorProductionRoutesPage,
  GeneratorProductionRulesPage,
  GeneratorProductionStationsPage,
} from './GeneratorProductionDefinitionScreens';
export {
  GeneratorProductionFactoryMapPage,
  GeneratorProductionMaterialControlPage,
  GeneratorProductionOutboundPage,
  GeneratorProductionReportsPage,
  GeneratorProductionRevisionsPage,
  GeneratorProductionStationBoardPage,
} from './GeneratorProductionMonitoringScreens';
