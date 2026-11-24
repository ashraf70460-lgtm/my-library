import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, List, Maximize, Minimize, Pause, Play, Search, Square, Type, X, StickyNote, Loader2, CheckCircle2 } from 'lucide-react';
import { useStore, useT, useLang, useAnnotations, useSessions, uid } from '../store';
import { loadFile } from '../lib/storage';
import { openFlow, type FlowContent, CHARS_PER_PAGE, pdfOutline } from '../lib/parse';
import { getPdfjs } from '../lib/pdf';
import { FlowReader, type Loc, type ReaderApi } from './FlowReader';
import { PdfReader } from './PdfReader';
import { Appearance } from './Appearance';
import { SoundPanel } from './SoundPanel';
import { useTts, play as ttsPlay, pause as ttsPause, resume as ttsResume, stop as ttsStop, skip as ttsSkip } from './tts';
import { stopAll as ambientStop, useAmbient } from './ambient';
import { cloudReady, downloadBook, useCloud } from '../lib/cloud';
import { Button, Ring } from '../components/ui';
import { JournalEditor } from '../pages/Journal';
import { byDay, dayKey, goalProgress, streaks } from '../lib/stats';
import { fmtDuration, fmtNum } from '../i18n';
import type { Annotation, Book, ReaderPrefs, Session } from '../types';

type Panel = null | 'toc' | 'search' | 'look' | 'marks' | 'goto' | 'sound';

export default function Reader({ bookId }: { bookId: string }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const book = useStore((st) => st.books[bookId]);
  const jump = useStore((st) => st.readerJump);
  const prefs = s.settings.reader;
  const setPrefs = (p: Partial<ReaderPrefs>) => s.setSettings({ reader: { ...prefs, ...p } });
  const [content, setContent] = useState<FlowContent | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [err, setErr] = useState('');
  const [chrome, setChrome] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [loc, setLoc] = useState<Loc>({ chapter: book?.position?.chapter ?? 0, ratio: book?.position?.ratio ?? 0, overall: book?.progress ?? 0, page: book?.position?.page });
  const [full, setFull] = useState(false);
  const [summary, setSummary] = useState<null | { secs: number; pages: number; exit: boolean }>(null);
  const [reflect, setReflect] = useState(false);
  const api = useRef<ReaderApi & { gotoPage?: (p: number) => void; searchAsync?: any }>(null);
  const annotations = useAnnotations();
  const bookAnn = useMemo(() => annotations.filter((a) => a.bookId === bookId), [annotations, bookId]);
  const isPdf = book?.format === 'pdf';
  const rtl = prefs.direction === 'auto' ? !!(book?.rtl || book?.language === 'ar') : prefs.direction === 'rtl';
  const session = useReadingSession(book);
  const ttsStatus = useTts((x) => x.status);
  const dl = useCloud((c) => c.downloads[bookId]);
  const ambientOn = useAmbient((x) => Object.values(x.volumes).some((v) => v > 0) || !!x.musicOn);
  useEffect(() => () => { ttsStop(); ambientStop(); }, []);
  useEffect(() => { if (ttsStatus === 'idle') (api.current as any)?.ttsClear?.(); }, [ttsStatus]);
  const bookLang = book?.language || (rtl ? 'ar' : 'en');
  const readAloud = () => {
    const a: any = api.current;
    if (!a) return;
    if (isPdf && pdf) {
      const start = (a.currentPage?.() || 1) - 1;
      ttsPlay({ units: pdf.numPages, lang: bookLang, getText: (u) => a.pageText(u + 1), onSentence: (u) => { session.touch(); if ((a.currentPage?.() || 1) !== u + 1) a.gotoPage(u + 1); }, onUnitChange: () => {} }, start, 0);
    } else if (content) {
      const pos = a.currentOffset?.() || { chapter: loc.chapter, offset: 0 };
      ttsPlay({ units: content.chapters.length, lang: bookLang, getText: (u) => content.chapters[u].text, onSentence: (u, st, en) => { session.touch(); a.ttsMark?.(u, st, en); }, onUnitChange: () => {} }, pos.chapter, pos.offset);
    }
    setPanel(null);
  };

  // load file
  useEffect(() => {
    if (!book) return;
    let cleanup = () => {};
    let alive = true;
    (async () => {
      try {
        let file = await loadFile(book.fileHash);
        if (!file && book.cloud && cloudReady()) file = await downloadBook(book);
        if (!file) { setErr(t('rd.fileMissing')); return; }
        if (book.format === 'pdf') {
          const pdfjs = await getPdfjs();
          const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
          if (!alive) { doc.destroy(); return; }
          setPdf(doc);
          cleanup = () => doc.destroy();
          if (!book.toc?.length) pdfOutline(doc).then((toc) => toc.length && s.updateBook(book.id, { toc }));
        } else {
          const c = await openFlow(file, book);
          if (!alive) { c.cleanup(); return; }
          setContent(c);
          cleanup = c.cleanup;
          const chars = c.chapters.reduce((a, x) => a + x.text.length, 0);
          if (!book.toc?.length || !book.chars) s.updateBook(book.id, { toc: c.toc, chars, pages: book.pagesEstimated !== false || !book.pages ? Math.max(1, Math.round(chars / CHARS_PER_PAGE)) : book.pages, pagesEstimated: book.pagesEstimated !== false || !book.pages });
        }
      } catch (e: any) { console.error(e); setErr(t('rd.openFailed') + ' ' + (e?.message || '')); }
    })();
    if (book.status === 'unread' || book.status === 'want' || book.status === 'onhold' || book.status === 'abandoned') s.setStatus(book.id, 'reading');
    return () => { alive = false; cleanup(); };
  }, [bookId]);

  // save position (debounced)
  const saveTimer = useRef<any>(null);
  const onLoc = useCallback((l: Loc) => {
    setLoc(l);
    session.progress.current = l.overall;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const b = useStore.getState().books[bookId];
      if (!b) return;
      const progress = Math.max(0, Math.min(1, l.overall));
      if (Math.abs((b.progress || 0) - progress) < 0.0005 && b.position?.chapter === l.chapter && b.position?.page === l.page) return;
      useStore.getState().updateBook(bookId, { progress, position: { chapter: l.chapter, ratio: Math.round(l.ratio * 10000) / 10000, page: l.page } });
    }, 800);
  }, [bookId]);

  // auto-hide chrome after reading starts
  const hideTimer = useRef<any>(null);
  const activity = useCallback(() => {
    session.touch();
    if (panel) return;
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChrome(false), 3500);
  }, [panel]);
  useEffect(() => { activity(); }, []);
  useEffect(() => { if (panel) { setChrome(true); clearTimeout(hideTimer.current); } else activity(); }, [panel]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (panel) setPanel(null); else exit(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const exit = () => {
    ttsStop();
    const r = session.end();
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* */ }
    if (r && r.secs >= 60) setSummary({ ...r, exit: true });
    else s.closeReader();
  };
  const endSession = () => { const r = session.end(); setSummary({ secs: r?.secs || 0, pages: r?.pages || 0, exit: false }); };
  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); setFull(false); }
      else { await document.documentElement.requestFullscreen(); setFull(true); }
    } catch { setFull(false); }
  };

  if (!book) return null;
  const totalPages = isPdf ? pdf?.numPages || book.pages : book.pages;
  const curPage = isPdf ? loc.page || 1 : totalPages ? Math.max(1, Math.round(loc.overall * totalPages)) : undefined;
  const chTitle = content?.chapters[loc.chapter]?.title;
  const bookmarkHere = bookAnn.find((a) => a.kind === 'bookmark' && (isPdf ? a.page === loc.page : a.chapter === loc.chapter && Math.abs((a.ratio ?? 0) - loc.ratio) < 0.04));
  const toggleBookmark = () => {
    if (bookmarkHere) { s.remove('annotations', bookmarkHere.id); return; }
    const a: Annotation = { id: uid('k'), updatedAt: Date.now(), bookId, kind: 'bookmark', target: isPdf ? 'page' : 'chapter', chapter: isPdf ? undefined : loc.chapter, ratio: isPdf ? undefined : loc.ratio, page: isPdf ? loc.page : undefined, chapterLabel: isPdf ? `${t('page')} ${loc.page}` : chTitle || `${t('rd.chapter')} ${loc.chapter + 1}`, text: api.current?.snippetHere() || undefined, createdAt: Date.now() };
    s.upsert('annotations', a);
    s.toast(t('rd.bookmark'));
  };
  const goAnn = (a: Annotation) => {
    if (isPdf && a.page) api.current?.gotoPage?.(a.page);
    else if (a.chapter != null) api.current?.goChapter(a.chapter, a.ratio ?? 0, a.kind === 'highlight' ? a.start : undefined);
    setPanel(null);
  };
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const SkipBackI = rtl ? ChevronRight : ChevronLeft;
  const SkipFwdI = rtl ? ChevronLeft : ChevronRight;
  const PrevI = rtl ? ChevronRight : ChevronLeft;
  const NextI = rtl ? ChevronLeft : ChevronRight;
  const remainSecs = totalPages ? (1 - loc.overall) * totalPages * session.secPerPage : 0;
  const finished = loc.overall >= 0.995 && book.status !== 'completed';

  return (
    <div className="reader-root fixed inset-0 z-[70] flex flex-col" data-theme={prefs.theme} style={prefs.customBg ? { background: prefs.customBg, color: prefs.customFg } : undefined} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* top bar */}
      <div className={`absolute inset-x-0 top-0 z-40 flex items-center gap-1 px-2 py-2 transition-all duration-300 sm:px-4 ${chrome ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0'}`} style={{ background: 'var(--r-bg)', borderBottom: '1px solid var(--r-line)' }}>
        <RBtn label={t('rd.exit')} onClick={exit}><Back size={20} /></RBtn>
        <div className="min-w-0 flex-1 px-2">
          <div className="truncate text-sm font-semibold" dir="auto">{book.title}</div>
          <div className="truncate text-xs" style={{ color: 'var(--r-muted)' }} dir="auto">{isPdf ? `${t('page')} ${fmtNum(lang, loc.page || 1)} / ${fmtNum(lang, totalPages || 0)}` : chTitle || book.authors[0]}</div>
        </div>
        <RBtn label={t('rd.toc')} onClick={() => setPanel(panel === 'toc' ? null : 'toc')}><List size={20} /></RBtn>
        <RBtn label={t('rd.search')} onClick={() => setPanel(panel === 'search' ? null : 'search')}><Search size={19} /></RBtn>
        <RBtn label={t('rd.bookmark')} onClick={toggleBookmark}>{bookmarkHere ? <BookmarkCheck size={20} style={{ color: 'var(--r-accent)' }} /> : <Bookmark size={20} />}</RBtn>
        <RBtn label={t('rd.annotations')} onClick={() => setPanel(panel === 'marks' ? null : 'marks')}><StickyNote size={19} /></RBtn>
        <RBtn label={t('snd.title')} onClick={() => setPanel(panel === 'sound' ? null : 'sound')}><Headphones size={19} style={ttsStatus !== 'idle' || ambientOn ? { color: 'var(--r-accent)' } : undefined} /></RBtn>
        <RBtn label={t('rd.appearance')} onClick={() => setPanel(panel === 'look' ? null : 'look')}><Type size={20} /></RBtn>
        <RBtn label={t('rd.full')} onClick={toggleFull} className="hidden sm:inline-flex">{full ? <Minimize size={19} /> : <Maximize size={19} />}</RBtn>
      </div>

      {/* content */}
      <div className="relative min-h-0 flex-1">
        {err ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"><p>{err}</p><Button onClick={() => s.closeReader()}>{t('close')}</Button></div>
        ) : !content && !pdf ? (
          <div className="flex h-full items-center justify-center gap-2" style={{ color: 'var(--r-muted)' }}><Loader2 className="animate-spin" size={20} />{dl != null ? `${t('cloud.downloading')} ${Math.round(dl * 100)}%` : t('loading')}</div>
        ) : pdf ? (
          <PdfReader ref={api as any} book={book} doc={pdf} prefs={prefs} rtl={rtl} initialPage={jump?.page ?? book.position?.page ?? 1} onLoc={onLoc} onTapCenter={() => setChrome((c) => !c)} onActivity={activity} />
        ) : (
          <FlowReader ref={api} book={book} chapters={content!.chapters} prefs={prefs} rtl={rtl} initial={jump && (jump.chapter != null) ? { chapter: jump.chapter, ratio: jump.ratio, start: jump.start } : null} annotations={bookAnn} onLoc={onLoc} onTapCenter={() => setChrome((c) => !c)} onActivity={activity} />
        )}
        {finished && (content || pdf) && (
          <div className="absolute inset-x-0 bottom-24 z-30 mx-auto flex w-fit items-center gap-3 rounded-full bg-forest px-4 py-2 text-sm text-ivory shadow-lg">
            <CheckCircle2 size={18} />{t('bd.markDone')}?
            <button type="button" className="rounded-full bg-ivory/20 px-3 py-1" onClick={() => { s.setStatus(bookId, 'completed'); s.toast(t('toast.statusChanged')); }}>{t('yes')}</button>
          </div>
        )}
      </div>

      {ttsStatus !== 'idle' && (
        <div className="absolute inset-x-0 bottom-24 z-30 mx-auto flex w-fit items-center gap-1 rounded-full px-2 py-1 shadow-lg" style={{ background: 'var(--r-bg)', border: '1px solid var(--r-line)' }}>
          <RBtn small label={t('previous')} onClick={() => ttsSkip(-1)}><SkipBackI size={15} /></RBtn>
          <RBtn label={ttsStatus === 'playing' ? t('rd.pause') : t('rd.resume')} onClick={() => (ttsStatus === 'playing' ? ttsPause() : ttsResume())}>{ttsStatus === 'playing' ? <Pause size={18} /> : <Play size={18} />}</RBtn>
          <RBtn small label={t('next')} onClick={() => ttsSkip(1)}><SkipFwdI size={15} /></RBtn>
          <RBtn small label={t('snd.stop')} onClick={ttsStop}><X size={15} /></RBtn>
        </div>
      )}

      {/* bottom bar */}
      <div className={`absolute inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 transition-all duration-300 sm:px-5 ${chrome ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'}`} style={{ background: 'var(--r-bg)', borderTop: '1px solid var(--r-line)' }}>
        <div className="flex items-center gap-2" dir={rtl ? 'rtl' : 'ltr'}>
          <RBtn label={isPdf ? t('previous') : t('rd.prevCh')} onClick={() => (isPdf ? api.current?.prev() : api.current?.goChapter(Math.max(0, loc.chapter - 1), 0))}><PrevI size={20} /></RBtn>
          <input type="range" min={0} max={1000} value={Math.round(loc.overall * 1000)} aria-label={t('rd.goto')} className="flex-1 accent-[var(--r-accent)]" onChange={(e) => api.current?.gotoOverall(Number(e.target.value) / 1000)} />
          <RBtn label={isPdf ? t('next') : t('rd.nextCh')} onClick={() => (isPdf ? api.current?.next() : api.current?.goChapter(Math.min((content?.chapters.length || 1) - 1, loc.chapter + 1), 0))}><NextI size={20} /></RBtn>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'var(--r-muted)' }}>
          <button type="button" className="min-h-[32px] rounded-full px-2 hover:underline" onClick={() => setPanel(panel === 'goto' ? null : 'goto')}>
            {t('pct', { n: Math.round(loc.overall * 100) })}{curPage && totalPages ? ` · ${book.pagesEstimated && !isPdf ? '≈ ' : ''}${fmtNum(lang, curPage)} / ${fmtNum(lang, totalPages)}` : ''}{remainSecs > 60 ? ` · ${t('rd.left', { t: fmtDuration(lang, remainSecs) })}` : ''}
          </button>
          <div className="flex items-center gap-1">
            <span className="tabular-nums">{session.running ? '' : t('rd.paused') + ' · '}{fmtClock(session.secs)}</span>
            <RBtn small label={session.running ? t('rd.pause') : t('rd.resume')} onClick={session.toggle}>{session.running ? <Pause size={15} /> : <Play size={15} />}</RBtn>
            <RBtn small label={t('rd.end')} onClick={endSession}><Square size={14} /></RBtn>
          </div>
        </div>
      </div>

      {/* side panel */}
      {panel && (
        <div className="absolute inset-0 z-50 flex justify-end bg-black/30" onClick={() => setPanel(null)}>
          <div className="fade-in flex h-full w-full max-w-sm flex-col shadow-2xl" style={{ background: 'var(--r-bg)', color: prefs.customFg }} onClick={(e) => e.stopPropagation()} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--r-line)' }}>
              <h2 className="font-semibold">{{ toc: t('rd.toc'), search: t('rd.search'), look: t('rd.appearance'), marks: t('rd.annotations'), goto: t('rd.goto'), sound: t('snd.title') }[panel]}</h2>
              <RBtn label={t('close')} onClick={() => setPanel(null)}><X size={18} /></RBtn>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto p-4">
              {panel === 'toc' && <Toc book={book} content={content} isPdf={isPdf} cur={isPdf ? loc.page : loc.chapter} go={(x) => { if (isPdf && x.page) api.current?.gotoPage?.(x.page); else if (x.chapter != null) api.current?.goChapter(x.chapter, 0); setPanel(null); }} />}
              {panel === 'search' && <SearchPanel api={api} isPdf={isPdf} close={() => setPanel(null)} />}
              {panel === 'look' && <Appearance prefs={prefs} onChange={setPrefs} pdf={isPdf} />}
              {panel === 'sound' && <SoundPanel lang={bookLang} onReadFromHere={readAloud} />}
              {panel === 'goto' && <GotoPanel isPdf={isPdf} total={totalPages} api={api} close={() => setPanel(null)} />}
              {panel === 'marks' && <MarksPanel bookId={bookId} ann={bookAnn} isPdf={isPdf} loc={loc} chTitle={chTitle} go={goAnn} />}
            </div>
          </div>
        </div>
      )}

      {summary && <SessionSummary book={book} secs={summary.secs} pages={summary.pages} onReflect={() => setReflect(true)} onClose={() => { const ex = summary.exit; setSummary(null); if (ex) s.closeReader(); else session.restart(); }} exitLabel={summary.exit} />}
      {reflect && <JournalEditor entry={{ id: uid('j'), updatedAt: Date.now(), createdAt: Date.now(), body: '', kind: 'session', bookId, author: book.authors[0], sessionId: session.lastId || undefined }} onClose={() => setReflect(false)} />}
    </div>
  );
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function RBtn({ label, onClick, children, className = '', small }: { label: string; onClick: () => void; children: React.ReactNode; className?: string; small?: boolean }) {
  return <button type="button" title={label} aria-label={label} onClick={(e) => { e.stopPropagation(); onClick(); }} className={`inline-flex shrink-0 items-center justify-center rounded-full hover:bg-black/5 ${small ? 'h-8 w-8' : 'h-11 w-11'} ${className}`}>{children}</button>;
}

function useReadingSession(book: Book | undefined) {
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(true);
  const state = useRef({ id: uid('s'), start: Date.now(), secs: 0, lastAct: Date.now(), startProgress: book?.progress ?? 0, saved: false, lastId: '' });
  const progress = useRef(book?.progress ?? 0);
  const sessions = useSessions();
  const mine = sessions.filter((x) => x.bookId === book?.id);
  const pastSecs = mine.reduce((a, x) => a + x.seconds, 0), pastPages = mine.reduce((a, x) => a + x.pages, 0);
  const secPerPage = pastPages >= 5 && pastSecs > 300 ? pastSecs / pastPages : 90;

  const pagesNow = () => {
    const total = book?.pages || 0;
    const p = Math.max(0, Math.round((progress.current - state.current.startProgress) * total));
    return Math.min(p, Math.ceil(state.current.secs / 8));
  };
  const save = () => {
    const st = state.current;
    if (!book || st.secs < 15) return null;
    const rec: Session = { id: st.id, updatedAt: Date.now(), bookId: book.id, start: st.start, end: Date.now(), seconds: Math.round(st.secs), pages: pagesNow(), chapters: 0, day: dayKey(st.start) };
    useStore.getState().upsert('sessions', rec);
    st.lastId = st.id;
    return rec;
  };
  useEffect(() => {
    const id = setInterval(() => {
      const st = state.current;
      if (running && document.visibilityState === 'visible' && Date.now() - st.lastAct < 5 * 60000) { st.secs += 1; setSecs(st.secs); }
      if (st.secs > 0 && st.secs % 60 === 0 && running) save();
    }, 1000);
    return () => clearInterval(id);
  }, [running, book?.id]);
  useEffect(() => () => { save(); }, []);
  return {
    secs, running, progress, secPerPage,
    get lastId() { return state.current.lastId; },
    touch: () => { state.current.lastAct = Date.now(); },
    toggle: () => { state.current.lastAct = Date.now(); setRunning((r) => !r); },
    end: () => { const r = save(); const out = { secs: state.current.secs, pages: r?.pages ?? 0 }; setRunning(false); return out; },
    restart: () => { state.current = { ...state.current, id: uid('s'), start: Date.now(), secs: 0, lastAct: Date.now(), startProgress: progress.current }; setSecs(0); setRunning(true); },
  };
}

function SessionSummary({ book, secs, pages, onClose, onReflect, exitLabel }: { book: Book; secs: number; pages: number; onClose: () => void; onReflect: () => void; exitLabel: boolean }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const sessions = useSessions();
  const days = byDay(sessions);
  const goal = goalProgress(s.settings, days.get(dayKey()));
  const st = streaks(days);
  const msg = goal.met ? t('ss.m4') : secs < 300 ? t('ss.short') : [t('ss.m1'), t('ss.m2'), t('ss.m3')][Math.floor(secs) % 3];
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="fade-in w-full max-w-sm rounded-3xl bg-card p-6 text-center text-ink shadow-2xl" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="mb-1 text-sm text-muted">{t('ss.title')}</div>
        <div className="serif mb-4 line-clamp-2 text-xl font-semibold" dir="auto">{book.title}</div>
        <div className="mb-4 flex justify-center"><Ring value={goal.ratio} size={96} stroke={8}><span>{fmtNum(lang, goal.done)}<span className="block text-[10px] font-normal text-muted">/ {fmtNum(lang, goal.target)}</span></span></Ring></div>
        <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-xl bg-paper/70 p-2"><div className="text-xs text-muted">{t('ss.time')}</div><div className="font-semibold">{fmtDuration(lang, secs)}</div></div>
          <div className="rounded-xl bg-paper/70 p-2"><div className="text-xs text-muted">{t('ss.pages')}</div><div className="font-semibold">{pages ? fmtNum(lang, pages) : '—'}</div></div>
          <div className="rounded-xl bg-paper/70 p-2"><div className="text-xs text-muted">{t('ss.streak')}</div><div className="font-semibold">{fmtNum(lang, st.current)} {t('home.days')}</div></div>
        </div>
        <p className="serif mb-5 text-[17px]">{msg}</p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={onClose}>{exitLabel ? t('done') : t('rd.resume')}</Button>
          <Button variant="ghost" onClick={onReflect}>{t('ss.reflect')}</Button>
        </div>
      </div>
    </div>
  );
}

function Toc({ book, content, isPdf, cur, go }: { book: Book; content: FlowContent | null; isPdf: boolean; cur?: number; go: (x: { chapter?: number; page?: number }) => void }) {
  const t = useT();
  const toc = (isPdf ? book.toc : content?.toc) || [];
  if (!toc.length) return <p className="text-sm opacity-70">{t('rd.noToc')}</p>;
  return (
    <div className="flex flex-col">
      {toc.map((x, i) => {
        const active = isPdf ? x.page === cur : x.chapter === cur;
        return (
          <button key={i} type="button" onClick={() => go(x)} className={`flex min-h-[40px] items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-start text-sm hover:bg-black/5 ${active ? 'font-semibold' : ''}`} style={{ paddingInlineStart: 12 + (x.level || 0) * 14, color: active ? 'var(--r-accent)' : undefined }}>
            <span className="line-clamp-2" dir="auto">{x.label}</span>{x.page && <span className="text-xs opacity-60">{x.page}</span>}
          </button>
        );
      })}
    </div>
  );
}

function SearchPanel({ api, isPdf, close }: { api: React.RefObject<any>; isPdf: boolean; close: () => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ chapter: number; start: number; end: number; snippet: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!api.current) return;
    if (isPdf) { setBusy(true); setRes([]); const r = await api.current.searchAsync(q, setRes); setRes(r); setBusy(false); }
    else setRes(api.current.search(q));
  };
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="mb-3 flex gap-2">
        <input autoFocus className="field" dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('rd.search')} />
        <Button variant="primary" type="submit" aria-label={t('search')}><Search size={16} /></Button>
      </form>
      {busy && <p className="mb-2 text-sm opacity-70">{t('rd.searching')}</p>}
      {res && <p className="mb-2 text-sm opacity-70">{res.length ? t('rd.results', { n: res.length }) : busy ? '' : t('rd.noResults')}</p>}
      <div className="flex flex-col gap-1">
        {res?.slice(0, 200).map((r, i) => (
          <button key={i} type="button" className="rounded-lg p-2 text-start text-sm hover:bg-black/5" onClick={() => { api.current.showMatch(r.chapter, r.start, r.end); close(); }}>
            <span className="block text-xs opacity-60">{isPdf ? `${t('page')} ${r.chapter}` : `${t('rd.chapter')} ${r.chapter + 1}`}</span>
            <span dir="auto">{r.snippet}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GotoPanel({ isPdf, total, api, close }: { isPdf: boolean; total?: number; api: React.RefObject<any>; close: () => void }) {
  const t = useT();
  const [page, setPage] = useState('');
  const [pct, setPct] = useState('');
  return (
    <div className="flex flex-col gap-4">
      {total ? (
        <form onSubmit={(e) => { e.preventDefault(); const p = Math.max(1, Math.min(total, Number(page))); if (isPdf) api.current?.gotoPage(p); else api.current?.gotoOverall((p - 1) / Math.max(1, total - 1)); close(); }} className="flex items-end gap-2">
          <label className="flex-1"><span className="mb-1 block text-sm">{t('rd.gotoPage')} (1–{total})</span><input className="field" type="number" min={1} max={total} value={page} onChange={(e) => setPage(e.target.value)} /></label>
          <Button variant="primary" type="submit">{t('rd.goto')}</Button>
        </form>
      ) : null}
      <form onSubmit={(e) => { e.preventDefault(); api.current?.gotoOverall(Math.max(0, Math.min(100, Number(pct))) / 100); close(); }} className="flex items-end gap-2">
        <label className="flex-1"><span className="mb-1 block text-sm">{t('rd.gotoPct')} (0–100)</span><input className="field" type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} /></label>
        <Button variant="primary" type="submit">{t('rd.goto')}</Button>
      </form>
    </div>
  );
}

function MarksPanel({ bookId, ann, isPdf, loc, chTitle, go }: { bookId: string; ann: Annotation[]; isPdf: boolean; loc: Loc; chTitle?: string; go: (a: Annotation) => void }) {
  const t = useT();
  const s = useStore();
  const [note, setNote] = useState('');
  const sorted = [...ann].filter((a) => a.target !== 'author').sort((a, b) => (isPdf ? (a.page || 0) - (b.page || 0) : (a.chapter ?? -1) - (b.chapter ?? -1) || (a.start ?? (a.ratio || 0) * 1e6) - (b.start ?? (b.ratio || 0) * 1e6)));
  const addNote = () => {
    if (!note.trim()) return;
    s.upsert('annotations', { id: uid('n'), updatedAt: Date.now(), bookId, kind: 'note', target: isPdf ? 'page' : 'chapter', chapter: isPdf ? undefined : loc.chapter, ratio: isPdf ? undefined : loc.ratio, page: isPdf ? loc.page : undefined, chapterLabel: isPdf ? `${t('page')} ${loc.page}` : chTitle || `${t('rd.chapter')} ${loc.chapter + 1}`, note: note.trim(), createdAt: Date.now() });
    setNote('');
  };
  const colors: Record<string, string> = { yellow: '#e8c547', blue: '#6eaae6', green: '#82c882', pink: '#f08cb4', orange: '#f5a55a' };
  return (
    <div>
      {isPdf && <p className="mb-3 rounded-lg p-2 text-xs opacity-70" style={{ background: 'var(--r-line)' }}>{t('rd.pdfNoHl')}</p>}
      <div className="mb-4">
        <span className="mb-1 block text-sm">{isPdf ? `${t('an.addNote')} · ${t('page')} ${loc.page}` : t('an.chapterNote')}</span>
        <textarea className="field !min-h-[70px]" dir="auto" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('rd.notePlaceholder')} />
        <Button size="sm" variant="primary" className="mt-2" disabled={!note.trim()} onClick={addNote}>{t('save')}</Button>
      </div>
      {!sorted.length && <p className="text-sm opacity-70">{t('an.empty')}</p>}
      <div className="flex flex-col gap-2">
        {sorted.map((a) => (
          <div key={a.id} className="flex gap-2 rounded-xl p-2" style={{ border: '1px solid var(--r-line)' }}>
            <span className="w-1 shrink-0 rounded-full" style={{ background: a.color ? colors[a.color] : a.kind === 'bookmark' ? '#7b2d35' : 'var(--r-accent)' }} />
            <button type="button" className="min-w-0 flex-1 text-start text-sm" onClick={() => go(a)}>
              <span className="flex items-center gap-1 text-xs opacity-60">{a.kind === 'bookmark' ? <Bookmark size={12} /> : a.kind === 'note' ? <StickyNote size={12} /> : null}{a.chapterLabel}</span>
              {a.text && <span className="line-clamp-3 block" dir="auto">{a.text}</span>}
              {a.note && <span className="mt-1 block opacity-80" dir="auto">✎ {a.note}</span>}
            </button>
            <button type="button" aria-label={t('delete')} className="h-8 w-8 shrink-0 rounded-full opacity-60 hover:bg-black/5" onClick={() => s.remove('annotations', a.id)}><X size={14} className="mx-auto" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
