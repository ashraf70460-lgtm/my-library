import { Download } from 'lucide-react';
import { useStore, useT, useBooks } from '../store';
import { BookBrowser } from '../components/BookBrowser';
import { Button, EmptyState, PageTitle } from '../components/ui';

export default function BooksPage() {
  const t = useT();
  const s = useStore();
  const books = useBooks();
  return (
    <div>
      <PageTitle title={t('books.title')} sub={t('books.count', { n: books.length })} actions={<Button variant="primary" onClick={() => s.navigate({ name: 'import' })}><Download size={18} />{t('nav.import')}</Button>} />
      {books.length ? <BookBrowser books={books} /> : <EmptyState title={t('home.empty.title')} body={t('home.empty.body')} actions={<Button variant="primary" onClick={() => s.navigate({ name: 'import' })}>{t('imp.files')}</Button>} />}
    </div>
  );
}
