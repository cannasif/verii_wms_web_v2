import { type ReactElement, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { cn } from '@/lib/utils';

interface VoiceSearchButtonProps {
  onResult: (text: string) => void;
  className?: string;
}

export function VoiceSearchButton({
  onResult,
  className,
}: VoiceSearchButtonProps): ReactElement | null {
  const { t } = useTranslation();
  const { isListening, error, isSupported, startListening, stopListening } = useVoiceSearch({
    onResult: (text) => {
      onResult(text);
      if (text.trim()) toast.success(t('voiceSearch.completed'));
    },
  });

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={() => { if (isListening) stopListening(); else startListening(); }}
      className={cn(
        'wms-ops-voice-btn grid place-items-center',
        isListening && 'wms-ops-voice-btn--listening animate-pulse',
        className,
      )}
      title={isListening ? t('voiceSearch.stop') : t('voiceSearch.start')}
      aria-label={isListening ? t('voiceSearch.stop') : t('voiceSearch.start')}
    >
      {isListening ? <MicOff className="size-3.5" aria-hidden /> : <Mic className="size-3.5" aria-hidden />}
    </button>
  );
}
