import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { useStore, useT, useLang, useBooks } from '../store';
import { Button, Modal } from './ui';
import { BookCover } from './books';
import { fmtDate } from '../i18n';
import type { Book } from '../types';

const key = (b: Book) => (b.title + '|' + (b.authors[0] || ''))
  .toLowerCase().normalize('NFKD').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^\p{L}\p{N}|]+/gu, '');

/** Books that look like the same work (same title and first author). Nothing is ever removed automatically. */
export function useDuplicates() {
  const books = useBooks();
  return useMemo(() => {
    const m = new Map<string, Book[]>();
    for (const b of books) { const k = key(b); if (k.replace('|', '').length < 3) continue; if (!m.has(k)) m.set(k, []); m.get(k)!.push(b); }
    return [...m.values()].filter((g) => g.length > 1);
  }, [books]);
}

export function DuplicatesButton() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const groups = useDuplicates();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Copy size={15} />{t('dup.find')}{groups.length ? ` · ${groups.length}` : ''}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('dup.title')} wide>
        <p className="mb-4 text-sm text-muted">{t('dup.hint')}</p>
        {!groups.length && <p className="text-forest">{t('dup.none')}</p>}
        {groups.map((g, i) => (
          <div key={i} className="mb-3 rounded-xl border border-line p-3">
            {g.map((b) => (
              <button key={b.id} type="button" onClick={() => { setOpen(false); s.navigate({ name: 'book', id: b.id }); }} className="flex w-full items-center gap-3 rounded-lg p-1.5 text-start hover:bg-paper">
                <BookCover book={b} size="sm" className="w-8 shrink-0" />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium" dir="auto">{b.title}</span>
                  <span className="block truncate text-xs text-muted" dir="auto">{b.authors.join('، ')} · {b.format.toUpperCase()} · {(b.fileSize / 1e6).toFixed(1)} MB · {fmtDate(lang, b.addedAt)}{b.archived ? ` · ${t('arc.title')}` : ''}</span></span>
              </button>
            ))}
          </div>
        ))}
      </Modal>
    </>
  );
}
