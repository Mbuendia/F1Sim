import React from 'react';
import panel from './QualifyingResults.module.css';
import type { PenaltyLine } from '../simulation/ComponentPool';

interface GridPenaltyNoticeProps {
  lines: PenaltyLine[];
  onContinue: () => void;
}

/** [R51] Aviso previo a la salida en GP directo: sanciones de parrilla por componentes fuera de cupo. */
export const GridPenaltyNotice: React.FC<GridPenaltyNoticeProps> = ({ lines, onContinue }) => {
  if (!lines.length) return null;
  return (
    <section className={panel.panel} aria-label="Sanciones de parrilla">
      <h2 className={panel.title}>Sanciones de parrilla</h2>
      <p className={panel.pole}>Componentes de la unidad de potencia fuera de cupo: la parrilla cambia antes de la salida.</p>
      <div className={panel.scroll}>
        <table className={panel.table}>
          <thead><tr><th>Piloto</th><th>Sanción</th><th>Parrilla</th><th>Motivo</th></tr></thead>
          <tbody>
            {lines.map(line => (
              <tr key={line.driverId}>
                <td>{line.name}</td>
                <td className={panel.penalty}>{line.places} puestos</td>
                <td>{line.backOfGrid ? `Sale desde el fondo de la parrilla: de P${line.from} a P${line.to}` : `De P${line.from} a P${line.to}`}</td>
                <td>{line.reasons.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className={panel.continue} onClick={onContinue}>Continuar a la parrilla</button>
    </section>
  );
};
