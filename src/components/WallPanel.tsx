import React from 'react';
import styles from './WallPanel.module.css';
import { DrsStatusBadge } from './DrsStatusBadge';
import { carFlags } from '../simulation/Wall';
import type { WallReading } from '../simulation/Wall';
import { COMPOUND_LABEL } from '../simulation/TireInventory';
import { pitWindowText } from '../simulation/PitWindow';
import type { PitWindow, TyreInfo } from '../simulation/PitWindow';

interface WallPanelProps {
  reading: WallReading | null;
}

const decimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');
const gap = (seconds: number | null, code: string | null) => (seconds === null || code === null ? '—' : `${decimal(seconds, 2)} s con ${code}`);

/** [T4.15] Ventana de parada en una línea, para la tarjeta de cada piloto: «Si paras: P9, a 2,1 s de HUL». */
export const PitWindowLine: React.FC<{ window: PitWindow | null }> = ({ window }) => {
  const text = pitWindowText(window);
  return text ? <span className={styles.pitWindow}>Si paras: {text}</span> : null;
};

const tyreLine = (who: string, tyre: TyreInfo) => `${who}: ${COMPOUND_LABEL[tyre.compound].toLowerCase()}, ${tyre.laps} ${tyre.laps === 1 ? 'vuelta' : 'vueltas'} (unas ${tyre.lifeLaps} más)`;

/** [R24] Lectura del muro en el detalle del coche: cada cifra sale de los registros del motor. */
export const WallPanel: React.FC<WallPanelProps> = ({ reading }) => {
  if (!reading) return null;
  const { fuel, energy, tyres, moves, paceLaps } = reading;
  // La misma marca que usan la torre de posiciones y el minimapa.
  const flags = carFlags({ drsStatus: reading.drs, isInPitLane: reading.pit, pitStop: { isPitting: false }, penaltyNote: reading.penalties[0] ?? null });
  return (
    <section className={styles.wall} aria-label={`Muro de ${reading.code}`} data-flag-drs={flags.drs ?? undefined} data-flag-pit={flags.inPit ? 'true' : undefined}>
      <h3 className={styles.title}>Muro · {reading.code} P{reading.position}{flags.inPit ? ' · en boxes' : ''}</h3>
      <dl className={styles.list}>
        <dt>Delante</dt><dd>{gap(reading.gapAheadSec, reading.aheadCode)}</dd>
        <dt>Detrás</dt><dd>{gap(reading.gapBehindSec, reading.behindCode)}</dd>
        <dt>DRS</dt><dd><DrsStatusBadge status={reading.drs} uses={reading.drsUses} /></dd>
        <dt>Energía</dt>
        <dd>{decimal(energy.storedMJ, 2)} MJ ({Math.round(energy.percent)} %) · en la vuelta: +{decimal(energy.recoveredLapMJ, 2)} recuperados, −{decimal(energy.deployedLapMJ, 2)} desplegados</dd>
        <dt>Combustible</dt>
        <dd className={fuel.reserveLaps < 0 ? styles.bad : undefined}>
          {decimal(fuel.kg)} kg · da para {decimal(fuel.lapsOfFuel)} vueltas y faltan {decimal(fuel.lapsToGo)} · reserva {fuel.reserveLaps >= 0 ? '+' : '−'}{decimal(Math.abs(fuel.reserveLaps))} vueltas
        </dd>
        <dt>Neumáticos</dt>
        <dd>
          {COMPOUND_LABEL[tyres.compound]} al {Math.round(tyres.health)} % · juegos libres: {tyres.available.soft} blandos, {tyres.available.medium} medios, {tyres.available.hard} duros
          {tyres.ruleWarning && <span className={styles.warn}> · {tyres.ruleWarning}</span>}
        </dd>
        {/* [T4.15] Telemetría de decisión: ventana de parada, gomas de los rivales y aviso de undercut. */}
        {reading.pitWindow && (
          <>
            <dt>Si paras</dt>
            <dd>
              {pitWindowText(reading.pitWindow)}
              {reading.pitWindow.behind && ` · ${decimal(reading.pitWindow.behind.gapSec)} s por delante de ${reading.pitWindow.behind.code}`}
              {` · pierdes ${decimal(reading.pitWindow.lossSec)} s`}
            </dd>
          </>
        )}
        {reading.rivalTyres && (
          <>
            <dt>Gomas</dt>
            <dd>
              {[tyreLine('Tú', reading.rivalTyres.own),
                reading.rivalTyres.ahead && tyreLine(`Delante ${reading.rivalTyres.ahead.code}`, reading.rivalTyres.ahead),
                reading.rivalTyres.behind && tyreLine(`Detrás ${reading.rivalTyres.behind.code}`, reading.rivalTyres.behind)].filter(Boolean).join(' · ')}
            </dd>
          </>
        )}
        {reading.undercut && (<><dt>Aviso</dt><dd className={styles.warn}>{reading.undercut}</dd></>)}
        {reading.vscDeltaSec !== null && (<><dt>VSC</dt><dd className={reading.vscDeltaSec < 0 ? styles.bad : undefined}>Delta {reading.vscDeltaSec >= 0 ? '+' : '−'}{decimal(Math.abs(reading.vscDeltaSec), 2)} s</dd></>)}
        {reading.penalties.length > 0 && (<><dt>Sanciones</dt><dd className={styles.bad}>{reading.penalties.join(' · ')}</dd></>)}
        {reading.upgrades.length > 0 && (<><dt>Mejoras</dt><dd>{reading.upgrades.join(' · ')}</dd></>)}
        <dt>Puestos</dt>
        <dd>
          En pista +{moves.pista.gained} / −{moves.pista.lost} · En boxes +{moves.boxes.gained} / −{moves.boxes.lost}
          {moves.abandono.gained > 0 && ` · Por abandonos +${moves.abandono.gained}`}
        </dd>
        <dt>Ritmo</dt><dd>Ataque {paceLaps.push} · Normal {paceLaps.balanced} · Ahorro {paceLaps.save} (vueltas)</dd>
      </dl>
    </section>
  );
};
