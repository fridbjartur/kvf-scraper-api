import type { CacheEntry, CacheStore } from "./types";

export class MemoryCache implements CacheStore {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): CacheEntry<T> | undefined {
    return this.store.get(key) as CacheEntry<T> | undefined;
  }

  set<T>(key: string, entry: CacheEntry<T>): void {
    this.store.set(key, entry as CacheEntry<unknown>);
  }

  clear(): void {
    this.store.clear();
  }
}
