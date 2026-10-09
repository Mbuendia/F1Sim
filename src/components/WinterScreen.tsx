import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { formatMoney } from '../simulation/Finance';
import type { WinterReport } from '../simulation/Winter';
import { Helmet } from './DriverContractsPanel';
import m from './Management.module.css';
import s from './Screens.module.css';

const STEPS = ['Cierre y premios', 'Junta', 'Mercado', 'Parrilla', 'Coche nuevo y objetivo'] as const;

const Row = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div><span>{label}</span><span className={`${m.num} ${tone ?? ''}`}>{value}</span></div>
);

/**
 * [T4.11] El invierno, entre la última ronda de una temporada y la primera de la siguiente, en cinco páginas a pantalla
 * completa con barra de progreso: cierre y premios, junta, mercado, parrilla y coche nuevo con su objetivo. Se puede
 * volver atrás hasta confirmar; al confirmar empieza la temporada nueva.
 */
export function WinterScreen({ report, onConfirm, initialStep = 0 }: { report: WinterReport; onConfirm: () => void; initialStep?: number }) {
  const [step, setStep] = useState(Math.max(0, Math.min(STEPS.length - 1, initialStep)));
  const tone = (amount: number) => (amount > 0 ? m.pos : amount < 0 ? m.neg : '');
  const { close, board, market, grid, car } = report;
  const quiet = market.retired.length + market.moves.length + market.promoted.length + market.left.length === 0;
  return (
    <div className={s.screen}>
      <header className={s.head} style={{ boxShadow: 'inset 0 3px 0 var(--equipo)' }}>
        <h1>Invierno · de la temporada {report.season} a la {report.nextSeason}</h1>
        <span className={s.spacer} />
        <span className={m.chip}>Paso {step + 1} de {STEPS.length} · {STEPS[step]}</span>
      </header>
      <div className={m.bar} role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Pasos del invierno">
        <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div className={s.body}>
        <div className={m.stack} style={{ gap: 14, maxWidth: 980, margin: '0 auto', width: '100%' }}>
          <h2 className={m.title} style={{ fontSize: 22 }}>{STEPS[step]}</h2>

          {step === 0 && (
            <section className={m.card}>
              <span className={m.label}>Temporada {report.season} · {report.teamName}</span>
              <div className={m.lines}>
                <Row label="Campeón de pilotos" value={close.champion ?? 'sin carreras'} />
                <Row label="Campeón de constructores" value={close.constructorsChampion ?? 'sin carreras'} />
                <Row label={`Tu equipo en constructores (${close.races} ${close.races === 1 ? 'Gran Premio disputado' : 'Grandes Premios disputados'})`} value={close.position ? `${close.position}.º · ${close.points} pts` : 'sin puntos'} />
                <Row label="Saldo al acabar la temporada" value={formatMoney(close.balance, true)} tone={tone(close.balance)} />
                <Row label="Premio de constructores" value={formatMoney(close.prize, true)} tone={tone(close.prize)} />
              </div>
            </section>
          )}

          {step === 1 && (
            <section className={`${m.card} ${m.stack}`}>
              <span className={m.label}>Balance de la junta de {report.teamName}</span>
              <p>Objetivo: <b>{board.objective}.º</b> en constructores · conseguido: <b>{board.position}.º</b> · <span className={board.met ? m.pos : m.neg}>{board.met ? 'objetivo cumplido' : 'objetivo no cumplido'}</span></p>
              {board.dismissed
                ? <p className={`${m.big} ${m.neg} ${m.count}`}>Destitución: la junta ha perdido la confianza. {board.newTeamName} te ofrece dirigir su equipo.</p>
                : board.lastChance
                  ? <p className={m.warn}>La junta ha perdido la confianza, pero no hay un equipo de menos nivel al que ir: te da otra temporada.</p>
                  : <p>{board.money > 0 ? 'Prima' : board.money < 0 ? 'Recorte' : 'Sin prima ni recorte'}{board.money !== 0 && <>: <b className={tone(board.money)}>{formatMoney(board.money, true)}</b></>}</p>}
              <div className={m.lines}>
                <Row label={board.dismissed ? `Confianza de la junta de ${board.newTeamName}` : 'Confianza para la temporada nueva'} value={`${Math.round(board.confidence)} de 100`} />
                <Row label="Objetivo de la temporada nueva" value={`${board.nextObjective}.º en constructores`} />
              </div>
            </section>
          )}

          {step === 2 && (
            <section className={`${m.card} ${m.stack}`}>
              <span className={m.label}>Mercado de pilotos</span>
              {quiet && <p className={m.muted}>Invierno tranquilo: todos los pilotos siguen en su equipo.</p>}
              {market.retired.map(line => <p key={line.name}><b>{line.name}</b> <span className={m.muted}>({line.age} años, {line.teamName})</span> · <span className={m.warn}>Se retira</span></p>)}
              {market.moves.map(move => <p key={move.name}><b>{move.name}</b> · {move.from} <ArrowRight size={14} aria-label="pasa a" /> <b>{move.to}</b></p>)}
              {market.promoted.map(line => <p key={line.name}><b>{line.name}</b> · <span className={m.pos}>sube de la cantera</span> a <b>{line.to}</b></p>)}
              {market.left.map(line => <p key={line.name}><b>{line.name}</b> <span className={m.muted}>({line.from})</span> · se queda sin asiento</p>)}
            </section>
          )}

          {step === 3 && (
            <section className={m.card}>
              <span className={m.label}>Parrilla de la temporada {report.nextSeason}</span>
              <div className={m.lines}>
                {grid.map(row => (
                  <div key={row.teamId} style={row.player ? { boxShadow: 'inset 4px 0 0 var(--equipo)', paddingLeft: 10 } : undefined}>
                    <b style={{ minWidth: 150 }}>{row.teamName}{row.player ? ' · tu equipo' : ''}</b>
                    <span className={`${m.row} ${m.wrap}`}>
                      {row.drivers.map(driver => (
                        <span key={driver.code} className={m.row} style={{ gap: 6 }}>
                          <Helmet teamId={row.teamId} number={driver.number} size={26} />{driver.name} <span className={m.dim}>{driver.age}</span>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {step === 4 && (
            <section className={`${m.card} ${m.stack}`}>
              <span className={m.label}>Coche nuevo de {car.teamName}</span>
              <p className={m.count}>El coche de la temporada {report.nextSeason} conserva la mitad de cada mejora montada en el anterior; los proyectos a medias se pierden.</p>
              {car.legacy.length === 0
                ? <p className={m.muted}>No hereda ninguna mejora: empieza con el coche de base.</p>
                : <div className={m.lines}>{car.legacy.map(item => <Row key={item.label} label={item.label} value={`${item.percent} % de su efecto`} />)}</div>}
              <div className={m.lines}>
                <Row label="Objetivo de la junta" value={`${car.objective}.º en constructores`} />
                <Row label="Saldo para empezar" value={formatMoney(car.balance, true)} tone={tone(car.balance)} />
              </div>
            </section>
          )}

          <div className={`${m.row} ${m.between}`}>
            {step > 0 ? <button type="button" className={m.button} onClick={() => setStep(step - 1)}><ArrowLeft size={16} aria-hidden /> Atrás</button> : <span />}
            {step < STEPS.length - 1
              ? <button type="button" className={m.primary} onClick={() => setStep(step + 1)}>Siguiente <ArrowRight size={16} aria-hidden /></button>
              : <button type="button" className={m.primary} onClick={onConfirm}>Empezar la temporada {report.nextSeason} <ArrowRight size={16} aria-hidden /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}
