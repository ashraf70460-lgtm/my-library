// My Library cloud shelf: private Vercel Blob storage shared by your devices, protected by LIBRARY_PASSCODE.
import { get, put, del, list } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

const ROOT = 'library';
const STATE = `${ROOT}/state.json`;
const KINDS = ['books', 'annotations', 'sessions', 'journal', 'collections', 'authors', 'challenges', 'wishlist'];

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
const clean = (s: string | null | undefined) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function authorized(key: string | null | undefined) {
  const expected = clean(process.env.LIBRARY_PASSCODE);
  const given = clean(key);
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

async function readJson(pathname: string): Promise<any> {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

const safeHash = (h: string | null) => (h && /^[a-zA-Z0-9]{6,80}$/.test(h) ? h : null);

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url, 'https://localhost');
  const op = url.searchParams.get('op');
  try {
    if (op === 'upload' && request.method === 'POST') {
      const body = (await request.json()) as HandleUploadBody;
      const result = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          if (!authorized(clientPayload)) throw new Error('Wrong library passcode');
          if (!/^library\/books\/[a-zA-Z0-9]{6,80}$/.test(pathname)) throw new Error('Invalid path');
          return { maximumSizeInBytes: 400 * 1024 * 1024, addRandomSuffix: false, allowOverwrite: true };
        },
        onUploadCompleted: async () => {},
      });
      return json(result);
    }

    if (!authorized(request.headers.get('x-library-key'))) {
      await new Promise((r) => setTimeout(r, 600));
      return json({ error: 'unauthorized', configured: !!process.env.LIBRARY_PASSCODE }, 401);
    }

    switch (op) {
      case 'ping':
        return json({ ok: true });

      case 'state': {
        if (request.method === 'GET') return json((await readJson(STATE)) || {});
        // merge incoming records (last write wins per record)
        const incoming = (await request.json()) as Record<string, any[]>;
        const state: Record<string, Record<string, any>> = (await readJson(STATE)) || {};
        let changed = 0;
        for (const kind of KINDS) {
          const recs = incoming[kind];
          if (!Array.isArray(recs)) continue;
          const map = (state[kind] ||= {});
          for (const r of recs) {
            if (!r || typeof r.id !== 'string') continue;
            const cur = map[r.id];
            if (!cur || (r.updatedAt || 0) >= (cur.updatedAt || 0)) { map[r.id] = r; changed++; }
          }
        }
        if (changed) await put(STATE, JSON.stringify(state), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
        return json({ ok: true, changed });
      }

      case 'covers': {
        const n = Number(url.searchParams.get('n'));
        if (!Number.isInteger(n) || n < 0 || n > 15) return json({ error: 'bad shard' }, 400);
        const path = `${ROOT}/covers/${n}.json`;
        if (request.method === 'GET') return json((await readJson(path)) || {});
        const incoming = (await request.json()) as Record<string, string | null>;
        const cur: Record<string, string> = (await readJson(path)) || {};
        for (const [id, v] of Object.entries(incoming)) { if (v) cur[id] = v; else delete cur[id]; }
        await put(path, JSON.stringify(cur), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
        return json({ ok: true });
      }

      case 'file': {
        const hash = safeHash(url.searchParams.get('hash'));
        if (!hash) return json({ error: 'bad hash' }, 400);
        const path = `${ROOT}/books/${hash}`;
        if (request.method === 'DELETE' || url.searchParams.get('delete') === '1') { await del(path); return json({ ok: true }); }
        const r = await get(path, { access: 'private' });
        if (!r || r.statusCode !== 200) return json({ error: 'not found' }, 404);
        return new Response(r.stream, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(r.blob.size ?? ''), 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' } });
      }

      case 'usage': {
        let size = 0, count = 0, cursor: string | undefined;
        do {
          const page = await list({ prefix: `${ROOT}/`, cursor, limit: 1000 });
          for (const b of page.blobs) { size += b.size; count++; }
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
        return json({ size, count });
      }
    }
    return json({ error: 'unknown op' }, 400);
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

export function GET(request: Request) { return handler(request); }
export function POST(request: Request) { return handler(request); }
export function DELETE(request: Request) { return handler(request); }
