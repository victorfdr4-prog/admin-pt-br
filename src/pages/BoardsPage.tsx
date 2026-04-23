import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClientService, UserService } from '@/services';
import { BoardShell } from '@/components/board/BoardShell';

export default function BoardsPage() {
  const { data: clientsRaw = [] } = useQuery({
    queryKey: ['clients', 'list'],
    queryFn: () => ClientService.getAll(),
    staleTime: 60_000,
  });

  const { data: usersRaw = [] } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => UserService.getAll(),
    staleTime: 60_000,
  });

  const clients = clientsRaw.map((c: Record<string, unknown>) => ({
    id: String(c.id ?? ''),
    name: String(c.name ?? ''),
    slug: c.slug ? String(c.slug) : null,
  }));

  const users = usersRaw.map((u: Record<string, unknown>) => ({
    id: String(u.id ?? ''),
    name: String(u.full_name ?? u.email ?? ''),
    avatar: (u.avatar_url as string | null) ?? null,
  }));

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1560px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6 xl:px-8">
      <div className="flex items-center">
        <div className="flex w-fit items-center rounded-2xl border border-lime-200 bg-lime-50/80 px-4 py-2.5 shadow-sm shadow-lime-100/50">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-700">
            Quadros da Equipe
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <BoardShell clients={clients} users={users} />
      </div>
    </div>
  );
}
