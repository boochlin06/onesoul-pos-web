interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * 封裝具備 TTL (預設 60 秒) 與 LRU 淘汰機制之安全快取容器，避免過期成本污染
 */
export class SafeTtlCache<K, V> {
  private map = new Map<K, CacheEntry<V>>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = 200, ttlMs = 60000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.data;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) this.map.delete(oldestKey);
    }
    this.map.set(key, { data: value, timestamp: Date.now() });
  }

  clear(): void {
    this.map.clear();
  }
}

export const autocompleteCache = new SafeTtlCache<string, any[]>(200, 60000);
