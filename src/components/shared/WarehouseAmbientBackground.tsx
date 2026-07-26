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

function RackScannerScene(): ReactElement {
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" role="presentation">
      <g className="wms-motion-racks">
        {[120, 300, 480, 660, 840, 1020].map((x) => (
          <g key={x} transform={`translate(${x} 120)`}>
            <rect x="0" y="0" width="120" height="320" rx="8" />
            <path d="M0 80H120M0 160H120M0 240H120M40 0V320M80 0V320" />
          </g>
        ))}
      </g>
      <g className="wms-motion-scan-beam">
        <rect x="70" y="278" width="1060" height="3" rx="1.5" />
        <rect x="70" y="260" width="1060" height="40" rx="20" className="wms-motion-scan-beam__halo" />
      </g>
      <g className="wms-motion-scan-pulse wms-motion-scan-pulse--one">
        <circle cx="340" cy="280" r="22" />
        <circle cx="340" cy="280" r="6" className="wms-motion-scan-pulse__core" />
      </g>
      <g className="wms-motion-scan-pulse wms-motion-scan-pulse--two">
        <circle cx="880" cy="280" r="22" />
        <circle cx="880" cy="280" r="6" className="wms-motion-scan-pulse__core" />
      </g>
    </svg>
  );
}

function ConveyorFlowScene(): ReactElement {
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" role="presentation">
      <g className="wms-motion-conveyor">
        <path d="M40 390H1160" />
        <path d="M80 430H1120" />
        {Array.from({ length: 18 }, (_, index) => (
          <circle key={index} cx={100 + index * 58} cy="410" r="14" />
        ))}
      </g>
      {[0, 1, 2].map((index) => (
        <g key={index} className={`wms-motion-package wms-motion-package--${index + 1}`}>
          <rect x="-80" y="300" width="110" height="88" rx="8" />
          <path d="M-80 330H30M-25 300V388" />
          <path d="M-58 349H-4" className="wms-motion-package__label" />
        </g>
      ))}
      <g className="wms-motion-conveyor-signal">
        <circle cx="1050" cy="235" r="26" />
        <path d="M1050 220V237L1062 245" />
      </g>
    </svg>
  );
}

function ForkliftRouteScene(): ReactElement {
  return (
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" role="presentation">
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
    </svg>
  );
}
