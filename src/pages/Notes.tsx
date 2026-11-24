import { useMemo, useState } from 'react';
import { Bookmark, BookOpen, Copy, Edit3, Highlighter, Quote, StickyNote, Trash2 } from 'lucide-react';
import { useStore, useT, useLang, useAnnotations, useBooks } from '../store';
import { Button, EmptyState, Field, Modal, PageTitle, Segmented } from '../components/ui';
import { BookCover } from '../components/books';
import { fmtDate } from '../i18n';
import { norm } from '../lib/filter';
import type { Annotation } from '../types';

export const HL_COLORS: Record<string, string> = { yellow: '#e8c547', blue: '#6eaae6', green: '#82c882', pink: '#f08cb4', orange: '#f5a55a' };

export default function NotesPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const ann = useAnnotations();
  const books = useBooks();
  const [type, setType] = useState<'all' | 'highlight' | 'note' | 'bookmark'>('all');
  const [bookId, setBookId] = useState('');
  const [author, setAuthor] = useState('');
  const [q, setQ] = useState('');
  const [order, setOrder] = useState<'new' | 'old'>('new');
  const [edit, setEdit] = useState<Annotation | null>(null);
  const authors = useMemo(() => [...new Set(books.flatMap((b) => b.authors))].sort(), [books]);
  const list = useMemo(() => ann.filter((a) => {
    const b = s.books[a.bookId];
    if (!b || b.deleted) return false;
    if (type === 'note' ? !(a.kind === 'note' || a.note) : type !== 'all' && a.kind !== type) return false;
    if (bookId && a.bookId !== bookId) return false;
    if (author && !(b.authors.includes(author) || a.author === author)) return false;
    if (q && !norm([a.text, a.note, b.title].join(' ')).includes(norm(q))) return false;
    return true;
  }).sort((a, b) => (order === 'new' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)), [ann, type, bookId, author, q, order, s.books]);
  const usedBooks = books.filter((b) => ann.some((a) => a.bookId === b.id));
  return (
    <div>
      <PageTitle title={t('an.title')} sub={`${ann.filter((a) => a.kind === 'highlight').length} · ${ann.filter((a) => a.note).length} · ${ann.filter((a) => a.kind === 'bookmark').length}`} />
      {!ann.length ? <EmptyState title={t('an.empty')} icon={<Highlighter size={48} />} /> : (
        <>
          <div className="mb-6 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <input className="field max-w-sm !rounded-full" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="field !w-auto" value={bookId} onChange={(e) => setBookId(e.target.value)} aria-label={t('jr.book')}><option value="">{t('jr.book')}: {t('all')}</option>{usedBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select>
              <select className="field !w-auto" value={author} onChange={(e) => setAuthor(e.target.value)} aria-label={t('jr.author')}><option value="">{t('jr.author')}: {t('all')}</option>{authors.map((a) => <option key={a} value={a}>{a}</option>)}</select>
              <select className="field !w-auto" value={order} onChange={(e) => setOrder(e.target.value as any)} aria-label={t('an.date')}><option value="new">{t('an.newest')}</option><option value="old">{t('an.oldest')}</option></select>
            </div>
            <div><Segmented value={type} onChange={setType} options={[{ value: 'all', label: t('all') }, { value: 'highlight', label: t('an.highlights') }, { value: 'note', label: t('an.notes') }, { value: 'bookmark', label: t('an.bookmarks') }]} /></div>
          </div>
          <div className="columns-1 gap-4 md:columns-2">
            {list.map((a) => <AnnotationCard key={a.id} a={a} onEdit={() => setEdit(a)} />)}
          </div>
          {!list.length && <EmptyState title={t('search.none')} />}
        </>
      )}
      {edit && <NoteEditor a={edit} onClose={() => setEdit(null)} />}
    </div>
  );
  void lang;
}

export function AnnotationCard({ a, onEdit, compact }: { a: Annotation; onEdit?: () => void; compact?: boolean }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const b = s.books[a.bookId];
  const Icon = a.kind === 'bookmark' ? Bookmark : a.kind === 'note' ? StickyNote : Highlighter;
  return (
    <div className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex">
        <div className="w-1.5 shrink-0" style={{ background: a.color ? HL_COLORS[a.color] : a.kind === 'bookmark' ? 'rgb(var(--c-wine))' : 'rgb(var(--c-forest))' }} />
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted">
            <Icon size={14} />{a.target === 'author' ? a.author : a.chapterLabel || (a.page ? `${t('page')} ${a.page}` : a.target === 'book' ? t('an.bookNote') : '')}
            {a.favoriteQuote && <Quote size={13} className="text-wine" />}
            <span className="ms-auto">{fmtDate(lang, a.createdAt)}</span>
          </div>
          {a.text && <p className="serif leading-relaxed" dir="auto">{a.text}</p>}
          {a.note && <p className={`whitespace-pre-wrap text-sm ${a.text ? 'mt-2 rounded-lg bg-paper/70 p-2.5' : ''}`} dir="auto">{a.note}</p>}
          {!compact && b && (
            <button type="button" className="mt-3 flex items-center gap-2 text-sm text-muted hover:text-ink" onClick={() => s.navigate({ name: 'book', id: b.id })}>
              <BookCover book={b} size="sm" className="w-5" /><span className="truncate" dir="auto">{b.title}{b.authors[0] ? ` — ${b.authors[0]}` : ''}</span>
            </button>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {a.target !== 'author' && <IconBtn label={t('an.goto')} onClick={() => s.openReader(a.bookId, { chapter: a.chapter, ratio: a.ratio, page: a.page, start: a.start })}><BookOpen size={15} /></IconBtn>}
            {onEdit && <IconBtn label={t('an.addNote')} onClick={onEdit}><Edit3 size={15} /></IconBtn>}
            {a.kind === 'highlight' && <IconBtn label={a.favoriteQuote ? t('an.unquote') : t('an.quote')} onClick={() => s.upsert('annotations', { ...a, favoriteQuote: !a.favoriteQuote })}><Quote size={15} className={a.favoriteQuote ? 'text-wine' : ''} /></IconBtn>}
            {a.text && <IconBtn label={t('copy')} onClick={() => navigator.clipboard?.writeText(`${a.text}\n— ${b?.title || ''}`).then(() => s.toast(t('copied')), () => {})}><Copy size={15} /></IconBtn>}
            <IconBtn label={t('delete')} onClick={() => s.remove('annotations', a.id)}><Trash2 size={15} /></IconBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink">{children}</button>;
}

export function NoteEditor({ a, onClose }: { a: Annotation; onClose: () => void }) {
  const t = useT();
  const s = useStore();
  const [note, setNote] = useState(a.note || '');
  const [color, setColor] = useState(a.color);
  return (
    <Modal open onClose={onClose} title={t('an.addNote')} footer={<><Button variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" onClick={() => { s.upsert('annotations', { ...a, note: note.trim() || undefined, color }); onClose(); }}>{t('save')}</Button></>}>
      {a.text && <p className="serif mb-4 rounded-lg bg-paper/70 p-3" dir="auto">{a.text}</p>}
      {a.kind === 'highlight' && (
        <div className="mb-4 flex gap-2">{Object.entries(HL_COLORS).map(([k, c]) => <button key={k} type="button" aria-label={k} onClick={() => setColor(k as any)} className={`h-8 w-8 rounded-full ${color === k ? 'ring-2 ring-ink ring-offset-2' : ''}`} style={{ background: c }} />)}</div>
      )}
      <Field label={t('an.notes')}><textarea className="field" dir="auto" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('rd.notePlaceholder')} /></Field>
    </Modal>
  );
}
