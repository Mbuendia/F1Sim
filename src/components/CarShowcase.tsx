import React, { lazy, Suspense, useEffect, useState } from 'react';
import { F1CarSilhouette } from './F1CarSilhouette';

// [R46] El visor 3D es un módulo aparte: solo se descarga al mostrar la vitrina con WebGL disponible.
const Car3DViewer = lazy(() => import('./Car3DViewer'));

interface CarShowcaseProps {
  teamColor: string;
  accentColor: string;
  number: number;
  compound: string;
  label?: string;
  className?: string;
}

/** Comprueba si el navegador puede crear un contexto WebGL, sin lanzar errores. */
export function supportsWebGL(doc: Pick<Document, 'createElement'> | undefined = typeof document !== 'undefined' ? document : undefined): boolean {
  try {
    if (!doc) return false;
    const canvas = doc.createElement('canvas') as HTMLCanvasElement;
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Vitrina del monoplaza: visor 3D girable o, sin WebGL (o mientras carga), la silueta 2D. */
export const CarShowcase: React.FC<CarShowcaseProps> = ({ teamColor, accentColor, number, compound, label = 'Monoplaza', className }) => {
  const [webgl, setWebgl] = useState(false);
  useEffect(() => { setWebgl(supportsWebGL()); }, []);
  const fallback = <F1CarSilhouette teamColor={teamColor} width={260} label={label} />;
  return (
    <div className={className} data-car-showcase={webgl ? '3d' : '2d'} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 190 }}>
      {webgl
        ? <Suspense fallback={fallback}><Car3DViewer teamColor={teamColor} accentColor={accentColor} number={number} compound={compound} label={label} /></Suspense>
        : fallback}
    </div>
  );
};
