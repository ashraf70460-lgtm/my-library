import { useState } from 'react';
import { ArrowLeft, ArrowRight, FileUp, FolderOpen, BookOpen } from 'lucide-react';
import { useStore, useT, useLang, useBooks } from '../store';
import { Button, Logo, ShelfIllustration, Watermark } from '../components/ui';
import { enqueue, filesFromInput, useImport } from '../lib/importer';
import { BookCover } from '../components/books';

export default function Onboarding() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const [step, setStep] = useState(0);
  const books = useBooks();
  const { running, items } = useImport();
  const finish = () => s.setSettings({ onboarded: true });
  const Next = lang === 'ar' ? ArrowLeft : ArrowRight;
  const Prev = lang === 'ar' ? ArrowRight : ArrowLeft;
  const steps = [
    <div key="w" className="text-center">
      <div className="mb-6 flex justify-center"><ShelfIllustration w={220} /></div>
      <h1 className="mb-3 text-[34px] font-semibold leading-tight sm:text-[44px]">{t('ob.welcome')}</h1>
      <p className="mx-auto max-w-md text-lg text-muted">{t('ob.welcomeBody')}</p>
    </div>,
    <div key="l"><h2 className="mb-6 text-center text-3xl font-semibold">{t('ob.lang')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{(['ar', 'en'] as const).map((l) => (
        <button key={l} type="button" onClick={() => s.setSettings({ lang: l })} className={`rounded-2xl border-2 p-6 text-center ${lang === l ? 'border-forest bg-forest/5' : 'border-line bg-card'}`}>
          <div className="serif text-3xl font-semibold" style={{ fontFamily: l === 'ar' ? "'Noto Naskh Arabic',serif" : "'Literata',serif" }}>{l === 'ar' ? 'العربية' : 'English'}</div>
          <div className="mt-1 text-sm text-muted">{l === 'ar' ? 'من اليمين إلى اليسار' : 'Left to right'}</div>
        </button>))}
      </div>
    </div>,
    <div key="a"><h2 className="mb-6 text-center text-3xl font-semibold">{t('ob.look')}</h2>
      <div className="grid gap-3 sm:grid-cols-3">{([['light', '#f6f1e7', '#23211e'], ['dark', '#171a17', '#e9e2d2'], ['system', 'linear-gradient(90deg,#f6f1e7 50%,#171a17 50%)', '#7a5a3a']] as const).map(([k, bg, fg]) => (
        <button key={k} type="button" onClick={() => s.setSettings({ appTheme: k })} className={`overflow-hidden rounded-2xl border-2 text-center ${s.settings.appTheme === k ? 'border-forest' : 'border-line'}`}>
          <div className="serif flex h-24 items-center justify-center text-2xl" style={{ background: bg, color: fg }}>Aa أ</div>
          <div className="bg-card p-3 text-sm">{t(k === 'light' ? 'set.light' : k === 'dark' ? 'set.dark' : 'set.system')}</div>
        </button>))}
      </div>
    </div>,
    <div key="g" className="text-center"><h2 className="mb-2 text-3xl font-semibold">{t('ob.goal')}</h2><p className="mb-6 text-muted">{t('ob.goalBody')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {[0, 10, 20, 30].map((m) => <Button key={m} variant={s.settings.goal.type === 'minutes' && s.settings.goal.value === m ? 'primary' : 'outline'} onClick={() => s.setSettings({ goal: { type: 'minutes', value: m } })}>{m ? `${m} ${t('minutes')}` : t('ob.noGoal')}</Button>)}
        <Button variant={s.settings.goal.type === 'pages' ? 'primary' : 'outline'} onClick={() => s.setSettings({ goal: { type: 'pages', value: 20 } })}>20 {t('pages')}</Button>
      </div>
    </div>,
    <div key="i" className="text-center"><h2 className="mb-2 text-3xl font-semibold">{t('ob.import')}</h2><p className="mb-6 text-muted">{t('imp.formats')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-forest px-5 text-ivory"><FileUp size={18} />{t('imp.files')}<input type="file" multiple className="sr-only" accept=".epub,.pdf,.txt,.fb2,.html,.htm,.md" onChange={(e) => enqueue(filesFromInput(e.target.files))} /></label>
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-paper px-5"><FolderOpen size={18} />{t('imp.folder')}<input type="file" multiple className="sr-only" {...({ webkitdirectory: '' } as any)} onChange={(e) => enqueue(filesFromInput(e.target.files))} /></label>
      </div>
      {(running || items.length > 0) && <p className="mt-4 text-sm text-muted">{t('imp.summary', { a: items.filter((i) => i.status === 'done').length, d: items.filter((i) => i.status === 'duplicate').length, f: items.filter((i) => i.status === 'failed').length })}{running ? ' …' : ''}</p>}
      {books.length > 0 && <div className="mt-5 flex justify-center gap-2">{books.slice(0, 6).map((b) => <BookCover key={b.id} book={b} size="sm" className="w-12" />)}</div>}
    </div>,
    <div key="o" className="text-center"><h2 className="mb-2 text-3xl font-semibold">{t('ob.organize')}</h2><p className="mx-auto mb-6 max-w-md text-muted">{t('ob.organizeBody')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant={s.settings.importPrefs.folderRules ? 'primary' : 'outline'} onClick={() => s.setSettings({ importPrefs: { ...s.settings.importPrefs, folderRules: true } })}>{t('ob.byFolders')}</Button>
        <Button variant={!s.settings.importPrefs.folderRules ? 'primary' : 'outline'} onClick={() => s.setSettings({ importPrefs: { ...s.settings.importPrefs, folderRules: false } })}>{t('ob.manual')}</Button>
      </div>
      <p className="mx-auto mt-4 max-w-md text-xs text-muted">{t('imp.rulesHint')}</p>
    </div>,
    <div key="r" className="text-center"><BookOpen size={44} className="mx-auto mb-4 text-forest" /><h2 className="mb-2 text-3xl font-semibold">{t('ob.read')}</h2><p className="mx-auto max-w-md text-muted">{t('ob.readBody')}</p>
      {books[0] && <Button variant="primary" className="mt-6" onClick={() => { finish(); s.openReader(books[0].id); }}><BookOpen size={18} />{books[0].title}</Button>}
    </div>,
  ];
  const last = step === steps.length - 1;
  return (
    <div className="paper-grain relative flex h-full flex-col overflow-y-auto bg-ivory">
      <Watermark className="bottom-4 start-1/2 -translate-x-1/2 rtl:translate-x-1/2" size={140} />
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2"><Logo size={30} /><span className="serif text-lg font-semibold">{t('brand')}</span></div>
        <button type="button" className="min-h-[44px] px-3 text-sm text-muted hover:text-ink" onClick={finish}>{t('skip')}</button>
      </div>
      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-6"><div key={step} className="fade-in">{steps[step]}</div></div>
      <div className="relative mx-auto flex w-full max-w-2xl items-center justify-between px-5 pb-8">
        <Button variant="ghost" disabled={!step} onClick={() => setStep(step - 1)}><Prev size={18} />{t('back')}</Button>
        <div className="flex gap-1.5">{steps.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-forest' : 'w-1.5 bg-line'}`} />)}</div>
        {last ? <Button variant="primary" onClick={finish}>{t('ob.finish')}</Button> : <Button variant="primary" onClick={() => setStep(step + 1)}>{t('next')}<Next size={18} /></Button>}
      </div>
    </div>
  );
}
