import React from 'react';
import { WEATHER_SCENARIOS } from '../data/weatherScenarios';

interface WeatherScenarioSelectProps {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/** [R44] Meteorología de la carrera, elegida en el paddock. */
export const WeatherScenarioSelect: React.FC<WeatherScenarioSelectProps> = ({ value, onChange, className }) => {
  const current = WEATHER_SCENARIOS.find(s => s.id === value) ?? WEATHER_SCENARIOS[0];
  return (
    <label className={className} title={current.description}>
      Meteorología:{' '}
      <select value={current.id} onChange={event => onChange(event.target.value)} aria-label="Meteorología de la carrera">
        {WEATHER_SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </label>
  );
};
