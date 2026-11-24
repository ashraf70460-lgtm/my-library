import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Copy, Highlighter, StickyNote, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Annotation, Book, ReaderPrefs } from '../types';
import type { Chapter } from '../lib/parse';
import { useStore, useT, uid } from '../store';
import { HL_COLORS } from '../pages/Notes';
import { domPoint, textOffset, unwrapAll, wrapRange } from './highlight';
import { fontCss } from './Appearance';

export interface Loc { chapter: number; ratio: number; overall: number; page?: number; pages?: number }
export interface ReaderApi {
  goChapter: (i: number, ratio?: number, start?: number) => void;
  next: () => void;
  prev: () => void;
  gotoOverall: (f: number) => void;
  search: (q: string) => { chapter: number; start: number; end: number; snippet: string }[];
  showMatch: (chapter: number, start: number, end: number) => void;
  snippetHere: () => string;
  ttsMark?: (chapter: number, start: number, end: number) => void;
  ttsClear?: () => void;
  currentOffset?: () => { chapter: number; offset: number };
}

interface Props {
  book: Book;
  chapters: Chapter[];
  prefs: ReaderPrefs;
  rtl: boolean;
  initial: { chapter?: number; ratio?: number; start?: number } | null;
  annotations: Annotation[];
  onLoc: (l: Loc) => void;
  onTapCenter: () => void;
  onActivity: () => void;
}

const COLORS = ['yellow', 'blue', 'green', 'pink', 'orange'] as const;

export const FlowReader = forwardRef<ReaderApi, Props>(function FlowReader({ book, chapters, prefs, rtl, initial, annotations, onLoc, onTapCenter, onActivity }, ref) {
  const t = useT();
  const s = useStore();
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(() => Math.min(Math.max(0, initial?.chapter ?? book.position?.chapter ?? 0), chapters.length - 1));
  const pendingRatio = useRef<number | null>(initial?.ratio ?? (initial?.chapter == null ? book.position?.ratio ?? 0 : 0));
  const pendingStart = useRef<{ start: number; end?: number; cls?: string } | null>(initial?.start != null ? { start: initial.start } : null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pop, setPop] = useState<null | { x: number; y: number; start: number; end: number; text: string; hlId?: string }>(null);
  const [noteFor, setNoteFor] = useState<null | { start: number; end: number; text: string; hlId?: string; color?: string }>(null);
  const [noteText, setNoteText] = useState('');
  const paged = prefs.mode === 'paged';
  const charsBefore = useMemo(() => { const a = [0]; for (const c of chapters) a.push(a[a.length - 1] + Math.max(1, c.text.length)); return a; }, [chapters]);
  const totalChars = charsBefore[charsBefore.length - 1];
  const tts = useRef<{ chapter: number; start: number; end: number } | null>(null);
  const chHls = useMemo(() => annotations.filter((a) => a.kind === 'highlight' && a.chapter === chapter && a.start != null), [annotations, chapter]);

  // measure container
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const margin = Math.min(prefs.margin, Math.max(8, size.w * 0.08));
  const colGap = margin * 2;
  const contentW = Math.max(200, Math.min(prefs.width, size.w - margin * 2));
  const spread = paged && prefs.spread && size.w >= 1000;
  const pageW = paged ? (spread ? Math.min(size.w - margin * 2, prefs.width * 2 + colGap) : contentW) : contentW;
  const colW = spread ? (pageW - colGap) / 2 : pageW;
  const step = pageW + colGap;
  const pageH = Math.max(200, size.h - (size.h > 600 ? 112 : 72));

  const report = useCallback((ratio: number, pg?: number, pgs?: number) => {
    const overall = Math.min(1, (charsBefore[chapter] + ratio * (charsBefore[chapter + 1] - charsBefore[chapter])) / totalChars);
    onLoc({ chapter, ratio, overall, page: pg, pages: pgs });
  }, [chapter, charsBefore, totalChars, onLoc]);

  const scroller = () => (paged ? outer.current?.querySelector<HTMLDivElement>('[data-pager]') : outer.current?.querySelector<HTMLDivElement>('[data-scroller]'));

  const goPage = useCallback((k: number, n = pages) => {
    const sc = scroller();
    if (!sc) return;
    const p = Math.max(0, Math.min(n - 1, k));
    sc.scrollLeft = (rtl ? -1 : 1) * p * step;
    setPage(p);
    report(n > 1 ? p / (n - 1) : 0, p + 1, n);
  }, [pages, rtl, step, report]);

  // render chapter html + highlights, then restore position
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.innerHTML = chapters[chapter]?.html || '';
    for (const h of chHls) wrapRange(el, h.start!, h.end!, `hl hl-${h.color || 'yellow'}${h.note ? ' has-note' : ''}`, h.id, h.note);
    if (pendingStart.current?.cls) wrapRange(el, pendingStart.current.start, pendingStart.current.end!, 'hl hl-search', 'search');
    if (tts.current && tts.current.chapter === chapter) wrapRange(el, tts.current.start, tts.current.end, 'hl hl-tts', 'tts');
  }, [chapter, chapters, chHls]);

  const showTts = useCallback(() => {
    const el = inner.current, sc = scroller();
    if (!el || !sc || !tts.current || tts.current.chapter !== chapter) return;
    unwrapAll(el, 'mark[data-hl="tts"]');
    wrapRange(el, tts.current.start, tts.current.end, 'hl hl-tts', 'tts');
    const m = el.querySelector('mark.hl-tts') as HTMLElement | null;
    if (!m) return;
    const r = m.getBoundingClientRect(), sr = sc.getBoundingClientRect();
    if (paged) {
      const off = rtl ? sr.right - r.right : r.left - sr.left;
      const p = Math.floor((off + Math.abs(sc.scrollLeft)) / step);
      if (p !== page) goPage(p);
    } else if (r.top < sr.top + 60 || r.bottom > sr.bottom - 90) {
      sc.scrollTo({ top: sc.scrollTop + (r.top - sr.top) - sc.clientHeight / 3, behavior: 'smooth' });
    }
  }, [chapter, paged, rtl, step, page, goPage]);

  const restore = useCallback(() => {
    const el = inner.current, sc = scroller();
    if (!el || !sc) return;
    let ratio = pendingRatio.current;
    let target: HTMLElement | null = null;
    if (pendingStart.current) {
      target = el.querySelector('mark.hl-search') || null;
      if (!target) {
        const pt = domPoint(el, pendingStart.current.start);
        if (pt) { const span = document.createElement('span'); pt.node.parentNode!.insertBefore(span, pt.node.splitText(pt.offset)); target = span; setTimeout(() => span.remove(), 50); }
      }
    }
    if (paged) {
      const n = Math.max(1, Math.round(sc.scrollWidth / step));
      setPages(n);
      let p = 0;
      if (target) {
        const rect = target.getBoundingClientRect(), srect = sc.getBoundingClientRect();
        const off = rtl ? srect.right - rect.right : rect.left - srect.left;
        p = Math.floor((off + Math.abs(sc.scrollLeft)) / step);
      } else if (ratio != null) p = Math.round(ratio * (n - 1));
      else p = page;
      goPage(p, n);
    } else {
      const max = sc.scrollHeight - sc.clientHeight;
      if (target) sc.scrollTop = Math.max(0, target.offsetTop - sc.clientHeight / 3);
      else if (ratio != null) sc.scrollTop = ratio * max;
      report(max > 0 ? sc.scrollTop / max : 0);
    }
    pendingRatio.current = null;
    if (pendingStart.current) setTimeout(() => { pendingStart.current = null; }, 2500);
  }, [paged, step, rtl, goPage, report, page]);

  // re-layout on chapter / settings / size change
  useEffect(() => {
    if (!size.w) return;
    const sc = scroller();
    if (sc && pendingRatio.current == null && !pendingStart.current) {
      // keep current ratio across font/layout changes
      if (paged) pendingRatio.current = pages > 1 ? page / (pages - 1) : 0;
      else { const max = sc.scrollHeight - sc.clientHeight; pendingRatio.current = max > 0 ? sc.scrollTop / max : 0; }
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(restore));
    const imgs = inner.current?.querySelectorAll('img') || [];
    let pend = 0;
    imgs.forEach((im) => { if (!(im as HTMLImageElement).complete) { pend++; im.addEventListener('load', () => { if (--pend === 0 && paged) { const sc2 = scroller(); if (sc2) setPages(Math.max(1, Math.round(sc2.scrollWidth / step))); } }, { once: true }); } });
    return () => cancelAnimationFrame(id);
  }, [chapter, size.w, size.h, prefs.fontSize, prefs.lineHeight, prefs.margin, prefs.width, prefs.paraSpacing, prefs.fontFamily, prefs.mode, prefs.spread, prefs.justify, rtl]);

  useEffect(() => { document.fonts?.ready.then(() => { if (paged) { const sc = scroller(); if (sc) setPages(Math.max(1, Math.round(sc.scrollWidth / step))); } }); }, []);

  const goChapter = useCallback((i: number, ratio = 0, start?: number, end?: number) => {
    if (i < 0 || i >= chapters.length) return;
    pendingRatio.current = ratio;
    pendingStart.current = start != null ? { start, end, cls: end != null ? 'search' : undefined } : null;
    setPop(null);
    if (i === chapter) requestAnimationFrame(() => {
      const el = inner.current; if (!el) return;
      unwrapAll(el, 'mark[data-hl="search"]');
      if (start != null && end != null) wrapRange(el, start, end, 'hl hl-search', 'search');
      restore();
    });
    else setChapter(i);
  }, [chapters.length, chapter, restore]);

  const next = useCallback(() => {
    if (paged && page < pages - 1) goPage(page + 1);
    else if (chapter < chapters.length - 1) goChapter(chapter + 1, 0);
    else if (paged) goPage(pages - 1);
  }, [paged, page, pages, chapter, chapters.length, goPage, goChapter]);
  const prev = useCallback(() => {
    if (paged && page > 0) goPage(page - 1);
    else if (chapter > 0) goChapter(chapter - 1, 1);
  }, [paged, page, chapter, goPage, goChapter]);

  useImperativeHandle(ref, () => ({
    goChapter: (i, ratio, start) => goChapter(i, ratio ?? 0, start),
    next, prev,
    gotoOverall: (f) => {
      const target = f * totalChars;
      let i = charsBefore.findIndex((c, k) => k < chapters.length && charsBefore[k + 1] > target);
      if (i < 0) i = chapters.length - 1;
      goChapter(i, (target - charsBefore[i]) / (charsBefore[i + 1] - charsBefore[i]));
    },
    search: (q) => {
      const out: { chapter: number; start: number; end: number; snippet: string }[] = [];
      const needle = q.trim().toLowerCase();
      if (needle.length < 2) return out;
      chapters.forEach((c, ci) => {
        const hay = c.text.toLowerCase();
        let idx = hay.indexOf(needle);
        while (idx >= 0 && out.length < 300) {
          out.push({ chapter: ci, start: idx, end: idx + needle.length, snippet: '…' + c.text.slice(Math.max(0, idx - 50), idx + needle.length + 60).replace(/\s+/g, ' ') + '…' });
          idx = hay.indexOf(needle, idx + needle.length);
        }
      });
      return out;
    },
    showMatch: (ci, start, end) => goChapter(ci, 0, start, end),
    ttsMark: (ci, start, end) => {
      tts.current = { chapter: ci, start, end };
      if (ci !== chapter) { pendingStart.current = { start }; pendingRatio.current = 0; setChapter(ci); }
      else showTts();
    },
    ttsClear: () => { tts.current = null; if (inner.current) unwrapAll(inner.current, 'mark[data-hl="tts"]'); },
    currentOffset: () => {
      const len = chapters[chapter]?.text.length || 0;
      const sc = scroller();
      const r = paged ? (pages > 1 ? page / (pages - 1) : 0) : sc ? sc.scrollTop / Math.max(1, sc.scrollHeight - sc.clientHeight) : 0;
      return { chapter, offset: Math.floor(r * len) };
    },
    snippetHere: () => {
      const txt = chapters[chapter]?.text || '';
      const r = paged ? (pages > 1 ? page / (pages - 1) : 0) : (() => { const sc = scroller(); return sc ? sc.scrollTop / Math.max(1, sc.scrollHeight - sc.clientHeight) : 0; })();
      const i = Math.floor(r * txt.length);
      return txt.slice(i, i + 90).replace(/\s+/g, ' ').trim();
    },
  }), [goChapter, next, prev, chapters, chapter, charsBefore, totalChars, paged, page, pages, showTts]);

  // keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      const fwd = rtl ? 'ArrowLeft' : 'ArrowRight', back = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd || e.key === 'PageDown' || (paged && e.key === ' ')) { e.preventDefault(); next(); onActivity(); }
      else if (e.key === back || e.key === 'PageUp') { e.preventDefault(); prev(); onActivity(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [next, prev, rtl, paged, onActivity]);

  // selection → highlight popover
  const onPointerUp = () => {
    setTimeout(() => {
      const sel = window.getSelection();
      const el = inner.current;
      if (!sel || sel.isCollapsed || !el || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      if (!el.contains(r.commonAncestorContainer)) return;
      const start = textOffset(el, r.startContainer, r.startOffset);
      const end = textOffset(el, r.endContainer, r.endOffset);
      const text = r.toString().trim();
      if (!text || end <= start) return;
      const rect = r.getBoundingClientRect();
      const box = outer.current!.getBoundingClientRect();
      setPop({ x: rect.left + rect.width / 2 - box.left, y: rect.top - box.top, start, end, text });
    }, 10);
  };

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest('[data-href],[data-anchor]') as HTMLElement | null;
    if (link) {
      e.preventDefault();
      const ch = link.dataset.href != null ? Number(link.dataset.href) : chapter;
      const anchor = link.dataset.anchor;
      if (ch >= 0) {
        if (anchor) {
          const go = () => { const a = inner.current?.querySelector(`[data-aid="${CSS.escape(anchor)}"]`); if (a && inner.current) { const off = textOffset(inner.current, a, 0); goChapter(ch, 0, off); } };
          if (ch === chapter) go(); else { goChapter(ch, 0); setTimeout(go, 120); }
        } else goChapter(ch, 0);
      }
      return;
    }
    const mark = target.closest('mark[data-hl]') as HTMLElement | null;
    if (mark && mark.dataset.hl !== 'search') {
      const a = annotations.find((x) => x.id === mark.dataset.hl);
      if (a) {
        const rect = mark.getBoundingClientRect(); const box = outer.current!.getBoundingClientRect();
        setPop({ x: rect.left + rect.width / 2 - box.left, y: rect.top - box.top, start: a.start!, end: a.end!, text: a.text || '', hlId: a.id });
        return;
      }
    }
    if (window.getSelection()?.toString()) return;
    if (pop) { setPop(null); return; }
    const box = outer.current!.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    if (paged && x < 0.28) { rtl ? next() : prev(); return; }
    if (paged && x > 0.72) { rtl ? prev() : next(); return; }
    onTapCenter();
  };

  // touch swipe for paged mode
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touch.current; touch.current = null;
    if (!st || !paged) return;
    const dx = e.changedTouches[0].clientX - st.x, dy = e.changedTouches[0].clientY - st.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - st.t < 600 && !window.getSelection()?.toString()) {
      if (dx < 0) (rtl ? prev : next)(); else (rtl ? next : prev)();
    }
  };

  const addHighlight = (color: string, note?: string) => {
    if (!pop && !noteFor) return;
    const src = noteFor || pop!;
    if (src.hlId) {
      const a = s.annotations[src.hlId];
      s.upsert('annotations', { ...a, color: color as any, ...(note !== undefined ? { note: note || undefined } : {}) });
    } else {
      const a: Annotation = { id: uid('h'), updatedAt: Date.now(), bookId: book.id, kind: 'highlight', target: 'passage', chapter, chapterLabel: chapters[chapter]?.title || `${t('rd.chapter')} ${chapter + 1}`, start: src.start, end: src.end, ratio: src.start / Math.max(1, chapters[chapter].text.length), text: src.text, color: color as any, note: note || undefined, createdAt: Date.now() };
      s.upsert('annotations', a);
    }
    window.getSelection()?.removeAllRanges();
    setPop(null); setNoteFor(null); setNoteText('');
  };

  const onScroll = () => {
    onActivity();
    if (paged) return;
    const sc = scroller(); if (!sc) return;
    const max = sc.scrollHeight - sc.clientHeight;
    report(max > 0 ? sc.scrollTop / max : 0);
  };

  const fg = prefs.customFg, bg = prefs.customBg;
  const proseStyle: React.CSSProperties = {
    ['--fs' as any]: `${prefs.fontSize}px`, ['--lh' as any]: prefs.lineHeight, ['--ps' as any]: prefs.paraSpacing, ['--ta' as any]: prefs.justify ? 'justify' : 'start', ['--page-h' as any]: `${pageH}px`,
    fontFamily: fontCss(prefs.fontFamily, rtl),
    ...(fg ? { color: fg } : {}),
  };
  const ChevPrev = rtl ? ChevronRight : ChevronLeft;
  const ChevNext = rtl ? ChevronLeft : ChevronRight;

  return (
    <div ref={outer} className="relative h-full w-full select-text" style={bg ? { background: bg } : undefined} onClick={onClick} onMouseUp={onPointerUp} onTouchEnd={(e) => { onTouchEnd(e); onPointerUp(); }} onTouchStart={onTouchStart}>
      {paged ? (
        <div className="flex h-full items-center justify-center" dir={rtl ? 'rtl' : 'ltr'}>
          <div data-pager className="overflow-hidden" style={{ width: pageW, height: pageH }}>
            <div ref={inner} className="prose-book" dir={rtl ? 'rtl' : 'ltr'} style={{ ...proseStyle, height: pageH, columnWidth: colW, columnGap: colGap, columnFill: 'auto' }} />
          </div>
        </div>
      ) : (
        <div data-scroller className="scroll-thin h-full overflow-y-auto" onScroll={onScroll}>
          <div className="mx-auto py-16" style={{ width: contentW }}>
            <div ref={inner} className="prose-book" dir={rtl ? 'rtl' : 'ltr'} style={proseStyle} />
            <div className="mt-16 flex items-center justify-between gap-3 border-t pt-6" style={{ borderColor: 'var(--r-line)' }} dir={rtl ? 'rtl' : 'ltr'}>
              <button type="button" disabled={chapter === 0} onClick={(e) => { e.stopPropagation(); goChapter(chapter - 1, 1); }} className="flex min-h-[44px] items-center gap-1 rounded-full px-4 disabled:opacity-30" style={{ color: 'var(--r-accent)' }}><ChevPrev size={18} />{t('rd.prevCh')}</button>
              <span className="text-sm" style={{ color: 'var(--r-muted)' }}>{chapter + 1} / {chapters.length}</span>
              <button type="button" disabled={chapter >= chapters.length - 1} onClick={(e) => { e.stopPropagation(); goChapter(chapter + 1, 0); }} className="flex min-h-[44px] items-center gap-1 rounded-full px-4 disabled:opacity-30" style={{ color: 'var(--r-accent)' }}>{t('rd.nextCh')}<ChevNext size={18} /></button>
            </div>
          </div>
        </div>
      )}

      {pop && !noteFor && (
        <div className="absolute z-30 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full border bg-card p-1 text-ink shadow-xl" style={{ left: Math.max(130, Math.min(size.w - 130, pop.x)), top: Math.max(56, pop.y - 8) }} onClick={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
          {COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => addHighlight(c)} className="h-8 w-8 rounded-full border-2 border-card" style={{ background: HL_COLORS[c] }} />)}
          <span className="mx-1 h-6 w-px bg-line" />
          <button type="button" title={t('rd.note')} aria-label={t('rd.note')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper" onClick={() => { const a = pop.hlId ? s.annotations[pop.hlId] : undefined; setNoteText(a?.note || ''); setNoteFor({ ...pop, color: a?.color || 'yellow' }); }}><StickyNote size={17} /></button>
          <button type="button" title={t('rd.copyText')} aria-label={t('rd.copyText')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper" onClick={() => { navigator.clipboard?.writeText(pop.text).catch(() => {}); s.toast(t('copied')); setPop(null); }}><Copy size={17} /></button>
          {pop.hlId ? <button type="button" title={t('rd.removeHl')} aria-label={t('rd.removeHl')} className="flex h-9 w-9 items-center justify-center rounded-full text-wine hover:bg-paper" onClick={() => { s.remove('annotations', pop.hlId!); setPop(null); }}><Trash2 size={17} /></button> : <span className="px-1"><Highlighter size={15} className="opacity-40" /></span>}
        </div>
      )}
      {noteFor && (
        <div className="absolute inset-x-3 bottom-20 z-30 mx-auto max-w-md rounded-2xl border bg-card p-4 text-ink shadow-2xl" onClick={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
          <p className="serif mb-2 line-clamp-3 text-sm opacity-80" dir="auto">{noteFor.text}</p>
          <textarea autoFocus className="field !min-h-[90px]" dir="auto" placeholder={t('rd.notePlaceholder')} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="min-h-[40px] rounded-full px-4 text-sm" onClick={() => { setNoteFor(null); setPop(null); }}>{t('cancel')}</button>
            <button type="button" className="min-h-[40px] rounded-full bg-forest px-4 text-sm text-ivory" onClick={() => addHighlight(noteFor.color || 'yellow', noteText.trim())}>{t('rd.saveNote')}</button>
          </div>
        </div>
      )}
    </div>
  );
});
