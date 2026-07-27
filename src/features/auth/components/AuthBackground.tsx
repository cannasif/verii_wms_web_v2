import loginBg from '@/assets/v3riiwmsloginbg.png';

interface AuthBackgroundProps {
  isActive: boolean;
  isPaused?: boolean;
}

export const AuthBackground = ({ isActive, isPaused = false }: AuthBackgroundProps) => {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-700 ${
        isActive ? 'opacity-100' : 'opacity-0'
      } ${isPaused ? 'wms-bg-paused' : ''}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#070e1f]" />

      <svg
        viewBox="0 0 1024 683"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <image href={loginBg} x="0" y="0" width="1024" height="683" opacity="0.62" preserveAspectRatio="xMidYMid slice" />

        {/* kamyon fari - yanip sonen */}
        <g className="wms-truck-light">
          <circle cx="755" cy="450" r="6" fill="rgba(255, 235, 180, 0.16)" stroke="none" />
          <circle cx="755" cy="450" r="2.5" fill="rgba(255, 244, 205, 0.5)" stroke="none" />
        </g>
      </svg>

      {/* sol: kasvetli gecmis - kara bulut hissi */}
      <div className="wms-storm-gloom absolute inset-0" />

      {/* sag: gunesli gelecek - login kartina dogru suzulen isik */}
      <div className="wms-sunset absolute inset-0" />
      <div className="wms-sunset-beam absolute inset-0" />

      {/* sol bulutlardan simsek - arada belirgin, arada soluk */}
      <div className="wms-lightning absolute inset-0" />

      <div className="wms-bg-photo-tint absolute inset-0" />
      <div className="wms-bg-vignette absolute inset-0" />
    </div>
  );
};
