import { useEffect, useState } from 'react';
import { Download, Smartphone, CheckCircle2, X, Share } from 'lucide-react';
import { lsGet, lsSet } from '../lib/storage';
import { create } from 'zustand';
import { useT } from '../store';
import { Button, Card } from './ui';
import { isHostedByClaude } from '../lib/claude';

const usePwa = create<{ prompt: any; installed: boolean }>(() => ({ prompt: null, installed: false }));

export function setupPwa() {
  if (isHostedByClaude() || !('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); usePwa.setState({ prompt: e }); });
  window.addEventListener('appinstalled', () => usePwa.setState({ installed: true, prompt: null }));
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function promptInstall() {
  const p = usePwa.getState().prompt;
  if (!p) return false;
  p.prompt();
  const r = await p.userChoice.catch(() => null);
  usePwa.setState({ prompt: null, installed: r?.outcome === 'accepted' });
  return true;
}

export function InstallButton({ compact }: { compact?: boolean }) {
  const t = useT();
  const { prompt } = usePwa();
  if (!prompt || standalone()) return null;
  return <Button size="sm" variant={compact ? 'ghost' : 'primary'} onClick={promptInstall}><Download size={15} />{t('pwa.install')}</Button>;
}

export function InstallCard() {
  const t = useT();
  const { prompt, installed } = usePwa();
  const [isStandalone, setStandalone] = useState(false);
  useEffect(() => setStandalone(standalone()), []);
  if (isHostedByClaude()) return null;
  return (
    <Card className="mb-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Smartphone size={18} />{t('pwa.title')}</h2>
      {isStandalone || installed ? (
        <p className="flex items-center gap-2 text-sm text-forest"><CheckCircle2 size={16} />{t('pwa.done')}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">{t('pwa.body')}</p>
          {prompt ? <Button variant="primary" onClick={promptInstall}><Download size={16} />{t('pwa.install')}</Button> : (
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {isIOS() ? <li>{t('pwa.ios')}</li> : <><li>{t('pwa.chrome')}</li><li>{t('pwa.android')}</li></>}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

/** Friendly banner on the home screen, shown until installed or dismissed. */
export function InstallBanner() {
  const t = useT();
  const { prompt, installed } = usePwa();
  const [hidden, setHidden] = useState(() => lsGet<{ v: boolean }>('ml-install-dismissed', { v: false }).v);
  if (isHostedByClaude() || hidden || installed || standalone()) return null;
  const ios = isIOS();
  if (!prompt && !ios) return null;
  const dismiss = () => { setHidden(true); lsSet('ml-install-dismissed', { v: true }); };
  return (
    <div className="fade-in mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-forest/30 bg-card p-4">
      <img src="./icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-[180px] flex-1">
        <div className="font-semibold">{t('pwa.title')}</div>
        <div className="text-sm text-muted">{ios ? <span className="inline-flex flex-wrap items-center gap-1">{t('pwa.iosShort')} <Share size={14} /></span> : t('pwa.short')}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end">
        {!ios && <Button variant="primary" size="sm" onClick={promptInstall}><Download size={15} />{t('pwa.install')}</Button>}
        <button type="button" aria-label={t('close')} onClick={dismiss} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper"><X size={16} /></button>
      </div>
    </div>
  );
}

export function InstallIcon() {
  const t = useT();
  const { prompt } = usePwa();
  if (!prompt || standalone()) return null;
  return <button type="button" onClick={promptInstall} aria-label={t('pwa.install')} title={t('pwa.install')} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-forest hover:bg-paper lg:hidden"><Download size={20} /></button>;
}
