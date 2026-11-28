import { useMemo, useState } from 'react';
import { Search as SearchIcon, BookOpen, Feather, Flag, Shapes, Globe2 } from 'lucide-react';
import { useStore, useT, useLang, useBooks, useAnnotations, useJournal } from '../store';
import { matchesQuery, norm } from '../lib/filter';
import { countries, regions } from '../lib/world';
import { genreDefs } from '../lib/genres';
import { BookRow } from '../components/books';
import { AnnotationCard } from './Notes';
import { Monogram, useAuthorsIndex } from './Authors';
import { Chip, SectionHeader } from '../components/ui';
import { BookBrowser } from '../components/BookBrowser';
import { fmtDate } from '../i18n';

export default function SearchPage({ initial }: { initial?: string }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const [q, setQ] = useState(initial || '');
  const [sugOpen, setSugOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const books = useBooks();
  const ann = useAnnotations();
  const journal = useJournal();
  const authors = useAuthorsIndex();
  const n = norm(q.trim());
  const r = useMemo(() => {
    if (!n) return null;
    return {
      books: books.filter((b) => matchesQuery(b, q)).slice(0, 30),
      authors: authors.filter((a) => norm(a.name).includes(n)).slice(0, 12),
      notes: ann.filter((a) => norm([a.text, a.note].join(' ')).includes(n)).slice(0, 20),
      genres: [...genreDefs.filter((g) => norm(g.en + ' ' + g.ar).includes(n)).map((g) => ({ id: g.id, label: g[lang], tag: false })),
        ...[...new Set(books.flatMap((b) => b.tags))].filter((x) => norm(x).includes(n)).map((x) => ({ id: x, label: x, tag: true }))],
      countries: countries.filter((c) => norm([c.en, c.ar, c.lit.en, c.lit.ar].join(' ')).includes(n)),
      journal: journal.filter((j) => norm([j.title, j.body, j.quote].join(' ')).includes(n)).slice(0, 10),
      regions: regions.filter((x) => norm(x.en + ' ' + x.ar).includes(n)),
      langs: (['ar', 'en'] as const).filter((l) => norm(t('lang.' + l)).includes(n) || l === n),
    };
  }, [n, books, ann, journal, authors, lang]);
  const none = r && !r.books.length && !r.authors.length && !r.notes.length && !r.genres.length && !r.countries.length && !r.journal.length && !r.langs.length && !r.regions.length;
  // autocomplete: titles that start with the words first, then authors, places and genres
  const sugs = useMemo(() => {
    if (!r) return [];
    const starts = (x: string) => norm(x).startsWith(n) ? 0 : 1;
    const out: { key: string; icon: React.ReactNode; label: string; sub?: string; go: () => void }[] = [
      ...[...r.books].sort((a, b) => starts(a.title) - starts(b.title)).slice(0, 4).map((b) => ({ key: 'b' + b.id, icon: <BookOpen size={15} />, label: b.title, sub: b.authors[0], go: () => s.navigate({ name: 'book', id: b.id }) })),
      ...r.authors.slice(0, 3).map((a) => ({ key: 'a' + a.name, icon: <Feather size={15} />, label: a.name, sub: t('books.count', { n: a.books.length }), go: () => s.navigate({ name: 'author', id: a.name }) })),
      ...r.countries.slice(0, 2).map((c) => ({ key: 'c' + c.id, icon: <Flag size={15} />, label: `${c.flag} ${c.lit[lang]}`, go: () => s.navigate({ name: 'country', id: c.id }) })),
      ...r.regions.slice(0, 2).map((x) => ({ key: 'r' + x.id, icon: <Globe2 size={15} />, label: x[lang], sub: t('nav.map'), go: () => s.navigate({ name: 'map', id: x.id }) })),
      ...r.genres.slice(0, 2).map((g) => ({ key: 'g' + g.id, icon: <Shapes size={15} />, label: g.label, go: () => s.navigate({ name: g.tag ? 'tag' : 'genre', id: g.id }) })),
    ];
    return out.slice(0, 8);
  }, [r, n, lang]);
  return (
    <div>
      <div className="relative mb-8">
        <SearchIcon size={20} className="absolute start-4 top-1/2 -translate-y-1/2 text-muted" />
        <input autoFocus className="field !min-h-[56px] !rounded-full !ps-12 text-lg" placeholder={t('search.placeholder')} value={q}
          role="combobox" aria-expanded={sugOpen && sugs.length > 0} aria-autocomplete="list" aria-controls="search-sugs"
          onChange={(e) => { setQ(e.target.value); setSugOpen(true); setHi(0); }}
          onFocus={() => setSugOpen(true)} onBlur={() => setTimeout(() => setSugOpen(false), 150)}
          onKeyDown={(e) => {
            if (!sugOpen || !sugs.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((hi + 1) % sugs.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((hi - 1 + sugs.length) % sugs.length); }
            else if (e.key === 'Enter') { e.preventDefault(); sugs[hi]?.go(); }
            else if (e.key === 'Escape') setSugOpen(false);
          }} />
        {sugOpen && sugs.length > 0 && (
          <ul id="search-sugs" role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-card py-1 shadow-lg">
            {sugs.map((x, i) => (
              <li key={x.key} role="option" aria-selected={i === hi}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHi(i)} onClick={x.go} className={`flex w-full items-center gap-3 px-4 py-2 text-start ${i === hi ? 'bg-paper' : ''}`}>
                  <span className="text-muted">{x.icon}</span><span className="min-w-0 flex-1 truncate" dir="auto">{x.label}</span>{x.sub && <span className="truncate text-xs text-muted" dir="auto">{x.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!r && <BookBrowser books={books} />}
      {none && <p className="text-muted">{t('search.none')}</p>}
      {r && r.authors.length > 0 && (
        <section className="mb-8"><SectionHeader title={t('search.authors')} />
          <div className="flex flex-wrap gap-2">{r.authors.map((a) => <button key={a.name} type="button" onClick={() => s.navigate({ name: 'author', id: a.name })} className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pe-4 ps-1"><Monogram name={a.name} portrait={a.meta?.portrait} size={32} /><span dir="auto">{a.name}</span><span className="text-sm text-muted">{a.books.length}</span></button>)}</div>
        </section>
      )}
      {r && r.books.length > 0 && <section className="mb-8"><SectionHeader title={`${t('search.books')} · ${r.books.length}`} /><div className="flex flex-col gap-1">{r.books.map((b) => <BookRow key={b.id} book={b} />)}</div></section>}
      {r && (r.genres.length > 0 || r.countries.length > 0 || r.langs.length > 0 || r.regions.length > 0) && (
        <section className="mb-8"><SectionHeader title={`${t('search.genres')} · ${t('search.countries')}`} />
          <div className="flex flex-wrap gap-2">
            {r.genres.map((g) => <Chip key={g.id} onClick={() => s.navigate({ name: g.tag ? 'tag' : 'genre', id: g.id })}>{g.label}</Chip>)}
            {r.countries.map((c) => <Chip key={c.id} onClick={() => s.navigate({ name: 'country', id: c.id })}>{c.flag} {c.lit[lang]}</Chip>)}
            {r.regions.map((x) => <Chip key={x.id} onClick={() => s.navigate({ name: 'map', id: x.id })}><Globe2 size={13} />{x[lang]}</Chip>)}
            {r.langs.map((l) => <Chip key={l} onClick={() => setQ('')}>{t('lang.' + l)}: {books.filter((b) => b.language === l).length}</Chip>)}
          </div>
        </section>
      )}
      {r && r.notes.length > 0 && <section className="mb-8"><SectionHeader title={t('search.notes')} /><div className="columns-1 gap-4 md:columns-2">{r.notes.map((a) => <AnnotationCard key={a.id} a={a} />)}</div></section>}
      {r && r.journal.length > 0 && (
        <section className="mb-8"><SectionHeader title={t('search.journal')} />
          {r.journal.map((j) => <button key={j.id} type="button" onClick={() => s.navigate({ name: 'journal' })} className="mb-2 block w-full rounded-xl border border-line bg-card p-3 text-start"><div className="text-xs text-muted">{fmtDate(lang, j.createdAt)}</div><div className="line-clamp-2" dir="auto">{j.title || j.body}</div></button>)}
        </section>
      )}
    </div>
  );
}
