// [R13] Comisarios: infracción objetiva → decisión → cumplimiento, con identificadores para no aplicar nada dos veces.
//
// S54.3-54.4: 5/10 s se cumplen en la siguiente parada antes de trabajar en el coche, o se suman al final si no vuelve
// a parar; drive-through y stop-and-go de 10 s deben cumplirse antes de dos pasos por meta (sin contar neutralización);
// impuestas en las tres últimas vueltas o tras el final se convierten en 5/10/20/30 s.
// La tabla infracción → sanción es POLÍTICA DE CALIBRACIÓN DEL JUEGO, no un baremo FIA.

export type PenaltyType = 'time-5' | 'time-10' | 'drive-through' | 'stop-go' | 'dsq';
export type DecisionStatus = 'pendiente' | 'cumplida' | 'al-final' | 'dsq' | 'anulada';

export interface Decision {
  id: string;
  carId: number;
  infractionKey?: string;
  penalty: PenaltyType;
  /** Segundos que suma la sanción al final (si se convierte o no se cumple en boxes). */
  seconds: number;
  article: string;
  reason: string;
  imposedAt: number;
  imposedLap: number;
  status: DecisionStatus;
  /** Pasos por meta en verde desde la notificación (drive-through / stop-and-go). */
  crossings: number;
  servedAt?: number;
}

/** Política del juego: infracción objetiva registrada → sanción. */
export const STEWARDS_POLICY: Record<string, { penalty: PenaltyType; article: string; reason: string }> = {
  'exceso-velocidad': { penalty: 'time-5', article: 'S54.3 (política del juego)', reason: 'Exceso de velocidad en el pit lane' },
  'delta-vsc': { penalty: 'time-5', article: 'S56 (política del juego)', reason: 'Delta del VSC negativo' },
};

/** S54.3: conversión de sanciones impuestas en las tres últimas vueltas o tras el final. */
export const LATE_CONVERSION_SEC: Record<Exclude<PenaltyType, 'dsq'>, number> = {
  'time-5': 5, 'time-10': 10, 'drive-through': 20, 'stop-go': 30,
};
const BASE_SECONDS: Record<PenaltyType, number> = { 'time-5': 5, 'time-10': 10, 'drive-through': 0, 'stop-go': 0, dsq: 0 };
/** Pasos por meta permitidos antes de cumplir un drive-through o stop-and-go. */
export const DRIVE_DEADLINE_CROSSINGS = 2;

export class Stewards {
  decisions: Decision[] = [];
  private processed = new Set<string>();
  private nextId = 1;

  reset() {
    this.decisions = [];
    this.processed.clear();
    this.nextId = 1;
  }

  /** Decide una infracción objetiva según la política; idempotente por `key`. */
  processInfraction(key: string, carId: number, type: string, time: number, lap: number, late: boolean): Decision | null {
    if (this.processed.has(key)) return null;
    this.processed.add(key);
    const policy = STEWARDS_POLICY[type];
    if (!policy) return null;
    return this.impose(carId, policy.penalty, policy.article, policy.reason, time, lap, late, key);
  }

  impose(carId: number, penalty: PenaltyType, article: string, reason: string, time: number, lap: number, late: boolean,
    infractionKey?: string): Decision {
    const decision: Decision = {
      id: `dec_${this.nextId++}`, carId, infractionKey, penalty, seconds: BASE_SECONDS[penalty], article, reason,
      imposedAt: time, imposedLap: lap, status: penalty === 'dsq' ? 'dsq' : 'pendiente', crossings: 0,
    };
    if (late && penalty !== 'dsq') {
      decision.status = 'al-final';
      decision.seconds = LATE_CONVERSION_SEC[penalty];
    }
    this.decisions.push(decision);
    return decision;
  }

  pending(carId: number): Decision[] {
    return this.decisions.filter(d => d.carId === carId && d.status === 'pendiente');
  }

  /** Drive-through o stop-and-go pendiente (se cumple antes que cualquier otro trabajo). */
  pendingDrive(carId: number): Decision | undefined {
    return this.pending(carId).find(d => d.penalty === 'drive-through' || d.penalty === 'stop-go');
  }

  /** Segundos de 5/10 s pendientes para la próxima parada. */
  pendingTimeSec(carId: number): number {
    return this.pending(carId).filter(d => d.penalty === 'time-5' || d.penalty === 'time-10').reduce((s, d) => s + d.seconds, 0);
  }

  /** Paso por meta: cuenta para el plazo de drive-through / stop-and-go si no hay neutralización. Devuelve la DSQ si vence. */
  onLineCrossing(carId: number, neutralized: boolean): Decision | undefined {
    const drive = this.pendingDrive(carId);
    if (!drive || neutralized) return undefined;
    drive.crossings++;
    if (drive.crossings > DRIVE_DEADLINE_CROSSINGS) {
      drive.status = 'dsq';
      return drive;
    }
    return undefined;
  }

  markServed(ids: string[], time: number) {
    for (const d of this.decisions) if (ids.includes(d.id) && d.status === 'pendiente') { d.status = 'cumplida'; d.servedAt = time; }
  }

  /** Al terminar: lo pendiente se suma al tiempo final (convertido si es drive-through o stop-and-go). */
  finalize(carId: number) {
    for (const d of this.pending(carId)) {
      if (d.penalty === 'dsq') continue;
      d.status = 'al-final';
      d.seconds = LATE_CONVERSION_SEC[d.penalty];
    }
  }

  /** Coche retirado: sus sanciones pendientes quedan registradas pero no se aplican. */
  annul(carId: number) {
    for (const d of this.pending(carId)) d.status = 'anulada';
  }

  /** Segundos que se suman al tiempo final. */
  finalPenaltySec(carId: number): number {
    return this.decisions.filter(d => d.carId === carId && d.status === 'al-final').reduce((s, d) => s + d.seconds, 0);
  }
}
