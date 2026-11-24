// Text-offset based highlighting inside a chapter container.

/** Character offset of (node, offset) from the start of root's text content. */
export function textOffset(root: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.setStart(root, 0);
  try { r.setEnd(node, offset); } catch { return 0; }
  return r.toString().length;
}

/** Find the DOM position for a character offset in root. */
export function domPoint(root: Node, target: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let n: Node | null;
  let last: Text | null = null;
  while ((n = walker.nextNode())) {
    const len = (n as Text).data.length;
    if (pos + len >= target) return { node: n as Text, offset: target - pos };
    pos += len; last = n as Text;
  }
  return last ? { node: last, offset: last.data.length } : null;
}

/** Wrap [start, end) in <mark> elements (split across text nodes as needed). */
export function wrapRange(root: HTMLElement, start: number, end: number, cls: string, id: string, title?: string) {
  if (end <= start) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: { node: Text; s: number; e: number }[] = [];
  let pos = 0;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    const len = t.data.length;
    const a = Math.max(start, pos), b = Math.min(end, pos + len);
    if (a < b && t.data.slice(a - pos, b - pos).trim().length) targets.push({ node: t, s: a - pos, e: b - pos });
    pos += len;
    if (pos >= end) break;
  }
  for (const { node, s, e } of targets) {
    let mid = node;
    if (s > 0) mid = node.splitText(s);
    if (e - s < mid.data.length) mid.splitText(e - s);
    const mark = document.createElement('mark');
    mark.className = cls;
    mark.dataset.hl = id;
    if (title) mark.title = title;
    mid.parentNode!.insertBefore(mark, mid);
    mark.appendChild(mid);
  }
}

export function unwrapAll(root: HTMLElement, selector = 'mark[data-hl]') {
  root.querySelectorAll(selector).forEach((m) => {
    const p = m.parentNode!;
    while (m.firstChild) p.insertBefore(m.firstChild, m);
    p.removeChild(m);
    p.normalize?.();
  });
}
