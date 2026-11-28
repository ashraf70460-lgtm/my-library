import { create } from 'zustand';
import type { Book, Collection } from '../types';
import { useStore, uid } from '../store';
import { saveFile, saveCover, hasFile } from './storage';
import { extractMetadata, extOf, hashBlob, SUPPORTED, UNSUPPORTED, CHARS_PER_PAGE } from './parse';
import { matchCountryFromName } from './world';
import { genreDefs } from './genres';

export type ImportStatus = 'waiting' | 'reading' | 'done' | 'duplicate' | 'failed' | 'unsupported' | 'relinked';
export interface ImportItem { key: string; name: string; path: string; size: number; status: ImportStatus; bookId?: string; error?: string }

interface ImportState { items: ImportItem[]; running: boolean; lastBatch: string[] }
export const useImport = create<ImportState>(() => ({ items: [], running: false, lastBatch: [] }));

const queue: { file: File | Blob; name: string; path: string; key: string }[] = [];

function setItem(key: string, patch: Partial<ImportItem>) {
  useImport.setState((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
}

export function enqueue(files: { file: File | Blob; name: string; path?: string }[]) {
  const newItems: ImportItem[] = [];
  for (const f of files) {
    if (f.name.startsWith('.') || /^(thumbs\.db|desktop\.ini)$/i.test(f.name)) continue;
    const ext = extOf(f.name);
    const key = uid('q');
    const path = f.path || f.name;
    if (!SUPPORTED[ext]) {
      if (UNSUPPORTED.includes(ext)) newItems.push({ key, name: f.name, path, size: f.file.size, status: 'unsupported' });
      continue;
    }
    newItems.push({ key, name: f.name, path, size: f.file.size, status: 'waiting' });
    queue.push({ file: f.file, name: f.name, path, key });
  }
  useImport.setState((s) => ({ items: [...newItems, ...s.items].slice(0, 3000) }));
  if (!useImport.getState().running) void run();
  return newItems.length;
}

async function run() {
  useImport.setState({ running: true, lastBatch: [] });
  const known = new Map<string, Book>();
  for (const b of Object.values(useStore.getState().books)) if (!b.deleted) known.set(b.fileHash, b);
  let n = 0;
  while (queue.length) {
    const job = queue.shift()!;
    setItem(job.key, { status: 'reading' });
    try {
      const hash = await hashBlob(job.file);
      const existing = known.get(hash);
      if (existing) {
        if (!(await hasFile(hash))) {
          await saveFile(hash, job.file);
          setItem(job.key, { status: 'relinked', bookId: existing.id });
        } else setItem(job.key, { status: 'duplicate', bookId: existing.id });
        continue;
      }
      const book = await importOne(job.file, job.name, job.path, hash);
      known.set(hash, book);
      setItem(job.key, { status: 'done', bookId: book.id });
      useImport.setState((s) => ({ lastBatch: [book.id, ...s.lastBatch].slice(0, 60) }));
    } catch (e: any) {
      console.warn('import failed', job.name, e);
      setItem(job.key, { status: 'failed', error: String(e?.message || e).slice(0, 140) });
    }
    if (++n % 3 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  useImport.setState({ running: false });
}

const splitList = (s: string) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

async function importOne(file: Blob, name: string, path: string, hash: string): Promise<Book> {
  const st = useStore.getState();
  const prefs = st.settings.importPrefs;
  const parsed = await extractMetadata(file, name);
  const m = parsed.meta;
  const id = uid('b');
  const book: Book = {
    id, updatedAt: Date.now(),
    title: (m.title || name).trim(),
    authors: (m.authors || []).map((a) => a.trim()).filter(Boolean),
    genres: m.genres || [], tags: [], countries: [],
    format: SUPPORTED[extOf(name)], fileHash: hash, fileName: name, fileSize: file.size,
    hasCover: !!parsed.cover, status: 'unread', favorite: false, addedAt: Date.now(), progress: 0,
    toc: parsed.toc,
    language: m.language, publisher: m.publisher, year: m.year, isbn: m.isbn, description: m.description, translator: m.translator,
    rtl: m.rtl || m.language === 'ar' || undefined,
  };
  if ((m as any).unverified?.length) book.unverified = (m as any).unverified;
  if (m.pages) book.pages = m.pages;
  else if (parsed.chars) { book.pages = Math.max(1, Math.round(parsed.chars / CHARS_PER_PAGE)); book.pagesEstimated = true; book.chars = parsed.chars; }

  // Folder rules: follow the user's own shelf organisation.
  const segs = path.split('/').slice(0, -1);
  if (segs.length) book.sourceFolder = segs.join(' / ');
  let quran = false;
  if (prefs.folderRules && segs.length) {
    const newNames = splitList(prefs.newFolderNames);
    const quranNames = splitList(prefs.quranFolderNames);
    let authorSeg: string | undefined;
    segs.forEach((seg, i) => {
      const s = seg.trim().toLowerCase();
      if (newNames.includes(s)) { book.status = 'want'; return; }
      if (quranNames.some((qn) => s === qn || s.includes(qn))) { quran = true; return; }
      const country = matchCountryFromName(seg);
      if (country) { if (prefs.categoryFromFolder && !book.countries.includes(country)) book.countries.push(country); return; }
      const genre = genreDefs.find((g) => g.en.toLowerCase() === s || g.ar === seg.trim() || (g.ar.length > 3 && seg.includes(g.ar)));
      if (genre) { if (!book.genres.includes(genre.id)) book.genres.push(genre.id); return; }
      if (i > 0) authorSeg = seg.trim(); // the first folder is the chosen root (e.g. the whole library)
    });
    if (prefs.authorFromFolder && authorSeg && (book.format === 'pdf' || !book.authors.length)) {
      if (!book.authors.some((a) => a.toLowerCase() === authorSeg!.toLowerCase())) book.authors = [authorSeg];
      book.unverified = book.unverified?.filter((x) => x !== 'authors'); // the user's own folder names the author
    }
  }
  if (quran) { if (!book.genres.includes('religion')) book.genres.push('religion'); }

  await saveFile(hash, file);
  if (parsed.cover) await saveCover(id, parsed.cover);
  st.upsert('books', book);

  if (quran) {
    const qName = st.t('col.quran');
    const cols = Object.values(useStore.getState().collections).filter((c) => !c.deleted);
    let col: Collection | undefined = cols.find((c) => c.special === 'quran' || c.name === qName || c.name === 'القرآن الكريم' || c.name === 'The Holy Quran');
    if (!col) col = { id: uid('c'), updatedAt: Date.now(), name: qName, special: 'quran', bookIds: [], pinned: true, createdAt: Date.now(), color: '#2f5d46' };
    useStore.getState().upsert('collections', { ...col, bookIds: [...col.bookIds, id] });
  }
  return book;
}

// Gather files from a drop event, including folders.
export async function filesFromDrop(dt: DataTransfer): Promise<{ file: File; name: string; path: string }[]> {
  const out: { file: File; name: string; path: string }[] = [];
  const items = Array.from(dt.items || []);
  const entries = items.map((i) => (i as any).webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) {
    for (const f of Array.from(dt.files)) out.push({ file: f, name: f.name, path: f.name });
    return out;
  }
  const walk = async (entry: any, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const f: File = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file: f, name: f.name, path: prefix + f.name });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch: any[];
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const e of batch) await walk(e, prefix + entry.name + '/');
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e, '');
  return out;
}

export function filesFromInput(list: FileList | null) {
  return Array.from(list || []).map((f) => ({ file: f, name: f.name, path: (f as any).webkitRelativePath || f.name }));
}

export async function importFromUrl(url: string, onProgress: (p: number) => void): Promise<number> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) links');
  const res = await fetch(u.href);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      if (total) onProgress(got / total);
      if (got > 300 * 1024 * 1024) throw new Error('File too large');
    }
  }
  const blob = reader ? new Blob(chunks as BlobPart[]) : await res.blob();
  let name = decodeURIComponent(u.pathname.split('/').pop() || 'book');
  const cd = res.headers.get('content-disposition');
  const m = cd?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (m) name = decodeURIComponent(m[1]);
  if (!SUPPORTED[extOf(name)]) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('epub')) name += '.epub'; else if (ct.includes('pdf')) name += '.pdf'; else if (ct.includes('html')) name += '.html'; else if (ct.includes('text')) name += '.txt';
    else throw new Error('Not a supported book file');
  }
  return enqueue([{ file: blob, name, path: name }]);
}
