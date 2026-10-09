import { ArrowRight } from 'lucide-react';
import { formatMoney } from '../simulation/Finance';
import type { RoundReport } from '../simulation/RoundReport';
import { SEASON_RACES } from '../simulation/Season';
import m from './Management.module.css';
import s from './Screens.module.css';

/**
 * [T4.20] Informe de la ronda, entre el podio y el centro de gestión: resultado de los dos coches, campeonato, dinero
 * concepto a concepto con su total, movimiento de la junta con su motivo, objetivos de patrocinio y mejora de los
 * pilotos. Tras un sprint es más corto: solo lo que el sprint mueve.
 */
export function RoundReportScreen({ report, onContinue }: { report: RoundReport; onContinue: () => void }) {
  const tone = (amount: number) => (amount > 0 ? m.pos : amount < 0 ? m.neg : '');
  return (
    <div className={s.screen}>
      <header className={s.head} style={{ boxShadow: 'inset 0 3px 0 var(--equipo)' }}>
        <h1>Informe · ronda {report.round} de {SEASON_RACES} · {report.circuitName}{report.format === 'sprint' ? ' · sprint' : ''}</h1>
        <span className={s.spacer} />
        <span className={m.chip}>{report.teamName}</span>
      </header>
      <div className={s.body}>
        <div className={m.report}>
          <div className={m.reportCars}>
            {report.cars.map(car => (
              <section key={car.code} className={`${m.card} ${m.reportCar}`}>
                <div><div className={m.title} style={{ fontSize: 18 }}>{car.name}</div><span className={m.muted}>{car.code}</span></div>
                <div style={{ textAlign: 'right' }}>
                  <div className={`${m.big} ${m.count}`}>{car.position ? `P${car.position}` : 'NC'}</div>
                  <div className={car.points > 0 ? m.pos : m.dim}>{car.points > 0 ? `+${car.points} pts` : 'sin puntos'}</div>
                </div>
              </section>
            ))}
          </div>
          <section className={m.card}>
            <span className={m.label}>Dinero de la ronda</span>
            <div className={m.lines}>
              {report.money.map((line, i) => <div key={i}><span>{line.label}</span><span className={`${m.num} ${tone(line.amount)}`}>{formatMoney(line.amount, true)}</span></div>)}
              <div><span>Resultado de la ronda</span><span className={`${m.num} ${tone(report.moneyTotal)} ${m.count}`}>{formatMoney(report.moneyTotal, true)}</span></div>
            </div>
            <p className={m.muted} style={{ marginTop: 8 }}>Saldo: {formatMoney(report.balanceBefore)} → <b style={{ color: '#fff' }}>{formatMoney(report.balanceAfter)}</b></p>
          </section>
          <div className={m.stack} style={{ gap: 14 }}>
            <section className={m.card}>
              <span className={m.label}>Campeonato</span>
              <p>Constructores: <b>{report.standing.position ? `${report.standing.position}.º · ${report.standing.points} pts` : 'sin puntos todavía'}</b></p>
            </section>
            {report.format === 'gp' && (
              <section className={m.card}>
                <span className={m.label}>Junta</span>
                {report.board
                  ? <><p className={`${m.big} ${m.count} ${tone(report.board.delta)}`}>{report.board.delta > 0 ? '+' : '−'}{Math.abs(report.board.delta)} <span className={m.muted} style={{ fontSize: 16 }}>· confianza {Math.round(report.board.confidence)}</span></p>
                    {report.board.reasons.map(reason => <p key={reason} className={m.muted}>{reason}</p>)}</>
                  : <p className={m.muted}>Sin cambios: el resultado fue el esperado.</p>}
              </section>
            )}
            {report.format === 'gp' && (
              <section className={m.card}>
                <span className={m.label}>Patrocinio y pilotos</span>
                <p>Objetivos de patrocinio: <b>{report.sponsors.met} de {report.sponsors.total}</b></p>
                <p className={m.muted}>{report.gains.length ? report.gains.map(gain => `${gain.code}: ${gain.text}`).join(' · ') : 'Sin mejora de los pilotos en esta carrera'}</p>
              </section>
            )}
          </div>
        </div>
      </div>
      <footer className={s.foot}>
        <span className={s.dim}>Cada cifra sale del libro y del campeonato.</span>
        <span className={s.spacer} />
        <button type="button" className={s.primary} onClick={onContinue}>Continuar<ArrowRight size={16} aria-hidden="true" /></button>
      </footer>
    </div>
  );
}
