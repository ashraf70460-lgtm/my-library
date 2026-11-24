// Wrappers for the hosting page's optional capabilities (Claude artifacts runtime).
// Every function degrades gracefully when the capability is absent (e.g. self-hosted).

declare global {
  interface Window { claude?: { use: (name: string) => Promise<any> } }
}

const cache: Record<string, Promise<any> | undefined> = {};

export function useCap<T = any>(name: string, timeoutMs = 10000): Promise<T | null> {
  const hit = cache[name];
  if (hit) return hit;
  cache[name] = new Promise((resolve) => {
    let done = false;
    const finish = (v: any) => { if (!done) { done = true; resolve(v ?? null); } };
    setTimeout(() => finish(null), timeoutMs);
    const tryUse = (attempt: number) => {
      const c = window.claude;
      if (c?.use) {
        c.use(name).then(finish, () => finish(null));
      } else if (attempt < 20) {
        setTimeout(() => tryUse(attempt + 1), 250);
      } else finish(null);
    };
    tryUse(0);
  });
  return cache[name]!;
}

export async function askClaude(prompt: string, opts: { json?: boolean; onText?: (t: string) => void; tier?: 'quick' | 'default' | 'complex' } = {}): Promise<any> {
  const sample = await useCap<any>('sample', 6000);
  if (!sample) throw new Error('unavailable');
  if (opts.json && sample.json) return sample.json(prompt, { modelTier: opts.tier ?? 'default' });
  const r = await sample(prompt, { modelTier: opts.tier ?? 'default', onText: opts.onText ? ({ text }: { text: string }) => opts.onText!(text) : undefined });
  return r.text as string;
}

/** Offer a file to the viewer. Returns true if delivered, false if no download route exists here. */
export async function saveFile(filename: string, data: Blob | string, mime = 'application/octet-stream'): Promise<boolean> {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
  const dl = await useCap<any>('downloads', 3000);
  if (dl) {
    try { await dl.save({ filename, data: blob }); return true; } catch (e: any) {
      if (e?.code === 'declined' || e?.code === 'cancelled') return true;
    }
  }
  if (isHostedByClaude()) return false;
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch { return false; }
}

export function isHostedByClaude() {
  try {
    return window.self !== window.top || /claude|anthropic|claudeusercontent/.test(location.hostname);
  } catch { return true; }
}

/** Network calls to other sites are blocked when hosted by Claude. */
export async function canReachNetwork(): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch('https://openlibrary.org/search.json?q=test&limit=1', { signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}
