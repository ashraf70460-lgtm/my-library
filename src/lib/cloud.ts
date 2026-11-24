// Cloud shelf: share books and reading data between your devices through the app's own
// Vercel deployment (private Blob storage + /api/cloud). Not available inside the Claude-hosted page.
import { create } from 'zustand';
import { upload } from '@vercel/blob/client';
import { useStore, onLocalChange } from '../store';
import { RECORD_KINDS, type RecordKind, lsGet, lsSet, loadFile, saveFile, hasFile, loadCover, saveCover, allKeys } from './storage';
import { isHostedByClaude } from './claude';
import type { Book } from '../types';

export interface CloudConfig { key: string; autoUpload: 'off' | 'reading' | 'all' }
interface CloudState {
  status: 'off' | 'connecting' | 'on' | 'syncing' | 'error';
  error?: string;
  lastSync?: number;
  uploads: Record<string, number>; // bookId -> progress 0..1
  downloads: Record<string, number>;
  usage?: { size: number; count: number };
}
export const CLOUD_LIMIT = 1024 ** 3; // Vercel Hobby includes 1 GB of Blob storage
const cfgKey = 'ml-cloud';
export const cloudConfig = () => lsGet<CloudConfig>(cfgKey, { key: '', autoUpload: 'reading' });
export const useCloud = create<CloudState>(() => ({ status: 'off', uploads: {}, downloads: {} }));
export const cloudSupported = () => !isHostedByClaude();
export const cloudReady = () => useCloud.getState().status === 'on' || useCloud.getState().status === 'syncing';

const headers = () => ({ 'x-library-key': cloudConfig().key, 'Content-Type': 'application/json' });
const dirty = new Map<string, { kind: RecordKind; id: string }>();
const dirtyCovers = new Set<string>();
let timer: any = null;
let pushing = false;
let applying = false;

async function api(op: string, init: RequestInit = {}, extra = '') {
  const r = await fetch(`/api/cloud?op=${op}${extra}`, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
  if (r.status === 401) throw new Error('unauthorized');
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'HTTP ' + r.status);
  return r;
}

export async function connectCloud(key: string, autoUpload?: CloudConfig['autoUpload']) {
  lsSet(cfgKey, { ...cloudConfig(), key: key.trim(), ...(autoUpload ? { autoUpload } : {}) });
  return startCloud();
}
export function setAutoUpload(v: CloudConfig['autoUpload']) { lsSet(cfgKey, { ...cloudConfig(), autoUpload: v }); }
export function disconnectCloud() { lsSet(cfgKey, { ...cloudConfig(), key: '' }); useCloud.setState({ status: 'off', error: undefined }); }

export async function startCloud(): Promise<boolean> {
  if (!cloudSupported() || !cloudConfig().key) { useCloud.setState({ status: 'off' }); return false; }
  useCloud.setState({ status: 'connecting', error: undefined });
  try {
    await api('ping');
    useCloud.setState({ status: 'on' });
    await pullCloud();
    return true;
  } catch (e: any) {
    useCloud.setState({ status: 'error', error: e?.message === 'unauthorized' ? 'unauthorized' : navigator.onLine ? String(e?.message || e) : 'offline' });
    return false;
  }
}

/** Download the shared state and merge it into this device (newest edit of each record wins). */
export async function pullCloud() {
  if (!cloudReady()) return;
  useCloud.setState({ status: 'syncing' });
  try {
    const remote: Record<string, Record<string, any>> = await (await api('state')).json();
    const st = useStore.getState();
    applying = true;
    for (const kind of RECORD_KINDS) {
      const rmap = remote[kind] || {};
      const lmap: Record<string, any> = (st as any)[kind];
      const newer = Object.values(rmap).filter((r: any) => !lmap[r.id] || (r.updatedAt || 0) > (lmap[r.id].updatedAt || 0));
      useStore.getState().applyRemote(kind, newer);
      for (const r of Object.values(lmap)) {
        const rr = rmap[r.id];
        if (!rr || (r.updatedAt || 0) > (rr.updatedAt || 0)) dirty.set(`${kind}/${r.id}`, { kind, id: r.id });
      }
    }
    applying = false;
    await pullCovers();
    await flushCloud();
    useCloud.setState({ status: 'on', lastSync: Date.now() });
  } catch (e: any) {
    applying = false;
    useCloud.setState({ status: 'error', error: String(e?.message || e) });
  }
}

const shardOf = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h) % 16; };

async function pullCovers() {
  const have = new Set(await allKeys('covers'));
  const books = Object.values(useStore.getState().books).filter((b) => !b.deleted);
  const missing = books.filter((b) => b.hasCover && !have.has(b.id));
  const shards = [...new Set(missing.map((b) => shardOf(b.id)))];
  for (const n of shards) {
    try {
      const covers: Record<string, string> = await (await api('covers', {}, `&n=${n}`)).json();
      for (const b of missing) if (shardOf(b.id) === n && covers[b.id]) await saveCover(b.id, covers[b.id]);
    } catch { /* covers are optional */ }
  }
  if (missing.length) useStore.setState((s) => ({ books: { ...s.books } }));
  // covers this device has that the cloud may lack (first connection)
  if (!cloudConfig().key) return;
  const pushedKey = 'ml-cloud-covers';
  const pushed = new Set(lsGet<{ ids: string[] }>(pushedKey, { ids: [] }).ids);
  for (const b of books) if (b.hasCover && have.has(b.id) && !pushed.has(b.id)) dirtyCovers.add(b.id);
}

/** Send pending changes now. */
export async function flushCloud() {
  if (!cloudReady() || pushing || (!dirty.size && !dirtyCovers.size)) return;
  pushing = true;
  try {
    const st = useStore.getState();
    const items = [...dirty.values()];
    dirty.clear();
    // batch to stay well under the function body limit
    let batch: Record<string, any[]> = {}; let size = 0;
    const send = async () => { if (size) await api('state', { method: 'POST', body: JSON.stringify(batch) }); batch = {}; size = 0; };
    for (const { kind, id } of items) {
      const rec = (st as any)[kind][id];
      if (!rec) continue;
      const r = kind === 'books' ? (({ toc, ...rest }) => rest)(rec) : rec;
      const len = JSON.stringify(r).length;
      if (size + len > 1_500_000) await send();
      (batch[kind] ||= []).push(r); size += len;
    }
    await send();
    if (dirtyCovers.size) {
      const byShard = new Map<number, Record<string, string>>();
      for (const id of dirtyCovers) {
        const c = await loadCover(id);
        if (!c) continue;
        const n = shardOf(id);
        if (!byShard.has(n)) byShard.set(n, {});
        byShard.get(n)![id] = c;
      }
      const done = [...dirtyCovers];
      dirtyCovers.clear();
      for (const [n, covers] of byShard) await api('covers', { method: 'POST', body: JSON.stringify(covers) }, `&n=${n}`);
      const pushedKey = 'ml-cloud-covers';
      const prev = lsGet<{ ids: string[] }>(pushedKey, { ids: [] }).ids;
      lsSet(pushedKey, { ids: [...new Set([...prev, ...done])] });
    }
    useCloud.setState({ lastSync: Date.now() });
  } catch (e: any) {
    useCloud.setState({ error: String(e?.message || e) });
  } finally {
    pushing = false;
  }
}

export function markCoverDirty(bookId: string) { dirtyCovers.add(bookId); schedule(); }

function schedule(ms = 90_000) {
  clearTimeout(timer);
  timer = setTimeout(flushCloud, ms);
}

onLocalChange((kind, rec) => {
  if (applying || !cloudConfig().key) return;
  dirty.set(`${kind}/${rec.id}`, { kind, id: rec.id });
  schedule();
  if (kind === 'books') {
    const pushed = new Set(lsGet<{ ids: string[] }>('ml-cloud-covers', { ids: [] }).ids);
    if ((rec as Book).hasCover && !pushed.has(rec.id)) dirtyCovers.add(rec.id);
    autoUpload(rec as Book);
  }
});

if (typeof document !== 'undefined') {
  let lastPull = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushCloud();
    else if (cloudReady() && Date.now() - lastPull > 5 * 60_000) { lastPull = Date.now(); pullCloud(); }
  });
  useStore.subscribe((s, prev) => { if (prev.readerBookId && !s.readerBookId) flushCloud(); });
}

// ---------------- book files ----------------
const queue: Book[] = [];
let uploading = false;

function autoUpload(b: Book) {
  if (b.deleted || b.cloud || !cloudReady()) return;
  const mode = cloudConfig().autoUpload;
  if (mode === 'all' || (mode === 'reading' && b.status === 'reading')) enqueueUpload(b);
}

export function enqueueUpload(b: Book) {
  if (queue.some((q) => q.id === b.id) || useCloud.getState().uploads[b.id] != null) return;
  queue.push(b);
  useCloud.setState((s) => ({ uploads: { ...s.uploads, [b.id]: 0 } }));
  if (!uploading) void runUploads();
}

async function runUploads() {
  uploading = true;
  while (queue.length) {
    const b = queue.shift()!;
    try { await uploadBook(b); } catch (e: any) { useCloud.setState({ error: `${b.title}: ${e?.message || e}` }); }
    useCloud.setState((s) => { const u = { ...s.uploads }; delete u[b.id]; return { uploads: u }; });
  }
  uploading = false;
}

async function uploadBook(b: Book) {
  const file = await loadFile(b.fileHash);
  if (!file) throw new Error('file not on this device');
  await upload(`library/books/${b.fileHash}`, file, {
    access: 'private',
    handleUploadUrl: '/api/cloud?op=upload',
    clientPayload: cloudConfig().key,
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: (p: { percentage: number }) => useCloud.setState((s) => ({ uploads: { ...s.uploads, [b.id]: p.percentage / 100 } })),
  } as any);
  const cur = useStore.getState().books[b.id];
  if (cur) useStore.getState().updateBook(b.id, { cloud: true });
  markCoverDirty(b.id);
}

export async function downloadBook(b: Book): Promise<Blob> {
  useCloud.setState((s) => ({ downloads: { ...s.downloads, [b.id]: 0 } }));
  try {
    const r = await api('file', {}, `&hash=${b.fileHash}`);
    const total = Number(r.headers.get('content-length')) || b.fileSize || 0;
    const reader = r.body!.getReader();
    const chunks: Uint8Array[] = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      if (total) useCloud.setState((s) => ({ downloads: { ...s.downloads, [b.id]: got / total } }));
    }
    const blob = new Blob(chunks as BlobPart[]);
    await saveFile(b.fileHash, blob);
    return blob;
  } finally {
    useCloud.setState((s) => { const d = { ...s.downloads }; delete d[b.id]; return { downloads: d }; });
  }
}

export async function removeFromCloud(b: Book) {
  await api('file', { method: 'POST' }, `&hash=${b.fileHash}&delete=1`);
  useStore.getState().updateBook(b.id, { cloud: false });
}

export async function cloudUsage() {
  try { const u = await (await api('usage')).json(); useCloud.setState({ usage: u }); return u; } catch { return null; }
}

export async function uploadAllReading() {
  for (const b of Object.values(useStore.getState().books)) if (!b.deleted && !b.cloud && b.status === 'reading' && (await hasFile(b.fileHash))) enqueueUpload(b);
}
