import { Fragment, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ArrowLeftRight, Boxes, ChevronRight, Package, Truck } from 'lucide-react';

const FLOW_STEPS = [
  { key: 'inbound' as const, Icon: Package },
  { key: 'stock' as const, Icon: Boxes },
  { key: 'transfer' as const, Icon: ArrowLeftRight },
  { key: 'shipping' as const, Icon: Truck },
];

function FlowMarkIcon({ size = 22 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12h3.2M16.3 12H19.5M12 4.5v3.2M12 16.3v3.2"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="12" cy="12" r="3.15" stroke="currentColor" strokeWidth="1.55" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.55" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="19.5" cy="12" r="1.55" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="4.5" r="1.55" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="19.5" r="1.55" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.1 10.6 10.2 7.4M13.8 7.4l4.1 3.2M17.9 13.4l-4.1 3.2M10.2 16.6 6.1 13.4"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

function greetingKeyForHour(hour: number): 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening' | 'greetingNight' {
  if (hour >= 5 && hour < 12) return 'greetingMorning';
  if (hour >= 12 && hour < 17) return 'greetingAfternoon';
  if (hour >= 17 && hour < 22) return 'greetingEvening';
  return 'greetingNight';
}

export function LoginIntroHeadline(): ReactElement {
  const { t } = useTranslation('common');

  return (
    <div className="auth-login-intro space-y-3.5">
      <h2 className="auth-login-intro-title text-3xl font-semibold leading-tight tracking-[-0.02em] text-white xl:text-[2.45rem] xl:leading-[1.12]">
        <Trans
          i18nKey="auth.login.intro.headline"
          components={{
            brand: (
              <span
                lang="en"
                className="bg-linear-to-r from-pink-400 to-yellow-400 bg-clip-text font-bold text-transparent"
              >
                V3RII
              </span>
            ),
          }}
        />
      </h2>
      <p className="auth-login-intro-copy max-w-[36rem] text-sm leading-relaxed tracking-[0.01em] text-slate-300/90 xl:text-[0.95rem]">
        {t('auth.login.intro.description')}
      </p>
    </div>
  );
}

export function LoginIntroFlowCard({ isAnimationPaused = false }: { isAnimationPaused?: boolean }): ReactElement {
  const { t, i18n } = useTranslation('common');
  const [activeStep, setActiveStep] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (isAnimationPaused) return;
    const cycle = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % FLOW_STEPS.length);
    }, 4200);
    return () => window.clearInterval(cycle);
  }, [isAnimationPaused]);

  const clockLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now),
    [i18n.language, now],
  );

  const greeting = t(`auth.login.intro.${greetingKeyForHour(now.getHours())}`);

  const renderStep = (index: number) => {
    const { key, Icon } = FLOW_STEPS[index];
    const active = index === activeStep;
    return (
      <div
        className={`relative min-w-0 flex-1 overflow-hidden rounded-xl border px-3.5 py-4 ${
          isAnimationPaused ? '' : 'transition-[background-color,border-color,box-shadow,transform,opacity] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]'
        } ${
          active
            ? 'border-sky-400/30 bg-white/[0.06] shadow-[0_0_22px_rgba(56,132,246,0.16),inset_0_0_12px_rgba(96,150,255,0.06)] scale-[1.015]'
            : 'border-white/10 bg-white/[0.025] opacity-65'
        }`}
      >
        <div
          className={`pointer-events-none absolute inset-0 bg-linear-to-br from-cyan-400/12 via-transparent to-orange-400/8 ${
            isAnimationPaused ? '' : 'transition-opacity duration-1000'
          } ${active ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        />
        <div className="relative mb-3 flex items-center justify-between gap-2">
          <span
            className={`text-[0.7rem] font-semibold tracking-[0.16em] ${
              isAnimationPaused ? '' : 'transition-colors duration-1000'
            } ${active ? 'text-cyan-200' : 'text-slate-500'}`}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <Icon
            size={17}
            className={`${isAnimationPaused ? '' : 'transition-colors duration-1000'} ${active ? 'text-cyan-200' : 'text-slate-500'}`}
          />
        </div>
        <p
          className={`relative text-[0.88rem] font-medium leading-snug ${
            isAnimationPaused ? '' : 'transition-colors duration-1000'
          } ${active ? 'text-white' : 'text-slate-400'}`}
        >
          {t(`auth.login.intro.steps.${key}`)}
        </p>
        <div
          className={`relative mt-3 flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.12em] ${
            isAnimationPaused ? '' : 'transition-colors duration-1000'
          } ${active ? 'text-emerald-300/90' : 'text-slate-600'}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isAnimationPaused ? '' : 'transition-colors duration-1000'} ${
              active ? 'bg-emerald-400' : 'bg-slate-600'
            }`}
          />
          {t('auth.login.intro.live')}
        </div>
      </div>
    );
  };

  return (
    <section className="auth-login-intro relative overflow-hidden rounded-2xl border border-sky-400/15 bg-[#0b1228]/70 shadow-[0_0_24px_2px_rgba(56,132,246,0.10),inset_0_0_14px_1px_rgba(96,150,255,0.05),0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:rounded-3xl">
      <div className="relative flex items-center justify-between gap-3 px-5 py-5 sm:px-7 sm:py-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-black/30 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.14)]">
            <FlowMarkIcon size={22} />
          </div>
          <p className="truncate text-base font-semibold tracking-[0.04em] text-white sm:text-lg">
            {t('auth.login.intro.flowTitle')}
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            {!isAnimationPaused ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            ) : null}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          {t('auth.login.intro.live')}
        </div>
      </div>

      <div className="relative px-4 pb-5 sm:px-6 sm:pb-6">
        <div className="grid grid-cols-2 gap-3 sm:hidden">
          {FLOW_STEPS.map((_, index) => (
            <Fragment key={FLOW_STEPS[index].key}>{renderStep(index)}</Fragment>
          ))}
        </div>

        <div className="hidden items-stretch sm:flex sm:gap-1">
          {FLOW_STEPS.map((step, index) => {
            const arrowLit = activeStep === index + 1;
            return (
              <Fragment key={step.key}>
                {renderStep(index)}
                {index < FLOW_STEPS.length - 1 ? (
                  <div className="flex w-7 shrink-0 items-center justify-center" aria-hidden="true">
                    <ChevronRight
                      size={18}
                      strokeWidth={2.25}
                      className={`${isAnimationPaused ? '' : 'transition-[color,filter,opacity,transform] duration-700 ease-out'} ${
                        arrowLit && !isAnimationPaused
                          ? 'auth-flow-arrow-lit scale-110 text-cyan-300 opacity-100'
                          : 'text-slate-600 opacity-40'
                      }`}
                    />
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="relative flex flex-wrap items-end justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-7 sm:py-4">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium tracking-[0.01em] text-white/90">{greeting}</p>
          <p className="text-xs leading-relaxed tracking-[0.01em] text-slate-400 sm:text-[0.8rem]">
            {t('auth.login.intro.humanNote')}
          </p>
        </div>
        <p className="font-mono text-[0.78rem] tracking-[0.04em] text-cyan-200/90 tabular-nums sm:text-sm">
          {clockLabel}
        </p>
      </div>
    </section>
  );
}

/** Desktop helper: headline + flow stacked (mobile unused). */
export function LoginIntroPanel(): ReactElement {
  return (
    <div className="flex h-full min-h-0 w-full max-w-[760px] flex-col justify-center gap-7 px-1 py-6 xl:gap-8 xl:px-2">
      <LoginIntroHeadline />
      <LoginIntroFlowCard />
    </div>
  );
}
