// Storage abstraction: IndexedDB for files + records, with an in-memory fallback.
// The RecordStore interface is what a cloud adapter (see sync.ts) mirrors.
import { openDB, type IDBPDatabase } from 'idb';

export const RECORD_KINDS = ['books', 'annotations', 'sessions', 'journal', 'collections', 'authors', 'challenges', 'wishlist'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];
const BLOB_STORES = ['files', 'covers', 'content', 'kv'] as const;
type BlobStore = (typeof BLOB_STORES)[number];

let dbp: Promise<IDBPDatabase | null> | null = null;
const mem: Record<string, Map<string, any>> = {};
export let storageAvailable = true;

function getDB() {
  if (!dbp) {
    dbp = openDB('my-library', 2, {
      upgrade(db) {
        for (const k of [...RECORD_KINDS, ...BLOB_STORES]) if (!db.objectStoreNames.contains(k)) db.createObjectStore(k);
      },
    }).catch((e) => {
      console.warn('IndexedDB unavailable', e);
      storageAvailable = false;
      return null;
    });
  }
  return dbp;
}
const m = (s: string) => (mem[s] ??= new Map());

export async function getAll<T>(store: RecordKind): Promise<T[]> {
  const db = await getDB();
  if (!db) return [...m(store).values()];
  return db.getAll(store);
}
export async function put(store: RecordKind | BlobStore, key: string, value: any) {
  const db = await getDB();
  if (!db) { m(store).set(key, value); return; }
  await db.put(store, value, key);
}
export async function putMany(store: RecordKind, items: { id: string }[]) {
  const db = await getDB();
  if (!db) { items.forEach((i) => m(store).set(i.id, i)); return; }
  const tx = db.transaction(store, 'readwrite');
  for (const i of items) tx.store.put(i, i.id);
  await tx.done;
}
export async function get<T>(store: RecordKind | BlobStore, key: string): Promise<T | undefined> {
  const db = await getDB();
  if (!db) return m(store).get(key);
  return db.get(store, key);
}
export async function del(store: RecordKind | BlobStore, key: string) {
  const db = await getDB();
  if (!db) { m(store).delete(key); return; }
  await db.delete(store, key);
}
export async function allKeys(store: BlobStore): Promise<string[]> {
  const db = await getDB();
  if (!db) return [...m(store).keys()];
  return (await db.getAllKeys(store)) as string[];
}
export async function clearAll() {
  const db = await getDB();
  for (const s of [...RECORD_KINDS, ...BLOB_STORES]) {
    if (db) await db.clear(s); else m(s).clear();
  }
}

// Files (book binaries) keyed by content hash
export const saveFile = (hash: string, blob: Blob) => put('files', hash, blob);
export const loadFile = (hash: string) => get<Blob>('files', hash);
export const hasFile = async (hash: string) => !!(await get<Blob>('files', hash));
export const deleteFile = (hash: string) => del('files', hash);

export const saveCover = (bookId: string, dataUrl: string) => put('covers', bookId, dataUrl);
export const loadCover = (bookId: string) => get<string>('covers', bookId);

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch { return null; }
}
export async function requestPersist(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
export async function isPersisted(): Promise<boolean> {
  try { return (await navigator.storage?.persisted?.()) ?? false; } catch { return false; }
}

export function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; }
}
export function lsSet(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}
