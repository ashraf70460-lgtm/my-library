// Procedurally generated ambient soundscapes (no audio files, works offline) + the reader's own music files.
import { create } from 'zustand';
import { put, get, del, lsGet, lsSet } from '../lib/storage';

export type SoundId = 'rain' | 'ocean' | 'fire' | 'forest' | 'stream' | 'brown' | 'pad' | 'chimes';
export const SOUNDS: SoundId[] = ['rain', 'ocean', 'fire', 'forest', 'stream', 'brown', 'pad', 'chimes'];

interface Track { gain: GainNode; stop: () => void }
interface AmbientState {
  volumes: Record<SoundId, number>; // 0 = off
  master: number;
  music: { id: string; name: string }[];
  musicOn: string | null; // playing music id
  musicVolume: number;
  sleepAt: number | null;
}

const saved = lsGet<AmbientState>('ml-ambient', {
  volumes: { rain: 0, ocean: 0, fire: 0, forest: 0, stream: 0, brown: 0, pad: 0, chimes: 0 },
  master: 0.7, music: [], musicOn: null, musicVolume: 0.6, sleepAt: null,
});
export const useAmbient = create<AmbientState>(() => ({ ...saved, musicOn: null, sleepAt: null }));
useAmbient.subscribe((s) => lsSet('ml-ambient', { ...s, musicOn: null, sleepAt: null }));

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const tracks: Partial<Record<SoundId, Track>> = {};
let audioEl: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let sleepTimer: any = null;

function ac() {
  if (!ctx) {
    const C = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = useAmbient.getState().master;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function noiseBuffer(c: AudioContext, type: 'white' | 'pink' | 'brown', seconds = 6) {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') d[i] = w * 0.5;
      else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      else {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    }
  }
  return buf;
}
const bufCache = new Map<string, AudioBuffer>();
function noise(c: AudioContext, type: 'white' | 'pink' | 'brown') {
  if (!bufCache.has(type)) bufCache.set(type, noiseBuffer(c, type));
  const src = c.createBufferSource();
  src.buffer = bufCache.get(type)!;
  src.loop = true;
  src.loopStart = Math.random() * 2;
  return src;
}
function lfo(c: AudioContext, freq: number, depth: number, target: AudioParam) {
  const o = c.createOscillator(); const g = c.createGain();
  o.frequency.value = freq; g.gain.value = depth; o.connect(g).connect(target); o.start();
  return o;
}

function build(id: SoundId): Track {
  const c = ac();
  const out = c.createGain(); out.gain.value = 0; out.connect(master!);
  const nodes: (AudioScheduledSourceNode)[] = [];
  const timers: any[] = [];
  const every = (fn: () => void, min: number, max: number) => {
    const tick = () => { fn(); timers.push(setTimeout(tick, min + Math.random() * (max - min))); };
    timers.push(setTimeout(tick, Math.random() * max));
  };
  switch (id) {
    case 'rain': {
      const n = noise(c, 'pink'); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
      n.connect(hp).connect(lp).connect(out); n.start(); nodes.push(n);
      every(() => { // individual drops
        const o = c.createOscillator(); const g = c.createGain(); const t = c.currentTime;
        o.frequency.setValueAtTime(2000 + Math.random() * 3000, t); o.frequency.exponentialRampToValueAtTime(400, t + 0.04);
        g.gain.setValueAtTime(0.05 * Math.random(), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        o.connect(g).connect(out); o.start(t); o.stop(t + 0.06);
      }, 20, 120);
      break;
    }
    case 'ocean': {
      const n = noise(c, 'brown'); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const g = c.createGain(); g.gain.value = 0.5;
      n.connect(lp).connect(g).connect(out); n.start(); nodes.push(n);
      nodes.push(lfo(c, 0.09, 0.45, g.gain), lfo(c, 0.07, 350, lp.frequency));
      break;
    }
    case 'fire': {
      const n = noise(c, 'brown'); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = c.createGain(); g.gain.value = 0.7; n.connect(lp).connect(g).connect(out); n.start(); nodes.push(n);
      every(() => { // crackles
        const s = noise(c, 'white'); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 3500; bp.Q.value = 3;
        const eg = c.createGain(); const t = c.currentTime; eg.gain.setValueAtTime(0.6 * Math.random() + 0.2, t); eg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
        s.connect(bp).connect(eg).connect(out); s.start(t); s.stop(t + 0.1);
      }, 60, 600);
      break;
    }
    case 'forest': {
      const n = noise(c, 'pink'); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.5;
      const g = c.createGain(); g.gain.value = 0.35; n.connect(bp).connect(g).connect(out); n.start(); nodes.push(n);
      nodes.push(lfo(c, 0.05, 0.2, g.gain));
      every(() => { // soft bird calls
        const t = c.currentTime; const base = 2200 + Math.random() * 1800; const notes = 2 + Math.floor(Math.random() * 4);
        for (let k = 0; k < notes; k++) {
          const o = c.createOscillator(); const eg = c.createGain(); const t0 = t + k * (0.12 + Math.random() * 0.08);
          o.type = 'sine'; o.frequency.setValueAtTime(base * (1 + Math.random() * 0.3), t0); o.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.6), t0 + 0.09);
          eg.gain.setValueAtTime(0.0001, t0); eg.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02); eg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
          o.connect(eg).connect(out); o.start(t0); o.stop(t0 + 0.12);
        }
      }, 2500, 9000);
      break;
    }
    case 'stream': {
      const n = noise(c, 'white'); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
      const g = c.createGain(); g.gain.value = 0.25; n.connect(bp).connect(g).connect(out); n.start(); nodes.push(n);
      nodes.push(lfo(c, 0.6, 600, bp.frequency), lfo(c, 0.33, 0.08, g.gain));
      break;
    }
    case 'brown': {
      const n = noise(c, 'brown'); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      n.connect(lp).connect(out); n.start(); nodes.push(n);
      break;
    }
    case 'pad': {
      // slow, warm chord pad drifting through a pentatonic progression
      const chords = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 329.63]];
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(out);
      const delay = c.createDelay(); delay.delayTime.value = 0.45; const fb = c.createGain(); fb.gain.value = 0.35;
      lp.connect(delay).connect(fb).connect(delay); delay.connect(out);
      let ci = 0;
      const play = () => {
        const t = c.currentTime; const ch = chords[ci++ % chords.length];
        for (const f of ch) for (const det of [-4, 4]) {
          const o = c.createOscillator(); const eg = c.createGain(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
          eg.gain.setValueAtTime(0.0001, t); eg.gain.linearRampToValueAtTime(0.045, t + 3); eg.gain.linearRampToValueAtTime(0.0001, t + 9.5);
          o.connect(eg).connect(lp); o.start(t); o.stop(t + 10);
        }
      };
      play(); const iv = setInterval(play, 8000); timers.push({ iv });
      break;
    }
    case 'chimes': {
      const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
      const delay = c.createDelay(); delay.delayTime.value = 0.6; const fb = c.createGain(); fb.gain.value = 0.3; delay.connect(fb).connect(delay); delay.connect(out);
      every(() => {
        const t = c.currentTime; const f = scale[Math.floor(Math.random() * scale.length)];
        const o = c.createOscillator(); const eg = c.createGain(); o.type = 'sine'; o.frequency.value = f;
        eg.gain.setValueAtTime(0.0001, t); eg.gain.exponentialRampToValueAtTime(0.08, t + 0.01); eg.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        o.connect(eg); eg.connect(out); eg.connect(delay); o.start(t); o.stop(t + 3.1);
      }, 1200, 4200);
      break;
    }
  }
  return {
    gain: out,
    stop: () => {
      const t = c.currentTime; out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0, t, 0.4);
      setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* */ } }); timers.forEach((x) => (x?.iv ? clearInterval(x.iv) : clearTimeout(x))); out.disconnect(); }, 1500);
    },
  };
}

export function setSound(id: SoundId, vol: number) {
  useAmbient.setState((s) => ({ volumes: { ...s.volumes, [id]: vol } }));
  if (vol <= 0) { tracks[id]?.stop(); delete tracks[id]; return; }
  if (!tracks[id]) tracks[id] = build(id);
  const c = ac();
  tracks[id]!.gain.gain.setTargetAtTime(vol, c.currentTime, 0.5);
}
export function setMaster(v: number) {
  useAmbient.setState({ master: v });
  if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.2);
  if (audioEl) audioEl.volume = v * useAmbient.getState().musicVolume;
}
export function stopAll() {
  for (const id of SOUNDS) if (tracks[id]) { tracks[id]!.stop(); delete tracks[id]; }
  useAmbient.setState((s) => ({ volumes: Object.fromEntries(SOUNDS.map((k) => [k, 0])) as any, sleepAt: null, musicOn: s.musicOn }));
  stopMusic();
  clearTimeout(sleepTimer);
}
/** Resume sounds that were left on (must be called from a user gesture). */
export function resumeSaved() {
  const v = useAmbient.getState().volumes;
  for (const id of SOUNDS) if (v[id] > 0 && !tracks[id]) setSound(id, v[id]);
}
export const anyPlaying = () => SOUNDS.some((id) => !!tracks[id]) || !!audioEl;

export function setSleep(minutes: number | null) {
  clearTimeout(sleepTimer);
  if (!minutes) { useAmbient.setState({ sleepAt: null }); return; }
  const at = Date.now() + minutes * 60000;
  useAmbient.setState({ sleepAt: at });
  sleepTimer = setTimeout(() => {
    if (master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 3);
    setTimeout(() => { stopAll(); if (master && ctx) master.gain.value = useAmbient.getState().master; }, 9000);
  }, minutes * 60000);
}

// ---- the reader's own music (stored in this browser) ----
export async function addMusic(files: FileList | File[]) {
  const list = [...useAmbient.getState().music];
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('audio') && !/\.(mp3|m4a|aac|ogg|oga|wav|flac|opus|webm)$/i.test(f.name)) continue;
    const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await put('kv', 'music:' + id, f);
    list.push({ id, name: f.name.replace(/\.[^.]+$/, '') });
  }
  useAmbient.setState({ music: list });
}
export async function removeMusic(id: string) {
  if (useAmbient.getState().musicOn === id) stopMusic();
  await del('kv', 'music:' + id);
  useAmbient.setState((s) => ({ music: s.music.filter((m) => m.id !== id) }));
}
export async function playMusic(id: string) {
  stopMusic();
  const blob = await get<Blob>('kv', 'music:' + id);
  if (!blob) return;
  audioUrl = URL.createObjectURL(blob);
  audioEl = new Audio(audioUrl);
  audioEl.volume = useAmbient.getState().master * useAmbient.getState().musicVolume;
  audioEl.onended = () => { // continue with the next track (loops the playlist)
    const m = useAmbient.getState().music; const i = m.findIndex((x) => x.id === id);
    if (m.length) playMusic(m[(i + 1) % m.length].id);
  };
  useAmbient.setState({ musicOn: id });
  try { await audioEl.play(); } catch { stopMusic(); }
}
export function stopMusic() {
  if (audioEl) { audioEl.pause(); audioEl.src = ''; audioEl = null; }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  useAmbient.setState({ musicOn: null });
}
export function setMusicVolume(v: number) {
  useAmbient.setState({ musicVolume: v });
  if (audioEl) audioEl.volume = useAmbient.getState().master * v;
}
