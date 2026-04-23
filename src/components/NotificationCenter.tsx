import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ActivityFeedList from '@/components/activity/ActivityFeedList';
import { buildFeedItemFromActivityLog, groupFeedItems } from '@/lib/activity-feed';

interface NotificationCenterProps {
  panelAlign?: 'left' | 'right';
  className?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ panelAlign = 'right', className }) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [items, setItems] = useState<ReturnType<typeof buildFeedItemFromActivityLog>[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  const groupedItems = useMemo(() => groupFeedItems(items.slice(0, 18)), [items]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data: activityRows } = await supabase
        .from('activity_logs')
        .select('id, user_id, client_id, action, entity, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      const userIds = [...new Set((activityRows || []).map((item: any) => String(item.user_id || '')).filter(Boolean))];
      const clientIds = [...new Set((activityRows || []).map((item: any) => String(item.client_id || '')).filter(Boolean))];

      const [{ data: profiles }, { data: clients }] = await Promise.all([
        userIds.length
          ? supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        clientIds.length
          ? supabase.from('clients').select('id, name').in('id', clientIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      if (!mounted) return;

      const profileMap = new Map((profiles || []).map((item: any) => [String(item.id), item]));
      const clientMap = new Map((clients || []).map((item: any) => [String(item.id), String(item.name || '')]));
      setItems((activityRows || []).map((item: any) => buildFeedItemFromActivityLog(item, profileMap, clientMap)));
    };

    void load();

    const channelName =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `realtime_activity_feed_${crypto.randomUUID()}`
        : `realtime_activity_feed_${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, async (payload) => {
        const row = payload.new as any;
        const [{ data: profile }, { data: client }] = await Promise.all([
          row.user_id
            ? supabase.from('profiles').select('id, full_name, username, avatar_url').eq('id', row.user_id).maybeSingle()
            : Promise.resolve({ data: null }),
          row.client_id
            ? supabase.from('clients').select('id, name').eq('id', row.client_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const profileMap = new Map(profile ? [[String(profile.id), profile]] : []);
        const clientMap = new Map(client ? [[String(client.id), String(client.name || '')]] : []);
        const next = buildFeedItemFromActivityLog(row, profileMap, clientMap);

        setItems((prev) => [next, ...prev.filter((item) => item.id !== next.id)].slice(0, 24));
        setUnreadCount((prev) => prev + 1);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      mounted = false;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (showPanel) setUnreadCount(0);
  }, [showPanel]);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setShowPanel((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#667085] transition-colors hover:bg-[#fafafa] hover:text-[#111827]"
        title="Atividade"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {showPanel ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={cn(
                'absolute top-12 z-50 flex max-h-[560px] w-[380px] flex-col overflow-hidden rounded-[24px] border border-[#e8edf3] bg-white shadow-sm',
                panelAlign === 'left' ? 'left-0' : 'right-0'
              )}
            >
              <div className="flex items-start justify-between border-b border-[#edf1f6] px-4 py-4">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#111827]">Atividade</h3>
                  <p className="mt-1 text-[12px] text-[#98a2b3]">Feed da operação em tempo real</p>
                </div>
                <button
                  onClick={() => setShowPanel(false)}
                  className="rounded-full p-2 text-[#98a2b3] transition hover:bg-[#f8fafc] hover:text-[#344054]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                {groupedItems.length === 0 ? (
                  <div className="py-14 text-center text-sm text-[#98a2b3]">
                    <Bell className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    <p>Nenhuma atividade recente</p>
                  </div>
                ) : (
                  <ActivityFeedList groups={groupedItems} compact />
                )}
              </div>

              <div className="border-t border-[#edf1f6] px-4 py-2 text-center text-[11px] text-[#98a2b3]">
                {items.length} atividade{items.length !== 1 ? 's' : ''} no feed
              </div>
            </motion.div>

            <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
