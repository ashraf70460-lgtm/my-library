import { useMemo, useState } from 'react';
import { Plus, Edit3, Trash2, GripVertical, Sparkles, Pin, ArrowUp, ArrowDown, X, BookOpen } from 'lucide-react';
import { useStore, useT, useLang, useBooks, useCollections, uid } from '../store';
import { Button, Chip, ConfirmDialog, EmptyState, Field, Modal, PageTitle, Toggle, Watermark } from '../components/ui';
import { BookCover, BookGrid } from '../components/books';
import { BookPicker } from '../components/BookPicker';
import { applyFilters } from '../lib/filter';
import { shrinkImage } from '../lib/parse';
import { genreLabel } from '../lib/genres';
import { countryName } from '../lib/world';
import type { Book, Collection } from '../types';

const SUGGEST = {
  en: ['Books to Read This Year', 'Favorite Books', 'Russian Classics', 'Philosophy', 'Books About History', 'Weekend Reading', 'Books I Recommend', 'Masterpieces', 'Read Again'],
  ar: ['كتب لأقرأها هذا العام', 'كتبي المفضلة', 'كلاسيكيات روسية', 'فلسفة', 'كتب عن التاريخ', 'قراءة نهاية الأسبوع', 'كتب أنصح بها', 'روائع', 'أعيد قراءتها'],
};
const COLORS = ['#2f4f3e', '#7b2d35', '#6b7445', '#7a5a3a', '#3d4a5c', '#5a2f4f'];

export function useCollectionBooks(c: Collection | undefined, books: Book[]) {
  return useMemo(() => {
    if (!c) return [];
    if (c.smart) return applyFilters(books, c.smart);
    const m = new Map(books.map((b) => [b.id, b]));
    return c.bookIds.map((id) => m.get(id)).filter(Boolean) as Book[];
  }, [c, books]);
}

export function CollectionsPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const cols = useCollections();
  const [edit, setEdit] = useState<Collection | null>(null);
  const create = (name: string) => setEdit({ id: uid('c'), updatedAt: Date.now(), name, bookIds: [], createdAt: Date.now(), color: COLORS[cols.length % COLORS.length] });
  return (
    <div>
      <PageTitle title={t('col.title')} actions={<Button variant="primary" onClick={() => create('')}><Plus size={16} />{t('col.new')}</Button>} />
      {!cols.length && <div className="mb-6"><EmptyState title={t('col.empty')} /></div>}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{t('col.suggest')}:</span>
        {SUGGEST[lang].filter((n) => !cols.some((c) => c.name === n)).slice(0, 6).map((n) => <Chip key={n} onClick={() => create(n)}><Plus size={13} />{n}</Chip>)}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cols.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt).map((c) => <CollectionCard key={c.id} c={c} />)}
      </div>
      {edit && <EditCollection c={edit} onClose={() => setEdit(null)} isNew onSaved={(id) => s.navigate({ name: 'collection', id })} />}
    </div>
  );
}

function CollectionCard({ c }: { c: Collection }) {
  const s = useStore();
  const t = useT();
  const books = useCollectionBooks(c, useBooks());
  const cover = c.coverBookId ? books.find((b) => b.id === c.coverBookId) : undefined;
  const stack = cover ? [cover, ...books.filter((b) => b.id !== cover.id)].slice(0, 3) : books.slice(0, 3);
  return (
    <button type="button" onClick={() => s.navigate({ name: 'collection', id: c.id })} className="group relative overflow-hidden rounded-2xl border border-line bg-card text-start hover:border-forest/40">
      <div className="relative flex h-40 items-end justify-center gap-0 overflow-hidden" style={{ background: c.color || '#2f4f3e' }}>
        {c.coverImage ? <img src={c.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" /> : (
          <div className="mb-[-18px] flex items-end">
            {stack.map((b, i) => <BookCover key={b.id} book={b} size="sm" className={`w-[72px] ${i === 1 ? 'z-10 -mx-3 mb-3 w-[84px]' : 'opacity-90'} ${i === 0 ? '-rotate-6' : i === 2 ? 'rotate-6' : ''}`} />)}
            {!stack.length && <div className="mb-8 text-ivory/50"><BookOpen size={40} /></div>}
          </div>
        )}
        {c.pinned && <Pin size={16} className="absolute end-3 top-3 text-ivory" />}
      </div>
      <div className="p-4">
        <div className="serif text-lg font-semibold" dir="auto">{c.name || t('untitled')}</div>
        <div className="flex items-center gap-2 text-sm text-muted">{t('col.books', { n: books.length })}{c.smart && <span className="inline-flex items-center gap-1"><Sparkles size={12} />{t('col.smart')}</span>}</div>
        {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted" dir="auto">{c.description}</p>}
      </div>
    </button>
  );
}

export function CollectionPage({ id }: { id: string }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const c = useStore((st) => st.collections[id]);
  const all = useBooks();
  const books = useCollectionBooks(c, all);
  const [edit, setEdit] = useState(false);
  const [pick, setPick] = useState(false);
  const [del, setDel] = useState(false);
  const [arrange, setArrange] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  if (!c || c.deleted) return <EmptyState title={t('col.empty')} />;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= c.bookIds.length) return;
    const ids = [...c.bookIds]; const [x] = ids.splice(from, 1); ids.splice(to, 0, x);
    s.upsert('collections', { ...c, bookIds: ids });
  };
  const smartDesc = c.smart ? Object.entries(c.smart).filter(([, v]) => v).map(([k, v]) => k === 'genre' ? genreLabel(String(v), lang) : k === 'country' ? countryName(String(v), lang) : k === 'status' ? t('st.' + v) : k === 'favorite' ? t('favorites') : String(v)).join(' · ') : '';
  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-3xl px-6 py-8 text-ivory sm:px-10" style={{ background: c.color || '#2f4f3e' }}>
        {c.coverImage && <img src={c.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
        <Watermark className="-bottom-8 end-4 !text-white/[0.08]" size={90} />
        <div className="relative">
          <h1 className="text-[32px] font-semibold leading-tight sm:text-[44px]" dir="auto">{c.name || t('untitled')}</h1>
          {c.description && <p className="mt-2 max-w-2xl opacity-90" dir="auto">{c.description}</p>}
          <div className="mt-2 text-sm opacity-80">{t('col.books', { n: books.length })}{c.smart ? ` · ${t('col.smart')}: ${smartDesc}` : ''}</div>
          <div className="mt-5 flex flex-wrap gap-2">
            {!c.smart && <Button size="sm" className="!bg-ivory !text-ink" onClick={() => setPick(true)}><Plus size={14} />{t('col.addBooks')}</Button>}
            {!c.smart && books.length > 1 && <Button size="sm" className="!bg-ivory/20 !text-ivory" onClick={() => setArrange(!arrange)}><GripVertical size={14} />{arrange ? t('done') : t('col.manualSort')}</Button>}
            <Button size="sm" className="!bg-ivory/20 !text-ivory" onClick={() => setEdit(true)}><Edit3 size={14} />{t('edit')}</Button>
            <Button size="sm" className="!bg-ivory/20 !text-ivory" onClick={() => setDel(true)}><Trash2 size={14} />{t('delete')}</Button>
          </div>
        </div>
      </div>
      {!books.length ? <EmptyState title={t('col.empty')} actions={!c.smart ? <Button variant="primary" onClick={() => setPick(true)}>{t('col.addBooks')}</Button> : undefined} /> : arrange ? (
        <div className="flex flex-col gap-1">
          {books.map((b, i) => (
            <div key={b.id} draggable onDragStart={() => setDrag(b.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) move(c.bookIds.indexOf(drag), i); setDrag(null); }}
              className={`flex items-center gap-3 rounded-xl border border-line bg-card p-2 ${drag === b.id ? 'opacity-50' : ''}`}>
              <GripVertical size={18} className="cursor-grab text-muted" />
              <BookCover book={b} size="sm" className="w-9" />
              <span className="flex-1 truncate" dir="auto">{b.title}</span>
              <button type="button" aria-label="up" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper" onClick={() => move(i, i - 1)}><ArrowUp size={16} /></button>
              <button type="button" aria-label="down" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper" onClick={() => move(i, i + 1)}><ArrowDown size={16} /></button>
              <button type="button" aria-label={t('col.removeFrom')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper" onClick={() => s.upsert('collections', { ...c, bookIds: c.bookIds.filter((x) => x !== b.id) })}><X size={16} /></button>
            </div>
          ))}
        </div>
      ) : <BookGrid books={books} />}
      <BookPicker open={pick} onClose={() => setPick(false)} exclude={c.bookIds} onPick={(ids) => s.upsert('collections', { ...c, bookIds: [...c.bookIds, ...ids] })} />
      {edit && <EditCollection c={c} onClose={() => setEdit(false)} books={books} />}
      <ConfirmDialog open={del} onClose={() => setDel(false)} text={`${t('delete')}: ${c.name}`} onConfirm={() => { s.remove('collections', c.id); s.navigate({ name: 'collections' }); }} />
    </div>
  );
}

function EditCollection({ c, onClose, isNew, onSaved, books = [] }: { c: Collection; onClose: () => void; isNew?: boolean; onSaved?: (id: string) => void; books?: Book[] }) {
  const t = useT();
  const s = useStore();
  const [v, setV] = useState<Collection>(c);
  return (
    <Modal open onClose={onClose} title={isNew ? t('col.new') : t('edit')} footer={<><Button variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" disabled={!v.name.trim()} onClick={() => { s.upsert('collections', { ...v, name: v.name.trim() }); onClose(); onSaved?.(v.id); }}>{t('save')}</Button></>}>
      <Field label={t('name')}><input className="field" dir="auto" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
      <Field label={t('description')}><textarea className="field !min-h-[80px]" dir="auto" value={v.description || ''} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <Field label={t('col.color')}>
        <div className="flex flex-wrap gap-2">{COLORS.map((col) => <button key={col} type="button" aria-label={col} onClick={() => setV({ ...v, color: col })} className={`h-9 w-9 rounded-full ${v.color === col ? 'ring-2 ring-offset-2 ring-ink' : ''}`} style={{ background: col }} />)}</div>
      </Field>
      {books.length > 0 && (
        <Field label={t('col.coverBook')}>
          <select className="field" value={v.coverBookId || ''} onChange={(e) => setV({ ...v, coverBookId: e.target.value || undefined })}>
            <option value="">—</option>{books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </Field>
      )}
      <Field label={t('bd.changeCover')}>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setV({ ...v, coverImage: await shrinkImage(f, 600) }); }} />
          {v.coverImage && <Button size="sm" variant="ghost" onClick={() => setV({ ...v, coverImage: undefined })}><X size={14} /></Button>}
        </div>
      </Field>
      <Toggle checked={!!v.pinned} onChange={(x) => setV({ ...v, pinned: x })} label={t('col.pin')} />
    </Modal>
  );
}
