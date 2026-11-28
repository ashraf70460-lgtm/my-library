import { useMemo } from 'react';
import { useStore, useT, useLang, useBooks, useAnnotations } from '../store';
import { EmptyState, PageTitle, SectionHeader } from '../components/ui';
import { BookGrid } from '../components/books';
import { AnnotationCard } from './Notes';
import { Monogram, useAuthorsIndex } from './Authors';
import { fmtNum } from '../i18n';

/** Favorite authors: the ones marked with a heart, else authors of favorite books. */
export function useFavoriteAuthors() {
  const idx = useAuthorsIndex();
  return useMemo(() => {
    const marked = idx.filter((a) => a.meta?.favorite);
    const auto = idx.filter((a) => !a.meta?.favorite && a.books.some((b) => b.favorite)).sort((a, b) => b.books.filter((x) => x.favorite).length - a.books.filter((x) => x.favorite).length);
    return { marked, auto };
  }, [idx]);
}

export default function FavoritesPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const books = useBooks().filter((b) => b.favorite).sort((a, b) => (b.favoritedAt || 0) - (a.favoritedAt || 0));
  const { marked, auto } = useFavoriteAuthors();
  const quotes = useAnnotations().filter((a) => a.favoriteQuote && s.books[a.bookId] && !s.books[a.bookId].deleted).sort((a, b) => b.createdAt - a.createdAt);
  const authors = [...marked, ...auto];
  if (!books.length && !authors.length && !quotes.length) return <div><PageTitle title={t('nav.favorites')} /><EmptyState title={t('fav.empty')} body={t('fav.emptyHint')} /></div>;
  return (
    <div>
      <PageTitle title={t('nav.favorites')} sub={t('fav.sub')} />
      {authors.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={t('fav.authors')} />
          <div className="flex flex-wrap gap-3">
            {authors.map((a) => (
              <button key={a.name} type="button" onClick={() => s.navigate({ name: 'author', id: a.name })} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2 pe-4 text-start hover:border-forest/40">
                <Monogram name={a.name} portrait={a.meta?.portrait} size={44} />
                <span><span className="block font-medium" dir="auto">{a.name}</span><span className="text-xs text-muted">{t('books.count', { n: a.books.length })}{!a.meta?.favorite ? ` · ${t('fav.fromBooks')}` : ''}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="mb-10">
        <SectionHeader title={`${t('fav.books')} · ${fmtNum(lang, books.length)}`} />
        {books.length ? <BookGrid books={books} /> : <p className="text-muted">{t('fav.noBooks')}</p>}
      </section>
      {quotes.length > 0 && (
        <section>
          <SectionHeader title={t('fav.quotes')} />
          <div className="columns-1 gap-4 md:columns-2">{quotes.map((a) => <AnnotationCard key={a.id} a={a} />)}</div>
        </section>
      )}
    </div>
  );
}
