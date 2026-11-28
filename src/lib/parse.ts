import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { Book, BookFormat, TocItem } from '../types';
import { normalizeGenre } from './genres';
import { getPdfjs, pdfDocOptions } from './pdf';

export interface Chapter { title: string; html: string; text: string }
export interface FlowContent { kind: 'flow'; chapters: Chapter[]; toc: TocItem[]; cleanup: () => void }
export interface ParsedMeta {
  meta: Partial<Book>;
  cover?: string; // data URL
  toc: TocItem[];
  chars?: number;
}

export const SUPPORTED: Record<string, BookFormat> = { epub: 'epub', pdf: 'pdf', txt: 'txt', text: 'txt', html: 'html', htm: 'html', xhtml: 'html', md: 'md', markdown: 'md', fb2: 'fb2', docx: 'docx' };
export const UNSUPPORTED = ['mobi', 'azw', 'azw3', 'kfx', 'prc', 'djvu', 'cbz', 'cbr', 'doc', 'rtf'];
export const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase();
export const CHARS_PER_PAGE = 1600;

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
export function detectLang(text: string): string | undefined {
  const sample = text.slice(0, 6000);
  const letters = sample.replace(/[\s\d\p{P}]/gu, '').length;
  if (!letters) return undefined;
  const ar = (sample.match(ARABIC) || []).length;
  if (ar / letters > 0.3) return 'ar';
  if (/[a-z]/i.test(sample)) return 'en';
  return undefined;
}

export async function hashBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  try {
    const d = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(d)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    const u = new Uint8Array(buf);
    let h = 2166136261;
    const step = Math.max(1, Math.floor(u.length / 200000));
    for (let i = 0; i < u.length; i += step) { h ^= u[i]; h = Math.imul(h, 16777619); }
    return 'f' + (h >>> 0).toString(16) + u.length.toString(16);
  }
}

export function decodeText(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); } catch { /* not utf-8 */ }
  try { return new TextDecoder('windows-1256').decode(buf); } catch { return new TextDecoder().decode(buf); }
}

/** Guess title/author from file names like "Author - Title.pdf" or "Title _ Author". */
export function guessFromFileName(fileName: string): { title: string; author?: string } {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = base.split(/\s[-–—]\s/);
  if (parts.length === 2) return { title: parts[0].trim(), author: parts[1].trim() };
  return { title: base };
}

const URI_RE = /^(?:(?:https?|mailto|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;
const sanitize = (html: string) =>
  DOMPurify.sanitize(html, {
    ALLOWED_URI_REGEXP: URI_RE,
    FORBID_TAGS: ['style', 'script', 'link', 'meta', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style', 'class', 'id', 'onclick'],
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: ['data-href', 'data-anchor'],
  });

const textOf = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
};

function makeChapter(title: string, html: string): Chapter {
  const clean = sanitize(html);
  return { title, html: clean, text: textOf(clean) };
}

// ---------- EPUB ----------
function resolvePath(base: string, rel: string) {
  if (/^[a-z]+:/i.test(rel)) return rel;
  const stack = base.split('/');
  stack.pop();
  for (const part of decodeURIComponent(rel).split('/')) {
    if (part === '..') stack.pop();
    else if (part !== '.' && part !== '') stack.push(part);
  }
  return stack.join('/');
}
const q = (el: Element | Document, local: string) => Array.from(el.getElementsByTagNameNS('*', local));
const first = (el: Element | Document, local: string) => q(el, local)[0]?.textContent?.trim() || undefined;

async function openEpub(blob: Blob, withContent: boolean) {
  const zip = await JSZip.loadAsync(blob);
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  const opfPath = containerXml?.match(/full-path="([^"]+)"/)?.[1] ?? Object.keys(zip.files).find((f) => f.endsWith('.opf'));
  if (!opfPath) throw new Error('No OPF');
  const opf = new DOMParser().parseFromString(await zip.file(opfPath)!.async('string'), 'application/xml');
  const manifest = new Map<string, { href: string; type: string; props: string }>();
  for (const it of q(opf, 'item')) {
    manifest.set(it.getAttribute('id')!, { href: resolvePath(opfPath, it.getAttribute('href')!), type: it.getAttribute('media-type') || '', props: it.getAttribute('properties') || '' });
  }
  const spineEl = q(opf, 'spine')[0];
  const spine = q(opf, 'itemref').filter((r) => r.getAttribute('linear') !== 'no').map((r) => manifest.get(r.getAttribute('idref')!)?.href).filter(Boolean) as string[];

  // metadata
  const meta: Partial<Book> = {};
  meta.title = first(opf, 'title');
  meta.authors = q(opf, 'creator').map((e) => e.textContent!.trim()).filter(Boolean);
  const contributors = q(opf, 'contributor').filter((e) => /trl/.test(e.getAttribute('opf:role') || e.getAttribute('role') || ''));
  if (contributors[0]) meta.translator = contributors[0].textContent!.trim();
  meta.language = first(opf, 'language')?.slice(0, 2).toLowerCase();
  meta.publisher = first(opf, 'publisher');
  const date = first(opf, 'date');
  if (date) meta.year = date.match(/\d{4}/)?.[0];
  for (const idEl of q(opf, 'identifier')) {
    const v = idEl.textContent?.replace(/[^0-9Xx]/g, '') || '';
    if ((v.length === 13 && /^97[89]/.test(v)) || v.length === 10) { meta.isbn = v; break; }
  }
  const desc = first(opf, 'description');
  if (desc) meta.description = textOf(desc).trim().slice(0, 4000);
  meta.genres = [...new Set(q(opf, 'subject').map((e) => normalizeGenre(e.textContent || '')).filter(Boolean))].slice(0, 6);
  const ppd = spineEl?.getAttribute('page-progression-direction');
  if (ppd === 'rtl') meta.rtl = true;

  // cover
  let coverHref: string | undefined;
  const coverMeta = q(opf, 'meta').find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content');
  if (coverMeta && manifest.get(coverMeta)?.type.startsWith('image')) coverHref = manifest.get(coverMeta)!.href;
  if (!coverHref) coverHref = [...manifest.values()].find((m) => m.props.includes('cover-image'))?.href;
  if (!coverHref) coverHref = [...manifest.entries()].find(([id, m]) => /cover/i.test(id + m.href) && m.type.startsWith('image'))?.[1].href;

  // toc
  const hrefToTitle = new Map<string, string>();
  const tocRaw: { label: string; href: string; level: number }[] = [];
  const navItem = [...manifest.values()].find((m) => m.props.split(/\s+/).includes('nav'));
  if (navItem && zip.file(navItem.href)) {
    const nav = new DOMParser().parseFromString(await zip.file(navItem.href)!.async('string'), 'application/xhtml+xml');
    const tocNav = q(nav, 'nav').find((n) => (n.getAttribute('epub:type') || n.getAttributeNS('http://www.idpf.org/2007/ops', 'type') || '').includes('toc')) || q(nav, 'nav')[0];
    if (tocNav) for (const a of q(tocNav, 'a')) {
      let level = 0; let p = a.parentElement; while (p && p !== tocNav) { if (p.localName === 'ol') level++; p = p.parentElement; }
      const href = a.getAttribute('href'); if (href) tocRaw.push({ label: a.textContent!.trim(), href: resolvePath(navItem.href, href), level: Math.max(0, level - 1) });
    }
  }
  if (!tocRaw.length) {
    const ncxId = spineEl?.getAttribute('toc');
    const ncx = (ncxId && manifest.get(ncxId)) || [...manifest.values()].find((m) => m.type.includes('dtbncx'));
    if (ncx && zip.file(ncx.href)) {
      const doc = new DOMParser().parseFromString(await zip.file(ncx.href)!.async('string'), 'application/xml');
      const walk = (el: Element, level: number) => {
        for (const np of Array.from(el.children).filter((c) => c.localName === 'navPoint')) {
          const label = first(np, 'text') || '';
          const src = q(np, 'content')[0]?.getAttribute('src');
          if (src) tocRaw.push({ label, href: resolvePath(ncx.href, src), level });
          walk(np, level + 1);
        }
      };
      const navMap = q(doc, 'navMap')[0];
      if (navMap) walk(navMap, 0);
    }
  }
  const toc: TocItem[] = [];
  for (const t of tocRaw) {
    const file = t.href.split('#')[0];
    const idx = spine.indexOf(file);
    if (idx >= 0) { toc.push({ label: t.label, chapter: idx, level: t.level }); if (!hrefToTitle.has(file)) hrefToTitle.set(file, t.label); }
  }

  const urls: string[] = [];
  let cover: string | undefined;
  if (coverHref && zip.file(coverHref)) {
    const b = await zip.file(coverHref)!.async('blob');
    cover = await shrinkImage(b);
  }

  const chapters: Chapter[] = [];
  let chars = 0;
  for (let i = 0; i < spine.length; i++) {
    const href = spine[i];
    const f = zip.file(href);
    if (!f) continue;
    const raw = await f.async('string');
    let doc = new DOMParser().parseFromString(raw, 'application/xhtml+xml');
    if (doc.getElementsByTagName('parsererror').length) doc = new DOMParser().parseFromString(raw, 'text/html');
    const body = doc.getElementsByTagName('body')[0] || doc.documentElement;
    if (withContent) {
      for (const img of [...Array.from(body.getElementsByTagName('img')), ...Array.from(body.getElementsByTagName('image'))]) {
        const src = img.getAttribute('src') || img.getAttribute('xlink:href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (!src) continue;
        const path = resolvePath(href, src);
        const zf = zip.file(path);
        if (zf) {
          const ext = extOf(path);
          const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const u = URL.createObjectURL(new Blob([await zf.async('arraybuffer')], { type: mime }));
          urls.push(u);
          if (img.localName === 'image') {
            const nimg = doc.createElement('img'); nimg.setAttribute('src', u);
            const svg = img.closest('svg'); (svg || img).replaceWith(nimg);
          } else img.setAttribute('src', u);
        }
      }
      for (const a of Array.from(body.getElementsByTagName('a'))) {
        const h = a.getAttribute('href');
        if (!h) continue;
        if (/^https?:/i.test(h)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); continue; }
        const [file, anchor] = h.split('#');
        const target = file ? spine.indexOf(resolvePath(href, file)) : i;
        a.removeAttribute('href');
        a.setAttribute('data-href', String(target));
        if (anchor) a.setAttribute('data-anchor', anchor);
      }
      // keep element ids for anchors as data-anchor-id
      for (const el of Array.from(body.querySelectorAll('[id]'))) el.setAttribute('data-aid', el.getAttribute('id')!);
    }
    const html = body.innerHTML;
    const title = hrefToTitle.get(href) || body.querySelector('h1,h2,h3')?.textContent?.trim() || '';
    if (withContent) {
      const clean = DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'script', 'link', 'meta', 'iframe', 'object', 'embed', 'form', 'input', 'button'], FORBID_ATTR: ['style', 'class', 'onclick'], ALLOW_DATA_ATTR: true, ALLOWED_URI_REGEXP: URI_RE });
      const text = textOf(clean);
      chars += text.length;
      chapters.push({ title, html: clean, text });
    } else {
      chars += (body.textContent || '').length;
    }
  }
  return { meta, cover, toc, chapters, chars, cleanup: () => urls.forEach((u) => URL.revokeObjectURL(u)) };
}

// ---------- FB2 ----------
function fb2ToHtml(el: Element, binaries: Map<string, string>): string {
  const map: Record<string, string> = { p: 'p', emphasis: 'em', strong: 'strong', epigraph: 'blockquote', cite: 'blockquote', 'text-author': 'p', subtitle: 'h3', v: 'p', stanza: 'div', poem: 'div', 'empty-line': 'br', strikethrough: 's', sub: 'sub', sup: 'sup', code: 'code', table: 'table', tr: 'tr', td: 'td', th: 'th' };
  let out = '';
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) { out += escapeHtml(n.textContent || ''); continue; }
    if (n.nodeType !== 1) continue;
    const e = n as Element;
    const tag = e.localName;
    if (tag === 'title') { out += `<h2>${fb2ToHtml(e, binaries).replace(/<\/?p>/g, ' ')}</h2>`; continue; }
    if (tag === 'image') {
      const href = (e.getAttribute('l:href') || e.getAttribute('xlink:href') || e.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '').replace('#', '');
      const src = binaries.get(href); if (src) out += `<img src="${src}" alt="">`; continue;
    }
    if (tag === 'section') { out += fb2ToHtml(e, binaries); continue; }
    if (tag === 'a') { out += fb2ToHtml(e, binaries); continue; }
    const t = map[tag];
    if (t === 'br') { out += '<br>'; continue; }
    out += t ? `<${t}>${fb2ToHtml(e, binaries)}</${t}>` : fb2ToHtml(e, binaries);
  }
  return out;
}
function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }

async function openFb2(blob: Blob) {
  const raw = decodeText(await blob.arrayBuffer());
  const doc = new DOMParser().parseFromString(raw, 'application/xml');
  const binaries = new Map<string, string>();
  for (const b of q(doc, 'binary')) binaries.set(b.getAttribute('id')!, `data:${b.getAttribute('content-type') || 'image/jpeg'};base64,${(b.textContent || '').replace(/\s+/g, '')}`);
  const ti = q(doc, 'title-info')[0];
  const meta: Partial<Book> = {};
  if (ti) {
    meta.title = first(ti, 'book-title');
    meta.authors = q(ti, 'author').map((a) => [first(a, 'first-name'), first(a, 'middle-name'), first(a, 'last-name')].filter(Boolean).join(' ') || first(a, 'nickname') || '').filter(Boolean);
    meta.language = first(ti, 'lang');
    meta.genres = q(ti, 'genre').map((g) => normalizeGenre(g.textContent || '')).filter(Boolean);
    const ann = q(ti, 'annotation')[0]; if (ann) meta.description = ann.textContent?.trim().slice(0, 4000);
    const tr = q(ti, 'translator')[0]; if (tr) meta.translator = [first(tr, 'first-name'), first(tr, 'last-name')].filter(Boolean).join(' ');
    meta.year = first(ti, 'date')?.match(/\d{4}/)?.[0];
  }
  const pi = q(doc, 'publish-info')[0];
  if (pi) { meta.publisher = first(pi, 'publisher'); meta.isbn = first(pi, 'isbn')?.replace(/[^0-9Xx]/g, ''); meta.year ||= first(pi, 'year'); }
  let cover: string | undefined;
  const cp = ti && q(ti, 'coverpage')[0];
  if (cp) { const im = q(cp, 'image')[0]; const href = (im?.getAttribute('l:href') || im?.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '').replace('#', ''); const src = binaries.get(href); if (src) cover = await shrinkImage(await (await fetch(src)).blob()).catch(() => undefined); }
  const chapters: Chapter[] = [];
  const body = q(doc, 'body').find((b) => b.getAttribute('name') !== 'notes') || q(doc, 'body')[0];
  if (body) {
    const sections = Array.from(body.children).filter((c) => c.localName === 'section');
    if (!sections.length) chapters.push(makeChapter(meta.title || '', fb2ToHtml(body, binaries)));
    for (const s of sections) {
      const t = q(s, 'title')[0]?.textContent?.trim().replace(/\s+/g, ' ') || '';
      chapters.push(makeChapter(t, fb2ToHtml(s, binaries)));
    }
  }
  return { meta, cover, chapters };
}

// ---------- TXT / HTML / MD ----------
const HEADING = /^\s*(chapter|part|book|section|prologue|epilogue|الفصل|فصل|الباب|باب|الجزء|المقدمة|مقدمة|الخاتمة|خاتمة)\b.{0,80}$/i;
function textToChapters(text: string, title: string): Chapter[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const chapters: { title: string; paras: string[] }[] = [];
  let cur = { title: title, paras: [] as string[] };
  let para: string[] = [];
  let size = 0;
  const flush = () => { if (para.length) { cur.paras.push(para.join(' ')); size += para.join(' ').length; para = []; } };
  for (const line of lines) {
    const l = line.trim();
    if (!l) { flush(); continue; }
    if (HEADING.test(l) && l.length < 90) {
      flush();
      if (cur.paras.length) chapters.push(cur);
      cur = { title: l, paras: [] }; size = 0; continue;
    }
    para.push(l);
    if (size > 40000 && !para.length) { /* handled below */ }
    if (size > 40000) { flush(); chapters.push(cur); cur = { title: '', paras: [] }; size = 0; }
  }
  flush();
  if (cur.paras.length || !chapters.length) chapters.push(cur);
  return chapters.map((c, i) => makeChapter(c.title || (chapters.length > 1 ? `${i + 1}` : title), (c.title ? `<h2>${escapeHtml(c.title)}</h2>` : '') + c.paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('')));
}

function htmlToChapters(html: string, fallbackTitle: string): { title: string; chapters: Chapter[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.querySelector('title')?.textContent?.trim() || doc.querySelector('h1')?.textContent?.trim() || fallbackTitle;
  const body = doc.body;
  for (const a of Array.from(body.querySelectorAll('a[href]'))) {
    const h = a.getAttribute('href')!;
    if (h.startsWith('#')) { a.setAttribute('data-anchor', h.slice(1)); a.removeAttribute('href'); }
    else { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
  }
  for (const el of Array.from(body.querySelectorAll('[id]'))) el.setAttribute('data-aid', el.getAttribute('id')!);
  const heads = Array.from(body.querySelectorAll('h1, h2'));
  const total = body.textContent?.length || 0;
  if (heads.length < 2 || total < 30000) return { title, chapters: [makeChapter(title, body.innerHTML)] };
  // split on top-level h1/h2 siblings
  const chapters: Chapter[] = [];
  let buf = ''; let curTitle = '';
  const flat = Array.from(body.children);
  for (const el of flat) {
    if (/^H[12]$/.test(el.tagName) && buf.trim()) { chapters.push(makeChapter(curTitle, buf)); buf = ''; }
    if (/^H[12]$/.test(el.tagName)) curTitle = el.textContent?.trim() || '';
    buf += el.outerHTML;
  }
  if (buf.trim()) chapters.push(makeChapter(curTitle, buf));
  return { title, chapters: chapters.length ? chapters : [makeChapter(title, body.innerHTML)] };
}

// ---------- Cover helpers ----------
export async function shrinkImage(blob: Blob, w = 360): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, w / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

// ---------- Public API ----------
export async function extractMetadata(file: Blob, fileName: string): Promise<ParsedMeta> {
  const fmt = SUPPORTED[extOf(fileName)];
  const guess = guessFromFileName(fileName);
  const base: Partial<Book> = { format: fmt, title: guess.title, authors: guess.author ? [guess.author] : [] };
  if (fmt === 'epub') {
    const r = await openEpub(file, false);
    const meta = { ...base, ...stripEmpty(r.meta) };
    if (!meta.authors?.length) { meta.authors = base.authors; if (base.authors?.length) (meta as any).unverified = ['authors']; }
    return { meta, cover: r.cover, toc: r.toc, chars: r.chars };
  }
  if (fmt === 'pdf') return extractPdf(file, base, guess);
  if (fmt === 'fb2') {
    const r = await openFb2(file);
    const chars = r.chapters.reduce((s, c) => s + c.text.length, 0);
    return { meta: { ...base, ...stripEmpty(r.meta), language: r.meta.language || detectLang(r.chapters[0]?.text || '') }, cover: r.cover, toc: r.chapters.map((c, i) => ({ label: c.title || `${i + 1}`, chapter: i })), chars };
  }
  const flow = await openFlowFromText(file, fileName, fmt);
  if (fmt === 'docx') {
    // Word keeps title and author in docProps/core.xml
    try {
      const zip = await JSZip.loadAsync(file);
      const core = await zip.file('docProps/core.xml')?.async('string');
      if (core) {
        const x = new DOMParser().parseFromString(core, 'application/xml');
        const tag = (n: string) => x.getElementsByTagNameNS('*', n)[0]?.textContent?.trim();
        const title = tag('title'), creator = tag('creator');
        if (title && !junkTitle(title)) base.title = title;
        if (creator && !/^(user|admin|owner|pc|hp|dell|python-docx|microsoft office user|author)$/i.test(creator)) base.authors = [creator];
      }
    } catch { /* not critical */ }
    if (base.authors?.length && base.authors[0] === guess.author) (base as any).unverified = ['authors'];
    return { meta: { ...base, language: detectLang(flow.chapters.map((c) => c.text).join(' ').slice(0, 6000)) }, toc: flow.chapters.map((c, i) => ({ label: c.title || `${i + 1}`, chapter: i })), chars: flow.chapters.reduce((s, c) => s + c.text.length, 0) };
  }
  if (base.authors?.length) (base as any).unverified = ['authors']; // author guessed from the file name
  return { meta: { ...base, title: flow.title || base.title, language: detectLang(flow.chapters.map((c) => c.text).join(' ').slice(0, 6000)) }, toc: flow.chapters.map((c, i) => ({ label: c.title || `${i + 1}`, chapter: i })), chars: flow.chapters.reduce((s, c) => s + c.text.length, 0) };
}

function stripEmpty<T extends object>(o: T): Partial<T> {
  const r: any = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) r[k] = v;
  return r;
}

async function openFlowFromText(file: Blob, fileName: string, fmt: BookFormat) {
  const guess = guessFromFileName(fileName).title;
  if (fmt === 'docx') {
    const mammoth: any = await import('mammoth');
    const res = await (mammoth.default || mammoth).convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlToChapters(`<body>${res.value}</body>`, guess);
  }
  const text = decodeText(await file.arrayBuffer());
  if (fmt === 'txt') return { title: guess, chapters: textToChapters(text, guess) };
  if (fmt === 'md') {
    const html = await marked.parse(text);
    const r = htmlToChapters(`<body>${html}</body>`, guess);
    return { title: r.title === guess ? (text.match(/^#\s+(.+)$/m)?.[1] || guess) : r.title, chapters: r.chapters };
  }
  return htmlToChapters(text, guess);
}

const junkTitle = (t?: string) => !t || /^(microsoft word|untitled|document|\d+|.*\.(docx?|pdf|indd|qxd))/i.test(t.trim()) || t.trim().length < 2;

async function extractPdf(file: Blob, base: Partial<Book>, guess: { title: string; author?: string }): Promise<ParsedMeta> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument(pdfDocOptions(new Uint8Array(await file.arrayBuffer()))).promise;
  try {
    const meta: Partial<Book> = { ...base, pages: doc.numPages };
    try {
      const info: any = (await doc.getMetadata()).info || {};
      const fileArabic = /[؀-ۿ]/.test(guess.title);
      if (!junkTitle(info.Title) && !(fileArabic && !/[؀-ۿ]/.test(info.Title))) meta.title = info.Title.trim();
      if (info.Author && !/^(user|admin|owner|pc|hp|dell)$/i.test(info.Author.trim()) && !meta.authors?.length) meta.authors = [info.Author.trim()];
      if (meta.authors?.length && meta.authors[0] === guess.author) (meta as any).unverified = ['authors'];
      if (info.Subject && !meta.description) meta.description = String(info.Subject).slice(0, 1000);
    } catch { /* no metadata */ }
    let sampleText = '';
    try {
      for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
        const tc = await (await doc.getPage(p)).getTextContent();
        sampleText += tc.items.map((i: any) => i.str).join(' ') + ' ';
      }
    } catch { /* image-only */ }
    meta.language = detectLang(sampleText + ' ' + (meta.title || '')) || (/[؀-ۿ]/.test(meta.title || '') ? 'ar' : undefined);
    const toc = await pdfOutline(doc);
    let cover: string | undefined;
    try {
      const page = await doc.getPage(1);
      const vp0 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: 360 / vp0.width });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
      cover = c.toDataURL('image/jpeg', 0.8);
    } catch { /* ignore */ }
    return { meta, cover, toc };
  } finally { doc.destroy(); }
}

export async function pdfOutline(doc: any): Promise<TocItem[]> {
  const toc: TocItem[] = [];
  try {
    const outline = await doc.getOutline();
    const walk = async (items: any[], level: number) => {
      for (const it of items || []) {
        let page: number | undefined;
        try {
          const dest = typeof it.dest === 'string' ? await doc.getDestination(it.dest) : it.dest;
          if (dest?.[0]) page = (await doc.getPageIndex(dest[0])) + 1;
        } catch { /* ignore */ }
        toc.push({ label: it.title, page, level });
        if (toc.length < 600) await walk(it.items, level + 1);
      }
    };
    await walk(outline, 0);
  } catch { /* no outline */ }
  return toc;
}

/** Load a reflowable book's content for reading. */
export async function openFlow(file: Blob, book: Book): Promise<FlowContent> {
  if (book.format === 'epub') {
    const r = await openEpub(file, true);
    return { kind: 'flow', chapters: r.chapters, toc: r.toc.length ? r.toc : r.chapters.map((c, i) => ({ label: c.title || `${i + 1}`, chapter: i })), cleanup: r.cleanup };
  }
  if (book.format === 'fb2') {
    const r = await openFb2(file);
    return { kind: 'flow', chapters: r.chapters, toc: r.chapters.map((c, i) => ({ label: c.title || `${i + 1}`, chapter: i })), cleanup: () => {} };
  }
  const r = await openFlowFromText(file, book.fileName, book.format);
  return { kind: 'flow', chapters: r.chapters, toc: r.chapters.map((c, i) => ({ label: c.title || `${i + 1}`, chapter: i })), cleanup: () => {} };
}
