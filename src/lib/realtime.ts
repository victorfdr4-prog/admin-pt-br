export type RealtimeRow = Record<string, unknown>;

export type RealtimeChangeDetail = {
  schema: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  newRow: RealtimeRow | null;
  oldRow: RealtimeRow | null;
};

export type ProfileUpdatedDetail = {
  full_name?: string;
  username?: string;
  email?: string;
  avatar_url?: string;
};

const REALTIME_EVENT_NAME = 'cromia:postgres-change';
const PROFILE_EVENT_NAME = 'cromia:profile-updated';

export const emitRealtimeChange = (detail: RealtimeChangeDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<RealtimeChangeDetail>(REALTIME_EVENT_NAME, { detail }));
};

export const subscribeRealtimeChange = (handler: (detail: RealtimeChangeDetail) => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const listener = (event: Event) => handler((event as CustomEvent<RealtimeChangeDetail>).detail);
  window.addEventListener(REALTIME_EVENT_NAME, listener as EventListener);

  return () => window.removeEventListener(REALTIME_EVENT_NAME, listener as EventListener);
};

export const emitProfileUpdated = (detail: ProfileUpdatedDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_EVENT_NAME, { detail }));
};

export const subscribeProfileUpdated = (handler: (detail: ProfileUpdatedDetail) => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const listener = (event: Event) => handler((event as CustomEvent<ProfileUpdatedDetail>).detail);
  window.addEventListener(PROFILE_EVENT_NAME, listener as EventListener);

  return () => window.removeEventListener(PROFILE_EVENT_NAME, listener as EventListener);
};
