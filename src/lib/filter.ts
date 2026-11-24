import type { Book, Filters } from '../types';

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[ً-ٰٟـ]/g, '') // Arabic diacritics + tatweel
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[̀-ͯ]/g, '');

export function matchesQuery(b: Book, q: string) {
  const n = norm(q.trim());
  if (!n) return true;
  const hay = norm([b.title, b.originalTitle, b.subtitle, ...(b.altTitles || []), ...b.authors, b.translator, b.publisher, ...b.genres, ...b.tags, b.isbn, b.sourceFolder].filter(Boolean).join(' | '));
  return n.split(/\s+/).every((w) => hay.includes(w));
}

export function applyFilters(books: Book[], f: Filters): Book[] {
  return books.filter((b) => {
    if (f.q && !matchesQuery(b, f.q)) return false;
    if (f.status && b.status !== f.status) return false;
    if (f.genre && !b.genres.includes(f.genre)) return false;
    if (f.tag && !b.tags.includes(f.tag)) return false;
    if (f.author && !b.authors.includes(f.author)) return false;
    if (f.country && !b.countries.includes(f.country)) return false;
    if (f.language && (b.language || 'other') !== f.language) return false;
    if (f.favorite && !b.favorite) return false;
    if (f.format && b.format !== f.format) return false;
    const y = Number(b.year);
    if (f.yearFrom && (!y || y < Number(f.yearFrom))) return false;
    if (f.yearTo && (!y || y > Number(f.yearTo))) return false;
    return true;
  });
}

export function sortBooks(books: Book[], sort: string, lang: 'en' | 'ar'): Book[] {
  const coll = new Intl.Collator(lang === 'ar' ? 'ar' : 'en', { sensitivity: 'base', numeric: true });
  const arr = [...books];
  switch (sort) {
    case 'title': return arr.sort((a, b) => coll.compare(a.title, b.title));
    case 'author': return arr.sort((a, b) => coll.compare(a.authors[0] || '￿', b.authors[0] || '￿') || coll.compare(a.title, b.title));
    case 'progress': return arr.sort((a, b) => b.progress - a.progress);
    case 'opened': return arr.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
    default: return arr.sort((a, b) => b.addedAt - a.addedAt);
  }
}
