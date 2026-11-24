import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useStore, useT, useLang, useBooks } from '../store';
import { countries, countryById, overviews, regions, continents } from '../lib/world';
import { Button, Card, EmptyState, PageTitle, ProgressBar, SectionHeader, Watermark } from '../components/ui';
import { BookCover } from '../components/books';
import { BookBrowser } from '../components/BookBrowser';
import { askClaude } from '../lib/claude';
import { fmtNum } from '../i18n';
import { lsGet, lsSet } from '../lib/storage';

export function WorldPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const books = useBooks();
  const [region, setRegion] = useState<string>('');
  const byCountry = useMemo(() => {
    const m = new Map<string, typeof books>();
    for (const b of books) for (const c of b.countries) { if (!m.has(c)) m.set(c, []); m.get(c)!.push(b); }
    return m;
  }, [books]);
  const unassigned = books.filter((b) => !b.countries.length).length;
  const regionCount = (rid: string) => new Set(countries.filter((c) => c.regions.includes(rid as any)).flatMap((c) => byCountry.get(c.id) || []).map((b) => b.id)).size;
  const list = countries.filter((c) => (!region || c.regions.includes(region as any)) && (byCountry.get(c.id)?.length || overviews[c.id]));
  return (
    <div>
      <PageTitle title={t('world.title')} sub={t('world.sub')} />
      {!byCountry.size && <div className="mb-8"><EmptyState title={t('world.empty')} actions={<Button variant="primary" onClick={() => s.navigate({ name: 'books' })}>{t('nav.books')}</Button>} /></div>}
      <SectionHeader title={t('world.regions')} />
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {continents.map((co) => (
          <div key={co.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="serif mb-2 text-lg font-semibold">{co[lang]}</div>
            <div className="flex flex-col gap-1">
              {regions.filter((r) => r.continent === co.id).map((r) => (
                <button key={r.id} type="button" onClick={() => setRegion(region === r.id ? '' : r.id)} className={`flex min-h-[34px] items-center justify-between rounded-lg px-2 text-start text-sm ${region === r.id ? 'bg-forest text-ivory' : 'hover:bg-paper'}`}>
                  <span>{r[lang]}</span><span className="opacity-70">{fmtNum(lang, regionCount(r.id))}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <SectionHeader title={t('world.countries')} action={region ? <Button size="sm" variant="ghost" onClick={() => setRegion('')}>{t('clear')}</Button> : undefined} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.sort((a, b) => (byCountry.get(b.id)?.length || 0) - (byCountry.get(a.id)?.length || 0)).map((c) => {
          const bs = byCountry.get(c.id) || [];
          const done = bs.filter((b) => b.status === 'completed').length;
          return (
            <button key={c.id} type="button" onClick={() => s.navigate({ name: 'country', id: c.id })} className="relative overflow-hidden rounded-2xl border border-line bg-card p-4 text-start hover:border-forest/40">
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden="true">{c.flag}</span>
                <div className="min-w-0 flex-1"><div className="serif truncate text-lg font-semibold">{c.lit[lang]}</div><div className="text-sm text-muted">{t('books.count', { n: bs.length })}</div></div>
              </div>
              {bs.length > 0 && <div className="mt-3 flex gap-1.5">{bs.slice(0, 5).map((b) => <BookCover key={b.id} book={b} size="sm" className="w-9" />)}</div>}
              {bs.length > 0 && <ProgressBar value={done / bs.length} className="mt-3" />}
            </button>
          );
        })}
      </div>
      {unassigned > 0 && (
        <Card className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <span>{t('world.unassigned')}: <b>{fmtNum(lang, unassigned)}</b></span>
          <Button size="sm" onClick={() => s.navigate({ name: 'books' })}>{t('world.assign')}</Button>
        </Card>
      )}
    </div>
  );
}

export function CountryPage({ id }: { id: string }) {
  const t = useT();
  const lang = useLang();
  const co = countryById(id);
  const books = useBooks().filter((b) => b.countries.includes(id));
  const ov = overviews[id];
  const key = `ml-ov-${id}-${lang}`;
  const [ai, setAi] = useState<string>(() => lsGet<{ v: string }>(key, { v: '' }).v);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!co) return null;
  const done = books.filter((b) => b.status === 'completed').length;
  const ask = async () => {
    setBusy(true); setErr('');
    try {
      const txt = await askClaude(`Write a calm, factual overview (about 180 words) of ${co.lit.en} for a reader's personal library, in ${lang === 'ar' ? 'Arabic' : 'English'}: its historical context, major periods, notable writers and characteristic forms. Plain paragraphs, no headings, no quotations from works.`, { onText: (x) => setAi(x) });
      setAi(txt); lsSet(key, { v: txt });
    } catch (e: any) { setErr(e?.message === 'unavailable' ? t('ai.unavailable') : t('ai.failed')); } finally { setBusy(false); }
  };
  return (
    <div>
      <div className="paper-grain relative mb-8 overflow-hidden rounded-3xl bg-[#2f4f3e] px-6 py-8 text-[#f6f1e7] dark:bg-[#22382c] sm:px-10">
        <div className="watermark -bottom-8 end-4 !text-[#f6f1e7]/[0.07]" style={{ fontSize: 100 }}>{t('brand')}</div>
        <div className="relative flex items-center gap-4">
          <span className="text-5xl" aria-hidden="true">{co.flag}</span>
          <div><h1 className="text-[32px] font-semibold leading-tight sm:text-[44px]">{co.lit[lang]}</h1><div className="opacity-80">{co[lang]} · {t('books.count', { n: books.length })}</div></div>
        </div>
        {books.length > 0 && <div className="relative mt-5 max-w-sm"><div className="mb-1 flex justify-between text-xs opacity-80"><span>{t('world.progress')}</span><span>{fmtNum(lang, done)} / {fmtNum(lang, books.length)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#f6f1e7]/20"><div className="h-full bg-[#c9a46b]" style={{ width: `${(done / books.length) * 100}%` }} /></div></div>}
      </div>
      <div className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="relative overflow-hidden">
          <Watermark className="-bottom-4 -end-4" size={50} />
          <h2 className="mb-3 text-lg font-semibold">{t('world.overview')}</h2>
          {ov ? <p className="max-w-[68ch] leading-relaxed">{ov[lang]}</p> : <p className="text-muted">{t('world.noOverview')}</p>}
          {ai && <div className="mt-4 border-t border-line pt-4"><p className="whitespace-pre-wrap leading-relaxed">{ai}</p><p className="mt-2 text-xs text-muted">{t('ai.label')}</p></div>}
          {err && <p className="mt-2 text-sm text-wine">{err}</p>}
          <Button size="sm" variant="ghost" className="mt-3" disabled={busy} onClick={ask}><Sparkles size={14} />{busy ? t('ai.working') : t('ai.overview')}</Button>
        </Card>
        {ov && (
          <Card>
            <dl className="space-y-4 text-sm">
              <div><dt className="mb-1 font-semibold">{t('world.periods')}</dt><dd className="text-muted">{ov.periods[lang]}</dd></div>
              <div><dt className="mb-1 font-semibold">{t('world.writers')}</dt><dd className="text-muted">{ov.writers[lang]}</dd></div>
              <div><dt className="mb-1 font-semibold">{t('world.genres')}</dt><dd className="text-muted">{ov.forms[lang]}</dd></div>
            </dl>
          </Card>
        )}
      </div>
      <SectionHeader title={t('world.yourBooks')} />
      <BookBrowser books={books} hide={['country']} />
    </div>
  );
}
