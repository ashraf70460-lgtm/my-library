// Turn a PDF page into readable paragraphs (used by the reader's "Text view").
// Arabic presentation forms are normalised so the reader's own font joins the letters correctly.

export interface PageBlock { type: 'p' | 'h'; text: string }

const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const MIRROR: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '«': '»', '»': '«', '<': '>', '>': '<' };
const ONLY_NUMBER = /^[\s\d٠-٩۰-۹\-–—.()]+$/;

interface Item { str: string; x: number; y: number; w: number; h: number; rtl: boolean }

export function normaliseText(s: string) {
  // NFKC maps Arabic presentation forms (U+FB50–FDFF, U+FE70–FEFF) back to ordinary letters.
  return s.normalize('NFKC').replace(/ـ{2,}/g, 'ـ').replace(/[ \t ]+/g, ' ').trim();
}

export async function pageBlocks(page: any): Promise<PageBlock[]> {
  const tc = await page.getTextContent();
  const items: Item[] = [];
  for (const it of tc.items as any[]) {
    if (typeof it.str !== 'string' || !it.str.trim()) continue;
    const [a, b, c, d, e, f] = it.transform;
    const h = Math.hypot(c, d) || Math.hypot(a, b) || it.height || 10;
    items.push({ str: it.str, x: e, y: f, w: it.width || 0, h, rtl: it.dir === 'rtl' || RTL.test(it.str) });
  }
  if (!items.length) return [];
  const heights = items.map((i) => i.h).sort((p, q) => p - q);
  const medH = heights[Math.floor(heights.length / 2)] || 10;

  // group into lines by baseline
  items.sort((p, q) => q.y - p.y || p.x - q.x);
  const lines: { y: number; h: number; items: Item[] }[] = [];
  for (const it of items) {
    const line = lines.find((l) => Math.abs(l.y - it.y) < Math.max(2, Math.min(l.h, it.h) * 0.45));
    if (line) { line.items.push(it); line.h = Math.max(line.h, it.h); }
    else lines.push({ y: it.y, h: it.h, items: [it] });
  }
  lines.sort((p, q) => q.y - p.y);

  const built = lines.map((l) => {
    const rtlCount = l.items.filter((i) => i.rtl).length;
    const rtl = rtlCount >= l.items.length / 2;
    const its = [...l.items].sort((p, q) => (rtl ? q.x + q.w - (p.x + p.w) : p.x - q.x));
    let text = '';
    let prev: Item | null = null;
    for (const it of its) {
      if (prev) {
        const gap = rtl ? prev.x - (it.x + it.w) : it.x - (prev.x + prev.w);
        if (gap > Math.min(prev.h, it.h) * 0.18 && !text.endsWith(' ') && !it.str.startsWith(' ')) text += ' ';
      }
      text += it.str;
      prev = it;
    }
    const left = Math.min(...l.items.map((i) => i.x));
    const right = Math.max(...l.items.map((i) => i.x + i.w));
    // PDF text in right-to-left lines carries mirrored brackets and quotes; swap them back
    if (rtl) text = text.replace(/[()[\]{}«»<>]/g, (ch) => MIRROR[ch] || ch);
    return { y: l.y, h: l.h, text: normaliseText(text), left, right, rtl };
  }).filter((l) => l.text && !ONLY_NUMBER.test(l.text));
  if (!built.length) return [];

  const maxRight = Math.max(...built.map((l) => l.right));
  const minLeft = Math.min(...built.map((l) => l.left));
  const fullWidth = maxRight - minLeft || 1;
  const gaps: number[] = [];
  for (let i = 1; i < built.length; i++) gaps.push(built[i - 1].y - built[i].y);
  const sortedGaps = [...gaps].sort((p, q) => p - q);
  const medGap = sortedGaps[Math.floor(sortedGaps.length / 2)] || medH * 1.4;

  const blocks: PageBlock[] = [];
  let cur = '';
  const flush = () => { if (cur.trim()) blocks.push({ type: 'p', text: cur.trim() }); cur = ''; };
  built.forEach((l, i) => {
    const isHeading = l.h > medH * 1.25 && l.text.length < 90;
    if (isHeading) { flush(); blocks.push({ type: 'h', text: l.text }); return; }
    const prev = built[i - 1];
    const bigGap = prev && prev.y - l.y > medGap * 1.6;
    // a short previous line (ends well before the margin) usually closes a paragraph
    const prevShort = prev && (prev.rtl ? prev.left - minLeft : maxRight - prev.right) > fullWidth * 0.18;
    const indented = l.rtl ? maxRight - l.right > fullWidth * 0.04 : l.left - minLeft > fullWidth * 0.04;
    if (bigGap || (prevShort && cur) || (indented && cur && i > 0)) flush();
    if (cur && cur.endsWith('-') && !l.rtl) cur = cur.slice(0, -1) + l.text;
    else cur += (cur ? ' ' : '') + l.text;
  });
  flush();
  return blocks;
}
