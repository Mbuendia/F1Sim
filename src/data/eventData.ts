// [R03] Datos de evento: líneas del trazado con unidad y procedencia, construidas desde la ficha y el trazado
// actuales (sin cambiar ningún valor). Un dato «verificado» cita su fuente; lo demás es calibrado para el juego,
// provisional o sintético, y no debe presentarse como oficial.
import type { CircuitSpec } from './circuits';
import type { TrackDefinition } from './barcelonaTrack';

export type Provenance = 'verificado' | 'calibrado' | 'provisional' | 'sintetico';
export type EventLineKind = 'meta' | 'sector' | 'drs-deteccion' | 'drs-zona' | 'pit-entrada' | 'pit-salida' | 'pit-compromiso';

export interface EventLine {
  id: string;
  kind: EventLineKind;
  /** Unidad de las posiciones: fracción de vuelta desde la meta en el sentido de marcha. */
  unit: 'fraccion-vuelta';
  t?: number;
  startT?: number;
  endT?: number;
  /** Zonas DRS que habilita una detección. */
  zoneIds?: number[];
  /** Zona DRS (id numérico de la ficha). */
  zoneId?: number;
  provenance: Provenance;
  source: string;
}

export interface EventData {
  circuitId: string;
  lapLength: { value: number; unit: 'm'; provenance: Provenance; source: string };
  lines: EventLine[];
}

/** Circuitos de referencia con datos de evento auditados (base inicial de R03). */
export const EVENT_DATA_IDS = ['barcelona', 'monaco'];

const UNIT = 'fraccion-vuelta' as const;

export function buildEventData(spec: CircuitSpec, track: TrackDefinition): EventData {
  const fiaPlan = `Plano DRS FIA 2025 · ${spec.officialGpName}`;
  const calibrated = 'Calibrado sobre el trazado SVG del juego';
  const lines: EventLine[] = [
    { id: 'meta', kind: 'meta', unit: UNIT, t: 0, provenance: 'calibrado', source: `${calibrated} (startOffsetT ${spec.startOffsetT ?? 0})` },
    { id: 'S1', kind: 'sector', unit: UNIT, t: track.sector1EndT, provenance: 'provisional', source: 'Reparto fijo del juego, no sectores oficiales' },
    { id: 'S2', kind: 'sector', unit: UNIT, t: track.sector2EndT, provenance: 'provisional', source: 'Reparto fijo del juego, no sectores oficiales' },
    { id: 'pit-entrada', kind: 'pit-entrada', unit: UNIT, t: track.pitEntryT, provenance: 'calibrado', source: calibrated },
    { id: 'pit-salida', kind: 'pit-salida', unit: UNIT, t: track.pitExitT, provenance: 'calibrado', source: calibrated },
    { id: 'pit-compromiso', kind: 'pit-compromiso', unit: UNIT, t: track.pitCommitmentT ?? track.pitEntryT, provenance: 'calibrado', source: 'Línea táctica del juego, no dato FIA' },
  ];
  // Zonas: la activación es oficial cuando la ficha lo indica (Q19); el fin de zona se calibra en la frenada.
  const detections = spec.drsDetections ?? [];
  for (const zone of spec.drsZoneSpecs) {
    const verified = detections.some(d => d.source === 'verified' && d.zoneIds.includes(zone.id));
    lines.push({
      id: `Z${zone.id}`, kind: 'drs-zona', unit: UNIT, startT: zone.startT, endT: zone.endT, zoneId: zone.id,
      provenance: verified ? 'verificado' : 'calibrado',
      source: verified ? `${fiaPlan} (${zone.name}); fin de zona calibrado en la frenada` : calibrated,
    });
  }
  for (const detection of detections) {
    const verified = detection.source === 'verified';
    lines.push({
      id: detection.id, kind: 'drs-deteccion', unit: UNIT, t: detection.t, zoneIds: [...detection.zoneIds],
      provenance: verified ? 'verificado' : 'calibrado', source: verified ? fiaPlan : calibrated,
    });
  }
  return {
    circuitId: spec.id,
    lapLength: { value: spec.lapLengthMeters, unit: 'm', provenance: 'verificado', source: `Ficha del circuito · ${spec.officialGpName}` },
    lines,
  };
}

const PROVENANCES: Provenance[] = ['verificado', 'calibrado', 'provisional', 'sintetico'];
const inRange = (t: unknown) => typeof t === 'number' && Number.isFinite(t) && t >= 0 && t < 1;

/** Errores de los datos de un evento (vacío si son válidos). */
export function validateEventData(data: EventData): string[] {
  const errors: string[] = [];
  const where = (line: EventLine) => `${data.circuitId}/${line.id}`;
  if (!(data.lapLength?.value > 0) || data.lapLength.unit !== 'm') errors.push(`${data.circuitId}: longitud de vuelta sin valor o sin unidad (m)`);
  const ids = new Set<string>();
  for (const line of data.lines) {
    if (ids.has(line.id)) errors.push(`${where(line)}: id duplicado`);
    ids.add(line.id);
    if (line.unit !== UNIT) errors.push(`${where(line)}: falta la unidad (${UNIT})`);
    if (!PROVENANCES.includes(line.provenance)) errors.push(`${where(line)}: procedencia desconocida`);
    if (line.provenance === 'verificado' && !line.source?.trim()) errors.push(`${where(line)}: dato verificado sin fuente`);
    const positions = line.kind === 'drs-zona' ? [line.startT, line.endT] : [line.t];
    if (!positions.every(inRange)) errors.push(`${where(line)}: posición fuera de [0, 1)`);
  }
  const zones = data.lines.filter(l => l.kind === 'drs-zona');
  const detections = data.lines.filter(l => l.kind === 'drs-deteccion');
  for (const detection of detections) {
    if (!detection.zoneIds?.length) errors.push(`${where(detection)}: detección sin zonas`);
    for (const zoneId of detection.zoneIds ?? []) {
      if (!zones.some(z => z.zoneId === zoneId)) errors.push(`${where(detection)}: zona ${zoneId} inexistente`);
    }
  }
  for (const zone of zones) {
    if (!detections.some(d => d.zoneIds?.includes(zone.zoneId!))) errors.push(`${where(zone)}: zona sin detección`);
  }
  return errors;
}
