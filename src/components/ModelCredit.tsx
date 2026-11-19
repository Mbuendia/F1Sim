import React from 'react';
import { MODEL_CREDITS } from '../data/liveries';

interface ModelCreditProps {
  model: keyof typeof MODEL_CREDITS;
}

/** [R55] Atribución visible del modelo 3D de terceros que se muestra al lado (lo piden sus licencias Creative Commons). */
export const ModelCredit: React.FC<ModelCreditProps> = ({ model }) => {
  const credit = MODEL_CREDITS[model];
  // [TL7] El coche de 2024 es un modelo propio del autor del juego: sin enlace ni licencia de terceros.
  if (!credit.source) {
    return <small style={{ display: 'block', marginTop: 4, color: '#94a3b8', fontSize: 11, lineHeight: 1.3, textAlign: 'center' }}>Modelo 3D: «{credit.title}», modelo propio del autor del juego.</small>;
  }
  return (
    <small style={{ display: 'block', marginTop: 4, color: '#94a3b8', fontSize: 11, lineHeight: 1.3, textAlign: 'center', pointerEvents: 'auto' }}>
      Modelo 3D: <a href={credit.source} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>«{credit.title}»</a> de {credit.author},{' '}
      <a href={credit.licenseUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{credit.license}</a>, modificado.
    </small>
  );
};
