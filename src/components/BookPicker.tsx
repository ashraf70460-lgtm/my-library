import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useT, useBooks, useLang } from '../store';
import { matchesQuery, sortBooks } from '../lib/filter';
import { BookCover } from './books';
import { Button, Modal } from './ui';

export function BookPicker({ open, onClose, onPick, exclude = [], title }: { open: boolean; onClose: () => void; onPick: (ids: string[]) => void; exclude?: string[]; title?: string }) {
  const t = useT();
  const lang = useLang();
  const books = useBooks();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const list = useMemo(() => sortBooks(books.filter((b) => !exclude.includes(b.id) && matchesQuery(b, q)), 'title', lang).slice(0, 200), [books, q, exclude, lang]);
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <Modal open={open} onClose={onClose} title={title || t('col.addBooks')} wide footer={<>
      <span className="me-auto self-center text-sm text-muted">{t('selected', { n: sel.size })}</span>
      <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
      <Button variant="primary" disabled={!sel.size} onClick={() => { onPick([...sel]); setSel(new Set()); onClose(); }}>{t('add')}</Button>
    </>}>
      <input className="field mb-3" placeholder={t('search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="flex flex-col gap-1">
        {list.map((b) => (
          <button key={b.id} type="button" onClick={() => toggle(b.id)} className={`flex items-center gap-3 rounded-lg p-2 text-start ${sel.has(b.id) ? 'bg-forest/10' : 'hover:bg-paper'}`}>
            <BookCover book={b} size="sm" className="w-9 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block truncate font-medium" dir="auto">{b.title}</span><span className="block truncate text-sm text-muted" dir="auto">{b.authors.join('، ')}</span></span>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${sel.has(b.id) ? 'border-forest bg-forest text-ivory' : 'border-line'}`}>{sel.has(b.id) && <Check size={14} />}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
