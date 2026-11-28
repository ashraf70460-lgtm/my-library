import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Book, ReaderPrefs } from '../types';
import type { Loc, ReaderApi } from './FlowReader';
import { pageBlocks, normaliseText, type PageBlock } from '../lib/pdftext';
import { fontCss } from './Appearance';

interface Props {
  book: Book;
  doc: any;
  prefs: ReaderPrefs;
  rtl: boolean;
  initialPage: number;
  onLoc: (l: Loc) => void;
  onTapCenter: () => void;
  onActivity: () => void;
}

export const PdfReader = forwardRef<ReaderApi, Props>(function PdfReader({ book, doc, prefs, rtl, initialPage, onLoc, onTapCenter, onActivity }, ref) {
  const n = doc.numPages as number;
  const outer = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [ratio0, setRatio] = useState(1.414);
  const rotate = ((book.pdfRotate || 0) % 360 + 360) % 360;
  const ratio = rotate % 180 ? 1 / ratio0 : ratio0;
  const [page, setPage] = useState(Math.min(n, Math.max(1, initialPage)));
  const textCache = useRef(new Map<number, string>());
  const textMode = !!prefs.pdfText;
  const single = prefs.pdfMode === 'single' && !textMode;
  const spread = !!prefs.pdfSpread && !textMode && width >= 640;
  const step = spread ? 2 : 1;
  const first = (p: number) => (spread ? p - ((p - 1) % 2) : p); // first page of the spread holding p

  useEffect(() => {
    doc.getPage(1).then((p: any) => { const v = p.getViewport({ scale: 1 }); setRatio(v.height / v.width); });
    const el = outer.current!;
    const ro = new ResizeObserver(() => { setWidth(el.clientWidth); setHeight(el.clientHeight); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  const fit = prefs.pdfFit || 'zoom';
  const avail = (width - 24 - (spread ? 12 : 0)) / (spread ? 2 : 1);
  const pageW = Math.max(160, fit === 'width' ? avail : fit === 'page' ? Math.min(avail, (height - 112) / ratio) : Math.min(avail, spread ? 700 : 900) * prefs.pdfZoom);
  const pageH = pageW * ratio;

  const report = useCallback((p: number) => { setPage(p); onLoc({ chapter: 0, ratio: 0, overall: n > 1 ? (p - 1) / (n - 1) : 1, page: p, pages: n }); }, [n, onLoc]);

  const go = useCallback((p: number) => {
    const target = first(Math.max(1, Math.min(n, p)));
    if (single) report(target);
    else {
      const el = outer.current?.querySelector(`[data-page="${target}"]`) as HTMLElement | null;
      if (el && outer.current) outer.current.scrollTop = el.offsetTop - 12;
      report(target);
    }
  }, [n, single, report, spread]);

  // initial scroll
  useEffect(() => { if (width) requestAnimationFrame(() => go(page)); }, [width > 0, single, prefs.pdfZoom, textMode, spread, fit, rotate]);

  const getText = async (p: number) => {
    if (textCache.current.has(p)) return textCache.current.get(p)!;
    const tc = await (await doc.getPage(p)).getTextContent();
    const s = normaliseText(tc.items.map((i: any) => i.str + (i.hasEOL ? '\n' : '')).join(' '));
    textCache.current.set(p, s);
    return s;
  };

  useImperativeHandle(ref, () => ({
    goChapter: (_i: number, _r?: number) => {},
    next: () => go(page + step),
    prev: () => go(page - step),
    gotoOverall: (f: number) => go(Math.round(f * (n - 1)) + 1),
    search: () => [],
    showMatch: (p: number) => go(p),
    snippetHere: () => (textCache.current.get(page) || '').slice(0, 90).replace(/\s+/g, ' '),
    // extra for PDF
    gotoPage: go,
    pageText: getText,
    currentPage: () => page,
    searchAsync: async (q: string, onPartial: (r: any[]) => void) => {
      const needle = q.trim().toLowerCase(); const out: any[] = [];
      if (needle.length < 2) return out;
      for (let p = 1; p <= n; p++) {
        const txt = await getText(p); const low = txt.toLowerCase();
        let i = low.indexOf(needle);
        while (i >= 0 && out.length < 300) { out.push({ chapter: p, start: i, end: i + needle.length, snippet: '…' + txt.slice(Math.max(0, i - 50), i + needle.length + 60).replace(/\s+/g, ' ') + '…' }); i = low.indexOf(needle, i + needle.length); }
        if (p % 10 === 0) onPartial([...out]);
      }
      return out;
    },
  }) as any, [go, page, n]);

  // keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      const fwd = rtl ? 'ArrowLeft' : 'ArrowRight', back = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd || e.key === 'PageDown') { e.preventDefault(); go(page + step); onActivity(); }
      else if (e.key === back || e.key === 'PageUp') { e.preventDefault(); go(page - step); onActivity(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [go, page, rtl, onActivity, step]);

  const onScroll = () => {
    onActivity();
    if (single || !outer.current) return;
    const top = outer.current.scrollTop + outer.current.clientHeight / 3;
    let p = 1;
    if (textMode) {
      for (const el of Array.from(outer.current.querySelectorAll<HTMLElement>('[data-page]'))) { if (el.offsetTop <= top) p = Number(el.dataset.page); else break; }
    } else p = Math.min(n, Math.max(1, Math.floor(top / (pageH + 16)) * step + 1));
    if (p !== page) report(p);
  };

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onClick = (e: React.MouseEvent) => {
    if (!single) { onTapCenter(); return; }
    const box = outer.current!.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    if (x < 0.28) go(rtl ? page + step : page - step);
    else if (x > 0.72) go(rtl ? page - step : page + step);
    else onTapCenter();
  };

  return (
    <div ref={outer} className="scroll-thin h-full w-full overflow-auto py-14" onScroll={onScroll} onClick={onClick}
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => { const st = touch.current; touch.current = null; if (!st || !single) return; const dx = e.changedTouches[0].clientX - st.x; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.changedTouches[0].clientY - st.y) * 1.5) go(dx < 0 ? (rtl ? page - step : page + step) : (rtl ? page + step : page - step)); }}>
      {width > 0 && textMode ? (
        <div className="mx-auto" style={{ width: Math.max(200, Math.min(prefs.width, width - prefs.margin * 2)) }}>
          {[...Array(n)].map((_, i) => <PdfTextPage key={i} doc={doc} num={i + 1} prefs={prefs} rtl={rtl} />)}
        </div>
      ) : width > 0 && (spread ? (
        (single ? [first(page)] : [...Array(Math.ceil(n / 2))].map((_, i) => i * 2 + 1)).map((p0) => (
          <div key={p0} data-page={p0} className={`mx-auto flex justify-center gap-3 ${rtl ? 'flex-row-reverse' : ''}`} style={{ marginBottom: 16 }}>
            <PdfPage doc={doc} num={p0} w={pageW} h={pageH} eager={single} rotate={rotate} inRow />
            {p0 + 1 <= n ? <PdfPage doc={doc} num={p0 + 1} w={pageW} h={pageH} eager={single} rotate={rotate} inRow /> : <div style={{ width: pageW }} />}
          </div>
        ))
      ) : single ? (
        <PdfPage key={page} doc={doc} num={page} w={pageW} h={pageH} eager rotate={rotate} />
      ) : (
        [...Array(n)].map((_, i) => <PdfPage key={i} doc={doc} num={i + 1} w={pageW} h={pageH} rotate={rotate} />)
      ))}
    </div>
  );
});

function PdfPage({ doc, num, w, h, eager, rotate = 0, inRow }: { doc: any; num: number; w: number; h: number; eager?: boolean; rotate?: number; inRow?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(!!eager);
  useEffect(() => {
    if (eager) return;
    const el = ref.current!;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '1200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);
  useEffect(() => {
    if (!visible) { const c = canvas.current; if (c) { c.width = 0; c.height = 0; } return; }
    let task: any; let cancelled = false;
    doc.getPage(num).then((p: any) => {
      if (cancelled) return;
      const rotation = ((p.rotate || 0) + rotate) % 360;
      const base = p.getViewport({ scale: 1, rotation });
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const maxPx = 14_000_000; // keep within mobile canvas limits
      let scale = (w / base.width) * dpr;
      if (base.width * base.height * scale * scale > maxPx) scale = Math.sqrt(maxPx / (base.width * base.height));
      const vp = p.getViewport({ scale, rotation });
      const c = canvas.current!;
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      task = p.render({ canvasContext: c.getContext('2d')!, viewport: vp });
      task.promise.catch(() => {});
    });
    return () => { cancelled = true; task?.cancel?.(); };
  }, [visible, w, doc, num, rotate]);
  return (
    <div ref={ref} data-page={inRow ? undefined : num} className={`pdf-page ${inRow ? '!m-0' : ''}`} style={{ width: w, height: h }}>
      <canvas ref={canvas} />
      <span className="absolute -bottom-5 start-1/2 -translate-x-1/2 text-[11px] opacity-50">{num}</span>
    </div>
  );
}

const blockCache = new WeakMap<object, Map<number, PageBlock[]>>();

function PdfTextPage({ doc, num, prefs, rtl }: { doc: any; num: number; prefs: ReaderPrefs; rtl: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [blocks, setBlocks] = useState<PageBlock[] | null>(() => blockCache.get(doc)?.get(num) ?? null);
  useEffect(() => {
    if (blocks) return;
    const el = ref.current!;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      doc.getPage(num).then((p: any) => pageBlocks(p)).then((b: PageBlock[]) => {
        if (!blockCache.has(doc)) blockCache.set(doc, new Map());
        blockCache.get(doc)!.set(num, b);
        setBlocks(b);
      }).catch(() => setBlocks([]));
    }, { rootMargin: '1500px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [doc, num, blocks]);
  const style: React.CSSProperties = {
    ['--fs' as any]: `${prefs.fontSize}px`, ['--lh' as any]: prefs.lineHeight, ['--ps' as any]: prefs.paraSpacing, ['--ta' as any]: prefs.justify ? 'justify' : 'start',
    fontFamily: fontCss(prefs.fontFamily, rtl), color: prefs.customFg || undefined,
  };
  return (
    <section ref={ref} data-page={num} className="prose-book" dir={rtl ? 'rtl' : 'ltr'} style={{ ...style, minHeight: blocks ? undefined : '80vh' }}>
      {blocks?.map((b, i) => (b.type === 'h' ? <h3 key={i} dir="auto">{b.text}</h3> : <p key={i} dir="auto">{b.text}</p>))}
      {blocks && !blocks.length && <p style={{ color: 'var(--r-muted)' }} className="text-center text-sm">—</p>}
      <div className="my-6 flex items-center gap-3 text-xs" style={{ color: 'var(--r-muted)' }} dir="ltr"><span className="h-px flex-1" style={{ background: 'var(--r-line)' }} />{num}<span className="h-px flex-1" style={{ background: 'var(--r-line)' }} /></div>
    </section>
  );
}

/** Grid of small page previews for jumping around a PDF. */
export function PdfThumbs({ doc, current, rotate = 0, onPick }: { doc: any; current: number; rotate?: number; onPick: (p: number) => void }) {
  const n = doc.numPages as number;
  const [count, setCount] = useState(Math.min(n, 60));
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.querySelector(`[data-thumb="${current}"]`)?.scrollIntoView({ block: 'center' }); }, []);
  return (
    <div ref={box} className="grid grid-cols-3 gap-3" dir="ltr" onScroll={() => {}}>
      {[...Array(count)].map((_, i) => (
        <button key={i} type="button" data-thumb={i + 1} onClick={() => onPick(i + 1)} className={`flex flex-col items-center gap-1 rounded-lg p-1 text-xs ${current === i + 1 ? 'ring-2 ring-[var(--r-accent,#2f4f3e)]' : ''}`}>
          <Thumb doc={doc} num={i + 1} rotate={rotate} /><span style={{ color: 'var(--r-muted)' }}>{i + 1}</span>
        </button>
      ))}
      {count < n && <button type="button" className="col-span-3 rounded-lg border py-2 text-sm" style={{ borderColor: 'var(--r-line)' }} onClick={() => setCount(Math.min(n, count + 60))}>+ {Math.min(60, n - count)}</button>}
    </div>
  );
}

function Thumb({ doc, num, rotate }: { doc: any; num: number; rotate: number }) {
  const c = useRef<HTMLCanvasElement>(null);
  const [vis, setVis] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(c.current!);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!vis) return;
    let task: any;
    doc.getPage(num).then((p: any) => {
      const rotation = ((p.rotate || 0) + rotate) % 360;
      const b = p.getViewport({ scale: 1, rotation });
      const vp = p.getViewport({ scale: 180 / b.width, rotation });
      const el = c.current; if (!el) return;
      el.width = Math.floor(vp.width); el.height = Math.floor(vp.height);
      task = p.render({ canvasContext: el.getContext('2d')!, viewport: vp });
      task.promise.then(() => setDone(true), () => {});
    });
    return () => task?.cancel?.();
  }, [vis, rotate]);
  return <canvas ref={c} className="w-full rounded bg-white shadow-sm" style={{ aspectRatio: done ? undefined : '0.72' }} />;
}
