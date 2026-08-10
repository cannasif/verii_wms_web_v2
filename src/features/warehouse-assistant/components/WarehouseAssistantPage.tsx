import { type FormEvent, type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Archive, ArrowLeftRight, Bot, Boxes, CircleAlert, Clock3, Database, ExternalLink, History, Layers3, ListChecks, Loader2, MapPin, MessageSquarePlus, ReceiptText, ScanBarcode, Send, Settings2, ShieldCheck, Sparkles, TriangleAlert, Truck, UserRoundSearch, Waypoints } from 'lucide-react';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';
import { warehouseAssistantApi } from '../api/warehouse-assistant.api';
import type {
  WarehouseAssistantCapabilities,
  WarehouseAssistantChatResponse,
  WarehouseAssistantConversationRow,
  WarehouseAssistantMessageRow,
} from '../types/warehouse-assistant.types';
import { WarehouseAssistantExportMenu } from './WarehouseAssistantExportMenu';
import { parameterGuidanceOptions, resolveParameterGuidanceHint } from '@/features/settings-guidance/parameter-guidance.catalog';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: WarehouseAssistantChatResponse;
}

const emptyCapabilities: WarehouseAssistantCapabilities = {
  canQueryAllUsers: false,
  canQuerySerialBalances: false,
  canQuerySerialReceiptHistory: false,
  canQueryBarcode: false,
  canQueryStockMovements: false,
  canQueryAssignedTasks: false,
  canQueryGoodsReceiptAnalysis: false,
  canExplainParameters: true,
  canQuerySteelVehicleAnalysis: false,
  canQueryTransferAnalysis: false,
  canQueryShiftBrief: false,
  canQueryOperationalExceptions: false,
  canQueryTraceability: false,
  canQueryProcessBlockers: false,
  assistantVersion: '2.2.0',
  routingMode: 'DeterministicOnly',
  semanticRoutingAvailable: false,
  semanticModel: null,
  canRunCompoundQueries: true,
  scopeLabel: '',
  exampleQuestions: [],
};

export function WarehouseAssistantPage(): ReactElement {
  const { t, i18n, moduleReady } = useModuleTranslation('warehouse-assistant');
  const { t: settingsT, moduleReady: settingsGuidanceReady } = useModuleTranslation('settings-guidance');
  const setPageTitle = useUIStore((state) => state.setPageTitle);
  const [capabilities, setCapabilities] = useState(emptyCapabilities);
  const [conversations, setConversations] = useState<WarehouseAssistantConversationRow[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<WarehouseAssistantConversationRow | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageTitle(t('title'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  useEffect(() => {
    let active = true;
    Promise.all([warehouseAssistantApi.getCapabilities(), warehouseAssistantApi.getConversations()])
      .then(([capabilityData, conversationData]) => {
        if (!active) return;
        setCapabilities(capabilityData);
        setConversations(conversationData);
      })
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : t('errors.load'));
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [t]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isSending]);

  const examples = useMemo(
    () => capabilities.exampleQuestions.length > 0 ? capabilities.exampleQuestions : [t('examples.myActivities')],
    [capabilities.exampleQuestions, t],
  );

  async function submitQuestion(question: string): Promise<void> {
    const trimmed = question.trim();
    if (!trimmed || isSending) return;
    const temporaryId = `user-${Date.now()}`;
    setMessages((current) => [...current, { id: temporaryId, role: 'user', content: trimmed }]);
    setMessage('');
    setIsSending(true);
    try {
      const parameterHint = capabilities.canExplainParameters
        ? resolveParameterGuidanceHint(trimmed, settingsT)
        : null;
      const result = await warehouseAssistantApi.ask(trimmed, conversationId, parameterHint);
      setConversationId(result.conversationId);
      setMessages((current) => [...current, {
        id: `assistant-${result.messageId}`,
        role: 'assistant',
        content: result.answer,
        result,
      }]);
      const latestConversations = await warehouseAssistantApi.getConversations();
      setConversations(latestConversations);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.ask'));
      setMessages((current) => current.filter((item) => item.id !== temporaryId));
    } finally {
      setIsSending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitQuestion(message);
  }

  async function openConversation(row: WarehouseAssistantConversationRow): Promise<void> {
    if (isSending) return;
    try {
      const history = await warehouseAssistantApi.getMessages(row.id);
      setConversationId(row.id);
      setMessages(history.map(mapHistoryMessage));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.loadConversation'));
    }
  }

  function startNewConversation(): void {
    if (isSending) return;
    setConversationId(null);
    setMessages([]);
    setMessage('');
  }

  async function archiveConversation(): Promise<void> {
    if (!archiveTarget || isArchiving) return;
    setIsArchiving(true);
    try {
      await warehouseAssistantApi.archiveConversation(archiveTarget.id);
      setConversations((current) => current.filter((item) => item.id !== archiveTarget.id));
      if (conversationId === archiveTarget.id) startNewConversation();
      toast.success(t('archive.success'));
      setArchiveTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('archive.error'));
    } finally {
      setIsArchiving(false);
    }
  }

  if (!moduleReady || !settingsGuidanceReady) {
    return <section className="grid min-h-[calc(100dvh-8rem)] place-items-center"><Loader2 className="size-7 animate-spin text-cyan-500" aria-label="Loading" /></section>;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-[1540px] flex-col gap-4 px-3 pb-5 sm:px-5 xl:px-7">
      <header className="overflow-hidden rounded-3xl border border-cyan-500/20 bg-[linear-gradient(125deg,rgba(6,182,212,.14),rgba(99,102,241,.08)_52%,rgba(249,115,22,.10))] p-4 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-600 ring-1 ring-cyan-500/25 dark:text-cyan-300">
              <Bot className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">{t('eyebrow')}</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">{t('title')}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{t('description')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:max-w-md lg:justify-end">
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              <ShieldCheck className="size-4 shrink-0" />
              <span>{capabilities.scopeLabel || t('scope.self')}</span>
            </div>
            <div
              className={cn(
                'flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold',
                capabilities.semanticRoutingAvailable
                  ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200',
              )}
              title={t(capabilities.semanticRoutingAvailable ? 'routing.semanticHint' : 'routing.fallbackHint')}
            >
              <Sparkles className="size-4 shrink-0" aria-hidden />
              <span>{t(capabilities.semanticRoutingAvailable ? 'routing.semantic' : 'routing.fallback')}</span>
              <span className="rounded-full bg-white/60 px-1.5 py-0.5 font-mono text-[10px] dark:bg-black/20">
                {t('routing.version', { version: capabilities.assistantVersion || '2.2.0' })}
              </span>
            </div>
            {capabilities.canRunCompoundQueries ? (
              <div
                className="flex items-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-800 dark:text-indigo-200"
                title={t('routing.compoundHint')}
              >
                <Layers3 className="size-4 shrink-0" aria-hidden />
                <span>{t('routing.compound')}</span>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="order-2 flex min-h-0 flex-col rounded-3xl border border-slate-200/80 bg-white/75 p-3 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/55 xl:order-1">
          <Button type="button" variant="outline" className="h-11 w-full justify-start" onClick={startNewConversation}>
            <MessageSquarePlus className="size-4" /> {t('newConversation')}
          </Button>
          <div className="mt-4 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            <History className="size-4" /> {t('history')}
          </div>
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1 xl:max-h-[calc(100dvh-19rem)]">
            {conversations.length === 0 && !isLoading ? (
              <p className="rounded-xl px-2 py-4 text-sm text-slate-500">{t('emptyHistory')}</p>
            ) : conversations.map((row) => (
              <div
                key={row.id}
                className={cn(
                  'group flex items-start rounded-xl transition-colors',
                  conversationId === row.id
                    ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-200'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5',
                )}
              >
                <button type="button" onClick={() => void openConversation(row)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
                  <span className="line-clamp-2 text-sm font-semibold">{row.title}</span>
                  <span className="mt-1 block text-[11px] opacity-70">{formatDate(row.lastMessageAtUtc, i18n.language)}</span>
                </button>
                <button type="button" onClick={() => setArchiveTarget(row)} title={t('archive.action')} aria-label={t('archive.action')} className="mt-2 mr-2 grid size-8 shrink-0 place-items-center rounded-lg opacity-70 hover:bg-slate-200 hover:opacity-100 dark:hover:bg-white/10 xl:opacity-0 xl:group-hover:opacity-100 xl:focus-visible:opacity-100">
                  <Archive className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="order-1 flex min-h-[620px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/65 xl:order-2 xl:min-h-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5" aria-live="polite">
            {messages.length === 0 ? (
              <WelcomePanel examples={examples} onSelect={(value) => void submitQuestion(value)} t={t} />
            ) : (
              <div className="space-y-4">
                {messages.map((item, index) => (
                  <article key={item.id} className={cn('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[94%] rounded-2xl px-4 py-3 sm:max-w-[85%]',
                      item.role === 'user'
                        ? 'rounded-br-md bg-cyan-600 text-white shadow-sm'
                        : 'rounded-bl-md border border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100',
                    )}>
                      <p className="whitespace-pre-wrap text-sm leading-6">{item.content}</p>
                      {item.result ? <AssistantResult result={item.result} question={findPreviousQuestion(messages, index)} language={i18n.language} t={t} settingsT={settingsT} onSuggestion={(value) => void submitQuestion(value)} /> : null}
                    </div>
                  </article>
                ))}
                {isSending ? (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5">
                      <span className="size-2 animate-pulse rounded-full bg-cyan-500" /> {t('thinking')}
                    </div>
                  </div>
                ) : null}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-slate-200/80 bg-white/90 p-3 dark:border-white/10 dark:bg-slate-950/85 sm:p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-cyan-500/60 focus-within:ring-2 focus-within:ring-cyan-500/10 dark:border-white/10 dark:bg-white/5">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submitQuestion(message);
                  }
                }}
                maxLength={1000}
                rows={2}
                placeholder={t('placeholder')}
                aria-label={t('placeholder')}
                className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              />
              <Button type="submit" size="icon-lg" disabled={!message.trim() || isSending} aria-label={t('send')} className="shrink-0 rounded-xl bg-cyan-600 hover:bg-cyan-500">
                <Send className="size-4" />
              </Button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-slate-500">{t('privacyNote')}</p>
          </form>
        </div>
      </section>
      <ArchiveConversationDialog
        open={archiveTarget !== null}
        title={t('archive.title')}
        description={t('archive.description', { title: archiveTarget?.title ?? '' })}
        confirmLabel={t('archive.confirm')}
        cancelLabel={t('archive.cancel')}
        isPending={isArchiving}
        onOpenChange={(open) => { if (!open && !isArchiving) setArchiveTarget(null); }}
        onConfirm={archiveConversation}
      />
    </main>
  );
}

function ArchiveConversationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-3xl border-cyan-500/20 p-0" showCloseButton={!isPending}>
        <DialogHeader className="border-b border-slate-200/80 px-5 py-5 text-left dark:border-white/10 sm:px-6">
          <div className="flex items-start gap-3 pr-8">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-500/12 text-cyan-600 ring-1 ring-cyan-500/20 dark:text-cyan-300">
              <Archive className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-black text-slate-950 dark:text-white">{title}</DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-6">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 px-5 py-4 sm:px-6">
          <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" disabled={isPending} onClick={() => void onConfirm()} className="bg-cyan-600 hover:bg-cyan-500">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WelcomePanel({ examples, onSelect, t }: { examples: string[]; onSelect: (value: string) => void; t: TFunction }): ReactElement {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center py-8 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-cyan-500/15 text-cyan-600 ring-1 ring-cyan-500/20 dark:text-cyan-300"><Bot className="size-8" /></span>
      <h2 className="mt-5 text-xl font-black text-slate-950 dark:text-white sm:text-2xl">{t('welcome.title')}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">{t('welcome.description')}</p>
      <p className="mx-auto mt-2 max-w-xl rounded-xl bg-indigo-500/8 px-3 py-2 text-xs font-semibold leading-5 text-indigo-700 dark:text-indigo-200">{t('welcome.compound')}</p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {examples.map((example, index) => (
          <button key={`${example}-${index}`} type="button" onClick={() => onSelect(example)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function AssistantResult({ result, question, language, t, settingsT, onSuggestion }: { result: WarehouseAssistantChatResponse; question: string; language: string; t: TFunction; settingsT: TFunction; onSuggestion: (value: string) => void }): ReactElement | null {
  const goodsReceipts = result.goodsReceipts ?? [];
  const parameterGuides = result.parameterGuides ?? [];
  const steelVehicles = result.steelVehicles ?? [];
  const transfers = result.transfers ?? [];
  const entityCandidates = result.entityCandidates ?? [];
  const summaryMetrics = result.summaryMetrics ?? [];
  const exceptions = result.exceptions ?? [];
  const traceabilityEvents = result.traceabilityEvents ?? [];
  const evidence = result.evidence ?? [];
  const exportableCount = result.activities.length + result.serialBalances.length + result.serialReceipts.length + result.stockLocations.length + result.movements.length + result.tasks.length + goodsReceipts.length + steelVehicles.length + transfers.length + summaryMetrics.length + exceptions.length + traceabilityEvents.length + (result.barcode ? 1 : 0);
  const hasData = exportableCount + parameterGuides.length > 0;
  if (!hasData && entityCandidates.length === 0 && result.suggestions.length === 0) return null;
  return (
    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-white/10">
      {exportableCount > 0 ? <div className="flex justify-end"><WarehouseAssistantExportMenu result={result} question={question} language={language} t={t} /></div> : null}
      {entityCandidates.length > 0 ? (
        <ResultSection icon={<CircleAlert className="size-4" />} title={t('entityResolution.title')}>
          <div className="grid gap-2 sm:grid-cols-2">
            {entityCandidates.map((candidate) => (
              <button
                key={`${candidate.entityType}-${candidate.entityId ?? candidate.code}`}
                type="button"
                onClick={() => onSuggestion(candidate.selectionMessage)}
                className="group rounded-2xl border border-amber-300/70 bg-amber-50/80 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-cyan-500 hover:bg-cyan-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-amber-400/25 dark:bg-amber-400/5 dark:hover:border-cyan-400 dark:hover:bg-cyan-400/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white dark:bg-white dark:text-slate-950">
                    {t(`entityResolution.${candidate.entityType}`)}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {t(`entityResolution.${candidate.matchedBy}Match`)}
                  </span>
                </div>
                <p className="mt-3 break-all text-sm font-black text-slate-950 dark:text-white">{candidate.code}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{candidate.name}</p>
                <p className="mt-3 text-xs font-extrabold text-cyan-700 group-hover:text-cyan-800 dark:text-cyan-300">{t('entityResolution.choose')}</p>
              </button>
            ))}
          </div>
        </ResultSection>
      ) : null}
      {summaryMetrics.length > 0 ? (
        <ResultSection icon={<Activity className="size-4" />} title={t('results.shiftSummary')}>
          {summaryMetrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} language={language} t={t} />
          ))}
        </ResultSection>
      ) : null}
      {exceptions.length > 0 ? (
        <ResultSection icon={<TriangleAlert className="size-4" />} title={t('results.exceptions')}>
          {exceptions.map((row, index) => (
            <ExceptionCard key={`${row.code}-${row.entityId ?? row.documentNo ?? index}`} row={row} language={language} t={t} />
          ))}
        </ResultSection>
      ) : null}
      {traceabilityEvents.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500"><Waypoints className="size-4" />{t('results.traceability')}</div>
          <div className="relative space-y-2 border-s border-cyan-500/30 ps-4">
            {traceabilityEvents.map((row) => (
              <TraceabilityCard key={row.eventKey} row={row} language={language} t={t} />
            ))}
          </div>
        </section>
      ) : null}
      {result.activities.length > 0 ? (
        <ResultSection icon={<UserRoundSearch className="size-4" />} title={t('results.activities')}>
          {result.activities.map((row) => <ResultCard key={row.id} title={row.description} meta={`${row.userDisplayName} · ${formatDate(row.occurredAtUtc, language)}`} detail={`${row.entityType} #${row.entityId}`} />)}
        </ResultSection>
      ) : null}
      {result.serialBalances.length > 0 ? (
        <ResultSection icon={<Boxes className="size-4" />} title={t('results.serialBalances')}>
          {result.serialBalances.map((row) => <ResultCard key={row.id} title={`${row.stockCode} · ${row.stockName}`} meta={`${row.warehouseCode} - ${row.warehouseName}`} detail={`${row.locationCode} - ${row.locationName} · ${formatNumber(row.availableQuantity, language)} / ${formatNumber(row.quantity, language)} ${row.unitCode}`} />)}
        </ResultSection>
      ) : null}
      {result.serialReceipts.length > 0 ? (
        <ResultSection icon={<Clock3 className="size-4" />} title={t('results.serialReceipts')}>
          {result.serialReceipts.map((row) => <ResultCard key={row.movementEntryId} title={`${row.goodsReceiptNo} · ${row.stockCode}`} meta={`${row.receivedByDisplayName} · ${formatDate(row.receivedAtUtc, language)}`} detail={`${row.warehouseCode} - ${row.warehouseName} / ${row.locationCode} · ${formatNumber(row.quantity, language)} ${row.unitCode}`} />)}
        </ResultSection>
      ) : null}
      {result.stockLocations.length > 0 ? (
        <ResultSection icon={<MapPin className="size-4" />} title={t('results.stockLocations')}>
          {result.stockLocations.map((row, index) => <ResultCard key={`${row.stockId}-${row.warehouseCode}-${row.locationCode}-${index}`} title={`${row.stockCode} · ${row.stockName}`} meta={`${row.warehouseCode} - ${row.warehouseName}`} detail={`${row.locationCode} - ${row.locationName} · ${formatNumber(row.availableQuantity, language)} ${row.unitCode}`} />)}
        </ResultSection>
      ) : null}
      {result.barcode ? (
        <ResultSection icon={<ScanBarcode className="size-4" />} title={t('results.barcode')}>
          <ResultCard
            title={`${result.barcode.stockCode} · ${result.barcode.stockName}`}
            meta={`${t('barcode.source')}: ${translateValue(t, 'barcodeSources', result.barcode.source)} · ${result.barcode.barcode}`}
            detail={[
              result.barcode.serialNo ? `${t('barcode.serial')}: ${result.barcode.serialNo}` : null,
              result.barcode.lotNo ? `${t('barcode.lot')}: ${result.barcode.lotNo}` : null,
              result.barcode.encodedQuantity != null ? `${formatNumber(result.barcode.encodedQuantity, language)} ${result.barcode.unitCode}` : null,
            ].filter(Boolean).join(' · ') || t('barcode.stockOnly')}
          />
        </ResultSection>
      ) : null}
      {result.movements.length > 0 ? (
        <ResultSection icon={<Waypoints className="size-4" />} title={t('results.movements')}>
          {result.movements.map((row) => (
            <ResultCard
              key={row.entryId}
              title={`${row.stockCode} · ${translateValue(t, 'movementTypes', row.operationType)}`}
              meta={`${formatDate(row.occurredAtUtc, language)} · ${row.referenceNo || row.referenceType || t('fallbacks.noReference')}`}
              detail={`${row.warehouseCode} - ${row.warehouseName} / ${row.locationCode} · ${row.quantityDelta > 0 ? '+' : ''}${formatNumber(row.quantityDelta, language)} ${row.unitCode}${row.serialNo ? ` · ${t('barcode.serial')}: ${row.serialNo}` : ''}`}
            />
          ))}
        </ResultSection>
      ) : null}
      {result.tasks.length > 0 ? (
        <ResultSection icon={<ListChecks className="size-4" />} title={t('results.tasks')}>
          {result.tasks.map((row) => (
            <ResultCard
              key={`${row.module}-${row.taskId}-${row.assigneeUserId ?? 0}`}
              title={`${row.taskNo} · ${translateValue(t, 'taskModules', row.module)}`}
              meta={`${row.documentNo} · ${row.assigneeDisplayName} · ${translateValue(t, 'taskStatuses', row.status)}`}
              detail={`${row.warehouseCode} - ${row.warehouseName} · ${t('tasks.remaining')}: ${formatNumber(row.remainingQuantity, language)} / ${formatNumber(row.plannedQuantity, language)} · ${t('tasks.priority')}: ${row.priority}`}
            />
          ))}
        </ResultSection>
      ) : null}
      {goodsReceipts.length > 0 ? (
        <ResultSection icon={<ReceiptText className="size-4" />} title={t('results.goodsReceipts')}>
          {goodsReceipts.map((row, index) => (
            <ResultCard
              key={`${row.goodsReceiptId}-${row.stockId}-${index}`}
              title={`${row.documentNo} · ${row.stockCode} - ${row.stockName}`}
              meta={`${formatDocumentDate(row.documentDate, language)} · ${row.supplierCode} - ${row.supplierName} · ${row.receivedByDisplayName}`}
              detail={`${row.warehouseCode} - ${row.warehouseName} · ${formatNumber(row.receivedQuantity, language)} ${row.unitCode}${row.yapCode ? ` · ${t('goodsReceipt.configurationCode')}: ${row.yapCode}` : ''}`}
            />
          ))}
        </ResultSection>
      ) : null}
      {steelVehicles.length > 0 ? (
        <ResultSection icon={<Truck className="size-4" />} title={t('results.steelVehicles')}>
          {steelVehicles.map((row) => (
            <ResultCard
              key={row.vehicleCheckInId}
              title={row.plateNo}
              meta={`${formatDate(row.checkedInAtUtc, language)} · ${row.driverName || t('fallbacks.noDriver')} · ${translateValue(t, 'vehicleStatuses', row.status)}`}
              detail={`${t('steelVehicles.declared')}: ${row.declaredSteelSheetCount} · ${t('steelVehicles.accepted')}: ${row.acceptedPlateCount} · ${t('steelVehicles.unresolved')}: ${row.unresolvedPlateCount}${row.customerCode ? ` · ${row.customerCode} - ${row.customerName ?? ''}` : ''}`}
            />
          ))}
        </ResultSection>
      ) : null}
      {transfers.length > 0 ? (
        <ResultSection icon={<ArrowLeftRight className="size-4" />} title={t('results.transfers')}>
          {transfers.map((row, index) => (
            <ResultCard
              key={`${row.transferId}-${row.unitCode}-${index}`}
              title={`${row.documentNo} · ${translateValue(t, 'transferContexts', row.businessContext)}`}
              meta={`${row.sourceWarehouseCode} - ${row.sourceWarehouseName} → ${row.targetWarehouseCode} - ${row.targetWarehouseName} · ${translateValue(t, 'transferStatuses', row.status)}`}
              detail={`${t('transfers.requested')}: ${formatNumber(row.requestedQuantity, language)} · ${t('transfers.picked')}: ${formatNumber(row.pickedQuantity, language)} · ${t('transfers.received')}: ${formatNumber(row.receivedQuantity, language)} · ${t('transfers.shortClosed')}: ${formatNumber(row.shortClosedQuantity, language)} ${row.unitCode}`}
            />
          ))}
        </ResultSection>
      ) : null}
      {parameterGuides.map((guide) => (
        <ParameterGuideCard
          key={`${guide.module}-${guide.field}-${guide.value ?? 'all'}`}
          module={guide.module}
          field={guide.field}
          selectedValue={guide.value}
          t={t}
          settingsT={settingsT}
        />
      ))}
      {evidence.length > 0 ? (
        <details className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Database className="size-4 text-cyan-600" />{t('evidence.title')}
          </summary>
          <div className="mt-3 grid gap-2">
            {evidence.map((row, index) => (
              <div key={`${row.tool}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-white/10 dark:bg-slate-950/50">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong>{row.source}</strong><span>{t('evidence.recordCount', { count: row.recordCount })}</span></div>
                <p className="mt-1 text-slate-500">{row.filters}</p>
                <p className="mt-1 text-slate-500">{t('evidence.generatedAt')}: {formatDate(row.generatedAtUtc, language)}{row.dataAsOfUtc ? ` · ${t('evidence.dataAsOf')}: ${formatDate(row.dataAsOfUtc, language)}` : ''}</p>
                {row.isTruncated ? <p className="mt-2 font-semibold text-amber-700 dark:text-amber-300">{t('evidence.truncated')}</p> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {result.suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {result.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)} className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-left text-xs font-semibold text-cyan-800 hover:bg-cyan-500/15 dark:text-cyan-200">{suggestion}</button>)}
        </div>
      ) : null}
    </div>
  );
}

function ParameterGuideCard({ module, field, selectedValue, t, settingsT }: { module: string; field: string; selectedValue?: string | null; t: TFunction; settingsT: TFunction }): ReactElement | null {
  const options = parameterGuidanceOptions(module, field, settingsT);
  if (options.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        <Settings2 className="size-4" />{t('parameter.title')}
      </div>
      <div className="space-y-2">
        {options.map((option, index) => {
          const selected = selectedValue != null && option.value.toLocaleLowerCase() === selectedValue.toLocaleLowerCase();
          return (
            <article key={option.value} className={cn('rounded-2xl border p-3.5', selected ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/45')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">{t('parameter.option', { number: index + 1 })}</p>
                {selected ? <span className="rounded-full bg-cyan-600 px-2.5 py-1 text-[11px] font-bold text-white">{t('parameter.mentionedOption')}</span> : null}
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{option.guidance.summary}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><strong>{t('parameter.whatHappens')}:</strong> {option.guidance.effect}</p>
              {option.guidance.decision ? <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><strong>{t('parameter.whenToChoose')}:</strong> {option.guidance.decision}</p> : null}
              <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-700 dark:bg-white/5 dark:text-slate-200"><strong>{t('parameter.scenario')}:</strong> {option.guidance.scenario}</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-500"><strong>{t('parameter.affects')}:</strong> {option.guidance.affects.join(' · ')}</p>
              {option.guidance.warning ? <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold leading-5 text-amber-700 dark:text-amber-300"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{option.guidance.warning}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ResultSection({ icon, title, children }: { icon: ReactElement; title: string; children: ReactElement | ReactElement[] }): ReactElement {
  return <section><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{icon}{title}</div><div className="grid gap-2 md:grid-cols-2">{children}</div></section>;
}

function ResultCard({ title, meta, detail }: { title: string; meta: string; detail: string }): ReactElement {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/45"><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-slate-500">{meta}</p><p className="mt-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">{detail}</p></div>;
}

function MetricCard({ metric, language, t }: { metric: NonNullable<WarehouseAssistantChatResponse['summaryMetrics']>[number]; language: string; t: TFunction }): ReactElement {
  const tone = severityTone(metric.severity);
  const content = (
    <div className={cn('h-full rounded-2xl border p-3.5 transition', tone, metric.route && 'hover:-translate-y-0.5 hover:shadow-md')}>
      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{metric.label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-black text-slate-950 dark:text-white">{formatNumber(metric.value, language)} <span className="text-xs font-bold text-slate-500">{metric.unit}</span></p>
        {metric.route ? <ExternalLink className="size-4 text-cyan-600" aria-label={t('actions.openModule')} /> : null}
      </div>
    </div>
  );
  return metric.route ? <Link to={metric.route}>{content}</Link> : content;
}

function ExceptionCard({ row, language, t }: { row: NonNullable<WarehouseAssistantChatResponse['exceptions']>[number]; language: string; t: TFunction }): ReactElement {
  return (
    <article className={cn('rounded-2xl border p-3.5', severityTone(row.severity))}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-slate-950/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white dark:bg-white dark:text-slate-950">{t(`severity.${row.severity}`, { defaultValue: row.severity })}</span>
        <span className="text-[11px] font-bold text-slate-500">{row.documentNo ?? `${row.entityType} #${row.entityId ?? '-'}`}</span>
      </div>
      <h4 className="mt-3 text-sm font-black text-slate-950 dark:text-white">{row.title}</h4>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{row.description}</p>
      <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-950/45 dark:text-slate-200"><strong>{t('exceptions.suggestedAction')}:</strong> {row.suggestedAction}</div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>{row.detectedAtUtc ? formatDate(row.detectedAtUtc, language) : '-'}{row.ageHours != null ? ` · ${t('exceptions.ageHours', { count: row.ageHours })}` : ''}</span>
        {row.route ? <Link to={row.route} className="inline-flex items-center gap-1 font-bold text-cyan-700 hover:underline dark:text-cyan-300">{t('actions.openModule')}<ExternalLink className="size-3" /></Link> : null}
      </div>
    </article>
  );
}

function TraceabilityCard({ row, language, t }: { row: NonNullable<WarehouseAssistantChatResponse['traceabilityEvents']>[number]; language: string; t: TFunction }): ReactElement {
  return (
    <article className="relative rounded-2xl border border-slate-200 bg-white p-3.5 before:absolute before:-start-[1.3rem] before:top-5 before:size-2.5 before:rounded-full before:bg-cyan-500 before:ring-4 before:ring-cyan-500/15 dark:border-white/10 dark:bg-slate-950/45">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{row.stage} · {translateValue(t, 'movementTypes', row.eventType)}</strong><span className="text-[11px] text-slate-500">{formatDate(row.occurredAtUtc, language)}</span></div>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{row.stockCode} - {row.stockName}</p>
      <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">{row.warehouseCode ?? '-'} - {row.warehouseName ?? '-'} / {row.locationCode ?? '-'} · {row.quantity > 0 ? '+' : ''}{formatNumber(row.quantity, language)} {row.unitCode}</p>
      <p className="mt-2 text-[11px] text-slate-500">{row.documentNo ?? row.documentType} · {row.actorDisplayName}{row.isReversal ? ` · ${t('traceability.reversal')}` : ''}</p>
    </article>
  );
}

function severityTone(severity: string): string {
  if (severity === 'Critical') return 'border-red-300 bg-red-50/80 dark:border-red-500/30 dark:bg-red-500/10';
  if (severity === 'High') return 'border-amber-300 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10';
  if (severity === 'Medium') return 'border-violet-300 bg-violet-50/80 dark:border-violet-500/30 dark:bg-violet-500/10';
  return 'border-cyan-200 bg-cyan-50/70 dark:border-cyan-500/25 dark:bg-cyan-500/10';
}

function mapHistoryMessage(row: WarehouseAssistantMessageRow): ChatMessage {
  return { id: `history-${row.id}`, role: row.role, content: row.content, result: row.result ?? undefined };
}

function findPreviousQuestion(messages: ChatMessage[], assistantIndex: number): string {
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return messages[index].content;
  }
  return '';
}

function translateValue(t: TFunction, group: string, value: string): string {
  return t(`${group}.${value}`, { defaultValue: value });
}

function formatDate(value: string, language: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(language);
}

function formatDocumentDate(value: string, language: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(language);
}

function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(value);
}
