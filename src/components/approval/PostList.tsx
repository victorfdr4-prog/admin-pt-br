import React from 'react';
import { motion } from 'framer-motion';
import { Clock3, Image as ImageIcon } from 'lucide-react';
import { WorkflowTone } from '@/components/posting-calendar/PostingCalendarShared';
import { cn } from '@/lib/utils';
import type { CentralApprovalQueueItem } from '@/services/content-approval.service';

interface PostListProps {
  posts: CentralApprovalQueueItem[];
  selectedPostId: string | null;
  onSelect: (postId: string) => void;
}

export default function PostList({ posts, selectedPostId, onSelect }: PostListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Posts</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Itens em checkpoint interno</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            ⚠️ Nenhum post encontrado
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const active = selectedPostId === post.id;
              return (
                <motion.button
                  key={post.id}
                  type="button"
                  onClick={() => onSelect(post.id)}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'w-full rounded-3xl border bg-white p-4 text-left transition-all',
                    active
                      ? 'border-slate-900 shadow-lg shadow-slate-200'
                      : 'border-gray-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'
                  )}
                >
                  <div className="flex gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                      {post.image_url ? (
                <img src={post.image_url} alt={post.title || 'Visualização'} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon size={20} className="text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{post.title || 'Sem título'}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {post.description || 'Sem legenda disponível.'}
                          </p>
                        </div>
                        <WorkflowTone value={post.workflow_status} />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          Versão {post.current_version_number || post.version_number || 1}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {post.post_date || 'Sem data'}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                            post.urgency === 'urgente'
                              ? 'bg-rose-50 text-rose-700'
                              : post.urgency === 'atencao'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                          )}
                        >
                          {post.urgency === 'urgente' ? '🔴 urgente' : post.urgency === 'atencao' ? '🟡 atenção' : '🟢 tranquilo'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          <Clock3 size={12} />
                          {post.waiting_days} dia(s)
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
