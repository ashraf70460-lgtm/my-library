import { useMemo, useState } from 'react';
import { Plus, Trash2, Trophy, Check } from 'lucide-react';
import { useStore, useT, useLang, useBooks, useSessions, useChallenges, uid } from '../store';
import { Button, Card, EmptyState, Field, Modal, PageTitle, ProgressBar, SectionHeader, Stat } from '../components/ui';
import { byDay, dayKey, addDays, streaks, challengeProgress } from '../lib/stats';
import { genreLabel } from '../lib/genres';
import { countries, countryName } from '../lib/world';
import { fmtDuration, fmtNum } from '../i18n';
import type { Challenge } from '../types';
import { Goals, Badges, AnnualReport } from './StatsExtra';

export default function StatsPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const books = useBooks();
  const sessions = useSessions();
  const days = useMemo(() => byDay(sessions), [sessions]);
  const st = useMemo(() => streaks(days), [days]);
  const totalSec = sessions.reduce((a, x) => a + x.seconds, 0);
  const totalPages = sessions.reduce((a, x) => a + x.pages, 0);
  const count = (status: string) => books.filter((b) => b.status === status).length;
  const completed = books.filter((b) => b.status === 'completed' && b.completedAt);
  const firstMonth = completed.length ? Math.min(...completed.map((b) => b.completedAt!)) : Date.now();
  const months = Math.max(1, (Date.now() - firstMonth) / (30.4 * 86400000));
  const now = new Date();
  const monthDays = [...days.entries()].filter(([k, v]) => k.startsWith(dayKey(now).slice(0, 7)) && v.seconds >= 60).length;

  const secByBook = useMemo(() => { const m = new Map<string, number>(); for (const x of sessions) m.set(x.bookId, (m.get(x.bookId) || 0) + x.seconds); return m; }, [sessions]);
  const weigh = (key: (b: typeof books[number]) => string[]) => {
    const m = new Map<string, number>();
    for (const b of books) {
      const w = (b.status === 'completed' ? 3 : 0) + (b.favorite ? 2 : 0) + (secByBook.get(b.id) || 0) / 1800 + (b.status === 'reading' ? 1 : 0);
      if (!w) continue;
      for (const k of key(b)) m.set(k, (m.get(k) || 0) + w);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  const favGenres = weigh((b) => b.genres);
  const favAuthors = weigh((b) => b.authors);
  const byCountry = useMemo(() => { const m = new Map<string, number>(); for (const b of books) if (b.status === 'completed' || b.status === 'reading') for (const c of b.countries) m.set(c, (m.get(c) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [books]);
  const decades = useMemo(() => { const m = new Map<number, number>(); for (const b of books) { const y = Number(b.year); if (y && (b.status === 'completed' || b.status === 'reading')) { const d = Math.floor(y / 10) * 10; m.set(d, (m.get(d) || 0) + 1); } } return [...m.entries()].sort((a, b) => a[0] - b[0]); }, [books]);

  if (!books.length && !sessions.length) return <div><PageTitle title={t('stats.title')} /><EmptyState title={t('stats.empty')} /></div>;

  return (
    <div>
      <PageTitle title={t('stats.title')} />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t('stats.owned')} value={fmtNum(lang, books.length)} />
        <Stat label={t('stats.read')} value={fmtNum(lang, count('completed'))} />
        <Stat label={t('stats.reading')} value={fmtNum(lang, count('reading'))} />
        <Stat label={t('stats.unread')} value={fmtNum(lang, count('unread') + count('want'))} />
        <Stat label={t('stats.onhold')} value={fmtNum(lang, count('onhold'))} />
        <Stat label={t('stats.abandoned')} value={fmtNum(lang, count('abandoned'))} />
        <Stat label={t('stats.time')} value={fmtDuration(lang, totalSec)} />
        <Stat label={t('stats.pages')} value={fmtNum(lang, totalPages)} />
        <Stat label={t('stats.avgDay')} value={fmtDuration(lang, st.totalDays ? totalSec / st.totalDays : 0)} />
        <Stat label={t('stats.avgMonth')} value={fmtNum(lang, Math.round((completed.length / months) * 10) / 10)} />
        <Stat label={t('stats.streak')} value={`${fmtNum(lang, st.current)} ${t('home.days')}`} sub={`${t('stats.longest')}: ${fmtNum(lang, st.longest)}`} />
        <Stat label={t('stats.month')} value={fmtNum(lang, monthDays)} sub={`${t('stats.totalDays')}: ${fmtNum(lang, st.totalDays)}`} />
      </div>

      <Goals />
      <Card className="relative mb-8 overflow-hidden">
        <h2 className="mb-4 text-lg font-semibold">{t('stats.heatmap')}</h2>
        <Heatmap days={days} />
      </Card>

      <Card className="mb-8"><h2 className="mb-4 text-lg font-semibold">{t('stats.weekly')}</h2><DailyBars days={days} /></Card>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Bars title={t('stats.genres')} rows={favGenres.map(([k, v]) => [genreLabel(k, lang), v, () => s.navigate({ name: 'genre', id: k })])} />
        <Bars title={t('stats.authors')} rows={favAuthors.map(([k, v]) => [k, v, () => s.navigate({ name: 'author', id: k })])} />
        <Bars title={t('stats.countries')} rows={byCountry.map(([k, v]) => [countryName(k, lang), v, () => s.navigate({ name: 'country', id: k })])} integer />
        <Bars title={t('stats.decades')} rows={decades.map(([k, v]) => [`${k}–${k + 9}`, v])} integer />
      </div>

      <AnnualReport />
      <Badges />
      <Challenges />
    </div>
  );
}

function Bars({ title, rows, integer }: { title: string; rows: [string, number, (() => void)?][]; integer?: boolean }) {
  const t = useT();
  const lang = useLang();
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {!rows.length ? <p className="text-sm text-muted">{t('stats.noData')}</p> : (
        <div className="flex flex-col gap-2.5">
          {rows.map(([label, v, go]) => (
            <button key={label} type="button" disabled={!go} onClick={go} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-start text-sm">
              <span className="truncate" dir="auto">{label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-line/60"><span className="block h-full rounded-full bg-forest" style={{ width: `${(v / max) * 100}%` }} /></span>
              <span className="w-8 text-end tabular-nums text-muted">{integer ? fmtNum(lang, v) : ''}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function Heatmap({ days }: { days: Map<string, { seconds: number }> }) {
  const t = useT();
  const lang = useLang();
  const end = new Date();
  const start = addDays(end, -7 * 52 - end.getDay());
  const weeks: Date[][] = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (!weeks.length || d.getDay() === 0) weeks.push([]);
    weeks[weeks.length - 1].push(new Date(d));
  }
  const level = (sec: number) => (sec < 60 ? 0 : sec < 900 ? 1 : sec < 1800 ? 2 : sec < 3600 ? 3 : 4);
  const colors = ['rgb(var(--c-line) / .6)', 'rgb(var(--c-forest) / .3)', 'rgb(var(--c-forest) / .55)', 'rgb(var(--c-forest) / .8)', 'rgb(var(--c-forest))'];
  return (
    <div>
      <div className="no-scrollbar overflow-x-auto" dir="ltr">
        <div className="flex gap-[3px]" style={{ minWidth: weeks.length * 14 }}>
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {w.map((d) => { const v = days.get(dayKey(d))?.seconds || 0; return <div key={d.toISOString()} className="h-[11px] w-[11px] rounded-[2px]" style={{ background: colors[level(v)] }} title={`${d.toLocaleDateString(lang)} · ${Math.round(v / 60)} ${t('min')}`} />; })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted">{t('stats.less')}{colors.map((c) => <span key={c} className="h-[11px] w-[11px] rounded-[2px]" style={{ background: c }} />)}{t('stats.more')}</div>
    </div>
  );
}

function DailyBars({ days }: { days: Map<string, { seconds: number }> }) {
  const lang = useLang();
  const t = useT();
  const data = [...Array(56)].map((_, i) => { const d = addDays(new Date(), i - 55); return { d, m: Math.round((days.get(dayKey(d))?.seconds || 0) / 60) }; });
  const max = Math.max(10, ...data.map((x) => x.m));
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]" dir="ltr">
        {data.map((x) => <div key={x.d.toISOString()} className="flex-1 rounded-t-sm bg-forest/80" style={{ height: `${Math.max(x.m ? 4 : 1, (x.m / max) * 100)}%`, opacity: x.m ? 1 : 0.25 }} title={`${x.d.toLocaleDateString(lang)} · ${x.m} ${t('min')}`} />)}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted" dir="ltr"><span>{data[0].d.toLocaleDateString(lang, { month: 'short', day: 'numeric' })}</span><span>{fmtNum(lang, max)} {t('min')} ↑</span><span>{t('today')}</span></div>
    </div>
  );
}

const PRESETS: { kind: Challenge['kind']; target: number; param?: string }[] = [
  { kind: 'books', target: 12 }, { kind: 'minutes-streak', target: 7, param: '30' }, { kind: 'countries', target: 5 },
  { kind: 'continents', target: 6 }, { kind: 'same-author', target: 3 }, { kind: 'country', target: 3, param: 'ru' }, { kind: 'classic', target: 1 },
];

export function challengeTitle(c: { kind: Challenge['kind']; target: number; param?: string; title?: string }, t: (k: string, v?: any) => string, lang: 'en' | 'ar') {
  if (c.title) return c.title;
  switch (c.kind) {
    case 'books': return t('ch.books', { n: c.target });
    case 'minutes-streak': return t('ch.streak', { n: Number(c.param || 30) });
    case 'countries': return t('ch.countries', { n: c.target });
    case 'continents': return t('ch.continents');
    case 'same-author': return t('ch.sameAuthor', { n: c.target });
    case 'country': return t('ch.country', { c: countryName(c.param || '', lang), n: c.target });
    case 'classic': return t('ch.classic');
    default: return t('ch.custom');
  }
}

function Challenges() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const list = useChallenges();
  const books = useBooks();
  const sessions = useSessions();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<{ kind: Challenge['kind']; target: number; param?: string; title?: string }>(PRESETS[0]);
  return (
    <section>
      <SectionHeader title={t('stats.challenges')} action={<Button size="sm" onClick={() => setOpen(true)}><Plus size={14} />{t('stats.newChallenge')}</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.filter((p) => !list.some((c) => c.kind === p.kind && c.param === p.param)).map((p) => (
          <button key={p.kind + (p.param || '')} type="button" className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm hover:bg-paper" onClick={() => s.upsert('challenges', { id: uid('ch'), updatedAt: Date.now(), createdAt: Date.now(), year: new Date().getFullYear(), title: '', ...p })}>
            <Plus size={12} className="me-1 inline" />{challengeTitle(p, t, lang)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((c) => {
          const done = challengeProgress(c, books, sessions);
          const ok = done >= c.target;
          return (
            <Card key={c.id} className="!p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-forest text-ivory' : 'bg-paper text-muted'}`}>{ok ? <Check size={18} /> : <Trophy size={18} />}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{challengeTitle(c, t, lang)}</div>
                  <div className="mb-2 text-sm text-muted">{fmtNum(lang, Math.min(done, c.target))} / {fmtNum(lang, c.target)}{ok ? ` · ${t('ch.complete')}` : ''}</div>
                  <ProgressBar value={done / c.target} />
                  <div className="mt-2 flex gap-1">
                    {c.kind === 'custom' && !ok && <Button size="sm" variant="ghost" onClick={() => s.upsert('challenges', { ...c, manualDone: (c.manualDone || 0) + 1 })}>{t('ch.markOne')}</Button>}
                    <button type="button" aria-label={t('delete')} className="ms-auto flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-paper" onClick={() => s.remove('challenges', c.id)}><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t('stats.newChallenge')} footer={<Button variant="primary" onClick={() => { s.upsert('challenges', { id: uid('ch'), updatedAt: Date.now(), createdAt: Date.now(), year: new Date().getFullYear(), title: v.kind === 'custom' ? v.title || t('ch.custom') : '', ...v }); setOpen(false); }}>{t('create')}</Button>}>
        <Field label={t('ch.kind')}>
          <select className="field" value={v.kind} onChange={(e) => { const p = PRESETS.find((x) => x.kind === e.target.value); setV(p ? { ...p } : { kind: 'custom', target: 5, title: '' }); }}>
            {PRESETS.map((p) => <option key={p.kind} value={p.kind}>{challengeTitle({ ...p, target: p.target }, t, lang)}</option>)}
            <option value="custom">{t('ch.custom')}</option>
          </select>
        </Field>
        {v.kind === 'custom' && <Field label={t('ch.title')}><input className="field" value={v.title || ''} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>}
        {v.kind === 'country' && <Field label={t('f.country')}><select className="field" value={v.param} onChange={(e) => setV({ ...v, param: e.target.value })}>{countries.map((c) => <option key={c.id} value={c.id}>{c.lit[lang]}</option>)}</select></Field>}
        {v.kind === 'minutes-streak' && <Field label={t('goal.minutes')}><input className="field" type="number" min={5} value={v.param} onChange={(e) => setV({ ...v, param: e.target.value })} /></Field>}
        <Field label={t('ch.target')}><input className="field" type="number" min={1} value={v.target} onChange={(e) => setV({ ...v, target: Math.max(1, Number(e.target.value)) })} /></Field>
      </Modal>
    </section>
  );
}
