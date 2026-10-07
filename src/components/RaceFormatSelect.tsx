import React from 'react';

export type RaceFormatId = 'directo' | 'clasificacion' | 'sprint';

interface RaceFormatSelectProps {
  value: RaceFormatId;
  onChange: (value: RaceFormatId) => void;
  className?: string;
  /** [R52] El circuito elegido tiene fin de semana sprint (y su sprint aún no se ha corrido). */
  sprintAvailable?: boolean;
}

/** [R20] Formato del fin de semana: GP directo (parrilla prefijada), con clasificación o, donde lo hay, sprint (R52). */
export const RaceFormatSelect: React.FC<RaceFormatSelectProps> = ({ value, onChange, className, sprintAvailable = false }) => (
  <label className={className} title="Con clasificación, la parrilla sale de Q1, Q2 y Q3; el GP directo usa la parrilla prefijada">
    Formato:{' '}
    <select value={value === 'sprint' && !sprintAvailable ? 'clasificacion' : value} onChange={event => onChange(event.target.value as RaceFormatId)} aria-label="Formato del Gran Premio">
      {sprintAvailable && <option value="sprint">Fin de semana sprint (clasificación sprint y sprint)</option>}
      <option value="directo">GP directo (parrilla prefijada)</option>
      <option value="clasificacion">Con clasificación (Q1, Q2 y Q3)</option>
    </select>
  </label>
);
