import { useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { Minus, Plus, RotateCcw, Search } from 'lucide-react';
import { useStore, useT, useLang, useBooks } from '../store';
import { countries, countryById, regions, periods, periodOf } from '../lib/world';
import { isoToLib } from '../lib/mapdata';
import { genreLabel } from '../lib/genres';
import { PageTitle, SectionHeader } from '../components/ui';
import { fmtNum } from '../i18n';

const W = 960, H = 500;
const shapes = (() => {
  const fc: any = feature(world as any, (world as any).objects.countries);
  const proj = geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' } as any);
  const path = geoPath(proj);
  return { list: fc.features.map((f: any) => ({ iso: String(f.id ?? ''), name: f.properties?.name as string, d: path(f) || '' })), sphere: path({ type: 'Sphere' } as any) || '' };
})();

export default function WorldMapPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const all = useBooks();
  const [genre, setGenre] = useState('');
  const [period, setPeriod] = useState('');
  const [region, setRegion] = useState(() => useStore.getState().route.id || '');
  const [q, setQ] = useState('');
  const [hover, setHover] = useState<{ iso: string; name: string; x: number; y: number } | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const books = useMemo(() => all.filter((b) => !b.archived && (!genre || b.genres.includes(genre)) && (!period || periodOf(b.year) === period)), [all, genre, period]);
  const per = useMemo(() => {
    const m = new Map<string, { books: number; authors: Set<string> }>();
    for (const b of books) for (const c of b.countries) {
      if (!m.has(c)) m.set(c, { books: 0, authors: new Set() });
      const e = m.get(c)!; e.books++; b.authors.forEach((a) => e.authors.add(a));
    }
    return m;
  }, [books]);
  const max = Math.max(1, ...[...per.values()].map((v) => v.books));
  const usedGenres = useMemo(() => [...new Set(all.flatMap((b) => b.genres))], [all]);
  const inRegion = (lib?: string) => !region || (!!lib && !!countryById(lib)?.regions.includes(region as any));

  const fill = (iso: string) => {
    const lib = isoToLib[iso];
    const n = lib ? per.get(lib)?.books || 0 : 0;
    if (!inRegion(lib)) return 'var(--map-off)';
    if (!n) return lib ? 'var(--map-empty)' : 'var(--map-none)';
    return `color-mix(in srgb, var(--map-green) ${Math.round(28 + 72 * Math.sqrt(n / max))}%, var(--map-empty))`;
  };
  const go = (iso: string) => { const lib = isoToLib[iso]; if (lib) s.navigate({ name: 'country', id: lib }); };
  const zoom = (f: number) => setView((v) => { const k = Math.min(8, Math.max(1, v.k * f)); return { k, x: k === 1 ? 0 : v.x, y: k === 1 ? 0 : v.y }; });

  const list = countries
    .filter((c) => inRegion(c.id) && (!q || `${c.en} ${c.ar} ${c.lit.en} ${c.lit.ar}`.toLowerCase().includes(q.toLowerCase())))
    .map((c) => ({ c, n: per.get(c.id)?.books || 0, a: per.get(c.id)?.authors.size || 0 }))
    .sort((a, b) => b.n - a.n || a.c[lang].localeCompare(b.c[lang], lang));
  const hl = hover ? isoToLib[hover.iso] : undefined;

  return (
    <div>
      <PageTitle title={t('map.title')} sub={t('map.sub')} />
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="field !w-auto !rounded-full !py-1 text-sm" value={region} onChange={(e) => setRegion(e.target.value)} aria-label={t('f.region')}>
          <option value="">{t('map.allRegions')}</option>{regions.map((r) => <option key={r.id} value={r.id}>{r[lang]}</option>)}
        </select>
        <select className="field !w-auto !rounded-full !py-1 text-sm" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label={t('f.genre')}>
          <option value="">{t('map.allGenres')}</option>{usedGenres.map((g) => <option key={g} value={g}>{genreLabel(g, lang)}</option>)}
        </select>
        <select className="field !w-auto !rounded-full !py-1 text-sm" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={t('map.period')}>
          <option value="">{t('map.allPeriods')}</option>{periods.map((p) => <option key={p.id} value={p.id}>{p[lang]}</option>)}
        </select>
      </div>

      <div ref={box} dir="ltr" className="relative mb-3 overflow-hidden rounded-2xl border border-line bg-[var(--map-sea)] touch-none select-none"
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current; if (!d || view.k === 1) return;
          const r = box.current!.getBoundingClientRect(); const sc = W / r.width;
          const dx = (e.clientX - d.x) * sc, dy = (e.clientY - d.y) * sc;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
        }}
        onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
        onPointerLeave={() => { drag.current = null; setHover(null); }}
        onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.25 : 0.8); } }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t('map.title')}>
          <g transform={`translate(${W / 2 + view.x} ${H / 2 + view.y}) scale(${view.k}) translate(${-W / 2} ${-H / 2})`}>
            <path d={shapes.sphere} fill="var(--map-sea)" />
            {shapes.list.map((f: any, i: number) => {
              const lib = isoToLib[f.iso];
              const on = !!hl && lib === hl;
              return (
                <path key={f.iso + i} d={f.d} fill={fill(f.iso)} stroke={on ? 'var(--map-ink)' : 'var(--map-line)'} strokeWidth={(on ? 1.4 : 0.5) / view.k}
                  className={lib ? 'cursor-pointer' : ''}
                  onPointerMove={(e) => { const r = box.current!.getBoundingClientRect(); setHover({ iso: f.iso, name: f.name, x: e.clientX - r.left, y: e.clientY - r.top }); }}
                  onClick={() => { if (!drag.current?.moved) go(f.iso); }}>
                  <title>{lib ? countryById(lib)?.lit[lang] : f.name}</title>
                </path>
              );
            })}
          </g>
        </svg>
        {hover && (() => {
          const lib = isoToLib[hover.iso]; const co = lib ? countryById(lib) : undefined; const e = lib ? per.get(lib) : undefined;
          return (
            <div className="pointer-events-none absolute z-10 max-w-[240px] rounded-xl border border-line bg-card px-3 py-2 text-sm shadow" style={{ left: Math.min(hover.x + 12, (box.current?.clientWidth || 300) - 200), top: hover.y + 12 }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div className="font-semibold">{co ? `${co.flag} ${co.lit[lang]}` : hover.name}</div>
              {co && <div className="text-muted">{t('books.count', { n: e?.books || 0 })} · {t('map.authors', { n: e?.authors.size || 0 })}</div>}
            </div>
          );
        })()}
        <div className="absolute bottom-3 end-3 flex flex-col gap-1">
          <button type="button" aria-label={t('map.zoomIn')} onClick={() => zoom(1.5)} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card shadow-sm"><Plus size={16} /></button>
          <button type="button" aria-label={t('map.zoomOut')} onClick={() => zoom(1 / 1.5)} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card shadow-sm"><Minus size={16} /></button>
          <button type="button" aria-label={t('map.reset')} onClick={() => setView({ k: 1, x: 0, y: 0 })} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card shadow-sm"><RotateCcw size={15} /></button>
        </div>
      </div>
      <div className="mb-10 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm" style={{ background: 'var(--map-empty)' }} />{t('map.noBooks')}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-12 rounded-sm" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--map-green) 28%, var(--map-empty)), var(--map-green))' }} />{t('map.more')}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm" style={{ background: 'var(--map-none)' }} />{t('map.notGrouped')}</span>
        <span>{t('map.hint')}</span>
      </div>

      <SectionHeader title={t('map.countries')} />
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="field !rounded-full !ps-9" placeholder={t('map.searchCountry')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ c, n, a }) => (
          <button key={c.id} type="button" onClick={() => s.navigate({ name: 'country', id: c.id })} onMouseEnter={() => setHover(null)}
            className={`flex min-h-[56px] items-center gap-3 rounded-xl border border-line bg-card px-3 text-start hover:border-forest/40 ${n ? '' : 'opacity-70'}`}>
            <span className="text-2xl" aria-hidden="true">{c.flag}</span>
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c[lang]}</span><span className="block truncate text-xs text-muted">{c.lit[lang]}</span></span>
            <span className="text-end text-xs text-muted"><span className="block text-sm font-semibold text-ink">{fmtNum(lang, n)}</span>{t('map.authors', { n: a })}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
