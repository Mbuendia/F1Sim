import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ExternalLink } from 'lucide-react';
import type { CircuitSpec } from '../data/circuits';
import { buildTrackFromSvg } from '../utils/svgTrackParser';
import { FIRST_GRAND_PRIX, circuitCard, formatDuration, formatLap } from '../freeRace/freeRace';
import { FlagIcon } from './FlagIcon';
import s from './FreeRace.module.css';

type Tab = 'trazado' | 'ficha' | 'estrategia' | 'tiempo' | 'enlaces';
const TABS: { id: Tab; label: string }[] = [
  { id: 'trazado', label: 'Trazado' }, { id: 'ficha', label: 'Ficha técnica' }, { id: 'estrategia', label: 'Estrategia' },
  { id: 'tiempo', label: 'Meteorología y asfalto' }, { id: 'enlaces', label: 'Enlaces' },
];

function Facts({ rows }: { rows: [string, string][] }) {
  return <dl className={s.sheetFacts}>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

/** Trazado del circuito con las zonas de DRS en verde y la meta marcada. */
function TrackMap({ circuit }: { circuit: CircuitSpec }) {
  const drawing = useMemo(() => {
    const track = buildTrackFromSvg(circuit, 600);
    const pts = track.points;
    if (!pts.length) return null;
    const b = track.bounds, w = b.maxX - b.minX, h = b.maxY - b.minY, pad = 24;
    const k = Math.min((500 - pad * 2) / w, (500 - pad * 2) / h);
    const ox = pad + (500 - pad * 2 - w * k) / 2, oy = pad + (500 - pad * 2 - h * k) / 2;
    const at = (i: number) => ({ x: (pts[i].x - b.minX) * k + ox, y: (pts[i].y - b.minY) * k + oy });
    const line = (ids: number[]) => ids.map((i, n) => { const p = at(i); return `${n ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(' ');
    const all = line(pts.map((_, i) => i)) + ' Z';
    // Tramos de DRS: puntos seguidos con la misma zona (la que cruza la meta queda en dos trozos, con su etiqueta en el primero).
    const zones: { id: number; d: string; label: { x: number; y: number } }[] = [];
    let run: number[] = [], runId: number | undefined;
    const flush = () => { if (run.length > 1 && runId !== undefined) zones.push({ id: runId, d: line(run), label: at(run[Math.floor(run.length / 2)]) }); run = []; };
    pts.forEach((p, i) => {
      const id = p.isDrsZone ? p.drsZoneId ?? 0 : undefined;
      if (id !== runId) { flush(); runId = id; }
      if (id !== undefined) run.push(i);
    });
    flush();
    return { all, zones, start: at(0) };
  }, [circuit]);
  if (!drawing) return null;
  const labelled = new Set<number>();
  return (
    <svg className={s.trackMap} viewBox="0 0 500 500" role="img" aria-label={`Trazado de ${circuit.name} con ${circuit.drsZones} zonas de DRS`}>
      <path d={drawing.all} fill="none" stroke="var(--line-strong)" strokeWidth="12" strokeLinejoin="round" />
      <path d={drawing.all} fill="none" stroke="var(--text-2)" strokeWidth="3" strokeLinejoin="round" />
      {drawing.zones.map((z, i) => <path key={i} d={z.d} fill="none" stroke="var(--positivo)" strokeWidth="7" strokeLinecap="round" />)}
      {drawing.zones.filter(z => !labelled.has(z.id) && labelled.add(z.id)).map(z => (
        <text key={`t${z.id}`} x={z.label.x} y={z.label.y - 12} className={s.mapLabel}>DRS {z.id}</text>
      ))}
      <rect x={drawing.start.x - 3} y={drawing.start.y - 9} width="6" height="18" fill="#fff" stroke="#111" />
    </svg>
  );
}

/**
 * [UX12] Detalle del circuito a pantalla completa, en fichas: trazado con las zonas de DRS, ficha técnica, estrategia,
 * meteorología y asfalto, y enlaces. Con Atrás y, si se quiere, elegirlo desde aquí.
 */
export function CircuitSheet({ circuit: c, onBack, onChoose, chosen = false, initialTab = 'trazado' }: {
  circuit: CircuitSpec; onBack: () => void; onChoose?: () => void; chosen?: boolean; initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'trazado');
  const info = circuitCard(c);
  const overtaking = c.drsZones >= 3 ? 'Alta: varias zonas de DRS y rectas anchas' : c.trackWidthCars === 2 ? 'Muy baja: urbano y estrecho' : 'Media: depende del ritmo';
  const links: [string, string | undefined][] = [['Mapa', c.googleMapsUrl], ['Web oficial', c.officialWebsiteUrl], ['Racing Circuits', c.racingCircuitsUrl], ['StatsF1', c.statsF1Url]];
  return (
    <div className={s.wizard} data-fullscreen>
      <header className={s.top}>
        <button type="button" className={s.secondary} onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />Atrás</button>
        <div className={s.sheetTitle}>
          <h1 className={s.title}><FlagIcon country={c.country} emoji={c.countryFlag} size={18} /> {c.name}</h1>
          <span className={s.facts}>{c.officialGpName} · {c.location}</span>
        </div>
      </header>
      <div className={s.tabs} role="tablist" aria-label="Detalle del circuito">
        {TABS.map(x => <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={s.tab} onClick={() => setTab(x.id)}>{x.label}</button>)}
      </div>
      <main className={s.scroll}>
        <div className={s.sheet}>
          {tab === 'trazado' && (<>
            <TrackMap circuit={c} />
            <section className={s.block}>
              <h2>Zonas de DRS ({c.drsZoneSpecs?.length || c.drsZones})</h2>
              <ul className={s.zoneList}>
                {(c.drsZoneSpecs ?? []).map(z => (
                  <li key={z.id}><strong>Zona {z.id}</strong> · {z.name} · del {Math.round(z.startT * 100)} % al {Math.round(z.endT * 100)} % de la vuelta</li>
                ))}
              </ul>
              <p className={s.facts}>Sentido {c.direction === 'clockwise' ? 'horario' : 'antihorario'}; la meta, en blanco.</p>
            </section>
          </>)}
          {tab === 'ficha' && (
            <section className={s.block}>
              <h2>Ficha técnica</h2>
              <Facts rows={[['Longitud', `${c.lapLengthMeters.toLocaleString('es-ES')} m`], ['Vueltas', String(c.totalLaps)], ['Curvas', String(c.turns)],
                ['Distancia', `${((c.lapLengthMeters * c.totalLaps) / 1000).toFixed(1).replace('.', ',')} km`],
                ['Vuelta rápida de 2025', info.fastestLapSec ? formatLap(info.fastestLapSec) : '—'],
                ['Primer Gran Premio', FIRST_GRAND_PRIX[c.id] ? String(FIRST_GRAND_PRIX[c.id]) : '—'],
                ['Tipo', c.trackWidthCars === 2 ? 'Urbano (caben 2 coches)' : 'Permanente (caben 3 coches)'],
                ['Espectadores', c.spectators.toLocaleString('es-ES')]]} />
            </section>
          )}
          {tab === 'estrategia' && (
            <section className={s.block}>
              <h2>Estrategia</h2>
              <p className={s.lead}>{info.strategy}</p>
              <Facts rows={[['Paso por el pit lane', `${c.pitLaneTimeLossSec.toLocaleString('es-ES')} s`], ['Safety Car', `${c.safetyCarProbabilityPercent} %`],
                ['Adelantar', overtaking], ['Tiempo previsto', `≈ ${formatDuration(info.predictedSec)}`]]} />
            </section>
          )}
          {tab === 'tiempo' && (
            <section className={s.block}>
              <h2>Meteorología y asfalto</h2>
              <Facts rows={[['Lluvia', `${c.rainProbabilityPercent} %`], ['Viento', `${c.windSpeedKmh} km/h, ${c.windDirection}`],
                ['Abrasión del asfalto', c.asphaltAbrasion], ['Estrés de neumáticos', c.tireStressLevel], ['Agarre', c.asphaltGripLevel], ['Desnivel', `${c.elevationChangeMeters} m`]]} />
            </section>
          )}
          {tab === 'enlaces' && (
            <section className={s.block}>
              <h2>Enlaces</h2>
              <ul className={s.linkList}>
                {links.filter(([, url]) => url).map(([label, url]) => (
                  <li key={label}><a className={s.secondary} href={url} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={16} aria-hidden="true" /></a></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      {onChoose && (
        <footer className={s.footer}>
          <span className={s.facts}>{info.laps} vueltas · ≈ {formatDuration(info.predictedSec)}</span>
          <div className={s.footerButtons}>
            <button type="button" className={s.primary} onClick={onChoose} aria-pressed={chosen}><Check size={18} aria-hidden="true" />{chosen ? 'Elegido' : 'Elegir este circuito'}</button>
          </div>
        </footer>
      )}
    </div>
  );
}
