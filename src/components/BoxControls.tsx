import { useState } from 'react';
import { ArrowUpDown, CloudRain, Dices, Fuel, Gauge, Hourglass, Lock, Swords, Wrench, Zap } from 'lucide-react';
import type { CarState, TireCompound } from '../types/f1';
import type { EngineOrder } from '../engine/EngineHost';
import type { TeamView } from '../engine/RaceView';
import type { Ack } from '../engine/RaceSession';
import type { WallProposal, WallReading } from '../simulation/Wall';
import type { PaceStatus } from './PaceControls';
import styles from './BoxControls.module.css';
import { PaceControls, paceNote } from './PaceControls';
import { CompoundBadge } from './CompoundBadge';
import { COMPOUND_STYLES, TIRE_COMPOUNDS } from '../utils/compounds';
import { WallProposals } from './WallProposals';
import { PitWindowLine } from './WallPanel';
import { Segmented } from './ui/Segmented';
import { Meter, meterTone } from './ui/Meter';
import { Chip } from './ui/Tile';

const CROSSOVER_LABEL = { slick: 'neumático de seco', intermediate: 'INTERMEDIO', wet: 'LLUVIA' } as const;
const ORDER_STATUS = { consumed: 'EJECUTADA', committed: 'CONFIRMADA', cancelled: 'CANCELADA', rejected: 'RECHAZADA', accepted: 'ACEPTADA' } as const;
const decimal = (value: number) => value.toFixed(1).replace('.', ',');

// [Q11] Panel dual de pilotos del equipo — controles independientes de boxes para ambos coches.
// [V3] Sin desplegables: el ritmo y el compuesto son controles segmentados, el estado del coche son medidores y los
// avisos, fichas en una sola línea. Cada tarjeta mide siempre lo mismo, así que el muro no le cambia el alto al circuito.
export function BoxControls({ car, teamCars, team, race, send }: {
  car: CarState;
  teamCars?: CarState[];
  /** [N3] Vista privada del equipo (muro, propuestas, órdenes, ritmo y cruce de compuestos) que manda el motor. */
  team: TeamView | null | undefined;
  /** [N3] Estado de la carrera que decide si se pueden dar órdenes. */
  race: { lightState: string; isFinished: boolean; raceFlagState: string };
  /** [N3] Manda una orden al motor; se resuelve con su acuse. */
  send: (order: EngineOrder) => Promise<Ack>;
}) {
  const own = (carId: number) => team?.cars.find(c => c.id === carId);
  // State is keyed per car id so toggling between pilots doesn't lose compound selection
  // [R44] Cruce de compuestos según el agua actual.
  const crossover = (carId: number) => (own(carId)?.crossover as { recommended: 'slick' | 'intermediate' | 'wet'; depthMm: number; advise: boolean } | undefined) ?? { recommended: 'slick' as const, depthMm: 0, advise: false };
  const [compounds, setCompounds] = useState<Record<number, TireCompound>>({});
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});
  // [V2] En pantallas estrechas se enseña un piloto cada vez; el conmutador elige cuál.
  const [shownId, setShownId] = useState<number | null>(null);

  // Determine which cars to show: both team pilots if available, otherwise just the single car
  const pilots = teamCars && teamCars.length === 2 ? teamCars : [car];

  const shown = pilots.some(p => p.id === shownId) ? shownId! : pilots[0].id;
  // [T4.14] Orden de equipo vigente entre los dos coches.
  const teamId = pilots[0].driver.teamId;
  const teamOrder = (team?.teamOrder as { mode: string; favouredCarId?: number } | null) ?? { mode: 'libre' };
  const orderValue = teamOrder.mode === 'dejar-pasar' ? String(teamOrder.favouredCarId) : teamOrder.mode;
  const ordersAvailable = race.lightState === 'racing' && !race.isFinished && pilots.every(p => p.status === 'running');

  const setCompoundFor = (carId: number, compound: TireCompound) => {
    setCompounds(prev => ({ ...prev, [carId]: compound }));
  };
  const setFeedbackFor = (carId: number, msg: string) => {
    setFeedbacks(prev => ({ ...prev, [carId]: msg }));
  };

  return (
    <section className={styles.controls} aria-label="Órdenes de boxes del equipo">
      <div className={styles.teamHeader}>
        <strong>MURO · {car.team.shortName.toUpperCase()}</strong>
      </div>
      {pilots.length > 1 && (
        <div className={styles.pilotSwitch}>
          <Segmented label="Piloto que se enseña en el muro" name="muro-piloto" value={String(shown)} onChange={value => setShownId(Number(value))}
            options={pilots.map(p => ({ value: String(p.id), label: `${p.driver.code} · P${p.currentPosition}` }))} />
        </div>
      )}
      <div className={styles.pilotsGrid} data-orders={pilots.length > 1 ? 'true' : undefined}>
        {/* [T4.14] Órdenes de equipo: franja estrecha entre las dos tarjetas. */}
        {pilots.length > 1 && (
          <div className={styles.teamOrders}>
            <Segmented compact label="Órdenes de equipo" name="ordenes-equipo" value={orderValue} disabled={!ordersAvailable}
              onChange={value => {
                if (value === 'libre' || value === 'mantener') void send({ kind: 'teamOrder', teamId, mode: value });
                else void send({ kind: 'teamOrder', teamId, mode: 'dejar-pasar', favouredCarId: Number(value) });
              }}
              options={[
                { value: 'libre', label: 'Lucha libre', title: 'Lucha libre: cada piloto hace su carrera', content: <><Swords size={16} aria-hidden="true" />Libre</> },
                { value: 'mantener', label: 'Mantener posiciones', title: 'Mantener posiciones: el de detrás no ataca a su compañero', content: <><Lock size={16} aria-hidden="true" />Mantener</> },
                ...pilots.map(p => ({ value: String(p.id), label: `Dejar pasar a ${p.driver.code}`, title: `Dejar pasar a ${p.driver.code}: su compañero levanta en la siguiente zona de adelantamiento`,
                  content: <><ArrowUpDown size={16} aria-hidden="true" />Pasa {p.driver.code}</> })),
              ]} />
          </div>
        )}
        {pilots.map(p => {
          const order = p.pitStop.activeBoxOrder;
          const available = race.lightState === 'racing' && !race.isFinished &&
            race.raceFlagState !== 'red' && p.status === 'running' && !p.isInPitLane && !p.pitStop.isPitting;
          const locked = order?.status === 'committed';
          const compound = compounds[p.id] || 'hard';
          const feedback = feedbacks[p.id] || '';
          const isWaiting = p.pitStop.waitingForBox;
          const isPitting = p.pitStop.isPitting && p.isInPitLane;
          const reading = (own(p.id)?.reading as WallReading | null | undefined) ?? null;
          const advice = crossover(p.id);
          const paceStatus = own(p.id)?.paceStatus as PaceStatus | null | undefined;
          const pace = paceNote(paceStatus);

          // Status badge
          let statusBadge = '';
          let statusClass = '';
          if (p.status === 'out') { statusBadge = 'DNF'; statusClass = styles.badgeDnf; }
          else if (p.status === 'finished') { statusBadge = 'FIN'; statusClass = styles.badgeFinished; }
          else if (isWaiting) { statusBadge = 'ESPERANDO'; statusClass = styles.badgeWaiting; }
          else if (isPitting && p.pitStop.currentStopTimer < p.pitStop.stopDuration) { statusBadge = 'EN SERVICIO'; statusClass = styles.badgeService; }
          else if (isPitting) { statusBadge = 'PIT'; statusClass = styles.badgePit; }
          else if (order?.status === 'committed') { statusBadge = 'CONFIRMADA'; statusClass = styles.badgeCommitted; }
          else if (order?.status === 'accepted') { statusBadge = 'ACEPTADA'; statusClass = styles.badgeAccepted; }

          const message = feedback || (p.status === 'out' || p.status === 'finished' ? 'No disponible.' : order?.message) || '';
          const health = Math.round(p.tires.health);

          return (
            <div key={p.id} className={styles.pilotCard} data-shown={p.id === shown ? 'true' : undefined}>
              <div className={styles.pilotIdentity}>
                <span className={styles.pilotCode}>{p.driver.code} #{p.driver.number}</span>
                <span className={styles.pilotPos}>P{p.currentPosition}</span>
                {statusBadge && <span className={`${styles.badge} ${statusClass}`}>{statusBadge}</span>}
              </div>
              <div className={styles.gauges}>
                <Meter label="Neumático" percent={health} text={`${health}%`} tone={meterTone(health, 50, 25)}
                  icon={<CompoundBadge compound={p.tires.compound} size={20} detail={`montado · salud ${health}%`} />} />
                {reading && (
                  <Meter label="Batería" icon={<Zap size={16} />} percent={reading.energy.percent} text={`${Math.round(reading.energy.percent)}%`}
                    tone={meterTone(reading.energy.percent, 30, 10)} />
                )}
                {reading && (
                  <Meter label="Combustible: vueltas de margen" icon={<Fuel size={16} />}
                    percent={reading.fuel.lapsToGo > 0 ? 100 * reading.fuel.lapsOfFuel / reading.fuel.lapsToGo : 100}
                    text={`${reading.fuel.reserveLaps >= 0 ? '+' : '−'}${decimal(Math.abs(reading.fuel.reserveLaps))} v`}
                    tone={reading.fuel.reserveLaps < 0 ? 'bad' : reading.fuel.reserveLaps < 0.5 ? 'warn' : 'ok'} />
                )}
                <span className={styles.stops} title={`Vuelta ${p.currentLap} · paradas hechas: ${p.pitStop.totalPitStops}`}>
                  <Wrench size={15} aria-hidden="true" />{p.pitStop.totalPitStops}
                </span>
              </div>
              <div className={styles.paceControls}>
                <PaceControls car={p} pace={paceStatus} send={send} />
              </div>
              {/* [R57] Dos grupos (selección y botones) para que la fila salte de línea entera cuando la columna es estrecha. */}
              <div className={styles.orderRow}>
                <Segmented compact label={`Compuesto para ${p.driver.code}`} name={`compuesto-${p.id}`} value={compound}
                  disabled={!available || locked} onChange={value => setCompoundFor(p.id, value)}
                  options={TIRE_COMPOUNDS.map(c => ({ value: c, label: COMPOUND_STYLES[c].name, content: <CompoundBadge compound={c} size={24} detail="selección para la orden" /> }))} />
                <span className={styles.orderActions}>
                  <button disabled={!available || locked} onClick={() => {
                    void send({ kind: 'box', carId: p.id, compound }).then(ack => setFeedbackFor(p.id, ack.ok ? '' : 'Rechazada'));
                  }}>{order?.status === 'accepted' ? 'Actualizar' : 'BOX'}</button>
                  <button disabled={!available || order?.status !== 'accepted'} title="Anular la parada y seguir en pista" onClick={() => {
                    void send({ kind: 'cancelBox', carId: p.id }).then(ack => setFeedbackFor(p.id, ack.ok ? '' : 'No cancelable'));
                  }}>Seguir</button>
                </span>
              </div>
              {/* Avisos en una sola línea de altura fija: ventana de parada, cruce de compuestos, suerte, cola y acuse. */}
              <div className={styles.statusLine} role="status" aria-live="polite">
                {/* [T4.15] Dónde saldría este coche si parase ahora. */}
                <PitWindowLine window={reading?.pitWindow ?? null} />
                {advice.advise && (
                  <Chip tone="warn" icon={<CloudRain size={15} aria-hidden="true" />} data-weather-crossover={advice.recommended}
                    title="Cruce de compuestos según el agua media actual de la pista">
                    Conviene {CROSSOVER_LABEL[advice.recommended]} ({decimal(advice.depthMm)} mm de agua)
                  </Chip>
                )}
                {p.pitStop.crewBenefit && p.currentLap <= p.pitStop.crewBenefit.expiresLap && (
                  <Chip tone="ok" icon={<Dices size={15} aria-hidden="true" />} data-crew-benefit={p.pitStop.crewBenefit.eventId}
                    title="Beneficio D20: solo acorta el servicio de la próxima parada; el tránsito por el pit lane no cambia">
                    {p.pitStop.crewBenefit.label}: servicio {decimal(p.pitStop.crewBenefit.minSec)}–{decimal(p.pitStop.crewBenefit.maxSec)} s hasta V{p.pitStop.crewBenefit.expiresLap}
                  </Chip>
                )}
                {isWaiting && <Chip tone="warn" icon={<Hourglass size={15} aria-hidden="true" />}>Esperando cajón ({p.pitStop.boxWaitTimer.toFixed(1)}s)</Chip>}
                {pace && <Chip tone="warn" icon={<Gauge size={15} aria-hidden="true" />} title={`Ritmo: ${pace}`}>{pace}</Chip>}
                {(message || order) && (
                  <span className={styles.message}>
                    {message}
                    {order && <span> <CompoundBadge compound={order.compound} size={14} detail="solicitado" /> {order.compound.toUpperCase()} · {order.status in ORDER_STATUS ? ORDER_STATUS[order.status as keyof typeof ORDER_STATUS] : 'ACEPTADA'}</span>}
                  </span>
                )}
              </div>
              {/* [R54] El estratega propone; nada se ejecuta en este coche sin aceptar (o sin delegar). */}
              {(p.status === 'running' || p.status === 'pit') && !race.isFinished ? (
                <WallProposals proposals={(own(p.id)?.proposals as WallProposal[] | undefined) ?? []} delegated={Boolean(own(p.id)?.delegated ?? p.wallDelegated)}
                  onAccept={id => { void send({ kind: 'acceptProposal', carId: p.id, proposalId: id }).then(ack => setFeedbackFor(p.id, ack.ok ? '' : 'Propuesta no aplicable ahora')); }}
                  onDiscard={id => { void send({ kind: 'discardProposal', carId: p.id, proposalId: id }); setFeedbackFor(p.id, ''); }}
                  onDelegate={on => { void send({ kind: 'delegate', carId: p.id, delegated: on }); setFeedbackFor(p.id, ''); }} />
              ) : <div className={styles.proposalsGap} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
