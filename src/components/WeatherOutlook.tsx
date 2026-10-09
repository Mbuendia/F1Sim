import React from 'react';

/** Cómo se cuenta una probabilidad de lluvia (los tramos son diseño del juego). */
const outlookLabel = (percent: number) =>
  percent < 10 ? 'tiempo estable' : percent < 30 ? 'riesgo bajo de lluvia' : percent < 50 ? 'tiempo inestable' : 'lluvia probable';

/**
 * [T4.12] Previsión del paddock para una carrera de temporada: la probabilidad de lluvia del circuito. El tiempo de la
 * carrera se sortea con ella y no se elige; lo que haya salido se ve en pista y en el radar.
 */
export const WeatherOutlook: React.FC<{ rainProbabilityPercent: number; className?: string }> = ({ rainProbabilityPercent, className }) => {
  const percent = Math.round(Math.min(100, Math.max(0, rainProbabilityPercent)));
  return (
    <div className={className} title="En una carrera de temporada el tiempo se sortea con la probabilidad de lluvia del circuito: no se puede elegir">
      Previsión: <strong>lluvia {percent} %</strong> · {outlookLabel(percent)}
    </div>
  );
};
