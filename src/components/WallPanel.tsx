import React from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Fuel, Zap } from 'lucide-react';
import styles from './WallPanel.module.css';
import { DrsStatusBadge } from './DrsStatusBadge';
import { CompoundBadge } from './CompoundBadge';
import { carFlags } from '../simulation/Wall';
import type { WallReading } from '../simulation/Wall';
import { pitWindowText } from '../simulation/PitWindow';
import type { PitWindow, TyreInfo } from '../simulation/PitWindow';
import { Meter, meterTone } from './ui/Meter';
import { Chip } from './ui/Tile';

interface WallPanelProps {
  reading: WallReading | null;
}

const decimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');
/** Hueco a partir del cual la barra de distancia ya va llena (s). */
const GAP_FULL_SEC = 3;

/** [T4.15] Ventana de parada en una línea, para la tarjeta de cada piloto: «Si paras: P9, a 2,1 s de HUL». */
export const PitWindowLine: React.FC<{ window: PitWindow | null }> = ({ window }) => {
  const text = pitWindowText(window);
  return text ? <span className={styles.pitWindow}>Si paras: {text}</span> : null;
};

/** Hueco con un rival como barra: cuanto más corta, más cerca está. */
const GapBar: React.FC<{ label: string; icon: React.ReactNode; seconds: number | null; code: string | null }> = ({ label, icon, seconds, code }) => (
  <div className={styles.gap} title={seconds === null || code === null ? `${label}: nadie` : `${label}: ${decimal(seconds, 2)} s con ${code}`}>
    <span className={styles.gapLabel}>{icon}{label}</span>
    <span className={styles.bar}><span className={styles.barFill} data-close={seconds !== null && seconds < 1 ? 'true' : undefined}
      style={{ width: `${seconds === null ? 0 : Math.min(100, 100 * seconds / GAP_FULL_SEC)}%` }} /></span>
    <span className={styles.gapValue}>{seconds === null || code === null ? '—' : <><strong>{code}</strong> {decimal(seconds, 2)} s</>}</span>
  </div>
);

/** Neumático de un coche como barra de vida: lo gastado, lleno; lo que le queda, vacío. */
const TyreRow: React.FC<{ who: string; tyre: TyreInfo }> = ({ who, tyre }) => {
  const total = tyre.laps + tyre.lifeLaps;
  return (
    <div className={styles.tyreRow} title={`${who}: ${tyre.laps} ${tyre.laps === 1 ? 'vuelta' : 'vueltas'}, unas ${tyre.lifeLaps} más`}>
      <span className={styles.tyreWho}>{who}</span>
      <CompoundBadge compound={tyre.compound} size={18} />
      <span className={styles.bar}><span className={styles.barFill} data-worn={tyre.lifeLaps <= 3 ? 'true' : undefined} style={{ width: `${total > 0 ? 100 * tyre.laps / total : 100}%` }} /></span>
      <span className={styles.tyreLaps}>{tyre.laps} {tyre.laps === 1 ? 'vuelta' : 'vueltas'} · +{tyre.lifeLaps}</span>
    </div>
  );
};

/**
 * [R24] Lectura del muro en el detalle del coche: cada cifra sale de los registros del motor.
 * [V4] En imagen: huecos y neumáticos como barras, energía y combustible como medidores, la ventana de parada como una
 * ficha con el puesto en grande y los avisos como fichas. El detalle escrito queda al pasar el ratón.
 */
export const WallPanel: React.FC<WallPanelProps> = ({ reading }) => {
  if (!reading) return null;
  const { fuel, energy, tyres, moves, paceLaps } = reading;
  // La misma marca que usan la torre de posiciones y el minimapa.
  const flags = carFlags({ drsStatus: reading.drs, isInPitLane: reading.pit, pitStop: { isPitting: false }, penaltyNote: reading.penalties[0] ?? null });
  const paceTotal = Math.max(1, paceLaps.push + paceLaps.balanced + paceLaps.save);
  const window = reading.pitWindow;
  return (
    <section className={styles.wall} aria-label={`Muro de ${reading.code}`} data-flag-drs={flags.drs ?? undefined} data-flag-pit={flags.inPit ? 'true' : undefined}>
      <h3 className={styles.title}>
        <span>Muro · {reading.code} P{reading.position}{flags.inPit ? ' · en boxes' : ''}</span>
        <DrsStatusBadge status={reading.drs} uses={reading.drsUses} />
      </h3>

      <div className={styles.block}>
        <GapBar label="Delante" icon={<ArrowUp size={14} aria-hidden="true" />} seconds={reading.gapAheadSec} code={reading.aheadCode} />
        <GapBar label="Detrás" icon={<ArrowDown size={14} aria-hidden="true" />} seconds={reading.gapBehindSec} code={reading.behindCode} />
      </div>

      <div className={styles.meters}>
        <span className={styles.meterCell} title={`Energía: ${decimal(energy.storedMJ, 2)} MJ · en la vuelta: +${decimal(energy.recoveredLapMJ, 2)} recuperados, −${decimal(energy.deployedLapMJ, 2)} desplegados`}>
          <Meter label="Energía" icon={<Zap size={16} />} percent={energy.percent} text={`${Math.round(energy.percent)}%`} tone={meterTone(energy.percent, 30, 10)} />
          <small>Energía · +{decimal(energy.recoveredLapMJ, 1)} / −{decimal(energy.deployedLapMJ, 1)} MJ</small>
        </span>
        <span className={styles.meterCell} title={`Combustible: ${decimal(fuel.kg)} kg · da para ${decimal(fuel.lapsOfFuel)} vueltas y faltan ${decimal(fuel.lapsToGo)}`}>
          <Meter label="Combustible" icon={<Fuel size={16} />} percent={fuel.lapsToGo > 0 ? 100 * fuel.lapsOfFuel / fuel.lapsToGo : 100}
            text={`${decimal(fuel.kg)} kg`} tone={fuel.reserveLaps < 0 ? 'bad' : fuel.reserveLaps < 0.5 ? 'warn' : 'ok'} />
          <small className={fuel.reserveLaps < 0 ? styles.bad : undefined}>Combustible · reserva {fuel.reserveLaps >= 0 ? '+' : '−'}{decimal(Math.abs(fuel.reserveLaps))} vueltas</small>
        </span>
      </div>

      <div className={styles.block}>
        <div className={styles.blockTitle}>
          <span>Neumáticos · {Math.round(tyres.health)} %</span>
          <span className={styles.sets} title="Juegos libres">
            {(['soft', 'medium', 'hard'] as const).map(compound => (
              <span key={compound} className={styles.set}><CompoundBadge compound={compound} size={16} detail={`juegos libres: ${tyres.available[compound]}`} />{tyres.available[compound]}</span>
            ))}
          </span>
        </div>
        {/* [T4.15] Gomas propias y de los rivales: compuesto, vueltas y lo que les queda. */}
        {reading.rivalTyres ? (
          <>
            <TyreRow who="Tú" tyre={reading.rivalTyres.own} />
            {reading.rivalTyres.ahead && <TyreRow who={reading.rivalTyres.ahead.code} tyre={reading.rivalTyres.ahead} />}
            {reading.rivalTyres.behind && <TyreRow who={reading.rivalTyres.behind.code} tyre={reading.rivalTyres.behind} />}
          </>
        ) : (
          <div className={styles.tyreRow}><span className={styles.tyreWho}>Tú</span><CompoundBadge compound={tyres.compound} size={18} />
            <span className={styles.bar}><span className={styles.barFill} style={{ width: `${100 - tyres.health}%` }} /></span></div>
        )}
        {tyres.ruleWarning && <Chip tone="warn" icon={<AlertTriangle size={14} aria-hidden="true" />}>{tyres.ruleWarning}</Chip>}
      </div>

      {/* [T4.15] Ventana de parada: el puesto en grande y con quién saldría. */}
      {window && (
        <div className={styles.window} title={`Si paras: ${pitWindowText(window)}`}>
          <span className={styles.windowPos}><small>Si paras</small>P{window.position}</span>
          <span className={styles.windowText}>
            <span>{pitWindowText(window)}</span>
            {window.behind && <span>{decimal(window.behind.gapSec)} s por delante de {window.behind.code}</span>}
            <span className={styles.dim}>pierdes {decimal(window.lossSec)} s</span>
          </span>
        </div>
      )}

      <div className={styles.chips}>
        {reading.undercut && <Chip tone="warn" icon={<AlertTriangle size={14} aria-hidden="true" />}>{reading.undercut}</Chip>}
        {reading.vscDeltaSec !== null && <Chip tone={reading.vscDeltaSec < 0 ? 'bad' : 'ok'}>VSC · delta {reading.vscDeltaSec >= 0 ? '+' : '−'}{decimal(Math.abs(reading.vscDeltaSec), 2)} s</Chip>}
        {reading.penalties.map(penalty => <Chip key={penalty} tone="bad" title="Sanción">Sanción · {penalty}</Chip>)}
        {reading.upgrades.map(upgrade => <Chip key={upgrade} title="Mejora montada">{upgrade}</Chip>)}
      </div>

      <div className={styles.footer}>
        <span title="Puestos ganados y perdidos según dónde">
          En pista <b>+{moves.pista.gained}</b>/−{moves.pista.lost} · En boxes <b>+{moves.boxes.gained}</b>/−{moves.boxes.lost}
          {moves.abandono.gained > 0 && <> · Abandonos <b>+{moves.abandono.gained}</b></>}
        </span>
        <span className={styles.paceBar} role="img" aria-label={`Vueltas por ritmo: Ataque ${paceLaps.push}, Normal ${paceLaps.balanced}, Ahorro ${paceLaps.save}`}
          title={`Vueltas por ritmo: Ataque ${paceLaps.push} · Normal ${paceLaps.balanced} · Ahorro ${paceLaps.save}`}>
          <span data-pace="push" style={{ flexGrow: paceLaps.push / paceTotal }} />
          <span data-pace="balanced" style={{ flexGrow: paceLaps.balanced / paceTotal }} />
          <span data-pace="save" style={{ flexGrow: paceLaps.save / paceTotal }} />
        </span>
      </div>
    </section>
  );
};
