import React, { useEffect, useRef, useState } from 'react';
import { LayoutList, KanbanSquare, Plus, ChevronDown, Archive, Settings2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/store/useBoardStore';
import { useBoards, useCreateBoard } from '@/hooks/useBoardV2';
import { BoardTable } from './BoardTable';
import { BoardKanban } from './BoardKanban';
import { CreateTaskModal } from './CreateTaskModal';
import type { BoardSection, BoardStatus } from '@/services/boardV2.service';

interface BoardShellProps {
  clients: { id: string; name: string }[];
  users: { id: string; name: string; avatar?: string | null }[];
}

const hexToRgba = (hex: string | null | undefined, alpha: number) => {
  const normalized = String(hex || '').replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(132, 204, 22, ${alpha})`;

  const value = Number.parseInt(full, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

export const BoardShell: React.FC<BoardShellProps> = ({ clients, users }) => {
  const { activeBoardId, setActiveBoardId, viewMode, setViewMode } = useBoardStore();
  const { data: boards = [], isLoading: loadingBoards } = useBoards();
  const createBoard = useCreateBoard();

  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? boards[0] ?? null;
  const activeBoardColor = activeBoard?.color || '#84cc16';

  // Auto-select first board
  React.useEffect(() => {
    if (!activeBoardId && boards.length > 0) {
      setActiveBoardId(boards[0].id);
    }
  }, [boards, activeBoardId, setActiveBoardId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!pickerRef.current?.contains(target)) {
        setShowBoardPicker(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowBoardPicker(false);
        setShowCreateTask(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return;
    const board = await createBoard.mutateAsync({ name: newBoardName.trim() });
    setActiveBoardId(board.id);
    setNewBoardName('');
    setShowBoardPicker(false);
  };

  if (loadingBoards) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Acessando quadros operacionais…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-[#dbe5cc] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdf5_100%)] shadow-[0_28px_72px_rgba(84,104,28,0.12)]">
      {/* ── Toolbar ── */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 gap-y-2 border-b border-[#e4ecd8] px-5 py-4 md:px-6"
        style={{
          background: `radial-gradient(circle at top left, ${hexToRgba(activeBoardColor, 0.24)}, transparent 34%), linear-gradient(135deg, #fdfef8 0%, #ffffff 48%, ${hexToRgba(activeBoardColor, 0.16)} 100%)`,
        }}
      >
        {/* Board picker */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowBoardPicker((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-[#dbe5cc] bg-white/90 px-3.5 py-2 text-sm font-semibold text-[#111827] shadow-[0_10px_20px_rgba(84,104,28,0.08)] backdrop-blur-sm transition-colors hover:bg-white"
          >
            <span className="max-w-[160px] truncate">{activeBoard?.name ?? 'Selecionar quadro'}</span>
            <ChevronDown className="size-3.5 text-[#7c8698]" />
          </button>

          <AnimatePresence>
            {showBoardPicker && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[#dde8cf] bg-white shadow-[0_18px_40px_rgba(84,104,28,0.12)]"
              >
                <div className="p-1">
                  {boards.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => { setActiveBoardId(b.id); setShowBoardPicker(false); }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#344054] transition-colors hover:bg-[#f8fbf1]',
                        b.id === activeBoardId && 'bg-[#f3f8e6] font-semibold text-[#111827]'
                      )}
                    >
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ background: b.color }}
                      />
                      <span className="truncate">{b.name}</span>
                      {b.client_name && (
                        <span className="ml-auto shrink-0 text-xs text-[#7c8698]">{b.client_name}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-[#e7eddc] p-2">
                  <div className="flex gap-1.5">
                    <input
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
                      placeholder="Nome do novo quadro operacional…"
                      className="min-w-0 flex-1 rounded-xl border border-[#d5e1c2] bg-white px-2.5 py-2 text-sm text-[#111827] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-[#9aca52]"
                    />
                    <button
                      onClick={handleCreateBoard}
                      disabled={!newBoardName.trim() || createBoard.isPending}
                      className="rounded-xl bg-[#1b1c15] px-2.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* View toggle */}
        <div className="flex overflow-hidden rounded-2xl border border-[#dce6cf] bg-white/85 shadow-[0_12px_24px_rgba(84,104,28,0.08)] backdrop-blur-sm">
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 text-sm transition-colors',
              viewMode === 'table' ? 'bg-[#1b1c15] text-white' : 'text-[#667085] hover:bg-[#f8fbf1] hover:text-[#111827]'
            )}
          >
            <LayoutList className="size-3.5" />
            <span className="hidden sm:inline">Lista</span>
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 text-sm transition-colors',
              viewMode === 'kanban' ? 'bg-[#1b1c15] text-white' : 'text-[#667085] hover:bg-[#f8fbf1] hover:text-[#111827]'
            )}
          >
            <KanbanSquare className="size-3.5" />
            <span className="hidden sm:inline">Kanban</span>
          </button>
        </div>

        <div className="flex-1" />

        {/* Add task */}
        {activeBoard && (
          <button
            onClick={() => setShowCreateTask(true)}
            className="flex items-center gap-1.5 rounded-2xl border border-transparent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95"
            style={{
              background: `linear-gradient(135deg, ${activeBoardColor} 0%, #22c55e 100%)`,
              boxShadow: `0 18px 36px ${hexToRgba(activeBoardColor, 0.32)}`,
            }}
          >
            <Plus className="size-4" />
            <span>{showCreateTask ? 'Criando tarefa' : 'Nova tarefa'}</span>
          </button>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-hidden bg-transparent p-5 md:p-6">
        {!activeBoard ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-[#d8e3c9] bg-[linear-gradient(135deg,#ffffff_0%,#fbfdf5_50%,#eef8d8_100%)] text-center">
            <Archive className="size-10 text-[#98a2b3]" />
            <p className="text-sm text-[#667085]">Nenhum quadro operacional encontrado.</p>
            <button
              onClick={() => setShowBoardPicker(true)}
              className="rounded-full border border-[#111827] bg-[#111827] px-4 py-2 text-sm font-semibold text-white"
            >
              Adicionar quadro
            </button>
          </div>
        ) : viewMode === 'table' ? (
          <BoardTable
            boardId={activeBoard.id}
            boardClientId={activeBoard.client_id ?? null}
            clients={clients}
            users={users}
          />
        ) : (
          <BoardKanban boardId={activeBoard.id} clients={clients} users={users} />
        )}
      </div>

      {/* ── Create task modal ── */}
      <AnimatePresence>
        {showCreateTask && activeBoard && (
          <CreateTaskModal
            boardId={activeBoard.id}
            clients={clients}
            users={users}
            onClose={() => setShowCreateTask(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
