import { useMemo, useState } from 'react';
import { ArrowLeft, Code2, ExternalLink, Gamepad2, HardDrive, Monitor, Radio, Volume2 } from 'lucide-react';
import { createDevTapCounter, DEV_TOOLS, isDevMode, setDevMode } from '../dev/devMode';
import { AUDIO_LEVEL_LABEL, AUDIO_STORAGE_KEY, parseAudioLevel } from '../audio/AudioEngine';
import { browserSettingsStorage, readRaceView, writeRaceView, type RaceView } from '../settings/graphics';
import { QUALITY_LABELS, browserDevice, readQuality, recommendedQuality, writeQuality, type QualitySetting } from '../settings/quality';
import RadioSettings, { type RadioSettingsProps } from './RadioSettings';
import { LiveAiStatusBadge } from './AiStatusBadge';
import { BrowserStorageSettings } from './StorageSettings';
import { Segmented } from './ui/Segmented';
import s from './Screens.module.css';

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void }

/** Sonido de la aplicación: el nivel elegido, sus nombres, cómo cambiarlo y los créditos (lo pasa App). */
export interface SettingsAudio { level: number; labels: string[]; onLevel: (level: number) => void; credits: { id: string; label: string; text: string }[] }

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : 'desarrollo';
const toolHref = (query: string) => `${import.meta.env.BASE_URL ?? '/'}${query}`;

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
  // [PF4] Calidad gráfica: automática (la del dispositivo, y baja sola si caen los fotogramas) o elegida a mano.
  const [quality, setQuality] = useState<QualitySetting>(() => readQuality(storage));
  const chooseQuality = (next: QualitySetting) => { setQuality(next); writeQuality(storage, next); };
  const recommended = useMemo(() => QUALITY_LABELS[recommendedQuality(browserDevice())].toLowerCase(), []);
  // [UX3] Modo desarrollador: siete toques seguidos en la versión lo encienden; se apaga desde su sección.
  const [devOn, setDevOn] = useState(() => isDevMode(storage));
  const [tapNote, setTapNote] = useState<string | null>(null);
  const taps = useMemo(() => createDevTapCounter({ storage }), [storage]);
  const tapVersion = () => {
    if (devOn) { setTapNote('El modo desarrollador ya está encendido.'); return; }
    if (taps.tap()) { setDevOn(true); setTapNote('Modo desarrollador encendido.'); return; }
    const left = taps.remaining();
    setTapNote(left <= 3 ? `A ${left} ${left === 1 ? 'toque' : 'toques'} del modo desarrollador.` : null);
  };
  const turnOff = () => { setDevMode(storage, false); setDevOn(false); setTapNote('Modo desarrollador apagado.'); };

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
            <LiveAiStatusBadge />
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
            <Segmented wrap label="Calidad" name="ajustes-calidad" value={quality} onChange={value => chooseQuality(value as QualitySetting)}
              options={(['auto', 'alto', 'medio', 'bajo'] as const).map(v => ({ value: v, label: QUALITY_LABELS[v] }))} />
            <p className={s.dim}>En automática, este dispositivo usa calidad {recommended}, y baja sola si la carrera va a tirones. Se aplica en la próxima carrera.</p>
          </section>

          <section className={s.settingsSection} aria-labelledby="ajustes-controles">
            <h2 id="ajustes-controles"><Gamepad2 size={20} aria-hidden="true" />Controles</h2>
            <dl className={s.shortcuts}>
              {SHORTCUTS.map(([key, what]) => (<div key={key}><dt><kbd>{key}</kbd></dt><dd>{what}</dd></div>))}
            </dl>
            <p className={s.dim}>En el móvil, todo se maneja con el dedo: las teclas son para el escritorio.</p>
          </section>

          {/* [OF2] Si el navegador puede borrar el juego guardado, los modelos y las partidas. */}
          <section className={s.settingsSection} aria-labelledby="ajustes-datos">
            <h2 id="ajustes-datos"><HardDrive size={20} aria-hidden="true" />Datos guardados</h2>
            <BrowserStorageSettings />
          </section>

          {devOn && (
            <section className={s.settingsSection} aria-labelledby="ajustes-desarrollo" data-dev-tools>
              <h2 id="ajustes-desarrollo"><Code2 size={20} aria-hidden="true" />Modo desarrollador</h2>
              <p className={s.dim}>Herramientas de revisión y de prueba. En carrera, el menú añade las pruebas de Safety Car y bandera roja, y la carrera libre deja elegir el tiempo.</p>
              <ul className={s.devTools}>
                {DEV_TOOLS.map(tool => (
                  <li key={tool.id}><a href={toolHref(tool.query)} target="_blank" rel="noreferrer"><b>{tool.label}</b><span>{tool.description}</span><ExternalLink size={16} aria-hidden="true" /></a></li>
                ))}
              </ul>
              <button type="button" className={s.button} onClick={turnOff}>Apagar el modo desarrollador</button>
            </section>
          )}

          <footer className={s.settingsFoot}>
            <button type="button" className={s.versionButton} onClick={tapVersion} data-version>Versión {APP_VERSION}</button>
            {tapNote && <span className={s.dim} role="status">{tapNote}</span>}
          </footer>
        </div>
      </main>
    </div>
  );
}
