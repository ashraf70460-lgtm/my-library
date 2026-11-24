import type { Book, Challenge, Session, Settings } from '../types';
import { continentOf } from './world';

export const dayKey = (d: Date | number = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function byDay(sessions: Session[]) {
  const m = new Map<string, { seconds: number; pages: number; chapters: number }>();
  for (const s of sessions) {
    const v = m.get(s.day) || { seconds: 0, pages: 0, chapters: 0 };
    v.seconds += s.seconds; v.pages += s.pages; v.chapters += s.chapters;
    m.set(s.day, v);
  }
  return m;
}

const MIN_SECONDS = 60;

export function streaks(days: Map<string, { seconds: number }>) {
  const read = (k: string) => (days.get(k)?.seconds ?? 0) >= MIN_SECONDS;
  let current = 0;
  let d = new Date();
  if (!read(dayKey(d))) d = addDays(d, -1); // today not yet read: streak still alive from yesterday
  while (read(dayKey(d))) { current++; d = addDays(d, -1); }
  const keys = [...days.keys()].filter(read).sort();
  let longest = 0, run = 0, prev: string | null = null;
  for (const k of keys) {
    if (prev && dayKey(addDays(new Date(prev + 'T12:00:00'), 1)) === k) run++; else run = 1;
    longest = Math.max(longest, run); prev = k;
  }
  return { current, longest: Math.max(longest, current), totalDays: keys.length };
}

export function goalProgress(settings: Settings, today?: { seconds: number; pages: number; chapters: number }) {
  const t = today || { seconds: 0, pages: 0, chapters: 0 };
  const g = settings.goal;
  const done = g.type === 'minutes' ? Math.floor(t.seconds / 60) : g.type === 'pages' ? t.pages : t.chapters;
  const target = Math.max(1, g.value);
  return { done, target, ratio: g.value ? Math.min(1, done / target) : 0, met: g.value > 0 && done >= target };
}

export function remainingSeconds(book: Book, sessions: Session[]): number | undefined {
  const mine = sessions.filter((s) => s.bookId === book.id);
  const secs = mine.reduce((a, s) => a + s.seconds, 0);
  const pages = mine.reduce((a, s) => a + s.pages, 0);
  const total = book.pages;
  if (!total) return undefined;
  const left = total * (1 - book.progress);
  const secPerPage = pages >= 5 && secs > 300 ? secs / pages : 90; // personal pace, else ~1.5 min/page
  return Math.round(left * secPerPage);
}

export function challengeProgress(c: Challenge, books: Book[], sessions: Session[]): number {
  const year = c.year || new Date().getFullYear();
  const done = books.filter((b) => b.status === 'completed');
  const inYear = done.filter((b) => b.completedAt && new Date(b.completedAt).getFullYear() === year);
  switch (c.kind) {
    case 'books': return inYear.length;
    case 'countries': return new Set(inYear.flatMap((b) => b.countries)).size;
    case 'continents': return new Set(inYear.flatMap((b) => b.countries.map(continentOf).filter(Boolean))).size;
    case 'same-author': {
      const m = new Map<string, number>();
      for (const b of inYear) for (const a of b.authors) m.set(a, (m.get(a) || 0) + 1);
      return Math.max(0, ...m.values());
    }
    case 'country': return inYear.filter((b) => b.countries.includes(c.param || '')).length;
    case 'classic': return inYear.filter((b) => b.genres.includes('classic')).length;
    case 'minutes-streak': {
      const d = byDay(sessions);
      let best = 0, run = 0;
      for (let i = 60; i >= 0; i--) {
        const k = dayKey(addDays(new Date(), -i));
        if ((d.get(k)?.seconds ?? 0) >= Number(c.param || 30) * 60) { run++; best = Math.max(best, run); } else run = 0;
      }
      return best;
    }
    default: return c.manualDone || 0;
  }
}
