import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Loader2, Paperclip, Sparkles, Upload, XCircle, Flag } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import { useCreateTaskV2 } from '@/hooks/useBoardV2';
import { UploadDropzone } from '@/components/UploadDropzone';
import { BoardV2Service } from '@/services/boardV2.service';
import { BoardSelectMenu, type BoardSelectOption } from './BoardSelectMenu';
import { ACTIVITY_TYPES, CHANNELS, PRIORITY_META } from './boardOptions';

interface CreateTaskModalProps {
  boardId: string;
  sectionId?: string | null;
  statusId?: string | null;
  clients: { id: string; name: string }[];
  users: { id: string; name: string; avatar?: string | null }[];
  onClose: () => void;
}

const TASK_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;
type CreateTaskMenu = 'client' | 'assignee' | 'activity' | 'channel' | null;

const formatFileSize = (size: number) => {
  if (size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let current = size;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const getInitials = (value?: string | null) =>
  String(value || '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  boardId, sectionId, statusId, clients, users, onClose,
}) => {
  const createTask = useCreateTaskV2();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [activityType, setActivityType] = useState('');
  const [channel, setChannel] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [openMenu, setOpenMenu] = useState<CreateTaskMenu>(null);

  const attachmentSummary = useMemo(() => {
    const totalBytes = attachments.reduce((sum, file) => sum + file.size, 0);
    return {
      count: attachments.length,
      totalBytes,
    };
  }, [attachments]);

  const clientOptions = useMemo<BoardSelectOption[]>(
    () => [
      { value: '', label: 'Sem cliente', description: 'Entrega ainda sem conta vinculada.' },
      ...clients.map((client) => ({
        value: client.id,
        label: client.name,
        description: 'Conta impactada por esta entrega.',
        initials: getInitials(client.name),
      })),
    ],
    [clients]
  );

  const assigneeOptions = useMemo<BoardSelectOption[]>(
    () => [
      { value: '', label: 'Sem responsável', description: 'Defina quem vai tocar a execução.' },
      ...users.map((user) => ({
        value: user.id,
        label: user.name,
        description: 'Dono principal da tarefa.',
        avatarUrl: user.avatar || null,
        initials: getInitials(user.name),
      })),
    ],
    [users]
  );

  const activityOptions = useMemo<BoardSelectOption[]>(
    () => [
      { value: '', label: 'Sem tipo definido', description: 'Classifique a atividade para leitura rápida.' },
      ...ACTIVITY_TYPES.map((activity) => ({
        value: activity,
        label: activity,
        description: 'Tipo principal da entrega.',
        tone: PRIORITY_META.medium.tone,
      })),
    ],
    []
  );

  const channelOptions = useMemo<BoardSelectOption[]>(
    () => [
      { value: '', label: 'Sem canal definido', description: 'Canal principal ainda não escolhido.' },
      ...CHANNELS.map((channel) => ({
        value: channel,
        label: channel,
        description: 'Destino principal da execução.',
        tone: '#0ea5e9',
      })),
    ],
    []
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const oversized = attachments.find((file) => file.size > TASK_ATTACHMENT_MAX_BYTES);
    if (oversized) {
      toast.error(`O arquivo ${oversized.name} excede o limite de 100 MB.`);
      return;
    }

    const task = await createTask.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      board_id: boardId,
      section_id: sectionId ?? null,
      status_id: statusId ?? null,
      client_id: clientId || null,
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
      priority,
      activity_type: activityType || null,
      channel: channel || null,
    });

    if (attachments.length > 0) {
      setUploadingFiles(true);
      const results = await Promise.allSettled(
        attachments.map((file) => BoardV2Service.uploadTaskAttachment(task.id, file))
      );

      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length > 0) {
        console.error('Falha ao enviar anexos da tarefa.', failed);
        toast.error(`A tarefa foi criada, mas ${failed.length} anexo(s) não foram enviados.`);
      } else {
        toast.success('Tarefa criada com anexos enviados para o storage.');
      }
      setUploadingFiles(false);
    } else {
      toast.success('Tarefa criada com sucesso.');
    }

    onClose();
  };

  const handleFiles = async (files: File[]) => {
    const accepted: File[] = [];
    const rejected: string[] = [];

    files.forEach((file) => {
      if (file.size > TASK_ATTACHMENT_MAX_BYTES) {
        rejected.push(file.name);
        return;
      }
      accepted.push(file);
    });

    if (rejected.length > 0) {
      toast.error(`Arquivos acima de 100 MB ignorados: ${rejected.join(', ')}`);
    }

    if (accepted.length === 0) return;

    setAttachments((current) => {
      const seen = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const next = [...current];
      accepted.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(key)) {
          next.push(file);
          seen.add(key);
        }
      });
      return next;
    });
  };

  const removeAttachment = (targetFile: File) => {
    setAttachments((current) =>
      current.filter(
        (file) =>
          !(file.name === targetFile.name && file.size === targetFile.size && file.lastModified === targetFile.lastModified)
      )
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (!panelRef.current?.contains(event.target as Node)) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-4xl overflow-hidden rounded-[32px] border border-[#d9e3ca] bg-white shadow-[0_30px_90px_rgba(84,104,28,0.2)]"
      >
        <div className="border-b border-[#e3ead8] bg-[radial-gradient(circle_at_top_left,_rgba(195,250,77,0.28),_transparent_42%),linear-gradient(135deg,#1b1c15_0%,#31451c_42%,#9aca52_100%)] px-6 pb-6 pt-6 text-white sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
                <Sparkles className="size-3.5" />
                Nova atividade operacional
              </div>
              <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-[30px]">
                Crie tarefas com contexto, dono, prazo e anexos sem sair do fluxo operacional.
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">
                O modal agora já prepara a entrega para execução real: briefing, cliente, canal, prioridade e upload direto
                para o Supabase Storage com limite de até 100 MB por arquivo.
              </p>
            </div>
            <button onClick={onClose} className="rounded-2xl border border-white/15 bg-white/10 p-2.5 transition-colors hover:bg-white/15">
            <X className="size-4" />
          </button>
        </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">Entrega</p>
              <p className="mt-2 text-sm font-semibold text-white">Briefing completo no mesmo fluxo</p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">Upload</p>
              <p className="mt-2 text-sm font-semibold text-white">Drag and drop com 100 MB por arquivo</p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">Persistência</p>
              <p className="mt-2 text-sm font-semibold text-white">Arquivo sobe no Storage e entra no drawer</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-7 bg-[#f7faf1] px-6 py-6 sm:px-7 lg:grid-cols-[minmax(0,1.15fr)_340px]">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-[#e2e8f3] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-2xl bg-[#111827] p-2 text-white">
                  <Plus className="size-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Briefing</p>
                  <p className="text-sm font-semibold text-[#0f172a]">Identidade da tarefa e contexto estratégico</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Título</label>
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nome da atividade ou entrega"
                    required
                    className="h-12 w-full rounded-2xl border border-[#d8e3c9] bg-[#f8fbf1] px-4 text-sm text-[#0f172a] outline-none transition focus:border-[#84cc16] focus:bg-white focus:ring-4 focus:ring-[#84cc16]/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Descrição</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalhamento, referências e instruções para execução"
                    rows={4}
                    className="w-full rounded-2xl border border-[#d8e3c9] bg-[#f8fbf1] px-4 py-3 text-sm text-[#0f172a] outline-none transition focus:border-[#84cc16] focus:bg-white focus:ring-4 focus:ring-[#84cc16]/10 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#e2e8f3] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-2xl bg-[#6f8f2f] p-2 text-white">
                  <Paperclip className="size-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Anexos</p>
                  <p className="text-sm font-semibold text-[#0f172a]">Envie arquivos de apoio para o drawer da tarefa</p>
                </div>
              </div>

              <UploadDropzone onFiles={handleFiles} disabled={createTask.isPending || uploadingFiles} />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[#d8e3c9] bg-[#f8fbf1] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">
                    {attachmentSummary.count} arquivo(s) selecionado(s)
                  </p>
                  <p className="text-xs text-[#64748b]">
                    Limite de 100 MB por arquivo. Total atual: {formatFileSize(attachmentSummary.totalBytes)}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#ecfccb] px-3 py-1 text-[11px] font-semibold text-[#365314]">
                  <Upload className="size-3.5" />
                  Supabase Storage
                </div>
              </div>

              {attachments.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {attachments.map((file) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#dfe7d2] bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#0f172a]">{file.name}</p>
                        <p className="text-xs text-[#64748b]">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(file)}
                        className="rounded-xl p-2 text-[#94a3b8] transition-colors hover:bg-[#fff1f2] hover:text-[#e11d48]"
                      >
                        <XCircle className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] border border-[#d9e3ca] bg-white p-5 shadow-[0_10px_30px_rgba(84,104,28,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Operação</p>
              <h4 className="mt-2 text-lg font-semibold text-[#0f172a]">Quem executa, quando e onde</h4>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Cliente</label>
                  <BoardSelectMenu
                    open={openMenu === 'client'}
                    onToggle={() => setOpenMenu((current) => (current === 'client' ? null : 'client'))}
                    selectedValue={clientId}
                    options={clientOptions}
                    placeholder="Selecionar cliente"
                    onSelect={(value) => {
                      setClientId(value);
                      setOpenMenu(null);
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Responsável</label>
                  <BoardSelectMenu
                    open={openMenu === 'assignee'}
                    onToggle={() => setOpenMenu((current) => (current === 'assignee' ? null : 'assignee'))}
                    selectedValue={assigneeId}
                    options={assigneeOptions}
                    placeholder="Selecionar responsável"
                    onSelect={(value) => {
                      setAssigneeId(value);
                      setOpenMenu(null);
                    }}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Prazo</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-11 w-full rounded-2xl border border-[#d8e3c9] bg-[#f8fbf1] px-4 text-sm text-[#0f172a] outline-none transition focus:border-[#84cc16] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Prioridade</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as const).map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setPriority(item)}
                          className={cn(
                            'rounded-[18px] border px-3 py-3 text-left text-xs font-semibold transition-all',
                            priority === item
                              ? PRIORITY_META[item].surface
                              : 'border-[#d8e3c9] bg-[#f8fbf1] text-[#64748b] hover:border-[#c8d7b3] hover:bg-white'
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <Flag className="size-3.5" />
                            {PRIORITY_META[item].label}
                          </span>
                          <span className="mt-1.5 block text-[11px] font-medium opacity-80">
                            {PRIORITY_META[item].description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Tipo de atividade</label>
                  <BoardSelectMenu
                    open={openMenu === 'activity'}
                    onToggle={() => setOpenMenu((current) => (current === 'activity' ? null : 'activity'))}
                    selectedValue={activityType}
                    options={activityOptions}
                    placeholder="Selecionar tipo"
                    onSelect={(value) => {
                      setActivityType(value);
                      setOpenMenu(null);
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Canal</label>
                  <BoardSelectMenu
                    open={openMenu === 'channel'}
                    onToggle={() => setOpenMenu((current) => (current === 'channel' ? null : 'channel'))}
                    selectedValue={channel}
                    options={channelOptions}
                    placeholder="Selecionar canal"
                    onSelect={(value) => {
                      setChannel(value);
                      setOpenMenu(null);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#d9e3ca] bg-[linear-gradient(160deg,#ecfccb_0%,#ffffff_42%,#f3f8df_100%)] p-5 shadow-[0_10px_30px_rgba(84,104,28,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Resumo</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3">
                  <span className="text-sm text-[#475569]">Título pronto</span>
                  <span className="text-sm font-semibold text-[#0f172a]">{title.trim() ? 'Sim' : 'Pendente'}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3">
                  <span className="text-sm text-[#475569]">Anexos</span>
                  <span className="text-sm font-semibold text-[#0f172a]">{attachmentSummary.count}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3">
                  <span className="text-sm text-[#475569]">Carga total</span>
                  <span className="text-sm font-semibold text-[#0f172a]">{formatFileSize(attachmentSummary.totalBytes)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-[#d8e3c9] bg-white px-5 py-3 text-sm font-semibold text-[#334155] transition-colors hover:bg-[#f8fbf1]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!title.trim() || createTask.isPending || uploadingFiles}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-opacity',
                  'bg-[linear-gradient(135deg,#84cc16_0%,#22c55e_100%)] shadow-[0_16px_40px_rgba(132,204,22,0.35)]',
                  'disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-95'
                )}
              >
                {createTask.isPending || uploadingFiles ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {uploadingFiles ? 'Enviando anexos...' : 'Criar atividade'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
