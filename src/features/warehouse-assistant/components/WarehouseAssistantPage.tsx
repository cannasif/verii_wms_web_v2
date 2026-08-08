import { type FormEvent, type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowLeftRight, Bot, Boxes, CircleAlert, Clock3, History, ListChecks, Loader2, MapPin, MessageSquarePlus, ReceiptText, ScanBarcode, Send, Settings2, ShieldCheck, Truck, UserRoundSearch, Waypoints } from 'lucide-react';
import type { TFunction } from 'i18next';
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
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            <ShieldCheck className="size-4 shrink-0" />
            <span>{capabilities.scopeLabel || t('scope.self')}</span>
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
  const exportableCount = result.activities.length + result.serialBalances.length + result.serialReceipts.length + result.stockLocations.length + result.movements.length + result.tasks.length + goodsReceipts.length + steelVehicles.length + transfers.length + (result.barcode ? 1 : 0);
  const hasData = exportableCount + parameterGuides.length > 0;
  if (!hasData && result.suggestions.length === 0) return null;
  return (
    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-white/10">
      {exportableCount > 0 ? <div className="flex justify-end"><WarehouseAssistantExportMenu result={result} question={question} language={language} t={t} /></div> : null}
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
