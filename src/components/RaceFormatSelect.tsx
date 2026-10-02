import React from 'react';

export type RaceFormatId = 'directo' | 'clasificacion';

interface RaceFormatSelectProps {
  value: RaceFormatId;
  onChange: (value: RaceFormatId) => void;
  className?: string;
}

/** [R20] Formato del fin de semana: GP directo (parrilla prefijada) o con clasificación. */
export const RaceFormatSelect: React.FC<RaceFormatSelectProps> = ({ value, onChange, className }) => (
  <label className={className} title="Con clasificación, la parrilla sale de Q1, Q2 y Q3; el GP directo usa la parrilla prefijada">
    Formato:{' '}
    <select value={value} onChange={event => onChange(event.target.value as RaceFormatId)} aria-label="Formato del Gran Premio">
      <option value="directo">GP directo (parrilla prefijada)</option>
      <option value="clasificacion">Con clasificación (Q1, Q2 y Q3)</option>
    </select>
  </label>
);
