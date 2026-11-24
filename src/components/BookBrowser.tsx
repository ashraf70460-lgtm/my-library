import { useMemo, useState, type ReactNode } from 'react';
import { CheckSquare, Filter, LayoutGrid, List, Save, Search, X, Trash2, FolderPlus, Tag, Globe2, User, Heart } from 'lucide-react';
import type { Book, BookStatus, Filters } from '../types';
import { useStore, useT, useLang, uid } from '../store';
import { applyFilters, sortBooks } from '../lib/filter';
import { genreDefs, genreLabel } from '../lib/genres';
import { countries, countryName } from '../lib/world';
import { BookGrid, STATUSES, AddToCollection } from './books';
import { Button, Chip, ConfirmDialog, Menu, MenuItem, Modal, Field, EmptyState } from './ui';

export function BookBrowser({ books, preset = {}, hide = [], emptyText }: { books: Book[]; preset?: Filters; hide?: (keyof Filters)[]; emptyText?: ReactNode }) {
  const s = useStore();
  const t = useT();
  const lang = useLang();
  const [f, setF] = useState<Filters>({});
  const [sort, setSort] = useState<string>(s.settings.defaultSort);
  const [view, setView] = useState<'grid' | 'list'>(s.settings.defaultView);
  const [showFilters, setShowFilters] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [colOpen, setColOpen] = useState(false);
  const [del, setDel] = useState(false);
  const [bulk, setBulk] = useState<null | 'genre' | 'country' | 'author'>(null);
  const [bulkVal, setBulkVal] = useState('');
  const [smartOpen, setSmartOpen] = useState(false);
  const [smartName, setSmartName] = useState('');

  const all = { ...preset, ...f };
  const shown = useMemo(() => sortBooks(applyFilters(books, all), sort, lang), [books, JSON.stringify(all), sort, lang]);
  const authors = useMemo(() => [...new Set(books.flatMap((b) => b.authors))].sort(), [books]);
  const usedGenres = useMemo(() => [...new Set(books.flatMap((b) => b.genres))], [books]);
  const usedCountries = useMemo(() => [...new Set(books.flatMap((b) => b.countries))], [books]);
  const usedLangs = useMemo(() => [...new Set(books.map((b) => b.language || 'other'))], [books]);
  const activeCount = Object.entries(f).filter(([k, v]) => v && k !== 'q').length;

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const set = (k: keyof Filters, v: any) => setF((p) => ({ ...p, [k]: v || undefined }));
  const applyBulk = () => {
    for (const id of sel) {
      const b = s.books[id]; if (!b) continue;
      if (bulk === 'genre' && bulkVal) s.updateBook(id, { genres: [...new Set([...b.genres, bulkVal])] });
      if (bulk === 'country' && bulkVal) s.updateBook(id, { countries: [...new Set([...b.countries, bulkVal])] });
      if (bulk === 'author' && bulkVal.trim()) s.updateBook(id, { authors: bulkVal.split(/[,،]/).map((x) => x.trim()).filter(Boolean) });
    }
    s.toast(t('toast.saved')); setBulk(null); setBulkVal('');
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field !rounded-full ps-9" placeholder={t('search.placeholder')} value={f.q || ''} onChange={(e) => set('q', e.target.value)} />
        </div>
        <Button variant={showFilters || activeCount ? 'primary' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)}><Filter size={16} />{t('filter')}{activeCount ? ` · ${activeCount}` : ''}</Button>
        <select className="field !min-h-[36px] !w-auto !rounded-full !py-1 text-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('sort')}>
          {['added', 'title', 'author', 'progress', 'opened'].map((x) => <option key={x} value={x}>{t('sort.' + x)}</option>)}
        </select>
        <div className="flex rounded-full border border-line bg-card p-0.5">
          <button type="button" aria-label={t('grid')} onClick={() => setView('grid')} className={`flex h-8 w-9 items-center justify-center rounded-full ${view === 'grid' ? 'bg-forest text-ivory' : ''}`}><LayoutGrid size={16} /></button>
          <button type="button" aria-label={t('list')} onClick={() => setView('list')} className={`flex h-8 w-9 items-center justify-center rounded-full ${view === 'list' ? 'bg-forest text-ivory' : ''}`}><List size={16} /></button>
        </div>
        <Button variant={selecting ? 'primary' : 'ghost'} size="sm" onClick={() => { setSelecting(!selecting); setSel(new Set()); }}><CheckSquare size={16} />{t('select')}</Button>
      </div>

      {showFilters && (
        <div className="fade-in mb-5 grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          {!hide.includes('status') && <Sel label={t('f.status')} value={f.status || ''} onChange={(v) => set('status', v as BookStatus)} options={STATUSES.map((x) => [x, t('st.' + x)])} />}
          {!hide.includes('genre') && <Sel label={t('f.genre')} value={f.genre || ''} onChange={(v) => set('genre', v)} options={usedGenres.map((g) => [g, genreLabel(g, lang)])} />}
          {!hide.includes('author') && <Sel label={t('f.author')} value={f.author || ''} onChange={(v) => set('author', v)} options={authors.map((a) => [a, a])} />}
          {!hide.includes('country') && <Sel label={t('f.country')} value={f.country || ''} onChange={(v) => set('country', v)} options={usedCountries.map((c) => [c, countryName(c, lang)])} />}
          <Sel label={t('f.language')} value={f.language || ''} onChange={(v) => set('language', v)} options={usedLangs.map((l) => [l, l === 'ar' ? t('lang.ar') : l === 'en' ? t('lang.en') : l === 'other' ? t('lang.other') : l])} />
          <Sel label={t('f.format')} value={f.format || ''} onChange={(v) => set('format', v)} options={['epub', 'pdf', 'txt', 'fb2', 'html', 'md'].map((x) => [x, x.toUpperCase()])} />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">{t('f.year')}</span>
            <div className="flex gap-2"><input className="field" inputMode="numeric" placeholder={t('from')} value={f.yearFrom || ''} onChange={(e) => set('yearFrom', e.target.value)} /><input className="field" inputMode="numeric" placeholder={t('to')} value={f.yearTo || ''} onChange={(e) => set('yearTo', e.target.value)} /></div>
          </div>
          <div className="flex items-end gap-2">
            <Chip active={!!f.favorite} onClick={() => set('favorite', !f.favorite)}><Heart size={14} />{t('f.favorite')}</Chip>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
            <Button variant="ghost" size="sm" onClick={() => setF({})}><X size={14} />{t('clear')}</Button>
            <Button variant="outline" size="sm" onClick={() => setSmartOpen(true)}><Save size={14} />{t('f.saveSmart')}</Button>
          </div>
        </div>
      )}

      {selecting && (
        <div className="sticky top-0 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-forest bg-card p-2 shadow">
          <span className="px-2 text-sm font-semibold">{t('selected', { n: sel.size })}</span>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set(shown.map((b) => b.id)))}>{t('all')}</Button>
          <Menu trigger={(o) => <Button size="sm" disabled={!sel.size} onClick={o}>{t('bulk.status')}</Button>}>
            {(c) => STATUSES.map((st) => <MenuItem key={st} onClick={() => { sel.forEach((id) => s.setStatus(id, st)); s.toast(t('toast.statusChanged')); c(); }}>{t('st.' + st)}</MenuItem>)}
          </Menu>
          <Button size="sm" disabled={!sel.size} onClick={() => setColOpen(true)}><FolderPlus size={14} />{t('bulk.collection')}</Button>
          <Button size="sm" disabled={!sel.size} onClick={() => setBulk('genre')}><Tag size={14} />{t('bulk.genre')}</Button>
          <Button size="sm" disabled={!sel.size} onClick={() => setBulk('country')}><Globe2 size={14} />{t('bulk.country')}</Button>
          <Button size="sm" disabled={!sel.size} onClick={() => setBulk('author')}><User size={14} />{t('bulk.author')}</Button>
          <Button size="sm" variant="danger" disabled={!sel.size} onClick={() => setDel(true)}><Trash2 size={14} />{t('bulk.delete')}</Button>
        </div>
      )}

      <div className="mb-3 text-sm text-muted">{t('books.count', { n: shown.length })}</div>
      {shown.length ? (
        <BookGrid books={shown} view={view} selectable={selecting} selected={sel} onToggle={toggle} />
      ) : (
        <EmptyState title={emptyText || t('books.empty')} />
      )}

      <AddToCollection open={colOpen} onClose={() => setColOpen(false)} bookIds={[...sel]} />
      <ConfirmDialog open={del} onClose={() => setDel(false)} text={`${t('bulk.delete')}: ${sel.size}`} onConfirm={async () => { for (const id of sel) await s.deleteBook(id); setSel(new Set()); s.toast(t('toast.deleted')); }} />
      <Modal open={!!bulk} onClose={() => setBulk(null)} title={bulk ? t('bulk.' + bulk) : ''} footer={<><Button variant="ghost" onClick={() => setBulk(null)}>{t('cancel')}</Button><Button variant="primary" onClick={applyBulk}>{t('apply')}</Button></>}>
        {bulk === 'genre' && (
          <select className="field" value={bulkVal} onChange={(e) => setBulkVal(e.target.value)}>
            <option value="">—</option>
            {genreDefs.map((g) => <option key={g.id} value={g.id}>{g[lang]}</option>)}
            {usedGenres.filter((g) => !genreDefs.some((d) => d.id === g)).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        {bulk === 'country' && (
          <select className="field" value={bulkVal} onChange={(e) => setBulkVal(e.target.value)}>
            <option value="">—</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.lit[lang]}</option>)}
          </select>
        )}
        {bulk === 'author' && <Field label={t('bd.authors')} hint={t('bd.authorsHint')}><input className="field" list="authors-dl" value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} /><datalist id="authors-dl">{authors.map((a) => <option key={a} value={a} />)}</datalist></Field>}
      </Modal>
      <Modal open={smartOpen} onClose={() => setSmartOpen(false)} title={t('f.saveSmart')} footer={<Button variant="primary" onClick={() => {
        if (!smartName.trim()) return;
        s.upsert('collections', { id: uid('c'), updatedAt: Date.now(), name: smartName.trim(), bookIds: [], smart: all, createdAt: Date.now() });
        s.toast(t('toast.saved')); setSmartOpen(false); setSmartName('');
      }}>{t('save')}</Button>}>
        <Field label={t('name')} hint={t('col.smartHint')}><input className="field" value={smartName} onChange={(e) => setSmartName(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const t = useT();
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('f.any')}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
