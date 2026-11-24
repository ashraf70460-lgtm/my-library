import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, Star } from 'lucide-react';
import { useStore, useT } from '../store';

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="9" fill="rgb(var(--c-forest))" />
      <path d="M9 30 V13 a11 11 0 0 1 22 0 V30" fill="none" stroke="rgb(var(--c-ivory))" strokeWidth="1.6" opacity=".55" />
      <rect x="12" y="15" width="3.2" height="15" rx=".6" fill="rgb(var(--c-ivory))" />
      <rect x="16.2" y="13" width="3.2" height="17" rx=".6" fill="rgb(var(--c-ivory))" opacity=".85" />
      <rect x="20.4" y="16" width="3.2" height="14" rx=".6" fill="#c9a46b" />
      <rect x="24.6" y="15.5" width="3.2" height="14.5" rx=".6" transform="rotate(12 26.2 30)" fill="rgb(var(--c-ivory))" opacity=".7" />
      <rect x="9" y="30" width="22" height="2" rx="1" fill="rgb(var(--c-ivory))" />
    </svg>
  );
}

export function Watermark({ className = '', size = 120 }: { className?: string; size?: number }) {
  const t = useT();
  return <div className={'watermark ' + className} style={{ fontSize: size }} aria-hidden="true">{t('brand')}</div>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'danger' | 'outline'; size?: 'sm' | 'md' };
export function Button({ variant = 'soft', size = 'md', className = '', ...p }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const sz = size === 'sm' ? 'min-h-[36px] px-3 text-sm' : 'min-h-[44px] px-5 text-[15px]';
  const v = {
    primary: 'bg-forest text-ivory hover:bg-forest/90',
    soft: 'bg-paper text-ink hover:bg-line/70',
    ghost: 'text-ink hover:bg-paper',
    outline: 'border border-line text-ink hover:bg-paper',
    danger: 'bg-wine text-ivory hover:bg-wine/90',
  }[variant];
  return <button type="button" className={`${base} ${sz} ${v} ${className}`} {...p} />;
}

export function IconButton({ label, className = '', children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-paper transition-colors ${className}`} {...p}>
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`fade-in flex max-h-[92vh] w-full flex-col rounded-t-2xl sm:rounded-2xl bg-card shadow-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton label={t('close')} onClick={onClose}><X size={20} /></IconButton>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, text, onConfirm, onClose, danger = true, requireText }: { open: boolean; text: string; onConfirm: () => void; onClose: () => void; danger?: boolean; requireText?: string }) {
  const t = useT();
  const [v, setV] = useState('');
  useEffect(() => setV(''), [open]);
  return (
    <Modal open={open} onClose={onClose} title={t('confirm')} footer={<>
      <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
      <Button variant={danger ? 'danger' : 'primary'} disabled={!!requireText && v !== requireText} onClick={() => { onConfirm(); onClose(); }}>{t('confirm')}</Button>
    </>}>
      <p className="mb-3">{text}</p>
      {requireText && <input className="field" value={v} onChange={(e) => setV(e.target.value)} placeholder={requireText} dir="ltr" />}
    </Modal>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Chip({ active, children, onClick, className = '' }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  const Tag: any = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${active ? 'border-forest bg-forest text-ivory' : 'border-line bg-card hover:bg-paper'} ${className}`}>
      {children}
    </Tag>
  );
}

export function ProgressBar({ value, className = '', color = 'bg-forest' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-line/70 ${className}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 6, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-line))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-forest))" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">{children}</div>
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 22 }: { value?: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" disabled={!onChange} aria-label={`${i}`} onClick={() => onChange?.(i === value ? 0 : i)} className="p-1">
          <Star size={size} className={i <= value ? 'fill-[#c9a46b] text-[#c9a46b]' : 'text-line'} />
        </button>
      ))}
    </div>
  );
}

export function SectionHeader({ title, action, sub }: { title: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[32px] leading-tight font-semibold sm:text-[40px]">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, actions, icon }: { title: ReactNode; body?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-line bg-card/60 px-6 py-12 text-center">
      <Watermark className="-bottom-6 start-1/2 -translate-x-1/2 rtl:translate-x-1/2" size={90} />
      <div className="relative mx-auto mb-4 flex justify-center text-forest">{icon ?? <ShelfIllustration />}</div>
      <h3 className="relative mb-2 text-xl font-semibold">{title}</h3>
      {body && <p className="relative mx-auto max-w-md text-muted">{body}</p>}
      {actions && <div className="relative mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function ShelfIllustration({ w = 180 }: { w?: number }) {
  const books = [
    { x: 20, h: 70, w: 16, c: 'rgb(var(--c-forest))' }, { x: 38, h: 82, w: 13, c: 'rgb(var(--c-wine))' }, { x: 53, h: 64, w: 18, c: 'rgb(var(--c-olive))' },
    { x: 73, h: 76, w: 12, c: 'rgb(var(--c-brown))' }, { x: 104, h: 58, w: 15, c: 'rgb(var(--c-forest) / .6)' }, { x: 121, h: 72, w: 14, c: 'rgb(var(--c-wine) / .7)' },
  ];
  return (
    <svg width={w} height={w * 0.6} viewBox="0 0 180 108" aria-hidden="true">
      <rect x="0" y="96" width="180" height="6" rx="2" fill="rgb(var(--c-brown) / .5)" />
      {books.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={96 - b.h} width={b.w} height={b.h} rx="1.5" fill={b.c} />
          <rect x={b.x + 3} y={96 - b.h + 10} width={b.w - 6} height="2" fill="rgb(var(--c-ivory) / .5)" />
        </g>
      ))}
      <rect x="87" y="40" width="13" height="56" rx="1.5" transform="rotate(-14 93 96)" fill="rgb(var(--c-muted) / .6)" />
      <circle cx="158" cy="30" r="10" fill="#c9a46b" opacity=".25" />
      <path d="M150 96 h16 l-3 -26 h-10z" fill="rgb(var(--c-muted) / .5)" />
      <path d="M158 70 v-30" stroke="rgb(var(--c-muted) / .6)" strokeWidth="2" />
    </svg>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-24 start-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2 rtl:translate-x-1/2 lg:bottom-6">
      {toasts.map((x) => <div key={x.id} className="fade-in rounded-full bg-ink px-4 py-2 text-sm text-ivory shadow-lg">{x.text}</div>)}
    </div>
  );
}

/** Lightweight popover menu anchored to a trigger. */
export function Menu({ trigger, children, align = 'end' }: { trigger: (open: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <div className={`fade-in absolute z-50 mt-1 min-w-[200px] rounded-xl border border-line bg-card p-1 shadow-xl ${align === 'end' ? 'end-0' : 'start-0'}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
export function MenuItem({ onClick, children, active }: { onClick: () => void; children: ReactNode; active?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex min-h-[40px] w-full items-center gap-2 rounded-lg px-3 text-start text-sm hover:bg-paper ${active ? 'font-semibold text-forest' : ''}`}>{children}</button>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-full border border-line bg-card p-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`min-h-[36px] rounded-full px-3 text-sm transition-colors ${value === o.value ? 'bg-forest text-ivory' : 'hover:bg-paper'}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span><span className="block">{label}</span>{hint && <span className="block text-sm text-muted">{hint}</span>}</span>
      <span className="relative mt-1 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-forest" />
        <span className="absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-5 ${className}`}>{children}</div>;
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="serif text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function TagInput({ value, onChange, placeholder, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [txt, setTxt] = useState('');
  const add = (s: string) => { const v = s.trim(); if (v && !value.includes(v)) onChange([...value, v]); setTxt(''); };
  const listId = useRef('dl' + Math.random().toString(36).slice(2)).current;
  return (
    <div className="field flex flex-wrap items-center gap-1.5 !py-1.5">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-sm">
          {v}<button type="button" aria-label="remove" onClick={() => onChange(value.filter((x) => x !== v))}><X size={13} /></button>
        </span>
      ))}
      <input list={listId} className="min-w-[120px] flex-1 bg-transparent py-1 outline-none" value={txt} placeholder={placeholder}
        onChange={(e) => { const v = e.target.value; if (v.endsWith(',') || v.endsWith('،')) add(v.slice(0, -1)); else setTxt(v); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(txt); } else if (e.key === 'Backspace' && !txt && value.length) onChange(value.slice(0, -1)); }}
        onBlur={() => txt && add(txt)} />
      <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  );
}
