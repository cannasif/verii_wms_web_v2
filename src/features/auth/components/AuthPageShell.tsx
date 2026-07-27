import type { ReactElement, ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import logo from '@/assets/v3riiwms.png';
import { AuthBackground } from './AuthBackground';

interface AuthPageShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthPageShell({ title, description, children }: AuthPageShellProps): ReactElement {
  return (
    <div data-wms-auth-surface="true" className="relative min-h-dvh w-full overflow-x-hidden overflow-y-auto bg-[#070d1f] text-white">
      <style>{`
        input { color-scheme: dark; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-text-fill-color: #fff !important;
          caret-color: #fff !important;
          background-color: #0b1228 !important;
          background-image: none !important;
          transition: background-color 99999s ease-out 0s !important;
          -webkit-box-shadow: 0 0 0 40px #0b1228 inset !important;
          box-shadow: 0 0 0 40px #0b1228 inset !important;
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity duration-1000 opacity-100">
        <div className="absolute left-[-12%] top-[-12%] h-[58vw] max-h-[520px] w-[58vw] max-w-[520px] rounded-full bg-cyan-900/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[58vw] max-h-[520px] w-[58vw] max-w-[520px] rounded-full bg-blue-900/20 blur-[120px] mix-blend-screen" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-[#070d1f]/60 to-[#070d1f]" />
      </div>

      <AuthBackground isActive isPaused />

      <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
        <LanguageSwitcher variant="pill" />
      </div>

      <div className="relative z-10 mx-auto box-border flex min-h-dvh w-full flex-col items-center justify-center px-4 py-8">
        <section className="w-full max-w-[480px] min-w-0 overflow-hidden rounded-3xl border border-sky-400/15 bg-[#0b1228]/70 shadow-[0_0_24px_2px_rgba(56,132,246,0.10),inset_0_0_14px_1px_rgba(96,150,255,0.05),0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="relative overflow-hidden px-6 pb-16 pt-12 sm:px-10">
            <header className="relative z-10 mb-8 text-center">
              <div className="mx-auto mb-4 flex justify-center">
                <img src={logo} alt="V3RII WMS" className="h-32 w-auto object-contain" />
              </div>
              <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">{title}</h1>
              <p className="text-sm text-slate-400">{description}</p>
            </header>
            <div className="relative z-10">{children}</div>
          </div>
        </section>

        <div className="mt-6 flex justify-center sm:hidden">
          <LanguageSwitcher variant="pill" />
        </div>
      </div>
    </div>
  );
}
