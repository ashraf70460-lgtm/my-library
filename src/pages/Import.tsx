import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Copy as CopyIcon, FileUp, FolderOpen, Link2, Loader2, Send, XCircle, RefreshCw, Download, HardDrive } from 'lucide-react';
import { useStore, useT, useLang, useBooks } from '../store';
import { Button, Card, Field, PageTitle, ProgressBar, SectionHeader, Toggle, Watermark } from '../components/ui';
import { Shelf } from '../components/books';
import { enqueue, filesFromDrop, filesFromInput, importFromUrl, useImport, type ImportItem } from '../lib/importer';
import { tgCheck, tgDownload, tgFetch, tgState, tgSave, type TgFile } from '../lib/net';
import { isHostedByClaude } from '../lib/claude';
import { storageEstimate } from '../lib/storage';

const fmtSize = (n: number) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');

export default function ImportPage() {
  const t = useT();
  const s = useStore();
  const { items, running, lastBatch } = useImport();
  const [over, setOver] = useState(false);
  const folderRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => { storageEstimate().then(setEst); }, [items.length, running]);
  useEffect(() => { if (s.route.id === 'url') document.getElementById('url-import')?.scrollIntoView({ behavior: 'smooth' }); }, [s.route.id]);
  const books = s.books;
  const batch = lastBatch.map((id) => books[id]).filter((b) => b && !b.deleted);
  const counts = { a: items.filter((i) => i.status === 'done' || i.status === 'relinked').length, d: items.filter((i) => i.status === 'duplicate').length, f: items.filter((i) => i.status === 'failed').length };
  const pending = items.filter((i) => i.status === 'waiting' || i.status === 'reading').length;
  const total = items.filter((i) => i.status !== 'unsupported').length;
  const prefs = s.settings.importPrefs;
  const setPrefs = (p: Partial<typeof prefs>) => s.setSettings({ importPrefs: { ...prefs, ...p } });

  return (
    <div>
      <PageTitle title={t('imp.title')} sub={t('imp.formats')} />
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={async (e) => { e.preventDefault(); setOver(false); enqueue(await filesFromDrop(e.dataTransfer)); }}
        className={`relative mb-6 flex flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${over ? 'border-forest bg-forest/5' : 'border-line bg-card'}`}>
        <Watermark className="-bottom-6 start-1/2 -translate-x-1/2 rtl:translate-x-1/2" size={90} />
        <FileUp size={40} className="relative mb-3 text-forest" />
        <div className="serif relative mb-1 text-2xl font-semibold">{t('imp.drop')}</div>
        <div className="relative mb-5 text-muted">{t('imp.or')}</div>
        <div className="relative flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={() => fileRef.current?.click()}><FileUp size={18} />{t('imp.files')}</Button>
          <Button onClick={() => folderRef.current?.click()}><FolderOpen size={18} />{t('imp.folder')}</Button>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" accept=".epub,.pdf,.txt,.fb2,.html,.htm,.xhtml,.md,.markdown,.mobi,.azw,.azw3" onChange={(e) => { enqueue(filesFromInput(e.target.files)); e.target.value = ''; }} />
        <input ref={folderRef} type="file" multiple className="hidden" {...({ webkitdirectory: '', directory: '' } as any)} onChange={(e) => { enqueue(filesFromInput(e.target.files)); e.target.value = ''; }} />
        <p className="relative mt-5 max-w-lg text-xs text-muted">{t('imp.unsupported')}</p>
      </div>

      {total > 0 && (
        <Card className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t('imp.queue')}</h2>
            <span className="text-sm text-muted">{t('imp.summary', counts)}</span>
          </div>
          {running && <ProgressBar value={(total - pending) / Math.max(1, total)} className="mb-3" />}
          <p className="mb-3 text-xs text-muted">{t('imp.batch')}</p>
          <div className="scroll-thin max-h-72 overflow-y-auto">
            {items.slice(0, 300).map((i) => <QueueRow key={i.key} i={i} />)}
          </div>
        </Card>
      )}

      {batch.length > 0 && (
        <section className="mb-8">
          <SectionHeader title={t('imp.afterTitle')} sub={t('bd.enrichHint')} />
          <Shelf books={batch} />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">{t('imp.folderRules')}</h2>
          <Toggle checked={prefs.folderRules} onChange={(v) => setPrefs({ folderRules: v })} label={t('imp.rulesOn')} hint={t('imp.rulesHint')} />
          {prefs.folderRules && (
            <div className="mt-2">
              <Toggle checked={prefs.categoryFromFolder} onChange={(v) => setPrefs({ categoryFromFolder: v })} label={t('imp.catFromFolder')} />
              <Toggle checked={prefs.authorFromFolder} onChange={(v) => setPrefs({ authorFromFolder: v })} label={t('imp.authorFromFolder')} />
              <Field label={t('imp.newFolders')}><input className="field" dir="auto" value={prefs.newFolderNames} onChange={(e) => setPrefs({ newFolderNames: e.target.value })} /></Field>
              <Field label={t('imp.quranFolders')}><input className="field" dir="auto" value={prefs.quranFolderNames} onChange={(e) => setPrefs({ quranFolderNames: e.target.value })} /></Field>
            </div>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><HardDrive size={18} />{t('imp.storage')}</h2>
            <p className="text-sm text-muted">{t('set.whereBody')}</p>
            {est && est.quota > 0 && <><ProgressBar value={est.usage / est.quota} className="mt-3" /><p className="mt-1 text-xs text-muted">{t('imp.used', { u: fmtSize(est.usage), q: fmtSize(est.quota) })}</p></>}
          </Card>
          <UrlImport />
        </div>
      </div>
      <Telegram />
    </div>
  );
}

function QueueRow({ i }: { i: ImportItem }) {
  const t = useT();
  const s = useStore();
  const icon = { waiting: <Loader2 size={16} className="text-muted" />, reading: <Loader2 size={16} className="animate-spin text-forest" />, done: <CheckCircle2 size={16} className="text-forest" />, relinked: <CheckCircle2 size={16} className="text-forest" />, duplicate: <CopyIcon size={16} className="text-brown" />, failed: <XCircle size={16} className="text-wine" />, unsupported: <AlertCircle size={16} className="text-wine" /> }[i.status];
  const label = { waiting: t('imp.waiting'), reading: t('imp.reading'), done: t('imp.done'), relinked: t('imp.done'), duplicate: t('imp.duplicate'), failed: t('imp.failed'), unsupported: t('imp.skipped') }[i.status];
  return (
    <div className="flex items-center gap-3 border-b border-line/60 py-2 text-sm last:border-0">
      {icon}
      <button type="button" disabled={!i.bookId} onClick={() => i.bookId && s.navigate({ name: 'book', id: i.bookId })} className="min-w-0 flex-1 text-start">
        <span className="block truncate" dir="auto">{i.name}</span>
        {i.path !== i.name && <span className="block truncate text-xs text-muted" dir="auto">{i.path}</span>}
        {i.error && <span className="block truncate text-xs text-wine">{i.error}</span>}
        {i.status === 'unsupported' && <span className="block text-xs text-wine">{t('imp.unsupported')}</span>}
      </button>
      <span className="shrink-0 text-xs text-muted">{label} · {fmtSize(i.size)}</span>
    </div>
  );
}

function UrlImport() {
  const t = useT();
  const [url, setUrl] = useState('');
  const [p, setP] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const go = async () => {
    setMsg(null);
    try { new URL(url); } catch { setMsg({ ok: false, text: 'URL?' }); return; }
    if (!confirm) { setConfirm(true); return; }
    setConfirm(false); setP(0);
    try { await importFromUrl(url, setP); setMsg({ ok: true, text: t('imp.done') }); setUrl(''); }
    catch (e: any) { setMsg({ ok: false, text: e instanceof TypeError && isHostedByClaude() ? t('imp.netBlocked') : `${t('imp.failed')}: ${e?.message || e}` }); }
    finally { setP(null); }
  };
  return (
    <Card>
      <div id="url-import" className="-mt-20 pt-20" />
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Link2 size={18} />{t('imp.url')}</h2>
      <p className="mb-3 text-sm text-muted">{t('imp.urlHint')}</p>
      <div className="flex gap-2">
        <input className="field" dir="ltr" type="url" placeholder="https://…/book.epub" value={url} onChange={(e) => { setUrl(e.target.value); setConfirm(false); }} />
        <Button variant="primary" disabled={!url || p !== null} onClick={go}><Download size={16} /></Button>
      </div>
      {confirm && <div className="mt-3 rounded-xl bg-paper p-3 text-sm"><p className="mb-2">{t('imp.urlConfirm')}</p><p className="mb-2 break-all text-xs text-muted" dir="ltr">{url}</p><Button size="sm" variant="primary" onClick={go}>{t('imp.urlFetch')}</Button></div>}
      {p !== null && <ProgressBar value={p} className="mt-3" />}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-forest' : 'text-wine'}`}>{msg.text}</p>}
    </Card>
  );
}

function Telegram() {
  const t = useT();
  const lang = useLang();
  const s = useStore();
  const [token, setToken] = useState(s.settings.telegram.token);
  const [st, setSt] = useState(tgState());
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const known = new Set(useBooks().map((b) => b.fileName));
  const netErr = (e: any) => setErr(e instanceof TypeError && isHostedByClaude() ? t('imp.netBlocked') : String(e?.message || e));
  const save = () => s.setSettings({ telegram: { ...s.settings.telegram, token } });
  const check = async () => { save(); setBusy('check'); setErr(''); try { await tgCheck(token); setSt(tgState()); } catch (e) { netErr(e); } finally { setBusy(''); } };
  const fetchNew = async () => { setBusy('fetch'); setErr(''); try { setSt({ ...(await tgFetch(token)) }); } catch (e) { netErr(e); } finally { setBusy(''); } };
  const setFile = (key: string, patch: Partial<TgFile>) => { const cur = tgState(); cur.files = cur.files.map((f) => (f.key === key ? { ...f, ...patch } : f)); tgSave(cur); setSt({ ...cur }); };
  const importFile = async (f: TgFile) => {
    if (f.size > 20 * 1024 * 1024) { setFile(f.key, { status: 'too-big' }); return; }
    setFile(f.key, { status: 'downloading', error: undefined });
    try { const blob = await tgDownload(token, f); enqueue([{ file: blob, name: f.name, path: `Telegram/${f.chat}/${f.name}` }]); setFile(f.key, { status: 'imported' }); }
    catch (e: any) { setFile(f.key, { status: 'failed', error: e instanceof TypeError && isHostedByClaude() ? t('imp.netBlocked') : String(e?.message || e) }); }
  };
  const importAll = async () => { for (const f of st.files.filter((x) => !x.status || x.status === 'failed')) await importFile(f); };
  return (
    <section className="mt-10">
      <SectionHeader title={<span className="flex items-center gap-2"><Send size={20} />{t('imp.telegram')}</span>} sub={t('tg.intro')} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <h3 className="mb-2 font-semibold">{t('tg.how')}</h3>
          <ol className="mb-4 list-decimal space-y-1.5 ps-5 text-sm">{['tg.s1', 'tg.s2', 'tg.s3', 'tg.s4'].map((k) => <li key={k}>{t(k)}</li>)}</ol>
          <Field label={t('tg.token')} hint={t('tg.tokenHint')}><input className="field" dir="ltr" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AA…" /></Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={!token || !!busy} onClick={check}>{busy === 'check' ? <Loader2 size={16} className="animate-spin" /> : null}{t('tg.check')}</Button>
            <Button disabled={!token || !!busy} onClick={fetchNew}>{busy === 'fetch' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}{t('tg.fetch')}</Button>
          </div>
          {st.bot && <p className="mt-3 text-sm text-forest">{t('tg.connected', { u: st.bot })}</p>}
          {err && <p className="mt-3 text-sm text-wine">{err}</p>}
          <p className="mt-4 rounded-xl bg-paper/70 p-3 text-xs leading-relaxed text-muted">{t('tg.limits')}</p>
          <div className="mt-4 text-sm"><div className="mb-1 font-semibold">{t('tg.alt')}</div><ul className="list-disc space-y-1 ps-5 text-muted"><li>{t('tg.alt1')}</li><li>{t('tg.alt2')}</li></ul></div>
        </Card>
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{t('tg.files')} · {st.files.length}</h3>
            {st.files.some((f) => !f.status) && <Button size="sm" variant="primary" onClick={importAll}>{t('tg.importAll')}</Button>}
          </div>
          {Object.keys(st.chats).length > 0 && <p className="mb-3 text-xs text-muted">{t('tg.chats')}: {Object.values(st.chats).join(' · ')}</p>}
          {!st.files.length ? <p className="text-sm text-muted">{t('tg.noFiles')}</p> : (
            <div className="scroll-thin max-h-96 overflow-y-auto">
              {st.files.map((f) => (
                <div key={f.key} className="flex items-center gap-3 border-b border-line/60 py-2 text-sm last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate" dir="auto">{f.name}</div>
                    <div className="truncate text-xs text-muted" dir="auto">{f.chat} · {fmtSize(f.size)} · {new Date(f.date).toLocaleDateString(lang)}{known.has(f.name) ? ` · ${t('imp.duplicate')}` : ''}</div>
                    {f.status === 'too-big' && <div className="text-xs text-wine">{t('tg.tooBig')}</div>}
                    {f.status === 'failed' && <div className="text-xs text-wine">{f.error}</div>}
                  </div>
                  {f.status === 'imported' ? <CheckCircle2 size={18} className="text-forest" /> : f.status === 'downloading' ? <Loader2 size={18} className="animate-spin" /> : f.status === 'too-big' ? <AlertCircle size={18} className="text-wine" /> : (
                    <Button size="sm" onClick={() => importFile(f)}>{f.status === 'failed' ? t('retry') : t('tg.import')}</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
