// [MJ10, 20/11/2026] Primera configuración, en dos pasos cortos: gráficos (vista y calidad, con lo recomendado para el
// dispositivo marcado) y radio (básica, sin descargas, o con IA, con lo que pesa su descarga en este dispositivo). Con IA
// la descarga empieza aquí y sigue mientras se juega. «Omitir» deja lo recomendado. Todo se cambia luego en Ajustes.
// Se carga con import(): solo la primera vez.
// [MJ10, 20/11/2026, el usuario: «Me falta un poco de efecto Wow»; elige «Escena nueva de Blender»] De fondo, el muro de
// boxes de noche con el coche del juego (scripts/blender/mj10-muro.py), con un acercamiento lento; el panel, de cristal,
// a la izquierda en escritorio y abajo en el móvil, con la barra de los pasos y una transición al cambiar de paso.
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Monitor, Radio } from 'lucide-react';
import { browserSettingsStorage, type RaceView } from '../settings/graphics';
import { QUALITY_LABELS, browserDevice, recommendedQuality, type DeviceInfo, type QualitySetting } from '../settings/quality';
import { finishFirstRun, recommendedFirstRun, type FirstRunChoice } from '../settings/firstRun';
import type { RadioMode } from '../radio/model/storage';
import type { VariantChoice } from '../radio/model/variants';
import { Segmented } from './ui/Segmented';
import s from './FirstRunScreen.module.css';

/** Fondo: la escena del muro de boxes (public/primera, codificada con scripts/encode-primera.mjs). */
const BG = `${import.meta.env.BASE_URL ?? '/'}primera/`;

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

export default function FirstRunScreen({ onDone, storage = browserSettingsStorage(), device = browserDevice(), radioChoice, startRadioDownload }: {
  onDone: () => void;
  storage?: StorageLike | null;
  device?: DeviceInfo;
  /** Para tests y revisión: qué versión del modelo admite el dispositivo (sin esto, la del navegador). */
  radioChoice?: VariantChoice;
  /** Para tests: cómo empezar la descarga (sin esto, la de Ajustes). */
  startRadioDownload?: (variant: 'q0f16' | 'q4') => void;
}) {
  const recommended = useMemo(() => recommendedFirstRun(device), [device]);
  const [choice, setChoice] = useState<FirstRunChoice>(recommended);
  const [step, setStep] = useState<1 | 2>(1);
  const [variant, setVariant] = useState<VariantChoice | null>(radioChoice ?? null);
  // El tamaño de cada versión del modelo (el código de la radio solo entra con import(), IA4).
  const [sizes, setSizes] = useState<Record<'q0f16' | 'q4', number> | null>(null);
  useEffect(() => {
    let alive = true;
    void import('../radio/model/manifest').then(m => { if (alive) setSizes({ q0f16: m.toMB(m.RADIO_MODELS.q0f16.bytes), q4: m.toMB(m.RADIO_MODELS.q4.bytes) }); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (radioChoice) return;
    let alive = true;
    void import('../radio/model/variants').then(v => v.chooseVariant(v.browserVariantEnv())).then(c => { if (alive) setVariant(c); }).catch(() => {});
    return () => { alive = false; };
  }, [radioChoice]);
  const aiVariant = variant && variant.variant !== 'basica' ? variant.variant : null;
  const aiMB = aiVariant && sizes ? sizes[aiVariant] : null;
  const level = QUALITY_LABELS[recommendedQuality(device)].toLowerCase();

  const finish = (how: 'hecha' | 'omitida') => {
    const final = how === 'omitida' ? recommended : choice;
    finishFirstRun(storage, final, how);
    if (how === 'hecha' && final.radio === 'ia' && aiVariant) {
      if (startRadioDownload) startRadioDownload(aiVariant);
      else void import('./RadioSettings').then(m => { void m.radioModelDownload(aiVariant).start(); });
    }
    onDone();
  };
  const set = <K extends keyof FirstRunChoice>(key: K, value: FirstRunChoice[K]) => setChoice(prev => ({ ...prev, [key]: value }));

  return (
    <div className={s.screen} data-first-run>
      <picture className={s.scene} aria-hidden="true">
        <source media="(max-width: 767px)" type="image/avif" srcSet={`${BG}muro-movil.avif`} />
        <source media="(max-width: 767px)" type="image/webp" srcSet={`${BG}muro-movil.webp`} />
        <source type="image/avif" srcSet={`${BG}muro-escritorio.avif`} />
        <img src={`${BG}muro-escritorio.webp`} alt="" decoding="async" data-first-run-scene />
      </picture>
      <div className={s.shade} aria-hidden="true" />
      <main className={s.card} aria-labelledby="primera-titulo">
        <p className={s.brand}>Bienvenido al muro</p>
        <div className={s.progress} aria-hidden="true"><span data-on={true} /><span data-on={step === 2} /></div>
        <header className={s.head}>
          <p className={s.step}>Paso {step} de 2</p>
          <h1 id="primera-titulo" className={s.title}>{step === 1 ? 'Gráficos' : 'Radio del muro'}</h1>
          <button type="button" className={s.skip} onClick={() => finish('omitida')}>Omitir</button>
        </header>

        {step === 1 ? (
          <section key="graficos" className={s.section} aria-label="Gráficos">
            <p className={s.lead}><Monitor size={18} aria-hidden="true" />Marcado, lo que recomendamos para este dispositivo.</p>
            <Segmented wrap label="Vista de la carrera" name="primera-vista" value={choice.view} onChange={(v: RaceView) => set('view', v)}
              options={[{ value: '3d', label: recommended.view === '3d' ? 'Vista 3D (recomendada)' : 'Vista 3D' }, { value: '2d', label: recommended.view === '2d' ? 'Vista 2D (recomendada)' : 'Vista 2D, más ligera' }]} />
            <Segmented wrap label="Calidad" name="primera-calidad" value={choice.quality} onChange={(v: string) => set('quality', v as QualitySetting)}
              options={(['auto', 'alto', 'medio', 'bajo'] as const).map(v => ({ value: v, label: v === 'auto' ? 'Automática (recomendada)' : QUALITY_LABELS[v] }))} />
            <p className={s.dim}>En automática, este dispositivo usa calidad {level} y baja sola si la carrera va a tirones.</p>
          </section>
        ) : (
          <section key="radio" className={s.section} aria-label="Radio del muro">
            <p className={s.lead}><Radio size={18} aria-hidden="true" />Habla con tus pilotos por radio durante la carrera.</p>
            <div className={s.options} role="radiogroup" aria-label="Radio">
              <RadioOption value="basica" current={choice.radio} onPick={v => set('radio', v)} title="Radio básica (recomendada)"
                text="Entiende las órdenes por palabras clave. No descarga nada." />
              <RadioOption value="ia" current={choice.radio} onPick={v => set('radio', v)} disabled={!aiVariant}
                title={aiMB ? `Radio con IA · ${aiMB} MB` : 'Radio con IA'}
                text={!variant ? 'Comprobando este dispositivo…' : !aiVariant ? `No disponible en este dispositivo${variant.reason ? `: ${variant.reason}` : ''}.`
                  : `Entiende tus órdenes dichas con tus palabras. Descarga ${aiMB} MB una sola vez${variant.mobile ? ' (mejor con wifi)' : ''}; empieza al terminar y sigue mientras juegas.`} />
            </div>
          </section>
        )}

        <p className={s.dim}>Todo se puede cambiar después en Ajustes.</p>
        <footer className={s.actions}>
          {step === 2 && <button type="button" className={s.secondary} onClick={() => setStep(1)}><ArrowLeft size={16} aria-hidden="true" />Atrás</button>}
          {step === 1
            ? <button type="button" className={s.primary} onClick={() => setStep(2)}>Siguiente<ArrowRight size={16} aria-hidden="true" /></button>
            : <button type="button" className={s.primary} onClick={() => finish('hecha')}>Empezar a jugar<ArrowRight size={16} aria-hidden="true" /></button>}
        </footer>
      </main>
    </div>
  );
}

function RadioOption({ value, current, onPick, title, text, disabled = false }: {
  value: RadioMode; current: RadioMode; onPick: (value: RadioMode) => void; title: string; text: string; disabled?: boolean;
}) {
  return (
    <button type="button" role="radio" aria-checked={current === value} disabled={disabled} className={s.option} onClick={() => onPick(value)}>
      <b>{title}</b><span>{text}</span>
    </button>
  );
}
