import { RotateCw } from 'lucide-react';
import type { ReaderPrefs, ReaderTheme } from '../types';
import { useT } from '../store';
import { Segmented, Toggle } from '../components/ui';

export const THEMES: { id: ReaderTheme; bg: string; fg: string }[] = [
  { id: 'paper', bg: '#fbfaf6', fg: '#26241f' }, { id: 'ivory', bg: '#f6efdf', fg: '#2c261d' }, { id: 'sepia', bg: '#ecdfc4', fg: '#4a3826' },
  { id: 'light', bg: '#ffffff', fg: '#1d1d1f' }, { id: 'gray', bg: '#e9e9e6', fg: '#2a2a28' }, { id: 'dark', bg: '#1f2124', fg: '#dcd8d0' },
  { id: 'night', bg: '#0d0d0c', fg: '#b9b1a2' }, { id: 'forest', bg: '#1d2a22', fg: '#dfe6d6' },
];
export const FONTS: { id: string; label: string; css: string }[] = [
  { id: 'auto', label: 'Auto', css: '' },
  { id: 'literata', label: 'Literata', css: "'Literata', Georgia, serif" },
  { id: 'lora', label: 'Lora', css: "'Lora', Georgia, serif" },
  { id: 'source', label: 'Source Serif', css: "'Source Serif 4', Georgia, serif" },
  { id: 'inter', label: 'Inter', css: "'Inter', system-ui, sans-serif" },
  { id: 'naskh', label: 'Noto Naskh Arabic', css: "'Noto Naskh Arabic', serif" },
  { id: 'amiri', label: 'Amiri', css: "'Amiri', serif" },
  { id: 'plex', label: 'IBM Plex Sans Arabic', css: "'IBM Plex Sans Arabic', sans-serif" },
  { id: 'cairo', label: 'Cairo', css: "'Cairo', sans-serif" },
];
export function fontCss(id: string, rtl: boolean) {
  const f = FONTS.find((x) => x.id === id);
  if (f && f.css) return `${f.css}, 'Noto Naskh Arabic', 'Literata', serif`;
  return rtl ? "'Noto Naskh Arabic', 'Amiri', 'Literata', serif" : "'Literata', 'Noto Naskh Arabic', Georgia, serif";
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="tabular-nums opacity-70">{fmt ? fmt(value) : value}</span></span>
      <input type="range" className="w-full accent-[rgb(var(--c-forest))]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Appearance({ prefs, onChange, pdf, onRotate }: { prefs: ReaderPrefs; onChange: (p: Partial<ReaderPrefs>) => void; pdf?: boolean; onRotate?: () => void }) {
  const t = useT();
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{t('rd.theme')}</div>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {THEMES.map((th) => (
          <button key={th.id} type="button" onClick={() => onChange({ theme: th.id, customBg: undefined, customFg: undefined })} className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border text-[11px] ${prefs.theme === th.id && !prefs.customBg ? 'border-2 border-[var(--r-accent,#2f4f3e)]' : 'border-black/10'}`} style={{ background: th.bg, color: th.fg }}>
            <span className="serif text-base">Aa</span>{t('th.' + th.id)}
          </button>
        ))}
      </div>
      {pdf ? (
        <>
          <div className="mb-2 text-sm font-medium">{t('rd.pdfView')}</div>
          <div className="mb-1"><Segmented value={prefs.pdfText ? 'text' : 'page'} onChange={(v) => onChange({ pdfText: v === 'text' })} options={[{ value: 'page', label: t('rd.pdfPage') }, { value: 'text', label: t('rd.pdfTextView') }]} /></div>
          <p className="mb-4 text-xs opacity-70">{t('rd.pdfTextHint')}</p>
          {prefs.pdfText && <>
            <label className="mb-3 block"><span className="mb-1 block text-sm font-medium">{t('rd.font')}</span>
              <select className="field" value={prefs.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>{FONTS.map((f) => <option key={f.id} value={f.id}>{f.id === 'auto' ? t('rd.auto') : f.label}</option>)}</select>
            </label>
            <Slider label={t('rd.size')} value={prefs.fontSize} min={13} max={34} step={1} onChange={(v) => onChange({ fontSize: v })} />
            <Slider label={t('rd.lineHeight')} value={prefs.lineHeight} min={1.2} max={2.4} step={0.05} onChange={(v) => onChange({ lineHeight: v })} fmt={(v) => v.toFixed(2)} />
          </>}
          {!prefs.pdfText && <>
          <div className="mb-2 text-sm font-medium">{t('rd.mode')}</div>
          <div className="mb-4"><Segmented value={prefs.pdfMode} onChange={(v) => onChange({ pdfMode: v })} options={[{ value: 'scroll', label: t('rd.scroll') }, { value: 'single', label: t('rd.single') }]} /></div>
          <div className="mb-2 text-sm font-medium">{t('rd.fit')}</div>
          <div className="mb-4"><Segmented value={prefs.pdfFit || 'zoom'} onChange={(v) => onChange({ pdfFit: v })} options={[{ value: 'zoom', label: t('rd.fitZoom') }, { value: 'width', label: t('rd.fitWidth') }, { value: 'page', label: t('rd.fitPage') }]} /></div>
          {(prefs.pdfFit || 'zoom') === 'zoom' && <Slider label={t('rd.zoom')} value={prefs.pdfZoom} min={0.5} max={3} step={0.1} onChange={(v) => onChange({ pdfZoom: v })} fmt={(v) => Math.round(v * 100) + '%'} />}
          <Toggle checked={!!prefs.pdfSpread} onChange={(v) => onChange({ pdfSpread: v })} label={t('rd.twoPages')} hint={t('rd.twoPagesHint')} />
          {onRotate && <button type="button" onClick={onRotate} className="mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-full border px-4 text-sm" style={{ borderColor: 'var(--r-line)' }}><RotateCw size={16} />{t('rd.rotate')}</button>}
          </>}
        </>
      ) : (
        <>
          <label className="mb-3 block"><span className="mb-1 block text-sm font-medium">{t('rd.font')}</span>
            <select className="field" value={prefs.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>{FONTS.map((f) => <option key={f.id} value={f.id}>{f.id === 'auto' ? t('rd.auto') : f.label}</option>)}</select>
          </label>
          <Slider label={t('rd.size')} value={prefs.fontSize} min={13} max={34} step={1} onChange={(v) => onChange({ fontSize: v })} />
          <Slider label={t('rd.lineHeight')} value={prefs.lineHeight} min={1.2} max={2.4} step={0.05} onChange={(v) => onChange({ lineHeight: v })} fmt={(v) => v.toFixed(2)} />
          <Slider label={t('rd.paragraph')} value={prefs.paraSpacing} min={0} max={2} step={0.1} onChange={(v) => onChange({ paraSpacing: v })} fmt={(v) => v.toFixed(1)} />
          <Slider label={t('rd.margins')} value={prefs.margin} min={8} max={96} step={4} onChange={(v) => onChange({ margin: v })} />
          <Slider label={t('rd.width')} value={prefs.width} min={420} max={1100} step={20} onChange={(v) => onChange({ width: v })} />
          <div className="mb-2 mt-2 text-sm font-medium">{t('rd.mode')}</div>
          <div className="mb-2"><Segmented value={prefs.mode} onChange={(v) => onChange({ mode: v })} options={[{ value: 'scroll', label: t('rd.scroll') }, { value: 'paged', label: t('rd.paged') }]} /></div>
          {prefs.mode === 'paged' && <Toggle checked={prefs.spread} onChange={(v) => onChange({ spread: v })} label={t('rd.spread')} />}
          {prefs.mode === 'paged' && <Toggle checked={!!prefs.pageTurn} onChange={(v) => onChange({ pageTurn: v })} label={t('rd.pageTurn')} />}
          <div className="mb-2 mt-2 text-sm font-medium">{t('rd.direction')}</div>
          <div className="mb-2"><Segmented value={prefs.direction} onChange={(v) => onChange({ direction: v })} options={[{ value: 'auto', label: t('rd.auto') }, { value: 'rtl', label: 'RTL ←' }, { value: 'ltr', label: 'LTR →' }]} /></div>
          <Toggle checked={prefs.justify} onChange={(v) => onChange({ justify: v })} label={t('rd.justify')} />
          <div className="mt-2 text-sm font-medium">{t('rd.colors')}</div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">{t('rd.bg')}<input type="color" value={prefs.customBg || THEMES.find((x) => x.id === prefs.theme)!.bg} onChange={(e) => onChange({ customBg: e.target.value })} className="h-9 w-12 rounded" /></label>
            <label className="flex items-center gap-2">{t('rd.fg')}<input type="color" value={prefs.customFg || THEMES.find((x) => x.id === prefs.theme)!.fg} onChange={(e) => onChange({ customFg: e.target.value })} className="h-9 w-12 rounded" /></label>
          </div>
          <p className="mt-3 text-xs opacity-70">{t('rd.portrait')}</p>
        </>
      )}
    </div>
  );
}
