import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore, useT, useLang, useBooks } from '../store';
import { genreDefs, genreLabel, themeTags } from '../lib/genres';
import { Button, Chip, Field, Modal, PageTitle, SectionHeader } from '../components/ui';
import { BookCover } from '../components/books';
import { BookBrowser } from '../components/BookBrowser';
import { BookPicker } from '../components/BookPicker';
import { fmtNum } from '../i18n';

export function GenresPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const books = useBooks();
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const counts = useMemo(() => {
    const m = new Map<string, typeof books>();
    for (const b of books) for (const g of b.genres) { if (!m.has(g)) m.set(g, []); m.get(g)!.push(b); }
    return m;
  }, [books]);
  const tagCounts = useMemo(() => { const m = new Map<string, number>(); for (const b of books) for (const g of b.tags) m.set(g, (m.get(g) || 0) + 1); return m; }, [books]);
  const custom = [...counts.keys()].filter((g) => !genreDefs.some((d) => d.id === g));
  const group = (gid: 'fiction' | 'nonfiction' | 'other') => (
    <section className="mb-10">
      <SectionHeader title={t('gen.' + gid)} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {genreDefs.filter((g) => g.group === gid).map((g) => <GenreCard key={g.id} id={g.id} label={g[lang]} books={counts.get(g.id) || []} />)}
      </div>
    </section>
  );
  return (
    <div>
      <PageTitle title={t('gen.title')} actions={<Button onClick={() => setNewOpen(true)}><Plus size={16} />{t('gen.add')}</Button>} />
      {custom.length > 0 && (
        <section className="mb-10"><SectionHeader title={t('gen.custom')} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{custom.map((g) => <GenreCard key={g} id={g} label={g} books={counts.get(g) || []} />)}</div>
        </section>
      )}
      {group('fiction')}{group('nonfiction')}{group('other')}
      <section>
        <SectionHeader title={t('gen.tags')} />
        <div className="flex flex-wrap gap-2">
          {[...new Set([...themeTags.map((x) => x[lang]), ...tagCounts.keys()])].map((tag) => (
            <Chip key={tag} onClick={() => s.navigate({ name: 'tag', id: tag })}>{tag}<span className="text-muted">{fmtNum(lang, tagCounts.get(tag) || 0)}</span></Chip>
          ))}
        </div>
      </section>
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={t('gen.add')} footer={<Button variant="primary" disabled={!name.trim()} onClick={() => { setNewOpen(false); s.navigate({ name: 'genre', id: name.trim() }); setName(''); }}>{t('create')}</Button>}>
        <Field label={t('name')}><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

function GenreCard({ id, label, books }: { id: string; label: string; books: any[] }) {
  const s = useStore();
  const t = useT();
  return (
    <button type="button" onClick={() => s.navigate({ name: 'genre', id })} className={`relative flex min-h-[96px] flex-col justify-between overflow-hidden rounded-2xl border border-line p-4 text-start ${books.length ? 'bg-card hover:border-forest/40' : 'bg-card/50 text-muted'}`}>
      <span className="serif text-[17px] font-semibold leading-snug">{label}</span>
      <span className="text-sm text-muted">{t('books.count', { n: books.length })}</span>
      <div className="absolute -bottom-3 end-2 flex -space-x-5 rtl:space-x-reverse opacity-90">{books.slice(0, 3).map((b) => <BookCover key={b.id} book={b} size="sm" className="w-10 rotate-6" />)}</div>
    </button>
  );
}

export function GenrePage({ id, tag }: { id: string; tag?: boolean }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const all = useBooks();
  const books = all.filter((b) => (tag ? b.tags.includes(id) : b.genres.includes(id)));
  const [pick, setPick] = useState(false);
  return (
    <div>
      <PageTitle title={tag ? id : genreLabel(id, lang)} sub={t('books.count', { n: books.length })} actions={<Button onClick={() => setPick(true)}><Plus size={16} />{t('col.addBooks')}</Button>} />
      <BookBrowser books={books} hide={tag ? [] : ['genre']} />
      <BookPicker open={pick} onClose={() => setPick(false)} exclude={books.map((b) => b.id)} onPick={(ids) => {
        for (const bid of ids) { const b = s.books[bid]; if (tag) s.updateBook(bid, { tags: [...new Set([...b.tags, id])] }); else s.updateBook(bid, { genres: [...new Set([...b.genres, id])] }); }
        s.toast(t('toast.saved'));
      }} />
    </div>
  );
}
