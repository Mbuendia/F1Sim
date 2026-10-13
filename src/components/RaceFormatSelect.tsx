import React from 'react';
import { Flag, Timer, Zap } from 'lucide-react';
import { Segmented } from './ui/Segmented';
import ui from './ui/ui.module.css';

export type RaceFormatId = 'directo' | 'clasificacion' | 'sprint';

interface RaceFormatSelectProps {
  value: RaceFormatId;
  onChange: (value: RaceFormatId) => void;
  className?: string;
  /** [R52] El circuito elegido tiene fin de semana sprint (y su sprint aún no se ha corrido). */
  sprintAvailable?: boolean;
}

/**
 * [R20] Formato del fin de semana: GP directo (parrilla prefijada), con clasificación o, donde lo hay, sprint (R52).
 * [V5] Opciones a la vista en un control segmentado, sin desplegable.
 */
export const RaceFormatSelect: React.FC<RaceFormatSelectProps> = ({ value, onChange, className, sprintAvailable = false }) => (
  <div className={`${ui.field} ${className ?? ''}`} title="Con clasificación, la parrilla sale de Q1, Q2 y Q3; el GP directo usa la parrilla prefijada">
    Formato
    <Segmented wrap label="Formato del Gran Premio" name="formato-gp" value={value === 'sprint' && !sprintAvailable ? 'clasificacion' : value} onChange={onChange}
      options={[
        ...(sprintAvailable ? [{ value: 'sprint' as const, label: 'Sprint', title: 'Fin de semana sprint (clasificación sprint y sprint)', content: <><Zap size={16} aria-hidden="true" />Sprint</> }] : []),
        { value: 'directo' as const, label: 'GP directo', title: 'GP directo (parrilla prefijada)', content: <><Flag size={16} aria-hidden="true" />Directo</> },
        { value: 'clasificacion' as const, label: 'Con clasificación', title: 'Con clasificación (Q1, Q2 y Q3)', content: <><Timer size={16} aria-hidden="true" />Clasificación</> },
      ]} />
  </div>
);
