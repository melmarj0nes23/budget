const CACHE_PREFIX = 'budgetlens_ph_v1:';
const MAX_ENTRY_BYTES = 450_000; // Guard against bloating localStorage with huge responses

export interface CacheEntry<T> {
  data: T;
  fetchedAt: string;
  expiresAt: number;
  sourceUrl: string;
}

class CacheService {
  private memoryCache = new Map<string, CacheEntry<unknown>>();

  private makeKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  getFresh<T>(key: string): CacheEntry<T> | null {
    const entry = this.getAny<T>(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry;
  }

  getAny<T>(key: string): CacheEntry<T> | null {
    const fullKey = this.makeKey(key);
    const inMem = this.memoryCache.get(fullKey) as CacheEntry<T> | undefined;
    if (inMem) return inMem;

    try {
      const raw = window.localStorage.getItem(fullKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (!parsed || typeof parsed.fetchedAt !== 'string' || !('data' in parsed)) {
        return null;
      }
      this.memoryCache.set(fullKey, parsed as CacheEntry<unknown>);
      return parsed;
    } catch {
      return null;
    }
  }

  set<T>(key: string, data: T, ttlMs: number, sourceUrl: string): CacheEntry<T> {
    const fullKey = this.makeKey(key);
    const entry: CacheEntry<T> = {
      data,
      fetchedAt: new Date().toISOString(),
      expiresAt: Date.now() + ttlMs,
      sourceUrl,
    };

    this.memoryCache.set(fullKey, entry as CacheEntry<unknown>);

    try {
      const serialized = JSON.stringify(entry);
      if (serialized.length <= MAX_ENTRY_BYTES) {
        window.localStorage.setItem(fullKey, serialized);
      }
    } catch {
      // QuotaExceededError or private browsing: evict expired keys and retry once
      this.evictExpired();
      try {
        const serialized = JSON.stringify(entry);
        if (serialized.length <= MAX_ENTRY_BYTES) {
          window.localStorage.setItem(fullKey, serialized);
        }
      } catch {
        // Keep in memory cache only; never crash the UI
      }
    }

    return entry;
  }

  invalidatePrefix(prefix: string): void {
    const targetPrefix = `${CACHE_PREFIX}${prefix}`;
    for (const k of Array.from(this.memoryCache.keys())) {
      if (k.startsWith(targetPrefix)) {
        this.memoryCache.delete(k);
      }
    }
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(targetPrefix)) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) {
        window.localStorage.removeItem(k);
      }
    } catch {
      // Ignore storage access restrictions
    }
  }

  clearAll(): void {
    this.invalidatePrefix('');
  }

  private evictExpired(): void {
    const now = Date.now();
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k || !k.startsWith(CACHE_PREFIX)) continue;
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as CacheEntry<unknown>;
          if (!parsed.expiresAt || now > parsed.expiresAt) {
            toRemove.push(k);
          }
        } catch {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) {
        window.localStorage.removeItem(k);
      }
    } catch {
      // Ignore
    }
  }
}

export const cacheService = new CacheService();
