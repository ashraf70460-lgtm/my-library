import { useMemo, useState } from 'react';
import { Award, Lock } from 'lucide-react';
import { useStore, useT, useLang, useBooks, useSessions, useAnnotations, useJournal } from '../store';
import { Card, ProgressBar, SectionHeader, Stat } from '../components/ui';
import { BookCover } from '../components/books';
import { byDay, dayKey, addDays, streaks } from '../lib/stats';
import { genreLabel } from '../lib/genres';
import { countryById, countryName, continentOf } from '../lib/world';
import { fmtDuration, fmtNum } from '../i18n';

/** Weekly minutes and monthly books goals (off until set). */
export function Goals() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const sessions = useSessions();
  const books = useBooks();
  const wk = s.settings.weeklyGoal || 0, mo = s.settings.monthlyGoal || 0;
  const days = useMemo(() => byDay(sessions), [sessions]);
  const now = new Date();
  // week starts on Saturday in Arabic locales, Monday otherwise
  const startDay = lang === 'ar' ? 6 : 1;
  const back = (now.getDay() - startDay + 7) % 7;
  let weekMin = 0;
  for (let i = 0; i <= back; i++) weekMin += (days.get(dayKey(addDays(now, -i)))?.seconds || 0) / 60;
  const monthBooks = books.filter((b) => b.completedAt && new Date(b.completedAt).getFullYear() === now.getFullYear() && new Date(b.completedAt).getMonth() === now.getMonth()).length;
  const row = (label: string, done: number, target: number, unit: string, set: (n: number) => void) => (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input className="field !min-h-[34px] !w-20 !py-1 text-center" type="number" min={0} value={target || ''} placeholder="—" onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} aria-label={label} />{unit}
        </label>
      </div>
      {target > 0 ? <>
        <ProgressBar value={Math.min(1, done / target)} />
        <div className="mt-1.5 text-sm text-muted">{done >= target ? t('home.goalMet') : `${fmtNum(lang, Math.round(done))} / ${fmtNum(lang, target)} ${unit}`}</div>
      </> : <div className="text-sm text-muted">{t('goal2.off')}</div>}
    </div>
  );
  return (
    <section className="mb-8">
      <SectionHeader title={t('goal2.title')} />
      <div className="grid gap-3 sm:grid-cols-2">
        {row(t('goal2.week'), weekMin, wk, t('minutes'), (n) => s.setSettings({ weeklyGoal: n }))}
        {row(t('goal2.month'), monthBooks, mo, t('goal2.books'), (n) => s.setSettings({ monthlyGoal: n }))}
      </div>
    </section>
  );
}

/** Achievement badges, computed from what is already in the library. */
export function Badges() {
  const t = useT();
  const lang = useLang();
  const books = useBooks();
  const sessions = useSessions();
  const ann = useAnnotations();
  const journal = useJournal();
  const list = useMemo(() => {
    const done = books.filter((b) => b.status === 'completed');
    const st = streaks(byDay(sessions));
    const ctry = new Set(done.flatMap((b) => b.countries));
    const conts = new Set([...ctry].map((c) => continentOf(c)).filter(Boolean));
    const hours = sessions.reduce((a, x) => a + x.seconds, 0) / 3600;
    const hl = ann.filter((a) => a.kind === 'highlight').length;
    const tiers = (key: string, have: number, steps: number[]) => steps.map((n) => ({ id: `${key}-${n}`, label: t(`badge.${key}`, { n }), have, need: n }));
    return [
      ...tiers('books', done.length, [1, 5, 10, 25, 50, 100]),
      ...tiers('streak', st.longest, [7, 30, 100]),
      ...tiers('countries', ctry.size, [3, 10, 20]),
      ...tiers('continents', conts.size, [3, 5]),
      ...tiers('hours', Math.floor(hours), [10, 50, 100, 250]),
      ...tiers('highlights', hl, [10, 100]),
      ...tiers('journal', journal.length, [1, 10]),
    ];
  }, [books, sessions, ann, journal, lang]);
  const earned = list.filter((b) => b.have >= b.need).length;
  return (
    <section className="mb-8">
      <SectionHeader title={`${t('badge.title')} · ${fmtNum(lang, earned)} / ${fmtNum(lang, list.length)}`} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {list.map((b) => {
          const ok = b.have >= b.need;
          return (
            <div key={b.id} className={`flex items-center gap-3 rounded-xl border p-3 ${ok ? 'border-[#c9a46b]/60 bg-[#c9a46b]/10' : 'border-line bg-card opacity-70'}`} title={ok ? '' : `${fmtNum(lang, b.have)} / ${fmtNum(lang, b.need)}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-[#c9a46b] text-[#23211e]' : 'bg-line text-muted'}`}>{ok ? <Award size={18} /> : <Lock size={15} />}</span>
              <span className="min-w-0 text-sm leading-tight">{b.label}{!ok && <span className="block text-xs text-muted">{fmtNum(lang, Math.min(b.have, b.need))} / {fmtNum(lang, b.need)}</span>}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A year in reading: everything is counted from your own sessions and finished books. */
export function AnnualReport() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const books = useBooks();
  const sessions = useSessions();
  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    sessions.forEach((x) => ys.add(new Date(x.start).getFullYear()));
    books.forEach((b) => b.completedAt && ys.add(new Date(b.completedAt).getFullYear()));
    return [...ys].sort((a, b) => b - a);
  }, [books, sessions]);
  const [year, setYear] = useState(years[0]);
  const r = useMemo(() => {
    const ss = sessions.filter((x) => new Date(x.start).getFullYear() === year);
    const done = books.filter((b) => b.completedAt && new Date(b.completedAt).getFullYear() === year).sort((a, b) => a.completedAt! - b.completedAt!);
    const secs = ss.reduce((a, x) => a + x.seconds, 0);
    const pages = ss.reduce((a, x) => a + x.pages, 0);
    const dayCount = new Set(ss.filter((x) => x.seconds >= 60).map((x) => x.day)).size;
    const top = (f: (b: typeof done[number]) => string[]) => { const m = new Map<string, number>(); done.forEach((b) => f(b).forEach((k) => m.set(k, (m.get(k) || 0) + 1))); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; };
    const months = [...Array(12)].map((_, i) => done.filter((b) => new Date(b.completedAt!).getMonth() === i).length);
    const longest = [...done].sort((a, b) => (b.pages || 0) - (a.pages || 0))[0];
    const ctry = new Set(done.flatMap((b) => b.countries));
    const perBook = new Map<string, number>(); ss.forEach((x) => perBook.set(x.bookId, (perBook.get(x.bookId) || 0) + x.seconds));
    const mostTime = [...perBook.entries()].sort((a, b) => b[1] - a[1])[0];
    return { done, secs, pages, dayCount, author: top((b) => b.authors), genre: top((b) => b.genres), country: top((b) => b.countries), months, longest, ctry, mostTime };
  }, [year, books, sessions]);
  const maxM = Math.max(1, ...r.months);
  const mostBook = r.mostTime ? s.books[r.mostTime[0]] : undefined;
  return (
    <section className="mb-8">
      <SectionHeader title={t('report.title')} action={years.length > 1 ? (
        <select className="field !min-h-[34px] !w-auto !rounded-full !py-1 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('report.year')}>{years.map((y) => <option key={y} value={y}>{fmtNum(lang, y).replace(/[,٬]/g, '')}</option>)}</select>
      ) : undefined} />
      <Card>
        {!r.done.length && !r.secs ? <p className="text-muted">{t('report.empty')}</p> : <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t('report.finished')} value={fmtNum(lang, r.done.length)} />
            <Stat label={t('stats.time')} value={fmtDuration(lang, r.secs)} />
            <Stat label={t('stats.pages')} value={fmtNum(lang, r.pages)} />
            <Stat label={t('report.days')} value={fmtNum(lang, r.dayCount)} />
          </div>
          <div className="mb-6">
            <div className="mb-2 text-sm text-muted">{t('report.byMonth')}</div>
            <div className="flex h-24 items-end gap-1.5">
              {r.months.map((n, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-16 w-full items-end"><div className={`w-full rounded-t ${n ? 'bg-forest' : 'bg-line'}`} style={{ height: `${Math.max(5, (n / maxM) * 100)}%` }} title={String(n)} /></div>
                  <span className="text-[10px] text-muted">{new Date(year, i, 1).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en', { month: 'narrow' })}</span>
                </div>
              ))}
            </div>
          </div>
          <dl className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
            {r.author && <div><dt className="text-muted">{t('report.topAuthor')}</dt><dd><button type="button" className="font-medium hover:underline" dir="auto" onClick={() => s.navigate({ name: 'author', id: r.author! })}>{r.author}</button></dd></div>}
            {r.genre && <div><dt className="text-muted">{t('report.topGenre')}</dt><dd className="font-medium">{genreLabel(r.genre, lang)}</dd></div>}
            {r.country && <div><dt className="text-muted">{t('report.topCountry')}</dt><dd className="font-medium">{countryById(r.country)?.flag} {countryName(r.country, lang)}</dd></div>}
            {r.ctry.size > 0 && <div><dt className="text-muted">{t('report.countries')}</dt><dd className="font-medium">{fmtNum(lang, r.ctry.size)}</dd></div>}
            {r.longest?.pages && <div><dt className="text-muted">{t('report.longest')}</dt><dd className="font-medium" dir="auto">{r.longest.title} · {t('pages.count', { n: r.longest.pages })}</dd></div>}
            {mostBook && <div><dt className="text-muted">{t('report.mostTime')}</dt><dd className="font-medium" dir="auto">{mostBook.title} · {fmtDuration(lang, r.mostTime![1])}</dd></div>}
          </dl>
          {r.done.length > 0 && <div className="flex flex-wrap gap-2">{r.done.map((b) => <button key={b.id} type="button" onClick={() => s.navigate({ name: 'book', id: b.id })} title={b.title}><BookCover book={b} size="sm" className="w-11" /></button>)}</div>}
        </>}
      </Card>
    </section>
  );
}
