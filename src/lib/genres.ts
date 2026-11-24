export interface GenreDef { id: string; en: string; ar: string; group: 'fiction' | 'nonfiction' | 'other' }

const g = (group: GenreDef['group'], id: string, en: string, ar: string): GenreDef => ({ id, en, ar, group });

export const genreDefs: GenreDef[] = [
  g('fiction', 'literary', 'Literary fiction', 'الأدب الروائي'),
  g('fiction', 'historical-fiction', 'Historical fiction', 'رواية تاريخية'),
  g('fiction', 'contemporary', 'Contemporary fiction', 'رواية معاصرة'),
  g('fiction', 'classic', 'Classic literature', 'أدب كلاسيكي'),
  g('fiction', 'scifi', 'Science fiction', 'خيال علمي'),
  g('fiction', 'fantasy', 'Fantasy', 'فانتازيا'),
  g('fiction', 'mystery', 'Mystery', 'غموض'),
  g('fiction', 'crime', 'Crime', 'جريمة'),
  g('fiction', 'thriller', 'Thriller', 'إثارة'),
  g('fiction', 'horror', 'Horror', 'رعب'),
  g('fiction', 'romance', 'Romance', 'رومانسية'),
  g('fiction', 'adventure', 'Adventure', 'مغامرة'),
  g('fiction', 'short-stories', 'Short stories', 'قصص قصيرة'),
  g('fiction', 'novella', 'Novellas', 'روايات قصيرة'),
  g('nonfiction', 'history', 'History', 'تاريخ'),
  g('nonfiction', 'biography', 'Biography', 'سيرة'),
  g('nonfiction', 'autobiography', 'Autobiography', 'سيرة ذاتية'),
  g('nonfiction', 'memoir', 'Memoir', 'مذكرات'),
  g('nonfiction', 'philosophy', 'Philosophy', 'فلسفة'),
  g('nonfiction', 'psychology', 'Psychology', 'علم النفس'),
  g('nonfiction', 'sociology', 'Sociology', 'علم الاجتماع'),
  g('nonfiction', 'politics', 'Politics', 'سياسة'),
  g('nonfiction', 'religion', 'Religion', 'دين'),
  g('nonfiction', 'economics', 'Economics', 'اقتصاد'),
  g('nonfiction', 'science', 'Science', 'علوم'),
  g('nonfiction', 'technology', 'Technology', 'تقنية'),
  g('nonfiction', 'medicine', 'Medicine', 'طب'),
  g('nonfiction', 'art', 'Art', 'فن'),
  g('nonfiction', 'architecture', 'Architecture', 'عمارة'),
  g('nonfiction', 'travel', 'Travel', 'أدب الرحلات'),
  g('nonfiction', 'essays', 'Essays', 'مقالات'),
  g('nonfiction', 'culture', 'Culture', 'ثقافة'),
  g('other', 'poetry', 'Poetry', 'شعر'),
  g('other', 'drama', 'Drama', 'مسرح'),
  g('other', 'folklore', 'Folklore', 'فلكلور'),
  g('other', 'mythology', 'Mythology', 'أساطير'),
  g('other', 'criticism', 'Literary criticism', 'نقد أدبي'),
  g('other', 'self-development', 'Self-development', 'تطوير الذات'),
  g('other', 'personal-growth', 'Personal growth', 'النمو الشخصي'),
  g('other', 'reference', 'Reference books', 'مراجع'),
];

export const themeTags: { en: string; ar: string }[] = [
  { en: 'Existentialism', ar: 'الوجودية' }, { en: 'War', ar: 'الحرب' }, { en: 'Identity', ar: 'الهوية' },
  { en: 'Human nature', ar: 'الطبيعة البشرية' }, { en: 'Memory', ar: 'الذاكرة' }, { en: 'Loneliness', ar: 'الوحدة' },
  { en: 'Love', ar: 'الحب' }, { en: 'Society', ar: 'المجتمع' }, { en: 'Power', ar: 'السلطة' },
  { en: 'Spirituality', ar: 'الروحانية' }, { en: 'Civilization', ar: 'الحضارة' }, { en: 'Freedom', ar: 'الحرية' },
];

export const genreById = (id: string) => genreDefs.find((x) => x.id === id);
export const genreLabel = (id: string, lang: 'en' | 'ar') => genreById(id)?.[lang] ?? id;

/** Map a free-text subject (e.g. from EPUB dc:subject) to a known genre id, else keep text. */
export function normalizeGenre(s: string): string {
  const t = s.trim().toLowerCase();
  for (const gd of genreDefs) if (gd.en.toLowerCase() === t || gd.ar === s.trim() || gd.id === t) return gd.id;
  if (/novel|fiction|رواية/.test(t)) return 'literary';
  if (/poem|poetry|شعر/.test(t)) return 'poetry';
  if (/history|تاريخ/.test(t)) return 'history';
  if (/philosoph|فلسف/.test(t)) return 'philosophy';
  return s.trim();
}
