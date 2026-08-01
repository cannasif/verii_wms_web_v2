import type { ReactElement } from 'react';
import { useTheme } from '@/components/theme-provider';
import { useMotionEnvironment } from '@/hooks/use-motion-environment';
import type { WmsBackgroundMotionVariant } from '@/lib/background-motion';
import { cn } from '@/lib/utils';
import './warehouse-ambient-background.css';

interface WarehouseMotionSceneProps {
  variant: WmsBackgroundMotionVariant;
  running: boolean;
  preview?: boolean;
  className?: string;
}

export function WarehouseMotionScene({
  variant,
  running,
  preview = false,
  className,
}: WarehouseMotionSceneProps): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'wms-ambient-motion',
        preview && 'wms-ambient-motion--preview',
        className,
      )}
      data-motion-variant={variant}
      data-motion-state={running ? 'running' : 'paused'}
    >
      {variant === 'rack-scanner' ? <RackScannerScene /> : null}
      {variant === 'conveyor-flow' ? <ConveyorFlowScene /> : null}
      {variant === 'forklift-route' ? <ForkliftRouteScene /> : null}
      {variant === 'pick-to-light' ? <PickToLightScene /> : null}
      {variant === 'agv-shuttle' ? <AgvShuttleScene /> : null}
      {variant === 'barcode-scan' ? <BarcodeScanScene /> : null}
    </div>
  );
}

export function WarehouseAmbientBackground(): ReactElement | null {
  const { backgroundMotionEnabled, backgroundMotionVariant } = useTheme();
  const { prefersReducedMotion, isPageVisible } = useMotionEnvironment();

  if (!backgroundMotionEnabled) return null;

  return (
    <WarehouseMotionScene
      variant={backgroundMotionVariant}
      running={!prefersReducedMotion && isPageVisible}
    />
  );
}

function TerminalHudFrame(): ReactElement {
  return (
    <g className="wms-motion-hud" fill="none" stroke="currentColor">
      <path d="M48 48H120V56H56V120H48Z" />
      <path d="M1152 48H1080V56H1144V120H1152Z" />
      <path d="M48 552H120V544H56V480H48Z" />
      <path d="M1152 552H1080V544H1144V480H1152Z" />
      <path className="wms-motion-hud__grid" d="M80 100H1120M80 500H1120M200 80V520M1000 80V520" />
      <g className="wms-motion-hud__ticks">
        {Array.from({ length: 12 }, (_, index) => (
          <path key={index} d={`M${140 + index * 80} 72V84`} />
        ))}
      </g>
    </g>
  );
}

function PremiumAura(): ReactElement {
  return (
    <g className="wms-motion-premium-aura" aria-hidden>
      <ellipse className="wms-motion-premium-aura__blob wms-motion-premium-aura__blob--one" cx="280" cy="180" rx="220" ry="140" />
      <ellipse className="wms-motion-premium-aura__blob wms-motion-premium-aura__blob--two" cx="920" cy="420" rx="260" ry="160" />
    </g>
  );
}

function RackScannerScene(): ReactElement {
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" role="presentation">
      <PremiumAura />
      <TerminalHudFrame />
      <g className="wms-motion-floor">
        <path d="M40 470H1160" />
        <path d="M80 510H1120" />
        {Array.from({ length: 16 }, (_, index) => (
          <path key={index} d={`M${100 + index * 68} 470V510`} />
        ))}
      </g>
      <g className="wms-motion-racks">
        {[120, 300, 480, 660, 840, 1020].map((x) => (
          <g key={x} transform={`translate(${x} 110)`}>
            <rect x="0" y="0" width="120" height="340" rx="8" />
            <path d="M0 85H120M0 170H120M0 255H120M40 0V340M80 0V340" />
            <g className="wms-motion-rack-bay">
              <rect x="10" y="20" width="28" height="18" rx="3" />
              <rect x="46" y="105" width="28" height="18" rx="3" />
              <rect x="82" y="190" width="28" height="18" rx="3" />
            </g>
          </g>
        ))}
      </g>
      <g className="wms-motion-scan-column">
        <rect x="168" y="100" width="3" height="360" rx="1.5" />
        <rect x="348" y="100" width="3" height="360" rx="1.5" />
        <rect x="888" y="100" width="3" height="360" rx="1.5" />
      </g>
      <g className="wms-motion-scan-beam">
        <rect x="70" y="278" width="1060" height="3" rx="1.5" />
        <rect x="70" y="258" width="1060" height="44" rx="22" className="wms-motion-scan-beam__halo" />
      </g>
      <g className="wms-motion-scan-pulse wms-motion-scan-pulse--one">
        <circle cx="340" cy="280" r="22" />
        <circle cx="340" cy="280" r="6" className="wms-motion-scan-pulse__core" />
      </g>
      <g className="wms-motion-scan-pulse wms-motion-scan-pulse--two">
        <circle cx="880" cy="280" r="22" />
        <circle cx="880" cy="280" r="6" className="wms-motion-scan-pulse__core" />
      </g>
      <g className="wms-motion-scan-readout">
        <rect x="920" y="84" width="160" height="36" rx="8" />
        <path d="M936 102H1048M936 114H1008" />
      </g>
    </svg>
  );
}

function ConveyorFlowScene(): ReactElement {
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" role="presentation">
      <PremiumAura />
      <TerminalHudFrame />
      <g className="wms-motion-conveyor-rail">
        <path d="M40 360H1160" />
        <path d="M40 460H1160" />
      </g>
      <g className="wms-motion-conveyor">
        <path d="M40 390H1160" />
        <path d="M80 430H1120" />
        {Array.from({ length: 18 }, (_, index) => (
          <circle key={index} cx={100 + index * 58} cy="410" r="14" />
        ))}
      </g>
      <g className="wms-motion-conveyor-chevrons">
        {Array.from({ length: 8 }, (_, index) => (
          <path key={index} d={`M${160 + index * 120} 500l18-10 18 10`} />
        ))}
      </g>
      {[0, 1, 2].map((index) => (
        <g key={index} className={`wms-motion-package wms-motion-package--${index + 1}`}>
          <rect x="-80" y="300" width="110" height="88" rx="8" />
          <path d="M-80 330H30M-25 300V388" />
          <path d="M-58 349H-4" className="wms-motion-package__label" />
          <rect x="-62" y="358" width="48" height="10" rx="2" className="wms-motion-package__barcode" />
        </g>
      ))}
      <g className="wms-motion-conveyor-gate">
        <path d="M980 250V360" />
        <path d="M1020 250V360" />
        <rect x="972" y="236" width="56" height="18" rx="4" />
      </g>
      <g className="wms-motion-conveyor-signal">
        <circle cx="1050" cy="220" r="26" />
        <path d="M1050 205V222L1062 230" />
      </g>
    </svg>
  );
}

function ForkliftRouteScene(): ReactElement {
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" role="presentation">
      <PremiumAura />
      <TerminalHudFrame />
      <g className="wms-motion-lane">
        <path d="M40 420H1160" />
        <path d="M40 500H1160" />
        {Array.from({ length: 14 }, (_, index) => (
          <path key={index} className="wms-motion-lane__dash" d={`M${70 + index * 80} 460h36`} />
        ))}
      </g>
      <path className="wms-motion-route" d="M40 445H1160" />
      <path className="wms-motion-route-dashes" d="M60 480H1140" />
      <g className="wms-motion-forklift">
        <g className="wms-motion-forklift__pallet">
          <rect x="-118" y="365" width="94" height="18" rx="3" />
          <rect x="-108" y="305" width="74" height="62" rx="5" />
          <path d="M-108 335H-34M-71 305V367" />
        </g>
        <g className="wms-motion-forklift__body">
          <rect x="-4" y="318" width="116" height="76" rx="12" />
          <path d="M20 318V270H72L98 318" />
          <path d="M28 278H66L84 318H28Z" className="wms-motion-forklift__window" />
          <rect x="-24" y="258" width="9" height="128" rx="4" />
          <path d="M-52 376H18" />
          <circle cx="24" cy="402" r="22" className="wms-motion-forklift__wheel" />
          <circle cx="91" cy="402" r="22" className="wms-motion-forklift__wheel" />
          <circle cx="24" cy="402" r="7" className="wms-motion-forklift__hub" />
          <circle cx="91" cy="402" r="7" className="wms-motion-forklift__hub" />
        </g>
      </g>
      <g className="wms-motion-route-marker wms-motion-route-marker--one">
        <circle cx="360" cy="445" r="24" />
        <circle cx="360" cy="445" r="5" className="wms-motion-route-marker__core" />
      </g>
      <g className="wms-motion-route-marker wms-motion-route-marker--two">
        <circle cx="900" cy="445" r="24" />
        <circle cx="900" cy="445" r="5" className="wms-motion-route-marker__core" />
      </g>
      <g className="wms-motion-waypoint">
        <path d="M620 445l16-16 16 16-16 16Z" />
        <path d="M780 445l16-16 16 16-16 16Z" />
      </g>
    </svg>
  );
}

function PickToLightScene(): ReactElement {
  const bays = [
    { x: 180, y: 140, delay: 0 },
    { x: 320, y: 220, delay: 1 },
    { x: 460, y: 160, delay: 2 },
    { x: 600, y: 260, delay: 3 },
    { x: 740, y: 180, delay: 4 },
    { x: 880, y: 240, delay: 5 },
  ];

  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" role="presentation">
      <PremiumAura />
      <TerminalHudFrame />
      <g className="wms-motion-pick-rack">
        <rect x="120" y="100" width="960" height="360" rx="14" />
        <path d="M120 190H1080M120 280H1080M120 370H1080" />
        <path d="M280 100V460M440 100V460M600 100V460M760 100V460M920 100V460" />
      </g>
      <g className="wms-motion-pick-cells">
        {bays.map((bay) => (
          <g
            key={`${bay.x}-${bay.y}`}
            className={`wms-motion-pick-cell wms-motion-pick-cell--${bay.delay + 1}`}
            transform={`translate(${bay.x} ${bay.y})`}
          >
            <rect x="0" y="0" width="88" height="56" rx="8" />
            <circle cx="44" cy="28" r="10" className="wms-motion-pick-cell__lamp" />
            <path d="M18 44H70" className="wms-motion-pick-cell__code" />
          </g>
        ))}
      </g>
      <g className="wms-motion-pick-cursor">
        <circle cx="0" cy="0" r="18" />
        <circle cx="0" cy="0" r="5" className="wms-motion-pick-cursor__core" />
      </g>
      <g className="wms-motion-pick-legend">
        <rect x="140" y="500" width="220" height="40" rx="10" />
        <path d="M160 520H320M160 532H268" />
      </g>
    </svg>
  );
}

function AgvShuttleScene(): ReactElement {
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" role="presentation">
      <PremiumAura />
      <TerminalHudFrame />
      <g className="wms-motion-agv-aisle">
        <path d="M40 200H1160" />
        <path d="M40 400H1160" />
        <path d="M80 300H1120" className="wms-motion-agv-guide" />
        {Array.from({ length: 10 }, (_, index) => (
          <path key={index} className="wms-motion-agv-rack-hint" d={`M${140 + index * 100} 210V390`} />
        ))}
      </g>
      <g className="wms-motion-agv-nodes">
        <circle cx="260" cy="300" r="10" />
        <circle cx="520" cy="300" r="10" />
        <circle cx="780" cy="300" r="10" />
        <circle cx="1040" cy="300" r="10" />
      </g>
      <g className="wms-motion-agv">
        <rect x="-70" y="262" width="140" height="76" rx="14" />
        <rect x="-54" y="276" width="58" height="30" rx="6" className="wms-motion-agv__panel" />
        <rect x="8" y="276" width="42" height="30" rx="6" className="wms-motion-agv__panel" />
        <circle cx="-42" cy="352" r="14" className="wms-motion-agv__wheel" />
        <circle cx="42" cy="352" r="14" className="wms-motion-agv__wheel" />
        <circle cx="-42" cy="352" r="5" className="wms-motion-agv__hub" />
        <circle cx="42" cy="352" r="5" className="wms-motion-agv__hub" />
        <path d="M70 300H110" className="wms-motion-agv__sensor" />
        <circle cx="118" cy="300" r="6" className="wms-motion-agv__beacon" />
      </g>
      <g className="wms-motion-agv wms-motion-agv--two">
        <rect x="-56" y="270" width="112" height="60" rx="12" />
        <rect x="-40" y="282" width="46" height="24" rx="5" className="wms-motion-agv__panel" />
        <circle cx="-30" cy="342" r="12" className="wms-motion-agv__wheel" />
        <circle cx="30" cy="342" r="12" className="wms-motion-agv__wheel" />
        <circle cx="-30" cy="342" r="4" className="wms-motion-agv__hub" />
        <circle cx="30" cy="342" r="4" className="wms-motion-agv__hub" />
        <circle cx="74" cy="300" r="5" className="wms-motion-agv__beacon" />
      </g>
      <g className="wms-motion-scan-pulse wms-motion-scan-pulse--one">
        <circle cx="520" cy="300" r="22" />
        <circle cx="520" cy="300" r="5" className="wms-motion-scan-pulse__core" />
      </g>
      <g className="wms-motion-scan-readout">
        <rect x="140" y="460" width="200" height="40" rx="10" />
        <path d="M160 478H300M160 490H250" />
      </g>
    </svg>
  );
}

function BarcodeScanScene(): ReactElement {
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" role="presentation">
      <PremiumAura />
      <TerminalHudFrame />
      <g className="wms-motion-barcode-stage">
        <rect x="180" y="140" width="520" height="300" rx="16" className="wms-motion-barcode-card" />
        <g className="wms-motion-barcode-stripes">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => (
            <rect
              key={index}
              x={220 + index * 36}
              y="210"
              width={index % 3 === 0 ? 10 : index % 2 === 0 ? 6 : 14}
              height="140"
              rx="2"
            />
          ))}
        </g>
        <path d="M220 380H640" className="wms-motion-barcode-caption" />
      </g>
      <g className="wms-motion-handheld">
        <rect x="780" y="210" width="220" height="150" rx="18" />
        <rect x="808" y="236" width="164" height="78" rx="10" className="wms-motion-handheld__screen" />
        <path d="M840 330H940" />
        <rect x="860" y="150" width="60" height="70" rx="8" className="wms-motion-handheld__nose" />
        <path d="M890 150V110" className="wms-motion-handheld__beam-stem" />
      </g>
      <g className="wms-motion-scan-laser">
        <rect x="300" y="268" width="560" height="4" rx="2" />
        <rect x="300" y="248" width="560" height="44" rx="22" className="wms-motion-scan-laser__halo" />
      </g>
      <g className="wms-motion-scan-pulse wms-motion-scan-pulse--one">
        <circle cx="420" cy="270" r="20" />
        <circle cx="420" cy="270" r="5" className="wms-motion-scan-pulse__core" />
      </g>
      <g className="wms-motion-scan-pulse wms-motion-scan-pulse--two">
        <circle cx="560" cy="270" r="20" />
        <circle cx="560" cy="270" r="5" className="wms-motion-scan-pulse__core" />
      </g>
      <g className="wms-motion-scan-readout">
        <rect x="780" y="400" width="220" height="48" rx="10" />
        <path d="M800 418H960M800 434H900" />
      </g>
    </svg>
  );
}
