import { useEffect, useMemo, useState } from 'react';
import { Cloud, CloudDownload, CloudUpload, BookOpen, CheckCircle2, Heart, FolderPlus, Edit3, Share2, Sparkles, Trash2, Search as SearchIcon, AlertTriangle, PenLine, Loader2 } from 'lucide-react';
import { useStore, useT, useLang, useAnnotations, useSessions, uid } from '../store';
import { Button, Card, ConfirmDialog, EmptyState, Field, Modal, ProgressBar, SectionHeader, Stars, TagInput, Watermark } from '../components/ui';
import { BookCover, STATUSES, AddToCollection, invalidateCover, statusDot } from '../components/books';
import { AnnotationCard, NoteEditor } from './Notes';
import { countries, countryName } from '../lib/world';
import { genreDefs, genreLabel, themeTags } from '../lib/genres';
import { hasFile, saveCover } from '../lib/storage';
import { shrinkImage } from '../lib/parse';
import { searchOpenLibrary, askClaudeForBook, type Suggestion } from '../lib/net';
import { isHostedByClaude } from '../lib/claude';
const inClaude = isHostedByClaude();
import { fmtDate, fmtDuration, fmtNum } from '../i18n';
import { useCloud, cloudSupported, enqueueUpload, downloadBook, removeFromCloud, markCoverDirty } from '../lib/cloud';
import { CloudProgress } from '../components/CloudCard';
import { remainingSeconds } from '../lib/stats';
import type { Annotation, Book } from '../types';

export default function BookPage({ id }: { id: string }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const book = useStore((st) => st.books[id]);
  const ann = useAnnotations().filter((a) => a.bookId === id && a.target !== 'author');
  const sessions = useSessions();
  const [fileOk, setFileOk] = useState(true);
  const [edit, setEdit] = useState(false);
  const [col, setCol] = useState(false);
  const [del, setDel] = useState(false);
  const [enrich, setEnrich] = useState(false);
  const [noteEdit, setNoteEdit] = useState<Annotation | null>(null);
  const [review, setReview] = useState(book?.review || '');
  const cloudOn = useCloud((c) => c.status === 'on' || c.status === 'syncing');
  const busyCloud = useCloud((c) => c.uploads[id] != null || c.downloads[id] != null);
  useEffect(() => { if (book) hasFile(book.fileHash).then(setFileOk); }, [book?.fileHash]);
  useEffect(() => { setReview(book?.review || ''); }, [id]);
  useEffect(() => { if (!book || review === (book.review || '')) return; const h = setTimeout(() => s.updateBook(id, { review }), 700); return () => clearTimeout(h); }, [review]);
  const readSecs = useMemo(() => sessions.filter((x) => x.bookId === id).reduce((a, x) => a + x.seconds, 0), [sessions, id]);
  if (!book || book.deleted) return <EmptyState title={t('books.empty')} />;
  const rem = remainingSeconds(book, sessions);
  const share = () => {
    const txt = [book.title, book.authors.join(', '), [book.publisher, book.year].filter(Boolean).join(', '), book.isbn ? 'ISBN ' + book.isbn : '', book.description?.slice(0, 400)].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(txt).then(() => s.toast(t('bd.sharedText')), () => {});
  };
  const meta: [string, React.ReactNode][] = [
    [t('bd.originalTitle'), book.originalTitle],
    [t('bd.altTitles'), book.altTitles?.join(' · ')],
    [t('bd.translator'), book.translator],
    [t('bd.publisher'), book.publisher],
    [t('bd.date'), book.year],
    [t('bd.language'), book.language === 'ar' ? t('lang.ar') : book.language === 'en' ? t('lang.en') : book.language],
    [t('bd.origin'), book.countries.length ? <span className="flex flex-wrap gap-1.5">{book.countries.map((c) => <button key={c} type="button" className="underline-offset-2 hover:underline" onClick={() => s.navigate({ name: 'country', id: c })}>{countryName(c, lang)}</button>)}</span> : null],
    [t('bd.genres'), book.genres.length ? <span className="flex flex-wrap gap-1.5">{book.genres.map((g) => <button key={g} type="button" className="rounded-full bg-paper px-2.5 py-0.5 text-sm hover:bg-line" onClick={() => s.navigate({ name: 'genre', id: g })}>{genreLabel(g, lang)}</button>)}</span> : null],
    [t('bd.tags'), book.tags.length ? <span className="flex flex-wrap gap-1.5">{book.tags.map((g) => <button key={g} type="button" className="rounded-full border border-line px-2.5 py-0.5 text-sm hover:bg-paper" onClick={() => s.navigate({ name: 'tag', id: g })}>{g}</button>)}</span> : null],
    [t('bd.isbn'), book.isbn],
    [t('bd.pages'), book.pages ? `${fmtNum(lang, book.pages)}${book.pagesEstimated ? ` (${t('bd.estPages')})` : ''}` : null],
    [t('bd.added'), fmtDate(lang, book.addedAt)],
    [t('bd.started'), book.startedAt ? fmtDate(lang, book.startedAt) : null],
    [t('bd.completed'), book.completedAt ? fmtDate(lang, book.completedAt) : null],
    [t('stats.time'), readSecs ? fmtDuration(lang, readSecs) : null],
    [t('bd.file'), <span className="break-all text-sm" dir="auto">{book.fileName} · {book.format.toUpperCase()} · {(book.fileSize / 1e6).toFixed(1)} MB{book.sourceFolder ? <span className="block text-muted">{book.sourceFolder}</span> : null}</span>],
  ];
  return (
    <div>
      <div className="relative mb-10 grid gap-8 overflow-hidden md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="mx-auto w-48 md:w-full">
          <BookCover book={book} size="lg" className="w-full" />
          <label className="mt-3 flex cursor-pointer justify-center text-sm text-muted hover:text-ink">{t('bd.changeCover')}
            <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; await saveCover(id, await shrinkImage(f)); invalidateCover(id); s.updateBook(id, { hasCover: true }); markCoverDirty(id); }} />
          </label>
        </div>
        <div className="relative min-w-0">
          <Watermark className="-bottom-4 end-0" size={70} />
          <h1 className="text-[30px] font-semibold leading-tight sm:text-[42px]" dir="auto">{book.title}</h1>
          {book.subtitle && <p className="serif mt-1 text-xl text-muted" dir="auto">{book.subtitle}</p>}
          <div className="mt-2 flex flex-wrap gap-x-3 text-lg">
            {book.authors.length ? book.authors.map((a) => <button key={a} type="button" className="text-forest hover:underline" dir="auto" onClick={() => s.navigate({ name: 'author', id: a })}>{a}</button>) : <span className="text-muted">{t('unknown.author')}</span>}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <select className="field !w-auto !rounded-full !py-1" value={book.status} onChange={(e) => { s.setStatus(id, e.target.value as any); s.toast(t('toast.statusChanged')); }} aria-label={t('status')}>
              {STATUSES.map((x) => <option key={x} value={x}>{t('st.' + x)}</option>)}
            </select>
            <span className={`h-2.5 w-2.5 rounded-full ${statusDot[book.status]}`} />
            <Stars value={book.rating} onChange={(v) => s.updateBook(id, { rating: v })} />
          </div>
          {book.progress > 0 && (
            <div className="mt-4 max-w-md">
              <div className="mb-1 flex justify-between text-sm text-muted"><span>{t('pct', { n: Math.round(book.progress * 100) })}</span><span>{rem && book.progress < 1 ? t('card.left', { t: fmtDuration(lang, rem) }) : ''}</span></div>
              <ProgressBar value={book.progress} />
            </div>
          )}
          {!fileOk && (book.cloud && cloudOn ? (
            <div className="mt-4 rounded-xl bg-forest/10 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-3"><Cloud size={18} className="text-forest" /><span className="flex-1">{t('cloud.notHere')}</span>
                <Button size="sm" variant="primary" disabled={busyCloud} onClick={async () => { try { await downloadBook(book); setFileOk(true); } catch (e: any) { s.toast(String(e?.message || e)); } }}><CloudDownload size={15} />{t('cloud.download')}</Button></div>
              <CloudProgress id={id} />
            </div>
          ) : <div className="mt-4 flex items-start gap-2 rounded-xl bg-wine/10 p-3 text-sm text-wine"><AlertTriangle size={18} className="shrink-0" />{book.cloud && cloudSupported() ? t('cloud.connectToGet') : t('bd.noFile')}</div>)}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" disabled={!fileOk} onClick={() => s.openReader(id)}><BookOpen size={18} />{book.progress > 0 && book.progress < 1 ? t('bd.continue') : t('bd.read')}</Button>
            {book.status !== 'completed' && <Button onClick={() => { s.setStatus(id, 'completed'); s.toast(t('toast.statusChanged')); }}><CheckCircle2 size={18} />{t('bd.markDone')}</Button>}
            <Button variant="outline" onClick={() => s.updateBook(id, { favorite: !book.favorite })}><Heart size={18} className={book.favorite ? 'fill-wine text-wine' : ''} />{book.favorite ? t('bd.unfav') : t('bd.fav')}</Button>
            <Button variant="outline" onClick={() => setCol(true)}><FolderPlus size={18} />{t('col.addTo')}</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEdit(true)}><Edit3 size={15} />{t('bd.edit')}</Button>
            <Button variant="ghost" size="sm" onClick={() => setEnrich(true)}><Sparkles size={15} />{t('bd.enrich')}</Button>
            <Button variant="ghost" size="sm" onClick={() => setNoteEdit({ id: uid('n'), updatedAt: Date.now(), bookId: id, kind: 'note', target: 'book', createdAt: Date.now() })}><PenLine size={15} />{t('rd.note')}</Button>
            <Button variant="ghost" size="sm" onClick={share}><Share2 size={15} />{t('bd.share')}</Button>
            {cloudOn && fileOk && !book.cloud && <Button variant="ghost" size="sm" disabled={busyCloud} onClick={() => enqueueUpload(book)}><CloudUpload size={15} />{t('cloud.save')}</Button>}
            {cloudOn && book.cloud && <Button variant="ghost" size="sm" onClick={() => removeFromCloud(book).catch((e) => s.toast(String(e?.message || e)))}><Cloud size={15} className="text-forest" />{t('cloud.remove')}</Button>}
            <Button variant="ghost" size="sm" onClick={() => setDel(true)}><Trash2 size={15} />{t('bd.deleteBook')}</Button>
          </div>
          {fileOk && <CloudProgress id={id} />}
          {book.description && <div className="mt-6"><h2 className="mb-2 font-semibold">{t('bd.description')}</h2><p className="max-w-[68ch] whitespace-pre-line leading-relaxed" dir="auto">{book.description}</p></div>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-3 text-[15px]">
            {meta.filter(([, v]) => v).map(([k, v]) => <div key={k} className="contents"><dt className="text-sm text-muted">{k}</dt><dd dir="auto">{v}</dd></div>)}
          </dl>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">{t('bd.review')}</h2>
          <textarea className="field !min-h-[160px]" dir="auto" placeholder={t('bd.writeReview')} value={review} onChange={(e) => setReview(e.target.value)} />
        </Card>
      </div>

      {book.toc && book.toc.length > 1 && (
        <section className="mt-10">
          <SectionHeader title={t('bd.toc')} />
          <Card className="scroll-thin max-h-80 overflow-y-auto !p-2">
            {book.toc.slice(0, 400).map((x, i) => (
              <button key={i} type="button" disabled={!fileOk} onClick={() => s.openReader(id, { chapter: x.chapter, page: x.page, ratio: 0 })} className="block w-full truncate rounded-lg px-3 py-2 text-start text-sm hover:bg-paper" style={{ paddingInlineStart: 12 + (x.level || 0) * 16 }} dir="auto">{x.label}</button>
            ))}
          </Card>
        </section>
      )}

      {ann.length > 0 && (
        <section className="mt-10">
          <SectionHeader title={`${t('an.title')} · ${ann.length}`} />
          <div className="columns-1 gap-4 md:columns-2">{ann.sort((a, b) => (a.chapter ?? a.page ?? 0) - (b.chapter ?? b.page ?? 0)).map((a) => <AnnotationCard key={a.id} a={a} compact onEdit={() => setNoteEdit(a)} />)}</div>
        </section>
      )}

      {edit && <EditBook book={book} onClose={() => setEdit(false)} />}
      {enrich && <Enrich book={book} onClose={() => setEnrich(false)} />}
      {noteEdit && <NoteEditor a={noteEdit} onClose={() => setNoteEdit(null)} />}
      <AddToCollection open={col} onClose={() => setCol(false)} bookIds={[id]} />
      <ConfirmDialog open={del} onClose={() => setDel(false)} text={t('bd.deleteConfirm', { t: book.title })} onConfirm={async () => { await s.deleteBook(id); s.toast(t('toast.deleted')); s.back(); }} />
    </div>
  );
}

const split = (v: string) => v.split(/[,،]/).map((x) => x.trim()).filter(Boolean);

function EditBook({ book, onClose }: { book: Book; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const [v, setV] = useState<Book>(book);
  const [authors, setAuthors] = useState(book.authors.join('، '));
  const [alt, setAlt] = useState((book.altTitles || []).join('، '));
  const allTags = useMemo(() => [...new Set([...themeTags.map((x) => x[lang]), ...Object.values(s.books).flatMap((b) => b.tags)])], [lang]);
  const customGenres = useMemo(() => [...new Set(Object.values(s.books).flatMap((b) => b.genres))].filter((g) => !genreDefs.some((d) => d.id === g)), []);
  const up = (p: Partial<Book>) => setV({ ...v, ...p });
  const save = () => {
    s.upsert('books', { ...v, title: v.title.trim() || book.title, authors: split(authors), altTitles: split(alt), pages: v.pages ? Number(v.pages) : undefined, pagesEstimated: v.pages !== book.pages ? false : v.pagesEstimated, rtl: v.language === 'ar' ? true : v.rtl });
    s.toast(t('toast.saved')); onClose();
  };
  const toggleIn = (k: 'genres' | 'countries', id: string) => up({ [k]: v[k].includes(id) ? v[k].filter((x) => x !== id) : [...v[k], id] } as any);
  return (
    <Modal open onClose={onClose} title={t('bd.edit')} wide footer={<><Button variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" onClick={save}>{t('save')}</Button></>}>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label={t('bd.title')}><input className="field" dir="auto" value={v.title} onChange={(e) => up({ title: e.target.value })} /></Field>
        <Field label={t('bd.subtitle')}><input className="field" dir="auto" value={v.subtitle || ''} onChange={(e) => up({ subtitle: e.target.value })} /></Field>
        <Field label={t('bd.originalTitle')}><input className="field" dir="auto" value={v.originalTitle || ''} onChange={(e) => up({ originalTitle: e.target.value })} /></Field>
        <Field label={t('bd.altTitles')} hint={t('bd.commaHint')}><input className="field" dir="auto" value={alt} onChange={(e) => setAlt(e.target.value)} /></Field>
        <Field label={t('bd.authors')} hint={t('bd.authorsHint')}><input className="field" dir="auto" value={authors} onChange={(e) => setAuthors(e.target.value)} /></Field>
        <Field label={t('bd.translator')}><input className="field" dir="auto" value={v.translator || ''} onChange={(e) => up({ translator: e.target.value })} /></Field>
        <Field label={t('bd.publisher')}><input className="field" dir="auto" value={v.publisher || ''} onChange={(e) => up({ publisher: e.target.value })} /></Field>
        <Field label={t('bd.year')}><input className="field" inputMode="numeric" value={v.year || ''} onChange={(e) => up({ year: e.target.value })} /></Field>
        <Field label={t('bd.isbn')}><input className="field" dir="ltr" value={v.isbn || ''} onChange={(e) => up({ isbn: e.target.value })} /></Field>
        <Field label={t('bd.language')}>
          <select className="field" value={v.language || ''} onChange={(e) => up({ language: e.target.value || undefined })}>
            <option value="">—</option><option value="ar">العربية</option><option value="en">English</option>
            {['fr', 'de', 'es', 'ru', 'tr', 'fa', 'ur', 'it', 'ja', 'zh'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <Field label={t('bd.pages')}><input className="field" type="number" min={1} value={v.pages || ''} onChange={(e) => up({ pages: Number(e.target.value) || undefined })} /></Field>
        <Field label={t('status')}><select className="field" value={v.status} onChange={(e) => up({ status: e.target.value as any })}>{STATUSES.map((x) => <option key={x} value={x}>{t('st.' + x)}</option>)}</select></Field>
      </div>
      <Field label={t('bd.origin')}>
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">{countries.map((c) => <button key={c.id} type="button" onClick={() => toggleIn('countries', c.id)} className={`rounded-full border px-2.5 py-1 text-sm ${v.countries.includes(c.id) ? 'border-forest bg-forest text-ivory' : 'border-line'}`}>{c.flag} {c.lit[lang]}</button>)}</div>
      </Field>
      <Field label={t('bd.genres')}>
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">{[...genreDefs.map((g) => [g.id, g[lang]]), ...customGenres.map((g) => [g, g])].map(([gid, label]) => <button key={gid} type="button" onClick={() => toggleIn('genres', gid)} className={`rounded-full border px-2.5 py-1 text-sm ${v.genres.includes(gid) ? 'border-forest bg-forest text-ivory' : 'border-line'}`}>{label}</button>)}</div>
        <div className="mt-2"><TagInput value={v.genres.filter((g) => !genreDefs.some((d) => d.id === g))} onChange={(custom) => up({ genres: [...v.genres.filter((g) => genreDefs.some((d) => d.id === g)), ...custom] })} placeholder={t('gen.add')} /></div>
      </Field>
      <Field label={t('bd.tags')}><TagInput value={v.tags} onChange={(tags) => up({ tags })} suggestions={allTags} /></Field>
      <Field label={t('bd.description')}><textarea className="field" dir="auto" value={v.description || ''} onChange={(e) => up({ description: e.target.value })} /></Field>
    </Modal>
  );
}

function Enrich({ book, onClose }: { book: Book; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const [busy, setBusy] = useState<'' | 'ol' | 'ai'>('');
  const [res, setRes] = useState<Suggestion[]>([]);
  const [err, setErr] = useState('');
  const run = async (src: 'ol' | 'ai') => {
    setBusy(src); setErr('');
    try {
      if (src === 'ol') { const r = await searchOpenLibrary(book); setRes(r); if (!r.length) setErr(t('bd.noResults')); }
      else { const r = await askClaudeForBook(book, lang); if (!Object.keys(r.fields).length) setErr(t('bd.noResults')); else setRes([r]); }
    } catch (e: any) {
      setErr(e?.message === 'unavailable' ? t('ai.unavailable') : e instanceof TypeError && isHostedByClaude() ? t('imp.netBlocked') : `${t('ai.failed')} ${e?.message || ''}`);
    } finally { setBusy(''); }
  };
  const apply = async (sg: Suggestion, field?: string) => {
    const f: any = field ? { [field]: (sg.fields as any)[field] } : { ...sg.fields };
    const cur = s.books[book.id];
    if (f.genres) f.genres = [...new Set([...cur.genres, ...f.genres])];
    if (f.countries) f.countries = [...new Set([...cur.countries, ...f.countries])];
    if (f.tags) f.tags = [...new Set([...cur.tags, ...f.tags])];
    if (f.pages) f.pagesEstimated = false;
    if ((!field || field === 'cover') && sg.cover) { await saveCover(book.id, sg.cover); invalidateCover(book.id); f.hasCover = true; markCoverDirty(book.id); }
    delete f.cover;
    s.updateBook(book.id, f);
    s.toast(t('toast.saved'));
  };
  const label = (k: string) => ({ title: t('bd.title'), originalTitle: t('bd.originalTitle'), authors: t('bd.authors'), translator: t('bd.translator'), publisher: t('bd.publisher'), year: t('bd.year'), isbn: t('bd.isbn'), language: t('bd.language'), countries: t('bd.origin'), genres: t('bd.genres'), tags: t('bd.tags'), description: t('bd.description'), pages: t('bd.pages') } as any)[k] || k;
  const show = (k: string, v: any) => k === 'countries' ? v.map((c: string) => countryName(c, lang)).join('، ') : k === 'genres' ? v.map((g: string) => genreLabel(g, lang)).join('، ') : Array.isArray(v) ? v.join('، ') : String(v);
  return (
    <Modal open onClose={onClose} title={t('bd.enrich')} wide>
      <p className="mb-4 text-sm text-muted">{t('bd.enrichHint')}</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {inClaude && <Button variant="primary" disabled={!!busy} onClick={() => run('ai')}>{busy === 'ai' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{t('bd.enrichAI')}</Button>}
        <Button variant={inClaude ? 'soft' : 'primary'} disabled={!!busy} onClick={() => run('ol')}>{busy === 'ol' ? <Loader2 size={16} className="animate-spin" /> : <SearchIcon size={16} />}{t('bd.enrichOL')}</Button>
      </div>
      {err && <p className="mb-3 text-sm text-wine">{err}</p>}
      {res.map((sg, i) => (
        <div key={i} className="mb-4 rounded-xl border border-line p-3">
          <div className="mb-2 flex items-center gap-3">
            {sg.cover && <img src={sg.cover} alt="" className="h-20 w-14 rounded object-cover" />}
            <div className="min-w-0 flex-1"><div className="font-semibold" dir="auto">{sg.label}</div>{sg.source === 'claude' && <div className="text-xs text-muted">{t('bd.aiNote')}</div>}</div>
            <Button size="sm" variant="primary" onClick={() => apply(sg)}>{t('bd.acceptAll')}</Button>
          </div>
          <div className="flex flex-col gap-1">
            {Object.entries(sg.fields).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)).map(([k, v]) => (
              <div key={k} className="flex items-start gap-3 border-t border-line/60 pt-1.5 text-sm">
                <span className="w-24 shrink-0 text-muted">{label(k)}</span>
                <span className="min-w-0 flex-1 line-clamp-3" dir="auto">{show(k, v)}</span>
                <button type="button" className="shrink-0 rounded-full px-3 py-1 text-forest hover:bg-paper" onClick={() => apply(sg, k)}>{t('bd.accept')}</button>
              </div>
            ))}
            {sg.cover && <div className="flex items-center gap-3 border-t border-line/60 pt-1.5 text-sm"><span className="w-24 text-muted">{t('bd.cover')}</span><span className="flex-1" /><button type="button" className="rounded-full px-3 py-1 text-forest hover:bg-paper" onClick={() => apply(sg, 'cover')}>{t('bd.accept')}</button></div>}
          </div>
        </div>
      ))}
    </Modal>
  );
}
