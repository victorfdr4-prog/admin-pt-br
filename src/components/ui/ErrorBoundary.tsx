// @ts-nocheck
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-8 bg-destructive/10 border border-destructive/20 rounded-3xl space-y-4 text-center">
          <div className="p-3 bg-destructive/20 rounded-2xl text-destructive">
            <AlertCircle size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white leading-none">Ops! Algo deu errado aqui.</h3>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              Esse componente encontrou um erro técnico e foi isolado para proteger o resto do painel.
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 px-6 py-2.5 bg-destructive text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
          >
            <RefreshCcw size={14} /> Tentar Reconectar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
