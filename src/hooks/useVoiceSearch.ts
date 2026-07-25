import { useState, useCallback, useEffect } from 'react';
import i18n from '@/lib/i18n';

interface UseVoiceSearchOptions {
  onResult: (text: string) => void;
  language?: string;
}

export const useVoiceSearch = ({ onResult, language = 'tr-TR' }: UseVoiceSearchOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const checkSupport = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    };
    checkSupport();
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError(i18n.t('voiceSearch.unsupported'));
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(i18n.t('voiceSearch.unsupported'));
      return;
    }
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join('');
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        setError(i18n.t('voiceSearch.noSpeech'));
      } else if (event.error === 'not-allowed') {
        setError(i18n.t('voiceSearch.permissionDenied'));
      } else {
        setError(i18n.t('voiceSearch.errorWithReason', { reason: event.error }));
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch {
      setError(i18n.t('voiceSearch.startFailed'));
      setIsListening(false);
    }
  }, [isSupported, language, onResult]);

  const stopListening = useCallback(() => {
    setIsListening(false);
  }, []);

  return {
    isListening,
    error,
    isSupported,
    startListening,
    stopListening,
  };
};

declare global {
  interface SpeechRecognitionResultLike {
    0: { transcript: string };
  }

  interface SpeechRecognitionEvent extends Event {
    results: ArrayLike<SpeechRecognitionResultLike>;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }

  interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start: () => void;
  }

  interface SpeechRecognitionConstructor {
    new (): SpeechRecognitionInstance;
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}
