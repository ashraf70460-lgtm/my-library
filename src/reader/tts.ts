// Read-aloud using the device's own voices (Web Speech API). Works offline where the OS has voices.
import { create } from 'zustand';
import { lsGet, lsSet } from '../lib/storage';

export interface TtsSource {
  units: number; // chapters or pages
  getText: (unit: number) => Promise<string> | string;
  onSentence: (unit: number, start: number, end: number) => void;
  onUnitChange: (unit: number) => void;
  lang: string; // 'ar' | 'en' | ...
}

interface TtsState { status: 'idle' | 'playing' | 'paused'; rate: number; pitch: number; voices: Record<string, string>; supported: boolean }
const saved = lsGet('ml-tts', { rate: 1, pitch: 1, voices: {} as Record<string, string> });
export const useTts = create<TtsState>(() => ({ status: 'idle', ...saved, supported: typeof window !== 'undefined' && 'speechSynthesis' in window }));
useTts.subscribe((s) => lsSet('ml-tts', { rate: s.rate, pitch: s.pitch, voices: s.voices }));

export function listVoices(lang: string): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  const all = speechSynthesis.getVoices();
  const pre = lang.slice(0, 2).toLowerCase();
  const match = all.filter((v) => v.lang.toLowerCase().startsWith(pre));
  return match.sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name));
}
export function onVoicesChanged(cb: () => void) {
  if (!('speechSynthesis' in window)) return () => {};
  speechSynthesis.addEventListener('voiceschanged', cb);
  return () => speechSynthesis.removeEventListener('voiceschanged', cb);
}

export function splitSentences(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const re = /[^.!?؟…\n]+(?:[.!?؟…]+["'»”)\]]*|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!m[0].length) { re.lastIndex++; continue; }
    let s = m.index, e = m.index + m[0].length;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e - s < 1 || !/[\p{L}\p{N}]/u.test(text.slice(s, e))) continue;
    // break very long sentences at commas so voices don't stall
    while (e - s > 260) {
      const slice = text.slice(s, s + 260);
      const cut = Math.max(slice.lastIndexOf('، '), slice.lastIndexOf(', '), slice.lastIndexOf('؛ '), slice.lastIndexOf('; '), slice.lastIndexOf(' '));
      const at = s + (cut > 60 ? cut + 1 : 260);
      out.push({ start: s, end: at });
      s = at; while (s < e && /\s/.test(text[s])) s++;
    }
    out.push({ start: s, end: e });
  }
  return out;
}

let src: TtsSource | null = null;
let unit = 0;
let sentences: { start: number; end: number }[] = [];
let idx = 0;
let text = '';
let token = 0;

async function loadUnit(u: number, fromOffset = 0) {
  unit = u;
  text = String(await src!.getText(u) || '');
  sentences = splitSentences(text);
  idx = Math.max(0, sentences.findIndex((s) => s.end > fromOffset));
  if (idx < 0) idx = 0;
}

function speakNext(my: number) {
  if (my !== token || !src) return;
  if (idx >= sentences.length) {
    if (unit + 1 >= src.units) { stop(); return; }
    loadUnit(unit + 1).then(() => { if (my !== token) return; src!.onUnitChange(unit); speakNext(my); });
    return;
  }
  const s = sentences[idx];
  const u = new SpeechSynthesisUtterance(text.slice(s.start, s.end));
  const st = useTts.getState();
  const lang = src.lang || 'en';
  const voices = listVoices(lang);
  const chosen = voices.find((v) => v.voiceURI === st.voices[lang.slice(0, 2)]) || voices[0];
  if (chosen) u.voice = chosen;
  u.lang = chosen?.lang || (lang === 'ar' ? 'ar-SA' : lang);
  u.rate = st.rate; u.pitch = st.pitch;
  u.onstart = () => { if (my === token) src?.onSentence(unit, s.start, s.end); };
  u.onend = () => { if (my !== token) return; idx++; speakNext(my); };
  u.onerror = (e) => { if (my !== token) return; if ((e as any).error === 'interrupted' || (e as any).error === 'canceled') return; idx++; setTimeout(() => speakNext(my), 50); };
  speechSynthesis.speak(u);
}

export async function play(source: TtsSource, fromUnit: number, fromOffset = 0) {
  if (!('speechSynthesis' in window)) return;
  stopSpeech();
  src = source;
  const my = ++token;
  await loadUnit(fromUnit, fromOffset);
  useTts.setState({ status: 'playing' });
  speakNext(my);
}
export function pause() {
  if (useTts.getState().status !== 'playing') return;
  token++; speechSynthesis.cancel();
  useTts.setState({ status: 'paused' });
}
export function resume() {
  if (useTts.getState().status !== 'paused' || !src) return;
  const my = ++token;
  useTts.setState({ status: 'playing' });
  speakNext(my);
}
export function skip(delta: number) {
  if (!src) return;
  const my = ++token; speechSynthesis.cancel();
  idx = Math.max(0, Math.min(sentences.length, idx + delta));
  useTts.setState({ status: 'playing' });
  speakNext(my);
}
export function setRate(rate: number) {
  useTts.setState({ rate });
  if (useTts.getState().status === 'playing') { const my = ++token; speechSynthesis.cancel(); speakNext(my); }
}
export function setVoice(lang: string, uri: string) {
  useTts.setState((s) => ({ voices: { ...s.voices, [lang.slice(0, 2)]: uri } }));
  if (useTts.getState().status === 'playing') { const my = ++token; speechSynthesis.cancel(); speakNext(my); }
}
function stopSpeech() { token++; try { speechSynthesis.cancel(); } catch { /* */ } }
export function stop() {
  stopSpeech();
  src = null;
  useTts.setState({ status: 'idle' });
}
export const ttsActive = () => useTts.getState().status !== 'idle';
