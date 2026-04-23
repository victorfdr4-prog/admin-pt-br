import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Link, Search, Shield, User } from 'lucide-react';
import BotaoAuditoriaGlobal from '@/components/BotaoAuditoriaGlobal';
import { ClientService } from '@/services';
import { cn } from '@/utils/cn';

interface SidebarExplorerProps {
  onSelectClient: (clientId: string, clientName: string) => void;
  selectedClientId?: string;
  currentFolderName?: string;
  itemCount: number;
  currentFolderLink?: string;
  onCopyLink?: () => void;
  onManageAccess?: () => void;
  onAuditoriaCompleta?: () => void;
}

export default function SidebarExplorer({
  onSelectClient,
  selectedClientId,
  currentFolderName,
  itemCount,
  currentFolderLink,
  onCopyLink,
  onManageAccess,
  onAuditoriaCompleta,
}: SidebarExplorerProps) {
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const data = await ClientService.getAll();
        setClientes(data || []);
      } catch (error) {
        console.error('Erro ao carregar clientes na sidebar', error);
      } finally {
        setLoading(false);
      }
    };

    void loadClients();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const term = buscaCliente.trim().toLowerCase();
    return clientes.filter((client) => String(client.name || '').toLowerCase().includes(term));
  }, [buscaCliente, clientes]);

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-r border-border/70 bg-background/95">
      <div className="border-b border-border/70 px-4 py-4">
        <div className="page-kicker">
          <span className="page-kicker-dot" />
          Drive
        </div>
        <h2 className="mt-3 text-lg font-bold tracking-tight text-foreground">Clientes</h2>
        <p className="mt-1 text-sm text-muted-foreground">Acesso rápido aos repositórios.</p>
        <div className="mt-4">
          <BotaoAuditoriaGlobal clientes={clientes} onAuditoriaCompleta={onAuditoriaCompleta} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="section-panel p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={14}
            />
            <input
              type="text"
              placeholder="Filtrar cliente..."
              value={buscaCliente}
              onChange={(event) => setBuscaCliente(event.target.value)}
              className="field-control h-10 pl-9"
            />
          </div>
        </div>

        <div className="minimal-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="shimmer h-12 rounded-[18px]" />
              ))}
            </div>
          ) : (
            clientesFiltrados.map((client) => {
              const isActive = client.id === selectedClientId;

              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => onSelectClient(client.id, client.name)}
                  className={cn(
                    'interactive-list-clickable flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left',
                    isActive
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-border/70 bg-white text-foreground hover:border-primary/15'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white">
                      {client.logo_url ? (
                        <img src={client.logo_url} alt={client.name} className="h-full w-full object-cover" />
                      ) : (
                        <User size={14} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{client.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{client.industry || 'Sem segmento'}</p>
                    </div>
                  </div>

                  {isActive ? (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  ) : (
                    <ChevronRight size={12} className="text-muted-foreground/70" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {selectedClientId ? (
          <div className="section-panel space-y-3 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Caminho atual
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {currentFolderName || 'Raiz do cliente'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{itemCount} itens sincronizados</p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={onCopyLink}
                disabled={!currentFolderLink}
                className="btn-primary h-10 w-full disabled:opacity-50"
              >
                <Link size={14} />
                Copiar link
              </button>

              <button
                type="button"
                onClick={onManageAccess}
                disabled={!currentFolderLink}
                className="btn-secondary h-10 w-full disabled:opacity-50"
              >
                <Shield size={14} />
                Abrir pasta
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
