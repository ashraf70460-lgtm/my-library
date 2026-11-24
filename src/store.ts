import { create } from 'zustand';
import type { Annotation, AuthorMeta, Book, BookStatus, Challenge, Collection, JournalEntry, Lang, Session, Settings } from './types';
import { RECORD_KINDS, type RecordKind, getAll, put, del, lsGet, lsSet, deleteFile, storageAvailable } from './lib/storage';
import { translate } from './i18n';

export type Route = { name: string; id?: string; q?: string };

type Maps = {
  books: Record<string, Book>;
  annotations: Record<string, Annotation>;
  sessions: Record<string, Session>;
  journal: Record<string, JournalEntry>;
  collections: Record<string, Collection>;
  authors: Record<string, AuthorMeta>;
  challenges: Record<string, Challenge>;
};

export const defaultSettings: Settings = {
  lang: (typeof navigator !== 'undefined' && navigator.language?.startsWith('ar')) ? 'ar' : 'en',
  appTheme: 'light',
  onboarded: false,
  goal: { type: 'minutes', value: 20 },
  reminders: { enabled: false, time: '21:00', days: [0, 1, 2, 3, 4, 5, 6] },
  defaultSort: 'added',
  defaultView: 'grid',
  reader: {
    theme: 'ivory', fontFamily: 'auto', fontSize: 19, lineHeight: 1.7, margin: 28, width: 680, paraSpacing: 0.8,
    mode: 'scroll', spread: false, direction: 'auto', justify: false, pdfZoom: 1, pdfMode: 'scroll',
  },
  importPrefs: { folderRules: true, newFolderNames: 'new, جديد, جديدة, الجديد', quranFolderNames: 'Quran, قرآن, القرآن, القرآن الكريم', categoryFromFolder: true, authorFromFolder: true },
  sync: true,
  telegram: { token: '', chats: '' },
  booksPerYear: 12,
};

interface Toast { id: number; text: string }

interface State extends Maps {
  ready: boolean;
  settings: Settings;
  route: Route;
  history: Route[];
  readerBookId: string | null;
  readerJump: { chapter?: number; ratio?: number; page?: number; start?: number } | null;
  toasts: Toast[];
  syncState: 'off' | 'connecting' | 'on' | 'syncing' | 'unavailable';
  init: () => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setSettings: (patch: Partial<Settings>) => void;
  navigate: (r: Route) => void;
  back: () => void;
  openReader: (bookId: string, jump?: State['readerJump']) => void;
  closeReader: () => void;
  toast: (text: string) => void;
  upsert: <K extends RecordKind>(kind: K, rec: Maps[K][string], silent?: boolean) => void;
  remove: (kind: RecordKind, id: string) => void;
  applyRemote: (kind: RecordKind, recs: any[]) => void;
  updateBook: (id: string, patch: Partial<Book>) => void;
  setStatus: (id: string, status: BookStatus) => void;
  deleteBook: (id: string) => Promise<void>;
}

type Listener = (kind: RecordKind, rec: any) => void;
const listeners: Listener[] = [];
export const onLocalChange = (l: Listener) => listeners.push(l);

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const useStore = create<State>((set, getS) => ({
  ready: false,
  books: {}, annotations: {}, sessions: {}, journal: {}, collections: {}, authors: {}, challenges: {},
  settings: lsGet('ml-settings', defaultSettings),
  route: { name: 'home' },
  history: [],
  readerBookId: null,
  readerJump: null,
  toasts: [],
  syncState: 'off',

  async init() {
    const s = getS().settings;
    // deep-merge nested prefs added in later versions
    s.reader = { ...defaultSettings.reader, ...s.reader };
    s.importPrefs = { ...defaultSettings.importPrefs, ...s.importPrefs };
    s.goal = { ...defaultSettings.goal, ...s.goal };
    s.reminders = { ...defaultSettings.reminders, ...s.reminders };
    s.telegram = { ...defaultSettings.telegram, ...s.telegram };
    const maps: Partial<Maps> = {};
    for (const k of RECORD_KINDS) {
      const all = await getAll<any>(k);
      const m: Record<string, any> = {};
      for (const r of all) m[r.id] = r;
      (maps as any)[k] = m;
    }
    const hash = location.hash.replace('#', '');
    const route: Route = hash && /^[a-z-]+$/.test(hash) ? { name: hash } : { name: 'home' };
    set({ ...(maps as Maps), settings: { ...s }, ready: true, route });
    void storageAvailable;
  },

  t(key, vars) { return translate(getS().settings.lang, key, vars); },

  setSettings(patch) {
    const settings = { ...getS().settings, ...patch };
    lsSet('ml-settings', settings);
    put('kv', 'settings', settings).catch(() => {});
    set({ settings });
  },

  navigate(r) {
    const { route, history } = getS();
    set({ route: r, history: [...history.slice(-30), route] });
    try {
      const top = ['home', 'books', 'continue', 'authors', 'world', 'genres', 'collections', 'journal', 'notes', 'stats', 'discover', 'import'];
      if (top.includes(r.name)) history_replace('#' + r.name);
    } catch { /* ignore */ }
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
  },
  back() {
    const { history } = getS();
    const prev = history[history.length - 1] ?? { name: 'home' };
    set({ route: prev, history: history.slice(0, -1) });
  },
  openReader(bookId, jump = null) {
    set({ readerBookId: bookId, readerJump: jump });
    getS().updateBook(bookId, { lastOpenedAt: Date.now() });
  },
  closeReader() { set({ readerBookId: null, readerJump: null }); },

  toast(text) {
    const id = Date.now() + Math.random();
    set({ toasts: [...getS().toasts, { id, text }] });
    setTimeout(() => set({ toasts: getS().toasts.filter((x) => x.id !== id) }), 2800);
  },

  upsert(kind, rec, silent) {
    const r = { ...(rec as any), updatedAt: silent ? (rec as any).updatedAt ?? Date.now() : Date.now() };
    set({ [kind]: { ...(getS() as any)[kind], [r.id]: r } } as any);
    put(kind, r.id, r).catch((e) => console.warn(e));
    if (!silent) listeners.forEach((l) => l(kind, r));
  },
  remove(kind, id) {
    const cur = (getS() as any)[kind][id];
    if (!cur) return;
    getS().upsert(kind, { ...cur, deleted: true });
  },
  applyRemote(kind, recs) {
    if (!recs.length) return;
    const map = { ...(getS() as any)[kind] };
    for (const r of recs) {
      const local = map[r.id];
      if (kind === 'books' && local?.toc && !r.toc) r.toc = local.toc;
      map[r.id] = r;
      put(kind, r.id, r).catch(() => {});
    }
    set({ [kind]: map } as any);
  },

  updateBook(id, patch) {
    const b = getS().books[id];
    if (!b) return;
    if (patch.favorite && !b.favorite) patch = { ...patch, favoritedAt: Date.now() };
    getS().upsert('books', { ...b, ...patch });
  },
  setStatus(id, status) {
    const b = getS().books[id];
    if (!b) return;
    const patch: Partial<Book> = { status };
    if (status === 'reading' && !b.startedAt) patch.startedAt = Date.now();
    if (status === 'completed') { patch.completedAt = Date.now(); patch.progress = 1; if (!b.startedAt) patch.startedAt = Date.now(); }
    getS().updateBook(id, patch);
  },
  async deleteBook(id) {
    const s = getS();
    const b = s.books[id];
    if (!b) return;
    s.remove('books', id);
    for (const a of Object.values(s.annotations)) if (a.bookId === id && !a.deleted) s.remove('annotations', a.id);
    for (const c of Object.values(s.collections)) if (c.bookIds.includes(id)) s.upsert('collections', { ...c, bookIds: c.bookIds.filter((x) => x !== id) });
    const others = Object.values(getS().books).some((x) => !x.deleted && x.fileHash === b.fileHash);
    if (!others) await deleteFile(b.fileHash).catch(() => {});
    await del('content', id).catch(() => {});
    await del('covers', id).catch(() => {});
  },
}));

function history_replace(h: string) {
  if (location.hash !== h) history.replaceState(null, '', h);
}

// --- selectors -------------------------------------------------------------
const live = <T extends { deleted?: boolean }>(m: Record<string, T>) => Object.values(m).filter((x) => !x.deleted);
const memo = new WeakMap<object, any[]>();
export function liveList<T extends { deleted?: boolean }>(m: Record<string, T>): T[] {
  let v = memo.get(m);
  if (!v) { v = live(m); memo.set(m, v); }
  return v as T[];
}
export const useBooks = () => liveList(useStore((s) => s.books));
export const useAnnotations = () => liveList(useStore((s) => s.annotations));
export const useSessions = () => liveList(useStore((s) => s.sessions));
export const useJournal = () => liveList(useStore((s) => s.journal));
export const useCollections = () => liveList(useStore((s) => s.collections));
export const useChallenges = () => liveList(useStore((s) => s.challenges));
export const useT = () => { const lang = useStore((s) => s.settings.lang); return (k: string, v?: Record<string, string | number>) => translate(lang, k, v); };
export const useLang = (): Lang => useStore((s) => s.settings.lang);

export function authorKey(name: string) {
  let h = 2166136261;
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ');
  for (let i = 0; i < n.length; i++) { h ^= n.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'a' + (h >>> 0).toString(36);
}
export function useAuthorMeta(name: string): AuthorMeta | undefined {
  return useStore((s) => { const a = s.authors[authorKey(name)]; return a && !a.deleted ? a : undefined; });
}
