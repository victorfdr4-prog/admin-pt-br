import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileImage, FileText, Loader2, Plus, Save, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { motion } from 'framer-motion';
import { toast } from '@/components/ui/sonner';
import PostingCalendarTemplateClassic from '@/components/posting-calendar/PostingCalendarTemplateClassic';
import {
  MONTH_OPTIONS,
  buildMonthCells,
  normalizeWorkflowStatusId,
  type CalendarClient,
  type PostingCalendarItemRecord,
} from '@/components/posting-calendar/PostingCalendarShared';
import { DEFAULT_POSTING_CALENDAR_TEMPLATE, type PostingCalendarLegendItem } from '@/domain/agencyPlatform';
import { ClientService, PostingCalendarService } from '@/services';
import { captureElementPngDataUrl, cloneForCanvasExport } from '@/utils/exportCapture';

const DEFAULT_LOGO_PATH = '/CALENDARIO.PNG';

export const PostingCalendarTemplatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client');
  const monthParam = Number(searchParams.get('month'));
  const yearParam = Number(searchParams.get('year'));

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClient, setSelectedClient] = useState<CalendarClient | null>(null);
  const [legendItems, setLegendItems] = useState<PostingCalendarLegendItem[]>(DEFAULT_POSTING_CALENDAR_TEMPLATE.legend_items);
  const [calendarItems, setCalendarItems] = useState<PostingCalendarItemRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(Number.isFinite(monthParam) ? monthParam : new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(Number.isFinite(yearParam) ? yearParam : new Date().getFullYear());
  const [newLegendLabel, setNewLegendLabel] = useState('');
  const [newLegendColor, setNewLegendColor] = useState('#B9C4F4');
  const [logoSource, setLogoSource] = useState<'supabase' | 'upload' | 'drive'>('supabase');
  const [uploadedLogoBase64, setUploadedLogoBase64] = useState<string>('');
  const [driveLogoUrl, setDriveLogoUrl] = useState('');
  const [previewScale, setPreviewScale] = useState(1);
  const [previewPadding, setPreviewPadding] = useState(0);
  const [previewGap, setPreviewGap] = useState(24);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      if (!clientId) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const [clientData, templateResponse, records] = await Promise.all([
          ClientService.getById(clientId),
          PostingCalendarService.getResolvedTemplate(),
          PostingCalendarService.getRecords(clientId, selectedMonth, selectedYear),
        ]);
        setSelectedClient(clientData || null);
        setLegendItems(templateResponse?.template?.legend_items || DEFAULT_POSTING_CALENDAR_TEMPLATE.legend_items);
        setCalendarItems((records?.items || []) as PostingCalendarItemRecord[]);
      } catch (error) {
        console.error(error);
        toast.error('Erro ao carregar dados');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [clientId, selectedMonth, selectedYear]);

  const monthLabel = useMemo(
    () => MONTH_OPTIONS.find((month) => month.value === selectedMonth)?.label || 'Janeiro',
    [selectedMonth]
  );

  const calendarCells = useMemo(() => buildMonthCells(selectedYear, selectedMonth), [selectedYear, selectedMonth]);
  const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  const handleAddLegend = () => {
    if (!newLegendLabel.trim()) return;
    setLegendItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: newLegendLabel.trim().toUpperCase(),
        color: newLegendColor,
        textColor: '#27354d',
        visible: true,
      },
    ]);
    setNewLegendLabel('');
  };

  const handleDeleteLegend = (id: string) => {
    setLegendItems((current) => current.filter((item) => item.id !== id));
  };

  const handleSaveTemplate = async () => {
    try {
      setIsSaving(true);
      await PostingCalendarService.saveTemplate({
        template: {
          ...DEFAULT_POSTING_CALENDAR_TEMPLATE,
          legend_items: legendItems,
          layout: {
            ...DEFAULT_POSTING_CALENDAR_TEMPLATE.layout,
            outer_padding: previewPadding,
            legend_spacing: previewGap,
          },
        },
      });
      toast.success('Legenda padrão salva');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar legenda');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = useCallback(
    async (type: 'png' | 'pdf') => {
      if (!previewRef.current || !selectedClient) return;
      let exportNode: HTMLElement | null = null;
      try {
        exportNode = await cloneForCanvasExport(previewRef.current, DEFAULT_LOGO_PATH);
        const dataUrl = await captureElementPngDataUrl(exportNode);

        const safeClientName = selectedClient.name.replace(/[^a-zA-Z0-9-_]/g, '_');
        const baseName = `Calendario_${safeClientName}_${selectedMonth + 1}-${selectedYear}`;

        if (type === 'png') {
          const link = document.createElement('a');
          link.download = `${baseName}.png`;
          link.href = dataUrl;
          link.click();
        } else {
          const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
          pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210);
          pdf.save(`${baseName}.pdf`);
        }
        toast.success(`${type.toUpperCase()} exportado com sucesso`);
      } catch (error) {
        console.error(error);
        toast.error(`Erro ao exportar ${type.toUpperCase()}`);
      } finally {
        if (exportNode?.parentNode) exportNode.parentNode.removeChild(exportNode);
      }
    },
    [selectedClient, selectedMonth, selectedYear]
  );

  const dynamicClientLogo = useMemo(() => {
    if (logoSource === 'upload') return uploadedLogoBase64 || selectedClient?.logo_url || null;
    if (logoSource === 'drive') return driveLogoUrl.trim() || selectedClient?.logo_url || null;
    return selectedClient?.logo_url || null;
  }, [driveLogoUrl, logoSource, selectedClient?.logo_url, uploadedLogoBase64]);

  const previewClient = useMemo(
    () =>
      selectedClient
        ? {
            ...selectedClient,
            logo_url: dynamicClientLogo,
          }
        : null,
    [dynamicClientLogo, selectedClient]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-900" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-white">
      <header className="z-20 flex h-16 items-center justify-between border-b border-slate-100 bg-white px-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 transition-colors hover:bg-slate-50">
            <ArrowLeft size={18} />
          </button>
          <div className="h-6 w-px bg-slate-100" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Calendário de Postagem</p>
            <h1 className="text-[16px] font-black tracking-tight text-slate-900">Editor de legenda</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => void handleExport('png')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50">
            <FileImage size={14} />
            PNG
          </button>
          <button onClick={() => void handleExport('pdf')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50">
            <FileText size={14} />
            PDF
          </button>
          <button onClick={handleSaveTemplate} disabled={isSaving} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-slate-800 disabled:opacity-50">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <motion.aside
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="custom-scrollbar w-[340px] overflow-y-auto border-r border-slate-100 bg-white p-6"
        >
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Período</h3>
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                >
                  {MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Legenda</h3>
                  <p className="mt-1 text-xs text-slate-500">Template global único (DEFAULT).</p>
                </div>
                <button type="button" onClick={handleAddLegend} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                  + Adicionar
                </button>
              </div>

              <div className="space-y-2.5">
                {legendItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <input
                      type="color"
                      value={item.color}
                      onChange={(event) =>
                        setLegendItems((current) =>
                          current.map((entry) =>
                            entry.id === item.id ? { ...entry, color: event.target.value } : entry
                          )
                        )
                      }
                      className="h-8 w-10 cursor-pointer rounded-md border-0 bg-transparent"
                    />
                    <input
                      value={item.label}
                      onChange={(event) =>
                        setLegendItems((current) =>
                          current.map((entry) =>
                            entry.id === item.id ? { ...entry, label: event.target.value } : entry
                          )
                        )
                      }
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 outline-none"
                    />
                    <button type="button" onClick={() => handleDeleteLegend(item.id)} className="rounded-full p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                <input type="color" value={newLegendColor} onChange={(event) => setNewLegendColor(event.target.value)} className="h-10 w-12 cursor-pointer rounded-xl border-0 bg-transparent" />
                <input
                  type="text"
                  value={newLegendLabel}
                  onChange={(event) => setNewLegendLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleAddLegend();
                  }}
                  placeholder="Ex: Post Reels"
                  className="flex-1 bg-transparent px-2 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button type="button" onClick={handleAddLegend} disabled={!newLegendLabel.trim()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-50">
                  <Plus size={16} />
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Logos</h3>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500">Logo superior (fixa)</label>
                <input value={DEFAULT_LOGO_PATH} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500">Logo inferior</label>
                <select
                  value={logoSource}
                  onChange={(event) => setLogoSource(event.target.value as 'supabase' | 'upload' | 'drive')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                >
                  <option value="supabase">Supabase (cliente)</option>
                  <option value="upload">Upload local (Base64)</option>
                  <option value="drive">Google Drive URL</option>
                </select>
                {logoSource === 'upload' ? (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setUploadedLogoBase64(String(reader.result || ''));
                      reader.readAsDataURL(file);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"
                  />
                ) : null}
                {logoSource === 'drive' ? (
                  <input
                    value={driveLogoUrl}
                    onChange={(event) => setDriveLogoUrl(event.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"
                  />
                ) : null}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Visualização</h3>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-slate-500">Padding</span>
                <input type="range" min={0} max={32} value={previewPadding} onChange={(event) => setPreviewPadding(Number(event.target.value))} className="w-full" />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-slate-500">Gap</span>
                <input type="range" min={8} max={32} value={previewGap} onChange={(event) => setPreviewGap(Number(event.target.value))} className="w-full" />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-slate-500">Scale</span>
                <input type="range" min={0.8} max={1.2} step={0.02} value={previewScale} onChange={(event) => setPreviewScale(Number(event.target.value))} className="w-full" />
              </label>
            </section>
          </div>
        </motion.aside>

        <main className="custom-scrollbar flex-1 overflow-y-auto bg-[#F7F7F6] p-6">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Visualização</h2>
                <p className="mt-1 text-xs text-slate-500">{selectedClient?.name || 'Cliente'} • {monthLabel} {selectedYear}</p>
              </div>
              <div className="text-[11px] font-medium text-slate-400">{calendarItems.length} item(ns) configurado(s)</div>
            </div>

            <div className="mx-auto w-full overflow-hidden rounded-[30px]" style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center' }}>
              <div ref={previewRef}>
              <PostingCalendarTemplateClassic
                client={previewClient}
                brandLogoUrl={DEFAULT_LOGO_PATH}
                monthLabel={monthLabel}
                year={selectedYear}
                weekDays={weekDays}
                calendarCells={calendarCells}
                calendarItems={calendarItems.map((item) => ({
                  id: item.id,
                  day_number: item.day_number,
                  post_type: item.post_type,
                  title: item.title || null,
                  status: normalizeWorkflowStatusId(item.workflow_status || item.status),
                  label_color: item.label_color || null,
                }))}
                config={{
                  ...DEFAULT_POSTING_CALENDAR_TEMPLATE,
                  legend_items: legendItems,
                  layout: {
                    ...DEFAULT_POSTING_CALENDAR_TEMPLATE.layout,
                    outer_padding: previewPadding,
                    legend_spacing: previewGap,
                  },
                }}
              />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PostingCalendarTemplatePage;
