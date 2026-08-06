import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppInput } from '@/components/shared/AppInput';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function usePrefersCameraCapture(): boolean {
  const [prefer, setPrefer] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(pointer: coarse), (max-width: 1023px)');
    const sync = (): void => setPrefer(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return prefer;
}

/**
 * Personel / QR yakalama alanı.
 * - El terminali & masaüstü: odaklı metin kutusu (wedge + elle yazma).
 * - Tablet / telefon: input içinde kamera ikonu (genişliği bozmaz).
 * - Commit: Enter, Tab (doluysa) veya kamera — yazarken otomatik tetiklenmez.
 */
export function OpsQrCaptureField({
  value,
  onChange,
  onCommit,
  placeholder = 'Kartı okutun veya kodu yazın',
  autoFocus = false,
  disabled = false,
  invalid = false,
  className,
  inputClassName,
  cameraTitle = 'Personel QR okut',
  cameraDescription = 'Karttaki veya ekrandaki QR kodu kamera karesine getirin.',
}: {
  value: string;
  onChange: (value: string) => void;
  /** Enter / Tab / kamera okutması sonrası (trim’li kod). Yazarken çağrılmaz. */
  onCommit?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  inputClassName?: string;
  cameraTitle?: string;
  cameraDescription?: string;
}): ReactElement {
  const prefersCamera = usePrefersCameraCapture();
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!autoFocus || prefersCamera) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [autoFocus, prefersCamera]);

  const commit = (raw: string): void => {
    const next = raw.trim();
    if (!next) return;
    onChange(next);
    onCommit?.(next);
  };

  return (
    <div className={cn('min-w-0 w-full', className)}>
      <AppInput
        ref={inputRef}
        autoFocus={autoFocus && !prefersCamera}
        value={value}
        disabled={disabled}
        invalid={invalid}
        autoComplete="off"
        spellCheck={false}
        className={cn('w-full font-mono', inputClassName)}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Wedge okuyucular Enter veya Tab ile biter; değeri prop’tan değil DOM’dan al
          // (hızlı basışlarda React state bir tick geride kalabilir).
          const typed = event.currentTarget.value;
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(typed);
            return;
          }
          if (event.key === 'Tab' && !event.shiftKey && typed.trim()) {
            event.preventDefault();
            commit(typed);
          }
        }}
        trailingContent={
          prefersCamera ? (
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="Kamerayla QR okut"
              title="Kamerayla QR okut"
              className="app-input-shell__picker disabled:pointer-events-none disabled:opacity-45"
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="size-4" />
            </button>
          ) : undefined
        }
      />

      <OpsQrCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title={cameraTitle}
        description={cameraDescription}
        onDetected={(code) => {
          commit(code);
          setCameraOpen(false);
          window.setTimeout(() => inputRef.current?.focus(), 80);
        }}
      />
    </div>
  );
}

function OpsQrCameraDialog({
  open,
  onOpenChange,
  title,
  description,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onDetected: (code: string) => void;
}): ReactElement {
  const reactId = useId().replace(/:/g, '');
  const elementId = `wms-qr-cam-${reactId}`;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    const stop = async (instance: Html5Qrcode): Promise<void> => {
      try {
        if (instance.isScanning) await instance.stop();
      } catch {
        /* ignore stop races */
      }
      try {
        instance.clear();
      } catch {
        /* ignore */
      }
    };

    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      void (async () => {
        try {
          await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
            (decodedText) => {
              if (cancelled || handledRef.current) return;
              const code = decodedText.trim();
              if (!code) return;
              handledRef.current = true;
              const active = scanner;
              void (active ? stop(active) : Promise.resolve()).finally(() => {
                if (!cancelled) onDetectedRef.current(code);
              });
            },
            () => {
              /* scan tick — sessiz */
            },
          );
          if (!cancelled) setStarting(false);
        } catch (err) {
          if (cancelled) return;
          setStarting(false);
          const message =
            err instanceof Error
              ? err.message
              : 'Kamera açılamadı. Tarayıcı izinlerini kontrol edin.';
          setError(message);
          toast.error(message);
        }
      })();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      scannerRef.current = null;
      if (scanner) void stop(scanner);
    };
  }, [elementId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tone="ops" className="sm:max-w-md">
        <DialogHeader className="wms-ops-detail-dialog__header border-b border-[var(--wms-ops-card-border)] px-4 py-3 sm:px-5">
          <DialogTitle className="wms-ops-detail-dialog__title">{title}</DialogTitle>
          <DialogDescription className="text-sm text-[var(--wms-app-text-muted)]">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <div
            id={elementId}
            className="overflow-hidden rounded-xl border border-[var(--wms-ops-card-border)] bg-black/80 [&_video]:max-h-[min(52vh,22rem)] [&_video]:w-full [&_video]:object-cover"
          />
          {starting ? (
            <p className="flex items-center gap-2 text-sm text-[var(--wms-app-text-muted)]">
              <Loader2 className="size-4 animate-spin" />
              Kamera başlatılıyor…
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-rose-500">{error}</p>
          ) : (
            <p className="text-xs text-[var(--wms-app-text-muted)]">
              QR okununca otomatik kapanır. İptal için pencereyi kapatın.
            </p>
          )}
          <div className="flex justify-end">
            <OpsActionButton type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Kapat
            </OpsActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
