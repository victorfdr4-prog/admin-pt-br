type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class MemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): T {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });

    return value;
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  async remember<T>(key: string, ttlMs: number, resolver: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const value = await resolver();
    return this.set(key, value, ttlMs);
  }
}

export const apiCache = new MemoryCache();

export function createScopedCacheKey(
  scope: string,
  accessToken: string | undefined,
  ...parts: Array<string | number | boolean | null | undefined>
) {
  const userScope = accessToken ? accessToken.slice(-16) : 'anonymous';
  const normalizedParts = parts.map((part) => (part === undefined || part === null ? 'null' : String(part)));
  return [scope, userScope, ...normalizedParts].join(':');
}
