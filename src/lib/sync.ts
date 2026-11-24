// Optional cloud sync of reading data (not book files) through the Claude artifact `db` capability.
// Layout: data/users/<uid>/lib/<kind>/<id>  (sessions are bucketed per month to stay small)
import { useStore, onLocalChange } from '../store';
import { RECORD_KINDS, type RecordKind } from './storage';
import { useCap, isHostedByClaude } from './claude';

const SHARDS = 16;
let db: any = null;
let root: any = null;
const dirty = new Map<string, { kind: RecordKind; id: string }>();
let timer: any = null;
let pushing = false;
let lastPull = 0;

const shardOf = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h) % SHARDS; };
const monthOf = (day: string) => 'm' + day.slice(0, 7);

function strip(kind: RecordKind, r: any) {
  if (kind === 'books') { const { toc, ...rest } = r; return rest; }
  return r;
}

export async function startSync() {
  const st = useStore.getState();
  if (!st.settings.sync || !isHostedByClaude()) { useStore.setState({ syncState: 'off' }); return; }
  useStore.setState({ syncState: 'connecting' });
  const [dbc, user] = await Promise.all([useCap('db'), useCap('user')]);
  const id = user ? await user.id().catch(() => null) : null;
  if (!dbc || !id) { useStore.setState({ syncState: 'unavailable' }); return; }
  db = dbc;
  try {
    root = db.doc(`data/users/${id}/lib`);
    await pull();
    useStore.setState({ syncState: 'on' });
  } catch (e) {
    console.warn('sync failed', e);
    db = null;
    useStore.setState({ syncState: 'unavailable' });
    return;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastPull > 60000) pull().catch(() => {});
    if (document.visibilityState === 'hidden') flush();
  });
}

onLocalChange((kind, rec) => {
  if (!db) return;
  const key = kind === 'sessions' ? `sessions/${monthOf(rec.day)}` : `${kind}/${rec.id}`;
  dirty.set(key, { kind, id: kind === 'sessions' ? monthOf(rec.day) : rec.id });
  clearTimeout(timer);
  timer = setTimeout(flush, 4000);
});

export async function pull() {
  if (!root) return;
  useStore.setState({ syncState: 'syncing' });
  lastPull = Date.now();
  const st = useStore.getState();
  for (const kind of RECORD_KINDS) {
    const col = root.collection(kind);
    const remote: any[] = [];
    if (kind === 'sessions') {
      const snap = await col.limit(1000).get();
      for (const d of snap.docs) remote.push(...(((d.data()?.items as any[]) ?? [])));
    } else {
      for (let s = 0; s < SHARDS; s++) {
        const snap = await col.where('_s', '==', s).limit(1000).get();
        for (const d of snap.docs) { const v = d.data(); if (v?.r) remote.push(v.r); }
      }
    }
    const localMap: Record<string, any> = (st as any)[kind];
    const newer = remote.filter((r) => !localMap[r.id] || (r.updatedAt ?? 0) > (localMap[r.id].updatedAt ?? 0));
    useStore.getState().applyRemote(kind, newer);
    const remoteIds = new Map(remote.map((r) => [r.id, r.updatedAt ?? 0]));
    for (const r of Object.values(localMap)) {
      if (!remoteIds.has(r.id) || (r.updatedAt ?? 0) > (remoteIds.get(r.id) ?? 0)) {
        const key = kind === 'sessions' ? `sessions/${monthOf(r.day)}` : `${kind}/${r.id}`;
        dirty.set(key, { kind, id: kind === 'sessions' ? monthOf(r.day) : r.id });
      }
    }
  }
  await flush();
  useStore.setState({ syncState: 'on' });
}

export async function flush() {
  if (!root || pushing || !dirty.size) return;
  pushing = true;
  try {
    const st = useStore.getState();
    const items = [...dirty.entries()];
    dirty.clear();
    for (const [, { kind, id }] of items) {
      try {
        if (kind === 'sessions') {
          const list = Object.values(st.sessions).filter((x) => monthOf(x.day) === id);
          await root.collection('sessions').doc(id).set({ items: list });
        } else {
          const rec = (st as any)[kind][id];
          if (!rec) continue;
          await root.collection(kind).doc(id).set({ _s: shardOf(id), r: strip(kind, rec) });
        }
      } catch (e: any) {
        if (e?.code === 'unavailable') dirty.set(`${kind}/${id}`, { kind, id });
        else console.warn('sync write', kind, id, e);
        if (e?.code === 'revoked' || e?.code === 'not_granted') { root = null; useStore.setState({ syncState: 'unavailable' }); break; }
      }
    }
  } finally {
    pushing = false;
    if (dirty.size) { clearTimeout(timer); timer = setTimeout(flush, 8000); }
  }
}
