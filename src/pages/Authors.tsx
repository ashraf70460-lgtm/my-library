import { useMemo, useState } from 'react';
import { Edit3, Sparkles, Camera, PenLine, Trash2 } from 'lucide-react';
import { useStore, useT, useLang, useBooks, useAnnotations, authorKey, useAuthorMeta, uid } from '../store';
import { Button, Card, EmptyState, Field, Modal, PageTitle, ProgressBar, SectionHeader, Segmented, Watermark } from '../components/ui';
import { BookGrid, BookCover } from '../components/books';
import { countries, countryName } from '../lib/world';
import { genreLabel } from '../lib/genres';
import { askClaude } from '../lib/claude';
import { shrinkImage } from '../lib/parse';
import { fmtNum, fmtDate } from '../i18n';
import type { AuthorMeta, Book } from '../types';

export function Monogram({ name, portrait, size = 64 }: { name: string; portrait?: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('');
  if (portrait) return <img src={portrait} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return <div className="serif flex shrink-0 items-center justify-center rounded-full bg-forest/10 font-semibold text-forest" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</div>;
}

export function useAuthorsIndex() {
  const books = useBooks();
  const authors = useStore((s) => s.authors);
  return useMemo(() => {
    const m = new Map<string, Book[]>();
    for (const b of books) for (const a of b.authors) { if (!m.has(a)) m.set(a, []); m.get(a)!.push(b); }
    return [...m.entries()].map(([name, list]) => ({ name, books: list, meta: authors[authorKey(name)] && !authors[authorKey(name)].deleted ? authors[authorKey(name)] : undefined }));
  }, [books, authors]);
}

export function AuthorsPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const idx = useAuthorsIndex();
  const [sort, setSort] = useState<'alpha' | 'count' | 'recent' | 'country' | 'period'>('alpha');
  const [q, setQ] = useState('');
  const coll = new Intl.Collator(lang, { sensitivity: 'base' });
  const list = useMemo(() => {
    const l = idx.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()));
    if (sort === 'count') l.sort((a, b) => b.books.length - a.books.length);
    else if (sort === 'recent') l.sort((a, b) => Math.max(...b.books.map((x) => x.addedAt)) - Math.max(...a.books.map((x) => x.addedAt)));
    else if (sort === 'country') l.sort((a, b) => coll.compare(countryName(a.meta?.country || a.books[0].countries[0] || 'zz', lang), countryName(b.meta?.country || b.books[0].countries[0] || 'zz', lang)));
    else if (sort === 'period') l.sort((a, b) => coll.compare(a.meta?.period || '￿', b.meta?.period || '￿'));
    else l.sort((a, b) => coll.compare(a.name, b.name));
    return l;
  }, [idx, sort, q, lang]);
  return (
    <div>
      <PageTitle title={t('auth.title')} sub={`${fmtNum(lang, idx.length)}`} />
      {!idx.length ? <EmptyState title={t('auth.empty')} /> : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <input className="field max-w-xs !rounded-full" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
            <Segmented value={sort} onChange={setSort} options={(['alpha', 'count', 'recent', 'country', 'period'] as const).map((v) => ({ value: v, label: t('auth.sort.' + v) }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a) => {
              const read = a.books.filter((b) => b.status === 'completed').length;
              const country = a.meta?.country || a.books.find((b) => b.countries[0])?.countries[0];
              return (
                <button key={a.name} type="button" onClick={() => s.navigate({ name: 'author', id: a.name })} className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 text-start hover:border-forest/40">
                  <Monogram name={a.name} portrait={a.meta?.portrait} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="serif truncate text-lg font-semibold" dir="auto">{a.name}</div>
                    <div className="text-sm text-muted">{t('books.count', { n: a.books.length })}{country ? ` · ${countryName(country, lang)}` : ''}</div>
                    <ProgressBar value={read / a.books.length} className="mt-2" />
                  </div>
                  <div className="hidden -space-x-6 rtl:space-x-reverse sm:flex">{a.books.slice(0, 3).map((b) => <BookCover key={b.id} book={b} size="sm" className="w-9" />)}</div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function AuthorPage({ name }: { name: string }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const books = useBooks().filter((b) => b.authors.includes(name));
  const meta = useAuthorMeta(name);
  const ann = useAnnotations().filter((a) => a.target === 'author' && a.author === name);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const read = books.filter((b) => b.status === 'completed');
  const favs = books.filter((b) => b.favorite);
  const progress = books.length ? books.reduce((a, b) => a + b.progress, 0) / books.length : 0;
  const genres = [...new Set(books.flatMap((b) => b.genres))];
  const country = meta?.country || books.find((b) => b.countries[0])?.countries[0];

  const draft = async () => {
    setBusy(true); setErr('');
    try {
      const r = await askClaude(`Write a short factual profile of the author "${name}" for a personal library app. Their books in this library: ${books.map((b) => b.title).slice(0, 8).join('; ')}. Return JSON only: {"bio": string (3-4 sentences, in ${lang === 'ar' ? 'Arabic' : 'English'}, neutral, no quotations), "country": one id from [${countries.map((c) => c.id + '=' + c.en).join(', ')}] or null, "languages": string|null, "period": string|null (literary period or movement, in ${lang === 'ar' ? 'Arabic' : 'English'}), "born": string|null (year and place)}. If you do not recognise this author, return {"bio": null}.`, { json: true });
      if (!r?.bio) { setErr(t('bd.noResults')); return; }
      save({ bio: r.bio, country: countries.some((c) => c.id === r.country) ? r.country : meta?.country, languages: r.languages || undefined, period: r.period || undefined, born: r.born || undefined, aiGenerated: true });
    } catch (e: any) { setErr(e?.message === 'unavailable' ? t('ai.unavailable') : t('ai.failed')); } finally { setBusy(false); }
  };
  const save = (patch: Partial<AuthorMeta>) => s.upsert('authors', { id: authorKey(name), updatedAt: Date.now(), name, ...(meta || {}), ...patch });

  if (!books.length) return <EmptyState title={t('auth.empty')} />;
  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-line bg-card p-6 sm:p-8">
        <Watermark className="-bottom-6 end-4" size={80} />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="relative">
            <Monogram name={name} portrait={meta?.portrait} size={112} />
            <label className="absolute bottom-0 end-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-forest text-ivory shadow" title={t('bd.changeCover')}>
              <Camera size={16} /><input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) save({ portrait: await shrinkImage(f, 240) }); }} />
            </label>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[32px] font-semibold leading-tight sm:text-[40px]" dir="auto">{name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {country && <button type="button" className="hover:underline" onClick={() => s.navigate({ name: 'country', id: country })}>{countryName(country, lang)}</button>}
              {meta?.born && <span>{t('auth.born')}: {meta.born}</span>}
              {meta?.period && <span>{meta.period}</span>}
              {meta?.languages && <span>{meta.languages}</span>}
            </div>
            <p className="mt-4 max-w-[68ch] leading-relaxed" dir="auto">{meta?.bio || <span className="text-muted">{t('auth.noBio')}</span>}</p>
            {meta?.aiGenerated && <p className="mt-2 text-xs text-muted">{t('ai.label')}</p>}
            {err && <p className="mt-2 text-sm text-wine">{err}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Edit3 size={14} />{t('auth.editProfile')}</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={draft}><Sparkles size={14} />{busy ? t('ai.working') : t('ai.draftBio')}</Button>
            </div>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[[t('auth.books'), books.length], [t('auth.read'), read.length], [t('auth.unread'), books.filter((b) => b.status === 'unread' || b.status === 'want').length], [t('auth.favs'), favs.length]].map(([l, v]) => (
            <div key={String(l)} className="rounded-xl bg-paper/60 px-4 py-3"><div className="text-xs text-muted">{l}</div><div className="serif text-2xl font-semibold">{fmtNum(lang, Number(v))}</div></div>
          ))}
        </div>
        <div className="relative mt-4"><div className="mb-1 flex justify-between text-xs text-muted"><span>{t('auth.progress')}</span><span>{t('pct', { n: Math.round(progress * 100) })}</span></div><ProgressBar value={progress} /></div>
        {genres.length > 0 && <div className="relative mt-4 flex flex-wrap gap-1.5">{genres.map((g) => <button key={g} type="button" onClick={() => s.navigate({ name: 'genre', id: g })} className="rounded-full bg-paper px-3 py-1 text-sm hover:bg-line">{genreLabel(g, lang)}</button>)}</div>}
      </div>

      <SectionHeader title={t('auth.books')} />
      <BookGrid books={[...books].sort((a, b) => (a.year || '9999').localeCompare(b.year || '9999'))} />

      <section className="mt-10">
        <SectionHeader title={t('auth.notes')} />
        <div className="flex gap-2">
          <textarea className="field !min-h-[70px]" placeholder={t('rd.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button variant="primary" disabled={!note.trim()} onClick={() => { s.upsert('annotations', { id: uid('n'), updatedAt: Date.now(), bookId: books[0].id, kind: 'note', target: 'author', author: name, note: note.trim(), createdAt: Date.now() }); setNote(''); }}><PenLine size={16} /></Button>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {ann.sort((a, b) => b.createdAt - a.createdAt).map((a) => (
            <Card key={a.id} className="!p-4"><p className="whitespace-pre-wrap" dir="auto">{a.note}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">{fmtDate(lang, a.createdAt)}<button type="button" aria-label={t('delete')} onClick={() => s.remove('annotations', a.id)}><Trash2 size={14} /></button></div></Card>
          ))}
        </div>
      </section>
      <EditAuthor open={edit} onClose={() => setEdit(false)} name={name} meta={meta} onSave={save} />
    </div>
  );
}

function EditAuthor({ open, onClose, name, meta, onSave }: { open: boolean; onClose: () => void; name: string; meta?: AuthorMeta; onSave: (p: Partial<AuthorMeta>) => void }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const [v, setV] = useState<Partial<AuthorMeta>>({});
  const [newName, setNewName] = useState(name);
  const cur = { ...meta, ...v };
  const upd = (k: keyof AuthorMeta, val: string) => setV((p) => ({ ...p, [k]: val }));
  const submit = () => {
    onSave({ ...v, aiGenerated: v.bio !== undefined ? false : meta?.aiGenerated });
    if (newName.trim() && newName.trim() !== name) {
      for (const b of Object.values(s.books)) if (!b.deleted && b.authors.includes(name)) s.updateBook(b.id, { authors: b.authors.map((a) => (a === name ? newName.trim() : a)) });
      const m = s.authors[authorKey(name)];
      s.upsert('authors', { ...(m || {}), ...v, id: authorKey(newName.trim()), name: newName.trim(), updatedAt: Date.now() });
      s.navigate({ name: 'author', id: newName.trim() });
    }
    setV({}); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={t('auth.editProfile')} footer={<><Button variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" onClick={submit}>{t('save')}</Button></>}>
      <Field label={t('auth.rename')}><input className="field" dir="auto" value={newName} onChange={(e) => setNewName(e.target.value)} /></Field>
      <Field label={t('auth.bio')}><textarea className="field" dir="auto" value={cur.bio || ''} onChange={(e) => upd('bio', e.target.value)} /></Field>
      <Field label={t('auth.country')}>
        <select className="field" value={cur.country || ''} onChange={(e) => upd('country', e.target.value)}>
          <option value="">—</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.flag} {c[lang]}</option>)}
        </select>
      </Field>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label={t('auth.languages')}><input className="field" value={cur.languages || ''} onChange={(e) => upd('languages', e.target.value)} /></Field>
        <Field label={t('auth.period')}><input className="field" value={cur.period || ''} onChange={(e) => upd('period', e.target.value)} /></Field>
        <Field label={t('auth.born')}><input className="field" value={cur.born || ''} onChange={(e) => upd('born', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
