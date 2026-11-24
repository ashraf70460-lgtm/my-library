import { useEffect, useState } from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';
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
