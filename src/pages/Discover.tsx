import { useMemo, useState } from 'react';
import { BookOpen, Shuffle, Sparkles } from 'lucide-react';
import { useStore, useT, useLang, useBooks, useSessions } from '../store';
import { Button, Card, EmptyState, PageTitle, SectionHeader, Toggle, Watermark } from '../components/ui';
import { BookCover, Shelf } from '../components/books';
import { countryName, countryById } from '../lib/world';
import { Monogram } from './Authors';
import { askClaude, isHostedByClaude } from '../lib/claude';
import { genreLabel } from '../lib/genres';
import { BooksToAdd, OnlineRecs, Wishlist } from '../components/Recommendations';

export default function DiscoverPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const books = useBooks();
  const sessions = useSessions();
  const [seed, setSeed] = useState(() => Math.random());
  const unread = useMemo(() => books.filter((b) => !b.archived && (b.status === 'unread' || b.status === 'want')), [books]);
  // rotate what is shown: changes every day, and on "shuffle"
  const daySeed = Math.floor(Date.now() / 86400000) + Math.floor(seed * 1000);
  const rot = <T,>(arr: T[], key: (x: T) => string) => [...arr].sort((a, b) => hash(key(a) + daySeed) - hash(key(b) + daySeed));
  const liked = useMemo(() => books.filter((b) => b.favorite || b.status === 'completed' || (b.rating || 0) >= 4), [books]);
  const similar = useMemo(() => {
    const g = new Map<string, number>(), c = new Map<string, number>();
    liked.forEach((b) => { b.genres.forEach((x) => g.set(x, (g.get(x) || 0) + 1)); b.countries.forEach((x) => c.set(x, (c.get(x) || 0) + 1)); });
    return unread.map((b) => ({ b, sc: b.genres.reduce((a, x) => a + (g.get(x) || 0), 0) + b.countries.reduce((a, x) => a + (c.get(x) || 0), 0) }))
      .filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 30).map((x) => x.b);
  }, [liked, unread]);
  const mayLike = useMemo(() => {
    const g = new Set(liked.flatMap((b) => b.genres)), c = new Set(liked.flatMap((b) => b.countries));
    const readAuthors = new Set(liked.flatMap((b) => b.authors));
    const m = new Map<string, number>();
    unread.forEach((b) => b.authors.forEach((a) => { if (!readAuthors.has(a)) m.set(a, (m.get(a) || 0) + b.genres.filter((x) => g.has(x)).length + b.countries.filter((x) => c.has(x)).length + 0.1); }));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([a]) => a);
  }, [liked, unread]);
  const asian = useMemo(() => unread.filter((b) => b.countries.some((c) => countryById(c)?.regions.some((r) => ['east-asia', 'south-asia', 'southeast-asia', 'central-asia'].includes(r)))), [unread]);
  const gems = useMemo(() => {
    const cnt = new Map<string, number>(); books.forEach((b) => b.countries.forEach((c) => cnt.set(c, (cnt.get(c) || 0) + 1)));
    return unread.filter((b) => !b.lastOpenedAt && b.countries.length && b.countries.every((c) => (cnt.get(c) || 0) <= 3));
  }, [books, unread]);
  const forgotten = useMemo(() => unread.filter((b) => !b.lastOpenedAt).sort((a, b) => a.addedAt - b.addedAt).slice(0, 14), [unread]);
  const pick = unread.length ? unread[Math.floor(seed * unread.length)] : undefined;
  const short = useMemo(() => unread.filter((b) => b.pages).sort((a, b) => (a.pages || 0) - (b.pages || 0)).slice(0, 12), [unread]);
  const favAuthor = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of books) if (b.favorite || b.status === 'completed' || (b.rating || 0) >= 4) for (const a of b.authors) m.set(a, (m.get(a) || 0) + 1);
    const ranked = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
    return ranked.find((a) => unread.some((b) => b.authors.includes(a)));
  }, [books, unread]);
  const unexplored = useMemo(() => {
    const read = new Map<string, number>(); const own = new Map<string, number>();
    for (const b of books) for (const c of b.countries) { own.set(c, (own.get(c) || 0) + 1); if (b.status === 'completed' || b.status === 'reading') read.set(c, (read.get(c) || 0) + 1); }
    return [...own.entries()].filter(([c, n]) => n >= 1 && (read.get(c) || 0) === 0).sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [books]);

  if (!books.length) return <div><PageTitle title={t('disc.title')} /><div className="mb-10"><EmptyState title={t('disc.empty')} actions={<Button variant="primary" onClick={() => s.navigate({ name: 'import' })}>{t('nav.import')}</Button>} /></div><BooksToAdd /><Wishlist /></div>;

  return (
    <div>
      <PageTitle title={t('disc.title')} sub={t('disc.sub')} />
      {pick && (
        <div className="paper-grain relative mb-10 grid items-center gap-6 overflow-hidden rounded-3xl bg-paper p-6 sm:grid-cols-[180px_1fr] sm:p-8">
          <Watermark className="-bottom-6 end-4" size={90} />
          <button type="button" className="relative mx-auto w-40 sm:w-full" onClick={() => s.navigate({ name: 'book', id: pick.id })}><BookCover book={pick} size="lg" className="w-full" /></button>
          <div className="relative">
            <div className="mb-1 text-sm text-muted">{t('disc.random')}</div>
            <h2 className="serif text-[28px] font-semibold leading-tight sm:text-[34px]" dir="auto">{pick.title}</h2>
            <div className="mb-3 text-muted" dir="auto">{pick.authors.join('، ')}{pick.year ? ` · ${pick.year}` : ''}</div>
            {pick.description && <p className="mb-4 line-clamp-4 max-w-[60ch] leading-relaxed" dir="auto">{pick.description}</p>}
            <div className="mb-4 flex flex-wrap gap-1.5">{pick.genres.slice(0, 3).map((g) => <span key={g} className="rounded-full bg-card px-3 py-1 text-sm">{genreLabel(g, lang)}</span>)}{pick.countries.slice(0, 2).map((c) => <span key={c} className="rounded-full bg-card px-3 py-1 text-sm">{countryName(c, lang)}</span>)}</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => s.openReader(pick.id)}><BookOpen size={16} />{t('bd.read')}</Button>
              <Button onClick={() => setSeed(Math.random())}><Shuffle size={16} />{t('disc.shuffle')}</Button>
            </div>
          </div>
        </div>
      )}
      {isHostedByClaude() && <AskClaude />}
      <div className="mb-4 flex items-center gap-3"><span className="rounded-full bg-forest px-3 py-1 text-xs font-semibold text-ivory">{t('disc.inLibrary')}</span><span className="h-px flex-1 bg-line" /></div>
      {similar.length > 0 && <section className="mb-10"><SectionHeader title={t('disc.similar')} /><Shelf books={rot(similar, (b) => b.id).slice(0, 14)} /></section>}
      {mayLike.length > 0 && (
        <section className="mb-10"><SectionHeader title={t('disc.mayLike')} />
          <div className="flex flex-wrap gap-2">{rot(mayLike, (a) => a).slice(0, 10).map((a) => <button key={a} type="button" onClick={() => s.navigate({ name: 'author', id: a })} className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pe-3 ps-1 text-sm hover:border-forest/40"><Monogram name={a} size={28} /><span dir="auto">{a}</span></button>)}</div>
        </section>
      )}
      {forgotten.length > 0 && <section className="mb-10"><SectionHeader title={t('disc.forgotten')} /><Shelf books={forgotten} /></section>}
      {gems.length > 0 && <section className="mb-10"><SectionHeader title={t('disc.gems')} /><Shelf books={rot(gems, (b) => b.id).slice(0, 14)} /></section>}
      {asian.length > 0 && <section className="mb-10"><SectionHeader title={t('disc.asian')} /><Shelf books={rot(asian, (b) => b.id).slice(0, 14)} /></section>}
      {favAuthor && <section className="mb-10"><SectionHeader title={t('disc.byFav', { a: favAuthor })} /><Shelf books={unread.filter((b) => b.authors.includes(favAuthor))} /></section>}
      {unexplored && <section className="mb-10"><SectionHeader title={`${t('disc.unexplored')}: ${countryName(unexplored, lang)}`} action={<Button size="sm" variant="ghost" onClick={() => s.navigate({ name: 'country', id: unexplored })}>{t('seeAll')}</Button>} /><Shelf books={unread.filter((b) => b.countries.includes(unexplored))} /></section>}
      {short.length > 0 && <section className="mb-10"><SectionHeader title={t('disc.short')} /><Shelf books={short} /></section>}
      <div className="mb-4 mt-4 flex items-center gap-3"><span className="rounded-full bg-[#c9a46b] px-3 py-1 text-xs font-semibold text-[#23211e]">{t('disc.notOwned')}</span><span className="h-px flex-1 bg-line" /></div>
      <BooksToAdd />
      <OnlineRecs />
      <Wishlist />
      {void sessions}
    </div>
  );
}

function AskClaude() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const books = useBooks();
  const [outside, setOutside] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ picks: { id?: string; title: string; why: string }[] } | null>(null);
  const [err, setErr] = useState('');
  const ask = async () => {
    setBusy(true); setErr(''); setRes(null);
    const unread = books.filter((b) => b.status === 'unread' || b.status === 'want').slice(0, 250).map((b) => ({ id: b.id, t: b.title, a: b.authors[0], g: b.genres.slice(0, 2), c: b.countries[0], p: b.pages }));
    const history = books.filter((b) => b.status === 'completed' || b.favorite || b.status === 'reading').slice(0, 60).map((b) => ({ t: b.title, a: b.authors[0], fav: b.favorite || undefined, rating: b.rating, status: b.status }));
    try {
      const r = await askClaude(`You are a thoughtful librarian for one reader's private library. Recommend what they should read next.
Reading history: ${JSON.stringify(history)}
Unread books they own: ${JSON.stringify(unread)}
Return JSON only: {"picks": [{"id": string|null, "title": string, "why": string}]}. Give 4 picks from the unread books they own (use their exact id)${outside ? ', then 2 more well-known books they do not own (id null)' : ''}. "why" is one or two sentences in ${lang === 'ar' ? 'Arabic' : 'English'}, connecting to their history. Do not quote from books.`, { json: true });
      if (!Array.isArray(r?.picks)) throw new Error('bad');
      setRes({ picks: r.picks.filter((p: any) => p && typeof p.title === 'string').slice(0, 6) });
    } catch (e: any) { setErr(e?.message === 'unavailable' ? t('ai.unavailable') : t('ai.failed')); } finally { setBusy(false); }
  };
  return (
    <Card className="mb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl"><h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Sparkles size={18} className="text-[#c9a46b]" />{t('disc.ask')}</h2><p className="text-sm text-muted">{t('disc.askHint')}</p></div>
        <Button variant="primary" disabled={busy} onClick={ask}>{busy ? t('disc.asking') : t('disc.ask')}</Button>
      </div>
      <div className="mt-2 max-w-md"><Toggle checked={outside} onChange={setOutside} label={t('disc.askOutside')} /></div>
      {err && <p className="mt-2 text-sm text-wine">{err}</p>}
      {res && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {res.picks.map((p, i) => {
            const b = p.id ? s.books[p.id] : undefined;
            return (
              <div key={i} className="flex gap-3 rounded-xl bg-paper/60 p-3">
                {b && <button type="button" onClick={() => s.navigate({ name: 'book', id: b.id })} className="w-14 shrink-0"><BookCover book={b} size="sm" className="w-full" /></button>}
                <div className="min-w-0"><div className="serif font-semibold" dir="auto">{b?.title || p.title}</div><p className="text-sm text-muted" dir="auto">{p.why}</p></div>
              </div>
            );
          })}
          <p className="text-xs text-muted sm:col-span-2">{t('ai.label')}</p>
        </div>
      )}
    </Card>
  );
}

function hash(x: string) { let h = 2166136261; for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
