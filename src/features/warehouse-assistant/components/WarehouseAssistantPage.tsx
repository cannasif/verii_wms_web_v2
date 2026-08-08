import { type FormEvent, type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Boxes, Clock3, History, Loader2, MapPin, MessageSquarePlus, Send, ShieldCheck, UserRoundSearch } from 'lucide-react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
  scopeLabel: '',
  exampleQuestions: [],
};

export function WarehouseAssistantPage(): ReactElement {
  const { t, i18n, moduleReady } = useModuleTranslation('warehouse-assistant');
  const setPageTitle = useUIStore((state) => state.setPageTitle);
  const [capabilities, setCapabilities] = useState(emptyCapabilities);
  const [conversations, setConversations] = useState<WarehouseAssistantConversationRow[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
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
      const result = await warehouseAssistantApi.ask(trimmed, conversationId);
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

  if (!moduleReady) {
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
              <button
                key={row.id}
                type="button"
                onClick={() => void openConversation(row)}
                className={cn(
                  'w-full rounded-xl px-3 py-2.5 text-left transition-colors',
                  conversationId === row.id
                    ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-200'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5',
                )}
              >
                <span className="line-clamp-2 text-sm font-semibold">{row.title}</span>
                <span className="mt-1 block text-[11px] opacity-70">{formatDate(row.lastMessageAtUtc, i18n.language)}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="order-1 flex min-h-[620px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/65 xl:order-2 xl:min-h-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5" aria-live="polite">
            {messages.length === 0 ? (
              <WelcomePanel examples={examples} onSelect={(value) => void submitQuestion(value)} t={t} />
            ) : (
              <div className="space-y-4">
                {messages.map((item) => (
                  <article key={item.id} className={cn('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[94%] rounded-2xl px-4 py-3 sm:max-w-[85%]',
                      item.role === 'user'
                        ? 'rounded-br-md bg-cyan-600 text-white shadow-sm'
                        : 'rounded-bl-md border border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100',
                    )}>
                      <p className="whitespace-pre-wrap text-sm leading-6">{item.content}</p>
                      {item.result ? <AssistantResult result={item.result} language={i18n.language} t={t} onSuggestion={(value) => void submitQuestion(value)} /> : null}
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
    </main>
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

function AssistantResult({ result, language, t, onSuggestion }: { result: WarehouseAssistantChatResponse; language: string; t: TFunction; onSuggestion: (value: string) => void }): ReactElement | null {
  const hasData = result.activities.length + result.serialBalances.length + result.serialReceipts.length + result.stockLocations.length > 0;
  if (!hasData && result.suggestions.length === 0) return null;
  return (
    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-white/10">
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
      {result.suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {result.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)} className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-left text-xs font-semibold text-cyan-800 hover:bg-cyan-500/15 dark:text-cyan-200">{suggestion}</button>)}
        </div>
      ) : null}
    </div>
  );
}

function ResultSection({ icon, title, children }: { icon: ReactElement; title: string; children: ReactElement | ReactElement[] }): ReactElement {
  return <section><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{icon}{title}</div><div className="grid gap-2 md:grid-cols-2">{children}</div></section>;
}

function ResultCard({ title, meta, detail }: { title: string; meta: string; detail: string }): ReactElement {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/45"><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-slate-500">{meta}</p><p className="mt-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">{detail}</p></div>;
}

function mapHistoryMessage(row: WarehouseAssistantMessageRow): ChatMessage {
  return { id: `history-${row.id}`, role: row.role, content: row.content };
}

function formatDate(value: string, language: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(language);
}

function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(value);
}
