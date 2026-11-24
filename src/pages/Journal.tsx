import { useMemo, useState } from 'react';
import { Plus, Edit3, Trash2, Quote, Lock } from 'lucide-react';
import { useStore, useT, useLang, useJournal, useBooks, useCollections, uid } from '../store';
import { Button, Card, ConfirmDialog, EmptyState, Field, Modal, PageTitle, Segmented, Watermark } from '../components/ui';
import { BookCover } from '../components/books';
import { fmtDate } from '../i18n';
import type { JournalEntry } from '../types';

const KINDS: JournalEntry['kind'][] = ['thought', 'reflection', 'passage', 'review', 'observation', 'insight', 'session'];

export default function JournalPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const entries = useJournal();
  const [edit, setEdit] = useState<JournalEntry | null>(null);
  const [kind, setKind] = useState<string>('all');
  const [del, setDel] = useState<string | null>(null);
  const list = useMemo(() => entries.filter((e) => kind === 'all' || e.kind === kind).sort((a, b) => b.createdAt - a.createdAt), [entries, kind]);
  const groups = useMemo(() => {
    const m = new Map<string, JournalEntry[]>();
    for (const e of list) { const k = fmtDate(lang, e.createdAt, { year: 'numeric', month: 'long' }); if (!m.has(k)) m.set(k, []); m.get(k)!.push(e); }
    return [...m.entries()];
  }, [list, lang]);
  const newEntry = () => setEdit({ id: uid('j'), updatedAt: Date.now(), createdAt: Date.now(), body: '', kind: 'thought' });
  return (
    <div className="relative">
      <PageTitle title={t('jr.title')} sub={<span className="inline-flex items-center gap-1.5"><Lock size={14} />{t('storage.local')}</span>} actions={<Button variant="primary" onClick={newEntry}><Plus size={16} />{t('jr.new')}</Button>} />
      {!entries.length ? <EmptyState title={t('jr.empty')} actions={<Button variant="primary" onClick={newEntry}>{t('jr.new')}</Button>} /> : (
        <>
          <div className="no-scrollbar mb-6 overflow-x-auto"><Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: t('all') }, ...KINDS.map((k) => ({ value: k, label: t('jr.k.' + k) }))]} /></div>
          {groups.map(([month, es]) => (
            <section key={month} className="mb-10">
              <h2 className="serif mb-4 text-lg font-semibold text-muted">{month}</h2>
              <ol className="relative border-s-2 border-line ps-6">
                {es.map((e) => {
                  const book = e.bookId ? s.books[e.bookId] : undefined;
                  return (
                    <li key={e.id} className="relative mb-6">
                      <span className="absolute -start-[33px] top-2 h-3.5 w-3.5 rounded-full border-2 border-ivory bg-forest" />
                      <Card className="relative overflow-hidden">
                        <Watermark className="-bottom-3 -end-3" size={36} />
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="rounded-full bg-paper px-2 py-0.5 font-medium text-ink">{t('jr.k.' + e.kind)}</span>
                          <span>{fmtDate(lang, e.createdAt, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="ms-auto flex gap-1">
                            <button type="button" aria-label={t('edit')} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-paper" onClick={() => setEdit(e)}><Edit3 size={14} /></button>
                            <button type="button" aria-label={t('delete')} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-paper" onClick={() => setDel(e.id)}><Trash2 size={14} /></button>
                          </span>
                        </div>
                        {e.title && <h3 className="serif mb-1 text-lg font-semibold" dir="auto">{e.title}</h3>}
                        {e.quote && <blockquote className="serif my-3 border-s-2 border-wine/50 ps-3 italic" dir="auto"><Quote size={14} className="mb-1 inline text-wine/60" /> {e.quote}</blockquote>}
                        <p className="whitespace-pre-wrap leading-relaxed" dir="auto">{e.body}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          {book && <button type="button" className="flex items-center gap-2 rounded-full bg-paper py-1 pe-3 ps-1" onClick={() => s.navigate({ name: 'book', id: book.id })}><BookCover book={book} size="sm" className="w-5" /><span className="max-w-[200px] truncate" dir="auto">{book.title}</span></button>}
                          {e.author && <button type="button" className="rounded-full bg-paper px-3 py-1" onClick={() => s.navigate({ name: 'author', id: e.author })} dir="auto">{e.author}</button>}
                          {e.collectionId && s.collections[e.collectionId] && <button type="button" className="rounded-full bg-paper px-3 py-1" onClick={() => s.navigate({ name: 'collection', id: e.collectionId })} dir="auto">{s.collections[e.collectionId].name}</button>}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </>
      )}
      {edit && <JournalEditor entry={edit} onClose={() => setEdit(null)} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} text={t('delete') + '?'} onConfirm={() => del && s.remove('journal', del)} />
    </div>
  );
}

export function JournalEditor({ entry, onClose }: { entry: JournalEntry; onClose: () => void }) {
  const t = useT();
  const s = useStore();
  const books = useBooks();
  const cols = useCollections();
  const authors = useMemo(() => [...new Set(books.flatMap((b) => b.authors))].sort(), [books]);
  const [v, setV] = useState<JournalEntry>(entry);
  const save = () => { if (!v.body.trim() && !v.quote?.trim()) return; s.upsert('journal', v); s.toast(t('toast.saved')); onClose(); };
  return (
    <Modal open onClose={onClose} title={t('jr.new')} wide footer={<><Button variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" onClick={save}>{t('save')}</Button></>}>
      <Field label={t('jr.kind')}>
        <select className="field" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as any })}>{KINDS.map((k) => <option key={k} value={k}>{t('jr.k.' + k)}</option>)}</select>
      </Field>
      <Field label={t('jr.titleField')}><input className="field" dir="auto" value={v.title || ''} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
      {(v.kind === 'passage' || v.quote) && <Field label={t('jr.quote')}><textarea className="field serif !min-h-[70px]" dir="auto" value={v.quote || ''} onChange={(e) => setV({ ...v, quote: e.target.value })} /></Field>}
      <Field label={t('jr.body')}><textarea className="field !min-h-[180px]" dir="auto" autoFocus value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></Field>
      <div className="grid gap-x-3 sm:grid-cols-3">
        <Field label={t('jr.book')}>
          <select className="field" value={v.bookId || ''} onChange={(e) => setV({ ...v, bookId: e.target.value || undefined })}><option value="">—</option>{books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select>
        </Field>
        <Field label={t('jr.author')}>
          <select className="field" value={v.author || ''} onChange={(e) => setV({ ...v, author: e.target.value || undefined })}><option value="">—</option>{authors.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </Field>
        <Field label={t('jr.collection')}>
          <select className="field" value={v.collectionId || ''} onChange={(e) => setV({ ...v, collectionId: e.target.value || undefined })}><option value="">—</option>{cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
      </div>
    </Modal>
  );
}
