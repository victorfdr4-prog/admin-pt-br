import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocVariable {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'currency' | 'number';
  required?: boolean;
  auto?: boolean;
  default?: string;
}

export interface DocBlock {
  id: string;
  type:
    | 'header'
    | 'intro'
    | 'services'
    | 'timeline'
    | 'investment'
    | 'conditions'
    | 'signature'
    | 'text_block'
    | 'parties'
    | 'metrics';
  title: string;
  content?: string;
  locked?: boolean;
}

export interface DocTemplate {
  id: string;
  name: string;
  description: string | null;
  category: 'proposal' | 'contract' | 'report' | 'brief' | 'invoice' | 'onboarding' | 'custom';
  icon: string;
  color: string;
  blocks: DocBlock[];
  variables: DocVariable[];
  default_values: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DocDocument {
  id: string;
  template_id: string | null;
  client_id: string | null;
  board_id: string | null;
  title: string;
  status: 'draft' | 'generated' | 'sent' | 'signed' | 'archived';
  variables: Record<string, unknown>;
  rendered_blocks: DocBlock[] | null;
  version: number;
  drive_file_id: string | null;
  drive_web_view_link: string | null;
  drive_download_link: string | null;
  drive_folder_id: string | null;
  pdf_generated_at: string | null;
  sent_at: string | null;
  signed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  client_name?: string | null;
  template_name?: string | null;
}

export interface CreateDocPayload {
  template_id?: string | null;
  client_id?: string | null;
  board_id?: string | null;
  title: string;
  variables: Record<string, unknown>;
  drive_folder_id?: string | null;
}

export interface GeneratePdfResult {
  blob: Blob;
  fileName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function formatCurrency(val: string): string {
  const num = parseFloat(val.replace(/[^\d.,]/g, '').replace(',', '.'));
  if (isNaN(num)) return val;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

function today(): string {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

export function generatePdf(
  template: DocTemplate,
  vars: Record<string, string>,
  tasks: { title: string; due_date: string | null; status: string; channel?: string | null }[] = []
): GeneratePdfResult {
  // Auto-fill system variables
  const allVars: Record<string, string> = {
    current_date: today(),
    agency_name: 'Cromia',
    services_list: tasks.map((t) => `• ${t.title}`).join('\n') || vars.services_list || '',
    ...vars,
  };

  // Format currency values
  template.variables.forEach((v) => {
    if (v.type === 'currency' && allVars[v.key]) {
      allVars[v.key] = formatCurrency(allVars[v.key]);
    }
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 0;

  const addPage = () => {
    doc.addPage();
    y = 20;
  };

  const checkSpace = (needed: number) => {
    if (y + needed > pageH - 20) addPage();
  };

  // ── Header block ─────────────────────────────────────────────────────────
  const renderHeader = () => {
    // Brand bar
    doc.setFillColor(99, 102, 241); // indigo-500
    doc.rect(0, 0, pageW, 18, 'F');

    // Agency name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(interpolate('{{agency_name}}', allVars), marginL, 12);

    // Document category label (right side)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const catLabel = template.category.toUpperCase();
    doc.text(catLabel, pageW - marginR, 12, { align: 'right' });

    y = 28;

    // Client name large
    if (allVars.client_name) {
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(interpolate('{{client_name}}', allVars), marginL, y);
      y += 9;
    }

    // Document title
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(99, 102, 241);
    const docTitle = interpolate(allVars.project_name || template.name, allVars);
    doc.text(docTitle, marginL, y);
    y += 6;

    // Date line
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(interpolate('{{current_date}}', allVars), marginL, y);
    y += 10;

    // Divider
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(marginL, y, pageW - marginR, y);
    y += 8;
  };

  // ── Section heading ───────────────────────────────────────────────────────
  const renderSectionTitle = (title: string) => {
    checkSpace(14);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.text(title.toUpperCase(), marginL, y);
    y += 2;
    doc.setDrawColor(199, 210, 254);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, pageW - marginR, y);
    y += 6;
    doc.setTextColor(17, 24, 39);
  };

  // ── Text content ──────────────────────────────────────────────────────────
  const renderText = (text: string, fontSize = 10) => {
    const interpolated = interpolate(text, allVars);
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const lines = doc.splitTextToSize(interpolated, contentW);
    lines.forEach((line: string) => {
      checkSpace(6);
      doc.text(line, marginL, y);
      y += 5.5;
    });
    y += 3;
  };

  // ── Services block ────────────────────────────────────────────────────────
  const renderServices = () => {
    const serviceLines = allVars.services_list
      ? allVars.services_list.split('\n').filter((s) => s.trim())
      : tasks.map((t) => `• ${t.title}`);

    if (serviceLines.length === 0) return;

    serviceLines.forEach((line) => {
      checkSpace(7);
      const clean = line.replace(/^[•\-]\s*/, '');
      // Bullet dot
      doc.setFillColor(99, 102, 241);
      doc.circle(marginL + 1.5, y - 1.5, 1, 'F');
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text(clean, marginL + 6, y);
      y += 6;
    });
    y += 2;
  };

  // ── Timeline block ────────────────────────────────────────────────────────
  const renderTimeline = () => {
    if (tasks.length === 0) {
      renderText('Cronograma a ser definido conforme alinhamento com o cliente.');
      return;
    }

    // Group by month
    const byMonth = new Map<string, typeof tasks>();
    tasks.forEach((t) => {
      const label = t.due_date
        ? new Date(t.due_date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : 'Sem prazo';
      if (!byMonth.has(label)) byMonth.set(label, []);
      byMonth.get(label)!.push(t);
    });

    byMonth.forEach((monthTasks, month) => {
      checkSpace(12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text(month.charAt(0).toUpperCase() + month.slice(1), marginL, y);
      y += 5;

      monthTasks.forEach((t) => {
        checkSpace(7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        const dateStr = t.due_date
          ? new Date(t.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : '—';
        doc.text(dateStr, marginL + 3, y);
        doc.setTextColor(55, 65, 81);
        doc.text(t.title, marginL + 20, y);
        y += 5.5;
      });
      y += 3;
    });
  };

  // ── Investment block ──────────────────────────────────────────────────────
  const renderInvestment = () => {
    checkSpace(20);
    const value = allVars.total_value || '—';
    const schedule = allVars.payment_schedule || '—';

    doc.setFillColor(238, 242, 255);
    doc.roundedRect(marginL, y, contentW, 22, 3, 3, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.text('INVESTIMENTO MENSAL', marginL + 6, y + 8);

    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.text(value, marginL + 6, y + 17);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(schedule, pageW - marginR, y + 17, { align: 'right' });

    y += 28;
  };

  // ── Signature block ───────────────────────────────────────────────────────
  const renderSignature = () => {
    checkSpace(45);
    const sigY = y + 30;

    // Left signature
    doc.setDrawColor(107, 114, 128);
    doc.setLineWidth(0.3);
    doc.line(marginL, sigY, marginL + 70, sigY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(interpolate('{{agency_name}}', allVars), marginL + 35, sigY + 5, { align: 'center' });
    doc.text('Data: ___/___/______', marginL + 35, sigY + 10, { align: 'center' });

    // Right signature
    const rightX = pageW - marginR - 70;
    doc.line(rightX, sigY, rightX + 70, sigY);
    doc.text(interpolate('{{client_name}}', allVars), rightX + 35, sigY + 5, { align: 'center' });
    doc.text('Data: ___/___/______', rightX + 35, sigY + 10, { align: 'center' });

    y = sigY + 18;
  };

  // ── Footer on each page ───────────────────────────────────────────────────
  const addFooters = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(marginL, pageH - 12, pageW - marginR, pageH - 12);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.setFont('helvetica', 'normal');
      doc.text(
        interpolate('{{agency_name}} · {{current_date}}', allVars),
        marginL,
        pageH - 7
      );
      doc.text(`${i} / ${pageCount}`, pageW - marginR, pageH - 7, { align: 'right' });
    }
  };

  // ── Render blocks ─────────────────────────────────────────────────────────
  renderHeader();

  template.blocks.forEach((block) => {
    if (block.type === 'header') return; // already rendered

    renderSectionTitle(block.title);

   switch (block.type) {
      case 'intro':
      case 'text_block':
      case 'parties':
      // Removi o segundo 'text_block' que estava aqui e causava o erro
        if (block.content) renderText(block.content);
        break;

      case 'services':
        renderServices();
        break;

      case 'timeline':
        renderTimeline();
        break;

      case 'investment':
        renderInvestment();
        break;

      case 'conditions':
        if (block.content) renderText(block.content);
        break;

      case 'signature':
        renderSignature();
        break;

      case 'metrics':
        renderText('Métricas disponíveis no painel de analytics.');
        break;

      default:
        if (block.content) renderText(block.content);
    }

    y += 4;
  });

  addFooters();

  // Build file name with versioning
  const clientSlug = (allVars.client_name ?? 'documento').replace(/[^a-zA-Z0-9À-ÿ ]/g, '').trim();
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `${template.name} - ${clientSlug} - ${dateStr}.pdf`;

  return { blob: doc.output('blob'), fileName };
}

// ─── DocService ───────────────────────────────────────────────────────────────

export const DocService = {
  // ── Templates ─────────────────────────────────────────────────────────────

  async getTemplates(): Promise<DocTemplate[]> {
    const { data, error } = await supabase
      .from('doc_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []) as DocTemplate[];
  },

  async getTemplate(id: string): Promise<DocTemplate> {
    const { data, error } = await supabase.from('doc_templates').select('*').eq('id', id).single();
    if (error) throw error;
    return data as DocTemplate;
  },

  async createTemplate(payload: Omit<DocTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<DocTemplate> {
    const { data, error } = await supabase.from('doc_templates').insert(payload).select().single();
    if (error) throw error;
    return data as DocTemplate;
  },

  async updateTemplate(id: string, patch: Partial<DocTemplate>): Promise<void> {
    const { error } = await supabase
      .from('doc_templates')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('doc_templates').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Documents ─────────────────────────────────────────────────────────────

  async getDocuments(opts?: { clientId?: string; status?: string }): Promise<DocDocument[]> {
    let q = supabase
      .from('doc_documents')
      .select('*, clients(name), doc_templates(name)')
      .order('created_at', { ascending: false });

    if (opts?.clientId) q = q.eq('client_id', opts.clientId);
    if (opts?.status) q = q.eq('status', opts.status);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((d) => ({
      ...d,
      client_name: (d.clients as { name: string } | null)?.name ?? null,
      template_name: (d.doc_templates as { name: string } | null)?.name ?? null,
      clients: undefined,
      doc_templates: undefined,
    })) as DocDocument[];
  },

  async getDocument(id: string): Promise<DocDocument> {
    const { data, error } = await supabase
      .from('doc_documents')
      .select('*, clients(name), doc_templates(name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return {
      ...data,
      client_name: (data.clients as { name: string } | null)?.name ?? null,
      template_name: (data.doc_templates as { name: string } | null)?.name ?? null,
      clients: undefined,
      doc_templates: undefined,
    } as DocDocument;
  },

  async createDocument(payload: CreateDocPayload): Promise<DocDocument> {
    const { data, error } = await supabase
      .from('doc_documents')
      .insert({
        template_id: payload.template_id,
        client_id: payload.client_id ?? null,
        board_id: payload.board_id ?? null,
        title: payload.title,
        variables: payload.variables,
        drive_folder_id: payload.drive_folder_id ?? null,
        status: 'draft',
        version: 1,
      })
      .select()
      .single();
    if (error) throw error;
    return data as DocDocument;
  },

  async updateDocument(id: string, patch: Partial<DocDocument>): Promise<void> {
    const { error } = await supabase
      .from('doc_documents')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabase.from('doc_documents').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Google Drive upload ────────────────────────────────────────────────────

  async uploadToDrive(
    docId: string,
    blob: Blob,
    fileName: string,
    folderId: string,
    accessToken: string,
    existingFileId?: string | null
  ): Promise<{ fileId: string; webViewLink: string; downloadLink: string }> {
    const metadata: Record<string, unknown> = {
      name: fileName,
      mimeType: 'application/pdf',
    };
    if (!existingFileId) metadata.parents = [folderId];

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob, fileName);

    const url = existingFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,webViewLink,webContentLink`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink';

    const res = await fetch(url, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Drive upload failed: ${errText}`);
    }

    const json = await res.json();

    // Persist links to DB
    await supabase.from('doc_documents').update({
      drive_file_id: json.id,
      drive_web_view_link: json.webViewLink,
      drive_download_link: json.webContentLink,
      drive_folder_id: folderId,
      status: 'generated',
      pdf_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', docId);

    return {
      fileId: json.id,
      webViewLink: json.webViewLink,
      downloadLink: json.webContentLink,
    };
  },

  // Auto-version file name to avoid overwrites
  buildVersionedFileName(baseName: string, version: number): string {
    const withoutExt = baseName.replace(/\.pdf$/i, '');
    return `${withoutExt} - v${version}.pdf`;
  },
};
