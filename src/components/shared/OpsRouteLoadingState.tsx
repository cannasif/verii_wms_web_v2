import { type ReactElement, useEffect, useState } from 'react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

interface OpsRouteLoadingStateProps {
  message: string;
  code?: string;
  className?: string;
}

const SPINNER_FRAMES = ['|', '/', '-', '\\'] as const;

const BOOT_STEPS = [
  'init.runtime',
  'mount.modules',
  'sync.session',
  'paint.shell',
  'ready.check',
] as const;

const PREMIUM_STEPS = ['Hazırlanıyor', 'Bağlanıyor', 'Senkron', 'Açılıyor'] as const;

/** Full-page / route-transition loader only — not for inline module states. */
export function OpsRouteLoadingState({
  message,
  code = 'BOOT',
  className,
}: OpsRouteLoadingStateProps): ReactElement {
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const [frame, setFrame] = useState(0);
  const [step, setStep] = useState(0);
  const [bars, setBars] = useState(3);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const spinner = window.setInterval(() => {
      setFrame((current) => (current + 1) % SPINNER_FRAMES.length);
    }, 90);

    const stepper = window.setInterval(() => {
      setStep((current) => (current + 1) % (isPremium ? PREMIUM_STEPS.length : BOOT_STEPS.length));
      setBars((current) => (current >= 14 ? 4 : current + 1));
    }, isPremium ? 950 : 720);

    return () => {
      window.clearInterval(spinner);
      window.clearInterval(stepper);
    };
  }, [isPremium]);

  if (isPremium) {
    const activeStep = step % PREMIUM_STEPS.length;

    return (
      <div
        className={cn('wms-premium-route-loading', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="wms-premium-route-loading__stage" aria-hidden>
          <span className="wms-premium-route-loading__glow" />
          <div className="wms-premium-route-loading__orbit">
            <span className="wms-premium-route-loading__ring wms-premium-route-loading__ring--outer" />
            <span className="wms-premium-route-loading__ring wms-premium-route-loading__ring--mid" />
            <span className="wms-premium-route-loading__ring wms-premium-route-loading__ring--inner" />
            <span className="wms-premium-route-loading__core" />
            <span className="wms-premium-route-loading__spark" />
          </div>
        </div>

        <div className="wms-premium-route-loading__copy">
          <div className="wms-premium-route-loading__eyebrow">
            <span className="wms-premium-route-loading__code">{code}</span>
            <span className="wms-premium-route-loading__pulse-dot" aria-hidden />
            <span className="wms-premium-route-loading__step-label">{PREMIUM_STEPS[activeStep]}</span>
          </div>
          <div className="wms-premium-route-loading__message">{message}</div>
        </div>

        <div className="wms-premium-route-loading__track" aria-hidden>
          <span className="wms-premium-route-loading__track-fill" />
          <span className="wms-premium-route-loading__track-shine" />
        </div>

        <div className="wms-premium-route-loading__steps" aria-hidden>
          {PREMIUM_STEPS.map((label, index) => (
            <span
              key={label}
              className={cn(
                'wms-premium-route-loading__step',
                index === activeStep && 'wms-premium-route-loading__step--active',
                index < activeStep && 'wms-premium-route-loading__step--done',
              )}
            >
              <i />
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const filled = Math.min(14, Math.max(3, bars));
  const empty = 14 - filled;
  const activeBoot = step % BOOT_STEPS.length;

  return (
    <div
      className={cn('wms-ops-route-loading', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="wms-ops-route-loading__chrome" aria-hidden>
        <span className="wms-ops-route-loading__traffic">
          <i />
          <i />
          <i />
        </span>
        <span className="wms-ops-route-loading__path">wms://proc/{code.toLowerCase()}</span>
        <span className="wms-ops-route-loading__status">
          RUN
          <em>{SPINNER_FRAMES[frame]}</em>
        </span>
      </div>

      <div className="wms-ops-terminal-state__line">
        <span className="wms-ops-terminal-state__prompt" aria-hidden>
          {'>'}
        </span>
        <span className="wms-ops-terminal-state__tag wms-ops-route-loading__tag">RUN</span>
        <span className="wms-ops-terminal-state__code">{code}</span>
        <span className="wms-ops-route-loading__cursor" aria-hidden />
      </div>

      <div className="wms-ops-route-loading__meter" aria-hidden>
        <span className="wms-ops-route-loading__brackets">[</span>
        <span className="wms-ops-route-loading__blocks">
          {'█'.repeat(filled)}
          <span className="wms-ops-route-loading__blocks-empty">{'░'.repeat(empty)}</span>
        </span>
        <span className="wms-ops-route-loading__brackets">]</span>
        <span className="wms-ops-route-loading__pct">
          {String(Math.round((filled / 14) * 100)).padStart(3, ' ')}%
        </span>
      </div>

      <div className="wms-ops-route-loading__bar" aria-hidden>
        <span className="wms-ops-route-loading__bar-scan" />
      </div>

      <ul className="wms-ops-route-loading__log" aria-hidden>
        {BOOT_STEPS.map((line, index) => (
          <li
            key={line}
            className={cn(
              'wms-ops-route-loading__log-item',
              index === activeBoot && 'wms-ops-route-loading__log-item--active',
              index < activeBoot && 'wms-ops-route-loading__log-item--done',
            )}
          >
            <span className="wms-ops-route-loading__log-mark">
              {index === activeBoot ? '>' : index < activeBoot ? 'ok' : '·'}
            </span>
            <span className="wms-ops-route-loading__log-text">{line}</span>
            {index === activeBoot ? <span className="wms-ops-route-loading__cursor" /> : null}
          </li>
        ))}
      </ul>

      <div className="wms-ops-terminal-state__detail">{message}</div>
    </div>
  );
}
