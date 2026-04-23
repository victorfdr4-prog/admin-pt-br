import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { ClientService } from '@/services/client.service';
import { SystemLogService, type SystemLogRecord } from '@/services/system-log.service';

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState('');
  const [scope, setScope] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const [rows, clientRows] = await Promise.all([
        SystemLogService.list({
          clientId: clientId || undefined,
          scope: scope === 'all' ? undefined : scope,
          from: fromDate ? `${fromDate}T00:00:00` : undefined,
          to: toDate ? `${toDate}T23:59:59` : undefined,
          limit: 300,
        }),
        ClientService.getAll(),
      ]);

      setLogs(rows);
      setClients((clientRows || []).map((row: any) => ({ id: String(row.id), name: String(row.name || 'Cliente') })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [clientId, scope, fromDate, toDate]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const query = search.toLowerCase();
    return logs.filter((log) =>
      [log.scope, log.action, log.message, log.error, log.table_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [logs, search]);

  const clientNameById = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const availableScopes = useMemo(() => Array.from(new Set(logs.map((log) => log.scope))).sort(), [logs]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Observabilidade</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Logs do sistema</h1>
          <p className="mt-2 text-sm text-slate-500">Rastreie ações, consultas vazias e erros por cliente.</p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <RefreshCw size={15} />
          Atualizar logs
        </button>
      </div>

      <div className="mb-6 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.2fr_0.9fr_0.8fr_0.7fr_0.7fr]">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por ação, escopo, erro ou tabela"
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>

        <select
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        >
          <option value="">Todos os clientes</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>

        <select
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        >
          <option value="all">Todos os escopos</option>
          {availableScopes.map((scopeOption) => (
            <option key={scopeOption} value={scopeOption}>
              {scopeOption}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />

        <input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[0.8fr_0.9fr_0.9fr_1.2fr_1fr_1.1fr] gap-3 border-b border-slate-200 px-5 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
          <span>Quando</span>
          <span>Escopo</span>
          <span>Ação</span>
          <span>Mensagem</span>
          <span>Cliente</span>
          <span>Status</span>
        </div>

        <div className="max-h-[72vh] overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">Carregando logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">Nenhum log encontrado.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="grid grid-cols-[0.8fr_0.9fr_0.9fr_1.2fr_1fr_1.1fr] gap-3 border-b border-slate-100 px-5 py-4 text-sm text-slate-700">
                <span>{format(new Date(log.created_at), 'dd/MM HH:mm:ss')}</span>
                <span className="font-medium text-slate-900">{log.scope}</span>
                <span>{log.action}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{log.message || 'Sem mensagem'}</p>
                  {log.table_name ? <p className="mt-1 truncate text-xs text-slate-500">Tabela: {log.table_name}</p> : null}
                </div>
                <span>{log.client_id ? clientNameById.get(log.client_id) || log.client_id : '—'}</span>
                <div>
                  {log.error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      <div className="mb-1 flex items-center gap-2 font-semibold">
                        <AlertTriangle size={13} />
                        Erro
                      </div>
                      <p className="line-clamp-2">{log.error}</p>
                    </div>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      OK
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
