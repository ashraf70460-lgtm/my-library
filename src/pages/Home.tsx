import { useMemo, useState } from 'react';
import { BookOpen, Download, Flame, Link2, Library, RefreshCw, Quote, Sparkles, BookPlus, CheckCircle2, Clock, PenLine, Heart, Feather, Flag, Globe2, Hourglass, Layers, Map as MapIcon } from 'lucide-react';
import { useStore, useT, useLang, useBooks, useSessions, useAnnotations, useCollections } from '../store';
import { countryById, countries as allCountries } from '../lib/world';
import { genreLabel } from '../lib/genres';
import { Monogram } from './Authors';
import { useFavoriteAuthors } from './Favorites';
import { Button, Card, EmptyState, Ring, SectionHeader, Watermark } from '../components/ui';
import { ContinueCard, Shelf, BookCover } from '../components/books';
import { byDay, dayKey, addDays, goalProgress, streaks } from '../lib/stats';
import { fmtDate, fmtNum } from '../i18n';
import type { Book } from '../types';
import { InstallBanner } from '../components/Install';

const PROMPTS: { en: string; ar: string }[] = [
  { en: 'Which character from your current book would you most like to argue with — and about what?', ar: 'أي شخصية في كتابك الحالي تودّ أن تجادلها، وفي أي شيء؟' },
  { en: 'Reread the first page of the book you are reading. What does it promise that you only notice now?', ar: 'أعد قراءة الصفحة الأولى من كتابك الحالي. ما الذي تعِد به ولم تلحظه إلا الآن؟' },
  { en: 'Pick a book from a country you have never read. What do you expect, before you open it?', ar: 'اختر كتابًا من بلد لم تقرأ له من قبل. ماذا تتوقع منه قبل أن تفتحه؟' },
  { en: 'Ten quiet minutes, one chapter, no phone. That is the whole plan for today.', ar: 'عشر دقائق هادئة، فصل واحد، بلا هاتف. هذه خطة اليوم كلها.' },
  { en: 'Which book on your shelves have you owned the longest without reading? Read its first chapter tonight.', ar: 'ما الكتاب الذي تملكه منذ أطول مدة دون أن تقرأه؟ اقرأ فصله الأول الليلة.' },
  { en: 'Copy one sentence you love into your journal, then write why it stayed with you.', ar: 'انقل جملة تحبها إلى يومياتك، ثم اكتب لماذا بقيت معك.' },
  { en: 'Think of a book that changed your mind about something. What was the moment it happened?', ar: 'تذكّر كتابًا غيّر رأيك في أمر ما. ما اللحظة التي حدث فيها ذلك؟' },
  { en: 'Read a few pages aloud today. Notice what the sound of the sentences adds.', ar: 'اقرأ بضع صفحات بصوت مسموع اليوم، ولاحظ ما يضيفه صوت الجمل.' },
];

export default function HomePage() {
  const s = useStore();
  const t = useT();
  const lang = useLang();
  const allBooks = useBooks();
  const books = useMemo(() => allBooks.filter((b) => !b.archived), [allBooks]);
  const sessions = useSessions();
  const days = useMemo(() => byDay(sessions), [sessions]);
  const today = days.get(dayKey());
  const goal = goalProgress(s.settings, today);
  const st = useMemo(() => streaks(days), [days]);
  const reading = useMemo(() => books.filter((b) => b.status === 'reading').sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0)), [books]);
  const year = new Date().getFullYear();
  const doneYear = books.filter((b) => b.status === 'completed' && b.completedAt && new Date(b.completedAt).getFullYear() === year).length;
  const recent = useMemo(() => [...books].sort((a, b) => b.addedAt - a.addedAt).slice(0, 14), [books]);
  const recommended = useMemo(() => recommend(books), [books]);

  if (!allBooks.length) {
    return (
      <div>
        <InstallBanner />
        <Hero />
        <EmptyState
          title={t('home.empty.title')}
          body={t('home.empty.body')}
          actions={<>
            <Button variant="primary" onClick={() => s.navigate({ name: 'import' })}><Download size={18} />{t('imp.files')}</Button>
            <Button onClick={() => s.navigate({ name: 'import', id: 'url' })}><Link2 size={18} />{t('imp.url')}</Button>
            <Button variant="outline" onClick={() => s.navigate({ name: 'world' })}><Library size={18} />{t('nav.world')}</Button>
          </>}
        />
      </div>
    );
  }

  const week = [...Array(7)].map((_, i) => { const d = addDays(new Date(), i - 6); const v = days.get(dayKey(d)); return { d, m: Math.round((v?.seconds || 0) / 60) }; });
  const maxW = Math.max(s.settings.goal.type === 'minutes' ? s.settings.goal.value : 10, ...week.map((w) => w.m));
  const unit = s.settings.goal.type === 'minutes' ? t('minutes') : s.settings.goal.type === 'pages' ? t('pages') : t('goal.chapters');

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <InstallBanner />
        <Hero stats={[
          { icon: <Flame size={16} />, label: t('home.streak'), value: `${fmtNum(lang, st.current)} ${t('home.days')}` },
          { icon: <Library size={16} />, label: t('home.total'), value: fmtNum(lang, books.length) },
          { icon: <BookOpen size={16} />, label: t('home.reading'), value: fmtNum(lang, reading.length) },
          { icon: <CheckCircle2 size={16} />, label: t('home.progress'), value: `${fmtNum(lang, doneYear)} / ${fmtNum(lang, s.settings.booksPerYear)}` },
        ]} goal={goal} />

        <section className="mb-10">
          <SectionHeader title={t('home.continue')} action={reading.length > 2 ? <Button variant="ghost" size="sm" onClick={() => s.navigate({ name: 'continue' })}>{t('seeAll')}</Button> : undefined} />
          {reading.length ? (
            <div className="grid gap-4 md:grid-cols-2">{reading.slice(0, 4).map((b) => <ContinueCard key={b.id} book={b} />)}</div>
          ) : (
            <Card className="flex flex-wrap items-center justify-between gap-3"><span className="text-muted">{t('home.noReading')}</span>
              {recommended[0] && <Button variant="primary" size="sm" onClick={() => s.openReader(recommended[0].id)}><BookOpen size={16} />{recommended[0].title}</Button>}</Card>
          )}
        </section>

        <section className="mb-10 xl:hidden"><DailyCard goal={goal} today={today} streak={st.current} week={week} maxW={maxW} unit={unit} /></section>

        <section className="mb-10">
          <SectionHeader title={t('home.recommended')} />
          <Shelf books={recommended.slice(0, 12)} />
        </section>

        <section className="mb-10">
          <SectionHeader title={t('home.recent')} action={<Button variant="ghost" size="sm" onClick={() => s.navigate({ name: 'books' })}>{t('seeAll')}</Button>} />
          <Shelf books={recent} />
        </section>

        <LibraryAtAGlance books={books} sessions={sessions} />
        <MoreShelves books={books} />

        <section className="mb-10 xl:hidden"><Inspiration /></section>
        <section className="xl:hidden"><Activity /></section>
      </div>

      <aside className="hidden flex-col gap-6 xl:flex">
        <DailyCard goal={goal} today={today} streak={st.current} week={week} maxW={maxW} unit={unit} />
        <Inspiration />
        <Activity />
      </aside>
    </div>
  );
}

function LibraryAtAGlance({ books, sessions }: { books: Book[]; sessions: { seconds: number }[] }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const authors = new Set(books.flatMap((b) => b.authors)).size;
  const cs = [...new Set(books.flatMap((b) => b.countries))];
  const regions = new Set(cs.flatMap((c) => countryById(c)?.regions || [])).size;
  const hours = Math.round(sessions.reduce((a, x) => a + x.seconds, 0) / 3600);
  const items = [
    { icon: <Library size={16} />, label: t('nav.books'), v: books.length, go: 'books' },
    { icon: <Feather size={16} />, label: t('nav.authors'), v: authors, go: 'authors' },
    { icon: <Flag size={16} />, label: t('nav.countries'), v: cs.length, go: 'countries' },
    { icon: <Globe2 size={16} />, label: t('home.regions'), v: regions, go: 'map' },
    { icon: <Hourglass size={16} />, label: t('home.hours'), v: hours, go: 'stats' },
  ];
  return (
    <section className="mb-10">
      <SectionHeader title={t('home.glance')} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {items.map((x) => (
          <button key={x.label} type="button" onClick={() => s.navigate({ name: x.go })} className="rounded-2xl border border-line bg-card px-4 py-3 text-start hover:border-forest/40">
            <div className="flex items-center gap-1.5 text-xs text-muted">{x.icon}{x.label}</div>
            <div className="serif mt-0.5 text-2xl font-semibold">{fmtNum(lang, x.v)}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function MoreShelves({ books }: { books: Book[] }) {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const cols = useCollections();
  const { marked, auto } = useFavoriteAuthors();
  const favAuthors = [...marked, ...auto].slice(0, 10);
  const opened = useMemo(() => books.filter((b) => b.lastOpenedAt).sort((a, b) => b.lastOpenedAt! - a.lastOpenedAt!).slice(0, 14), [books]);
  const done = useMemo(() => books.filter((b) => b.status === 'completed').sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 14), [books]);
  const favs = useMemo(() => books.filter((b) => b.favorite).sort((a, b) => (b.favoritedAt || 0) - (a.favoritedAt || 0)).slice(0, 14), [books]);
  const ctry = useMemo(() => { const m = new Map<string, number>(); books.forEach((b) => b.countries.forEach((c) => m.set(c, (m.get(c) || 0) + 1))); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [books]);
  const gen = useMemo(() => { const m = new Map<string, number>(); books.forEach((b) => b.genres.forEach((g) => m.set(g, (m.get(g) || 0) + 1))); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14); }, [books]);
  const chip = 'inline-flex min-h-[36px] items-center gap-2 rounded-full border border-line bg-card px-3 text-sm hover:border-forest/40';
  return (
    <>
      {opened.length > 0 && <section className="mb-10"><SectionHeader title={t('home.opened')} /><Shelf books={opened} /></section>}
      {done.length > 0 && <section className="mb-10"><SectionHeader title={t('home.completed')} /><Shelf books={done} /></section>}
      {favs.length > 0 && <section className="mb-10"><SectionHeader title={t('home.favBooks')} action={<Button variant="ghost" size="sm" onClick={() => s.navigate({ name: 'favorites' })}>{t('seeAll')}</Button>} /><Shelf books={favs} /></section>}
      {favAuthors.length > 0 && (
        <section className="mb-10"><SectionHeader title={t('fav.authors')} />
          <div className="flex flex-wrap gap-2">{favAuthors.map((a) => <button key={a.name} type="button" className={chip + ' ps-1'} onClick={() => s.navigate({ name: 'author', id: a.name })}><Monogram name={a.name} portrait={a.meta?.portrait} size={28} /><span dir="auto">{a.name}</span></button>)}</div>
        </section>
      )}
      <section className="mb-10"><SectionHeader title={t('home.exploreCountries')} action={<Button variant="ghost" size="sm" onClick={() => s.navigate({ name: 'map' })}><MapIcon size={15} />{t('nav.map')}</Button>} />
        <div className="flex flex-wrap gap-2">
          {(ctry.length ? ctry.slice(0, 12).map(([c, n]) => ({ c, n })) : allCountries.slice(0, 8).map((c) => ({ c: c.id, n: 0 }))).map(({ c, n }) => { const co = countryById(c); return co ? <button key={c} type="button" className={chip} onClick={() => s.navigate({ name: 'country', id: c })}><span aria-hidden="true">{co.flag}</span>{co.lit[lang]}{n ? <span className="text-muted">{fmtNum(lang, n)}</span> : null}</button> : null; })}
        </div>
      </section>
      {gen.length > 0 && (
        <section className="mb-10"><SectionHeader title={t('home.exploreGenres')} />
          <div className="flex flex-wrap gap-2">{gen.map(([g, n]) => <button key={g} type="button" className={chip} onClick={() => s.navigate({ name: 'genre', id: g })}>{genreLabel(g, lang)}<span className="text-muted">{fmtNum(lang, n)}</span></button>)}</div>
        </section>
      )}
      {cols.length > 0 && (
        <section className="mb-10"><SectionHeader title={t('home.myCollections')} action={<Button variant="ghost" size="sm" onClick={() => s.navigate({ name: 'collections' })}>{t('seeAll')}</Button>} />
          <div className="flex flex-wrap gap-2">{cols.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)).slice(0, 12).map((c) => <button key={c.id} type="button" className={chip} onClick={() => s.navigate({ name: 'collection', id: c.id })}><Layers size={14} style={{ color: c.color }} /><span dir="auto">{c.name}</span></button>)}</div>
        </section>
      )}
    </>
  );
}

function Hero({ stats, goal }: { stats?: { icon: React.ReactNode; label: string; value: string }[]; goal?: ReturnType<typeof goalProgress> }) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="paper-grain relative mb-10 overflow-hidden rounded-3xl bg-[#2f4f3e] px-6 py-8 text-[#f6f1e7] dark:bg-[#22382c] sm:px-10 sm:py-10">
      <div className="watermark -bottom-8 end-4 !text-[#f6f1e7]/[0.07]" style={{ fontSize: 110 }} aria-hidden="true">{t('brand')}</div>
      <svg className="absolute -top-6 end-6 hidden opacity-20 sm:block" width="220" height="160" viewBox="0 0 220 160" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={20 + i * 26} y={40 + (i % 3) * 12} width="20" height={120 - (i % 3) * 12} rx="2" fill="currentColor" opacity={0.4 + (i % 3) * 0.2} />)}
        <rect x="10" y="158" width="200" height="2" fill="currentColor" />
      </svg>
      <div className="relative">
        <div className="mb-1 text-sm opacity-80">{fmtDate(lang, Date.now(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <h1 className="max-w-xl text-[34px] font-semibold leading-tight sm:text-[46px]">{t('home.welcome')}</h1>
        {stats && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((x) => (
              <div key={x.label} className="rounded-2xl bg-[#f6f1e7]/10 px-4 py-3">
                <div className="flex items-center gap-1.5 text-xs opacity-80">{x.icon}{x.label}</div>
                <div className="serif mt-0.5 text-2xl font-semibold">{x.value}</div>
              </div>
            ))}
          </div>
        )}
        {goal && (
          <div className="mt-4 flex items-center gap-3 text-sm">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[#f6f1e7]/20"><div className="h-full rounded-full bg-[#c9a46b]" style={{ width: `${goal.ratio * 100}%` }} /></div>
            <span className="opacity-90">{t('home.goal')}: {goal.met ? t('home.goalMet') : `${fmtNum(lang, goal.done)} / ${fmtNum(lang, goal.target)}`}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DailyCard({ goal, today, streak, week, maxW, unit }: { goal: ReturnType<typeof goalProgress>; today?: { seconds: number; pages: number; chapters: number }; streak: number; week: { d: Date; m: number }[]; maxW: number; unit: string }) {
  const t = useT();
  const lang = useLang();
  return (
    <Card className="relative overflow-hidden">
      <h2 className="mb-4 text-lg font-semibold">{t('home.daily')}</h2>
      <div className="flex items-center gap-4">
        <Ring value={goal.ratio} size={84} stroke={7}><span className="text-center leading-tight">{fmtNum(lang, goal.done)}<span className="block text-[10px] font-normal text-muted">/ {fmtNum(lang, goal.target)}</span></span></Ring>
        <div className="text-sm">
          <div className="font-semibold">{goal.met ? t('home.goalMet') : t('home.goalLeft', { n: `${fmtNum(lang, Math.max(0, goal.target - goal.done))} ${unit}` })}</div>
          <div className="mt-1 text-muted">{t('home.minutesToday')}: {fmtNum(lang, Math.round((today?.seconds || 0) / 60))}</div>
          <div className="text-muted">{t('home.pagesToday')}: {fmtNum(lang, today?.pages || 0)}</div>
          <div className="flex items-center gap-1 text-muted"><Flame size={14} className="text-wine" />{t('home.streak')}: {fmtNum(lang, streak)}</div>
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 text-xs text-muted">{t('home.week')}</div>
        <div className="flex h-20 items-end gap-2">
          {week.map((w, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-14 w-full items-end"><div className={`w-full rounded-t ${w.m ? 'bg-forest' : 'bg-line'}`} style={{ height: `${Math.max(6, (w.m / maxW) * 100)}%` }} title={`${w.m} ${t('min')}`} /></div>
              <span className="text-[10px] text-muted">{w.d.toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { weekday: 'narrow' })}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Inspiration() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const ann = useAnnotations();
  const books = s.books;
  const quotes = useMemo(() => {
    const hl = ann.filter((a) => a.kind === 'highlight' && a.text && a.text.length > 20 && a.text.length < 600 && books[a.bookId] && !books[a.bookId].deleted);
    const fav = hl.filter((a) => a.favoriteQuote);
    return fav.length >= 3 ? fav : hl;
  }, [ann, books]);
  const seed = Math.floor(Date.now() / 86400000);
  const [offset, setOffset] = useState(0);
  const items = [...quotes.map((q) => ({ type: 'quote' as const, q })), ...PROMPTS.map((p) => ({ type: 'prompt' as const, p }))];
  const pick = quotes.length ? (offset % 3 === 2 ? items[quotes.length + ((seed + offset) % PROMPTS.length)] : items[(seed + offset) % quotes.length]) : items[(seed + offset) % PROMPTS.length];
  return (
    <Card className="relative overflow-hidden bg-paper/60">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('home.inspiration')}</h2>
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-line/60" aria-label={t('next')} onClick={() => setOffset(offset + 1)}><RefreshCw size={16} /></button>
      </div>
      {pick.type === 'quote' ? (
        <figure>
          <Quote size={22} className="mb-2 text-wine/60" />
          <blockquote className="serif text-[17px] leading-relaxed" dir="auto">{pick.q.text}</blockquote>
          <figcaption className="mt-3 text-sm text-muted">
            <button type="button" className="hover:underline" dir="auto" onClick={() => s.navigate({ name: 'book', id: pick.q.bookId })}>— {books[pick.q.bookId]?.authors[0] ? books[pick.q.bookId].authors[0] + '، ' : ''}{books[pick.q.bookId]?.title}</button>
            <span className="block text-xs">{t('insp.fromHighlights')}</span>
          </figcaption>
        </figure>
      ) : (
        <div>
          <Sparkles size={20} className="mb-2 text-[#c9a46b]" />
          <p className="serif text-[17px] leading-relaxed">{pick.p[lang]}</p>
          <p className="mt-3 text-xs text-muted">{t('insp.prompt')} · {t('insp.generated')}</p>
          {!quotes.length && <p className="mt-2 text-xs text-muted">{t('insp.empty')}</p>}
        </div>
      )}
    </Card>
  );
}

function Activity() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const books = useBooks();
  const sessions = useSessions();
  const ann = useAnnotations();
  const events = useMemo(() => {
    const ev: { ts: number; icon: React.ReactNode; text: string; book?: Book }[] = [];
    for (const b of books) {
      ev.push({ ts: b.addedAt, icon: <BookPlus size={14} />, text: t('act.added'), book: b });
      if (b.completedAt) ev.push({ ts: b.completedAt, icon: <CheckCircle2 size={14} />, text: t('act.completed'), book: b });
      if (b.favorite && b.favoritedAt) ev.push({ ts: b.favoritedAt, icon: <Heart size={14} />, text: t('act.favorited'), book: b });
    }
    for (const x of sessions) if (s.books[x.bookId]) ev.push({ ts: x.end, icon: <Clock size={14} />, text: `${t('act.session')} · ${Math.max(1, Math.round(x.seconds / 60))} ${t('min')}`, book: s.books[x.bookId] });
    for (const a of ann) if (a.note && s.books[a.bookId]) ev.push({ ts: a.createdAt, icon: <PenLine size={14} />, text: t('act.note'), book: s.books[a.bookId] });
    // collapse bulk imports
    ev.sort((a, b) => b.ts - a.ts);
    const out: typeof ev = [];
    for (const e of ev) {
      const prev = out[out.length - 1];
      if (prev && prev.text === e.text && e.text === t('act.added') && Math.abs(prev.ts - e.ts) < 120000) continue;
      out.push(e);
      if (out.length >= 9) break;
    }
    return out;
  }, [books, sessions, ann, lang]);
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">{t('home.activity')}</h2>
      <ol className="relative border-s border-line ps-4">
        {events.map((e, i) => (
          <li key={i} className="mb-3 last:mb-0">
            <span className="absolute -start-[9px] mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card text-forest">{e.icon}</span>
            <button type="button" className="flex w-full items-center gap-3 text-start" onClick={() => e.book && s.navigate({ name: 'book', id: e.book.id })}>
              {e.book && <BookCover book={e.book} size="sm" className="w-7 shrink-0" />}
              <span className="min-w-0 text-sm"><span className="text-muted">{e.text}</span> <span className="line-clamp-1 font-medium" dir="auto">{e.book?.title}</span>
                <span className="block text-xs text-muted">{fmtDate(lang, e.ts, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function recommend(books: Book[]): Book[] {
  const liked = books.filter((b) => b.favorite || b.status === 'completed' || (b.rating || 0) >= 4 || b.status === 'reading');
  const w = { genre: new Map<string, number>(), author: new Map<string, number>(), country: new Map<string, number>() };
  for (const b of liked) {
    const k = b.favorite || (b.rating || 0) >= 4 ? 2 : 1;
    b.genres.forEach((g) => w.genre.set(g, (w.genre.get(g) || 0) + k));
    b.authors.forEach((a) => w.author.set(a, (w.author.get(a) || 0) + 2 * k));
    b.countries.forEach((c) => w.country.set(c, (w.country.get(c) || 0) + k));
  }
  const seed = Math.floor(Date.now() / 86400000);
  const cands = books.filter((b) => b.status === 'unread' || b.status === 'want');
  return cands
    .map((b) => {
      let sc = (b.status === 'want' ? 3 : 0) + ((b.id.charCodeAt(b.id.length - 1) + seed) % 7) / 10;
      b.genres.forEach((g) => (sc += w.genre.get(g) || 0));
      b.authors.forEach((a) => (sc += w.author.get(a) || 0));
      b.countries.forEach((c) => (sc += w.country.get(c) || 0));
      return { b, sc };
    })
    .sort((a, b) => b.sc - a.sc)
    .map((x) => x.b);
}
