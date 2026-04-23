import React from 'react';
import { Link } from 'react-router-dom';

export const NotFound: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="surface-card max-w-md space-y-4 p-10 text-center">
        <div className="page-kicker justify-center">
          <span className="page-kicker-dot" />
          Navegação
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          O endereço acessado não existe neste painel. Volte para uma área válida sem sair do `/admin`.
        </p>
        <Link to="/dashboard" className="btn-primary">
          Ir para o painel operacional
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
