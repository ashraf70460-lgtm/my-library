import { useEffect, useState } from 'react';
import { BookOpen, Check, Heart, MoreHorizontal, FolderPlus, Info, Trash2 } from 'lucide-react';
import type { Book, BookStatus } from '../types';
import { useStore, useT, useLang, useCollections, useSessions } from '../store';
import { loadCover } from '../lib/storage';
import { Button, Menu, MenuItem, Modal, ProgressBar, ConfirmDialog } from './ui';
import { fmtDuration, fmtNum } from '../i18n';
import { remainingSeconds } from '../lib/stats';

const coverCache = new Map<string, string | null>();
export function invalidateCover(id: string) { coverCache.delete(id); }

const PALETTE = [
  ['#2f4f3e', '#e9dfc8'], ['#7b2d35', '#f1e4cf'], ['#3d4a5c', '#e8e1d0'], ['#6b7445', '#f4ecd8'], ['#7a5a3a', '#f3e7d1'],
  ['#1f3a4a', '#e6d9bd'], ['#5a2f4f', '#efe1cf'], ['#40362c', '#d8c39a'], ['#234038', '#d9c58f'], ['#8a3b2a', '#f2e2c6'],
];
const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

export function BookCover({ book, className = '', size = 'md' }: { book: Book; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const [src, setSrc] = useState<string | null | undefined>(coverCache.get(book.id));
  useEffect(() => {
    if (!book.hasCover) { setSrc(null); return; }
    if (coverCache.has(book.id)) { setSrc(coverCache.get(book.id)); return; }
    let alive = true;
    loadCover(book.id).then((c) => { coverCache.set(book.id, c ?? null); if (alive) setSrc(c ?? null); }).catch(() => alive && setSrc(null));
    return () => { alive = false; };
  }, [book.id, book.hasCover, book.updatedAt]);
  const [bg, fg] = PALETTE[hashStr(book.title + book.authors.join()) % PALETTE.length];
  const tsz = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xl' : 'text-[13px]';
  return (
    <div className={`spine book-shadow relative aspect-[2/3] overflow-hidden rounded-[3px] ${className}`} style={{ background: bg }}>
      {src ? (
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" draggable={false} />
      ) : (
        <div className="absolute inset-0 flex flex-col p-[9%]" style={{ color: fg }} dir="auto">
          <div className="mb-auto h-px w-1/3 opacity-60" style={{ background: fg }} />
          <div className={`serif ${tsz} font-semibold leading-snug line-clamp-5`} style={{ fontFamily: /[؀-ۿ]/.test(book.title) ? "'Amiri','Noto Naskh Arabic',serif" : undefined }}>{book.title}</div>
          <div className={`mt-2 opacity-75 ${size === 'sm' ? 'text-[8px]' : 'text-[11px]'} line-clamp-2`}>{book.authors[0]}</div>
          <div className="mt-auto flex items-center gap-1 opacity-50"><span className="h-px flex-1" style={{ background: fg }} /><span className="text-[8px]">✦</span><span className="h-px flex-1" style={{ background: fg }} /></div>
        </div>
      )}
    </div>
  );
}

export const STATUSES: BookStatus[] = ['unread', 'reading', 'completed', 'onhold', 'abandoned', 'want'];
export const statusDot: Record<BookStatus, string> = {
  unread: 'bg-line', reading: 'bg-forest', completed: 'bg-olive', onhold: 'bg-brown', abandoned: 'bg-wine', want: 'bg-[#c9a46b]',
};

export function StatusBadge({ status }: { status: BookStatus }) {
  const t = useT();
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted"><span className={`h-2 w-2 rounded-full ${statusDot[status]}`} />{t('st.' + status)}</span>;
}

export function BookMenu({ book }: { book: Book }) {
  const t = useT();
  const s = useStore();
  const [colOpen, setColOpen] = useState(false);
  const [del, setDel] = useState(false);
  return (
    <>
      <Menu trigger={(open) => (
        <button type="button" aria-label={t('card.status')} onClick={(e) => { e.stopPropagation(); open(); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-card/90 shadow hover:bg-card">
          <MoreHorizontal size={18} />
        </button>
      )}>
        {(close) => (
          <div onClick={(e) => e.stopPropagation()}>
            <div className="px-3 pb-1 pt-2 text-xs text-muted">{t('card.status')}</div>
            {STATUSES.map((st) => (
              <MenuItem key={st} active={book.status === st} onClick={() => { s.setStatus(book.id, st); s.toast(t('toast.statusChanged')); close(); }}>
                <span className={`h-2 w-2 rounded-full ${statusDot[st]}`} />{t('st.' + st)}{book.status === st && <Check size={14} className="ms-auto" />}
              </MenuItem>
            ))}
            <div className="my-1 h-px bg-line" />
            <MenuItem onClick={() => { s.updateBook(book.id, { favorite: !book.favorite }); close(); }}><Heart size={16} />{book.favorite ? t('bd.unfav') : t('bd.fav')}</MenuItem>
            <MenuItem onClick={() => { setColOpen(true); close(); }}><FolderPlus size={16} />{t('col.addTo')}</MenuItem>
            <MenuItem onClick={() => { s.navigate({ name: 'book', id: book.id }); close(); }}><Info size={16} />{t('bd.edit')}</MenuItem>
            <MenuItem onClick={() => { setDel(true); close(); }}><Trash2 size={16} className="text-wine" />{t('bd.deleteBook')}</MenuItem>
          </div>
        )}
      </Menu>
      <AddToCollection open={colOpen} onClose={() => setColOpen(false)} bookIds={[book.id]} />
      <ConfirmDialog open={del} onClose={() => setDel(false)} text={t('bd.deleteConfirm', { t: book.title })} onConfirm={() => { s.deleteBook(book.id); s.toast(t('toast.deleted')); }} />
    </>
  );
}

export function BookCard({ book, selectable, selected, onSelect }: { book: Book; selectable?: boolean; selected?: boolean; onSelect?: () => void }) {
  const s = useStore();
  const open = () => (selectable ? onSelect?.() : s.navigate({ name: 'book', id: book.id }));
  return (
    <div className="group relative fade-in">
      <button type="button" onClick={open} className="block w-full text-start" aria-label={book.title}>
        <div className="relative">
          <BookCover book={book} className={`w-full transition-transform group-hover:-translate-y-1 ${selected ? 'ring-4 ring-forest' : ''}`} />
          {book.favorite && <Heart size={16} className="absolute end-2 top-2 z-10 fill-wine text-wine drop-shadow" />}
          {book.status === 'reading' && book.progress > 0 && (
            <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-black/30"><div className="h-full bg-[#c9a46b]" style={{ width: `${book.progress * 100}%` }} /></div>
          )}
          {selectable && <span className={`absolute start-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${selected ? 'bg-forest' : 'bg-black/20'}`}>{selected && <Check size={14} className="text-white" />}</span>}
        </div>
        <div className="mt-2.5 px-0.5">
          <div className="serif line-clamp-2 text-[15px] font-semibold leading-snug" dir="auto">{book.title}</div>
          <div className="line-clamp-1 text-sm text-muted" dir="auto">{book.authors.join('، ') || '—'}</div>
          <div className="mt-1"><StatusBadge status={book.status} /></div>
        </div>
      </button>
      {!selectable && <div className="absolute end-1.5 top-1.5 z-20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"><BookMenu book={book} /></div>}
    </div>
  );
}

export function BookRow({ book, selectable, selected, onSelect }: { book: Book; selectable?: boolean; selected?: boolean; onSelect?: () => void }) {
  const s = useStore();
  const t = useT();
  const lang = useLang();
  return (
    <div className={`flex items-center gap-4 rounded-xl border border-transparent p-2 hover:border-line hover:bg-card ${selected ? 'border-forest bg-card' : ''}`}>
      <button type="button" className="flex flex-1 items-center gap-4 text-start" onClick={() => (selectable ? onSelect?.() : s.navigate({ name: 'book', id: book.id }))}>
        <BookCover book={book} size="sm" className="w-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="serif truncate font-semibold" dir="auto">{book.title}</div>
          <div className="truncate text-sm text-muted" dir="auto">{book.authors.join('، ') || '—'}{book.year ? ` · ${book.year}` : ''}</div>
          <div className="mt-1 flex items-center gap-3"><StatusBadge status={book.status} />{book.progress > 0 && book.progress < 1 && <span className="text-xs text-muted">{t('pct', { n: Math.round(book.progress * 100) })}</span>}<span className="text-xs uppercase text-muted">{book.format}</span>{book.pages ? <span className="text-xs text-muted">{fmtNum(lang, book.pages)} {t('pages')}</span> : null}</div>
        </div>
      </button>
      {!selectable && <BookMenu book={book} />}
    </div>
  );
}

export function BookGrid({ books, view = 'grid', selectable, selected, onToggle }: { books: Book[]; view?: 'grid' | 'list'; selectable?: boolean; selected?: Set<string>; onToggle?: (id: string) => void }) {
  const [limit, setLimit] = useState(120);
  useEffect(() => setLimit(120), [books.length]);
  const t = useT();
  const shown = books.slice(0, limit);
  return (
    <>
      {view === 'grid' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-x-5 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
          {shown.map((b) => <BookCard key={b.id} book={b} selectable={selectable} selected={selected?.has(b.id)} onSelect={() => onToggle?.(b.id)} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-1">{shown.map((b) => <BookRow key={b.id} book={b} selectable={selectable} selected={selected?.has(b.id)} onSelect={() => onToggle?.(b.id)} />)}</div>
      )}
      {books.length > limit && <div className="mt-8 flex justify-center"><Button onClick={() => setLimit(limit + 200)}>{t('more')} ({books.length - limit})</Button></div>}
    </>
  );
}

/** Horizontal shelf of covers. */
export function Shelf({ books, empty }: { books: Book[]; empty?: React.ReactNode }) {
  const s = useStore();
  if (!books.length) return <>{empty}</>;
  return (
    <div className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-5 pt-1">
      {books.map((b) => (
        <button key={b.id} type="button" onClick={() => s.navigate({ name: 'book', id: b.id })} className="w-[104px] shrink-0 snap-start text-start sm:w-[124px]">
          <BookCover book={b} className="w-full" />
          <div className="serif mt-2 line-clamp-2 text-sm font-semibold leading-snug" dir="auto">{b.title}</div>
          <div className="line-clamp-1 text-xs text-muted" dir="auto">{b.authors[0] || ''}</div>
        </button>
      ))}
    </div>
  );
}

export function ContinueCard({ book }: { book: Book }) {
  const s = useStore();
  const t = useT();
  const lang = useLang();
  const sessions = useSessions();
  const rem = remainingSeconds(book, sessions);
  const page = book.pages ? Math.max(1, Math.round(book.progress * book.pages)) : undefined;
  return (
    <div className="flex gap-4 rounded-2xl border border-line bg-card p-4">
      <button type="button" onClick={() => s.navigate({ name: 'book', id: book.id })} className="w-[84px] shrink-0 sm:w-[96px]"><BookCover book={book} className="w-full" /></button>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="serif line-clamp-2 text-lg font-semibold leading-snug" dir="auto">{book.title}</div>
        <div className="truncate text-sm text-muted" dir="auto">{book.authors.join('، ')}</div>
        <div className="mt-auto pt-3">
          <div className="mb-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted">
            <span>{page && book.pages ? `${book.pagesEstimated ? t('card.approx') + ' ' : ''}${t('card.pageOf', { a: page, b: book.pages })}` : ''}</span>
            <span className="font-semibold text-ink">{t('pct', { n: Math.round(book.progress * 100) })}</span>
          </div>
          <ProgressBar value={book.progress} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">{rem ? t('card.left', { t: fmtDuration(lang, rem) }) : ''}</span>
            <Button variant="primary" size="sm" onClick={() => s.openReader(book.id)}><BookOpen size={16} />{t('card.continue')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AddToCollection({ open, onClose, bookIds }: { open: boolean; onClose: () => void; bookIds: string[] }) {
  const t = useT();
  const s = useStore();
  const cols = useCollections().filter((c) => !c.smart);
  const [name, setName] = useState('');
  const add = (id: string) => {
    const c = s.collections[id];
    s.upsert('collections', { ...c, bookIds: [...new Set([...c.bookIds, ...bookIds])] });
    s.toast(t('toast.added', { c: c.name }));
    onClose();
  };
  const create = () => {
    if (!name.trim()) return;
    const id = 'c' + Date.now().toString(36);
    s.upsert('collections', { id, updatedAt: Date.now(), name: name.trim(), bookIds, createdAt: Date.now() });
    s.toast(t('toast.added', { c: name.trim() }));
    setName('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={t('col.addTo')}>
      <div className="mb-4 flex flex-col gap-1">
        {cols.map((c) => (
          <button key={c.id} type="button" onClick={() => add(c.id)} className="flex min-h-[44px] items-center justify-between rounded-lg px-3 text-start hover:bg-paper">
            <span dir="auto">{c.name}</span><span className="text-sm text-muted">{c.bookIds.length}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="field" placeholder={t('col.new')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        <Button variant="primary" onClick={create}>{t('create')}</Button>
      </div>
    </Modal>
  );
}
