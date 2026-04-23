import React, { useEffect, useMemo, useState } from 'react';

interface PortalLoadingProps {
  clientName: string;
  logoUrl?: string | null;
  isReady?: boolean;
  onComplete?: () => void;
}

const LOADING_STEPS = [
  'Sincronizando conteúdos',
  'Carregando calendário de postagem',
  'Preparando painel do cliente',
] as const;

export default function PortalLoading({
  clientName,
  logoUrl,
  isReady = false,
  onComplete,
}: PortalLoadingProps) {
  const [progress, setProgress] = useState(6);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const safeClient = clientName?.trim() || 'Cliente';
    document.title = `Portal ${safeClient} | Cromia Comunicacao`;
  }, [clientName]);

  useEffect(() => {
    if (visibleSteps >= LOADING_STEPS.length) return;
    const timeout = window.setTimeout(() => {
      setVisibleSteps((current) => Math.min(current + 1, LOADING_STEPS.length));
    }, 800 + Math.floor(Math.random() * 401));
    return () => window.clearTimeout(timeout);
  }, [visibleSteps]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) => {
        const softCap = isReady
          ? 100
          : Math.min(92, 30 + visibleSteps * 18 + Math.floor(Math.random() * 8));

        if (current >= softCap) return current;
        const increment = Math.max(1, Math.floor(Math.random() * 7));
        return Math.min(softCap, current + increment);
      });
    }, 140);

    return () => window.clearInterval(timer);
  }, [isReady, visibleSteps]);

  useEffect(() => {
    if (!isReady || progress < 100 || completed) return;
    setCompleted(true);
    const timeout = window.setTimeout(() => {
      onComplete?.();
    }, 420);
    return () => window.clearTimeout(timeout);
  }, [isReady, progress, completed, onComplete]);

  const blockBar = useMemo(() => {
    const totalBlocks = 20;
    const filled = Math.round((progress / 100) * totalBlocks);
    return `${'█'.repeat(filled)}${'░'.repeat(totalBlocks - filled)}`;
  }, [progress]);

  const safeClientName = clientName?.trim() || 'Cliente';

  return (
    <div className="min-h-screen w-full bg-[#f5f6f8] flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-[0_12px_34px_rgba(15,23,42,0.08)] border border-slate-200/80 p-8 sm:p-10">
        <header className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo Cromia" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-xl font-semibold text-slate-700">C</span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-500">Portal do Cliente</p>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">{safeClientName}</h1>
        </header>

        <main className="mt-8 space-y-5">
          <p className="text-center text-[15px] font-medium text-slate-700">
            Carregando seu ambiente estratégico...
          </p>

          <div className="space-y-2">
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span className="font-mono tracking-tight">[{blockBar}]</span>
              <span>{progress}%</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 space-y-2.5">
            {LOADING_STEPS.map((step, index) => {
              const isVisible = index < visibleSteps;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-2.5 text-sm ${
                    isVisible ? 'text-green-600' : 'text-slate-400'
                  }`}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: `translateY(${isVisible ? 0 : 10}px)`,
                    transition: 'opacity 300ms ease, transform 300ms ease',
                  }}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                      isVisible ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {isVisible ? '✔' : '•'}
                  </span>
                  <span className="font-medium">{step}</span>
                </div>
              );
            })}
          </div>
        </main>

        <footer className="mt-8 text-center text-xs text-slate-400 font-medium">
          Cromia Comunicação 360º • Cliente: {safeClientName}
        </footer>
      </div>
    </div>
  );
}
