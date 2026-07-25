interface WmsBackgroundAnimationProps {
  isPaused?: boolean;
}

export function WmsBackgroundAnimation({ isPaused = false }: WmsBackgroundAnimationProps) {
  return (
    <div
      aria-hidden="true"
      className={`wms-forklift-wrap pointer-events-none select-none ${isPaused ? 'wms-forklift-paused' : ''}`}
    >
      <svg viewBox="0 0 160 100" className="h-full w-full" role="presentation">
        <defs>
          <linearGradient id="wmsForkliftStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.6)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.5)" />
          </linearGradient>
          <filter id="wmsForkliftGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="wms-forklift-pallet">
          <rect x="18" y="72" width="44" height="14" rx="2" className="wms-pallet-base" />
          <rect x="22" y="56" width="36" height="18" rx="2" className="wms-pallet-crate" />
        </g>
        <g className="wms-forklift-chassis">
          <rect x="88" y="48" width="52" height="42" rx="4" className="wms-forklift-body" />
          <rect x="92" y="50" width="24" height="16" rx="2" className="wms-forklift-cab" />
          <circle cx="98" cy="92" r="6" className="wms-forklift-wheel" />
          <circle cx="130" cy="92" r="6" className="wms-forklift-wheel" />
          <rect x="96" y="38" width="5" height="22" rx="1" className="wms-forklift-mast" />
          <rect x="126" y="38" width="5" height="22" rx="1" className="wms-forklift-mast" />
          <rect x="78" y="54" width="28" height="4" rx="1" className="wms-forklift-forks" />
        </g>
      </svg>
    </div>
  );
}
