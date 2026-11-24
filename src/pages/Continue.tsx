import { useStore, useT, useBooks } from '../store';
import { ContinueCard, Shelf } from '../components/books';
import { EmptyState, PageTitle, SectionHeader, Button } from '../components/ui';
import { recommend } from './Home';

export function ContinuePage() {
  const t = useT();
  const s = useStore();
  const books = useBooks();
  const reading = books.filter((b) => b.status === 'reading').sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  const onhold = books.filter((b) => b.status === 'onhold');
  const next = recommend(books).slice(0, 12);
  return (
    <div>
      <PageTitle title={t('cont.title')} />
      {reading.length ? (
        <div className="grid gap-4 md:grid-cols-2">{reading.map((b) => <ContinueCard key={b.id} book={b} />)}</div>
      ) : (
        <EmptyState title={t('cont.empty')} actions={books.length ? undefined : <Button variant="primary" onClick={() => s.navigate({ name: 'import' })}>{t('nav.import')}</Button>} />
      )}
      {onhold.length > 0 && <section className="mt-10"><SectionHeader title={t('cont.onhold')} /><Shelf books={onhold} /></section>}
      {next.length > 0 && <section className="mt-10"><SectionHeader title={t('home.recommended')} /><Shelf books={next} /></section>}
    </div>
  );
}
