// [IA4] Página de revisión de los ajustes de la radio (solo en desarrollo: `?revision=radio`). Cada tarjeta es un
// estado con la tienda falsa: dispositivos no aptos, móvil, sin espacio, a medias, cortes, completa y la del juego.
import { useMemo } from 'react';
import RadioSettings, { type RadioSettingsProps } from '../components/RadioSettings';
import { createFakeModelStore, unavailableModelStore } from '../radio/model/ModelStore';
import { DEVICE_REASONS } from '../radio/model/deviceCheck';
import { MODEL_MANIFEST } from '../radio/model/manifest';

const MB = 1024 * 1024;
const total = MODEL_MANIFEST.bytes;
const roomy = async () => ({ quota: 8192 * MB, usage: 0 });
const fake = (extra: Partial<Parameters<typeof createFakeModelStore>[0]> = {}) => createFakeModelStore({ totalBytes: total, chunkBytes: 6 * MB, stepMs: 120, ...extra });

const CASES: { title: string; props: () => RadioSettingsProps }[] = [
  { title: 'Sin WebGPU', props: () => ({ device: { kind: 'no-apto', reason: DEVICE_REASONS.sinWebgpu }, initialMode: 'basica', store: fake() }) },
  { title: 'Gráfica sin memoria', props: () => ({ device: { kind: 'no-apto', reason: DEVICE_REASONS.sinMemoria }, initialMode: 'basica', store: fake() }) },
  { title: 'Ventana privada o poco espacio', props: () => ({ device: { kind: 'no-apto', reason: DEVICE_REASONS.sinEspacio }, initialMode: 'basica', store: fake() }) },
  { title: 'Móvil, sin modelo', props: () => ({ device: { kind: 'movil', reason: DEVICE_REASONS.movil }, initialMode: 'ia', store: fake(), estimate: roomy }) },
  { title: 'Escritorio, sin modelo (pulsa Descargar)', props: () => ({ device: { kind: 'completo' }, initialMode: 'ia', store: fake(), estimate: roomy }) },
  { title: 'Ahorro de datos activado', props: () => ({ device: { kind: 'completo' }, initialMode: 'ia', store: fake(), estimate: roomy, saveData: true }) },
  { title: 'Descarga a medias (cancelada)', props: () => ({ device: { kind: 'completo' }, initialMode: 'ia', store: fake({ initialBytes: Math.round(total * 0.42) }), estimate: roomy }) },
  { title: 'Corte de red a mitad (pulsa Descargar)', props: () => ({ device: { kind: 'completo' }, initialMode: 'ia', store: fake({ failOnce: { atBytes: Math.round(total * 0.3), code: 'red' } }), estimate: roomy }) },
  { title: 'Disco lleno a mitad (pulsa Descargar)', props: () => ({ device: { kind: 'completo' }, initialMode: 'ia', store: fake({ failOnce: { atBytes: Math.round(total * 0.5), code: 'cuota' } }), estimate: roomy }) },
  { title: 'Sin espacio antes de empezar (pulsa Descargar)', props: () => ({ device: { kind: 'completo' }, initialMode: 'ia', store: fake(), estimate: async () => ({ quota: 1200 * MB, usage: 1000 * MB }) }) },
  { title: 'Modelo descargado', props: () => ({ device: { kind: 'completo' }, initialMode: 'ia', store: fake({ preloaded: true }), estimate: roomy }) },
  { title: 'En el juego hasta IA5 (pulsa Descargar)', props: () => ({ device: { kind: 'completo' }, initialMode: 'ia', store: unavailableModelStore, estimate: roomy }) },
];

function Card({ title, make }: { title: string; make: () => RadioSettingsProps }) {
  const props = useMemo(make, [make]);
  return (
    <section style={{ width: 290, padding: 8, border: '1px solid var(--line-strong)', borderRadius: 12, background: 'var(--panel-2)' }} data-case={title}>
      <h2 style={{ margin: '2px 8px 8px', fontSize: 13, color: '#38bdf8', fontWeight: 700 }}>{title}</h2>
      <RadioSettings {...props} remember={false} />
    </section>
  );
}

export default function RadioReview() {
  return (
    <main style={{ minHeight: '100vh', padding: 16, background: 'var(--bg, #0b0f19)', color: 'var(--text, #e8edf3)', boxSizing: 'border-box' }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 20 }}>Revisión IA4 · Ajustes de la radio</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        {CASES.map(c => <Card key={c.title} title={c.title} make={c.props} />)}
      </div>
    </main>
  );
}
