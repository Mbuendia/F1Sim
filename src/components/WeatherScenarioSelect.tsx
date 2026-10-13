import React from 'react';
import { Cloud, CloudDrizzle, CloudLightning, CloudRain, Sun } from 'lucide-react';
import { WEATHER_SCENARIOS } from '../data/weatherScenarios';
import { Segmented } from './ui/Segmented';
import ui from './ui/ui.module.css';

interface WeatherScenarioSelectProps {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

const ICONS: Record<string, typeof Sun> = { seco: Sun, nubes: Cloud, chubasco: CloudDrizzle, 'mojado-inicial': CloudRain, tormenta: CloudLightning };

/** [R44] Meteorología de la carrera, elegida en el paddock. [V5] Un icono por escenario, sin desplegable. */
export const WeatherScenarioSelect: React.FC<WeatherScenarioSelectProps> = ({ value, onChange, className }) => {
  const current = WEATHER_SCENARIOS.find(s => s.id === value) ?? WEATHER_SCENARIOS[0];
  return (
    <div className={`${ui.field} ${className ?? ''}`} title={current.description}>
      Meteorología · {current.label}
      <Segmented compact label="Meteorología de la carrera" name="meteorologia" value={current.id} onChange={onChange}
        options={WEATHER_SCENARIOS.map(s => { const Icon = ICONS[s.id] ?? Cloud; return { value: s.id, label: s.label, title: `${s.label}: ${s.description}`, content: <Icon size={20} aria-hidden="true" /> }; })} />
    </div>
  );
};
