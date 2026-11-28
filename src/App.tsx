import { useEffect, useState, lazy, Suspense } from 'react';
import {
  Home, Library, BookOpen, Feather, Globe2, Shapes, Layers, NotebookPen, Highlighter, BarChart3, Compass, Download, Settings as SettingsIcon,
  Search as SearchIcon, MoreHorizontal, Languages, ArrowLeft, ArrowRight, Bell, X, Moon, Sun, Pin, Heart, Flag, Map as MapIcon,
} from 'lucide-react';
import { useStore, useT, useLang, useCollections, useSessions } from './store';
import { Logo, Toasts, IconButton } from './components/ui';
import { InstallButton, InstallIcon } from './components/Install';
import { startSync } from './lib/sync';
import { startCloud, useCloud } from './lib/cloud';
import { storageAvailable } from './lib/storage';
import { ensureRestorePoint } from './lib/backup';
import { byDay, dayKey } from './lib/stats';
import HomePage from './pages/Home';
import BooksPage from './pages/Books';
import { ContinuePage } from './pages/Continue';
import { AuthorsPage, AuthorPage } from './pages/Authors';
import { WorldPage, CountryPage, CountriesPage } from './pages/World';
import FavoritesPage from './pages/Favorites';
import { GenresPage, GenrePage } from './pages/Genres';
import { CollectionsPage, CollectionPage } from './pages/Collections';
import JournalPage from './pages/Journal';
import NotesPage from './pages/Notes';
import StatsPage from './pages/Stats';
import DiscoverPage from './pages/Discover';
import ImportPage from './pages/Import';
import SettingsPage from './pages/Settings';
import BookPage from './pages/BookDetails';
import SearchPage from './pages/Search';
import Onboarding from './pages/Onboarding';

let started = false;
const Reader = lazy(() => import('./reader/Reader'));
const WorldMapPage = lazy(() => import('./pages/WorldMap'));

export const NAV = [
  { name: 'home', icon: Home }, { name: 'books', icon: Library }, { name: 'continue', icon: BookOpen }, { name: 'favorites', icon: Heart },
  { name: 'collections', icon: Layers }, { name: 'authors', icon: Feather },
  { name: 'world', icon: Globe2 }, { name: 'countries', icon: Flag }, { name: 'map', icon: MapIcon }, { name: 'genres', icon: Shapes }, { name: 'discover', icon: Compass },
  { name: 'journal', icon: NotebookPen }, { name: 'notes', icon: Highlighter }, { name: 'stats', icon: BarChart3 },
  { name: 'import', icon: Download }, { name: 'settings', icon: SettingsIcon },
] as const;

/** Sidebar groups (every section stays; they are just arranged under small headings). */
export const NAV_GROUPS: { id: string; items: string[] }[] = [
  { id: 'library', items: ['home', 'books', 'continue', 'favorites', 'collections', 'authors'] },
  { id: 'explore', items: ['world', 'countries', 'map', 'genres', 'discover'] },
  { id: 'reading', items: ['journal', 'notes', 'stats'] },
  { id: 'tools', items: ['import', 'settings'] },
];

const parentOf: Record<string, string> = { author: 'authors', country: 'world', genre: 'genres', tag: 'genres', collection: 'collections', book: 'books', search: '' };

export default function App() {
  const s = useStore();
  const t = useT();
  const lang = useLang();
  const [moreOpen, setMoreOpen] = useState(false);
  const [reminder, setReminder] = useState(false);
  const sessions = useSessions();
  const pinned = useCollections().filter((c) => c.pinned);

  useEffect(() => { if (started) return; started = true; s.init().then(() => { ensureRestorePoint().finally(() => { startSync(); startCloud(); }); }); }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const dark = s.settings.appTheme === 'dark' || (s.settings.appTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
    document.title = t('brand');
    // keep the built-in Quran section's name in the interface language (unless renamed)
    for (const c of Object.values(useStore.getState().collections)) {
      if (!c.deleted && (c.special === 'quran' || c.name === 'The Holy Quran' || c.name === 'القرآن الكريم') && c.name !== t('col.quran') && ['The Holy Quran', 'القرآن الكريم'].includes(c.name)) {
        useStore.getState().upsert('collections', { ...c, special: 'quran', name: t('col.quran') });
      }
    }
  }, [lang, s.settings.appTheme, s.ready]);

  // In-app reading reminders (work while the page is open)
  useEffect(() => {
    const check = () => {
      const r = useStore.getState().settings.reminders;
      if (!r.enabled) return;
      const now = new Date();
      if (!r.days.includes(now.getDay())) return;
      const [h, m] = r.time.split(':').map(Number);
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
      const today = dayKey();
      if ((byDay(Object.values(useStore.getState().sessions)).get(today)?.seconds ?? 0) >= 60) return;
      let last = '';
      try { last = localStorage.getItem('ml-reminded') || ''; } catch { /* */ }
      if (last === today) return;
      try { localStorage.setItem('ml-reminded', today); } catch { /* */ }
      setReminder(true);
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification(useStore.getState().t('brand'), { body: useStore.getState().t('rem.now') }); } catch { /* */ }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [sessions.length]);

  // keyboard: "/" focuses search
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,[contenteditable]') && !useStore.getState().readerBookId) { e.preventDefault(); useStore.getState().navigate({ name: 'search' }); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  useEffect(() => {
    const h = () => { const n = location.hash.slice(1); if (n && NAV.some((x) => x.name === n) && useStore.getState().route.name !== n) useStore.getState().navigate({ name: n }); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  if (!s.ready) {
    return <div className="flex h-full items-center justify-center"><div className="flex flex-col items-center gap-3 text-muted"><Logo size={48} /><span>{t('loading')}</span></div></div>;
  }
  if (!s.settings.onboarded) return <><Onboarding /><Toasts /></>;

  const r = s.route;
  const active = parentOf[r.name] ?? r.name;
  const page = (() => {
    switch (r.name) {
      case 'books': return <BooksPage />;
      case 'continue': return <ContinuePage />;
      case 'authors': return <AuthorsPage />;
      case 'author': return <AuthorPage name={r.id!} />;
      case 'world': return <WorldPage />;
      case 'countries': return <CountriesPage />;
      case 'map': return <Suspense fallback={<div className="text-muted">{t('loading')}</div>}><WorldMapPage /></Suspense>;
      case 'favorites': return <FavoritesPage />;
      case 'country': return <CountryPage id={r.id!} />;
      case 'genres': return <GenresPage />;
      case 'genre': return <GenrePage id={r.id!} />;
      case 'tag': return <GenrePage id={r.id!} tag />;
      case 'collections': return <CollectionsPage />;
      case 'collection': return <CollectionPage id={r.id!} />;
      case 'journal': return <JournalPage />;
      case 'notes': return <NotesPage />;
      case 'stats': return <StatsPage />;
      case 'discover': return <DiscoverPage />;
      case 'import': return <ImportPage />;
      case 'settings': return <SettingsPage />;
      case 'book': return <BookPage id={r.id!} />;
      case 'search': return <SearchPage initial={r.q} />;
      default: return <HomePage />;
    }
  })();
  const isSub = !!parentOf[r.name] || r.name === 'search';
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const toggleTheme = () => s.setSettings({ appTheme: document.documentElement.classList.contains('dark') ? 'light' : 'dark' });

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-e border-line bg-paper/60 lg:flex">
        <button type="button" onClick={() => s.navigate({ name: 'home' })} className="flex items-center gap-3 px-5 pb-4 pt-5 text-start">
          <Logo />
          <span><span className="serif block text-xl font-semibold leading-none">{t('brand')}</span><span className="text-xs text-muted">{t('tagline')}</span></span>
        </button>
        <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4" aria-label={t('nav.sections')}>
          {NAV_GROUPS.map((g, gi) => (
            <div key={g.id} className={gi ? 'mt-3' : ''}>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('navg.' + g.id)}</div>
              {g.items.map((name) => { const Icon = NAV.find((x) => x.name === name)!.icon; return (
                <button key={name} type="button" onClick={() => s.navigate({ name })} aria-current={active === name ? 'page' : undefined}
                  className={`mb-0.5 flex min-h-[36px] w-full items-center gap-3 rounded-lg px-3 text-start text-[15px] transition-colors ${active === name ? 'bg-forest text-ivory' : 'hover:bg-line/60'}`}>
                  <Icon size={18} strokeWidth={1.8} />{t('nav.' + name)}
                </button>
              ); })}
            </div>
          ))}
          {pinned.length > 0 && <div className="mx-3 mb-1 mt-4 h-px bg-line" />}
          {pinned.map((c) => (
            <button key={c.id} type="button" onClick={() => s.navigate({ name: 'collection', id: c.id })}
              className={`mb-0.5 flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 text-start text-[15px] ${r.name === 'collection' && r.id === c.id ? 'bg-forest text-ivory' : 'hover:bg-line/60'}`}>
              <Pin size={16} strokeWidth={1.8} /><span className="truncate" dir="auto">{c.name}</span>
            </button>
          ))}
        </nav>
        <div className="px-4"><InstallButton compact /></div>
        <SyncBadge />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center gap-2 border-b border-line bg-ivory/90 px-3 py-2 backdrop-blur sm:px-5">
          {isSub ? (
            <IconButton label={t('back')} onClick={() => s.back()}><Back size={20} /></IconButton>
          ) : (
            <button type="button" className="flex items-center gap-2 lg:hidden" onClick={() => s.navigate({ name: 'home' })}><Logo size={30} /><span className="serif text-lg font-semibold">{t('brand')}</span></button>
          )}
          <button type="button" onClick={() => s.navigate({ name: 'search' })} className="ms-auto hidden min-h-[40px] w-full max-w-sm items-center gap-2 rounded-full border border-line bg-card px-4 text-start text-sm text-muted sm:flex lg:ms-0">
            <SearchIcon size={16} />{t('search.placeholder')}<kbd className="ms-auto rounded border border-line px-1.5 text-[11px]">/</kbd>
          </button>
          <div className="ms-auto flex items-center gap-1">
            <InstallIcon />
            <IconButton className="sm:hidden" label={t('nav.search')} onClick={() => s.navigate({ name: 'search' })}><SearchIcon size={20} /></IconButton>
            <IconButton label={t('set.theme')} onClick={toggleTheme}>{document.documentElement.classList.contains('dark') ? <Sun size={19} /> : <Moon size={19} />}</IconButton>
            <button type="button" onClick={() => s.setSettings({ lang: lang === 'ar' ? 'en' : 'ar' })} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-line px-3 text-sm hover:bg-paper" aria-label={t('set.language')}>
              <Languages size={16} />{lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
        </header>

        {!storageAvailable && <div className="bg-wine px-4 py-2 text-sm text-ivory">{t('err.storage')}</div>}
        {reminder && (
          <div className="flex items-center gap-3 bg-forest px-4 py-2 text-sm text-ivory">
            <Bell size={16} /><span className="flex-1">{t('rem.now')}</span>
            <button type="button" className="underline" onClick={() => { setReminder(false); s.navigate({ name: 'continue' }); }}>{t('home.continue')}</button>
            <button type="button" aria-label={t('close')} onClick={() => setReminder(false)}><X size={16} /></button>
          </div>
        )}

        <main id="main-scroll" className="scroll-thin relative flex-1 overflow-y-auto pb-24 lg:pb-10">
          <div key={r.name + (r.id || '')} className="fade-in mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-8 sm:py-8">{page}</div>
        </main>

        {/* Bottom nav (phones/tablets) */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={t('nav.sections')}>
          {(['home', 'books', 'continue', 'discover'] as const).map((n) => {
            const Icon = NAV.find((x) => x.name === n)!.icon;
            return (
              <button key={n} type="button" onClick={() => s.navigate({ name: n })} className={`flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${active === n ? 'text-forest font-semibold' : 'text-muted'}`}>
                <Icon size={21} strokeWidth={active === n ? 2.2 : 1.8} /><span className="max-w-full truncate px-1">{t('nav.' + n)}</span>
              </button>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className="flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] text-muted">
            <MoreHorizontal size={21} /><span>{t('nav.more')}</span>
          </button>
        </nav>
        {moreOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setMoreOpen(false)}>
            <div className="fade-in absolute inset-x-0 bottom-0 rounded-t-2xl bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
              <div className="scroll-thin max-h-[70vh] overflow-y-auto">
                {[...NAV_GROUPS.map((g) => ({ id: g.id, items: g.items.filter((n) => !['home', 'books', 'continue', 'discover'].includes(n)).map((n) => ({ name: n, icon: NAV.find((x) => x.name === n)!.icon as any, label: t('nav.' + n), go: () => s.navigate({ name: n }) })) })),
                  ...(pinned.length ? [{ id: 'pinned', items: pinned.map((c) => ({ name: c.id, icon: Pin as any, label: c.name, go: () => s.navigate({ name: 'collection', id: c.id }) })) }] : [])].filter((g) => g.items.length).map((g) => (
                  <div key={g.id} className="mb-3">
                    <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('navg.' + g.id)}</div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {g.items.map(({ name, icon: Icon, label, go }) => (
                        <button key={name} type="button" onClick={() => { go(); setMoreOpen(false); }} className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl bg-paper/70 px-1 text-center text-xs">
                          <Icon size={20} strokeWidth={1.8} /><span className="line-clamp-2" dir="auto">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3"><SyncBadge /></div>
            </div>
          </div>
        )}
      </div>

      {s.readerBookId && <Suspense fallback={<div className="fixed inset-0 z-[70] flex items-center justify-center bg-ivory">{t('loading')}</div>}><Reader key={s.readerBookId} bookId={s.readerBookId} /></Suspense>}
      <Toasts />
    </div>
  );
}

function SyncBadge() {
  const t = useT();
  const cloud = useCloud((c) => c.status);
  const claudeSync = useStore((s) => s.syncState);
  const st = cloud !== 'off' && cloud !== 'error' ? (cloud === 'connecting' ? 'connecting' : cloud) : claudeSync;
  const label = st === 'on' ? t('set.syncOn') : st === 'syncing' || st === 'connecting' ? t('set.syncing') : t('storage.local');
  return (
    <div className="flex items-center gap-2 px-5 py-3 text-xs text-muted">
      <span className={`h-2 w-2 rounded-full ${st === 'on' ? 'bg-forest' : st === 'syncing' || st === 'connecting' ? 'animate-pulse bg-[#c9a46b]' : 'bg-line'}`} />{label}
    </div>
  );
}
