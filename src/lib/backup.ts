import JSZip from 'jszip';
import { useStore } from '../store';
import { RECORD_KINDS, loadFile, saveFile as storeFile, saveCover, loadCover, putMany, clearAll } from './storage';
import { countryName } from './world';
import { genreLabel } from './genres';
import { pull } from './sync';

export function exportJson(): string {
  const s = useStore.getState();
  const data: any = { app: 'my-library', version: 1, exportedAt: new Date().toISOString(), settings: { ...s.settings, telegram: { ...s.settings.telegram, token: '' } } };
  for (const k of RECORD_KINDS) data[k] = Object.values((s as any)[k]);
  return JSON.stringify(data, null, 1);
}

const csvCell = (v: any) => { const x = v == null ? '' : String(v); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
const csv = (rows: any[][]) => '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n');

export function exportBooksCsv(): string {
  const s = useStore.getState();
  const lang = s.settings.lang;
  const books = Object.values(s.books).filter((b) => !b.deleted);
  return csv([
    ['title', 'authors', 'translator', 'publisher', 'year', 'isbn', 'language', 'countries', 'genres', 'tags', 'status', 'progress_%', 'favorite', 'rating', 'pages', 'format', 'file', 'folder', 'added', 'started', 'completed'],
    ...books.map((b) => [b.title, b.authors.join('; '), b.translator, b.publisher, b.year, b.isbn, b.language, b.countries.map((c) => countryName(c, lang)).join('; '), b.genres.map((g) => genreLabel(g, lang)).join('; '), b.tags.join('; '), b.status, Math.round(b.progress * 100), b.favorite ? 'yes' : '', b.rating || '', b.pages || '', b.format, b.fileName, b.sourceFolder || '', iso(b.addedAt), iso(b.startedAt), iso(b.completedAt)]),
  ]);
}
const iso = (n?: number) => (n ? new Date(n).toISOString().slice(0, 10) : '');

export function exportHistoryCsv(): string {
  const s = useStore.getState();
  const rows = Object.values(s.sessions).filter((x) => !x.deleted).sort((a, b) => a.start - b.start);
  return csv([['date', 'start', 'minutes', 'pages', 'chapters', 'book', 'authors'], ...rows.map((x) => [x.day, new Date(x.start).toISOString(), Math.round(x.seconds / 6) / 10, x.pages, x.chapters, s.books[x.bookId]?.title || '', s.books[x.bookId]?.authors.join('; ') || ''])]);
}

export function exportNotesMd(): string {
  const s = useStore.getState();
  const ann = Object.values(s.annotations).filter((a) => !a.deleted);
  const byBook = new Map<string, typeof ann>();
  for (const a of ann) { if (!byBook.has(a.bookId)) byBook.set(a.bookId, []); byBook.get(a.bookId)!.push(a); }
  let out = `# ${s.t('an.title')} — ${s.t('brand')}\n\n`;
  for (const [bid, list] of byBook) {
    const b = s.books[bid]; if (!b || b.deleted) continue;
    out += `## ${b.title}${b.authors.length ? ' — ' + b.authors.join(', ') : ''}\n\n`;
    for (const a of list.sort((x, y) => (x.chapter ?? 0) - (y.chapter ?? 0) || (x.start ?? 0) - (y.start ?? 0))) {
      const where = a.target === 'author' ? a.author : a.chapterLabel || (a.page ? `p. ${a.page}` : '');
      if (a.kind === 'bookmark') out += `- 🔖 ${where || ''}${a.text ? ': ' + a.text : ''}\n`;
      else {
        if (a.text) out += `> ${a.text.replace(/\n/g, '\n> ')}\n`;
        if (a.note) out += `\n${a.note}\n`;
        out += `\n<sub>${where ? where + ' · ' : ''}${iso(a.createdAt)}${a.color ? ' · ' + a.color : ''}</sub>\n\n`;
      }
    }
    out += '\n';
  }
  return out;
}

export async function fullBackupZip(onProgress?: (p: number) => void): Promise<Blob> {
  const s = useStore.getState();
  const zip = new JSZip();
  zip.file('library.json', exportJson());
  const books = Object.values(s.books).filter((b) => !b.deleted);
  const seen = new Set<string>();
  let i = 0;
  for (const b of books) {
    if (!seen.has(b.fileHash)) {
      seen.add(b.fileHash);
      const f = await loadFile(b.fileHash);
      if (f) zip.file(`files/${b.fileHash}`, f);
    }
    const c = await loadCover(b.id);
    if (c) zip.file(`covers/${b.id}.txt`, c);
    onProgress?.(++i / books.length);
  }
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}

export async function restoreBackup(file: File): Promise<number> {
  let data: any;
  let zip: JSZip | null = null;
  if (/\.zip$/i.test(file.name)) {
    zip = await JSZip.loadAsync(file);
    data = JSON.parse(await zip.file('library.json')!.async('string'));
  } else data = JSON.parse(await file.text());
  if (data?.app !== 'my-library') throw new Error('Not a My Library backup');
  const s = useStore.getState();
  let n = 0;
  for (const k of RECORD_KINDS) {
    const incoming: any[] = data[k] || [];
    const cur = (s as any)[k] as Record<string, any>;
    const newer = incoming.filter((r) => r?.id && (!cur[r.id] || (r.updatedAt || 0) >= (cur[r.id].updatedAt || 0)));
    await putMany(k, newer);
    useStore.getState().applyRemote(k, newer);
    n += newer.length;
  }
  if (zip) {
    for (const name of Object.keys(zip.files)) {
      if (name.startsWith('files/') && !zip.files[name].dir) await storeFile(name.slice(6), await zip.file(name)!.async('blob'));
      if (name.startsWith('covers/')) await saveCover(name.slice(7).replace(/\.txt$/, ''), await zip.file(name)!.async('string'));
    }
  }
  if (data.settings) useStore.getState().setSettings({ ...data.settings, telegram: s.settings.telegram, onboarded: true });
  pull().catch(() => {});
  return n;
}

export async function wipeEverything() {
  await clearAll();
  try { localStorage.clear(); } catch { /* */ }
  location.reload();
}
