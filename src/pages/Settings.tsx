import { useEffect, useState } from 'react';
import { Download, Upload, Copy, ShieldCheck, Trash2, RefreshCw, Bell, Cloud, Globe } from 'lucide-react';
import { useStore, useT, useLang } from '../store';
import { Button, Card, ConfirmDialog, Field, Modal, PageTitle, Segmented, Toggle } from '../components/ui';
import { Appearance } from '../reader/Appearance';
import { exportJson, exportBooksCsv, exportHistoryCsv, exportNotesMd, fullBackupZip, restoreBackup, wipeEverything } from '../lib/backup';
import { saveFile, isHostedByClaude } from '../lib/claude';
import { isPersisted, requestPersist } from '../lib/storage';
import { pull, startSync } from '../lib/sync';

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <Card className="mb-6"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">{icon}{title}</h2>{children}</Card>;
}

export default function SettingsPage() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const st = s.settings;
  const [copyBox, setCopyBox] = useState<string | null>(null);
  const [wipe, setWipe] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [zipP, setZipP] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  useEffect(() => { isPersisted().then(setPersisted); }, []);
  const stamp = new Date().toISOString().slice(0, 10);
  const offer = async (name: string, text: string, mime: string) => { const ok = await saveFile(name, text, mime); if (!ok) setCopyBox(text); };

  return (
    <div className="max-w-3xl">
      <PageTitle title={t('set.title')} />
      <Section title={t('set.language')}>
        <Segmented value={lang} onChange={(v) => s.setSettings({ lang: v })} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
      </Section>
      <Section title={t('set.theme')}>
        <Segmented value={st.appTheme} onChange={(v) => s.setSettings({ appTheme: v })} options={[{ value: 'light', label: t('set.light') }, { value: 'dark', label: t('set.dark') }, { value: 'system', label: t('set.system') }]} />
      </Section>
      <Section title={t('goal.title')}>
        <Segmented value={st.goal.type} onChange={(v) => s.setSettings({ goal: { ...st.goal, type: v } })} options={[{ value: 'minutes', label: t('goal.minutes') }, { value: 'pages', label: t('goal.pages') }, { value: 'chapters', label: t('goal.chapters') }]} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(st.goal.type === 'minutes' ? [10, 20, 30, 45, 60] : st.goal.type === 'pages' ? [10, 20, 30, 50] : [1, 2, 3]).map((n) => <Button key={n} size="sm" variant={st.goal.value === n ? 'primary' : 'outline'} onClick={() => s.setSettings({ goal: { ...st.goal, value: n } })}>{n}</Button>)}
          <input className="field !w-24" type="number" min={0} value={st.goal.value} onChange={(e) => s.setSettings({ goal: { ...st.goal, value: Math.max(0, Number(e.target.value)) } })} aria-label={t('goal.custom')} />
        </div>
        <Field label={t('set.yearGoal')}><input className="field !w-28" type="number" min={1} value={st.booksPerYear} onChange={(e) => s.setSettings({ booksPerYear: Math.max(1, Number(e.target.value)) })} /></Field>
      </Section>
      <Section title={t('rem.title')} icon={<Bell size={18} />}>
        <Toggle checked={st.reminders.enabled} onChange={(v) => s.setSettings({ reminders: { ...st.reminders, enabled: v } })} label={t('rem.enable')} />
        {st.reminders.enabled && (
          <>
            <div className="mb-3 mt-2 flex flex-wrap items-center gap-2">
              {[['rem.morning', '08:00'], ['rem.afternoon', '14:00'], ['rem.evening', '21:00']].map(([k, v]) => <Button key={k} size="sm" variant={st.reminders.time === v ? 'primary' : 'outline'} onClick={() => s.setSettings({ reminders: { ...st.reminders, time: v } })}>{t(k)}</Button>)}
              <input type="time" className="field !w-32" value={st.reminders.time} onChange={(e) => s.setSettings({ reminders: { ...st.reminders, time: e.target.value } })} />
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                const on = st.reminders.days.includes(d);
                const label = new Date(2024, 0, 7 + d).toLocaleDateString(lang, { weekday: 'short' });
                return <button key={d} type="button" onClick={() => s.setSettings({ reminders: { ...st.reminders, days: on ? st.reminders.days.filter((x) => x !== d) : [...st.reminders.days, d] } })} className={`min-h-[36px] rounded-full px-3 text-sm ${on ? 'bg-forest text-ivory' : 'border border-line'}`}>{label}</button>;
              })}
            </div>
            {typeof Notification !== 'undefined' && perm === 'default' && <Button size="sm" variant="outline" onClick={async () => { try { setPerm(await Notification.requestPermission()); } catch { setPerm('denied'); } }}><Bell size={14} />Notifications</Button>}
            <p className="mt-3 text-sm text-muted">{t('rem.note')}</p>
          </>
        )}
      </Section>
      <Section title={t('set.reader')}>
        <Appearance prefs={st.reader} onChange={(p) => s.setSettings({ reader: { ...st.reader, ...p } })} />
      </Section>
      <Section title={`${t('set.sorting')} · ${t('set.bookView')}`}>
        <div className="flex flex-wrap gap-3">
          <select className="field !w-auto" value={st.defaultSort} onChange={(e) => s.setSettings({ defaultSort: e.target.value as any })}>{['added', 'title', 'author', 'progress', 'opened'].map((x) => <option key={x} value={x}>{t('sort.' + x)}</option>)}</select>
          <Segmented value={st.defaultView} onChange={(v) => s.setSettings({ defaultView: v })} options={[{ value: 'grid', label: t('grid') }, { value: 'list', label: t('list') }]} />
        </div>
      </Section>
      <Section title={`${t('set.import')} · ${t('set.metadata')}`}>
        <Toggle checked={st.importPrefs.folderRules} onChange={(v) => s.setSettings({ importPrefs: { ...st.importPrefs, folderRules: v } })} label={t('imp.rulesOn')} hint={t('imp.rulesHint')} />
        <Toggle checked={st.importPrefs.authorFromFolder} onChange={(v) => s.setSettings({ importPrefs: { ...st.importPrefs, authorFromFolder: v } })} label={t('imp.authorFromFolder')} />
        <p className="mt-2 text-sm text-muted">{t('bd.enrichHint')}</p>
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => s.navigate({ name: 'import' })}>{t('imp.folderRules')} →</Button>
      </Section>
      <Section title={t('set.backup')} icon={<Download size={18} />}>
        <p className="mb-4 text-sm text-muted">{t('set.backupNote')}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => offer(`my-library-${stamp}.json`, exportJson(), 'application/json')}>{t('set.exportJson')}</Button>
          <Button size="sm" onClick={() => offer(`my-library-books-${stamp}.csv`, exportBooksCsv(), 'text/csv')}>{t('set.exportCsv')}</Button>
          <Button size="sm" onClick={() => offer(`my-library-notes-${stamp}.md`, exportNotesMd(), 'text/markdown')}>{t('set.exportNotes')}</Button>
          <Button size="sm" onClick={() => offer(`my-library-history-${stamp}.csv`, exportHistoryCsv(), 'text/csv')}>{t('set.exportHistory')}</Button>
          <Button size="sm" disabled={zipP !== null} onClick={async () => { setZipP(0); try { const z = await fullBackupZip(setZipP); const ok = await saveFile(`my-library-full-${stamp}.zip`, z); if (!ok) setMsg(t('set.copyInstead')); } finally { setZipP(null); } }}>{zipP !== null ? `${Math.round(zipP * 100)}%` : t('set.fullBackup')}</Button>
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-1 font-medium">{t('set.restore')}</div>
          <p className="mb-3 text-sm text-muted">{t('set.restoreHint')}</p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:bg-paper"><Upload size={16} />{t('set.restore')}
            <input type="file" accept=".json,.zip" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const n = await restoreBackup(f); setMsg(t('set.restarted', { n })); } catch (err: any) { setMsg(String(err?.message || err)); } e.target.value = ''; }} />
          </label>
        </div>
        {msg && <p className="mt-3 text-sm text-forest">{msg}</p>}
      </Section>
      <Section title={t('set.data')} icon={<ShieldCheck size={18} />}>
        <h3 className="mb-1 font-medium">{t('set.where')}</h3>
        <p className="mb-3 text-sm text-muted">{t('set.whereBody')}</p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {persisted ? <span className="text-sm text-forest">✓ {t('set.persisted')}</span> : <Button size="sm" variant="outline" onClick={async () => setPersisted(await requestPersist())}>{t('set.persist')}</Button>}
        </div>
        <div className="mb-4 rounded-xl bg-paper/60 p-4">
          <Toggle checked={st.sync} onChange={(v) => { s.setSettings({ sync: v }); if (v) startSync(); else useStore.setState({ syncState: 'off' }); }} label={<span className="flex items-center gap-2"><Cloud size={16} />{t('set.sync')}</span>} hint={t('set.syncHint')} />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className={s.syncState === 'on' ? 'text-forest' : 'text-muted'}>{s.syncState === 'on' ? t('set.syncOn') : s.syncState === 'syncing' || s.syncState === 'connecting' ? t('set.syncing') : st.sync ? t('set.syncOff') : ''}</span>
            {s.syncState === 'on' && <Button size="sm" variant="ghost" onClick={() => pull()}><RefreshCw size={14} />{t('set.syncNow')}</Button>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => s.setSettings({ onboarded: false })}>{t('set.onboarding')}</Button>
          <Button size="sm" variant="danger" onClick={() => setWipe(true)}><Trash2 size={14} />{t('set.clearAll')}</Button>
        </div>
      </Section>
      <Section title={t('set.privacy')}>
        <p className="text-sm leading-relaxed text-muted">{t('set.privacyBody')}</p>
        {isHostedByClaude() && <div className="mt-4 rounded-xl bg-paper/60 p-4 text-sm"><div className="mb-1 flex items-center gap-2 font-medium"><Globe size={16} />{t('set.selfHost')}</div><p className="text-muted">{t('set.selfHostBody')}</p></div>}
      </Section>
      <ConfirmDialog open={wipe} onClose={() => setWipe(false)} text={t('set.clearConfirm')} requireText="DELETE" onConfirm={() => wipeEverything()} />
      <Modal open={copyBox !== null} onClose={() => setCopyBox(null)} title={t('download')} wide footer={<Button variant="primary" onClick={() => navigator.clipboard?.writeText(copyBox || '').then(() => s.toast(t('copied')), () => {})}><Copy size={16} />{t('copy')}</Button>}>
        <p className="mb-2 text-sm text-muted">{t('set.copyInstead')}</p>
        <textarea readOnly className="field !min-h-[300px] font-mono text-xs" dir="ltr" value={copyBox || ''} onFocus={(e) => e.target.select()} />
      </Modal>
    </div>
  );
}
