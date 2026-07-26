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
    <div className="relative min-h-dvh w-full overflow-x-hidden overflow-y-auto bg-[#070d1f] text-white">
      <AuthBackground isActive isPaused />

      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <LanguageSwitcher variant="pill" />
      </div>

      <main className="relative z-10 flex min-h-dvh items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-20 sm:px-6 sm:pt-24">
        <section className="relative w-full max-w-[520px] overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-[#0a132b]/85 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.55),0_0_45px_rgba(14,165,233,0.08)] backdrop-blur-2xl sm:p-9">
          <div className="absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-cyan-300/80 to-transparent" />
          <header className="mb-7 text-center">
            <img
              src={logo}
              alt="V3RII WMS"
              className="mx-auto w-[190px] max-w-[72%] object-contain drop-shadow-[0_10px_24px_rgba(236,72,153,0.12)] sm:w-[220px]"
            />
            <div className="mx-auto mt-5 h-px w-16 bg-linear-to-r from-transparent via-cyan-300/60 to-transparent" />
            <h1 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">{description}</p>
          </header>
          {children}
        </section>
      </main>
    </div>
  );
}
