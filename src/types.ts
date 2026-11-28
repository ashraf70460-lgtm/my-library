export type Lang = 'en' | 'ar';
export type BookStatus = 'unread' | 'reading' | 'completed' | 'onhold' | 'abandoned' | 'want';
export type BookFormat = 'epub' | 'pdf' | 'txt' | 'html' | 'md' | 'fb2' | 'docx';

export interface Base {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface TocItem {
  label: string;
  chapter?: number; // flow books
  page?: number; // pdf
  level?: number;
}

export interface Book extends Base {
  title: string;
  altTitles?: string[]; // titles in other languages
  originalTitle?: string;
  subtitle?: string;
  authors: string[];
  translator?: string;
  publisher?: string;
  year?: string;
  isbn?: string;
  language?: string; // 'ar' | 'en' | ...
  genres: string[];
  tags: string[];
  countries: string[]; // country codes from lib/world
  description?: string;
  format: BookFormat;
  fileHash: string;
  fileName: string;
  fileSize: number;
  hasCover: boolean;
  pages?: number; // real pages (pdf) or estimated pages
  pagesEstimated?: boolean;
  chars?: number;
  toc?: TocItem[];
  status: BookStatus;
  favorite: boolean;
  favoritedAt?: number;
  rating?: number;
  review?: string;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  lastOpenedAt?: number;
  progress: number; // 0..1
  position?: { chapter?: number; ratio?: number; page?: number };
  sourceFolder?: string;
  rtl?: boolean;
  cloud?: boolean; // file stored on the cloud shelf
  pdfView?: 'page' | 'text'; // remembered PDF display for this book
  pdfRotate?: number; // 0 | 90 | 180 | 270
  archived?: boolean; // hidden from the main shelves, never deleted
  archivedAt?: number;
  originalLanguage?: string; // language the work was first written in
  pubCountry?: string; // country of publication (country id)
  subjects?: string[]; // subject headings
  unverified?: string[]; // fields filled automatically that still need checking
}

export interface Annotation extends Base {
  bookId: string;
  kind: 'highlight' | 'note' | 'bookmark';
  target?: 'passage' | 'chapter' | 'book' | 'author' | 'page';
  author?: string; // for author notes
  chapter?: number;
  chapterLabel?: string;
  page?: number;
  start?: number; // char offsets inside chapter text
  end?: number;
  ratio?: number; // position within chapter
  text?: string; // highlighted text
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'orange';
  note?: string;
  createdAt: number;
  favoriteQuote?: boolean;
}

export interface Session extends Base {
  bookId: string;
  start: number;
  end: number;
  seconds: number;
  pages: number;
  chapters: number;
  day: string; // YYYY-MM-DD local
}

export interface JournalEntry extends Base {
  createdAt: number;
  title?: string;
  body: string;
  kind: 'thought' | 'reflection' | 'passage' | 'review' | 'observation' | 'insight' | 'session';
  bookId?: string;
  author?: string;
  sessionId?: string;
  quote?: string;
  collectionId?: string;
}

export interface Collection extends Base {
  name: string;
  description?: string;
  bookIds: string[];
  color?: string;
  coverBookId?: string;
  coverImage?: string;
  smart?: Filters;
  pinned?: boolean;
  special?: 'quran';
  createdAt: number;
}

export interface AuthorMeta extends Base {
  // id = normalized author name
  name: string;
  bio?: string;
  country?: string;
  languages?: string;
  period?: string;
  born?: string;
  genres?: string;
  aiGenerated?: boolean;
  portrait?: string;
  specialty?: string; // field or specialty (e.g. novelist, physician)
  favorite?: boolean;
}

export interface Challenge extends Base {
  title: string;
  kind: 'books' | 'minutes-streak' | 'countries' | 'continents' | 'same-author' | 'country' | 'classic' | 'custom';
  target: number;
  param?: string;
  year?: number;
  createdAt: number;
  manualDone?: number;
}

export interface Filters {
  q?: string;
  status?: BookStatus | '';
  genre?: string;
  author?: string;
  country?: string;
  language?: string;
  favorite?: boolean;
  format?: string;
  yearFrom?: string;
  yearTo?: string;
  tag?: string;
  region?: string;
  archived?: boolean; // show archived books instead of the shelf
}

export type ReaderTheme = 'paper' | 'ivory' | 'sepia' | 'light' | 'dark' | 'night' | 'forest' | 'gray';

export interface ReaderPrefs {
  theme: ReaderTheme;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  margin: number;
  width: number;
  paraSpacing: number;
  mode: 'scroll' | 'paged';
  spread: boolean;
  direction: 'auto' | 'ltr' | 'rtl';
  justify: boolean;
  customBg?: string;
  customFg?: string;
  pdfZoom: number;
  pdfMode: 'scroll' | 'single';
  pdfText?: boolean; // show PDFs as reflowed text
  pdfFit?: 'zoom' | 'width' | 'page';
  pdfSpread?: boolean; // two pages side by side
  pageTurn?: boolean; // page-turn animation in paged mode
}

export interface Settings {
  lang: Lang;
  appTheme: 'light' | 'dark' | 'system';
  onboarded: boolean;
  goal: { type: 'minutes' | 'pages' | 'chapters'; value: number };
  reminders: { enabled: boolean; time: string; days: number[] };
  defaultSort: 'added' | 'title' | 'author' | 'progress' | 'opened';
  defaultView: 'grid' | 'list';
  reader: ReaderPrefs;
  importPrefs: { folderRules: boolean; newFolderNames: string; quranFolderNames: string; categoryFromFolder: boolean; authorFromFolder: boolean };
  sync: boolean;
  telegram: { token: string; chats: string };
  booksPerYear: number;
  weeklyGoal?: number; // minutes per week (0 = off)
  monthlyGoal?: number; // books per month (0 = off)
}

export interface WishItem extends Base {
  title: string;
  author: string;
  country?: string;
  genres?: string[];
  year?: number;
  catalogId?: string;
  olKey?: string;
  note?: string;
  addedAt: number;
}
