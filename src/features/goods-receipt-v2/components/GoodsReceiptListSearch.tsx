import { useEffect, useState, type KeyboardEvent, type ReactElement } from 'react';
import { X } from 'lucide-react';
import { OpsListSearchField } from '@/components/shared/OpsListSearchField';
import { VoiceSearchButton } from '@/components/ui/voice-search-button';
import { useModuleTranslation } from '@/hooks/useModuleTranslation';
import { appendFoldedSearchToken } from '@/lib/turkish-search';

export function GoodsReceiptListSearch({
  onSearchChange,
}: {
  onSearchChange: (search: string) => void;
}): ReactElement {
  const { t, moduleReady } = useModuleTranslation('goods-receipt-v2');
  const [draft, setDraft] = useState('');
  const [tokens, setTokens] = useState<string[]>([]);

  useEffect(() => {
    if (tokens.length > 0) {
      onSearchChange(tokens.join(' '));
      return;
    }
    const timer = window.setTimeout(() => {
      onSearchChange(draft.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, onSearchChange, tokens]);

  const commitToken = (): void => {
    setTokens((current) => appendFoldedSearchToken(current, draft));
    if (draft.trim()) setDraft('');
  };

  const clearAll = (): void => {
    setDraft('');
    setTokens([]);
    onSearchChange('');
  };

  void moduleReady;

  return (
    <div className="wms-ops-grid-search wms-ops-grid-search--tokens" data-no-auto-localize="true">
      <OpsListSearchField
        value={draft}
        placeholder={t('list.searchPlaceholder')}
        title={t('list.searchTokenHint')}
        onValueChange={setDraft}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          commitToken();
        }}
        className="md:w-64"
        rightSlot={draft || tokens.length > 0 ? (
          <button
            type="button"
            aria-label={t('list.searchClearTokens')}
            onClick={clearAll}
            className="wms-ops-voice-btn grid place-items-center"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <VoiceSearchButton
            onResult={(text) => {
              setTokens((current) => appendFoldedSearchToken(current, text));
              setDraft('');
            }}
          />
        )}
      />
      {tokens.length > 0 ? (
        <div className="wms-ops-grid-search__chips" aria-label={t('list.searchActiveTokens')}>
          {tokens.map((token) => (
            <span key={token} className="wms-ops-grid-search__chip">
              <span className="wms-ops-grid-search__chip-text">{token}</span>
              <button
                type="button"
                className="wms-ops-grid-search__chip-remove"
                onClick={() => setTokens((current) => current.filter((item) => item !== token))}
                aria-label={t('list.searchRemoveToken', { token })}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" className="wms-ops-grid-search__clear" onClick={clearAll}>
            {t('list.searchClearTokens')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
