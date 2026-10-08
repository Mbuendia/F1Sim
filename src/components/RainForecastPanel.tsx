import React from 'react';
import type { RainForecast } from '../simulation/WeatherForecast';

interface RainForecastPanelProps {
  forecast: RainForecast | null | undefined;
  /** [T3.2] Nubosidad actual (0-100 %). */
  cloudCoverPct?: number;
}

const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));
const cell: React.CSSProperties = { padding: '2px 6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' };

/** [R53] Previsión del radar: cuándo se espera la lluvia (con su margen) y probabilidad por tramos de tiempo y por sector. */
export const RainForecastPanel: React.FC<RainForecastPanelProps> = ({ forecast, cloudCoverPct }) => {
  if (!forecast) return null;
  const headline = forecast.rainingNow
    ? (forecast.dryInSec === null ? 'Llueve y sigue más de 20 min' : `Llueve: para en unos ${minutes(forecast.dryInSec)} min (±${minutes(forecast.dryMarginSec ?? 0)})`)
    : forecast.nextRainInSec === null ? 'Sin lluvia a la vista en 20 min'
    : `Lluvia en unos ${minutes(forecast.nextRainInSec)} min (±${minutes(forecast.nextRainMarginSec ?? 0)})`;
  return (
    <section aria-label="Previsión de lluvia" style={{ margin: '8px 0', padding: '8px 10px', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 8, fontSize: 12, color: '#e2e8f0' }}>
      <strong>Previsión del radar · {headline}</strong>
      {cloudCoverPct !== undefined && <div style={{ marginTop: 4, color: '#cbd5e1' }}>{cloudCoverPct >= 70 ? '☁️' : cloudCoverPct >= 20 ? '⛅' : '☀️'} Nubosidad: {cloudCoverPct} %</div>}
      <table style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...cell, textAlign: 'left' }}>Minutos</th>
            {forecast.slots.map(slot => <th key={slot.fromMin} style={cell}>{slot.fromMin}–{slot.toMin}</th>)}
          </tr>
        </thead>
        <tbody>
          {forecast.slots[0].sectors.map((_, sector) => (
            <tr key={sector}>
              <th style={{ ...cell, textAlign: 'left' }}>S{sector + 1}</th>
              {forecast.slots.map(slot => {
                const { probability, rainMmH } = slot.sectors[sector];
                return (
                  <td key={slot.fromMin} style={{ ...cell, background: `rgba(56, 189, 248, ${(probability * 0.45).toFixed(2)})` }} title={`${rainMmH.toFixed(1)} mm/h previstos`}>
                    {Math.round(probability * 100)}%
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th style={{ ...cell, textAlign: 'left' }}>Margen</th>
            {forecast.slots.map(slot => <td key={slot.fromMin} style={{ ...cell, color: '#94a3b8' }}>±{Math.round(slot.uncertainty * 100)}</td>)}
          </tr>
        </tbody>
      </table>
    </section>
  );
};
