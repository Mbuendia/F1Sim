import type { ReactNode } from 'react';
import { balanceByRound, balanceOf, debtOf, FINANCE, formatMoney, interestOn, LEDGER_KIND_LABEL, ledgerOf, roundForecast } from '../simulation/Finance';
import type { FinanceState, LedgerEntry } from '../simulation/Finance';
import m from './Management.module.css';

/** Suma por concepto de los movimientos de esta temporada con ese signo (sin el saldo inicial ni el arrastrado). */
function byKind(entries: LedgerEntry[], sign: 1 | -1): { label: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind === 'inicial' || entry.kind === 'arrastre' || Math.sign(entry.amount) !== sign) continue;
    const label = LEDGER_KIND_LABEL[entry.kind] ?? entry.kind;
    totals.set(label, (totals.get(label) ?? 0) + entry.amount);
  }
  return [...totals].map(([label, amount]) => ({ label, amount })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

/** Saldo ronda a ronda de la temporada, con la línea del cero cuando hay deuda. */
function BalanceChart({ points }: { points: { round: number; balance: number }[] }) {
  const width = 700, height = 96, pad = 10;
  const values = points.map(point => point.balance);
  const top = Math.max(0, ...values), bottom = Math.min(0, ...values), range = top - bottom || 1;
  const x = (round: number) => pad + (round / 24) * (width - 2 * pad);
  const y = (value: number) => pad + ((top - value) / range) * (height - 2 * pad);
  const path = points.map((point, i) => `${i ? 'L' : 'M'}${x(point.round).toFixed(1)} ${y(point.balance).toFixed(1)}`).join(' ');
  return (
    <svg className={m.chart} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Saldo ronda a ronda de la temporada">
      <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />
      <path d={path} fill="none" stroke="var(--equipo)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      {points.map(point => <circle key={point.round} cx={x(point.round)} cy={y(point.balance)} r={3} fill="var(--equipo)" />)}
    </svg>
  );
}

/**
 * [T4.1] Finanzas del equipo: saldo (o deuda con su límite), previsión de la ronda siguiente, saldo ronda a ronda,
 * ingresos y gastos de la temporada por concepto y el libro completo. `children` son las tarjetas que añaden otras
 * tareas en la misma página (patrocinio, junta).
 */
export function FinancePanel({ finance, teamId, children }: { finance: FinanceState; teamId: string; children?: ReactNode }) {
  const balance = balanceOf(finance, teamId), debt = debtOf(finance, teamId), forecast = roundForecast(finance, teamId);
  const season = ledgerOf(finance, teamId).filter(entry => entry.season === finance.season);
  const income = byKind(season, 1), costs = byKind(season, -1);
  const sum = (lines: { amount: number }[]) => lines.reduce((total, line) => total + line.amount, 0);
  const tone = (amount: number) => (amount > 0 ? m.pos : amount < 0 ? m.neg : '');
  return (
    <section className={m.finance} aria-label="Finanzas del equipo">
      <div className={`${m.card} ${m.stack}`}>
        <span className={m.label}>{debt > 0 ? 'Deuda' : 'Saldo'}</span>
        <span className={`${m.big} ${debt > 0 ? m.neg : ''}`}>{formatMoney(debt > 0 ? debt : balance)}</span>
        <span className={m.muted}>Próxima ronda: <b className={tone(forecast.net)}>{formatMoney(forecast.net, true)}</b> <span className={m.dim}>sin contar puntos</span></span>
        {debt > 0
          ? <span className={m.muted}>Préstamo: {formatMoney(debt)} de {formatMoney(FINANCE.DEBT_LIMIT)} · intereses de la ronda: {formatMoney(interestOn(balance))}</span>
          : <span className={m.muted}>Sin deuda · límite del préstamo {formatMoney(FINANCE.DEBT_LIMIT)}</span>}
        <span className={m.dim}>En negativo se pagan intereses cada ronda; en el límite no se pueden empezar gastos nuevos.</span>
      </div>
      <div className={`${m.card} ${m.span3}`}>
        <span className={m.label}>Saldo ronda a ronda · temporada {finance.season}</span>
        <BalanceChart points={balanceByRound(finance, teamId)} />
        <div className={`${m.row} ${m.between} ${m.dim}`}><span>inicio</span><span>ronda 12</span><span>ronda 24</span></div>
      </div>
      <div className={`${m.card} ${children ? '' : m.span2}`}>
        <span className={m.label}>Ingresos de la temporada</span>
        <div className={m.lines}>
          {income.map(line => <div key={line.label}><span>{line.label}</span><span className={`${m.num} ${m.pos}`}>{formatMoney(line.amount, true)}</span></div>)}
          <div><span>Total</span><span className={`${m.num} ${m.pos}`}>{formatMoney(sum(income), true)}</span></div>
        </div>
      </div>
      <div className={`${m.card} ${children ? '' : m.span2}`}>
        <span className={m.label}>Gastos de la temporada</span>
        <div className={m.lines}>
          {costs.map(line => <div key={line.label}><span>{line.label}</span><span className={`${m.num} ${m.neg}`}>{formatMoney(line.amount, true)}</span></div>)}
          <div><span>Total</span><span className={`${m.num} ${m.neg}`}>{formatMoney(sum(costs), true)}</span></div>
        </div>
      </div>
      {children}
      <div className={`${m.card} ${m.full} ${m.ledger}`}>
        <span className={m.label}>Libro</span>
        <table className={m.table}>
          <thead><tr><th>Ronda</th><th>Concepto</th><th className={m.right}>Importe</th></tr></thead>
          <tbody>
            {[...season].reverse().map((entry, i) => (
              <tr key={`${entry.round}-${entry.kind}-${i}`}>
                <td className={m.num}>{entry.round === 0 ? 'inicio' : entry.round}</td>
                <td>{entry.label}</td>
                <td className={`${m.right} ${m.num} ${tone(entry.amount)}`}>{formatMoney(entry.amount, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
