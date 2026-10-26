import { useState } from 'react';
import { ArrowLeft, Gamepad2, Monitor, Radio, Volume2 } from 'lucide-react';
import { AUDIO_LEVEL_LABEL, AUDIO_STORAGE_KEY, parseAudioLevel } from '../audio/AudioEngine';
import { browserSettingsStorage, readRaceView, writeRaceView, type RaceView } from '../settings/graphics';
import RadioSettings, { type RadioSettingsProps } from './RadioSettings';
import { Segmented } from './ui/Segmented';
import s from './Screens.module.css';

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void }

/** Sonido de la aplicación: el nivel elegido, sus nombres, cómo cambiarlo y los créditos (lo pasa App). */
export interface SettingsAudio { level: number; labels: string[]; onLevel: (level: number) => void; credits: { id: string; label: string; text: string }[] }

const SHORTCUTS: [string, string][] = [
  ['Espacio', 'Pausa y reanuda'],
  ['1 a 6', 'Velocidad: ×1, ×2, ×4, ×8, ×16 y ×32'],
  ['C', 'Cambia de cámara'],
  ['Esc', 'Deja de seguir al coche elegido'],
  ['R', 'Abre la radio con el piloto que se ve'],
  ['T (mantener)', 'Habla por el micro'],
];

/**
 * [UX2] Ajustes desde la pantalla de juego, fuera de la carrera: la radio con IA arriba y destacada (con las descargas
 * de los modelos: aquí se hacen, antes de correr), sonido, gráficos y controles. Se carga con import().
 */
export default function SettingsScreen({ onBack, audio, radioProps, storage = browserSettingsStorage() }: {
  onBack: () => void;
  audio?: SettingsAudio;
  /** Para tests y revisión: tiendas y dispositivo simulados de la radio. */
  radioProps?: RadioSettingsProps;
  storage?: StorageLike | null;
}) {
  const [view, setView] = useState<RaceView>(() => readRaceView(storage));
  // Sin App (tests, revisión) el volumen se guarda aquí mismo.
  const [ownLevel, setOwnLevel] = useState(() => { try { return parseAudioLevel(storage?.getItem(AUDIO_STORAGE_KEY) ?? null); } catch { return 0; } });
  const level = audio?.level ?? ownLevel;
  const labels = audio?.labels ?? AUDIO_LEVEL_LABEL;
  const chooseLevel = (next: number) => {
    if (audio) audio.onLevel(next);
    else { setOwnLevel(next); try { storage?.setItem(AUDIO_STORAGE_KEY, String(next)); } catch { /* sin almacenamiento */ } }
  };
  const chooseView = (next: RaceView) => { setView(next); writeRaceView(storage, next); };

  return (
    <div className={s.screen}>
      <header className={s.head}>
        <button type="button" className={s.button} onClick={onBack} aria-label="Volver"><ArrowLeft size={18} aria-hidden="true" />Volver</button>
        <h1>Ajustes</h1>
      </header>
      <main className={s.body}>
        <div className={s.settings}>
          <section className={`${s.settingsSection} ${s.settingsFeatured}`} aria-labelledby="ajustes-radio">
            <h2 id="ajustes-radio"><Radio size={20} aria-hidden="true" />Radio con IA</h2>
            <p className={s.dim}>Las descargas del modelo, la voz y el micro se hacen aquí, antes de correr. En carrera solo se enciende o se apaga.</p>
            <RadioSettings {...radioProps} />
          </section>

          <section className={s.settingsSection} aria-labelledby="ajustes-sonido">
            <h2 id="ajustes-sonido"><Volume2 size={20} aria-hidden="true" />Sonido</h2>
            <Segmented wrap label="Volumen del sonido" name="ajustes-volumen" value={String(level)} onChange={value => chooseLevel(Number(value))}
              options={labels.map((label, i) => ({ value: String(i), label }))} />
            {audio && audio.credits.length > 0 && (
              <details className={s.settingsCredits}>
                <summary>Créditos de los sonidos</summary>
                <ul>{audio.credits.map(credit => <li key={credit.id}><b>{credit.label}:</b> {credit.text}</li>)}</ul>
              </details>
            )}
          </section>

          <section className={s.settingsSection} aria-labelledby="ajustes-graficos">
            <h2 id="ajustes-graficos"><Monitor size={20} aria-hidden="true" />Gráficos</h2>
            <Segmented label="Vista de la carrera" name="ajustes-vista" value={view} onChange={chooseView}
              options={[{ value: '3d', label: 'Vista 3D' }, { value: '2d', label: 'Vista 2D (más ligera)' }]} />
            <p className={s.dim}>La vista 2D desde arriba gasta menos batería; se aplica en la próxima carrera.</p>
          </section>

          <section className={s.settingsSection} aria-labelledby="ajustes-controles">
            <h2 id="ajustes-controles"><Gamepad2 size={20} aria-hidden="true" />Controles</h2>
            <dl className={s.shortcuts}>
              {SHORTCUTS.map(([key, what]) => (<div key={key}><dt><kbd>{key}</kbd></dt><dd>{what}</dd></div>))}
            </dl>
            <p className={s.dim}>En el móvil, todo se maneja con el dedo: las teclas son para el escritorio.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
