import { useEffect, useRef } from 'react';

interface AuthBackgroundProps {
  isActive: boolean;
  isPaused?: boolean;
}

/**
 * Auth atmospheric background — wind-swept logistics aurora.
 * Organic cross-currents + dust + luminous cargo orbs (no aisle vanishing point).
 * Photo asset kept on disk but not rendered.
 */
export const AuthBackground = ({ isActive, isPaused = false }: AuthBackgroundProps) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (isPaused) {
      svg.pauseAnimations();
    } else {
      svg.unpauseAnimations();
    }
  }, [isPaused]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-700 ${
        isActive ? 'opacity-100' : 'opacity-0'
      } ${isPaused ? 'wms-bg-paused' : ''}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#070e1f]" />

      {/* Deep color wells */}
      <div className="wms-auth-well wms-auth-well-a absolute inset-0" />
      <div className="wms-auth-well wms-auth-well-b absolute inset-0" />
      <div className="wms-auth-well wms-auth-well-c absolute inset-0" />

      {/* Wind silk ribbons */}
      <div className="wms-auth-silk wms-auth-silk-a absolute inset-0" />
      <div className="wms-auth-silk wms-auth-silk-b absolute inset-0" />
      <div className="wms-auth-silk wms-auth-silk-c absolute inset-0" />
      <div className="wms-auth-silk wms-auth-silk-d absolute inset-0" />

      {/* Soft dust field */}
      <div className="wms-auth-dust absolute inset-0" />

      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wmsWindCyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(34,211,238,0)" />
            <stop offset="30%" stopColor="rgba(34,211,238,0.55)" />
            <stop offset="55%" stopColor="rgba(96,165,250,0.45)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </linearGradient>
          <linearGradient id="wmsWindWarm" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(251,146,60,0)" />
            <stop offset="40%" stopColor="rgba(251,146,60,0.45)" />
            <stop offset="70%" stopColor="rgba(56,189,248,0.35)" />
            <stop offset="100%" stopColor="rgba(251,146,60,0)" />
          </linearGradient>
          <linearGradient id="wmsWindViolet" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(129,140,248,0)" />
            <stop offset="45%" stopColor="rgba(125,211,252,0.4)" />
            <stop offset="100%" stopColor="rgba(251,146,60,0)" />
          </linearGradient>
          <filter id="wmsWindGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="wmsOrbGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Organic wind rivers — different directions, no shared vanishing point */}
          <path
            id="wmsWind1"
            d="M-80 220 C 180 140, 320 300, 520 240 C 720 180, 860 320, 1080 260 C 1240 220, 1360 300, 1520 240"
          />
          <path
            id="wmsWind2"
            d="M1520 520 C 1280 460, 1100 600, 900 540 C 700 480, 520 620, 320 560 C 160 520, 40 600, -80 540"
          />
          <path
            id="wmsWind3"
            d="M200 -40 C 260 160, 120 300, 220 450 C 320 600, 180 720, 280 860 C 340 940, 420 980, 500 1040"
          />
          <path
            id="wmsWind4"
            d="M1180 1040 C 1120 860, 1280 720, 1180 560 C 1080 400, 1240 280, 1160 120 C 1100 20, 1040 -40, 980 -80"
          />
          <path
            id="wmsWind5"
            d="M-60 720 C 200 680, 340 780, 560 700 C 780 620, 960 760, 1180 680 C 1320 640, 1420 700, 1540 660"
          />
          <path
            id="wmsWind6"
            d="M720 -60 C 640 120, 820 220, 700 360 C 580 500, 820 600, 680 740 C 560 860, 760 940, 700 1040"
          />
          <path
            id="wmsWind7"
            d="M1540 180 C 1320 280, 1140 120, 940 220 C 740 320, 560 140, 360 240 C 200 300, 80 200, -60 280"
          />
        </defs>

        {/* Soft river underlays */}
        <g fill="none" strokeLinecap="round" opacity="0.35">
          <use href="#wmsWind1" stroke="rgba(56,189,248,0.12)" strokeWidth="10" />
          <use href="#wmsWind2" stroke="rgba(251,146,60,0.08)" strokeWidth="12" />
          <use href="#wmsWind5" stroke="rgba(125,211,252,0.09)" strokeWidth="9" />
          <use href="#wmsWind6" stroke="rgba(96,165,250,0.08)" strokeWidth="11" />
        </g>

        {/* Bright wind streaks */}
        <g className="wms-auth-wind-streaks" fill="none" strokeLinecap="round" filter="url(#wmsWindGlow)">
          <use href="#wmsWind1" className="wms-auth-streak wms-auth-streak-a" stroke="url(#wmsWindCyan)" strokeWidth="1.8" />
          <use href="#wmsWind2" className="wms-auth-streak wms-auth-streak-b" stroke="url(#wmsWindWarm)" strokeWidth="1.6" />
          <use href="#wmsWind3" className="wms-auth-streak wms-auth-streak-c" stroke="url(#wmsWindCyan)" strokeWidth="1.4" />
          <use href="#wmsWind4" className="wms-auth-streak wms-auth-streak-d" stroke="url(#wmsWindViolet)" strokeWidth="1.5" />
          <use href="#wmsWind5" className="wms-auth-streak wms-auth-streak-e" stroke="url(#wmsWindCyan)" strokeWidth="1.55" />
          <use href="#wmsWind6" className="wms-auth-streak wms-auth-streak-f" stroke="url(#wmsWindWarm)" strokeWidth="1.45" />
          <use href="#wmsWind7" className="wms-auth-streak wms-auth-streak-g" stroke="url(#wmsWindViolet)" strokeWidth="1.5" />
        </g>

        {/* Luminous cargo orbs riding the wind */}
        <g className="wms-auth-orbs" filter="url(#wmsOrbGlow)">
          <circle className="wms-auth-orb wms-auth-orb-cyan" r="3.2">
            <animateMotion dur="14s" repeatCount="indefinite"><mpath href="#wmsWind1" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-cyan" r="2.4">
            <animateMotion dur="14s" begin="-4.5s" repeatCount="indefinite"><mpath href="#wmsWind1" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-warm" r="3">
            <animateMotion dur="16s" repeatCount="indefinite"><mpath href="#wmsWind2" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-warm" r="2.2">
            <animateMotion dur="16s" begin="-7s" repeatCount="indefinite"><mpath href="#wmsWind2" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-cyan" r="2.8">
            <animateMotion dur="18s" repeatCount="indefinite"><mpath href="#wmsWind3" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-blue" r="2.6">
            <animateMotion dur="17s" begin="-5s" repeatCount="indefinite"><mpath href="#wmsWind4" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-cyan" r="3.1">
            <animateMotion dur="15s" begin="-2s" repeatCount="indefinite"><mpath href="#wmsWind5" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-warm" r="2.5">
            <animateMotion dur="15s" begin="-9s" repeatCount="indefinite"><mpath href="#wmsWind5" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-blue" r="2.9">
            <animateMotion dur="19s" begin="-3s" repeatCount="indefinite"><mpath href="#wmsWind6" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-cyan" r="2.3">
            <animateMotion dur="19s" begin="-11s" repeatCount="indefinite"><mpath href="#wmsWind6" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-warm" r="2.7">
            <animateMotion dur="13.5s" begin="-1s" repeatCount="indefinite"><mpath href="#wmsWind7" /></animateMotion>
          </circle>
          <circle className="wms-auth-orb wms-auth-orb-blue" r="2.1">
            <animateMotion dur="13.5s" begin="-6.5s" repeatCount="indefinite"><mpath href="#wmsWind7" /></animateMotion>
          </circle>
        </g>

        {/* Tiny wind dust motes */}
        <g className="wms-auth-motes" fill="rgba(186,230,253,0.55)">
          {Array.from({ length: 18 }).map((_, i) => {
            const paths = ['#wmsWind1', '#wmsWind2', '#wmsWind5', '#wmsWind7', '#wmsWind3', '#wmsWind6'];
            const path = paths[i % paths.length];
            const dur = 11 + (i % 7) * 1.4;
            const begin = -((i * 1.7) % dur);
            const r = 0.7 + (i % 3) * 0.35;
            return (
              <circle key={i} r={r} opacity={0.35 + (i % 4) * 0.12}>
                <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite">
                  <mpath href={path} />
                </animateMotion>
              </circle>
            );
          })}
        </g>
      </svg>

      {/* Floating logistics silhouettes — crates, pallets, drums, totes, mailers */}
      <div className="wms-auth-float wms-auth-crate-float wms-auth-crate-float-a absolute" aria-hidden="true">
        <span className="wms-auth-crate-float__face" />
        <span className="wms-auth-crate-float__tape" />
        <span className="wms-auth-crate-float__tape wms-auth-crate-float__tape--v" />
        <span className="wms-auth-crate-float__label" />
        <span className="wms-auth-crate-float__bars" />
      </div>
      <div className="wms-auth-float wms-auth-crate-float wms-auth-crate-float-b absolute" aria-hidden="true">
        <span className="wms-auth-crate-float__face" />
        <span className="wms-auth-crate-float__tape" />
        <span className="wms-auth-crate-float__tape wms-auth-crate-float__tape--v" />
        <span className="wms-auth-crate-float__label" />
        <span className="wms-auth-crate-float__bars" />
      </div>
      <div className="wms-auth-float wms-auth-crate-float wms-auth-crate-float-c absolute" aria-hidden="true">
        <span className="wms-auth-crate-float__face" />
        <span className="wms-auth-crate-float__tape" />
        <span className="wms-auth-crate-float__tape wms-auth-crate-float__tape--v" />
        <span className="wms-auth-crate-float__label" />
        <span className="wms-auth-crate-float__bars" />
      </div>
      <div className="wms-auth-float wms-auth-crate-float wms-auth-crate-float-d absolute" aria-hidden="true">
        <span className="wms-auth-crate-float__face" />
        <span className="wms-auth-crate-float__tape" />
        <span className="wms-auth-crate-float__tape wms-auth-crate-float__tape--v" />
        <span className="wms-auth-crate-float__label" />
        <span className="wms-auth-crate-float__bars" />
      </div>
      <div className="wms-auth-float wms-auth-crate-float wms-auth-crate-float-e absolute" aria-hidden="true">
        <span className="wms-auth-crate-float__face" />
        <span className="wms-auth-crate-float__tape" />
        <span className="wms-auth-crate-float__tape wms-auth-crate-float__tape--v" />
        <span className="wms-auth-crate-float__label" />
        <span className="wms-auth-crate-float__bars" />
      </div>
      <div className="wms-auth-float wms-auth-crate-float wms-auth-crate-float-f absolute" aria-hidden="true">
        <span className="wms-auth-crate-float__face" />
        <span className="wms-auth-crate-float__tape" />
        <span className="wms-auth-crate-float__tape wms-auth-crate-float__tape--v" />
        <span className="wms-auth-crate-float__label" />
        <span className="wms-auth-crate-float__bars" />
      </div>
      <div className="wms-auth-float wms-auth-crate-float wms-auth-crate-float-g absolute" aria-hidden="true">
        <span className="wms-auth-crate-float__face" />
        <span className="wms-auth-crate-float__tape" />
        <span className="wms-auth-crate-float__tape wms-auth-crate-float__tape--v" />
        <span className="wms-auth-crate-float__label" />
        <span className="wms-auth-crate-float__bars" />
      </div>
      <div className="wms-auth-float wms-auth-crate-float wms-auth-crate-float-h absolute" aria-hidden="true">
        <span className="wms-auth-crate-float__face" />
        <span className="wms-auth-crate-float__tape" />
        <span className="wms-auth-crate-float__tape wms-auth-crate-float__tape--v" />
        <span className="wms-auth-crate-float__label" />
        <span className="wms-auth-crate-float__bars" />
      </div>
      <div className="wms-auth-float wms-auth-crate-float wms-auth-crate-float-i absolute" aria-hidden="true">
        <span className="wms-auth-crate-float__face" />
        <span className="wms-auth-crate-float__tape" />
        <span className="wms-auth-crate-float__tape wms-auth-crate-float__tape--v" />
        <span className="wms-auth-crate-float__label" />
        <span className="wms-auth-crate-float__bars" />
      </div>

      <div className="wms-auth-float wms-auth-pallet wms-auth-pallet-a absolute" aria-hidden="true">
        <span className="wms-auth-pallet__deck" />
        <span className="wms-auth-pallet__block" />
        <span className="wms-auth-pallet__block wms-auth-pallet__block--m" />
        <span className="wms-auth-pallet__block wms-auth-pallet__block--r" />
        <span className="wms-auth-pallet__slat" />
        <span className="wms-auth-pallet__slat wms-auth-pallet__slat--2" />
      </div>
      <div className="wms-auth-float wms-auth-pallet wms-auth-pallet-b absolute" aria-hidden="true">
        <span className="wms-auth-pallet__deck" />
        <span className="wms-auth-pallet__block" />
        <span className="wms-auth-pallet__block wms-auth-pallet__block--m" />
        <span className="wms-auth-pallet__block wms-auth-pallet__block--r" />
        <span className="wms-auth-pallet__slat" />
        <span className="wms-auth-pallet__slat wms-auth-pallet__slat--2" />
      </div>
      <div className="wms-auth-float wms-auth-pallet wms-auth-pallet-c absolute" aria-hidden="true">
        <span className="wms-auth-pallet__deck" />
        <span className="wms-auth-pallet__block" />
        <span className="wms-auth-pallet__block wms-auth-pallet__block--m" />
        <span className="wms-auth-pallet__block wms-auth-pallet__block--r" />
        <span className="wms-auth-pallet__slat" />
        <span className="wms-auth-pallet__slat wms-auth-pallet__slat--2" />
      </div>

      <div className="wms-auth-float wms-auth-drum wms-auth-drum-a absolute" aria-hidden="true">
        <span className="wms-auth-drum__body" />
        <span className="wms-auth-drum__ring" />
        <span className="wms-auth-drum__ring wms-auth-drum__ring--2" />
        <span className="wms-auth-drum__lid" />
      </div>
      <div className="wms-auth-float wms-auth-drum wms-auth-drum-b absolute" aria-hidden="true">
        <span className="wms-auth-drum__body" />
        <span className="wms-auth-drum__ring" />
        <span className="wms-auth-drum__ring wms-auth-drum__ring--2" />
        <span className="wms-auth-drum__lid" />
      </div>
      <div className="wms-auth-float wms-auth-drum wms-auth-drum-c absolute" aria-hidden="true">
        <span className="wms-auth-drum__body" />
        <span className="wms-auth-drum__ring" />
        <span className="wms-auth-drum__ring wms-auth-drum__ring--2" />
        <span className="wms-auth-drum__lid" />
      </div>

      <div className="wms-auth-float wms-auth-tote wms-auth-tote-a absolute" aria-hidden="true">
        <span className="wms-auth-tote__body" />
        <span className="wms-auth-tote__rim" />
        <span className="wms-auth-tote__handle" />
        <span className="wms-auth-tote__handle wms-auth-tote__handle--r" />
      </div>
      <div className="wms-auth-float wms-auth-tote wms-auth-tote-b absolute" aria-hidden="true">
        <span className="wms-auth-tote__body" />
        <span className="wms-auth-tote__rim" />
        <span className="wms-auth-tote__handle" />
        <span className="wms-auth-tote__handle wms-auth-tote__handle--r" />
      </div>
      <div className="wms-auth-float wms-auth-tote wms-auth-tote-c absolute" aria-hidden="true">
        <span className="wms-auth-tote__body" />
        <span className="wms-auth-tote__rim" />
        <span className="wms-auth-tote__handle" />
        <span className="wms-auth-tote__handle wms-auth-tote__handle--r" />
      </div>

      <div className="wms-auth-float wms-auth-mailer wms-auth-mailer-a absolute" aria-hidden="true">
        <span className="wms-auth-mailer__body" />
        <span className="wms-auth-mailer__flap" />
        <span className="wms-auth-mailer__stripe" />
      </div>
      <div className="wms-auth-float wms-auth-mailer wms-auth-mailer-b absolute" aria-hidden="true">
        <span className="wms-auth-mailer__body" />
        <span className="wms-auth-mailer__flap" />
        <span className="wms-auth-mailer__stripe" />
      </div>
      <div className="wms-auth-float wms-auth-mailer wms-auth-mailer-c absolute" aria-hidden="true">
        <span className="wms-auth-mailer__body" />
        <span className="wms-auth-mailer__flap" />
        <span className="wms-auth-mailer__stripe" />
      </div>

      <div className="wms-auth-float wms-auth-container wms-auth-container-a absolute" aria-hidden="true">
        <span className="wms-auth-container__body" />
        <span className="wms-auth-container__rib" />
        <span className="wms-auth-container__rib wms-auth-container__rib--2" />
        <span className="wms-auth-container__rib wms-auth-container__rib--3" />
        <span className="wms-auth-container__door" />
      </div>
      <div className="wms-auth-float wms-auth-container wms-auth-container-b absolute" aria-hidden="true">
        <span className="wms-auth-container__body" />
        <span className="wms-auth-container__rib" />
        <span className="wms-auth-container__rib wms-auth-container__rib--2" />
        <span className="wms-auth-container__rib wms-auth-container__rib--3" />
        <span className="wms-auth-container__door" />
      </div>

      <div className="wms-bg-vignette absolute inset-0" />
    </div>
  );
};
