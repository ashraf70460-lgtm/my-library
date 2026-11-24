import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Upload, Loader2, KeyRound, LogOut } from 'lucide-react';
import { useT, useLang, useBooks } from '../store';
import { useCloud, cloudConfig, connectCloud, disconnectCloud, pullCloud, setAutoUpload, cloudUsage, uploadAllReading, cloudSupported, CLOUD_LIMIT } from '../lib/cloud';
import { Button, Card, Field, ProgressBar, Segmented } from './ui';
import { fmtDate } from '../i18n';

const mb = (n: number) => (n / 1e6).toFixed(n > 1e8 ? 0 : 1) + ' MB';

export function CloudCard() {
  const t = useT();
  const lang = useLang();
  const c = useCloud();
  const books = useBooks();
  const [key, setKey] = useState('');
  const [mode, setMode] = useState(cloudConfig().autoUpload);
  const [busy, setBusy] = useState(false);
  const connected = c.status === 'on' || c.status === 'syncing';
  useEffect(() => { if (connected) cloudUsage(); }, [connected]);
  if (!cloudSupported()) return null;
  const inCloud = books.filter((b) => b.cloud).length;
  const uploading = Object.keys(c.uploads).length;
  return (
    <Card className="mb-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">{connected ? <Cloud size={18} className="text-forest" /> : <CloudOff size={18} />}{t('cloud.title')}</h2>
      <p className="mb-4 text-sm text-muted">{t('cloud.intro')}</p>
      {!connected ? (
        <>
          <Field label={<span className="flex items-center gap-1.5"><KeyRound size={14} />{t('cloud.key')}</span>} hint={t('cloud.keyHint')}>
            <input className="field tracking-widest" dir="ltr" autoComplete="off" autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" value={key} onChange={(e) => setKey(e.target.value)} />
          </Field>
          <Button variant="primary" disabled={!key.trim() || busy || c.status === 'connecting'} onClick={async () => { setBusy(true); await connectCloud(key, mode); setBusy(false); }}>
            {c.status === 'connecting' ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}{t('cloud.connect')}
          </Button>
          {c.status === 'error' && <p className="mt-3 text-sm text-wine">{c.error === 'unauthorized' ? t('cloud.wrongKey') : c.error === 'offline' ? t('cloud.offline') : `${t('cloud.failed')} ${c.error || ''}`}</p>}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-forest">✓ {t('cloud.on')}</span>
            {c.lastSync && <span className="text-muted">{t('cloud.last', { d: fmtDate(lang, c.lastSync, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) })}</span>}
            <span className="text-muted">{t('cloud.inCloud', { n: inCloud })}</span>
            {uploading > 0 && <span className="flex items-center gap-1 text-muted"><Loader2 size={13} className="animate-spin" />{t('cloud.uploading', { n: uploading })}</span>}
          </div>
          {c.usage && (
            <div className="mb-4">
              <ProgressBar value={c.usage.size / CLOUD_LIMIT} color={c.usage.size > CLOUD_LIMIT * 0.85 ? 'bg-wine' : 'bg-forest'} />
              <p className="mt-1 text-xs text-muted">{t('cloud.usage', { u: mb(c.usage.size), q: '1 GB' })}</p>
            </div>
          )}
          <div className="mb-1 text-sm font-medium">{t('cloud.auto')}</div>
          <div className="mb-2"><Segmented value={mode} onChange={(v) => { setMode(v); setAutoUpload(v); }} options={[{ value: 'reading', label: t('cloud.autoReading') }, { value: 'all', label: t('cloud.autoAll') }, { value: 'off', label: t('cloud.autoOff') }]} /></div>
          <p className="mb-4 text-xs text-muted">{t('cloud.autoHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => pullCloud()} disabled={c.status === 'syncing'}><RefreshCw size={14} className={c.status === 'syncing' ? 'animate-spin' : ''} />{t('set.syncNow')}</Button>
            <Button size="sm" variant="outline" onClick={() => uploadAllReading()}><Upload size={14} />{t('cloud.uploadReading')}</Button>
            <Button size="sm" variant="ghost" onClick={disconnectCloud}><LogOut size={14} />{t('cloud.disconnect')}</Button>
          </div>
          {c.error && c.status !== 'error' && <p className="mt-3 text-xs text-wine">{c.error}</p>}
        </>
      )}
      <p className="mt-4 rounded-xl bg-paper/60 p-3 text-xs leading-relaxed text-muted">{t('cloud.limits')}</p>
    </Card>
  );
}

export function CloudProgress({ id }: { id: string }) {
  const up = useCloud((s) => s.uploads[id]);
  const down = useCloud((s) => s.downloads[id]);
  const v = up ?? down;
  if (v == null) return null;
  return <ProgressBar value={v} className="mt-2" />;
}
