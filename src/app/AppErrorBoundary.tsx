import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Uygulama ekranı çöktü.', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="grid min-h-dvh place-items-center bg-[#070d1f] p-6 text-white">
        <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1228]/90 p-8 text-center shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">WMS</p>
          <h1 className="mt-3 text-2xl font-semibold">Ekran yüklenemedi</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Sayfa çizilirken bir hata oluştu. Sayfayı yenilemek genellikle yeterli olur.
          </p>
          <p className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left text-xs text-slate-400">
            {this.state.error.message}
          </p>
          <button
            type="button"
            className="mt-6 h-11 rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            onClick={() => window.location.reload()}
          >
            Yeniden dene
          </button>
        </section>
      </main>
    );
  }
}
