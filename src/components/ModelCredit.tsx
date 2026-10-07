import React from 'react';
import { MODEL_CREDITS } from '../data/liveries';

interface ModelCreditProps {
  model: keyof typeof MODEL_CREDITS;
}

/** [R55] Atribución visible del modelo 3D de terceros que se muestra al lado (lo piden sus licencias Creative Commons). */
export const ModelCredit: React.FC<ModelCreditProps> = ({ model }) => {
  const credit = MODEL_CREDITS[model];
  return (
    <small style={{ display: 'block', marginTop: 4, color: '#94a3b8', fontSize: 11, lineHeight: 1.3, textAlign: 'center', pointerEvents: 'auto' }}>
      Modelo 3D: <a href={credit.source} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>«{credit.title}»</a> de {credit.author},{' '}
      <a href={credit.licenseUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{credit.license}</a>, modificado.
    </small>
  );
};
