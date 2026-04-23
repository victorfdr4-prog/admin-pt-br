/**
 * DocumentEditorPage V2
 * Left: variáveis (data picker, cliente dropdown, seções, rodapé)
 * Right: ProposalTemplate A4 preview (live)
 * Actions: auto-save, export PDF (html2canvas), upload Drive
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Download, Upload, ExternalLink, Copy, Check,
  Loader2, Plus, Trash2, GripVertical, ChevronDown, Image,
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useQuery } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { generateProposalHtml } from '@/lib/generateProposalHtml';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import { ClientService } from '@/services';
import { DocService } from '@/services/doc.service';
import { useDocument, useUpdateDocument } from '@/hooks/useDocuments';
import { useAuthStore } from '@/store/useAuthStore';
import {
  ProposalTemplate,
  DEFAULT_PROPOSAL_CONTENT,
  type ProposalTemplateData,
  type TemplateSection,
  type TemplateVars,
  normalizeSectionContent,
} from '@/components/docs/ProposalTemplate';
import { DocEditor } from '@/components/docs/DocEditor';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converte "YYYY-MM-DD" → "11 de abril de 2026" */
function dateToFull(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

/** Hoje em YYYY-MM-DD */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Section editor accordion ──────────────────────────────────────────────────

const SectionEditorRow: React.FC<{
  section: TemplateSection;
  index: number;
  onChange: (id: string, patch: Partial<TemplateSection>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}> = ({ section, index, onChange, onDelete, onDuplicate, onMoveUp, onMoveDown }) => {
  const [open, setOpen] = useState(index === 0);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-border overflow-hidden bg-background">
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground/40 hover:text-foreground hover:bg-muted/60"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5 shrink-0" />
        </button>
        <span className="text-xs font-mono text-primary/80 w-6 shrink-0">{section.number ?? `${index + 1}.`}</span>
        <span className="text-sm font-semibold flex-1 truncate">{section.title || 'Sem título'}</span>
        <div className="flex items-center gap-0.5 ml-auto" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onMoveUp(section.id)} className="p-1 rounded hover:bg-muted text-muted-foreground text-xs font-bold">↑</button>
          <button onClick={() => onMoveDown(section.id)} className="p-1 rounded hover:bg-muted text-muted-foreground text-xs font-bold">↓</button>
          <button onClick={() => onDuplicate(section.id)} className="p-1 rounded hover:bg-muted text-muted-foreground text-xs font-bold" title="Duplicar">
            ⧉
          </button>
          <button onClick={() => onDelete(section.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="size-3.5" />
          </button>
        </div>
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform shrink-0', !open && '-rotate-90')} />
      </div>

      {open && (
        <div className="p-3 space-y-2.5 bg-background">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">Nº</label>
              <input
                value={section.number ?? ''}
                onChange={(e) => onChange(section.id, { number: e.target.value || undefined })}
                placeholder="1."
                className="w-full rounded-lg border border-border px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground font-semibold block mb-1">TÍTULO</label>
              <input
                value={section.title}
                onChange={(e) => onChange(section.id, { title: e.target.value })}
                placeholder="Título da seção"
                className="w-full rounded-lg border border-border px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-semibold block mb-1.5">CONTEÚDO</label>
            <DocEditor
              content={section.content}
              onChange={(content) => onChange(section.id, { content })}
              placeholder="Escreva o conteúdo desta seção…"
              className="min-h-[140px]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Field helpers ─────────────────────────────────────────────────────────────

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-xs text-muted-foreground font-semibold block mb-1 tracking-wide">
    {children}
  </label>
);

const FieldInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className="w-full rounded-lg border border-border px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
  />
);

// ── Vars padrão ───────────────────────────────────────────────────────────────

const DEFAULT_VARS: Required<Omit<TemplateVars, 'logoUrl'>> & { logoUrl: null } = {
  date:       dateToFull(todayIso()),
  clientName: '',
  docType:    'PROPOSTA DE SERVIÇOS',
  logoUrl:    null,
  phone1:     '+55 47 99705-3732',
  phone2:     '',
  website:    'CromiaComunicação.com',
  email:      'contato@cromiacomunicacao.com',
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  const { data: doc, isLoading } = useDocument(id ?? null);
  const updateDoc = useUpdateDocument();

  // Clientes cadastrados para o dropdown
  const { data: clientsRaw = [] } = useQuery({
    queryKey: ['clients', 'list'],
    queryFn: () => ClientService.getAll(),
    staleTime: 60_000,
  });
  const clients = (clientsRaw as Record<string, unknown>[]).map((c) => ({
    id: String(c.id ?? ''),
    name: String(c.name ?? ''),
  }));

  // ── State ──────────────────────────────────────────────────────────────────
  const [sections, setSections] = useState<TemplateSection[]>(DEFAULT_PROPOSAL_CONTENT);
  const [vars, setVars]         = useState<TemplateVars>(DEFAULT_VARS);
  const [dateIso, setDateIso]   = useState(todayIso());   // YYYY-MM-DD para o input date
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [saved, setSaved]       = useState(true);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied]     = useState(false);

  // Refs para evitar stale closures nos timers
  const sectionsRef  = useRef(sections);
  const varsRef      = useRef(vars);
  const driveLinkRef = useRef(driveLink);
  useLayoutEffect(() => { sectionsRef.current  = sections;  }, [sections]);
  useLayoutEffect(() => { varsRef.current      = vars;      }, [vars]);
  useLayoutEffect(() => { driveLinkRef.current = driveLink; }, [driveLink]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureRef    = useRef<HTMLDivElement>(null);   // div UNSCALED para html2canvas
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const sanitizeSections = useCallback((items: TemplateSection[]) => (
    items.map((section, index) => ({
      ...section,
      id: String(section.id || crypto.randomUUID()),
      number: section.number || `${index + 1}.`,
      title: section.title || 'Nova Seção',
      content: normalizeSectionContent(section),
      meta: section.meta ? { ...section.meta } : undefined,
    }))
  ), []);

  // Cleanup no unmount
  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  // ── Carregar estado persistido ─────────────────────────────────────────────
  useEffect(() => {
    if (!doc) return;
    const p = doc.variables as Record<string, unknown>;
    if (Array.isArray(p?.sections)) {
      setSections(
        p.sections.map((section, index) => {
          const raw = section as Partial<TemplateSection> & { htmlContent?: string; content?: unknown };
          return {
            id: String(raw.id ?? crypto.randomUUID()),
            number: raw.number ?? `${index + 1}.`,
            title: raw.title ?? 'Nova Seção',
            content: normalizeSectionContent(raw),
            meta: raw.meta ?? undefined,
          };
        }),
      );
    }
    if (p?.vars && typeof p.vars === 'object') {
      // Merge com DEFAULT_VARS para garantir que campos opcionais nunca sejam undefined
      const loaded = p.vars as Partial<TemplateVars>;
      setVars({
        ...DEFAULT_VARS,
        ...Object.fromEntries(
          Object.entries(loaded).filter(([, v]) => v !== undefined && v !== null)
        ),
      } as TemplateVars);
    }
    if (typeof p?.dateIso === 'string') setDateIso(p.dateIso);
    if (typeof p?.driveLink === 'string') setDriveLink(p.driveLink);
  }, [doc?.id]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const triggerSave = useCallback(() => {
    setSaved(false);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (!id) return;
      updateDoc.mutate({
        id,
        patch: {
          variables: {
            sections: sanitizeSections(sectionsRef.current),
            vars: varsRef.current,
            dateIso,
            driveLink: driveLinkRef.current,
          },
          updated_at: new Date().toISOString(),
        },
      });
      setSaved(true);
    }, 1500);
  }, [id, dateIso, updateDoc]);

  // ── Variáveis ──────────────────────────────────────────────────────────────
  const setVar = useCallback(<K extends keyof TemplateVars>(key: K, value: TemplateVars[K]) => {
    setVars((prev) => ({ ...prev, [key]: value }));
    triggerSave();
  }, [triggerSave]);

  // Date picker: atualiza iso + converte para texto por extenso
  const handleDateChange = (iso: string) => {
    setDateIso(iso);
    const full = dateToFull(iso);
    setVars((prev) => ({ ...prev, date: full }));
    triggerSave();
  };

  // Cliente dropdown: preenche clientName
  const handleClientSelect = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) setVar('clientName', client.name);
  };

  // ── Seções ─────────────────────────────────────────────────────────────────
  const updateSection = useCallback((secId: string, patch: Partial<TemplateSection>) => {
    setSections((prev) => prev.map((s) => s.id === secId ? { ...s, ...patch } : s));
    triggerSave();
  }, [triggerSave]);

  const duplicateSection = useCallback((secId: string) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === secId);
      if (idx < 0) return prev;
      const source = prev[idx];
      if (!source) return prev;
      const copy: TemplateSection = {
        ...source,
        id: crypto.randomUUID(),
        number: `${prev.length + 1}.`,
        title: `${source.title} (cópia)`,
        content: JSON.parse(JSON.stringify(source.content)) as TemplateSection['content'],
      };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
    triggerSave();
  }, [triggerSave]);

  const deleteSection = useCallback((secId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== secId));
    triggerSave();
  }, [triggerSave]);

  const moveSection = useCallback((secId: string, dir: 'up' | 'down') => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === secId);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    triggerSave();
  }, [triggerSave]);

  const addSection = useCallback(() => {
    setSections((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        number: `${prev.length + 1}.`,
        title: 'Nova Seção',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Conteúdo da seção.' }] }],
        },
      },
    ]);
    triggerSave();
  }, [triggerSave]);

  const handleSectionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = (arrayMove(prev, oldIndex, newIndex) as TemplateSection[]).map((item, index) => ({
        ...item,
        number: `${index + 1}.`,
      }));
      return next;
    });
    triggerSave();
  }, [triggerSave]);

  // ── Logo upload ────────────────────────────────────────────────────────────
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setVar('logoUrl', ev.target?.result as string ?? null);
    reader.readAsDataURL(file);
  };

  // ── Captura PDF (usa UNSCALED captureRef) ─────────────────────────────────
  const waitForPreviewAssets = async (root: HTMLElement) => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }));
  };

  const capturePdf = async (): Promise<jsPDF> => {
    const el = captureRef.current;
    if (!el) throw new Error('Visualização não encontrada');
    await waitForPreviewAssets(el);
    const pages = Array.from(el.querySelectorAll<HTMLElement>('[data-doc-page]'));
    const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const targets = pages.length > 0 ? pages : [el];
    for (let i = 0; i < targets.length; i++) {
      const canvas = await html2canvas(targets[i], { scale: 2, useCORS: true, backgroundColor: '#fff', logging: false });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
    }
    return pdf;
  };

  // ── Exportar PDF via motor nativo do browser (Chromium = Puppeteer) ─────────
  const handleExportPdf = () => {
    try {
      setExporting(true);
      const html = generateProposalHtml(
        { vars: varsRef.current, sections: sectionsRef.current },
        doc?.title ?? 'Proposta',
      );
      const win = window.open('', '_blank');
      if (!win) {
        toast.error('Bloqueio de popup detectado. Libere popups para este site.');
        return;
      }
      win.document.write(html);
      win.document.close();
      if (id) updateDoc.mutate({ id, patch: { status: 'generated', pdf_generated_at: new Date().toISOString() } });
      toast.success('Janela de impressão aberta — salve como PDF.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleUploadDrive = async () => {
    if (!doc?.drive_folder_id) { toast.error('Nenhuma pasta do Drive configurada'); return; }
    if (!token) { toast.error('Sessão expirada'); return; }
    try {
      setUploading(true);
      toast('Enviando ao Drive…');
      const pdf = await capturePdf();
      const blob = pdf.output('blob');
      const name = DocService.buildVersionedFileName(`${doc.title ?? 'Proposta'}.pdf`, doc.version ?? 1);
      const result = await DocService.uploadToDrive(id!, blob, name, doc.drive_folder_id, token, doc.drive_file_id);
      setDriveLink(result.webViewLink);
      updateDoc.mutate({
        id: id!,
        patch: {
          variables: {
            sections: sanitizeSections(sectionsRef.current),
            vars: varsRef.current,
            driveLink: result.webViewLink,
          },
        },
      });
      toast.success('Enviado ao Drive!');
    } catch (e: unknown) { console.error(e); toast.error((e as Error).message ?? 'Erro'); }
    finally { setUploading(false); }
  };

  const templateData: ProposalTemplateData = { vars, sections };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-muted/20">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background shrink-0 flex-wrap gap-y-2">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{doc?.title ?? 'Editor de Documento'}</p>
          <p className="text-xs text-muted-foreground">{saved ? '✓ Salvo automaticamente' : '● Salvando…'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {driveLink && (
            <>
              <a href={driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                <ExternalLink className="size-3" /> Abrir no Drive
              </a>
              <button onClick={() => { navigator.clipboard.writeText(driveLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              </button>
            </>
          )}
          <button onClick={handleUploadDrive} disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-100 disabled:opacity-50">
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Drive
          </button>
          <button onClick={handleExportPdf} disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Exportar PDF
          </button>
        </div>
      </div>

      {/* ── Split view ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ── */}
        <div className="w-[340px] shrink-0 border-r border-border bg-background overflow-y-auto flex flex-col">

          {/* Bloco: variáveis principais */}
          <div className="p-4 border-b border-border space-y-3">
            <p className="text-xs font-bold text-muted-foreground tracking-wider">DOCUMENTO</p>

            {/* LOGO */}
            <div>
              <FieldLabel>LOGO</FieldLabel>
              {vars.logoUrl ? (
                <div className="flex items-center gap-2">
                  <img src={vars.logoUrl} alt="Logo" className="h-10 w-auto rounded border border-border object-contain" />
                  <button onClick={() => setVar('logoUrl', null)} className="text-xs text-muted-foreground hover:text-destructive underline">Remover</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground cursor-pointer transition-colors">
                  <Image className="size-4" /> Carregar logo
                  <input type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} />
                </label>
              )}
            </div>

            {/* DATA */}
            <div>
              <FieldLabel>DATA</FieldLabel>
              <input
                type="date"
                value={dateIso}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full rounded-lg border border-border px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {vars.date && (
                <p className="text-xs text-muted-foreground mt-1">{vars.date}</p>
              )}
            </div>

            {/* CLIENTE — dropdown */}
            <div>
              <FieldLabel>CLIENTE</FieldLabel>
              <select
                value={clients.find((c) => c.name === vars.clientName)?.id ?? ''}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full rounded-lg border border-border px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Selecionar cliente —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {/* Campo livre para digitar se não estiver na lista */}
              <input
                value={vars.clientName}
                onChange={(e) => setVar('clientName', e.target.value)}
                placeholder="Ou digite o nome manualmente"
                className="mt-1.5 w-full rounded-lg border border-border px-2.5 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* TIPO */}
            <div>
              <FieldLabel>TIPO DO DOCUMENTO</FieldLabel>
              <FieldInput
                value={vars.docType}
                onChange={(e) => setVar('docType', e.target.value)}
                placeholder="PROPOSTA DE SERVIÇOS"
              />
            </div>
          </div>

          {/* Bloco: seções */}
          <div className="p-4 flex-1 space-y-2 border-b border-border">
            <p className="text-xs font-bold text-muted-foreground tracking-wider mb-3">SEÇÕES</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {sections.map((s, i) => (
                    <SectionEditorRow
                      key={s.id}
                      section={s}
                      index={i}
                      onChange={updateSection}
                      onDelete={deleteSection}
                      onDuplicate={duplicateSection}
                      onMoveUp={(sid) => moveSection(sid, 'up')}
                      onMoveDown={(sid) => moveSection(sid, 'down')}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button
              onClick={addSection}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
            >
              <Plus className="size-4" /> Adicionar seção
            </button>
          </div>

          {/* Bloco: rodapé — fica no final */}
          <div className="p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground tracking-wider">RODAPÉ</p>
            {([
              { key: 'phone1' as const, label: 'TELEFONE 1', placeholder: '+55 47 99705-3732' },
              { key: 'phone2' as const, label: 'TELEFONE 2', placeholder: '(opcional)' },
              { key: 'website' as const, label: 'SITE', placeholder: 'CromiaComunicação.com' },
              { key: 'email' as const, label: 'E-MAIL', placeholder: 'contato@cromiacomunicacao.com' },
            ] as { key: keyof TemplateVars; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <FieldInput
                  value={(vars[key] as string | undefined | null) ?? ''}
                  onChange={(e) => setVar(key, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel: preview A4 ── */}
        <div className="flex-1 overflow-auto bg-slate-200 flex flex-col items-center py-8 px-4">
          <p className="mb-5 text-xs text-slate-500 font-medium">Visualização A4 — o PDF exportado será idêntico a este layout</p>

          {/*
            Scale visual: puramente cosmético, FORA do captureRef.
            captureRef aponta para o div de 794px real → html2canvas captura em resolução total.
          */}
          <div style={{ transform: 'scale(0.78)', transformOrigin: 'top center', marginBottom: `${1123 * (0.78 - 1)}px` }}>
            <div ref={captureRef}>
              <ProposalTemplate data={templateData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
