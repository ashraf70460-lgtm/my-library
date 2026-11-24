import { useEffect, useRef, useState } from 'react';
import { CloudRain, Waves, Flame, Trees, Droplets, Wind, Music2, Bell, Play, Pause, Square, SkipBack, SkipForward, Plus, Trash2, Moon, Volume2 } from 'lucide-react';
import { useT } from '../store';
import { useAmbient, setSound, setMaster, stopAll, addMusic, removeMusic, playMusic, stopMusic, setMusicVolume, setSleep, SOUNDS, type SoundId } from './ambient';
import { useTts, listVoices, onVoicesChanged, pause, resume, stop, skip, setRate, setVoice } from './tts';

const ICONS: Record<SoundId, any> = { rain: CloudRain, ocean: Waves, fire: Flame, forest: Trees, stream: Droplets, brown: Wind, pad: Music2, chimes: Bell };

export function SoundPanel({ lang, onReadFromHere }: { lang: string; onReadFromHere: () => void }) {
  const t = useT();
  const tts = useTts();
  const amb = useAmbient();
  const [, force] = useState(0);
  useEffect(() => onVoicesChanged(() => force((x) => x + 1)), []);
  const voices = listVoices(lang);
  const fileRef = useRef<HTMLInputElement>(null);
  const sleepLeft = amb.sleepAt ? Math.max(0, Math.round((amb.sleepAt - Date.now()) / 60000)) : 0;
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-1 font-semibold">{t('snd.read')}</h3>
        {!tts.supported ? <p className="text-sm opacity-70">{t('snd.noTts')}</p> : (
          <>
            <p className="mb-3 text-xs opacity-70">{t('snd.readHint')}</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {tts.status === 'idle' ? (
                <button type="button" onClick={onReadFromHere} className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-sm font-medium text-white" style={{ background: 'var(--r-accent)' }}><Play size={16} />{t('snd.readHere')}</button>
              ) : (
                <>
                  <RoundBtn label={t('previous')} onClick={() => skip(-1)}><SkipBack size={16} /></RoundBtn>
                  <RoundBtn label={tts.status === 'playing' ? t('rd.pause') : t('rd.resume')} onClick={() => (tts.status === 'playing' ? pause() : resume())} primary>{tts.status === 'playing' ? <Pause size={18} /> : <Play size={18} />}</RoundBtn>
                  <RoundBtn label={t('next')} onClick={() => skip(1)}><SkipForward size={16} /></RoundBtn>
                  <RoundBtn label={t('snd.stop')} onClick={stop}><Square size={14} /></RoundBtn>
                </>
              )}
            </div>
            <label className="mb-3 block"><span className="mb-1 flex justify-between text-sm"><span>{t('snd.speed')}</span><span className="opacity-70">{tts.rate.toFixed(2)}×</span></span>
              <input type="range" min={0.6} max={1.8} step={0.05} value={tts.rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-[var(--r-accent)]" />
            </label>
            {voices.length > 0 ? (
              <label className="block"><span className="mb-1 block text-sm">{t('snd.voice')}</span>
                <select className="field" value={tts.voices[lang.slice(0, 2)] || voices[0]?.voiceURI} onChange={(e) => setVoice(lang, e.target.value)}>
                  {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}{v.localService ? '' : ' ☁'}</option>)}
                </select>
              </label>
            ) : <p className="text-xs opacity-70">{t('snd.noVoice')}</p>}
          </>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{t('snd.ambient')}</h3>
          <button type="button" className="text-xs underline opacity-70" onClick={stopAll}>{t('snd.allOff')}</button></div>
        <p className="mb-3 text-xs opacity-70">{t('snd.ambientHint')}</p>
        <div className="grid grid-cols-2 gap-2">
          {SOUNDS.map((id) => {
            const Icon = ICONS[id]; const v = amb.volumes[id]; const on = v > 0;
            return (
              <div key={id} className="rounded-xl p-2" style={{ border: '1px solid var(--r-line)', background: on ? 'color-mix(in srgb, var(--r-accent) 12%, transparent)' : undefined }}>
                <button type="button" onClick={() => setSound(id, on ? 0 : 0.5)} className="flex w-full items-center gap-2 text-start text-sm" aria-pressed={on}>
                  <Icon size={17} style={{ color: on ? 'var(--r-accent)' : undefined }} />{t('snd.' + id)}
                </button>
                {on && <input type="range" min={0.05} max={1} step={0.05} value={v} onChange={(e) => setSound(id, Number(e.target.value))} className="mt-1 w-full accent-[var(--r-accent)]" aria-label={t('snd.' + id)} />}
              </div>
            );
          })}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><Volume2 size={16} />
          <input type="range" min={0} max={1} step={0.05} value={amb.master} onChange={(e) => setMaster(Number(e.target.value))} className="flex-1 accent-[var(--r-accent)]" aria-label={t('snd.volume')} />
        </label>
      </section>

      <section>
        <h3 className="mb-1 font-semibold">{t('snd.music')}</h3>
        <p className="mb-3 text-xs opacity-70">{t('snd.musicHint')}</p>
        <div className="flex flex-col gap-1">
          {amb.music.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1" style={{ background: amb.musicOn === m.id ? 'color-mix(in srgb, var(--r-accent) 12%, transparent)' : undefined }}>
              <button type="button" aria-label={amb.musicOn === m.id ? t('rd.pause') : t('rd.resume')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5" onClick={() => (amb.musicOn === m.id ? stopMusic() : playMusic(m.id))}>{amb.musicOn === m.id ? <Pause size={15} /> : <Play size={15} />}</button>
              <span className="min-w-0 flex-1 truncate text-sm" dir="auto">{m.name}</span>
              <button type="button" aria-label={t('delete')} className="flex h-9 w-9 items-center justify-center rounded-full opacity-60 hover:bg-black/5" onClick={() => removeMusic(m.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        {amb.musicOn && <input type="range" min={0} max={1} step={0.05} value={amb.musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} className="mt-2 w-full accent-[var(--r-accent)]" aria-label={t('snd.volume')} />}
        <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-sm" style={{ border: '1px solid var(--r-line)' }}><Plus size={15} />{t('snd.addMusic')}</button>
        <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addMusic(e.target.files); e.target.value = ''; }} />
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 font-semibold"><Moon size={16} />{t('snd.sleep')}</h3>
        <div className="flex flex-wrap gap-2">
          {[15, 30, 45, 60].map((m) => <button key={m} type="button" onClick={() => setSleep(m)} className="min-h-[36px] rounded-full px-3 text-sm" style={{ border: '1px solid var(--r-line)' }}>{m} {t('min')}</button>)}
          {amb.sleepAt && <button type="button" onClick={() => setSleep(null)} className="min-h-[36px] rounded-full px-3 text-sm underline">{t('cancel')}</button>}
        </div>
        {amb.sleepAt && <p className="mt-2 text-xs opacity-70">{t('snd.sleepLeft', { n: sleepLeft })}</p>}
      </section>
    </div>
  );
}

function RoundBtn({ label, onClick, children, primary }: { label: string; onClick: () => void; children: React.ReactNode; primary?: boolean }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`inline-flex items-center justify-center rounded-full ${primary ? 'h-12 w-12 text-white' : 'h-10 w-10 hover:bg-black/5'}`} style={primary ? { background: 'var(--r-accent)' } : { border: '1px solid var(--r-line)' }}>{children}</button>;
}
