import type { Book } from '../types';
import { shrinkImage } from './parse';
import { askClaude } from './claude';
import { countries } from './world';
import { genreDefs } from './genres';
import { lsGet, lsSet } from './storage';

export interface Suggestion { source: 'openlibrary' | 'claude'; fields: Partial<Book>; cover?: string; label: string }

async function getJson(url: string, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function searchOpenLibrary(book: Book): Promise<Suggestion[]> {
  const params = new URLSearchParams({ limit: '5', fields: 'key,title,author_name,first_publish_year,publisher,isbn,language,subject,cover_i,number_of_pages_median' });
  if (book.isbn) params.set('isbn', book.isbn);
  else { params.set('title', book.title); if (book.authors[0]) params.set('author', book.authors[0]); }
  const data = await getJson('https://openlibrary.org/search.json?' + params);
  const out: Suggestion[] = [];
  for (const d of (data.docs || []).slice(0, 4)) {
    const fields: Partial<Book> = {};
    if (d.author_name?.length) fields.authors = d.author_name.slice(0, 3);
    if (d.first_publish_year) fields.year = String(d.first_publish_year);
    if (d.publisher?.[0]) fields.publisher = d.publisher[0];
    const isbn = (d.isbn || []).find((x: string) => x.length === 13) || d.isbn?.[0];
    if (isbn) fields.isbn = isbn;
    if (d.number_of_pages_median && book.format !== 'pdf') fields.pages = d.number_of_pages_median;
    if (d.subject?.length) fields.tags = d.subject.slice(0, 5);
    try {
      const w = await getJson(`https://openlibrary.org${d.key}.json`, 8000);
      const desc = typeof w.description === 'string' ? w.description : w.description?.value;
      if (desc) fields.description = desc.slice(0, 3000);
    } catch { /* optional */ }
    let cover: string | undefined;
    if (d.cover_i) {
      try {
        const r = await fetch(`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`);
        if (r.ok) cover = await shrinkImage(await r.blob());
      } catch { /* optional */ }
    }
    out.push({ source: 'openlibrary', fields, cover, label: `${d.title}${d.author_name ? ' — ' + d.author_name[0] : ''}${d.first_publish_year ? ' (' + d.first_publish_year + ')' : ''}` });
  }
  return out;
}

export async function askClaudeForBook(book: Book, lang: 'en' | 'ar'): Promise<Suggestion> {
  const prompt = `You help catalogue a personal library. Identify this book and return JSON only.
Book as stored: ${JSON.stringify({ title: book.title, authors: book.authors, language: book.language, year: book.year, publisher: book.publisher, fileName: book.fileName })}
Return an object with these keys (use null when you are not confident — never guess an ISBN):
{"title": string|null (the usual published title in the book's own language), "originalTitle": string|null, "authors": string[]|null (full names, in the book's language), "translator": string|null, "publisher": string|null, "year": string|null (first publication year), "language": "ar"|"en"|other ISO 639-1|null, "countries": string[] (literary origin, choose ids only from: ${countries.map((c) => c.id + '=' + c.en).join(', ')}), "genres": string[] (choose ids only from: ${genreDefs.map((g) => g.id).join(', ')}), "tags": string[] (up to 4 themes, written in ${lang === 'ar' ? 'Arabic' : 'English'}), "description": string|null (2–3 neutral sentences about the book, written in ${lang === 'ar' ? 'Arabic' : 'English'}, no quotations)}`;
  const r = await askClaude(prompt, { json: true });
  const f: Partial<Book> = {};
  if (r && typeof r === 'object') {
    for (const k of ['title', 'originalTitle', 'translator', 'publisher', 'year', 'language', 'description'] as const) if (typeof r[k] === 'string' && r[k].trim()) (f as any)[k] = r[k].trim();
    if (Array.isArray(r.authors) && r.authors.length) f.authors = r.authors.filter((x: any) => typeof x === 'string');
    if (Array.isArray(r.countries)) f.countries = r.countries.filter((x: any) => countries.some((c) => c.id === x));
    if (Array.isArray(r.genres)) f.genres = r.genres.filter((x: any) => genreDefs.some((g) => g.id === x));
    if (Array.isArray(r.tags)) f.tags = r.tags.filter((x: any) => typeof x === 'string').slice(0, 4);
  }
  return { source: 'claude', fields: f, label: 'Claude' };
}

// ---------------- Telegram Bot API ----------------
export interface TgFile { key: string; fileId: string; name: string; size: number; mime?: string; chat: string; date: number; status?: 'queued' | 'downloading' | 'imported' | 'failed' | 'too-big'; error?: string }
interface TgState { offset: number; files: TgFile[]; chats: Record<string, string>; bot?: string }

export const tgState = (): TgState => lsGet<TgState>('ml-telegram', { offset: 0, files: [], chats: {} });
export const tgSave = (s: TgState) => lsSet('ml-telegram', s);

async function tg(token: string, method: string, params: Record<string, string> = {}) {
  if (!/^\d+:[\w-]{20,}$/.test(token.trim())) throw new Error('Invalid bot token format');
  token = token.trim();
  const url = `https://api.telegram.org/bot${token.trim()}/${method}?` + new URLSearchParams(params);
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || 'Telegram error ' + r.status);
  return j.result;
}

export async function tgCheck(token: string) {
  const me = await tg(token, 'getMe');
  const s = tgState(); s.bot = me.username; tgSave(s);
  return me.username as string;
}

const BOOK_EXT = /\.(epub|pdf|txt|fb2|html?|md|mobi|azw3?)$/i;

export async function tgFetch(token: string): Promise<TgState> {
  const s = tgState();
  const updates = await tg(token, 'getUpdates', { offset: String(s.offset), timeout: '0', allowed_updates: JSON.stringify(['message', 'channel_post']) });
  for (const u of updates) {
    s.offset = Math.max(s.offset, u.update_id + 1);
    const msg = u.message || u.channel_post;
    if (!msg) continue;
    const chatTitle = msg.chat.title || msg.chat.username || msg.chat.first_name || String(msg.chat.id);
    s.chats[String(msg.chat.id)] = chatTitle;
    const d = msg.document;
    if (d && (BOOK_EXT.test(d.file_name || '') || /pdf|epub/.test(d.mime_type || ''))) {
      if (!s.files.some((f) => f.fileId === d.file_unique_id || f.key === d.file_unique_id)) {
        s.files.unshift({ key: d.file_unique_id, fileId: d.file_id, name: d.file_name || 'book', size: d.file_size || 0, mime: d.mime_type, chat: chatTitle, date: msg.date * 1000, status: (d.file_size || 0) > 20 * 1024 * 1024 ? 'too-big' : undefined });
      }
    }
  }
  s.files = s.files.slice(0, 500);
  tgSave(s);
  return s;
}

export async function tgDownload(token: string, f: TgFile): Promise<Blob> {
  const info = await tg(token, 'getFile', { file_id: f.fileId });
  const r = await fetch(`https://api.telegram.org/file/bot${token.trim()}/${info.file_path}`);
  if (!r.ok) throw new Error('Download failed ' + r.status);
  return r.blob();
}
