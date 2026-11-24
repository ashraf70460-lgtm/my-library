import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, EyeOff, ExternalLink, Trash2, Download, Sparkles, Loader2 } from 'lucide-react';
import { useStore, useT, useLang, useBooks, useWishlist, uid } from '../store';
import { rankCatalog, moreByAuthors, type CatalogBook, type OnlineRec } from '../lib/recs';
import { countryName } from '../lib/world';
import { genreLabel } from '../lib/genres';
import { lsGet, lsSet } from '../lib/storage';
import { isHostedByClaude } from '../lib/claude';
import { Button, Card, SectionHeader } from './ui';

const searchUrl = (title: string, author: string) => `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(`${title} ${author}`)}`;
const olUrl = (title: string, author: string) => `https://openlibrary.org/search?q=${encodeURIComponent(`${title} ${author}`)}`;

function Spine({ title, seed }: { title: string; seed: string }) {
  const colors = ['#2f4f3e', '#7b2d35', '#6b7445', '#7a5a3a', '#3d4a5c', '#5a2f4f'];
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (
    <div className="spine book-shadow relative flex aspect-[2/3] w-16 shrink-0 items-center justify-center overflow-hidden rounded-[3px] p-1.5 text-center" style={{ background: colors[Math.abs(h) % colors.length] }}>
      <span className="serif line-clamp-4 text-[9px] font-semibold leading-tight text-[#f1e4cf]" dir="auto">{title}</span>
    </div>
  );
}

export function BooksToAdd() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const books = useBooks();
  const wish = useWishlist();
  const [hidden, setHidden] = useState<string[]>(() => lsGet<{ ids: string[] }>('ml-recs-hidden', { ids: [] }).ids);
  const [more, setMore] = useState(8);
  const li = lang === 'ar' ? 1 : 0;
  const ranked = useMemo(() => rankCatalog(books, new Set(hidden)), [books, hidden]);
  const inWish = (cb: CatalogBook) => wish.find((w) => w.catalogId === cb.id);
  const hide = (id: string) => { const n = [...hidden, id]; setHidden(n); lsSet('ml-recs-hidden', { ids: n }); };
  const toggleWish = (cb: CatalogBook) => {
    const w = inWish(cb);
    if (w) { s.remove('wishlist', w.id); return; }
    s.upsert('wishlist', { id: uid('w'), updatedAt: Date.now(), title: cb.t[li], author: cb.a[li], country: cb.c, genres: cb.g, year: cb.y, catalogId: cb.id, addedAt: Date.now() });
    s.toast(t('rec.added'));
  };
  const reasonText = (r: string, cb: CatalogBook) => r === 'author' ? t('rec.byAuthor', { a: cb.a[li] }) : r === 'country' ? t('rec.fromCountry', { c: countryName(cb.c, lang) }) : r === 'genre' ? t('rec.genre', { g: genreLabel(cb.g[0], lang) }) : t('rec.classic');
  if (!ranked.length) return null;
  return (
    <section className="mb-10">
      <SectionHeader title={t('rec.title')} sub={t('rec.sub')} />
      <div className="grid gap-3 sm:grid-cols-2">
        {ranked.slice(0, more).map(({ cb, reason }) => {
          const w = inWish(cb);
          return (
            <Card key={cb.id} className="flex gap-3 !p-3">
              <Spine title={cb.t[li]} seed={cb.id} />
              <div className="min-w-0 flex-1">
                <div className="serif font-semibold leading-snug" dir="auto">{cb.t[li]}</div>
                <div className="text-sm text-muted" dir="auto">{cb.a[li]}{cb.y ? ` · ${cb.y < 0 ? `${-cb.y} BC` : cb.y}` : ''}</div>
                <div className="mt-1 text-xs text-forest">{reasonText(reason, cb)}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Button size="sm" variant={w ? 'primary' : 'outline'} onClick={() => toggleWish(cb)}>{w ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}{w ? t('rec.inWish') : t('rec.wish')}</Button>
                  <a className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-paper" href={searchUrl(cb.t[li], cb.a[li])} target="_blank" rel="noopener" title={t('rec.find')} aria-label={t('rec.find')}><ExternalLink size={15} /></a>
                  <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-paper" title={t('rec.hide')} aria-label={t('rec.hide')} onClick={() => hide(cb.id)}><EyeOff size={15} /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {ranked.length > more && <div className="mt-4 flex justify-center"><Button onClick={() => setMore(more + 8)}>{t('more')}</Button></div>}
      <p className="mt-3 text-xs text-muted">{t('rec.note')}</p>
    </section>
  );
}

export function OnlineRecs() {
  const t = useT();
  const s = useStore();
  const books = useBooks();
  const wish = useWishlist();
  const [items, setItems] = useState<OnlineRec[] | null>(null);
  const [busy, setBusy] = useState(false);
  const favAuthors = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of books) for (const a of b.authors) m.set(a, (m.get(a) || 0) + (b.favorite ? 3 : 0) + (b.status === 'completed' ? 2 : 0) + ((b.rating || 0) >= 4 ? 2 : 0) + (b.status === 'reading' ? 1 : 0));
    return [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([a]) => a);
  }, [books]);
  const load = async () => { setBusy(true); setItems(await moreByAuthors(books, favAuthors)); setBusy(false); };
  useEffect(() => { if (favAuthors.length && !isHostedByClaude()) load(); }, [favAuthors.join('|')]);
  if (isHostedByClaude() || !favAuthors.length) return null;
  return (
    <section className="mb-10">
      <SectionHeader title={t('rec.online')} sub={t('rec.onlineSub')} action={busy ? <Loader2 size={18} className="animate-spin text-muted" /> : undefined} />
      {items && !items.length && <p className="text-sm text-muted">{t('bd.noResults')}</p>}
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-3">
        {items?.map((o) => {
          const w = wish.find((x) => x.olKey === o.key);
          return (
            <div key={o.key} className="w-[124px] shrink-0">
              {o.cover ? <img src={o.cover} alt="" loading="lazy" className="book-shadow aspect-[2/3] w-full rounded-[3px] object-cover" /> : <div className="w-full"><Spine title={o.title} seed={o.key} /></div>}
              <div className="serif mt-2 line-clamp-2 text-sm font-semibold leading-snug" dir="auto">{o.title}</div>
              <div className="line-clamp-1 text-xs text-muted" dir="auto">{o.author}{o.year ? ` · ${o.year}` : ''}</div>
              <div className="mt-1 flex gap-1">
                <button type="button" title={t('rec.wish')} aria-label={t('rec.wish')} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-paper" onClick={() => { if (w) s.remove('wishlist', w.id); else { s.upsert('wishlist', { id: uid('w'), updatedAt: Date.now(), title: o.title, author: o.author, year: o.year, olKey: o.key, addedAt: Date.now() }); s.toast(t('rec.added')); } }}>{w ? <BookmarkCheck size={15} className="text-forest" /> : <Bookmark size={15} />}</button>
                <a className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-paper" href={`https://openlibrary.org${o.key}`} target="_blank" rel="noopener" aria-label="Open Library"><ExternalLink size={14} /></a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Wishlist() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const wish = useWishlist().sort((a, b) => b.addedAt - a.addedAt);
  return (
    <section className="mb-10">
      <SectionHeader title={`${t('rec.wishlist')} · ${wish.length}`} sub={t('rec.wishSub')} />
      {!wish.length ? <Card className="text-sm text-muted"><Sparkles size={16} className="mb-1 text-[#c9a46b]" />{t('rec.wishEmpty')}</Card> : (
        <div className="flex flex-col gap-1">
          {wish.map((w) => (
            <div key={w.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-2">
              <Spine title={w.title} seed={w.id} />
              <div className="min-w-0 flex-1">
                <div className="serif font-semibold" dir="auto">{w.title}</div>
                <div className="text-sm text-muted" dir="auto">{w.author}{w.country ? ` · ${countryName(w.country, lang)}` : ''}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <a className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-line px-3 text-xs hover:bg-paper" href={searchUrl(w.title, w.author)} target="_blank" rel="noopener"><ExternalLink size={12} />{t('rec.find')}</a>
                  <a className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-line px-3 text-xs hover:bg-paper" href={olUrl(w.title, w.author)} target="_blank" rel="noopener">Open Library</a>
                  <button type="button" className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-line px-3 text-xs hover:bg-paper" onClick={() => s.navigate({ name: 'import' })}><Download size={12} />{t('rec.gotIt')}</button>
                </div>
              </div>
              <button type="button" aria-label={t('remove')} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-paper" onClick={() => s.remove('wishlist', w.id)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
