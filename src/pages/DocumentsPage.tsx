import React, { useState, useMemo } from 'react';
import {
  FileText, Plus, Download, ExternalLink, Trash2, Clock, CheckCircle,
  Send, Archive, Search, Loader2, X, Copy, Check, PenLine
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import { ClientService } from '@/services';
import { useDocuments, useCreateDocument, useDeleteDocument } from '@/hooks/useDocuments';
import type { DocDocument } from '@/services/doc.service';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocDocument['status'], { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: 'Rascunho',  color: 'bg-slate-100 text-slate-600',    icon: Clock },
  generated: { label: 'Gerado',    color: 'bg-blue-50 text-blue-700',       icon: CheckCircle },
  sent:      { label: 'Enviado',   color: 'bg-amber-50 text-amber-700',     icon: Send },
  signed:    { label: 'Assinado',  color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle },
  archived:  { label: 'Arquivado', color: 'bg-gray-100 text-gray-500',      icon: Archive },
};

// ─── New Document Modal ───────────────────────────────────────────────────────

interface NewDocModalProps {
  clients: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (doc: DocDocument) => void;
}

const NewDocModal: React.FC<NewDocModalProps> = ({ clients, onClose, onCreated }) => {
  const createDoc = useCreateDocument();
  const [title, setTitle] = useState(`Proposta - ${new Date().toLocaleDateString('pt-BR')}`);
  const [clientId, setClientId] = useState('');
  const [folderId, setFolderId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === clientId);
    const doc = await createDoc.mutateAsync({
      template_id: null,
      client_id: clientId || null,
      title,
      variables: { vars: { clientName: client?.name ?? '' }, sections: [] },
      drive_folder_id: folderId || null,
    });
    onCreated(doc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="w-full max-w-md bg-background rounded-2xl border border-border shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-bold">NOVO DOCUMENTO</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">TÍTULO</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">CLIENTE (opcional)</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Selecionar cliente —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              PASTA DO GOOGLE DRIVE (ID, opcional)
            </label>
            <input
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim() || createDoc.isPending}
              className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {createDoc.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Criar e abrir editor
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ─── Document Row ─────────────────────────────────────────────────────────────

const DocRow: React.FC<{
  doc: DocDocument;
  onDelete: (id: string) => void;
}> = ({ doc, onDelete }) => {
  const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = cfg.icon;
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const copyLink = () => {
    if (!doc.drive_web_view_link) return;
    navigator.clipboard.writeText(doc.drive_web_view_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <tr className="group border-b border-border/50 hover:bg-muted/20 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <FileText className="size-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">{doc.title}</p>
            {doc.template_name && (
              <p className="text-xs text-muted-foreground">{doc.template_name}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-3 hidden sm:table-cell">
        <span className="text-sm text-muted-foreground">{doc.client_name ?? '—'}</span>
      </td>
      <td className="py-3 px-3">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', cfg.color)}>
          <StatusIcon className="size-3" />
          {cfg.label}
        </span>
      </td>
      <td className="py-3 px-3 hidden md:table-cell">
        <span className="text-xs text-muted-foreground">
          {new Date(doc.created_at).toLocaleDateString('pt-BR')}
        </span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => navigate(`/documents/${doc.id}/edit`)}
            title="Abrir editor"
            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
          >
            <PenLine className="size-3.5" />
          </button>

          {doc.drive_web_view_link && (
            <>
              <a
                href={doc.drive_web_view_link}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir no Drive"
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3.5" />
              </a>
              <button onClick={copyLink} title="Copiar link" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              </button>
            </>
          )}

          {doc.drive_download_link && (
            <a
              href={doc.drive_download_link}
              download
              title="Download"
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <Download className="size-3.5" />
            </a>
          )}

          <button
            onClick={() => { if (confirm('Excluir documento?')) onDelete(doc.id); }}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { data: documents = [], isLoading } = useDocuments();
  const deleteDoc = useDeleteDocument();

  const { data: clientsRaw = [] } = useQuery({
    queryKey: ['clients', 'list'],
    queryFn: () => ClientService.getAll(),
    staleTime: 60_000,
  });

  const clients = (clientsRaw as Record<string, unknown>[]).map((c) => ({
    id: String(c.id ?? ''),
    name: String(c.name ?? ''),
  }));

  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() =>
    documents.filter((d) =>
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.client_name ?? '').toLowerCase().includes(search.toLowerCase())
    ),
    [documents, search]
  );

  return (
    <div className="flex min-h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileText className="size-5 text-primary" /> Documentos
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Modelos, propostas, contratos e relatórios usados na operação da agência.
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" /> Novo documento
          </button>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="rounded-lg border border-border pl-8 pr-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
            <FileText className="size-10 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              {search ? 'Nenhum documento encontrado.' : 'Nenhum documento criado ainda.'}
            </p>
            {!search && (
              <button
                onClick={() => setShowNew(true)}
                className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
              >
                Criar primeiro documento
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-muted-foreground">DOCUMENTO</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">CLIENTE</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground">STATUS</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">DATA</th>
                  <th className="py-2.5 px-3 w-32" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    onDelete={(id) => deleteDoc.mutate(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showNew && (
          <NewDocModal
            clients={clients}
            onClose={() => setShowNew(false)}
            onCreated={(doc) => navigate(`/documents/${doc.id}/edit`)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
